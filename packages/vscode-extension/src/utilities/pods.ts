import fs from "fs";
import path from "path";
import { OutputChannel } from "vscode";
import { command, lineReader } from "./subprocess";
import { CancelToken } from "./cancelToken";
import { getIosSourceDir } from "../builders/buildIOS";

interface PodsContext {
  appRoot: string;
  env: Record<string, string>;
}

async function shouldUseBundleCommand(ctx: PodsContext) {
  const { appRoot } = ctx;
  const gemfile = path.join(appRoot, "Gemfile");
  try {
    await fs.promises.access(gemfile);
    return true;
  } catch (e) {
    return false;
  }
}

async function getPodsCommand(ctx: PodsContext): Promise<string> {
  if (await shouldUseBundleCommand(ctx)) {
    return "bundle exec pod";
  }
  return "pod";
}

async function maybeInstallBundlePackages(ctx: PodsContext): Promise<void> {
  const iosDirPath = getIosSourceDir(ctx.appRoot);
  if (await shouldUseBundleCommand(ctx)) {
    await command("bundle install", {
      cwd: iosDirPath,
      env: { ...ctx.env, LANG: "en_US.UTF-8" },
    });
  }
}

export async function isPodsCommandInstalled(ctx: PodsContext): Promise<boolean> {
  if (await shouldUseBundleCommand(ctx)) {
    await maybeInstallBundlePackages(ctx);
  }
  const podsCommand = await getPodsCommand(ctx);
  const installed = await testCommand(`${podsCommand} --version`, ctx);
  return installed;
}

export async function installPods(
  ctx: PodsContext,
  outputChannel: OutputChannel,
  cancelToken: CancelToken
) {
  const { appRoot, env } = ctx;

  const iosDirPath = getIosSourceDir(appRoot);

  if (!iosDirPath) {
    throw new Error("ios directory was not found inside the workspace.");
  }

  const podsCommand = await getPodsCommand(ctx);

  await maybeInstallBundlePackages(ctx);
  const process = command(`${podsCommand} install`, {
    cwd: iosDirPath,
    env: { ...env, LANG: "en_US.UTF-8" },
  });
  lineReader(process).onLineRead((line) => outputChannel.appendLine(line));
  await cancelToken.adapt(process);
}

export async function arePodsInstalled({ appRoot }: PodsContext): Promise<boolean> {
  const iosDirPath = getIosSourceDir(appRoot);

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

async function testCommand(cmd: string, ctx: PodsContext) {
  const { env, appRoot } = ctx;
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
