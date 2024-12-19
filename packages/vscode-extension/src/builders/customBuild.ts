import path from "path";
import fs from "fs";
import os from "os";
import { mkdtemp} from "fs/promises";
import { Logger } from "../Logger";
import { command, lineReader } from "../utilities/subprocess";
import { CancelToken } from "./cancelToken";
import { getAppRootFolder } from "../utilities/extensionContext";
import { extractTarApp } from "./utils";

type Env = Record<string, string> | undefined;

const EXPO_LOCAL_BUILD_PATH_REGEX = new RegExp('You can find the build artifacts in (.*)');

export async function runExternalBuild(cancelToken: CancelToken, buildCommand: string, env: Env) {
  const output = await runExternalScript(buildCommand, env, cancelToken);

  if (!output) {
    return undefined;
  }

  let binaryPath = output.lastLine;

  // We test if the output of the command matches eas build output.
  // If it does we extract the bath to binary. 
  if (EXPO_LOCAL_BUILD_PATH_REGEX.test(output.lastLine)) {
    const groups = EXPO_LOCAL_BUILD_PATH_REGEX.exec(output.lastLine);
    if (groups?.[1]) {
      binaryPath = groups[1];
    }
  }

  if (binaryPath && !fs.existsSync(binaryPath)) {
    Logger.error(
      `External script: ${buildCommand} failed to output any existing app path, got: ${binaryPath}`
    );
    return undefined;
  }

  const shouldExtractArchive = binaryPath.endsWith('.tar.gz');
  if (!shouldExtractArchive) {
    return binaryPath;
  }

  const tmpDirectory = await mkdtemp(path.join(os.tmpdir(), "rn-ide-custom-build-"));

  return await extractTarApp(binaryPath, tmpDirectory, cancelToken);
}

export async function runfingerprintCommand(externalCommand: string, env: Env) {
  const output = await runExternalScript(externalCommand, env);
  if (!output) {
    return undefined;
  }
  return output.lastLine;
}

async function runExternalScript(externalCommand: string, env: Env, cancelToken?: CancelToken) {
  let process = command(externalCommand, { cwd: getAppRootFolder(), env });
  process = cancelToken ? cancelToken.adapt(process) : process;
  Logger.info(`Running external script: ${externalCommand}`);

  let lastLine: string | undefined;
  const scriptName = getScriptName(externalCommand);
  lineReader(process).onLineRead((line) => {
    Logger.info(`External script: ${scriptName} (${process.pid})`, line);
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
