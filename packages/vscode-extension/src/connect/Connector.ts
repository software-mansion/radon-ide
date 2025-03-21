import { MarkdownString, StatusBarAlignment, StatusBarItem, window, workspace } from "vscode";
import { DebugSession } from "../debugging/DebugSession";
import { Metro } from "../project/metro";
import { sleep } from "../utilities/retry";
import { extensionContext } from "../utilities/extensionContext";
import extension from "vscode-js-debug/dist";

const PORT_SCAN_INTERVAL_MS = 4000;
const DEFAULT_PORTS = [8081, 8082, 8083];

const RADON_CONNECT_ENABLED_KEY = "radon_connect_enabled";

export class Connector {
  private static instance: Connector | null = null;

  private statusBarItem: StatusBarItem;
  private debugSession: DebugSession | null = null;

  private constructor() {
    this.statusBarItem = window.createStatusBarItem(
      StatusBarAlignment.Left,
      Number.MIN_SAFE_INTEGER
    );
  }

  private scanPortsPeriodically() {
    const enabled = extensionContext.workspaceState.get(RADON_CONNECT_ENABLED_KEY, true);
    if (!enabled || this.debugSession) {
      return;
    }
    Promise.all(DEFAULT_PORTS.map(this.scanPort.bind(this)))
      .then(() => sleep(PORT_SCAN_INTERVAL_MS))
      .then(this.scanPortsPeriodically.bind(this));
  }

  private async scanPort(port: number) {
    try {
      const response = await fetch(`http://localhost:${port}/status`);
      if (response.ok) {
        // we expect metro to include a response header X-React-Native-Project-Root
        // that points to the project root folder
        const projectRoot = response.headers.get("X-React-Native-Project-Root");
        if (projectRoot && isInWorkspace(projectRoot)) {
          const debugSession = new DebugSession({
            onDebugSessionTerminated: () => {
              this.debugSession = null;
              this.updateStatusBarItem();
            },
          });
          const metro = new Metro(port, [projectRoot]);
          const success = await debugSession.connectJSDebugger(metro);
          if (success) {
            this.debugSession = debugSession;
            this.updateStatusBarItem();
          } else {
            debugSession.dispose();
          }
        }
      }
    } catch (error) {}
  }

  public start() {
    this.updateStatusBarItem();
    this.statusBarItem.show();
    this.scanPortsPeriodically();
  }

  private updateStatusBarItem() {
    const markdownText = new MarkdownString();
    markdownText.supportThemeIcons = true;
    markdownText.isTrusted = true;

    if (this.debugSession) {
      this.statusBarItem.text = "Radon IDE $(debug)";
    } else {
      this.statusBarItem.text = "Radon IDE $(debug-disconnect)";
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

function isInWorkspace(filePath: string) {
  // first check if the provided path is a parent of any workspace folder
  return workspace.workspaceFolders?.some((folder) => filePath.startsWith(folder.uri.fsPath));
}
