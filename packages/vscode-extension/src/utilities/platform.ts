import os from "os";

const OS: "macos" | "windows" | "unsupported" = (() => {
  const platform = os.platform();
  switch (platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "unsupported";
  }
})();
export const Platform = {
  OS,
  select: <R, T>(obj: { macos: R; windows: T }) => {
    // we assume that the 'unsupported' OS type will never occur here
    return Platform.OS !== "unsupported" ? obj[Platform.OS] : obj["macos"];
  },
};

export type Platform = typeof Platform;
