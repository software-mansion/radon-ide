import * as os from "os";

export class Platform {
  static OS: "macos" | "windows" = (() => {
    const platform = os.platform();
    switch (platform) {
      case "darwin":
        return "macos";
      case "win32":
        return "windows";
      default:
        return "macos";
    }
  })();

  static select(obj: { macos: any; windows: any }) {
    if (Platform.OS in obj) {
      return obj[Platform.OS];
    }
  }
}
