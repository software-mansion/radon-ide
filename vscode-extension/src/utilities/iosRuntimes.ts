import fetch from "node-fetch";
import plist from "plist";
import { RuntimeInfo } from "../devices/IosSimulatorDevice";
import { exec } from "./subprocess";

interface SimulatorPackage {
  name: string;
  contentType: string;
  category: string;
  source: string;
  simulatorVersion: {
    version: string;
    buildUpdate: string;
  };
  fileSize: number;
  platform: string;
}

const DOWNLOADABLE_IOS_RUNTIMES_URL =
  "https://devimages-cdn.apple.com/downloads/xcode/simulators/index2.dvtdownloadableindex";

export async function getAllAvailableIosRuntimes() {
  const runtimesResponse = await fetch(DOWNLOADABLE_IOS_RUNTIMES_URL);
  const runtimesRaw = await runtimesResponse.text();
  const runtimes = plist.parse(runtimesRaw) as { downloadables: any[] };
  const filteredRuntimes = runtimes.downloadables.filter(
    (downloadable) =>
      downloadable.category === "simulator" &&
      downloadable.contentType === "diskImage" &&
      downloadable.platform === "com.apple.platform.iphoneos"
  ) as SimulatorPackage[];
  return filteredRuntimes;
}

export async function getAvailableIosRuntimes(): Promise<Array<RuntimeInfo>> {
  const result: { runtimes: Array<RuntimeInfo> } = JSON.parse(
    (await exec("xcrun", ["simctl", "list", "runtimes", "--json"])).stdout
  );
  return result.runtimes.filter((runtime) => runtime.platform === "iOS" && runtime.isAvailable);
}
