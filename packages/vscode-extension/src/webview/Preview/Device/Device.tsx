import React, { useRef, useEffect, useMemo } from "react";
import { Resizable, ResizableProps } from "re-resizable";

import DeviceFrame from "./DeviceFrame";
import { useDeviceFrame } from "./hooks";
import { useProject } from "../../providers/ProjectProvider";
import { DeviceProperties, DevicePropertiesFrame } from "../../utilities/deviceContants";
import { DeviceRotationType } from "../../../common/Project";

const MIN_HEIGHT = 350;
const CSS_MARGIN_FACTOR = 0.9;

type ResizablePropsSize = string | number | undefined;

interface DeviceProps {
  device: DeviceProperties;
  resizableProps: ResizableProps;
  children: React.ReactNode;
  wrapperDivRef: React.RefObject<HTMLDivElement | null>;
}

type DeviceCSSProperties = React.CSSProperties & {
  "--phone-content-min-height"?: string;
  "--phone-content-min-width"?: string;
  "--phone-content-width"?: string;
  "--phone-content-height"?: string;
  "--phone-screen-height"?: string;
  "--phone-screen-width"?: string;
  "--phone-aspect-ratio"?: string;
  "--phone-top"?: string;
  "--phone-left"?: string;
  "--phone-mask-image"?: string;
  "--content-rotate"?: string;
  "--phone-wrapper-min-width"?: string;
  "--phone-wrapper-min-height"?: string;
  "--phone-frame-image"?: string;
  "--phone-touch-area-width"?: string;
  "--phone-touch-area-height"?: string;
  "--phone-touch-area-top"?: string;
  "--phone-touch-area-left"?: string;
  "--phone-touch-area-screen-height"?: string;
  "--phone-touch-area-screen-width"?: string;
  "--phone-touch-area-screen-top"?: string;
  "--phone-touch-area-screen-left"?: string;
  "--frame-rotation"?: string;
};

function getParentDimensions(wrapperDivRef: React.RefObject<HTMLDivElement | null>) {
  const parentElement = wrapperDivRef.current;

  return {
    width: parentElement?.clientWidth || window.innerWidth,
    height: parentElement?.clientHeight || window.innerHeight,
  };
}

function calculateLandscapeProperties(
  aspectRatio: number,
  parentDimensions: { width: number; height: number },
  resizableHeight: ResizablePropsSize
) {
  const { width: parentWidth } = parentDimensions;
  // const isFitSet = typeof resizableHeight === "string";

  const minWidth = MIN_HEIGHT;
  const minHeight = minWidth * aspectRatio;
  const adjustedWidth = Math.max(parentWidth * CSS_MARGIN_FACTOR, minWidth);
  // const adjustedHeight = (isFitSet ? scaledHeight : (resizableHeight as number) || scaledHeight) * CSS_MARGIN_FACTOR;
  // const adjustedHeight = 'auto'
  const adjustedHeight = adjustedWidth * aspectRatio;

  return {
    width: `${adjustedWidth}px`,
    height: `${adjustedHeight}px`,
    minWidth: `${minWidth}px`,
    minHeight: `${minHeight}px`,
  };
}

function cssPropertiesForDevice(
  device: DeviceProperties,
  frame: DevicePropertiesFrame,
  rotation: DeviceRotationType,
  wrapperDivRef: React.RefObject<HTMLDivElement | null>,
  resizableHeight: ResizablePropsSize
): DeviceCSSProperties {
  const aspectRatio = frame.width / frame.height;
  const isLandscape =
    rotation === DeviceRotationType.LandscapeLeft || rotation === DeviceRotationType.LandscapeRight;

  const parentDimensions = getParentDimensions(wrapperDivRef);

  let newHeight = `min(100%, max(${MIN_HEIGHT}px, ${(parentDimensions.width / aspectRatio) * CSS_MARGIN_FACTOR}px))`;
  let newWidth = "auto";
  let minWidth = "fit-content";
  let minHeight = `${MIN_HEIGHT}px`;
  let screenHeight = `${(device.screenHeight / frame.height) * 100}%`;
  let screenWidth = `${(device.screenWidth / frame.width) * 100}%`;
  let phoneTop = `${(frame.offsetY / frame.height) * 100}%`;
  let phoneLeft = `${(frame.offsetX / frame.width) * 100}%`;
  let maskImage = `url(${device.maskImage})`;
  let frameImage = `url(${frame.image})`;
  let touchAreaWidth = "calc(var(--phone-screen-width) + 14px)";
  let touchAreaHeight = "var(--phone-screen-height)";
  let touchAreaTop = "var(--phone-top)";
  let touchAreaLeft = "calc(var(--phone-left) - 7px)";
  let touchAreaScreenHeight = "100%";
  let touchAreaScreenWidth = "calc(100% - 14px)";
  let touchAreaScreenTop = "0";
  let touchAreaScreenLeft = "7px";
  let frameRotation = "0deg";

  if (isLandscape) {
    const landscapeProps = calculateLandscapeProperties(
      aspectRatio,
      parentDimensions,
      resizableHeight
    );

    newHeight = landscapeProps.height;
    newWidth = landscapeProps.width;
    minWidth = landscapeProps.minWidth;
    minHeight = landscapeProps.minHeight;
    [screenHeight, screenWidth] = [screenWidth, screenHeight]; // Swap for landscape
    [phoneTop, phoneLeft] = [phoneLeft, phoneTop]; // Swap for landscape
    maskImage = `url(${device.landscapeMaskImage})`;
    frameImage = `url(${frame.imageLandscape})`;
    [touchAreaHeight, touchAreaWidth] = [touchAreaWidth, touchAreaHeight]; // Swap for landscape
    [touchAreaTop, touchAreaLeft] = [touchAreaLeft, touchAreaTop]; // Swap for landscape
    touchAreaWidth = "var(--phone-screen-width)";
    touchAreaHeight = "calc(var(--phone-screen-height) + 14px)";
    touchAreaTop = "calc(var(--phone-top) - 7px)";
    touchAreaLeft = "var(--phone-left)";
    [touchAreaScreenHeight, touchAreaScreenWidth] = [touchAreaScreenWidth, touchAreaScreenHeight]; // Swap for landscape
    [touchAreaScreenTop, touchAreaScreenLeft] = [touchAreaScreenLeft, touchAreaScreenTop]; // Swap for landscape
  }

  if (
    rotation === DeviceRotationType.LandscapeRight ||
    rotation === DeviceRotationType.PortraitUpsideDown
  ) {
    frameRotation = "180deg";
  }

  return {
    "--phone-content-min-height": minHeight,
    "--phone-content-min-width": minWidth,
    "--phone-content-width": newWidth,
    "--phone-content-height": newHeight,
    "--phone-screen-height": screenHeight,
    "--phone-screen-width": screenWidth,
    "--phone-aspect-ratio": `${aspectRatio}`,
    "--phone-top": phoneTop,
    "--phone-left": phoneLeft,
    "--phone-mask-image": maskImage,
    "--phone-frame-image": frameImage,
    "--phone-touch-area-width": touchAreaWidth,
    "--phone-touch-area-height": touchAreaHeight,
    "--phone-touch-area-top": touchAreaTop,
    "--phone-touch-area-left": touchAreaLeft,
    "--phone-touch-area-screen-height": touchAreaScreenHeight,
    "--phone-touch-area-screen-width": touchAreaScreenWidth,
    "--phone-touch-area-screen-top": touchAreaScreenTop,
    "--phone-touch-area-screen-left": touchAreaScreenLeft,
    "--frame-rotation": frameRotation,

    "--phone-wrapper-min-width": isLandscape
      ? "var(--phone-content-min-height)"
      : "var(--phone-content-min-width)",
    "--phone-wrapper-min-height": isLandscape
      ? "var(--phone-content-min-width)"
      : "var(--phone-content-min-height)",
  };
}

export default function Device({ device, resizableProps, children, wrapperDivRef }: DeviceProps) {
  const frame = useDeviceFrame(device);
  const { projectState } = useProject();
  const phoneContentRef = useRef<HTMLDivElement>(null);

  const resizableHeight = resizableProps.size?.height;
  // console.log("DIMENSIONS", resizableProps.size?.width, resizableProps.size?.height);
  const rotation = projectState.rotation;

  const cssProperties = useMemo(() => {
    return cssPropertiesForDevice(device, frame, rotation, wrapperDivRef, resizableHeight);
  }, [device, frame, rotation, wrapperDivRef, resizableHeight]);

  const handleResize = () => {
    // Recalculate the complete CSS properties that depend on window size
    const updatedProperties = cssPropertiesForDevice(
      device,
      frame,
      rotation,
      wrapperDivRef,
      resizableHeight
    );

    // Apply all CSS properties to both Resizable and phone-content elements
    const resizableElement = phoneContentRef.current?.parentElement;

    if (resizableElement) {
      Object.entries(updatedProperties).forEach(([property, value]) => {
        resizableElement.style.setProperty(property, value || null);
      });
    }

    if (phoneContentRef.current) {
      Object.entries(updatedProperties).forEach(([property, value]) => {
        phoneContentRef.current!.style.setProperty(property, value || null);
      });
    }
  };

  const isLandscape =
    rotation === DeviceRotationType.LandscapeLeft || rotation === DeviceRotationType.LandscapeRight;

  useEffect(() => {
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [device, frame, rotation, wrapperDivRef, resizableHeight]);

  return (
    <Resizable className="phone-wrapper-resizable" {...resizableProps} style={{ ...cssProperties }}>
      <div ref={phoneContentRef} className="phone-content" style={cssProperties}>
        <DeviceFrame frame={frame} isLandscape={isLandscape} />
        <img
          src={isLandscape ? device.landscapeScreenImage : device.screenImage}
          className="phone-screen-background"
        />
        {children}
      </div>
    </Resizable>
  );
}
