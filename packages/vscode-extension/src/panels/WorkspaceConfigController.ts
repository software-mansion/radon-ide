import _ from "lodash";
import { ConfigurationChangeEvent, workspace, Disposable } from "vscode";
import { getTelemetryReporter } from "../utilities/telemetry";
import { PanelLocation, WorkspaceConfiguration } from "../common/State";
import { StateManager } from "../project/StateManager";
import { disposeAll } from "../utilities/disposables";
import { DeviceRotation } from "../common/Project";
import { updatePartialWorkspaceConfig } from "../utilities/updatePartialWorkspaceConfig";
import { Logger } from "../Logger";

export class WorkspaceConfigController implements Disposable {
  private disposables: Disposable[] = [];
  private workspaceConfigurationUpdatesToIgnore: WorkspaceConfiguration[] = [];

  constructor(private stateManager: StateManager<WorkspaceConfiguration>) {
    const configuration = workspace.getConfiguration("RadonIDE");
    const workspaceConfig = {
      panelLocation: configuration.get<PanelLocation>("panelLocation")!,
      showDeviceFrame: configuration.get<boolean>("showDeviceFrame")!,
      stopPreviousDevices: configuration.get<boolean>("stopPreviousDevices")!,
      deviceRotation: configuration.get<DeviceRotation>("deviceRotation")!,
    };

    this.stateManager.setState(workspaceConfig);

    this.disposables.push(workspace.onDidChangeConfiguration(this.onConfigurationChange));

    this.stateManager.onSetState(async (partialState) => {
      const partialStateEntries = Object.entries(partialState);

      const config = workspace.getConfiguration("RadonIDE");

      const currentWorkspaceConfig = {
        panelLocation: config.get<PanelLocation>("panelLocation")!,
        showDeviceFrame: config.get<boolean>("showDeviceFrame")!,
        stopPreviousDevices: config.get<boolean>("stopPreviousDevices")!,
        deviceRotation: config.get<DeviceRotation>("deviceRotation")!,
      };

      for (const partialStateEntry of partialStateEntries) {
        const updatedConfig = {
          [partialStateEntry[0]]: partialStateEntry[1],
          ...currentWorkspaceConfig,
        };

        const shouldSkipUpdate = _.isEqual(updatedConfig, currentWorkspaceConfig);
        if (shouldSkipUpdate) {
          continue;
        }

        this.workspaceConfigurationUpdatesToIgnore.push(updatedConfig);
        await updatePartialWorkspaceConfig(config, partialStateEntry);
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
      deviceRotation: config.get<DeviceRotation>("deviceRotation")!,
    };

    const index = this.workspaceConfigurationUpdatesToIgnore.findIndex((cfg) =>
      _.isEqual(cfg, newConfig)
    );
    const shouldIgnoreUpdate = index !== -1;
    if (shouldIgnoreUpdate) {
      this.workspaceConfigurationUpdatesToIgnore.splice(index, 1);
      return;
    }

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
