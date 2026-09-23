import { h } from '../../lib/dom.js';

export function createAvatar(character, size = 'md') {
  return h(
    'span',
    { className: `avatar avatar--${size}`, style: { '--accent': character.accent } },
    h('img', { className: 'avatar__image', attrs: { src: character.image, alt: character.name } })
  );
}
