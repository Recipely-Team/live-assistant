# @live-assistant/gemini

The Gemini Live implementation of `AssistantSession`: one WebSocket, its setup
handshake, and the frames in both directions — binary JSON frames, 16 kHz in,
24 kHz out, generic tool calls and cancellations.

**Just want it working?** [`@live-assistant/react-native`](https://www.npmjs.com/package/@live-assistant/react-native)
installs all of this and gives you `<LiveAssistant tokenEndpoint="…" />` — one
component that builds the session, the audio, the controller and the widget.
Reach for the packages below it when you want to hold the pieces apart.

```sh
npm install @live-assistant/gemini @live-assistant/core
```

```ts
import { GeminiLiveSession } from '@live-assistant/gemini';

const session = new GeminiLiveSession();
// `wsUrl` defaults to the constrained endpoint; the token carries the rest.
await session.connect({ token, model });
```

Hand it to an `AssistantController` rather than driving it yourself — the
controller is what turns a socket into a conversation.

## The one thing to know

**The session's configuration lives in the token, not in `connect`.** Gemini
fixes the system instruction, the tools and the voice when the token is minted
and discards a setup frame sent by the client, so a tool the token did not
declare does not exist — with no error. Mint with
[`@live-assistant/token-server`](https://www.npmjs.com/package/@live-assistant/token-server)
and declare your tools there.

Tokens are single-use. Reusing one closes the socket during the handshake, which
surfaces as `closed_before_ready`.

See the [overview](https://github.com/Recipely-Team/live-assistant#readme).

A working app that puts this together: [`examples/expo-app`](https://github.com/Recipely-Team/live-assistant/tree/main/examples/expo-app).
