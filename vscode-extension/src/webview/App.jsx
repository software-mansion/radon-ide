import { vscode } from "./utilities/vscode";
import { VSCodePanels, VSCodePanelTab, VSCodePanelView } from "@vscode/webview-ui-toolkit/react";
import "./App.css";
import PreviewView from "./views/PreviewView";
import DiagnosticView from "./views/DiagnosticView";
import { useEffect, useState } from "react";
import AndroidImagesView from "./views/AndroidImagesView";
import { useGlobalStateContext } from "./components/GlobalStateContext";
import InternalErrorView from "./views/InternalErrorView";

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
  const [previewDisabled, setPreviewDisabled] = useState(true);
  const [projectStarted, setProjectStarted] = useState(false);
  const [unhandledError, setUnhandledError] = useState(undefined);
  const { state: globalState } = useGlobalStateContext();

  useEffect(() => {
    if (!previewDisabled && !projectStarted && !!globalState?.devices?.length) {
      setProjectStarted(true);
    }
  }, [previewDisabled, projectStarted, globalState]);

  useEffect(() => {
    const listener = (event) => {
      const message = event.data;
      switch (message.command) {
        case "unhandledError":
          setUnhandledError(message.error);
          break;
      }
    };

    window.addEventListener("message", listener);

    return () => window.removeEventListener("message", listener);
  }, []);

  if (unhandledError) {
    return <InternalErrorView />;
  }

  return (
    <main>
      <VSCodePanels
        className="panels"
        aria-label="Default"
        activeid={previewDisabled ? SETTINGS_TAB_ID : EMULATOR_TAB_ID}>
        <VSCodePanelTab disabled={previewDisabled} id="tab-1">
          EMULATOR
        </VSCodePanelTab>
        <VSCodePanelTab id="tab-2">SETTINGZ</VSCodePanelTab>
        <VSCodePanelTab disabled={previewDisabled} id="tab-3">
          ANDROID IMAGES
        </VSCodePanelTab>
        <VSCodePanelView className="tab-view" id={EMULATOR_TAB_ID}>
          {projectStarted && <PreviewView initialDevice={globalState.devices[0]} />}
        </VSCodePanelView>
        <VSCodePanelView className="tab-view" id={SETTINGS_TAB_ID}>
          <DiagnosticView setProjectStarted={setPreviewDisabled} />
        </VSCodePanelView>
        <VSCodePanelView className="tab-view" id={ANDROID_IMAGES_TAB_ID}>
          <AndroidImagesView />
        </VSCodePanelView>
      </VSCodePanels>
    </main>
  );
}
export default App;
