import { requestReply } from './features/chat/chatApi.js';
import {
  ROLES,
  buildChatRequest,
  createGreeting,
  createMessage,
  hasUserMessages,
} from './utils.js';
import { clearConversation, loadConversation, saveConversation } from './features/chat/chatStorage.js';

export const CHAT_STATUS = Object.freeze({ IDLE: 'idle', LOADING: 'loading', ERROR: 'error' });

function snapshot({ messages, status, streamingText, error }, hasHistory) {
  return {
    messages,
    status,
    streamingText,
    error,
    isLoading: status === CHAT_STATUS.LOADING,
    hasHistory,
  };
}

/** Estado de una conversación con un personaje, sin depender de ningún framework ni del DOM. */
export function createChatController(character) {
  const listeners = new Set();
  let abortController = null;
  let destroyed = false;
  const initialMessages = loadConversation(character.id) ?? [createGreeting(character)];
  let state = snapshot(
    { messages: initialMessages, status: CHAT_STATUS.IDLE, streamingText: '', error: null },
    hasUserMessages(initialMessages)
  );

  function setState(patch) {
    if (destroyed) return;

    const next = { ...state, ...patch };
    const messagesChanged = 'messages' in patch;
    state = snapshot(next, messagesChanged ? hasUserMessages(next.messages) : state.hasHistory);
    if (messagesChanged && state.hasHistory) saveConversation(character.id, state.messages);

    for (const listener of listeners) listener(state);
  }

  async function requestAssistantReply(history) {
    abortController?.abort();
    const controller = new AbortController();
    abortController = controller;

    setState({ status: CHAT_STATUS.LOADING, streamingText: '', error: null });

    try {
      const reply = await requestReply(buildChatRequest(character.id, history), {
        signal: controller.signal,
        onDelta: (text) => setState({ streamingText: text }),
      });
      setState({
        messages: [...state.messages, createMessage(ROLES.ASSISTANT, reply)],
        status: CHAT_STATUS.IDLE,
      });
    } catch (requestError) {
      if (requestError?.name === 'AbortError') return;
      setState({ error: requestError.message, status: CHAT_STATUS.ERROR });
    } finally {
      if (abortController === controller) setState({ streamingText: '' });
    }
  }

  async function sendMessage(text) {
    const content = text.trim();
    if (!content || state.status === CHAT_STATUS.LOADING) return;

    const history = [...state.messages, createMessage(ROLES.USER, content)];
    setState({ messages: history });
    await requestAssistantReply(history);
  }

  async function retry() {
    if (state.messages.at(-1)?.role !== ROLES.USER) return;
    await requestAssistantReply(state.messages);
  }

  function clearHistory() {
    abortController?.abort();
    clearConversation(character.id);
    setState({
      messages: [createGreeting(character)],
      status: CHAT_STATUS.IDLE,
      streamingText: '',
      error: null,
    });
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function destroy() {
    destroyed = true;
    abortController?.abort();
    listeners.clear();
  }

  return {
    getState: () => state,
    subscribe,
    sendMessage,
    retry,
    clearHistory,
    destroy,
  };
}
