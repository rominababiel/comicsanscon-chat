import { classNames, h } from '../../lib/dom.js';
import { createIcon } from './icon.js';

export function createSticker({ icon, tone = 'red', className, title }, ...children) {
  return h(
    'span',
    { className: classNames('sticker', `sticker--${tone}`, className), attrs: { title } },
    icon && createIcon(icon, { size: 14 }),
    ...children
  );
}
