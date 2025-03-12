import "./App.css";
import NetworkBar from "../components/NetworkBar";
import NetworkRequestsChart from "../components/NetworkTimeline";
import NetworkFilters from "../components/NetworkFilters";
import { useNetwork } from "../providers/NetworkProvider";

function App() {
  const { showFilter } = useNetwork();

  return (
    <main>
      <div className="panel-view">
        <div className="network-bar">
          <NetworkBar />
        </div>
        {showFilter && (
          <div className="network-filter">
            <NetworkFilters />
          </div>
        )}
        <NetworkRequestsChart />
      </div>
    </main>
  );
}

export default App;
