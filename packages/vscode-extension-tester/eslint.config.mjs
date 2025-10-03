import eslint from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**/*", "data/**/*"],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        React: "readonly",
        acquireVsCodeApi: "readonly",
        Thenable: "readonly",
        describe: "readonly",
        it: "readonly",
        before: "readonly",
        after: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
      },
    },
    plugins: {
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        node: {
          extensions: [".js", ".jsx"],
        },
      },
    },
    rules: {
      curly: "off",
      eqeqeq: "off",
      "no-throw-literal": "warn",
      semi: "off",
      "no-empty": "off",
      "no-useless-escape": "off",
      "no-case-declarations": "off",
      "no-irregular-whitespace": "off",
      "no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          args: "none",
          caughtErrors: "none",
        },
      ],
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "never",
        },
      ],
    },
  },
];
