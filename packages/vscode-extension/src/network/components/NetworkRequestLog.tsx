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
  const [sortState, setSortState] = useState<SortState>({
    column: null,
    direction: null,
  });

  // Sort the network logs based on current sort state
  const sortedNetworkLogs = useMemo(() => {
    return sortNetworkLogs(networkLogs, sortState.column, sortState.direction);
  }, [networkLogs, sortState]);

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
    return sortState.direction === SortDirection.Asc ? "codicon-chevron-up" : "codicon-chevron-down";
  };

  return (
    <div className="table-container" ref={containerRef}>
      <div style={{ width: "100%", overflowX: "hidden" }}>
        {/* DIRTY HACK: table rerenders on window resize, including scroll position which sucks */}
        <VscodeTable
          zebra
          bordered-columns
          resizable
          style={{ height: parentHeight }}
          key={parentHeight}>
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
                {logDetailsConfig.map(({ title, getClass }) => (
                  <VscodeTableCell key={title} className={getClass ? getClass(log) : ""}>
                    {getNetworkLogValue(log, title)}
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
