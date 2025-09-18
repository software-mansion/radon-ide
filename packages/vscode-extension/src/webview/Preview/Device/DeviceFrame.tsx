import { DevicePropertiesFrame } from "../../utilities/deviceConstants";

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
    <img
      src={isLandscape ? frame.imageLandscape : frame.image}
      className="phone-frame"
      data-testid="device-frame"
    />
  );
}

export default DeviceFrame;
