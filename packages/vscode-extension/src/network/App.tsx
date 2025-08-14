import "./App.css";
import "../webview/styles/theme.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { VscodeSplitLayout } from "@vscode-elements/react-elements";
import { debounce } from "lodash";
import NetworkBar from "./components/NetworkBar";
import NetworkRequestLog from "./components/NetworkRequestLog";
import NetworkLogDetails from "./components/NetworkLogDetails";
import { useNetwork } from "./providers/NetworkProvider";

function App() {
  const networkLogContainerRef = useRef<HTMLDivElement | null>(null);
  const networkDetailsContainerRef = useRef<HTMLDivElement>(null);
  const networkLogDetailsSize = useRef<string>("50%");

  const [networkLogContainerHeight, setNetworkLogContainerHeight] = useState<number | undefined>(
    networkLogContainerRef?.current?.clientHeight
  );

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

  useEffect(() => {
    // debounce the resize event to avoid performance issues
    const handleResize = debounce(() => {
      if (networkLogContainerRef.current) {
        setNetworkLogContainerHeight(networkLogContainerRef.current.clientHeight);
      }
    }, 30);

    handleResize();
    handleResize.flush();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      handleResize.cancel();
    };
  }, []);

  useEffect(() => {
    // Set the size of the network log details container, after users decides to resize it
    // https://vscode-elements.github.io/components/split-layout/api/
    const handleResize = debounce(() => {
      if (!networkLogContainerRef.current || !networkDetailsContainerRef.current) {
        return;
      }
      const containerWidth = networkLogContainerRef.current.clientWidth;
      const detailsWidth = networkDetailsContainerRef.current?.clientWidth;
      networkLogDetailsSize.current = `${((containerWidth - detailsWidth) / containerWidth) * 100}%`;
    });

    const detailsResizeObserver = new ResizeObserver(handleResize);

    if (networkDetailsContainerRef.current) {
      detailsResizeObserver.observe(networkDetailsContainerRef.current);
    }

    return () => {
      detailsResizeObserver.disconnect();
      handleResize.cancel();
    };
  }, [isNetworkLogDetailsVisible]);

  return (
    <main>
      <NetworkBar />

      <div className="network-log-container" ref={networkLogContainerRef}>
        <VscodeSplitLayout
          className="network-log-split-layout"
          handleSize={isNetworkLogDetailsVisible ? 4 : 0}
          handlePosition={isNetworkLogDetailsVisible ? networkLogDetailsSize.current : "100%"}>
          <div slot="start">
            <NetworkRequestLog
              selectedNetworkLog={selectedNetworkLog}
              networkLogs={networkLogs}
              handleSelectedRequest={setSelectedNetworkLogId}
              parentHeight={networkLogContainerHeight}
            />
          </div>
          {isNetworkLogDetailsVisible ? (
            <div ref={networkDetailsContainerRef} slot="end">
              <NetworkLogDetails
                key={selectedNetworkLog.requestId}
                networkLog={selectedNetworkLog}
                handleClose={() => setSelectedNetworkLogId(null)}
                parentHeight={networkLogContainerHeight}
              />
            </div>
          ) : null}
        </VscodeSplitLayout>
      </div>
    </main>
  );
}

export default App;
