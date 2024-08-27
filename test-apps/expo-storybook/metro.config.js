const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { generate } = require("@storybook/react-native/scripts/generate");

generate({
  configPath: path.resolve(__dirname, "./.storybook"),
  useJs: true,
});

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.transformer.unstable_allowRequireContext = true;

module.exports = defaultConfig;
