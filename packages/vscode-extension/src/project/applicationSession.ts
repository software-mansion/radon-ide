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
} from "vscode";
import { minimatch } from "minimatch";
import { DebugSession, DebugSessionImpl, DebugSource } from "../debugging/DebugSession";
import { ApplicationContext } from "./ApplicationContext";
import { MetroLauncher } from "./metro";
import { ReconnectingDebugSession } from "../debugging/ReconnectingDebugSession";
import { DeviceBase } from "../devices/DeviceBase";
import { Devtools } from "./devtools";
import { Logger } from "../Logger";
import { AppOrientation, InspectData, StartupMessage } from "../common/Project";
import { disposeAll } from "../utilities/disposables";
import { ToolKey, ToolPlugin, ToolsManager } from "./tools";
import { focusSource } from "../utilities/focusSource";
import { CancelToken } from "../utilities/cancelToken";
import { BuildResult } from "../builders/BuildManager";
import {
  ApplicationSessionState,
  DevicePlatform,
  DeviceRotation,
  DeviceType,
  InspectorAvailabilityStatus,
  InspectorBridgeStatus,
} from "../common/State";
import { isAppSourceFile } from "../utilities/isAppSourceFile";
import { StateManager } from "./StateManager";

interface LaunchApplicationSessionDeps {
  applicationContext: ApplicationContext;
  device: DeviceBase;
  buildResult: BuildResult;
  metro: MetroLauncher;
  devtools: Devtools;
}

export class ApplicationSession implements Disposable {
  private disposables: Disposable[] = [];
  private debugSession?: DebugSession & Disposable;
  private debugSessionEventSubscription?: Disposable;
  private toolsManager: ToolsManager;
  private isActive = false;
  private inspectCallID = 7621;

  public static async launch(
    stateManager: StateManager<ApplicationSessionState>,
    { applicationContext, device, buildResult, metro, devtools }: LaunchApplicationSessionDeps,
    getIsActive: () => boolean,
    onLaunchStage: (stage: StartupMessage) => void,
    cancelToken: CancelToken
  ): Promise<ApplicationSession> {
    const packageNameOrBundleId =
      buildResult.platform === DevicePlatform.IOS ? buildResult.bundleID : buildResult.packageName;
    const supportedOrientations =
      buildResult.platform === DevicePlatform.IOS ? buildResult.supportedInterfaceOrientations : [];
    const session = new ApplicationSession(
      stateManager,
      applicationContext,
      device,
      metro,
      devtools,
      packageNameOrBundleId,
      supportedOrientations
    );
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
        const hasBundleError = stateManager.getState().bundleError !== undefined;
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
    private readonly stateManager: StateManager<ApplicationSessionState>,
    private readonly applicationContext: ApplicationContext,
    private readonly device: DeviceBase,
    private readonly metro: MetroLauncher,
    private readonly devtools: Devtools,
    private readonly packageNameOrBundleId: string,
    private readonly supportedOrientations: DeviceRotation[]
  ) {
    this.registerDevtoolsListeners();
    this.registerMetroListeners();
    this.toolsManager = new ToolsManager(this.stateManager.getDerived("toolsState"), this.devtools);

    this.disposables.push(this.stateManager);
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

  // #region Tools

  public async updateToolEnabledState(toolName: ToolKey, enabled: boolean) {
    this.toolsManager.updateToolEnabledState(toolName, enabled);
  }

  public openTool(toolName: ToolKey): void {
    this.toolsManager.openTool(toolName);
  }

  public getPlugin(toolName: ToolKey): ToolPlugin | undefined {
    return this.toolsManager.getPlugin(toolName);
  }

  // #endregion Tools

  //#region Debug session event listeners

  private onConsoleLog = (event: DebugSessionCustomEvent): void => {
    const currentLogCount = this.stateManager.getState().logCounter;
    this.stateManager.setState({ logCounter: currentLogCount + 1 });
  };

  private onDebuggerPaused = (event: DebugSessionCustomEvent): void => {
    this.stateManager.setState({ isDebuggerPaused: true });

    if (this.isActive) {
      commands.executeCommand("workbench.view.debug");
    }
  };

  private onDebuggerResumed = (event: DebugSessionCustomEvent): void => {
    this.stateManager.setState({ isDebuggerPaused: false });
  };

  private onProfilingCPUStarted = (event: DebugSessionCustomEvent): void => {
    this.stateManager.setState({ profilingCPUState: "profiling" });
  };

  private onProfilingCPUStopped = (event: DebugSessionCustomEvent): void => {
    this.stateManager.setState({ profilingCPUState: "stopped" });
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

  private determineAppOrientation(orientation: AppOrientation): DeviceRotation {
    // Android case - the API is reliable, we do not need supportedOrientations array
    // so we just consider the situation in which during the initialization,
    // the orientation sent is landscape, which will later be corrected by
    // on the lib side anyways
    if (this.device.deviceInfo.platform === DevicePlatform.Android) {
      if (orientation === "Landscape") {
        return DeviceRotation.LandscapeLeft;
      }
      return orientation;
    }

    // IOS case
    if (orientation === "Landscape") {
      if (this.supportedOrientations.includes(DeviceRotation.LandscapeLeft)) {
        return DeviceRotation.LandscapeLeft;
      } else {
        return DeviceRotation.LandscapeRight;
      }
    }

    if (orientation === "Portrait") {
      // iPhone case - expo always reports portraitUpsideDown as portrait on iPads
      if (
        this.device.deviceInfo.deviceType === DeviceType.Tablet &&
        this.device.rotation === DeviceRotation.PortraitUpsideDown &&
        this.supportedOrientations.includes(DeviceRotation.PortraitUpsideDown)
      ) {
        return DeviceRotation.PortraitUpsideDown;
      }

      if (
        (this.supportedOrientations.includes(DeviceRotation.PortraitUpsideDown) &&
          this.device.rotation === DeviceRotation.PortraitUpsideDown) ||
        !this.supportedOrientations.includes(DeviceRotation.Portrait)
      ) {
        return DeviceRotation.PortraitUpsideDown;
      } else {
        return DeviceRotation.Portrait;
      }
    }

    const currentAppOrientation = this.stateManager.getState().appOrientation;

    if (currentAppOrientation && !this.supportedOrientations.includes(orientation)) {
      return currentAppOrientation;
    }

    return orientation;
  }

  //#endregion

  //#region Metro event listeners

  private async onBundleError(message: string, source: DebugSource) {
    Logger.error("[Bundling Error]", message);
    this.stateManager.setState({
      bundleError: {
        kind: "bundle",
        message,
      },
    });
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
  public stepOutDebugger() {
    this.debugSession?.stepOutDebugger();
  }
  public stepIntoDebugger() {
    this.debugSession?.stepIntoDebugger();
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
        this.stateManager.setState({ bundleError: null });
      }),
      this.devtools.onEvent("fastRefreshStarted", () => {
        this.stateManager.setState({ bundleError: null, isRefreshing: true });
      }),
      this.devtools.onEvent("fastRefreshComplete", () => {
        this.stateManager.setState({ isRefreshing: false });
      }),
      this.devtools.onEvent("isProfilingReact", (isProfiling) => {
        if (this.stateManager.getState().profilingReactState !== "saving") {
          this.stateManager.setState({
            profilingReactState: isProfiling ? "profiling" : "stopped",
          });
        }
      }),
      this.devtools.onEvent("appOrientationChanged", (orientation: AppOrientation) => {
        this.stateManager.setState({ appOrientation: this.determineAppOrientation(orientation) });
      }),
      this.devtools.onEvent(
        "inspectorAvailabilityChanged",
        (inspectorAvailability: InspectorAvailabilityStatus) => {
          this.stateManager.setState({ elementInspectorAvailability: inspectorAvailability });
        }
      ),
      this.devtools.onEvent("disconnected", () => {
        if (
          this.stateManager.getState().inspectorBridgeStatus === InspectorBridgeStatus.Connected
        ) {
          this.stateManager.setState({ inspectorBridgeStatus: InspectorBridgeStatus.Disconnected });
        }
      }),
      this.devtools.onEvent("connected", () => {
        if (
          this.stateManager.getState().inspectorBridgeStatus !== InspectorBridgeStatus.Connected
        ) {
          this.stateManager.setState({ inspectorBridgeStatus: InspectorBridgeStatus.Connected });
        }
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
      this.stateManager.setState({ profilingReactState: "stopped" });
    }
  }
  //#endregion

  //#region Element Inspector
  public async inspectElementAt(
    xRatio: number,
    yRatio: number,
    requestStack: boolean
  ): Promise<InspectData> {
    const id = this.inspectCallID++;
    const { promise, resolve, reject } = Promise.withResolvers<InspectData>();
    const listener = this.devtools.onEvent("inspectData", (payload) => {
      if (payload.id === id) {
        listener.dispose();
        resolve(payload as unknown as InspectData);
      } else if (payload.id >= id) {
        listener.dispose();
        reject("Inspect request was invalidated by a later request");
      }
    });
    this.devtools.sendInspectRequest(xRatio, yRatio, id, requestStack);

    const inspectData = await promise;
    let stack = undefined;
    if (requestStack && inspectData?.stack) {
      stack = inspectData.stack;
      const inspectorExcludePattern =
        this.applicationContext.workspaceConfiguration.inspectorExcludePattern;
      const patterns = inspectorExcludePattern?.split(",").map((pattern) => pattern.trim());
      function testInspectorExcludeGlobPattern(filename: string) {
        return patterns?.some((pattern) => minimatch(filename, pattern));
      }
      stack.forEach((item) => {
        item.hide = false;
        if (!isAppSourceFile(item.source.fileName)) {
          item.hide = true;
        } else if (testInspectorExcludeGlobPattern(item.source.fileName)) {
          item.hide = true;
        }
      });
    }
    return { frame: inspectData.frame, stack };
  }
  //#endregion

  public resetLogCounter() {
    this.stateManager.setState({ logCounter: 0 });
  }

  public async dispose() {
    disposeAll(this.disposables);
    this.debugSessionEventSubscription?.dispose();
    await this.debugSession?.dispose();
    this.debugSession = undefined;
    this.device.terminateApp(this.packageNameOrBundleId);
  }
}
