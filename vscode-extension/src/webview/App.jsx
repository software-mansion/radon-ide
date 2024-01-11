import { vscode } from "./utilities/vscode";
import "./App.css";
import PreviewView from "./views/PreviewView";

console.log = function (...args) {
  vscode.postMessage({
    command: "log",
    text: args.map((arg) => JSON.stringify(arg)).join(" "),
  });
};

function App() {
  return (
    <main>
      <PreviewView />
    </main>
  );
}
export default App;
