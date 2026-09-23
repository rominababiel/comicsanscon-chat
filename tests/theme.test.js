import { describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY, createTheme } from '../src/lib/theme.js';

function mockSystemTheme(dark) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: dark && query === '(prefers-color-scheme: dark)',
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

describe('createTheme', () => {
  it('follows the system theme without saving it as a user choice', () => {
    mockSystemTheme(true);

    const theme = createTheme();

    expect(theme.getTheme()).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('keeps following the system on later loads while the user has not chosen', () => {
    mockSystemTheme(true);
    createTheme();

    mockSystemTheme(false);
    expect(createTheme().getTheme()).toBe('light');
  });

  it('saves the theme only when the user toggles it', () => {
    mockSystemTheme(false);
    const theme = createTheme();

    expect(theme.toggleTheme()).toBe('dark');

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('prefers the saved choice over the system theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    mockSystemTheme(true);

    expect(createTheme().getTheme()).toBe('light');
  });

  it('ignores invalid saved values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    mockSystemTheme(true);

    expect(createTheme().getTheme()).toBe('dark');
  });
});
