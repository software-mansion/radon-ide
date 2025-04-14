import { useEffect, useRef, useMemo, useState } from "react";
import * as d3 from "d3";
import { NetworkLog } from "../hooks/useNetworkTracker";
import { useNetwork } from "../providers/NetworkProvider";
import { NetworkLog as TimelineNetworkLog } from "../types/network";
import "./NetworkTimeline.css";

const PADDING_HORIZONTAL = 8;
const MARGIN_VERTICAL = 20;
const TIMELINE_LEGEND_HEIGHT = 20;
const SIDEBAR_MAX_WIDTH = 600;
const ROW_HEIGHT = 10;
const ROW_PADDING = 5;
const TIME_GAP_THRESHOLD = 50;
const MAX_ITEMS_TO_DISPLAY = 150;
const CHART_MARGIN = 10;
const MAX_SIZE_BIG_SCREEN = 15000;
const MAX_SIZE_SMALL_SCREEN = 5000;
const MAX_VIEW_TIME =
  window.innerWidth > SIDEBAR_MAX_WIDTH ? MAX_SIZE_BIG_SCREEN : MAX_SIZE_SMALL_SCREEN;
const SCREEN_WIDTH = window.innerWidth - 2 * PADDING_HORIZONTAL;

interface NetworkFiltersProps {
  handleSelectedRequest: (id: string | null) => void;
  networkLogs: NetworkLog[];
}

interface RequestBarProps {
  d: TimelineNetworkLog;
  rowIndex: number;
  adjustedRowHeight: number;
  setTooltip: (tooltip: {
    visible: boolean;
    data: TimelineNetworkLog | null;
    x: number;
    y: number;
  }) => void;
  handleSelectedRequest: (id: string) => void;
  timeScale: d3.ScaleLinear<number, number>;
}

interface RequestRowProps {
  rowData: TimelineNetworkLog[];
  rowIndex: number;
  adjustedRowHeight: number;
  setTooltip: (tooltip: {
    visible: boolean;
    data: TimelineNetworkLog | null;
    x: number;
    y: number;
  }) => void;
  handleSelectedRequest: (id: string) => void;
  timeScale: d3.ScaleLinear<number, number>;
}

interface DashedLinesProps {
  timeScale: d3.ScaleLinear<number, number>;
  minTime: number;
  maxTime: number;
  chartHeight: number;
}

interface TooltipProps {
  d: TimelineNetworkLog;
  isLeftSide: boolean;
  x: number;
  y: number;
}

const getColorForSameService = (url: string) => {
  const urlObject = new URL(url);
  return `hsl(${urlObject.hostname.length * 10}, 70%, 50%)`;
};

function RequestBar({
  d,
  rowIndex,
  adjustedRowHeight,
  setTooltip,
  handleSelectedRequest,
  timeScale,
}: RequestBarProps) {
  const handleMouseOver = (e: React.MouseEvent<SVGRectElement, MouseEvent>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      visible: true,
      data: d,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  const handleMouseOut = (e: React.MouseEvent<SVGRectElement, MouseEvent>) => {
    e.stopPropagation();
    setTooltip({ visible: false, data: null, x: 0, y: 0 });
  };

  const handleClick = (e: React.MouseEvent<SVGRectElement, MouseEvent>) => {
    e.stopPropagation();
    console.log("Clicked requestId:", d.requestId);
    handleSelectedRequest(d.requestId);
  };

  return (
    <rect
      className="request-bar"
      x={timeScale(d.startTimestamp)}
      y={rowIndex * (adjustedRowHeight + ROW_PADDING) + MARGIN_VERTICAL / 2}
      width={Math.max(1, timeScale(d.endTimestamp) - timeScale(d.startTimestamp))}
      height={adjustedRowHeight}
      fill={getColorForSameService(d.url)}
      onClick={handleClick}
      onMouseEnter={handleMouseOver}
      onMouseLeave={handleMouseOut}
    />
  );
}

function RequestRow({
  rowData,
  rowIndex,
  adjustedRowHeight,
  setTooltip,
  handleSelectedRequest,
  timeScale,
}: RequestRowProps) {
  return (
    <g className="request-row" key={rowIndex}>
      {rowData.map((d) => (
        <RequestBar
          key={d.requestId}
          d={d}
          rowIndex={rowIndex}
          adjustedRowHeight={adjustedRowHeight}
          setTooltip={setTooltip}
          handleSelectedRequest={handleSelectedRequest}
          timeScale={timeScale}
        />
      ))}
    </g>
  );
}

function DashedLines({ timeScale, minTime, maxTime, chartHeight }: DashedLinesProps) {
  return (
    <g className="dashed-lines">
      {d3.range(minTime, maxTime, 1000).map((tick) => (
        <line
          x1={timeScale(tick)}
          x2={timeScale(tick)}
          y1={0}
          y2={chartHeight - 20}
          stroke="var(--swm-default-text)"
          strokeDasharray="4,4"
        />
      ))}
    </g>
  );
}

function Tooltip({ d, isLeftSide, x, y }: TooltipProps) {
  return (
    <div
      className="tooltip"
      style={{
        left: isLeftSide ? `${x + 10}px` : `${x - 300}px`,
        top: `${y}px`,
      }}>
      <strong>Request:</strong> {d.requestId} <br />
      <strong>URL:</strong> {d.url} <br />
      <strong>Method:</strong> {d.method} <br />
      <strong>Status:</strong> {d.status} <br />
      <strong>Duration:</strong> {d.endTimestamp - d.startTimestamp} ms
    </div>
  );
}

function NetworkTimeline({ handleSelectedRequest, networkLogs }: NetworkFiltersProps) {
  const { filters, setFilters } = useNetwork();
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [chartHeight, _] = useState(100);
  const [isCmdPressed, setIsCmdPressed] = useState(false);
  const [tooltip, setTooltip] = useState({
    visible: false,
    data: null as TimelineNetworkLog | null,
    x: 0,
    y: 0,
  });

  const brushRef = useRef<SVGGElement>(null);
  const xAxisRef = useRef<SVGGElement>(null);

  const processedData = useMemo(() => {
    return networkLogs.map((d) => ({
      requestId: d.requestId,
      url: d.request?.url || "",
      status: d.response?.status || 0,
      method: d.request?.method || "",
      type: d.type || "",
      startTimestamp: d.timeline.timestamp * 1000,
      endTimestamp: d.timeline.timestamp * 1000 + (d.timeline?.durationMs || 0),
      duration: d.timeline?.durationMs || 0,
      headers: d.request?.headers || {},
    }));
  }, [networkLogs]);

  const firstRequestTime = useMemo(() => {
    return processedData.length > 0 ? d3.min(processedData, (d) => d.startTimestamp) || 0 : 0;
  }, [processedData]);

  const lastRequestTime = useMemo(() => {
    return processedData.length > 0
      ? d3.max(processedData, (d) => d.endTimestamp) || 0
      : firstRequestTime;
  }, [processedData]);

  const rows = useMemo(() => {
    const timelineRows: TimelineNetworkLog[][] = [];
    const limitedRequests = processedData.slice(-MAX_ITEMS_TO_DISPLAY);

    limitedRequests.forEach((req) => {
      let placed = false;
      for (const row of timelineRows) {
        if (
          row.length === 0 ||
          req.startTimestamp - row[row.length - 1].endTimestamp > TIME_GAP_THRESHOLD
        ) {
          row.push(req);
          placed = true;
          break;
        }
      }
      if (!placed) {
        timelineRows.push([req]);
      }
    });
    return timelineRows;
  }, [processedData]);

  const adjustedRowHeight = useMemo(() => {
    const renderHeight = chartHeight - TIMELINE_LEGEND_HEIGHT - MARGIN_VERTICAL;
    const maxRows = Math.floor(renderHeight / (ROW_HEIGHT + ROW_PADDING));
    return rows.length > maxRows
      ? Math.max(2, renderHeight / rows.length - ROW_PADDING)
      : ROW_HEIGHT;
  }, [rows]);

  const minTime = firstRequestTime;
  const maxTime = lastRequestTime;

  const timeScale = useMemo(() => {
    return d3
      .scaleLinear()
      .domain([minTime + scrollOffset, minTime + scrollOffset + MAX_VIEW_TIME])
      .range([CHART_MARGIN, SCREEN_WIDTH - CHART_MARGIN]);
  }, [minTime, maxTime, scrollOffset]);

  const xAxis = useMemo(() => {
    return d3
      .axisBottom(timeScale)
      .ticks(MAX_VIEW_TIME / 1000)
      .tickValues(d3.range(minTime, maxTime, 1000))
      .tickFormat((d) => `${d.valueOf() - minTime} ms`);
  }, [timeScale, minTime]);

  useEffect(() => {
    if (!xAxisRef.current) {
      return;
    }

    const xAxisGroup = d3.select(xAxisRef.current);
    xAxisGroup.call(xAxis);

    return () => {
      xAxisGroup.selectAll("*").remove();
    };
  }, [xAxis]);

  const brushX = useMemo(() => {
    return d3
      .brushX()
      .extent([
        [CHART_MARGIN, 0],
        [SCREEN_WIDTH - CHART_MARGIN, chartHeight - TIMELINE_LEGEND_HEIGHT],
      ])
      .filter((event) => {
        return isCmdPressed && !event.button;
      })
      .on("start", () => {
        setIsAutoScrolling(false);
      })
      .on("brush", (event) => {
        const [start, end] = event.selection;
        if (start === end) {
          return;
        }
        const newDomain = [timeScale.invert(start), timeScale.invert(end)];
        setFilters({
          ...filters,
          timestampRange: {
            start: Math.floor(newDomain[0]) / 1000,
            end: Math.floor(newDomain[1]) / 1000,
          },
        });
      })
      .on("end", (event) => {
        if (!event.selection) {
          setIsAutoScrolling(true);
          setFilters({
            ...filters,
            timestampRange: undefined,
          });
        }
      });
  }, [timeScale, chartHeight, filters, firstRequestTime, isCmdPressed]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey) {
        setIsCmdPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!event.metaKey) {
        setIsCmdPressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!brushRef.current || !isCmdPressed) {
      return;
    }

    const brushGroup = d3.select(brushRef.current);
    if (isCmdPressed) {
      brushGroup.call(brushX);
    } else {
      brushGroup.selectAll("*").remove();
    }

    return () => {
      brushGroup.selectAll("*").remove();
    };
  }, [brushX, isCmdPressed]);

  useMemo(() => {
    if (isAutoScrolling && maxTime - minTime > MAX_VIEW_TIME) {
      setScrollOffset(maxTime - minTime - MAX_VIEW_TIME);
    } else if (scrollOffset === maxTime - minTime - MAX_VIEW_TIME) {
      setIsAutoScrolling(true);
    }
  }, [maxTime, minTime, isAutoScrolling]);

  const handleScroll = (event: React.WheelEvent) => {
    setScrollOffset((prev) => {
      const newOffset = prev + event.deltaX * 10;
      return Math.max(0, Math.min(newOffset, maxTime - minTime - MAX_VIEW_TIME));
    });
    setIsAutoScrolling(false);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
      // onMouseLeave={() => setTooltip({ visible: false, data: null, x: 0, y: 0 })}
      onWheel={handleScroll}>
      <svg width="100%" height="100%">
        <g transform={`translate(0,${chartHeight - TIMELINE_LEGEND_HEIGHT})`} ref={xAxisRef} />
        <DashedLines
          chartHeight={chartHeight - MARGIN_VERTICAL}
          timeScale={timeScale}
          minTime={minTime}
          maxTime={maxTime}
        />
        <g className="requests">
          {rows.map((rowData, rowIndex) => (
            <RequestRow
              key={rowIndex}
              rowData={rowData}
              rowIndex={rowIndex}
              adjustedRowHeight={adjustedRowHeight}
              setTooltip={setTooltip}
              handleSelectedRequest={handleSelectedRequest}
              timeScale={timeScale}
            />
          ))}
        </g>
        {isCmdPressed && <g className="brush" ref={brushRef} />}
      </svg>
      {tooltip.visible && (
        <Tooltip
          d={tooltip.data!}
          isLeftSide={tooltip.x < window.innerWidth / 2}
          x={tooltip.x}
          y={tooltip.y}
        />
      )}
    </div>
  );
}

export default NetworkTimeline;
