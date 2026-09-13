/**
 * Everything the page tool can be asked to do, defined once.
 *
 * @remarks
 * - **One vocabulary, three readers.** These words become the `enum` the model
 *   chooses from, the keys the tool dispatches on, and the allowlist an app
 *   narrows with `actions`. Spelled separately they would drift, and a word the
 *   model was told about but nothing performs comes back as a failed call it
 *   has to explain away.
 * - **Names are the model's, not the code's.** It picks by reading them, so
 *   they are the plainest word for the act: `press`, not `dispatchClick`.
 */
export const PageAction = {
  /** What the page says, as text. */
  Read: 'read',
  /** What can be clicked, typed into or followed, by name. */
  List: 'list',
  /** Follow a link, by its name or its path. */
  Navigate: 'navigate',
  /** Back, in history. */
  Back: 'back',
  /** Click a button or link by name. */
  Press: 'press',
  /** Put text in a field, found by its label. */
  Type: 'type',
  /** Move the page up, down, to the top or to the bottom. */
  Scroll: 'scroll',
} as const;

export type PageActionType = (typeof PageAction)[keyof typeof PageAction];
