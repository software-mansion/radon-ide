import "./App.css";
import PreviewView from "./views/PreviewView";
import { useDiagnosticAlert } from "./hooks/useDiagnosticAlert";

function App() {
  useDiagnosticAlert();

  return (
    <main>
      <PreviewView />
    </main>
  );
}
export default App;
