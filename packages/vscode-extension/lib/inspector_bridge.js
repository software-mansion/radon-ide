let agent = globalThis.__radon_agent;

if (!agent) {
  // if the agent was not loaded yet, we do it here -- hopefully connect had the time to register its bridge already
  agent = require("./react_devtools_agent");
}

const messageListeners = [];

const inspectorBridge = {
  sendMessage: (message) => {
    agent.postMessage(message);
  },
  addMessageListener: (listener) => {
    messageListeners.push(listener);
  },
  removeMessageListener: (listener) => {
    messageListeners.splice(messageListeners.indexOf(listener), 1);
  },
};

agent.onmessage = (message) => {
  messageListeners.forEach((listener) => listener(message));
};

module.exports = inspectorBridge;
