import fetch from "node-fetch";
import { extensionContext } from "./extensionContext";
import { exec } from "./subprocess";
import { Logger } from "../Logger";
import { simulatorServerBinary } from "./simulatorServerBinary";
import { ActivateDeviceResult, RefreshLicenseTokenResult } from "../common/Project";
import { Response } from "node-fetch";
import { error } from "console";
import { throttleAsync } from "./throttle";

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

export enum SimServerLicenseValidationResult {
  Success,
  Corrupted,
  Expired,
  FingerprintMismatch,
}

async function saveTokenIfValid(response: Response) {
  const responseBody = await response.json();
  if (response.ok) {
    const newToken = responseBody.token as string;
    const checkResult = await checkLicenseToken(newToken);
    if (checkResult === SimServerLicenseValidationResult.Success && newToken) {
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

export async function checkLicenseToken(token: string) {
  const simControllerBinary = simulatorServerBinary();
  const { stdout } = await exec(simControllerBinary, ["verify_token", token]);
  if (stdout === "token_valid") {
    return SimServerLicenseValidationResult.Success;
  } else {
    try {
      const reason = stdout.split(" ", 2)[1];
      switch (reason) {
        case "expired":
          return SimServerLicenseValidationResult.Expired;
        case "fingerprint_mismatch":
          return SimServerLicenseValidationResult.FingerprintMismatch;
      }
    } catch (e) {
      Logger.error("Error parsing license token verification result", e);
    }
    return SimServerLicenseValidationResult.Corrupted;
  }
}

async function generateDeviceFingerprint() {
  const simControllerBinary = simulatorServerBinary();
  const { stdout } = await exec(simControllerBinary, ["fingerprint"]);
  return stdout;
}
