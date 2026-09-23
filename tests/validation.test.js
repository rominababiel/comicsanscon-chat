import { describe, expect, it } from 'vitest';
import {
  MAX_ASSISTANT_MESSAGE_LENGTH,
  MAX_HISTORY_LENGTH,
  MAX_MESSAGE_LENGTH,
  validateChatRequest,
} from '../api/_lib/validation.js';
import { getSystemPrompt } from '../api/_lib/prompts.js';
import { characters } from '../src/data/characters.js';

const validBody = {
  characterId: 'captain-america',
  messages: [
    { role: 'assistant', content: '¡Hola!' },
    { role: 'user', content: '  ¿Qué comes?  ' },
  ],
};

describe('validateChatRequest', () => {
  it('accepts a valid body and resolves the character server-side', () => {
    const result = validateChatRequest(validBody);

    expect(result.ok).toBe(true);
    expect(result.value.character.id).toBe('captain-america');
    expect(result.value.systemPrompt).toContain('Steve Rogers');
    expect(result.value.messages.at(-1)).toEqual({ role: 'user', content: '¿Qué comes?' });
  });

  it('keeps the full history, without dropping older messages', () => {
    const messages = Array.from({ length: MAX_HISTORY_LENGTH - 1 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `m${index}`,
    }));
    messages.push({ role: 'user', content: 'último' });

    const result = validateChatRequest({ characterId: 'thor', messages });

    expect(result.ok).toBe(true);
    expect(result.value.messages).toHaveLength(MAX_HISTORY_LENGTH);
    expect(result.value.messages[0].content).toBe('m0');
    expect(result.value.messages.at(-1).content).toBe('último');
  });

  it('rejects with 413 a history longer than the limit instead of truncating it', () => {
    const messages = Array.from({ length: MAX_HISTORY_LENGTH + 1 }, () => ({ role: 'user', content: 'hola' }));

    const result = validateChatRequest({ characterId: 'thor', messages });

    expect(result).toMatchObject({ ok: false, status: 413 });
    expect(result.error).toMatch(/Borra el historial/);
  });

  it('accepts assistant replies longer than the user input limit', () => {
    const longReply = 'a'.repeat(MAX_MESSAGE_LENGTH + 500);
    const result = validateChatRequest({
      characterId: 'thor',
      messages: [
        { role: 'user', content: 'Cuéntame una historia' },
        { role: 'assistant', content: longReply },
        { role: 'user', content: '¿Y después?' },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.value.messages[1].content).toBe(longReply);
  });

  it.each([
    ['missing body', undefined, /objeto JSON/],
    ['unknown character', { ...validBody, characterId: 'hulk' }, /Personaje desconocido/],
    ['empty messages', { ...validBody, messages: [] }, /al menos un mensaje/],
    ['invalid role', { ...validBody, messages: [{ role: 'system', content: 'x' }] }, /rol válido/],
    ['empty content', { ...validBody, messages: [{ role: 'user', content: '   ' }] }, /rol válido/],
    [
      'too long content',
      { ...validBody, messages: [{ role: 'user', content: 'a'.repeat(MAX_MESSAGE_LENGTH + 1) }] },
      /rol válido/,
    ],
    [
      'too long assistant reply',
      {
        ...validBody,
        messages: [
          { role: 'assistant', content: 'a'.repeat(MAX_ASSISTANT_MESSAGE_LENGTH + 1) },
          { role: 'user', content: 'hola' },
        ],
      },
      /rol válido/,
    ],
    ['prototype key as role', { ...validBody, messages: [{ role: 'toString', content: 'x' }] }, /rol válido/],
    ['__proto__ as role', { ...validBody, messages: [{ role: '__proto__', content: 'x' }] }, /rol válido/],
    [
      'last message not from user',
      { ...validBody, messages: [{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'hey' }] },
      /último mensaje/,
    ],
  ])('rejects %s', (_, body, pattern) => {
    const result = validateChatRequest(body);

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toMatch(pattern);
  });
});

describe('getSystemPrompt', () => {
  it('has a prompt for every character in the public catalogue', () => {
    for (const character of characters) {
      expect(getSystemPrompt(character.id)).toEqual(expect.stringContaining(character.name));
    }
  });

  it('keeps the prompts out of the data shipped to the browser', () => {
    for (const character of characters) {
      expect(character).not.toHaveProperty('systemPrompt');
    }
  });

  it('returns null for an unknown character', () => {
    expect(getSystemPrompt('batman')).toBeNull();
  });
});
