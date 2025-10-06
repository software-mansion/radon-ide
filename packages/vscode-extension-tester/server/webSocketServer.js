import { WebSocketServer } from "ws";

let wss = null;
let appWebsocket = null;

export function initServer(port = 8080) {
  if (wss) {
    console.warn("WebSocket server already initialized");
    return;
  }

  wss = new WebSocketServer({ port });

  wss.on("connection", (ws) => {
    appWebsocket = ws;

    ws.on("message", (message) => {
      const msg = JSON.parse(message);
      console.log("Received message:", msg);
    });

    ws.on("close", () => {
      appWebsocket = null;
      console.log("Client disconnected");
    });
  });

  console.log(`WebSocket server listening on ws://localhost:${port}`);
  return wss;
}

export function getAppWebsocket() {
  return appWebsocket;
}

export function waitForMessage(id, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const appWebsocket = getAppWebsocket();
    if (!appWebsocket) {
      reject(new Error("No websocket connection"));
      return;
    }

    const timer = setTimeout(() => {
      appWebsocket.off("message", handler);
      reject(new Error("Timeout waiting for message"));
    }, timeoutMs);

    const handler = (message) => {
      const msg = JSON.parse(message);
      if (msg.id === id) {
        clearTimeout(timer);
        appWebsocket.off("message", handler);
        resolve(msg);
      }
    };

    appWebsocket.on("message", handler);
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
}
