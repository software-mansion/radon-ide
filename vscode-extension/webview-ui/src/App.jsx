import { vscode } from "./utilities/vscode";
import { VSCodePanels, VSCodePanelTab, VSCodePanelView } from "@vscode/webview-ui-toolkit/react";
import "./App.css";
import PreviewView from "./views/PreviewView";
import SettingsView from "./views/SettingsView";

console.log = function (...args) {
  vscode.postMessage({
    command: "log",
    text: args.map((arg) => JSON.stringify(arg)).join(" "),
  });
};

function App() {
  return (
    <main>
      <VSCodePanels className="panels" aria-label="Default">
        <VSCodePanelTab id="tab-1">EMULATOR</VSCodePanelTab>
        <VSCodePanelTab id="tab-2">SETTINGS</VSCodePanelTab>
        <VSCodePanelView className="tab-view" id="tab-view-1">
          <PreviewView />
        </VSCodePanelView>
        <VSCodePanelView className="tab-view" id="tab-view-2">
          <SettingsView />
        </VSCodePanelView>
      </VSCodePanels>
    </main>
  );
}
export default App;
