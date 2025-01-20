import {
  DeviceProperties,
} from "../utilities/consts";

type DeviceFrameProps = {
  device: DeviceProperties | undefined;
  isFrameDisabled: boolean;
};

function DeviceFrame({ device, isFrameDisabled }: DeviceFrameProps) {
  if (!device) {
    return null;
  }

  return (
    <img
      src={device.frameImage}
      className="phone-frame"
      style={{
        opacity: isFrameDisabled ? 0 : 1,
      }}
    />
  );
}

export default DeviceFrame;