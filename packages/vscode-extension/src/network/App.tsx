import "./App.css";
import "../webview/styles/theme.css";
import { useMemo, useState } from "react";
import { VscodeSplitLayout } from "@vscode-elements/react-elements";
import NetworkBar from "./components/NetworkBar";
import NetworkRequestLog from "./components/NetworkRequestLog";
import NetworkLogDetails from "./components/NetworkLogDetails";
import { useNetwork } from "./providers/NetworkProvider";
import NetworkTimeline from "./components/NetworkTimeline";

function App() {
  const { networkLogs, unfilteredNetworkLogs, isTimelineVisible } = useNetwork();

  const [selectedNetworkLogId, setSelectedNetworkLogId] = useState<string | null>(null);

  const selectedNetworkLog = useMemo(() => {
    const fullLog = networkLogs.find((log) => log.requestId === selectedNetworkLogId);
    if (!fullLog) {
      setSelectedNetworkLogId(null);
    }
    return fullLog || null;
  }, [selectedNetworkLogId, networkLogs]);

  const handleSelectedRequest = (id: string | null) => {
    setSelectedNetworkLogId(id);
  };

  const isNetworkLogDetailsVisible = !!selectedNetworkLog;

  const RequestLog = () => (
    <NetworkRequestLog
      selectedNetworkLog={selectedNetworkLog}
      networkLogs={networkLogs}
      handleSelectedRequest={handleSelectedRequest}
    />
  );

  const LogContainer = () =>
    isNetworkLogDetailsVisible ? (
      <VscodeSplitLayout className="network-log-container">
        <div slot="start">
          <RequestLog />
        </div>
        <div slot="end">
          <NetworkLogDetails
            key={selectedNetworkLog.requestId}
            networkLog={selectedNetworkLog}
            handleClose={() => handleSelectedRequest(null)}
          />
        </div>
      </VscodeSplitLayout>
    ) : (
      <div className="network-log-container">
        <RequestLog />
      </div>
    );

  return (
    <main>
      <NetworkBar />
      {isTimelineVisible ? (
        <VscodeSplitLayout split="horizontal" className="network-log-container">
          <div slot="start">
            <NetworkTimeline
              networkLogs={unfilteredNetworkLogs}
              handleSelectedRequest={handleSelectedRequest}
            />
          </div>
          <div slot="end">
            <LogContainer />
          </div>
        </VscodeSplitLayout>
      ) : (
        <LogContainer />
      )}
    </main>
  );
}

export default App;
