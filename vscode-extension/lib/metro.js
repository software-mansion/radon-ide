const path = require("path");

const appRoot = process.argv[2];
const extensionLib = process.argv[3];

const nodeModules = path.join(appRoot, "node_modules") + "/";
const runtimePath = path.join(extensionLib, "runtime.js");
const previewPath = path.join(extensionLib, "preview.js");

// Instead of using require in this code, we should use require_root, which will
// resolve modules relative to the app root, not the extension lib root.
function require_root(module) {
  const path = require.resolve(module, { paths: [appRoot] });
  return require(path);
}

const ctx = require_root("@react-native-community/cli-config").default(appRoot);
const loadMetroConfig = require_root(
  "@react-native-community/cli-plugin-metro/build/tools/loadMetroConfig.js"
).default;
const metro = require_root("metro");
const metroCore = require_root(nodeModules + "metro-core");
const cliServerApi = require_root(nodeModules + "@react-native-community/cli-server-api");

async function runServer(_argv, ctx, args) {
  let reportEvent;
  const terminal = new metroCore.Terminal(process.stdout);
  const ReporterImpl = getReporterImpl(args.customLogReporterPath);
  const terminalReporter = new ReporterImpl(terminal);
  const reporter = {
    update(event) {
      terminalReporter.update(event);
      if (reportEvent) {
        reportEvent(event);
      }
    },
  };
  const metroConfig = await loadMetroConfig(ctx, {
    config: args.config,
    maxWorkers: args.maxWorkers,
    port: args.port,
    resetCache: true, // args.resetCache,
    watchFolders: [...(args.watchFolders || []), appRoot, extensionLib],
    projectRoot: appRoot,
    sourceExts: args.sourceExts,
    reporter,
  });

  // possbily not necessary?
  const defaultRunBeforeMainModules = metroConfig.serializer.getModulesRunBeforeMainModule;
  metroConfig.serializer.getModulesRunBeforeMainModule = (ep) => {
    return [...defaultRunBeforeMainModules(ep), runtimePath];
  };

  // note that real entry file is resolved to runtime.js, which in turns should require the
  // sztudio-real-entry-file module, which is resolved to the real entry file
  metroConfig.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName.match(/preview/)) {
      return {
        filePath: previewPath,
        type: "sourceFile",
      };
    } else if (moduleName.match(/sztudio-runtime/)) {
      return {
        filePath: runtimePath,
        type: "sourceFile",
      };
    }

    // Optionally, chain to the standard Metro resolver.
    return context.resolveRequest(context, moduleName, platform);
  };

  // no idea why this is required / not default?
  metroConfig.resolver.nodeModulesPaths = [nodeModules];

  process.env.RNSZTUDIO_ORIGINAL_BABEL_TRANSFORMER_PATH =
    metroConfig.transformer.babelTransformerPath;
  metroConfig.transformer.babelTransformerPath = require.resolve(
    path.join(extensionLib, "./babel_transformer.js"),
    { paths: [appRoot] }
  );

  if (args.assetPlugins) {
    metroConfig.transformer.assetPlugins = args.assetPlugins.map((plugin) =>
      require.resolve(plugin, { paths: [appRoot] })
    );
  }
  const { middleware, websocketEndpoints, messageSocketEndpoint, eventsSocketEndpoint } =
    cliServerApi.createDevServerMiddleware({
      host: args.host,
      port: metroConfig.server.port,
      watchFolders: metroConfig.watchFolders,
    });
  middleware.use(cliServerApi.indexPageMiddleware);
  const customEnhanceMiddleware = metroConfig.server.enhanceMiddleware;
  metroConfig.server.enhanceMiddleware = (metroMiddleware, server) => {
    if (customEnhanceMiddleware) {
      metroMiddleware = customEnhanceMiddleware(metroMiddleware, server);
    }
    return middleware.use(metroMiddleware);
  };

  const serverInstance = await metro.runServer(metroConfig, {
    host: args.host,
    secure: args.https,
    secureCert: args.cert,
    secureKey: args.key,
    hmrEnabled: true,
    websocketEndpoints,
  });

  reportEvent = eventsSocketEndpoint.reportEvent;
  // if (args.interactive) {
  //   _watchMode(messageSocketEndpoint);
  // }

  // In Node 8, the default keep-alive for an HTTP connection is 5 seconds. In
  // early versions of Node 8, this was implemented in a buggy way which caused
  // some HTTP responses (like those containing large JS bundles) to be
  // terminated early.
  //
  // As a workaround, arbitrarily increase the keep-alive from 5 to 30 seconds,
  // which should be enough to send even the largest of JS bundles.
  //
  // For more info: https://github.com/nodejs/node/issues/13391
  //
  serverInstance.keepAliveTimeout = 30000;
  // await _cliTools(ctx.root);
}
function getReporterImpl(customLogReporterPath) {
  if (customLogReporterPath === undefined) {
    return require_root("metro/src/lib/TerminalReporter");
  }
  try {
    // First we let require resolve it, so we can require packages in node_modules
    // as expected. eg: require('my-package/reporter');
    return require(customLogReporterPath);
  } catch (e) {
    if (e.code !== "MODULE_NOT_FOUND") {
      throw e;
    }
    // If that doesn't work, then we next try relative to the cwd, eg:
    // require('./reporter');
    return require(path.resolve(customLogReporterPath));
  }
}

runServer({}, ctx, {});
