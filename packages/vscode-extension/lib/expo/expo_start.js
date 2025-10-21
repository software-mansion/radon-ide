const {
  adaptMetroConfig,
  requireFromAppDependency,
  overrideModuleFromAppDependency,
} = require("../metro_helpers");

function createMetroConfigProxy(metroConfig) {
  return new Proxy(metroConfig, {
    get(_target, prop, _receiver) {
      const original = Reflect.get(...arguments);
      if (prop === "loadConfig") {
        return async function pain(...args) {
          const config = await original(...args);
          return adaptMetroConfig(config);
        };
      }
      return original;
    },
  });
}

// since expo cli doesn't accept metro-config as parameter, we override metro's loadConfig method
// in projects using expo 53 and older, the metro config dependency can be found as a dependency of react-native
const metroConfigReactNative = requireFromAppDependency("react-native", "metro-config");
const metroConfigProxy = createMetroConfigProxy(metroConfigReactNative);
overrideModuleFromAppDependency("react-native", "metro-config", metroConfigProxy);

// in projects using expo 54 and newer, the metro config dependency can be found as a dependency of expo
try {
  // this is a location that expo CLI uses to import loadConfig method
  // unfortunately we can not use something simpler like requireFromAppDependency("expo", "metro-config")
  // as it would point to the same instance as the one imported from react-native above
  // we also need to be careful not to require "@expo/metro-config" witch also exists but is a different package
  // used for generating "default metro config". This is something we might want to adapt in the future as well.
  // But for now we want to adapt the config that expo CLI uses in expected scenarios,
  // which is imported from "@expo/metro/metro-config"
  const metroConfigExpo = requireFromAppDependency("expo", "@expo/metro/metro-config");
  // when the project has "flat"/"no-hoisting" node_modules, the metro-config package
  // will be found as a dependency of both react-native and expo, but they will resolve
  // to the same instance, so we need to make sure we don't override the loadConfig twice
  const wasMetroConfigAlreadyOverloaded = metroConfigExpo === metroConfigProxy;
  if (!wasMetroConfigAlreadyOverloaded) {
    console.log("NOT OVERRIDEN");
    overrideModuleFromAppDependency(
      "expo",
      "@expo/metro/metro-config",
      createMetroConfigProxy(metroConfigExpo)
    );
  }
} catch (e) {
  // in case the project doesn't use expo 54 or newer, the above require will throw MODULE_NOT_FOUND
}

// Furthermore, expo CLI also does override the reporter setting despite it being
// set in the config. In order to force CLI to use JSON reporter, we override
// base terminal reporter class from metro that Expo CLI extends
overrideModuleFromAppDependency(
  "react-native",
  "metro/src/lib/TerminalReporter",
  require("../metro_reporter")
);

// since expo 54 this is the new path that the Terminal reporter is imported from, by expo
overrideModuleFromAppDependency(
  "expo",
  "@expo/metro/metro/lib/TerminalReporter",
  require("../metro_reporter")
);

const { expoStart } = requireFromAppDependency("expo", "@expo/cli/build/src/start/index");
expoStart(process.argv.slice(2)); // pass argv but strip node and script name
