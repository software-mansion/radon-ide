import { Disposable, workspace } from "vscode";
import { StateManager } from "../../project/StateManager";
import { State } from "../../common/State";
import { isRadonEnabledInSettings } from "./utils";

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
