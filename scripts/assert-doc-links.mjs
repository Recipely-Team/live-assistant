/**
 * Every link in the documentation has to go somewhere.
 *
 * @remarks
 * - **Why this is a gate.** Extracting the library moved `packages/README.md` to
 *   the repository root, which silently broke the "see the overview" link in all
 *   six package READMEs. Nothing failed: not lint, not the build, not the suite.
 *   The first person to notice would have been someone on npmjs.com clicking it.
 * - **Relative links inside `packages/` are rejected on purpose.** These pages
 *   are rendered on the registry, where a path up the tree is not something a
 *   reader can follow. Link to the repository by URL instead — and because that
 *   leaves a package page's only file links unresolvable by any checker, a URL
 *   into this repository's own tree has its path resolved here too. That is how
 *   the example app is reachable from npm at all, and renaming the folder would
 *   otherwise break seven pages silently.
 * - Anchors are checked too, against the headings of the file they point at.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const markdown = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) markdown(full, out);
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
};

const slug = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');

const headings = (file) =>
  new Set([...readFileSync(file, 'utf8').matchAll(/^#{1,6}\s+(.*)$/gm)].map((m) => slug(m[1])));

const errors = [];
const files = markdown(ROOT);

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const source = readFileSync(file, 'utf8');
  for (const [, link] of source.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    if (/^(https?:|mailto:|#)/.test(link)) {
      if (link.startsWith('#') && !headings(file).has(link.slice(1))) {
        errors.push(`${rel}: ${link} — no such heading in this file`);
      }
      // A URL into this repository's own tree is the only way a package page can
      // point at a file — relative paths are rejected above, because npm renders
      // these pages away from the tree. That makes them the links most likely to
      // rot: renaming a folder cannot break a link nothing resolves. Resolve the
      // path half here; the host and branch are this repository by construction.
      const inTree = link.match(/^https:\/\/github\.com\/Recipely-Team\/live-assistant\/(?:tree|blob)\/main\/([^#?]+)/);
      if (inTree !== null && !existsSync(path.join(ROOT, decodeURIComponent(inTree[1])))) {
        errors.push(`${rel}: ${link} — points into this repository at a path that does not exist`);
      }
      continue;
    }
    if (rel.startsWith(`packages${path.sep}`)) {
      errors.push(`${rel}: ${link} — a package page is read on npm, where a relative path leads nowhere; link to the repository by URL`);
      continue;
    }
    const [target, fragment] = link.split('#');
    const resolved = path.resolve(path.dirname(file), target);
    if (!existsSync(resolved)) {
      errors.push(`${rel}: ${link} — no such file`);
      continue;
    }
    if (fragment !== undefined && statSync(resolved).isFile() && !headings(resolved).has(fragment)) {
      errors.push(`${rel}: ${link} — no heading "${fragment}" in ${path.basename(resolved)}`);
    }
  }
}

if (errors.length > 0) {
  console.error(`assert-doc-links — ${errors.length} broken link(s):\n`);
  for (const error of errors.sort()) console.error('  ' + error);
  process.exit(1);
}
console.log(`assert-doc-links — OK (${files.length} files)`);
