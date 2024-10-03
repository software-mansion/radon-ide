import path from "path";
import fs from "fs";
import { Logger } from "../Logger";
import { command, lineReader } from "../utilities/subprocess";
import { CancelToken } from "./cancelToken";
import { getAppRootFolder } from "../utilities/extensionContext";

type Env = Record<string, string> | undefined;

export async function runExternalBuild(cancelToken: CancelToken, buildCommand: string, env: Env) {
  const output = await runExternalScript(buildCommand, env, cancelToken);

  if (!output) {
    return undefined;
  }

  const binaryPath = output.lastLine;
  if (binaryPath && !fs.existsSync(binaryPath)) {
    Logger.error(
      `External script: ${buildCommand} failed to output any existing app path, got: ${binaryPath}`
    );
    return undefined;
  }

  return binaryPath;
}

export async function runFingerprintScript(externalCommand: string, env: Env) {
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
