/**
 * The native configuration this library needs, so an app does not have to know
 * it.
 *
 * @remarks
 * - **Why this exists.** `react-native-audio-api` ships a config plugin whose
 *   defaults are wrong for a voice assistant, and both mistakes are invisible
 *   until late: it declares `UIBackgroundModes: ["audio"]`, which App Review
 *   rejects under guideline 2.5.4 when nothing plays in the background, and it
 *   writes no `NSMicrophoneUsageDescription`, so iOS terminates the app the
 *   moment it asks for the microphone. Every integrator would have had to
 *   discover both.
 * - **What it produces**, verified by running `expo prebuild` and reading the
 *   generated files: `NSMicrophoneUsageDescription` set to your sentence, no
 *   `UIBackgroundModes`, `android.permission.RECORD_AUDIO` present, and no
 *   foreground service.
 * - **Use this INSTEAD of listing `react-native-audio-api` yourself.** That
 *   plugin runs once; if the app lists it first, this one is skipped and the
 *   defaults win.
 * - An app that genuinely plays audio while backgrounded should configure
 *   `react-native-audio-api` directly and not use this plugin — and be ready to
 *   justify the background mode to App Review.
 */
// `react-native-audio-api/app.plugin` re-exports a transpiled ES module, so the
// function is under `default`. Taking the module itself hands Expo an object and
// prebuild dies with "withAudioAPI is not a function".
const audioApiPlugin = require('react-native-audio-api/app.plugin');
const withAudioAPI = audioApiPlugin.default || audioApiPlugin;

const DEFAULT_MICROPHONE_PERMISSION =
  'This app uses your microphone so you can talk to the assistant.';

module.exports = (config, props) =>
  withAudioAPI(config, {
    iosMicrophonePermission:
      (props && props.microphonePermission) || DEFAULT_MICROPHONE_PERMISSION,
    iosBackgroundMode: false,
    androidForegroundService: false,
    androidPermissions: [],
  });
