import { h } from '../../lib/dom.js';
import { ROLES, formatTimestamp } from '../../utils.js';
import { createAvatar } from '../ui/avatar.js';
import { createCopyButton } from '../ui/copyButton.js';

export function createMessageBubble(message, character) {
  const isUser = message.role === ROLES.USER;
  const author = isUser ? 'Tú' : character.name;
  const copyButton = isUser ? null : createCopyButton(message.content);

  const element = h(
    'li',
    { className: `message message--${isUser ? 'user' : 'assistant'}`, attrs: { 'data-testid': 'message' } },
    isUser
      ? h('span', { className: 'avatar avatar--sm avatar--user', attrs: { 'aria-hidden': 'true' } }, 'Tú')
      : createAvatar(character, 'sm'),
    h(
      'div',
      { className: 'message__bubble' },
      h(
        'div',
        { className: 'message__meta' },
        h('span', { className: 'message__author' }, author),
        h(
          'time',
          { className: 'message__time', attrs: { datetime: message.createdAt } },
          formatTimestamp(message.createdAt)
        )
      ),
      h('p', { className: 'message__content' }, message.content),
      copyButton?.element
    )
  );

  function destroy() {
    copyButton?.destroy();
  }

  return { element, destroy };
}
