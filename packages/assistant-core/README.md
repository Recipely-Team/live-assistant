# @live-assistant/core

The provider-neutral heart of Live Assistant. It depends on nothing, runs
anywhere JavaScript does, and knows about no UI framework.

```sh
npm install @live-assistant/core
```

Install this directly when you are assembling the pieces yourself. An app that
wants the whole thing installs
[`@live-assistant/react-native`](https://www.npmjs.com/package/@live-assistant/react-native)
instead.

## What is in it

- **`AssistantController`** runs a whole voice session headlessly: the start
  order (microphone access before a token is spent), mute, the echo gate,
  interruptions, transcript assembly, serialised tool calls, `goAway`
  resumption and a silence timeout. Read state with `getState()` / `subscribe()`
  (shaped for `useSyncExternalStore`), and levels with `inputLevel` /
  `outputLevel` — never through state.
- **`ToolRegistry`**, **`AssistantTool`**, **`ToolDefinition`** hold the
  functions the model may call. Every call is answered, including unknown names
  and handlers that throw; withdrawn calls never run.
- **`AssistantSession`**, **`AssistantMicrophone`**, **`AssistantPlayer`** are
  the ports. Implement them to add a provider or an audio back-end — that is all
  `@live-assistant/gemini` and `@live-assistant/audio` are.
- **`LevelTimeline`**, **`toDisplayLevel`**, **`smoothLevel`** turn audio into
  numbers you can draw.
- **`Result`** and **`AssistantFailureCode`**: nothing throws across the
  boundary, and no failure carries user-facing text.

## Minimal use, no React

```ts
import { AssistantController, ToolRegistry } from '@live-assistant/core';

const assistant = new AssistantController({
  session, microphone, player,           // the three ports
  tools: new ToolRegistry([/* … */]),
  getConnection: async () => fetchTokenFromYourServer(),
});

const stop = assistant.subscribe(() => console.log(assistant.getState().status));
await assistant.start();
```

## Acting on the page, with nothing registered

`createPageTools()` gives the assistant a `page` tool that reads and drives the
document the user is looking at: `read`, `list`, `navigate`, `back`, `press`,
`type`, `scroll`. `AssistantController` registers it by itself wherever a
document exists, so on the web an app that declares no tools at all still has an
assistant that can do things.

```ts
new AssistantController({ …, page: false });                  // off
new AssistantController({ …, page: { actions: ['read'] } });  // narrowed
new AssistantController({ …, page: { root: '#app', maxCharacters: 2000 } });
```

It reads the live DOM at the moment of the call — no route table, nothing to
register on a new screen — and names targets by their accessible name, which is
what a screen reader announces and what the user just said out loud. Following a
link **clicks** it rather than assigning the url, so a single-page router stays
in charge and the live session survives. A target that is not there is answered
with the names that are.

**On a phone there is no document**, so the pack is inert unless you pass
`page: { router: { go, back, current } }` — three functions, and navigate and back
are then the two actions the model is offered.

| Option | Default | What it does |
| --- | --- | --- |
| `actions` | all seven | Which the model may use; a word left out never reaches it |
| `name` | `'page'` | The tool's name |
| `root` | the document | A CSS selector the tools are confined to |
| `maxCharacters` | `4000` | Cap on `read` |
| `maxTargets` | `40` | Cap on `list`, per kind |
| `router` | — | Navigation where there is no DOM |
| `document` / `window` | the globals | For tests, an iframe or a server render |

See the [overview](https://github.com/Recipely-Team/live-assistant#readme) for the whole picture, including the token
server your `getConnection` talks to.

A working app that puts this together: [`examples/expo-app`](https://github.com/Recipely-Team/live-assistant/tree/main/examples/expo-app).
