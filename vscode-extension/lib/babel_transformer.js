const { transform } = require(
  require.resolve("metro-babel-transformer", { paths: [process.cwd()] })
);

function transformWrapper({ filename, src, ...rest }) {
  if (filename === "index.js") {
    src += '\nrequire("sztudio-runtime");\n';
  }
  return transform({ filename, src, ...rest });
}

module.exports = { transform: transformWrapper };
