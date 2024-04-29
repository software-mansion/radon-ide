const ORIGINAL_TRANSFORMER_PATH = process.env.REACT_NATIVE_IDE_ORIG_BABEL_TRANSFORMER_PATH;

const { requireFromAppDir } = require("./metro_helpers");

function transformWrapper({ filename, src, plugins, ...rest }) {
  const { transform } = require(ORIGINAL_TRANSFORMER_PATH);
  if (filename.endsWith("node_modules/react-native/Libraries/Core/InitializeCore.js")) {
    src = `${src};require("__RNIDE_lib__/runtime.js");`;
  } else if (filename.endsWith("node_modules/expo-router/entry.js")) {
    // expo-router v2 and v3 integration
    const { version } = requireFromAppDir("expo-router/package.json");
    if (version.startsWith("2.")) {
      // src = `${src};require("__RNIDE_lib__/expo_router_v2_plugin.js");`;
    } else if (version.startsWith("3.")) {
      // src = `${src};require("__RNIDE_lib__/expo_router_plugin.js");`;
    }
  } else if (filename.endsWith("node_modules/react-native-ide/index.js")) {
    src = `${src};preview = require("__RNIDE_lib__/preview.js").preview;`;
  }

  const newPlugins = [
    {
      name: "disable-non-dev-jsx-transformer-exit",
      pre(state) {
        // In some configurations, React Native may pull several different version of JSX transoform plugins:
        // plugin-transform-react-jsx-self, plugin-transform-react-jsx-source, plugin-transform-react-jsx and
        // plugin-transform-react-jsx-development. For line and columnt numbers to be added to components, we
        // need the development version of the plugin to produce the JSXElement node output. Apparently,
        // in the default configuration, non-dev version is typically added and runs before the dev version
        // resulting in the JSXElement node being processed by the non-dev version and the latter, dev version
        // not seeing the already transformed node. Below, we implement a workaround that deletes JSXElement
        // visitor from jsx transform plugin, as long as development version of the plugin is also present.
        // This way we let the development version handle transforming JSXElement nodes.
        const hasJsxDevTransformer = state.opts.plugins.some(
          (p) => p.key === "transform-react-jsx/development"
        );
        if (hasJsxDevTransformer) {
          state.opts.plugins.forEach((plugin) => {
            if (plugin.key === "transform-react-jsx") {
              delete plugin.visitor.JSXElement;
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
