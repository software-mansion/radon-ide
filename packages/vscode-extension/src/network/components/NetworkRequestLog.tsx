import classNames from "classnames";
import { useMemo, useLayoutEffect, useRef } from "react";
import {
  VscodeTable,
  VscodeTableBody,
  VscodeTableCell,
  VscodeTableHeader,
  VscodeTableHeaderCell,
  VscodeTableRow,
} from "@vscode-elements/react-elements";

import { NetworkLog } from "../hooks/useNetworkTracker";
import "./NetworkRequestLog.css";

interface NetworkRequestLogProps {
  networkLogs: NetworkLog[];
  selectedNetworkLog: NetworkLog | null;
  handleSelectedRequest: (id: string | null) => void;
  parentHeight: number | undefined;
}

const NetworkRequestLog = ({
  networkLogs,
  handleSelectedRequest,
  selectedNetworkLog,
  parentHeight,
}: NetworkRequestLogProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const { scrollTop } = container;

    if (
      !selectedNetworkLog &&
      scrollTop >= container.scrollHeight - container.clientHeight * 1.25
    ) {
      container.scrollTo({
        top: container.scrollHeight,
      });
    }
  }, [networkLogs, selectedNetworkLog]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const selectedElement = container.querySelector(".selected");
    const { scrollTop } = container;

    const handleScrollToSelectedElement = () => {
      if (!selectedElement) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const selectedElementRect = selectedElement.getBoundingClientRect();

      if (
        selectedElementRect.top < containerRect.top ||
        selectedElementRect.bottom > containerRect.bottom
      ) {
        container.scrollTo({
          top: scrollTop + (selectedElementRect.top - containerRect.top - 100),
          behavior: "smooth",
        });
      }
    };

    handleScrollToSelectedElement();
  }, [selectedNetworkLog?.requestId]);

  const getStatusClass = (status: number | string | undefined) => {
    if (!status) {
      return "";
    }

    const statusNum = Number(status);
    if (statusNum >= 200 && statusNum < 400) {
      return "status-success";
    }

    if (statusNum >= 400) {
      return "status-error";
    }

    return "";
  };

  const logDetailsConfig = useMemo(
    () => [
      {
        title: "Domain",
        getValue: (log: NetworkLog) => log.request?.url.split("/")[2] || "(pending)",
      },
      {
        title: "File",
        getValue: (log: NetworkLog) => log.request?.url.split("/").pop() || "(pending)",
      },
      {
        title: "Status",
        getValue: (log: NetworkLog) => log.response?.status || "(pending)",
        getClass: (log: NetworkLog) => getStatusClass(log.response?.status) + " status",
      },
      { title: "Method", getValue: (log: NetworkLog) => log.request?.method || "(pending)" },
      { title: "Type", getValue: (log: NetworkLog) => log.type || "(pending)" },
      {
        title: "Size",
        getValue: (log: NetworkLog) => {
          const size = log.encodedDataLength;
          if (!size) {
            return "(pending)";
          }
          const units = ["B", "KB", "MB", "GB", "TB"];
          let unitIndex = 0;
          let formattedSize = size;
          while (formattedSize >= 1024 && unitIndex < units.length - 1) {
            formattedSize /= 1024;
            unitIndex++;
          }
          return `${parseFloat(formattedSize.toFixed(2) || "")} ${units[unitIndex]}`;
        },
      },
      {
        title: "Time",
        getValue: (log: NetworkLog) =>
          log.timeline?.durationMs ? `${log.timeline?.durationMs} ms` : "(pending)",
      },
    ],
    []
  );

  return (
    <div className="table-container" ref={containerRef}>
      <div style={{ width: "100%", overflowX: "hidden" }}>
        <VscodeTable zebra resizable style={{ height: parentHeight }}>
          <VscodeTableHeader slot="header">
            {logDetailsConfig.map(({ title }) => (
              <VscodeTableHeaderCell key={title}>{title}</VscodeTableHeaderCell>
            ))}
          </VscodeTableHeader>
          <VscodeTableBody slot="body">
            {networkLogs.map((log) => (
              <VscodeTableRow
                key={log.requestId}
                className={classNames(
                  "table-row",
                  selectedNetworkLog?.requestId === log.requestId && "selected"
                )}
                onClick={() =>
                  handleSelectedRequest(
                    selectedNetworkLog?.requestId === log.requestId ? null : log.requestId
                  )
                }>
                {logDetailsConfig.map(({ title, getValue, getClass }) => (
                  <VscodeTableCell key={title} className={getClass ? getClass(log) : ""}>
                    {getValue(log)}
                  </VscodeTableCell>
                ))}
              </VscodeTableRow>
            ))}
          </VscodeTableBody>
        </VscodeTable>
      </div>
    </div>
  );
};

export default NetworkRequestLog;
