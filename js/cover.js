// Home only: a closed book cover that swings open once per browser session.
// The inline script in <head> decides whether to show it (first visit this session, motion allowed)
// and sets html.cover-wait, which paints a plain cover-coloured screen so the page never flashes.
// This deferred script builds the real cover over it. (A blocking script in <body> would have
// switched off the page-turn view transition into Home, so this stays deferred.)
// The real page stays in the DOM underneath; focus is never moved or trapped.
(function () {
  'use strict';
  var root = document.documentElement;
  if (!root.classList.contains('cover-wait')) return;        // no cover this time, or the safety timer already showed the page

  var small = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  var DUR = small ? 800 : 1200;                               // ms, matches the CSS

  var book = document.createElement('div');
  book.className = 'book' + (small ? ' book-small' : '');
  book.innerHTML =
    '<div class="book-shade" aria-hidden="true"></div>' +
    '<div class="book-cover" aria-hidden="true">' +
      '<div class="bc-front">' +
        '<div class="bc-inner">' +
          '<svg class="bc-emblem" viewBox="0 0 64 64"><use href="#seal"/></svg>' +
          '<p class="bc-name">Jihad Mohamed Alahiane</p>' +
          '<p class="bc-sub">Cybersecurity engineer, portfolio</p>' +
        '</div>' +
      '</div>' +
      '<div class="bc-back"></div>' +
    '</div>' +
    '<button type="button" class="book-skip">Skip intro</button>';
  document.body.appendChild(book);
  root.classList.remove('cover-wait');                       // the real cover now sits over the page

  var cover = book.querySelector('.book-cover');
  var opened = false, removed = false;

  function cleanup() {
    if (removed) return;
    removed = true;
    root.classList.remove('cover-on');
    book.remove();
  }
  function open() {
    if (opened) return;
    opened = true;
    clearTimeout(auto);
    window.removeEventListener('keydown', onKey, true);
    book.classList.add('open');
    // let the hero start rising while the cover is past halfway
    setTimeout(function () { root.classList.remove('cover-on'); }, DUR * 0.45);
    cover.addEventListener('animationend', function (e) { if (e.target === cover) cleanup(); });
    setTimeout(cleanup, DUR + 400);                           // in case animationend never fires
  }
  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); open(); }
  }

  window.addEventListener('keydown', onKey, true);
  book.addEventListener('click', open);                       // the Skip button is inside, so it opens too
  var auto = setTimeout(open, 600);
})();
