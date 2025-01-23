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
         >
            {/* ZoomControl works in away that we change the height, and leave width auto which works for images,
            that have it's intrinsic width and height, but I couldn't achieve the same effect with the div,
            thus we add the image and use opacity 0 to hide it. */}
            <img src={frame.image} className="phone-bezel-image"/> 
         </div>
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