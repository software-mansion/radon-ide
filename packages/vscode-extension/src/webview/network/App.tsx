import "./App.css";
import NetworkBar from "../components/NetworkBar";
import NetworkFilters from "../components/NetworkFilters";
import useNetworkTracker from "../hooks/useNetworkTracker";

function App() {
  const networkLogs = useNetworkTracker();

  console.log("networkLogs", networkLogs);

  return (
    <main>
      <div className="panel-view">
        <div className="button-group-top">
          <NetworkBar />
          <NetworkFilters />
        </div>
      </div>
    </main>
  );
}

export default App;
