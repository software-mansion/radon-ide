import "./App.css";
import { useEffect, useMemo, useState } from "react";
import NetworkBar from "../components/NetworkBar";
import NetworkFilters from "../components/NetworkFilters";
import NetworkRequestLog from "../components/NetworkRequestLog";
import NetworkLogDetails from "../components/NetworkLogDetails";
import { useNetwork } from "../providers/NetworkProvider";
import NetworkTimeline from "../components/NetworkTimeline";

function App() {
  const { showFilter, networkLogs } = useNetwork();

  const [selectedNetworkLogId, setSelectedNetworkLogId] = useState<string | null>(null);
  const [detailsWidth, setDetailsWidth] = useState(0);

  const selectedNetworkLog = useMemo(() => {
    return networkLogs.find((log) => log.requestId === selectedNetworkLogId) || null;
  }, [selectedNetworkLogId, networkLogs]);

  useEffect(() => {
    if (!selectedNetworkLog) {
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
      <div className="network-log-container">
        <NetworkRequestLog
          selectedNetworkLog={selectedNetworkLog}
          networkLogs={networkLogs}
          detailsWidth={detailsWidth}
          handleSelectedRequest={setSelectedNetworkLogId}
        />

        {selectedNetworkLog && (
          <NetworkLogDetails
            key={selectedNetworkLog.requestId}
            networkLog={selectedNetworkLog}
            handleClose={() => setSelectedNetworkLogId(null)}
            containerWidth={detailsWidth}
            setContainerWidth={setDetailsWidth}
          />
        )}
      </div>
    </main>
  );
}

export default App;
