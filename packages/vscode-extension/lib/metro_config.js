const { adaptMetroConfig, requireFromAppDir, metroServerReadyHandler } = require("./metro_helpers");

// Below is the main code of the config overrider.
const { loadConfig } = requireFromAppDir("metro-config");

module.exports = async function () {
  const config = await loadConfig({}, {});
  return adaptMetroConfig(config);
};
