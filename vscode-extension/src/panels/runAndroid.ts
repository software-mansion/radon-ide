const execa = require("execa");
const path = require("path");
const os = require("os");

const ANDROID_HOME = process.env.ANDROID_HOME || path.join(os.homedir(), "Library/Android/sdk");
const ADB_PATH = path.join(ANDROID_HOME, "platform-tools", "adb");
const AAPT_PATH = path.join(ANDROID_HOME, "build-tools", "33.0.0", "aapt");

async function build(projectDir: string, gradleArgs: string[]) {
  await execa("./gradlew", gradleArgs, {
    cwd: projectDir,
  });
}

async function getConnectedEmulators() {
  const { stdout } = await execa(ADB_PATH, ["devices", "-l"]);
  const lines = stdout
    .split("\n")
    .filter((line) => line && !line.startsWith("List") && line.startsWith("emulator"));
  const devices = lines.map((line) => line.split(/\s+/)[0]); // Extracts device identifiers
  return devices;
}

async function extractPackageName(artifactPath: string) {
  const { stdout } = await execa(AAPT_PATH, ["dump", "badging", artifactPath]);
  const packageLine = stdout.split("\n").find((line: string) => line.startsWith("package: name="));
  const packageName = packageLine!.split("'")[1];
  return packageName;
}

export async function getSelectedDeviceId() {
  const emulators = await getConnectedEmulators();
  return emulators[0]!;
}

export async function runAndroid(projectDir: string, deviceId: string, metroPort: number) {
  console.log("Using emulator", deviceId);
  const gradleArgs = [
    "-x",
    "lint",
    "-PreactNativeArchitectures=arm64-v8a", // TODO: check emulator architecture
    `-PreactNativeDevServerPort=${metroPort}`,
  ];
  await build(projectDir, gradleArgs);
  // adb reverse
  await execa(ADB_PATH, ["-s", deviceId, "reverse", `tcp:${metroPort}`, `tcp:${metroPort}`]);
  const artifactPath = path.join(projectDir, "app/build/outputs/apk/debug/app-debug.apk");
  // install apk
  console.log("Installing apk", artifactPath);
  await execa(ADB_PATH, ["-s", deviceId, "install", "-r", artifactPath]);
  // extract package name
  const packageName = await extractPackageName(artifactPath);
  console.log("Running app ", packageName);
  // launch app
  await execa(ADB_PATH, [
    "-s",
    deviceId,
    "shell",
    "monkey",
    "-p",
    packageName,
    "-c",
    "android.intent.category.LAUNCHER",
    "1",
  ]);
}
