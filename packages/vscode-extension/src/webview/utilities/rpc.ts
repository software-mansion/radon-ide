import { vscode } from "../utilities/vscode";

let globalCallCounter = 1;

let globalCallbackCounter = 1;
let callbackToID = new WeakMap<(...args: any[]) => void, number>();
let idToCallback = new Map<number, (...args: any[]) => void>();

/* this is used on the webview side to create a proxy of an object that lives on the extension side */
export function makeProxy<T extends object>(objectName: string) {
  return new Proxy<T>({} as T, {
    get(_, methodName) {
      return (...args: any[]) => {
        const currentCallId = globalCallCounter++;
        let argsWithCallbacks = args.map((arg) => {
          if (typeof arg === "function") {
            const callbackId = callbackToID.get(arg) || globalCallbackCounter++;
            idToCallback.set(callbackId, arg);
            if (callbackId === 1) {
              window.addEventListener("message", (event) => {
                if (event.data.command === "callback") {
                  const callback = idToCallback.get(event.data.callbackId);
                  if (callback) {
                    callback(...event.data.args);
                  }
                }
              });
            }
            return {
              __callbackId: callbackId,
            };
          } else {
            return arg;
          }
        });

        vscode.postMessage({
          command: "call",
          callId: currentCallId,
          object: objectName,
          method: methodName,
          args: argsWithCallbacks,
        });
        return new Promise((resolve, reject) => {
          window.addEventListener("message", (event) => {
            if (event.data.command === "callResult" && event.data.callId === currentCallId) {
              if (event.data.error) {
                reject(event.data.error);
              } else {
                resolve(event.data.result);
              }
            }
          });
        });
      };
    },
  });
}
