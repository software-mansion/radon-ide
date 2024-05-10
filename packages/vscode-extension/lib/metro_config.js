const { adaptMetroConfig, requireFromAppDir, metroServerReadyHandler } = require("./metro_helpers");

// Below is the main code of the config overrider.
const { loadConfig } = requireFromAppDir("metro-config");

module.exports = async function () {
  const customMetroConfigPath = process.env.RN_IDE_METRO_CONFIG_PATH;
  let options = {};
  if (customMetroConfigPath) {
    options = { config: customMetroConfigPath };
  }
  const config = await loadConfig(options, {});
  return adaptMetroConfig(config);
};
