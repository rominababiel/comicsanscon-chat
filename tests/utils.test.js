import { describe, expect, it } from 'vitest';
import {
  ROLES,
  buildChatRequest,
  createGreeting,
  createMessage,
  formatTimestamp,
  hasUserMessages,
  parseStreamBuffer,
  toApiMessages,
} from '../src/utils.js';
import { characters } from '../src/data/characters.js';

describe('createMessage', () => {
  it('creates a message with id, role, content and ISO timestamp', () => {
    const message = createMessage(ROLES.USER, 'Hola');

    expect(message).toMatchObject({ role: 'user', content: 'Hola' });
    expect(typeof message.id).toBe('string');
    expect(new Date(message.createdAt).toISOString()).toBe(message.createdAt);
  });

  it('generates unique ids for consecutive messages', () => {
    const first = createMessage(ROLES.USER, 'a');
    const second = createMessage(ROLES.USER, 'a');

    expect(first.id).not.toBe(second.id);
  });

  it('accepts a custom createdAt', () => {
    const message = createMessage(ROLES.ASSISTANT, 'x', { createdAt: '2026-01-01T10:00:00.000Z' });
    expect(message.createdAt).toBe('2026-01-01T10:00:00.000Z');
  });
});

describe('createGreeting', () => {
  it('uses the character greeting with the assistant role', () => {
    const greeting = createGreeting(characters[0]);
    expect(greeting.role).toBe(ROLES.ASSISTANT);
    expect(greeting.content).toBe(characters[0].greeting);
  });
});

describe('toApiMessages / buildChatRequest', () => {
  const messages = [
    createMessage(ROLES.ASSISTANT, 'Hola, viajero'),
    createMessage(ROLES.USER, '¿Quién eres?'),
  ];

  it('strips client-only fields and keeps role and content', () => {
    expect(toApiMessages(messages)).toEqual([
      { role: 'assistant', content: 'Hola, viajero' },
      { role: 'user', content: '¿Quién eres?' },
    ]);
  });

  it('builds the payload expected by the serverless function with the full history', () => {
    const payload = buildChatRequest('thor', messages);

    expect(payload.characterId).toBe('thor');
    expect(payload.messages).toHaveLength(2);
    expect(payload.messages.at(-1)).toEqual({ role: 'user', content: '¿Quién eres?' });
  });
});

describe('parseStreamBuffer', () => {
  it('extracts the complete events and keeps the unfinished tail', () => {
    const buffer = 'data: {"delta":"Yo "}\n\ndata: {"delta":"soy"}\n\ndata: {"do';

    expect(parseStreamBuffer(buffer)).toEqual({
      events: [{ delta: 'Yo ' }, { delta: 'soy' }],
      rest: 'data: {"do',
    });
  });

  it('ignores blank lines, comments and malformed JSON', () => {
    const buffer = ': keep-alive\n\ndata: no-es-json\n\ndata: {"done":true}\n\n';

    expect(parseStreamBuffer(buffer).events).toEqual([{ done: true }]);
  });

  it('returns no events while no line is complete', () => {
    expect(parseStreamBuffer('data: {"delta":"ho')).toEqual({ events: [], rest: 'data: {"delta":"ho' });
  });
});

describe('hasUserMessages', () => {
  it('is false when only the greeting exists', () => {
    expect(hasUserMessages([createGreeting(characters[0])])).toBe(false);
  });

  it('is true once the user has written something', () => {
    expect(hasUserMessages([createGreeting(characters[0]), createMessage(ROLES.USER, 'hola')])).toBe(true);
  });
});

describe('formatTimestamp', () => {
  it('formats a valid ISO date as hours and minutes', () => {
    const date = new Date(2026, 0, 1, 9, 5).toISOString();
    expect(formatTimestamp(date)).toMatch(/09:05/);
  });

  it('returns an empty string for invalid dates', () => {
    expect(formatTimestamp('not-a-date')).toBe('');
  });
});
