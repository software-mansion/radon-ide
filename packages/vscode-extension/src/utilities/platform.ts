import os from "os";
import { window } from "vscode";

const OS: "macos" | "windows" = (() => {
  const platform = os.platform();
  switch (platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      window.showErrorMessage("Radon IDE works only on macOS and Windows.", "Dismiss");
      throw new Error("Unsupported platform");
  }
})();
export const Platform = {
  OS,
  select: <R, T>(obj: { macos: R; windows: T }) => {
    return obj[Platform.OS];
  },
};

export type Platform = typeof Platform;
