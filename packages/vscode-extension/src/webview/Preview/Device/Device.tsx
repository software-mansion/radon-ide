import React, { useRef, useEffect } from "react";
import { Resizable, ResizableProps } from "re-resizable";

import DeviceFrame from "./DeviceFrame";
import { useDeviceFrame } from "./hooks";
import { useProject } from "../../providers/ProjectProvider";
import { DeviceProperties, DevicePropertiesFrame } from "../../utilities/deviceContants";
import { DeviceRotationType } from "../../../common/Project";

const rotationAngle = {
  Portrait: "0deg",
  LandscapeLeft: "-90deg",
  LandscapeRight: "90deg",
  PortraitUpsideDown: "180deg",
}

interface DeviceProps {
  device: DeviceProperties;
  resizableProps: ResizableProps;
  children: React.ReactNode;
}

function cssPropertiesForDevice(
  device: DeviceProperties,
  frame: DevicePropertiesFrame,
  rotation: DeviceRotationType,
  phoneElement: HTMLDivElement | null,
  resizableProps: ResizableProps
) {
  const aspectRatio = frame.width / frame.height;
  const minHeight = 350;
  const minWidth = minHeight * aspectRatio;
  const rotate = rotationAngle[rotation] || "0deg";
  const isHorizontal = rotation === "LandscapeLeft" || rotation === "LandscapeRight"
  
  
  let newHeight = "100%";
  let newWidth = "auto";
  
  if (isHorizontal) {
    const parentWidth =
    phoneElement?.parentElement?.parentElement?.clientWidth || window.innerWidth;
    const parentHeight =
    phoneElement?.parentElement?.parentElement?.clientHeight || window.innerHeight;
    // const resizedHeight = parseFloat(resizableProps.size?.height?.toString()) || parentHeight

    const adjustedHeight =
      parentWidth * aspectRatio < parentHeight
        ? parentWidth
        : Math.max(parentHeight / aspectRatio, minHeight);

    newHeight = `${adjustedHeight}px`;
    newWidth = `${adjustedHeight * aspectRatio}px`;
  }

  return {
    "--phone-content-min-height": `${minHeight}px`,
    "--phone-content-min-width": `${minWidth}px`,
    "--phone-content-width": newWidth,
    "--phone-content-height": newHeight,
    "--phone-screen-height": `${(device.screenHeight / frame.height) * 100}%`,
    "--phone-screen-width": `${(device.screenWidth / frame.width) * 100}%`,
    "--phone-aspect-ratio": `${aspectRatio}`,
    "--phone-top": `${(frame.offsetY / frame.height) * 100}%`,
    "--phone-left": `${(frame.offsetX / frame.width) * 100}%`,
    "--phone-mask-image": `url(${device.maskImage})`,
    "rotate": rotate,
  };
}

export default function Device({ device, resizableProps, children }: DeviceProps) {
  const frame = useDeviceFrame(device);
  const { selectedDeviceSession } = useProject();
  const phoneContentRef = useRef<HTMLDivElement>(null);
  const rotation =
    selectedDeviceSession?.status === "running" ? selectedDeviceSession.rotation : "Portrait";

  useEffect(() => {
    const handleResize = () => {
      if (phoneContentRef.current) {
        const style = cssPropertiesForDevice(device, frame, rotation, phoneContentRef.current, resizableProps);
        phoneContentRef.current?.style.setProperty(
          "--phone-content-width",
          style["--phone-content-width"]
        );
        phoneContentRef.current?.style.setProperty(
          "--phone-content-height",
          style["--phone-content-height"]
        );
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [rotation, device, frame]); // React to changes in rotation, device, or frame

  return (
    <Resizable {...resizableProps}>
      <div
        ref={phoneContentRef}
        className="phone-content"
        style={cssPropertiesForDevice(device, frame, rotation, phoneContentRef.current, resizableProps)}>
        <DeviceFrame frame={frame} />
        <img src={device.screenImage} className="phone-screen-background" />
        {children}
      </div>
    </Resizable>
  );
}
