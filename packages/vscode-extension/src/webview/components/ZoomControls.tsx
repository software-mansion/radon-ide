import { useCallback } from "react";
import IconButton from "./shared/IconButton";
import "./ZoomControls.css";

const ZOOM_STEP = 10;

type ZoomControlsProps = {
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
};

function ZoomControls({ setZoomLevel }: ZoomControlsProps) {
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
          label: "Zoom out",
          side: "top",
        }}
        onClick={handleZoomOut}>
        <span className="codicon codicon-zoom-out" />
      </IconButton>
      <IconButton
        tooltip={{
          label: "Zoom in",
          side: "top",
        }}
        onClick={handleZoomIn}>
        <span className="codicon codicon-zoom-in" />
      </IconButton>
    </div>
  );
}

export default ZoomControls;
