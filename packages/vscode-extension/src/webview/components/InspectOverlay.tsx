import { RefObject } from "react";
import { DeviceRotationType, Frame } from "../../common/Project";
import { DeviceProperties } from "../utilities/deviceContants";
import DimensionsBox from "./DimensionsBox";
import { useProject } from "../providers/ProjectProvider";

interface InspectOverlayProps {
  inspectFrame: Frame;
  isInspecting: boolean;
  device: DeviceProperties;
  wrapperDivRef: RefObject<HTMLDivElement | null>;
}



const getCssProperties = (frame: Frame, rotation: DeviceRotationType): React.CSSProperties => {
  const width = `${frame.width * 100}%`;
  const height = `${frame.height * 100}%`;
  const top = `${frame.y * 100}%`;
  const left = `${frame.x * 100}%`;

  switch (rotation) {
    case DeviceRotationType.LandscapeRight:
      return {
        width: height,
        height: width,
        left: top,
        bottom: left,
      };
    case DeviceRotationType.LandscapeLeft:
      return {
        width: height,
        height: width,
        right: top,
        top: left,
      };
    default:
      // Portait
      return {
        width: width,
        height: height,
        left: `${frame.x * 100}%`,
        top: `${frame.y * 100}%`,
      };
  }
};

function InspectOverlay({
  inspectFrame,
  isInspecting,
  device,
  wrapperDivRef,
}: InspectOverlayProps) {
  const { projectState } = useProject();

  const cssProperties = getCssProperties(inspectFrame, projectState.rotation);

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
