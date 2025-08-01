import React, { useRef, useEffect, useCallback } from "react";
import { use$ } from "@legendapp/state/react";

import DeviceFrame from "./DeviceFrame";
import { useDeviceFrame } from "./hooks";
import { DeviceProperties, DevicePropertiesFrame } from "../../utilities/deviceConstants";
import { DeviceRotation, ZoomLevelType } from "../../../common/Project";
import { DEVICE_DEFAULT_SCALE } from "../../components/ZoomControls";
import { useStore } from "../../providers/storeProvider";

const MIN_HEIGHT = 350;

interface DeviceProps {
  device: DeviceProperties;
  zoomLevel: ZoomLevelType;
  children: React.ReactNode;
  wrapperDivRef: React.RefObject<HTMLDivElement | null>;
}

type DeviceCSSProperties = React.CSSProperties & {
  "--phone-wrapper-min-height"?: string;
  "--phone-wrapper-min-width"?: string;
  "--phone-wrapper-height"?: string;
  "--phone-wrapper-width"?: string;
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

interface DeviceLayoutConfig {
  aspectRatio: number;
  isLandscape: boolean;
  isFitSet: boolean;
  parentWidth: number;
  parentHeight: number;
}

function getParentDimensions(wrapperDivRef: React.RefObject<HTMLDivElement | null>) {
  const parentElement = wrapperDivRef.current;
  return {
    width: parentElement?.clientWidth || window.innerWidth,
    height: parentElement?.clientHeight || window.innerHeight,
  };
}

function isLandscapeOrientation(rotation: DeviceRotation): boolean {
  return rotation === DeviceRotation.LandscapeLeft || rotation === DeviceRotation.LandscapeRight;
}

function shouldRotateFrame(rotation: DeviceRotation): boolean {
  return (
    rotation === DeviceRotation.LandscapeRight || rotation === DeviceRotation.PortraitUpsideDown
  );
}

function getPortraitDimensions(
  config: DeviceLayoutConfig,
  device: DeviceProperties,
  frame: DevicePropertiesFrame,
  zoomLevel: ZoomLevelType
) {
  const { isFitSet, parentWidth } = config;

  const zoomHeight = frame.height * (zoomLevel as number) * DEVICE_DEFAULT_SCALE;

  return {
    phoneWrapperMinWidth: "auto",
    phoneWrapperMinHeight: `${MIN_HEIGHT}px`,
    phoneWrapperHeight: isFitSet ? "100%" : `${zoomHeight}px`,
    phoneWrapperWidth: isFitSet ? "100%" : "fit-content",
    phoneContentHeight: isFitSet
      ? `min(100%, max(${MIN_HEIGHT}px, ${parentWidth / config.aspectRatio}px))`
      : `${zoomHeight}px`,
    phoneContentWidth: "auto",
    phoneContentMinWidth: "fit-content",
    phoneContentMinHeight: isFitSet ? `${MIN_HEIGHT}px` : "none",
    phoneScreenHeight: `${(device.screenHeight / frame.height) * 100}%`,
    phoneScreenWidth: `${(device.screenWidth / frame.width) * 100}%`,
    phoneTop: `${(frame.offsetY / frame.height) * 100}%`,
    phoneLeft: `${(frame.offsetX / frame.width) * 100}%`,
    phoneMaskImage: `url(${device.screenMaskImage})`,
    phoneFrameImage: `url(${frame.image})`,
    phoneAspectRatio: `${config.aspectRatio}`,
  };
}

function getLandscapeDimensions(
  config: DeviceLayoutConfig,
  device: DeviceProperties,
  frame: DevicePropertiesFrame,
  zoomLevel: ZoomLevelType
) {
  const { isFitSet, parentHeight, aspectRatio } = config;

  const zoomHeight = frame.height * (zoomLevel as number) * DEVICE_DEFAULT_SCALE;

  return {
    phoneWrapperMinWidth: "auto",
    phoneWrapperMinHeight: "auto",
    phoneWrapperHeight: "fit-content",
    phoneWrapperWidth: isFitSet ? "100%" : "fit-content",
    phoneContentHeight: "auto",
    phoneContentWidth: isFitSet ? `min(100%,  ${parentHeight / aspectRatio}px)` : `${zoomHeight}px`,
    phoneContentMinWidth: `${MIN_HEIGHT}px`,
    phoneContentMinHeight: `${MIN_HEIGHT * aspectRatio}px`,
    phoneScreenHeight: `${(device.screenWidth / frame.width) * 100}%`, // Swapped for landscape
    phoneScreenWidth: `${(device.screenHeight / frame.height) * 100}%`, // Swapped for landscape
    phoneTop: `${(frame.offsetX / frame.width) * 100}%`, // Swapped for landscape
    phoneLeft: `${(frame.offsetY / frame.height) * 100}%`, // Swapped for landscape
    phoneMaskImage: `url(${device.landscapeScreenMaskImage})`,
    phoneFrameImage: `url(${frame.imageLandscape})`,
    phoneAspectRatio: `${1 / aspectRatio}`,
  };
}

function getPortraitTouchAreaDimensions() {
  return {
    phoneTouchAreaWidth: "calc(var(--phone-screen-width) + 14px)",
    phoneTouchAreaHeight: "var(--phone-screen-height)",
    phoneTouchAreaTop: "var(--phone-top)",
    phoneTouchAreaLeft: "calc(var(--phone-left) - 7px)",
    phoneTouchAreaScreenHeight: "100%",
    phoneTouchAreaScreenWidth: "calc(100% - 14px)",
    phoneTouchAreaScreenTop: "0",
    phoneTouchAreaScreenLeft: "7px",
  };
}

function getLandscapeTouchAreaDimensions() {
  return {
    phoneTouchAreaWidth: "var(--phone-screen-width)",
    phoneTouchAreaHeight: "calc(var(--phone-screen-height) + 14px)",
    phoneTouchAreaTop: "calc(var(--phone-top) - 7px)",
    phoneTouchAreaLeft: "var(--phone-left)",
    phoneTouchAreaScreenHeight: "calc(100% - 14px)",
    phoneTouchAreaScreenWidth: "100%",
    phoneTouchAreaScreenTop: "7px",
    phoneTouchAreaScreenLeft: "0",
  };
}

function getDeviceLayoutConfig(
  frame: DevicePropertiesFrame,
  rotation: DeviceRotation,
  zoomLevel: ZoomLevelType,
  wrapperDivRef: React.RefObject<HTMLDivElement | null>
): DeviceLayoutConfig {
  const { width: parentWidth, height: parentHeight } = getParentDimensions(wrapperDivRef);

  return {
    aspectRatio: frame.width / frame.height,
    isLandscape: isLandscapeOrientation(rotation),
    isFitSet: zoomLevel === "Fit",
    parentWidth,
    parentHeight,
  };
}

export default function Device({ device, zoomLevel, children, wrapperDivRef }: DeviceProps) {
  const store$ = useStore();
  const rotation = use$(store$.workspaceConfiguration.deviceRotation);

  const frame = useDeviceFrame(device);

  const phoneContentRef = useRef<HTMLDivElement>(null);

  const isLandscape = isLandscapeOrientation(rotation);

  const cssPropertiesForDevice = useCallback((): DeviceCSSProperties => {
    const layoutConfig = getDeviceLayoutConfig(frame, rotation, zoomLevel, wrapperDivRef);

    const phoneDimensions = layoutConfig.isLandscape
      ? getLandscapeDimensions(layoutConfig, device, frame, zoomLevel)
      : getPortraitDimensions(layoutConfig, device, frame, zoomLevel);
    const touchAreaDimensions = layoutConfig.isLandscape
      ? getLandscapeTouchAreaDimensions()
      : getPortraitTouchAreaDimensions();

    const frameRotation = shouldRotateFrame(rotation) ? "180deg" : "0deg";

    return {
      "--phone-wrapper-min-width": phoneDimensions.phoneWrapperMinWidth,
      "--phone-wrapper-min-height": phoneDimensions.phoneWrapperMinHeight,
      "--phone-wrapper-height": phoneDimensions.phoneWrapperHeight,
      "--phone-wrapper-width": phoneDimensions.phoneWrapperWidth,
      "--phone-content-min-height": phoneDimensions.phoneContentMinHeight,
      "--phone-content-min-width": phoneDimensions.phoneContentMinWidth,
      "--phone-content-width": phoneDimensions.phoneContentWidth,
      "--phone-content-height": phoneDimensions.phoneContentHeight,
      "--phone-screen-height": phoneDimensions.phoneScreenHeight,
      "--phone-screen-width": phoneDimensions.phoneScreenWidth,
      "--phone-aspect-ratio": phoneDimensions.phoneAspectRatio,
      "--phone-top": phoneDimensions.phoneTop,
      "--phone-left": phoneDimensions.phoneLeft,
      "--phone-mask-image": phoneDimensions.phoneMaskImage,
      "--phone-frame-image": phoneDimensions.phoneFrameImage,
      "--phone-touch-area-width": touchAreaDimensions.phoneTouchAreaWidth,
      "--phone-touch-area-height": touchAreaDimensions.phoneTouchAreaHeight,
      "--phone-touch-area-top": touchAreaDimensions.phoneTouchAreaTop,
      "--phone-touch-area-left": touchAreaDimensions.phoneTouchAreaLeft,
      "--phone-touch-area-screen-height": touchAreaDimensions.phoneTouchAreaScreenHeight,
      "--phone-touch-area-screen-width": touchAreaDimensions.phoneTouchAreaScreenWidth,
      "--phone-touch-area-screen-top": touchAreaDimensions.phoneTouchAreaScreenTop,
      "--phone-touch-area-screen-left": touchAreaDimensions.phoneTouchAreaScreenLeft,
      "--frame-rotation": frameRotation,
    };
  }, [device, frame, rotation, zoomLevel, wrapperDivRef]);

  const applyStylePropertiesToComponents = () => {
    const updatedProperties = cssPropertiesForDevice();

    const phoneContentElement = phoneContentRef.current;
    const resizableElement = phoneContentRef.current?.parentElement;

    for (let element of [phoneContentElement, resizableElement]) {
      if (element) {
        Object.entries(updatedProperties).forEach(([property, value]) => {
          element.style.setProperty(property, (value as string) || null);
        });
      }
    }
  };

  useEffect(() => {
    // initial call to set styles of elements
    applyStylePropertiesToComponents();

    // recalculate on resize
    window.addEventListener("resize", applyStylePropertiesToComponents);
    return () => window.removeEventListener("resize", applyStylePropertiesToComponents);
  }, [device, frame, rotation, wrapperDivRef, zoomLevel]);

  return (
    <div className="phone-wrapper">
      <div ref={phoneContentRef} className="phone-content">
        <DeviceFrame frame={frame} isLandscape={isLandscape} />
        {children}
      </div>
    </div>
  );
}
