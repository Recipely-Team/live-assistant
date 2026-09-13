import type { PageDocument } from './page-document';
import type { PageElement } from './page-element';

const NOTHING = 0;
const FIRST = 0;

/** What an element is called, as someone reading the screen aloud would say it. */
export function accessibleName(element: PageElement): string {
  const labelled = element.labels?.[FIRST]?.textContent;
  const candidate =
    element.getAttribute('aria-label') ??
    labelled ??
    element.innerText ??
    element.textContent ??
    element.getAttribute('placeholder') ??
    element.getAttribute('title') ??
    element.getAttribute('name') ??
    '';
  return candidate.replace(/\s+/g, ' ').trim();
}

/**
 * Confines a selector list to a root.
 *
 * Distributed over the commas rather than prefixed once: `main a, button`
 * scoped as one string would leave `button` matching the whole page, which is
 * the bug an app setting `root` is trying to avoid.
 */
export function within(selectors: string, root: string | undefined): string {
  if (root === undefined) return selectors;
  return selectors
    .split(',')
    .map((part) => `${root} ${part.trim()}`)
    .join(', ');
}

/** The named, enabled elements matching `selectors`, in document order. */
export function findTargets(
  document: PageDocument,
  selectors: string,
  root: string | undefined,
  limit: number,
): { readonly name: string; readonly element: PageElement }[] {
  const found = document.querySelectorAll(within(selectors, root));
  const targets: { name: string; element: PageElement }[] = [];
  const seen = new Set<PageElement>();

  for (let index = NOTHING; index < found.length && targets.length < limit; index += 1) {
    const element = found[index];
    if (element === undefined || seen.has(element) || element.disabled === true) continue;
    seen.add(element);
    const name = accessibleName(element);
    if (name.length === NOTHING) continue;
    targets.push({ name, element });
  }
  return targets;
}

/**
 * The target the model meant.
 *
 * Exact first, then a prefix, then anything containing it, then the other way
 * round: asked to press Save, a model says "Save", "save recipe" and "the Save
 * button" on different days, and all three mean the one button on the screen.
 */
export function matchTarget<T extends { readonly name: string }>(targets: readonly T[], wanted: string): T | undefined {
  const needle = wanted.replace(/\s+/g, ' ').trim().toLowerCase();
  if (needle.length === NOTHING) return undefined;
  const named = (target: T): string => target.name.toLowerCase();
  return (
    targets.find((target) => named(target) === needle) ??
    targets.find((target) => named(target).startsWith(needle)) ??
    targets.find((target) => named(target).includes(needle)) ??
    targets.find((target) => needle.includes(named(target)))
  );
}
