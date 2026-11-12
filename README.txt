Jihad Mohamed Alahiane: portfolio site
======================================

Open it locally (modules need a server, double-clicking index.html will not load the 3D):
  npx serve .                      (from this folder)
  python -m http.server 8000       (then open http://localhost:8000)

Deploy: upload this whole folder to GitHub Pages or Netlify. No build step.

Files
  index.html        all content (works without JavaScript)
  css/main.css      design tokens, layout, components
  js/main.js        start-up: WebGL check, scroll values, loads GSAP/Lenis
  js/scene.js       Three.js hero (pyramid layers + floating field)
  js/scroll.js      GSAP ScrollTrigger timelines (SOC diagram, timeline, skills)
  js/ui.js          boot screen, name decrypt, cursor, filters, modal, counters
  js/theme.js       night (dark) / day (light) theme switch, circular reveal
  js/fx.js          extra motion: title scramble, marquee, spotlight, HUD, click ping
  js/worldmap.js    background attack map (simulated): dotted world map, missiles, impacts
  assets/           favicon + the two topology images

Libraries (pinned, jsDelivr): three@0.170.0, gsap@3.13.0, lenis@1.1.20, topojson-client@3.1.0 + world-atlas@2.0.2 (map data)

Tips
  - Boot screen shows once per browser. To see it again: localStorage.removeItem('jma-boot')
  - Theme is remembered per browser. To reset: localStorage.removeItem('jma-theme')
  - Add ?debug to the URL to expose window.__lenis for testing.
  - Search the HTML for "TODO(confirm)" to find facts waiting for confirmation.
