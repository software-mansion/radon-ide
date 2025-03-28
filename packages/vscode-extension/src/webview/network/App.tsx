import "./App.css";
import "../styles/theme.css";
import { useMemo, useState } from "react";
import NetworkBar from "../components/NetworkBar";
import NetworkRequestLog from "../components/NetworkRequestLog";
import NetworkLogDetails from "../components/NetworkLogDetails";
import { useNetwork } from "../providers/NetworkProvider";
import NetworkTimeline from "../components/NetworkTimeline";
import { Input } from "../components/shared/Input";

function App() {
  const { showSearch, networkLogs, unfilteredNetworkLogs, filters, showChart, setFilters } =
    useNetwork();

  const [selectedNetworkLogId, setSelectedNetworkLogId] = useState<string | null>(null);
  const [detailsWidth, setDetailsWidth] = useState(0);

  const selectedNetworkLog = useMemo(() => {
    const fullLog = networkLogs.find((log) => log.requestId === selectedNetworkLogId);
    if (!fullLog) {
      setSelectedNetworkLogId(null);
    }
    return fullLog || null;
  }, [selectedNetworkLogId, networkLogs]);

  const handleSelectedRequest = (id: string | null) => {
    setSelectedNetworkLogId(id);

    if (id) {
      setDetailsWidth(500);
    } else {
      setDetailsWidth(0);
    }
  };

  return (
    <main>
      <div className="panel-view">
        <div className="network-bar">
          <NetworkBar />
        </div>
        {showSearch && (
          <div className="network-search">
            <Input
              value={filters.url ?? ""}
              type="string"
              onChange={(e) => setFilters({ ...filters, url: e.target.value })}
              placeholder="Filter"
            />
          </div>
        )}
        {showChart && (
          <NetworkTimeline
            networkLogs={unfilteredNetworkLogs}
            handleSelectedRequest={handleSelectedRequest}
          />
        )}
      </div>
      <div className="network-log-container">
        <NetworkRequestLog
          selectedNetworkLog={selectedNetworkLog}
          networkLogs={networkLogs}
          detailsWidth={detailsWidth}
          handleSelectedRequest={handleSelectedRequest}
        />

        {selectedNetworkLog && (
          <NetworkLogDetails
            key={selectedNetworkLog.requestId}
            networkLog={selectedNetworkLog}
            handleClose={() => handleSelectedRequest(null)}
            containerWidth={detailsWidth}
            setContainerWidth={setDetailsWidth}
          />
        )}
      </div>
    </main>
  );
}

export default App;
