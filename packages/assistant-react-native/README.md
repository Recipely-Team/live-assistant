# @live-assistant/react-native

One install for a voice assistant in a React Native or Expo app: the controller,
a Gemini Live connection, microphone and playback, React bindings and a
ready-made widget, re-exported from one place.

This page is the whole integration. You should not need another one.

---

## 1. Install

```sh
npm install @live-assistant/react-native react-native-audio-api
```

`react-native-audio-api` is a **peer dependency and a native module**, so:

- **Expo Go cannot run this.** Build a development build instead:
  `npx expo prebuild && npx expo run:ios` (or `run:android`), or use EAS Build.
- Installing it means rebuilding the app, not just restarting Metro.

On the web nothing native is needed, but `getUserMedia` only exists in a
**secure context** — serve the page from `https://` or `localhost`.

## 2. Configure the microphone — one line

```json
{
  "expo": {
    "plugins": [
      [
        "@live-assistant/react-native",
        { "microphonePermission": "Acme uses your microphone so you can talk to the assistant." }
      ]
    ]
  }
}
```

That is the whole native setup. The plugin ships with the library and writes what
a voice assistant actually needs — verified by running `expo prebuild` and
reading the generated files, not the config:

| Generated | Value |
| --- | --- |
| `NSMicrophoneUsageDescription` | your sentence — without it iOS terminates the app at the first microphone request |
| `UIBackgroundModes` | **absent**. `react-native-audio-api`'s own default adds `["audio"]`, which App Review rejects under guideline 2.5.4 when nothing plays in the background |
| `android.permission.RECORD_AUDIO` | present |
| foreground service | none |

**Do not also list `react-native-audio-api` in `plugins`.** Its plugin runs once,
so whichever is listed first wins — and if that is theirs, you get the defaults
this one exists to avoid.

Need background audio for real? Configure `react-native-audio-api` yourself
instead of using this plugin, and be ready to justify the background mode.

**Without Expo config plugins** (a bare React Native app), add
`NSMicrophoneUsageDescription` to `ios/<App>/Info.plist` by hand. `RECORD_AUDIO`
arrives through the module's own manifest merge on Android.

## 3. Mint tokens on your server

Your Gemini API key must never ship in an app bundle. Install
[`@live-assistant/token-server`](https://www.npmjs.com/package/@live-assistant/token-server)
on your server and put the minting behind your own authentication:

```ts
import { mintGeminiLiveToken } from '@live-assistant/token-server';

app.post('/assistant/token', requireUser, async (req, res) => {
  const minted = await mintGeminiLiveToken({
    apiKey: process.env.GEMINI_API_KEY!,
    model: 'models/gemini-3.1-flash-live-preview',
    systemInstruction: 'You are the assistant inside Acme Notes. Be brief.',
    tools: toolDefinitions,               // the same definitions the app registers handlers for
    voiceName: 'Aoede',
    languageCode: req.body.languageCode ?? 'en-US',
    resumptionHandle: req.body.resumptionHandle,
  });
  if (!minted.ok) return res.status(503).json({ error: minted.failure.code });
  res.json(minted.value);                 // { token, model, wsUrl, expiresAt }
});
```

**The session's configuration lives in the token.** Gemini fixes the instruction,
the tools and the voice when the token is minted, and discards a setup sent by
the client — so a tool the token did not declare simply does not exist, with no
error. Declare every tool here.

## 4. Wire up the app

```tsx
import {
  AssistantController,
  AssistantProvider,
  AssistantWidget,
  GeminiLiveSession,
  Microphone,
  PcmPlayer,
  ToolRegistry,
} from '@live-assistant/react-native';

const tools = new ToolRegistry([
  {
    definition: {
      name: 'createNote',
      description: 'Creates a note with the given text',
      parameters: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
    run: async ({ text }) => ({ ok: true, id: await notes.create(String(text)) }),
  },
]);

const assistant = new AssistantController({
  session: new GeminiLiveSession(),
  microphone: new Microphone(),
  player: new PcmPlayer(),
  tools,
  getConnection: async ({ resumptionHandle }) => {
    const response = await fetch('https://api.example.com/assistant/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await getUserToken()}` },
      body: JSON.stringify({ resumptionHandle, languageCode: 'en-US' }),
    });
    if (!response.ok) throw await response.json(); // comes back to you as failure.cause
    return response.json();
  },
});

export function App() {
  return (
    <AssistantProvider controller={assistant}>
      <Navigation />
      <AssistantWidget />
    </AssistantProvider>
  );
}
```

Build the controller **once**, outside the component (or in `useState(() => …)`),
and render the widget near the root so it survives navigation.

## 5. Run it

```sh
npx expo run:ios      # or run:android — a development build, not Expo Go
npx expo start --web  # the web half needs no rebuild
```

Tap the orb. It asks for the microphone before spending a token, so the first run
shows the permission prompt.

---

## Making it yours

```tsx
<AssistantWidget
  placement="bottom-left"
  theme={{ colors: { primary: '#E4572E', assistantGlow: '#FFB400' }, radius: 8 }}
  strings={{ status: { listening: 'Dinliyorum' }, stop: 'Bitir' }}
  renderTool={(entry, fallback) =>
    entry.status === 'succeeded' ? <ActionChip name={entry.call.name} /> : fallback
  }
/>
```

- **`theme`** — colours, orb size, radius, spacing, font size, panel height.
- **`strings`** — every word, including statuses, errors and end reasons. The
  defaults are English.
- **`renderMessage` / `renderTool`** — each transcript row, with the default
  rendering handed to you as `fallback`. Note that the default chip shows
  **nothing** for a tool run that succeeded, on the grounds that the assistant
  already said what it did; override `renderTool` to show every run.

Drawing your own UI instead? Use the hooks — `useAssistant()`,
`useTranscript()`, `useLevelFrames()` — and install `core`, `gemini`, `audio` and
`react` directly rather than this package. **It matters for size**: this package
re-exports with `export *` from a CommonJS build and Metro does not tree-shake,
so importing one name from it pulls in all five members. Measured on an Expo web
export whose only import is `AssistantController` — 604 KB through this package
against 344 KB through `@live-assistant/core`.

## What it re-exports

| Package | What it brings |
| --- | --- |
| `@live-assistant/core` | the controller, the session port, the transcript, tools, levels |
| `@live-assistant/gemini` | the Gemini Live connection |
| `@live-assistant/audio` | microphone capture and streaming playback |
| `@live-assistant/react` | the provider and the hooks |
| `@live-assistant/widget` | the orb, the panel and the controls |

`@live-assistant/token-server` is deliberately **not** here: it mints
credentials with your API key, so it belongs on a server and never inside an app
bundle.

Node cannot `require` this package — it reaches React Native, whose source is
Flow. That is expected, and the same reason the token server is separate.

## When it does not work

| What you see | What it is |
| --- | --- |
| `microphone_denied` | The user declined, or `NSMicrophoneUsageDescription` is missing so iOS never asked. Check the **generated** `Info.plist`, not `app.json` |
| `microphone_unavailable` on a device | The native module is not in the binary — you are on Expo Go. Make a development build |
| `microphone_unavailable` in a browser | Not a secure context: `getUserMedia` needs `https://` or `localhost` |
| `connection_refused` | Your `getConnection` threw; the thrown value is on `failure.cause` |
| `closed_before_ready` | Gemini closed during the handshake — almost always a token used twice. They are single-use |
| `connect_timed_out` | Check the model you minted with is callable for your key; a model can be listed and still not exist |
| `no_answer` | The tools declared at mint time do not match what the app registered |
| Android echoes | Expected: Android's recorder has no echo cancellation, so the controller holds the microphone shut while the assistant is audible |
| On the web, `start()` never settles | The session was started outside a user gesture. A browser leaves `AudioContext.resume()` pending until the page has been interacted with, so start from a press — which is what the orb already is |

Failures are codes, never sentences. Map them to words yourself — the library
ships no user-facing copy.

## Licence

MIT
