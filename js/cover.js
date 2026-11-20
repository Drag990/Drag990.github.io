// Home only: an old wooden door standing in the woods at night. It opens once per browser session,
// warm light spills out, and the scene fades into the site (about 2 s, kept deliberately still).
// The inline script in <head> decides whether to show it (first visit this session, motion allowed)
// and sets html.cover-wait, which paints a plain forest-coloured screen so the page never flashes.
// This deferred script builds the real scene over it. (A blocking script in <body> would have
// switched off the page-turn view transition into Home, so this stays deferred.)
// The name sits above the door, never under it; the hero starts as the scene fades. The page stays
// in the DOM underneath; focus is never moved or trapped. All drawings are original.
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('cover-wait')) return;        // no cover this time, or the safety timer already showed the page

  var small = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  var K = small ? 0.8 : 1;                                    // phones run a little faster; CSS reads --k
  var FADE_AT = 800 * K, END = 1300 * K;                      // ms, match the CSS timings

  // a fixed pseudo-random sequence, so the forest looks the same on every visit
  var seed = 7;
  var rnd = function (a, b) { seed = (seed * 16807) % 2147483647; return a + (b - a) * (seed / 2147483647); };
  var f = function (n) { return n.toFixed(1); };

  // a pine: three stacked tiers (little pyramids) on a short trunk
  function pine(x, base, h, w) {
    var d = 'M' + f(x - w * 0.025) + ' ' + base + 'h' + f(w * 0.05) + 'v' + f(-h * 0.16) + 'h' + f(-w * 0.05) + 'z';
    for (var i = 0; i < 3; i++) {
      var top = base - h + i * h * 0.24, bot = top + h * 0.42, hw = w * (0.24 + i * 0.13);
      d += 'M' + f(x) + ' ' + f(top) + 'L' + f(x + hw) + ' ' + f(bot) + 'L' + f(x - hw) + ' ' + f(bot) + 'Z';
    }
    return d;
  }
  function forest(cls, fill, step, hMin, hMax, base) {
    var d = '';
    for (var x = -40; x < 1660; x += step * rnd(0.6, 1.25)) {
      var h = rnd(hMin, hMax);
      d += pine(x, base + rnd(-8, 8), h, h * rnd(0.42, 0.55));
    }
    return '<svg class="wd-trees ' + cls + '" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice"><path fill="' + fill + '" d="' + d + '"/></svg>';
  }

  // a cobweb in a corner: spokes from (cx, cy) between two angles, rings sagging toward the centre
  function web(cx, cy, r, a0, a1) {
    var n = 7, rings = [0.24, 0.42, 0.6, 0.78, 0.96], d = '';
    var pt = function (rr, a) { a = a * Math.PI / 180; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; };
    for (var i = 0; i < n; i++) { var p = pt(r, a0 + (a1 - a0) * i / (n - 1)); d += 'M' + cx + ' ' + cy + 'L' + f(p[0]) + ' ' + f(p[1]); }
    rings.forEach(function (k) {
      for (var j = 0; j < n - 1; j++) {
        var aA = a0 + (a1 - a0) * j / (n - 1), aB = a0 + (a1 - a0) * (j + 1) / (n - 1);
        var A = pt(r * k, aA), B = pt(r * k, aB), C = pt(r * k * 0.84, (aA + aB) / 2);
        d += 'M' + f(A[0]) + ' ' + f(A[1]) + 'Q' + f(C[0]) + ' ' + f(C[1]) + ' ' + f(B[0]) + ' ' + f(B[1]);
      }
    });
    return '<path class="wd-web" d="' + d + '"/>';
  }

  // ivy leaves along a list of [x, y, angle, size]
  function ivy(list) {
    return list.map(function (l, i) {
      return '<path d="M0 0C2-3.2 6.4-3.2 7.6 0C6.4 3.2 2 3.2 0 0Z" fill="' + (i % 3 ? '#2F4C2B' : '#41643A') + '" transform="translate(' + l[0] + ' ' + l[1] + ') rotate(' + l[2] + ') scale(' + l[3] + ')"/>';
    }).join('');
  }

  // gold, wood and stone fills, the grain filters, a pyramid stud and the engraved "tattoo" ornament.
  // Shared by every SVG below (ids are document-wide). Colours follow the --wood tokens.
  var defs =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
      '<linearGradient id="wd-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF1B5"/><stop offset=".35" stop-color="#E8C25E"/><stop offset=".6" stop-color="#A97C27"/><stop offset=".8" stop-color="#F3D27A"/><stop offset="1" stop-color="#8F6420"/></linearGradient>' +
      '<linearGradient id="wd-post" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5E3D22"/><stop offset=".35" stop-color="#6E4828"/><stop offset=".75" stop-color="#43291A"/><stop offset="1" stop-color="#26170C"/></linearGradient>' +
      '<linearGradient id="wd-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7C5332"/><stop offset=".5" stop-color="#55361D"/><stop offset="1" stop-color="#2C1A0D"/></linearGradient>' +
      '<linearGradient id="wd-gable" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5A3A20"/><stop offset="1" stop-color="#3A2413"/></linearGradient>' +
      '<linearGradient id="wd-stone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7A7466"/><stop offset=".3" stop-color="#5E594E"/><stop offset="1" stop-color="#36332C"/></linearGradient>' +
      '<radialGradient id="wd-flame" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#FFF6D8"/><stop offset=".45" stop-color="#FFD27A"/><stop offset="1" stop-color="#D9822F"/></radialGradient>' +
      '<filter id="wd-grain-v" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.03" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 .1 0 0 0 0 .05 0 0 0 0 .02 1.3 0 0 0 -.42"/><feComposite in2="SourceGraphic" operator="in"/></filter>' +
      '<filter id="wd-grain-h" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.03 0.9" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 .1 0 0 0 0 .05 0 0 0 0 .02 1.3 0 0 0 -.42"/><feComposite in2="SourceGraphic" operator="in"/></filter>' +
      // a gold pyramid stud seen from above, lit from the top left (unit size, scale when used)
      '<g id="wd-stud"><path d="M-1-1H1L0 0Z" fill="#FFF1B5"/><path d="M-1-1V1L0 0Z" fill="#E8C25E"/><path d="M1-1V1L0 0Z" fill="#9C7024"/><path d="M-1 1H1L0 0Z" fill="#6E4C14"/></g>' +
      // the tattoo: a small pyramid, vine scrolls and circuit traces ending in solder dots (100 x 100)
      '<g id="wd-orn" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="3.2">' +
        '<path d="M50 8L61 27L50 46L39 27Z"/><path d="M50 17L56 27L50 37L44 27Z" stroke-width="2"/>' +
        '<path d="M61 27C75 22 86 33 79 43C74 50 64 47 67 40C69 36 74 38 72 42M39 27C25 22 14 33 21 43C26 50 36 47 33 40C31 36 26 38 28 42"/>' +
        '<path d="M50 46V89M50 58H63L70 65M50 58H37L30 65M50 72L62 83M50 72L38 83"/>' +
        '<path d="M64 50C70 47 75 51 73 56C68 57 65 54 64 50ZM36 50C30 47 25 51 27 56C32 57 35 54 36 50Z"/>' +
        '<circle cx="70" cy="65" r="2.4"/><circle cx="30" cy="65" r="2.4"/><circle cx="62" cy="83" r="2.4"/><circle cx="38" cy="83" r="2.4"/><circle cx="50" cy="92" r="3"/>' +
      '</g>' +
    '</defs></svg>';

  // ---- the door face: one drawing in door units (100 x 170), shown half by each door ----
  var panels = [[7, 10, 36, 68], [57, 10, 36, 68], [7, 92, 36, 68], [57, 92, 36, 68]];
  var faceSvg = '<svg viewBox="0 0 100 170" preserveAspectRatio="none">';
  panels.forEach(function (p, i) {
    var x = p[0], y = p[1], w = p[2], h = p[3], cx = x + w / 2, cy = y + h / 2;
    faceSvg +=
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="#140A03" fill-opacity=".2"/>' +
      '<path d="M' + x + ' ' + (y + h) + 'V' + y + 'H' + (x + w) + '" fill="none" stroke="#000" stroke-opacity=".6" stroke-width=".9"/>' +
      '<path d="M' + (x + w) + ' ' + y + 'V' + (y + h) + 'H' + x + '" fill="none" stroke="#FFD9A0" stroke-opacity=".2" stroke-width=".9"/>' +
      '<path d="M' + (x + 3) + ' ' + (y + h - 3) + 'V' + (y + 3) + 'H' + (x + w - 3) + '" fill="none" stroke="#FFD9A0" stroke-opacity=".16" stroke-width=".7"/>' +
      '<path d="M' + (x + w - 3) + ' ' + (y + 3) + 'V' + (y + h - 3) + 'H' + (x + 3) + '" fill="none" stroke="#000" stroke-opacity=".45" stroke-width=".7"/>' +
      // engraved gold tattoo: a dark cut first, the gold inlay on top (lower panels are mirrored)
      '<use href="#wd-orn" stroke="#120802" stroke-opacity=".75" transform="translate(' + (cx - 14.5) + ' ' + (i < 2 ? cy - 14 : cy + 16) + ') scale(.3 ' + (i < 2 ? '.3' : '-.3') + ')"/>' +
      '<use href="#wd-orn" stroke="url(#wd-gold)" transform="translate(' + (cx - 15) + ' ' + (i < 2 ? cy - 15 : cy + 15) + ') scale(.3 ' + (i < 2 ? '.3' : '-.3') + ')"/>';
    // gold corner fittings on each panel
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(function (c) {
      faceSvg += '<path d="M0 0h6.5v1.7H1.7v4.8H0z" fill="url(#wd-gold)" stroke="#5A3D0E" stroke-width=".25" transform="translate(' + c[0] + ' ' + c[1] + ') scale(' + c[2] + ' ' + c[3] + ')"/>';
    });
  });
  // strap hinges on the outer edges, with nails
  [16, 150].forEach(function (y) {
    [[0, 1], [100, -1]].forEach(function (s) {
      faceSvg += '<g transform="translate(' + s[0] + ' ' + y + ') scale(' + s[1] + ' 1)">' +
        '<path d="M0-2.4H25L31 0L25 2.4H0Z" fill="url(#wd-gold)" stroke="#5A3D0E" stroke-width=".35"/>' +
        '<circle cx="4" cy="0" r=".8" fill="#4A3008"/><circle cx="12" cy="0" r=".8" fill="#4A3008"/><circle cx="20" cy="0" r=".8" fill="#4A3008"/></g>';
    });
  });
  // ring pulls by the seam
  [45, 55].forEach(function (x) {
    faceSvg +=
      '<circle cx="' + (x + 0.5) + '" cy="89.6" r="3.7" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="1.2"/>' +
      '<circle cx="' + x + '" cy="84" r="2.3" fill="url(#wd-gold)" stroke="#5A3D0E" stroke-width=".3"/>' +
      '<circle cx="' + x + '" cy="88.6" r="3.7" fill="none" stroke="url(#wd-gold)" stroke-width="1.15"/>';
  });
  faceSvg += '</svg>';
  var face = '<div class="door-face">' + faceSvg + '</div>';

  // ---- the frame around the doors (door units: the opening is 0..100 x 0..170) ----
  var gableTri = function (y) { var t = (-16 - y) / 34 * 40; return [10 + t, 90 - t]; };
  var layers = [-24, -32, -40].map(function (y) { var e = gableTri(y); return 'M' + f(e[0]) + ' ' + y + 'H' + f(e[1]); }).join('');
  var frame =
    '<svg class="wd-frame" viewBox="-30 -66 160 250">' +
      // stone step with moss
      '<path d="M-17 168h134q3 0 3 3v8q0 2-2 2h-136q-2 0-2-2v-8q0-3 3-3z" fill="url(#wd-stone)"/>' +
      '<path d="M-16 168.6h132" stroke="#B9B2A0" stroke-opacity=".45" stroke-width=".7"/>' +
      '<path d="M-15 168c3-3 6-2 8 0s5-3 8 0 4-2 6 0zM96 168c2-2 5-3 7 0s4-2 7 0z" fill="#3E5E36"/>' +
      // posts, with grain, gold corner fittings top and bottom
      '<rect x="-11" y="-2" width="11" height="172" fill="url(#wd-post)"/><rect x="-11" y="-2" width="11" height="172" filter="url(#wd-grain-v)"/>' +
      '<rect x="100" y="-2" width="11" height="172" fill="url(#wd-post)"/><rect x="100" y="-2" width="11" height="172" filter="url(#wd-grain-v)"/>' +
      '<path d="M-11 0h11v3h-8v8h-3zM111 0h-11v3h8v8h3zM-11 168h11v-3h-8v-8h-3zM111 168h-11v-3h8v-8h3z" fill="url(#wd-gold)" stroke="#5A3D0E" stroke-width=".3"/>' +
      // lintel beam and its shadow on the doors
      '<path d="M-22-12H122L120 0H-20Z" fill="url(#wd-beam)"/><path d="M-22-12H122L120 0H-20Z" filter="url(#wd-grain-h)"/>' +
      '<path d="M-21.5-11.4H121.5" stroke="#C99A64" stroke-opacity=".45" stroke-width=".6"/>' +
      '<use href="#wd-stud" transform="translate(-14 -6) scale(2.6)"/><use href="#wd-stud" transform="translate(114 -6) scale(2.6)"/>' +
      '<use href="#wd-stud" transform="translate(30 -6) scale(1.8)"/><use href="#wd-stud" transform="translate(70 -6) scale(1.8)"/>' +
      // the gable: a wooden pyramid with a layered gold pyramid inlaid (defence in depth, governance on top)
      '<path d="M-18-12L50-58L118-12Z" fill="url(#wd-gable)"/><path d="M-18-12L50-58L118-12Z" filter="url(#wd-grain-v)"/>' +
      '<path d="M50-58L118-12H50Z" fill="#000" fill-opacity=".22"/>' +
      '<path d="M-18-12L50-58L118-12" fill="none" stroke="#1A0E05" stroke-width="2.6" transform="translate(.5 .8)"/>' +
      '<path d="M-18-12L50-58L118-12" fill="none" stroke="url(#wd-gold)" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<g transform="translate(.4 .6)" stroke="#120802" stroke-opacity=".7" fill="none" stroke-width="1.4"><path d="M10-16L50-50L90-16Z"/><path d="' + layers + '"/></g>' +
      '<path d="M50-50L61.8-40H38.2Z" fill="url(#wd-gold)"/>' +
      '<g stroke="url(#wd-gold)" fill="none" stroke-width="1.4" stroke-linejoin="round"><path d="M10-16L50-50L90-16Z"/><path d="' + layers + '"/></g>' +
      '<use href="#wd-stud" transform="translate(50 -61) scale(2.2)"/>' +
      // ivy over the left of the frame, and along the beam
      '<path d="M-19-9C-25 8-13 26-18 44C-21 58-13 70-16 88M-20-11C-6-4 8-10 24-5" fill="none" stroke="#2A3F24" stroke-width=".9"/>' +
      ivy([[-19, -6, 200, 1.1], [-21, 4, 150, 1.2], [-17, 12, 20, 1], [-22, 22, 170, 1.3], [-15, 30, 30, 1.1], [-19, 40, 190, 1.2], [-15, 50, 10, 1], [-18, 61, 160, 1.1], [-14, 71, 25, 0.9], [-17, 82, 180, 1], [-10, -8, 300, 1], [-2, -6, 60, 1.1], [8, -9, 290, 0.9], [16, -6, 70, 1], [23, -5, 20, 0.8]]) +
      // cobwebs: the inside top-left corner of the doorway, and under the right end of the beam
      web(0, 0, 21, 0, 90) + web(111, 0, 9, 0, 90) +
      // the lantern on the right end of the beam: a gold pyramid cap over warm glass
      '<path d="M115 0V9" stroke="#2B2620" stroke-width=".8" stroke-dasharray="1.2 .6"/>' +
      '<rect class="wd-flame" x="110.4" y="15" width="9.2" height="14" fill="url(#wd-flame)"/>' +
      '<path d="M110 15V29M115 15V29M120 15V29" stroke="url(#wd-gold)" stroke-width=".9"/>' +
      '<path d="M108.6 15.4L115 8.6L121.4 15.4Z" fill="url(#wd-gold)" stroke="#5A3D0E" stroke-width=".3"/>' +
      '<path d="M108.6 29h12.8l-1.6 3h-9.6z" fill="url(#wd-gold)" stroke="#5A3D0E" stroke-width=".3"/>' +
    '</svg>';


  var book = document.createElement('div');
  book.className = 'book' + (small ? ' book-small' : '');
  book.style.setProperty('--k', K);
  book.innerHTML = defs +
    '<div class="wd-scene" aria-hidden="true">' +
      '<div class="wd-sky"></div><div class="wd-moon"></div>' +
      forest('wd-far', '#1A3533', 62, 170, 300, 742) +
      forest('wd-mid', '#0F2124', 120, 300, 480, 772) +
      '<div class="wd-ground"></div>' +
      '<div class="wd-spill"></div>' +
      '<div class="wd-door">' +
        '<div class="wd-cast"></div>' +
        '<div class="wd-hole"><div class="door door-l">' + face + '</div><div class="door door-r">' + face + '</div></div>' +
        frame +
        '<div class="wd-glow"></div>' +
      '</div>' +
      '<div class="wd-vig"></div>' +
      '<div class="wd-title"><p class="wd-name">Jihad Mohamed Alahiane</p><p class="wd-sub">Cybersecurity engineer, portfolio</p></div>' +
    '</div>' +
    '<button type="button" class="book-skip">Skip intro</button>';
  document.body.appendChild(book);
  root.classList.remove('cover-wait');                       // the real scene now sits over the page

  var opened = false, removed = false, timers = [];

  function cleanup() {
    if (removed) return;
    removed = true;
    timers.forEach(clearTimeout);
    window.removeEventListener('keydown', onKey, true);
    root.classList.remove('cover-on');
    book.remove();
  }
  function open() {
    if (opened) return;
    opened = true;
    book.classList.add('open');
    timers.push(setTimeout(function () { root.classList.remove('cover-on'); }, FADE_AT));   // the hero rises as the light fades
    book.addEventListener('animationend', function (e) { if (e.target === book) cleanup(); });
    timers.push(setTimeout(cleanup, END + 500));               // in case animationend never fires
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); cleanup(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  }

  window.addEventListener('keydown', onKey, true);
  book.querySelector('.book-skip').addEventListener('click', function (e) { e.stopPropagation(); cleanup(); });   // skip: straight to the page
  book.addEventListener('click', open);                       // a click anywhere else opens the door
  timers.push(setTimeout(open, 1000 * K));                    // a moment to see the door
})();
