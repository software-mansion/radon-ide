import http from "http";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { app } from "./server.js";

let server = null;
let wss = null;
let appWebsocket = null;

export function resetAppWebsocket() {
  appWebsocket = null;
}

export function getAppWebsocket() {
  return appWebsocket;
}

export function waitForMessage(id, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const currentWs = getAppWebsocket();
    if (!currentWs) {
      reject(new Error("No websocket connection"));
      return;
    }

    const timer = setTimeout(() => {
      currentWs.off("message", handler);
      reject(new Error("Timeout waiting for message"));
    }, timeoutMs);

    const handler = (message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.id === id) {
          clearTimeout(timer);
          currentWs.off("message", handler);
          resolve(msg);
        }
      } catch (e) {}
    };

    currentWs.on("message", handler);
  });
}

export function closeServer() {
  if (wss) {
    wss.clients.forEach((client) => {
      try {
        client.terminate();
      } catch {}
    });

    wss.close(() => {
      console.log("WebSocket server closed");
    });
    wss = null;
    appWebsocket = null;
  }

  if (server) {
    server.close(() => {
      console.log("HTTP server closed");
    });
    server = null;
  }
}

export function initServer(port = 8080) {
  if (wss) {
    console.warn("WebSocket server already initialized");
    return wss;
  }

  server = http.createServer(app);
  wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    appWebsocket = ws;
    console.log("WS: Client connected");

    ws.send(
      JSON.stringify({ type: "WELCOME", message: "Connected to Live Ticker" })
    );

    ws.on("message", (message) => {
      const msgStr = message.toString();
      try {
        const msg = JSON.parse(msgStr);
        console.log("Received message:", msg);
      } catch (e) {
        console.log("Received raw message:", msgStr);
      }

      ws.send(JSON.stringify({ type: "ECHO", content: msgStr }));
    });

    ws.on("close", () => {
      if (appWebsocket === ws) appWebsocket = null;
      console.log("Client disconnected");
    });
  });

  server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`WebSocket server listening on ws://localhost:${port}`);
  });

  return wss;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initServer(8080);
}
