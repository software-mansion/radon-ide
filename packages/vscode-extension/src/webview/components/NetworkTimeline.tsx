import { useEffect, useRef, useMemo, useState } from "react";
import * as d3 from "d3";
import useNetworkTracker from "../hooks/useNetworkTracker";
import { useNetwork } from "../providers/NetworkProvider";
import { NetworkLog } from "../types/network";

const HEIGHT = 80;
const MARGIN_VERTICAL = 20;
const TIMELINE_LEGEND_HEIGHT = 20;
const SIDEBAR_MAX_WIDTH = 600;
const ROW_HEIGHT = 10;
const ROW_PADDING = 5;
const TIME_GAP_THRESHOLD = 100;
const CHART_MARGIN = 10;
const MAX_SIZE_BIG_SCREEN = 15000;
const MAX_SIZE_SMALL_SCREEN = 5000;
const MAX_VIEW_TIME =
  window.innerWidth > SIDEBAR_MAX_WIDTH ? MAX_SIZE_BIG_SCREEN : MAX_SIZE_SMALL_SCREEN;

interface NetworkFiltersProps {
  handleSelectedRequest: (id: string | null) => void;
}

const NetworkTimeline = ({ handleSelectedRequest }: NetworkFiltersProps) => {
  const { isClearing, filters, setFilters } = useNetwork();
  const networkLogs = useNetworkTracker();
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState(true);

  const getColorForSameService = (url: string) => {
    const urlObject = new URL(url);

    return `hsl(${urlObject.hostname.length * 10}, 70%, 50%)`;
  };

  const processedData = useMemo(() => {
    return networkLogs.networkLogs.map((d) => ({
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
    const renderHeight = HEIGHT - TIMELINE_LEGEND_HEIGHT - MARGIN_VERTICAL;
    const maxRows = Math.floor(renderHeight / (ROW_HEIGHT + ROW_PADDING));
    const adjustedRowHeight =
      rows.length > maxRows ? Math.max(2, renderHeight / rows.length - ROW_PADDING) : ROW_HEIGHT;

    const svg = container
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", HEIGHT)
      .style("background", "var(--swm-preview-background)");

    svg
      .append("g")
      .attr("transform", `translate(0,${HEIGHT - TIMELINE_LEGEND_HEIGHT})`)
      .call(xAxis);

    const dashedLineGroup = svg.append("g").attr("class", "dashed-lines");
    for (let i = minTime; i < maxTime; i += 1000) {
      dashedLineGroup
        .append("line")
        .attr("x1", timeScale(i))
        .attr("x2", timeScale(i))
        .attr("y1", 0)
        .attr("y2", HEIGHT - TIMELINE_LEGEND_HEIGHT)
        .attr("stroke", "var(--swm-default-text)")
        .attr("stroke-dasharray", "4,4");
    }

    const brush = d3
      .brushX()
      .extent([
        [CHART_MARGIN, 0],
        [containerWidth - CHART_MARGIN, HEIGHT - TIMELINE_LEGEND_HEIGHT],
      ])
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
        }
      });

    svg.append("g").attr("class", "brush").call(brush);

    svg.on("click", function (event) {
      console.log("click", event);
      const [x] = d3.pointer(event);
      const clickedRequest = processedData.find(
        (d) => x >= timeScale(d.startTimestamp) && x <= timeScale(d.endTimestamp)
      );
      if (clickedRequest) {
        handleSelectedRequest(clickedRequest.requestId);
      }
    });

    const rowGroups = svg
      .append("g")
      .attr("class", "requests")
      .selectAll(".request-row")
      .data(rows)
      .join(
        (enter) => enter.append("g").attr("class", "request-row"),
        (update) => update,
        (exit) => exit.remove()
      );

    rowGroups.each(function (rowData, rowIndex) {
      const rowGroup = d3.select(this);

      rowGroup
        .selectAll(".request-bar")
        .data(rowData, (d: any) => d.requestId)
        .join(
          (enter) =>
            enter
              .append("rect")
              .attr("class", "request-bar")
              .attr("x", (d) => timeScale(d.startTimestamp))
              .attr("y", rowIndex * (adjustedRowHeight + ROW_PADDING) + MARGIN_VERTICAL / 2)
              .attr("width", (d) =>
                Math.max(1, timeScale(d.endTimestamp) - timeScale(d.startTimestamp))
              )
              .attr("height", adjustedRowHeight)
              .attr("fill", (d) => getColorForSameService(d.url))
              .on("mouseover", function (event, d) {
                d3.select("body").selectAll(".tooltip").remove();
                const tooltip = d3.select("body").append("div").attr("class", "tooltip");
                tooltip
                  .style("position", "absolute")
                  .style("background", "var(--swm-input-background)")
                  .style("color", "var(--swm-default-text)")
                  .style("border", "1px")
                  .style("box-shadow", "var(--swm-input-shadow)")
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

                tooltip.transition().duration(50).style("opacity", 1);
              })
              .on("mouseout", function () {
                d3.select("body")
                  .selectAll(".tooltip")
                  .transition()
                  .duration(50)
                  .style("opacity", 0)
                  .remove();
              }),
          (update) =>
            update
              .transition()
              .duration(50)
              .attr("x", (d) => timeScale(d.startTimestamp))
              .attr("width", (d) =>
                Math.max(1, timeScale(d.endTimestamp) - timeScale(d.startTimestamp))
              ),

          (exit) => exit.transition().duration(50).style("opacity", 0).remove()
        );
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
  }, [processedData]);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: HEIGHT, overflowX: "hidden", paddingBlock: "20px" }}
    />
  );
};

export default NetworkTimeline;
