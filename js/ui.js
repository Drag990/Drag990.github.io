// Interface pieces that work without any library:
// boot sequence, name decrypt, cursor, magnetic buttons, card tilt,
// counters, filters, project modal, copy button, top bar state.

const root = document.documentElement;
export const prefersReduced = () => root.classList.contains('reduced');
export const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------- boot sequence (first visit only, skippable) ---------- */
export function runBoot() {
  return new Promise((resolve) => {
    let seen = false;
    try {
      seen = localStorage.getItem('jma-boot') === '1';
      localStorage.setItem('jma-boot', '1');
    } catch (e) { seen = true; }
    if (seen || prefersReduced()) return resolve(false);

    const lines = [
      ['hi', 'night shift console, starting'],
      ['ok', '[ ok ] pfSense: NET1 web, NET2 attacker, NET3 SIEM'],
      ['ok', '[ ok ] ModSecurity v3 + OWASP CRS loaded'],
      ['ok', '[ ok ] Suricata 8: ET Open rules loaded'],
      ['ok', '[ ok ] Splunk: index=security receiving'],
      ['', '[ .. ] correlating WAF + IDS events'],
      ['hi', '> analyst on shift: Jihad Mohamed Alahiane'],
    ];
    const el = document.createElement('div');
    el.className = 'boot';
    el.setAttribute('role', 'presentation');
    el.innerHTML = '<pre aria-hidden="true"></pre><p class="skip-hint">Press any key to skip</p>';
    document.body.appendChild(el);
    const pre = el.querySelector('pre');

    let i = 0, done = false;
    const timers = [];
    const step = () => {
      if (i >= lines.length) return;
      const [cls, txt] = lines[i++];
      const span = document.createElement('span');
      if (cls) span.className = cls;
      span.textContent = txt + '\n';
      pre.appendChild(span);
      if (i < lines.length) timers.push(setTimeout(step, 190));
      else timers.push(setTimeout(finish, 380));
    };
    const finish = () => {
      if (done) return;
      done = true;
      timers.forEach(clearTimeout);
      window.removeEventListener('keydown', finish);
      el.style.transition = 'opacity .45s ease';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 460);
      resolve(true);
    };
    el.addEventListener('click', finish);
    window.addEventListener('keydown', finish);
    timers.push(setTimeout(step, 120));
  });
}

/* ---------- decrypt / scramble name ---------- */
export function decryptName() {
  const lines = [...document.querySelectorAll('.name-line')];
  if (!lines.length || prefersReduced()) return;
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>=+';
  const rnd = () => glyphs[Math.floor(Math.random() * glyphs.length)];
  const jobs = lines.map((el, li) => ({
    el, text: el.dataset.text || el.textContent,
    start: performance.now() + li * 160,
  }));
  const dur = 900;
  const tick = (now) => {
    let busy = false;
    for (const j of jobs) {
      const p = Math.max(0, (now - j.start) / dur);
      const n = j.text.length;
      const fixed = Math.floor(p * n);
      if (fixed < n) busy = true;
      let html = '';
      for (let i = 0; i < n; i++) {
        html += i < fixed ? j.text[i] : '<span class="g">' + rnd() + '</span>';
      }
      j.el.innerHTML = html;
    }
    if (busy) requestAnimationFrame(tick);
    else jobs.forEach((j) => { j.el.textContent = j.text; });
  };
  requestAnimationFrame(tick);
}

/* ---------- custom cursor ---------- */
export function initCursor() {
  if (!finePointer() || prefersReduced()) return;
  const ring = document.querySelector('.cursor-ring');
  const dot = document.querySelector('.cursor-dot');
  if (!ring || !dot) return;
  root.classList.add('has-cursor');
  let x = -100, y = -100, rx = -100, ry = -100, raf = 0;
  const move = (e) => {
    x = e.clientX; y = e.clientY;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (!raf) raf = requestAnimationFrame(follow);
  };
  const follow = () => {
    rx += (x - rx) * 0.2; ry += (y - ry) * 0.2;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    raf = (Math.abs(x - rx) + Math.abs(y - ry) > 0.3) ? requestAnimationFrame(follow) : 0;
  };
  window.addEventListener('pointermove', move, { passive: true });
  const hoverSel = 'a, button, .card, [tabindex="0"]';
  document.addEventListener('pointerover', (e) => {
    root.classList.toggle('cursor-hover', !!e.target.closest(hoverSel));
  });
  window.addEventListener('pointerdown', () => root.classList.add('cursor-down'));
  window.addEventListener('pointerup', () => root.classList.remove('cursor-down'));
  document.addEventListener('pointerleave', () => { dot.style.transform = ring.style.transform = 'translate3d(-100px,-100px,0)'; });
}

/* ---------- magnetic buttons ---------- */
export function initMagnetic(gsap) {
  if (!finePointer() || prefersReduced()) return;
  document.querySelectorAll('.magnetic').forEach((el) => {
    const strength = el.classList.contains('btn') ? 0.35 : 0.18;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      if (gsap) gsap.to(el, { x: dx * strength, y: dy * strength, duration: 0.4, ease: 'power3.out' });
      else el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
    });
    el.addEventListener('pointerleave', () => {
      if (gsap) gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
      else el.style.transform = '';
    });
  });
}

/* ---------- 3D tilt + domain glow on project cards ---------- */
export function initTilt() {
  if (!finePointer() || prefersReduced()) return;
  document.querySelectorAll('.card').forEach((card) => {
    let raf = 0, ev = null;
    const apply = () => {
      raf = 0;
      const r = card.getBoundingClientRect();
      const px = (ev.clientX - r.left) / r.width;
      const py = (ev.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      card.style.transition = 'border-color .3s, box-shadow .4s';
      card.style.transform = `rotateX(${(0.5 - py) * 7}deg) rotateY(${(px - 0.5) * 9}deg) translateZ(6px)`;
    };
    card.addEventListener('pointermove', (e) => { ev = e; if (!raf) raf = requestAnimationFrame(apply); });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf); raf = 0;
      card.style.transition = 'transform .6s cubic-bezier(.2,.7,.1,1), border-color .3s, box-shadow .4s';
      card.style.transform = '';
    });
  });
}

/* ---------- animated counters ---------- */
export function initCounters() {
  const els = document.querySelectorAll('.count');
  if (prefersReduced() || !('IntersectionObserver' in window)) return;
  els.forEach((el) => { el.textContent = '0'; });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const el = en.target, to = +el.dataset.to, t0 = performance.now(), dur = 1300;
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        el.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  els.forEach((el) => io.observe(el));
}

/* ---------- project filters ---------- */
const DOMAIN_NAMES = { all: 'all domains', soc: 'SOC & detection', grc: 'GRC & IT risk', net: 'Network', ot: 'ICS/OT', cloud: 'Cloud' };

export function initFilters({ onChange } = {}) {
  const buttons = [...document.querySelectorAll('.filter')];
  const cards = [...document.querySelectorAll('#projectGrid .card')];
  const status = document.getElementById('filterStatus');
  const grid = document.getElementById('projectGrid');
  let libs = null; // { gsap, Flip, ScrollTrigger } once loaded
  let current = 'all';
  let tl = null;   // running transition, so a new click can take over cleanly

  // Inline styles a killed Flip / tween can leave behind.
  const RESET = 'opacity,transform,position,top,left,width,height,margin,zIndex,pointerEvents,visibility,display';

  const apply = (f, { silent = false } = {}) => {
    buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === f)));
    const animate = libs && !prefersReduced() && f !== current;
    current = f;
    let state = null, h0 = 0;

    if (animate) {
      const { gsap, Flip } = libs;
      // Capture where everything is right now (also mid-animation), then stop the old transition.
      state = Flip.getState(cards, { props: 'opacity' });
      h0 = grid.offsetHeight;
      if (tl) { tl.kill(); tl = null; }
      gsap.killTweensOf(cards);
      gsap.set(cards, { clearProps: RESET });
      gsap.set(grid, { clearProps: 'height' });
      // The hover tilt leaves a CSS transform transition on cards; it fights GSAP and causes lag.
      cards.forEach((c) => { c.style.transition = 'none'; });
    }

    let shown = 0;
    cards.forEach((c) => {
      const show = f === 'all' || c.dataset.domain === f;
      c.hidden = !show;
      if (show) shown++;
    });

    if (animate) {
      const { gsap, Flip, ScrollTrigger } = libs;
      const h1 = grid.offsetHeight;
      tl = Flip.from(state, {
        duration: 0.62,
        ease: 'power3.inOut',
        absolute: true,
        scale: false,          // never stretch cards: no squashed text
        stagger: 0.025,
        onEnter: (els) => gsap.fromTo(els,
          { opacity: 0, y: 28, scale: 0.97 },
          { opacity: 1, y: 0, scale: 1, duration: 0.55, delay: 0.16, ease: 'power3.out', stagger: 0.06 }),
        onLeave: (els) => gsap.to(els,
          { opacity: 0, y: -10, scale: 0.96, duration: 0.26, ease: 'power2.in' }),
        onComplete: () => {
          gsap.set(grid, { clearProps: 'height' });
          gsap.set(cards, { clearProps: 'transform' });
          cards.forEach((c) => { c.style.transition = ''; });
          tl = null;
          if (ScrollTrigger) ScrollTrigger.refresh();
        },
      });
      // Grow/shrink the grid smoothly so the rest of the page glides instead of jumping.
      tl.fromTo(grid, { height: h0 }, { height: h1, duration: 0.62, ease: 'power3.inOut' }, 0);
    }
    if (status && !silent) status.textContent = `Showing ${shown} project${shown === 1 ? '' : 's'} in ${DOMAIN_NAMES[f]}.`;
    if (onChange) onChange(f);
  };

  buttons.forEach((b) => b.addEventListener('click', () => apply(b.dataset.filter)));

  // hero pyramid layers act as filters too
  document.querySelectorAll('[data-layer]').forEach((a) => {
    a.addEventListener('click', () => apply(a.dataset.layer));
  });

  return {
    apply,
    useLibs(gsap, Flip, ScrollTrigger) { libs = { gsap, Flip, ScrollTrigger }; },
  };
}

/* ---------- project detail modal ---------- */
export function initModal({ onOpen, onClose } = {}) {
  const dlg = document.getElementById('projectModal');
  if (!dlg || typeof dlg.showModal !== 'function') {
    // very old browser: show details inline instead
    root.classList.remove('js');
    return { useGsap() {} };
  }
  const meta = dlg.querySelector('#modalMeta');
  const title = dlg.querySelector('#modalTitle');
  const body = dlg.querySelector('#modalBody');
  const inner = dlg.querySelector('.modal-inner');
  let opener = null, gsap = null;
  const cursorEl = document.querySelector('.cursor');

  const open = (card, btn) => {
    opener = btn;
    dlg.style.setProperty('--dc', getComputedStyle(card).getPropertyValue('--dc'));
    meta.innerHTML = card.querySelector('.card-meta').innerHTML;
    title.textContent = card.querySelector('h3').textContent;
    body.innerHTML = '';
    const sum = card.querySelector('.sum').cloneNode(true);
    sum.classList.add('modal-sum');
    body.appendChild(sum);
    const det = card.querySelector('.detail').cloneNode(true);
    det.style.setProperty('--dc', getComputedStyle(card).getPropertyValue('--dc'));
    body.appendChild(det);
    body.appendChild(card.querySelector('.tags').cloneNode(true));
    dlg.showModal();
    // The dialog lives in the top layer, above the page: carry the custom cursor into it.
    if (cursorEl) dlg.appendChild(cursorEl);
    dlg.scrollTop = 0;
    if (onOpen) onOpen();
    if (gsap && !prefersReduced()) {
      // Animate the inner panel only: a transform on the dialog itself would offset the fixed-position cursor inside it.
      gsap.fromTo(inner, { y: 26, scale: 0.97, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'power3.out', clearProps: 'transform' });
    }
  };
  const close = () => { if (dlg.open) dlg.close(); };

  document.querySelectorAll('.card .open').forEach((btn) => {
    btn.addEventListener('click', () => open(btn.closest('.card'), btn));
  });
  dlg.querySelector('.modal-close').addEventListener('click', close);
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('close', () => {
    if (cursorEl) document.body.appendChild(cursorEl);
    if (onClose) onClose();
    if (opener) opener.focus({ preventScroll: true });
  });

  return { useGsap(g) { gsap = g; } };
}

/* ---------- copy email ---------- */
export function initCopy() {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const txt = btn.dataset.copy;
      let ok = false;
      try { await navigator.clipboard.writeText(txt); ok = true; } catch (e) {
        const ta = document.createElement('textarea');
        ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        try { ok = document.execCommand('copy'); } catch (e2) {}
        ta.remove();
      }
      btn.textContent = ok ? 'Copied' : 'Copy failed';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
  });
}

/* ---------- top bar: solid background + current section ---------- */
export function initNav() {
  const bar = document.querySelector('.topbar');
  const links = [...document.querySelectorAll('.topbar nav a')];
  // Highlight the section under the middle of the screen; nothing while still in the hero / about.
  const targets = links
    .map((a) => ({ a, sec: document.getElementById(a.getAttribute('href').slice(1)) }))
    .filter((t) => t.sec);
  let active = null;
  const update = () => {
    const mid = window.innerHeight * 0.45;
    let cur = null;
    targets.forEach((t) => { if (t.sec.getBoundingClientRect().top <= mid) cur = t.a; });
    // at the very bottom, the last link (Contact) wins even if its section is short
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4 && targets.length) cur = targets[targets.length - 1].a;
    if (cur === active) return;
    active = cur;
    links.forEach((l) => (l === cur ? l.setAttribute('aria-current', 'true') : l.removeAttribute('aria-current')));
  };
  update();
  return (y) => { bar.classList.toggle('solid', y > 30); update(); };
}
