import { vscode } from "./utilities/vscode";
import { VSCodePanels, VSCodePanelTab, VSCodePanelView } from "@vscode/webview-ui-toolkit/react";
import "./App.css";
import PreviewView from "./views/PreviewView";
import DiagnosticView from "./views/DiagnosticView";
import { useEffect, useState } from "react";
import AndroidImagesView from "./views/AndroidImagesView";
import GlobalStateProvider from "./components/GlobalStateContext";

console.log = function (...args) {
  vscode.postMessage({
    command: "log",
    text: args.map((arg) => JSON.stringify(arg)).join(" "),
  });
};

const EMULATOR_TAB_ID = "tab-1";
const SETTINGS_TAB_ID = "tab-2";
const ANDROID_IMAGES_TAB_ID = "tab-3";

function App() {
  const [emulatorDisabled, setEmulatorDisabled] = useState(true);
  const [projectStarted, setProjectStarted] = useState(false);

  useEffect(() => {
    if (!emulatorDisabled && !projectStarted) {
      setProjectStarted(true);
      vscode.postMessage({
        command: "startProject",
      });
    }
  }, [emulatorDisabled, projectStarted]);

  return (
    <main>
      <GlobalStateProvider>
        <VSCodePanels
          className="panels"
          aria-label="Default"
          activeid={emulatorDisabled ? SETTINGS_TAB_ID : EMULATOR_TAB_ID}>
          <VSCodePanelTab disabled={emulatorDisabled} id="tab-1">
            EMULATOR
          </VSCodePanelTab>
          <VSCodePanelTab id="tab-2">SETTINGS</VSCodePanelTab>
          <VSCodePanelTab disabled={emulatorDisabled} id="tab-3">
            ANDROID IMAGES
          </VSCodePanelTab>
          <VSCodePanelView className="tab-view" id={EMULATOR_TAB_ID}>
            {projectStarted && <PreviewView />}
          </VSCodePanelView>
          <VSCodePanelView className="tab-view" id={SETTINGS_TAB_ID}>
            <DiagnosticView setEmulatorDisabled={setEmulatorDisabled} />
          </VSCodePanelView>
          <VSCodePanelView className="tab-view" id={ANDROID_IMAGES_TAB_ID}>
            <AndroidImagesView />
          </VSCodePanelView>
        </VSCodePanels>
      </GlobalStateProvider>
    </main>
  );
}
export default App;
