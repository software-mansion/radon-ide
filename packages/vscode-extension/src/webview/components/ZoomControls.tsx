import { useCallback } from "react";
import IconButton from "./shared/IconButton";
import * as Select from "@radix-ui/react-select";
import "./ZoomControls.css";

const ZOOM_STEP = 10;
const DEFAULT_ZOOM_LEVEL = 100;
const ZOOM_SELECT_NUMERIC_VALUES = [50, 100, 150, 200, 300];

export type ZoomLevelType = number | "Fit";

type ZoomControlsProps = {
  zoomLevel: ZoomLevelType;
  setZoomLevel: React.Dispatch<React.SetStateAction<ZoomLevelType>>;
};

const ZoomLevelSelect = ({ zoomLevel, setZoomLevel }: ZoomControlsProps) => {
  const onValueChange = useCallback(
    (e: string) => setZoomLevel(Number(e) || (e as ZoomLevelType)),
    [setZoomLevel]
  );

  return (
    <Select.Root onValueChange={onValueChange} value={zoomLevel.toString()}>
      <Select.Trigger className="zoom-select-trigger" disabled={false}>
        <Select.Value>
          <div className="zoom-select-value">
            {typeof zoomLevel === "string" ? zoomLevel : `${Math.floor(zoomLevel) / 100}x`}
          </div>
        </Select.Value>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className="zoom-select-content zoom-dropdown-menu-content"
          side="right"
          position="popper">
          <Select.Viewport className="zoom-select-viewport">
            <Select.SelectItem value="Fit" className="zoom-select-item">
              Fit
            </Select.SelectItem>
            <Select.Separator className="zoom-select-item-separator" />
            {ZOOM_SELECT_NUMERIC_VALUES.map((level) => (
              <Select.SelectItem key={level} value={level.toString()} className="zoom-select-item">
                {level / 100}x
              </Select.SelectItem>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
};

function ZoomControls({ zoomLevel, setZoomLevel }: ZoomControlsProps) {
  const handleZoom = useCallback(
    (shouldIncrease: boolean) => {
      setZoomLevel((currentZoomLevel: ZoomLevelType) => {
        const resolvedCurrentZoomLevel =
          typeof currentZoomLevel === "string" ? DEFAULT_ZOOM_LEVEL : currentZoomLevel;
        const newZoomLevel = resolvedCurrentZoomLevel + (shouldIncrease ? ZOOM_STEP : -ZOOM_STEP);

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
        className="zoom-out-button"
        tooltip={{
          label: "Zoom out",
          side: "top",
        }}
        onClick={handleZoomOut}>
        <span className="codicon codicon-zoom-out" />
      </IconButton>
      <ZoomLevelSelect zoomLevel={zoomLevel} setZoomLevel={setZoomLevel} />
      <IconButton
        className="zoom-in-button"
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
