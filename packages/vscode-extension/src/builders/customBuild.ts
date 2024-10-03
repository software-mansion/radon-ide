import path from "path";
import fs from "fs";
import { Logger } from "../Logger";
import { command, lineReader } from "../utilities/subprocess";
import { CancelToken } from "./cancelToken";
import { getAppRootFolder } from "../utilities/extensionContext";

export async function runExternalBuild(
  cancelToken: CancelToken,
  externalCommand: string,
  env: Record<string, string> | undefined
): Promise<string | undefined> {
  const output = await runExternalScript(cancelToken, externalCommand, env);

  if (!output) {
    return undefined;
  }

  const binaryPath = output.lastLine;
  if (binaryPath && !fs.existsSync(binaryPath)) {
    Logger.error(
      `External script: ${externalCommand} failed to output any existing app path, got: ${binaryPath}`
    );
    return undefined;
  }

  return binaryPath;
}

export async function runFingerprintScript(
  cancelToken: CancelToken,
  externalCommand: string,
  env: Record<string, string> | undefined
) {
  return runExternalScript(cancelToken, externalCommand, env);
}

async function runExternalScript(
  cancelToken: CancelToken,
  externalCommand: string,
  env: Record<string, string> | undefined
) {
  const process = cancelToken.adapt(command(externalCommand, { cwd: getAppRootFolder(), env }));
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
