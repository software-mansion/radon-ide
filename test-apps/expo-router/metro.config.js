const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { generate } = require("@storybook/react-native/scripts/generate");

generate({
  configPath: path.resolve(__dirname, "./.storybook"),
  useJs: true,
});

const defaultConfig = getDefaultConfig(__dirname);

// defaultConfig.resolver.resolverMainFields.unshift("sbmodern");

defaultConfig.transformer.unstable_allowRequireContext = true;

// defaultConfig.resolver.resolveRequest = (context, moduleName, platform) => {
//   const defaultResolveResult = context.resolveRequest(
//     context,
//     moduleName,
//     platform
//   );

//   if (
//     process.env.STORYBOOK_ENABLED !== "true" &&
//     defaultResolveResult?.filePath?.includes?.(".storybook/")
//   ) {
//     return {
//       type: "empty",
//     };
//   }

//   return defaultResolveResult;
// };

module.exports = defaultConfig;
