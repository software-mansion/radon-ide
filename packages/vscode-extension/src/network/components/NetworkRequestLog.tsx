import classNames from "classnames";
import { useMemo, useLayoutEffect, useRef, useState } from "react";
import {
  VscodeTable,
  VscodeTableBody,
  VscodeTableCell,
  VscodeTableHeader,
  VscodeTableHeaderCell,
  VscodeTableRow,
} from "@vscode-elements/react-elements";
import type { VscodeTable as VscodeTableElement } from "@vscode-elements/elements/dist/vscode-table/vscode-table.js";
import { SortDirection } from "../types/network";

import { NetworkLog } from "../hooks/useNetworkTracker";
import "./NetworkRequestLog.css";
import { getNetworkLogValue, sortNetworkLogs } from "../utils/networkLogFormatters";
import { NetworkLogColumn } from "../types/network";

interface SortState {
  column: NetworkLogColumn | null;
  direction: SortDirection | null;
}

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
  const tableRef = useRef<VscodeTableElement>(null);
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: null,
  });
  const [cellWidths, setCellWidths] = useState<number[]>([]);

  // Sort the network logs based on current sort state
  const sortedNetworkLogs = useMemo(() => {
    return sortNetworkLogs(networkLogs, sortState.column, sortState.direction);
  }, [networkLogs, sortState]);

  /**
   * Updates the cell widths based on the current sash (column bars) positions from the table component.
   *
   * This function accesses the private `_sashPositions` property from the table reference
   * to calculate relative column widths as percentages. It converts absolute sash positions
   * into relative width percentages for each column, in order to comply with current workings of
   * VscodeTable.
   *
   * This workaround is necessary to prevent improper rendering when modifying row order,
   * because VscodeTableCell does not update properly upon rearranging the columns.
   *
   */
  const updateCellWidths = () => {
    const table = tableRef.current;
    if (!table) {
      return;
    }

    // @ts-ignore - private property, but needs to be accessed due to problems with lack
    // of VscodeTableCell keys, which causes improper rendering upon modifying order of the rows
    // Sash positions are stored as float array of percentage-offset from the left side of the table.
    const sashPositions = table._sashPositions || [];

    if (sashPositions.length === 0) {
      return;
    }

    // Convert absolute sash positions to relative column widths
    const columnWidths = sashPositions.map((currentPos: number, index: number) => {
      const previousPos = index === 0 ? 0 : sashPositions[index - 1];
      return `${currentPos - previousPos}%`;
    });

    // Add the width of the last column
    const lastSashPosition = sashPositions[sashPositions.length - 1];
    columnWidths.push(`${100 - lastSashPosition}%`);

    setCellWidths(columnWidths);
  };

  useLayoutEffect(() => {
    updateCellWidths();
  }, [sortedNetworkLogs]);

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
  }, [sortedNetworkLogs, selectedNetworkLog]);

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
      { title: NetworkLogColumn.Name },
      {
        title: NetworkLogColumn.Status,
        getClass: (log: NetworkLog) => getStatusClass(log.response?.status) + " status",
      },
      { title: NetworkLogColumn.Method },
      { title: NetworkLogColumn.Type },
      { title: NetworkLogColumn.Size },
      { title: NetworkLogColumn.Time },
    ],
    []
  );

  const headerClickHandler = (column: NetworkLogColumn) => {
    setSortState((prevState) => {
      // If clicking on the same column, cycle through: asc -> desc -> null
      if (prevState.column === column) {
        switch (prevState.direction) {
          case SortDirection.Asc:
            return { column, direction: SortDirection.Desc };
          case SortDirection.Desc:
            return { column: null, direction: null };
          case null:
          default:
            return { column, direction: SortDirection.Asc };
        }
      }
      // If clicking on a different column or no current sort, start with ascending
      return { column, direction: SortDirection.Asc };
    });
  };

  const getSortIcon = (column: NetworkLogColumn) => {
    if (sortState.column !== column) {
      return "hidden"; // No icon when not sorting by this column
    }
    return sortState.direction === SortDirection.Asc
      ? "codicon-chevron-up"
      : "codicon-chevron-down";
  };

  return (
    <div className="table-container" ref={containerRef}>
      <div style={{ width: "100%", overflowX: "hidden" }}>
        {/* DIRTY HACK: table rerenders on window resize, including scroll position which sucks */}
        <VscodeTable
          zebra
          bordered-columns
          resizable
          borderedColumns
          style={{ height: parentHeight }}
          ref={tableRef}>
          <VscodeTableHeader slot="header">
            {logDetailsConfig.map(({ title }) => (
              <VscodeTableHeaderCell
                key={title}
                onClick={() => headerClickHandler(title)}
                style={{ cursor: "pointer" }}>
                <div className="table-header-cell">
                  <div>{title}</div>
                  <span className={`codicon ${getSortIcon(title)}`}></span>
                </div>
              </VscodeTableHeaderCell>
            ))}
          </VscodeTableHeader>
          <VscodeTableBody slot="body">
            {sortedNetworkLogs.map((log) => (
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
                {logDetailsConfig.map(({ title, getClass }, i) => (
                  <VscodeTableCell
                    key={`${log.requestId}-${title}`}
                    className={getClass ? getClass(log) : ""}
                    style={{ width: cellWidths[i] || "auto" }}>
                    <div>{getNetworkLogValue(log, title)}</div>
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
