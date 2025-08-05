import { Change, Observable, observable } from "@legendapp/state";
import { synced, SyncedSetParams, SyncedSubscribeParams } from "@legendapp/state/sync";
import { vscode } from "../utilities/vscode";
import { createContext, PropsWithChildren, useContext } from "react";
import { initialState, State } from "../../common/State";
import { mergeAndCalculateChanges } from "../../utilities/mergeAndCalculateChanges";

let instanceToken = Math.floor(Math.random() * 1000000);
let globalCallCounter = 1;

const getStateResultPromises = new Map<
  string,
  { resolve: (value: State) => void; reject: (reason?: any) => void }
>();

function getStateResultListener(event: MessageEvent) {
  if (event.data.command === "RNIDE_get_state_result" && event.data.callId) {
    const promise = getStateResultPromises.get(event.data.callId);
    if (promise) {
      getStateResultPromises.delete(event.data.callId);
      if (getStateResultPromises.size === 0) {
        window.removeEventListener("message", getStateResultListener);
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

function registerGetStateResultPromise(
  callId: string,
  resolve: (value: State) => void,
  reject: (reason?: any) => void
) {
  getStateResultPromises.set(callId, { resolve, reject });
  if (getStateResultPromises.size === 1) {
    window.addEventListener("message", getStateResultListener);
  }
}

const getState: () => Promise<State> = async () => {
  const currentCallId = `RNIDE_get_state_${instanceToken}_${globalCallCounter++}`;

  vscode.postMessage({
    command: "RNIDE_get_state",
    callId: currentCallId,
  });

  return new Promise((resolve, reject) => {
    registerGetStateResultPromise(currentCallId, resolve, reject);
  });
};

const setState = async (params: SyncedSetParams<State>) => {
  const { changes } = params;

  const currentCallId = `RNIDE_set_state_${instanceToken}_${globalCallCounter++}`;

  vscode.postMessage({
    command: "RNIDE_set_state",
    callId: currentCallId,
    state: partialNewStateFromChanges(changes),
  });
};

const subscribeToState = (params: SyncedSubscribeParams<State>) => {
  const { update, value$ } = params;
  const listener = (event: any) => {
    if (event.data.command === "RNIDE_state_updated") {
      const oldState = value$.get();
      const [newState] = mergeAndCalculateChanges(oldState, event.data.state);
      update({ value: newState, mode: "set" });
    }
  };

  window.addEventListener("message", listener);
  return () => {
    window.removeEventListener("message", listener);
  };
};

const stateStore$ = observable(
  synced<State>({
    get: getState,
    set: setState,
    subscribe: subscribeToState,
    initial: initialState,
  })
);

const StoreContext = createContext<Observable<State>>(undefined as any);

export default function StoreProvider({ children }: PropsWithChildren) {
  const contextValue = stateStore$;

  return <StoreContext.Provider value={contextValue}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);

  if (context === undefined) {
    throw new Error("useLaunchConfig must be used within a StoreContextProvider");
  }
  return context;
}

function partialNewStateFromChanges(changes: Change[]) {
  const result: any = {};
  changes.forEach((change) => {
    let current = result;
    const path = change.path;
    path.forEach((key, index) => {
      if (index === path.length - 1) {
        current[key] = change.valueAtPath;
      } else {
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
    });
  });
  return result;
}
