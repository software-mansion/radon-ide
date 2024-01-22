const { adaptMetroConfig, requireFromAppDir, metroServerReadyHandler } = require("./metro_helpers");

// Part 1
// An ugly workaround for packager script to print actual port number.
// Since we want to start packager on ephemeral port, we need to know the actual port number.
// Apparently, metro only reports port provided to the config, which will be 0.
// This workaround overrides runServer method from metro main module by providing
// a default onReady callback that prints the real port number.
const Metro = requireFromAppDir("metro");

const oldRunServer = Metro.runServer;
Metro.runServer = function (config, options) {
  return oldRunServer(config, {
    ...options,
    onReady: metroServerReadyHandler(options.onReady),
  });
};

// Part 2
// Below is the main code of the config overrider.
const { loadConfig } = require_app("metro-config");

module.exports = async function () {
  const config = await loadConfig({}, {});
  return adaptMetroConfig(config);
};
