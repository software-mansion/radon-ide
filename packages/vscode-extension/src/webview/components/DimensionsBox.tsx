import { Inspector } from "../hooks/useInspector";
import "./DimensionsBox.css";

const BOX_HEIGHT_FRACTION = 0.033;
const FONT_SIZE_FRACTION = 0.6;
const BORDER_RADIUS_FRACTION = 0.15;
const HORIZONTAL_PADDING_FRACTION = 0.3;
const ARROW_SIZE_FRACTION = 0.4;

const VERTICAL_POSITION_THRESHOLD = 0.3;
const HORIZONTAL_POSITION_THRESHOLD = 0.5;

const VERTICAL_ARROW_MARGIN = 0.015;
const HORIZONTAL_ARROW_MARGIN = 0.03;

type DimensionsBoxProps = {
  inspector: Inspector;
  wrapperDivRef: React.RefObject<HTMLDivElement>;
};

type DimensionsBoxPosition = "above" | "below" | "left" | "right" | "inside";

function DimensionsBox({ inspector, wrapperDivRef }: DimensionsBoxProps) {
  const { focusedElement } = inspector;

  if (!focusedElement) {
    return;
  }

  const exactDim = inspector.getExactDimensions(focusedElement);

  if (!exactDim) {
    return;
  }

  const fractionalDim = inspector.getFractionalDimensions(focusedElement);

  const width = parseFloat(exactDim.width.toFixed(2));
  const height = parseFloat(exactDim.height.toFixed(2));

  const previewDiv = wrapperDivRef.current?.childNodes?.[0] as unknown;

  if (
    !previewDiv ||
    typeof previewDiv !== "object" ||
    !("clientHeight" in previewDiv) ||
    typeof previewDiv.clientHeight !== "number"
  ) {
    return;
  }

  const { clientHeight: previewHeight } = previewDiv;

  const boxPosition: DimensionsBoxPosition = (() => {
    if (fractionalDim.top >= VERTICAL_POSITION_THRESHOLD) {
      return "above";
    } else if (fractionalDim.top + fractionalDim.height <= 1 - VERTICAL_POSITION_THRESHOLD) {
      return "below";
    } else if (fractionalDim.left + fractionalDim.width <= HORIZONTAL_POSITION_THRESHOLD) {
      return "right";
    } else if (fractionalDim.left >= 1 - HORIZONTAL_POSITION_THRESHOLD) {
      return "left";
    }
    return "inside";
  })();

  console.log("fractionalDimensionsBox boxPosition", boxPosition);

  const positionalProps = (() => {
    switch (boxPosition) {
      case "above":
        return {
          "--top": `${(fractionalDim.top - VERTICAL_ARROW_MARGIN) * 100}%`,
          "--left": `${(fractionalDim.left + fractionalDim.width / 2) * 100}%`,
          "--box-transform": "translate(-50%, -100%)",
        };
      case "below":
        return {
          "--top": `${(fractionalDim.top + fractionalDim.height + VERTICAL_ARROW_MARGIN) * 100}%`,
          "--left": `${(fractionalDim.left + fractionalDim.width / 2) * 100}%`,
          "--box-transform": "translate(-50%, 0%)",
        };
      case "right":
        return {
          "--top": `${(fractionalDim.top + fractionalDim.height / 2) * 100}%`,
          "--left": `${
            (fractionalDim.left + fractionalDim.width + HORIZONTAL_ARROW_MARGIN) * 100
          }%`,
          "--box-transform": "translate(0%, -50%)",
        };
      case "left":
        return {
          "--top": `${(fractionalDim.top + fractionalDim.height / 2) * 100}%`,
          "--left": `${(fractionalDim.left - HORIZONTAL_ARROW_MARGIN) * 100}%`,
          "--box-transform": "translate(-100%, -50%)",
        };
      default:
        return {
          "--top": `${(fractionalDim.top + fractionalDim.height / 2) * 100}%`,
          "--left": `${(fractionalDim.left + fractionalDim.width / 2) * 100}%`,
          "--box-transform": "translate(-50%, -50%)",
        };
    }
  })();

  const boxHeight = previewHeight * BOX_HEIGHT_FRACTION;

  const cssPropertiesForDimensionsBox = {
    "--box-height": `${boxHeight}px`,
    "--font-size": `${boxHeight * FONT_SIZE_FRACTION}px`,
    "--border-radius": `${boxHeight * BORDER_RADIUS_FRACTION}px`,
    "--horizontal-padding": `${boxHeight * HORIZONTAL_PADDING_FRACTION}px`,
    "--arrow-size": `${boxHeight * ARROW_SIZE_FRACTION}px`,
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
