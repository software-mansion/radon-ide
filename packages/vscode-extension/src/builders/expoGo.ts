import fs from "fs";
import path from "path";
import { getAppRootFolder } from "../utilities/extensionContext";
import http from "http";

type ExpoDeeplinkChoice = "expo-go" | "expo-dev-client";

export function shouldUseExpoGo(): boolean {
  // TODO: Check for better solution to determine whether Expo Go should be used
  const androidExists = fs.existsSync(path.join(getAppRootFolder(), "android"));
  const iosExists = fs.existsSync(path.join(getAppRootFolder(), "ios"));
  return !(androidExists && iosExists);
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
