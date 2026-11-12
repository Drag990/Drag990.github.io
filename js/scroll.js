// Scroll-driven storytelling with GSAP + ScrollTrigger.
// Everything here is enhancement: the HTML is complete without it.

export function initScroll({ gsap, ScrollTrigger, SplitText, reduced }) {
  const mm = gsap.matchMedia();

  if (reduced) {
    // Calm version: no pinning, no scrubbing. Show the diagram finished.
    document.querySelectorAll('.tl').forEach((t) => t.classList.add('lit'));
    document.querySelectorAll('#socDiagram .badge, .soc-v .badge').forEach((b) => b.classList.add('lit'));
    return;
  }

  /* ---------- hero copy drifts up as the pyramid breaks apart ---------- */
  gsap.to('.hero-inner', {
    yPercent: -14, opacity: 0.3, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.layers, .scroll-cue', {
    opacity: 0, y: -30, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '40% top', scrub: true },
  });

  /* ---------- about: lines rise out of a mask ---------- */
  if (SplitText) {
    document.fonts?.ready.then(() => {
      document.querySelectorAll('.reveal-lines').forEach((p) => {
        const split = SplitText.create(p, { type: 'lines', mask: 'lines', linesClass: 'ln', aria: 'none' });
        gsap.from(split.lines, {
          yPercent: 105, duration: 0.9, ease: 'power3.out', stagger: 0.08,
          scrollTrigger: { trigger: p, start: 'top 85%', once: true },
        });
      });
      ScrollTrigger.refresh();
    });
  }

  /* ---------- featured SOC diagram draws itself ---------- */
  // Two versions of the same diagram: wide (#socDiagram) and a top-to-bottom one for phones (.soc-v).
  const svgH = document.getElementById('socDiagram');
  const svgV = document.querySelector('.soc-v');
  const steps = [...document.querySelectorAll('.steps li')];
  const STEP_COUNT = 7;
  let svg = svgH;   // the diagram currently on screen
  let drawnStep = 0;

  const setStep = (n) => {
    if (n === drawnStep) return;
    drawnStep = n;
    steps.forEach((li) => li.classList.toggle('on', +li.dataset.step === n));
    svg.querySelector('.badge')?.classList.toggle('lit', n >= 6);
  };

  const buildDiagramTimeline = (el) => {
    const badge = el.querySelector('.badge');
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
    for (let n = 1; n <= STEP_COUNT; n++) {
      const at = n - 1;
      const parts = el.querySelectorAll(`[data-step="${n}"]:not(.edge)`);
      const edges = el.querySelectorAll(`.edge[data-step="${n}"]`);
      tl.fromTo(parts, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.05 }, at);
      edges.forEach((e) => {
        const len = e.getTotalLength();
        const dashed = e.classList.contains('plan');
        if (dashed) {
          tl.fromTo(e, { opacity: 0 }, { opacity: 1, duration: 0.6 }, at);
        } else {
          tl.fromTo(e, { strokeDasharray: len, strokeDashoffset: len, opacity: 0 },
            { strokeDashoffset: 0, opacity: 1, duration: 0.7, ease: 'power1.inOut' }, at);
        }
      });
      if (n === 6) {
        tl.fromTo(badge, { scale: 0.85, svgOrigin: badge.dataset.origin || '0 0' },
          { scale: 1, duration: 0.5, ease: 'back.out(3)' }, at);
      }
    }
    tl.to({}, { duration: 0.6 }); // hold on the finished picture
    tl.eventCallback('onUpdate', () => {
      const t = tl.time();
      setStep(t <= 0.02 ? 0 : Math.min(STEP_COUNT, Math.floor(t) + 1));
    });
    return tl;
  };

  // Desktop: pin the section and scrub through the steps.
  mm.add('(min-width: 1001px) and (min-height: 640px)', () => {
    svg = svgH; drawnStep = 0;
    const tl = buildDiagramTimeline(svgH);
    const st = ScrollTrigger.create({
      trigger: '.featured-pin', pin: true, start: 'top top', end: '+=170%', scrub: 0.6,
      animation: tl,
    });
    return () => { st.kill(); tl.kill(); };
  });
  // Tablets and short windows: no pinning, the wide diagram plays once when it comes into view.
  mm.add('(min-width: 641px) and (max-width: 1000px), (min-width: 1001px) and (max-height: 639px)', () => {
    svg = svgH; drawnStep = 0;
    const tl = buildDiagramTimeline(svgH);
    tl.timeScale(1.4);
    const st = ScrollTrigger.create({ trigger: svgH, start: 'top 80%', once: true, onEnter: () => tl.play() });
    return () => { st.kill(); tl.progress(1).kill(); };
  });
  // Phones: the vertical diagram draws itself as you scroll down through it (no pinning, no scroll-jacking).
  mm.add('(max-width: 640px)', () => {
    if (!svgV) return;
    svg = svgV; drawnStep = 0;
    const tl = buildDiagramTimeline(svgV);
    const st = ScrollTrigger.create({
      trigger: svgV, start: 'top 82%', end: 'bottom 72%', scrub: 0.5, animation: tl,
    });
    return () => { st.kill(); tl.progress(1).kill(); };
  });

  /* ---------- traffic packets along the diagram ---------- */
  const path = (name) => svg.querySelector(`[data-path="${name}"]`);
  const ROUTES = [
    { color: 'var(--alert)', paths: ['e-attack', 'e-allowed'], need: 3, blocked: true },
    { color: 'var(--ink)', paths: ['e-attack', 'e-allowed', 'e-clean'], need: 4 },
    { color: 'var(--signal)', paths: ['e-logs'], need: 5 },
  ];
  let pktTimer = 0, pktOn = false;
  const NS = 'http://www.w3.org/2000/svg';
  const spawn = (route) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', '4.5');
    c.style.fill = route.color; // CSS variable, so packets follow the theme
    c.setAttribute('class', 'pkt');
    c.style.filter = `drop-shadow(0 0 4px ${route.color})`;
    const pkLayer = svg.querySelector('.packets');
    if (!pkLayer) return;
    pkLayer.appendChild(c);
    const segs = route.paths.map(path);
    const lens = segs.map((s) => s.getTotalLength());
    const total = lens.reduce((a, b) => a + b, 0);
    const o = { d: 0 };
    gsap.to(o, {
      d: total, duration: total / 190, ease: 'none',
      onUpdate: () => {
        let d = o.d, i = 0;
        while (i < segs.length - 1 && d > lens[i]) { d -= lens[i]; i++; }
        const pt = segs[i].getPointAtLength(Math.min(d, lens[i]));
        c.setAttribute('cx', pt.x); c.setAttribute('cy', pt.y);
      },
      onComplete: () => {
        if (route.blocked) {
          // stopped by the WAF: a short red flash at the WAF edge
          gsap.to(c, { attr: { r: 14 }, opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: () => c.remove() });
        } else {
          gsap.to(c, { opacity: 0, duration: 0.25, onComplete: () => c.remove() });
        }
      },
    });
  };
  let k = 0;
  const pump = () => {
    const avail = ROUTES.filter((r) => drawnStep >= r.need);
    if (avail.length) spawn(avail[k++ % avail.length]);
    pktTimer = setTimeout(pump, 520);
  };
  ScrollTrigger.create({
    trigger: '.featured', start: 'top bottom', end: 'bottom top',
    onToggle: (self) => {
      pktOn = self.isActive;
      clearTimeout(pktTimer);
      if (pktOn) pump();
    },
  });

  /* ---------- experience timeline draws its line ---------- */
  const tlList = document.querySelector('.timeline');
  gsap.fromTo(tlList, { '--tp': 0 }, {
    '--tp': 1, ease: 'none',
    scrollTrigger: { trigger: tlList, start: 'top 70%', end: 'bottom 55%', scrub: 0.4 },
  });
  document.querySelectorAll('.tl').forEach((item) => {
    ScrollTrigger.create({
      trigger: item, start: 'top 68%',
      onEnter: () => item.classList.add('lit'),
      onLeaveBack: () => item.classList.remove('lit'),
    });
  });

  /* ---------- skills assemble into a pyramid, foundation first ---------- */
  const tiers = [...document.querySelectorAll('.tier')].reverse();
  gsap.from(tiers, {
    y: 70, opacity: 0, scaleX: 0.82, duration: 0.8, ease: 'power3.out', stagger: 0.11,
    scrollTrigger: { trigger: '.ziggurat', start: 'top 78%', once: true },
  });

  /* ---------- "currently" items light their top line ---------- */
  gsap.from('.now-list li', {
    opacity: 0, y: 20, duration: 0.6, stagger: 0.08, ease: 'power2.out',
    scrollTrigger: { trigger: '.now-list', start: 'top 82%', once: true },
  });

  return { refresh: () => ScrollTrigger.refresh() };
}
