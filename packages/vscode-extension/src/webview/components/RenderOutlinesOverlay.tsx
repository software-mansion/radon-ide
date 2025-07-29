import { useEffect, useRef } from "react";
import { CanvasOutlineRenderer, OutlineRenderer } from "react-scan";
import {
  RenderOutlinesEventListener,
  RenderOutlinesEventMap,
  RenderOutlinesInterface,
  RENDER_OUTLINES_PLUGIN_ID,
} from "../../common/RenderOutlines";
import { makeProxy } from "../utilities/rpc";
import "./RenderOutlinesOverlay.css";
import { useProject } from "../providers/ProjectProvider";
import { appToPreviewCoordinates } from "../utilities/transformAppCoordinates";

const RenderOutlines = makeProxy<RenderOutlinesInterface>("RenderOutlines");

function getDpr() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

interface Size {
  width: number;
  height: number;
}

function createOutlineRenderer(canvas: HTMLCanvasElement, size: Size, dpr: number) {
  return new CanvasOutlineRenderer(canvas, size, dpr);
}

function useIsEnabled() {
  const { selectedDeviceSession } = useProject();
  return selectedDeviceSession?.toolsState[RENDER_OUTLINES_PLUGIN_ID]?.enabled;
}

function RenderOutlinesOverlay() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outlineRendererRef = useRef<OutlineRenderer | null>(null);
  const outlineRendererEnabled = useIsEnabled();
  const { projectState, selectedDeviceSession } = useProject();

  if (selectedDeviceSession?.status !== "running") {
    return;
  }

  const orientationRef = useRef({
    deviceOrientation: projectState.rotation,
    appOrientation: selectedDeviceSession.appOrientation,
  });

  useEffect(() => {
    orientationRef.current = {
      deviceOrientation: projectState.rotation,
      appOrientation: selectedDeviceSession.appOrientation,
    };
  }, [projectState.rotation, selectedDeviceSession.appOrientation]);

  useEffect(() => {
    if (!outlineRendererEnabled) {
      outlineRendererRef.current?.dispose();
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
        const frameRect = appToPreviewCoordinates(
          orientationRef.current.appOrientation,
          orientationRef.current.deviceOrientation,
          boundingRect
        );
        const outline = {
          id: fiberId,
          name: name,
          count: count,
          x: frameRect.x * horizontalScale,
          y: frameRect.y * verticalScale,
          width: frameRect.width * horizontalScale,
          height: frameRect.height * verticalScale,
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
