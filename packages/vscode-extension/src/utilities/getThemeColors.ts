import path from "path";
import vscode from "vscode";

type ThemeRule = {
  name?: string;
  scope: string | string[];
  settings: TokenStyle;
};

type TokenStyle = {
  foreground?: string;
  fontStyle?: string;
};

interface ThemeObject {
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

interface ThemeDataFile extends ThemeObject {
  $schema?: string;
  include?: string;
}

/**
 * Extracts the complete theme data from the currently active VS Code theme
 * @returns The merged theme object with all includes resolved, in format compatible with 
 * TextMate themes (used by vscode and Shiki library)
 */
export function extractCurrentTheme(): ThemeDataFile {
  const themeName = vscode.workspace.getConfiguration("workbench").get("colorTheme") as string;
  const themePath = findThemePath(themeName);
  
  if (!themePath) {
    return {};
  }

  return loadThemeDefinitions(themePath);
}

/**
 * Loads a theme file and recursively processes any included themes.
 * The theme file may containe an include property pointing to another theme file.
 * {include: "path/to/other/theme.json"}, which contains theme definitions. In
 * order for the Shiki highlighter to work correctly, we need to merge all these
 * definitions into a single theme object.
 * @param themePath - Path to the main theme file
 * @returns Merged theme data
 */
function loadThemeDefinitions(themePath: string): ThemeDataFile {
  const themeStack = [themePath];
  let mergedTheme: ThemeDataFile = {};

  while (themeStack.length > 0) {
    const currentPath = themeStack.pop();

    if(!currentPath) {
      return mergedTheme;
    }
    
    try {
      const themeData: ThemeDataFile = require(currentPath);
      
      // Add "include" paths to stack for processing
      if (themeData.include) {
        const includePath = path.join(path.dirname(currentPath), themeData.include);
        themeStack.push(includePath);
      }
      
      // excluding the include property to avoid circular references
      const { include: _include, ...themeWithoutInclude } = themeData;
      mergedTheme = { ...mergedTheme, ...themeWithoutInclude };
      
    } catch (error) {
      console.warn(`Failed to load theme file: ${currentPath}`, error);
    }
  }

  return mergedTheme;
}

type PackageThemesData = { id: string; label: string };

/**
 * Finds the file path for a given theme name. 
 * 
 * We have to search through all installed extensions 
 * to find available themes and exctract their file paths.
 */
function findThemePath(themeName: string): string | undefined {
  for (const extension of vscode.extensions.all) {
    const themes = extension.packageJSON.contributes?.themes;
    const theme = themes?.find(
      (t: PackageThemesData) => t.id === themeName || t.label === themeName
    );
    if (theme) {
      return path.join(extension.extensionPath, theme.path);
    }
  }
  return undefined;
}
