const {
  adaptMetroConfig,
  requireFromAppDir,
  resolveFromAppDir,
  overrideModuleFromAppDir,
} = require("../metro_helpers");

// since expo cli doesn't accept metro-config as parameter, we override metro's loadConfig method
const metroConfig = requireFromAppDir("metro-config");
const origLoadConfig = metroConfig.loadConfig;
metroConfig.loadConfig = async function (...args) {
  const config = await origLoadConfig(...args);
  return adaptMetroConfig(config);
};

// Furthermore, expo CLI also does override the reporter setting despite it being
// set in the config. In order to force CLI to use JSON reporter, we override
// base terminal reporter class from metro that Expo CLI extends
overrideModuleFromAppDir("metro/src/lib/TerminalReporter", require("../metro_reporter"));

const expoInstallPath = resolveFromAppDir("expo");

// since expo 54 this is the new path that the Terminal reporter is imported from, by expo
overrideModuleFromAppDir("@expo/metro/metro/lib/TerminalReporter", require("../metro_reporter"), {
  paths: [expoInstallPath],
});

const { expoStart } = requireFromAppDir("@expo/cli/build/src/start/index", {
  paths: [expoInstallPath],
});
expoStart(process.argv.slice(2)); // pass argv but strip node and script name
