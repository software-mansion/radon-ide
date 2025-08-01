import { RefObject, useCallback, useState } from "react";
import * as Select from "@radix-ui/react-select";
import IconButton from "./shared/IconButton";
import { ZoomLevelType } from "../../common/Project";
import { DeviceProperties } from "../utilities/deviceConstants";
import "./ZoomControls.css";
import { useDeviceFrame } from "../Preview/Device/hooks";

const ZOOM_STEP = 0.05;
const ZOOM_SELECT_NUMERIC_VALUES = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
export const DEVICE_DEFAULT_SCALE = 1 / 3;
export const MIN_ZOOM_LEVEL = 0.4;

type ZoomControlsProps = {
  zoomLevel: ZoomLevelType;
  onZoomChanged: (zoom: ZoomLevelType) => void;
  device?: DeviceProperties;
  wrapperDivRef?: RefObject<HTMLDivElement | null>;
  setIsSelectOpen?: (open: boolean) => void;
};

const ZoomLevelSelect = ({ zoomLevel, onZoomChanged, setIsSelectOpen }: ZoomControlsProps) => {
  const onValueChange = useCallback(
    (e: string) => {
      if (e === "Fit") {
        onZoomChanged("Fit");
        return;
      }
      onZoomChanged(Number(e));
    },
    [onZoomChanged]
  );

  const hasTwoDecimalPrecision = zoomLevel !== "Fit" && zoomLevel.toString().length > 3;
  const fontStretchStyle = hasTwoDecimalPrecision ? "ultra-condensed" : "semi-condensed";

  return (
    <Select.Root
      onOpenChange={setIsSelectOpen}
      onValueChange={onValueChange}
      value={zoomLevel === "Fit" ? "Fit" : zoomLevel.toString()}>
      <Select.Trigger className="zoom-select-trigger" disabled={false}>
        <Select.Value>
          <div style={{ fontStretch: fontStretchStyle }} className="zoom-select-value">
            {zoomLevel === "Fit" ? "Fit" : `${zoomLevel}x`}
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
                {level}x
              </Select.SelectItem>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
};

function ZoomControls({ zoomLevel, onZoomChanged, device, wrapperDivRef }: ZoomControlsProps) {
  const frame = useDeviceFrame(device!);
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  function handleZoom(shouldIncrease: boolean) {
    let currentZoomLevel;
    if (zoomLevel === "Fit") {
      currentZoomLevel =
        ((wrapperDivRef!.current!.offsetHeight / frame.height) * 1) / DEVICE_DEFAULT_SCALE;
    } else {
      currentZoomLevel = zoomLevel;
    }
    // toFixed() is necessary because of floating point rounding errors
    const zoomAfterStep = currentZoomLevel + (shouldIncrease ? ZOOM_STEP : -ZOOM_STEP);
    const newZoomLevel = +(zoomAfterStep > MIN_ZOOM_LEVEL ? zoomAfterStep : MIN_ZOOM_LEVEL).toFixed(
      2
    );

    if (newZoomLevel >= ZOOM_STEP) {
      onZoomChanged(newZoomLevel);
    }
  }

  return (
    <div className={`zoom-controls ${isSelectOpen ? "select-open" : ""}`}>
      <IconButton
        className="zoom-in-button"
        tooltip={{
          label: "Zoom in",
          side: "top",
        }}
        onClick={() => handleZoom(true)}>
        <span className="codicon codicon-zoom-in" />
      </IconButton>
      <ZoomLevelSelect
        zoomLevel={zoomLevel}
        onZoomChanged={onZoomChanged}
        setIsSelectOpen={setIsSelectOpen}
      />
      <IconButton
        className="zoom-out-button"
        tooltip={{
          label: "Zoom out",
          side: "bottom",
        }}
        onClick={() => handleZoom(false)}>
        <span className="codicon codicon-zoom-out" />
      </IconButton>
    </div>
  );
}

export default ZoomControls;
