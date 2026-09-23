const SVG_NS = 'http://www.w3.org/2000/svg';

const isEnumerated = (name) => name.startsWith('aria-') || name.startsWith('data-');

/**
 * En aria-* y data-* los booleanos se escriben como "true"/"false"; en el
 * resto, true deja el atributo vacío y false lo quita.
 */
export function setAttr(element, name, value) {
  if (value === undefined || value === null || (value === false && !isEnumerated(name))) {
    element.removeAttribute(name);
  } else {
    element.setAttribute(name, value === true && !isEnumerated(name) ? '' : String(value));
  }
}

function appendChildren(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || typeof child === 'boolean') continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

function applyStyle(element, style) {
  for (const [name, value] of Object.entries(style)) {
    if (name.startsWith('--')) element.style.setProperty(name, value);
    else element.style[name] = value;
  }
}

/**
 * Crea un elemento HTML. El texto siempre entra como nodo de texto: nunca se
 * interpreta como HTML, así que el contenido de la IA no puede inyectar marcado.
 */
export function h(tag, { className, attrs, props, style, on } = {}, ...children) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (attrs) for (const [name, value] of Object.entries(attrs)) setAttr(element, name, value);
  if (props) Object.assign(element, props);
  if (style) applyStyle(element, style);
  if (on) for (const [event, handler] of Object.entries(on)) element.addEventListener(event, handler);

  appendChildren(element, children);
  return element;
}

export function svg(tag, attrs = {}, ...children) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) setAttr(element, name, value);
  appendChildren(element, children);
  return element;
}

export function classNames(...names) {
  return names.filter(Boolean).join(' ') || undefined;
}
