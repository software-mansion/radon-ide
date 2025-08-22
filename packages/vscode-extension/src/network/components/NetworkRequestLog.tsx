import classNames from "classnames";
import { useRef, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  VscodeTable,
  VscodeTableBody,
  VscodeTableCell,
  VscodeTableHeader,
  VscodeTableHeaderCell,
  VscodeTableRow,
} from "@vscode-elements/react-elements";
import type { VscodeTable as VscodeTableElement } from "@vscode-elements/elements/dist/vscode-table/vscode-table";
import type { VscodeTableRow as VscodeTableRowElement } from "@vscode-elements/elements/dist/vscode-table-row/vscode-table-row";

import { NetworkLog } from "../hooks/useNetworkTracker";
import "./NetworkRequestLog.css";

interface NetworkRequestLogProps {
  networkLogs: NetworkLog[];
  selectedNetworkLog: NetworkLog | null;
  handleSelectedRequest: (id: string | null) => void;
  parentHeight: number | undefined;
}

type logDetails = {
  title: string;
  getValue: (log: NetworkLog) => string | number | undefined;
  getClass?: (log: NetworkLog) => string;
};

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
  //@ts-ignore - ignore accessing the private property - needed to avoid ugly selectors
  return table?._scrollableElement?._scrollableContainer;
}

function getStatusClass(status: number | string | undefined) {
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
}

const LOG_DETAILS_CONFIG: logDetails[] = [
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
];

const SCROLL_TO_TOP_TIMEOUT = 200;

const NetworkRequestLog = ({
  networkLogs,
  handleSelectedRequest,
  selectedNetworkLog,
  parentHeight,
}: NetworkRequestLogProps) => {
  const tableRef = useRef<VscodeTableElement>(null);

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
            {LOG_DETAILS_CONFIG.map(({ title }) => (
              <VscodeTableHeaderCell key={title}>{title}</VscodeTableHeaderCell>
            ))}
          </VscodeTableHeader>
          <TableBody
            networkLogs={networkLogs}
            selectedNetworkLog={selectedNetworkLog}
            handleSelectedRequest={handleSelectedRequest}
            tableRef={tableRef}
            parentHeight={parentHeight}
          />
        </VscodeTable>
      </div>
    </div>
  );
};

interface TableBodyProps {
  networkLogs: NetworkLog[];
  selectedNetworkLog: NetworkLog | null;
  handleSelectedRequest: (requestId: string | null) => void;
  tableRef: React.RefObject<VscodeTableElement | null>;
  parentHeight: number | undefined;
}

const CELL_DEFAULT_HEIGHT = 24;
const ROW_OVERSCAN = 15;

function TableBody({
  networkLogs,
  selectedNetworkLog,
  handleSelectedRequest,
  tableRef,
  parentHeight,
}: TableBodyProps) {
  const [selectedRequestOffset, setSelectedRequestOffset] = useState<number>(0);

  const rowVirtualizer = useVirtualizer<HTMLDivElement, VscodeTableRowElement>({
    count: networkLogs.length,
    estimateSize: () => CELL_DEFAULT_HEIGHT,
    getScrollElement: () =>
      tableRef.current && (getScrollableTableContainer(tableRef.current) ?? null),
    overscan: ROW_OVERSCAN,
  });

  // If table's height changes and something is selected, scroll to the selected element
  useEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return;
    }

    const timeout = setTimeout(() => {
      const selectedElement = table.querySelector<HTMLDivElement>(".selected");
      const selectedElementRect = selectedElement?.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const selectedElementTop = selectedElementRect?.top ?? 0;
      const tableTotalHeight = tableRect.top + tableRect.height;
      const tableTop = tableRect.top;

      if (
        !selectedElement ||
        selectedElementTop > tableTotalHeight ||
        selectedElementTop < tableTop
      ) {
        rowVirtualizer.scrollToIndex(selectedRequestOffset, {
          behavior: "smooth",
          align: "center",
        });
      }
    }, SCROLL_TO_TOP_TIMEOUT);

    return () => {
      clearTimeout(timeout);
    };
  }, [parentHeight]);

  // Scroll to the selected element when user clicks on it
  useEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return;
    }

    const selectedElement = table.querySelector<HTMLDivElement>(".selected");
    if (!selectedElement) {
      return;
    }

    rowVirtualizer.scrollToIndex(selectedRequestOffset, {
      behavior: "smooth",
      align: "center",
    });
  }, [selectedNetworkLog?.requestId]);

  const innerHandleSelectedRequest = (id: string | null, offset: number) => {
    setSelectedRequestOffset(offset);
    handleSelectedRequest(id);
  };

  return (
    <VscodeTableBody style={{ height: `${rowVirtualizer.getTotalSize()}px` }} slot="body">
      {rowVirtualizer.getVirtualItems().map((virtualRow, index) => {
        const log = networkLogs[virtualRow.index];
        return (
          <VscodeTableRow
            data-index={virtualRow.index}
            key={log.requestId}
            ref={(node) => rowVirtualizer.measureElement(node)}
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start - index * virtualRow.size}px)`,
            }}
            className={classNames(
              "table-row",
              selectedNetworkLog?.requestId === log.requestId && "selected"
            )}
            onClick={() =>
              innerHandleSelectedRequest(
                selectedNetworkLog?.requestId === log.requestId ? null : log.requestId,
                virtualRow.index
              )
            }>
            {LOG_DETAILS_CONFIG.map(({ title, getValue, getClass }) => (
              <VscodeTableCell key={title} className={getClass ? getClass(log) : ""}>
                {getValue(log)}
              </VscodeTableCell>
            ))}
          </VscodeTableRow>
        );
      })}
      {/* Below row, renedered unconditionally, is needed, because the scrollable-container
          (requested by getScrollableTableContainer method) is mounted only after
          at least one of the rows is present */}
      <VscodeTableRow className="hack-table-row">mleko</VscodeTableRow>
    </VscodeTableBody>
  );
}

export default NetworkRequestLog;
