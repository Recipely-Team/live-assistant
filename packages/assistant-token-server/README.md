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
    console.error('mint failed', minted.failure.code, minted.failure.detail);
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

`resumptionHandle` comes from the app when a session is being resumed after the
provider handed it over; pass it through and the conversation continues.

## It never throws

Every outcome is a `Result`. Failures are `unreachable` (the network, or Google
is down), `rejected` (Google refused — a bad key, a model your key cannot call, a
quota) or `malformed` (an answer that did not parse). Google's own message is in
`failure.detail` for your logs; do not show it to a user.

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
