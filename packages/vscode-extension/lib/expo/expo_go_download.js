const { requireFromAppDir, resolveFromAppDir, appRoot } = require("../metro_helpers");
const expoInstallPath = resolveFromAppDir("expo");
const { getConfig } = requireFromAppDir("@expo/config/build/Config.js", {
  paths: [expoInstallPath],
});
const { downloadExpoGoAsync } = requireFromAppDir("@expo/cli/build/src/utils/downloadExpoGoAsync", {
  paths: [expoInstallPath],
});

async function main() {
  let platform = process.argv[2]; // 'Android' or 'iOS'

  if (platform !== "Android" && platform !== "iOS") {
    throw new Error("Platform not selected.");
  }
  const { exp } = getConfig(appRoot);
  const sdkVersion = exp.sdkVersion;

  // expo accepts either 'ios' or 'android'
  // in RN IDE we use 'Android' or 'iOS', so we need apply toLowerCase
  platform = platform.toLowerCase();
  const filepath = await downloadExpoGoAsync(platform, { sdkVersion });
  console.log(filepath);
}

main();
