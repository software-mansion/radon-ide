import path from "path";
import { Disposable } from "vscode";
import { createFingerprintAsync } from "@expo/fingerprint";
import { watchProjectFiles } from "../utilities/watchProjectFiles";
import { Logger } from "../Logger";
import { command } from "../utilities/subprocess";
import { DevicePlatform } from "../common/State";

type Fingerprint = string;

export interface FingerprintOptions {
  appRoot: string;
  platform: DevicePlatform;
  env?: Record<string, string>;
  fingerprintCommand?: string;
}

type CustomFingerprintOptions = FingerprintOptions & {
  fingerprintCommand: string;
};

const IGNORE_PATHS_BASE = [
  path.join("android", ".gradle/**/*"),
  path.join("android", "build/**/*"),
  path.join("android", "app", "build/**/*"),
  path.join("ios", "build/**/*"),
  path.join("ios", "DerivedData/**/*"),
  "**/node_modules/**/android/.cxx/**/*",
  "**/node_modules/**/.gradle/**/*",
  "**/node_modules/**/android/build/intermediates/cxx/**/*",
];

function resolveIgnoredPaths(platform: DevicePlatform) {
  let result = IGNORE_PATHS_BASE;
  if (platform === DevicePlatform.IOS) {
    result = [...result, path.join("android", "**/*")];
  }
  if (platform === DevicePlatform.Android) {
    result = [...result, path.join("ios", "**/*")];
  }
  return result;
}

export async function runFingerprintCommand(
  options: CustomFingerprintOptions
): Promise<Fingerprint | undefined> {
  try {
    const { appRoot, env, fingerprintCommand } = options;
    const output = await command(fingerprintCommand, {
      env,
      cwd: appRoot,
    });
    if (!output) {
      return undefined;
    }
    const lastLine = output.stdout
      .split("\n")
      // find last non-empty line
      .findLast((line) => line.trim().length > 0)
      ?.trim();
    return lastLine || undefined;
  } catch (error) {
    Logger.error("Error running custom fingerprint command:", error);
    return undefined;
  }
}

async function calculateCustomFingerprint(options: CustomFingerprintOptions): Promise<Fingerprint> {
  Logger.debug(`Using custom fingerprint script '${options.fingerprintCommand}'`);
  const fingerprint = await runFingerprintCommand(options);

  if (!fingerprint) {
    throw new Error("Failed to generate application fingerprint using custom script.");
  }

  Logger.debug("Application fingerprint", fingerprint);
  return fingerprint;
}

export class FingerprintProvider implements Disposable {
  private workspaceWatcher: Disposable;
  private fingerprintCache: Map<string, Promise<Fingerprint>> = new Map();

  constructor() {
    this.workspaceWatcher = watchProjectFiles(this.onProjectFilesChanged);
  }

  public calculateFingerprint(options: FingerprintOptions): Promise<Fingerprint> {
    const cacheKey = this.makeCacheKey(options);
    const cachedFingerprintPromise = this.fingerprintCache.get(cacheKey);
    if (cachedFingerprintPromise) {
      Logger.debug("Using cached fingerprint");
      return cachedFingerprintPromise;
    }
    Logger.debug("Calculating fingerprint");
    const { appRoot } = options;

    let fingerprintPromise: Promise<Fingerprint>;
    if (options.fingerprintCommand !== undefined) {
      Logger.debug("Using custom fingerprint command");
      fingerprintPromise = calculateCustomFingerprint(options as CustomFingerprintOptions);
    } else {
      fingerprintPromise = createFingerprintAsync(appRoot, {
        platforms: [options.platform === DevicePlatform.IOS ? "ios" : "android"],
        ignorePaths: resolveIgnoredPaths(options.platform),
      }).then((fingerprint) => fingerprint.hash);
    }

    this.fingerprintCache.set(cacheKey, fingerprintPromise);
    fingerprintPromise.catch(() => {
      // NOTE: on error, we remove the promise from the cache so that further calls will retry
      if (this.fingerprintCache.get(cacheKey) === fingerprintPromise) {
        this.fingerprintCache.delete(cacheKey);
      }
    });

    return fingerprintPromise;
  }

  private makeCacheKey(options: FingerprintOptions): string {
    return `${options.appRoot}:${options.platform}:${options.fingerprintCommand || ""}`;
  }

  private onProjectFilesChanged = () => {
    this.fingerprintCache.clear();
  };

  dispose() {
    this.workspaceWatcher.dispose();
  }
}
