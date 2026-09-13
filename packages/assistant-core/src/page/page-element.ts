/**
 * The part of an element the page tools touch.
 *
 * @remarks
 * - **Structural, not `lib.dom`.** Core depends on nothing and runs where there
 *   is no DOM at all, so the contract is written out here and a real element
 *   satisfies it by shape. It is also what makes the suite possible: the tests
 *   run under the `react-native` preset, which has no jsdom, and build pages out
 *   of plain objects.
 * - **`value` and `labels` are the field half.** Only inputs carry them, which
 *   is why they are optional rather than a second interface — the tools ask an
 *   element what it can do rather than what it is.
 */
export interface PageElement {
  readonly tagName: string;
  readonly textContent?: string | null;
  readonly innerText?: string;
  value?: string;
  readonly disabled?: boolean;
  readonly labels?: ArrayLike<{ readonly textContent?: string | null }> | null;
  getAttribute(name: string): string | null;
  click(): void;
  dispatchEvent(event: unknown): boolean;
}
