const {
  Dimensions,
  Text,
  View,
} = require("react-native");

const BOX_HEIGHT_FRACTION = 0.033;
const FONT_SIZE_FRACTION = 0.6;
const BORDER_RADIUS_FRACTION = 0.15;
const HORIZONTAL_PADDING_FRACTION = 0.3;

const VERTICAL_POSITION_THRESHOLD = 0.3;
const HORIZONTAL_POSITION_THRESHOLD = 0.5;

const VERTICAL_ARROW_MARGIN = 10;
const HORIZONTAL_ARROW_MARGIN = 20;

function DimensionsBox({ frame }) {
  const width = parseFloat(frame.width.toFixed(2));
  const height = parseFloat(frame.height.toFixed(2));
  const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");

  const boxPosition = (() => {
    if (frame.y / screenHeight >= VERTICAL_POSITION_THRESHOLD) {
      return "above";
    } else if ((frame.y + frame.height) / screenHeight <= 1 - VERTICAL_POSITION_THRESHOLD) {
      return "below";
    } else if ((frame.x + frame.width) / screenWidth <= HORIZONTAL_POSITION_THRESHOLD) {
      return "right";
    } else if (frame.x / screenWidth >= 1 - HORIZONTAL_POSITION_THRESHOLD) {
      return "left";
    }
    return "inside";
  })();

  const positionalProps = (() => {
    switch (boxPosition) {
      case "above":
        const res = {
          top: frame.y - VERTICAL_ARROW_MARGIN,
          left: frame.x + frame.width / 2,
          transform: "translate(-50%, -100%)",
        };
        return res;
      case "below":
        return {
          top: frame.y + frame.height + VERTICAL_ARROW_MARGIN,
          left: frame.x + frame.width / 2,
          transform: "translate(-50%, 0%)",
        };
      case "right":
        return {
          top: frame.y + frame.height / 2,
          left: frame.x + frame.width + HORIZONTAL_ARROW_MARGIN,
          transform: "translate(0%, -50%)",
        };
      case "left":
        return {
          top: frame.y + frame.height / 2,
          left: frame.x - HORIZONTAL_ARROW_MARGIN,
          transform: "translate(-100%, -50%)",
        };
      default:
        return {
          top: frame.y + frame.height / 2,
          left: frame.x + frame.width / 2,
          transform: "translate(-50%, -50%)",
        };
    }
  })();

  const boxHeight = screenHeight * BOX_HEIGHT_FRACTION;

  const cssPropertiesForDimensionsBox = {
    height: boxHeight,
    justifyContent: "center",
    paddingLeft: boxHeight * HORIZONTAL_PADDING_FRACTION,
    paddingRight: boxHeight * HORIZONTAL_PADDING_FRACTION,
    borderRadius: boxHeight * BORDER_RADIUS_FRACTION,
    fontSize: boxHeight * FONT_SIZE_FRACTION,
    backgroundColor: "rgb(64, 64, 64)",
    position: "absolute",
    alignItems: "center",
  };

  return (
    <View
      style={{
        ...cssPropertiesForDimensionsBox,
        ...positionalProps,
      }}>
      <Text style={{ color: "rgb(101, 123, 131)" }}>
        {width} × {height}
      </Text>
    </View>
  );
}


export default {
    DimensionsBox
  };
  