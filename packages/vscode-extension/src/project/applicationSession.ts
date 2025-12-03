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
import { InspectedElementPayload, InspectElementFullData } from "react-devtools-inline";
import { DebugSession, DebugSessionImpl, DebugSource } from "../debugging/DebugSession";
import { ApplicationContext } from "./ApplicationContext";
import { ReconnectingDebugSession } from "../debugging/ReconnectingDebugSession";
import { DeviceBase } from "../devices/DeviceBase";
import { Logger } from "../Logger";
import { AppOrientation, InspectData, SourceInfo } from "../common/Project";
import { disposeAll } from "../utilities/disposables";
import { ToolKey, ToolPlugin, ToolsManager } from "./tools";
import { focusSource } from "../utilities/focusSource";
import { CancelError, CancelToken } from "../utilities/cancelToken";
import { BuildResult } from "../builders/BuildManager";
import {
  ApplicationSessionState,
  DevicePlatform,
  DeviceRotation,
  DeviceType,
  initialApplicationSessionState,
  InspectorAvailabilityStatus,
  InspectorBridgeStatus,
  NavigationHistoryItem,
  NavigationRoute,
  NavigationState,
  REMOVE,
  StartupMessage,
} from "../common/State";
import { isAppSourceFile } from "../utilities/isAppSourceFile";
import { StateManager } from "./StateManager";
import {
  DevtoolsConnection,
  DevtoolsInspectorBridge,
  DevtoolsServer,
  CDPDevtoolsServer,
} from "./devtools";
import { RadonInspectorBridge } from "./inspectorBridge";
import { NETWORK_EVENT_MAP, NetworkBridge } from "./networkBridge";
import { MetroSession } from "./metro";
import { getDebuggerTargetForDevice } from "./DebuggerTarget";
import { isCDPDomainCall } from "../network/types/panelMessageProtocol";
import { MaestroTestRunner } from "./MaestroTestRunner";

const MAX_URL_HISTORY_SIZE = 20;

interface LaunchApplicationSessionDeps {
  applicationContext: ApplicationContext;
  device: DeviceBase;
  buildResult: BuildResult;
  metro: MetroSession;
  devtoolsServer?: DevtoolsServer;
  devtoolsPort?: number;
}

function waitForAppReady(inspectorBridge: RadonInspectorBridge, cancelToken?: CancelToken) {
  // set up `appReady` promise
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  cancelToken?.onCancel(() => {
    reject(new CancelError("Cancelled while waiting for the app to be ready."));
  });
  const appReadyListener = inspectorBridge.onEvent("appReady", resolve);
  promise
    .finally(() => {
      appReadyListener.dispose();
    })
    .catch(() => {
      // we ignore cancellation rejections as this is another surfaces for it to bubble up
    });
  return promise;
}

type SourceData = {
  sourceURL: string;
  line: number;
  column: number;
};

function isFullInspectionData(
  payload?: InspectedElementPayload
): payload is InspectElementFullData {
  return payload?.type === "full-data";
}

export function toSourceInfo(source: SourceData): SourceInfo {
  return {
    fileName: source.sourceURL,
    column0Based: source.column,
    line0Based: source.line,
  };
}

export class ApplicationSession implements Disposable {
  private disposables: Disposable[] = [];
  private debugSession?: DebugSession & Disposable;
  private debugSessionEventSubscription?: Disposable;
  private networkBridge: NetworkBridge;
  private isActive = false;
  private inspectCallID = 7621;
  private devtools: DevtoolsConnection | undefined;
  private toolsManager: ToolsManager;
  private maestroTestRunner: MaestroTestRunner;
  private lastRegisteredInspectorAvailability: InspectorAvailabilityStatus =
    InspectorAvailabilityStatus.UnavailableInactive;

  private readonly _inspectorBridge: DevtoolsInspectorBridge;
  public get inspectorBridge(): RadonInspectorBridge {
    return this._inspectorBridge;
  }

  public get devtoolsStore() {
    return this.devtools?.store;
  }

  public static async launch(
    stateManager: StateManager<ApplicationSessionState>,
    navigationStateManager: StateManager<NavigationState>,
    {
      applicationContext,
      device,
      buildResult,
      metro,
      devtoolsServer,
      devtoolsPort,
    }: LaunchApplicationSessionDeps,
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
      navigationStateManager,
      applicationContext,
      device,
      metro,
      devtoolsServer,
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
        device.launchApp(
          buildResult,
          metro.port,
          devtoolsPort,
          launchArguments,
          applicationContext.appRootFolder
        )
      );

      const appReadyPromise = waitForAppReady(session.inspectorBridge, cancelToken);
      onLaunchStage(StartupMessage.WaitingForAppToLoad);

      if (getIsActive()) {
        const activatePromise = session.activate(cancelToken);
        await cancelToken.adapt(Promise.race([activatePromise, bundleErrorPromise]));
      }

      if (getIsActive()) {
        await cancelToken.adapt(Promise.race([appReadyPromise, bundleErrorPromise]));
      }

      return session;
    } catch (e) {
      session.dispose();
      throw e;
    } finally {
      bundleErrorSubscription.dispose();
    }
  }

  private cdpDevtoolsServer?: CDPDevtoolsServer;
  private devtoolsServerSubscription: Disposable | undefined;

  private constructor(
    private readonly stateManager: StateManager<ApplicationSessionState>,
    // owned by DeviceSession
    private readonly navigationStateManager: StateManager<NavigationState>,
    private readonly applicationContext: ApplicationContext,
    private readonly device: DeviceBase,
    private readonly metro: MetroSession,
    private readonly websocketDevtoolsServer: DevtoolsServer | undefined,
    private readonly packageNameOrBundleId: string,
    private readonly supportedOrientations: DeviceRotation[]
  ) {
    this.stateManager.updateState(initialApplicationSessionState);
    this.registerMetroListeners();
    this.networkBridge = new NetworkBridge();

    const devtoolsInspectorBridge = new DevtoolsInspectorBridge();
    this._inspectorBridge = devtoolsInspectorBridge;
    const inspectorBridgeSubscriptions =
      this.registerInspectorBridgeEventListeners(devtoolsInspectorBridge);
    const configurationChangeSubscriptions = this.registerConfigurationChangeListeners();
    this.disposables.push(
      devtoolsInspectorBridge,
      ...inspectorBridgeSubscriptions,
      ...configurationChangeSubscriptions
    );

    if (websocketDevtoolsServer) {
      this.setupDevtoolsServer(websocketDevtoolsServer);
    }

    this.toolsManager = new ToolsManager(
      this.stateManager.getDerived("toolsState"),
      this.applicationContext,
      devtoolsInspectorBridge,
      this.networkBridge,
      this.metro.port
    );

    this.disposables.push(this.toolsManager);
    this.disposables.push(this.stateManager);

    this.maestroTestRunner = new MaestroTestRunner(this.device);
    this.disposables.push(this.maestroTestRunner);
  }

  private setupDevtoolsServer(devtoolsServer: DevtoolsServer) {
    this.devtoolsServerSubscription?.dispose();
    if (devtoolsServer.connection) {
      this.setDevtoolsConnection(devtoolsServer.connection);
    }
    this.devtoolsServerSubscription = devtoolsServer.onConnection(this.setDevtoolsConnection);
  }

  private setDevtoolsConnection = (devtools: DevtoolsConnection) => {
    this.devtools?.dispose();
    this.devtools = devtools;
    this.stateManager.updateState({ inspectorBridgeStatus: InspectorBridgeStatus.Connected });
    devtools.onDisconnected(() => {
      if (devtools !== this.devtools) {
        return;
      }
      if (this.stateManager.getState().inspectorBridgeStatus === InspectorBridgeStatus.Connected) {
        this.stateManager.updateState({
          inspectorBridgeStatus: InspectorBridgeStatus.Disconnected,
        });
      }
      this.devtools = undefined;
      this._inspectorBridge.setDevtoolsConnection(undefined);
    });
    devtools.onProfilingChange((isProfiling) => {
      if (this.stateManager.getState().profilingReactState !== "saving") {
        this.stateManager.updateState({
          profilingReactState: isProfiling ? "profiling" : "stopped",
        });
      }
    });
    this._inspectorBridge.setDevtoolsConnection(devtools);
  };

  private async setupDebugSession(): Promise<void> {
    this.debugSession = await this.createDebugSession();
    this.debugSessionEventSubscription = this.registerDebugSessionListeners(this.debugSession);
    this.networkBridge.setDebugSession(this.debugSession);
    if (this.cdpDevtoolsServer) {
      this.cdpDevtoolsServer.dispose();
      this.cdpDevtoolsServer = undefined;
    }
    if (this.websocketDevtoolsServer === undefined) {
      this.cdpDevtoolsServer = new CDPDevtoolsServer(this.debugSession);
      this.setupDevtoolsServer(this.cdpDevtoolsServer);
    }
  }

  private async createDebugSession(): Promise<DebugSession & Disposable> {
    const session = new ReconnectingDebugSession(
      new DebugSessionImpl({
        displayName: this.device.deviceInfo.displayName,
        useParentDebugSession: true,
        useCustomJSDebugger: this.applicationContext.launchConfig.useCustomJSDebugger,
      }),
      this.metro,
      this.device.deviceInfo,
      this.websocketDevtoolsServer
    );

    await session.startParentDebugSession();

    return session;
  }

  // #region Tools

  public async updateToolEnabledState(toolName: ToolKey, enabled: boolean) {
    return this.toolsManager.updateToolEnabledState(toolName, enabled);
  }

  public openTool(toolName: ToolKey): void {
    return this.toolsManager.openTool(toolName);
  }

  public getPlugin(toolName: ToolKey): ToolPlugin | undefined {
    return this.toolsManager.getPlugin(toolName);
  }

  // #endregion Tools

  //#region Debug session event listeners

  private onConsoleLog = (event: DebugSessionCustomEvent): void => {
    const currentLogCount = this.stateManager.getState().logCounter;
    this.stateManager.updateState({ logCounter: currentLogCount + 1 });
  };

  private onDebuggerPaused = (event: DebugSessionCustomEvent): void => {
    this.stateManager.updateState({ isDebuggerPaused: true });

    if (this.isActive) {
      commands.executeCommand("workbench.view.debug");
    }
  };

  private onDebuggerResumed = (event: DebugSessionCustomEvent): void => {
    this.stateManager.updateState({ isDebuggerPaused: false });
  };

  private onProfilingCPUStarted = (event: DebugSessionCustomEvent): void => {
    this.stateManager.updateState({ profilingCPUState: "profiling" });
  };

  private onProfilingCPUStopped = (event: DebugSessionCustomEvent): void => {
    this.stateManager.updateState({ profilingCPUState: "stopped" });
    if (event.body?.filePath) {
      this.saveAndOpenCPUProfile(event.body.filePath);
    }
  };

  private onNetworkEvent = (event: DebugSessionCustomEvent): void => {
    const method = event.body?.method;
    if (!method || !isCDPDomainCall(method)) {
      Logger.error("Unknown network event method:", method);
      this.networkBridge.emitEvent("unknownEvent", event.body);
      return;
    }

    this.networkBridge.emitEvent(NETWORK_EVENT_MAP[method], event.body);
  };

  private registerDebugSessionListeners(debugSession: DebugSession): Disposable {
    const subscriptions: Disposable[] = [
      debugSession.onConsoleLog(this.onConsoleLog),
      debugSession.onDebuggerPaused(this.onDebuggerPaused),
      debugSession.onDebuggerResumed(this.onDebuggerResumed),
      debugSession.onProfilingCPUStarted(this.onProfilingCPUStarted),
      debugSession.onProfilingCPUStopped(this.onProfilingCPUStopped),
      debugSession.onNetworkEvent(this.onNetworkEvent),
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
    if (!this.isActive) {
      return;
    }
    Logger.error("[Bundling Error]", message);
    this.stateManager.updateState({
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

  public async activate(cancelToken?: CancelToken): Promise<void> {
    if (!this.isActive) {
      this.isActive = true;
      this.toolsManager.activate();
      if (this.debugSession === undefined) {
        await this.setupDebugSession();
      }
      await this.connectJSDebugger(cancelToken);
    }
  }

  public async deactivate(): Promise<void> {
    this.isActive = false;
    this.stateManager.updateState({
      // NOTE: we reset the state to "connecting" here to prevent showing the "disconnected" alert
      // when switching between devices
      inspectorBridgeStatus: InspectorBridgeStatus.Connecting,
      // NOTE: we reset the bundle error here to prevent showing stale errors when switching between devices.
      // If, after swithcing, the app still has a bundle error,
      // the debugger connecting and fetching the source will cause it to appear again.
      bundleError: REMOVE,
    });
    this.toolsManager.deactivate();
    this.debugSessionEventSubscription?.dispose();
    this.debugSessionEventSubscription = undefined;
    const debugSession = this.debugSession;
    this.debugSession = undefined;
    await debugSession?.dispose();
    this.networkBridge.clearDebugSession();
    this.cdpDevtoolsServer?.dispose();
    this.cdpDevtoolsServer = undefined;
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

  private connectJSDebuggerCancelToken: CancelToken = new CancelToken();
  private async connectJSDebugger(cancelToken?: CancelToken) {
    this.connectJSDebuggerCancelToken.cancel();
    this.connectJSDebuggerCancelToken = new CancelToken();
    cancelToken?.onCancel(() => this.connectJSDebuggerCancelToken.cancel());

    const target = await getDebuggerTargetForDevice({
      metro: this.metro,
      deviceInfo: this.device.deviceInfo,
      cancelToken: this.connectJSDebuggerCancelToken,
    });
    if (!target) {
      Logger.error("Couldn't find a proper debugger URL to connect to");
      return;
    }
    if (this.debugSession === undefined) {
      // the application session was deactivated in the meantime, we don't need to connect the debugger
      return;
    }
    await this.debugSession.startJSDebugSession({
      ...target,
      displayDebuggerOverlay: false,
      expoPreludeLineCount: this.metro.expoPreludeLineCount,
      sourceMapPathOverrides: this.metro.sourceMapPathOverrides,
    });
  }

  /**
   * Determine availability of the element inspector taking the
   * enableExperimentalElementInspector setting (force-enable) into account.
   */
  private determineInspectorAvailability(
    status: InspectorAvailabilityStatus
  ): InspectorAvailabilityStatus {
    const experimentalInspectorEnabled =
      this.applicationContext.workspaceConfiguration.general.enableExperimentalElementInspector;
    const isStatusUnavailableEdgeToEdge =
      status === InspectorAvailabilityStatus.UnavailableEdgeToEdge;

    const newAvailabilityStatus =
      experimentalInspectorEnabled && isStatusUnavailableEdgeToEdge
        ? InspectorAvailabilityStatus.Available
        : status;

    return newAvailabilityStatus;
  }

  private registerConfigurationChangeListeners() {
    const subscriptions = [
      // react to enableExperimentalElementInspector setting changes
      this.applicationContext.workspaceConfigState.onSetState(() => {
        const status = this.determineInspectorAvailability(
          this.lastRegisteredInspectorAvailability
        );
        this.stateManager.updateState({ elementInspectorAvailability: status });
      }),
    ];
    return subscriptions;
  }

  private registerInspectorBridgeEventListeners(inspectorBridge: RadonInspectorBridge) {
    const subscriptions = [
      inspectorBridge.onEvent("appReady", () => {
        // NOTE: since this is triggered by the JS bundle,
        // we can assume that if it fires, the bundle loaded successfully.
        // This is necessary to reset the bundle error state when the app reload
        // is triggered from the app itself (e.g. by in-app dev menu or redbox).
        this.stateManager.updateState({ bundleError: null });
      }),
      inspectorBridge.onEvent("fastRefreshStarted", () => {
        this.stateManager.updateState({ bundleError: null, isRefreshing: true });
      }),
      inspectorBridge.onEvent("fastRefreshComplete", () => {
        this.stateManager.updateState({ isRefreshing: false });
      }),
      inspectorBridge.onEvent("appOrientationChanged", (orientation: AppOrientation) => {
        this.stateManager.updateState({
          appOrientation: this.determineAppOrientation(orientation),
        });
      }),
      inspectorBridge.onEvent(
        "inspectorAvailabilityChanged",
        (inspectorAvailability: InspectorAvailabilityStatus) => {
          this.lastRegisteredInspectorAvailability = inspectorAvailability;
          const status = this.determineInspectorAvailability(inspectorAvailability);
          this.stateManager.updateState({ elementInspectorAvailability: status });
        }
      ),
      inspectorBridge.onEvent("navigationChanged", (payload: NavigationHistoryItem) => {
        const navigationHistory = [
          payload,
          ...this.navigationStateManager
            .getState()
            .navigationHistory.filter((record) => record.id !== payload.id),
        ].slice(0, MAX_URL_HISTORY_SIZE);

        this.navigationStateManager.updateState({ navigationHistory });
      }),
      inspectorBridge.onEvent("navigationRouteListUpdated", (payload: NavigationRoute[]) => {
        this.navigationStateManager.updateState({ navigationRouteList: payload });
      }),
    ];
    return subscriptions;
  }
  //#endregion

  public async reloadJS(cancelToken: CancelToken) {
    const { promise: bundleErrorPromise, reject: rejectBundleError } = Promise.withResolvers();
    const bundleErrorSubscription = this.metro.onBundleError(() => {
      rejectBundleError(new Error("Bundle error occurred during reload"));
    });
    try {
      const appReadyPromise = waitForAppReady(this.inspectorBridge, cancelToken);
      await this.reloadWithDebugger();
      await Promise.race([appReadyPromise, bundleErrorPromise]);
    } finally {
      bundleErrorSubscription.dispose();
    }
  }

  private async reloadWithDebugger() {
    if (this.debugSession === undefined) {
      throw new Error("Cannot reload JS with the debugger when the debugger is not connected");
    }
    const { result } = await this.debugSession.evaluateExpression({
      expression: "void globalThis.__RADON_reloadJS()",
    });
    if (result.className === "Error") {
      throw new Error("Reloading JS failed.");
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
    return await this.devtools?.startProfilingReact();
  }

  public async stopProfilingReact() {
    try {
      return await this.devtools?.stopProfilingReact();
    } finally {
      this.stateManager.updateState({ profilingReactState: "stopped" });
    }
  }
  //#endregion

  // #region Maestro testing

  public async startMaestroTest(fileNames: string[]) {
    if (this.stateManager.getState().maestroTestState !== "stopped") {
      const selection = await window.showWarningMessage(
        "A Maestro test is already running on this device. Abort it before starting a new one.",
        "Abort and continue",
        "Cancel"
      );
      if (selection !== "Abort and continue") {
        return;
      }
      await this.stopMaestroTest();
    }
    try {
      this.stateManager.updateState({ maestroTestState: "running" });
      await this.maestroTestRunner.startMaestroTest(fileNames);
    } finally {
      this.stateManager.updateState({ maestroTestState: "stopped" });
    }
  }

  public async stopMaestroTest() {
    this.stateManager.updateState({ maestroTestState: "aborting" });
    try {
      await this.maestroTestRunner.stopMaestroTest();
    } finally {
      this.stateManager.updateState({ maestroTestState: "stopped" });
    }
  }

  // #endregion

  //#region Element Inspector
  public async inspectElementAt(
    xRatio: number,
    yRatio: number,
    requestStack: boolean
  ): Promise<InspectData> {
    const id = this.inspectCallID++;
    const { promise, resolve, reject } = Promise.withResolvers<InspectData>();
    const listener = this.inspectorBridge.onEvent("inspectData", (payload) => {
      if (payload.id === id) {
        listener?.dispose();
        resolve(payload as unknown as InspectData);
      } else if (payload.id >= id) {
        listener?.dispose();
        reject("Inspect request was invalidated by a later request");
      }
    });
    this.inspectorBridge.sendInspectRequest(xRatio, yRatio, id, requestStack);

    const inspectData = await promise;
    let stack = undefined;
    if (requestStack && inspectData?.stack) {
      stack = inspectData.stack;
      // for stack entries with source names that start with http, we need to decipher original source positions
      // using source maps via the debugger
      await Promise.all(
        stack.map(async (item) => {
          if (item.source?.fileName.startsWith("http") && this.debugSession) {
            try {
              item.source = await this.debugSession.findOriginalPosition(item.source);
            } catch (e) {
              Logger.error("Error finding original source position for stack item", item, e);
            }
          }
        })
      );

      const inspectorExcludePattern =
        this.applicationContext.workspaceConfiguration.general.inspectorExcludePattern;
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

  public async inspectElementById(id: number) {
    const payload = await this.devtools?.inspectElementById(id);

    if (!isFullInspectionData(payload)) {
      return undefined;
    }

    // `source` is incorrectly typed as `Source`, it's actually `SourceData` when `payload.type === 'full-data'`
    const source = payload.value.source as SourceData | null;

    if (source) {
      const sourceInfo = toSourceInfo(source);

      if (sourceInfo.fileName.startsWith("http") && this.debugSession) {
        try {
          const symbolicated = await this.debugSession.findOriginalPosition(sourceInfo);
          payload.value.source = {
            fileName: symbolicated.fileName,
            lineNumber: symbolicated.line0Based,
          };
        } catch (e) {
          Logger.error("Error finding original source position for element", payload, e);
        }
      }
    }

    return payload;
  }
  //#endregion

  public resetLogCounter() {
    this.stateManager.updateState({ logCounter: 0 });
  }

  public openNavigation(id: string) {
    this.inspectorBridge?.sendOpenNavigationRequest(id);
  }

  public navigateHome() {
    // going home resets the navigation history
    this.navigationStateManager.updateState({ navigationHistory: [] });
    this.inspectorBridge?.sendOpenNavigationRequest("__HOME__");
  }

  public navigateBack() {
    this.inspectorBridge?.sendOpenNavigationRequest("__BACK__");
  }

  public removeNavigationHistoryEntry(id: string) {
    this.navigationStateManager.updateState({
      navigationHistory: this.navigationStateManager
        .getState()
        .navigationHistory.filter((record) => record.id !== id),
    });
  }

  public async dispose() {
    disposeAll(this.disposables);
    this.connectJSDebuggerCancelToken.cancel();
    this.debugSessionEventSubscription?.dispose();
    this.devtoolsServerSubscription?.dispose();
    await this.debugSession?.dispose();
    this.debugSession = undefined;
    this.device.terminateApp(this.packageNameOrBundleId);
    this.cdpDevtoolsServer?.dispose();
  }
}
