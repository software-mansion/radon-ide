import "./View.css";
import "./SettingsView.css";
import { useEffect, useState } from "react";
import { vscode } from "../utilities/vscode";
import { VSCodeButton, VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react";
import DependenciesList from "../components/DependenciesList";

function checkIfAllDependenciesInstalled(dependencies) {
  return Object.values(dependencies).every((installed) => installed);
}

function SettingsView({ setEmulatorDisabled }) {
  const [dependencies, setDependencies] = useState(null);
  const [iosDepsInstalling, setIosDepsInstalling] = useState(false);

  useEffect(() => {
    const listener = (event) => {
      const message = event.data;
      switch (message.command) {
        case "checkedDependencies":
          setDependencies(message.dependencies);
          setEmulatorDisabled(!checkIfAllDependenciesInstalled(message.dependencies));
          break;
        case "installationComplete":
          setIosDepsInstalling(false);
          break;
      }
    };

    window.addEventListener("message", listener);

    vscode.postMessage({
      command: "handlePrerequisites",
    });

    return () => window.removeEventListener("message", listener);
  }, []);

  const dependenciesLoading = !dependencies;

  if (dependenciesLoading)
    return (
      <div className="panel-view loading-container">
        <VSCodeProgressRing />
      </div>
    );

  return (
    <div className="panel-view">
      <div className="button-container">
        <VSCodeButton
          title="Check dependencies"
          appearance="secondary"
          disabled={dependenciesLoading}
          onClick={() =>
            vscode.postMessage({
              command: "refreshDependencies",
            })
          }>
          <span className="codicon codicon-refresh" />
        </VSCodeButton>
      </div>

      <DependenciesList
        dependencies={dependencies}
        iosDepsInstalling={iosDepsInstalling}
        setIosDepsInstalling={setIosDepsInstalling}
      />
    </div>
  );
}

export default SettingsView;
