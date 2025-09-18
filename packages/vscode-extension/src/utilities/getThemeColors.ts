import path from "path";
import vscode from "vscode";

type TokenStyle = {
  background?: string;
  fontStyle?: string;
  foreground?: string;
};

type ThemeRule = {
  scope: string | string[];
  settings: TokenStyle;
};

type Theme = {
  include?: string;
  tokenColors?: ThemeRule[];
};

/**
 * Extracts token color styles from a VS Code theme
 * @param themeName - The name/ID of the VS Code theme
 * @returns A flat object mapping token scopes to their styles
 */
export function getTokenColorsForCurrentTheme(): Record<string, any> {
  const themeName = vscode.workspace.getConfiguration("workbench").get("colorTheme") as string;
  //   const themePath = findThemePath(themeName);
  let theme = {};
  //   if (!themePath) {
  //     return {};
  //   }

  //   const theme: Theme = require(themePath);

  //   return theme ?? {};
//   const tokenColors: Record<string, TokenStyle> = {};

  // Find theme file path
  const themePath = findThemePath(themeName);
  if (!themePath) {
    return {};
  }

  // Process theme file(s) including any included themes
  const themePaths = [themePath];
  while (themePaths.length > 0) {
    const currentPath = themePaths.pop()!;
    theme = {...theme, ...require(currentPath) };
    console.log(theme);

    if (theme.include) {
      themePaths.push(path.join(path.dirname(currentPath), theme.include));
      theme.include = undefined; // prevent circular includes
    }
  }

  return theme;
}

/**
 * Finds the file path for a given theme name
 */
function findThemePath(themeName: string): string | undefined {
  for (const extension of vscode.extensions.all) {
    const themes = extension.packageJSON.contributes?.themes;
    const theme = themes?.find((t: { id: string }) => t.id === themeName || t.label === themeName);
    if (theme) {
      return path.join(extension.extensionPath, theme.path);
    }
  }
  return undefined;
}

/**
 * Processes token color rules and adds them to the tokenColors object
 */
function processTokenRules(rules: ThemeRule[], tokenColors: Record<string, TokenStyle>): void {
  rules.forEach((rule) => {
    const scopes = Array.isArray(rule.scope) ? rule.scope : [rule.scope];
    scopes.forEach((scope) => {
      if (!tokenColors[scope]) {
        tokenColors[scope] = { ...rule.settings };
      }
    });
  });
}
