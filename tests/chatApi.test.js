import { describe, expect, it, vi } from 'vitest';
import { CHAT_ENDPOINT, ChatApiError, requestReply } from '../src/features/chat/chatApi.js';
import { chatStream, jsonResponse } from './helpers.js';

const payload = { characterId: 'thor', messages: [{ role: 'user', content: 'Hola' }] };

describe('requestReply', () => {
  it('posts the payload as JSON to /api/functions and returns the full reply', async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatStream(['¡Salve, ', 'mortal!']));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestReply(payload)).resolves.toBe('¡Salve, mortal!');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(CHAT_ENDPOINT);
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(options.body)).toEqual(payload);
  });

  it('reports the reply progressively as the chunks arrive', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(chatStream(['Yo ', 'soy ', 'Thor.'])));

    const snapshots = [];
    await requestReply(payload, { onDelta: (text) => snapshots.push(text) });

    expect(snapshots).toEqual(['Yo ', 'Yo soy ', 'Yo soy Thor.']);
  });

  it('throws the server error message when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Personaje desconocido.' }, 400)));

    const error = await requestReply(payload).catch((e) => e);

    expect(error).toBeInstanceOf(ChatApiError);
    expect(error.message).toBe('Personaje desconocido.');
    expect(error.status).toBe(400);
  });

  it('surfaces an error event sent in the middle of the stream', async () => {
    const body = [
      `data: ${JSON.stringify({ delta: 'Empiezo…' })}\n\n`,
      `data: ${JSON.stringify({ error: 'Se cortó la conexión con la IA.' })}\n\n`,
    ].join('');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 200 })));

    const error = await requestReply(payload).catch((e) => e);

    expect(error).toBeInstanceOf(ChatApiError);
    expect(error.kind).toBe('stream');
    expect(error.message).toMatch(/Se cortó/);
  });

  it('falls back to a friendly message when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 })));

    await expect(requestReply(payload)).rejects.toThrow(/problema al responder/);
  });

  it('describes rate limiting when the server answers 429 without body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 429 })));

    await expect(requestReply(payload)).rejects.toThrow(/Demasiados mensajes/);
  });

  it('maps network failures to a connection error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const error = await requestReply(payload).catch((e) => e);

    expect(error).toBeInstanceOf(ChatApiError);
    expect(error.kind).toBe('network');
    expect(error.message).toMatch(/conexión/);
  });

  it('rejects a stream that never sends any text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(chatStream([])));

    const error = await requestReply(payload).catch((e) => e);

    expect(error.kind).toBe('parse');
  });

  it('re-throws abort errors untouched so callers can ignore them', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    await expect(requestReply(payload)).rejects.toBe(abortError);
  });
});
