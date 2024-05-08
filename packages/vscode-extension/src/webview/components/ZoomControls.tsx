import { useCallback } from "react";
import IconButton from "./shared/IconButton";
import "./ZoomControls.css";

const ZOOM_STEP = 10;

function ZoomControls({ setZoomLevel }) {
  const handleZoom = useCallback(
    (shouldIncrease: boolean) => {
      setZoomLevel((currentZoomLevel: number) => {
        const newZoomLevel = currentZoomLevel + (shouldIncrease ? ZOOM_STEP : -ZOOM_STEP);

        if (newZoomLevel < ZOOM_STEP) {
          return currentZoomLevel;
        }

        return newZoomLevel;
      });
    },
    [setZoomLevel]
  );

  const handleZoomIn = useCallback(() => handleZoom(true), [handleZoom]);
  const handleZoomOut = useCallback(() => handleZoom(false), [handleZoom]);

  return (
    <div className="zoom-controls">
      <IconButton
        tooltip={{
          label: "Zoom in",
          side: "left",
        }}
        onClick={handleZoomIn}>
        <span className="codicon codicon-zoom-in" />
      </IconButton>
      <IconButton
        tooltip={{
          label: "Zoom out",
          side: "left",
        }}
        onClick={handleZoomOut}>
        <span className="codicon codicon-zoom-out" />
      </IconButton>
    </div>
  );
}

export default ZoomControls;
