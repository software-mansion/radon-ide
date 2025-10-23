import { AppOrientation } from "../common/Project";
import { InspectorAvailabilityStatus, NavigationRoute } from "../common/State";
import { EventDispatcherBase, EventDispatcher } from "./eventDispatcher";

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

export interface RadonInspectorBridge
  extends EventDispatcher<RadonInspectorBridgeEvents, RadonInspectorEventName> {
  sendPluginMessage(pluginId: string, type: string, data: any): void;
  sendInspectRequest(x: number, y: number, id: number, requestStack: boolean): void;
  sendOpenNavigationRequest(id: string): void;
  sendOpenPreviewRequest(previewId: string): void;
  sendShowStorybookStoryRequest(componentTitle: string, storyName: string): void;
}

export abstract class InspectorBridge
  extends EventDispatcherBase<RadonInspectorBridgeEvents, RadonInspectorEventName>
  implements RadonInspectorBridge
{
  protected abstract send(message: { type: string; data?: any }): void;
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
