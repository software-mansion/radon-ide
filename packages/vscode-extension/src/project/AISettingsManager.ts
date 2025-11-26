import { Disposable, workspace } from "vscode";
import { StateManager } from "../project/StateManager";
import { RadonAISettings, RecursivePartial, State } from "../common/State";

export class AISettingsManager implements Disposable {
  private state: StateManager<RadonAISettings>;
  private configurationListenerDisposable: Disposable;

  private static getIsAIEnabled() {
    return workspace.getConfiguration("RadonIDE").get<boolean>("radonAI.enabledBoolean") ?? true;
  }

  private updateState(partialState: RecursivePartial<RadonAISettings>) {
    this.state.updateState(partialState);
  }

  constructor(stateManager: StateManager<State>) {
    this.state = stateManager.getDerived("workspaceConfiguration").getDerived("radonAI");

    const radonAiEnabled = AISettingsManager.getIsAIEnabled();
    this.updateState({
      enableRadonAI: radonAiEnabled,
    });

    this.configurationListenerDisposable = workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("RadonIDE.radonAI.enabledBoolean")) {
        const updatedRadonAiEnabled = AISettingsManager.getIsAIEnabled();
        this.updateState({
          enableRadonAI: updatedRadonAiEnabled,
        });
      }
    });
  }

  dispose() {
    this.configurationListenerDisposable.dispose();
  }
}
