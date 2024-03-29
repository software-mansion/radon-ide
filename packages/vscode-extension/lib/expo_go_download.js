const { requireFromAppDir, appRoot } = require("./metro_helpers");
const { getConfig } = requireFromAppDir("@expo/config/build/Config.js");
const { getVersionsAsync } = requireFromAppDir("@expo/cli/build/src/api/getVersions");

async function getExpoGoClient(platform) {
  const { exp } = getConfig(appRoot);
  const versions = await getVersionsAsync();
  if (platform === "Android") {
    return {
      clientVersion: versions.sdkVersions[exp.sdkVersion].androidClientVersion,
      url: versions.sdkVersions[exp.sdkVersion].androidClientUrl,
    };
  } else if (platform === "iOS") {
    return {
      clientVersion: versions.sdkVersions[exp.sdkVersion].iosClientVersion,
      url: versions.sdkVersions[exp.sdkVersion].iosClientUrl,
    };
  }
}

async function main() {
  const platform = process.argv[2]; // 'Android' or 'iOS'

  if (!platform) {
    throw new Error('Please provide both platform ("Android" or "iOS").');
  }
  const result = await getExpoGoClient(platform);
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(`Failed to ensure Expo Go due to: ${error}`);
});
