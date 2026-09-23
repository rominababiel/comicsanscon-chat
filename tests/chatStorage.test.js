import { describe, expect, it } from 'vitest';
import {
  clearConversation,
  hasSavedConversation,
  loadConversation,
  loadLastCharacterId,
  saveConversation,
  saveLastCharacterId,
} from '../src/features/chat/chatStorage.js';
import { ROLES, createMessage } from '../src/utils.js';

const messages = [createMessage(ROLES.ASSISTANT, 'Hola'), createMessage(ROLES.USER, '¿Qué tal?')];

describe('conversation storage', () => {
  it('returns null when nothing is saved', () => {
    expect(loadConversation('thor')).toBeNull();
    expect(hasSavedConversation('thor')).toBe(false);
  });

  it('round-trips a conversation per character', () => {
    saveConversation('thor', messages);

    expect(loadConversation('thor')).toEqual(messages);
    expect(hasSavedConversation('thor')).toBe(true);
    expect(loadConversation('spider-man')).toBeNull();
  });

  it('clears only the requested character', () => {
    saveConversation('thor', messages);
    saveConversation('spider-man', messages);

    clearConversation('thor');

    expect(loadConversation('thor')).toBeNull();
    expect(loadConversation('spider-man')).toEqual(messages);
  });

  it('ignores corrupted or malformed data', () => {
    localStorage.setItem('comicsanscon:chat:spock', '{not json');
    expect(loadConversation('spock')).toBeNull();

    localStorage.setItem('comicsanscon:chat:spock', JSON.stringify([{ role: 'user' }]));
    expect(loadConversation('spock')).toBeNull();

    localStorage.setItem('comicsanscon:chat:spock', JSON.stringify([]));
    expect(loadConversation('spock')).toBeNull();
  });
});

describe('last character', () => {
  it('remembers the last selected character', () => {
    expect(loadLastCharacterId()).toBeNull();
    saveLastCharacterId('spock');
    expect(loadLastCharacterId()).toBe('spock');
  });
});
