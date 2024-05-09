import { useCallback } from "react";
import IconButton from "./shared/IconButton";
import "./ZoomControls.css";

const ZOOM_STEP = 10;

type ZoomControlsProps = {
  disabled: boolean;
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>;
};

function ZoomControls({ disabled, setZoomLevel }: ZoomControlsProps) {
  const handleZoom = useCallback(
    (shouldIncrease: boolean) => {
      if (disabled) {
        return;
      }

      setZoomLevel((currentZoomLevel: number) => {
        const newZoomLevel = currentZoomLevel + (shouldIncrease ? ZOOM_STEP : -ZOOM_STEP);

        if (newZoomLevel < ZOOM_STEP) {
          return currentZoomLevel;
        }

        return newZoomLevel;
      });
    },
    [setZoomLevel, disabled]
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
