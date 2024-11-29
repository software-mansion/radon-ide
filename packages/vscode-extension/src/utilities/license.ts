import fetch from "node-fetch";
import { extensionContext } from "./extensionContext";
import { exec } from "./subprocess";
import { Logger } from "../Logger";
import { simulatorServerBinary } from "./simulatorServerBinary";
import { ActivateDeviceResult } from "../common/Project";

const TOKEN_KEY = "token_key";
const BASE_CUSTOMER_PORTAL_URL = "https://portal.ide.swmansion.com/";

export async function activateDevice(
  licenseKey: string,
  username: string
): Promise<ActivateDeviceResult> {
  const url = new URL("/api/create-token", BASE_CUSTOMER_PORTAL_URL);
  const body = {
    fingerprint: await generateDeviceFingerprint(),
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

  if (
    response.status === 400 &&
    responseBody.error.startsWith("All seats for a license with a key")
  ) {
    return ActivateDeviceResult.notEnoughSeats;
  }

  return ActivateDeviceResult.unableToVerify;
}

async function generateDeviceFingerprint() {
  const simControllerBinary = simulatorServerBinary();
  const { stdout } = await exec(simControllerBinary, ["fingerprint"]);
  return stdout;
}

export async function removeLicense() {
  await extensionContext.secrets.delete(TOKEN_KEY);
}

export async function getLicenseToken() {
  const token = await extensionContext.secrets.get(TOKEN_KEY);
  return token;
}
