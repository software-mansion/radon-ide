import fetch, { Response } from "node-fetch";
import { z } from "zod";
import { extensionContext } from "./extensionContext";
import { exec } from "./subprocess";
import { Logger } from "../Logger";
import { simulatorServerBinary } from "./simulatorServerBinary";
import { ActivateDeviceResult } from "../common/Project";
import { throttleAsync } from "./throttle";
import {
  DefaultFeaturesAvailability,
  Feature,
  FeatureAvailabilityStatus,
  FeaturesAvailability,
  getLicenseStatusFromString,
  LicenseStatus,
} from "../common/License";

const TOKEN_KEY = "RNIDE_license_token_key";
const TOKEN_KEY_TIMESTAMP = "RNIDE_license_token_key_timestamp";
const BASE_CUSTOMER_PORTAL_URL = "https://portal.ide.swmansion.com/";

const LICENCE_TOKEN_REFRESH_INTERVAL = 1000 * 60 * 60 * 24; // 24 hours – how often to refresh the token (given successful token verification)
const LICENCE_TOKEN_REFRESH_RETRY_INTERVAL = 1000 * 60; // 1 minute – how often to retry refreshing the token

export enum ServerResponseStatusCode {
  success = "S001",
  badRequest = "E001",
  noSubscription = "E002",
  allSeatTaken = "E003",
  seatRemoved = "E004",
  licenseExpired = "E005",
  licenseCancelled = "E006",
  noProductForSubscription = "E007",
  internalError = "E101",
}

export enum SimServerLicenseValidationStatus {
  Success,
  Corrupted,
  Expired,
  FingerprintMismatch,
}

export type SimServerLicenseValidationResult =
  | {
      status: SimServerLicenseValidationStatus.Success;
      licensePlan: LicenseStatus;
      featuresAvailability: FeaturesAvailability;
    }
  | {
      status: Exclude<SimServerLicenseValidationStatus, SimServerLicenseValidationStatus.Success>;
    };

async function saveTokenIfValid(response: Response) {
  const responseBody = (await response.json()) as {
    token?: string;
    code?: ServerResponseStatusCode;
  };
  if (response.ok) {
    const newToken = responseBody.token as string;
    const checkResult = await checkLicenseToken(newToken);
    if (checkResult.status === SimServerLicenseValidationStatus.Success && newToken) {
      await extensionContext.secrets.store(TOKEN_KEY, newToken);
      await extensionContext.globalState.update(TOKEN_KEY_TIMESTAMP, Date.now());
      return ServerResponseStatusCode.success;
    } else {
      Logger.warn("Fetched token is invalid, reason:", checkResult);
      return ServerResponseStatusCode.noSubscription;
    }
  }
  return responseBody.code as ServerResponseStatusCode;
}

export async function activateDevice(
  licenseKey: string,
  username: string
): Promise<ActivateDeviceResult> {
  const url = new URL("/api/create-token", BASE_CUSTOMER_PORTAL_URL);

  let deviceFingerprint;

  try {
    deviceFingerprint = await generateDeviceFingerprint();
  } catch (e) {
    Logger.error("Error generating device fingerprint", e);
    return ActivateDeviceResult.unableToVerify;
  }

  const body = {
    fingerprint: deviceFingerprint,
    name: username,
    licenseKey,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const errorCode = await saveTokenIfValid(response);
    switch (errorCode) {
      case ServerResponseStatusCode.success:
        return ActivateDeviceResult.succeeded;
      case ServerResponseStatusCode.noSubscription:
        return ActivateDeviceResult.keyVerificationFailed;
      case ServerResponseStatusCode.allSeatTaken:
        return ActivateDeviceResult.notEnoughSeats;
      case ServerResponseStatusCode.badRequest:
      default:
        return ActivateDeviceResult.unableToVerify;
    }
  } catch (e) {
    Logger.warn("Creating license token with license key failed", e);
    return ActivateDeviceResult.connectionFailed;
  }
}

export function refreshTokenPeriodically() {
  const refreshIfNeeded = throttleAsync(async () => {
    const lastRefreshTimestamp = extensionContext.globalState.get<number>(TOKEN_KEY_TIMESTAMP) || 0;
    const timeSinceLastRefresh = Date.now() - lastRefreshTimestamp;
    if (timeSinceLastRefresh > LICENCE_TOKEN_REFRESH_INTERVAL) {
      const token = await getLicenseToken();
      if (token) {
        await refreshToken(token);
      }
    }
  }, 1);
  const intervalId = setInterval(refreshIfNeeded, LICENCE_TOKEN_REFRESH_RETRY_INTERVAL);
  refreshIfNeeded(); // trigger initial call as setInterval will wait for the first interval to pass
  return {
    dispose: () => {
      clearInterval(intervalId);
    },
  };
}

async function refreshToken(token: string) {
  try {
    const url = new URL("/api/refresh-token", BASE_CUSTOMER_PORTAL_URL);

    const body = {
      token: token,
    };
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const errorCode = await saveTokenIfValid(response);

    switch (errorCode) {
      case ServerResponseStatusCode.success:
      case ServerResponseStatusCode.internalError:
        // in case of internal error with license server, we don't want to remove the license
        // obviously, we also don't remove it on success
        return;
      default:
        // in all the other cases when we get erroneous response, we remove the license
        Logger.warn("Saved license can no longer be used, reason:", errorCode);
        await removeLicense();
        return;
    }
  } catch (e) {
    Logger.warn("Refreshing license token failed", e);
  }
}

export async function removeLicense() {
  await extensionContext.secrets.delete(TOKEN_KEY);
  await extensionContext.globalState.update(TOKEN_KEY_TIMESTAMP, undefined);
}

export async function getLicenseToken() {
  return await extensionContext.secrets.get(TOKEN_KEY);
}

export function watchLicenseTokenChange(callback: (token: string | undefined) => void) {
  getLicenseToken().then(callback);
  return extensionContext.secrets.onDidChange((changeEvent) => {
    if (changeEvent.key === TOKEN_KEY) {
      getLicenseToken().then(callback);
    }
  });
}

export async function checkLicenseToken(
  token: string,
  isRetry: boolean = false
): Promise<SimServerLicenseValidationResult> {
  const simControllerBinary = simulatorServerBinary();
  const { stdout } = await exec(simControllerBinary, ["verify_token", token]);

  if (stdout.startsWith("token_valid")) {
    const licensePlan = stdout.split(" ", 2)[1];
    const tokenPayload = await decodeJWTPayload(token);

    let featuresAvailability = { ...DefaultFeaturesAvailability };

    if (tokenPayload && tokenPayload.cp_features) {
      const allFeatures = Object.values(Feature);
      const tokenFeatures = Object.keys(tokenPayload.cp_features);
      const missingFeatures = allFeatures.filter((feature) => !tokenFeatures.includes(feature));

      if (missingFeatures.length > 0 && !isRetry) {
        Logger.warn(
          `Token is missing ${missingFeatures.length} features: ${missingFeatures.join(", ")}. Attempting to refresh token.`
        );
        await refreshToken(token);

        const refreshedToken = await getLicenseToken();
        if (refreshedToken && refreshedToken !== token) {
          return checkLicenseToken(refreshedToken, true);
        }
      }

      featuresAvailability = {
        ...DefaultFeaturesAvailability,
        ...tokenPayload.cp_features,
      };

      if (missingFeatures.length > 0 && isRetry) {
        Logger.warn(
          `Token still missing ${missingFeatures.length} features after refresh. Using defaults for: ${missingFeatures.join(", ")}`
        );
      }
    }

    return {
      status: SimServerLicenseValidationStatus.Success,
      licensePlan: getLicenseStatusFromString(licensePlan),
      featuresAvailability,
    };
  } else {
    try {
      const reason = stdout.split(" ", 2)[1];
      switch (reason) {
        case "expired":
          return {
            status: SimServerLicenseValidationStatus.Expired,
          };
        case "fingerprint_mismatch":
          return {
            status: SimServerLicenseValidationStatus.FingerprintMismatch,
          };
      }
    } catch (e) {
      Logger.error("Error parsing license token verification result", e);
    }
    return {
      status: SimServerLicenseValidationStatus.Corrupted,
    };
  }
}

async function decodeJWTPayload(token: string): Promise<{
  cp_sub?: string;
  cp_pri?: string;
  cp_fpr?: string;
  cp_ent?: number;
  cp_usr?: string;
  cp_plan?: string;
  cp_features?: Partial<FeaturesAvailability>;
} | null> {
  // Zod schema for runtime validation of features object
  const featureAvailabilityStatusSchema = z.enum([
    FeatureAvailabilityStatus.AVAILABLE.toString(),
    FeatureAvailabilityStatus.PAYWALLED.toString(),
    FeatureAvailabilityStatus.ADMIN_DISABLED.toString(),
  ]);

  const featuresSchema = z.record(z.string(), z.unknown()).transform((obj) => {
    const result: Partial<FeaturesAvailability> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (!Object.values(Feature).includes(key as Feature)) {
        continue;
      }

      // Validate the value is a valid FeatureAvailabilityStatus
      const validationResult = featureAvailabilityStatusSchema.safeParse(value);
      if (validationResult.success) {
        result[key as Feature] = validationResult.data as FeatureAvailabilityStatus;
      } else {
        Logger.warn(`Invalid FeatureAvailabilityStatus value for feature ${key}: ${value}`);
      }
    }

    return result;
  });

  const payloadSchema = z.object({
    cp_sub: z.string().optional(),
    cp_pri: z.string().optional(),
    cp_fpr: z.string().optional(),
    cp_ent: z.number().optional(),
    cp_usr: z.string().optional(),
    cp_plan: z.string().optional(),
    cp_features: featuresSchema.optional(),
  });

  try {
    // JWT format: header.payload.signature (all base64url)
    const parts = token.split(".");
    if (parts.length < 2) {
      Logger.warn("Invalid JWT format: expected at least 2 parts");
      return null;
    }

    const payloadB64Url = parts[1];
    // Convert base64url to base64
    const base64 = payloadB64Url.replace(/-/g, "+").replace(/_/g, "/");
    // Pad base64 if necessary
    const padded = base64 + "===".slice((base64.length + 3) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json) as unknown;

    const result = payloadSchema.safeParse(parsed);
    if (!result.success) {
      Logger.warn("JWT payload validation failed:", result.error.issues);
      return null;
    }

    return result.data;
  } catch (e) {
    Logger.warn("Failed to decode JWT payload", e);
    return null;
  }
}

async function generateDeviceFingerprint() {
  const simControllerBinary = simulatorServerBinary();
  const { stdout } = await exec(simControllerBinary, ["fingerprint"]);
  return stdout;
}
