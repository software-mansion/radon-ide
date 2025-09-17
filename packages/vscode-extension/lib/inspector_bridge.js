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

let wakeupTimeout = null;
agent.onmessage = (message) => {
  // NOTE: this is a hack needed on React Native 0.76 with CDP-based agents.
  // This is needed because on RN 0.76 promises created by the debugger through `Runtime.evaluate`
  // won't resolve until the application wakes up by itself (e.g. by user interaction or a timer firing).
  const { Platform } = require("react-native");
  if (
    wakeupTimeout === null &&
    Platform.constants.reactNativeVersion.major === 0 &&
    Platform.constants.reactNativeVersion.minor === 76
  ) {
    wakeupTimeout = setTimeout(() => {
      wakeupTimeout = null;
    }, 0);
  }

  messageListeners.forEach((listener) => listener(message));
};

module.exports = inspectorBridge;
