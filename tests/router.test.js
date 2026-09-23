import { describe, expect, it, vi } from 'vitest';
import { matchRoute } from '../src/router/matchRoute.js';
import { getCurrentPath, navigate, subscribe } from '../src/router/history.js';

const Home = () => null;
const Chat = () => null;
const About = () => null;

const routes = [
  { path: '/', view: Home },
  { path: '/home', view: Home },
  { path: '/chat', view: Chat },
  { path: '/chat/:characterId', view: Chat },
  { path: '/about', view: About },
];

describe('matchRoute', () => {
  it.each([
    ['/', Home],
    ['/home', Home],
    ['/home/', Home],
    ['/chat', Chat],
    ['/about', About],
  ])('matches %s to the expected view', (pathname, view) => {
    expect(matchRoute(routes, pathname)?.route.view).toBe(view);
  });

  it('extracts and decodes route params', () => {
    const match = matchRoute(routes, '/chat/peter%20parker');
    expect(match.route.view).toBe(Chat);
    expect(match.params).toEqual({ characterId: 'peter parker' });
  });

  it('returns null for unknown paths', () => {
    expect(matchRoute(routes, '/unknown')).toBeNull();
    expect(matchRoute(routes, '/chat/a/b')).toBeNull();
  });

  it('returns null instead of throwing when a param has malformed percent-encoding', () => {
    expect(() => matchRoute(routes, '/chat/%E0')).not.toThrow();
    expect(matchRoute(routes, '/chat/%E0')).toBeNull();
  });
});

describe('history', () => {
  it('pushes a new entry with pushState and notifies subscribers', () => {
    const pushState = vi.spyOn(window.history, 'pushState');
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    navigate('/about');

    expect(pushState).toHaveBeenCalledWith({ path: '/about' }, '', '/about');
    expect(getCurrentPath()).toBe('/about');
    expect(listener).toHaveBeenCalledWith('/about');
    unsubscribe();
  });

  it('uses replaceState when replace is requested', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');

    navigate('/chat', { replace: true });

    expect(replaceState).toHaveBeenCalledWith({ path: '/chat' }, '', '/chat');
  });

  it('does not push a duplicate entry for the current path', () => {
    navigate('/home');
    const pushState = vi.spyOn(window.history, 'pushState');

    navigate('/home');

    expect(pushState).not.toHaveBeenCalled();
  });

  it('notifies subscribers on popstate (browser back/forward)', () => {
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);

    window.history.pushState({}, '', '/about');
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(listener).toHaveBeenCalledWith('/about');
    unsubscribe();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    subscribe(listener)();

    navigate('/chat');

    expect(listener).not.toHaveBeenCalled();
  });
});
