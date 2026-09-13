import type { AssistantTool } from '../tools/assistant-tool';
import { PageAction } from './page-action';
import type { PageActionType } from './page-action';
import type { PageDocument } from './page-document';
import { setFieldValue } from './page-fields';
import { findTargets, matchTarget } from './page-targets';
import { readText } from './page-text';
import type { PageToolsOptions } from './page-tools-options';
import type { PageWindow } from './page-window';

const DEFAULT_NAME = 'page';
const DEFAULT_MAX_CHARACTERS = 4000;
const DEFAULT_MAX_TARGETS = 40;
const NOTHING = 0;
const ORIGIN = 0;
const PAGE_SHARE = 0.9;
// A page whose window reports no height still has to move when asked.
const ASSUMED_VIEWPORT = 800;
const BOTTOM = 1_000_000;
const OK = true;
const FAILED = false;

const LINKS = 'a[href]';
const BUTTONS = 'button, [role="button"], input[type="submit"], input[type="button"]';
const FIELDS = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select';

const ScrollWay = { Up: 'up', Down: 'down', Top: 'top', Bottom: 'bottom' } as const;

const globals = globalThis as { document?: PageDocument; window?: PageWindow };
const named = (targets: readonly { readonly name: string }[]): string[] => targets.map((target) => target.name);

/**
 * The tools that let the assistant read and drive the page the user is looking at.
 *
 * @remarks
 * - **Nothing is declared by the app.** The DOM is read at the moment of the
 *   call, so there is no route table to keep in step with the router and no
 *   registration to forget on a new screen. A page that renders a link is a
 *   page the assistant can already follow.
 * - **One tool with an action enum, not seven tools.** A live session fixes its
 *   tool list when it is set up, so every tool is paid for at setup whether or
 *   not it is used: an enum costs about 200 tokens where a tool apiece costs
 *   1.5–2k. The same reasoning the app this came from measured.
 * - **Targets are named the way a person would name them** — the accessible
 *   name, which is what a screen reader announces and what the user just said
 *   out loud. That also makes React Native Web work unchanged: its
 *   `accessibilityLabel` renders as `aria-label`.
 * - **`navigate` clicks the link** rather than assigning `location`. Assigning
 *   it reloads the whole document, which throws away the single-page router,
 *   the app's state and the live session with it.
 * - **A target that is not there is answered, not thrown**, and the answer
 *   carries the names that ARE there. The model then picks one instead of
 *   repeating a guess, and the conversation never stalls on a call with no
 *   response — the registry's rule, kept here deliberately.
 * - **Without a document it is inert**, unless a `router` is supplied: on a
 *   phone the only two acts that mean anything are navigate and back, and
 *   those are the two the enum then offers.
 */
export function createPageTools(options: PageToolsOptions = {}): AssistantTool[] {
  const document = options.document ?? globals.document;
  const window = options.window ?? globals.window;
  const router = options.router;
  const maxCharacters = options.maxCharacters ?? DEFAULT_MAX_CHARACTERS;
  const maxTargets = options.maxTargets ?? DEFAULT_MAX_TARGETS;
  const root = options.root;

  const wanted: readonly PageActionType[] = options.actions ?? Object.values(PageAction);
  const reachable = (action: PageActionType): boolean =>
    document !== undefined || ((action === PageAction.Navigate || action === PageAction.Back) && router !== undefined);
  const actions = wanted.filter(reachable);
  if (actions.length === NOTHING) return [];

  const where = (): Record<string, unknown> => ({
    url: router?.current?.() ?? window?.location?.href,
    title: document?.title,
  });
  const targets = (selectors: string): { readonly name: string; readonly element: ReturnType<typeof findTargets>[number]['element'] }[] =>
    document === undefined ? [] : findTargets(document, selectors, root, maxTargets);

  const run = async (args: Readonly<Record<string, unknown>>): Promise<Readonly<Record<string, unknown>>> => {
    const action = args.action as PageActionType;
    const target = typeof args.target === 'string' ? args.target : undefined;
    const value = typeof args.value === 'string' ? args.value : undefined;

    if (!actions.includes(action)) return { ok: FAILED, error: 'unknown_action', actions };
    if (document === undefined && action !== PageAction.Navigate && action !== PageAction.Back) {
      return { ok: FAILED, error: 'no_page' };
    }

    if (action === PageAction.Read) {
      return { ok: OK, ...where(), text: readText(document as PageDocument, root, maxCharacters) };
    }

    if (action === PageAction.List) {
      return {
        ok: OK,
        ...where(),
        links: named(targets(LINKS)),
        buttons: named(targets(BUTTONS)),
        fields: named(targets(FIELDS)),
      };
    }

    if (action === PageAction.Back) {
      if (router !== undefined) await router.back();
      else if (window?.history?.back !== undefined) window.history.back();
      else return { ok: FAILED, error: 'no_history' };
      return { ok: OK, ...where() };
    }

    if (action === PageAction.Navigate) {
      if (target === undefined) return { ok: FAILED, error: 'missing_target' };
      const links = targets(LINKS);
      const link = matchTarget(links, target);
      if (link !== undefined) {
        link.element.click();
        return { ok: OK, followed: link.name, ...where() };
      }
      if (router !== undefined) {
        await router.go(target);
        return { ok: OK, followed: target, ...where() };
      }
      if (/^([a-z]+:)?\/\//.test(target) || target.startsWith('/')) {
        if (window?.location?.assign === undefined) return { ok: FAILED, error: 'no_page' };
        window.location.assign(target);
        return { ok: OK, followed: target };
      }
      return { ok: FAILED, error: 'no_match', links: named(links) };
    }

    if (action === PageAction.Press) {
      if (target === undefined) return { ok: FAILED, error: 'missing_target' };
      const pressable = [...targets(BUTTONS), ...targets(LINKS)];
      const found = matchTarget(pressable, target);
      if (found === undefined) return { ok: FAILED, error: 'no_match', buttons: named(pressable) };
      found.element.click();
      return { ok: OK, pressed: found.name, ...where() };
    }

    if (action === PageAction.Type) {
      if (target === undefined) return { ok: FAILED, error: 'missing_target' };
      if (value === undefined) return { ok: FAILED, error: 'missing_value' };
      const fields = targets(FIELDS);
      const field = matchTarget(fields, target);
      if (field === undefined) return { ok: FAILED, error: 'no_match', fields: named(fields) };
      setFieldValue(field.element, value);
      return { ok: OK, field: field.name, value };
    }

    const way = value ?? ScrollWay.Down;
    const height = window?.innerHeight ?? ASSUMED_VIEWPORT;
    if (way === ScrollWay.Top) window?.scrollTo?.(ORIGIN, ORIGIN);
    else if (way === ScrollWay.Bottom) window?.scrollTo?.(ORIGIN, BOTTOM);
    else window?.scrollBy?.(ORIGIN, height * PAGE_SHARE * (way === ScrollWay.Up ? -1 : 1));
    return { ok: OK, scrolled: way, y: window?.scrollY };
  };

  return [
    {
      definition: {
        name: options.name ?? DEFAULT_NAME,
        description:
          'Reads and operates the page the user is looking at. Use "read" for what it says and "list" for what can be followed, pressed or filled; then "navigate", "press" or "type" naming a target from that list. When a target is not found, the answer carries the names that are there — choose one of those instead of guessing again.',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: actions, description: 'What to do.' },
            target: {
              type: 'string',
              description: 'The link, button or field, by the name shown on screen. For navigate, a path may be given instead.',
            },
            value: {
              type: 'string',
              description: 'For type, the text to put in the field. For scroll, one of up, down, top, bottom.',
            },
          },
          required: ['action'],
        },
      },
      run,
    },
  ];
}
