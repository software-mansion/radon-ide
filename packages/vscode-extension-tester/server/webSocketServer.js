import { WebSocketServer, WebSocket } from "ws";

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

export function resetAppWebsocket() {
  appWebsocket = null;
}

export function getAppWebsocket() {
  return appWebsocket;
}

export function waitForMessage(id, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const appWebsocket = getAppWebsocket();

    if (!appWebsocket || appWebsocket.readyState !== WebSocket.OPEN) {
      reject(
        new Error(
          `Websocket not connected or not ready. State: ${appWebsocket?.readyState}`
        )
      );
      return;
    }

    const timer = setTimeout(() => {
      appWebsocket.off("message", handler);
      reject(new Error(`Timeout waiting for message ID: ${id}`));
    }, timeoutMs);

    const handler = (message) => {
      try {
        const msg = JSON.parse(message);
        if (msg.id === id) {
          clearTimeout(timer);
          appWebsocket.off("message", handler);
          resolve(msg);
        }
      } catch (e) {
        console.error("Error parsing message:", message);
        console.error(e);
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
