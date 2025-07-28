import React, { useRef, useEffect, useCallback } from "react";

import DeviceFrame from "./DeviceFrame";
import { useDeviceFrame } from "./hooks";
import { useProject } from "../../providers/ProjectProvider";
import { DeviceProperties, DevicePropertiesFrame } from "../../utilities/deviceContants";
import { DeviceRotation, ZoomLevelType } from "../../../common/Project";
import { DEVICE_DEFAULT_SCALE } from "../../components/ZoomControls";

const MIN_HEIGHT = 350;
const CSS_MARGIN_FACTOR = 0.9;

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
  return (
    rotation === DeviceRotation.LandscapeLeft || rotation === DeviceRotation.LandscapeRight
  );
}

function shouldRotateFrame(rotation: DeviceRotation): boolean {
  return (
    rotation === DeviceRotation.LandscapeRight ||
    rotation === DeviceRotation.PortraitUpsideDown
  );
}

function getPortraitDimensions(
  config: DeviceLayoutConfig,
  device: DeviceProperties,
  frame: DevicePropertiesFrame,
  zoomLevel: ZoomLevelType
) {
  const { isFitSet, parentWidth } = config;

  const zoomHeight = isFitSet
    ? "100%"
    : frame.height * (zoomLevel as number) * DEVICE_DEFAULT_SCALE;

  const phoneWrapperMinWidth = "auto";
  const phoneWrapperMinHeight = `${MIN_HEIGHT}px`;
  const phoneWrapperHeight = isFitSet ? (zoomHeight as string) : `${zoomHeight}px`;
  const phoneContentHeight = isFitSet
    ? `min(100%, max(${MIN_HEIGHT}px, ${(parentWidth / config.aspectRatio) * CSS_MARGIN_FACTOR}px))`
    : `${zoomHeight}px`;
  const phoneContentWidth = "auto";
  const phoneContentMinWidth = "fit-content";
  const phoneContentMinHeight = isFitSet ? `${MIN_HEIGHT}px` : "none";
  const phoneScreenHeight = `${(device.screenHeight / frame.height) * 100}%`;
  const phoneScreenWidth = `${(device.screenWidth / frame.width) * 100}%`;
  const phoneTop = `${(frame.offsetY / frame.height) * 100}%`;
  const phoneLeft = `${(frame.offsetX / frame.width) * 100}%`;
  const phoneMaskImage = `url(${device.screenImage})`;
  const phoneFrameImage = `url(${frame.image})`;
  const phoneAspectRatio = `${config.aspectRatio}`;

  return {
    phoneWrapperMinWidth,
    phoneWrapperMinHeight,
    phoneWrapperHeight,
    phoneContentHeight,
    phoneContentWidth,
    phoneContentMinWidth,
    phoneContentMinHeight,
    phoneScreenHeight,
    phoneScreenWidth,
    phoneTop,
    phoneLeft,
    phoneMaskImage,
    phoneFrameImage,
    phoneAspectRatio,
  };
}

function getLandscapeDimensions(
  config: DeviceLayoutConfig,
  device: DeviceProperties,
  frame: DevicePropertiesFrame,
  zoomLevel: ZoomLevelType
) {
  const { isFitSet, parentHeight, aspectRatio } = config;

  const zoomHeight = isFitSet
    ? "100%"
    : frame.height * (zoomLevel as number) * DEVICE_DEFAULT_SCALE;

  const phoneWrapperMinWidth = "auto";
  const phoneWrapperMinHeight = "auto";
  const phoneWrapperHeight = "fit-content";
  const phoneContentHeight = "auto";
  const phoneContentMinWidthValue = MIN_HEIGHT;
  const phoneContentMinHeightValue = phoneContentMinWidthValue * aspectRatio;
  const phoneContentWidth = isFitSet
    ? `calc(min(100%,  ${parentHeight / aspectRatio}px) * ${CSS_MARGIN_FACTOR})`
    : `${zoomHeight}px`;
  const phoneContentMinWidth = `${phoneContentMinWidthValue}px`;
  const phoneContentMinHeight = `${phoneContentMinHeightValue}px`;
  const phoneScreenHeight = `${(device.screenWidth / frame.width) * 100}%`; // Swapped for landscape
  const phoneScreenWidth = `${(device.screenHeight / frame.height) * 100}%`; // Swapped for landscape
  const phoneTop = `${(frame.offsetX / frame.width) * 100}%`; // Swapped for landscape
  const phoneLeft = `${(frame.offsetY / frame.height) * 100}%`; // Swapped for landscape
  const phoneMaskImage = `url(${device.landscapeScreenImage})`;
  const phoneFrameImage = `url(${frame.imageLandscape})`;
  const phoneAspectRatio = `${1 / aspectRatio}`;

  return {
    phoneWrapperMinWidth,
    phoneWrapperMinHeight,
    phoneWrapperHeight,
    phoneContentHeight,
    phoneContentWidth,
    phoneContentMinWidth,
    phoneContentMinHeight,
    phoneScreenHeight,
    phoneScreenWidth,
    phoneTop,
    phoneLeft,
    phoneMaskImage,
    phoneFrameImage,
    phoneAspectRatio,
  };
}

function getPortraitTouchAreaDimensions() {
  const phoneTouchAreaWidth = "calc(var(--phone-screen-width) + 14px)";
  const phoneTouchAreaHeight = "var(--phone-screen-height)";
  const phoneTouchAreaTop = "var(--phone-top)";
  const phoneTouchAreaLeft = "calc(var(--phone-left) - 7px)";
  const phoneTouchAreaScreenHeight = "100%";
  const phoneTouchAreaScreenWidth = "calc(100% - 14px)";
  const phoneTouchAreaScreenTop = "0";
  const phoneTouchAreaScreenLeft = "7px";

  return {
    phoneTouchAreaWidth,
    phoneTouchAreaHeight,
    phoneTouchAreaTop,
    phoneTouchAreaLeft,
    phoneTouchAreaScreenHeight,
    phoneTouchAreaScreenWidth,
    phoneTouchAreaScreenTop,
    phoneTouchAreaScreenLeft,
  };
}

function getLandscapeTouchAreaDimensions() {
  const phoneTouchAreaWidth = "var(--phone-screen-width)";
  const phoneTouchAreaHeight = "calc(var(--phone-screen-height) + 14px)";
  const phoneTouchAreaTop = "calc(var(--phone-top) - 7px)";
  const phoneTouchAreaLeft = "var(--phone-left)";
  const phoneTouchAreaScreenHeight = "calc(100% - 14px)";
  const phoneTouchAreaScreenWidth = "100%";
  const phoneTouchAreaScreenTop = "7px";
  const phoneTouchAreaScreenLeft = "0";

  return {
    phoneTouchAreaWidth,
    phoneTouchAreaHeight,
    phoneTouchAreaTop,
    phoneTouchAreaLeft,
    phoneTouchAreaScreenHeight,
    phoneTouchAreaScreenWidth,
    phoneTouchAreaScreenTop,
    phoneTouchAreaScreenLeft,
  };
}

function getDeviceLayoutConfig(
  frame: DevicePropertiesFrame,
  rotation: DeviceRotation,
  zoomLevel: ZoomLevelType,
  wrapperDivRef: React.RefObject<HTMLDivElement | null>
): DeviceLayoutConfig {
  const aspectRatio = frame.width / frame.height;
  const isLandscape = isLandscapeOrientation(rotation);
  const isFitSet = zoomLevel === "Fit";
  const { width: parentWidth, height: parentHeight } = getParentDimensions(wrapperDivRef);

  return {
    aspectRatio,
    isLandscape,
    isFitSet,
    parentWidth,
    parentHeight,
  };
}

export default function Device({ device, zoomLevel, children, wrapperDivRef }: DeviceProps) {
  const frame = useDeviceFrame(device);
  const { projectState } = useProject();
  const phoneContentRef = useRef<HTMLDivElement>(null);

  const rotation = projectState.rotation;
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

  const backgroundImageSrc = isLandscape ? device.landscapeScreenImage : device.screenImage;

  return (
    <div className="phone-wrapper">
      <div ref={phoneContentRef} className="phone-content">
        <DeviceFrame frame={frame} isLandscape={isLandscape} />
        <img src={backgroundImageSrc} className="phone-screen-background" alt="Device screen" />
        {children}
      </div>
    </div>
  );
}
