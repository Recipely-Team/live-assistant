import type { PageDocument } from './page-document';

const ELLIPSIS = '…';

/**
 * What the page says, as text.
 *
 * `innerText` where the environment has it, because it is what is *visible*:
 * `textContent` would hand the model the contents of every `<script>` and
 * `<style>` on the page, and the text of menus that are closed.
 */
export function readText(document: PageDocument, root: string | undefined, maxCharacters: number): string {
  const element = document.querySelector(root ?? 'body');
  const raw = element?.innerText ?? element?.textContent ?? '';
  const text = raw
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
  return text.length > maxCharacters ? text.slice(0, maxCharacters) + ELLIPSIS : text;
}
