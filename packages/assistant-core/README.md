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

See the [overview](https://github.com/Recipely-Team/live-assistant#readme) for the whole picture, including the token
server your `getConnection` talks to.
