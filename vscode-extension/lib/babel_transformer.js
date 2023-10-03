const { transform } = require(process.env.RNSZTUDIO_ORIGINAL_BABEL_TRANSFORMER_PATH);

function transformWrapper({ filename, src, ...rest }) {
  if (filename === "node_modules/react-native/Libraries/Core/InitializeCore.js") {
    src += '\nrequire("sztudio-runtime");\n';
  }
  return transform({ filename, src, ...rest });
}

module.exports = { transform: transformWrapper };
