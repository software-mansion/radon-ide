import { RefObject } from "react";
import { Frame } from "../../common/Project";
import { DeviceProperties } from "../utilities/deviceConstants";
import DimensionsBox from "./DimensionsBox";
import { appToPreviewCoordinates } from "../utilities/transformAppCoordinates";
import { useProject } from "../providers/ProjectProvider";

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
  const { selectedDeviceSession, projectState } = useProject();
  if (selectedDeviceSession?.status !== "running") {
    return null;
  }
  const translatedInspectFrame = appToPreviewCoordinates(
    selectedDeviceSession?.appOrientation,
    projectState.rotation,
    inspectFrame
  );

  const cssProperties = getCssProperties(translatedInspectFrame);
  return (
    <div className="phone-screen phone-inspect-overlay">
      <div className="inspect-area" style={cssProperties} />
      {isInspecting && (
        <DimensionsBox
          device={device}
          frame={translatedInspectFrame}
          wrapperDivRef={wrapperDivRef}
        />
      )}
    </div>
  );
}

export default InspectOverlay;
