const {
  adaptMetroConfig,
  requireFromAppDir,
  overrideModuleFromAppDir,
  metroServerReadyHandler,
} = require("./metro_helpers");

// since expo cli doesn't accept metro-config as parameter, we use runServer override workaround
// to update the config. This is a very similar to a workaround for accessign ephemeral port number
// that we use for the packager.script in metro_config.js and we'd need to have it here anyways
// in order to access the port, but in addition we also use it to update the config.
const Metro_fork = requireFromAppDir("@expo/cli/build/src/start/server/metro/runServer-fork");
const oldRunServer = Metro_fork.runServer;
Metro_fork.runServer = function (bundler, config, options) {
  adaptMetroConfig(config);
  return oldRunServer(bundler, config, {
    ...options,
    onReady: metroServerReadyHandler(options.onReady),
  });
};

// In addition, expo uses freeport-async to check whether provided port is busy.
// Apparently, this module returns 11000 port when 0 is provided, so we need to
// override this behavior here.
overrideModuleFromAppDir("freeport-async", async (port) => port);

const { expoStart } = requireFromAppDir("@expo/cli/build/src/start/index");
expoStart(process.argv.slice(2)); // pass argv but strip node and script name
