let agent = globalThis.__radon_agent;

if (!agent) {
  // if the agent was not loaded yet, we do it here -- hopefully connect had the time to register its bridge already
  agent = require("./react_devtools_agent");
}

const messageListeners = [];
let nextMessageId = 1;
const unacknowledgedMessages = [];

const inspectorBridge = {
  sendMessage: (message) => {
    const messageWithId = { id: nextMessageId++, ...message };
    unacknowledgedMessages.push(messageWithId);
    agent.postMessage(messageWithId);
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

  if (message.type === "ack") {
    const unreceivedIndex = unacknowledgedMessages.findIndex((msg) => msg.id > message.id);
    unacknowledgedMessages.splice(
      0,
      unreceivedIndex === -1 ? unacknowledgedMessages.length : unreceivedIndex
    );
    return;
  } else if (message.type === "retransmit") {
    const lastReceivedId = message.id;
    unacknowledgedMessages.forEach((msg) => {
      if (msg.id > lastReceivedId) {
        agent.postMessage(msg);
      }
    });
    unacknowledgedMessages.length = 0;
    return;
  }

  messageListeners.forEach((listener) => listener(message));
};

module.exports = inspectorBridge;
