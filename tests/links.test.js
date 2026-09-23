import { afterEach, describe, expect, it, vi } from 'vitest';
import { h } from '../src/lib/dom.js';
import { createLink, interceptLinks, syncActiveLinks } from '../src/router/links.js';

let stopIntercepting = null;

function mountLinks(...links) {
  const root = h('div', {}, ...links);
  document.body.append(root);
  stopIntercepting = interceptLinks(root);
  return root;
}

/**
 * Despacha un clic y devuelve si la app lo interceptó. Después evita la
 * navegación real, que jsdom no implementa.
 */
function click(anchor, init = {}) {
  let intercepted = false;
  const settle = (event) => {
    intercepted = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener('click', settle, { once: true });
  anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
  return intercepted;
}

afterEach(() => {
  stopIntercepting?.();
  stopIntercepting = null;
});

describe('interceptLinks', () => {
  it('navigates with pushState when a SPA link is clicked', () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const link = createLink({ to: '/about' }, 'About');
    mountLinks(link);

    expect(click(link)).toBe(true);
    expect(pushState).toHaveBeenCalledWith({ path: '/about' }, '', '/about');
    expect(window.location.pathname).toBe('/about');
  });

  it('also handles clicks on elements nested inside the link', () => {
    const icon = h('span', {}, 'icono');
    mountLinks(createLink({ to: '/chat' }, 'Chat', icon));

    click(icon);

    expect(window.location.pathname).toBe('/chat');
  });

  it.each([
    ['ctrl', { ctrlKey: true }],
    ['meta', { metaKey: true }],
    ['shift', { shiftKey: true }],
    ['alt', { altKey: true }],
    ['middle button', { button: 1 }],
  ])('lets the browser handle %s clicks', (_, init) => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const link = createLink({ to: '/about' }, 'About');
    mountLinks(link);

    expect(click(link, init)).toBe(false);
    expect(pushState).not.toHaveBeenCalled();
  });

  it('ignores links that open in a new tab and anchors not created with createLink', () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const blank = createLink({ to: '/about', attrs: { target: '_blank' } }, 'Nueva pestaña');
    const plain = h('a', { attrs: { href: '/characters/thor.svg' } }, 'Retrato');
    mountLinks(blank, plain);

    expect([click(blank), click(plain)]).toEqual([false, false]);
    expect(pushState).not.toHaveBeenCalled();
  });

  it('stops intercepting after the returned cleanup runs', () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const link = createLink({ to: '/about' }, 'About');
    mountLinks(link);
    stopIntercepting();
    stopIntercepting = null;

    click(link);

    expect(pushState).not.toHaveBeenCalled();
  });
});

describe('syncActiveLinks', () => {
  const navLink = (to, label) =>
    createLink({ to, className: 'nav__link', activeClassName: 'nav__link--active' }, label);

  it('marks exact and nested matches and toggles the active class', () => {
    const chat = navLink('/chat', 'Chat');
    const home = navLink('/home', 'Home');
    const root = mountLinks(chat, home);

    syncActiveLinks(root, '/chat/thor');

    expect(chat).toHaveAttribute('aria-current', 'page');
    expect(chat).toHaveClass('nav__link', 'nav__link--active');
    expect(home).not.toHaveAttribute('aria-current');

    syncActiveLinks(root, '/home');

    expect(chat).not.toHaveAttribute('aria-current');
    expect(chat.className).toBe('nav__link');
    expect(home).toHaveAttribute('aria-current', 'page');
  });

  it('never treats "/" as a prefix of every route', () => {
    const root = createLink({ to: '/' }, 'Inicio');
    syncActiveLinks(mountLinks(root), '/about');

    expect(root).not.toHaveAttribute('aria-current');
  });

  it('renders only class and href on SPA links', () => {
    expect(navLink('/chat', 'Chat').getAttributeNames().sort()).toEqual(['class', 'href']);
  });
});
