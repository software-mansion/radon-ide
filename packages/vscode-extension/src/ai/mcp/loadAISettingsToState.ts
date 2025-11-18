import { Disposable, workspace } from "vscode";
import { StateManager } from "../../project/StateManager";
import { State } from "../../common/State";

function isRadonEnabledInSettings() {
  return workspace.getConfiguration("RadonIDE").get<boolean>("radonAI.enabledBoolean") ?? true;
}

export default function loadAISettingsToState(stateManager: StateManager<State>): Disposable {
  const radonAiEnabled = isRadonEnabledInSettings();
  stateManager.updateState({
    workspaceConfiguration: {
      general: {
        enableRadonAI: radonAiEnabled,
      },
    },
  });

  return workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("RadonIDE.radonAI.enabledBoolean")) {
      const updatedRadonAiEnabled = isRadonEnabledInSettings();
      stateManager.updateState({
        workspaceConfiguration: {
          general: {
            enableRadonAI: updatedRadonAiEnabled,
          },
        },
      });
    }
  });
}
