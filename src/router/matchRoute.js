function compilePattern(pattern) {
  const paramNames = [];
  const source = pattern
    .replace(/\/+$/, '')
    .replace(/:([A-Za-z0-9_]+)/g, (_, name) => {
      paramNames.push(name);
      return '([^/]+)';
    });

  return { regex: new RegExp(`^${source || '/'}/?$`), paramNames };
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Devuelve la primera ruta que coincide, o null si ninguna coincide o un param no se puede decodificar. */
export function matchRoute(routes, pathname) {
  for (const route of routes) {
    const { regex, paramNames } = compilePattern(route.path);
    const match = pathname.match(regex);
    if (!match) continue;

    const values = paramNames.map((_, index) => safeDecode(match[index + 1]));
    if (values.includes(null)) return null;

    return { route, params: Object.fromEntries(paramNames.map((name, index) => [name, values[index]])) };
  }

  return null;
}
