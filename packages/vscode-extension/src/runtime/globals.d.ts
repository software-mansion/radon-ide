export interface Agent {
  postMessage: (message: any) => void;
  onmessage: ((message: any) => void) | undefined;
}

declare global {
  var __radon_binding: (payload: string) => void;
  var __radon_dispatch: (message: any) => void;
  var __radon_agent: Agent;
}
