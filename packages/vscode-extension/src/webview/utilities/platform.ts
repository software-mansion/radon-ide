export class Platform {
  static OS: "macos" | "windows" | "unknown" = (() => {
    const platform = (navigator as any).userAgentData?.platform ?? navigator.platform ?? "unknown";
    if (/mac/.test(platform)) return "macos";
    if (/win/.test(platform)) return "windows";
    return "macos";
  })();

  static select(obj: { macos: any; windows: any }) {
    if (Platform.OS !== "unknown" && Platform.OS in obj) {
      return obj[Platform.OS];
    }
  }
}
