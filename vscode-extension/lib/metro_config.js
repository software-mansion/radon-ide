const path = require("path");

const appRoot = path.resolve();

// Instead of using require in this code, we should use require_app, which will
// resolve modules relative to the app root, not the extension lib root.
function require_app(module) {
  const path = require.resolve(module, { paths: [appRoot] });
  return require(path);
}

// Part 1
// An ugly workaround for packager script to print actual port number.
// Since we want to start packager on ephemeral port, we need to know the actual port number.
// Apparently, metro only reports port provided to the config, which will be 0.
// This workaround overrides runServer method from metro main module by providing
// a default onReady callback that prints the real port number.
const Metro = require_app("metro");

const oldRunServer = Metro.runServer;
Metro.runServer = function (config, options) {
  return oldRunServer(config, {
    ...options,
    onReady: (server, ...args) => {
      options.onReady && options.onReady(server, ...args);
      console.log("METRO_READY", server.address().port);
    },
  });
};
// END Part 1

// Part 2
// Below is the main code of the config overrider.
const { loadConfig } = require_app("metro-config");

const extensionLib = process.env.REACT_NATIVE_IDE_LIB_PATH;

module.exports = async function () {
  const config = await loadConfig({}, {});

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
    }
    return origProcessModuleFilter(module);
  };

  // We actually need to reset port number here again, because CLI overrides it
  // thinking that value 0 means "use default port".
  config.server.port = 0;

  config.watchFolders = [...(config.watchFolders || []), extensionLib];

  // This code overrides resolver allowing us to host some files from the extension's lib folder
  // Currently used for runtime and wrapper functionalities
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName.match(/__rnp_lib__/)) {
      // we strip __rnp_lib__/ from the path to get relative location to extenion's lib folder
      const relativePath = moduleName.replace(/.*__rnp_lib__\//, "");
      const libFilePath = path.join(extensionLib, relativePath);
      return {
        filePath: libFilePath,
        type: "sourceFile",
      };
    }

    // Invoke the standard Metro resolver.
    return context.resolveRequest(context, moduleName, platform);
  };
  // Specifying resolveRequest requires that also nodeModulesPaths are set.
  // Both these settings are not set by default.
  // This may potentially break with non-standard settings like yarn workspaces etc.
  // TODO: figure out why these settings aren't needed when not overriding resolveRequest
  config.resolver.nodeModulesPaths = [
    ...(config.resolver.nodeModulesPaths || []),
    path.join(appRoot, "node_modules"),
  ];

  // This code overrides the default babel transformer. Our transformer is a wrapper
  // that adds a preamble to one of the files loaded by React Native in initialization.
  // It also provides a way to load some integration files when apropriate libraries are requested.
  // Since the transformer is loaded by path, we pass the original transformer that it wraps via process.env
  process.env.REACT_NATIVE_IDE_ORIG_BABEL_TRANSFORMER_PATH =
    config.transformer.babelTransformerPath;
  config.transformer.babelTransformerPath = path.join(extensionLib, "./babel_transformer.js");

  return config;
};
