/**
 * A router the tools can drive where there is no DOM to click.
 *
 * Three functions is the whole native path: `go` pushes a path, `back` pops,
 * and `current` says where the user is so an answer can name it. Where a
 * document exists this is not needed — a link is clicked instead, which is what
 * keeps a single-page router in charge of its own navigation.
 */
export interface PageRouter {
  go(path: string): void | Promise<void>;
  back(): void | Promise<void>;
  current?(): string | undefined;
}
