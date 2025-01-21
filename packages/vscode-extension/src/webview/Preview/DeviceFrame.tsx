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

  if (isFrameDisabled) {
      return (
         <div 
            className="phone-bezel"
         />
      );
  }

  return (
      <img
         src={device.frameImage}
         className="phone-frame"
      />
  );
}

export default DeviceFrame;