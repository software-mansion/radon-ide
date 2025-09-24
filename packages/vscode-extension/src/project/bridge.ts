import { Disposable } from "vscode";
import { AppOrientation } from "../common/Project";
import { Logger } from "../Logger";
import { InspectorAvailabilityStatus, NavigationRoute } from "../common/State";
import { DebugSession, DebugNetworkEvent } from "../debugging/DebugSession";

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
  navigationChanged: [{ displayName: string; id: string }];
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

export enum NetworkCommandMethod {
  Enable = "Network.enable",
  Disable = "Network.disable",
  RuntimeEnable = "Runtime.enable",
  RequestWillBeSent = "Network.requestWillBeSent",
  RequestWillBeSentExtraInfo = "Network.requestWillBeSentExtraInfo",
  ResponseReceived = "Network.responseReceived",
  LoadingFinished = "Network.loadingFinished",
}

export interface RadonNetworkBridgeEvents {
  enable: [];
  disable: [];
  runtimeEnable: [];
  requestWillBeSent: [{ data: any }];
  requestWillBeSentExtraInfo: [{ data: any }];
  responseReceived: [{ data: any }];
  loadingFinished: [{ data: any }];
}

export type NetworkEventNames = keyof RadonNetworkBridgeEvents;

export const NETWORK_EVENT_MAP = {
  [NetworkCommandMethod.Enable]: "enable",
  [NetworkCommandMethod.Disable]: "disable",
  [NetworkCommandMethod.RuntimeEnable]: "runtimeEnable",
  [NetworkCommandMethod.RequestWillBeSent]: "requestWillBeSent",
  [NetworkCommandMethod.RequestWillBeSentExtraInfo]: "requestWillBeSentExtraInfo",
  [NetworkCommandMethod.ResponseReceived]: "responseReceived",
  [NetworkCommandMethod.LoadingFinished]: "loadingFinished",
} as const;

export interface RadonNetworkBridge {
  enableNetworkInspector(): void;
  disableNetworkInspector(): void;
  onEvent<K extends NetworkEventNames>(
    event: K,
    listener: (...payload: RadonNetworkBridgeEvents[K]) => void
  ): Disposable;
}

export class NetworkInspectorBridge
  extends GenericBridge<RadonNetworkBridgeEvents, NetworkEventNames>
  implements RadonNetworkBridge
{
  private debugSession?: (DebugSession & Disposable) | undefined;

  public get bridgeAvailable(): boolean {
    return !!this.debugSession;
  }

  public setDebugSession(debugSession: DebugSession & Disposable) {
    this.debugSession = debugSession;
  }

  protected send(request: DebugNetworkEvent): void {
    this.debugSession?.sendNetworkCommandRequest(request);
  }

  public enableNetworkInspector(): void {
    if (!this.bridgeAvailable) {
      return;
    }
    this.send(DebugNetworkEvent.Enable);
    this.emitEvent("enable", []);
  }

  public disableNetworkInspector(): void {
    if (!this.bridgeAvailable) {
      return;
    }
    this.send(DebugNetworkEvent.Disable);
    this.emitEvent("disable", []);
  }
}
