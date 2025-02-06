const { useEffect } = require("react");
const {createComposeWithDevTools} = require('./external/redux-devtools-expo-dev-plugin');

class RNIDEAppExtensionProxy {
  scope;
  listeners = new Map();
  devtoolsAgent = undefined; 

  constructor(scope) {
    this.scope = scope;
  }

  handleMessages = (data) => {
    const listeners = this.listeners.get(data.type) || [];
    listeners.forEach((listener) => listener(data.data));
  };

  setDevtoolsAgent = (agent) =>  {
    if (!agent) {
      return;
    }
    this.devtoolsAgent = agent;
    this.devtoolsAgent._bridge.addListener(this.scope, this.handleMessages);
  };

  clearDevToolsAgent = () => {
    if (!this.devtoolsAgent) {
      return;
    }

    this.devtoolsAgent._bridge.removeListener(this.scope, this.handleMessages);
    this.devtoolsAgent = undefined;
  };

  sendMessage = (type, data) => {
    if (!this.devtoolsAgent) {
      return;
    }

    this.devtoolsAgent._bridge.send(this.scope, {
      type,
      data,
    });
  };

  addMessageListener = (type, listener) => {
    const currentListeners = this.listeners.get(type) || [];
    this.listeners.set(type, [...currentListeners, listener]);
  };

  removeMessageListener = (type, listener) => {
    const currentListeners = this.listeners.get(type) || [];
    const filteredListeners = currentListeners.filter((l) => l !== listener);
    this.listeners.set(type, filteredListeners);
  };

  closeAsync = () => {
    this.clearDevToolsAgent();
    this.listeners.clear();
  };
}

let proxyClient = null;
let reduxDevToolsReady = false;

export const isReduxDevToolsReady = () => reduxDevToolsReady;

export const createRNIDEProxyClientAsync = async () => {
  if (proxyClient !== null) {
    return proxyClient;
  }
  
  reduxDevToolsReady = true;
  proxyClient = new RNIDEAppExtensionProxy('RNIDE-redux-devtools');

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
