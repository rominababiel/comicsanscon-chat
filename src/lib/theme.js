export const THEME_STORAGE_KEY = 'comicsanscon:theme';
const THEMES = ['light', 'dark'];

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(stored) ? stored : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveInitialTheme() {
  return readStoredTheme() ?? systemTheme();
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function persistTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}

/**
 * Resuelve el tema inicial y lo aplica al documento. Solo se guarda cuando el
 * usuario lo cambia: mientras no elija uno, la app sigue el tema del sistema.
 */
export function createTheme() {
  let theme = resolveInitialTheme();
  applyTheme(theme);

  return {
    getTheme: () => theme,
    isDark: () => theme === 'dark',
    toggleTheme() {
      theme = theme === 'dark' ? 'light' : 'dark';
      applyTheme(theme);
      persistTheme(theme);
      return theme;
    },
  };
}
