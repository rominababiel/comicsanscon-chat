import { h } from '../../lib/dom.js';

export function createFooter() {
  return h(
    'footer',
    { className: 'footer' },
    h('p', {}, 'ComicSansCon · Prueba de concepto · Respuestas generadas por IA, pueden contener errores.')
  );
}
