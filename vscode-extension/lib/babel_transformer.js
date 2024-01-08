const ORIGINAL_TRANSFORMER_PATH = process.env.REACT_NATIVE_IDE_ORIG_BABEL_TRANSFORMER_PATH;

// The below section overrides import of @babel/plugin-transform-react-jsx to load @babel/plugin-transform-react-jsx/lib/development
// instead. We need this for because the default transformer doesn't attach source locations to JSX nodes, which is required for
// the code inspector to work.
// What we do here is resolve the original transfomer location and replace it in require cache with the development
// version. As a result, when the preset loads the transformer, it will load the development version.
const jsxTransformPluginPath = require.resolve("@babel/plugin-transform-react-jsx", {
  paths: [ORIGINAL_TRANSFORMER_PATH],
});
require(jsxTransformPluginPath);
const devJsxTransformPluginPath = require.resolve(
  "@babel/plugin-transform-react-jsx/lib/development",
  { paths: [ORIGINAL_TRANSFORMER_PATH] }
);
require(devJsxTransformPluginPath);
require.cache[jsxTransformPluginPath] = require.cache[devJsxTransformPluginPath];

function transformWrapper({ filename, src, ...rest }) {
  const { transform } = require(ORIGINAL_TRANSFORMER_PATH);
  if (filename === "node_modules/react-native/Libraries/Core/InitializeCore.js") {
    src = `global.__REACT_DEVTOOLS_PORT__=${process.env.RCT_DEVTOOLS_PORT};\n${src}\nrequire("__rnp_lib__/runtime.js");\n`;
  } else if (filename === "node_modules/expo-router/entry.js") {
    // expo-router v2 integration
    src = `${src};require("__rnp_lib__/expo_router_plugin.js");`;
  } else if (filename === "node_modules/react-native-ide/index.js") {
    src = `${src};preview = require("__rnp_lib__/preview.js").preview;`;
  }
  return transform({ filename, src, ...rest });
}

module.exports = { transform: transformWrapper };
