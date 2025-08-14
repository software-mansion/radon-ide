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
import type { VscodeTable as VscodeTableElement } from "@vscode-elements/elements/dist/vscode-table/vscode-table";

import { NetworkLog } from "../hooks/useNetworkTracker";
import "./NetworkRequestLog.css";

interface NetworkRequestLogProps {
  networkLogs: NetworkLog[];
  selectedNetworkLog: NetworkLog | null;
  handleSelectedRequest: (id: string | null) => void;
  parentHeight: number | undefined;
}

/**
 * Navigates through the shadow DOM hierarchy to find the scrollable container within a VSCode table element.
 *
 * VSCode table elements use shadow DOM structures where the actual scrollable container
 * is nested. The element may be null, as it needs some time after component mount (useEffects)
 * to be rendered, probably due to inner logic of VscodeElements.
 *
 * @param table - The VSCode table element to search within
 * @returns The scrollable container div element if found, null if the table has no shadow root,
 *          or undefined if any intermediate elements in the shadow DOM hierarchy are missing
 */
function getScrollableTableContainer(table: VscodeTableElement): HTMLDivElement | null | undefined {
  const tableShadowRoot = table.shadowRoot;
  const scrollableShadowRoot =
    tableShadowRoot?.querySelector<HTMLDivElement>(".scrollable")?.shadowRoot;
  const scrollableContainer =
    scrollableShadowRoot?.querySelector<HTMLDivElement>(".scrollable-container");

  return scrollableContainer;
}

const NetworkRequestLog = ({
  networkLogs,
  handleSelectedRequest,
  selectedNetworkLog,
  parentHeight,
}: NetworkRequestLogProps) => {
  const tableRef = useRef<VscodeTableElement>(null);

  // Scroll to the selected element when user clicks on it
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return;
    }

    const scrollableContainer = getScrollableTableContainer(table);
    const selectedElement = table.querySelector<HTMLDivElement>(".selected");

    if (!selectedElement || !scrollableContainer) {
      return;
    }

    scrollableContainer.scrollTo({
      top: selectedElement.offsetTop - table.clientHeight / 2,
      behavior: "smooth",
    });
  }, [selectedNetworkLog?.requestId]);

  // If table's height changes and something is selected, scroll to the selected element
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return;
    }

    const selectedElement = table.querySelector<HTMLDivElement>(".selected");
    if (!selectedElement) {
      return;
    }

    const timeout = setTimeout(() => {
      const scrollableContainer = getScrollableTableContainer(table);

      if (selectedElement.offsetTop > table.clientHeight) {
        scrollableContainer?.scrollTo({
          top: selectedElement.offsetTop - table.clientHeight / 2,
          behavior: "smooth",
        });
      }
    }, 200);

    return () => {
      clearTimeout(timeout);
    };
  }, [parentHeight]);

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
        title: "Name",
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
    <div className="table-container">
      <div style={{ width: "100%", overflowX: "hidden" }}>
        <VscodeTable
          zebra
          bordered-columns
          resizable
          responsive
          style={{ height: parentHeight }}
          ref={tableRef}>
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
