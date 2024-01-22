const ORIGINAL_TRANSFORMER_PATH = process.env.REACT_NATIVE_IDE_ORIG_BABEL_TRANSFORMER_PATH;

// React Native in some configurations may pull several different version of JSX transoform plugins:
// plugin-transform-react-jsx-self, plugin-transform-react-jsx-source, plugin-transform-react-jsx and
// plugin-transform-react-jsx-development. We want to use plugin-transform-react-jsx-development, however, this package
// may not always be installed as it's been only added recently to RN presents. But since it only imports
// plugin-transform-react-jsx/lib/development we can rely on loading that instead.
// Unfortunately, when one of the other plugins is installed while we add plugin-transform-react-jsx/lib/development,
// we start getting build errors.
// Below, we implemented a workaround that disables all other plugins from being loaded using require. It returns an empty
// babel plugin and allows for the only transformer that we want to be included.
const { overrideModuleFromAppDir } = require("./metro_helpers");
function disablePlugin(moduleNameToOverride) {
  overrideModuleFromAppDir(moduleNameToOverride, function () {
    return { visitor: {} };
  });
}
disablePlugin("@babel/plugin-transform-react-jsx-self");
disablePlugin("@babel/plugin-transform-react-jsx-source");
disablePlugin("@babel/plugin-transform-react-jsx");
disablePlugin("@babel/plugin-transform-react-jsx-development");

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
