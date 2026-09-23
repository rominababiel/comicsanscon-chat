import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MODELS,
  GeminiError,
  buildGeminiRequest,
  extractDelta,
  parseModelList,
  streamReply,
  toGeminiContents,
} from '../api/_lib/gemini.js';
import { collect, geminiStream } from './helpers.js';

const history = [
  { role: 'assistant', content: 'Hola. Tony Stark.' },
  { role: 'user', content: '¿Quién eres?' },
  { role: 'assistant', content: 'Iron Man, obviamente.' },
  { role: 'user', content: '¿Y qué haces aquí?' },
];

function withFakeTimers(run) {
  return async () => {
    vi.useFakeTimers();
    try {
      await run();
    } finally {
      vi.useRealTimers();
    }
  };
}

describe('parseModelList', () => {
  it('falls back to the default models when the value is empty', () => {
    expect(parseModelList(undefined)).toEqual(DEFAULT_MODELS);
    expect(parseModelList('  ')).toEqual(DEFAULT_MODELS);
  });

  it('splits a comma separated list and trims each model', () => {
    expect(parseModelList(' gemini-3.1-flash-lite , gemini-3-flash-preview ')).toEqual([
      'gemini-3.1-flash-lite',
      'gemini-3-flash-preview',
    ]);
  });
});

describe('toGeminiContents', () => {
  it('maps roles to Gemini roles and drops the leading assistant greeting', () => {
    expect(toGeminiContents(history)).toEqual([
      { role: 'user', parts: [{ text: '¿Quién eres?' }] },
      { role: 'model', parts: [{ text: 'Iron Man, obviamente.' }] },
      { role: 'user', parts: [{ text: '¿Y qué haces aquí?' }] },
    ]);
  });

  it('merges consecutive messages with the same role', () => {
    const contents = toGeminiContents([
      { role: 'user', content: 'Hola' },
      { role: 'user', content: '¿Estás ahí?' },
    ]);

    expect(contents).toEqual([{ role: 'user', parts: [{ text: 'Hola' }, { text: '¿Estás ahí?' }] }]);
  });

  it('returns an empty list when there is no user message', () => {
    expect(toGeminiContents([{ role: 'assistant', content: 'Hola' }])).toEqual([]);
  });
});

describe('buildGeminiRequest', () => {
  it('includes the system prompt, the full history and generation config', () => {
    const request = buildGeminiRequest({ systemPrompt: 'Eres Tony Stark.', messages: history });

    expect(request.systemInstruction).toEqual({ parts: [{ text: 'Eres Tony Stark.' }] });
    expect(request.contents).toHaveLength(3);
    expect(request.generationConfig.temperature).toBeGreaterThan(0);
    expect(request.generationConfig.maxOutputTokens).toBeGreaterThan(0);
  });
});

describe('extractDelta', () => {
  it('joins the text parts of the first candidate', () => {
    const payload = { candidates: [{ content: { parts: [{ text: 'Yo soy ' }, { text: 'Iron Man.' }] } }] };

    expect(extractDelta(payload)).toBe('Yo soy Iron Man.');
  });

  it('returns an empty string for chunks without text', () => {
    expect(extractDelta({ candidates: [{ finishReason: 'STOP' }] })).toBe('');
    expect(extractDelta(null)).toBe('');
  });

  it('throws when the prompt was blocked', () => {
    expect(() => extractDelta({ promptFeedback: { blockReason: 'SAFETY' } })).toThrow(GeminiError);
  });

  it('throws a specific error when the candidate finished for safety reasons', () => {
    const error = (() => {
      try {
        extractDelta({ candidates: [{ finishReason: 'SAFETY' }] });
      } catch (e) {
        return e;
      }
    })();

    expect(error).toBeInstanceOf(GeminiError);
    expect(error.status).toBe(422);
    expect(error.code).toBe('blocked');
  });
});

describe('streamReply', () => {
  const args = { apiKey: 'secret', systemPrompt: 'Eres Thor.', messages: history };

  it('streams the reply in chunks from the first model, with the API key in a header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiStream(['¡Salve, ', 'mortal!']));
    vi.stubGlobal('fetch', fetchMock);

    const chunks = [];
    for await (const delta of streamReply(args)) chunks.push(delta);

    expect(chunks).toEqual(['¡Salve, ', 'mortal!']);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain(`${DEFAULT_MODELS[0]}:streamGenerateContent`);
    expect(url).not.toContain('secret');
    expect(options.headers['x-goog-api-key']).toBe('secret');
    expect(JSON.parse(options.body).contents).toHaveLength(3);
  });

  it('honours a custom model list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiStream('ok')));

    await collect(streamReply({ ...args, models: ['gemini-3.5-pro'] }));

    expect(fetch.mock.calls[0][0]).toContain('gemini-3.5-pro:streamGenerateContent');
  });

  it.each([
    [403, 502, 'auth', /API key/],
    [500, 503, 'unavailable', /no está disponible/],
  ])('maps HTTP %i to status %i without retrying the same model', async (geminiStatus, expectedStatus, code, pattern) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: geminiStatus }));
    vi.stubGlobal('fetch', fetchMock);

    const error = await collect(streamReply({ ...args, models: ['only-model'] })).catch((e) => e);

    expect(error).toBeInstanceOf(GeminiError);
    expect(error.status).toBe(expectedStatus);
    expect(error.code).toBe(code);
    expect(error.message).toMatch(pattern);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not fall back to another model on authentication errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(collect(streamReply({ ...args, models: ['a', 'b'] }))).rejects.toMatchObject({ code: 'auth' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the next model when the first one is not found', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(geminiStream('Desde el segundo modelo.'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(collect(streamReply({ ...args, models: ['old-model', 'new-model'] }))).resolves.toBe(
      'Desde el segundo modelo.'
    );
    expect(fetchMock.mock.calls[0][0]).toContain('old-model');
    expect(fetchMock.mock.calls[1][0]).toContain('new-model');
  });

  it('falls back to the next model when the first one answers without any text', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(geminiStream([]))
      .mockResolvedValueOnce(geminiStream('Respuesta real.'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(collect(streamReply({ ...args, models: ['empty', 'backup'] }))).resolves.toBe('Respuesta real.');
  });

  it(
    'launches the next model in parallel when the first one is too slow and keeps the fastest',
    withFakeTimers(async () => {
      const hanging = new Response(new ReadableStream({ start() {} }), { status: 200 });
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(hanging)
        .mockResolvedValueOnce(geminiStream('Desde el modelo rápido.'));
      vi.stubGlobal('fetch', fetchMock);

      const pending = collect(streamReply({ ...args, models: ['slow', 'fast'] }));
      await vi.runAllTimersAsync();

      await expect(pending).resolves.toBe('Desde el modelo rápido.');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    })
  );

  it(
    'retries a transient 503 on the same model before giving up',
    withFakeTimers(async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response('{}', { status: 503 }))
        .mockResolvedValueOnce(geminiStream('Recuperado.'));
      vi.stubGlobal('fetch', fetchMock);

      const pending = collect(streamReply({ ...args, models: ['only-model'] }));
      await vi.runAllTimersAsync();

      await expect(pending).resolves.toBe('Recuperado.');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    })
  );

  it(
    'falls back to the next model when the first one stays rate-limited',
    withFakeTimers(async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(new Response('{}', { status: 429 }))
        .mockResolvedValueOnce(new Response('{}', { status: 429 }))
        .mockResolvedValueOnce(geminiStream('Modelo de respaldo.'));
      vi.stubGlobal('fetch', fetchMock);

      const pending = collect(streamReply({ ...args, models: ['busy', 'backup'] }));
      await vi.runAllTimersAsync();

      await expect(pending).resolves.toBe('Modelo de respaldo.');
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[2][0]).toContain('backup');
    })
  );

  it(
    'reports 429 when every model is rate-limited',
    withFakeTimers(async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }));
      vi.stubGlobal('fetch', fetchMock);

      const pending = collect(streamReply({ ...args, models: ['a', 'b'] })).catch((e) => e);
      await vi.runAllTimersAsync();
      const error = await pending;

      expect(error.status).toBe(429);
      expect(error.code).toBe('rate_limit');
      expect(fetchMock).toHaveBeenCalledTimes(4);
    })
  );

  it('maps network failures to a 503', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    const error = await collect(streamReply({ ...args, models: ['only-model'] })).catch((e) => e);

    expect(error.status).toBe(503);
    expect(error.code).toBe('unavailable');
  });
});
