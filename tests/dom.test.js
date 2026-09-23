import { describe, expect, it, vi } from 'vitest';
import { classNames, h, setAttr, svg } from '../src/lib/dom.js';

describe('h', () => {
  it('renders strings as text, never as markup', () => {
    const element = h('p', {}, '<img src=x onerror=alert(1)>');

    expect(element.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(element.querySelector('img')).toBeNull();
  });

  it('skips empty children and flattens arrays', () => {
    const element = h('ul', {}, null, false, undefined, [h('li', {}, 'a'), [h('li', {}, 'b')]], 0);

    expect([...element.childNodes].map((node) => node.textContent)).toEqual(['a', 'b', '0']);
  });

  it('applies class, attributes, properties, custom properties and listeners', () => {
    const onClick = vi.fn();
    const element = h('button', {
      className: 'button',
      attrs: { type: 'button', title: undefined },
      props: { disabled: true },
      style: { '--accent': '#fff' },
      on: { click: onClick },
    });

    expect(element).toBeDisabled();
    element.disabled = false;
    element.click();

    expect(element.outerHTML).toBe('<button class="button" type="button" style="--accent: #fff;"></button>');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('omits the class attribute when className is empty', () => {
    expect(h('div', { className: undefined }).hasAttribute('class')).toBe(false);
  });
});

describe('setAttr', () => {
  it('writes booleans as "true"/"false" on aria-* and data-* attributes', () => {
    const element = document.createElement('button');

    setAttr(element, 'aria-pressed', false);
    setAttr(element, 'data-open', true);

    expect(element.getAttribute('aria-pressed')).toBe('false');
    expect(element.getAttribute('data-open')).toBe('true');
  });

  it('treats booleans as presence on regular attributes', () => {
    const element = document.createElement('button');

    setAttr(element, 'disabled', true);
    expect(element.getAttribute('disabled')).toBe('');

    setAttr(element, 'disabled', false);
    expect(element.hasAttribute('disabled')).toBe(false);
  });

  it('removes the attribute for null and undefined', () => {
    const element = document.createElement('a');
    element.setAttribute('aria-current', 'page');

    setAttr(element, 'aria-current', undefined);

    expect(element.hasAttribute('aria-current')).toBe(false);
  });
});

describe('svg', () => {
  it('creates elements in the SVG namespace', () => {
    const icon = svg('svg', { viewBox: '0 0 24 24' }, svg('path', { d: 'M0 0' }));

    expect(icon.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(icon.firstChild.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });
});

describe('classNames', () => {
  it('joins truthy names and returns undefined when empty', () => {
    expect(classNames('a', false, 'b', null)).toBe('a b');
    expect(classNames(false)).toBeUndefined();
  });
});
