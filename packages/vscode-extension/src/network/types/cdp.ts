export enum WebviewCommand {
  CDPCall = "cdp-call",
}

export enum CDPNetworkCommand {
  Enable = "Network.enable",
  Disable = "Network.disable",
  GetResponseBody = "Network.getResponseBody",
  Initiator = "Network.Initiator",
}

export interface WebviewCDPMessage {
  command: WebviewCommand.CDPCall;
  method: string;
  params: Record<string, unknown>;
  id: string;
}
