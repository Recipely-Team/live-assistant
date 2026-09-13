import { useEffect, useRef, useState } from 'react';
import { AssistantController, ToolRegistry } from '@live-assistant/core';
import type { AssistantControllerOptions, AssistantFailure, AssistantTool, PageToolsOptions } from '@live-assistant/core';
import { Microphone, PcmPlayer } from '@live-assistant/audio';
import { GeminiLiveSession } from '@live-assistant/gemini';
import type { GeminiLiveCredentials } from '@live-assistant/gemini';
import { AssistantProvider, useAssistantState } from '@live-assistant/react';
import { AssistantWidget } from '@live-assistant/widget';
import type { AssistantWidgetProps } from '@live-assistant/widget';

/** Shared by both ways of connecting; see `LiveAssistantProps`. */
interface LiveAssistantCommonProps extends AssistantWidgetProps {
  /** Sent to your token endpoint as `languageCode`. Default `'en-US'`. */
  readonly language?: string;
  /** Added to the token request — this is where an app's own `Authorization` goes. Read fresh on every connection. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Your app's own tools, on top of the page pack. */
  readonly tools?: readonly AssistantTool[] | ToolRegistry;
  /** Reading and driving the page. On by default in a browser; `false` removes it. */
  readonly page?: boolean | PageToolsOptions;
  readonly timing?: AssistantControllerOptions<GeminiLiveCredentials>['timing'];
  /** Called with the controller once, for an app that wants to start or stop a session from elsewhere. */
  readonly onReady?: (controller: AssistantController<GeminiLiveCredentials>) => void;
  /** Called whenever a session fails. The widget already tells the user; this is for logging. */
  readonly onFailure?: (failure: AssistantFailure) => void;
}

/** The endpoint form: the usual one. */
interface LiveAssistantEndpointProps extends LiveAssistantCommonProps {
  /** Your server's route that mints a short-lived token. The one value this component cannot invent. */
  readonly tokenEndpoint: string;
  readonly getConnection?: never;
}

/** The escape hatch: an app that already has its own client for the same thing. */
interface LiveAssistantConnectionProps extends LiveAssistantCommonProps {
  readonly getConnection: (request: { readonly resumptionHandle?: string }) => Promise<GeminiLiveCredentials>;
  readonly tokenEndpoint?: never;
}

export type LiveAssistantProps = LiveAssistantEndpointProps | LiveAssistantConnectionProps;

const DEFAULT_LANGUAGE = 'en-US';
const JSON_TYPE = 'application/json';

/**
 * The whole integration: import it, put it in your tree, and there is a voice
 * assistant on the screen.
 *
 * ```tsx
 * <LiveAssistant tokenEndpoint="https://api.example.com/assistant/token" />
 * ```
 *
 * @remarks
 * - **One required value, because it is the only one we cannot know**: the
 *   route on your server that mints a short-lived token. Everything else — the
 *   Gemini session, the microphone, the player, the tool registry, the
 *   controller, the provider and the widget — is built here, the same way in
 *   every app, which is what makes it ours to write rather than yours.
 * - **The controller is built once**, in a `useState` initialiser. It owns a
 *   socket and two devices; rebuilding it on a render would start a session per
 *   render. The session is stopped when this unmounts.
 * - **`headers` and `language` are read at connection time, not at mount.** An
 *   app whose `Authorization` header is refreshed mid-session would otherwise
 *   reconnect with the token it had when the component first rendered — which
 *   is exactly when a long conversation hands over to a new socket.
 * - **A non-2xx from your endpoint is thrown on purpose.** It reaches the app
 *   as `connection_refused` with the response in `failure.cause`, rather than
 *   as a session that fails later for no stated reason.
 * - **It does not own your navigation or your screens.** The page pack reads
 *   the live DOM, so on the web it already works; a native app passes its own
 *   tools, or `page: { router }`.
 * - **Outgrowing it costs nothing**: build `AssistantController` yourself and
 *   render `AssistantProvider` + `AssistantWidget`, which is all this does.
 */
export function LiveAssistant({
  tokenEndpoint,
  getConnection,
  language = DEFAULT_LANGUAGE,
  headers,
  tools,
  page,
  timing,
  onReady,
  onFailure,
  ...widget
}: LiveAssistantProps) {
  // Read at connection time rather than captured at mount: see the doc block.
  const latest = useRef({ tokenEndpoint, getConnection, language, headers });
  latest.current = { tokenEndpoint, getConnection, language, headers };

  const [controller] = useState(
    () =>
      new AssistantController<GeminiLiveCredentials>({
        session: new GeminiLiveSession(),
        microphone: new Microphone(),
        player: new PcmPlayer(),
        tools: tools instanceof ToolRegistry ? tools : new ToolRegistry(tools ?? []),
        ...(page === undefined ? {} : { page }),
        ...(timing === undefined ? {} : { timing }),
        getConnection: async ({ resumptionHandle }) => {
          const current = latest.current;
          if (current.getConnection !== undefined) return current.getConnection({ resumptionHandle });
          const response = await fetch(current.tokenEndpoint as string, {
            method: 'POST',
            headers: { 'content-type': JSON_TYPE, ...current.headers },
            body: JSON.stringify({ resumptionHandle, languageCode: current.language }),
          });
          if (!response.ok) throw new Error(`the token endpoint answered ${response.status}`);
          return (await response.json()) as GeminiLiveCredentials;
        },
      }),
  );

  useEffect(() => {
    onReady?.(controller);
    return () => void controller.stop();
  }, [controller, onReady]);

  return (
    <AssistantProvider controller={controller}>
      <FailureReporter onFailure={onFailure} />
      <AssistantWidget {...widget} />
    </AssistantProvider>
  );
}

const selectError = (state: { readonly error: AssistantFailure | null }): AssistantFailure | null => state.error;

/** Reports failures to the app without re-rendering the widget for them. */
function FailureReporter({ onFailure }: { readonly onFailure?: (failure: AssistantFailure) => void }) {
  const error = useAssistantState(selectError);
  useEffect(() => {
    if (error !== null) onFailure?.(error);
  }, [error, onFailure]);
  return null;
}
