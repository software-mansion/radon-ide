import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { NetworkLog } from "../hooks/useNetworkTracker";
import ResizableContainer from "./shared/ResizableContainer";
import "./NetworkRequestLog.css";

interface NetworkRequestLogProps {
  networkLogs: NetworkLog[];
  detailsWidth: number;
  selectedNetworkLog: NetworkLog | null;
  handleSelectedRequest: (id: string | null) => void;
}

const ROWS = ["Domain", "File", "Status", "Method", "Type", "Size", "Time"];
const TABLE_RIGHT_PADDING = 0;
const TABLE_CELL_MIN_WIDTH = 50;

const NetworkRequestLog = ({
  networkLogs,
  detailsWidth,
  handleSelectedRequest,
  selectedNetworkLog,
}: NetworkRequestLogProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>(
    ROWS.reduce(
      (acc, title) => ({
        ...acc,
        [title]: 0,
      }),
      {}
    )
  );
  const [lastDetailsWidth, setLastDetailsWidth] = useState(0);
  const [initialRowWidth, setInitialRowWidth] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) {
        return;
      }

      setInitialRowWidth(
        containerRef.current.clientWidth / ROWS.length - TABLE_RIGHT_PADDING / ROWS.length
      );
    };

    window.addEventListener("resize", handleResize);

    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    setColumnWidths(
      ROWS.reduce(
        (acc, title) => ({
          ...acc,
          [title]: initialRowWidth,
        }),
        {}
      )
    );
  }, [initialRowWidth]);

  useEffect(() => {
    if (detailsWidth !== lastDetailsWidth) {
      const isIncreasing = detailsWidth > lastDetailsWidth;

      setColumnWidths((prev) => {
        let updatedWidths = { ...prev };
        const diff = Math.abs(detailsWidth - lastDetailsWidth);
        const proportion = diff / ROWS.length;

        ROWS.forEach((title) => {
          if (isIncreasing) {
            updatedWidths[title] -= proportion;
          } else {
            updatedWidths[title] += proportion;
          }

          updatedWidths[title] = updatedWidths[title];
        });

        return updatedWidths;
      });
      setLastDetailsWidth(detailsWidth);
    }
  }, [detailsWidth, lastDetailsWidth]);

  useEffect(() => {
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

  useEffect(() => {
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

  const handleResize = useCallback((title: string, newWidth: number) => {
    setColumnWidths((prev) => {
      const prevWidth = prev[title];
      const diff = newWidth - prevWidth;

      const keys = Object.keys(prev);

      let remainingDiff = diff;
      let updatedWidths = { ...prev };

      for (let i = keys.length - 1; i >= 0; i--) {
        if (diff > 0 && keys[i] === title) {
          return { ...prev };
        }

        if (diff > 0) {
          if (keys[i] !== title && updatedWidths[keys[i]] > TABLE_CELL_MIN_WIDTH) {
            const availableShrink = updatedWidths[keys[i]] - TABLE_CELL_MIN_WIDTH;
            const shrinkBy = Math.min(availableShrink, remainingDiff);
            updatedWidths[keys[i]] -= shrinkBy;
            remainingDiff -= shrinkBy;
            if (remainingDiff <= 0) {
              break;
            }
          }
        } else {
          if (keys[i] !== title) {
            updatedWidths[keys[i]] -= remainingDiff;
            remainingDiff = 0;
            break;
          }
        }
      }

      if (remainingDiff > 0 && diff > 0) {
        for (let i = 0; i < keys.length; i++) {
          if (keys[i] !== title && updatedWidths[keys[i]] > TABLE_CELL_MIN_WIDTH) {
            const availableShrink = updatedWidths[keys[i]] - TABLE_CELL_MIN_WIDTH;
            const shrinkBy = Math.min(availableShrink, remainingDiff);
            updatedWidths[keys[i]] -= shrinkBy;
            remainingDiff -= shrinkBy;
            if (remainingDiff <= 0) {
              break;
            }
          }
        }
      }

      updatedWidths[title] = newWidth;

      return updatedWidths;
    });
  }, []);

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
      { title: "Domain", getValue: (log: NetworkLog) => log.request?.url.split("/")[2] },
      { title: "File", getValue: (log: NetworkLog) => log.request?.url.split("/").pop() },
      {
        title: "Status",
        getValue: (log: NetworkLog) => log.response?.status,
        getClass: (log: NetworkLog) => getStatusClass(log.response?.status) + " status",
      },
      { title: "Method", getValue: (log: NetworkLog) => log.request?.method },
      { title: "Type", getValue: (log: NetworkLog) => log.type },
      {
        title: "Size",
        getValue: (log: NetworkLog) => {
          const size = log.encodedDataLength;
          if (!size) {
            return "N/A";
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
      { title: "Time", getValue: (log: NetworkLog) => `${log.timeline?.durationMs} ms` },
    ],
    []
  );

  return (
    <div
      className="table-container"
      style={{ paddingRight: TABLE_RIGHT_PADDING + "px" }}
      ref={containerRef}>
      <div style={{ width: "100%", overflowX: "hidden", borderRadius: "5px" }}>
        <table>
          <thead
            style={{
              width: Object.values(columnWidths).reduce((acc, width) => acc + width, 0) + "px",
            }}>
            <tr>
              {logDetailsConfig.map(({ title }) => (
                <th
                  key={title}
                  style={{
                    maxWidth: `${columnWidths[title]}px`,
                    width: `${columnWidths[title]}px`,
                  }}>
                  <ResizableContainer
                    side="right"
                    containerWidth={columnWidths[title]}
                    setContainerWidth={(width) => handleResize(title, width)}
                    isColumn={true}>
                    <p className="table-paragraph">{title}</p>
                  </ResizableContainer>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {networkLogs.map((log) => (
              <tr
                key={log.requestId}
                className={selectedNetworkLog?.requestId === log.requestId ? "selected" : ""}
                onClick={() =>
                  handleSelectedRequest(
                    selectedNetworkLog?.requestId === log.requestId ? null : log.requestId
                  )
                }>
                {logDetailsConfig.map(({ title, getValue, getClass }) => (
                  <td
                    key={title}
                    style={{
                      maxWidth: `${columnWidths[title]}px`,
                      width: `${columnWidths[title]}px`,
                    }}
                    className={getClass ? getClass(log) : ""}>
                    <p
                      className="table-paragraph"
                      style={{
                        maxWidth: `${columnWidths[title]}px`,
                        width: `${columnWidths[title]}px`,
                      }}>
                      {getValue(log)}
                    </p>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NetworkRequestLog;
