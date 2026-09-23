import { screen, waitFor } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountChatView } from '../src/views/chat.js';
import { getCharacter } from '../src/data/characters.js';
import { chatStream, jsonResponse } from './helpers.js';

const ironMan = getCharacter('iron-man');
const encoder = new TextEncoder();

let view = null;

function mount(params) {
  view = mountChatView(params);
  document.body.append(view.element);
  return view;
}

function deferredFetch() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  const fetchMock = vi.fn(() => promise);
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, resolve };
}

function controllableStream() {
  let controller;
  const body = new ReadableStream({
    start(streamController) {
      controller = streamController;
    },
  });
  const send = (event) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));

  return {
    response: new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    delta: (text) => send({ delta: text }),
    finish: () => {
      send({ done: true });
      controller.close();
    },
  };
}

describe('mountChatView', () => {
  afterEach(() => {
    view?.destroy();
    view?.element.remove();
    view = null;
  });

  it('shows the greeting, the composer and disables the send button when empty', () => {
    mount({ characterId: 'iron-man' });

    expect(screen.getByText(ironMan.greeting)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /mensaje para iron man/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar/i })).toBeDisabled();
  });

  it('sends with Enter, differentiates user and assistant bubbles and shows the typing indicator', async () => {
    const user = userEvent.setup();
    const { fetchMock, resolve } = deferredFetch();
    mount({ characterId: 'iron-man' });

    await user.type(screen.getByRole('textbox'), 'Hola Tony{Enter}');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent(/iron man está escribiendo/i);
    expect(screen.getByRole('textbox')).toHaveValue('');

    const bubbles = screen.getAllByTestId('message');
    expect(bubbles[0]).toHaveClass('message--assistant');
    expect(bubbles[1]).toHaveClass('message--user');
    expect(bubbles[1]).toHaveTextContent('Hola Tony');

    resolve(chatStream('Hola, chico. Tony Stark.'));

    await waitFor(() => expect(screen.getAllByTestId('message')).toHaveLength(3));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Hola, chico. Tony Stark.')).toBeInTheDocument();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('sends with the button and shows timestamps on every message', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(chatStream('Respuesta')));
    mount({ characterId: 'iron-man' });

    await user.type(screen.getByRole('textbox'), 'Hola');
    await user.click(screen.getByRole('button', { name: /enviar/i }));

    await screen.findByText('Respuesta');
    const times = screen.getAllByTestId('message').map((bubble) => bubble.querySelector('time'));
    expect(times.every((time) => time && time.textContent.match(/\d{2}:\d{2}/))).toBe(true);
  });

  it('shows an error banner when the API fails and lets the user retry', async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'El personaje está saturado.' }, 429))
      .mockResolvedValueOnce(chatStream('Ya estoy aquí.'));
    vi.stubGlobal('fetch', fetchMock);
    mount({ characterId: 'iron-man' });

    await user.type(screen.getByRole('textbox'), 'Hola{Enter}');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El personaje está saturado.');

    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    await screen.findByText('Ya estoy aquí.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends a suggested prompt when clicked', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(chatStream('ok'));
    vi.stubGlobal('fetch', fetchMock);
    mount({ characterId: 'iron-man' });

    await user.click(screen.getByRole('button', { name: ironMan.samplePrompts[0] }));

    await screen.findByText('ok');
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.messages.at(-1).content).toBe(ironMan.samplePrompts[0]);
  });

  it('shows the saved badge and clears the history on demand', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(chatStream('ok')));
    mount({ characterId: 'iron-man' });

    expect(screen.getByRole('button', { name: /borrar historial/i })).toBeDisabled();

    await user.type(screen.getByRole('textbox'), 'Hola{Enter}');
    await screen.findByText('ok');

    expect(screen.getByText(/guardado/i)).toBeInTheDocument();
    expect(localStorage.getItem('comicsanscon:chat:iron-man')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: /borrar historial/i }));

    expect(screen.getAllByTestId('message')).toHaveLength(1);
    expect(localStorage.getItem('comicsanscon:chat:iron-man')).toBeNull();
  });

  it('copies assistant replies to the clipboard', async () => {
    const user = userEvent.setup();
    mount({ characterId: 'iron-man' });

    await user.click(screen.getByRole('button', { name: /copiar respuesta/i }));

    expect(await navigator.clipboard.readText()).toBe(ironMan.greeting);
    expect(screen.getByRole('button', { name: /copiado/i })).toBeInTheDocument();
  });

  it('falls back to the last visited character on /chat', () => {
    localStorage.setItem('comicsanscon:last-character', 'captain-america');
    mount();

    expect(screen.getByRole('heading', { level: 1, name: /capitán américa/i })).toBeInTheDocument();
  });

  it('renders model output as plain text, never as HTML', async () => {
    const user = userEvent.setup();
    const payload = '<img src=x onerror=alert(1)>';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(chatStream(payload)));
    mount({ characterId: 'iron-man' });

    await user.type(screen.getByRole('textbox'), 'Hola{Enter}');

    expect(await screen.findByText(payload)).toHaveClass('message__content');
    expect(document.querySelectorAll('.message__content img')).toHaveLength(0);
  });

  it('keeps the same streaming bubble while the reply arrives', async () => {
    const user = userEvent.setup();
    const stream = controllableStream();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(stream.response));
    mount({ characterId: 'iron-man' });

    await user.type(screen.getByRole('textbox'), 'Hey{Enter}');

    stream.delta('Hola');
    const content = await screen.findByText('Hola', { selector: '.message__content' });
    const bubble = content.closest('li');
    expect(bubble).toHaveAttribute('aria-live', 'polite');
    expect(bubble.parentElement.lastElementChild).toBe(bubble);

    stream.delta(', chico');
    await waitFor(() => expect(bubble).toHaveTextContent('Hola, chico'));
    stream.delta('. Tony Stark.');
    await waitFor(() => expect(bubble).toHaveTextContent('Hola, chico. Tony Stark.'));

    const current = document.querySelector('.message__caret').closest('li');
    expect(current).toBe(bubble);
    expect(bubble.isConnected).toBe(true);

    stream.finish();

    await waitFor(() => expect(document.querySelector('.message__caret')).toBeNull());
    expect(bubble.isConnected).toBe(false);
    expect(screen.getAllByTestId('message')).toHaveLength(3);
    expect(screen.getAllByTestId('message').at(-1)).toHaveTextContent('Hola, chico. Tony Stark.');
  });

  it('aborts the request in flight when destroyed', async () => {
    const user = userEvent.setup();
    const { fetchMock } = deferredFetch();
    mount({ characterId: 'iron-man' });

    await user.type(screen.getByRole('textbox'), 'Hola{Enter}');

    const { signal } = fetchMock.mock.calls[0][1];
    expect(signal.aborted).toBe(false);

    view.destroy();

    expect(signal.aborted).toBe(true);
  });
});
