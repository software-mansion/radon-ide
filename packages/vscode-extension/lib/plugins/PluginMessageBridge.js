const inspectorBridge = require("../inspector_bridge");

export class PluginMessageBridge {
  constructor(pluginId) {
    this.pluginId = pluginId;
    this.listeners = new Map();
    inspectorBridge.addMessageListener(this.handleMessage);
  }

  handleMessage = (message) => {
    const { type, data } = message;
    if (type === "pluginMessage" && data.pluginId === this.pluginId) {
      const listeners = this.listeners.get(data.type) || [];
      listeners.forEach((listener) => listener(data.data));
    }
  };

  sendMessage(type, data) {
    inspectorBridge.sendMessage({
      type: "pluginMessage",
      data: {
        pluginId: this.pluginId,
        type,
        data,
      },
    });
  }

  addMessageListener(type, listener) {
    const currentListeners = this.listeners.get(type) || [];
    this.listeners.set(type, [...currentListeners, listener]);
  }

  removeMessageListener(type, listener) {
    const currentListeners = this.listeners.get(type) || [];
    const filteredListeners = currentListeners.filter((l) => l !== listener);
    this.listeners.set(type, filteredListeners);
  }

  closeAsync() {
    this.listeners.clear();
  }
}
