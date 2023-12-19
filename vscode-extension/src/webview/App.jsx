import { vscode } from "./utilities/vscode";
import "./App.css";
import PreviewView from "./views/PreviewView";
import { useGlobalStateContext } from "./providers/GlobalStateProvider";
import { useDependencies } from "./providers/DependenciesProvider";
import PreviewSkeletonView from "./views/PreviewSkeletonView";

console.log = function (...args) {
  vscode.postMessage({
    command: "log",
    text: args.map((arg) => JSON.stringify(arg)).join(" "),
  });
};

function App() {
  const { state: globalState } = useGlobalStateContext();

  const { isReady: dependenciesReady } = useDependencies();
  const devicesReady = Boolean(globalState?.devices?.length);

  if (!(dependenciesReady && devicesReady)) {
    return (
      <main>
        <PreviewSkeletonView />
      </main>
    );
  }

  return (
    <main>
      <PreviewView initialDevice={globalState.devices[0]} />
    </main>
  );
}
export default App;
