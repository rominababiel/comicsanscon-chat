import { h } from '../../lib/dom.js';
import { createLink } from '../../router/links.js';
import { createThemeToggle } from '../ui/themeToggle.js';

const NAV_ITEMS = [
  { to: '/home', label: 'Home' },
  { to: '/chat', label: 'Chat' },
  { to: '/about', label: 'About' },
];

export function createHeader() {
  return h(
    'header',
    { className: 'header' },
    h(
      'div',
      { className: 'header__inner' },
      createLink(
        { to: '/home', className: 'brand', attrs: { 'aria-label': 'ComicSansCon, ir al inicio' } },
        h('span', { className: 'brand__mark', attrs: { 'aria-hidden': 'true' } }, 'CSC'),
        h('span', { className: 'brand__name' }, 'ComicSansCon')
      ),
      h(
        'nav',
        { className: 'nav', attrs: { 'aria-label': 'Navegación principal' } },
        NAV_ITEMS.map((item) =>
          createLink({ to: item.to, className: 'nav__link', activeClassName: 'nav__link--active' }, item.label)
        )
      ),
      createThemeToggle()
    )
  );
}
