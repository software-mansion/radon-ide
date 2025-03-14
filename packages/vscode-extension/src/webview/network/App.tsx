import "./App.css";
import { useEffect, useRef, useState } from "react";
import NetworkBar from "../components/NetworkBar";
import NetworkFilters from "../components/NetworkFilters";
import { NetworkLog } from "../hooks/useNetworkTracker";
import NetworkRequestLog from "../components/NetworkRequestLog";
import NetworkLogDetails from "../components/NetworkLogDetails";
import { useNetwork } from "../providers/NetworkProvider";
import NetworkTimeline from "../components/NetworkTimeline";

function App() {
  const parentRef = useRef<HTMLDivElement>(null);
  const { showFilter, networkLogs } = useNetwork();

  const [selectedNetworkLog, setSelectedNetworkLog] = useState<NetworkLog | null>(null);
  const [detailsWidth, setDetailsWidth] = useState(0);

  useEffect(() => {
    if (!selectedNetworkLog) {
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
        {/* <NetworkTimeline /> */}
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
            networkLog={selectedNetworkLog}
            containerWidth={detailsWidth}
            handleClose={() => setSelectedNetworkLog(null)}
            setContainerWidth={(width) => setDetailsWidth(width)}
          />
        )}
      </div>
    </main>
  );
}

export default App;
