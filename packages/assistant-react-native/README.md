# @live-assistant/react-native

One install for a voice assistant in a React Native, Expo or web app — and one
component to use it:

```tsx
import { LiveAssistant } from '@live-assistant/react-native';

<LiveAssistant tokenEndpoint="https://api.example.com/assistant/token" />
```

That is the integration. The Gemini session, the microphone, the player, the tool
registry, the controller, the provider and the widget are built inside it, the
same way in every app — so they are not yours to write. The one value it cannot
invent is the route on **your** server that mints a short-lived token, because
your API key must never ship in an app bundle.

This page is the whole of it: five steps, then a table for every value you can
pass. **Building for the web only?** Steps 1 and 2 are the native setup — there,
the install is the whole of it and nothing needs rebuilding; skip to
[step 3](#3-mint-tokens-on-your-server). If you would rather read code than prose,
[`examples/expo-app`](https://github.com/Recipely-Team/live-assistant/tree/main/examples/expo-app)
is a working app in one file, and CI builds it on every change.

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

*Native only. A web build needs nothing from this step.*

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

## 4. Add the assistant

```tsx
import { LiveAssistant } from '@live-assistant/react-native';

export function App() {
  return (
    <>
      <Navigation />
      <LiveAssistant
        tokenEndpoint="https://api.example.com/assistant/token"
        headers={{ authorization: `Bearer ${userToken}` }}
      />
    </>
  );
}
```

Render it once, near the root and beside your navigation, so a session survives
moving between screens. It builds the controller on its first render and stops
the session when it unmounts; `headers` and `language` are read again on every
connection, so a login refreshed mid-conversation is the one used when a long
session hands over to a new socket.

### What it can already do, with nothing registered

On the web the assistant reads the page it is on and acts on it:

| It can | Meaning |
| --- | --- |
| `read` | what the page says, as text |
| `list` | what can be followed, pressed or filled, by name |
| `navigate` | follow a link, by its name or a path |
| `back` | go back |
| `press` | click a button or link |
| `type` | put text in a field |
| `scroll` | up, down, to the top or the bottom |

Nothing declares any of that. It reads the live DOM at the moment of the call, so
there is no route table to keep in step with your router and nothing to register
on a new screen. Targets are named the way someone reading the screen aloud would
name them — the accessible name — which is also why a React Native Web app works
unchanged: `accessibilityLabel` renders as `aria-label`.

Following a link **clicks** it rather than assigning the url, so your
single-page router stays in charge and the live session is not thrown away by a
reload. A target that is not on the page is answered with the names that are, so
the model picks one instead of guessing again.

On a phone there is no DOM, so the pack is inert unless you hand it a router:

```tsx
<LiveAssistant
  tokenEndpoint={endpoint}
  page={{ router: { go: (path) => router.push(path), back: () => router.back(), current: () => pathname } }}
/>
```

### Your own tools

Everything the page cannot do for itself is a tool:

```tsx
<LiveAssistant
  tokenEndpoint={endpoint}
  tools={[
    {
      definition: {
        name: 'createNote',
        description: 'Creates a note with the given text',
        parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      },
      run: async ({ text }) => ({ ok: true, id: await notes.create(String(text)) }),
    },
  ]}
/>
```

Declare the same definitions when you mint the token (step 3): Gemini fixes the
tool list there, and a tool the token did not declare does not exist — with no
error saying so.

## 5. Run it

```sh
npx expo run:ios      # or run:android — a development build, not Expo Go
npx expo start --web  # the web half needs no rebuild
```

Tap the orb. It asks for the microphone before spending a token, so the first run
shows the permission prompt.

---

## Configuration

Everything is optional except `tokenEndpoint` (or `getConnection` in its place).

### `<LiveAssistant>`

| Prop | Default | What it does |
| --- | --- | --- |
| **`tokenEndpoint`** | — | **Required.** Your server's route that mints a token. Called as `POST` with `{ resumptionHandle, languageCode }`; answer `{ token, model, wsUrl? }` |
| `getConnection` | — | Instead of `tokenEndpoint`, when your app already has its own client. Throw to refuse — the thrown value comes back as `failure.cause` |
| `headers` | — | Added to the token request; where your `Authorization` goes. Read fresh on every connection |
| `language` | `'en-US'` | Sent to your endpoint as `languageCode` |
| `tools` | — | Your app's own tools, on top of the page pack. An array or a `ToolRegistry` |
| `page` | on where a document exists | Reading and driving the page. `false` removes it; an object narrows it — table below |
| `timing` | measured | `utteranceGapMs` 1200 · `answerTimeoutMs` 12000 · `silenceTimeoutMs` 90000, `null` never ends a session · `echoTailMs` 250 · `maxHandovers` 3 |
| `theme` | below | Colours, sizes and your logo |
| `strings` | English | Every word the widget says |
| `placement` | `'bottom-right'` | `'bottom-left'`, or `'inline'` to lay it out where you rendered it |
| `style` | — | Merged last onto the floating stack — safe-area insets go here (`{ bottom: insets.bottom + 16 }`) |
| `showTranscript` | `true` | Show the conversation in the panel |
| `showComposer` | `true` | Show the typing box |
| `renderMessage` | — | Replace a said line; the default bubble arrives as `fallback` |
| `renderTool` | — | Replace a tool run; return `null` to hide it. The default shows **nothing** for a run that succeeded, on the grounds that the assistant already said what it did |
| `onReady` | — | Called once with the controller, to start or stop a session from elsewhere (a push notification, a deep link) |
| `onFailure` | — | Called with each failure, for logging. The widget already tells the user |

### `page`

| Field | Default | What it does |
| --- | --- | --- |
| `actions` | all seven | Which actions the model may use. A word left out never reaches the model, so it cannot ask for it and be refused |
| `name` | `'page'` | The tool's name, if `page` collides with one of yours |
| `root` | the whole document | A CSS selector the tools are confined to |
| `maxCharacters` | `4000` | Cap on what `read` returns, so a long page cannot crowd out the conversation |
| `maxTargets` | `40` | Cap on what `list` returns per kind |
| `router` | — | `{ go, back, current }` — navigation where there is no DOM |
| `document` / `window` | the globals | For tests, an iframe, or a server render |

### `theme`

Pass any part of it; the rest keeps the default.

| Colour | Default | Where it shows |
| --- | --- | --- |
| `primary` | `#5B5BD6` | The orb at rest, and the controls' accent |
| `userGlow` | `#3E9BFF` | The ring that follows the user's voice |
| `assistantGlow` | `#B45BFF` | The glow that follows the assistant's voice |
| `surface` | `#FFFFFF` | The panel |
| `text` | `#1C1C28` | Panel text |
| `mutedText` | `#6B6B80` | The status line and secondary text |
| `userBubble` | `#5B5BD6` | The user's transcript bubble |
| `userText` | `#FFFFFF` | Text in it |
| `assistantBubble` | `#F0F0F7` | The assistant's bubble |
| `assistantText` | `#1C1C28` | Text in it |
| `toolChip` | `#E8F5EC` | A tool-run chip |
| `toolText` | `#1F6B3A` | Text on it |
| `danger` | `#D93F3F` | Errors, and the end-session control |
| `onPrimary` | `#FFFFFF` | Anything drawn on `primary` |

| Value | Default | What it does |
| --- | --- | --- |
| `logo` | — | **Your mark, drawn inside the orb.** Any `<Image source>`: a `require(...)`, a `{ uri }`, an imported asset |
| `logoSize` | `0.55` | The logo's share of the orb's diameter; `1` would touch the edges |
| `orbSize` | `64` | The orb's diameter |
| `radius` | `16` | Corner radius of the panel and its controls |
| `spacing` | `12` | Padding and the gaps between rows |
| `fontSize` | `15` | Transcript text size |
| `panelMaxHeight` | `420` | How tall the panel may grow before the transcript scrolls |

```tsx
<LiveAssistant
  tokenEndpoint={endpoint}
  theme={{ logo: require('./assets/mark.png'), colors: { primary: '#E4572E', assistantGlow: '#FFB400' }, radius: 8 }}
/>
```

### `strings`

Every word, in one object — the defaults are English and the library ships no
other language, because a library that guesses at your voice is one you have to
argue with.

| Key | Default |
| --- | --- |
| `start` / `stop` | `Start voice assistant` / `End` |
| `mute` / `unmute` | `Mute` / `Unmute` |
| `send` / `composerPlaceholder` | `Send` / `Type a message` |
| `status.idle` … `status.working` | `Tap to talk`, `Connecting…`, `Listening`, `Thinking…`, `Speaking`, `Working on it…` |
| `ended.silence` | `Ended after a quiet spell` |
| `errors.*` | one sentence per failure code — `microphone_denied`, `microphone_unavailable`, `connection_refused`, `connection_lost`, `no_answer` |
| `genericError` | `Something went wrong` |
| `toolRunning(name)` / `toolFailed(name)` | `Running {name}…` / `{name} did not work` |

```tsx
<LiveAssistant
  tokenEndpoint={endpoint}
  strings={{ start: 'Asistanı başlat', stop: 'Bitir', status: { listening: 'Dinliyorum' } }}
/>
```

---

## Building it yourself

`<LiveAssistant>` is not a wall. It is these three things, and nothing you cannot
write out when you need to hold them apart — a controller that outlives the tree,
a widget somewhere other than where the provider is, a session you start from a
push notification:

```tsx
const assistant = new AssistantController({
  session: new GeminiLiveSession(),
  microphone: new Microphone(),
  player: new PcmPlayer(),
  tools: new ToolRegistry([...]),
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

Build the controller **once**, outside the component or in `useState(() => …)`:
it owns a socket and two devices.

Drawing your own UI instead of the widget? Use the hooks — `useAssistant()`,
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
