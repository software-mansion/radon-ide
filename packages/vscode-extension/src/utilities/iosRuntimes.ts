import { IOSRuntimeInfo } from "../common/State";
import { SimCtl } from "./simctl";

export async function getAvailableIosRuntimes(): Promise<IOSRuntimeInfo[]> {
  const runtimes = await SimCtl.listRuntimes();
  return runtimes
    .filter((runtime) => runtime.platform === "iOS")
    .map((runtime) => ({
      platform: runtime.platform,
      identifier: runtime.identifier,
      name: runtime.name,
      version: runtime.version,
      supportedDeviceTypes: runtime.supportedDeviceTypes,
      available: runtime.isAvailable,
    }));
}
