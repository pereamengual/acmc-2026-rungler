// THEME — the light/dark switch, and the colours the canvases draw with
//
//   switch (bottom right) ──▶ <html data-theme="light|dark"> ──▶ CSS colours
//                                                            └──▶ canvas colours (read from CSS)
//
// With no choice saved, the page follows the system setting. The choice is remembered in
// this browser only.

const KEY = 'rungler-theme';
let cached = null;

// The colours of the current theme, read from the CSS variables.
export function colors() {
  if (!cached) {
    const style = getComputedStyle(document.documentElement);
    const read = name => style.getPropertyValue(name).trim();
    cached = { ink: read('--ink'), grid: read('--grid'), dim: read('--dim'), line: read('--line'), fade: read('--fade'), panel: read('--panel') };
  }
  return cached;
}

function currentTheme() {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function setupThemeSwitch(button, onChange = () => {}) {
  const show = () => {
    const theme = currentTheme();
    button.textContent = theme === 'dark' ? '☀' : '☾';
    button.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    cached = null;
    onChange(theme);
  };
  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* private mode: the choice lasts this visit */ }
    show();
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', show);
  show();
}
