import { vscode } from "../utilities/vscode";

let globalCallCounter = 1;

let globalCallbackCounter = 1;
let callbackToID = new WeakMap<(...args: any[]) => void, string>();
let idToCallback = new Map<string, (...args: any[]) => void>();
let callbackMessageListenerInitialized = false;
let instanceToken = Math.floor(Math.random() * 1000000);

let callResultPromises = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (reason?: any) => void }
>();

function callResultListener(event: MessageEvent) {
  if (event.data.command === "callResult" && event.data.callId) {
    const promise = callResultPromises.get(event.data.callId);
    if (promise) {
      callResultPromises.delete(event.data.callId);
      if (callResultPromises.size === 0) {
        window.removeEventListener("message", callResultListener);
      }
      if (event.data.error) {
        const errorData = event.data.error;
        const error = new Error(errorData.message);
        error.name = errorData.name;
        promise.reject(error);
      } else {
        promise.resolve(event.data.result);
      }
    }
  }
}

function registerCallResultPromise(
  callId: string,
  resolve: (value: unknown) => void,
  reject: (reason?: any) => void
) {
  callResultPromises.set(callId, { resolve, reject });
  if (callResultPromises.size === 1) {
    window.addEventListener("message", callResultListener);
  }
}

function maybeInitializeCallbackMessageListener() {
  if (callbackMessageListenerInitialized) {
    return;
  }
  callbackMessageListenerInitialized = true;
  window.addEventListener("message", (event) => {
    if (event.data.command === "callback") {
      const callback = idToCallback.get(event.data.callbackId);
      if (callback) {
        callback(...event.data.args);
      }
    } else if (event.data.command === "cleanupCallback") {
      idToCallback.delete(event.data.callbackId);
    }
  });
}

/* this is used on the webview side to create a proxy of an object that lives on the extension side */
export function makeProxy<T extends object>(objectName: string) {
  return new Proxy<T>({} as T, {
    get(_, methodName) {
      return (...args: any[]) => {
        const currentCallId = `${instanceToken}:${globalCallCounter++}`;
        let argsWithCallbacks = args.map((arg) => {
          if (typeof arg === "function") {
            maybeInitializeCallbackMessageListener();
            const callbackId =
              callbackToID.get(arg) || `${instanceToken}:${globalCallbackCounter++}`;
            callbackToID.set(arg, callbackId);
            idToCallback.set(callbackId, arg);
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
          registerCallResultPromise(currentCallId, resolve, reject);
        });
      };
    },
  });
}
