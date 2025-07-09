import { DevicePropertiesFrame } from "../../utilities/deviceContants";

type DeviceFrameProps = {
  frame: DevicePropertiesFrame;
};

function DeviceFrame({ frame }: DeviceFrameProps) {
  if (!frame) {
    return null;
  }

  return frame.type === "mask" ? (
    <div style={{ "--phone-frame-image": `url(${frame.image})` } as React.CSSProperties} className="phone-bezel"></div>
  ) : (
    <img src={frame.image} className="phone-frame" />
  );
}

export default DeviceFrame;
