import {
  DevicePropertiesFrame,
} from "../../utilities/consts";

type DeviceFrameProps = {
  frame: DevicePropertiesFrame;
};

function DeviceFrame({ frame }: DeviceFrameProps) {
  if (!frame) {
    return null;
  }

  if (frame.type === "mask") {
      return (
         <div 
            style={{"--phone-frame-image": `url(${frame.image})`,}}
            className="phone-bezel"
         />
      );
  }

  return (
      <img
         src={frame.image}
         className="phone-frame"
      />
  );
}

export default DeviceFrame;