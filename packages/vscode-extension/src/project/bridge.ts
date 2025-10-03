import { Disposable } from "vscode";
import { AppOrientation } from "../common/Project";
import { Logger } from "../Logger";
import { InspectorAvailabilityStatus, NavigationRoute } from "../common/State";
import { DebugSession, RNIDE_NetworkMethod } from "../debugging/DebugSession";
import {
  NetworkMethod,
  NetworkEvent,
  NetworkType,
  CDPMessage,
} from "../network/types/panelMessageProtocol";
import { GetResponseBodyResponse } from "../network/types/network";

type BridgeEventsMap<K extends string> = Record<K, unknown[]>;

/**
 * Abstract base class that provides an event-based bridging mechanism.
 *
 * This class manages event listeners keyed by event names and exposes:
 * - onEvent method to register listeners,
 * - emitEvent method to invoke listeners,
 * - abstract send method that subclasses must implement to forward messages externally
 *
 * @template E - Map of event names to listener-argument tuples (e.g. { foo: [number, string] }).
 * @template K - Union of string literal event names (keys of E).
 */
abstract class GenericBridge<E extends BridgeEventsMap<K>, K extends string> {
  private listeners = new Map<K, Array<(...payload: any) => void>>();

  protected abstract send(message: any): void;

  public emitEvent<L extends K>(event: L, payload: E[L]) {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      return;
    }

    // We need to clone the listeners array to avoid issues with concurrent modifications
    // it is a common pattern to create listeners that dispose themselves which could lead to
    // issues if we modify the array while iterating over it.
    const listenersCopy = [...listeners];
    listenersCopy.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        Logger.error(`[Bridge] Error in listener for event ${String(event)}:`, error);
      }
    });
  }

  public onEvent<L extends K>(event: L, listener: (...payload: E[L]) => void): Disposable {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      this.listeners.set(event, [listener]);
    } else {
      const index = listeners.indexOf(listener);
      if (index === -1) {
        listeners.push(listener as (...payload: any) => void);
      }
    }
    return {
      dispose: () => {
        const listenersToClean = this.listeners.get(event);
        if (listenersToClean) {
          const index = listenersToClean.indexOf(listener as (...payload: any) => void);
          if (index !== -1) {
            listenersToClean.splice(index, 1);
          }
        }
      },
    };
  }
}

// --- InspectorBridge ---

export interface RadonInspectorBridgeEvents {
  appReady: [];
  connected: [];
  disconnected: [];
  navigationChanged: [{ displayName: string; id: string; canGoBack: boolean }];
  navigationRouteListUpdated: [NavigationRoute[]];
  fastRefreshStarted: [];
  fastRefreshComplete: [];
  openPreviewResult: [{ previewId: string; error?: string }];
  inspectData: [{ id: number }];
  devtoolPluginsChanged: [{ plugins: string[] }];
  pluginMessage: [{ pluginId: string; type: string; data: any }];
  isProfilingReact: [boolean];
  appOrientationChanged: [AppOrientation];
  inspectorAvailabilityChanged: [InspectorAvailabilityStatus];
}

export type RadonInspectorEventName = keyof RadonInspectorBridgeEvents;

export interface RadonInspectorBridge {
  sendPluginMessage(pluginId: string, type: string, data: any): void;
  sendInspectRequest(x: number, y: number, id: number, requestStack: boolean): void;
  sendOpenNavigationRequest(id: string): void;
  sendOpenPreviewRequest(previewId: string): void;
  sendShowStorybookStoryRequest(componentTitle: string, storyName: string): void;
  onEvent<K extends RadonInspectorEventName>(
    event: K,
    listener: (...payload: RadonInspectorBridgeEvents[K]) => void
  ): Disposable;
}

export abstract class BaseInspectorBridge
  extends GenericBridge<RadonInspectorBridgeEvents, RadonInspectorEventName>
  implements RadonInspectorBridge
{
  sendPluginMessage(pluginId: string, type: string, data: any): void {
    this.send({
      type: "pluginMessage",
      data: { pluginId, type, data },
    });
  }

  sendInspectRequest(x: number, y: number, id: number, requestStack: boolean): void {
    this.send({
      type: "inspect",
      data: { x, y, id, requestStack },
    });
  }

  sendOpenNavigationRequest(id: string): void {
    this.send({
      type: "openNavigation",
      data: { id },
    });
  }

  sendOpenPreviewRequest(previewId: string): void {
    this.send({
      type: "openPreview",
      data: { previewId },
    });
  }

  sendShowStorybookStoryRequest(componentTitle: string, storyName: string): void {
    this.send({
      type: "showStorybookStory",
      data: { componentTitle, storyName },
    });
  }
}

// --- NetworkBridge ---

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

export interface RadonNetworkBridge {
  enableNetworkInspector(): void;
  disableNetworkInspector(): void;
  getResponseBody(requestId: string | number): Promise<GetResponseBodyResponse | undefined>;
  onEvent<K extends NetworkBridgeEventNames>(
    event: K,
    listener: (...payload: RadonNetworkBridgeEvents[K]) => void
  ): Disposable;
}

export type NetworkBridgeSendMethodArgs = Record<string, unknown>;
export type NetworkBridgeGetResponseBodyArgs = { requestId: string | number };

export class NetworkBridge
  extends GenericBridge<RadonNetworkBridgeEvents, NetworkBridgeEventNames>
  implements RadonNetworkBridge
{
  private debugSession?: (DebugSession & Disposable) | undefined;

  public get bridgeAvailable(): boolean {
    return !!this.debugSession;
  }

  public setDebugSession(debugSession: DebugSession & Disposable) {
    this.debugSession = debugSession;
  }

  // Method overloads for type safety
  protected send(request: RNIDE_NetworkMethod.Enable): void;
  protected send(request: RNIDE_NetworkMethod.Disable): void;
  protected send(request: RNIDE_NetworkMethod, args?: NetworkBridgeSendMethodArgs): void {
    this.debugSession?.invokeNetworkMethod(request, args);
  }

  protected async sendAsync(
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
