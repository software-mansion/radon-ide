import path from "path";
import fs from "fs";
import os from "os";
import { mkdtemp } from "fs/promises";
import { OutputChannel } from "vscode";
import { Logger } from "../Logger";
import { command, lineReader } from "../utilities/subprocess";
import { CancelToken } from "../utilities/cancelToken";
import { extractTarApp, isApkFile, isAppFile } from "./utils";
import { DevicePlatform } from "../common/DeviceManager";

type Env = Record<string, string> | undefined;

// Extracts all paths from the last line, both Unix and Windows format
const BUILD_PATH_REGEX = /(\/.*?\.\S*)|([a-zA-Z]:\\.*?\.\S*)/g;

export async function runExternalBuild(
  cancelToken: CancelToken,
  buildCommand: string,
  env: Env,
  platform: DevicePlatform,
  cwd: string,
  outputChannel: OutputChannel
) {
  const output = await runExternalScript(buildCommand, env, cwd, outputChannel, cancelToken);

  if (!output) {
    return undefined;
  }

  let binaryPath = output.lastLine;

  // We run regex to extract paths from the first line and we take the first one
  const groups = output.lastLine.match(BUILD_PATH_REGEX);
  if (groups?.[0]) {
    binaryPath = groups[0];
  }

  if (binaryPath && !fs.existsSync(binaryPath)) {
    Logger.error(
      `External script: ${buildCommand} failed to output any existing app path, got: ${binaryPath}`
    );
    return undefined;
  }

  const shouldExtractArchive = binaryPath.endsWith(".tar.gz");
  if (shouldExtractArchive) {
    const tmpDirectory = await mkdtemp(path.join(os.tmpdir(), "rn-ide-custom-build-"));
    const extractedFile = await extractTarApp(binaryPath, tmpDirectory, platform);

    Logger.info(`External script: ${buildCommand} output app path: ${binaryPath}`);
    return extractedFile;
  }

  if (platform === DevicePlatform.Android && !isApkFile(binaryPath)) {
    Logger.error(`External script: ${buildCommand} failed to output .apk file, got: ${binaryPath}`);
    return undefined;
  }

  if (platform === DevicePlatform.IOS && !isAppFile(binaryPath)) {
    Logger.error(`External script: ${buildCommand} failed to output .app file, got: ${binaryPath}`);
    return undefined;
  }

  Logger.info(`External script: ${buildCommand} output app path: ${binaryPath}`);
  return binaryPath;
}

export async function runfingerprintCommand(externalCommand: string, env: Env, cwd: string) {
  const output = await runExternalScript(externalCommand, env, cwd);
  if (!output) {
    return undefined;
  }
  return output.lastLine;
}

async function runExternalScript(
  externalCommand: string,
  env: Env,
  cwd: string,
  outputChannel?: OutputChannel,
  cancelToken?: CancelToken
) {
  let process = command(externalCommand, { cwd, env, shell: true });
  process = cancelToken ? cancelToken.adapt(process) : process;
  Logger.info(`Running external script: ${externalCommand}`);

  let lastLine: string | undefined;
  const scriptName = getScriptName(externalCommand);
  lineReader(process).onLineRead((line) => {
    if (outputChannel) {
      outputChannel.appendLine(line);
    } else {
      Logger.info(`External script: ${scriptName} (${process.pid})`, line);
    }
    lastLine = line.trim();
  });

  const { failed } = await process;
  if (failed) {
    return undefined;
  }

  if (!lastLine) {
    Logger.error(`External script: ${externalCommand} didn't print any output`);
    return undefined;
  }

  return { lastLine };
}

function getScriptName(fullCommand: string) {
  const escapedSpacesAwareRegex = /(\\.|[^ ])+/g;
  const externalCommandName = fullCommand.match(escapedSpacesAwareRegex)?.[0];
  return externalCommandName ? path.basename(externalCommandName) : fullCommand;
}
