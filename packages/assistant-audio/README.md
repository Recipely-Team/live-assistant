# @live-assistant/audio

`Microphone` and `PcmPlayer` for iOS, Android and the web. The platform is picked
by file extension, so you import one name and get the right implementation.

```sh
npm install @live-assistant/audio react-native-audio-api
```

## Native setup — one line

The library ships an Expo config plugin, so this is the whole of it:

```json
["@live-assistant/audio", { "microphonePermission": "Acme uses your microphone so you can talk to the assistant." }]
```

(If you installed `@live-assistant/react-native`, name that instead — same
plugin.)

It writes what a voice assistant needs, checked by running `expo prebuild` and
reading the **generated** files rather than the config: the microphone usage
description set to your sentence, **no** `UIBackgroundModes`,
`android.permission.RECORD_AUDIO` present, and no foreground service.

Left to `react-native-audio-api`'s own plugin defaults you would get
`UIBackgroundModes: ["audio"]` — background audio nothing here plays, which App
Review rejects under guideline 2.5.4 — and **no** microphone usage description,
so iOS terminates the app at the first request. That is why this plugin exists.
**Do not list `react-native-audio-api` in `plugins` as well**: its plugin runs
once, and whichever is listed first wins.

Two more things the first run depends on:

- **Expo Go cannot load this.** `react-native-audio-api` is a native module.
  Build a development build (`npx expo prebuild && npx expo run:ios`) or use EAS.
- **Bare React Native**: add `NSMicrophoneUsageDescription` to
  `ios/<App>/Info.plist` yourself; `RECORD_AUDIO` arrives through the module's
  manifest merge.

## On the web, with or without React Native

Nothing native is involved: the `.web` halves use Web Audio.

- In an **Expo / React Native Web** app, Metro picks them by file extension.
- In a **plain React** app — Vite, Next, webpack, esbuild — the package's
  `browser` field points at them, so a browser build never reaches the native
  module. Checked by bundling an installed copy for `platform=browser`:
  `react-native-audio-api` does not appear in the output.

Either way `getUserMedia` needs a **secure context**, so serve from `https://` or
`localhost`. Anything else answers `microphone_unavailable`.

## What it does that a recorder does not

- **It promises a sample rate rather than requesting one.** Platform recorders
  treat the rate as a preference and hand back whatever the hardware runs at;
  frames labelled with a rate they are not transcribe as fast noise instead of
  failing. Resampling to the promised rate happens here, so no caller repeats it.
- **`level()` on both classes feeds animations**, 0–1, pulled on an animation
  clock rather than pushed. The player's level follows the **playhead**, so a
  glow moves with what is heard, not with what has arrived.
- **`remainingSeconds()`** says how much audio has not been heard yet — the
  number the echo gate and the interruption flush are built on.
- **Echo differs by platform.** iOS runs the session in `voiceChat` mode, which
  cancels the app's own output, so `cancelsEcho` is true and the user can
  interrupt freely. Android has none, so `cancelsEcho` is false and
  `AssistantController` holds the microphone shut while the assistant is
  audible. Do not send audio yourself during `speaking`.

## Failures

`microphone_denied` (the user said no, or iOS never asked because the usage
description is missing) · `microphone_unavailable` (no native module, or not a
secure context on the web) · `player_unavailable`.

Codes, never sentences: map them to words in your own app.

See the [overview](https://github.com/Recipely-Team/live-assistant#readme) for how this fits together.
