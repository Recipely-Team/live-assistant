/**
 * The library's own suite.
 *
 * @remarks
 * - **`react-native` preset, not `jest-expo`** — the packages import `react`,
 *   `react-native`, `react-test-renderer` and `react-native-audio-api` and
 *   nothing else. A library that any React Native app can install should not
 *   need Expo to test itself.
 * - **Two mapper rules, not one.** The controller fixtures are imported by a
 *   deep specifier (`@live-assistant/core/src/controller/__fixtures__/...`), and
 *   a single anchored rule sends those to the package index instead of the file.
 * - **`react-native-audio-api` must be transformed** — it ships untranspiled,
 *   and one player test reaches for the real module with `requireActual`.
 * - **`dist/` is ignored** so a built tree cannot be discovered twice.
 */
module.exports = {
  preset: 'react-native',
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  modulePathIgnorePatterns: ['<rootDir>/packages/[^/]+/dist/'],
  moduleNameMapper: {
    '^@live-assistant/([a-z-]+)/(.*)$': '<rootDir>/packages/assistant-$1/$2',
    '^@live-assistant/([a-z-]+)$': '<rootDir>/packages/assistant-$1/src/index.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-audio-api)/)',
  ],
};
