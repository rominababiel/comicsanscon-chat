import { h } from '../../lib/dom.js';
import { characters } from '../../data/characters.js';
import { hasSavedConversation } from '../../features/chat/chatStorage.js';
import { createCharacterCard } from './characterCard.js';

export function createCharacterGallery() {
  return h(
    'section',
    { className: 'gallery', attrs: { 'aria-labelledby': 'gallery-title' } },
    h(
      'div',
      { className: 'gallery__heading' },
      h('h2', { className: 'section-title', attrs: { id: 'gallery-title' } }, 'Elige con quién hablar')
    ),
    h(
      'div',
      { className: 'gallery__grid' },
      characters.map((character) =>
        createCharacterCard(character, { hasHistory: hasSavedConversation(character.id) })
      )
    )
  );
}
