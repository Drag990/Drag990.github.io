// Entry point. Content is already in the HTML; this file only adds motion.
import {
  runBoot, decryptName, initCursor, initMagnetic, initTilt, initCounters,
  initFilters, initModal, initCopy, initNav, prefersReduced, finePointer,
} from './ui.js';
import { initTheme, onThemeChange } from './theme.js';
import { initFx, initFxScroll } from './fx.js';

const root = document.documentElement;
const reduced = prefersReduced();
const coarse = window.matchMedia('(pointer: coarse)').matches;
const small = window.innerWidth < 760 || coarse;

let scene = null;
let lenis = null;

/* ---------- 1. things that need no library ---------- */
const setBarSolid = initNav();
initCopy();
initCounters();
initCursor();
initTilt();
initTheme({ reduced });
initFx();
const filters = initFilters({ onChange: (f) => scene && scene.focus(f) });
const modal = initModal({
  onOpen: () => lenis && lenis.stop(),
  onClose: () => lenis && lenis.start(),
});

/* ---------- 2. boot sequence while libraries load ---------- */
const boot = runBoot();

/* ---------- 3. 3D scene (only if WebGL works) ---------- */
function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

const scenePromise = hasWebGL()
  ? import('./scene.js')
    .then((m) => {
      scene = m.createScene(document.getElementById('scene'), { reduced, small });
      root.classList.add('webgl');
      onThemeChange((light) => scene.setTheme(light));
      if (location.search.includes('debug')) window.__scene = scene; // for local testing only
      return scene;
    })
    .catch((err) => { console.warn('3D scene disabled:', err); return null; })
  : Promise.resolve(null);

// About: 3D knight, desktop only (wide screen + mouse). Loaded after the hero scene.
const knightCanvas = document.getElementById('knight');
if (knightCanvas && window.matchMedia('(min-width: 1001px) and (hover: hover) and (pointer: fine)').matches) {
  scenePromise.then((s) => {
    if (!s) return; // no WebGL: nothing to show
    return import('./knight.js').then((m) => {
      const knight = m.createKnight(knightCanvas, { reduced });
      onThemeChange((light) => knight && knight.setTheme(light));
    });
  }).catch((err) => console.warn('Knight disabled:', err));
}

/* ---------- 3b. world attack map in the background (loads after the page is up) ---------- */
const mapCanvas = document.getElementById('worldmap');
if (mapCanvas) {
  const loadMap = () => import('./worldmap.js')
    .then((m) => m.initWorldMap(mapCanvas))
    .catch((err) => console.warn('Attack map disabled:', err));
  if ('requestIdleCallback' in window) requestIdleCallback(loadMap, { timeout: 1500 });
  else setTimeout(loadMap, 600);
}

/* ---------- 4. scroll-linked values (work with or without GSAP) ---------- */
const hero = document.querySelector('.hero');
const bar = document.querySelector('.progress');
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
let ticking = false;
function onScroll() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = window.scrollY;
    const heroH = hero.offsetHeight || window.innerHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const p = y / heroH;
    root.style.setProperty('--veil', (smooth(0.08, 0.85, p) * 0.97).toFixed(3));
    bar.style.setProperty('--sp', (y / max).toFixed(4));
    setBarSolid(y);
    if (scene) {
      if (!reduced) {
        scene.setHero(p / 1.1);
        scene.setPage(y / max);
      }
      scene.setHeroVisible(y < heroH * 1.05);
    }
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll);
onScroll();

/* ---------- 5. pointer → camera parallax ---------- */
if (!reduced && finePointer()) {
  window.addEventListener('pointermove', (e) => {
    if (!scene) return;
    scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  }, { passive: true });
}

/* ---------- 6. GSAP, ScrollTrigger, Flip, SplitText, Lenis ---------- */
async function loadMotion() {
  const [{ gsap }, { ScrollTrigger }, { Flip }, split] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger.js'),
    import('gsap/Flip.js'),
    import('gsap/SplitText.js').catch(() => null),
  ]);
  const SplitText = split && split.SplitText;
  gsap.registerPlugin(ScrollTrigger, Flip, ...(SplitText ? [SplitText] : []));

  filters.useLibs(gsap, Flip, ScrollTrigger);
  modal.useGsap(gsap);
  initMagnetic(gsap);

  // Smooth scrolling on desktop only, never with reduced motion.
  if (!reduced && !coarse) {
    try {
      const { default: Lenis } = await import('lenis');
      lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      if (location.search.includes('debug')) window.__lenis = lenis; // for local testing only
    } catch (e) { lenis = null; }
  }

  // In-page links: smooth scroll and move keyboard focus to the target.
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target && id !== 'top') return;
    e.preventDefault();
    const dest = target || document.body;
    if (lenis) lenis.scrollTo(id === 'top' ? 0 : dest, { offset: id === 'top' ? 0 : -64, duration: 1.3 });
    else window.scrollTo({ top: id === 'top' ? 0 : dest.getBoundingClientRect().top + window.scrollY - 64, behavior: reduced ? 'auto' : 'smooth' });
    if (target) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
    history.replaceState(null, '', '#' + id);
  });

  const { initScroll } = await import('./scroll.js');
  initScroll({ gsap, ScrollTrigger, SplitText, reduced });
  initFxScroll({ gsap, ScrollTrigger });
  window.addEventListener('load', () => ScrollTrigger.refresh());
  return gsap;
}

const motion = loadMotion().catch((err) => { console.warn('Motion libraries unavailable:', err); return null; });

/* ---------- 7. hero entrance after the boot screen ---------- */
Promise.all([boot, scenePromise]).then(([booted, sc]) => {
  if (sc && booted) sc.replayIntro();
  decryptName();
});
