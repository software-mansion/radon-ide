import {
  commands,
  Disposable,
  EventEmitter,
  MarkdownString,
  StatusBarAlignment,
  StatusBarItem,
  window,
} from "vscode";
import { MetroSession } from "../project/metro";
import { extensionContext } from "../utilities/extensionContext";
import { disposeAll } from "../utilities/disposables";
import { Scanner } from "./Scanner";
import ConnectSession from "./ConnectSession";
import { ConnectState } from "../common/Project";
import { getTelemetryReporter } from "../utilities/telemetry";

const RADON_CONNECT_ENABLED_KEY = "radon_connect_enabled";
export const RADON_CONNECT_PORT_KEY = "radon_connect_port";

export class Connector implements Disposable {
  private static instance: Connector | null = null;

  private statusBarItem: StatusBarItem;
  public connectSession: ConnectSession | null = null;
  private scanner: Scanner | null = null;

  private disposables: Disposable[] = [];

  private connectStateChangedEmitter = new EventEmitter<ConnectState>();
  public onConnectStateChanged = this.connectStateChangedEmitter.event;

  private constructor() {
    this.statusBarItem = window.createStatusBarItem(
      StatusBarAlignment.Left,
      Number.MIN_SAFE_INTEGER
    );
    this.statusBarItem.command = "RNIDE.openPanel";
    this.disposables.push(this.statusBarItem);

    this.disposables.push(
      commands.registerCommand("RNIDE.disableRadonConnect", () => {
        this.disable();
      })
    );

    this.disposables.push(
      commands.registerCommand("RNIDE.enableRadonConnect", () => {
        this.enable();
      })
    );

    this.disposables.push(
      commands.registerCommand("RNIDE.connect.configurePort", async () => {
        const port = await window.showInputBox({
          prompt: "Enter metro/Expo server port. Leave empty to reset to default ports.",
          placeHolder: "e.g. 8081",
          validateInput: (value) => {
            const num = parseInt(value);
            if (value === "") {
              return null;
            }
            if (isNaN(num)) {
              return "Please enter a valid number";
            }
            if (num < 1 || num > 65535) {
              return "Port number must be between 1 and 65535";
            }
            return null;
          },
        });

        if (port !== undefined) {
          if (port === "") {
            extensionContext.workspaceState.update(RADON_CONNECT_PORT_KEY, undefined);
          } else {
            extensionContext.workspaceState.update(RADON_CONNECT_PORT_KEY, parseInt(port));
          }
          this.enable(true);
        }
      })
    );
  }

  public enable(forceStartScanner: boolean = false) {
    getTelemetryReporter().sendTelemetryEvent("radon-connect:enable", {});
    extensionContext.workspaceState.update(RADON_CONNECT_ENABLED_KEY, true);
    this.maybeStartScanner(forceStartScanner);
    this.handleStateChange();
  }

  public disable() {
    getTelemetryReporter().sendTelemetryEvent("radon-connect:disable", {});
    extensionContext.workspaceState.update(RADON_CONNECT_ENABLED_KEY, false);
    this.disconnect();
    this.stopScanner();
    this.handleStateChange();
  }

  public get isEnabled() {
    return extensionContext.workspaceState.get(RADON_CONNECT_ENABLED_KEY, false);
  }

  public get isConnected() {
    return this.connectSession !== null;
  }

  public dispose() {
    this.disconnect();
    this.stopScanner();
    this.connectStateChangedEmitter.dispose();
    disposeAll(this.disposables);
    commands.executeCommand("setContext", "RNIDE.showsStatusBarItem", false);
    Connector.instance = null;
  }

  private disconnect() {
    this.connectSession?.dispose();
    this.connectSession = null;
  }

  private async tryConnectJSDebuggerWithMetro(
    websocketAddress: string,
    isUsingNewDebugger: boolean,
    metro: MetroSession
  ) {
    const connectSession = new ConnectSession(metro, {
      onSessionTerminated: () => {
        getTelemetryReporter().sendTelemetryEvent("radon-connect:disconnected", {});
        if (this.connectSession === connectSession) {
          this.connectSession = null;
        }
        connectSession.dispose();
        this.handleStateChange();
        this.maybeStartScanner();
      },
    });
    try {
      await connectSession.start(websocketAddress, isUsingNewDebugger);
      getTelemetryReporter().sendTelemetryEvent("radon-connect:connected", {});
      this.connectSession?.dispose();
      this.connectSession = connectSession;
      this.stopScanner();
    } catch {
      connectSession.dispose();
    }
  }

  private maybeStartScanner(forceRestart: boolean = false) {
    if (!this.isEnabled || (this.scanner && !forceRestart)) {
      return;
    }

    if (this.scanner) {
      this.scanner.dispose();
    }

    this.scanner = new Scanner({
      onPortStatusUpdated: () => this.handleStateChange(),
      onDeviceCandidateFound: async (metro, websocketAddress, isUsingNewDebugger) => {
        await this.tryConnectJSDebuggerWithMetro(websocketAddress, isUsingNewDebugger, metro);
      },
    });
    this.scanner.start();
  }

  private stopScanner() {
    this.scanner?.dispose();
    this.scanner = null;
    this.handleStateChange();
  }

  public start() {
    this.handleStateChange();
    this.statusBarItem.show();
    commands.executeCommand("setContext", "RNIDE.showsStatusBarItem", true);
    this.maybeStartScanner();
  }

  private handleStateChange() {
    // emit connect state changed event
    this.connectStateChangedEmitter.fire({
      enabled: this.isEnabled,
      connected: this.isConnected,
    });

    // update status bar item
    const markdownText = new MarkdownString();
    markdownText.supportThemeIcons = true;
    markdownText.isTrusted = true;

    if (this.connectSession) {
      this.statusBarItem.text = "Radon IDE $(debug)";
      markdownText.appendMarkdown("Connected on port " + this.connectSession.port);
      markdownText.appendMarkdown("\n\n");
      markdownText.appendMarkdown(
        "[$(circle-slash) Disconnect](command:RNIDE.disableRadonConnect)"
      );
      markdownText.appendMarkdown("\n\n");
      markdownText.appendMarkdown(
        "[$(debug-console) Open debug console](command:workbench.panel.repl.view.focus)"
      );
    } else if (!this.isEnabled) {
      this.statusBarItem.text = "Radon IDE $(open-preview)";
      markdownText.appendMarkdown(
        "[$(open-preview) Open Radon IDE panel](command:RNIDE.openPanel)\n\n"
      );
      markdownText.appendMarkdown(
        "[$(debug-disconnect) Enable Radon Connect](command:RNIDE.enableRadonConnect)\n\n"
      );
    } else {
      this.statusBarItem.text = "Radon IDE $(debug-disconnect)";
      markdownText.appendMarkdown("Radon Connect enabled (scanning ports)");
      markdownText.appendMarkdown("\n\n");
      markdownText.appendMarkdown(
        "[$(broadcast) Connect on custom port](command:RNIDE.connect.configurePort)\n\n"
      );
      markdownText.appendMarkdown(
        "[$(circle-slash) Disable Radon Connect](command:RNIDE.disableRadonConnect)\n\n"
      );
      markdownText.appendMarkdown(
        "[$(open-preview) Open Radon IDE panel](command:RNIDE.openPanel)\n\n"
      );
    }

    this.statusBarItem.tooltip = markdownText;
  }

  public static getInstance(): Connector {
    if (!Connector.instance) {
      Connector.instance = new Connector();
    }
    return Connector.instance;
  }
}
