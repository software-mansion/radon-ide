export type ThemeType =
  | "vscode-dark"
  | "vscode-light"
  | "vscode-high-contrast"
  | "vscode-high-contrast-light";

export interface ThemeData {
  themeType: ThemeType;
  themeName: string;
}
