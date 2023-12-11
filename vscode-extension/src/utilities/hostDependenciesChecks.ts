const child_process = require("child_process");
import { promisify } from "util";
import loadConfig from "@react-native-community/cli-config";
import path from "path";
import { getWorkspacePath } from "./common";
import fs from "fs";
import { EMULATOR_BINARY } from "../devices/AndroidEmulatorDevice";

const asyncExec = promisify(child_process.exec);

async function checkIfCLIInstalled(command: string) {
  try {
    // We are not checking the stderr here, because some of the CLIs put the warnings there.
    const { stdout } = await asyncExec(command, { encoding: "utf8" });
    return !!stdout.length;
  } catch (_) {
    return false;
  }
}

export async function checkXCodeBuildInstalled() {
  return checkIfCLIInstalled("xcodebuild -version");
}

export async function checkXcrunInstalled() {
  return checkIfCLIInstalled("xcrun --version");
}

export async function checkSimctlInstalled() {
  return checkIfCLIInstalled("xcrun simctl help");
}

export async function checkPodInstalled() {
  return checkIfCLIInstalled("pod --version");
}

export async function checkIosDependenciesInstalled() {
  const ctx = loadConfig(getWorkspacePath());
  const iosDirPath = ctx.project.ios?.sourceDir;

  console.log("Check pods in", iosDirPath, getWorkspacePath(), ctx);
  if (!iosDirPath) {
    return false;
  }

  const podfileLockExists = fs.existsSync(path.join(iosDirPath, "Podfile.lock"));
  const podsDirExists = fs.existsSync(path.join(iosDirPath, "Pods"));

  return podfileLockExists && podsDirExists;
}

export async function checkAdroidEmulatorExists() {
  return fs.existsSync(EMULATOR_BINARY);
}

export async function checkSdkManagerInstalled() {
  return checkIfCLIInstalled("sdkmanager --version");
}
