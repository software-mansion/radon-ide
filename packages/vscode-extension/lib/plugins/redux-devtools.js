const { createComposeWithDevTools } = require("./third-party/redux-devtools-expo-dev-plugin");
const { AppExtensionProxy } = require('./AppExtensionProxy');

export const compose = (...args) => {
  global.__RNIDE_register_dev_plugin && global.__RNIDE_register_dev_plugin("RNIDE-redux-devtools");
  const proxyClient = new AppExtensionProxy("RNIDE-redux-devtools");
  return createComposeWithDevTools(() => proxyClient)(...args);
};
