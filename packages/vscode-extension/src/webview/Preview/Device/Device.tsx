import React, { useRef, useEffect, useMemo } from "react";
import { Resizable, ResizableProps } from "re-resizable";

import DeviceFrame from "./DeviceFrame";
import { useDeviceFrame } from "./hooks";
import { useProject } from "../../providers/ProjectProvider";
import { DeviceProperties, DevicePropertiesFrame } from "../../utilities/deviceContants";
import { DeviceRotationType } from "../../../common/Project";

const ROTATION_ANGLE: Record<DeviceRotationType, string> = {
  Portrait: "0deg",
  LandscapeLeft: "-90deg",
  LandscapeRight: "90deg",
  PortraitUpsideDown: "180deg",
} as const;

const MIN_HEIGHT = 350;
const CSS_MARGIN_FACTOR = 0.9;

type ResizablePropsSize = string | number | undefined;

interface DeviceProps {
  device: DeviceProperties;
  resizableProps: ResizableProps;
  children: React.ReactNode;
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
  "--phone-wrapper-width"?: string;
  "--phone-wrapper-min-width"?: string;
  "--phone-wrapper-min-height"?: string;
  "--phone-wrapper-height"?: string;
};

function getParentDimensions(phoneElement: HTMLDivElement | null) {
  const parentElement = phoneElement?.parentElement?.parentElement;
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
  const { width: parentWidth, height: parentHeight } = parentDimensions;
  const isFitSet = typeof resizableHeight === "string";

  const scaledHeight = Math.min(parentWidth, Math.max(parentHeight / aspectRatio, MIN_HEIGHT));
  const adjustedHeight = (isFitSet ? scaledHeight : (resizableHeight as number) || scaledHeight) * CSS_MARGIN_FACTOR;


  return {
    height: `${adjustedHeight}px`,
    width: `${adjustedHeight * aspectRatio}px`,
    minWidth: `${MIN_HEIGHT * aspectRatio}px`,
  };
}

function cssPropertiesForDevice(
  device: DeviceProperties,
  frame: DevicePropertiesFrame,
  rotation: DeviceRotationType,
  phoneElement: HTMLDivElement | null,
  resizableHeight: ResizablePropsSize
): DeviceCSSProperties {
  const aspectRatio = frame.width / frame.height;
  const isHorizontal = rotation === "LandscapeLeft" || rotation === "LandscapeRight";
  const parentDimensions = getParentDimensions(phoneElement);

  let newHeight = `min(100%, max(${MIN_HEIGHT}px, ${(parentDimensions.width / aspectRatio) * CSS_MARGIN_FACTOR}px))`;
  let newWidth = "auto";
  let minWidth = "fit-content";

  if (isHorizontal) {
    const landscapeProps = calculateLandscapeProperties(
      aspectRatio,
      parentDimensions,
      resizableHeight
    );

    newHeight = landscapeProps.height;
    newWidth = landscapeProps.width;
    minWidth = landscapeProps.minWidth;
  }

  return {
    "--phone-content-min-height": `${MIN_HEIGHT}px`,
    "--phone-content-min-width": minWidth,
    "--phone-content-width": newWidth,
    "--phone-content-height": newHeight,
    "--phone-screen-height": `${(device.screenHeight / frame.height) * 100}%`,
    "--phone-screen-width": `${(device.screenWidth / frame.width) * 100}%`,
    "--phone-aspect-ratio": `${aspectRatio}`,
    "--phone-top": `${(frame.offsetY / frame.height) * 100}%`,
    "--phone-left": `${(frame.offsetX / frame.width) * 100}%`,
    "--phone-mask-image": `url(${device.maskImage})`,
    "--content-rotate": ROTATION_ANGLE[rotation],
    "--phone-wrapper-width": "var(--phone-content-height)",
    "--phone-wrapper-height": "var(--phone-content-width)",
    "--phone-wrapper-min-width": isHorizontal
      ? "var(--phone-content-min-height)"
      : "var(--phone-content-min-width)",
    "--phone-wrapper-min-height": isHorizontal
      ? "var(--phone-content-min-width)"
      : "var(--phone-content-min-height)",
  };
}

export default function Device({ device, resizableProps, children }: DeviceProps) {
  const frame = useDeviceFrame(device);
  const { selectedDeviceSession } = useProject();
  const phoneContentRef = useRef<HTMLDivElement>(null);

  const resizableHeight = resizableProps.size?.height;
  const rotation = selectedDeviceSession?.rotation ?? "Portrait";

  const cssProperties = useMemo(() => {
    return cssPropertiesForDevice(
      device,
      frame,
      rotation,
      phoneContentRef.current,
      resizableHeight
    );
  }, [device, frame, rotation, resizableHeight]);

  const handleResize = () => {
    if (!phoneContentRef.current) {
      return;
    }

    // Recalculate only the properties that depend on window size
    const updatedProperties = cssPropertiesForDevice(
      device,
      frame,
      rotation,
      phoneContentRef.current,
      resizableHeight
    );

    const propertiesToUpdate = [
      { element: phoneContentRef.current, property: "--phone-content-width" },
      { element: phoneContentRef.current, property: "--phone-content-height" },
    ] as const;

    propertiesToUpdate.forEach(({ element, property }) => {
      element?.style.setProperty(property, updatedProperties[property] || null);
    });
  };

  useEffect(() => {
    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [device, frame, rotation, resizableHeight]);

  return (
    <Resizable className="phone-wrapper-resizable" {...resizableProps} style={{ ...cssProperties }}>
      <div ref={phoneContentRef} className="phone-content" style={cssProperties}>
        <DeviceFrame frame={frame} />
        <img src={device.screenImage} className="phone-screen-background" />
        {children}
      </div>
    </Resizable>
  );
}
