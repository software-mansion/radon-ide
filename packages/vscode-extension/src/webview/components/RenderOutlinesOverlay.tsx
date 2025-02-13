import { useEffect, useRef } from "react";
import { CanvasOutlineRenderer, OutlineRenderer, WorkerOutlineRenderer } from "react-scan";
import {
  RenderOutlinesEventListener,
  RenderOutlinesEventMap,
  RenderOutlinesInterface,
} from "../../common/RenderOutlines";
import { makeProxy } from "../utilities/rpc";

const RenderOutlines = makeProxy<RenderOutlinesInterface>("RenderOutlines");

function getDpr() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Size {
  width: number;
  height: number;
}

function mergeRects(lhs: Rect, rhs: Rect): Rect {
  const minX = Math.min(lhs.x, rhs.x);
  const minY = Math.min(lhs.y, rhs.y);
  const maxX = Math.max(lhs.x + lhs.width, rhs.x + rhs.width);
  const maxY = Math.max(lhs.y + lhs.height, rhs.y + rhs.height);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function createOutlineRenderer(canvas: HTMLCanvasElement, size: Size, dpr: number) {
  try {
    return new WorkerOutlineRenderer(canvas, size, dpr);
  } catch {
    return new CanvasOutlineRenderer(canvas, size, dpr);
  }
}

function RenderOutlinesOverlay() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outlineRendererRef = useRef<OutlineRenderer | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvasEl = canvasRef.current;
    if (!host || !canvasEl) {
      return;
    }

    const dpr = getDpr();
    let size = { width: hostRef.current.clientWidth, height: host.clientHeight };

    outlineRendererRef.current ??= createOutlineRenderer(canvasEl, size, dpr);
    const outlineRenderer = outlineRendererRef.current;

    const blueprintListener: RenderOutlinesEventListener<
      RenderOutlinesEventMap["rendersReported"]
    > = ({ blueprintOutlines }) => {
      const outlines = blueprintOutlines.flatMap(([fiberId, blueprint]) => {
        const horizontalScale = size.width * dpr;
        const verticalScale = size.height * dpr;
        if (blueprint.elements.length === 0) {
          return [];
        }
        const boundingRect = blueprint.elements.reduce(mergeRects);
        const outline = {
          id: fiberId,
          name: blueprint.name,
          count: blueprint.count,
          x: boundingRect.x * horizontalScale,
          y: boundingRect.y * verticalScale,
          width: boundingRect.width * horizontalScale,
          height: boundingRect.height * verticalScale,
          didCommit: blueprint.didCommit,
        };
        return [outline];
      });
      outlineRenderer.renderOutlines(outlines);
    };
    RenderOutlines.addEventListener("rendersReported", blueprintListener);

    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = host.getBoundingClientRect();
      size = { width, height };
      outlineRenderer.resize(size);
    });
    resizeObserver.observe(host);

    return () => {
      RenderOutlines.removeEventListener("rendersReported", blueprintListener);
      resizeObserver.disconnect();
    };
  }, [hostRef.current, canvasRef.current]);

  return (
    <div
      ref={hostRef}
      style={{
        position: "absolute",
        left: "7px",
        right: "7px",
        top: 0,
        bottom: 0,
      }}>
      <canvas
        ref={canvasRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          zIndex: 2147483646,
        }}
        aria-hidden="true"></canvas>
    </div>
  );
}
export default RenderOutlinesOverlay;
