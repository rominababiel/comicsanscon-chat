import { h } from '../../lib/dom.js';
import { createLink } from '../../router/links.js';
import { createAvatar } from '../ui/avatar.js';
import { createIcon } from '../ui/icon.js';
import { createSticker } from '../ui/sticker.js';

export function createChatHeader(character, { hasHistory = false, onClearHistory } = {}) {
  let sticker = null;

  const clearButton = h(
    'button',
    {
      className: 'button button--small',
      attrs: { type: 'button', 'aria-label': 'Borrar historial' },
      on: { click: () => onClearHistory?.() },
    },
    createIcon('trash', { size: 16 }),
    h('span', { className: 'chat-header__clear-label' }, 'Borrar historial')
  );

  const actions = h('div', { className: 'chat-header__actions' }, clearButton);

  const element = h(
    'header',
    { className: 'chat-header' },
    createLink(
      {
        to: '/home',
        className: 'button button--small chat-header__back',
        attrs: { 'aria-label': 'Volver a la galería' },
      },
      createIcon('arrowLeft', { size: 16 }),
      h('span', { className: 'chat-header__back-label' }, 'Personajes')
    ),
    h(
      'div',
      { className: 'chat-header__identity' },
      createAvatar(character, 'md'),
      h(
        'div',
        {},
        h('h1', { className: 'chat-header__name' }, character.name),
        h('p', { className: 'chat-header__title' }, character.title)
      )
    ),
    actions
  );

  function update({ hasHistory: nextHasHistory }) {
    clearButton.disabled = !nextHasHistory;

    if (nextHasHistory && !sticker) {
      sticker = createSticker(
        { icon: 'save', tone: 'paper', title: 'La conversación se guarda en este navegador' },
        'Guardado'
      );
      actions.insertBefore(sticker, clearButton);
    } else if (!nextHasHistory && sticker) {
      sticker.remove();
      sticker = null;
    }
  }

  update({ hasHistory });
  return { element, update };
}
