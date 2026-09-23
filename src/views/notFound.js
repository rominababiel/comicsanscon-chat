import { h } from '../lib/dom.js';
import { createLink } from '../router/links.js';

export function mountNotFoundView({ message = 'La página que buscas no existe.' } = {}) {
  const element = h(
    'main',
    { className: 'view view--not-found' },
    h('span', { className: 'caption caption--tilt' }, 'Error 404'),
    h('h1', { className: 'display-title' }, '¡Te perdiste en el multiverso!'),
    h('p', { className: 'lead' }, message),
    createLink({ to: '/home', className: 'button button--primary button--lg' }, 'Volver al inicio')
  );

  return { element, destroy() {} };
}
