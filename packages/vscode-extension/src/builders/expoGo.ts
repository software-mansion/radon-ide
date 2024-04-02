import path from "path";
import { extensionContext, getAppRootFolder } from "../utilities/extensionContext";
import http from "http";
import { exec } from "../utilities/subprocess";
import { Platform } from "../common/DeviceManager";
import { CancelToken } from "./BuildManager";

type ExpoDeeplinkChoice = "expo-go" | "expo-dev-client";

export async function isExpoGoProject(): Promise<boolean> {
  const libPath = path.join(extensionContext.extensionPath, "lib");
  const { stdout } = await exec(`node`, [path.join(libPath, "expo_go_usage.js")], {
    cwd: getAppRootFolder(),
  });
  const useExpoGo = stdout === "true";
  return useExpoGo;
}

export function fetchExpoLaunchDeeplink(
  metroPort: number,
  platformString: string,
  choice: ExpoDeeplinkChoice
) {
  return new Promise<string | void>((resolve, reject) => {
    const req = http.request(
      new URL(
        `http://localhost:${metroPort}/_expo/link?platform=${platformString}&choice=${choice}`
      ),
      (res) => {
        if (res.statusCode === 307) {
          // we want to retrieve redirect location
          resolve(res.headers.location);
        } else {
          resolve();
        }
        res.resume();
      }
    );
    req.on("error", (e) => {
      // we still want to resolve on error, because the URL may not exists, in which
      // case it serves as a mechanism for detecting non expo-dev-client setups
      resolve();
    });
    req.end();
  });
}

export async function downloadExpoGo(platform: Platform, cancelToken: CancelToken) {
  const downloadScript = path.join(extensionContext.extensionPath, "lib", "expo_go_download.js");
  const { stdout } = await cancelToken.adapt(
    exec(`node`, [downloadScript, platform], {
      cwd: getAppRootFolder(),
    })
  );

  // While expo downloads the file, it prints '- Fetching Expo Go' and at the last line it prints the path to the downloaded file
  // we want to wait until the file is downloaded before we return the path
  const lines = stdout.split("\n");
  const filepath = lines[lines.length - 1];
  return filepath;
}
