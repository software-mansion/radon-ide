import { PreviewsPanel } from "../panels/PreviewsPanel";

const http = require("http");
const { Server } = require("ws");

export class Devtools {
  public readonly port: number;
  private server: any;
  private socket: any;
  private listeners: Set<(event: string, payload: any) => void> = new Set();

  constructor({ port }: { port: number }) {
    this.port = port;
    this.server = http.createServer(() => {});
    const wss = new Server({ server: this.server });

    wss.on("connection", (ws: any) => {
      console.log("Devtools client connected");
      this.socket = ws;

      // When data is received from a client
      ws.on("message", (message: string) => {
        try {
          const { event, payload } = JSON.parse(message);
          console.log("Devtools msg", event);
          this.listeners.forEach((listener) => listener(event, payload));
        } catch (e) {
          console.log("Error", e);
        }
      });
    });

    this.server.listen(port, () => {});

    this.addListener((event, payload) => {
      if (event === "rnp_appReady") {
        console.log("App ready");
        const { appKey } = payload;
        if (appKey !== "main") {
          PreviewsPanel.currentPanel?.notifyAppUrlChanged(appKey);
        }
      } else if (event === "rnp_appUrlChanged") {
        PreviewsPanel.currentPanel?.notifyAppUrlChanged(payload.url);
      }
    });
  }

  public shutdown() {
    this.server.close();
  }

  public send(event: string, payload?: any) {
    this.socket?.send(JSON.stringify({ event, payload }));
  }

  public rpc(event: string, payload: any, responseEvent: string, callback: (payload: any) => void) {
    const listener = (event: string, payload: any) => {
      if (event === responseEvent) {
        callback(payload);
        this.removeListener(listener);
      }
    };

    this.addListener(listener);
    this.send(event, payload);
  }

  public addListener(listener: (event: string, payload: any) => void) {
    this.listeners.add(listener);
  }

  public removeListener(listener: (event: string, payload: any) => void) {
    this.listeners.delete(listener);
  }
}
