const ORIGINAL_TRANSFORMER_PATH = process.env.REACT_NATIVE_IDE_ORIG_BABEL_TRANSFORMER_PATH;

// For JSX source file annotation to work correctly, we rely on plugin-transform-react-jsx/lib/development which is
// a development version of plugin-transform-react-jsx. Apparently, React Native by default pulls in three different
// plugins aiming to transform JSX. As they aren't needed, they also doesn't interfere with each other. However, when
// jsx/lib/development version of the gets added to the mix, they start to throw error messages about the other
// plugins being deprecated. To avoid this, we disable the two plugins in question: jsx-self and jsx-source.
// The disabling works by overriding node's require cache with noop version of plugins as we couldn't find a better
// way to handle this without modifying React Native's code.
// In order to eventually load jsx-development plugin, we override plugins list in the transformer.
function disablePlugin(moduleNameToOverride) {
  const pluginToOverride = require.resolve(moduleNameToOverride, {
    paths: [ORIGINAL_TRANSFORMER_PATH],
  });
  require.cache[pluginToOverride] = {
    exports: function () {
      return { visitor: {} };
    },
  };
}
disablePlugin("@babel/plugin-transform-react-jsx-self");
disablePlugin("@babel/plugin-transform-react-jsx-source");

function transformWrapper({ filename, src, plugins, ...rest }) {
  const { transform } = require(ORIGINAL_TRANSFORMER_PATH);
  if (filename === "node_modules/react-native/Libraries/Core/InitializeCore.js") {
    src = `${src};require("__rnp_lib__/runtime.js");`;
  } else if (filename === "node_modules/expo-router/entry.js") {
    // expo-router v2 integration
    src = `${src};require("__rnp_lib__/expo_router_plugin.js");`;
  } else if (filename === "node_modules/react-native-ide/index.js") {
    src = `${src};preview = require("__rnp_lib__/preview.js").preview;`;
  }

  const newPlugins = [
    require(require.resolve("@babel/plugin-transform-react-jsx/lib/development", {
      paths: [ORIGINAL_TRANSFORMER_PATH],
    })),
    ...(plugins || []),
  ];

  return transform({ filename, src, plugins: newPlugins, ...rest });
}

module.exports = { transform: transformWrapper };
