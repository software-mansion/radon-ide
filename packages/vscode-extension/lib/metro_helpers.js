const path = require("path");

const appRoot = path.resolve();

// Instead of using require in this code, we should use require_app, which will
// resolve modules relative to the app root, not the extension lib root.
function requireFromAppDir(module) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
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

const extensionLib = process.env.RADON_IDE_LIB_PATH;

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
      // the code below exposes the number of lines in the prelude.
      // This is used to calculate the line number offset
      // when reporting line numbers from the JS runtime, breakpoints
      // and uncaught exceptions. The reason why this is needed, is that
      // metro doesn't include __env__ prelude in the source map resulting in the source map
      // transformation getting shifted by the number of lines in the expo generated prelude.
      process.stdout.write(
        JSON.stringify({
          type: "RNIDE_expo_env_prelude_lines",
          lineCount: module.output[0].data.lineCount,
        })
      );
      process.stdout.write("\n");
    }
    return origProcessModuleFilter(module);
  };

  config.watchFolders = [...(config.watchFolders || []), extensionLib];

  // Handle the case when resolver is not defined in the config
  if (!config.resolver) {
    config.resolver = {};
  } else {
    const originalResolveRequest = config.resolver?.resolveRequest;
    if (originalResolveRequest) {
      // Some storybook setups rely on resolveRequest being overridden
      // in order to exclude storybook files from being imported into the bundle.
      // The files are only included when STORYBOOK_ENABLED environment variable
      // is set. Apparently, we can't set that variable for the whole metro process
      // as you'd normally do with storybook, because it also controls swapping out
      // the main app entry point which also accesses that env constant via expo-constants
      // module. We here implement a workaround which only sets the env variable for the
      // duration of resolveRequest call and reset it back afterwards such that it only
      // impacts resolution process.
      const storybookResolveRequest = (context, moduleName, platform) => {
        process.env.STORYBOOK_ENABLED = "true";
        const res = originalResolveRequest(context, moduleName, platform);
        process.env.STORYBOOK_ENABLED = "false";
        return res;
      };
      config = {
        ...config,
        resolver: {
          ...config.resolver,
          resolveRequest: storybookResolveRequest,
        },
      };
    }
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
  extraNodeModulesPaths.push(path.join(appRoot, "node_modules/react-native/node_modules"));

  config.resolver.nodeModulesPaths = [
    ...(config.resolver.nodeModulesPaths || []),
    ...extraNodeModulesPaths,
  ];

  // This code overrides the default babel transformer. Our transformer is a wrapper
  // that adds a preamble to one of the files loaded by React Native in initialization.
  // It also provides a way to load some integration files when apropriate libraries are requested.
  // Since the transformer is loaded by path, we pass the original transformer that it wraps via process.env
  process.env.RADON_IDE_ORIG_BABEL_TRANSFORMER_PATH = config.transformer.babelTransformerPath;
  config.transformer.babelTransformerPath = path.join(extensionLib, "./babel_transformer.js");

  // In extension development, metro may resolve dependencies for the extension lib files to the extension's node_modules
  // folder, as it lies on the path up the directory tree.
  // Since we don't want this, we use resolver's blockList to exclude the extension lib's node_modules folder from
  // being considered:
  if (process.env.RADON_IDE_DEV) {
    let origBlockList = [];
    if (config.resolver.blockList) {
      // if block list is array, we use it as original block list
      if (Array.isArray(config.resolver.blockList)) {
        origBlockList = config.resolver.blockList;
      } else {
        // otherwise we create a new array containing the original block list
        origBlockList = [config.resolver.blockList];
      }
    }
    config.resolver.blockList = [
      // the below regex aims to match extensionLib/../node_modules/.* paths
      // we use resolve to get absolute path with no ".." in it
      new RegExp(path.resolve(path.join(extensionLib, "..", "node_modules", ".*"))),
      ...origBlockList,
    ];
  }

  // Metro reporter gets overridden when launching with packager script, hence we need
  // to pass its configuration.
  const ReporterImpl = require("./metro_reporter");
  config.reporter = new ReporterImpl();

  process.stdout.write(
    JSON.stringify({
      type: "RNIDE_watch_folders",
      watchFolders: [config.projectRoot, ...config.watchFolders], // metro internally adds projectRoot as first entry to watch folders
    })
  );
  process.stdout.write("\n");

  config.cacheVersion = `RNIDE_metro_cache_version$${process.env.RADON_IDE_VERSION}$${config.cacheVersion}`;

  return config;
}

module.exports = {
  appRoot,
  adaptMetroConfig,
  requireFromAppDir,
  overrideModuleFromAppDir,
};
