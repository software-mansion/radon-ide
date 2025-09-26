import assert from "assert";
import { Disposable } from "vscode";
import { exec } from "../utilities/subprocess";
import { BuildError, BuildOptions } from "../builders/BuildManager";
import {
  IOSLocalBuildConfig,
  AndroidLocalBuildConfig,
  AndroidDevClientBuildConfig,
  IOSDevClientBuildConfig,
} from "../common/BuildConfig";
import { DevicePlatform } from "../common/State";
import { FingerprintProvider } from "../project/FingerprintProvider";
import { lineReader } from "../utilities/subprocess";
import { CancelError, CancelToken } from "../utilities/cancelToken";
import { extensionContext } from "../utilities/extensionContext";
import _ from "lodash";
import crypto from "crypto";
import { checkNativeDirectoryExists } from "../utilities/checkNativeDirectoryExists";

class PrebuildProcess {
  private attachedCounter = 0;
  public finished: Promise<void>;

  constructor(
    process: Promise<void>,
    private cancelToken: CancelToken
  ) {
    this.finished = this.cancelToken.adapt(process);
  }

  public attach(cancelToken: CancelToken) {
    this.attachedCounter++;
    cancelToken.onCancel(() => {
      this.attachedCounter--;
      if (this.attachedCounter === 0) {
        this.cancel();
      }
    });
  }

  public cancel() {
    this.cancelToken.cancel();
  }
}

function getEnvHash(env: Record<string, string>) {
  const sortedEnv = _.sortBy(Object.entries(env), ([key, _value]) => key);
  const envHash = crypto.createHash("md5");
  sortedEnv.forEach(([k, v]) => {
    envHash.update(`${k}=${v}`);
  });
  return envHash.digest("hex");
}

function getPersistKey(platform: DevicePlatform, appRoot: string, env?: Record<string, string>) {
  const key = `prebuild:${platform}:${appRoot}:${getEnvHash(env ?? {})}`;
  return key;
}

export class Prebuild implements Disposable {
  private prebuildProcessByPlatform = new Map<DevicePlatform, PrebuildProcess>();

  constructor(private fingerprintProvider: FingerprintProvider) {}

  dispose() {
    this.prebuildProcessByPlatform.forEach((prebuildProcess) => {
      prebuildProcess.cancel();
    });
  }

  public async runPrebuildIfNeeded(
    buildConfig:
      | IOSLocalBuildConfig
      | AndroidLocalBuildConfig
      | AndroidDevClientBuildConfig
      | IOSDevClientBuildConfig,
    buildOptions: BuildOptions
  ) {
    const { forceCleanBuild, cancelToken } = buildOptions;
    const [currentFingerprint, nativeDirectoryExists] = await Promise.all([
      this.fingerprintProvider.calculateFingerprint(buildConfig),
      checkNativeDirectoryExists(buildConfig.appRoot, buildConfig.platform),
    ]);
    const persistKey = getPersistKey(buildConfig.platform, buildConfig.appRoot, buildConfig.env);
    const lastSuccessfulFingerprint = extensionContext.workspaceState.get<string>(persistKey);
    // NOTE: we do this after the asynchronous tasks to ensure we didn't grab a process which cancels/fails while we're checking other things
    const ongoingPrebuild = this.prebuildProcessByPlatform.get(buildConfig.platform);

    const hasAlreadyPrebuild =
      ongoingPrebuild === undefined && lastSuccessfulFingerprint === currentFingerprint;
    const isCurrentlyPrebuilding = ongoingPrebuild !== undefined;

    const canSkipPrebuild =
      !forceCleanBuild && nativeDirectoryExists && (hasAlreadyPrebuild || isCurrentlyPrebuilding);
    if (canSkipPrebuild) {
      if (isCurrentlyPrebuilding) {
        ongoingPrebuild.attach(cancelToken);
        return await ongoingPrebuild.finished;
      } else {
        // NOTE: follows from `canSkipPrebuild` and `!isCurrentlyPrebuilding`
        assert(hasAlreadyPrebuild);
        return;
      }
    }

    ongoingPrebuild?.cancel();

    const prebuildCancelToken = new CancelToken();
    const prebuildProcess = new PrebuildProcess(
      this.runPrebuild(buildConfig, buildOptions, prebuildCancelToken),
      prebuildCancelToken
    );
    prebuildProcess.attach(cancelToken);
    this.prebuildProcessByPlatform.set(buildConfig.platform, prebuildProcess);

    prebuildProcess.finished
      .then(async () => {
        const fingerprint = await this.fingerprintProvider.calculateFingerprint(buildConfig);
        extensionContext.workspaceState.update(persistKey, fingerprint);
      })
      .finally(() => {
        if (this.prebuildProcessByPlatform.get(buildConfig.platform) === prebuildProcess) {
          this.prebuildProcessByPlatform.delete(buildConfig.platform);
        }
      });
    return await prebuildProcess.finished;
  }

  private async runPrebuild(
    buildConfig:
      | IOSLocalBuildConfig
      | AndroidLocalBuildConfig
      | AndroidDevClientBuildConfig
      | IOSDevClientBuildConfig,
    buildOptions: BuildOptions,
    cancelToken: CancelToken
  ) {
    const { buildOutputChannel, forceCleanBuild } = buildOptions;
    const appRoot = buildConfig.appRoot;
    const cliPath = getExpoCliPath(appRoot);
    if (!cliPath) {
      throw new BuildError(
        "Prebuild could not run because Expo CLI not installed in the project. Verify you have `@expo/cli` in your dependencies.",
        buildConfig.type
      );
    }
    const platform = buildConfig.platform === DevicePlatform.Android ? "android" : "ios";
    const args = [cliPath, "prebuild", "-p", platform];
    // NOTE: We handle installing node dependencies and pods ourselves, so we skip it in the prebuild.
    args.push("--no-install");
    if (forceCleanBuild) {
      args.push("--clean");
    }

    if (cancelToken.cancelled) {
      throw new CancelError("Prebuild was cancelled");
    }

    const process = exec("node", args, { cwd: appRoot });

    lineReader(process).onLineRead((line) => {
      buildOutputChannel.appendLine(line);
    });

    await cancelToken.adapt(process);
  }
}

function getExpoCliPath(appRoot: string) {
  try {
    return require.resolve("@expo/cli", {
      paths: [appRoot],
    });
  } catch {
    return undefined;
  }
}
