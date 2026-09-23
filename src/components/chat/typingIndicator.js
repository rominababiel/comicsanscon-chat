import { h } from '../../lib/dom.js';
import { createAvatar } from '../ui/avatar.js';

export function createTypingIndicator(character) {
  return h(
    'li',
    { className: 'message message--assistant', attrs: { role: 'status', 'aria-live': 'polite' } },
    createAvatar(character, 'sm'),
    h(
      'div',
      { className: 'message__bubble message__bubble--typing' },
      h(
        'span',
        { className: 'typing', attrs: { 'aria-hidden': 'true' } },
        h('span', { className: 'typing__dot' }),
        h('span', { className: 'typing__dot' }),
        h('span', { className: 'typing__dot' })
      ),
      h('span', { className: 'typing__label' }, character.name, ' está escribiendo…')
    )
  );
}
