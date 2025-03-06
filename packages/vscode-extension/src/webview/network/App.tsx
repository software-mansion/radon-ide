import "./App.css";
import NetworkBar from "../components/NetworkBar";
import NetworkRequestsChart from "../components/NetworkTimeline";
import NetworkFilters from "../components/NetworkFilters";

function App() {
  return (
    <main>
      <div className="panel-view">
        <div className="button-group-top">
          <NetworkBar />
          <NetworkFilters />
        </div>
        <NetworkRequestsChart />
      </div>
    </main>
  );
}

export default App;
