import path from "path";
import fs from "fs";
import { Disposable, OutputChannel } from "vscode";
import { exec } from "../utilities/subprocess";
import { BuildError } from "../builders/BuildManager";
import { IOSLocalBuildConfig, AndroidLocalBuildConfig } from "../common/BuildConfig";
import { DevicePlatform } from "../common/State";
import { FingerprintProvider } from "../project/FingerprintProvider";
import { lineReader } from "../utilities/subprocess";
import { CancelError, CancelToken } from "../utilities/cancelToken";

interface PrebuildProcess {
  fingerprint: string;
  process: Promise<void>;
  cancelToken: CancelToken;
}

export class Prebuild implements Disposable {
  private prebuildProcessByPlatform = new Map<DevicePlatform, PrebuildProcess>();

  constructor(private fingerprintProvider: FingerprintProvider) {}

  dispose() {
    this.prebuildProcessByPlatform.forEach((prebuildProcess) => {
      prebuildProcess.cancelToken.cancel();
    });
  }

  private async nativeDirectoryExists(buildConfig: IOSLocalBuildConfig | AndroidLocalBuildConfig) {
    const directoryName = buildConfig.platform === DevicePlatform.Android ? "android" : "ios";
    const nativeDirectoryPath = path.join(buildConfig.appRoot, directoryName);
    try {
      const { isDirectory } = await fs.promises.stat(nativeDirectoryPath);
      return !isDirectory;
    } catch {
      return true;
    }
  }

  public async runPrebuildIfNeeded(
    buildConfig: IOSLocalBuildConfig | AndroidLocalBuildConfig,
    outputChannel: OutputChannel,
    cancelToken: CancelToken
  ) {
    const ongoingPrebuild = this.prebuildProcessByPlatform.get(buildConfig.platform);
    const currentFingerprint = await this.fingerprintProvider.calculateFingerprint(buildConfig);

    const canSkipPrebuild =
      !buildConfig.forceCleanBuild &&
      ongoingPrebuild &&
      ongoingPrebuild.fingerprint !== currentFingerprint &&
      !(await this.nativeDirectoryExists(buildConfig));
    if (canSkipPrebuild) {
      return await ongoingPrebuild.process;
    }

    ongoingPrebuild?.cancelToken.cancel();

    // NOTE: we create a new cancel token so that cancelling the prebuild does not cancel the calling process.
    const prebuildCancelToken = new CancelToken();
    cancelToken.onCancel(() => {
      prebuildCancelToken.cancel();
    });

    const prebuildProcess = this.runPrebuild(buildConfig, outputChannel, prebuildCancelToken);
    this.prebuildProcessByPlatform.set(buildConfig.platform, {
      fingerprint: currentFingerprint,
      process: prebuildProcess,
      cancelToken: prebuildCancelToken,
    });

    // NOTE: on error, we need remove the process from the map so that later requests can start a new one.
    prebuildProcess.catch(() => {
      if (this.prebuildProcessByPlatform.get(buildConfig.platform)?.process === prebuildProcess) {
        this.prebuildProcessByPlatform.delete(buildConfig.platform);
      }
    });
    return await prebuildProcess;
  }

  private async runPrebuild(
    buildConfig: IOSLocalBuildConfig | AndroidLocalBuildConfig,
    outputChannel: OutputChannel,
    cancelToken: CancelToken
  ) {
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
    if (buildConfig.forceCleanBuild) {
      args.push("--clean");
    }

    if (cancelToken.cancelled) {
      throw new CancelError("Prebuild was cancelled");
    }

    const process = exec("node", args, { cwd: appRoot });

    lineReader(process).onLineRead((line) => {
      outputChannel.appendLine(line);
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
