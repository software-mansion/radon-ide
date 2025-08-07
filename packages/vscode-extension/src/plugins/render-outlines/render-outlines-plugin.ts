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
import { InspectorAvailabilityStatus } from "../../common/Project";

const INSPECTOR_AVAILABILITY_MESSAGES = {
  [InspectorAvailabilityStatus.Available]: "",
  [InspectorAvailabilityStatus.UnavailableEdgeToEdge]:
    "Render Outlines is disabled in apps that don't support Edge-to-Edge",
  [InspectorAvailabilityStatus.UnavailableInactive]:
    "Render Outlines is disabled when the app is inactive",
} as const;

export class RenderOutlinesPlugin implements ToolPlugin, RenderOutlinesInterface, Disposable {
  private eventEmitter = new EventEmitter();
  private isEnabled = false;
  private devtoolsListeners: Disposable[] = [];
  private inspectorAvailability: InspectorAvailabilityStatus =
    InspectorAvailabilityStatus.Available;
  private wasPreviouslyEnabled = false;

  constructor(
    private inspectorBridge: RadonInspectorBridge,
    private onAvailabilityChange?: () => void
  ) {
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
    this.devtoolsListeners.push(
      this.inspectorBridge.onEvent(
        "inspectorAvailabilityChanged",
        (inspectorAvailability: InspectorAvailabilityStatus) => {
          this.inspectorAvailability = inspectorAvailability;

          if (inspectorAvailability === InspectorAvailabilityStatus.Available) {
            this.activateDueToAvailabilityChange();
          } else {
            this.deactivateDueToAvailabilityChange();
          }

          this.onAvailabilityChange?.();
        }
      )
    );
  }

  public readonly id = RENDER_OUTLINES_PLUGIN_ID;
  public readonly label = "Outline Renders";
  public readonly toolInstalled = true;
  public readonly persist = false;

  public get pluginAvailable() {
    return this.inspectorAvailability === InspectorAvailabilityStatus.Available;
  }

  public get pluginUnavailableTooltip() {
    return INSPECTOR_AVAILABILITY_MESSAGES[this.inspectorAvailability];
  }

  private activateDueToAvailabilityChange() {
    if (this.wasPreviouslyEnabled) {
      this.setEnabled(true);
    }
  }

  private deactivateDueToAvailabilityChange() {
    this.setEnabled(false);
  }

  activate(): void {
    this.setEnabled(true);
    this.wasPreviouslyEnabled = true;
  }

  deactivate(): void {
    this.setEnabled(false);
    this.wasPreviouslyEnabled = false;
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
