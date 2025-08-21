import "./App.css";
import "../webview/styles/theme.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { VscodeSplitLayout } from "@vscode-elements/react-elements";
import { debounce } from "lodash";
import NetworkBar from "./components/NetworkBar";
import NetworkRequestLog from "./components/NetworkRequestLog";
import NetworkLogDetails from "./components/NetworkLogDetails";
import { useNetworkFilter } from "./providers/NetworkFilterProvider";

const DEBOUNCE_TIME = 30;

function App() {
  const networkLogContainerRef = useRef<HTMLDivElement | null>(null);
  const networkDetailsContainerRef = useRef<HTMLDivElement>(null);
  const networkLogDetailsSize = useRef<string>("50%");

  const [networkLogContainerHeight, setNetworkLogContainerHeight] = useState<number | undefined>(
    networkLogContainerRef?.current?.clientHeight
  );

  const { filteredNetworkLogs } = useNetworkFilter();

  const [selectedNetworkLogId, setSelectedNetworkLogId] = useState<string | null>(null);

  const selectedNetworkLog = useMemo(() => {
    if (!selectedNetworkLogId) {
      return null;
    }
    const fullLog = filteredNetworkLogs.find((log) => log.requestId === selectedNetworkLogId);

    if (!fullLog) {
      setSelectedNetworkLogId(null);
      return null;
    }
    return fullLog;
  }, [selectedNetworkLogId, filteredNetworkLogs]);

  const areNetworkLogDetailsVisible = !!selectedNetworkLog;

  useEffect(() => {
    // debounce the resize event to avoid performance issues
    const handleResize = debounce(() => {
      if (networkLogContainerRef.current) {
        setNetworkLogContainerHeight(networkLogContainerRef.current.clientHeight);
      }
    }, DEBOUNCE_TIME);

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

    const networkDetailsContainer = networkDetailsContainerRef.current;
    if (!networkDetailsContainer) {
      return;
    }

    const handleResize = debounce(() => {
      const networkLogContainer = networkLogContainerRef.current;
      if (!networkLogContainer || !networkDetailsContainer) {
        return;
      }
      const containerWidth = networkLogContainer.clientWidth;
      const detailsWidth = networkDetailsContainer?.clientWidth;
      networkLogDetailsSize.current = `${((containerWidth - detailsWidth) / containerWidth) * 100}%`;
    }, DEBOUNCE_TIME);

    const detailsResizeObserver = new ResizeObserver(handleResize);
    detailsResizeObserver.observe(networkDetailsContainer);

    return () => {
      detailsResizeObserver.disconnect();
      handleResize.cancel();
    };
  }, [areNetworkLogDetailsVisible]);

  return (
    <main>
      <NetworkBar />

      <div className="network-log-container" ref={networkLogContainerRef}>
        <VscodeSplitLayout
          className="network-log-split-layout"
          handleSize={areNetworkLogDetailsVisible ? 4 : 0}
          handlePosition={areNetworkLogDetailsVisible ? networkLogDetailsSize.current : "100%"}>
          <div slot="start">
            <NetworkRequestLog
              selectedNetworkLog={selectedNetworkLog}
              networkLogs={filteredNetworkLogs}
              handleSelectedRequest={setSelectedNetworkLogId}
              parentHeight={networkLogContainerHeight}
            />
          </div>
          {areNetworkLogDetailsVisible ? (
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
