import type { TokenFailureCodeType } from './token-failure-code';

/**
 * A failed mint.
 *
 * @remarks
 * - **`detail` is diagnostic text for server logs** — never send it to a client.
 * - **`cause` is what the transport threw**, handed back untouched: the timeout,
 *   the DNS error, the TLS error, or a value that is not an `Error` at all. Its
 *   message is flattened into `detail` for convenience, but a message is not a
 *   stack and a logger's error serializer wants the object. Without this the
 *   first integrator had to wrap `fetch` to keep what it threw, and a non-`Error`
 *   throw left nothing to log at all. `AssistantFailure` in `@live-assistant/core`
 *   has carried a `cause` from the start; this is the same idea, one package over.
 */
export interface TokenFailure {
  readonly code: TokenFailureCodeType;
  readonly status?: number;
  readonly detail?: string;
  readonly cause?: unknown;
}
