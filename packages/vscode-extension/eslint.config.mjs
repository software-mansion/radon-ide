import { defineConfig, globalIgnores } from "eslint/config";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import _import from "eslint-plugin-import";
import { fixupPluginRules } from "@eslint/compat";
import tsParser from "@typescript-eslint/parser";

export default defineConfig([
  globalIgnores(["webview-ui/**/*"]),
  {
    plugins: {
      "@typescript-eslint": typescriptEslint,
      "import": fixupPluginRules(_import),
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 6,
      sourceType: "module",
    },

    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },

      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },

    rules: {
      "curly": "warn",
      "eqeqeq": "warn",
      "no-throw-literal": "warn",
      "semi": "off",
      "@typescript-eslint/naming-convention": "off",
      "@typescript-eslint/no-shadow": "error",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          args: "none",
        },
      ],

      "import/order": [
        "warn",
        {
          groups: ["builtin", "external"],
        },
      ],
    },
  },
]);
