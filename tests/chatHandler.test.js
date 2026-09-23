import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../api/functions.js';
import { geminiStream } from './helpers.js';

function createResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: undefined,
    chunks: [],
    ended: false,
    status: vi.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    setHeader: vi.fn((name, value) => {
      res.headers[name] = value;
      return res;
    }),
    json: vi.fn((payload) => {
      res.body = payload;
      return res;
    }),
    writeHead: vi.fn((code, headers) => {
      res.statusCode = code;
      Object.assign(res.headers, headers);
      return res;
    }),
    write: vi.fn((chunk) => {
      res.chunks.push(chunk);
      return true;
    }),
    end: vi.fn(() => {
      res.ended = true;
      return res;
    }),
  };
  return res;
}

const events = (res) =>
  res.chunks
    .join('')
    .split('\n\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line.replace(/^data: /, '')));

const validRequest = {
  method: 'POST',
  body: { characterId: 'iron-man', messages: [{ role: 'user', content: '¿Quién eres?' }] },
};

describe('POST /api/functions', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubEnv('GEMINI_MODEL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects non-POST methods', async () => {
    const res = createResponse();

    await handler({ method: 'GET' }, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('POST');
  });

  it('fails clearly when the API key is not configured', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const res = createResponse();

    await handler(validRequest, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toMatch(/API key/);
  });

  it('returns 400 for invalid payloads', async () => {
    const res = createResponse();

    await handler({ method: 'POST', body: { characterId: 'nobody', messages: [] } }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Personaje desconocido/);
  });

  it('returns 413 when the history exceeds the limit, without calling Gemini', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = createResponse();
    const messages = Array.from({ length: 201 }, () => ({ role: 'user', content: 'hola' }));

    await handler({ method: 'POST', body: { characterId: 'thor', messages } }, res);

    expect(res.statusCode).toBe(413);
    expect(res.body.error).toMatch(/demasiado larga/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxies the request with the server-side system prompt and streams the reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue(geminiStream(['Yo soy ', 'Iron Man.']));
    vi.stubGlobal('fetch', fetchMock);
    const res = createResponse();

    await handler(validRequest, res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toMatch(/text\/event-stream/);
    expect(events(res)).toEqual([{ delta: 'Yo soy ' }, { delta: 'Iron Man.' }, { done: true }]);
    expect(res.ended).toBe(true);

    const [, options] = fetchMock.mock.calls[0];
    const sent = JSON.parse(options.body);
    expect(options.headers['x-goog-api-key']).toBe('test-key');
    expect(sent.systemInstruction.parts[0].text).toContain('Tony Stark');
    expect(sent.contents).toEqual([{ role: 'user', parts: [{ text: '¿Quién eres?' }] }]);
  });

  it('propagates Gemini rate limiting as 429 before the stream starts', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    const res = createResponse();

    const pending = handler(validRequest, res);
    await vi.runAllTimersAsync();
    await pending;

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toMatch(/demasiados mensajes/i);
    expect(res.chunks).toHaveLength(0);
    vi.useRealTimers();
  });

  it('reports a failure that happens once the stream already started as an SSE error event', async () => {
    const body = [
      `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Empiezo…' }] } }] })}\n\n`,
      `data: ${JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } })}\n\n`,
    ].join('');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));
    const res = createResponse();

    await handler(validRequest, res);

    expect(res.statusCode).toBe(200);
    expect(events(res)).toEqual([{ delta: 'Empiezo…' }, { error: expect.stringMatching(/bloqueado/i) }]);
    expect(res.ended).toBe(true);
  });

  it('never leaks the API key in error responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));
    const res = createResponse();

    await handler(validRequest, res);

    expect(res.statusCode).toBe(502);
    expect(JSON.stringify(res.body)).not.toContain('test-key');
  });
});
