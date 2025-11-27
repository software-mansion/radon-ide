import { Disposable, workspace } from "vscode";
import { StateManager } from "../project/StateManager";
import { State } from "../common/State";

export class AISettingsManager implements Disposable {
  private configurationListenerDisposable: Disposable;

  private static getIsAIEnabled() {
    return workspace.getConfiguration("RadonIDE").get<boolean>("radonAI.enabledBoolean") ?? true;
  }

  constructor(stateManager: StateManager<State>) {
    this.configurationListenerDisposable = workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("RadonIDE.radonAI.enabledBoolean")) {
        stateManager.updateState({
          workspaceConfiguration: {
            radonAI: {
              enableRadonAI: AISettingsManager.getIsAIEnabled(),
            },
          },
        });
      }
    });
  }

  dispose() {
    this.configurationListenerDisposable.dispose();
  }
}
