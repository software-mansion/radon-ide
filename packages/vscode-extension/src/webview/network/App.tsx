import "./App.css";
import { useEffect, useMemo, useRef, useState } from "react";
import NetworkBar from "../components/NetworkBar";
import NetworkFilters from "../components/NetworkFilters";
import useNetworkTracker from "../hooks/useNetworkTracker";
import NetworkRequestLog from "../components/NetworkRequestLog";
import NetworkLogDetails from "../components/NetworkLogDetails";
import { useNetwork } from "../providers/NetworkProvider";
import NetworkTimeline from "../components/NetworkTimeline";

function App() {
  const parentRef = useRef<HTMLDivElement>(null);
  const networkLogs = useNetworkTracker();
  const { showFilter } = useNetwork();

  const [selectedNetworkLogId, setSelectedNetworkLogId] = useState<string | null>(null);
  const [detailsWidth, setDetailsWidth] = useState(0);

  const selectedNetworkLog = useMemo(() => {
    return networkLogs.find((log) => log.requestId === selectedNetworkLogId) || null;
  }, [selectedNetworkLogId]);

  useEffect(() => {
    if (!selectedNetworkLogId) {
      console.log("Resetting details width");
      setDetailsWidth(0);
    } else {
      setDetailsWidth(500);
    }
  }, [selectedNetworkLogId]);

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
        <NetworkTimeline handleSelectedRequest={setSelectedNetworkLogId} />
      </div>
      <div className="network-log-container" ref={parentRef}>
        <NetworkRequestLog
          selectedNetworkLog={selectedNetworkLog}
          networkLogs={networkLogs}
          detailsWidth={detailsWidth}
          handleSelectedRequest={setSelectedNetworkLogId}
        />

        {selectedNetworkLog && (
          <NetworkLogDetails
            parentRef={parentRef}
            networkLog={selectedNetworkLog}
            handleClose={() => setSelectedNetworkLogId(null)}
            handleContainerSize={(width) => setDetailsWidth(width)}
          />
        )}
      </div>
    </main>
  );
}

export default App;
