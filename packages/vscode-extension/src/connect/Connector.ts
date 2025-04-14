import {
  commands,
  Disposable,
  MarkdownString,
  StatusBarAlignment,
  StatusBarItem,
  window,
} from "vscode";
import { DebugSession } from "../debugging/DebugSession";
import { Metro } from "../project/metro";
import { extensionContext } from "../utilities/extensionContext";
import { disposeAll } from "../utilities/disposables";
import { Scanner } from "./Scanner";

const RADON_CONNECT_ENABLED_KEY = "radon_connect_enabled";
export const RADON_CONNECT_PORT_KEY = "radon_connect_port";

export class Connector implements Disposable {
  private static instance: Connector | null = null;

  private statusBarItem: StatusBarItem;
  private debugSession: DebugSession | null = null;
  private metro: Metro | null = null;
  private scanner: Scanner | null = null;

  private disposables: Disposable[] = [];

  private constructor() {
    this.statusBarItem = window.createStatusBarItem(
      StatusBarAlignment.Left,
      Number.MIN_SAFE_INTEGER
    );
    this.disposables.push(this.statusBarItem);

    this.disposables.push(
      commands.registerCommand("RNIDE.disableRadonConnect", () => {
        extensionContext.workspaceState.update(RADON_CONNECT_ENABLED_KEY, false);
        this.disconnect();
        this.stopScanner();
        this.updateStatusBarItem();
      })
    );

    this.disposables.push(
      commands.registerCommand("RNIDE.enableRadonConnect", () => {
        extensionContext.workspaceState.update(RADON_CONNECT_ENABLED_KEY, true);
        this.maybeStartScanner();
        this.updateStatusBarItem();
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
          extensionContext.workspaceState.update(RADON_CONNECT_ENABLED_KEY, true);
          this.maybeStartScanner(true);
          this.updateStatusBarItem();
        }
      })
    );
  }

  public dispose() {
    this.disconnect();
    this.stopScanner();
    disposeAll(this.disposables);
    commands.executeCommand("setContext", "RNIDE.showsStatusBarItem", false);
    Connector.instance = null;
  }

  private disconnect() {
    this.metro = null;
    this.debugSession?.dispose();
    this.debugSession = null;
  }

  private async tryConnectJSDebuggerWithMetro(websocketAddress: string, metro: Metro) {
    const debugSession = new DebugSession({
      onDebugSessionTerminated: () => {
        this.metro = null;
        this.debugSession = null;
        this.updateStatusBarItem();
        this.maybeStartScanner();
      },
    });
    const isUsingNewDebugger = metro.isUsingNewDebugger;
    if (!isUsingNewDebugger) {
      throw new Error("Auto-connect is only supported for the new React Native debugger");
    }
    const success = await debugSession.startJSDebugSession({
      websocketAddress,
      displayDebuggerOverlay: true,
      isUsingNewDebugger,
      expoPreludeLineCount: metro.expoPreludeLineCount,
      sourceMapPathOverrides: metro.sourceMapPathOverrides,
    });
    if (success) {
      this.metro = metro;
      this.debugSession = debugSession;
      this.stopScanner();
    } else {
      debugSession.dispose();
    }
  }

  private maybeStartScanner(forceRestart: boolean = false) {
    const enabled = extensionContext.workspaceState.get(RADON_CONNECT_ENABLED_KEY, true);
    if (!enabled || (this.scanner && !forceRestart)) {
      return;
    }

    if (this.scanner) {
      this.scanner.dispose();
    }

    this.scanner = new Scanner({
      onPortStatusUpdated: () => this.updateStatusBarItem(),
      onDeviceCandidateFound: async (metro, websocketAddress) => {
        await this.tryConnectJSDebuggerWithMetro(websocketAddress, metro);
      },
    });
    this.scanner.start();
  }

  private stopScanner() {
    this.scanner?.dispose();
    this.scanner = null;
    this.updateStatusBarItem();
  }

  public start() {
    this.updateStatusBarItem();
    this.statusBarItem.show();
    commands.executeCommand("setContext", "RNIDE.showsStatusBarItem", true);
    this.maybeStartScanner();
  }

  private printPortStatus(port: number) {
    const status = this.scanner?.portsStatus.get(port);
    if (status) {
      return ` - ${port}: ${status}`;
    } else {
      return ` - ${port}`;
    }
  }

  private updateStatusBarItem() {
    const markdownText = new MarkdownString();
    markdownText.supportThemeIcons = true;
    markdownText.isTrusted = true;

    const enabled = extensionContext.workspaceState.get(RADON_CONNECT_ENABLED_KEY, true);

    if (this.debugSession && this.metro) {
      this.statusBarItem.text = "Radon IDE $(debug)";
      markdownText.appendMarkdown("Connected on port " + this.metro.port);
      markdownText.appendMarkdown("\n\n");
      markdownText.appendMarkdown("[Disconnect](command:RNIDE.disableRadonConnect)");
      markdownText.appendMarkdown("\n\n");
      markdownText.appendMarkdown("[Open debug console](command:workbench.panel.repl.view.focus)");
    } else if (!enabled) {
      this.statusBarItem.text = "Radon IDE $(open-preview)";
      markdownText.appendMarkdown("Radon Connect is disabled\n\n");
      markdownText.appendMarkdown(
        "Radon will not connect to running\nmetro instances and React Native apps"
      );
      markdownText.appendMarkdown("\n\n");
      markdownText.appendMarkdown("[Enable Radon Connect](command:RNIDE.enableRadonConnect)\n\n");
      markdownText.appendMarkdown("[Open Radon IDE Panel](command:RNIDE.openPanel)\n\n");
    } else {
      this.statusBarItem.text = "Radon IDE $(debug-disconnect)";
      const ports = Array.from(this.scanner?.portsStatus.keys() ?? []);
      markdownText.appendMarkdown(
        "Waiting for React Native app to connect, scanning ports:\n" +
          ports.map(this.printPortStatus.bind(this)).join("\n")
      );
      markdownText.appendMarkdown("\n\n");
      markdownText.appendMarkdown(
        "[$(broadcast) Connect on custom port](command:RNIDE.connect.configurePort)\n\n"
      );
      markdownText.appendMarkdown(
        "[$(circle-slash) Disable Radon Connect](command:RNIDE.disableRadonConnect)\n\n"
      );
      markdownText.appendMarkdown(
        "[$(open-preview) Open Radon IDE Panel](command:RNIDE.openPanel)\n\n"
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
