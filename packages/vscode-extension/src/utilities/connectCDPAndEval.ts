import WebSocket from "ws";
import { Logger } from "../Logger";

export async function connectCDPAndEval(
  webSocketDebuggerUrl: string,
  source: string,
  timeoutMs: number = 2000
): Promise<string | undefined> {
  const REQUEST_ID = 0;

  return new Promise((resolve, reject) => {
    let settled = false;
    const ws = new WebSocket(webSocketDebuggerUrl);

    const timeoutHandle = setTimeout(() => {
      reject(new Error("Request timeout"));
      settled = true;
      ws.close();
    }, timeoutMs);

    const settleConnection = () => {
      settled = true;
      clearTimeout(timeoutHandle);
      ws.close();
    };

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          id: REQUEST_ID,
          method: "Runtime.evaluate",
          params: { expression: source },
        })
      );
    });

    ws.on("error", (e) => {
      reject(e);
      settleConnection();
    });

    ws.on("close", () => {
      if (!settled) {
        reject(new Error("WebSocket closed before response was received."));
        clearTimeout(timeoutHandle);
      }
    });

    ws.on("message", (data) => {
      Logger.debug(
        `[evaluateJsFromCdpAsync] message received from ${webSocketDebuggerUrl}: ${data.toString()}`
      );
      try {
        const response = JSON.parse(data.toString());
        if (response.id === REQUEST_ID) {
          if (response.error) {
            reject(new Error(response.error.message));
          } else if (response.result.result.type === "string") {
            resolve(response.result.result.value);
          } else {
            resolve(undefined);
          }
          settleConnection();
        }
      } catch (e) {
        reject(e);
        settleConnection();
      }
    });
  });
}
