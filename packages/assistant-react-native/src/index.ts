/**
 * Everything an app on a phone needs, from one install.
 *
 * @remarks
 * - **Why this package exists.** The pieces are split for reasons that cost
 *   someone something: the token server runs on a server and must not drag
 *   React Native onto it, the audio package carries a native dependency that
 *   means a rebuild, and the widget is a UI that anyone drawing their own
 *   should be able to leave out. None of those reasons apply to the ordinary
 *   case — an app that wants the assistant — and making that case install five
 *   packages and keep five versions in step is friction with nothing behind it.
 * - **It adds exactly one thing of its own: `<LiveAssistant>`.** Everything
 *   else is re-exported unchanged, so reading the source of
 *   `@live-assistant/core` still explains what you are holding, and an app that
 *   outgrows this package can depend on the pieces directly without changing an
 *   import. The one addition exists because this is the only package that can
 *   see the session, the audio and the widget at once — and because the forty
 *   lines it replaces were identical in every app that would ever write them.
 * - **The token server is deliberately absent.** It mints credentials with an
 *   API key, which belongs on a server and never in an app bundle. It is
 *   installed on its own, where it runs.
 */
export * from '@live-assistant/core';
export * from '@live-assistant/gemini';
export * from '@live-assistant/audio';
export * from '@live-assistant/react';
export * from '@live-assistant/widget';
export { LiveAssistant } from './live-assistant';
export type { LiveAssistantProps } from './live-assistant';
