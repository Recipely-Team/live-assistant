# Board — import it, drop the widget in, it works

**Done 2026-09-13.** Released as 0.3.0 (`8c1bfcb`, tag `v0.3.0`), published by hand because trusted publishing is still unconfigured, and taken by the app in recipely#437. What is left is not code: the owner configuring a trusted publisher per package on npmjs.com, and a live browser check of the page pack with a real token.

Status board for the 0.3.0 work. Tick a box only when its gate is green; the
next session starts by reading this file.

## Why

The integrator imports the library, puts the widget in their design, and it
works. Integration cost must not grow: we take the few values only they can
know, and the library does everything else.

Today the simplest possible integration is `examples/expo-app/App.tsx` — about
45 lines that construct a session, a microphone, a player, a registry, a
`getConnection` with its fetch and error handling, and a controller, before any
of the app's own code. Every one of those lines is identical in every app that
will install this, which makes them ours.

Two findings that shape the work: the widget's colours are **already** fully
configurable (14 colours + 5 measurements through `theme`), and the assistant can
only act through tools — so a drop-in with no tools would be a drop-in that can
only talk.

## 1. `<LiveAssistant>` — the whole integration

- [x] `packages/assistant-react-native/src/live-assistant.tsx`
- [x] one required value: `tokenEndpoint` (or `getConnection` for an app with its own client)
- [x] builds session + microphone + player + registry + controller once, in a `useState` initialiser
- [x] default `getConnection`: `POST {tokenEndpoint}` `{ resumptionHandle, languageCode }` → `{ token, model, wsUrl? }`, non-2xx throws so it surfaces as `connection_refused` with the response in `cause`
- [x] registers the page tools, renders `AssistantProvider` + `AssistantWidget`, stops on unmount
- [x] optional props, all defaulted: `theme` (colours, sizes, `logo`), `strings`, `placement`, `style`, `language`, `tools`, `page`, `timing`, `onFailure`
- [x] the by-hand path (controller + provider + widget) stays for anyone who outgrows it
- [x] the umbrella's "adds nothing of its own" doc block is rewritten to say what this adds and why

## 2. Page tools — acting on the page with no app code

`packages/assistant-core/src/page/`, read from the live DOM at call time.

- [x] `page-element.ts` / `page-document.ts` / `page-window.ts` / `page-router.ts` — structural contracts, not `lib.dom`
- [x] `page-action.ts` — the vocabulary (read, list, navigate, back, press, type, scroll)
- [x] `page-tools-options.ts` — `actions`, `name`, `root`, `maxCharacters`, `maxTargets`, `router`, `document`, `window`
- [x] `page-targets.ts` — accessible names, selector scoping, exact→prefix→contains matching
- [x] `page-fields.ts` — typing through the prototype's setter (a controlled input reverts a plain assignment)
- [x] `page-text.ts` — `innerText` where it exists, capped
- [x] `create-page-tools.ts` — one tool named `page` with an action enum (the Live API fixes its tool list at setup: an enum is ~200 setup tokens against 1.5–2k for a tool apiece)
- [x] `navigate` clicks the anchor rather than assigning `location`, so an SPA router stays in charge
- [x] an unmatched target is answered with the names that ARE there, never thrown
- [x] `AssistantControllerOptions.page?: boolean | PageToolsOptions`, default on wherever a document exists
- [x] exported from `packages/assistant-core/src/index.ts`
- [x] inert on native unless given a `router: { go, back, current }`

## 3. Logo

- [x] `AssistantTheme.logo?: ImageSourcePropType` + `logoSize?: number` (share of the orb, default 0.55)
- [x] `AssistantOrb` draws it in the core circle; undefined by default changes nothing

## 4. Documentation — every value, where it is read

- [x] `@live-assistant/react-native` README rewritten around `<LiveAssistant>`: quick start, then three tables (props, theme, strings), each row *value · default · what it does*
- [x] core README: the `page` tool, its actions, and the honest native limit
- [x] widget README: theme table + logo
- [x] `examples/expo-app/App.tsx` drops to the one-liner plus one app tool; its README and the root README follow

## 5. Tests

- [x] core, against a fake document: every action; unmatched target answered with candidates; `page: false` registers nothing; no document → inert; a controlled input really changes; `actions` narrows the enum
- [x] umbrella: one controller across re-renders, the endpoint called with the resumption handle, a non-2xx surfacing as `connection_refused`, stop on unmount
- [x] widget: the orb draws the logo when the theme carries one

## 6. Release and the app

- [x] `npm run check` + `npm run check:example` green
- [x] 0.3.0: explicit `npm version 0.3.0 --workspaces --include-workspace-root`, tag, push
- [x] publish by hand — trusted publishing is still unconfigured on npmjs.com, so the tag job 404s (see CONTRIBUTING.md §Releasing)
- [x] Recipely: bump to 0.3.0 and pass `page: false` — it has its own fifty-word vocabulary and two overlapping ones compete for the same sentence; branch → four gates → PR → `dev`

## Verification

- `npm run check`, `npm run check:example`
- owner's browser check: build the example for web, serve it, say "go to the about page" — the page should move with no app code behind it
- Recipely's four gates green, its assistant unchanged
