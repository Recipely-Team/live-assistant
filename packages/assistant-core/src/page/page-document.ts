import type { PageElement } from './page-element';

/** The part of a document the page tools read: its title, and the elements in it. */
export interface PageDocument {
  readonly title?: string;
  querySelector(selectors: string): PageElement | null;
  querySelectorAll(selectors: string): ArrayLike<PageElement>;
}
