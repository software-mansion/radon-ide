const path = require("path");

const appRoot = path.resolve();

// Instead of using require in this code, we should use require_app, which will
// resolve modules relative to the app root, not the extension lib root.
function requireFromAppDir(module) {
  const path = require.resolve(module, { paths: [appRoot] });
  return require(path);
}

function overrideModuleFromAppDir(moduleName, exports) {
  try {
    const moduleToOverride = require.resolve(moduleName, {
      paths: [appRoot],
    });
    require.cache[moduleToOverride] = {
      exports,
    };
  } catch (e) {
    // the code may throw MODULE_NOT_FOUND error, in which case we don't do anything
    // as there is nothing to override
  }
}

const extensionLib = process.env.REACT_NATIVE_IDE_LIB_PATH;

function adaptMetroConfig(config) {
  // We use processorModuleFilter to inject some code into the bundle prelude.
  // This is needed, as we want to configre React DevTools port, which changes with every
  // run of the metro server. React Native expects devtools port to available under
  // global.__REACT_DEVTOOLS_PORT__, so by defining such var in the prelude, it is accessible
  // via global object later on. The port number cannot be embedded in any other source file,
  // as otherwise metro caching would cause the port number to be stale (unless we find a way
  // to invalidate individual files in the cache).
  const origProcessModuleFilter = config.serializer.processModuleFilter;
  config.serializer.processModuleFilter = (module) => {
    if (module.path === "__prelude__") {
      const preludeCode = module.output[0].data.code;
      if (!preludeCode.includes("__REACT_DEVTOOLS_PORT__")) {
        module.output[0].data.code = `${preludeCode};var __REACT_DEVTOOLS_PORT__=${process.env.RCT_DEVTOOLS_PORT};`;
      }
    } else if (module.path === "__env__") {
      // this handles @expo/env plugin, which is used to inject environment variables
      // the code below instantiates a global variable __EXPO_ENV_PRELUDE_LINES__ that stores
      // the number of lines in the prelude. This is used to calculate the line number offset
      // when reporting line numbers from the JS runtime. The reason why this is needed, is that
      // metro doesn't include __env__ prelude in the source map resulting in the source map
      // transformation getting shifted by the number of lines in the prelude.
      const expoEnvCode = module.output[0].data.code;
      if (!expoEnvCode.includes("__EXPO_ENV_PRELUDE_LINES__")) {
        module.output[0].data.code = `${expoEnvCode};var __EXPO_ENV_PRELUDE_LINES__=${module.output[0].data.lineCount};`;
      }
    }
    return origProcessModuleFilter(module);
  };

  // We actually need to reset port number here again, because CLI overrides it
  // thinking that value 0 means "use default port".
  config.server.port = 0;

  config.watchFolders = [...(config.watchFolders || []), extensionLib];

  // Handle the case when resolver is not defined in the config
  if (!config.resolver) {
    config.resolver = {};
  }

  // This code allows us to host some files from the extension's lib folder
  // Currently used for runtime and wrapper functionalities
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    __RNIDE_lib__: extensionLib,
    __APPDIR__: appRoot,
  };

  // This code is needed to resolve modules that the extension lib files import.
  // Since node's resolution algorithm require that dependencies are present in node_modules
  // folder that is located in the parent/gradparent/etc directory, we need to add the app's
  // node_modules folder to allow files from the extension lib to import things like react, react-native
  // and other dependencies. Since in some setups apps don't keep all dependency under app root's node_modules
  // directory, we need to add all the parent directories to the nodeModulesPaths array.
  const extraNodeModulesPaths = [];
  for (let next = appRoot; path.dirname(next) !== next; next = path.dirname(next)) {
    extraNodeModulesPaths.push(path.join(next, "node_modules"));
  }

  // because some libraries imported by the files in extension lib are not imported directly by an application, 
  // but are imported by react native we need to add it's node_modules to the paths list
  extraNodeModulesPaths.push(path.join(appRoot,"node_modules/react-native/node_modules"));

  config.resolver.nodeModulesPaths = [
    ...(config.resolver.nodeModulesPaths || []),
    ...extraNodeModulesPaths,
  ];

  // This code overrides the default babel transformer. Our transformer is a wrapper
  // that adds a preamble to one of the files loaded by React Native in initialization.
  // It also provides a way to load some integration files when apropriate libraries are requested.
  // Since the transformer is loaded by path, we pass the original transformer that it wraps via process.env
  process.env.REACT_NATIVE_IDE_ORIG_BABEL_TRANSFORMER_PATH =
    config.transformer.babelTransformerPath;
  config.transformer.babelTransformerPath = path.join(extensionLib, "./babel_transformer.js");

  // Metro reporter gets overridden when launching with packager script, hence we need
  // to pass its configuration.
  const ReporterImpl = require("./metro_reporter");
  config.reporter = new ReporterImpl();

  return config;
}

// An ugly workaround for packager script to print actual port number.
// Since we want to start packager on ephemeral port, we need to know the actual port number.
// Apparently, metro only reports port provided to the config, which will be 0.
// This workaround overrides http server prototype and prints the port number along
// with setting some env variables specific to expo that are populated with "0" port as well.
function patchHttpListen() {
  const http = require("http");
  const originalListen = http.Server.prototype.listen;

  http.Server.prototype.listen = function (...args) {
    const server = this;
    originalListen.apply(server, args);
    server.on("listening", () => {
      const port = server.address().port;
      process.env.EXPO_PACKAGER_PROXY_URL =
        process.env.EXPO_MANIFEST_PROXY_URL = `http://localhost:${port}`;
      process.stdout.write(JSON.stringify({ type: "RNIDE_initialize_done", port }));
      process.stdout.write("\n");
    });
    return server;
  };
}

patchHttpListen();

module.exports = {
  appRoot,
  adaptMetroConfig,
  requireFromAppDir,
  overrideModuleFromAppDir,
};
