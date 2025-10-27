import { Disposable } from "vscode";
import { RNIDE_NetworkMethod, DebugSession } from "../debugging/DebugSession";
import { GetResponseBodyResponse } from "../network/types/network";
import {
  CDPMessage,
  NetworkMethod,
  NetworkType,
  NetworkEvent,
} from "../network/types/panelMessageProtocol";
import { EventDispatcher, EventDispatcherBase } from "./eventDispatcher";

export interface RadonNetworkBridgeEvents {
  enable: [];
  disable: [];
  Initiator: [];
  requestWillBeSent: [CDPMessage];
  requestWillBeSentExtraInfo: [CDPMessage];
  responseReceived: [CDPMessage];
  loadingFinished: [CDPMessage];
  loadingFailed: [CDPMessage];
  getResponseBody: [CDPMessage];
  dataReceived: [CDPMessage];
  storeResponseBody: [CDPMessage];
  jsDebuggerConnected: [];
  jsDebuggerDisconnected: [];
  unknownEvent: [any];
}

export type NetworkBridgeEventNames = keyof RadonNetworkBridgeEvents;

export const NETWORK_EVENT_MAP = {
  [NetworkMethod.Enable]: "enable",
  [NetworkMethod.Disable]: "disable",
  [NetworkMethod.GetResponseBody]: "getResponseBody",
  [NetworkMethod.StoreResponseBody]: "storeResponseBody",
  [NetworkType.Initiator]: "Initiator",
  [NetworkEvent.RequestWillBeSent]: "requestWillBeSent",
  [NetworkEvent.RequestWillBeSentExtraInfo]: "requestWillBeSentExtraInfo",
  [NetworkEvent.ResponseReceived]: "responseReceived",
  [NetworkEvent.LoadingFinished]: "loadingFinished",
  [NetworkEvent.LoadingFailed]: "loadingFailed",
  [NetworkEvent.DataReceived]: "dataReceived",
} as const;

export interface RadonNetworkBridge
  extends EventDispatcher<RadonNetworkBridgeEvents, NetworkBridgeEventNames> {
  enableNetworkInspector(): void;
  disableNetworkInspector(): void;
  getResponseBody(requestId: string | number): Promise<GetResponseBodyResponse | undefined>;
}

export type NetworkBridgeSendMethodArgs = Record<string, unknown>;
export type NetworkBridgeGetResponseBodyArgs = { requestId: string | number };

export class NetworkBridge
  extends EventDispatcherBase<RadonNetworkBridgeEvents, NetworkBridgeEventNames>
  implements RadonNetworkBridge
{
  private debugSession?: (DebugSession & Disposable) | undefined;
  private jsDebugSessionAvailable: boolean = false;

  public get bridgeAvailable(): boolean {
    return this.jsDebugSessionAvailable;
  }

  public setDebugSession(debugSession: DebugSession & Disposable) {
    this.debugSession = debugSession;

    this.debugSession.onJSDebugSessionStarted(() => {
      this.jsDebugSessionAvailable = true;
      this.emitEvent("jsDebuggerConnected", []);
    });

    this.debugSession.onDebugSessionTerminated(() => {
      this.jsDebugSessionAvailable = false;
      this.emitEvent("jsDebuggerDisconnected", []);
    });
  }

  public clearDebugSession() {
    this.debugSession = undefined;
    this.jsDebugSessionAvailable = false;
  }

  // Method overloads for type safety
  private send(request: RNIDE_NetworkMethod.Enable): void;
  private send(request: RNIDE_NetworkMethod.Disable): void;
  private send(request: RNIDE_NetworkMethod, args?: NetworkBridgeSendMethodArgs): void {
    this.debugSession?.invokeNetworkMethod(request, args);
  }

  private async sendAsync(
    request: RNIDE_NetworkMethod.GetResponseBody,
    args: NetworkBridgeGetResponseBodyArgs
  ): Promise<GetResponseBodyResponse | undefined> {
    const result = await this.debugSession?.invokeNetworkMethod<GetResponseBodyResponse>(
      request,
      args
    );
    return result;
  }

  public enableNetworkInspector(): void {
    if (!this.bridgeAvailable) {
      return;
    }
    this.send(RNIDE_NetworkMethod.Enable);
  }

  public disableNetworkInspector(): void {
    if (!this.bridgeAvailable) {
      return;
    }
    this.send(RNIDE_NetworkMethod.Disable);
  }

  public getResponseBody(requestId: string | number): Promise<GetResponseBodyResponse | undefined> {
    return this.sendAsync(RNIDE_NetworkMethod.GetResponseBody, { requestId });
  }
}
