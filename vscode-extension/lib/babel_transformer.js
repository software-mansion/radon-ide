const { transform } = require(process.env.RNSZTUDIO_ORIGINAL_BABEL_TRANSFORMER_PATH);

function transformWrapper({ filename, src, ...rest }) {
  if (filename.match(/node_modules\/react-native\/Libraries\/Core\/setUpReactDevTools/)) {
    src = `global.__REACT_DEVTOOLS_PORT__=${process.env.RCT_DEVTOOLS_PORT};${src}\nrequire("sztudio-runtime");`;
  }
  return transform({ filename, src, ...rest });
}

module.exports = { transform: transformWrapper };
