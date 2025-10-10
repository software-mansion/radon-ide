import { EventEmitter } from "stream";
import { Disposable } from "vscode";
import {
  RENDER_OUTLINES_PLUGIN_ID,
  RenderOutlinesEventListener,
  RenderOutlinesEventMap,
  RenderOutlinesInterface,
} from "../../common/RenderOutlines";
import { RadonInspectorBridge } from "../../project/inspectorBridge";
import { ToolPlugin } from "../../project/tools";
import { disposeAll } from "../../utilities/disposables";
import { InspectorAvailabilityStatus, REMOVE, WorkspaceConfiguration } from "../../common/State";
import { StateManager } from "../../project/StateManager";

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
  private disposables: Disposable[] = [];
  private inspectorAvailability: InspectorAvailabilityStatus =
    InspectorAvailabilityStatus.Available;
  private experimentalEnable: boolean;
  private enableRequested = false;

  public readonly id = RENDER_OUTLINES_PLUGIN_ID;
  public readonly label = "Outline Renders";
  public readonly toolInstalled = true;
  public readonly persist = false;

  constructor(
    private inspectorBridge: RadonInspectorBridge,
    private onAvailabilityChange: () => void,
    private workspaceConfigState: StateManager<WorkspaceConfiguration>
  ) {
    this.experimentalEnable =
      workspaceConfigState.getState().general.enableExperimentalElementInspector;
    this.setupEventListeners();
  }

  /**
   * Sets up all event listeners for the plugin
   */
  private setupEventListeners(): void {
    const subscriptions = [
      this.inspectorBridge.onEvent("appReady", () => {
        this.setEnabled(this.isEnabled);
      }),

      this.inspectorBridge.onEvent("pluginMessage", ({ pluginId, type, data }) => {
        if (pluginId === RENDER_OUTLINES_PLUGIN_ID && type === "rendersReported") {
          this.eventEmitter.emit("rendersReported", data);
        }
      }),

      this.inspectorBridge.onEvent(
        "inspectorAvailabilityChanged",
        (inspectorAvailability: InspectorAvailabilityStatus) => {
          this.inspectorAvailability = inspectorAvailability;
          this.updatePluginState();
          this.onAvailabilityChange();
        }
      ),

      this.workspaceConfigState.onSetState((state) => {
        this.experimentalEnable =
          state.general !== REMOVE ? !!state.general?.enableExperimentalElementInspector : false;
        this.updatePluginState();
        this.onAvailabilityChange();
      }),
    ];

    this.disposables.push(...subscriptions);
  }

  private isPluginAvailable(): boolean {
    const isAvailable = this.inspectorAvailability === InspectorAvailabilityStatus.Available;
    const isAvailableExperimentally =
      this.inspectorAvailability === InspectorAvailabilityStatus.UnavailableEdgeToEdge &&
      this.experimentalEnable;

    return isAvailable || isAvailableExperimentally;
  }

  private updatePluginState(): void {
    if (this.isPluginAvailable() && this.enableRequested) {
      this.setEnabled(true);
    } else {
      this.setEnabled(false);
    }
  }

  public get pluginAvailable() {
    return this.isPluginAvailable();
  }

  public get pluginUnavailableTooltip() {
    return INSPECTOR_AVAILABILITY_MESSAGES[this.inspectorAvailability];
  }

  activate(): void {
    this.enableRequested = true;
    this.updatePluginState();
  }

  deactivate(): void {
    this.enableRequested = false;
    this.updatePluginState();
  }

  dispose() {
    disposeAll(this.disposables);
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
