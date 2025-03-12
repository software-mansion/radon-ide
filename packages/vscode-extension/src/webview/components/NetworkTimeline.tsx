import { useEffect, useRef, useMemo, useState } from "react";
import * as d3 from "d3";
import useNetworkTracker from "../hooks/useNetworkTracker";
import { useNetwork } from "../providers/NetworkProvider";
import { NetworkLog } from "../types/network";

const HEIGHT = 100;
const SIDEBAR_MAX_WIDTH = 600;
const ROW_HEIGHT = 10;
const ROW_PADDING = 5;
const TIME_GAP_THRESHOLD = 100;
const CHART_MARGIN = 10;
const MAX_SIZE_BIG_SCREEN = 15000;
const MAX_SIZE_SMALL_SCREEN = 5000;
const MAX_VIEW_TIME =
  window.innerWidth > SIDEBAR_MAX_WIDTH ? MAX_SIZE_BIG_SCREEN : MAX_SIZE_SMALL_SCREEN;

const NetworkTimeline = () => {
  const { isClearing, filters, setFilters } = useNetwork();

  const networkData = useNetworkTracker();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);
  const [stopInserting, setStopInserting] = useState(false);
  const [currentData, setCurrentData] = useState(networkData);

  const getColorForSameService = (url: string) => {
    const urlObject = new URL(url);

    return `hsl(${urlObject.hostname.length * 10}, 70%, 50%)`;
  };

  const getColorForStatus = (status: number) => {
    if (status >= 200 && status < 300) {
      return "var(--vscode-charts-green)";
    } else if (status >= 300 && status < 400) {
      return "var(--vscode-charts-blue)";
    } else if (status >= 400 && status < 500) {
      return "var(--vscode-charts-orange)";
    } else {
      return "var(--vscode-charts-red)";
    }
  };

  useEffect(() => {
    if (!stopInserting) {
      setCurrentData(networkData);
    }
  }, [networkData]);

  const processedData = useMemo(() => {
    return currentData.map((d) => ({
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
  }, [currentData, isClearing]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const container = d3.select(containerRef.current);
    container.selectAll("*").remove();

    const containerWidth = containerRef.current.clientWidth;

    const minTime = d3.min(processedData, (d) => d.startTimestamp) || 0;
    const maxTime = d3.max(processedData, (d) => d.endTimestamp) || minTime + MAX_VIEW_TIME;

    if (isAutoScrolling && maxTime - minTime > MAX_VIEW_TIME) {
      setScrollOffset(maxTime - minTime - MAX_VIEW_TIME);
    }

    if (isClearing) {
      setScrollOffset(0);
    }

    if (scrollOffset === maxTime - minTime - MAX_VIEW_TIME) {
      setIsAutoScrolling(true);
    }

    const timeScale = d3
      .scaleLinear()
      .domain([minTime + scrollOffset, minTime + scrollOffset + MAX_VIEW_TIME])
      .range([CHART_MARGIN, containerWidth - CHART_MARGIN]);

    const xAxis = d3
      .axisBottom(timeScale)
      .ticks(MAX_VIEW_TIME / 1000)
      .tickValues(d3.range(minTime, maxTime, 1000))
      .tickFormat((d) => `${d.valueOf() - minTime} ms`);

    const placeRequestsInRows = (requests: NetworkLog[]) => {
      const rows: NetworkLog[][] = [];

      requests.forEach((req) => {
        let placed = false;
        for (const row of rows) {
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
          rows.push([req]);
        }
      });
      return rows;
    };

    const rows = placeRequestsInRows(processedData);
    const svgHeight = rows.length * (ROW_HEIGHT + ROW_PADDING) + 50;

    const svg = container
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", svgHeight)
      .style("background", "var(--swm-preview-background)");

    svg
      .append("g")
      .attr("transform", `translate(0,${svgHeight - 20})`)
      .call(xAxis);

    const brush = d3
      .brushX()
      .extent([
        [CHART_MARGIN, 0],
        [containerWidth - CHART_MARGIN, HEIGHT - 20],
      ])
      .on("start", () => {
        setStopInserting(true);
      })
      .on("brush", (event) => {
        const [start, end] = event.selection;
        if (start === end) {
          return;
        }
        const newDomain = [timeScale.invert(start), timeScale.invert(end)];
        console.log("newDomain", newDomain);
        setFilters({
          ...filters,
          timestampRange: {
            start: newDomain[0],
            end: newDomain[1],
          },
        });
      })
      .on("end", (event) => {
        if (!event.selection) {
          setIsAutoScrolling(true);
          setStopInserting(false);
        }
      });

    svg.append("g").attr("class", "brush").call(brush);

    const cursorLine = svg
      .append("line")
      .attr("class", "cursor-line")
      .attr("y1", 0)
      .attr("y2", svgHeight - 20)
      .attr("stroke", "gray")
      .attr("stroke-dasharray", "4")
      .style("opacity", 0);

    svg
      .on("mousemove", function (event) {
        const [x] = d3.pointer(event);
        cursorLine.attr("x1", x).attr("x2", x).style("opacity", 1);
      })
      .on("mouseleave", function () {
        cursorLine.style("opacity", 0);
      });

    const requestGroup = svg.append("g").attr("class", "requests");

    rows.forEach((row, rowIndex) => {
      const bars = requestGroup
        .selectAll(`.request-row-${rowIndex}`)
        .data(row, (d: any) => d.requestId)
        .enter()
        .append("g")
        .attr("class", `request-row-${rowIndex}`);

      bars
        .append("rect")
        .attr("x", (d) => timeScale(d.startTimestamp))
        .attr("y", rowIndex * (ROW_HEIGHT + ROW_PADDING) + 20)
        .attr("width", (d) => Math.max(1, timeScale(d.endTimestamp) - timeScale(d.startTimestamp)))
        .attr("height", ROW_HEIGHT)
        .attr("fill", (d) => getColorForSameService(d.url))

        .on("mouseover", function (event, d) {
          d3.select("body").selectAll(".tooltip").remove();
          const tooltip = d3.select("body").append("div").attr("class", "tooltip");
          tooltip
            .style("position", "absolute")
            .style("background", "var(--swm-url-select-background)")
            .style("border", `2px solid ${getColorForStatus(d.status)}`)
            .style("box-shadow", `0 2px 5px ${getColorForStatus(d.status)}`)
            .style("padding", "5px")
            .style("border-radius", "5px")
            .style("pointer-events", "none")
            .style("left", `${event.pageX + 10}px`)
            .style("top", `${event.pageY + 10}px`).html(`
              <strong>Request:</strong> ${d.requestId}<br/>
              <strong>URL:</strong> ${d.url}<br/>
              <strong>Method:</strong> ${d.method}<br/>
              <strong>Status:</strong> ${d.status}<br/>
              <strong>Duration:</strong> ${d.endTimestamp - d.startTimestamp} ms<br/>
            `);

          setTimeout(() => {
            tooltip.transition().duration(200).style("opacity", 1);
          }, 100);
        })
        .on("mouseout", function () {
          setTimeout(() => {
            d3.select("body")
              .selectAll(".tooltip")
              .transition()
              .duration(200)
              .style("opacity", 0)
              .remove();
          }, 300);
        });
    });

    const handleScroll = (event: WheelEvent) => {
      setScrollOffset((prev) => {
        const newOffset = prev + event.deltaX * 10;
        return Math.max(0, Math.min(newOffset, maxTime - minTime - MAX_VIEW_TIME));
      });
      setIsAutoScrolling(false);
    };

    containerRef.current.addEventListener("wheel", handleScroll, { passive: true });
    return () => containerRef.current?.removeEventListener("wheel", handleScroll);
  }, [processedData, scrollOffset]);

  return <div ref={containerRef} style={{ width: "100%", height: HEIGHT, overflowX: "hidden" }} />;
};

export default NetworkTimeline;
