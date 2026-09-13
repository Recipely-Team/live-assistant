# Regressions

One line per CLASS of mistake, not per incident: the symptom, the root cause, and
what now prevents a recurrence. Git history holds the incidents. This file stays
short enough to read in one sitting.

## Packaging

| Symptom | Root cause | What prevents it now |
|---|---|---|
| `require('@live-assistant/token-server')` failed on a Node server — the package could not be loaded at all | Every package's `main` pointed at `src/index.ts`. The tarball does carry `src/`, so the file existed; it is TypeScript, which Node cannot parse | `scripts/assert-tarballs.mjs` asserts `main` is a `.js` the tarball carries and `types` a `.d.ts`, then extracts the three Node-loadable packages and requires them, naming one export of each |
| A published package pointed at nothing, while the manifest in the repo looked correct | `main`/`types` were set under `publishConfig`, which npm 11 leaves out of the tarball. Reading the repo's `package.json` could never have shown this — only the packed one does | The same gate reads the `package.json` **from inside the tarball**, not from the working tree |
| Packing to inspect a release produced seven tarballs with no `dist/` at all, while `main` said `dist/index.js` | `prepublishOnly` runs on `npm publish` and not on `npm pack`, so a clean tree packed nothing built. Publishing was safe; looking at what you were about to publish was not | Each package builds in `prepack`, which npm runs for both, and the workspace root builds in `prepare`. The gate packs with `--ignore-scripts` so it still judges the tree as built, and fails on a tarball whose `main` it cannot find |
| A package could be added to the workspace and never built — its tarball would be the one with no `dist/` | The root build script hard-codes the seven names and their order, because npm does not topologically order a `--workspaces` script run. Nothing objected to an eighth name missing from it | The gate asserts every workspace package is named in the root build script |
| A build failed naming an export that was plainly in the source, and the suite had been running against the previous release without saying so | The packages depend on each other by exact version. Once that version is on the registry, an install can satisfy the range from there instead of from the folder next door, and npm writes real copies into `packages/*/node_modules/@live-assistant/` | `scripts/assert-workspace-links.mjs`, in the `check` chain: every `@live-assistant/*` under a workspace folder must be a symlink back into `packages/` or `examples/` |
| A release bumped the packages but left every sibling pin at the previous version, so the umbrella at the new version pulled old members | `npm version --workspaces` rewrites each package's own `version` and nothing else; the exact pins between them are ordinary dependency entries | `scripts/assert-tarballs.mjs` reads the packed manifest and fails when a `@live-assistant/*` dependency is not the exact version being published, and now also when the seven packages and the workspace root do not share one version — nothing pins the token server, so only the second check sees it drift alone |
| A source file was deleted and its compiled `.js`/`.d.ts` kept shipping | `tsc` writes into `outDir` and never removes what is no longer generated | Every package's `build` clears `dist` before compiling |

## Documentation

| Symptom | Root cause | What prevents it now |
|---|---|---|
| The example app was invisible to everyone who arrives from npm: seven package pages, none mentioning it, and the root README that does link it is not published | npm renders each package's own README and nothing else. The example is `private`, so it never ships either — the only route was the sidebar's repository link | Every package page links the example by URL, and `assert-doc-links.mjs` resolves the path inside any `github.com/Recipely-Team/live-assistant/tree/main/...` URL against the tree, so renaming the folder fails the gate instead of breaking seven pages quietly |
| Every package's "see the overview" link led nowhere, on the pages people read on npmjs.com | Extracting the library moved `packages/README.md` to the repository root; the six links to `../README.md` were never updated. Lint, build and the suite all passed | `scripts/assert-doc-links.mjs` resolves every link and anchor, and rejects a relative link inside `packages/` outright — those pages are rendered on the registry, where a path up the tree leads nowhere |

## The rule these share

A gate that reads the working tree cannot see a packaging bug. Lint, typecheck,
build and the test suite all passed on every one of the rows above. **The tarball
is the artifact; check the artifact.**
