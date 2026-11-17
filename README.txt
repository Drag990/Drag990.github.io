Jihad Mohamed Alahiane: portfolio site
======================================

Open it locally:
  npx serve .                      (from this folder)
  python -m http.server 8000       (then open http://localhost:8000)
Double-clicking the HTML files also works; everything is plain HTML/CSS/JS.

Deploy: push this folder to GitHub Pages. No build step, no external scripts (only Google Fonts).

Pages
  index.html        Home: portrait, name, one line, two buttons, strip of the 3 main projects
  projects.html     3 main projects with inline SVG architecture diagrams (reveal on scroll, tap to enlarge),
                    then 7 more projects with filters and a details dialog
  about.html        About, illustrated timeline (ENSA, ONDA, DXC, next PFE), skills and certifications

Shared
  css/style.css     the whole design (palette tokens on :root at the top)
  js/cover.js       Home only: the book cover intro (once per browser session; skipped with reduced motion)
  js/site.js        menu, frosted top bar, scroll reveal, clouds/leaves, filters, dialogs, diagram reveal + enlarge, timeline
  assets/           favicon + the two topology images
  images/           painted illustrations: portrait.webp, project-*.webp, timeline-*.webp; og-image.jpg is the link-preview image (1200x630, cut from project-soc)

Tips
  - Background music: add your track as audio/ambient.mp3 (a royalty-free loop). The music button only appears once that file exists; it is off by default and nothing downloads until a visitor turns it on.
  - The pause button in the nav stops all ambient motion (birds, leaves, tree sway, fireflies, clouds, diagram dots) and is remembered per browser.
  - To see the book cover again: sessionStorage.removeItem("jma-cover") in the console, or open a new tab.
  - Page turns use cross-document view transitions (Chrome/Edge 126+, Safari 18.2+); other browsers just load the page.
  - Link straight to a main project: projects.html#soc-lab, #grfics, #aws. Other projects open their dialog: #p-ad, #p-cti, #p-iso, #p-risk, #p-pa, #p-hosp, #p-az
  - View on GitHub buttons stay hidden while href is #: paste the repo URL and remove the hidden attribute.
  - Search the HTML for "TODO" to find facts waiting for confirmation and the missing GitHub links.
  - The nav and footer are identical on the three pages: change all three if you edit them.
