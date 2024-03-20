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
    }
    return origProcessModuleFilter(module);
  };

  // We actually need to reset port number here again, because CLI overrides it
  // thinking that value 0 means "use default port".
  config.server.port = 0;

  config.watchFolders = [...(config.watchFolders || []), extensionLib];

  // This code overrides resolver allowing us to host some files from the extension's lib folder
  // Currently used for runtime and wrapper functionalities
  const origResolveRequest = config.resolver.resolveRequest;
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
    return origResolveRequest(context, moduleName, platform);
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

  // Metro reporter gets overridden when launching with packager script, hence we need
  // to pass its configuration.
  const ReporterImpl = require("./metro_reporter");
  config.reporter = new ReporterImpl();

  return config;
}

function metroServerReadyHandler(originalOnReadyHandler) {
  return (server, ...args) => {
    const port = server.address().port;
    process.env.EXPO_PACKAGER_PROXY_URL =
      process.env.EXPO_MANIFEST_PROXY_URL = `http://localhost:${port}`;
    originalOnReadyHandler && originalOnReadyHandler(server, ...args);
    process.stdout.write(JSON.stringify({ type: "rnp_initialize_done", port }));
    process.stdout.write("\n");
  };
}

module.exports = {
  adaptMetroConfig,
  requireFromAppDir,
  metroServerReadyHandler,
  overrideModuleFromAppDir,
};
