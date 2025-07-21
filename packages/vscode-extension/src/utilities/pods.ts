import fs from "fs";
import path from "path";
import { OutputChannel, Disposable } from "vscode";
import { command, lineReader } from "./subprocess";
import { CancelToken } from "./cancelToken";
import { getIosSourceDir } from "../builders/buildIOS";

/**
 * Utility class for managing CocoaPods dependencies in an iOS project workspace.
 *
 * The `Pods` class provides methods to check for the presence of the `pod` command,
 * install CocoaPods dependencies, and verify the installation state of pods within
 * a given application root directory. It ensures that only one pod installation
 * process runs at a time and supports cancellation of ongoing installations.
 */
export class Pods implements Disposable {
  private podsInstallationProcess:
    | {
        podsPromise: Promise<void>;
        cancelToken: CancelToken;
      }
    | undefined;
  constructor(
    private readonly appRoot: string,
    private readonly _env: Record<string, string> = {}
  ) {}

  private get env() {
    return { ...this._env, LANG: "en_US.UTF-8" };
  }

  public async isPodsCommandInstalled(): Promise<boolean> {
    if (await this.shouldUseBundleCommand()) {
      await this.maybeInstallBundlePackages();
    }
    const podsCommand = await this.getPodsCommand();
    const installed = await this.testCommand(`${podsCommand} --version`);
    return installed;
  }

  /**
   * Installs CocoaPods dependencies for the iOS project within the workspace.
   *
   * This method ensures that only one pod installation process runs at a time by cancelling any ongoing installation.
   *
   * @param outputChannel - The channel to which installation output will be appended.
   * @param cancelToken - A token that can be used to cancel the pod installation process.
   */
  public async installPods(outputChannel: OutputChannel, cancelToken: CancelToken): Promise<void> {
    if (this.podsInstallationProcess) {
      this.podsInstallationProcess.cancelToken.cancel();
    }

    // we create a new cancel token to avoid cancelling the calling process when the pod installation is cancelled
    const cancelPodInstallToken = new CancelToken();
    cancelToken.onCancel(() => cancelPodInstallToken.cancel());
    const { promise, resolve } = Promise.withResolvers<void>();
    this.podsInstallationProcess = {
      podsPromise: promise,
      cancelToken: cancelPodInstallToken,
    };

    try {
      const { appRoot, env } = this;

      const iosDirPath = getIosSourceDir(appRoot);

      if (!iosDirPath) {
        throw new Error("ios directory was not found inside the workspace.");
      }

      const podsCommand = await this.getPodsCommand();

      await this.maybeInstallBundlePackages();
      const process = command(`${podsCommand} install`, {
        cwd: iosDirPath,
        env: { ...env, LANG: "en_US.UTF-8" },
      });
      lineReader(process).onLineRead((line) => outputChannel.appendLine(line));
      await cancelToken.adapt(process);
    } finally {
      this.podsInstallationProcess = undefined;
      resolve();
    }
  }

  public async arePodsInstalled(): Promise<boolean> {
    if (this.podsInstallationProcess) {
      await this.podsInstallationProcess.podsPromise;
    }
    const iosDirPath = getIosSourceDir(this.appRoot);

    const podfileLockExists = fs.existsSync(path.join(iosDirPath, "Podfile.lock"));
    const podsDirExists = fs.existsSync(path.join(iosDirPath, "Pods"));

    const podsInstallationIsPresent = podfileLockExists && podsDirExists;

    if (!podsInstallationIsPresent) {
      return false;
    }

    // finally, we perform check between Podfile.lock and Pods/Manifest.lock
    // this is what xcode does in Check Pods build phase and is used to determine
    // if pods are up to date

    // run diff command:
    const { failed } = await command("diff Podfile.lock Pods/Manifest.lock", {
      cwd: iosDirPath,
      reject: false,
      quietErrorsOnExit: true,
    });
    return !failed;
  }

  private async shouldUseBundleCommand() {
    const gemfile = path.join(this.appRoot, "Gemfile");
    try {
      await fs.promises.access(gemfile);
      return true;
    } catch (e) {
      return false;
    }
  }

  private async getPodsCommand(): Promise<string> {
    if (await this.shouldUseBundleCommand()) {
      return "bundle exec pod";
    }
    return "pod";
  }

  private async maybeInstallBundlePackages(): Promise<void> {
    const iosDirPath = getIosSourceDir(this.appRoot);
    if (await this.shouldUseBundleCommand()) {
      await command("bundle install", {
        cwd: iosDirPath,
        env: { ...this.env, LANG: "en_US.UTF-8" },
      });
    }
  }

  private async testCommand(cmd: string) {
    const { env, appRoot } = this;
    const iosDirPath = getIosSourceDir(appRoot);
    try {
      // We are not checking the stderr here, because some of the CLIs put the warnings there.
      const { failed } = await command(cmd, {
        encoding: "utf8",
        quietErrorsOnExit: true,
        env: { ...env, LANG: "en_US.UTF-8" },
        cwd: iosDirPath,
      });
      return !failed;
    } catch (_) {
      return false;
    }
  }

  public dispose(): void {
    this.podsInstallationProcess?.cancelToken.cancel();
    this.podsInstallationProcess = undefined;
  }
}
