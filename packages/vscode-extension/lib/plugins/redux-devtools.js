const { createComposeWithDevTools } = require("./third-party/redux-devtools-expo-dev-plugin");
const {RNIDEAppExtensionProxy} = require('./utils');

export const compose = (...args) => {
  global.__RNIDE_register_dev_plugin && global.__RNIDE_register_dev_plugin("RNIDE-redux-devtools");
  const proxyClient = new RNIDEAppExtensionProxy("RNIDE-redux-devtools");
  return createComposeWithDevTools(() => proxyClient)(...args);
};
