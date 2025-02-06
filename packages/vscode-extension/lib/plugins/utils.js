export class RNIDEProxyClient {
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

  setDevtoolsAgent = (agent) => {
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
    console.log('EVENT SEND MESSAGE', type, data, this.devtoolsAgent);
    if (!this.devtoolsAgent) {
      return;
    }

    console.log('EVENT SEND MESSAGE 2', type, data, this.devtoolsAgent._bridge);
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
