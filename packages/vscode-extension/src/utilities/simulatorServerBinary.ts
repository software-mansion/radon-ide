import path from "path";
import { extensionContext } from "./extensionContext";
import { Platform } from "./platform";

export function simulatorServerBinary() {
  return path.join(
    extensionContext.extensionPath,
    "dist",
    Platform.select({
      macos: "simulator-server-macos",
      windows: "simulator-server-windows.exe",
      linux: "simulator-server-linux",
    })
  );
}
