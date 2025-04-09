import { Disposable, workspace } from "vscode";
import { Metro } from "../project/metro";
import { sleep } from "../utilities/retry";
import { RADON_CONNECT_PORT_KEY } from "./Connector";
import { extensionContext } from "../utilities/extensionContext";
export const PORT_SCAN_INTERVAL_MS = 4000;
export const DEFAULT_PORTS = [8081, 8082];

export type ScannerDelegate = {
  onPortStatusUpdated: () => void;
  onDeviceCandidateFound: (metro: Metro, websocketAddress: string) => Promise<void>;
};

function isInWorkspace(absoluteFilePath: string) {
  // first check if the provided path is a parent of any workspace folder
  return workspace.workspaceFolders?.some((folder) =>
    absoluteFilePath.startsWith(folder.uri.fsPath)
  );
}

export class Scanner implements Disposable {
  public portsStatus: Map<number, string> = new Map();
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

    const customPort = extensionContext.workspaceState.get<number>(RADON_CONNECT_PORT_KEY);
    const ports = customPort ? [customPort, ...DEFAULT_PORTS] : DEFAULT_PORTS;

    Promise.all(ports.map(this.scanPort.bind(this)))
      .then(() => sleep(PORT_SCAN_INTERVAL_MS))
      .then(this.scanPortsPeriodically.bind(this));
  }

  private async verifyAndConnect(port: number, projectRoot: string) {
    const metro = new Metro(port, [projectRoot]);
    const websocketAddress = await metro.getDebuggerURL();
    if (!websocketAddress) {
      this.portsStatus.set(port, "no connected device listed");
      return false;
    }
    if (!metro.isUsingNewDebugger) {
      this.portsStatus.set(port, "using old debugger");
      return false;
    }

    this.portsStatus.set(port, "connecting...");
    await this.delegate?.onDeviceCandidateFound(metro, websocketAddress);
  }

  private async scanPort(port: number) {
    try {
      if (!this.portsStatus.has(port)) {
        this.portsStatus.set(port, "scanning...");
      }
      const response = await fetch(`http://localhost:${port}/status`);
      if (response.ok) {
        // we expect metro to include a response header X-React-Native-Project-Root
        // that points to the project root folder
        const projectRoot = response.headers.get("X-React-Native-Project-Root");
        if (projectRoot && isInWorkspace(projectRoot)) {
          await this.verifyAndConnect(port, projectRoot);
        } else if (projectRoot) {
          this.portsStatus.set(port, "running for a different workspace");
        } else {
          this.portsStatus.set(port, "not recognized as metro process");
        }
      } else {
        this.portsStatus.set(port, "not running");
      }
    } catch (error) {
      this.portsStatus.set(port, "not running");
    } finally {
      this.delegate?.onPortStatusUpdated();
    }
  }
}
