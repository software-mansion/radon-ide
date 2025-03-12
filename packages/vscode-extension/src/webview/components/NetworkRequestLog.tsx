import { useState, useMemo, useEffect, createRef } from "react";
import { NetworkLog } from "../hooks/useNetworkTracker";
import "./NetworkRequestLog.css";
import ResizableContainer from "./shared/ResizableContainer";

interface NetworkRequestLogProps {
  networkLogs: NetworkLog[];
  detailsWidth: number;
  selectedNetworkLog: NetworkLog | null;
  handleSelectedRequest: (log: NetworkLog | null) => void;
}

const ROWS = ["Domain", "File", "Status", "Method", "Type", "Size", "Time"];

const NetworkRequestLog = ({
  networkLogs,
  detailsWidth,
  handleSelectedRequest,
  selectedNetworkLog,
}: NetworkRequestLogProps) => {
  const containerRef = createRef<HTMLTableElement>();
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

      setInitialRowWidth(containerRef.current.clientWidth / ROWS.length);
    };

    window.addEventListener("resize", handleResize);

    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [columnWidths]);

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
    if (detailsWidth) {
      setColumnWidths((prev) =>
        ROWS.reduce(
          (acc, title) => ({
            ...acc,
            [title]: detailsWidth / ROWS.length,
          }),
          {}
        )
      );
      setLastDetailsWidth(detailsWidth);
    } else {
      setColumnWidths((prev) => {
        const proportion = detailsWidth / lastDetailsWidth;
        return ROWS.reduce(
          (acc, title) => ({
            ...acc,
            [title]: prev[title] * proportion,
          }),
          {}
        );
      });
    }
  }, [detailsWidth]);

  const handleResize = (title: string, newWidth: number) => {
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
          if (keys[i] !== title && updatedWidths[keys[i]] > 50) {
            const availableShrink = updatedWidths[keys[i]] - 66;
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
          if (keys[i] !== title && updatedWidths[keys[i]] > 50) {
            const availableShrink = updatedWidths[keys[i]] - 66;
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
  };

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
          return `${formattedSize.toFixed(2)} ${units[unitIndex]}`;
        },
      },
      { title: "Time", getValue: (log: NetworkLog) => `${log.timeline?.durationMs} ms` },
    ],
    []
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const selectedElement = container.querySelector(".selected");
    const { scrollTop } = container;

    const handleScroll = () => {
      if (!selectedElement) {
        return;
      }

      const selectedElementTop = selectedElement.getBoundingClientRect().top;
      const selectedElementHeight = selectedElement.clientHeight;

      if (
        selectedElementTop < 0 ||
        selectedElementTop + selectedElementHeight > container.clientHeight
      ) {
        container.scrollTo({
          top: scrollTop + selectedElementTop,
          behavior: "smooth",
        });
      }
    };

    if (!selectedNetworkLog && scrollTop >= container.scrollHeight - container.clientHeight * 1.1) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [networkLogs, selectedNetworkLog]);

  return (
    <div className="table-container" ref={containerRef}>
      <table>
        <thead>
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
          {networkLogs.map((log, index) => (
            <tr
              key={index}
              className={selectedNetworkLog?.requestId === log.requestId ? "selected" : ""}
              onClick={() =>
                handleSelectedRequest(selectedNetworkLog?.requestId === log.requestId ? null : log)
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
  );
};

export default NetworkRequestLog;
