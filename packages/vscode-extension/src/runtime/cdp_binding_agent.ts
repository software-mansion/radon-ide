import type { Agent } from "./globals";

const agent: Agent = {
  postMessage: (message: any) => {
    globalThis.__radon_binding(JSON.stringify(message));
  },
  onmessage: undefined,
};

globalThis.__radon_dispatch = (message: any) => {
  if (agent.onmessage) {
    agent.onmessage(message);
  }
};

globalThis.__radon_agent = agent;

export default agent;
