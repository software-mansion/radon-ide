import "./App.css";
import { useEffect, useRef, useState } from "react";
import NetworkBar from "../components/NetworkBar";
import NetworkFilters from "../components/NetworkFilters";
import useNetworkTracker, { NetworkLog } from "../hooks/useNetworkTracker";
import NetworkRequestLog from "../components/NetworkRequestLog";
import NetworkLogDetails from "../components/NetworkLogDetails";
import { useNetwork } from "../providers/NetworkProvider";

function App() {
  const parentRef = useRef<HTMLDivElement>(null);
  const networkLogs = useNetworkTracker();
  const { showFilter } = useNetwork();

  const [selectedNetworkLog, setSelectedNetworkLog] = useState<NetworkLog | null>(null);
  const [detailsWidth, setDetailsWidth] = useState(0);

  useEffect(() => {
    if (!selectedNetworkLog) {
      console.log("Resetting details width");
      setDetailsWidth(0);
    } else {
      setDetailsWidth(500);
    }
  }, [selectedNetworkLog]);

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
        {/* <NetworkRequestsChart /> */}
      </div>
      <div className="network-log-container" ref={parentRef}>
        <NetworkRequestLog
          selectedNetworkLog={selectedNetworkLog}
          networkLogs={networkLogs}
          detailsWidth={detailsWidth}
          handleSelectedRequest={(v) => setSelectedNetworkLog(v)}
        />

        {selectedNetworkLog && (
          <NetworkLogDetails
            parentRef={parentRef}
            networkLog={selectedNetworkLog}
            handleClose={() => setSelectedNetworkLog(null)}
            handleContainerSize={(width) => setDetailsWidth(width)}
          />
        )}
      </div>
    </main>
  );
}

export default App;
