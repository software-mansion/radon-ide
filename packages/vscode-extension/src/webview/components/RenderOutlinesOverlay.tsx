import { useEffect,  useRef } from "react";
import { CanvasOutlineRenderer } from "react-scan";
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

function RenderOutlinesOverlay() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scheduledOutlines = useRef<Parameters<CanvasOutlineRenderer["renderOutlines"]>[0]>([]);
  const outlineRendererRef = useRef<CanvasOutlineRenderer | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const canvasEl = canvasRef.current;
    if (!canvasEl) {
      return;
    }

    const dpr = getDpr();
    const size = { width: hostRef.current.clientWidth, height: host.clientHeight };

    outlineRendererRef.current ??= new CanvasOutlineRenderer(canvasEl, size, dpr);

    const outlineRenderer = outlineRendererRef.current;

    const blueprintListener: RenderOutlinesEventListener<
      RenderOutlinesEventMap["rendersReported"]
    > = ({ blueprintOutlines }) => {
      blueprintOutlines.forEach(([fiberId, blueprint]) => {
        const horizontalScale = size.width * dpr;
        const verticalScale = size.height * dpr;
        const outline = {
          id: fiberId,
          name: blueprint.name,
          count: blueprint.count,
          x: blueprint.elements[0].x * horizontalScale,
          y: blueprint.elements[0].y * verticalScale,
          width: blueprint.elements[0].width * horizontalScale,
          height: blueprint.elements[0].height * verticalScale,
          didCommit: blueprint.didCommit,
        };
        scheduledOutlines.current.push(outline);
        if (scheduledOutlines.current.length === 1) {
          setTimeout(() => {
            outlineRenderer.renderOutlines(scheduledOutlines.current);
            scheduledOutlines.current = [];
          });
        }
      });
    };
    RenderOutlines.addEventListener("rendersReported", blueprintListener);

    return () => {
      RenderOutlines.removeEventListener("rendersReported", blueprintListener);
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
