import { DeviceRotation } from "../../common/State";

type NormalizedFrameRect = {
  width: number;
  height: number;
  x: number;
  y: number;
};

type NormalizedCoordinates = {
  x: number;
  y: number;
};

type OrientationPredicates = {
  actualPortaitAppLeft: boolean;
  actualPortaitAppRight: boolean;
  actualPortraitAppUpsideDown: boolean;
  actualUpsideDownAppPortrait: boolean;
  actualUpsideDownAppLeft: boolean;
  actualUpsideDownAppRight: boolean;
  actualLeftAppPortrait: boolean;
  actualLeftAppPortraitUpsideDown: boolean;
  actualLeftAppRight: boolean;
  actualRightAppPortrait: boolean;
  actualRightAppPortraitUpsideDown: boolean;
  actualRightAppLeft: boolean;
};

function getOrientationPredicates(
  appOrientation: DeviceRotation,
  deviceOrientation: DeviceRotation
): OrientationPredicates {
  const actualPortaitAppLeft =
    deviceOrientation === DeviceRotation.Portrait &&
    appOrientation === DeviceRotation.LandscapeLeft;
  const actualPortaitAppRight =
    deviceOrientation === DeviceRotation.Portrait &&
    appOrientation === DeviceRotation.LandscapeRight;
  const actualPortraitAppUpsideDown =
    deviceOrientation === DeviceRotation.Portrait &&
    appOrientation === DeviceRotation.PortraitUpsideDown;
  const actualUpsideDownAppPortrait =
    deviceOrientation === DeviceRotation.PortraitUpsideDown &&
    appOrientation === DeviceRotation.Portrait;
  const actualUpsideDownAppLeft =
    deviceOrientation === DeviceRotation.PortraitUpsideDown &&
    appOrientation === DeviceRotation.LandscapeLeft;
  const actualUpsideDownAppRight =
    deviceOrientation === DeviceRotation.PortraitUpsideDown &&
    appOrientation === DeviceRotation.LandscapeRight;
  const actualLeftAppPortrait =
    deviceOrientation === DeviceRotation.LandscapeLeft &&
    appOrientation === DeviceRotation.Portrait;
  const actualLeftAppPortraitUpsideDown =
    deviceOrientation === DeviceRotation.LandscapeLeft &&
    appOrientation === DeviceRotation.PortraitUpsideDown;
  const actualLeftAppRight =
    deviceOrientation === DeviceRotation.LandscapeLeft &&
    appOrientation === DeviceRotation.LandscapeRight;
  const actualRightAppPortrait =
    deviceOrientation === DeviceRotation.LandscapeRight &&
    appOrientation === DeviceRotation.Portrait;
  const actualRightAppPortraitUpsideDown =
    deviceOrientation === DeviceRotation.LandscapeRight &&
    appOrientation === DeviceRotation.PortraitUpsideDown;
  const actualRightAppLeft =
    deviceOrientation === DeviceRotation.LandscapeRight &&
    appOrientation === DeviceRotation.LandscapeLeft;

  return {
    actualPortaitAppLeft,
    actualPortraitAppUpsideDown,
    actualPortaitAppRight,
    actualUpsideDownAppPortrait,
    actualUpsideDownAppLeft,
    actualUpsideDownAppRight,
    actualLeftAppPortrait,
    actualRightAppPortrait,
    actualLeftAppRight,
    actualRightAppLeft,
    actualLeftAppPortraitUpsideDown,
    actualRightAppPortraitUpsideDown,
  };
}

/**
 * Transform coordinates and rects from app's coordinate system to preview's coordinate system.
 * @param appOrientation - Current orientation of the app.
 * @param deviceOrientation - Current orientation of the device.
 * @param frameRect - Coordinates and frame rects in app coordinate system.
 * @returns Coordinates and frame rects in preview coordinate system.
 *  The transform is needed to account of change of origin point after both - the device preview rotation
 *  and app orientation - change, synchronizing the app's coordinate system with the preview's coordinate system.
 * */
export function appToPreviewCoordinates(
  appOrientation: DeviceRotation | null,
  deviceOrientation: DeviceRotation,
  frameRect: NormalizedFrameRect
): NormalizedFrameRect {
  if (!appOrientation) {
    // if the app orientation is null, we assume that
    // the app's orientation is the same as the device's rotation
    return frameRect;
  }

  let newX = frameRect.x;
  let newY = frameRect.y;
  let newWidth = frameRect.width;
  let newHeight = frameRect.height;

  const {
    actualPortaitAppLeft,
    actualPortaitAppRight,
    actualUpsideDownAppPortrait,
    actualUpsideDownAppLeft,
    actualUpsideDownAppRight,
    actualLeftAppPortrait,
    actualRightAppPortrait,
    actualLeftAppRight,
    actualRightAppLeft,
    actualPortraitAppUpsideDown,
    actualLeftAppPortraitUpsideDown,
    actualRightAppPortraitUpsideDown,
  } = getOrientationPredicates(appOrientation, deviceOrientation);

  if (actualPortaitAppRight || actualUpsideDownAppLeft) {
    // if the screen is in landscape mode, we need to swap width and height
    newX = newY;
    newY = 1 - frameRect.x - frameRect.width;
    newWidth = newHeight;
    newHeight = frameRect.width;
  }

  if (actualPortaitAppLeft || actualUpsideDownAppRight) {
    newX = 1 - newY - frameRect.height;
    newY = frameRect.x;
    newWidth = newHeight;
    newHeight = frameRect.width;
  }

  if (actualUpsideDownAppPortrait || actualPortraitAppUpsideDown) {
    newX = 1 - frameRect.x - frameRect.width;
    newY = 1 - frameRect.y - frameRect.height;
    newWidth = frameRect.width;
    newHeight = frameRect.height;
  }

  if (actualLeftAppPortrait || actualRightAppPortraitUpsideDown) {
    newX = newY;
    newY = 1 - frameRect.x - frameRect.width;
    newWidth = newHeight;
    newHeight = frameRect.width;
  }

  if (actualRightAppPortrait || actualLeftAppPortraitUpsideDown) {
    newX = 1 - newY - frameRect.height;
    newY = frameRect.x;
    newWidth = newHeight;
    newHeight = frameRect.width;
  }

  if (actualLeftAppRight || actualRightAppLeft) {
    newX = 1 - frameRect.x - frameRect.width;
    newY = 1 - frameRect.y - frameRect.height;
  }

  // implicitly handles isLandscape &&  deviceOrientation === DeviceRotation.LandscapeLeft ||
  //              isLandscape && deviceOrientation === DeviceRotation.LandscapeRight
  return {
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight,
  };
}

/**
 * Transform coordinates from preview's coordinate system to app's coordinate system.
 * @param appOrientation - Current orientation of the app.
 * @param deviceOrientation - Current orientation of the device.
 * @param coords - x,y coordinates in preview coordinate system.
 * @returns x,y coordinates in app coordinate system.
 *  The transform is needed to account of change of origin point after both - the device preview rotation
 *  and app orientation - change, synchronizing the preview's coordinate system with the app's coordinate system.
 * */
export function previewToAppCoordinates(
  appOrientation: DeviceRotation | null,
  deviceOrientation: DeviceRotation,
  coords: NormalizedCoordinates
): NormalizedCoordinates {
  if (!appOrientation) {
    // if the app orientation is null, we assume that
    // the app's orientation is the same as the device's rotation
    return coords;
  }

  const { x, y } = coords;
  let newX = x;
  let newY = y;

  const {
    actualPortaitAppLeft,
    actualPortaitAppRight,
    actualUpsideDownAppPortrait,
    actualUpsideDownAppLeft,
    actualUpsideDownAppRight,
    actualLeftAppPortrait,
    actualRightAppPortrait,
    actualLeftAppRight,
    actualRightAppLeft,
    actualPortraitAppUpsideDown,
    actualLeftAppPortraitUpsideDown,
    actualRightAppPortraitUpsideDown,
  } = getOrientationPredicates(appOrientation, deviceOrientation);

  if (actualPortaitAppRight || actualUpsideDownAppLeft) {
    newX = 1 - coords.y;
    newY = coords.x;
  }

  if (actualPortaitAppLeft || actualUpsideDownAppRight) {
    newX = coords.y;
    newY = 1 - coords.x;
  }

  if (
    actualUpsideDownAppPortrait ||
    actualPortraitAppUpsideDown ||
    actualLeftAppRight ||
    actualRightAppLeft
  ) {
    newX = 1 - coords.x;
    newY = 1 - coords.y;
  }

  if (actualLeftAppPortrait || actualRightAppPortraitUpsideDown) {
    newX = 1 - coords.y;
    newY = coords.x;
  }

  if (actualRightAppPortrait || actualLeftAppPortraitUpsideDown) {
    newX = coords.y;
    newY = 1 - coords.x;
  }

  return { x: newX, y: newY };
}
