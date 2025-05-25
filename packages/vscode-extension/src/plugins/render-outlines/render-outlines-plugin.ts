import { EventEmitter } from "stream";
import { Disposable } from "vscode";
import {
  RENDER_OUTLINES_PLUGIN_ID,
  RenderOutlinesEventListener,
  RenderOutlinesEventMap,
  RenderOutlinesInterface,
} from "../../common/RenderOutlines";
import { RadonInspectorBridge } from "../../project/bridge";
import { ToolPlugin } from "../../project/tools";
import { disposeAll } from "../../utilities/disposables";

export class RenderOutlinesPlugin implements ToolPlugin, RenderOutlinesInterface, Disposable {
  private eventEmitter = new EventEmitter();
  private isEnabled = false;
  private devtoolsListeners: Disposable[] = [];

  constructor(private inspectorBridge: RadonInspectorBridge) {
    this.devtoolsListeners.push(
      this.inspectorBridge.onEvent("appReady", () => {
        this.setEnabled(this.isEnabled);
      })
    );
    this.devtoolsListeners.push(
      this.inspectorBridge.onEvent("pluginMessage", ({ pluginId, type, data }) => {
        if (pluginId === RENDER_OUTLINES_PLUGIN_ID && type === "rendersReported") {
          this.eventEmitter.emit("rendersReported", data);
        }
      })
    );
  }

  public readonly id = RENDER_OUTLINES_PLUGIN_ID;
  public readonly label = "Outline Renders";
  public readonly available = true;
  public readonly persist = false;

  activate(): void {
    this.setEnabled(true);
  }

  deactivate(): void {
    this.setEnabled(false);
  }

  dispose() {
    disposeAll(this.devtoolsListeners);
  }

  setEnabled(isEnabled: boolean) {
    this.isEnabled = isEnabled;
    this.inspectorBridge.sendPluginMessage(
      RENDER_OUTLINES_PLUGIN_ID,
      "updateInstrumentationOptions",
      {
        isEnabled,
      }
    );
  }

  addEventListener<K extends keyof RenderOutlinesEventMap>(
    type: K,
    listener: RenderOutlinesEventListener<RenderOutlinesEventMap[K]>
  ): void {
    this.eventEmitter.addListener(type, listener);
  }

  removeEventListener<K extends keyof RenderOutlinesEventMap>(
    type: K,
    listener: RenderOutlinesEventListener<RenderOutlinesEventMap[K]>
  ): void {
    this.eventEmitter.removeListener(type, listener);
  }
}
