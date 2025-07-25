import { ConfigurationChangeEvent, workspace, Disposable } from "vscode";
import { getTelemetryReporter } from "../utilities/telemetry";
import { PanelLocation, WorkspaceConfiguration } from "../common/State";
import { StateManager } from "../project/StateManager";
import { disposeAll } from "../utilities/disposables";
import { DeviceRotationType } from "../common/Project";

export class WorkspaceConfigController implements Disposable {
  private disposables: Disposable[] = [];

  constructor(private stateManager: StateManager<WorkspaceConfiguration>) {
    const configuration = workspace.getConfiguration("RadonIDE");
    const workspaceConfig = {
      panelLocation: configuration.get<PanelLocation>("panelLocation")!,
      showDeviceFrame: configuration.get<boolean>("showDeviceFrame")!,
      stopPreviousDevices: configuration.get<boolean>("stopPreviousDevices")!,
      deviceRotation: configuration.get<DeviceRotationType>("deviceRotation")!,
    };

    this.stateManager.setState(workspaceConfig);

    this.disposables.push(workspace.onDidChangeConfiguration(this.onConfigurationChange));

    this.stateManager.onSetState(async (partialState) => {
      const partialStateEntries = Object.entries(partialState);

      const config = workspace.getConfiguration("RadonIDE");

      for (const partialStateEntry of partialStateEntries) {
        if (config.inspect(partialStateEntry[0] as string)?.workspaceValue) {
          await config.update(partialStateEntry[0] as string, partialStateEntry[1], false);
        } else {
          await config.update(partialStateEntry[0] as string, partialStateEntry[1], true);
        }
      }
    });

    this.disposables.push(this.stateManager);
  }

  private onConfigurationChange = (event: ConfigurationChangeEvent) => {
    if (!event.affectsConfiguration("RadonIDE")) {
      return;
    }
    const config = workspace.getConfiguration("RadonIDE");

    const newConfig = {
      panelLocation: config.get<PanelLocation>("panelLocation")!,
      showDeviceFrame: config.get<boolean>("showDeviceFrame")!,
      stopPreviousDevices: config.get<boolean>("stopPreviousDevices")!,
      deviceRotation: config.get<DeviceRotationType>("deviceRotation")!,
    };

    const oldConfig = this.stateManager.getState();

    if (newConfig.panelLocation !== oldConfig.panelLocation) {
      getTelemetryReporter().sendTelemetryEvent("workspace-configuration:panel-location-changed", {
        newPanelLocation: newConfig.panelLocation,
      });
    }

    if (newConfig.showDeviceFrame !== oldConfig.showDeviceFrame) {
      getTelemetryReporter().sendTelemetryEvent(
        "workspace-configuration:show-device-frame-changed",
        { showDeviceFrame: String(newConfig.showDeviceFrame) }
      );
    }

    this.stateManager.setState(newConfig);
  };

  dispose() {
    disposeAll(this.disposables);
  }
}
