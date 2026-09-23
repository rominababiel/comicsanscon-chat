import { h } from '../../lib/dom.js';
import { createAvatar } from '../ui/avatar.js';

export function createStreamingBubble(character, text = '') {
  const textNode = document.createTextNode(text);

  const element = h(
    'li',
    { className: 'message message--assistant', attrs: { 'aria-live': 'polite' } },
    createAvatar(character, 'sm'),
    h(
      'div',
      { className: 'message__bubble' },
      h('div', { className: 'message__meta' }, h('span', { className: 'message__author' }, character.name)),
      h(
        'p',
        { className: 'message__content' },
        textNode,
        h('span', { className: 'message__caret', attrs: { 'aria-hidden': 'true' } })
      )
    )
  );

  function setText(value) {
    if (textNode.data !== value) textNode.data = value;
  }

  return { element, setText };
}
