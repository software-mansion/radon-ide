const agent = globalThis.__radon_agent;

if (!agent) {
  throw new Error("Radon inspector bridge agent is not installed");
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
