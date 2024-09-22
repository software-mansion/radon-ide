import path from "path";
import fs from "fs";
import os from "os";
import fetch from "node-fetch";
import { mkdtemp, readdir } from "fs/promises";
import { finished } from "stream/promises";

import { Logger } from "../Logger";
import { command, exec, lineReader } from "../utilities/subprocess";
import { CancelToken } from "./cancelToken";
import { DevicePlatform } from "../common/DeviceManager";
import { getAppRootFolder } from "../utilities/extensionContext";

type UnixTimestamp = number;

type EasBuildUrl = {
  platform: DevicePlatform;
  binaryUrl: string;
  completedAt: UnixTimestamp;
};

type IsoTimestamp = string; // e.g. "2024-09-04T09:44:07.001Z"
type UUID = string;
type Version = string; // e.g. "50.0.0"

type EASBuild = {
  id: string;
  status: "FINISHED" | "CANCELLED" | string;
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
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  completedAt: IsoTimestamp;
  expirationDate: IsoTimestamp;
  isForIosSimulator: false;
};

export async function runExternalBuild(
  cancelToken: CancelToken,
  platform: DevicePlatform,
  externalCommand: string
): Promise<string> {
  const { stdout, lastLine: binaryPath } = await runExternalScript(cancelToken, externalCommand);

  let easBinaryPath = await downloadAppFromEas(stdout, platform);

  if (easBinaryPath?.endsWith(".ipa")) {
    easBinaryPath = await extractIpa(easBinaryPath, cancelToken);
  }

  if (easBinaryPath) {
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
  lineReader(process).onLineRead((line) => {
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
  if (!artifacts || artifacts.length === 0) {
    return undefined;
  }

  const { binaryUrl } = getMostRecentBuild(artifacts, platform) ?? {};
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

function parseEasBuildOutput(stdout: string): EasBuildUrl[] | undefined {
  let buildInfo: EASBuild[];
  try {
    // Supports eas build, eas build:list, eas build:view
    buildInfo = [JSON.parse(stdout)].flat();
    assertEasBuildOutput(buildInfo);
  } catch (_e) {
    // Not an EAS build output, ignore
    return undefined;
  }

  const platformMapping = { ANDROID: DevicePlatform.Android, IOS: DevicePlatform.IOS };
  return buildInfo
    .filter(({ status }) => status === "FINISHED")
    .map(({ platform: easPlatform, artifacts, completedAt }) => {
      return {
        platform: platformMapping[easPlatform],
        binaryUrl: artifacts.applicationArchiveUrl,
        completedAt: Date.parse(completedAt),
      };
    });
}

function assertEasBuildOutput(buildInfo: any): asserts buildInfo is EASBuild[] {
  for (const { platform, artifacts, completedAt, status } of buildInfo) {
    if (status !== "FINISHED") {
      continue;
    }

    const isInvalidPlatform = platform !== "ANDROID" && platform !== "IOS";
    const hasMissingFields = !artifacts || !completedAt;
    if (isInvalidPlatform || hasMissingFields) {
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

function getMostRecentBuild(artifacts: EasBuildUrl[], platform: DevicePlatform) {
  let latestBuild: EasBuildUrl | undefined = undefined;
  for (const build of artifacts) {
    if (platform !== build.platform) {
      continue;
    }
    const isLater = !latestBuild || latestBuild.completedAt < build.completedAt;

    if (isLater) {
      latestBuild = build;
    }
  }
  return latestBuild;
}

async function extractIpa(ipaPath: string, cancelToken: CancelToken) {
  const extractDirName = path.basename(ipaPath, path.extname(ipaPath));
  const extractDir = path.join(path.dirname(ipaPath), extractDirName);
  try {
    await cancelToken.adapt(exec("unzip", ["-d", extractDir, ipaPath]));
  } catch (error) {
    Logger.error(`Failed to extract archive ${ipaPath} to ${extractDir}`, error);
    return undefined;
  }

  const payloadDir = path.join(extractDir, "Payload");

  const appName = (await readdir(payloadDir))[0];
  const appPath = path.join(payloadDir, appName);
  Logger.debug("Extracted .ipa to", appPath);
  return appPath;
}
