import path from "path";
import fs from "fs";
import os from "os";
import { mkdtemp } from "fs/promises";
import { OutputChannel } from "vscode";
import { Logger } from "../Logger";
import { command, lineReader } from "../utilities/subprocess";
import { CancelToken } from "../utilities/cancelToken";
import { extractTarApp, isApkFile, isAppFile } from "./utils";
import { DevicePlatform } from "../common/State";

type Env = Record<string, string> | undefined;

export function extractFilePath(line: string): string | null {
  // Define file extensions we're looking for
  const fileExtensions = "(?:tar\\.gz|app|apk)";

  // Single regex that handles all cases:
  // 1. Quoted paths: "path.ext" or 'path.ext' (any format inside quotes)
  // 2. Windows paths: C:\path\file.ext
  // 3. Unix absolute paths: /path/file.ext
  // 4. Relative paths: ./path/file.ext
  const pathRegex = new RegExp(
    `["']([^"']*\\.${fileExtensions})["']|` + // Quoted: "any/path.ext"
      `([a-zA-Z]:\\\\[^"']*\\.${fileExtensions})|` + // Windows: C:\path\file.ext
      `(\\/[^"']*\\.${fileExtensions})|` + // Unix absolute: /path/file.ext
      `(\\.\\/[^"']*\\.${fileExtensions})`, // Relative: ./path/file.ext
    "i"
  );

  const match = line.match(pathRegex);
  if (match) {
    // Return the first non-undefined capture group
    return match[1] || match[2] || match[3] || match[4];
  }
  return null;
}

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

  let binaryPath = extractFilePath(output.lastLine);

  if (!binaryPath || !fs.existsSync(binaryPath)) {
    Logger.error(
      `External script: ${buildCommand} failed to output any existing app path, got: ${binaryPath}`
    );
    return undefined;
  }

  const shouldExtractArchive = binaryPath.endsWith(".tar.gz");
  if (shouldExtractArchive) {
    const tmpDirectory = await mkdtemp(path.join(os.tmpdir(), "rn-ide-custom-build-"));
    const extractedFile = await extractTarApp(binaryPath, tmpDirectory, platform, cancelToken);

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
