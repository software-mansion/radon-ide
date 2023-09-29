import loadConfig from "@react-native-community/cli-config";

const execa = require("execa");
const path = require("path");
const os = require("os");

const ANDROID_HOME = process.env.ANDROID_HOME || path.join(os.homedir(), "Library/Android/sdk");
const AAPT_PATH = path.join(ANDROID_HOME, "build-tools", "33.0.0", "aapt");

async function build(projectDir: string, gradleArgs: string[]) {
  await execa("./gradlew", gradleArgs, {
    cwd: projectDir,
  });
}

async function extractPackageName(artifactPath: string) {
  const { stdout } = await execa(AAPT_PATH, ["dump", "badging", artifactPath]);
  const packageLine = stdout.split("\n").find((line: string) => line.startsWith("package: name="));
  const packageName = packageLine!.split("'")[1];
  return packageName;
}

export async function buildAndroid(workspaceDir: string, metroPort: number) {
  const ctx = loadConfig(workspaceDir);
  const androidSourceDir = ctx.project.android!.sourceDir;
  const gradleArgs = [
    "-x",
    "lint",
    "-PreactNativeArchitectures=arm64-v8a", // TODO: check emulator architecture
    `-PreactNativeDevServerPort=${metroPort}`,
  ];
  await build(androidSourceDir, gradleArgs);
  const apkPath = path.join(androidSourceDir, "app/build/outputs/apk/debug/app-debug.apk");
  const packageName = await extractPackageName(apkPath);
  return { apkPath, packageName };
}
