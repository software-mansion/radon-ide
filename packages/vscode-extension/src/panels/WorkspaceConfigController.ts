import _ from "lodash";
import { ConfigurationChangeEvent, workspace, Disposable } from "vscode";
import { getTelemetryReporter } from "../utilities/telemetry";
import { WorkspaceConfiguration } from "../common/State";
import { StateManager } from "../project/StateManager";
import { disposeAll } from "../utilities/disposables";
import {
  getCurrentWorkspaceConfiguration,
  updateWorkspaceConfig,
} from "../utilities/workspaceConfiguration";
import {
  merge,
  mergeAndCalculateChanges,
  splitRecursivePartialToSingleLeaves,
} from "../common/Merge";

export class WorkspaceConfigController implements Disposable {
  private disposables: Disposable[] = [];
  private workspaceConfigurationUpdatesToIgnore: WorkspaceConfiguration[] = [];

  constructor(private stateManager: StateManager<WorkspaceConfiguration>) {
    const configuration = workspace.getConfiguration("RadonIDE");

    const workspaceConfig = getCurrentWorkspaceConfiguration(configuration);

    this.stateManager.updateState(workspaceConfig);

    this.disposables.push(workspace.onDidChangeConfiguration(this.onConfigurationChange));

    this.stateManager.onSetState(async (partialState) => {
      const config = workspace.getConfiguration("RadonIDE");

      const currentWorkspaceConfig: WorkspaceConfiguration =
        getCurrentWorkspaceConfiguration(config);

      const [_result, changes] = mergeAndCalculateChanges(currentWorkspaceConfig, partialState);
      const singleChangesArray = splitRecursivePartialToSingleLeaves(changes);

      for (const singleChange of singleChangesArray) {
        const updatedConfig = merge(currentWorkspaceConfig, singleChange);

        const shouldSkipUpdate = _.isEqual(updatedConfig, currentWorkspaceConfig);
        if (shouldSkipUpdate) {
          continue;
        }

        this.workspaceConfigurationUpdatesToIgnore.push(updatedConfig);

        await updateWorkspaceConfig(config, currentWorkspaceConfig, singleChange);
      }
    });

    this.disposables.push(this.stateManager);
  }

  private onConfigurationChange = (event: ConfigurationChangeEvent) => {
    if (!event.affectsConfiguration("RadonIDE")) {
      return;
    }
    const config = workspace.getConfiguration("RadonIDE");

    const newConfig = getCurrentWorkspaceConfiguration(config);

    const index = this.workspaceConfigurationUpdatesToIgnore.findIndex((cfg) =>
      _.isEqual(cfg, newConfig)
    );
    const shouldIgnoreUpdate = index !== -1;
    if (shouldIgnoreUpdate) {
      this.workspaceConfigurationUpdatesToIgnore.splice(index, 1);
      return;
    }

    const oldConfig = this.stateManager.getState();

    if (newConfig.userInterface.panelLocation !== oldConfig.userInterface.panelLocation) {
      getTelemetryReporter().sendTelemetryEvent("workspace-configuration:panel-location-changed", {
        newPanelLocation: newConfig.userInterface.panelLocation,
      });
    }

    if (newConfig.userInterface.showDeviceFrame !== oldConfig.userInterface.showDeviceFrame) {
      getTelemetryReporter().sendTelemetryEvent(
        "workspace-configuration:show-device-frame-changed",
        { showDeviceFrame: String(newConfig.userInterface.showDeviceFrame) }
      );
    }

    this.stateManager.updateState(newConfig);
  };

  dispose() {
    disposeAll(this.disposables);
  }
}
