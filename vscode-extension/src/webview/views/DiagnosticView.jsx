import "./View.css";
import "./DiagnosticView.css";
import { vscode } from "../utilities/vscode";
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react";
import DependenciesList from "../components/DependenciesList";

function DiagnosticView() {
  return (
    <div className="panel-view">
      <div className="button-container">
        <VSCodeButton
          title="Check dependencies"
          appearance="secondary"
          onClick={() => {
            setLoading(true);
            vscode.postMessage({
              command: "refreshDependencies",
            });
          }}>
          <span className="codicon codicon-refresh" />
        </VSCodeButton>
      </div>

      <DependenciesList />
    </div>
  );
}

export default DiagnosticView;
