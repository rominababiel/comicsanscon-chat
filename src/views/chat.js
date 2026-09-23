import { h } from '../lib/dom.js';
import { createChatController } from '../chat.js';
import { defaultCharacter, getCharacter } from '../data/characters.js';
import { loadLastCharacterId, saveLastCharacterId } from '../features/chat/chatStorage.js';
import { createChatHeader } from '../components/chat/chatHeader.js';
import { createChatComposer } from '../components/chat/chatComposer.js';
import { createErrorBanner } from '../components/chat/errorBanner.js';
import { createMessageBubble } from '../components/chat/messageBubble.js';
import { createStreamingBubble } from '../components/chat/streamingBubble.js';
import { createTypingIndicator } from '../components/chat/typingIndicator.js';
import { mountNotFoundView } from './notFound.js';

const PENDING = Object.freeze({ STREAMING: 'streaming', TYPING: 'typing' });

export function resolveCharacter(characterId) {
  if (characterId) return getCharacter(characterId);
  return getCharacter(loadLastCharacterId()) ?? defaultCharacter;
}

export function chatViewKey(params = {}) {
  return resolveCharacter(params.characterId)?.id ?? `missing:${params.characterId}`;
}

function pendingKind({ isLoading, streamingText }) {
  if (!isLoading) return null;
  return streamingText ? PENDING.STREAMING : PENDING.TYPING;
}

function mountChatSession(character) {
  const controller = createChatController(character);
  const bubbles = new Map();
  let pending = null;
  let banner = null;
  let scrollKey = null;
  let destroyed = false;

  const suggestionButtons = character.samplePrompts.map((prompt) =>
    h(
      'button',
      {
        className: 'suggestion',
        attrs: { type: 'button' },
        on: { click: () => controller.sendMessage(prompt) },
      },
      prompt
    )
  );

  const header = createChatHeader(character, { onClearHistory: () => controller.clearHistory() });
  const list = h('ul', { className: 'message-list__items' });
  const anchor = h('div', { attrs: { 'aria-hidden': 'true' } });
  const composer = createChatComposer({
    characterName: character.name,
    onSend: (value) => controller.sendMessage(value),
  });

  const panel = h(
    'section',
    { className: 'chat-panel', attrs: { 'aria-label': `Chat con ${character.name}` } },
    header.element,
    h('div', { className: 'message-list', attrs: { 'aria-label': 'Conversación' } }, list, anchor),
    composer.element
  );

  const element = h(
    'main',
    { className: 'view view--chat', style: { '--accent': character.accent } },
    h(
      'aside',
      { className: 'chat-sidebar', attrs: { 'aria-label': 'Información del personaje' } },
      h('p', { className: 'eyebrow' }, 'Estás hablando con'),
      h('h2', { className: 'chat-sidebar__name' }, character.name),
      h('p', { className: 'chat-sidebar__title' }, character.title),
      h('p', { className: 'chat-sidebar__description' }, character.description),
      h('h3', { className: 'chat-sidebar__subtitle caption' }, 'Ideas para empezar'),
      h(
        'ul',
        { className: 'suggestions' },
        suggestionButtons.map((button) => h('li', {}, button))
      )
    ),
    panel
  );

  function scrollToEnd() {
    anchor.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }

  function renderMessages(messages) {
    const ids = new Set(messages.map((message) => message.id));
    for (const [id, bubble] of bubbles) {
      if (ids.has(id)) continue;
      bubble.element.remove();
      bubble.destroy();
      bubbles.delete(id);
    }

    let cursor = list.firstChild;
    for (const message of messages) {
      let bubble = bubbles.get(message.id);
      if (!bubble) {
        bubble = createMessageBubble(message, character);
        bubbles.set(message.id, bubble);
      }

      if (bubble.element === cursor) cursor = cursor.nextSibling;
      else list.insertBefore(bubble.element, cursor);
    }
  }

  function renderPending(state) {
    const kind = pendingKind(state);

    if (kind !== pending?.kind) {
      pending?.element.remove();
      pending = null;
      if (kind === PENDING.STREAMING) {
        pending = { kind, ...createStreamingBubble(character, state.streamingText) };
      } else if (kind === PENDING.TYPING) {
        pending = { kind, element: createTypingIndicator(character) };
      }
    } else if (kind === PENDING.STREAMING) {
      pending.setText(state.streamingText);
    }

    if (pending && list.lastChild !== pending.element) list.append(pending.element);
  }

  function renderError(error) {
    if (!error) {
      banner?.element.remove();
      banner = null;
    } else if (banner) {
      banner.setMessage(error);
    } else {
      banner = createErrorBanner({ message: error, onRetry: () => controller.retry() });
      panel.insertBefore(banner.element, composer.element);
    }
  }

  function syncScroll({ messages, isLoading, streamingText }) {
    const key = `${messages.length}-${isLoading}-${streamingText.length}`;
    if (key === scrollKey) return;
    scrollKey = key;
    if (anchor.isConnected) scrollToEnd();
  }

  function render(state, previous) {
    if (state.isLoading !== previous?.isLoading) {
      for (const button of suggestionButtons) button.disabled = state.isLoading;
      composer.setDisabled(state.isLoading);
    }
    if (state.hasHistory !== previous?.hasHistory) header.update({ hasHistory: state.hasHistory });
    if (state.messages !== previous?.messages) renderMessages(state.messages);
    renderPending(state);
    renderError(state.error);
    syncScroll(state);
  }

  let rendered = controller.getState();
  render(rendered);
  const unsubscribe = controller.subscribe((state) => {
    render(state, rendered);
    rendered = state;
  });
  saveLastCharacterId(character.id);
  queueMicrotask(() => {
    if (!destroyed) scrollToEnd();
  });

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    unsubscribe();
    controller.destroy();
    for (const bubble of bubbles.values()) bubble.destroy();
    bubbles.clear();
  }

  return { element, destroy };
}

export function mountChatView(params = {}) {
  const character = resolveCharacter(params.characterId);

  if (!character) {
    return mountNotFoundView({ message: `No encontramos ningún personaje llamado “${params.characterId}”.` });
  }

  return mountChatSession(character);
}
