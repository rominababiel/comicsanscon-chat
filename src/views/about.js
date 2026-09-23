import { h } from '../lib/dom.js';
import { characters } from '../data/characters.js';
import { createLink } from '../router/links.js';
import { createAvatar } from '../components/ui/avatar.js';
import { createIcon } from '../components/ui/icon.js';

const TECH_STACK = [
  { name: 'JavaScript + Vite', detail: 'Interfaz con módulos ES y DOM nativo, sin frameworks; Vite para el build.' },
  { name: 'History API', detail: 'Routing propio con pushState y popstate, sin recargas.' },
  { name: 'Vercel Serverless Functions', detail: 'Proxy seguro hacia Gemini; la API key vive solo en el servidor.' },
  { name: 'Google Gemini', detail: 'Modelo generativo que interpreta a cada personaje.' },
  { name: 'Vitest + Testing Library', detail: 'Tests unitarios con fetch mockeado.' },
];

const STEPS = [
  'Escribes un mensaje y la aplicación lo agrega al historial de la conversación.',
  'El historial completo viaja a una Serverless Function en Vercel.',
  'La función agrega el system prompt del personaje y consulta a Gemini con la API key del servidor.',
  'La respuesta se parsea y se muestra en el chat manteniendo el contexto anterior.',
];

function createAboutCharacter(character) {
  return h(
    'li',
    { className: 'about-character panel', style: { '--accent': character.accent } },
    createAvatar(character, 'lg'),
    h(
      'div',
      { className: 'about-character__body' },
      h('h3', { className: 'about-character__name' }, character.name),
      h('p', { className: 'about-character__title' }, character.title),
      h('p', { className: 'about-character__description' }, character.description),
      createLink(
        { to: `/chat/${character.id}`, className: 'text-link' },
        'Hablar con ',
        character.name,
        createIcon('arrowRight', { size: 16 })
      )
    )
  );
}

export function mountAboutView() {
  const element = h(
    'main',
    { className: 'view view--about' },
    h(
      'section',
      { className: 'about-intro' },
      h('span', { className: 'caption caption--tilt' }, 'Sobre el proyecto'),
      h('h1', { className: 'display-title' }, 'Una prueba de concepto de ComicSansCon'),
      h(
        'p',
        { className: 'lead' },
        'ComicSansCon diseña experiencias interactivas para fans. Esta aplicación explora cómo se sentiría conversar con héroes de cómic usando inteligencia artificial generativa, con una arquitectura simple, segura y desplegable en minutos.'
      )
    ),
    h(
      'section',
      { className: 'about-section', attrs: { 'aria-labelledby': 'about-characters' } },
      h('h2', { className: 'section-title', attrs: { id: 'about-characters' } }, 'Los personajes'),
      h('ul', { className: 'about-characters' }, characters.map(createAboutCharacter))
    ),
    h(
      'section',
      { className: 'about-section', attrs: { 'aria-labelledby': 'about-how' } },
      h('h2', { className: 'section-title', attrs: { id: 'about-how' } }, 'Cómo funciona'),
      h(
        'ol',
        { className: 'steps' },
        STEPS.map((step) => h('li', { className: 'steps__item panel' }, step))
      )
    ),
    h(
      'section',
      { className: 'about-section', attrs: { 'aria-labelledby': 'about-stack' } },
      h('h2', { className: 'section-title', attrs: { id: 'about-stack' } }, 'Tecnología'),
      h(
        'ul',
        { className: 'stack' },
        TECH_STACK.map((item) =>
          h('li', { className: 'stack__item panel' }, h('strong', {}, item.name), h('span', {}, item.detail))
        )
      )
    )
  );

  return { element, destroy() {} };
}
