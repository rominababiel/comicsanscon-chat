import { h, setAttr } from '../../lib/dom.js';
import { createTheme } from '../../lib/theme.js';
import { createIcon } from './icon.js';

export function createThemeToggle() {
  const theme = createTheme();
  const button = h('button', {
    className: 'icon-button theme-toggle',
    attrs: { type: 'button' },
    on: { click: handleClick },
  });

  function render() {
    const isDark = theme.isDark();
    const label = isDark ? 'Activar modo claro' : 'Activar modo oscuro';
    setAttr(button, 'aria-label', label);
    setAttr(button, 'title', label);
    setAttr(button, 'aria-pressed', isDark);
    button.replaceChildren(createIcon(isDark ? 'sun' : 'moon', { size: 20 }));
  }

  function handleClick() {
    theme.toggleTheme();
    render();
  }

  render();
  return button;
}
