# Example — Expo app

A working integration in one file. Copy `App.tsx`, point `TOKEN_ENDPOINT` at your
own server, and you have a voice assistant.

```sh
npm install
npx expo run:ios       # or run:android — a development build, not Expo Go
npx expo start --web   # the web half needs no rebuild
```

`react-native-audio-api` is a native module, so **Expo Go cannot run this**. The
microphone is configured by the library's own Expo config plugin — see
`app.json`, which is the whole of the native setup:

```json
["@live-assistant/react-native", { "microphonePermission": "…your sentence…" }]
```

You also need the server half, which mints short-lived tokens so your API key
never ships in the app:

```ts
import { mintGeminiLiveToken } from '@live-assistant/token-server';
```

See the [repository README](https://github.com/Recipely-Team/live-assistant#readme)
for that route in full.

## What CI does with this

It is typechecked and bundled for the web on every pull request. An example that
is not built is an example that stops being true.
