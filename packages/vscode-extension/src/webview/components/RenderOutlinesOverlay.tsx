import { useEffect, useRef, useState } from "react";
import { CanvasOutlineRenderer, OutlineRenderer, WorkerOutlineRenderer } from "react-scan";
import {
  RenderOutlinesEventListener,
  RenderOutlinesEventMap,
  RenderOutlinesInterface,
} from "../../common/RenderOutlines";
import { makeProxy } from "../utilities/rpc";
import "./RenderOutlinesOverlay.css";

const RenderOutlines = makeProxy<RenderOutlinesInterface>("RenderOutlines");

function getDpr() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

interface Size {
  width: number;
  height: number;
}

function createOutlineRenderer(canvas: HTMLCanvasElement, size: Size, dpr: number) {
  try {
    return new WorkerOutlineRenderer(canvas, size, dpr);
  } catch {
    return new CanvasOutlineRenderer(canvas, size, dpr);
  }
}

function useIsEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const listener: RenderOutlinesEventListener<RenderOutlinesEventMap["isEnabledChanged"]> = ({
      isEnabled,
    }) => {
      setEnabled(isEnabled);
    };
    RenderOutlines.addEventListener("isEnabledChanged", listener);
    return () => {
      RenderOutlines.removeEventListener("isEnabledChanged", listener);
    };
  }, []);

  return enabled;
}

function RenderOutlinesOverlay() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outlineRendererRef = useRef<OutlineRenderer | null>(null);
  const outlineRendererEnabled = useIsEnabled();

  useEffect(() => {
    if (!outlineRendererEnabled) {
      const outlineRenderer: any = outlineRendererRef.current;
      outlineRenderer?.worker?.terminate();
      outlineRendererRef.current = null;
      return;
    }

    const host = hostRef.current;
    const canvasEl = canvasRef.current;
    if (!host || !canvasEl) {
      return;
    }

    const dpr = getDpr();
    let size = { width: host.clientWidth, height: host.clientHeight };

    outlineRendererRef.current ??= createOutlineRenderer(canvasEl, size, dpr);
    const outlineRenderer = outlineRendererRef.current;

    const blueprintListener: RenderOutlinesEventListener<
      RenderOutlinesEventMap["rendersReported"]
    > = ({ blueprintOutlines }) => {
      const outlines = blueprintOutlines.flatMap(([fiberId, blueprint]) => {
        const { name, count, boundingRect, didCommit } = blueprint;
        const horizontalScale = size.width;
        const verticalScale = size.height;
        const outline = {
          id: fiberId,
          name: name,
          count: count,
          x: boundingRect.x * horizontalScale,
          y: boundingRect.y * verticalScale,
          width: boundingRect.width * horizontalScale,
          height: boundingRect.height * verticalScale,
          didCommit: didCommit,
        };
        return [outline];
      });
      outlineRenderer.renderOutlines(outlines);
    };
    RenderOutlines.addEventListener("rendersReported", blueprintListener);

    const resizeObserver = new ResizeObserver((entries) => {
      const hostIndex = entries.findIndex((entry) => entry.target === host);
      if (hostIndex === -1) {
        return;
      }
      const { width, height } = entries[hostIndex].contentRect;
      size = { width, height };
      outlineRenderer.resize(size);
    });
    resizeObserver.observe(host);

    return () => {
      RenderOutlines.removeEventListener("rendersReported", blueprintListener);
      resizeObserver.disconnect();
    };
  }, [hostRef.current, canvasRef.current, outlineRendererEnabled]);

  return (
    outlineRendererEnabled && (
      <div ref={hostRef} className="phone-screen not-masked">
        <canvas ref={canvasRef} className="render-outlines-overlay" aria-hidden="true"></canvas>
      </div>
    )
  );
}
export default RenderOutlinesOverlay;
