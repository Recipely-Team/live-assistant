/* eslint-disable import/first -- jest.mock() must be hoisted above imports */

// The same reason as the re-export suite: the audio package reaches for the
// native recorder at module load and there is none in a test process.
jest.mock('react-native-audio-api', () => ({
  AudioManager: {
    requestRecordingPermissions: async () => 'Granted',
    setAudioSessionOptions: () => undefined,
    setAudioSessionActivity: async () => undefined,
  },
  AudioRecorder: class {},
  AudioContext: class {},
}));

// The session is the wire, and this suite is about what reaches it: which
// credentials, from which request. The real Gemini socket is covered where it
// lives.
jest.mock('@live-assistant/gemini', () => {
  const { FakeSession } = jest.requireActual('@live-assistant/core/src/controller/__fixtures__/fake-session');
  return { GeminiLiveSession: FakeSession };
});

jest.mock('@live-assistant/audio', () => {
  const { FakeMicrophone } = jest.requireActual('@live-assistant/core/src/controller/__fixtures__/fake-microphone');
  const { FakePlayer } = jest.requireActual('@live-assistant/core/src/controller/__fixtures__/fake-player');
  return {
    Microphone: class extends FakeMicrophone {
      constructor() {
        super([]);
      }
    },
    PcmPlayer: class extends FakePlayer {
      constructor() {
        super([]);
      }
    },
  };
});

import { act, create } from 'react-test-renderer';
import { AssistantFailureCode } from '@live-assistant/core';
import type { AssistantController, AssistantFailure } from '@live-assistant/core';
import type { GeminiLiveCredentials } from '@live-assistant/gemini';
import { LiveAssistant } from '../live-assistant';

type Held = AssistantController<GeminiLiveCredentials>;

const credentials = { token: 'auth_tokens/abc', model: 'models/gemini-live-2.5-flash-preview' };

const answer = (body: unknown, ok = true, status = 200): Promise<unknown> =>
  Promise.resolve({ ok, status, json: async () => body });

describe('<LiveAssistant>', () => {
  let controller: Held | undefined;
  let rendered: ReturnType<typeof create> | undefined;

  // Fake timers and an unmount after each: the orb animates a live session, so
  // a tree left mounted goes on scheduling frames into the next test's process.
  beforeEach(() => {
    jest.useFakeTimers();
    controller = undefined;
    (globalThis as { fetch?: unknown }).fetch = jest.fn(() => answer(credentials));
  });

  afterEach(() => {
    act(() => rendered?.unmount());
    rendered = undefined;
    jest.useRealTimers();
  });

  // The endpoint and `getConnection` are the two halves of a union, so the
  // spread carries only what both forms share.
  type Extras = Partial<Omit<React.ComponentProps<typeof LiveAssistant>, 'tokenEndpoint' | 'getConnection'>>;

  const render = (props: Extras = {}) => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <LiveAssistant
          tokenEndpoint="https://api.example.com/assistant/token"
          onReady={(ready) => (controller = ready)}
          {...props}
        />,
      );
    });
    rendered = tree;
    return tree;
  };

  // Rebuilt per render it would open a socket and two devices per render.
  it('builds one assistant and keeps it across re-renders', () => {
    const tree = render();
    const first = controller;

    act(() => {
      tree.update(
        <LiveAssistant tokenEndpoint="https://api.example.com/assistant/token" onReady={(ready) => (controller = ready)} theme={{ colors: { primary: '#000' } }} />,
      );
    });

    expect(first).toBeDefined();
    expect(controller).toBe(first);
  });

  it('asks the app’s own endpoint for a token, and hands what comes back to the session', async () => {
    render({ language: 'tr-TR', headers: { authorization: 'Bearer one' } });

    await act(async () => {
      await controller?.start();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith('https://api.example.com/assistant/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer one' },
      body: JSON.stringify({ languageCode: 'tr-TR' }),
    });
  });

  // A long conversation hands over to a new socket mid-session, which is
  // exactly when an app that refreshed its login would otherwise reconnect
  // with the header it had at mount.
  it('reads the headers again on every connection, not once at mount', async () => {
    const tree = render({ headers: { authorization: 'Bearer one' } });
    const held = controller;

    act(() => {
      tree.update(
        <LiveAssistant
          tokenEndpoint="https://api.example.com/assistant/token"
          onReady={(ready) => (controller = ready)}
          headers={{ authorization: 'Bearer two' }}
        />,
      );
    });
    await act(async () => {
      await held?.start();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { 'content-type': 'application/json', authorization: 'Bearer two' } }),
    );
  });

  it('reports a refusing endpoint as a refused connection, with the reason attached', async () => {
    (globalThis as { fetch?: unknown }).fetch = jest.fn(() => answer({}, false, 401));
    const failures: AssistantFailure[] = [];
    render({ onFailure: (failure) => failures.push(failure) });

    await act(async () => {
      await controller?.start();
    });

    expect(controller?.getState().error?.code).toBe(AssistantFailureCode.ConnectionRefused);
    expect(String((controller?.getState().error?.cause as Error).message)).toContain('401');
    expect(failures.map((failure) => failure.code)).toContain(AssistantFailureCode.ConnectionRefused);
  });

  // The symptom: the assistant hung up mid-sentence whenever anything above it
  // re-rendered. `onReady` was an effect dependency, and an inline arrow — the
  // ordinary way to pass it — is a new function on every render, so the effect
  // re-ran and its cleanup stopped the live session.
  it('keeps talking when the tree around it re-renders with a new onReady', async () => {
    const tree = render();
    await act(async () => {
      await controller?.start();
    });
    expect(controller?.getState().status).not.toBe('idle');

    act(() => {
      tree.update(
        <LiveAssistant
          tokenEndpoint="https://api.example.com/assistant/token"
          onReady={(ready) => (controller = ready)}
          onFailure={() => undefined}
        />,
      );
    });

    expect(controller?.getState().status).not.toBe('idle');
  });

  it('hands the controller over once, not again on every render', () => {
    const seen: unknown[] = [];
    const tree = render({ onFailure: () => undefined });
    act(() => {
      tree.update(
        <LiveAssistant tokenEndpoint="https://api.example.com/assistant/token" onReady={(ready) => seen.push(ready)} />,
      );
    });

    expect(seen).toHaveLength(0);
  });

  it('stops the session when it leaves the tree', async () => {
    const tree = render();
    await act(async () => {
      await controller?.start();
    });

    act(() => tree.unmount());
    rendered = undefined;

    expect(controller?.getState().status).toBe('idle');
  });
});
