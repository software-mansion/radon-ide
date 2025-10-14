const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

if (process.env.CI) {
  console.log("Running in CI — enabling polling file watcher");
  process.env.METRO_NO_WATCHMAN = "1";
  process.env.METRO_USE_POLLING = "true";
  process.env.METRO_POLL_INTERVAL = "1000";
}

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
