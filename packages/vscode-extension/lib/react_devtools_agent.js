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
    return;
  }
  devtoolsAgent = newDevtoolsAgent;
  devtoolsAgent._bridge.addListener("RNIDE_message", (message) => {
    if (agent.onmessage) {
      agent.onmessage(message);
    }
  });
  const messages = messageQueue;
  messageQueue = [];
  messages.forEach((message) => {
    devtoolsAgent._bridge.send("RNIDE_message", message);
  });
};

const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
if (hook.reactDevtoolsAgent) {
  setDevtoolsAgent(hook.devtoolsAgent);
} else {
  hook.on("react-devtools", setDevtoolsAgent);
}

globalThis.__radon_agent = agent;
