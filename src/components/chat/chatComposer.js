import { h } from '../../lib/dom.js';
import { createIcon } from '../ui/icon.js';

const MAX_LENGTH = 2000;

export function createChatComposer({ characterName, onSend, disabled = false }) {
  let isDisabled = disabled;

  const input = h('textarea', {
    className: 'composer__input',
    attrs: { placeholder: `Escribe a ${characterName}…`, autocomplete: 'off' },
    props: { id: 'composer-input', maxLength: MAX_LENGTH, rows: 1 },
    on: { input: render, keydown: handleKeyDown },
  });

  const label = h('span', { className: 'composer__send-label' });

  const sendButton = h(
    'button',
    { className: 'button button--primary composer__send', attrs: { type: 'submit' } },
    label,
    createIcon('send', { size: 20 })
  );

  const element = h(
    'form',
    { className: 'composer', on: { submit: handleSubmit } },
    h(
      'label',
      { className: 'visually-hidden', attrs: { for: 'composer-input' } },
      'Mensaje para ',
      characterName
    ),
    input,
    sendButton
  );

  function canSend() {
    return input.value.trim().length > 0 && !isDisabled;
  }

  function render() {
    input.disabled = isDisabled;
    sendButton.disabled = !canSend();
    label.textContent = isDisabled ? 'Enviando…' : '¡Enviar!';
  }

  function submit() {
    if (!canSend()) return;
    const { value } = input;
    input.value = '';
    render();
    onSend(value);
  }

  function handleSubmit(event) {
    event.preventDefault();
    submit();
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  function setDisabled(value) {
    if (value === isDisabled) return;
    isDisabled = value;
    render();
  }

  render();
  return { element, setDisabled };
}
