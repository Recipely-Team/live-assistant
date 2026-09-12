// Only jest uses this: React Native's jest preset transforms with babel-jest and
// expects the project to supply the preset. An app consuming the library bundles
// with its own Metro config and never reads this file.
module.exports = {
  presets: ['@react-native/babel-preset'],
};
