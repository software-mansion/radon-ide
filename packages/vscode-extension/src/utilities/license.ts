import fetch from "node-fetch";
import { extensionContext } from "./extensionContext";
import path from "path";
import { Platform } from "./platform";
import { exec } from "./subprocess";

const TOKEN_KEY = "token_key";
const BASE_CUSTOMER_PORTAL_URL = "https://portal.ide.swmansion.com/";

export async function activateDevice(licenseKey: string, username: string) {
  const url = new URL("/api/create-token", BASE_CUSTOMER_PORTAL_URL);
  const body = {
    fingerprint: await generateDeviceFingerprint(),
    name: username,
    licenseKey,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  let newToken;

  if (response.ok) {
    const responseBody = await response.json();
    newToken = responseBody.token as string;
    extensionContext.secrets.store(TOKEN_KEY, newToken ?? "");
    return true;
  }

  return false;
}

async function generateDeviceFingerprint() {
  const simControllerBinary = path.join(
    extensionContext.extensionPath,
    "dist",
    Platform.select({ macos: "simulator-server-macos", windows: "simulator-server-windows.exe" })
  );
  const { stdout } = await exec(simControllerBinary, ["fingerprint"]);
  return stdout;
}

export async function getLicenseToken() {
  const token = await extensionContext.secrets.get(TOKEN_KEY);
  return token;
}
