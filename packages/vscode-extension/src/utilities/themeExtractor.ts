import path from "path";
import vscode from "vscode";
import _ from "lodash";
import {
  ThemeVariant,
  ThemeData,
  ThemeDescriptor,
  ThemeFileData,
  ExtensionThemeInfo,
  ThemeRule,
} from "../common/theme";
import { THEME_VARIANT_FALLBACK } from "../common/theme";

// Below are the themes used when the theme file cannot be found or loaded
// In case the themes chosen by us to be default cannot be loaded from vscode
// for any reason, we provide files with basic themes bundled with the extension
import theme_dark from "../assets/default_themes/theme-dark.json";
import theme_light from "../assets/default_themes/theme-light.json";
import theme_hc_dark from "../assets/default_themes/theme-hc-dark.json";
import theme_hc_light from "../assets/default_themes/theme-hc-light.json";

const DEFAULT_THEME_MAPPING: Record<ThemeVariant, ThemeData> = {
  [ThemeVariant.Dark]: theme_dark,
  [ThemeVariant.Light]: theme_light,
  [ThemeVariant.HighContrast]: theme_hc_dark,
  [ThemeVariant.HighContrastLight]: theme_hc_light,
};

// Cache for theme data to avoid repeated file reads
const themeCache = new Map<string, ThemeData>();

function getDefaultTheme(themeVariant: ThemeVariant = THEME_VARIANT_FALLBACK): ThemeData {
  return DEFAULT_THEME_MAPPING[themeVariant];
}

/**
 * Extracts the complete theme data from the currently active VS Code theme
 * @returns The merged theme object with all includes resolved, in format compatible with
 * TextMate themes (used by vscode and Shiki library)
 */
export function extractTheme(themeDescriptor?: ThemeDescriptor): ThemeData {
  const { themeId, themeVariant } = themeDescriptor || {};

  const workspaceThemeId = vscode.workspace.getConfiguration("workbench").get<string>("colorTheme");
  const themePath = findThemePath(themeId ?? workspaceThemeId);

  if (!themePath) {
    return getDefaultTheme(themeVariant);
  }

  // Return cached theme if available
  if (themeCache.has(themePath)) {
    return themeCache.get(themePath)!;
  }

  const loadedTheme = loadThemeDefinitions(themePath);
  const resolvedTheme = _.isEmpty(loadedTheme) ? getDefaultTheme(themeVariant) : loadedTheme;

  themeCache.set(themePath, resolvedTheme);
  return resolvedTheme;
}

/**
 * Loads a theme file and recursively processes any included themes.
 * The theme file may contain an include property pointing to another theme file.
 * {include: "path/to/other/theme.json"}, which contains theme definitions. In
 * order for the Shiki highlighter to work correctly, we need to merge all these
 * definitions into a single theme object.
 * @param themePath - Path to the main theme file
 * @returns Merged theme data
 */
function loadThemeDefinitions(themePath: string): ThemeData {
  if (themeCache.has(themePath)) {
    return themeCache.get(themePath)!;
  }

  const themeStack = [themePath];
  let mergedTheme: ThemeData = {};

  while (themeStack.length > 0) {
    const currentPath = themeStack.pop();

    if (!currentPath) {
      return mergedTheme;
    }

    try {
      const themeData: ThemeFileData = require(currentPath);

      // Add "include" paths to stack for processing
      if (themeData.include) {
        const includePath = path.join(path.dirname(currentPath), themeData.include);
        themeStack.push(includePath);
      }

      // Exclude the include property to avoid circular references
      const { include: _include, ...themeWithoutInclude } = themeData;
      mergedTheme = mergeThemeData(themeWithoutInclude, mergedTheme);
    } catch (error) {
      console.warn(`Failed to load theme file: ${currentPath}`, error);
    }
  }

  themeCache.set(themePath, mergedTheme);
  return mergedTheme;
}

/**
 * Finds the file path for a given theme name by searching through all installed extensions
 * to find available themes and extract their file paths.
 */
function findThemePath(themeId: string | undefined): string | undefined {
  if (!themeId) {
    return undefined;
  }

  for (const extension of vscode.extensions.all) {
    const themes = extension.packageJSON.contributes?.themes;
    const theme = themes?.find((t: ExtensionThemeInfo) => t.id === themeId || t.label === themeId);
    if (theme) {
      return path.join(extension.extensionPath, theme.path);
    }
  }
  return undefined;
}

function normalizeScope(scope: string | string[]): string[] {
  return _.isArray(scope) ? scope : [scope];
}

/**
 * Checks if two scope arrays are equivalent (same scopes, order doesn't matter)
 */
function areScopesEqual(scope1: string | string[], scope2: string | string[]): boolean {
  const normalized1 = normalizeScope(scope1).sort();
  const normalized2 = normalizeScope(scope2).sort();
  return _.isEqual(normalized1, normalized2);
}

/**
 * Merges token color arrays by scope, with override rules taking precedence
 * for rules with the same scope, and unique scopes being preserved
 */
function mergeTokenColorsByScope(base: ThemeRule[], override: ThemeRule[]): ThemeRule[] {
  const result: ThemeRule[] = [...base];

  for (const overrideRule of override) {
    const baseRuleIndex = result.findIndex((baseRule) =>
      areScopesEqual(baseRule.scope, overrideRule.scope)
    );

    if (baseRuleIndex >= 0) {
      result[baseRuleIndex] = {
        ...result[baseRuleIndex],
        ...overrideRule,
        settings: _.merge({}, result[baseRuleIndex].settings, overrideRule.settings),
      };
    } else {
      // Add new rule if scope doesn't exist
      result.push(overrideRule);
    }
  }

  return result;
}

/**
 * Custom merge function for theme data that handles VS Code theme structure appropriately.
 * Vscode theme schema: Theme file schema: https://github.com/microsoft/vscode/blob/main/src/vs/workbench/services/themes/common/colorThemeSchema.ts
 * Based on the VS Code color theme schema:
 * - colors: object (workbench colors)
 * - tokenColors: string (path to tmTheme) OR array of token color rules
 *   We are aware of the fact that string points to tmTheme file and we knowingly do not handle that case here
 *   This case would require parsing the tmTheme file and merging its contents, which is out of scope for now
 *   Can be done if someone submits an issue about it.
 * - semanticTokenColors: object
 * - Other properties are treated as simple key-value pairs,
 *   including "semanticHighlighting", "name", "displayName", "type" and unknown properties
 */
function mergeThemeData(base: ThemeData, override: ThemeData): ThemeData {
  const result: ThemeData = { ...base };

  for (const [key, overrideValue] of Object.entries(override)) {
    if (overrideValue === undefined || overrideValue === null) {
      continue;
    }

    const baseValue = result[key];

    switch (key) {
      case "colors":
      case "semanticTokenColors":
        // colors and semanticTokenColors: Record<string, string>
        result[key] = _.merge({}, baseValue, overrideValue);
        break;
      case "tokenColors":
        // tokenColors: Array | string,
        // we knowingly do not handle the string case and merge the token arrays
        if (_.isArray(overrideValue)) {
          result.tokenColors = mergeTokenColorsByScope(
            baseValue as ThemeRule[],
            overrideValue as ThemeRule[]
          );
        }
        break;

      // in other cases, we simply override primitive values.
      // this goes for "semanticHighlighting", "name", "displayName", "type"
      // as well as unknown properties
      default:
        result[key] = overrideValue;
        break;
    }
  }

  return result;
}
