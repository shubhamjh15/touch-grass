import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'dist',
    '.next',
    '.next-*',
    'next-env.d.ts',
    'dev-dist',
    'coverage',
    'playwright-report',
    'test-results',
    '.redesign',
    '.vercel',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Next.js route files export metadata and config next to the component by design.
    files: ['app/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Server-side and tooling code runs in Node, not the browser.
    files: ['app/api/**', 'server/**', 'scripts/**', 'e2e/**', '*.config.{js,ts,mjs}'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Browser automation: callbacks passed to page.evaluate() run in the page.
    files: ['scripts/**', 'e2e/**'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
]);
