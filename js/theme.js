// Night shift (dark, default) / day shift (light) theme switch.
// The choice is remembered per browser. The switch spreads from the button as a
// circular reveal (View Transitions API); without it, colors cross-fade.
const root = document.documentElement;
const KEY = 'jma-theme';
const listeners = new Set();

export const currentTheme = () => (root.dataset.theme === 'light' ? 'light' : 'dark');
export const onThemeChange = (fn) => { listeners.add(fn); };

function apply(theme) {
  if (theme === 'light') root.dataset.theme = 'light';
  else delete root.dataset.theme;
  try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode: not remembered */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#EEF2F7' : '#050E1D');
  syncButton();
  listeners.forEach((fn) => { try { fn(theme === 'light'); } catch (e) { console.warn(e); } });
}

function syncButton() {
  const btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  const light = currentTheme() === 'light';
  btn.setAttribute('aria-pressed', String(light));
  btn.setAttribute('aria-label', light ? 'Switch to dark theme (night shift)' : 'Switch to light theme (day shift)');
  btn.querySelector('.tt-label').textContent = light ? 'Day' : 'Night';
}

export function initTheme({ reduced = false } = {}) {
  const btn = document.querySelector('.theme-toggle');
  if (!btn) return;
  btn.hidden = false;
  syncButton();

  btn.addEventListener('click', () => {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    const r = btn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    if (reduced) { apply(next); return; }

    if (!document.startViewTransition) {
      root.classList.add('theme-fade');
      apply(next);
      setTimeout(() => root.classList.remove('theme-fade'), 600);
      return;
    }

    root.classList.add('theme-switching');
    const vt = document.startViewTransition(() => apply(next));
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 820, easing: 'cubic-bezier(.7,0,.2,1)', pseudoElement: '::view-transition-new(root)' },
      );
    }).catch(() => {});
    vt.finished.finally(() => root.classList.remove('theme-switching'));
  });
}
