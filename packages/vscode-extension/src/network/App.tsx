import "./App.css";
import "../webview/styles/theme.css";
import { useMemo, useState } from "react";
import { VscodeSplitLayout } from "@vscode-elements/react-elements";
import NetworkBar from "./components/NetworkBar";
import NetworkRequestLog from "./components/NetworkRequestLog";
import NetworkLogDetails from "./components/NetworkLogDetails";
import { useNetwork } from "./providers/NetworkProvider";

function App() {
  const { networkLogs } = useNetwork();

  const [selectedNetworkLogId, setSelectedNetworkLogId] = useState<string | null>(null);

  const selectedNetworkLog = useMemo(() => {
    const fullLog = networkLogs.find((log) => log.requestId === selectedNetworkLogId);
    if (!fullLog) {
      setSelectedNetworkLogId(null);
    }
    return fullLog || null;
  }, [selectedNetworkLogId, networkLogs]);

  const isNetworkLogDetailsVisible = !!selectedNetworkLog;

  const RequestLog = () => (
    <NetworkRequestLog
      selectedNetworkLog={selectedNetworkLog}
      networkLogs={networkLogs}
      handleSelectedRequest={setSelectedNetworkLogId}
    />
  );

  return (
    <main>
      <NetworkBar />

      {isNetworkLogDetailsVisible ? (
        <VscodeSplitLayout className="network-log-container">
          <div slot="start">
            <RequestLog />
          </div>
          <div slot="end">
            <NetworkLogDetails
              key={selectedNetworkLog.requestId}
              networkLog={selectedNetworkLog}
              handleClose={() => setSelectedNetworkLogId(null)}
            />
          </div>
        </VscodeSplitLayout>
      ) : (
        <div className="network-log-container">
          <RequestLog />
        </div>
      )}
    </main>
  );
}

export default App;
