import type { PageActionType } from './page-action';
import type { PageDocument } from './page-document';
import type { PageRouter } from './page-router';
import type { PageWindow } from './page-window';

/**
 * How the page tool behaves. Every field is optional: the defaults are what an
 * app that passes nothing gets.
 *
 * @remarks
 * - **`actions` narrows what the model is told it can do**, not just what the
 *   tool will run. A word left out of the list never reaches the enum, so the
 *   model cannot ask for it and then be refused.
 * - **The caps are context protection.** A long page read whole would crowd out
 *   the conversation it is meant to inform; 4000 characters is roughly a screen
 *   of dense text and still leaves room to answer.
 * - **`document` and `window` are for tests and for a non-global page** (an
 *   iframe, a server render). Left out, the globals are used where they exist.
 */
export interface PageToolsOptions {
  /** Which actions the model may use. Default: all of them. */
  readonly actions?: readonly PageActionType[];
  /** The tool's name, if `page` collides with one of yours. Default `'page'`. */
  readonly name?: string;
  /** A CSS selector the tools are confined to. Default: the whole document. */
  readonly root?: string;
  /** Cap on the characters `read` returns. Default 4000. */
  readonly maxCharacters?: number;
  /** Cap on the targets `list` returns per kind. Default 40. */
  readonly maxTargets?: number;
  /** Navigation for a page with no DOM; see `PageRouter`. */
  readonly router?: PageRouter;
  readonly document?: PageDocument;
  readonly window?: PageWindow;
}
