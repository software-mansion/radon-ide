import {
  NativeModulesProxy,
  EventEmitter,
  Subscription,
} from "expo-modules-core";

// Import the native module. On web, it will be resolved to NativeExceptionTrigger.web.ts
// and on native platforms to NativeExceptionTrigger.ts
import NativeExceptionTriggerModule from "./src/NativeExceptionTriggerModule";
import NativeExceptionTriggerView from "./src/NativeExceptionTriggerView";
import {
  ChangeEventPayload,
  NativeExceptionTriggerViewProps,
} from "./src/NativeExceptionTrigger.types";

// Get the native constant value.
export const PI = NativeExceptionTriggerModule.PI;

export function throwNativeException(): string {
  return NativeExceptionTriggerModule.throwNativeException();
}

export function crashApp() {
  return NativeExceptionTriggerModule.crashApp();
}

export async function setValueAsync(value: string) {
  return await NativeExceptionTriggerModule.setValueAsync(value);
}

const emitter = new EventEmitter(
  NativeExceptionTriggerModule ?? NativeModulesProxy.NativeExceptionTrigger
);

export function addChangeListener(
  listener: (event: ChangeEventPayload) => void
): Subscription {
  return emitter.addListener<ChangeEventPayload>("onChange", listener);
}

export {
  NativeExceptionTriggerView,
  NativeExceptionTriggerViewProps,
  ChangeEventPayload,
};
