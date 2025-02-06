const { useEffect } = require("react");
const {createComposeWithDevTools} = require('./external/redux-devtools-expo-dev-plugin');
const {RNIDEProxyClient} = require('./utils');

let proxyClient = null;

export const isProxyClientReady = () => proxyClient !== null;

export const clearProxyClient = () => proxyClient = null;

export const createRNIDEProxyClientAsync = async () => {
  if (proxyClient !== null) {
    return proxyClient;
  }
  
  proxyClient = new RNIDEProxyClient('RNIDE-redux-devtools');

  return proxyClient;
};

window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = createComposeWithDevTools(createRNIDEProxyClientAsync);

export const useReduxDevTools = (devtoolsAgent) => {
  useEffect(() => {
    proxyClient?.setDevtoolsAgent(devtoolsAgent);

    return () => {
      proxyClient?.clearDevToolsAgent();
    };
  }, [devtoolsAgent]);
};
