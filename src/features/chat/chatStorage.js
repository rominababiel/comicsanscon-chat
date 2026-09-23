const STORAGE_PREFIX = 'comicsanscon:chat:';
export const LAST_CHARACTER_KEY = 'comicsanscon:last-character';

function storageKey(characterId) {
  return `${STORAGE_PREFIX}${characterId}`;
}

function safeStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function isMessage(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.role === 'string' &&
    typeof value.content === 'string' &&
    typeof value.createdAt === 'string'
  );
}

export function loadConversation(characterId) {
  const storage = safeStorage();
  if (!storage) return null;

  try {
    const parsed = JSON.parse(storage.getItem(storageKey(characterId)) ?? 'null');
    return Array.isArray(parsed) && parsed.length > 0 && parsed.every(isMessage) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveConversation(characterId, messages) {
  try {
    safeStorage()?.setItem(storageKey(characterId), JSON.stringify(messages));
  } catch {
    return;
  }
}

export function clearConversation(characterId) {
  safeStorage()?.removeItem(storageKey(characterId));
}

export function hasSavedConversation(characterId) {
  return loadConversation(characterId) !== null;
}

export function loadLastCharacterId() {
  return safeStorage()?.getItem(LAST_CHARACTER_KEY) ?? null;
}

export function saveLastCharacterId(characterId) {
  try {
    safeStorage()?.setItem(LAST_CHARACTER_KEY, characterId);
  } catch {
    return;
  }
}
