import { GeminiEndpoints } from '../gemini-endpoints';
import { mintGeminiLiveToken } from '../mint-gemini-live-token';
import { TokenFailureCode } from '../token-failure-code';

const NOW = Date.parse('2026-09-11T12:00:00.000Z');

function fakeFetch(respond: () => Promise<Response> | Response) {
  const requests: { url: string; body: Record<string, any> }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    requests.push({ url, body: JSON.parse(String(init.body)) });
    return respond();
  }) as unknown as typeof fetch;
  return { fetchImpl, requests };
}

const base = { apiKey: 'k', model: 'models/live', now: () => NOW };

describe('mintGeminiLiveToken', () => {
  it('returns what a client connects with', async () => {
    const { fetchImpl, requests } = fakeFetch(() => new Response(JSON.stringify({ name: 'auth_tokens/abc' })));

    const minted = await mintGeminiLiveToken({ ...base, fetch: fetchImpl });

    expect(minted).toEqual({
      ok: true,
      value: {
        token: 'auth_tokens/abc',
        model: 'models/live',
        wsUrl: GeminiEndpoints.liveSocket,
        expiresAt: '2026-09-11T12:30:00.000Z',
      },
    });
    expect(requests[0]!.url).toBe(`${GeminiEndpoints.mint}?key=k`);
  });

  // The start window is what makes a leaked token worthless a minute later;
  // the session window has to cover a real conversation.
  it('mints a single-use token with a short start window and a long session', async () => {
    const { fetchImpl, requests } = fakeFetch(() => new Response(JSON.stringify({ name: 'auth_tokens/abc' })));

    await mintGeminiLiveToken({ ...base, fetch: fetchImpl, startWindowMs: 30_000 });

    expect(requests[0]!.body).toMatchObject({
      uses: 1,
      expireTime: '2026-09-11T12:30:00.000Z',
      newSessionExpireTime: '2026-09-11T12:00:30.000Z',
    });
  });

  it('bakes the app’s instruction, tools, voice, language and handle into the setup', async () => {
    const { fetchImpl, requests } = fakeFetch(() => new Response(JSON.stringify({ name: 'auth_tokens/abc' })));
    const parameters = { type: 'object', properties: { minutes: { type: 'number' } }, required: ['minutes'] };

    await mintGeminiLiveToken({
      ...base,
      fetch: fetchImpl,
      systemInstruction: 'You set kitchen timers.',
      tools: [{ name: 'startTimer', description: 'Starts a timer', parameters }],
      voiceName: 'Aoede',
      languageCode: 'tr-TR',
      resumptionHandle: 'h-1',
    });

    expect(requests[0]!.body.bidiGenerateContentSetup).toEqual({
      model: 'models/live',
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { languageCode: 'tr-TR', voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
      },
      systemInstruction: { parts: [{ text: 'You set kitchen timers.' }] },
      tools: [
        {
          functionDeclarations: [
            {
              name: 'startTimer',
              description: 'Starts a timer',
              parameters: { type: 'OBJECT', properties: { minutes: { type: 'NUMBER' } }, required: ['minutes'] },
            },
          ],
        },
      ],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      contextWindowCompression: { slidingWindow: {} },
      sessionResumption: { handle: 'h-1' },
    });
  });

  it('leaves out what the app did not configure, and still enables resumption', async () => {
    const { fetchImpl, requests } = fakeFetch(() => new Response(JSON.stringify({ name: 'auth_tokens/abc' })));

    await mintGeminiLiveToken({ ...base, fetch: fetchImpl });

    const setup = requests[0]!.body.bidiGenerateContentSetup;
    expect(setup).not.toHaveProperty('tools');
    expect(setup).not.toHaveProperty('systemInstruction');
    expect(setup.generationConfig).toEqual({ responseModalities: ['AUDIO'] });
    expect(setup.sessionResumption).toEqual({});
  });

  it('reports Google refusing, with its message for the logs', async () => {
    const { fetchImpl } = fakeFetch(() => new Response('{"error":{"message":"API key not valid"}}', { status: 400 }));

    await expect(mintGeminiLiveToken({ ...base, fetch: fetchImpl })).resolves.toEqual({
      ok: false,
      failure: { code: TokenFailureCode.Rejected, status: 400, detail: '{"error":{"message":"API key not valid"}}' },
    });
  });

  it('reports an unreachable Google instead of throwing', async () => {
    const thrown = new Error('ETIMEDOUT');
    const { fetchImpl } = fakeFetch(() => Promise.reject(thrown));

    await expect(mintGeminiLiveToken({ ...base, fetch: fetchImpl })).resolves.toEqual({
      ok: false,
      failure: { code: TokenFailureCode.Unreachable, cause: thrown, detail: 'ETIMEDOUT' },
    });
  });

  // The message is not the error. A logger's error serializer wants the object —
  // the type and the stack are what separate our own timeout from a DNS failure
  // from a TLS one — and the first integrator had to wrap `fetch` to keep it.
  it('hands back the error the transport threw, not just its message', async () => {
    const thrown = new TypeError('fetch failed');
    const { fetchImpl } = fakeFetch(() => Promise.reject(thrown));

    const minted = await mintGeminiLiveToken({ ...base, fetch: fetchImpl });

    expect(!minted.ok && minted.failure.cause).toBe(thrown);
  });

  // A throw that is not an `Error` has no `message`, so there is no `detail` to
  // report: without the cause the failure would say nothing at all about why.
  it('hands back a thrown value that is not an Error at all', async () => {
    const { fetchImpl } = fakeFetch(() => Promise.reject('socket hang up'));

    const minted = await mintGeminiLiveToken({ ...base, fetch: fetchImpl });

    expect(!minted.ok && minted.failure).toEqual({
      code: TokenFailureCode.Unreachable,
      cause: 'socket hang up',
    });
  });

  it('reports an answer that carries no token', async () => {
    const { fetchImpl } = fakeFetch(() => new Response('{"name":""}'));

    const minted = await mintGeminiLiveToken({ ...base, fetch: fetchImpl });

    expect(!minted.ok && minted.failure.code).toBe(TokenFailureCode.Malformed);
  });
});
