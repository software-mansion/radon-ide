const { createComposeWithDevTools } = require("./third-party/redux-devtools-expo-dev-plugin");
const { AppExtensionProxy } = require("./AppExtensionProxy");

export const compose = (...args) => {
  global.__RNIDE_register_dev_plugin && global.__RNIDE_register_dev_plugin("redux-devtools");
  const proxyClient = new AppExtensionProxy("redux-devtools");
  return createComposeWithDevTools(() => proxyClient)(...args);
};
