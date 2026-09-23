import { screen, waitFor, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startApp } from '../src/app.js';
import { chatStream } from './helpers.js';

let destroyApp = null;

function renderAt(path) {
  destroyApp?.();
  window.history.replaceState({}, '', path);
  const root = document.createElement('div');
  document.body.append(root);
  destroyApp = startApp(root);
  return root;
}

afterEach(() => {
  destroyApp?.();
  destroyApp = null;
});

async function goBack() {
  window.history.back();
  await waitFor(() => expect(window.location.pathname).toBe('/home'));
}

describe('App routing', () => {
  it.each([
    ['/', /chatea con tu personaje favorito/i],
    ['/home', /chatea con tu personaje favorito/i],
    ['/about', /una prueba de concepto de comicsanscon/i],
    ['/chat', /iron man/i],
  ])('renders the view for %s on initial load', (path, heading) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('renders the requested character for /chat/:characterId', () => {
    renderAt('/chat/thor');
    expect(screen.getByRole('heading', { level: 1, name: /thor/i })).toBeInTheDocument();
  });

  it('shows a not-found view for unknown routes and characters', () => {
    renderAt('/nope');
    expect(screen.getByRole('heading', { level: 1, name: /te perdiste/i })).toBeInTheDocument();

    renderAt('/chat/hulk');
    expect(screen.getByText(/no encontramos ningún personaje/i)).toBeInTheDocument();
  });

  it('shows the not-found view for URLs with malformed encoding instead of crashing', () => {
    renderAt('/chat/%E0');

    expect(screen.getByRole('heading', { level: 1, name: /te perdiste/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /navegación principal/i })).toBeInTheDocument();
    expect(document.title).toBe('ComicSansCon · Página no encontrada');
  });

  it('navigates between views with pushState without reloading', async () => {
    const user = userEvent.setup();
    const pushState = vi.spyOn(window.history, 'pushState');
    renderAt('/home');

    const nav = screen.getByRole('navigation', { name: /navegación principal/i });
    await user.click(within(nav).getByRole('link', { name: 'About' }));

    expect(window.location.pathname).toBe('/about');
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 1, name: /prueba de concepto/i })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'About' })).toHaveAttribute('aria-current', 'page');
  });

  it('supports the browser back button through popstate', async () => {
    const user = userEvent.setup();
    renderAt('/home');
    const nav = screen.getByRole('navigation', { name: /navegación principal/i });

    await user.click(within(nav).getByRole('link', { name: 'About' }));
    expect(screen.getByRole('heading', { level: 1, name: /prueba de concepto/i })).toBeInTheDocument();

    await goBack();

    expect(window.location.pathname).toBe('/home');
    expect(screen.getByRole('heading', { level: 1, name: /chatea con tu personaje/i })).toBeInTheDocument();
  });

  it('opens the chat for the character chosen in the gallery', async () => {
    const user = userEvent.setup();
    renderAt('/home');

    await user.click(screen.getByRole('link', { name: /chatear con capitán américa/i }));

    expect(window.location.pathname).toBe('/chat/captain-america');
    expect(screen.getByRole('heading', { level: 1, name: /capitán américa/i })).toBeInTheDocument();
  });

  it('aborts the in-flight request when leaving the chat', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(() => new Promise(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/chat/thor');

    await user.type(screen.getByRole('textbox'), 'Hola{Enter}');
    const nav = screen.getByRole('navigation', { name: /navegación principal/i });
    await user.click(within(nav).getByRole('link', { name: 'About' }));

    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('keeps the same chat session when /chat resolves to the current character', async () => {
    const user = userEvent.setup();
    let resolveFetch;
    const fetchMock = vi.fn(() => new Promise((resolve) => (resolveFetch = resolve)));
    vi.stubGlobal('fetch', fetchMock);
    renderAt('/chat/iron-man');
    const panel = document.querySelector('.chat-panel');

    await user.type(screen.getByRole('textbox'), 'Hola{Enter}');
    const nav = screen.getByRole('navigation', { name: /navegación principal/i });
    await user.click(within(nav).getByRole('link', { name: 'Chat' }));

    expect(window.location.pathname).toBe('/chat');
    expect(document.querySelector('.chat-panel')).toBe(panel);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);

    resolveFetch(chatStream('Sigo aquí.'));
    expect(await screen.findByText('Sigo aquí.')).toBeInTheDocument();
  });
});

describe('document title', () => {
  it('reflects the current view and updates when navigating', async () => {
    renderAt('/about');
    expect(document.title).toBe('ComicSansCon · Sobre el proyecto');

    await userEvent.click(screen.getByRole('link', { name: 'Home' }));
    expect(document.title).toBe('ComicSansCon · Chatea con tu personaje favorito');
  });
});
