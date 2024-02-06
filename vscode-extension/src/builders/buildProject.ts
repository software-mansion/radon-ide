import { exec } from "../utilities/subprocess";
import { Logger } from "../Logger";
import { IOSProjectInfo } from "../utilities/ios";

export type BuildFlags = {
  mode: string;
  verbose: boolean;
  xcconfig?: string;
  buildFolder?: string;
  buildCwd: string;
  port?: number;
  interactive?: boolean;
  destination?: string;
  extraParams?: string[];
  cleanBuild: boolean;
};

export function buildProject(
  xcodeProject: IOSProjectInfo,
  udid: string | undefined,
  scheme: string,
  args: BuildFlags
) {
  const xcodebuildArgs = [
    xcodeProject.isWorkspace ? "-workspace" : "-project",
    xcodeProject.name,
    ...(args.xcconfig ? ["-xcconfig", args.xcconfig] : []),
    ...(args.buildFolder ? ["-derivedDataPath", args.buildFolder] : []),
    "-configuration",
    args.mode,
    "-scheme",
    scheme,
    "-destination",
    (udid
      ? `id=${udid}`
      : args.mode === "Debug"
      ? "generic/platform=iOS Simulator"
      : "generic/platform=iOS") + (args.destination ? "," + args.destination : ""),
    ...(args.cleanBuild ? ["clean"] : []),
    "build",
  ];

  if (args.extraParams) {
    xcodebuildArgs.push(...args.extraParams);
  }

  Logger.debug(`Building using "xcodebuild ${xcodebuildArgs.join(" ")}`);

  return exec("xcodebuild", xcodebuildArgs, {
    env: {
      ...process.env,
      RCT_NO_LAUNCH_PACKAGER: "true",
    },
    cwd: args.buildCwd,
  });
}
