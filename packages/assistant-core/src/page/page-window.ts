/** The part of a window the page tools use: where it is, where it has been, and how far down. */
export interface PageWindow {
  readonly location?: { readonly href?: string; assign?(url: string): void };
  readonly history?: { back?(): void };
  readonly scrollY?: number;
  readonly innerHeight?: number;
  scrollTo?(x: number, y: number): void;
  scrollBy?(x: number, y: number): void;
}
