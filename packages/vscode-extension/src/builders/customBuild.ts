import path from "path";
import fs from "fs";
import os from "os";
import fetch from "node-fetch";
import { mkdtemp } from "fs/promises";
import { finished } from "stream/promises";

import { Logger } from "../Logger";
import { command, lineReader } from "../utilities/subprocess";
import { CancelToken } from "./cancelToken";
import { DevicePlatform } from "../common/DeviceManager";
import { getAppRootFolder } from "../utilities/extensionContext";

type Timestamp = string; // e.g. "2024-09-04T09:44:07.001Z"
type UUID = string;
type Version = string; // e.g. "50.0.0"

type EASBuild = {
  id: string;
  status: string; // "FINISHED" for build ones
  platform: "ANDROID" | "IOS";
  artifacts: {
    buildUrl: string;
    applicationArchiveUrl: string;
  };
  initiatingActor: {
    id: UUID;
    displayName: string;
  };
  project: {
    id: UUID;
    name: string;
    slug: string;
    ownerAccount: {
      id: UUID;
      name: string;
    };
  };
  distribution: string; // e.g. "INTERNAL";
  buildProfile: string; // e.g. "development"
  sdkVersion: Version;
  appVersion: Version;
  appBuildVersion: string;
  gitCommitHash: string;
  gitCommitMessage: string;
  priority: string; // e.g. "NORMAL_PLUS"
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp;
  expirationDate: Timestamp;
  isForIosSimulator: false;
};

export async function runExternalBuild(
  cancelToken: CancelToken,
  platform: DevicePlatform,
  externalCommand: string
): Promise<string> {
  const { stdout, lastLine: binaryPath } = await runExternalScript(cancelToken, externalCommand);

  const easBinaryPath = await downloadAppFromEas(stdout, platform);
  const isEasBuild = easBinaryPath !== undefined;
  if (isEasBuild) {
    return easBinaryPath;
  }

  if (binaryPath && !fs.existsSync(binaryPath)) {
    throw Error(
      `External script: ${externalCommand} failed to output any existing app path, got: ${binaryPath}`
    );
  }

  return binaryPath;
}

async function runExternalScript(cancelToken: CancelToken, externalCommand: string) {
  const process = cancelToken.adapt(command(externalCommand, { cwd: getAppRootFolder() }));
  Logger.info(`Running external script: ${externalCommand}`);

  let lastLine: string | undefined;
  const scriptName = getScriptName(externalCommand);
  lineReader(process, true).onLineRead((line) => {
    Logger.info(`External script: ${scriptName} (${process.pid})`, line);
    lastLine = line.trim();
  });

  let stdout: string;
  try {
    const output = await process;
    stdout = output.stdout;
  } catch (error) {
    throw Error(`External script: ${externalCommand} failed, error: ${error}`);
  }

  if (!lastLine) {
    throw Error(`External script: ${externalCommand} didn't print any output`);
  }

  return { stdout, lastLine };
}

function getScriptName(fullCommand: string) {
  const escapedSpacesAwareRegex = /(\\.|[^ ])+/g;
  const externalCommandName = fullCommand.match(escapedSpacesAwareRegex)?.[0];
  return externalCommandName ? path.basename(externalCommandName) : fullCommand;
}

async function downloadAppFromEas(processOutput: string, platform: DevicePlatform) {
  const artifacts = parseEasBuildOutput(processOutput);
  if (!artifacts) {
    return undefined;
  }

  const easPlatformEnum = platform === DevicePlatform.Android ? "ANDROID" : "IOS";
  const { binaryUrl } = artifacts.find((buildInfo) => buildInfo.platform === easPlatformEnum) ?? {};
  if (!binaryUrl) {
    Logger.warn(`Failed to find binary URL from EAS for platform ${platform}, ignoring`);
    return undefined;
  }

  const tmpDirectory = await mkdtemp(path.join(os.tmpdir(), "rn-ide-external-build-"));
  const appBinaryPath = await downloadBinary(binaryUrl, tmpDirectory);
  if (!appBinaryPath) {
    Logger.warn(`Failed to download binary from ${binaryUrl}, ignoring`);
  }

  return appBinaryPath;
}

function parseEasBuildOutput(stdout: string) {
  let buildInfo: EASBuild[];
  try {
    buildInfo = JSON.parse(stdout);
    assertEasBuildOutput(buildInfo);
  } catch (_e) {
    // Not an EAS build output, ignore
    return undefined;
  }
  return buildInfo.map(({ platform, artifacts }) => {
    return { platform, binaryUrl: artifacts.applicationArchiveUrl };
  });
}

function assertEasBuildOutput(buildInfo: any): asserts buildInfo is EASBuild[] {
  if (!Array.isArray(buildInfo)) {
    throw new Error("Not an EAS build output");
  }

  for (const { platform, artifacts } of buildInfo) {
    if (!platform || !artifacts) {
      throw new Error("Not an EAS build output");
    }
  }
}

async function downloadBinary(url: string, directory: string) {
  // URL should be in format "https://expo.dev/artifacts/eas/ID.apk", where ID
  // is unique identifier.
  const filename = url.split("/").pop();
  const hasInvalidFormat = !filename;
  if (hasInvalidFormat) {
    return undefined;
  }

  let body: NodeJS.ReadableStream;
  let ok: boolean;
  try {
    const result = await fetch(url);
    body = result.body;
    ok = result.ok;
  } catch (_e) {
    // Network error
    return undefined;
  }

  if (ok) {
    const destination = path.resolve(directory, filename);
    const fileStream = fs.createWriteStream(destination, { flags: "wx" });
    await finished(body.pipe(fileStream));

    return destination.toString();
  } else {
    return undefined;
  }
}
