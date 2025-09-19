export enum ThemeVariant {
  Dark = "vscode-dark",
  Light = "vscode-light",
  HighContrast = "vscode-high-contrast",
  HighContrastLight = "vscode-high-contrast-light",
}

export type ThemeRule = {
  name?: string;
  scope: string | string[];
  settings: TokenStyle;
};

export type TokenStyle = {
  foreground?: string;
  fontStyle?: string;
};

export interface ThemeData {
  name?: string;
  displayName?: string;
  semanticTokenColors?: Record<string, string>;
  colors?: Record<string, string>;
  semanticHighlighting?: boolean;
  tokenColors?: ThemeRule[] | string;
  include?: string;
  type?: string;
  [key: string]: unknown;
}

export interface ThemeDescriptor {
  themeVariant?: ThemeVariant;
  themeId?: string;
}

export interface ThemeFileData extends ThemeData {
  $schema?: string;
  include?: string;
}

export type ExtensionThemeInfo = { 
  id: string; 
  label: string; 
  path: string; 
};