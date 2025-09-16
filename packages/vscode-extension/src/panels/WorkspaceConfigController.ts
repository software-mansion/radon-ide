import _ from "lodash";
import { ConfigurationChangeEvent, workspace, Disposable } from "vscode";
import { getTelemetryReporter } from "../utilities/telemetry";
import { DeviceRotation, PanelLocation, WorkspaceConfiguration } from "../common/State";
import { StateManager } from "../project/StateManager";
import { disposeAll } from "../utilities/disposables";
import { updatePartialWorkspaceConfig } from "../utilities/updatePartialWorkspaceConfig";

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
      startDeviceOnLaunch: configuration.get<boolean>("startDeviceOnLaunch") ?? true,
      enableExperimentalInspector: configuration.get<boolean>("enableExperimentalInspector") ?? false,
    };

    this.stateManager.setState(workspaceConfig);

    this.disposables.push(workspace.onDidChangeConfiguration(this.onConfigurationChange));

    this.stateManager.onSetState(async (partialState) => {
      const partialStateEntries = Object.entries(partialState);

      const config = workspace.getConfiguration("RadonIDE");

      const currentWorkspaceConfig: WorkspaceConfiguration = {
        panelLocation: config.get<PanelLocation>("panelLocation")!,
        showDeviceFrame: config.get<boolean>("showDeviceFrame")!,
        stopPreviousDevices: config.get<boolean>("stopPreviousDevices")!,
        deviceRotation: config.get<DeviceRotation>("deviceRotation")!,
        inspectorExcludePattern: config.get<string>("inspectorExcludePattern") ?? null,
        defaultMultimediaSavingLocation:
          config.get<string>("defaultMultimediaSavingLocation") ?? null,
        startDeviceOnLaunch: config.get<boolean>("startDeviceOnLaunch") ?? true,
        enableExperimentalInspector: config.get<boolean>("enableExperimentalInspector") ?? false,
      };

      for (const partialStateEntry of partialStateEntries) {
        const updatedConfig = {
          ...currentWorkspaceConfig,
          [partialStateEntry[0]]: partialStateEntry[1],
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
      inspectorExcludePattern: config.get<string>("inspectorExcludePattern") ?? null,
      defaultMultimediaSavingLocation:
        config.get<string>("defaultMultimediaSavingLocation") ?? null,
      startDeviceOnLaunch: config.get<boolean>("startDeviceOnLaunch") ?? true,
      enableExperimentalInspector: config.get<boolean>("enableExperimentalInspector") ?? false,
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
