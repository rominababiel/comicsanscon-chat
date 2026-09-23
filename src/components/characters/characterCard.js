import { h } from '../../lib/dom.js';
import { createLink } from '../../router/links.js';
import { createSticker } from '../ui/sticker.js';

export function createCharacterCard(character, { hasHistory = false } = {}) {
  return h(
    'article',
    { className: 'character-card', style: { '--accent': character.accent } },
    hasHistory &&
      createSticker(
        {
          icon: 'save',
          className: 'character-card__sticker',
          title: 'Tienes una conversación guardada con este personaje',
        },
        'Historial guardado'
      ),
    h(
      'div',
      { className: 'cover' },
      h('img', {
        className: 'cover__art',
        attrs: { src: character.image, alt: `${character.name} ilustrado en estilo cómic` },
      }),
      h(
        'div',
        { className: 'cover__corner' },
        h('h3', { className: 'character-card__name' }, character.name),
        h('p', { className: 'cover__franchise' }, character.franchise)
      )
    ),
    h('p', { className: 'character-card__title' }, character.title),
    h('p', { className: 'character-card__description' }, character.description),
    createLink(
      { to: `/chat/${character.id}`, className: 'button button--accent character-card__cta' },
      hasHistory ? 'Continuar conversación' : `Chatear con ${character.name}`
    )
  );
}
