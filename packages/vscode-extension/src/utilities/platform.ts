import * as os from "os";

type PlatformType = "macos" | "windows";

export const Platform = {
  OS: (() => {
    const platform = os.platform() as "darwin" | "win32";
    switch (platform) {
      case "darwin":
        return "macos" as PlatformType;
      case "win32":
        return "windows" as PlatformType;
    }
  })(),

  select: <R, T>(obj: { macos: R; windows: T }) => {
    return obj[Platform.OS];
  }
}

export type Platform = typeof Platform;