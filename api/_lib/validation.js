import { getCharacter } from '../../src/data/characters.js';
import { getSystemPrompt } from './prompts.js';

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_ASSISTANT_MESSAGE_LENGTH = 8000;
export const MAX_HISTORY_LENGTH = 200;

/**
 * El límite de 2000 caracteres es el del input del usuario. Las respuestas del
 * personaje vuelven en el historial y pueden ser más largas, así que tienen su
 * propio tope: si no, una respuesta larga rompería todos los mensajes siguientes.
 */
const MAX_LENGTH_BY_ROLE = new Map([
  ['user', MAX_MESSAGE_LENGTH],
  ['assistant', MAX_ASSISTANT_MESSAGE_LENGTH],
]);

function invalid(error, status = 400) {
  return { ok: false, error, status };
}

function normalizeMessage(message) {
  if (!message || typeof message !== 'object') return null;
  const maxLength = MAX_LENGTH_BY_ROLE.get(message.role);
  if (!maxLength) return null;
  if (typeof message.content !== 'string') return null;

  const content = message.content.trim();
  if (!content || content.length > maxLength) return null;

  return { role: message.role, content };
}

export function validateChatRequest(body) {
  if (!body || typeof body !== 'object') {
    return invalid('El cuerpo de la petición debe ser un objeto JSON.');
  }

  const character = getCharacter(body.characterId);
  const systemPrompt = character && getSystemPrompt(character.id);
  if (!systemPrompt) {
    return invalid('Personaje desconocido.');
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return invalid('Debes enviar al menos un mensaje.');
  }

  if (body.messages.length > MAX_HISTORY_LENGTH) {
    return invalid('La conversación es demasiado larga. Borra el historial para empezar una nueva.', 413);
  }

  const messages = body.messages.map(normalizeMessage);
  if (messages.some((message) => message === null)) {
    return invalid(
      `Cada mensaje necesita un rol válido y un texto de hasta ${MAX_MESSAGE_LENGTH} caracteres.`
    );
  }

  if (messages.at(-1).role !== 'user') {
    return invalid('El último mensaje debe ser del usuario.');
  }

  return { ok: true, value: { character, systemPrompt, messages } };
}
