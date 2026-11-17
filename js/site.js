// One script for every page. The content is complete without it; this only adds motion and the
// interactive pieces. Each part checks that its elements exist, so pages load only what they use.
(function () {
  'use strict';

  var root = document.documentElement;
  var motion = root.classList.contains('motion');
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };

  /* ---------- top bar: more opaque once the page scrolls ---------- */
  var bar = $('.topbar');
  var onScrollFns = [];
  var ticking = false, scrolled = null, lastY = 0;
  function onScroll() {
    // read the position here, in the event, before GSAP writes styles in the next frame
    // (reading it inside the frame forced an extra layout every frame)
    lastY = window.scrollY;
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      var s = lastY > 12;
      if (bar && s !== scrolled) { scrolled = s; bar.classList.toggle('scrolled', s); }
      onScrollFns.forEach(function (fn) { fn(); });
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ---------- mobile menu ---------- */
  var menuBtn = $('.menu-btn');
  var nav = $('#site-nav');
  if (menuBtn && nav) {
    menuBtn.hidden = false;
    var label = $('.menu-label', menuBtn);
    var setOpen = function (open) {
      nav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      label.textContent = open ? 'Close' : 'Menu';
    };
    menuBtn.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); menuBtn.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (nav.classList.contains('open') && !nav.contains(e.target) && !menuBtn.contains(e.target)) setOpen(false);
    });
    window.matchMedia('(min-width: 761px)').addEventListener('change', function (m) { if (m.matches) setOpen(false); });
  }

  /* ---------- ribbon bookmark: fixed under the current page's link ----------
     Without JS (and on phones) the plain underline is used instead. */
  var navLinks = $$('#site-nav a');
  var current = navLinks.filter(function (a) { return a.getAttribute('aria-current') === 'page'; })[0];
  var navBar = $('.topbar-in');
  if (current && navBar) {
    var ribbon = document.createElement('span');
    ribbon.className = 'ribbon';
    ribbon.setAttribute('aria-hidden', 'true');
    navBar.appendChild(ribbon);
    root.classList.add('has-ribbon');
    var place = function () {
      var r = current.getBoundingClientRect(), b = navBar.getBoundingClientRect();
      ribbon.style.left = (r.left - b.left + r.width / 2 - 8).toFixed(1) + 'px';
      ribbon.classList.add('ready');
    };
    place();
    window.addEventListener('resize', place);
    var swung = false;
    var swing = function () {   // data-turn is set by the head script when this page arrived with a page turn
      if (swung || !motion || !root.hasAttribute('data-turn')) return;
      swung = true;
      ribbon.classList.add('swing');
    };
    swing();
    window.addEventListener('pagereveal', swing);
    setTimeout(swing, 60);
    if (document.fonts) document.fonts.ready.then(place);
  }

  /* ---------- reading progress: a thin line along the top of the viewport ---------- */
  var progress = document.createElement('div');
  progress.className = 'read-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progress);
  var docSpan = 1;
  var measure = function () { docSpan = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); };
  measure();
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(document.body);
  onScrollFns.push(function () { progress.style.transform = 'scaleX(' + Math.min(1, lastY / docSpan).toFixed(4) + ')'; });

  /* ---------- scroll reveal ---------- */
  var revealEls = $$('[data-reveal]');
  if (motion && 'IntersectionObserver' in window) {
    // a gentle stagger for siblings that enter together
    revealEls.forEach(function (el) {
      var sibs = $$(':scope > [data-reveal]', el.parentElement);
      el.style.setProperty('--rd', (Math.min(sibs.indexOf(el), 5) * 0.12) + 's');
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- the odd falling leaf (slow, few, paused when the tab is hidden) ---------- */
  var leafBox = $('.leaves');
  if (leafBox && motion) {
    var colors = ['#8DB384', '#A8C3A0', '#E59866', '#D9A04A', '#6E9A5E'];
    var small = window.innerWidth < 640;
    var maxLeaves = small ? 2 : 4;
    var SEED = (function () {             // a pappus: a fan of fine threads on a thin stalk
      var d = 'M10 10V26';
      for (var a = -170; a <= -10; a += 16) {
        var r = a * Math.PI / 180;
        d += 'M10 10L' + (10 + 8 * Math.cos(r)).toFixed(1) + ' ' + (10 + 8 * Math.sin(r)).toFixed(1);
      }
      return '<svg viewBox="0 0 20 28" aria-hidden="true"><path d="' + d + '"/><circle cx="10" cy="26.5" r="1.4"/></svg>';
    })();
    var spawnLeaf = function () {
      if (document.hidden || root.classList.contains('calm') || leafBox.childElementCount >= maxLeaves) return;
      var dur = 16 + Math.random() * 10;
      var el = document.createElement('div');
      el.className = 'leaf';
      el.style.setProperty('--x', (Math.random() * 100) + 'vw');
      el.style.setProperty('--s', (14 + Math.random() * 12) + 'px');
      el.style.setProperty('--dur', dur + 's');
      el.style.setProperty('--wind', ((Math.random() * 2 - 1) * 18) + 'vw');
      el.style.setProperty('--c', colors[Math.floor(Math.random() * colors.length)]);
      el.innerHTML = '<svg viewBox="0 0 24 24"><use href="#leaf"/></svg>';
      if (Math.random() < 0.35) {          // now and then a dandelion seed instead: lighter, slower
        el.className = 'seed';
        el.style.setProperty('--s', (16 + Math.random() * 8) + 'px');
        el.style.setProperty('--dur', (dur * 1.5) + 's');
        el.innerHTML = SEED;
      }
      el.addEventListener('animationend', function (e) { if (e.target === el) el.remove(); });
      leafBox.appendChild(el);
    };
    setTimeout(spawnLeaf, 2500);
    setInterval(spawnLeaf, small ? 9000 : 6000);
  }

  /* ---------- project filters ---------- */
  var filterBtns = $$('.filter');
  var cards = $$('#projectGrid .card');
  var status = $('#filterStatus');
  var NAMES = { all: 'all domains', soc: 'SOC & detection', grc: 'GRC & IT risk', net: 'Network', ot: 'ICS/OT', cloud: 'Cloud' };
  var applyFilter = function (f) {
    var shown = 0;
    filterBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.filter === f)); });
    cards.forEach(function (c) {
      var show = f === 'all' || c.dataset.domain === f;
      c.hidden = !show;
      c.classList.remove('pop');
      if (show) {
        if (motion) { void c.offsetWidth; c.style.setProperty('--k', shown); c.classList.add('pop'); }
        shown++;
      }
    });
    if (status) status.textContent = 'Showing ' + shown + ' project' + (shown === 1 ? '' : 's') + ' in ' + NAMES[f] + '.';
  };
  filterBtns.forEach(function (b) { b.addEventListener('click', function () { applyFilter(b.dataset.filter); }); });

  /* ---------- the whole card opens its project ---------- */
  $$('.card').forEach(function (card) {
    var link = $('.open', card);
    if (!link) return;
    card.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) return;
      if (window.getSelection && String(window.getSelection())) return; // selecting text, not opening
      link.click();
    });
  });

  /* ---------- storybook maps: tooltips, drawing in, and dots along the flows ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  var SPEED = 45;            // px per second: calm
  var startDots = function (svg) {
    var layer = document.createElementNS(NS, 'g');
    layer.setAttribute('class', 'dots');
    var ink = $('.paper-ink', svg);
    ink.insertBefore(layer, $('.n', ink));   // under the cards and labels
    var runs = $$('.e-attack, .e-log', svg).map(function (path, k) {
      // a copy without pathLength, so getPointAtLength works in real units
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('d', path.getAttribute('d'));
      p.setAttribute('visibility', 'hidden');
      layer.appendChild(p);
      var dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', '4');
      dot.setAttribute('class', 'dot ' + (path.classList.contains('e-attack') ? 'dot-attack' : 'dot-log'));
      dot.style.opacity = '0';
      layer.appendChild(dot);
      var len = p.getTotalLength();
      return { p: p, dot: dot, len: len, offset: k * 0.9, cycle: len / SPEED + 1.6 }; // travel time + a pause
    });
    var raf = 0, t0 = 0, stopped = false;
    var frame = function (now) {
      raf = 0;
      if (stopped) return;
      if (document.hidden || root.classList.contains('calm')) { runs.forEach(function (r) { r.dot.style.opacity = '0'; }); return; }
      if (!t0) t0 = now;
      var t = (now - t0) / 1000;
      runs.forEach(function (r) {
        var d = ((t + r.offset) % r.cycle) * SPEED;
        if (d > r.len) { r.dot.style.opacity = '0'; return; }
        var pt = r.p.getPointAtLength(d);
        r.dot.setAttribute('cx', pt.x.toFixed(1));
        r.dot.setAttribute('cy', pt.y.toFixed(1));
        r.dot.style.opacity = String(Math.min(1, d / 30, (r.len - d) / 30) * 0.9); // fade at both ends
      });
      raf = requestAnimationFrame(frame);
    };
    var go = function () { if (!raf && !stopped && !document.hidden) raf = requestAnimationFrame(frame); };
    document.addEventListener('visibilitychange', go);
    document.addEventListener('calmchange', go);     // resumes after 'Pause animations' is turned off
    go();
    return function () {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', go);
      document.removeEventListener('calmchange', go);
      layer.remove();
    };
  };
  var wireTips = function (fig) {
    var frame = $('.dg-frame', fig), tip = $('.dg-tip', fig);
    var hide = function () { tip.hidden = true; };
    var show = function (n) {
      tip.textContent = n.getAttribute('data-tip');
      tip.hidden = false;
      var fr = frame.getBoundingClientRect(), r = n.getBoundingClientRect();
      var w = tip.offsetWidth, h = tip.offsetHeight;
      var x = Math.min(Math.max(r.left - fr.left + r.width / 2 - w / 2, 8), fr.width - w - 8);
      var y = r.bottom - fr.top + 8;
      if (y + h > fr.height - 4) y = Math.max(4, r.top - fr.top - h - 8);
      tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    };
    $$('.n[data-tip]', fig).forEach(function (n) {
      n.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') show(n); });
      n.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && document.activeElement !== n) hide(); });
      n.addEventListener('focus', function () { show(n); });
      n.addEventListener('blur', hide);
      n.addEventListener('click', function () { n.focus(); show(n); });   // a tap on a phone
    });
  };
  // returns a function that stops the dots again
  var showDiagram = function (fig) {
    if (!fig.dataset.wired) { wireTips(fig); fig.dataset.wired = '1'; }
    fig.classList.remove('in');
    void fig.offsetWidth;            // restart the drawing each time the project opens
    fig.classList.add('in');
    if (!motion) return function () {};
    var svg = $$('svg', fig).filter(function (el) { return el.getBoundingClientRect().width > 0; })[0];
    if (!svg) return function () {};
    var last = Math.max.apply(null, $$('[style*="--i"]', svg).map(function (el) { return parseFloat(el.style.getPropertyValue('--i')) || 0; }));
    var stop = null;
    var timer = setTimeout(function () { stop = startDots(svg); }, (last * 0.22 + 1.1) * 1000);
    return function () { clearTimeout(timer); if (stop) stop(); };
  };

  /* ---------- a project's full write-up in a dialog ----------
     Every card links to #id (#soc, #grfics, #aws ...). Without JavaScript the link jumps to the plain write-up
     below the grid; with it the write-up moves into the dialog. Back closes it, and the old ids still work. */
  var dlg = $('#projectModal'), store = $('.pd-store');
  if (dlg && store && typeof dlg.showModal === 'function') {
    var slot = $('.modal-slot', dlg);
    var OLD = { 'soc-lab': 'soc', 'p-soc': 'soc', 'p-ot': 'grfics', 'p-aws': 'aws', 'p-ad': 'ad', 'p-cti': 'cti', 'p-iso': 'iso',
      'p-risk': 'risk', 'p-pa': 'paloalto', 'p-hosp': 'hospital', 'p-az': 'azure' };
    var shown = null, place = null, opener = null, pushed = false, popping = false, stops = [];
    var fromHash = function () {
      var id = decodeURIComponent(location.hash.slice(1));
      id = OLD[id] || id;
      var el = id && document.getElementById(id);
      return el && el.classList.contains('pd') ? el : null;
    };
    var putBack = function () {
      stops.forEach(function (f) { f(); });
      stops = [];
      if (shown) { place.replaceWith(shown); shown = null; }
    };
    var open = function (pd, push) {
      if (shown === pd) return;
      putBack();
      place = document.createComment('');
      pd.before(place);
      slot.appendChild(pd);
      shown = pd;
      dlg.setAttribute('aria-labelledby', pd.id + '-h');
      dlg.classList.toggle('wide', !!$('figure.dg', pd));
      dlg.style.setProperty('--dc', pd.style.getPropertyValue('--dc'));
      if (push) { history.pushState({ pd: pd.id }, '', '#' + pd.id); pushed = true; }
      else if (location.hash !== '#' + pd.id) history.replaceState(history.state, '', '#' + pd.id); // an old id becomes the new one
      root.classList.add('modal-open');
      if (!dlg.open) dlg.showModal();
      dlg.scrollTop = 0;
      $('.modal-close', dlg).focus({ preventScroll: true });
      $$('figure.dg', pd).forEach(function (f) { stops.push(showDiagram(f)); });
    };
    $$('#projectGrid .open').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var pd = document.getElementById(a.getAttribute('href').slice(1));
        if (!pd) return;
        e.preventDefault();
        opener = a;
        open(pd, true);
      });
    });
    $('.modal-close', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });   // the backdrop
    dlg.addEventListener('close', function () {
      putBack();
      root.classList.remove('modal-open');
      if (popping) popping = false;
      else if (pushed) history.back();                                       // the entry the card added
      else history.replaceState(null, '', location.pathname + location.search);
      pushed = false;
      if (opener) opener.focus({ preventScroll: true });
      opener = null;
    });
    window.addEventListener('popstate', function () {
      var pd = fromHash();
      if (pd) { opener = opener || $('#projectGrid .open[href="#' + pd.id + '"]'); open(pd, false); }
      else if (dlg.open) { popping = true; pushed = false; dlg.close(); }
    });
    // arriving with a link like projects.html#grfics opens that project
    var first = fromHash();
    if (first) {
      opener = $('#projectGrid .open[href="#' + first.id + '"]');
      if (opener) opener.closest('.card').scrollIntoView({ block: 'center' });
      open(first, false);
    }
  } else if (store) {
    root.classList.remove('js'); // no dialog support: the write-ups stay on the page as sections
  }

  /* ---------- copy email ---------- */
  $$('[data-copy]').forEach(function (btn) {
    var original = btn.textContent;
    btn.addEventListener('click', function () {
      var txt = btn.dataset.copy;
      var done = function (ok) {
        btn.textContent = ok ? 'Copied' : 'Copy failed';
        setTimeout(function () { btn.textContent = original; }, 2000);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
  });

  /* ---------- About: highlighter sweeps over the key phrases ---------- */
  var aboutText = $('.about-text');
  if (aboutText) {
    if (motion && 'IntersectionObserver' in window) {
      var aio = new IntersectionObserver(function (en) {
        if (en[0].isIntersecting) { setTimeout(function () { aboutText.classList.add('lit'); }, 500); aio.disconnect(); }
      }, { threshold: 0.4 });
      aio.observe(aboutText);
    } else aboutText.classList.add('lit');
  }

  /* ---------- About: without GSAP or with reduced motion, the timeline is simply finished ---------- */
  var timeline = $('.timeline');
  var finishTimeline = function () {
    if (!timeline) return;
    timeline.style.setProperty('--tp', '1');
    $$('.tl', timeline).forEach(function (it) { it.classList.add('lit'); });
  };
  if (timeline && !motion) finishTimeline();

  /* ---------- Pause animations (WCAG 2.2.2) and hidden tabs ----------
     html.calm stops everything that moves on its own (birds, leaves, tree sway, fireflies, clouds, diagram dots).
     The choice is remembered; the head script applies it before the first paint. */
  var calmBtn = $('.calm-btn');
  var isCalm = function () { return root.classList.contains('calm'); };
  if (calmBtn) {
    calmBtn.hidden = false;
    var syncCalm = function () {
      calmBtn.setAttribute('aria-pressed', String(isCalm()));
      calmBtn.title = isCalm() ? 'Play animations' : 'Pause animations';
    };
    syncCalm();
    calmBtn.addEventListener('click', function () {
      var on = !isCalm();
      root.classList.toggle('calm', on);
      try { localStorage.setItem('jma-calm', on ? '1' : '0'); } catch (e) { /* not remembered */ }
      syncCalm();
      document.dispatchEvent(new Event('calmchange'));
    });
  }
  var syncHidden = function () { root.classList.toggle('tab-hidden', document.hidden); };
  document.addEventListener('visibilitychange', syncHidden);
  syncHidden();

  /* ---------- Birds ----------
     Flocks cross the whole window now and then (behind the content); over the header, one or two slow single
     birds glide by after the page opens. No birds under reduced motion; Pause animations hides them. */
  var birdLayer = $('.birds');
  var head = $('.hero') || $('.page-head');
  var headInView = true;
  if (head && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { headInView = en[0].isIntersecting; }).observe(head);
  }
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var phone = window.matchMedia('(max-width: 767px)').matches;
  if (birdLayer && motion) {
    var BIRD = '<svg viewBox="0 0 40 16" aria-hidden="true">' +
      '<path class="bw bw-l" d="M20 8C15.5 2.5 9 1 2 3.6c6.5.3 11.5 2.6 16.4 6.4z"/>' +
      '<path class="bw bw-r" d="M20 8c4.5-5.5 11-7 18-4.4-6.5.3-11.5 2.6-16.4 6.4z"/>' +
      '<ellipse cx="20" cy="9" rx="3.2" ry="1.9"/></svg>';
    var addBird = function (cls, y, dur, del, flap, bob, w) {
      var el = document.createElement('div');
      el.className = 'bird' + cls;
      el.style.setProperty('--y', y.toFixed(0) + 'px');
      el.style.setProperty('--dur', dur.toFixed(2) + 's');
      el.style.setProperty('--del', del.toFixed(2) + 's');
      el.style.setProperty('--flap', flap.toFixed(2) + 's');
      el.style.setProperty('--bob', bob.toFixed(2) + 's');
      el.style.setProperty('--bw', w.toFixed(0) + 'px');
      el.innerHTML = '<div class="bird-bob">' + BIRD + '</div>';
      el.addEventListener('animationend', function (e) { if (e.target === this) this.remove(); });   // gone once off screen
      birdLayer.appendChild(el);
    };
    var flock = function () {
      if (document.hidden || isCalm()) return;
      var n = phone ? Math.round(rnd(2, 3)) : Math.round(rnd(3, 5));
      var baseY = rnd(0.1, 0.6) * window.innerHeight;                      // anywhere in the upper part of the window
      var rtl = Math.random() < 0.25 ? ' rtl' : '';
      var dur = rnd(13, 21);
      for (var i = 0; i < n; i++) {
        var row = Math.ceil(i / 2), side = i % 2 ? 1 : -1;                  // loose V: leader, then pairs behind
        addBird(rtl, baseY + side * row * rnd(10, 18) + rnd(-4, 4), dur * rnd(0.92, 1.08), row * rnd(0.35, 0.6),
          rnd(0.34, 0.5), rnd(2.8, 4.2), phone ? rnd(16, 20) : rnd(20, 28));
      }
    };
    var solo = function () {                                                 // a big, slow bird, high over the header
      if (!headInView || document.hidden || isCalm()) return;
      addBird(' solo' + (Math.random() < 0.3 ? ' rtl' : ''), rnd(0.1, 0.24) * window.innerHeight, rnd(36, 46), 0,
        0.95, 5.5, phone ? 24 : rnd(30, 36));
    };
    var nextFlock = function () {
      setTimeout(function () { flock(); nextFlock(); }, (phone ? rnd(35, 60) : rnd(18, 34)) * 1000);
    };
    setTimeout(function () { flock(); nextFlock(); }, rnd(6, 11) * 1000);
    setTimeout(solo, rnd(3, 6) * 1000);
    if (!phone) setTimeout(solo, rnd(26, 38) * 1000);
  }

  /* ---------- Butterflies: now and then one flutters across the header meadow ---------- */
  if (head && motion) {
    var flutter = document.createElement('div');
    flutter.className = 'flutter';
    flutter.setAttribute('aria-hidden', 'true');
    head.appendChild(flutter);
    var WINGS = ['var(--sunset)', 'var(--dg-glow)', 'var(--sky)', 'var(--d-grc)'];
    var BF = '<svg viewBox="0 0 24 20" aria-hidden="true">' +
      '<path class="bfw bfw-l" d="M12 10C9 3 4 1 2 3s0 7 4 8c-3 1-4 4-2 6s6-1 8-7z"/>' +
      '<path class="bfw bfw-r" d="M12 10c3-7 8-9 10-7s0 7-4 8c3 1 4 4 2 6s-6-1-8-7z"/>' +
      '<path class="bfb" d="M12 6v10M12 6l-2-3M12 6l2-3"/></svg>';
    var butterfly = function () {
      if (!headInView || document.hidden || isCalm() || flutter.childElementCount) return;
      var el = document.createElement('div');
      el.className = 'bf' + (Math.random() < 0.4 ? ' rtl' : '');
      el.style.setProperty('--y', (head.offsetHeight * rnd(0.62, 0.82)).toFixed(0) + 'px');   // low, over the meadow
      el.style.setProperty('--dur', rnd(17, 24).toFixed(1) + 's');
      el.style.setProperty('--bs', (phone ? rnd(18, 22) : rnd(22, 28)).toFixed(0) + 'px');
      el.style.setProperty('--c', WINGS[Math.floor(Math.random() * WINGS.length)]);
      el.innerHTML = '<div class="bf-bob">' + BF + '</div>';
      el.addEventListener('animationend', function (e) { if (e.target === el) el.remove(); });
      flutter.appendChild(el);
    };
    setTimeout(butterfly, rnd(4, 8) * 1000);
    setInterval(butterfly, (phone ? 40 : 22) * 1000);
  }

  /* ---------- a hand-drawn stroke under each section heading ---------- */
  var ULS = ['M3 9c40-5 86-6 130-3s92 4 164-4', 'M2 7c50 3 96 4 146 1s98-5 150 1', 'M4 10c36-6 80-7 124-4 52 3 104 1 168-5'];
  $$('main h2:not(.visually-hidden), .page-head h1').filter(function (h) { return !h.closest('.pd, dialog, .intro'); }).forEach(function (h, i) {
    h.classList.add('has-ul');
    h.insertAdjacentHTML('beforeend', '<svg class="h-ul" viewBox="0 0 300 14" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
      '<path vector-effect="non-scaling-stroke" d="' + ULS[i % ULS.length] + '"/></svg>');
    if (!motion || !('IntersectionObserver' in window)) { h.classList.add('drawn'); return; }
    var uio = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { h.classList.add('drawn'); uio.disconnect(); }
    }, { threshold: 1 });
    uio.observe(h);
  });

  /* ---------- cards lean a little toward the pointer (desktop mouse only) ---------- */
  if (motion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('.card').forEach(function (card) {
      var raf = 0, px = 0.5, py = 0.5;
      var apply = function () {
        raf = 0;
        card.style.transform = 'perspective(900px) rotateX(' + ((0.5 - py) * 5).toFixed(2) + 'deg) rotateY(' + ((px - 0.5) * 6).toFixed(2) + 'deg) translateY(-2px)';
      };
      card.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse' || (card.hasAttribute('data-reveal') && !card.classList.contains('in'))) return;
        card.classList.add('tilting');
        card.style.transition = 'transform 180ms ease-out';
      });
      card.addEventListener('pointermove', function (e) {
        if (!card.classList.contains('tilting')) return;
        var r = card.getBoundingClientRect();
        px = (e.clientX - r.left) / r.width; py = (e.clientY - r.top) / r.height;
        if (!raf) raf = requestAnimationFrame(apply);
      });
      card.addEventListener('pointerleave', function () {
        if (!card.classList.contains('tilting')) return;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        card.classList.remove('tilting');
        card.style.transition = 'transform 600ms cubic-bezier(0.16, 1, 0.3, 1)';
        card.style.transform = '';
      });
    });
  }

  /* ---------- Background music (off by default) ----------
     audio/ambient.mp3, loop, preload none: nothing downloads until the visitor turns it on.
     The button only appears if the file exists. On: 2 s fade in to 0.3. Off: 1 s fade out, then pause.
     The choice is remembered (localStorage); the position carries over to the next page (sessionStorage). */
  var musicBtn = $('.music-btn');
  if (musicBtn && window.fetch && location.protocol !== 'file:') {
    var SRC = 'audio/ambient.mp3', VOL = 0.3;
    var audio = null, fadeRaf = 0, wantOn = false, pendingFade = 2000;
    var store = function (k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* not remembered */ } };
    var read = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
    var getAudio = function () {
      if (!audio) {
        audio = new Audio();
        audio.preload = 'none';
        audio.loop = true;
        audio.src = SRC;
        audio.volume = 0;
        audio.addEventListener('error', function () { musicBtn.hidden = true; });   // the file is missing or broken
        // The UI follows real playback, not the play() promise (which can be interrupted by a seek and retried)
        audio.addEventListener('playing', function () { if (wantOn) { setUi('on'); fade(VOL, pendingFade); } });
      }
      return audio;
    };
    var fade = function (to, ms, done) {
      cancelAnimationFrame(fadeRaf);
      var a = getAudio(), from = a.volume, t0 = performance.now();
      var step = function (t) {
        var p = Math.min(1, (t - t0) / ms);
        a.volume = from + (to - from) * p;
        if (p < 1) fadeRaf = requestAnimationFrame(step); else if (done) done();
      };
      fadeRaf = requestAnimationFrame(step);
    };
    var setUi = function (state) {          // 'on' | 'off' | 'waiting'
      musicBtn.setAttribute('aria-pressed', String(state === 'on'));
      musicBtn.classList.toggle('waiting', state === 'waiting');
      musicBtn.title = state === 'waiting' ? 'Tap to resume background music' : 'Background music';
    };
    var start = function (fadeMs) {
      pendingFade = fadeMs;
      var p = getAudio().play();
      if (p && p.catch) p.catch(function (err) {
        // the browser wants a tap first: show "tap to resume", never an error (other rejections are interruptions)
        if (err && err.name === 'NotAllowedError') setUi('waiting');
      });
    };
    var stop = function () {
      setUi('off');
      if (audio) fade(0, 1000, function () { audio.pause(); });
    };

    // Is there a track? Checked once per browser session (a missing file logs one 404, not one per page).
    var known = null;
    try { known = sessionStorage.getItem('jma-music-file'); } catch (e) { /* check every time */ }
    var probe = known ? Promise.resolve({ ok: known === '1' })
      : fetch(SRC, { method: 'HEAD' }).then(function (r) {
          try { sessionStorage.setItem('jma-music-file', r.ok ? '1' : '0'); } catch (e) { /* ignore */ }
          return r;
        });
    probe.then(function (r) {
      if (!r.ok) return;                       // no track: the button stays hidden
      musicBtn.hidden = false;
      setUi('off');
      if (read('jma-music') === 'on') {        // only when the visitor turned it on before; never on a first visit
        wantOn = true;
        var pos = 0;
        try { pos = parseFloat(sessionStorage.getItem('jma-music-t')) || 0; } catch (e) { /* start from the top */ }
        var a = getAudio();
        if (pos) a.addEventListener('loadedmetadata', function () { try { a.currentTime = pos; } catch (e) { /* ignore */ } }, { once: true });
        start(800);                            // short fade-in when it carries over from the previous page
      }
    }).catch(function () { /* offline or blocked: keep the button hidden */ });

    musicBtn.addEventListener('click', function () {
      if (musicBtn.getAttribute('aria-pressed') === 'true') { wantOn = false; store('jma-music', 'off'); stop(); }
      else { wantOn = true; store('jma-music', 'on'); start(2000); }
    });
    window.addEventListener('pagehide', function () {
      if (audio && wantOn && !audio.paused) { try { sessionStorage.setItem('jma-music-t', String(audio.currentTime)); } catch (e) { /* ignore */ } }
    });
    document.addEventListener('visibilitychange', function () {
      if (!audio || !wantOn) return;
      if (document.hidden) { cancelAnimationFrame(fadeRaf); audio.pause(); }
      else if (musicBtn.getAttribute('aria-pressed') === 'true') { audio.volume = 0; start(1000); }
    });
  }

  /* ---------- Stacked intro (Home, once per session; the head script set intro-on) ----------
     Four big lines rise from behind their masks, hold, lift away, and the hero settles in.
     It starts when the book cover is past halfway (or at once without a cover): under 2.5 s in all. */
  var playIntro = function () {
    if (!root.classList.contains('intro-on')) return;
    root.classList.add('intro-play');
    setTimeout(function () { root.classList.add('intro-out'); }, 1000);
    setTimeout(function () { root.classList.remove('intro-on'); }, 1200);          // the hero copy rises now
    setTimeout(function () { root.classList.remove('intro-play', 'intro-out'); }, 1700);
  };

  /* ---------- Skills ticker: two rows drift in opposite directions; scrolling pushes them faster ---------- */
  var tkRows = $$('.tk-row');
  if (tkRows.length && motion) {
    var tks = tkRows.map(function (row, i) {
      var track = $('.tk-track', row);
      track.innerHTML += track.innerHTML;                 // a second copy makes the loop seamless (aria-hidden)
      return { track: track, dir: i % 2 ? 1 : -1, x: 0, half: 1 };
    });
    var measureTk = function () { tks.forEach(function (t) { t.half = t.track.scrollWidth / 2 || 1; }); };
    measureTk();
    window.addEventListener('resize', measureTk);
    if (document.fonts) document.fonts.ready.then(measureTk);
    var boost = 0, lastTkY = window.scrollY, tkVisible = true, tkRaf = 0, tkLast = 0;
    window.addEventListener('scroll', function () {
      var y = window.scrollY;                               // read in the event, before any writes
      boost = Math.min(900, boost + Math.abs(y - lastTkY) * 6);
      lastTkY = y;
    }, { passive: true });
    var tkFrame = function (t) {
      tkRaf = 0;
      if (!tkVisible || document.hidden || root.classList.contains('calm')) { tkLast = 0; return; }
      var dt = tkLast ? Math.min(0.05, (t - tkLast) / 1000) : 0;
      tkLast = t;
      var speed = 38 + boost;                              // px per second
      boost *= Math.pow(0.04, dt);                         // the push fades within about a second
      tks.forEach(function (k) {
        k.x += k.dir * speed * dt;
        if (k.x <= -k.half) k.x += k.half;
        if (k.x > 0) k.x -= k.half;
        k.track.style.transform = 'translate3d(' + k.x.toFixed(1) + 'px,0,0)';
      });
      tkRaf = requestAnimationFrame(tkFrame);
    };
    tks.forEach(function (k) { if (k.dir > 0) k.x = -k.half / 2; });
    var tkGo = function () { if (!tkRaf && tkVisible && !document.hidden && !root.classList.contains('calm')) tkRaf = requestAnimationFrame(tkFrame); };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { tkVisible = en[0].isIntersecting; tkGo(); }).observe($('.ticker'));
    document.addEventListener('visibilitychange', tkGo);
    document.addEventListener('calmchange', tkGo);
    tkGo();
  }

  /* ---------- Skills wheel: six areas; hover, tap or arrow keys pick one ----------
     The drawing is decorative; real tab buttons (visually hidden) carry keyboard and screen-reader use.
     Without JS every area's list simply shows. */
  var wheel = $('.wheel-grid');
  if (wheel) {
    var segs = $$('.ws', wheel), tabs = $$('.wheel-tabs [role="tab"]', wheel), panels = $$('.wp', wheel);
    $('.wheel-tabs', wheel).hidden = false;
    wheel.classList.add('wheel-ready');
    panels.forEach(function (p) { p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', 'wtab-' + p.id.slice(3)); p.tabIndex = 0; });
    var pick = function (i, focus) {
      segs.forEach(function (g, k) { g.classList.toggle('on', k === i); });
      panels.forEach(function (p, k) { p.classList.toggle('on', k === i); });
      tabs.forEach(function (b, k) { b.setAttribute('aria-selected', String(k === i)); b.tabIndex = k === i ? 0 : -1; });
      if (focus) tabs[i].focus();
    };
    segs.forEach(function (g, i) {
      g.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') pick(i); });
      g.addEventListener('click', function () { pick(i); });
    });
    tabs.forEach(function (b, i) {
      b.addEventListener('click', function () { pick(i); });
      b.addEventListener('focus', function () { pick(i); segs[i].classList.add('kfocus'); });
      b.addEventListener('blur', function () { segs[i].classList.remove('kfocus'); });
      b.addEventListener('keydown', function (e) {
        var n = tabs.length, to = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (i + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (i - 1 + n) % n;
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = n - 1;
        if (to !== null) { e.preventDefault(); pick(to, true); }
      });
    });
    pick(0);
  }

  /* ---------- Living landscape (GSAP + ScrollTrigger, loaded deferred before this file) ----------
     Sky: morning → golden hour → dusk across the page (opacity crossfade, also under reduced motion).
     Hills, clouds and the sun move in depth while you scroll (scrubbed, never pinned or smoothed).
     Fireflies glow only while the footer is on screen. Leaves get a short gust while scrolling.
     Starts once the book cover has opened, so the cover never animates over a moving page. */
  var ff = $('.site-foot');
  if (ff && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { ff.classList.toggle('ff-on', en[0].isIntersecting && motion); }, { rootMargin: '120px 0px 0px 0px' }).observe(ff);
  }

  var startLandscape = function () {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    if (!gsap || !ST) { finishTimeline(); return; }  // CDN unreachable: morning light, a finished timeline, nothing breaks
    gsap.registerPlugin(ST);
    var small = window.matchMedia('(max-width: 767px)').matches;
    var k = small ? 0.5 : 1;                        // phones move half as much
    var page = { trigger: document.documentElement, start: 'top top', end: 'bottom bottom', scrub: 0.5 };

    // 1. time of day + cloud tint (colour, not movement: kept under reduced motion)
    var sky = $('.sky');
    var day = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: page });
    day.to('.st-golden', { opacity: 1, duration: 0.5 }, 0)
       .to('.st-dusk', { opacity: 1, duration: 0.5 }, 0.5);
    if (sky) {
      day.fromTo(sky, { '--cloud': '#FFFDF8' }, { '--cloud': '#FCE8DC', duration: 0.5 }, 0)
         .to(sky, { '--cloud': '#F5D6DC', duration: 0.5 }, 0.5);
    }
    if (birdLayer) {   // birds show a little more against dusk
      day.fromTo(birdLayer, { '--bird-o': 0.34 }, { '--bird-o': 0.4, duration: 0.5 }, 0)
         .to(birdLayer, { '--bird-o': 0.5, duration: 0.5 }, 0.5);
    }

    if (motion) {
      // 2. depth: the hills lag behind the page by different amounts, so on screen the far hills move
      //    slowest and the near hills fastest (they only move down, so no gap can open under them)
      $$('.hills').forEach(function (h) {
        var head = h.parentElement;
        var span = function () { return head.offsetHeight; };
        var layer = function (sel, lag) {
          var el = $(sel, h);
          if (el) gsap.to(el, { y: function () { return span() * lag * k; }, ease: 'none',
            scrollTrigger: { trigger: head, start: 'top top', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true } });
        };
        layer('.hl-far', 0.3);    // on screen the far hills trail the most
        layer('.hl-mid', 0.18);
        layer('.hl-near', 0.07);  // the meadow nearly keeps pace with the page
      });
      if (sky) {
        gsap.to(sky, { y: function () { return -window.innerHeight * 0.45 * k; }, x: 70 * k, ease: 'none',
          scrollTrigger: { trigger: document.documentElement, start: 'top top', end: function () { return '+=' + window.innerHeight * 1.5; }, scrub: 0.5, invalidateOnRefresh: true } });
      }
      // 3. the sun sinks and warms as the hero scrolls away (Home only)
      var portrait = $('.portrait');
      if (portrait) {
        gsap.fromTo(portrait, { '--sun-y': '0px', '--sun-warm': 0 }, { '--sun-y': (120 * k) + 'px', '--sun-warm': 1, ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.5 } });
      }
      // 3b. the paintings drift inside their frames, so each picture has its own depth
      $$('.card-art img').forEach(function (img) {
        img.classList.add('px');
        gsap.fromTo(img, { yPercent: -5 * k }, { yPercent: 5 * k, ease: 'none',
          scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
      });
      var pImg = $('.portrait img');
      if (pImg) gsap.to(pImg, { y: -36 * k, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 } });

      // 4. one breeze: a short sideways gust while scrolling moves the falling leaves and leans the trees
      //    (trees read --gust from their .hills box), then everything settles
      var leaves = $('.leaves');
      var hillBoxes = $$('.hills');
      var gustLeaves = leaves ? gsap.quickTo(leaves, 'x', { duration: 0.9, ease: 'power2.out' }) : null;
      var gustTrees = hillBoxes.length ? gsap.quickTo(hillBoxes, '--gust', { duration: 1.1, ease: 'power2.out' }) : null;
      var gust = function (v) {
        if (root.classList.contains('calm')) v = 0;     // paused animations: no breeze either
        if (gustLeaves) gustLeaves(v);
        if (gustTrees) gustTrees(v);                    // ±28 → about ±3.4° of extra lean
      };
      if (gustLeaves || gustTrees) {
        ST.create({ trigger: document.documentElement, start: 'top top', end: 'bottom bottom',
          onUpdate: function (self) { gust(Math.max(-28, Math.min(28, self.getVelocity() * 0.012 * k))); } });
        ST.addEventListener('scrollEnd', function () { gust(0); });
      }
    }

    // marker highlights take the colour of the current sky (on the two lists that use them)
    var marked = $$('.timeline, .about-text');
    if (marked.length) {
      day.fromTo(marked, { '--mark': '#BCD8AF' }, { '--mark': '#F2BE94', duration: 0.5 }, 0)
         .to(marked, { '--mark': '#CDB9E3', duration: 0.5 }, 0.5);
    }

    // the timeline line grows with scroll
    if (timeline && motion) {
      gsap.fromTo(timeline, { '--tp': 0 }, { '--tp': 1, ease: 'none',
        scrollTrigger: { trigger: timeline, start: 'top 70%', end: 'bottom 55%', scrub: 0.4 } });
    }
    // the scene (wide screens, motion allowed): each painting drifts left to right; the text of the entry
    // in the middle of the screen grows into focus, its key facts get the marker, then it eases out to the right
    if (timeline) {
      var wide = window.matchMedia('(min-width: 761px)').matches;
      $$('.tl', timeline).forEach(function (it) {
        ST.create({ trigger: it, start: 'top 62%', once: true, onEnter: function () { it.classList.add('lit'); } });
        if (!motion || !wide) return;
        var body = $('.tl-body', it), art = $('.tl-art img', it);
        if (art) {
          art.classList.add('px');
          gsap.fromTo(art, { xPercent: -6 }, { xPercent: 6, ease: 'none',
            scrollTrigger: { trigger: it, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
        }
        var scene = gsap.timeline({ defaults: { ease: 'none' },
          scrollTrigger: { trigger: it, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
        scene.fromTo(body, { scale: 0.9, opacity: 0.45, x: -24 }, { scale: 1, opacity: 1, x: 0, duration: 0.5 })
             .to(body, { scale: 0.95, opacity: 0.5, x: 48, duration: 0.5 });
      });
    }

    var refresh = function () { ST.refresh(); };
    window.addEventListener('load', refresh);
    if (document.fonts) document.fonts.ready.then(refresh);
    window.addEventListener('pagereveal', refresh);     // after a page turn (and bfcache restores)
    // lazy images already reserve their space (width/height), so they don't need a refresh each
  };

  // wait for the book cover (Home, first visit) to open before starting
  var coverUp = function () { return root.classList.contains('cover-on') || root.classList.contains('cover-wait'); };
  if (!coverUp()) { playIntro(); startLandscape(); }
  else {
    var mo = new MutationObserver(function () { if (!coverUp()) { mo.disconnect(); playIntro(); startLandscape(); } });
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
  }

  onScroll();
})();
