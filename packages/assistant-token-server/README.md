# @live-assistant/token-server

Mints single-use Gemini Live tokens on your server, with the system instruction,
tools, voice and language baked in — so your API key never ships in an app
bundle.

```sh
npm install @live-assistant/token-server    # Node >= 18, on your server
```

No React, no React Native: this package is the reason those are not dragged onto
a server.

## A complete route

```ts
import express from 'express';
import { mintGeminiLiveToken } from '@live-assistant/token-server';

const app = express();

app.post('/assistant/token', requireUser, async (req, res) => {
  const minted = await mintGeminiLiveToken({
    apiKey: process.env.GEMINI_API_KEY!,
    model: 'models/gemini-3.1-flash-live-preview',
    systemInstruction: 'You are the assistant inside Acme Notes. Be brief.',
    tools: toolDefinitions,
    voiceName: 'Aoede',
    languageCode: req.body.languageCode ?? 'en-US',
    resumptionHandle: req.body.resumptionHandle,
  });

  if (!minted.ok) {
    // `cause` is what the transport threw — hand it to your logger's error
    // serializer, which wants the object rather than its message.
    logger.error({ err: minted.failure.cause, detail: minted.failure.detail }, minted.failure.code);
    return res.status(503).json({ error: minted.failure.code });
  }
  res.json(minted.value); // { token, model, wsUrl, expiresAt }
});
```

The app's `getConnection` calls this route and returns what it answers. Put it
behind your own authentication: anyone who can call it can talk to your Gemini
account.

## What goes in the token, and why it matters

Gemini fixes a session's configuration **when the token is minted**. A setup
frame sent later by the client is discarded — so **a tool the token did not
declare simply does not exist**, with no error and no complaint. Symptoms of
getting this wrong: the model never calls a tool you registered in the app, or
answers `no_answer`.

Declare here, in `tools`, exactly the definitions your app registers handlers
for. `ToolDefinition` JSON Schema is normalised to the upper-case type names the
Live API accepts, so you write ordinary JSON Schema.

If your app also has a **typed mode** — an ordinary `generateContent` call
answering the same user with the same tools — send it `toGeminiTools(tools)`.
That is the identical array this package bakes into the token, so the two modes
cannot drift into offering the model different words:

```ts
import { toGeminiTools } from '@live-assistant/token-server';

await fetch(`${GENERATE_URL}/${model}:generateContent?key=${apiKey}`, {
  method: 'POST',
  body: JSON.stringify({ tools: toGeminiTools(toolDefinitions), contents }),
});
```

`resumptionHandle` comes from the app when a session is being resumed after the
provider handed it over; pass it through and the conversation continues.

## It never throws

Every outcome is a `Result`, and a failure carries everything there is to know
about it:

| Field | What it holds |
|---|---|
| `code` | `unreachable` (the network, or Google is down), `rejected` (Google refused — a bad key, a model your key cannot call, a quota) or `malformed` (an answer that did not parse) |
| `status` | The HTTP status, on `rejected` |
| `detail` | Google's own message, or the thrown error's message. For your logs — never show it to a user |
| `cause` | On `unreachable`, the value the transport threw, untouched: the timeout, the DNS error, or something that is not an `Error` at all. Pass it to your logger's error serializer — a message is not a stack |

A model can appear in the model list and still not be callable. If `rejected`
mentions the model, that is usually what happened.

## Checking it end to end

The repository carries a live check that mints a token with your key, connects,
and prints what comes back. It is not part of the published package — clone the
repository to run it:

```sh
git clone https://github.com/Recipely-Team/live-assistant && cd live-assistant && npm install
read -s GEMINI_API_KEY && export GEMINI_API_KEY
npx tsx packages/assistant-token-server/scripts/live-check.ts
```

See the [overview](https://github.com/Recipely-Team/live-assistant#readme) for the app half.

A working app that puts this together: [`examples/expo-app`](https://github.com/Recipely-Team/live-assistant/tree/main/examples/expo-app).
