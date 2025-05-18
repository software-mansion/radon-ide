import { Frame } from "../../common/DeviceSessionsManager";
import { DeviceProperties } from "../utilities/deviceContants";
import "./DimensionsBox.css";

const VERTICAL_POSITION_THRESHOLD = 0.3;
const HORIZONTAL_POSITION_THRESHOLD = 0.5;

const ARROW_SIZE = 8;

type DimensionsBoxProps = {
  device?: DeviceProperties;
  frame: Frame;
  wrapperDivRef: React.RefObject<HTMLDivElement | null>;
};

type DimensionsBoxPosition = "above" | "below" | "left" | "right" | "inside";

function DimensionsBox({ device, frame, wrapperDivRef }: DimensionsBoxProps) {
  if (!device) {
    return;
  }

  const width = parseFloat((frame.width * device.screenWidth).toFixed(2));
  const height = parseFloat((frame.height * device.screenHeight).toFixed(2));

  const previewDiv = wrapperDivRef.current?.childNodes?.[0] as unknown;

  if (
    !previewDiv ||
    typeof previewDiv !== "object" ||
    !("clientHeight" in previewDiv) ||
    typeof previewDiv.clientHeight !== "number"
  ) {
    return;
  }

  const boxPosition: DimensionsBoxPosition = (() => {
    if (frame.y >= VERTICAL_POSITION_THRESHOLD) {
      return "above";
    } else if (frame.y + frame.height <= 1 - VERTICAL_POSITION_THRESHOLD) {
      return "below";
    } else if (frame.x + frame.width <= HORIZONTAL_POSITION_THRESHOLD) {
      return "right";
    } else if (frame.x >= 1 - HORIZONTAL_POSITION_THRESHOLD) {
      return "left";
    }
    return "inside";
  })();

  const positionalProps = (() => {
    switch (boxPosition) {
      case "above":
        return {
          "--top": `${frame.y * 100}%`,
          "--left": `${(frame.x + frame.width / 2) * 100}%`,
          "--box-transform": "translate(-50%, -100%)",
          "--margin": `-${ARROW_SIZE}px 0 0 0`,
        };
      case "below":
        return {
          "--top": `${(frame.y + frame.height) * 100}%`,
          "--left": `${(frame.x + frame.width / 2) * 100}%`,
          "--box-transform": "translate(-50%, 0%)",
          "--margin": `${ARROW_SIZE}px 0 0 0`,
        };
      case "right":
        return {
          "--top": `${(frame.y + frame.height / 2) * 100}%`,
          "--left": `${(frame.x + frame.width) * 100}%`,
          "--box-transform": "translate(0%, -50%)",
          "--margin": `0 0 0 ${ARROW_SIZE}px`,
        };
      case "left":
        return {
          "--top": `${(frame.y + frame.height / 2) * 100}%`,
          "--left": `${frame.x * 100}%`,
          "--box-transform": "translate(-100%, -50%)",
          "--margin": `0 0 0 -${ARROW_SIZE}px`,
        };
      default:
        return {
          "--top": `${(frame.y + frame.height / 2) * 100}%`,
          "--left": `${(frame.x + frame.width / 2) * 100}%`,
          "--box-transform": "translate(-50%, -50%)",
          "--margin": `0 0 0 0`,
        };
    }
  })();

  const cssPropertiesForDimensionsBox = {
    "--arrow-size": `${ARROW_SIZE}px`,
    ...positionalProps,
  };

  return (
    <div style={cssPropertiesForDimensionsBox}>
      {boxPosition !== "inside" && <div className="arrow" />}
      <div className="dimensions-box">
        {width} × {height}
      </div>
    </div>
  );
}

export default DimensionsBox;
