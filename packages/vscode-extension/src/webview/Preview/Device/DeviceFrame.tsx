import { DevicePropertiesFrame } from "../../utilities/deviceContants";

type DeviceFrameProps = {
  frame: DevicePropertiesFrame;
  isLandscape?: boolean;
};

function DeviceFrame({ frame, isLandscape }: DeviceFrameProps) {
  if (!frame) {
    return null;
  }

  return frame.type === "mask" ? (
    <div className="phone-bezel"></div>
  ) : (
    <span>
      <img src={ frame.imageLandscape} style={{visibility: isLandscape ? "visible" : 'hidden'}} className="phone-frame" />
      <img src={ frame.image} style={{visibility: isLandscape ? "hidden" : 'visible'}} className="phone-frame" />
    </span>
  );
}

export default DeviceFrame;
