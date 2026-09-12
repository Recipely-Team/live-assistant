# @live-assistant/audio

`Microphone` and `PcmPlayer` for iOS, Android and the web. The platform is picked
by file extension, so you import one name and get the right implementation.

```sh
npm install @live-assistant/audio react-native-audio-api
```

## Native setup — read this before your first run

`react-native-audio-api` is a **native module**, which has two consequences that
cost people an afternoon each:

- **Expo Go cannot load it.** Use a development build
  (`npx expo prebuild && npx expo run:ios`) or EAS Build.
- Installing it means rebuilding the app.

Its Expo config plugin has **defaults that are wrong for a voice assistant**:

| With the defaults | What happens |
| --- | --- |
| `UIBackgroundModes: ["audio"]` lands in `Info.plist` | You declare background audio you never play. App Review rejects that under guideline 2.5.4 |
| no `NSMicrophoneUsageDescription` | iOS terminates the app when it asks for the microphone |
| a foreground service and `FOREGROUND_SERVICE` permissions on Android | Android asks for capabilities a voice session does not use |

So configure it:

```json
[
  "react-native-audio-api",
  {
    "iosMicrophonePermission": "Acme uses your microphone so you can talk to the assistant.",
    "iosBackgroundMode": false,
    "androidForegroundService": false,
    "androidPermissions": []
  }
]
```

Verified by running `expo prebuild` and reading the **generated** files rather
than the config: `NSMicrophoneUsageDescription` written, `UIBackgroundModes`
absent, `android.permission.RECORD_AUDIO` present, no foreground service.
Config is not the artifact — check the artifact.

Bare React Native: add `NSMicrophoneUsageDescription` to `ios/<App>/Info.plist`
by hand. `RECORD_AUDIO` comes in through the module's own manifest merge.

**The web needs nothing native**, but `getUserMedia` exists only in a secure
context — `https://` or `localhost`. Everything else answers
`microphone_unavailable`.

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
