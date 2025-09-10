let devtoolsAgent = undefined;
let messageQueue = [];

const agent = {
  postMessage: (message) => {
    if (devtoolsAgent) {
      devtoolsAgent._bridge.send("RNIDE_message", message);
    } else {
      messageQueue.push(message);
    }
  },
  onmessage: undefined,
};

const setDevtoolsAgent = (newDevtoolsAgent) => {
  if (!newDevtoolsAgent) {
    devtoolsAgent = undefined;
    return;
  }
  devtoolsAgent = newDevtoolsAgent;
  const bridge = devtoolsAgent._bridge;

  function onIdeMessage(message) {
    if (agent.onmessage) {
      agent.onmessage(message);
    }
  }

  function onBridgeShutdown() {
    if (devtoolsAgent === newDevtoolsAgent) {
      devtoolsAgent = undefined;
    }
    bridge.removeListener("RNIDE_message", onIdeMessage);
    bridge.removeListener("shutdown", onBridgeShutdown);
  }

  bridge.addListener("RNIDE_message", onIdeMessage);
  bridge.addListener("shutdown", onBridgeShutdown);

  const messages = messageQueue;
  messageQueue = [];
  messages.forEach((message) => {
    bridge.send("RNIDE_message", message);
  });
};

const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
if (hook.reactDevtoolsAgent) {
  setDevtoolsAgent(hook.reactDevtoolsAgent);
}
hook.on("react-devtools", setDevtoolsAgent);

globalThis.__radon_agent = agent;

module.exports = agent;
