import type { PageElement } from './page-element';

const bubbling = (type: string): unknown =>
  typeof Event === 'function' ? new Event(type, { bubbles: true }) : { type, bubbles: true };

/**
 * Puts text in a field so the app it belongs to notices.
 *
 * @remarks
 * - **Through the prototype's setter, not the property.** React tracks the last
 *   value it wrote on the node itself; assigning `element.value` leaves that
 *   tracker unchanged, so the `input` event is dismissed as a no-op and the
 *   next render puts the old text back. Calling the setter on the prototype is
 *   what a real keystroke does, and it is the one line that makes typing work
 *   on a controlled input.
 * - **Both events, in that order.** `input` is what React and Vue listen to;
 *   `change` is what a plain form and a `<select>` listen to.
 */
export function setFieldValue(element: PageElement, value: string): void {
  const prototype: unknown = Object.getPrototypeOf(element);
  const descriptor =
    typeof prototype === 'object' && prototype !== null
      ? Object.getOwnPropertyDescriptor(prototype, 'value')
      : undefined;

  if (typeof descriptor?.set === 'function') descriptor.set.call(element, value);
  else element.value = value;

  element.dispatchEvent(bubbling('input'));
  element.dispatchEvent(bubbling('change'));
}
