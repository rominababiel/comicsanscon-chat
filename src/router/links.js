import { h } from '../lib/dom.js';
import { navigate } from './history.js';

/** Links de la SPA creados con createLink: solo esos navegan con History API. */
const spaLinks = new WeakMap();

function isModifiedEvent(event) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey || event.button !== 0;
}

function isActive(to, pathname) {
  return pathname === to || (to !== '/' && pathname.startsWith(`${to}/`));
}

export function createLink({ to, className, activeClassName, attrs }, ...children) {
  const anchor = h('a', { className, attrs: { href: to, ...attrs } }, ...children);
  spaLinks.set(anchor, { to, activeClassName });
  return anchor;
}

/** Intercepta los clics en los links de la SPA para navegar sin recargar la página. */
export function interceptLinks(root) {
  function handleClick(event) {
    const anchor = event.target.closest?.('a[href]');
    const link = anchor && root.contains(anchor) ? spaLinks.get(anchor) : null;
    if (!link || isModifiedEvent(event) || anchor.target === '_blank') return;

    event.preventDefault();
    navigate(link.to);
  }

  root.addEventListener('click', handleClick);
  return () => root.removeEventListener('click', handleClick);
}

/** Marca con aria-current (y la clase activa, si la tiene) los links que apuntan a la ruta actual. */
export function syncActiveLinks(root, pathname) {
  for (const anchor of root.querySelectorAll('a[href]')) {
    const link = spaLinks.get(anchor);
    if (!link) continue;

    const active = isActive(link.to, pathname);
    if (active) anchor.setAttribute('aria-current', 'page');
    else anchor.removeAttribute('aria-current');

    if (link.activeClassName) anchor.classList.toggle(link.activeClassName, active);
  }
}
