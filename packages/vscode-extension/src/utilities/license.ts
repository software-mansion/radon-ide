import fetch from "node-fetch";
import { extensionContext } from "./extensionContext";
import { exec } from "./subprocess";
import { Logger } from "../Logger";
import { simulatorServerBinary } from "./simulatorServerBinary";
import { ActivateDeviceResult, RefreshLicenseTokenResult } from "../common/Project";

const TOKEN_KEY = "RNIDE_license_token_key";
const BASE_CUSTOMER_PORTAL_URL = "https://portal.ide.swmansion.com/";

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

  let response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    Logger.warn("Creating license token with license key failed", e);
    return ActivateDeviceResult.connectionFailed;
  }

  const responseBody = await response.json();

  if (response.ok) {
    const newToken = responseBody.token as string;
    await extensionContext.secrets.store(TOKEN_KEY, newToken ?? "");
    return ActivateDeviceResult.succeeded;
  }

  switch (responseBody.code) {
    case ServerResponseStatusCode.noSubscription:
      return ActivateDeviceResult.keyVerificationFailed;
    case ServerResponseStatusCode.allSeatTaken:
      return ActivateDeviceResult.notEnoughSeats;
    case ServerResponseStatusCode.badRequest:
    default:
      return ActivateDeviceResult.unableToVerify;
  }
}

export async function refreshToken(token: string) {
  const url = new URL("/api/refresh-token", BASE_CUSTOMER_PORTAL_URL);

  const body = {
    token: token,
  };

  let response;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    Logger.warn("Refreshing license token failed", e);
    return RefreshLicenseTokenResult.connectionFailed;
  }

  const responseBody = await response.json();

  if (response.ok) {
    const newToken = responseBody.token as string;
    await extensionContext.secrets.store(TOKEN_KEY, newToken ?? "");
    return RefreshLicenseTokenResult.succeeded;
  }

  switch (responseBody.code) {
    case ServerResponseStatusCode.seatRemoved:
      return RefreshLicenseTokenResult.seatRemoved;
    case ServerResponseStatusCode.licenseExpired:
      return RefreshLicenseTokenResult.licenseExpired;
    case ServerResponseStatusCode.licenseCancelled:
      return RefreshLicenseTokenResult.licenseCanceled;
    case ServerResponseStatusCode.badRequest:
    default:
      return RefreshLicenseTokenResult.unableToVerify;
  }
}

export async function removeLicense() {
  await extensionContext.secrets.delete(TOKEN_KEY);
}

export async function getLicenseToken() {
  const token = await extensionContext.secrets.get(TOKEN_KEY);
  return token;
}

async function generateDeviceFingerprint() {
  const simControllerBinary = simulatorServerBinary();
  const { stdout } = await exec(simControllerBinary, ["fingerprint"]);
  return stdout;
}
