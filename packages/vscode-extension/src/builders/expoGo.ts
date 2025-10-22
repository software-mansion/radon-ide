import path from "path";
import http from "http";
import { extensionContext } from "../utilities/extensionContext";
import { exec } from "../utilities/subprocess";
import { CancelToken } from "../utilities/cancelToken";
import { DevicePlatform } from "../common/State";
import { checkNativeDirectoryExists } from "../utilities/checkNativeDirectoryExists";
import { fileExists } from "../utilities/fileExists";
import { requireNoCache } from "../utilities/requireNoCache";

type ExpoDeeplinkChoice = "expo-go" | "expo-dev-client";

export const EXPO_GO_BUNDLE_ID = "host.exp.Exponent";
export const EXPO_GO_PACKAGE_NAME = "host.exp.exponent";

export async function isExpoGoProject(appRoot: string, platform: DevicePlatform): Promise<boolean> {
  // There is no straightforward way to tell apart different react native project
  // setups. i.e. expo-go, expo-dev-client, bare react native, etc.
  // Here, we are using a heuristic to determine if the project is expo-go based
  // on the following factors:
  // 1) The project has app.json or app.config.js
  // 2) The project doesn't have an android or ios folder
  // 3) The expo_go_project_tester.js script runs successfully – the script uses expo-cli
  // internals to resolve project config and tells expo-go and dev-client apart.

  if (!fileExists(appRoot, "app.json") && !fileExists(appRoot, "app.config.js")) {
    // app.json or app.config.js is required for expo-go projects
    return false;
  }

  const nativeDirectoryExists = await checkNativeDirectoryExists(appRoot, platform);
  if (nativeDirectoryExists) {
    // expo-go projects don't have android or ios folders
    return false;
  }

  const expoGoProjectTesterScript = path.join(
    extensionContext.extensionPath,
    "lib",
    "expo",
    "expo_go_project_tester.js"
  );
  try {
    const result = await exec("node", [expoGoProjectTesterScript], {
      cwd: appRoot,
      allowNonZeroExit: true,
    });
    return result.exitCode === 0;
  } catch (e) {
    return false;
  }
}

export function getExpoVersion(appRoot: string) {
  const expoPackage = requireNoCache(path.join("expo", "package.json"), {
    paths: [appRoot],
  });
  return expoPackage.version;
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
          const location = new URL(res.headers.location!);
          // NOTE: for physical Android devices, the address for the host machine is different
          // than the one we get in the redirect. However, since we forward the metro port, we can
          // use `localhost` for the host without issue.
          location.hostname = "localhost";
          resolve(location.toString());
        } else {
          resolve();
        }
        res.resume();
      }
    );
    req.on("error", (e) => {
      if ((e as NodeJS.ErrnoException).code === "ECONNREFUSED") {
        // if host is not reachable, we want to report an issue as it is likely
        // related to metro process that got terminated
        reject(new Error("Unable to reach metro server", { cause: e }));
      } else {
        // in case of other errors, we let the process continue as it means that
        // the metro instance we're trying to reach is not associated with expo-go
        // or dev-client and we should proceed launching the app using simulator
        // or emulator controls.
        resolve();
      }
    });
    req.end();
  });
}

export async function downloadExpoGo(
  platform: DevicePlatform,
  cancelToken: CancelToken,
  appRoot: string
) {
  const downloadScript = path.join(
    extensionContext.extensionPath,
    "lib",
    "expo",
    "expo_go_download.js"
  );
  const { stdout } = await cancelToken.adapt(
    exec("node", [downloadScript, platform], {
      cwd: appRoot,
    })
  );

  // While expo downloads the file, it prints '- Fetching Expo Go' and at the last line it prints the path to the downloaded file
  // we want to wait until the file is downloaded before we return the path
  const lines = stdout.split("\n");
  const filepath = lines[lines.length - 1];
  return filepath;
}
