const js = require('@eslint/js');
const tseslint = require('typescript-eslint');
const importPlugin = require('eslint-plugin-import');
const oneDeclarationPerFile = require('./eslint-rules/one-declaration-per-file');

const SOURCE = ['**/*.ts', '**/*.tsx'];
const TESTS = ['**/__tests__/**', '**/__fixtures__/**', '**/*.test.ts', '**/*.test.tsx'];

module.exports = [
  { ignores: ['**/dist/**', 'eslint-rules/**', 'examples/*/.expo/**'] },
  js.configs.recommended,
  // The TypeScript rules apply to TypeScript. Left unscoped they also judge the
  // CommonJS config files at this root, where `require()` is the only way to
  // load anything.
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: SOURCE })),
  {
    // Config files at the root, and the Expo config plugins inside packages, are
    // CommonJS modules read by node at config time — not part of any bundle.
    files: ['*.js', 'packages/*/app.plugin.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly', __dirname: 'readonly' },
    },
  },
  {
    // The gates in scripts/ are ES modules run by node, not part of any package.
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  {
    files: SOURCE,
    plugins: {
      import: importPlugin,
      'live-assistant': { rules: { 'one-declaration-per-file': oneDeclarationPerFile } },
    },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.json' }, node: true },
    },
    rules: {
      'import/first': 'error',
      'import/namespace': 'error',
      'import/no-duplicates': 'error',
      'live-assistant/one-declaration-per-file': 'error',
    },
  },
  {
    // Test scaffolding is not part of the published surface: a fake session or a
    // hand-built request body is allowed to be loosely typed, and a stub option
    // shape does not earn a file of its own.
    files: TESTS,
    rules: {
      'live-assistant/one-declaration-per-file': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
