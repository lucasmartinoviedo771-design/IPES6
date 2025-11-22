import globals from "globals";
import pluginJs from "@eslint/js";
import tsEslintPlugin from "@typescript-eslint/eslint-plugin";
import tsEslintParser from "@typescript-eslint/parser";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginJsxA11y from "eslint-plugin-jsx-a11y";

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const reactRefresh = require('eslint-plugin-react-refresh');

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "eslint.config.js",
    ],
  },
  {
    files: [
      "src/**/*.{js,mjs,cjs,ts,jsx,tsx}",
      "vite.config.ts",
    ],
    ...tsEslintPlugin.configs.disableTypeChecked,
    languageOptions: {
      parser: tsEslintParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        project: ["./tsconfig.json", "./tsconfig.node.json"],
        tsconfigRootDir: __dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2020,
        "React": "readonly",
        "JSX": "readonly",
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "jsx-a11y": pluginJsxA11y,
      "react-refresh": reactRefresh,
      "@typescript-eslint": tsEslintPlugin,
    },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,
      ...pluginJsxA11y.configs.recommended.rules,
      ...tsEslintPlugin.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/set-state-in-effect": "off",
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      "react/prop-types": "off",
      "jsx-a11y/no-redundant-roles": "off",
      "jsx-a11y/anchor-is-valid": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
];
