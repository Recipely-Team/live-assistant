# Contributing

## Layout

Seven packages under `packages/`, one npm name each. `packages/assistant-core`
publishes `@live-assistant/core`, and so on.

```
packages/assistant-core           the controller, ports, tools, transcript, levels
packages/assistant-gemini         the Gemini Live session
packages/assistant-audio          microphone and speaker (native + web)
packages/assistant-react          headless hooks
packages/assistant-widget         the drop-in orb and panel
packages/assistant-react-native   the umbrella: re-exports the five above
packages/assistant-token-server   token minting, for a server
```

A package depends only on other packages in here and on npm dependencies. It
never reaches outside its own folder with a relative path, and it carries
nothing specific to any one app that installs it — no app's tool names, no app's
wire contract, no app's copy. Anything app-specific belongs in the adapter the
integrating app writes.

## Gates

```sh
npm install
npm run check      # lint, typecheck, build, test
```

Each one on its own: `npm run lint`, `npm run typecheck`, `npm run build`,
`npm test`. CI runs all four on every pull request, plus a job that packs each
package and asserts the tarball's entry points resolve.

## Standards

- **One exported declaration per file** — one class, interface, type alias or
  component per `.ts`/`.tsx`. Exempt: barrel `index.ts` files, a component's
  `Props` interface, and any non-exported type. Enforced by the custom ESLint
  rule in `eslint-rules/`.
- **One doc block at the head of the thing it describes**, with the reasoning
  under `@remarks` bullets. The body of a function carries as close to no
  comments as the code allows; an inline `//` is for the one line a reader would
  otherwise change and break.
- **Failures are values, not exceptions.** Public surfaces return
  `Result<T, Failure>` with a machine-readable code. A library never produces
  user-facing text: the consumer maps codes to words.
- **No user-facing strings in the library.** The widget's defaults are English
  and every one of them is overridable through `strings`.
- **Every file is written in English** — code, comments, tests, commit
  messages, docs.
- **Tests come with behaviour.** A fix ships the test that fails without it,
  named after the symptom someone saw rather than the mechanism.

## What ships

A tarball carries `dist`, `src`, the README and the LICENSE. `src` is there on
purpose: `sourceMap` and `declarationMap` are on, so stepping into the library in
a debugger lands on real source rather than on compiled output.

Tests and test doubles do not ship. The fakes in
`packages/assistant-core/src/controller/__fixtures__/` are genuinely useful to
anyone testing against `AssistantController`, and they were being published —
compiled into `dist/controller/__fixtures__/` — before anyone decided they should
be. A name a consumer cannot be expected to import is a name we could never
change afterwards. So they are excluded from the build and from the tarball, and
the gate asserts it. **Exposing the fakes is a real feature worth doing
deliberately**: a named entry point (`@live-assistant/core/testing`) with its own
documentation, decided before 1.0.0 — not a side effect of a build exclude list.

Inside this repository the sibling suites still import them through a deep `src/`
path. That resolves through the workspace, never through a tarball, and it is
test code in the same repository as the thing it tests.

## Releasing

Versions move together: all seven packages share one version number, because
the umbrella pins its members exactly and a mismatch is not installable.

```sh
npm login
npm version <patch|minor|major> --workspaces --include-workspace-root
npm run build
npm publish -w @live-assistant/core
npm publish -w @live-assistant/gemini
npm publish -w @live-assistant/audio
npm publish -w @live-assistant/react
npm publish -w @live-assistant/token-server
npm publish -w @live-assistant/widget
npm publish -w @live-assistant/react-native
```

The order is the dependency order: a package cannot be installed before the
packages it depends on exist at the pinned version. Each package's
`prepack` builds it, so `dist/` is fresh whether or not anyone remembered —
`prepack` rather than `prepublishOnly`, because npm runs it for `npm pack` as
well, and packing to look at a release should not produce something different
from the release.

[`docs/regressions.md`](docs/regressions.md) records the packaging mistakes that
have already been made here and what now catches each one. Two are worth
repeating in place:

- **`publishConfig` cannot carry `main` or `types`.** npm 11 leaves those
  overrides out of the tarball, so the fields are set directly. Verified by
  packing and reading the `package.json` inside the tarball.
- **Node cannot `require` `@live-assistant/react-native` or
  `@live-assistant/widget`** — they reach React Native, whose source is Flow.
  That is expected, and the reason the token server is a separate package: it
  runs on a server, where React Native must not follow.
