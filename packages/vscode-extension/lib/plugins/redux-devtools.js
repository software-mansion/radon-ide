const { createComposeWithDevTools } = require("./third-party/redux-devtools-expo-dev-plugin");
const { PluginMessageBridge } = require("./PluginMessageBridge");

export const compose = (...args) => {
  global.__RNIDE_register_dev_plugin && global.__RNIDE_register_dev_plugin("redux-devtools");
  const proxyClient = new PluginMessageBridge("redux-devtools");
  return createComposeWithDevTools(() => proxyClient)(...args);
};
