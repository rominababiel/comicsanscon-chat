const listeners = new Set();
let isListeningPopstate = false;

function notify() {
  listeners.forEach((listener) => listener(getCurrentPath()));
}

function ensurePopstateListener() {
  if (isListeningPopstate) return;
  window.addEventListener('popstate', notify);
  isListeningPopstate = true;
}

export function getCurrentPath() {
  return window.location.pathname;
}

export function navigate(path, { replace = false } = {}) {
  if (path === getCurrentPath()) return;
  const method = replace ? 'replaceState' : 'pushState';
  window.history[method]({ path }, '', path);
  notify();
}

export function subscribe(listener) {
  ensurePopstateListener();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
