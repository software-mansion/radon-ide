import React, { useRef, useEffect } from "react";
import { Resizable, ResizableProps } from "re-resizable";

import DeviceFrame from "./DeviceFrame";
import { useDeviceFrame } from "./hooks";
import { useProject } from "../../providers/ProjectProvider";
import { DeviceProperties, DevicePropertiesFrame } from "../../utilities/deviceContants";
import { DeviceRotationType } from "../../../common/Project";

interface DeviceProps {
  device: DeviceProperties;
  resizableProps: ResizableProps;
  children: React.ReactNode;
}

function cssPropertiesForDevice(
  device: DeviceProperties,
  frame: DevicePropertiesFrame,
  rotation: DeviceRotationType,
  phoneElement: HTMLDivElement | null
) {
  let rotate = "0deg";
  let scale = 1;

  if (rotation === "LandscapeLeft" || rotation === "LandscapeRight") {
    rotate = rotation === "LandscapeLeft" ? "-90deg" : "90deg";
    if (phoneElement) {
      scale = (Math.min(1, window.innerWidth / frame.height) * frame.height) / frame.width;
    }
  }

  return {
    "--phone-screen-height": `${(device.screenHeight / frame.height) * 100}%`,
    "--phone-screen-width": `${(device.screenWidth / frame.width) * 100}%`,
    "--phone-aspect-ratio": `${frame.width / frame.height}`,
    "--phone-top": `${(frame.offsetY / frame.height) * 100}%`,
    "--phone-left": `${(frame.offsetX / frame.width) * 100}%`,
    "--phone-mask-image": `url(${device.maskImage})`,
    "rotate": rotate,
    "transform": `scale(${scale})`,
  };
}

export default function Device({ device, resizableProps, children }: DeviceProps) {
  const frame = useDeviceFrame(device);
  const { selectedDeviceSession } = useProject();
  const phoneContentRef = useRef<HTMLDivElement>(null);
  const rotation =
    selectedDeviceSession?.status === "running" ? selectedDeviceSession.rotation : "Portrait";

  const handleResize = () => {
    if (phoneContentRef.current) {
      const style = cssPropertiesForDevice(device, frame, rotation, phoneContentRef.current);
      phoneContentRef.current.style.setProperty("transform", style["transform"] as string);
    }
  };

  useEffect(() => {
    if (rotation === "LandscapeLeft" || rotation === "LandscapeRight") {
      window.addEventListener("resize", handleResize);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [rotation, device, frame]);

  return (
    <Resizable {...resizableProps}>
      <div
        ref={phoneContentRef}
        className="phone-content"
        style={cssPropertiesForDevice(device, frame, rotation, phoneContentRef.current)}>
        <DeviceFrame frame={frame} />
        <img src={device.screenImage} className="phone-screen-background" />
        {children}
      </div>
    </Resizable>
  );
}
