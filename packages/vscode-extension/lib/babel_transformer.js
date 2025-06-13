const ORIGINAL_TRANSFORMER_PATH = process.env.RADON_IDE_ORIG_BABEL_TRANSFORMER_PATH;
const path = require("path");
const { requireFromAppDir, overrideModuleFromAppDir } = require("./metro_helpers");

// In some configurations, React Native may pull several different version of JSX transform plugins:
// plugin-transform-react-jsx-self, plugin-transform-react-jsx-source, plugin-transform-react-jsx and
// plugin-transform-react-jsx-development. For line and column numbers to be added to components, we
// need the development version of the plugin. Apparently, it is up to the order of plugins being added
// whether the development version would actually be allowed to produce the JSXElement node output.
//
// Since babel doesn't have good extension points, as the plugin system relies on directly requiring plugin
// modules, the only option to intercept that process is by overriding require. This, however isn't ideal
// as we don't know which plugins are loaded and in what order.
//
// In addition to that, there are some extra constraints that make this even harder. Specifically, the development
// version of JSX transform plugin (plugin-transform-react-jsx-development) has a check that throws an error
// when plugin-transform-jsx-source or plugin-transform-jsx-self run on the same source files, or in case it is registered
// more than once. Also, some libraries, like nativewind, rely on specific order of JSX transform to happen. Because of
// that we take the following approach:
// 1) we disable plugin-transform-jsx-source and plugin-transform-jsx-self plugins entirely as they are deprecated and
// don't provide any value except from interfering with JSX dev plugin
// 2) we replace non-dev version (plugin-transform-jsx) with dev version (plugin-transform-jsx-development) to ensure that
// the JSX transformation runs at the right time.
// 3) we keep a flag to know if the non-dev version was used (and replaced by dev version), and if it was, we disable
// further requires of the dev version to avoid it being installed the second time.
//
// The downside of the current approach is if the dev version is used first and the non-dev version is listed later,
// we will end up replacing the non-dev version and as a result we will run the dev version twice which will result in
// an error. In practice we haven't yet encountered such a setup.
const jsxDevTransformer = requireFromAppDir("@babel/plugin-transform-react-jsx/lib/development");
let nonJSXDevTransformUsed = false;
overrideModuleFromAppDir("@babel/plugin-transform-react-jsx", (...args) => {
  nonJSXDevTransformUsed = true;
  return jsxDevTransformer.default(...args);
});
overrideModuleFromAppDir("@babel/plugin-transform-react-jsx-development", (...args) => {
  if (nonJSXDevTransformUsed) {
    return {
      name: "rnide-disabled-jsx-dev-transform",
      visitor: {},
    };
  } else {
    return jsxDevTransformer.default(...args);
  }
});
overrideModuleFromAppDir("@babel/plugin-transform-react-jsx-source", {
  name: "rnide-disabled-jsx-source-transform",
  visitor: {},
});
overrideModuleFromAppDir("@babel/plugin-transform-react-jsx-self", {
  name: "rnide-disabled-jsx-self-transform",
  visitor: {},
});

function transformWrapper({ filename, src, ...rest }) {
  function isTransforming(unixPath) {
    return filename.endsWith(path.normalize(unixPath));
  }

  const { transform } = require(ORIGINAL_TRANSFORMER_PATH);
  if (isTransforming("node_modules/react-native/Libraries/Core/InitializeCore.js")) {
    src = `${src};require("__RNIDE_lib__/runtime.js");`;
  } else if (isTransforming("node_modules/expo-router/entry.js")) {
    // expo-router v2 and v3 integration
    const { version } = requireFromAppDir("expo-router/package.json");
    if (version.startsWith("2.")) {
      src = `${src};require("__RNIDE_lib__/expo_router_v2_plugin.js");`;
    } else if (version.startsWith("3.") || version.startsWith("4.")) {
      src = `${src};require("__RNIDE_lib__/expo_router_plugin.js");`;
    } else if (version.startsWith("5.")) {
      src = `${src};require("__RNIDE_lib__/expo_router_v5_plugin.js");`;
    }
  } else if (
    isTransforming("node_modules/react-native-ide/index.js") || // using react-native-ide for compatibility with old NPM package name
    isTransforming("node_modules/radon-ide/index.js")
  ) {
    src = `${src};preview = require("__RNIDE_lib__/preview.js").preview;`;
  } else if (isTransforming("node_modules/@dev-plugins/react-native-mmkv/build/index.js")) {
    src = `require("__RNIDE_lib__/expo_dev_plugins.js").register("@dev-plugins/react-native-mmkv");${src}`;
  } else if (isTransforming("node_modules/redux-devtools-expo-dev-plugin/build/index.js")) {
    src = `require("__RNIDE_lib__/expo_dev_plugins.js").register("redux-devtools-expo-dev-plugin");${src}`;
  } else if (
    isTransforming(
      "node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js"
    ) ||
    isTransforming(
      "node_modules/react-native/Libraries/Renderer/implementations/ReactNativeRenderer-dev.js"
    )
  ) {
    // This is a temporary workaround for inspector in React Native 0.74 & 0.75 & 0.76
    // The inspector broke in those versions because of this commit that's been included
    // in React Native renderer despite it not being a part of React 18 release: https://github.com/facebook/react/commit/37d901e2b8
    // The commit changes the way metadata properties from jsx transforms are added to the elements.
    // The workaround is to replace dev version of ReactNative renderer with the one build from exact
    // same react version, but with that commit reverted. The version of react used in React Native 0.74
    // comes from this commit: https://github.com/facebook/react/commit/03d6f7cf0
    //
    // The mentioned issue got later resolved in https://github.com/facebook/react/commit/61bd00498
    // however, the new approach does not produce the same information as the debug entries only
    // point to component definition lines rather than places where the component is used.
    // There is also a follow-up attempt to bring back proper debug metadata in https://github.com/facebook/react/commit/151cce37401
    // However, this commit is not included in React Native 0.74 and would require pulling in
    // a lot of further changes along with it. Also, based on the commit message, this approach
    // is experimental as it has some performance implications and may be removed in future versions.
    //
    const { version } = requireFromAppDir("react-native/package.json");
    const rendererFileName = filename.split(path.sep).pop();
    if (
      version.startsWith("0.74") ||
      version.startsWith("0.75") ||
      version.startsWith("0.76") ||
      version.startsWith("0.77")
    ) {
      src = `module.exports = require("__RNIDE_lib__/rn-renderer/react-native-74-77/${rendererFileName}");`;
    }
    if (version.startsWith("0.78") || version.startsWith("0.79")) {
      src = `module.exports = require("__RNIDE_lib__/rn-renderer/react-native-78-79/${rendererFileName}");`;
    }
    if (version.startsWith("0.80")) {
      src = `module.exports = require("__RNIDE_lib__/rn-renderer/react-native-80/${rendererFileName}");`;
    }
  } else if (isTransforming("node_modules/react/cjs/react-jsx-dev-runtime.development.js")) {
    const { version } = requireFromAppDir("react-native/package.json");
    const jsxRuntimeFileName = filename.split(path.sep).pop();
    if (version.startsWith("0.78") || version.startsWith("0.79")) {
      src = `module.exports = require("__RNIDE_lib__/JSXRuntime/react-native-78-79/${jsxRuntimeFileName}");`;
    }
    if (version.startsWith("0.80")) {
      src = `module.exports = require("__RNIDE_lib__/JSXRuntime/react-native-80/${jsxRuntimeFileName}");`;
    }
  } else if (
    isTransforming("node_modules/@tanstack/react-query/src/index.ts") ||
    isTransforming("node_modules/@tanstack/react-query/build/lib/index.js")
  ) {
    src = `require("__RNIDE_lib__/plugins/react-query-devtools.js");${src}`;
  } else if (isTransforming("/lib/rn-internals/rn-internals.js")) {
    const { version } = requireFromAppDir("react-native/package.json");
    const majorMinorVersion = version.split(".").slice(0, 2).join(".");
    src = `module.exports = require("__RNIDE_lib__/rn-internals/rn-internals-${majorMinorVersion}.js");`;
  }

  return transform({ filename, src, ...rest });
}

module.exports = { transform: transformWrapper };
