import { describe, expect, it, vi } from 'vitest';
import { CHAT_STATUS, createChatController } from '../src/chat.js';
import { loadConversation, saveConversation } from '../src/features/chat/chatStorage.js';
import { ROLES, createMessage } from '../src/utils.js';
import { characters, getCharacter } from '../src/data/characters.js';
import { chatStream, jsonResponse } from './helpers.js';

const thor = getCharacter('thor');

describe('createChatController', () => {
  it('starts with the character greeting when there is no saved history', () => {
    const chat = createChatController(thor);
    const state = chat.getState();

    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({ role: ROLES.ASSISTANT, content: thor.greeting });
    expect(state.status).toBe(CHAT_STATUS.IDLE);
    expect(state.hasHistory).toBe(false);
  });

  it('restores a saved conversation from localStorage', () => {
    const saved = [createMessage(ROLES.ASSISTANT, 'Hola'), createMessage(ROLES.USER, '¿Qué tal?')];
    saveConversation(thor.id, saved);

    const chat = createChatController(thor);

    expect(chat.getState().messages).toEqual(saved);
    expect(chat.getState().hasHistory).toBe(true);
  });

  it('sends the full history, shows loading and appends the reply', async () => {
    let resolveFetch;
    const fetchMock = vi.fn(() => new Promise((resolve) => (resolveFetch = resolve)));
    vi.stubGlobal('fetch', fetchMock);

    const chat = createChatController(thor);

    chat.sendMessage('  ¿Qué es la lógica?  ');

    expect(chat.getState().isLoading).toBe(true);
    expect(chat.getState().messages.at(-1)).toMatchObject({ role: ROLES.USER, content: '¿Qué es la lógica?' });

    const sentPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentPayload.characterId).toBe('thor');
    expect(sentPayload.messages).toEqual([
      { role: 'assistant', content: thor.greeting },
      { role: 'user', content: '¿Qué es la lógica?' },
    ]);

    resolveFetch(chatStream('La lógica es el principio de la sabiduría.'));

    await vi.waitFor(() => expect(chat.getState().isLoading).toBe(false));
    expect(chat.getState().messages.at(-1)).toMatchObject({
      role: ROLES.ASSISTANT,
      content: 'La lógica es el principio de la sabiduría.',
    });
    expect(loadConversation(thor.id)).toHaveLength(3);
  });

  it('ignores empty messages and does not call the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const chat = createChatController(thor);

    await chat.sendMessage('   ');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(chat.getState().messages).toHaveLength(1);
  });

  it('exposes the error, keeps the user message and allows retrying', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'El servicio de IA no está disponible.' }, 503))
      .mockResolvedValueOnce(chatStream('Ahora sí.'));
    vi.stubGlobal('fetch', fetchMock);

    const chat = createChatController(thor);

    await chat.sendMessage('Hola');

    expect(chat.getState().status).toBe(CHAT_STATUS.ERROR);
    expect(chat.getState().error).toBe('El servicio de IA no está disponible.');
    expect(chat.getState().messages.at(-1)).toMatchObject({ role: ROLES.USER, content: 'Hola' });

    await chat.retry();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(chat.getState().error).toBeNull();
    expect(chat.getState().messages.at(-1)).toMatchObject({ role: ROLES.ASSISTANT, content: 'Ahora sí.' });
  });

  it('clears the history, storage and resets to the greeting', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(chatStream('ok')));
    const chat = createChatController(thor);

    await chat.sendMessage('Hola');
    expect(loadConversation(thor.id)).not.toBeNull();

    chat.clearHistory();

    expect(chat.getState().messages).toHaveLength(1);
    expect(chat.getState().messages[0].content).toBe(thor.greeting);
    expect(chat.getState().hasHistory).toBe(false);
    expect(loadConversation(thor.id)).toBeNull();
  });

  it('keeps conversations isolated per character', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(chatStream('ok')));
    const chat = createChatController(thor);

    await chat.sendMessage('Hola');

    expect(loadConversation(characters[0].id)).toBeNull();
    expect(loadConversation(thor.id)).toHaveLength(3);
  });

  it('destroy aborts the in-flight request and stops notifying', async () => {
    let resolveFetch;
    const fetchMock = vi.fn(() => new Promise((resolve) => (resolveFetch = resolve)));
    vi.stubGlobal('fetch', fetchMock);

    const chat = createChatController(thor);
    const listener = vi.fn();
    chat.subscribe(listener);

    const pending = chat.sendMessage('Hola');
    const { signal } = fetchMock.mock.calls[0][1];
    listener.mockClear();

    chat.destroy();
    expect(signal.aborted).toBe(true);

    resolveFetch(chatStream('Demasiado tarde.'));
    await pending;

    expect(listener).not.toHaveBeenCalled();
    expect(chat.getState().messages.at(-1)).toMatchObject({ role: ROLES.USER, content: 'Hola' });
  });

  it('does not let an aborted request clear the text of the reply that replaced it', async () => {
    let rejectFirst;
    let resolveSecond;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Falló.' }, 503))
      .mockImplementationOnce(() => new Promise((_, reject) => (rejectFirst = reject)))
      .mockImplementationOnce(() => new Promise((resolve) => (resolveSecond = resolve)));
    vi.stubGlobal('fetch', fetchMock);

    const chat = createChatController(thor);
    await chat.sendMessage('Hola');
    expect(chat.getState().status).toBe(CHAT_STATUS.ERROR);

    const first = chat.retry();
    const second = chat.retry();

    const encoder = new TextEncoder();
    let streamController;
    const body = new ReadableStream({ start: (controller) => (streamController = controller) });
    resolveSecond(new Response(body, { status: 200 }));
    const send = (event) => streamController.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    send({ delta: '¡Salve' });
    await vi.waitFor(() => expect(chat.getState().streamingText).toBe('¡Salve'));

    rejectFirst(new DOMException('Aborted', 'AbortError'));
    await first;

    expect(chat.getState().streamingText).toBe('¡Salve');
    expect(chat.getState().isLoading).toBe(true);

    send({ done: true });
    streamController.close();
    await second;

    expect(chat.getState().messages.at(-1)).toMatchObject({ role: ROLES.ASSISTANT, content: '¡Salve' });
    expect(chat.getState().streamingText).toBe('');
  });
});
