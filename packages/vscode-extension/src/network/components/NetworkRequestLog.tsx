import classNames from "classnames";
import { useRef, useState, useEffect, useLayoutEffect, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { capitalize } from "lodash";
import { VscodeTable as VscodeTableElement } from "@vscode-elements/elements/dist/vscode-table/vscode-table.js";
import type { VscodeTableRow as VscodeTableRowElement } from "@vscode-elements/elements/dist/vscode-table-row/vscode-table-row";
import type { VscodeContextMenu as VscodeContextMenuElement } from "@vscode-elements/elements/dist/vscode-context-menu/vscode-context-menu";
import {
  VscodeTableBody,
  VscodeTableCell,
  VscodeTableHeader,
  VscodeTableHeaderCell,
  VscodeTableRow,
} from "@vscode-elements/react-elements";
import ContextMenuPortal from "./ContextMenuPortal";
import VscodeTable from "./VscodeTableInternalFix";
import IconButton from "../../webview/components/shared/IconButton";
import { getNetworkLogValue, sortNetworkLogs } from "../utils/networkLogUtils";
import { NetworkLogColumn } from "../types/network";
import { useNetworkFilter } from "../providers/NetworkFilterProvider";
import { SortDirection } from "../types/network";
import { NetworkLog } from "../hooks/useNetworkTracker";
import "./NetworkRequestLog.css";

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

type logDetails = {
  title: NetworkLogColumn;
  getClass?: (log: NetworkLog) => string;
};

const SCROLL_TO_TOP_TIMEOUT = 200;
const DEFAULT_SORT_STATE: SortState = {
  column: null,
  direction: null,
};

const LOG_DETAILS_CONFIG: logDetails[] = [
  { title: NetworkLogColumn.Name },
  {
    title: NetworkLogColumn.Status,
    getClass: (log: NetworkLog) => getStatusClass(log.response?.status) + " status",
  },
  { title: NetworkLogColumn.Method },
  { title: NetworkLogColumn.Type },
  { title: NetworkLogColumn.Size },
  { title: NetworkLogColumn.Time },
];

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

const NetworkRequestLog = ({
  networkLogs,
  handleSelectedRequest,
  selectedNetworkLog,
  parentHeight,
}: NetworkRequestLogProps) => {
  const tableRef = useRef<VscodeTableElement>(null);
  const [sortState, setSortState] = useState<SortState>(DEFAULT_SORT_STATE);
  const { addColumnFilterToInputField } = useNetworkFilter();

  // Sort the network logs based on current sort state
  const sortedNetworkLogs = useMemo(() => {
    return sortNetworkLogs(networkLogs, sortState.column, sortState.direction);
  }, [networkLogs, sortState]);

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
    // If filter was clicked, do not trigger sorting by stopping propagation
    e.stopPropagation();
    addColumnFilterToInputField(column);
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
          style={{ height: parentHeight }}
          ref={tableRef}>
          <VscodeTableHeader slot="header">
            {LOG_DETAILS_CONFIG.map(({ title }) => (
              <VscodeTableHeaderCell key={title} onClick={() => handleHeaderClick(title)}>
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
          <TableBody
            networkLogs={sortedNetworkLogs}
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

const CONTEXT_MENU_DATA = [
  {
    label: "Copy as cURL",
    value: "menuitem1",
  },
  {
    label: "Test2",
    value: "menuitem2",
  },
];

function TableBody({
  networkLogs,
  selectedNetworkLog,
  handleSelectedRequest,
  tableRef,
  parentHeight,
}: TableBodyProps) {
  const [selectedRequestIndex, setSelectedRequestIndex] = useState<number>(0);
  const [contextMenuRequestId, setContextMenuRequestId] = useState<string | null>(null);
  const [cellWidths, setCellWidths] = useState<number[]>([]);

  const contextMenuRef = useRef<VscodeContextMenuElement>(null);

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
  }, [networkLogs]);

  /**
   * Creates a virtual row renderer for the network request log table.
   * Uses TanStack Virtual to handle large lists by only rendering visible rows.
   * https://tanstack.com/virtual/latest/docs/api/virtualizer
   */
  const rowVirtualizer = useVirtualizer<HTMLDivElement, VscodeTableRowElement>({
    count: networkLogs.length,
    overscan: ROW_OVERSCAN,
    estimateSize: () => CELL_DEFAULT_HEIGHT,
    getScrollElement: () =>
      tableRef.current && (getScrollableTableContainer(tableRef.current) ?? null),
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
        rowVirtualizer.scrollToIndex(selectedRequestIndex, {
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

    rowVirtualizer.scrollToIndex(selectedRequestIndex, {
      behavior: "smooth",
      align: "center",
    });
  }, [selectedNetworkLog?.requestId]);

  const innerHandleSelectedRequest = (id: string | null, offset: number) => {
    setSelectedRequestIndex(offset);
    handleSelectedRequest(id);
  };

  const handleContextMenu = (
    e: React.MouseEvent<VscodeTableRowElement>,
    requestId: string | null
  ) => {
    const contextMenu = contextMenuRef.current;
    if (!contextMenu) {
      return;
    }

    e.preventDefault();

    if (contextMenuRequestId !== requestId) {
      setContextMenuRequestId(requestId);
      contextMenu.show = true;
    } else {
      contextMenu.show = !contextMenu.show;
    }

    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;
  };

  return (
    <>
      <ContextMenuPortal
        className="context-menu-row"
        ref={contextMenuRef}
        data={CONTEXT_MENU_DATA}
      />

      <VscodeTableBody style={{ height: `${rowVirtualizer.getTotalSize()}px` }} slot="body">
        {rowVirtualizer.getVirtualItems().map((virtualRow, index) => {
          const log = networkLogs[virtualRow.index];
          return (
            <VscodeTableRow
              data-index={virtualRow.index}
              key={log.requestId}
              // Style needs to be overwritten using virtualizer values
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
              }
              onContextMenu={(e) => handleContextMenu(e, log.requestId)}>
              {LOG_DETAILS_CONFIG.map(({ title, getClass }, i) => (
                <VscodeTableCell
                  key={`${log.requestId}-${title}`}
                  className={getClass?.(log) ?? ""}
                  style={{ width: cellWidths[i] || "auto" }}>
                  {getNetworkLogValue(log, title)}
                </VscodeTableCell>
              ))}
            </VscodeTableRow>
          );
        })}
        {/* Below row, renedered unconditionally, is needed, because the VscodeTableBody
        is styled with display:table, which causes rows to stretch to fit the container, despite
        set size. As we will always have total low height lesser than the table-body height (because
        virtualization) an additional row is needed to fill the remaining space */}
        <VscodeTableRow className="hack-table-row"></VscodeTableRow>
      </VscodeTableBody>
    </>
  );
}

export default NetworkRequestLog;
