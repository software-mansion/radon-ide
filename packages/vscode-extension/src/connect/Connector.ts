import {
  commands,
  Disposable,
  MarkdownString,
  StatusBarAlignment,
  StatusBarItem,
  window,
  workspace,
} from "vscode";
import { DebugSession } from "../debugging/DebugSession";
import { Metro } from "../project/metro";
import { sleep } from "../utilities/retry";
import { extensionContext } from "../utilities/extensionContext";
import { disposeAll } from "../utilities/disposables";

const PORT_SCAN_INTERVAL_MS = 4000;
const DEFAULT_PORTS = [8081, 8082, 8083];

const RADON_CONNECT_ENABLED_KEY = "radon_connect_enabled";

export class Connector implements Disposable {
  private static instance: Connector | null = null;

  private statusBarItem: StatusBarItem;
  private debugSession: DebugSession | null = null;
  private metro: Metro | null = null;

  private portsStatus: Record<number, string> = {};
  private disposables: Disposable[] = [];

  private constructor() {
    this.statusBarItem = window.createStatusBarItem(
      StatusBarAlignment.Left,
      Number.MIN_SAFE_INTEGER
    );
    this.statusBarItem.command = "RNIDE.openPanel";
    this.disposables.push(this.statusBarItem);

    this.disposables.push(
      commands.registerCommand("RNIDE.disableAutoConnect", () => {
        extensionContext.workspaceState.update(RADON_CONNECT_ENABLED_KEY, false);
        this.updateStatusBarItem();
      })
    );
  }

  public dispose() {
    this.disconnect();
    disposeAll(this.disposables);
    Connector.instance = null;
  }

  private disconnect() {
    this.metro = null;
    this.debugSession?.dispose();
    this.debugSession = null;
  }

  private scanPortsPeriodically() {
    const enabled =
      this === Connector.instance &&
      extensionContext.workspaceState.get(RADON_CONNECT_ENABLED_KEY, true);
    if (!enabled || this.debugSession) {
      return;
    }
    Promise.all(DEFAULT_PORTS.map(this.scanPort.bind(this)))
      .then(() => sleep(PORT_SCAN_INTERVAL_MS))
      .then(this.scanPortsPeriodically.bind(this))
      .then(this.updateStatusBarItem.bind(this));
  }

  private async tryConnectMetroAndJSDebugger(port: number, projectRoot: string) {
    const metro = new Metro(port, [projectRoot]);
    const websocketAddress = await metro.getDebuggerURL();
    if (!websocketAddress) {
      this.portsStatus[port] = "no connected device";
      return false;
    }
    if (!metro.isUsingNewDebugger) {
      this.portsStatus[port] = "using old debugger";
      return false;
    }

    const debugSession = new DebugSession({
      onDebugSessionTerminated: () => {
        this.metro = null;
        this.debugSession = null;
        this.updateStatusBarItem();
      },
    });
    const success = await debugSession.startJSDebugSession(metro, {
      websocketAddress,
      displayDebuggerOverlay: true,
    });
    if (success) {
      this.metro = metro;
      this.debugSession = debugSession;
    } else {
      this.portsStatus[port] = "unable to connect";
      debugSession.dispose();
    }
  }

  private async scanPort(port: number) {
    try {
      const response = await fetch(`http://localhost:${port}/status`);
      if (response.ok) {
        // we expect metro to include a response header X-React-Native-Project-Root
        // that points to the project root folder
        const projectRoot = response.headers.get("X-React-Native-Project-Root");
        if (projectRoot && isInWorkspace(projectRoot)) {
          await this.tryConnectMetroAndJSDebugger(port, projectRoot);
        } else if (projectRoot) {
          this.portsStatus[port] = "running for a different workspace";
        } else {
          this.portsStatus[port] = "not recognized as metro process";
        }
      } else {
        this.portsStatus[port] = "not running";
      }
    } catch (error) {
      this.portsStatus[port] = "not running";
    } finally {
      this.updateStatusBarItem();
    }
  }

  public start() {
    this.updateStatusBarItem();
    this.statusBarItem.show();
    commands.executeCommand("setContext", "RNIDE.showsStatusBarItem", true);
    this.scanPortsPeriodically();
  }

  private printPortStatus(port: number) {
    const status = this.portsStatus[port];
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
      markdownText.appendMarkdown("[Open debug console](command:workbench.panel.repl.view.focus)");
    } else if (!enabled) {
      this.statusBarItem.text = "Radon IDE $(open-preview)";
      markdownText.appendMarkdown(
        "Auto-connect is disabled [enable](command:RNIDE.enableAutoConnect)"
      );
    } else {
      this.statusBarItem.text = "Radon IDE $(debug-disconnect)";
      markdownText.appendMarkdown(
        "Waiting for metro to start on ports:\n" +
          DEFAULT_PORTS.map(this.printPortStatus.bind(this)).join("\n")
      );
      markdownText.appendMarkdown("\n\n");
      markdownText.appendMarkdown(
        "[Specify a different port](command:RNIDE.connect.configurePort)"
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

type ScannerDelegate = {
  onPortStatusUpdated: () => void;
  onDeviceCandidateFound: (port: number, projectRoot: string, websocketAddress: string) => void;
};

class Scanner implements Disposable {
  public portsStatus: Record<number, string> = {};
  private disposed = false;
  private delegate: ScannerDelegate | null = null;

  public constructor(delegate: ScannerDelegate) {
    this.delegate = delegate;
  }

  public dispose() {
    this.delegate = null;
    this.disposed = true;
  }

  public start() {
    this.scanPortsPeriodically();
  }

  private scanPortsPeriodically() {
    if (this.disposed) {
      return;
    }
    Promise.all(DEFAULT_PORTS.map(this.scanPort.bind(this)))
      .then(() => sleep(PORT_SCAN_INTERVAL_MS))
      .then(this.scanPortsPeriodically.bind(this))
      .then(this.delegate?.onPortStatusUpdated);
  }

  private async tryConnectMetroAndJSDebugger(port: number, projectRoot: string) {
    const metro = new Metro(port, [projectRoot]);
    const websocketAddress = await metro.getDebuggerURL();
    if (!websocketAddress) {
      this.portsStatus[port] = "no connected device";
      return false;
    }
    if (!metro.isUsingNewDebugger) {
      this.portsStatus[port] = "using old debugger";
      return false;
    }

    const debugSession = new DebugSession({
      onDebugSessionTerminated: () => {
        this.metro = null;
        this.debugSession = null;
        this.updateStatusBarItem();
      },
    });
    const success = await debugSession.startJSDebugSession(metro, {
      websocketAddress,
      displayDebuggerOverlay: true,
    });
    if (success) {
      this.metro = metro;
      this.debugSession = debugSession;
    } else {
      this.portsStatus[port] = "unable to connect";
      debugSession.dispose();
    }
  }

  private async scanPort(port: number) {
    try {
      const response = await fetch(`http://localhost:${port}/status`);
      if (response.ok) {
        // we expect metro to include a response header X-React-Native-Project-Root
        // that points to the project root folder
        const projectRoot = response.headers.get("X-React-Native-Project-Root");
        if (projectRoot && isInWorkspace(projectRoot)) {
          await this.tryConnectMetroAndJSDebugger(port, projectRoot);
        } else if (projectRoot) {
          this.portsStatus[port] = "running for a different workspace";
        } else {
          this.portsStatus[port] = "not recognized as metro process";
        }
      } else {
        this.portsStatus[port] = "not running";
      }
    } catch (error) {
      this.portsStatus[port] = "not running";
    } finally {
      this.updateStatusBarItem();
    }
  }
}

function isInWorkspace(filePath: string) {
  // first check if the provided path is a parent of any workspace folder
  return workspace.workspaceFolders?.some((folder) => filePath.startsWith(folder.uri.fsPath));
}
