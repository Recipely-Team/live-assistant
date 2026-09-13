/**
 * The page pack, against a page built out of plain objects.
 *
 * The suite runs on the `react-native` preset, which has no jsdom — so the
 * tools are written against structural interfaces and a fake page satisfies
 * them. That is not a workaround: it is the same reason the tools work in a
 * React Native Web app, an iframe and a server render without knowing which.
 */
import { createPageTools } from '../create-page-tools';
import { PageAction } from '../page-action';
import type { PageDocument } from '../page-document';
import type { PageElement } from '../page-element';
import type { PageWindow } from '../page-window';

type Recorded = { readonly clicked: string[]; readonly events: string[] };

function element(name: string, extras: Partial<PageElement> = {}, log?: Recorded): PageElement {
  return {
    tagName: 'A',
    textContent: name,
    getAttribute: () => null,
    click: () => log?.clicked.push(name),
    dispatchEvent: (event) => {
      log?.events.push((event as { type: string }).type);
      return true;
    },
    ...extras,
  };
}

function page(bySelector: Record<string, PageElement[]>, text = 'Recipes for tonight'): PageDocument {
  return {
    title: 'Recipely',
    querySelector: () => element('root', { innerText: text }),
    querySelectorAll: (selectors) => bySelector[selectors] ?? [],
  };
}

const LINKS = 'a[href]';
const BUTTONS = 'button, [role="button"], input[type="submit"], input[type="button"]';
const FIELDS = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select';

const window = (over: Partial<PageWindow> = {}): PageWindow => ({
  location: { href: 'https://example.com/recipes', assign: jest.fn() },
  history: { back: jest.fn() },
  scrollY: 0,
  innerHeight: 800,
  scrollTo: jest.fn(),
  scrollBy: jest.fn(),
  ...over,
});

const only = <T,>(tools: readonly T[]): T => {
  expect(tools).toHaveLength(1);
  return tools[0] as T;
};

describe('the page pack', () => {
  it('says what the page shows, with its title and url', async () => {
    const tool = only(createPageTools({ document: page({}), window: window() }));

    const answer = await tool.run({ action: PageAction.Read }, { id: '1', name: 'page', args: {} });

    expect(answer).toMatchObject({
      ok: true,
      title: 'Recipely',
      url: 'https://example.com/recipes',
      text: 'Recipes for tonight',
    });
  });

  it('lists what can be followed, pressed and filled, by the name on screen', async () => {
    const document = page({
      [LINKS]: [element('My recipes')],
      [BUTTONS]: [element('Save')],
      [FIELDS]: [element('Search', { getAttribute: (name) => (name === 'placeholder' ? 'Search' : null), textContent: null })],
    });
    const tool = only(createPageTools({ document, window: window() }));

    const answer = await tool.run({ action: PageAction.List }, { id: '1', name: 'page', args: {} });

    expect(answer).toMatchObject({ links: ['My recipes'], buttons: ['Save'], fields: ['Search'] });
  });

  // Assigning `location` reloads the document, which throws away the router,
  // the app's state and the live session in the middle of a sentence.
  it('follows a link by clicking it, never by assigning the url', async () => {
    const log: Recorded = { clicked: [], events: [] };
    const document = page({ [LINKS]: [element('My recipes', {}, log), element('Settings', {}, log)] });
    const win = window();
    const tool = only(createPageTools({ document, window: win }));

    const answer = await tool.run({ action: PageAction.Navigate, target: 'my recipes' }, { id: '1', name: 'page', args: {} });

    expect(answer).toMatchObject({ ok: true, followed: 'My recipes' });
    expect(log.clicked).toEqual(['My recipes']);
    expect(win.location?.assign).not.toHaveBeenCalled();
  });

  // A call left unanswered stalls a live session with no error anywhere, and a
  // model told only "no" repeats the same guess. It is told what is there.
  it('answers a target that is not on the page with the names that are', async () => {
    const document = page({ [LINKS]: [element('My recipes')] });
    const tool = only(createPageTools({ document, window: window() }));

    const answer = await tool.run({ action: PageAction.Navigate, target: 'shopping list' }, { id: '1', name: 'page', args: {} });

    expect(answer).toEqual({ ok: false, error: 'no_match', links: ['My recipes'] });
  });

  it('presses a button the model named loosely', async () => {
    const log: Recorded = { clicked: [], events: [] };
    const document = page({ [BUTTONS]: [element('Save', {}, log)], [LINKS]: [] });
    const tool = only(createPageTools({ document, window: window() }));

    const answer = await tool.run({ action: PageAction.Press, target: 'the Save button' }, { id: '1', name: 'page', args: {} });

    expect(answer).toMatchObject({ ok: true, pressed: 'Save' });
    expect(log.clicked).toEqual(['Save']);
  });

  // React keeps its own record of the last value it wrote. Assigning `.value`
  // leaves that record untouched, so the input event is dismissed as a no-op
  // and the next render puts the old text back — the field looks unchanged.
  it('types through the prototype setter, so a controlled input keeps the text', async () => {
    const log: Recorded = { clicked: [], events: [] };
    const written: string[] = [];
    const prototype = {};
    Object.defineProperty(prototype, 'value', { set: (value: string) => written.push(value), get: () => written[written.length - 1] });
    const field = Object.create(prototype) as PageElement;
    Object.assign(field, element('Search', { getAttribute: () => null, textContent: 'Search' }, log));
    const tool = only(createPageTools({ document: page({ [FIELDS]: [field] }), window: window() }));

    const answer = await tool.run({ action: PageAction.Type, target: 'search', value: 'lentil soup' }, { id: '1', name: 'page', args: {} });

    expect(answer).toMatchObject({ ok: true, field: 'Search', value: 'lentil soup' });
    expect(written).toEqual(['lentil soup']);
    expect(log.events).toEqual(['input', 'change']);
  });

  it('scrolls by a page, and to the very top', async () => {
    const win = window();
    const tool = only(createPageTools({ document: page({}), window: win }));

    await tool.run({ action: PageAction.Scroll, value: 'down' }, { id: '1', name: 'page', args: {} });
    await tool.run({ action: PageAction.Scroll, value: 'top' }, { id: '2', name: 'page', args: {} });

    expect(win.scrollBy).toHaveBeenCalledWith(0, 720);
    expect(win.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('goes back through the history, or through a router when one is given', async () => {
    const win = window();
    const router = { go: jest.fn(), back: jest.fn(), current: () => '/recipes' };

    await only(createPageTools({ document: page({}), window: win })).run({ action: PageAction.Back }, { id: '1', name: 'page', args: {} });
    await only(createPageTools({ document: page({}), window: win, router })).run({ action: PageAction.Back }, { id: '2', name: 'page', args: {} });

    expect(win.history?.back).toHaveBeenCalledTimes(1);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('confines itself to the root it was given, comma by comma', async () => {
    const asked: string[] = [];
    const document: PageDocument = {
      title: 'Recipely',
      querySelector: () => null,
      querySelectorAll: (selectors) => {
        asked.push(selectors);
        return [];
      },
    };
    const tool = only(createPageTools({ document, window: window(), root: 'main' }));

    await tool.run({ action: PageAction.List }, { id: '1', name: 'page', args: {} });

    expect(asked[0]).toBe('main a[href]');
    // Every part of the list is scoped: prefixing the string once would leave
    // `button` matching the navigation bar outside the root.
    expect(asked[1]?.split(', ').every((part) => part.startsWith('main '))).toBe(true);
  });

  it('offers nothing at all where there is no page and no router', () => {
    expect(createPageTools({})).toEqual([]);
  });

  it('offers only navigate and back on a phone, where a router is the whole of it', async () => {
    const router = { go: jest.fn(), back: jest.fn() };
    const tool = only(createPageTools({ router }));

    expect(tool.definition.parameters?.properties).toMatchObject({ action: { enum: ['navigate', 'back'] } });
    await tool.run({ action: PageAction.Navigate, target: '/recipes/42' }, { id: '1', name: 'page', args: {} });
    expect(router.go).toHaveBeenCalledWith('/recipes/42');
  });

  // A word the model is told about but nothing performs comes back as a failed
  // call it has to explain away, so the allowlist shrinks the enum itself.
  it('narrows the enum to the actions the app allowed', async () => {
    const tool = only(createPageTools({ document: page({}), window: window(), actions: [PageAction.Read] }));

    expect(tool.definition.parameters?.properties).toMatchObject({ action: { enum: ['read'] } });
    const answer = await tool.run({ action: PageAction.Press, target: 'Save' }, { id: '1', name: 'page', args: {} });
    expect(answer).toEqual({ ok: false, error: 'unknown_action', actions: ['read'] });
  });

  it('takes the tool name the app asked for', () => {
    expect(only(createPageTools({ document: page({}), name: 'site' })).definition.name).toBe('site');
  });
});
