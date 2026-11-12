// Extra motion layer. Everything is decorative and optional:
// skipped entirely with reduced motion, and the page reads the same without it.
import { prefersReduced, finePointer } from './ui.js';

const root = document.documentElement;
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>=+';
const rnd = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

/* ---------- 1. section titles decrypt when they scroll in ---------- */
function scrambleTitles() {
  const els = [...document.querySelectorAll('.sec-title, .sec-sub')];
  const run = (el) => {
    const text = el.textContent;
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', text);
    const start = performance.now();
    const dur = 520 + text.length * 22;
    el.classList.add('scrambling');
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const fixed = Math.floor(p * text.length);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        out += i < fixed || ch === ' ' ? ch : rnd();
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(tick);
      else { el.textContent = text; el.classList.remove('scrambling'); }
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      run(en.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  els.forEach((el) => io.observe(el));
}

/* ---------- 2. domain marquee, skews with scroll speed ---------- */
function marquee() {
  const band = document.querySelector('.marquee');
  if (!band) return;
  const track = band.querySelector('.marquee-track');
  // duplicate the content so the loop is seamless
  track.innerHTML += track.innerHTML;
  let x = 0, v = 0, lastY = window.scrollY, raf = 0, on = false, half = track.scrollWidth / 2;
  window.addEventListener('resize', () => { half = track.scrollWidth / 2; });
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const y = window.scrollY;
    const dy = y - lastY; lastY = y;
    v += (dy - v) * 0.12;                      // smoothed scroll velocity
    const dir = v < -0.2 ? -1 : 1;            // scrolling up reverses the band
    x -= (0.6 + Math.min(14, Math.abs(v) * 0.5)) * dir;
    if (x <= -half) x += half;
    if (x > 0) x -= half;
    const skew = Math.max(-12, Math.min(12, -v * 0.35));
    track.style.transform = `translate3d(${x}px,0,0) skewX(${skew}deg)`;
  };
  new IntersectionObserver(([en]) => {
    on = en.isIntersecting;
    cancelAnimationFrame(raf);
    if (on) { lastY = window.scrollY; raf = requestAnimationFrame(loop); }
  }).observe(band);
}

/* ---------- 3. cursor spotlight on a faint grid + HUD readout ---------- */
function spotlight() {
  const hud = document.querySelector('.hud');
  const hx = hud?.querySelector('[data-hud="x"]');
  const hy = hud?.querySelector('[data-hud="y"]');
  let mx = innerWidth / 2, my = innerHeight / 2, raf = 0;
  root.classList.add('has-spot');
  const paint = () => {
    raf = 0;
    root.style.setProperty('--cx', mx + 'px');
    root.style.setProperty('--cy', my + 'px');
    if (hx) {
      hx.textContent = String(Math.round(mx)).padStart(4, '0');
      hy.textContent = String(Math.round(my)).padStart(4, '0');
    }
  };
  window.addEventListener('pointermove', (e) => {
    mx = e.clientX; my = e.clientY;
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
  paint();

  // HUD: live scroll depth in the hero corner
  const depth = hud?.querySelector('[data-hud="d"]');
  if (depth) {
    const upd = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      depth.textContent = String(Math.round((scrollY / max) * 100)).padStart(3, '0');
    };
    window.addEventListener('scroll', upd, { passive: true });
    upd();
  }
}

/* ---------- 4. radar ping where you click ---------- */
function clickPing() {
  window.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('input, textarea, select, dialog')) return;
    const p = document.createElement('span');
    p.className = 'ping';
    p.setAttribute('aria-hidden', 'true');
    p.style.left = e.clientX + 'px';
    p.style.top = e.clientY + 'px';
    p.innerHTML = '<i></i><i></i><b></b>';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1100);
  });
}

/* ---------- 5. contact headline: letters lean toward the cursor ---------- */
function proximityTitle() {
  const h = document.querySelector('.contact-title');
  if (!h) return;
  const text = h.textContent;
  h.setAttribute('aria-label', text);
  h.textContent = '';
  text.split(' ').forEach((w, wi) => {
    if (wi) h.append(' ');
    const word = document.createElement('span');
    word.className = 'pw';
    word.setAttribute('aria-hidden', 'true');
    for (const c of w) {
      const l = document.createElement('span');
      l.className = 'pl';
      l.textContent = c;
      word.append(l);
    }
    h.append(word);
  });
  const letters = [...h.querySelectorAll('.pl')];
  let centers = [], raf = 0, px = -9999, py = -9999, active = false;
  const measure = () => {
    centers = letters.map((l) => {
      const r = l.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2 + scrollY];
    });
  };
  const paint = () => {
    raf = 0;
    letters.forEach((l, i) => {
      const [cx, cy] = centers[i];
      const d = Math.hypot(px - cx, py - (cy - scrollY));
      const k = Math.max(0, 1 - d / 220);
      const e = k * k * (3 - 2 * k);
      l.style.transform = `translateY(${(-e * 14).toFixed(1)}px)`;
      l.style.setProperty('--k', e.toFixed(3));
    });
  };
  new IntersectionObserver(([en]) => { active = en.isIntersecting; if (active) measure(); }).observe(h);
  window.addEventListener('resize', () => active && measure());
  window.addEventListener('pointermove', (e) => {
    if (!active) return;
    px = e.clientX; py = e.clientY;
    if (!raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
  document.fonts?.ready.then(measure);
}

/* ---------- 6. GSAP extras: cards and stats ---------- */
export function initFxScroll({ gsap, ScrollTrigger }) {
  if (prefersReduced()) return;
  ScrollTrigger.batch('.grid .card:not([hidden])', {
    start: 'top 90%', once: true,
    onEnter: (batch) => gsap.fromTo(batch,
      { opacity: 0, y: 46, rotateX: -14, transformOrigin: '50% 100%' },
      { opacity: 1, y: 0, rotateX: 0, duration: 0.75, ease: 'power3.out', stagger: 0.07, clearProps: 'opacity,transform' }),
  });
  // stats cells: a light sweep crosses each one as it appears
  ScrollTrigger.create({
    trigger: '.stats', start: 'top 85%', once: true,
    onEnter: () => document.querySelector('.stats')?.classList.add('swept'),
  });
  // section heads: a scan line runs under each title
  document.querySelectorAll('.sec-title').forEach((t) => {
    ScrollTrigger.create({ trigger: t, start: 'top 85%', once: true, onEnter: () => t.classList.add('scanned') });
  });
}

export function initFx() {
  if (prefersReduced()) {
    root.classList.add('fx-static');
    return;
  }
  scrambleTitles();
  marquee();
  if (finePointer()) {
    spotlight();
    clickPing();
    proximityTitle();
  }
}
