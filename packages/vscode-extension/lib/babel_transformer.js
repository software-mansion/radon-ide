const ORIGINAL_TRANSFORMER_PATH = process.env.REACT_NATIVE_IDE_ORIG_BABEL_TRANSFORMER_PATH;

const { requireFromAppDir, overrideModuleFromAppDir } = require("./metro_helpers");

// In some configurations, React Native may pull several different version of JSX transoform plugins:
// plugin-transform-react-jsx-self, plugin-transform-react-jsx-source, plugin-transform-react-jsx and
// plugin-transform-react-jsx-development. For line and column numbers to be added to components, we
// need the development version of the plugin. Apparently, it is up to the order of plugins being added
// whether the development version would actually be allowed to produce the JSXElement node output.
// To workaround this issue, we override require such that it always pulls in the development version.
// Apparently, when someone has both dev and non-dev plugins on their babel config, overriding the non-dev
// version with dev will result in an error, as the dev version has additional checks and throws an error
// when registered more then once (which is what's going to happen if we turn non-dev into dev version).
// In order to avoid this, we add a custom plugin that disables all jsx transform visitors that come after
// the first one.
const jsxDevTransformer = requireFromAppDir("@babel/plugin-transform-react-jsx/lib/development");
overrideModuleFromAppDir("@babel/plugin-transform-react-jsx", jsxDevTransformer);

function clearObject(obj) {
  for (let prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      delete obj[prop];
    }
  }
}

function transformWrapper({ filename, src, plugins, ...rest }) {
  const { transform } = require(ORIGINAL_TRANSFORMER_PATH);
  if (filename.endsWith("node_modules/react-native/Libraries/Core/InitializeCore.js")) {
    src = `${src};require("__RNIDE_lib__/runtime.js");`;
  } else if (filename.endsWith("node_modules/expo-router/entry.js")) {
    // expo-router v2 and v3 integration
    const { version } = requireFromAppDir("expo-router/package.json");
    if (version.startsWith("2.")) {
      src = `${src};require("__RNIDE_lib__/expo_router_v2_plugin.js");`;
    } else if (version.startsWith("3.")) {
      src = `${src};require("__RNIDE_lib__/expo_router_plugin.js");`;
    }
  } else if (filename.endsWith("node_modules/react-native-ide/index.js")) {
    src = `${src};preview = require("__RNIDE_lib__/preview.js").preview;`;
  }

  const newPlugins = [
    {
      name: "disable-non-dev-jsx-transformer-exit",
      pre(state) {
        // we disable all jsx transform visitors that come after the first one, because they will
        // throw an error recognizing that parts of the code have already been transformed.
        const plugins = state.opts.plugins;
        const jsxTransformer = plugins.find((p) => p.key === "transform-react-jsx/development");
        if (jsxTransformer) {
          plugins.forEach((plugin) => {
            if (plugin.key.includes("transform-react-jsx") && plugin !== jsxTransformer) {
              // we need to clear the visitor as it is being referenced in other places, so
              // reassigning to empty object doesn't work.
              clearObject(plugin.visitor);
            }
          });
        }
      },
    },
    ...plugins,
  ];

  return transform({ filename, src, plugins: newPlugins, ...rest });
}

module.exports = { transform: transformWrapper };
