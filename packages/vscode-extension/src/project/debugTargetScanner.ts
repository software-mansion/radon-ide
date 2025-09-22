import _ from "lodash";
import { Disposable } from "vscode";
import { EXPO_GO_BUNDLE_ID, EXPO_GO_PACKAGE_NAME } from "../builders/expoGo";
import { DeviceInfo, DevicePlatform } from "../common/State";
import { Logger } from "../Logger";
import { CancelToken } from "../utilities/cancelToken";
import { connectCDPAndEval } from "../utilities/connectCDPAndEval";
import { sleep, progressiveRetryTimeout } from "../utilities/retry";
import { CDPTargetDescription, MetroSession } from "./metro";

interface DebuggerTargetDescription {
  websocketAddress: string;
  isUsingNewDebugger: boolean;
  deviceName: string;
  deviceId?: string;
}

function targetDeviceFilter(deviceInfo: DeviceInfo) {
  return (target: CDPTargetDescription) => {
    if (deviceInfo.platform === DevicePlatform.IOS) {
      // On iOS, we want to connect to the target that has the same device name as our device
      return target.deviceName === deviceInfo.displayName;
    } else {
      // TODO: figure out how to get this string from the AVD or system image
      return target.deviceName.startsWith("sdk_gphone64_");
    }
  };
}

export class DebuggerTargetScanner implements Disposable {
  constructor(private readonly metro: MetroSession) {}

  public async waitForTarget({
    filter,
    cancelToken,
  }: {
    filter?: (page: CDPTargetDescription) => boolean;
    cancelToken: CancelToken;
  }) {
    let retryCount = 0;
    while (!cancelToken.cancelled) {
      retryCount++;
      try {
        const debuggerPages = await this.metro.getDebuggerPages();

        const filteredPages = filter ? debuggerPages.filter(filter) : debuggerPages;

        const debuggerTarget = await pickDebuggerTarget(filteredPages);
        if (debuggerTarget !== undefined) {
          return debuggerTarget;
        }
        await cancelToken.adapt(sleep(progressiveRetryTimeout(retryCount)));
      } catch (e) {
        if (cancelToken.cancelled) {
          return undefined;
        }
        throw e;
      }
    }
    return undefined;
  }

  public dispose(): void {}
}

export async function getDebuggerTargetForDevice(
  metro: MetroSession,
  deviceInfo: DeviceInfo,
  cancelToken: CancelToken
): Promise<DebuggerTargetDescription | undefined> {
  return new DebuggerTargetScanner(metro).waitForTarget({
    filter: targetDeviceFilter(deviceInfo),
    cancelToken,
  });
}

function isNewDebuggerPage(page: CDPTargetDescription) {
  return (
    page.reactNative &&
    (page.title.startsWith("React Native Bridge") ||
      page.description?.endsWith("[C++ connection]") ||
      page.reactNative?.capabilities?.prefersFuseboxFrontend)
  );
}

async function isActiveExpoGoAppRuntime(webSocketDebuggerUrl: string) {
  // This method checks for a global variable that is set in the expo host runtime.
  // We expect this variable to not be present in the main app runtime.
  const HIDE_FROM_INSPECTOR_ENV = "(globalThis.__expo_hide_from_inspector__ || 'runtime')";
  try {
    const result = await connectCDPAndEval(webSocketDebuggerUrl, HIDE_FROM_INSPECTOR_ENV);
    if (result === "runtime") {
      return true;
    }
  } catch (e) {
    Logger.warn(
      "Error checking expo go runtime",
      webSocketDebuggerUrl,
      "(this could be stale/inactive runtime)",
      e
    );
  }
  return false;
}

async function lookupWsAddressForNewDebugger(listJson: CDPTargetDescription[]) {
  // In the new debugger, ids are generated in the following format: "deviceId-pageId"
  // but unlike with the old debugger, deviceId is a hex string (UUID most likely)
  // that is stable between reloads.
  // Subsequent runtimes that register get incremented pageId (e.g. main runtime will
  // be 1, reanimated worklet runtime would get 2, etc.)
  // The most recent runtimes are listed first, so we can pick the first one with title
  // that starts with "React Native Bridge" (which is the main runtime)
  const newDebuggerPages = listJson.filter(isNewDebuggerPage);
  if (newDebuggerPages.length > 0) {
    const description = newDebuggerPages[0].description;
    const appId = newDebuggerPages[0]?.appId;
    const isExpoGo =
      description === EXPO_GO_BUNDLE_ID ||
      description === EXPO_GO_PACKAGE_NAME ||
      appId === EXPO_GO_BUNDLE_ID ||
      appId === EXPO_GO_PACKAGE_NAME;
    if (isExpoGo) {
      // Expo go apps using the new debugger could report more then one page,
      // if it exist the first one being the Expo Go host runtime.
      // more over expo go on android has a bug causing newDebuggerPages
      // from previously run applications to leak if the host application
      // was not stopped.
      // to solve both issues we check if the runtime is part of
      // the host application process and select the last one that
      // is not. To perform this check we use expo host functionality
      // introduced in https://github.com/expo/expo/pull/32322/files
      for (const newDebuggerPage of newDebuggerPages.reverse()) {
        if (await isActiveExpoGoAppRuntime(newDebuggerPage.webSocketDebuggerUrl)) {
          return newDebuggerPage;
        }
      }
      return undefined;
    }
    return newDebuggerPages[0];
  }
  return undefined;
}

function lookupWsAddressForOldDebugger(listJson: CDPTargetDescription[]) {
  // Pre 0.76 RN metro lists debugger pages that are identified as "deviceId-pageId"
  // After new device is connected, the deviceId is incremented while pageId could be
  // either 1 or -1 where "-1" corresponds to connection that supports reloads.
  // We search for the most recent device id and want to use special -1 page identifier (reloadable page)
  let recentDeviceId = -1;
  let target;
  for (const page of listJson) {
    // pageId can sometimes be negative so we can't just use .split('-') here
    const matches = page.id.match(/([^-]+)-(-?\d+)/);

    if (!matches) {
      continue;
    }
    const pageId = parseInt(matches[2]);
    if (pageId !== -1) {
      continue;
    }
    //If deviceId is a number we want to pick the highest one, with expo it's never a number and we pick the latest record
    if (Number.isInteger(matches[1])) {
      const deviceId = parseInt(matches[1]);
      if (deviceId < recentDeviceId) {
        continue;
      }
      recentDeviceId = deviceId;
    }
    target = page;
  }
  return target;
}

async function pickDebuggerTarget(listJson: CDPTargetDescription[]) {
  const [newDebuggerPages, oldDebuggerPages] = _.partition(listJson, isNewDebuggerPage);
  const usesNewDebugger = newDebuggerPages.length > 0;
  const page = usesNewDebugger
    ? await lookupWsAddressForNewDebugger(newDebuggerPages)
    : lookupWsAddressForOldDebugger(oldDebuggerPages);

  if (page) {
    return {
      websocketAddress: page.webSocketDebuggerUrl,
      deviceName: page.deviceName,
      isUsingNewDebugger: usesNewDebugger,
      deviceId: page.reactNative?.logicalDeviceId,
    };
  }
}
