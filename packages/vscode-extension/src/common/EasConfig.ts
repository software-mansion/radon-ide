export interface EasConfig {
  build?: EasBuildConfig;
}

export type EasBuildConfig = {
  [key: string]: EasBuildProfile;
};

export type EasBuildDistributionType = "internal" | "store";

export interface EasBuildProfileIOSSpecific {
  simulator?: boolean;
}

export interface EasBuildProfile {
  distribution?: EasBuildDistributionType;
  ios?: EasBuildProfileIOSSpecific;
}

export function isEasConfig(obj: unknown): obj is EasConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  return !("build" in obj) || obj.build === undefined || isEasBuildConfig(obj.build);
}

export function isEasBuildConfig(obj: unknown): obj is EasBuildConfig {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  return Object.values(obj).every((v) => v === undefined || isEasBuildProfile(v));
}

export function isEasBuildProfile(obj: unknown): obj is EasBuildProfile {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  if (
    "distribution" in obj &&
    (typeof obj.distribution !== "string" || !["internal", "store"].includes(obj.distribution))
  ) {
    return false;
  }

  if ("ios" in obj && obj.ios !== undefined) {
    if (typeof obj.ios !== "object" || obj.ios === null) {
      return false;
    }
    if (
      "simulator" in obj.ios &&
      obj.ios.simulator !== undefined &&
      !(typeof obj.ios.simulator === "boolean")
    ) {
      return false;
    }
  }

  return true;
}
