import { DeviceRotationType } from "../../common/Project";

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
  actualUpsideDownAppPortrait: boolean;
  actualUpsideDownAppLeft: boolean;
  actualUpsideDownAppRight: boolean;
  actualLeftAppPortrait: boolean;
  actualRightAppPortrait: boolean;
};

function getOrientationPredicates(
  appOrientation: DeviceRotationType,
  deviceOrientation: DeviceRotationType
): OrientationPredicates {
  const actualPortaitAppLeft =
    deviceOrientation === DeviceRotationType.Portrait &&
    appOrientation === DeviceRotationType.LandscapeLeft;
  const actualPortaitAppRight =
    deviceOrientation === DeviceRotationType.Portrait &&
    appOrientation === DeviceRotationType.LandscapeRight;
  const actualUpsideDownAppPortrait =
    deviceOrientation === DeviceRotationType.PortraitUpsideDown &&
    appOrientation === DeviceRotationType.Portrait;
  const actualUpsideDownAppLeft =
    deviceOrientation === DeviceRotationType.PortraitUpsideDown &&
    appOrientation === DeviceRotationType.LandscapeLeft;
  const actualUpsideDownAppRight =
    deviceOrientation === DeviceRotationType.PortraitUpsideDown &&
    appOrientation === DeviceRotationType.LandscapeRight;
  const actualLeftAppPortrait =
    deviceOrientation === DeviceRotationType.LandscapeLeft &&
    appOrientation === DeviceRotationType.Portrait;
  const actualRightAppPortrait =
    deviceOrientation === DeviceRotationType.LandscapeRight &&
    appOrientation === DeviceRotationType.Portrait;

  return {
    actualPortaitAppLeft,
    actualPortaitAppRight,
    actualUpsideDownAppPortrait,
    actualUpsideDownAppLeft,
    actualUpsideDownAppRight,
    actualLeftAppPortrait,
    actualRightAppPortrait,
  };
}

export function translateAppToPreviewCoordinates(
  appOrientation: DeviceRotationType,
  deviceOrientation: DeviceRotationType,
  frameRect: NormalizedFrameRect
): NormalizedFrameRect {
  let newX = frameRect.x;
  let newY = frameRect.y;
  let newWidth = frameRect.width;
  let newHeight = frameRect.height;

  console.log("COORDS", appOrientation, deviceOrientation)

  const {
    actualPortaitAppLeft,
    actualPortaitAppRight,
    actualUpsideDownAppPortrait,
    actualUpsideDownAppLeft,
    actualUpsideDownAppRight,
    actualLeftAppPortrait,
    actualRightAppPortrait,
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

  if (actualUpsideDownAppPortrait) {
    newX = 1 - frameRect.x - frameRect.width;
    newY = 1 - frameRect.y - frameRect.height;
    newWidth = frameRect.width;
    newHeight = frameRect.height;
  }

  if (actualLeftAppPortrait) {
    newX = newY;
    newY = 1 - frameRect.x - frameRect.width;
    newWidth = newHeight;
    newHeight = frameRect.width;
  }

  if (actualRightAppPortrait) {
    newX = 1 - newY - frameRect.height;
    newY = frameRect.x;
    newWidth = newHeight;
    newHeight = frameRect.width;
  }

  return {
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight,
  };
}

export function translatePreviewToAppCoordinates(
  appOrientation: DeviceRotationType,
  deviceOrientation: DeviceRotationType,
  coords: NormalizedCoordinates
): NormalizedCoordinates {
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
  } = getOrientationPredicates(appOrientation, deviceOrientation);

  if (actualPortaitAppRight || actualUpsideDownAppLeft) {
    newX = 1 - coords.y;
    newY = coords.x;
  }

  if (actualPortaitAppLeft || actualUpsideDownAppRight) {
    newX = coords.y;
    newY = 1 - coords.x;
  }

  if (actualUpsideDownAppPortrait) {
    newX = 1 - coords.x;
    newY = 1 - coords.y;
  }

  if (actualLeftAppPortrait) {
    newX = 1 - coords.y;
    newY = coords.x;
  }

  if (actualRightAppPortrait) {
    newX = coords.y;
    newY = 1 - coords.x;
  }

  return { x: newX, y: newY };
}
