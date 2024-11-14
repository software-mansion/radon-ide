import { useState, MouseEvent } from "react";
import { InspectData, InspectElement } from "../../common/Project";
import { throttle } from "../../utilities/throttle";
import { TouchPosition } from "../types";
import { useProject } from "../providers/ProjectProvider";
import { DeviceProperties } from "../utilities/consts";

export type InspectArea = {
  left: number,
  top: number,
  width: number,
  height: number,
};

export interface InspectorProps {
  deviceProperties?: DeviceProperties,
  onInspectElementLeftClicked: (item: InspectElement | undefined) => void,
  onInspectElementRightClicked: (item: InspectElement | undefined) => void
}

export interface Inspector {
  inspectData: InspectData | null,
  focusedElement: InspectElement | null,
  setFocusedElement: (element: InspectElement | null) => void,
  getFractionalDimensions: (element: InspectElement) => InspectArea
  getExactDimensions: (element: InspectElement) => InspectArea | null
  onMouseMove: (e: MouseEvent<HTMLDivElement>, touchPosition: TouchPosition) => void,
  onMouseDown: (e: MouseEvent<HTMLDivElement>, touchPosition: TouchPosition) => void,
  onMouseLeave: (e: MouseEvent<HTMLDivElement>, touchPosition: TouchPosition) => void,
  reset: () => void
}

export const useInspector = ({ 
  deviceProperties, 
  onInspectElementLeftClicked,
  onInspectElementRightClicked
}: InspectorProps): Inspector => {
  const { project } = useProject();

  const [inspectData, setInspectData] = useState<InspectData | null>(null);
  const [focusedElement, setFocusedElement] = useState<InspectElement | null>(null);

  function getFractionalDimensions(element: InspectElement): InspectArea {
    return {
      left: element.frame.x,
      top: element.frame.y,
      width: element.frame.width,
      height: element.frame.height
    };
  }

  function getExactDimensions(element: InspectElement): InspectArea | null {
    if (!deviceProperties) {
      return null;
    }

    const { screenHeight, screenWidth } = deviceProperties;

    return {
      left: element.frame.x * screenWidth,
      top: element.frame.y * screenHeight,
      width: element.frame.width * screenWidth,
      height: element.frame.height * screenHeight
    };
  }

  const sendInspectUnthrottled = (
    event: MouseEvent<HTMLDivElement>,
    touchPosition: { x: number, y: number },
    type: "Move" | "Leave" | "Down" | "RightButtonDown"
  ) => {
    if (type === "Leave") {
      return;
    }

    const { x: clampedX, y: clampedY } = touchPosition;
    
    project.inspectElementAt(clampedX, clampedY, (newInspectData) => {
        setInspectData({
          requestLocation: { x: event.clientX, y: event.clientY },
          stack: newInspectData.stack,
        });

        const firstItem = newInspectData?.stack?.find((item) => !item.hide);

        if (firstItem) {
          setFocusedElement(firstItem);
          if (type === 'Down') {
            onInspectElementLeftClicked(firstItem);
          } else if (type === 'RightButtonDown') {
            onInspectElementRightClicked(firstItem);
          }
        }
      });
  };

  const sendInspect = throttle(sendInspectUnthrottled, 50);

  const onMouseMove = (e: MouseEvent<HTMLDivElement>, touchPosition: TouchPosition) =>
    sendInspect(e, touchPosition, "Move", false);

  const onMouseDown = (e: MouseEvent<HTMLDivElement>, touchPosition: TouchPosition) =>
    sendInspect(e, touchPosition, e.button === 2 ? "RightButtonDown" : "Down", true);

  const onMouseLeave = (e: MouseEvent<HTMLDivElement>, touchPosition: TouchPosition) =>
    sendInspect(e, touchPosition, "Leave", true);

  const reset = () => {
    setInspectData(null);
    setFocusedElement(null);
  };

  return {
    inspectData,
    focusedElement,
    setFocusedElement,
    getFractionalDimensions,
    getExactDimensions,
    onMouseMove,
    onMouseDown,
    onMouseLeave,
    reset
  };
};