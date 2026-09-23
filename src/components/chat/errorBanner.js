import { h } from '../../lib/dom.js';
import { createIcon } from '../ui/icon.js';

export function createErrorBanner({ message, onRetry }) {
  const messageElement = h('p', { className: 'error-banner__message' }, message);

  const element = h(
    'div',
    { className: 'error-banner', attrs: { role: 'alert' } },
    createIcon('alert', { size: 22, className: 'error-banner__icon' }),
    messageElement,
    onRetry &&
      h(
        'button',
        {
          className: 'button button--small error-banner__retry',
          attrs: { type: 'button' },
          on: { click: onRetry },
        },
        'Reintentar'
      )
  );

  function setMessage(text) {
    if (messageElement.textContent !== text) messageElement.textContent = text;
  }

  return { element, setMessage };
}
