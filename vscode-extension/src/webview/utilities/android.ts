export enum AndroidSystemImageDistribution {
  GOOGLE_API = "google_apis",
  GOOGLE_PLAY = "google_apis_playstore",
  DEFAULT = "default",
}

export interface AndroidSystemImage {
  path: string;
  version: string;
  description: string;
  location?: string;
  apiLevel: number;
  androidVersion: number | undefined;
  imageType: AndroidSystemImageDistribution;
}

function getVerboseAndroidImageDistribution(imageType: AndroidSystemImageDistribution) {
  switch (imageType) {
    case AndroidSystemImageDistribution.DEFAULT:
      return "Default";
    case AndroidSystemImageDistribution.GOOGLE_API:
      return "Google API";
    case AndroidSystemImageDistribution.GOOGLE_PLAY:
      return "Google Play";
    default:
      undefined;
  }
}

export function getVerboseAndroidImageName(image: AndroidSystemImage) {
  const verboseDistribution = getVerboseAndroidImageDistribution(image.imageType);
  return `Android ${image.androidVersion}${
    image.imageType === AndroidSystemImageDistribution.GOOGLE_API ||
    image.imageType === AndroidSystemImageDistribution.GOOGLE_PLAY
      ? ` with ${verboseDistribution}`
      : ""
  } (API Level ${image.apiLevel})`;
}
