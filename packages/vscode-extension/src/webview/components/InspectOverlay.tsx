import { RefObject } from "react";
import { Frame } from "../../common/Project";
import { DeviceProperties } from "../utilities/deviceContants";
import DimensionsBox from "./DimensionsBox";

interface InspectOverlayProps {
  inspectFrame: Frame;
  isInspecting: boolean;
  device: DeviceProperties;
  wrapperDivRef: RefObject<HTMLDivElement | null>;
}

const getCssProperties = (frame: Frame): React.CSSProperties => {
  const width = `${frame.width * 100}%`;
  const height = `${frame.height * 100}%`;
  return {
    width: width,
    height: height,
    left: `${frame.x * 100}%`,
    top: `${frame.y * 100}%`,
  };
};

function InspectOverlay({
  inspectFrame,
  isInspecting,
  device,
  wrapperDivRef,
}: InspectOverlayProps) {
  const cssProperties = getCssProperties(inspectFrame);

  return (
    <div className="phone-screen phone-inspect-overlay">
      <div className="inspect-area" style={cssProperties} />
      {isInspecting && (
        <DimensionsBox device={device} frame={inspectFrame} wrapperDivRef={wrapperDivRef} />
      )}
    </div>
  );
}

export default InspectOverlay;
