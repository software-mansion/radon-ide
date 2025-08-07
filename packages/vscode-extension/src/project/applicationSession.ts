import path from "path";
import fs from "fs";
import {
  commands,
  window,
  DebugSessionCustomEvent,
  Disposable,
  extensions,
  Uri,
  workspace,
  EventEmitter,
} from "vscode";
import { DebugSession, DebugSessionImpl, DebugSource } from "../debugging/DebugSession";
import { ApplicationContext } from "./ApplicationContext";
import { MetroLauncher } from "./metro";
import { ReconnectingDebugSession } from "../debugging/ReconnectingDebugSession";
import { DeviceBase } from "../devices/DeviceBase";
import { Devtools } from "./devtools";
import { Logger } from "../Logger";
import {
  ApplicationSessionState,
  AppOrientation,
  BundleErrorDescriptor,
  DeviceRotation,
  ProfilingState,
  StartupMessage,
  ToolsState,
} from "../common/Project";
import { disposeAll } from "../utilities/disposables";
import { ToolKey, ToolPlugin, ToolsDelegate, ToolsManager } from "./tools";
import { focusSource } from "../utilities/focusSource";
import { CancelToken } from "../utilities/cancelToken";
import { BuildResult } from "../builders/BuildManager";
import { DevicePlatform } from "../common/State";

interface LaunchApplicationSessionDeps {
  applicationContext: ApplicationContext;
  device: DeviceBase;
  buildResult: BuildResult;
  metro: MetroLauncher;
  devtools: Devtools;
}

export class ApplicationSession implements ToolsDelegate, Disposable {
  private disposables: Disposable[] = [];
  private debugSession?: DebugSession & Disposable;
  private debugSessionEventSubscription?: Disposable;
  private toolsManager: ToolsManager;
  private bundleError: BundleErrorDescriptor | undefined;
  private logCounter = 0;
  private isDebuggerPaused = false;
  private profilingCPUState: ProfilingState = "stopped";
  private profilingReactState: ProfilingState = "stopped";
  private isRefreshing: boolean = false;
  private appOrientation: DeviceRotation | undefined;
  private isActive = false;

  private stateChangedEventEmitter = new EventEmitter<void>();

  public readonly onStateChanged = this.stateChangedEventEmitter.event;

  public static async launch(
    { applicationContext, device, buildResult, metro, devtools }: LaunchApplicationSessionDeps,
    getIsActive: () => boolean,
    onLaunchStage: (stage: StartupMessage) => void,
    cancelToken: CancelToken
  ): Promise<ApplicationSession> {
    const packageNameOrBundleId =
      buildResult.platform === DevicePlatform.IOS ? buildResult.bundleID : buildResult.packageName;
    const session = new ApplicationSession(device, metro, devtools, packageNameOrBundleId);
    if (getIsActive()) {
      // we need to start the parent debug session asap to ensure metro errors are shown in the debug console
      await session.setupDebugSession();
    }
    const launchConfig = applicationContext.launchConfig;
    const launchArguments =
      (device.deviceInfo.platform === DevicePlatform.IOS && launchConfig.ios?.launchArguments) ||
      [];

    onLaunchStage(StartupMessage.StartingPackager);
    await cancelToken.adapt(metro.ready());

    const { promise: bundleErrorPromise, resolve: resolveBundleError } =
      Promise.withResolvers<void>();
    const bundleErrorSubscription = metro.onBundleError(({ source }) => {
      resolveBundleError();
      if (getIsActive()) {
        focusSource(source);
      }
    });

    try {
      onLaunchStage(StartupMessage.Launching);
      await cancelToken.adapt(
        device.launchApp(buildResult, metro.port, devtools.port, launchArguments)
      );

      onLaunchStage(StartupMessage.WaitingForAppToLoad);
      await cancelToken.adapt(Promise.race([devtools.appReady(), bundleErrorPromise]));

      if (getIsActive()) {
        const activatePromise = session.activate();
        const hasBundleError = session.bundleError !== undefined;
        // NOTE: if an initial bundle error occurred, the app won't connect to Metro
        // and we won't be able to attach the debugger anyway, so there's no point in waiting
        if (!hasBundleError) {
          onLaunchStage(StartupMessage.AttachingDebugger);
          await cancelToken.adapt(activatePromise);
        }
      }

      return session;
    } catch (e) {
      session.dispose();
      throw e;
    } finally {
      bundleErrorSubscription.dispose();
    }
  }

  private constructor(
    private readonly device: DeviceBase,
    private readonly metro: MetroLauncher,
    private readonly devtools: Devtools,
    private readonly packageNameOrBundleId: string
  ) {
    this.registerDevtoolsListeners();
    this.registerMetroListeners();
    this.toolsManager = new ToolsManager(this.devtools, this);
    this.disposables.push(this.stateChangedEventEmitter);
  }

  public get state(): ApplicationSessionState {
    return {
      profilingCPUState: this.profilingCPUState,
      profilingReactState: this.profilingReactState,
      toolsState: this.toolsManager.getToolsState(),
      isDebuggerPaused: this.isDebuggerPaused,
      logCounter: this.logCounter,
      isRefreshing: this.isRefreshing,
      bundleError: this.bundleError,
      appOrientation: this.appOrientation,
    };
  }

  private emitStateChange() {
    this.stateChangedEventEmitter.fire();
  }

  private async setupDebugSession(): Promise<void> {
    this.debugSession = await this.createDebugSession();
    this.debugSessionEventSubscription = this.registerDebugSessionListeners(this.debugSession);
  }

  private async createDebugSession(): Promise<DebugSession & Disposable> {
    const session = new ReconnectingDebugSession(
      new DebugSessionImpl({
        displayName: this.device.deviceInfo.displayName,
        useParentDebugSession: true,
      }),
      this.metro,
      this.devtools
    );

    await session.startParentDebugSession();

    return session;
  }

  //#region ToolsDelegate implementation

  onToolsStateChange(toolsState: ToolsState): void {
    this.emitStateChange();
  }

  //#endregion

  public async updateToolEnabledState(toolName: ToolKey, enabled: boolean) {
    this.toolsManager.updateToolEnabledState(toolName, enabled);
  }

  public openTool(toolName: ToolKey): void {
    this.toolsManager.openTool(toolName);
  }

  public getPlugin(toolName: ToolKey): ToolPlugin | undefined {
    return this.toolsManager.getPlugin(toolName);
  }

  //#region Debug session event listeners

  private onConsoleLog = (event: DebugSessionCustomEvent): void => {
    this.logCounter += 1;
    this.emitStateChange();
  };

  private onDebuggerPaused = (event: DebugSessionCustomEvent): void => {
    this.isDebuggerPaused = true;
    this.emitStateChange();

    if (this.isActive) {
      commands.executeCommand("workbench.view.debug");
    }
  };

  private onDebuggerResumed = (event: DebugSessionCustomEvent): void => {
    this.isDebuggerPaused = false;
    this.emitStateChange();
  };

  private onProfilingCPUStarted = (event: DebugSessionCustomEvent): void => {
    this.profilingCPUState = "profiling";
    this.emitStateChange();
  };

  private onProfilingCPUStopped = (event: DebugSessionCustomEvent): void => {
    this.profilingCPUState = "stopped";
    this.emitStateChange();
    if (event.body?.filePath) {
      this.saveAndOpenCPUProfile(event.body.filePath);
    }
  };

  private registerDebugSessionListeners(debugSession: DebugSession): Disposable {
    const subscriptions: Disposable[] = [
      debugSession.onConsoleLog(this.onConsoleLog),
      debugSession.onDebuggerPaused(this.onDebuggerPaused),
      debugSession.onDebuggerResumed(this.onDebuggerResumed),
      debugSession.onProfilingCPUStarted(this.onProfilingCPUStarted),
      debugSession.onProfilingCPUStopped(this.onProfilingCPUStopped),
    ];
    return new Disposable(() => {
      disposeAll(subscriptions);
    });
  }

  //#endregion

  //#region Metro event listeners

  private async onBundleError(message: string, source: DebugSource) {
    Logger.error("[Bundling Error]", message);
    this.bundleError = {
      kind: "bundle",
      message,
    };
    this.emitStateChange();
    await this.debugSession?.appendDebugConsoleEntry(message, "error", source);
  }

  private registerMetroListeners() {
    this.disposables.push(
      this.metro.onBundleError(({ message, source }) => this.onBundleError(message, source))
    );
  }

  //#endregion

  public async activate(): Promise<void> {
    if (!this.isActive) {
      this.isActive = true;
      this.toolsManager.activate();
      if (this.debugSession === undefined) {
        await this.setupDebugSession();
      }
      await this.connectJSDebugger();
    }
  }

  public async deactivate(): Promise<void> {
    this.isActive = false;
    this.toolsManager.deactivate();
    // detaching debugger will also stop the debug console, after switching back
    // to the device session, we won't be able to see the logs from the previous session
    // hence we reset the log counter.
    this.logCounter = 0;
    this.emitStateChange();
    this.debugSessionEventSubscription?.dispose();
    const debugSession = this.debugSession;
    this.debugSession = undefined;
    await debugSession?.dispose();
    this.debugSessionEventSubscription = undefined;
  }

  //#region Debugger control
  public resumeDebugger() {
    this.debugSession?.resumeDebugger();
  }

  public stepOverDebugger() {
    this.debugSession?.stepOverDebugger();
  }

  private async connectJSDebugger() {
    const websocketAddress = await this.metro.getDebuggerURL();
    if (!websocketAddress) {
      Logger.error("Couldn't find a proper debugger URL to connect to");
      return;
    }
    if (this.debugSession === undefined) {
      // the application session was deactivated in the meantime, we don't need to connect the debugger
      return;
    }
    await this.debugSession.startJSDebugSession({
      websocketAddress,
      displayDebuggerOverlay: false,
      isUsingNewDebugger: this.metro.isUsingNewDebugger,
      expoPreludeLineCount: this.metro.expoPreludeLineCount,
      sourceMapPathOverrides: this.metro.sourceMapPathOverrides,
    });
  }

  private registerDevtoolsListeners() {
    this.disposables.push(
      this.devtools.onEvent("appReady", () => {
        // NOTE: since this is triggered by the JS bundle,
        // we can assume that if it fires, the bundle loaded successfully.
        // This is necessary to reset the bundle error state when the app reload
        // is triggered from the app itself (e.g. by in-app dev menu or redbox).
        this.bundleError = undefined;
      }),
      this.devtools.onEvent("fastRefreshStarted", () => {
        this.isRefreshing = true;
        this.bundleError = undefined;
        this.emitStateChange();
      }),
      this.devtools.onEvent("fastRefreshComplete", () => {
        this.isRefreshing = false;
        this.emitStateChange();
      }),
      this.devtools.onEvent("isProfilingReact", (isProfiling) => {
        if (this.profilingReactState !== "saving") {
          this.profilingReactState = isProfiling ? "profiling" : "stopped";
          this.emitStateChange();
        }
      }),
      this.devtools.onEvent("appOrientationChanged", (orientation: AppOrientation) => {
        const isLandscape =
          this.device.rotation === DeviceRotation.LandscapeLeft ||
          this.device.rotation === DeviceRotation.LandscapeRight;

        if (orientation === "Landscape") {
          // if the app orientation is equal to "Landscape", it means we do not have enough
          // information on the application side to infer the detailed orientation.
          if (isLandscape) {
            // if the device is in landscape mode, we assume that the app orientation is correct with device rotation
            this.appOrientation = this.device.rotation;
          } else {
            // if the device is not in landscape mode we set app orientation to the last known orientation.
            // if the last orientation is not known, we assume the application was started in Landscape mode
            // while the device was oriented in Portrait, and we pick `LandscapeLeft` as the default orientation in that case.
            this.appOrientation = this.appOrientation ?? DeviceRotation.LandscapeLeft;
          }
        } else {
          this.appOrientation = orientation;
        }

        this.emitStateChange();
      })
    );
  }
  //#endregion

  public async reloadJS() {
    if (!this.devtools.hasConnectedClient) {
      Logger.debug(
        "`reloadJS()` was called on an application session while the devtools are not connected. " +
          "This should never happen, since an application session should represent a running and connected application."
      );
      throw new Error("Tried to reload JS on an application which disconnected from Radon");
    }
    const { promise: bundleErrorPromise, reject } = Promise.withResolvers();
    const bundleErrorSubscription = this.metro.onBundleError(() => {
      reject(new Error("Bundle error occurred during reload"));
    });
    try {
      await this.metro.reload();
      await Promise.race([this.devtools.appReady(), bundleErrorPromise]);
    } finally {
      bundleErrorSubscription.dispose();
    }
  }

  //#region CPU Profiling
  public async startProfilingCPU(): Promise<void> {
    await this.debugSession?.startProfilingCPU();
  }

  public async stopProfilingCPU(): Promise<void> {
    await this.debugSession?.stopProfilingCPU();
  }

  private async saveAndOpenCPUProfile(tempFilePath: string) {
    // Show save dialog to save the profile file to the workspace folder:
    let defaultUri = Uri.file(tempFilePath);
    const workspaceFolder = workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      defaultUri = Uri.file(path.join(workspaceFolder.uri.fsPath, path.basename(tempFilePath)));
    }

    const saveDialog = await window.showSaveDialog({
      defaultUri,
      filters: {
        "CPU Profile": ["cpuprofile"],
      },
    });

    if (saveDialog) {
      await fs.promises.copyFile(tempFilePath, saveDialog.fsPath);
      commands.executeCommand("vscode.open", Uri.file(saveDialog.fsPath));

      // verify whether flame chart visualizer extension is installed
      // flame chart visualizer is not necessary to open the cpuprofile file, but when it is installed,
      // the user can use the flame button from cpuprofile view to visualize it differently
      const flameChartExtension = extensions.getExtension("ms-vscode.vscode-js-profile-flame");
      if (!flameChartExtension) {
        const GO_TO_EXTENSION_BUTTON = "Go to Extension";
        window
          .showInformationMessage(
            "Flame Chart Visualizer extension is not installed. It is recommended to install it for better profiling insights.",
            GO_TO_EXTENSION_BUTTON
          )
          .then((action) => {
            if (action === GO_TO_EXTENSION_BUTTON) {
              commands.executeCommand(
                "workbench.extensions.search",
                "ms-vscode.vscode-js-profile-flame"
              );
            }
          });
      }
    }
  }
  //#endregion

  //#region React Profiling
  public async startProfilingReact() {
    return await this.devtools.startProfilingReact();
  }

  public async stopProfilingReact() {
    try {
      return await this.devtools.stopProfilingReact();
    } finally {
      this.profilingReactState = "stopped";
      this.emitStateChange();
    }
  }
  //#endregion

  public resetLogCounter() {
    this.logCounter = 0;
    this.emitStateChange();
  }

  public async dispose() {
    disposeAll(this.disposables);
    this.debugSessionEventSubscription?.dispose();
    await this.debugSession?.dispose();
    this.debugSession = undefined;
    this.device.terminateApp(this.packageNameOrBundleId);
  }
}
