import path from "path";
import { extensionContext, getAppRootFolder } from "../utilities/extensionContext";
import http from "http";
import { exec } from "../utilities/subprocess";

type ExpoDeeplinkChoice = "expo-go" | "expo-dev-client";

export async function shouldUseExpoGo(): Promise<boolean> {
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
