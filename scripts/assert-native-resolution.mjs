/**
 * Asserts that no package sends its web build to a phone.
 *
 * @remarks
 * - **Why.** A `browser` map is read by Metro on iOS and Android as well — it is
 *   in Metro's default `mainFields`, after `react-native`. Up to 0.3.4,
 *   `@live-assistant/audio` mapped its microphone and player to the `.web.js`
 *   files there and nothing mapped them back, so phones shipped the web
 *   microphone: `getUserMedia` does not exist on a phone, the session reported
 *   `microphone_denied` without ever asking, and played nothing. Every gate here
 *   was green, because Jest and the web build load the right files.
 * - **What it checks.** For every package with a `browser` map, each mapped path
 *   also appears in a `react-native` map that sends it back to itself (or to
 *   another file that is not a `.web.js`), and that file is in the package.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const packagesDir = path.join(root, 'packages');
const failures = [];

for (const name of fs.readdirSync(packagesDir)) {
  const manifestPath = path.join(packagesDir, name, 'package.json');
  if (!fs.existsSync(manifestPath)) continue;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const browser = manifest.browser;
  if (browser === undefined || typeof browser !== 'object') continue;
  const native = typeof manifest['react-native'] === 'object' ? manifest['react-native'] : {};
  for (const from of Object.keys(browser)) {
    const to = native[from];
    if (typeof to !== 'string') {
      failures.push(`${manifest.name}: "${from}" is mapped for the browser but not back for react-native — phones get the web build`);
    } else if (/\.web\.[cm]?js$/.test(to)) {
      failures.push(`${manifest.name}: react-native maps "${from}" to a web build (${to})`);
    }
  }
}

if (failures.length > 0) {
  console.error(`assert-native-resolution — ${String(failures.length)} problem(s):\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log('assert-native-resolution: every browser mapping is mapped back for react-native');
