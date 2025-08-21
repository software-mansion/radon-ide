import fs from "fs";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { calculateAppArtifactHash } from "../utilities/common";
import { BuildFingerprint, BuildResult } from "./BuildManager";
import { DevicePlatform } from "../common/State";

const GLOBAL_STATE_BUILD_CACHE_KEY_PREFIX = "build-cache";
const GLOBAL_STATE_LGACY_BUILD_CACHE_PREFIXES = ["android_build_cache", "ios_build_cache"];

function globalStateKey(fingerprint: BuildFingerprint) {
  return `${GLOBAL_STATE_BUILD_CACHE_KEY_PREFIX}:${fingerprint}`;
}

export class BuildCache {
  constructor() {
    BuildCache.clearLegacyCacheEntries();
  }
  /**
   * Passed fingerprint should be calculated at the time build is started.
   */
  public async storeBuild(build: BuildResult) {
    await extensionContext.globalState.update(globalStateKey(build.fingerprint), build);
    // we expect store build not to happen frequently (we only call it after ssucesfull builds which typically takes some time)
    // therefore we use this place to fire cache GC asynchronously (no await)
    this.collectGarbageCacheEntriesNow();
  }

  public async clearCache(fingerprint: BuildFingerprint) {
    await extensionContext.globalState.update(globalStateKey(fingerprint), undefined);
  }

  public static async clearLegacyCacheEntries() {
    const keys = await extensionContext.globalState.keys();
    const keysToRemove = keys.filter((key) =>
      GLOBAL_STATE_LGACY_BUILD_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))
    );
    await Promise.all(
      keysToRemove.map((key) => extensionContext.globalState.update(key, undefined))
    );
  }

  private async collectGarbageCacheEntriesNow() {
    const keys = await extensionContext.globalState.keys();
    Logger.info(
      `Collecting garbage cache entries. ${keys.length} keys present in the global state.`
    );
    const keysToRemove = keys.filter((key) => key.startsWith(GLOBAL_STATE_BUILD_CACHE_KEY_PREFIX));
    const buildResultsForAppPaths = new Map<string, [BuildResult]>();
    const promises = [];

    for (const key of keysToRemove) {
      const cachedBuild = extensionContext.globalState.get<BuildResult>(key);
      if (cachedBuild) {
        // the GC logic tries to only check if the app artifact exists, it does not verify the
        // hash of the artifact, unless there's a key collision.
        // Key collision means that there are two distinct configurations with different
        // fingerprints that produce the same app artifacts. In that case, we want to only
        // keep the one with matching hash
        // the GC logic only checks if the app artifact exists, it does not verify the
        // hash of the artifacts as this is a more expensive operation and we rely on
        // the build artifacts to be eventually wiped from the disk if not used.
        const appPath =
          cachedBuild.platform === DevicePlatform.Android
            ? cachedBuild.apkPath
            : cachedBuild.appPath;
        const appExists = await fs.existsSync(appPath);
        if (appExists) {
          const appPaths = buildResultsForAppPaths.get(appPath);
          if (appPaths) {
            appPaths.push(cachedBuild);
          } else {
            buildResultsForAppPaths.set(appPath, [cachedBuild]);
          }
        } else {
          promises.push(extensionContext.globalState.update(key, undefined));
        }
      }
    }

    for (const [appPath, buildResults] of buildResultsForAppPaths) {
      if (buildResults.length > 1) {
        // this means that there are multiple keys pointing to the same app artifact
        // we need to calculate the hash of the app artifact and delete ones with different hashes
        const appHash = await calculateAppArtifactHash(appPath);
        buildResults.forEach((cachedBuild) => {
          if (cachedBuild.buildHash !== appHash) {
            promises.push(
              extensionContext.globalState.update(
                globalStateKey(cachedBuild.fingerprint),
                undefined
              )
            );
          }
        });
      }
    }

    await Promise.all(promises);
  }

  public async getBuild(fingerprint: BuildFingerprint) {
    const cachedBuild = extensionContext.globalState.get<BuildResult>(globalStateKey(fingerprint));
    if (!cachedBuild) {
      Logger.debug("No cached build found.");
      return undefined;
    }

    const fingerprintsMatch = cachedBuild.fingerprint === fingerprint;
    if (!fingerprintsMatch) {
      Logger.info(
        `Fingerprint mismatch, cannot use cached build. Old: '${cachedBuild.fingerprint}', new: '${fingerprint}'.`
      );
      return undefined;
    }

    const appPath =
      cachedBuild.platform === DevicePlatform.Android ? cachedBuild.apkPath : cachedBuild.appPath;
    try {
      const builtAppExists = fs.existsSync(appPath);
      if (!builtAppExists) {
        Logger.info("Couldn't use cached build. App artifact not found.");
        return undefined;
      }

      const appHash = await calculateAppArtifactHash(appPath);
      const hashesMatch = appHash === cachedBuild.buildHash;
      if (hashesMatch) {
        Logger.info("Using cached build.");
        return cachedBuild;
      }
    } catch (e) {
      // we only log the error and ignore it to allow new build to start
      Logger.error("Error while attempting to load cached build: ", e);
      return undefined;
    }
  }
}
