import { InspectData } from "../../common/Project";
import { DeviceProperties } from "../utilities/consts";
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
  device?: DeviceProperties;
  frame: InspectData["frame"];
  wrapperDivRef: React.RefObject<HTMLDivElement>;
};

type DimensionsBoxPosition = 'above' | 'below' | 'left' | 'right' | 'inside';

function DimensionsBox({ device, frame, wrapperDivRef } : DimensionsBoxProps) {
  if (!device) {
    return;
  }

  const width = parseFloat((frame.width * device.screenWidth).toFixed(2));
  const height = parseFloat((frame.height * device.screenHeight).toFixed(2));

  const previewDiv = wrapperDivRef.current?.childNodes?.[0] as unknown;

  if (!previewDiv || typeof previewDiv !== 'object' 
    || !('clientHeight' in previewDiv) 
    || typeof previewDiv.clientHeight !== 'number'
  ) {
    return;
  }

  const { clientHeight: previewHeight } = previewDiv;

  const boxHeight = previewHeight * BOX_HEIGHT_FRACTION;
  const fontSize = boxHeight * FONT_SIZE_FRACTION;
  const borderRadius = boxHeight * BORDER_RADIUS_FRACTION;
  const horizontalPadding = boxHeight * HORIZONTAL_PADDING_FRACTION;
  const arrowSize = boxHeight * ARROW_SIZE_FRACTION;

  const boxPosition: DimensionsBoxPosition = (() => {
    if (frame.y >= VERTICAL_POSITION_THRESHOLD) {return 'above';}
    else if (frame.y + frame.height <= 1 - VERTICAL_POSITION_THRESHOLD) {return 'below';}
    else if (frame.x + frame.width <= HORIZONTAL_POSITION_THRESHOLD) {return 'right';}
    else if (frame.x >= 1 - HORIZONTAL_POSITION_THRESHOLD) {return 'left';}
    return 'inside';
  })();

  const positionalProps = (() => {
    switch (boxPosition) {
      case 'above': 
        return {
          top: `${(frame.y - VERTICAL_ARROW_MARGIN) * 100}%`,
          left: `${(frame.x + frame.width/2) * 100}%`,
          transform: `translate(-50%, -100%)`
        };
      case 'below':
        return {
          top: `${(frame.y + frame.height + VERTICAL_ARROW_MARGIN) * 100}%`,
          left: `${(frame.x + frame.width/2) * 100}%`,
          transform: `translate(-50%, 0%)`
        };
      case 'right':
        return {
          top: `${(frame.y + frame.height/2) * 100}%`,
          left: `${(frame.x + frame.width + HORIZONTAL_ARROW_MARGIN) * 100}%`,
          transform: `translate(0%, -50%)`
        };
      case 'left':
        return {
          top: `${(frame.y + frame.height/2) * 100}%`,
          left: `${(frame.x - HORIZONTAL_ARROW_MARGIN) * 100}%`,
          transform: `translate(-100%, -50%)`
        };
      default: 
        return {
          top: `${(frame.y + frame.height/2) * 100}%`,
          left: `${(frame.x + frame.width/2) * 100}%`,
          transform: `translate(-50%, -50%)`
        }; 
    }
  })();

  return (
    <>
      { boxPosition !== 'inside' && (
        <div 
          className="arrow"
          style={{
            width: `${arrowSize}px`,
            height: `${arrowSize}px`,
            left: positionalProps.left,
            top: positionalProps.top,
          }}/>
        )
      }
      <div 
        className="dimensions-box" 
        style={{
          height: `${boxHeight}px`,
          fontSize: `${fontSize}px`,
          borderRadius: `${borderRadius}px`,
          paddingLeft: `${horizontalPadding}px`,
          paddingRight: `${horizontalPadding}px`,
          ...positionalProps
        }}
      >
        { width } × { height }
      </div> 
    </>
  );
};

export default DimensionsBox;