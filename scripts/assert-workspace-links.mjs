/**
 * Asserts the workspace is testing its own source.
 *
 * @remarks
 * - **The failure this exists for.** The packages depend on each other by exact
 *   version. Once that version is published, an install can satisfy the range
 *   from the registry instead of from the folder next door — and npm then
 *   writes real copies into `packages/*\/node_modules/@live-assistant/`. Every
 *   gate goes on passing: lint, typecheck, build and the suite all run happily
 *   against the PUBLISHED code, which is precisely the code the change in your
 *   working tree is not in. It surfaced as a build error naming an export that
 *   was plainly there — because the copy being read was the previous release.
 * - **What it checks.** Every `@live-assistant/*` resolvable from a workspace
 *   package is a symlink pointing back into `packages/` or `examples/`.
 * - **The fix when it fails** is `rm -rf packages/*\/node_modules/@live-assistant
 *   examples/*\/node_modules/@live-assistant && npm install`.
 */
import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCOPE = '@live-assistant';

const errors = [];

const holders = [ROOT];
for (const group of ['packages', 'examples']) {
  const base = path.join(ROOT, group);
  if (!existsSync(base)) continue;
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    if (entry.isDirectory()) holders.push(path.join(base, entry.name));
  }
}

for (const holder of holders) {
  const scope = path.join(holder, 'node_modules', SCOPE);
  if (!existsSync(scope)) continue;
  for (const entry of readdirSync(scope)) {
    const installed = path.join(scope, entry);
    if (!lstatSync(installed).isSymbolicLink()) {
      errors.push(
        `${path.relative(ROOT, installed)} is a copy from the registry, not the package in this tree — the gates would run against the last release`,
      );
      continue;
    }
    const target = realpathSync(installed);
    if (!target.startsWith(path.join(ROOT, 'packages')) && !target.startsWith(path.join(ROOT, 'examples'))) {
      errors.push(`${path.relative(ROOT, installed)} links outside this workspace, to ${target}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`assert-workspace-links — ${errors.length} problem(s):\n`);
  for (const error of errors.sort()) console.error('  ' + error);
  console.error('\n  fix: rm -rf packages/*/node_modules/@live-assistant examples/*/node_modules/@live-assistant && npm install');
  process.exit(1);
}
console.log(`assert-workspace-links — OK (${holders.length} workspace folders checked)`);
