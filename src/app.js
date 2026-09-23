import { h } from './lib/dom.js';
import { createHeader } from './components/layout/header.js';
import { createFooter } from './components/layout/footer.js';
import { getCurrentPath, subscribe } from './router/history.js';
import { matchRoute } from './router/matchRoute.js';
import { routes } from './router/routes.js';
import { interceptLinks, syncActiveLinks } from './router/links.js';
import { mountNotFoundView } from './views/notFound.js';

const NOT_FOUND_ROUTE = { view: mountNotFoundView, title: 'Página no encontrada' };

/**
 * Monta la SPA: cabecera y pie persistentes, y entre ambos la vista que
 * corresponde a la ruta actual. Una vista solo se vuelve a montar cuando
 * cambia su función o su identidad (`key`): cambiar de personaje remonta el
 * chat, navegar dentro del mismo no. La vista nueva se monta antes de
 * desmontar la anterior, así un error al montar no deja la aplicación sin vista.
 */
export function startApp(root) {
  const header = createHeader();
  const footer = createFooter();
  const shell = h('div', { className: 'app' }, header, footer);
  root.append(shell);

  let current = null;

  function render(pathname) {
    const match = matchRoute(routes, pathname);
    const route = match?.route ?? NOT_FOUND_ROUTE;
    const params = match?.params ?? {};
    const key = route.key?.(params) ?? '';

    if (current?.route.view !== route.view || current.key !== key) {
      const mounted = route.view(params);
      const previous = current;

      footer.before(mounted.element);
      current = { route, key, mounted };

      previous?.mounted.element.remove();
      previous?.mounted.destroy();
    }

    document.title = `ComicSansCon · ${route.title}`;
    syncActiveLinks(shell, pathname);
  }

  const unsubscribe = subscribe(render);
  const stopIntercepting = interceptLinks(shell);
  render(getCurrentPath());

  return function destroy() {
    unsubscribe();
    stopIntercepting();
    current?.mounted.destroy();
    shell.remove();
    current = null;
  };
}
