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
import { capitalize } from "lodash";
import IconButton from "../../webview/components/shared/IconButton";
import { SortDirection } from "../types/network";

import { NetworkLog } from "../hooks/useNetworkTracker";
import "./NetworkRequestLog.css";
import { getNetworkLogValue, sortNetworkLogs } from "../utils/networkLogUtils";
import { NetworkLogColumn } from "../types/network";
import { useNetworkFilter } from "../providers/NetworkFilterProvider";

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

const SCROLL_TO_TOP_TIMEOUT = 200;

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
  return table._scrollableElement?._scrollableContainer;
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

  const { addColumnFilterToInputField: addColumnFilter } = useNetworkFilter();

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
  }, [selectedNetworkLog?.requestId, sortedNetworkLogs]);

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
    }, SCROLL_TO_TOP_TIMEOUT);

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

  const handleHeaderClick = (column: NetworkLogColumn) => {
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

  const handleHeaderFilterClick = (e: React.MouseEvent, column: NetworkLogColumn) => {
    e.stopPropagation();
    addColumnFilter(column);
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
    <div className="table-container">
      <div style={{ width: "100%", overflowX: "hidden" }}>
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
                onClick={() => handleHeaderClick(title)}
                style={{ cursor: "pointer" }}>
                <div className="table-header-cell">
                  <span className="table-header-title">{capitalize(title)}</span>
                  <IconButton onClick={(e) => handleHeaderFilterClick(e, title)}>
                    <span className={`codicon codicon-filter-filled`}></span>
                  </IconButton>
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
