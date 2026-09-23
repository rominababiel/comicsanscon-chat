import { h, svg } from '../lib/dom.js';
import { createLink } from '../router/links.js';
import { defaultCharacter } from '../data/characters.js';
import { createCharacterGallery } from '../components/characters/characterGallery.js';
import { createAvatar } from '../components/ui/avatar.js';
import { createIcon } from '../components/ui/icon.js';

function createStarburst(label) {
  return svg(
    'svg',
    { class: 'starburst', viewBox: '0 0 132 132', 'aria-hidden': 'true' },
    svg('polygon', {
      points:
        '66,4 80,26 106,14 100,42 128,48 108,66 128,84 100,90 106,118 80,106 66,128 52,106 26,118 32,90 4,84 24,66 4,48 32,42 26,14 52,26',
      class: 'starburst__shape',
    }),
    svg('text', { x: '66', y: '76', 'text-anchor': 'middle', class: 'starburst__label' }, label)
  );
}

export function mountHomeView() {
  const element = h(
    'main',
    { className: 'view view--home' },
    h(
      'section',
      { className: 'hero', style: { '--accent': defaultCharacter.accent } },
      h('div', { className: 'hero__halftone', attrs: { 'aria-hidden': 'true' } }),
      h(
        'div',
        { className: 'hero__content' },
        h('span', { className: 'caption caption--tilt' }, 'Prueba de concepto · ComicSansCon'),
        h('h1', { className: 'hero__title' }, '¡Chatea con tu personaje favorito!'),
        h(
          'p',
          { className: 'hero__lead' },
          'Conversaciones naturales con héroes de cómic impulsadas por inteligencia artificial. Cada personaje tiene su propia voz, humor y límites.'
        ),
        h(
          'div',
          { className: 'hero__actions' },
          createLink(
            { to: `/chat/${defaultCharacter.id}`, className: 'button button--primary button--lg' },
            '¡Empezar a chatear!',
            createIcon('arrowRight', { size: 20 })
          ),
          createLink({ to: '/about', className: 'button button--lg' }, 'Sobre el proyecto')
        )
      ),
      h(
        'aside',
        { className: 'hero__featured', attrs: { 'aria-label': 'Personaje destacado' } },
        createStarburst('¡NUEVO!'),
        h(
          'div',
          { className: 'hero__featured-header' },
          createAvatar(defaultCharacter, 'xl'),
          h(
            'div',
            {},
            h('p', { className: 'eyebrow' }, 'Personaje destacado'),
            h('h2', { className: 'hero__featured-name' }, defaultCharacter.name),
            h('p', { className: 'hero__featured-title' }, defaultCharacter.title)
          )
        ),
        h('p', { className: 'hero__featured-description' }, defaultCharacter.description),
        h('p', { className: 'speech' }, defaultCharacter.greeting)
      )
    ),
    createCharacterGallery()
  );

  return { element, destroy() {} };
}
