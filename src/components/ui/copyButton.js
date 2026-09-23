import { classNames, h } from '../../lib/dom.js';
import { copyToClipboard } from '../../lib/clipboard.js';
import { createIcon } from './icon.js';

const FEEDBACK_DURATION_MS = 1800;

export function createCopyButton(text, { label = 'Copiar respuesta' } = {}) {
  let timeoutId = null;
  let destroyed = false;

  const element = h('button', {
    attrs: { type: 'button', title: label },
    on: { click: handleClick },
  });

  function render(copied) {
    element.className = classNames('copy-button', copied && 'copy-button--done');
    element.setAttribute('aria-label', copied ? 'Copiado al portapapeles' : label);
    element.replaceChildren(createIcon(copied ? 'check' : 'copy', { size: 14 }), copied ? 'Copiado' : 'Copiar');
  }

  async function handleClick() {
    const copied = await copyToClipboard(text);
    if (destroyed) return;

    render(copied);
    if (!copied) return;

    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => render(false), FEEDBACK_DURATION_MS);
  }

  function destroy() {
    destroyed = true;
    clearTimeout(timeoutId);
  }

  render(false);
  return { element, destroy };
}
