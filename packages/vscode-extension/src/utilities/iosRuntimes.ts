import { IOSRuntimeInfo } from "../common/State";
import { exec } from "./subprocess";

type RuntimeInfo = {
  bundlePath: string;
  buildversion: string;
  platform: "iOS" | "tvOS" | "watchOS";
  runtimeRoot: string;
  identifier: string;
  version: string;
  isInternal: boolean;
  isAvailable: boolean;
  name: string;
  supportedDeviceTypes: Array<{ name: string; identifier: string }>;
};

export async function getAvailableIosRuntimes(): Promise<IOSRuntimeInfo[]> {
  const result: { runtimes: RuntimeInfo[] } = JSON.parse(
    (await exec("xcrun", ["simctl", "list", "runtimes", "--json"])).stdout
  );
  const runtimes = result.runtimes
    .filter((runtime) => runtime.platform === "iOS")
    .map((runtime) => ({
      platform: runtime.platform,
      identifier: runtime.identifier,
      name: runtime.name,
      version: runtime.version,
      supportedDeviceTypes: runtime.supportedDeviceTypes,
      available: runtime.isAvailable,
    }));
  // there can be multiple runtimes with the same identifier but different buildversion
  // since the command we use never take build version, we can filter out duplicates and
  // only show a single runtime for each identifier
  const seenIdentifiers = new Set<string>();
  const uniqueRuntimes = runtimes.filter((runtime) => {
    if (seenIdentifiers.has(runtime.identifier)) {
      return false;
    }
    seenIdentifiers.add(runtime.identifier);
    return true;
  });
  return uniqueRuntimes;
}
