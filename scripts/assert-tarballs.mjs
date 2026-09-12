/**
 * Asserts that what an installer downloads actually works.
 *
 * @remarks
 * - **Why a separate gate.** Lint, typecheck, build and the suite all read the
 *   working tree. None of them sees the tarball, and the tarball is the only
 *   artifact anybody installs. Every packaging mistake so far was invisible to
 *   the other four: `publishConfig` carrying `main`/`types` (npm leaves those
 *   overrides out of the tarball, so the published package pointed at nothing),
 *   and every package pointing `main` at `src/index.ts`, which made
 *   `require('@live-assistant/token-server')` fail on Node.
 * - **What it checks.** For each package: the tarball carries the file `main`
 *   and `types` name, a README and a LICENSE; it carries no tests; and every
 *   dependency on a sibling package is pinned to the exact version being
 *   published, because the umbrella is not installable if one of its members
 *   resolves to a different version.
 * - **It packs, it does not publish.** Nothing here talks to the registry.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = path.join(ROOT, 'packages');
const SCOPE = '@live-assistant/';

const errors = [];
const staging = mkdtempSync(path.join(tmpdir(), 'live-assistant-pack-'));

const packageDirs = readdirSync(PACKAGES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

for (const dir of packageDirs) {
  const manifest = JSON.parse(readFileSync(path.join(PACKAGES, dir, 'package.json'), 'utf8'));
  const { name, version } = manifest;

  execFileSync('npm', ['pack', '--workspace', name, '--pack-destination', staging], {
    cwd: ROOT,
    stdio: 'pipe',
  });
  const tarball = readdirSync(staging).find((file) => file.startsWith(`${name.replace(SCOPE, 'live-assistant-')}-`));
  if (tarball === undefined) {
    errors.push(`${name}: npm pack produced no tarball`);
    continue;
  }

  const listed = execFileSync('tar', ['-tzf', path.join(staging, tarball)], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    // Every path in an npm tarball is prefixed with `package/`.
    .map((entry) => entry.replace(/^package\//, ''));

  const packed = JSON.parse(
    execFileSync('tar', ['-xzOf', path.join(staging, tarball), 'package/package.json'], {
      encoding: 'utf8',
    }),
  );

  // `main` must be built JavaScript and `types` a declaration file. Pointing
  // `main` at `src/index.ts` passes an existence check — the tarball does carry
  // src/ — and still cannot be loaded: that is how the token server shipped
  // unusable on Node.
  const EXPECTED_SUFFIX = { main: '.js', types: '.d.ts' };
  for (const [field, suffix] of Object.entries(EXPECTED_SUFFIX)) {
    const target = packed[field];
    if (typeof target !== 'string') {
      errors.push(`${name}: the packed package.json has no "${field}" — publishConfig cannot supply it`);
      continue;
    }
    if (!listed.includes(target)) {
      errors.push(`${name}: "${field}" points at ${target}, which the tarball does not carry`);
    }
    if (!target.endsWith(suffix)) {
      errors.push(`${name}: "${field}" is ${target}, not a ${suffix} file — an installer cannot load TypeScript source`);
    }
  }

  if (!listed.includes('README.md')) errors.push(`${name}: the tarball has no README.md — its npm page would be blank`);
  if (!listed.includes('LICENSE')) errors.push(`${name}: the tarball has no LICENSE`);

  const test = listed.find((entry) => entry.includes('__tests__') || entry.endsWith('.test.ts') || entry.endsWith('.test.tsx'));
  if (test !== undefined) errors.push(`${name}: the tarball carries a test (${test}) — check the "files" list`);

  for (const [dependency, range] of Object.entries(packed.dependencies ?? {})) {
    if (!dependency.startsWith(SCOPE)) continue;
    if (range !== version) {
      errors.push(
        `${name}: depends on ${dependency}@${range} but is itself ${version} — sibling versions are pinned exactly and move together`,
      );
    }
  }
}

rmSync(staging, { recursive: true, force: true });

if (errors.length > 0) {
  console.error(`assert-tarballs — ${errors.length} problem(s):\n`);
  for (const error of errors.sort()) console.error('  ' + error);
  process.exit(1);
}
console.log(`assert-tarballs — OK (${packageDirs.length} packages)`);
