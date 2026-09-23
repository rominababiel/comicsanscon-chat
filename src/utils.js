export const ROLES = Object.freeze({ USER: 'user', ASSISTANT: 'assistant' });

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createMessage(role, content, { createdAt = new Date().toISOString() } = {}) {
  return { id: generateId(), role, content, createdAt };
}

export function createGreeting(character) {
  return createMessage(ROLES.ASSISTANT, character.greeting);
}

export function toApiMessages(messages) {
  return messages.map(({ role, content }) => ({ role, content }));
}

export function buildChatRequest(characterId, messages) {
  return { characterId, messages: toApiMessages(messages) };
}

/**
 * Separa un buffer de texto en eventos `data:` completos y devuelve el resto
 * todavía incompleto para concatenarlo con el siguiente fragmento del stream.
 */
export function parseStreamBuffer(buffer) {
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';

  const events = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean)
    .map((data) => {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return { events, rest };
}

export function hasUserMessages(messages) {
  return messages.some((message) => message.role === ROLES.USER);
}

export function formatTimestamp(isoDate, locale = 'es') {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
}
