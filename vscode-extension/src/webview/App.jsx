import { vscode } from "./utilities/vscode";
import "./App.css";
import PreviewView from "./views/PreviewView";
import { useDependencies } from "./providers/DependenciesProvider";
import PreviewSkeletonView from "./views/PreviewSkeletonView";

console.log = function (...args) {
  vscode.postMessage({
    command: "log",
    text: args.map((arg) => JSON.stringify(arg)).join(" "),
  });
};

function App() {
  const { isReady: dependenciesReady } = useDependencies();

  if (!dependenciesReady) {
    return (
      <main>
        <PreviewSkeletonView />
      </main>
    );
  }

  return (
    <main>
      <PreviewView />
    </main>
  );
}
export default App;
