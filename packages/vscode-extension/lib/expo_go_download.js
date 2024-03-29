const { requireFromAppDir, appRoot } = require("./metro_helpers");
const { getConfig } = requireFromAppDir("@expo/config/build/Config.js");
const { downloadExpoGoAsync } = requireFromAppDir("@expo/cli/build/src/utils/downloadExpoGoAsync");

async function main() {
  let platform = process.argv[2]; // 'Android' or 'iOS'

  if (!platform) {
    throw new Error('Please provide both platform ("Android" or "iOS").');
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
