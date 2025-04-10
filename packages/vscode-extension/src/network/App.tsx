import "./App.css";
import "../webview/styles/theme.css";
import { useMemo, useRef, useState } from "react";
import { VscodeSplitLayout } from "@vscode-elements/react-elements";
import NetworkBar from "./components/NetworkBar";
import NetworkRequestLog from "./components/NetworkRequestLog";
import NetworkLogDetails from "./components/NetworkLogDetails";
import { useNetwork } from "./providers/NetworkProvider";

function App() {
  const networkLogContainerRef = useRef<HTMLDivElement | null>(null);
  const networkLogContainerHeight = networkLogContainerRef?.current?.clientHeight;

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

  return (
    <main>
      <NetworkBar />

      <div className="network-log-container" ref={networkLogContainerRef}>
        {isNetworkLogDetailsVisible ? (
          <VscodeSplitLayout className="network-log-split-layout">
            <div slot="start">
              <NetworkRequestLog
                selectedNetworkLog={selectedNetworkLog}
                networkLogs={networkLogs}
                handleSelectedRequest={setSelectedNetworkLogId}
                parentHeight={networkLogContainerHeight}
              />
            </div>
            <div slot="end">
              <NetworkLogDetails
                key={selectedNetworkLog.requestId}
                networkLog={selectedNetworkLog}
                handleClose={() => setSelectedNetworkLogId(null)}
                parentHeight={networkLogContainerHeight}
              />
            </div>
          </VscodeSplitLayout>
        ) : (
          <NetworkRequestLog
            selectedNetworkLog={selectedNetworkLog}
            networkLogs={networkLogs}
            handleSelectedRequest={setSelectedNetworkLogId}
            parentHeight={networkLogContainerHeight}
          />
        )}
      </div>
    </main>
  );
}

export default App;
