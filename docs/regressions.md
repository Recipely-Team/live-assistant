# Regressions

One line per CLASS of mistake, not per incident: the symptom, the root cause, and
what now prevents a recurrence. Git history holds the incidents. This file stays
short enough to read in one sitting.

## Packaging

| Symptom | Root cause | What prevents it now |
|---|---|---|
| `require('@live-assistant/token-server')` failed on a Node server — the package could not be loaded at all | Every package's `main` pointed at `src/index.ts`. The tarball does carry `src/`, so the file existed; it is TypeScript, which Node cannot parse | `scripts/assert-tarballs.mjs` asserts `main` is a `.js` the tarball carries and `types` a `.d.ts`, then extracts the three Node-loadable packages and requires them, naming one export of each |
| A published package pointed at nothing, while the manifest in the repo looked correct | `main`/`types` were set under `publishConfig`, which npm 11 leaves out of the tarball. Reading the repo's `package.json` could never have shown this — only the packed one does | The same gate reads the `package.json` **from inside the tarball**, not from the working tree |
| Packing to inspect a release produced seven tarballs with no `dist/` at all, while `main` said `dist/index.js` | `prepublishOnly` runs on `npm publish` and not on `npm pack`, so a clean tree packed nothing built. Publishing was safe; looking at what you were about to publish was not | The workspace root has a `prepare` script, which `npm pack` and `npm install` both run. The gate independently fails on a tarball whose `main` it cannot find |
| A source file was deleted and its compiled `.js`/`.d.ts` kept shipping | `tsc` writes into `outDir` and never removes what is no longer generated | Every package's `build` clears `dist` before compiling |

## The rule these share

A gate that reads the working tree cannot see a packaging bug. Lint, typecheck,
build and the test suite all passed on every one of the rows above. **The tarball
is the artifact; check the artifact.**
