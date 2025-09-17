import { bundledThemesInfo } from "shiki";
import { ThemeData } from "../types/theme";

enum ThemeDefaults {
  dark = "dark-plus",
  light = "light-plus",
  highContrast = "github-dark-high-contrast",
  highContrastLight = "github-light-high-contrast",
}

const THEME_NAME_MAP = Object.fromEntries(
  bundledThemesInfo.map((t) => [t.displayName.toLowerCase(), t.id])
);


export function getShikiThemeId(themeData: ThemeData): string {
  const { themeType, themeName } = themeData;
  const themeNameParsed = themeName.toLowerCase().replace("+", " plus");

  if (THEME_NAME_MAP[themeNameParsed]) {
    return THEME_NAME_MAP[themeNameParsed];
  }

  // best effort - match by theme type
  switch (themeType) {
    case "vscode-dark":
      return ThemeDefaults.dark;
    case "vscode-light":
      return ThemeDefaults.light;
    case "vscode-high-contrast":
      return ThemeDefaults.highContrast;
    case "vscode-high-contrast-light":
      return ThemeDefaults.highContrastLight;
    default:
      return ThemeDefaults.dark;
  }
}
