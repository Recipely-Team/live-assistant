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
 *   resolves to a different version; and all seven packages, plus the workspace
 *   root the release tag is cut from, carry that one version.
 * - **Then it loads them.** The three packages Node can load are extracted into
 *   a throwaway `node_modules` and required, and one export of each is named.
 *   The structural checks above would pass a `main` that points at a real file
 *   which happens to be unloadable; requiring it is what proves the entry point.
 *   The other four reach React Native, whose source is Flow, so Node cannot load
 *   them by design — they are covered by the suite and by an app's bundler.
 * - **It packs, it does not publish, and it needs no network.** Nothing here
 *   talks to the registry: the tarballs are unpacked by hand into a temporary
 *   tree, so the check is the same offline and in CI.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKAGES = path.join(ROOT, 'packages');
const SCOPE = '@live-assistant/';

// One export per package that Node can load, chosen as the thing an integrator
// reaches for first. The rest of the packages reach React Native (Flow source),
// which Node cannot parse — that is by design, not a gap.
const NODE_LOADABLE = {
  '@live-assistant/core': 'ToolRegistry',
  '@live-assistant/gemini': 'GeminiLiveSession',
  '@live-assistant/token-server': 'mintGeminiLiveToken',
};

const errors = [];
const staging = mkdtempSync(path.join(tmpdir(), 'live-assistant-pack-'));
const tarballs = new Map();

const packageDirs = readdirSync(PACKAGES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

for (const dir of packageDirs) {
  const manifest = JSON.parse(readFileSync(path.join(PACKAGES, dir, 'package.json'), 'utf8'));
  const { name, version } = manifest;

  // `--ignore-scripts` is load-bearing: each package's `prepack` builds it, and a
  // gate that rebuilds the tree before inspecting it can never catch a tarball
  // whose `main` was never built. CI builds first, deliberately and separately.
  execFileSync('npm', ['pack', '--ignore-scripts', '--workspace', name, '--pack-destination', staging], {
    cwd: ROOT,
    stdio: 'pipe',
  });
  const tarball = readdirSync(staging).find((file) => file.startsWith(`${name.replace(SCOPE, 'live-assistant-')}-`));
  if (tarball === undefined) {
    errors.push(`${name}: npm pack produced no tarball`);
    continue;
  }

  tarballs.set(name, path.join(staging, tarball));

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

  // A config plugin missing from `files` breaks every integrator's prebuild and
  // nothing else notices: it is not imported, so no build or test reaches it.
  if (existsSync(path.join(PACKAGES, dir, 'app.plugin.js')) && !listed.includes('app.plugin.js')) {
    errors.push(`${name}: ships an Expo config plugin that the tarball does not carry — add app.plugin.js to "files"`);
  }

  if (!listed.includes('README.md')) errors.push(`${name}: the tarball has no README.md — its npm page would be blank`);
  if (!listed.includes('LICENSE')) errors.push(`${name}: the tarball has no LICENSE`);

  // Tests and test doubles are both unpublished, for the same reason: a name a
  // consumer cannot be expected to import is a name we could never change, and
  // the fixtures reached the tarball at `dist/controller/__fixtures__/` before
  // anybody decided they should. Exposing the fakes is a real feature — through a
  // named entry point, deliberately, not as a side effect of the build.
  const internal = listed.find(
    (entry) =>
      entry.includes('__tests__') ||
      entry.includes('__fixtures__') ||
      entry.endsWith('.test.ts') ||
      entry.endsWith('.test.tsx'),
  );
  if (internal !== undefined) {
    errors.push(`${name}: the tarball carries ${internal} — tests and fixtures are not published; check "files" and tsconfig.build.json`);
  }

  for (const [dependency, range] of Object.entries(packed.dependencies ?? {})) {
    if (!dependency.startsWith(SCOPE)) continue;
    if (range !== version) {
      errors.push(
        `${name}: depends on ${dependency}@${range} but is itself ${version} — sibling versions are pinned exactly and move together`,
      );
    }
  }
}

// --- the seven packages, and the root, carry one version --------------------
// The sibling-pin check above cannot see this on its own: nothing pins the token
// server, so it could be left behind at the old version and still pass. The root
// is checked because the release tag is cut from a `npm version` run that
// includes it — with the root at 0.0.0, the documented bump tagged v0.1.0 while
// the packages said 0.2.0, and the release workflow refused the mismatch.
{
  const versions = new Map();
  for (const dir of packageDirs) {
    const { name, version } = JSON.parse(readFileSync(path.join(PACKAGES, dir, 'package.json'), 'utf8'));
    versions.set(name, version);
  }
  const root = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  // The example app installs the umbrella by version like any integrator. npm
  // links it from the workspace either way, so a stale pin there is invisible
  // until someone copies the example's package.json into a real app.
  const examples = path.join(ROOT, 'examples');
  for (const dir of readdirSync(examples, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
    const manifest = JSON.parse(readFileSync(path.join(examples, dir.name, 'package.json'), 'utf8'));
    for (const [dependency, range] of Object.entries(manifest.dependencies ?? {})) {
      if (!dependency.startsWith(SCOPE)) continue;
      if (range !== versions.get(dependency)) {
        errors.push(
          `${manifest.name}: depends on ${dependency}@${range}, which is not the ${versions.get(dependency)} in this tree`,
        );
      }
    }
  }

  const distinct = new Set([...versions.values(), root]);
  if (distinct.size > 1) {
    const listing = [...versions].map(([name, version]) => `${name}@${version}`).join(', ');
    errors.push(
      `the packages do not share one version — root@${root}, ${listing}; they are pinned to each other and release under one tag`,
    );
  }
}

// --- the build script must name every package -------------------------------
// The order is hard-coded because npm does not topologically order a
// `--workspaces` script run. Nothing else notices when an eighth package is
// added and left out of it: it would simply never be built, and its tarball
// would be the one with no dist/.
{
  const rootBuild = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts.build;
  for (const dir of packageDirs) {
    const { name } = JSON.parse(readFileSync(path.join(PACKAGES, dir, 'package.json'), 'utf8'));
    if (!rootBuild.includes(`-w ${name}`)) {
      errors.push(`${name}: the root "build" script does not build it — add it, in dependency order`);
    }
  }
}

// --- load phase: require what an installer would receive --------------------
const tree = path.join(staging, 'tree');
for (const [name, tarball] of tarballs) {
  if (!(name in NODE_LOADABLE)) continue;
  const target = path.join(tree, 'node_modules', name);
  mkdirSync(target, { recursive: true });
  execFileSync('tar', ['-xzf', tarball, '-C', target, '--strip-components=1'], { stdio: 'pipe' });
}

const probe = path.join(tree, 'probe.cjs');
writeFileSync(
  probe,
  `const expected = ${JSON.stringify(NODE_LOADABLE)};
for (const [name, exported] of Object.entries(expected)) {
  const loaded = require(name);
  if (loaded[exported] === undefined) {
    console.log(name + ': loaded, but does not export ' + exported);
  }
}
`,
);
try {
  const complaints = execFileSync(process.execPath, [probe], { encoding: 'utf8', stdio: 'pipe' }).trim();
  if (complaints !== '') for (const line of complaints.split('\n')) errors.push(line);
} catch (failure) {
  const detail = String(failure.stderr ?? failure.message).split('\n').slice(0, 4).join(' / ');
  errors.push(`a packed entry point could not be loaded by node: ${detail}`);
}

rmSync(staging, { recursive: true, force: true });

if (errors.length > 0) {
  console.error(`assert-tarballs — ${errors.length} problem(s):\n`);
  for (const error of errors.sort()) console.error('  ' + error);
  process.exit(1);
}
console.log(
  `assert-tarballs — OK (${packageDirs.length} packages packed, ${Object.keys(NODE_LOADABLE).length} loaded on node)`,
);
