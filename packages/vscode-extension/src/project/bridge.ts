import { Disposable } from "vscode";
import { AppOrientation, NavigationRoute } from "../common/Project";
import { Logger } from "../Logger";
import { InspectorAvailabilityStatus } from "../common/State";

export interface RadonInspectorBridgeEvents {
  appReady: [];
  navigationChanged: [{ displayName: string; id: string }];
  navigationRouteListUpdated: [NavigationRoute[]];
  fastRefreshStarted: [];
  fastRefreshComplete: [];
  openPreviewResult: [{ previewId: string; error?: string }];
  inspectData: [{ id: number }];
  devtoolPluginsChanged: [{ plugins: string[] }];
  pluginMessage: [{ pluginId: string; type: string; data: any }];
  appOrientationChanged: [AppOrientation];
  inspectorAvailabilityChanged: [InspectorAvailabilityStatus];
}

export interface RadonInspectorBridge {
  sendPluginMessage(pluginId: string, type: string, data: any): void;
  sendInspectRequest(x: number, y: number, id: number, requestStack: boolean): void;
  sendOpenNavigationRequest(id: string): void;
  sendOpenPreviewRequest(previewId: string): void;
  sendShowStorybookStoryRequest(componentTitle: string, storyName: string): void;
  emitInspectorAvailabilityUpdate(status: InspectorAvailabilityStatus): void;
  onEvent<K extends keyof RadonInspectorBridgeEvents>(
    event: K,
    listener: (...payload: RadonInspectorBridgeEvents[K]) => void
  ): Disposable;
}

export type RadonInspectorEventName = keyof RadonInspectorBridgeEvents;

export abstract class BaseInspectorBridge implements RadonInspectorBridge {
  private listeners: Map<keyof RadonInspectorBridgeEvents, Array<(...payload: any) => void>> =
    new Map();

  protected abstract send(message: any): void;

  public emitEvent<K extends RadonInspectorEventName>(
    event: K,
    payload: RadonInspectorBridgeEvents[K]
  ) {
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
        Logger.error(`[Inspector Bridge] Error in listener for event ${event}:`, error);
      }
    });
  }

  onEvent<K extends keyof RadonInspectorBridgeEvents>(
    event: K,
    listener: (...payload: RadonInspectorBridgeEvents[K]) => void
  ): Disposable {
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

  emitInspectorAvailabilityUpdate(status: InspectorAvailabilityStatus): void {
    //@ts-ignore - FIXME, consider how to type this properly, as
    // all the events through inspector-bridge are sent as a single argument
    // (see ConnectionSession.ts or devtools.ts emitEvent calls - the data is typed as an array or any
    // but sent argument is value, not an array). Despite that, emitEvent expects the array, 
    // which comes from RadonInspectorBridgeEvents.
    this.emitEvent("inspectorAvailabilityChanged", status);
  }
}
