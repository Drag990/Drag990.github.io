// Background: a SOC-style world attack map. A dotted world map with missiles arcing between
// cities and exploding on impact. Rabat is the defended node: attacks on it hit a shield.
// Decorative only (the canvas is aria-hidden). The traffic is simulated, not real data.
import { prefersReduced } from './ui.js';
import { onThemeChange } from './theme.js';

const LAND_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json';
const TOPO_URL = 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm';

// [name, lat, lon]
const CITIES = [
  ['New York', 40.7, -74.0], ['San Francisco', 37.8, -122.4], ['Toronto', 43.7, -79.4],
  ['Mexico City', 19.4, -99.1], ['Sao Paulo', -23.5, -46.6], ['Buenos Aires', -34.6, -58.4],
  ['Bogota', 4.7, -74.1], ['London', 51.5, -0.1], ['Paris', 48.9, 2.35], ['Frankfurt', 50.1, 8.7],
  ['Madrid', 40.4, -3.7], ['Stockholm', 59.3, 18.1], ['Moscow', 55.8, 37.6], ['Istanbul', 41.0, 29.0],
  ['Cairo', 30.0, 31.2], ['Lagos', 6.5, 3.4], ['Johannesburg', -26.2, 28.0], ['Nairobi', -1.3, 36.8],
  ['Dubai', 25.2, 55.3], ['Riyadh', 24.7, 46.7], ['Mumbai', 19.1, 72.9], ['Delhi', 28.6, 77.2],
  ['Singapore', 1.35, 103.8], ['Hong Kong', 22.3, 114.2], ['Beijing', 39.9, 116.4], ['Seoul', 37.6, 127.0],
  ['Tokyo', 35.7, 139.7], ['Sydney', -33.9, 151.2], ['Jakarta', -6.2, 106.8], ['Dakar', 14.7, -17.5],
];
const HOME = { name: 'Rabat', lat: 34.0, lon: -6.8 };

const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ease = (t) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, t))) / 2;

export async function initWorldMap(canvas) {
  const reduced = prefersReduced();
  const small = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const [{ feature }, topo] = await Promise.all([
    import(TOPO_URL),
    fetch(LAND_URL).then((r) => { if (!r.ok) throw new Error('map ' + r.status); return r.json(); }),
  ]);

  /* ---------- land mask (equirectangular, 2 px per degree) ---------- */
  const MW = 720, MH = 360;
  const mask = document.createElement('canvas');
  mask.width = MW; mask.height = MH;
  const m = mask.getContext('2d', { willReadFrequently: true });
  m.fillStyle = '#fff';
  const land = feature(topo, topo.objects.land);
  const geoms = land.type === 'FeatureCollection' ? land.features.map((f) => f.geometry) : [land.geometry];
  const polygons = [];
  geoms.forEach((g) => {
    if (g.type === 'Polygon') polygons.push(g.coordinates);
    else if (g.type === 'MultiPolygon') polygons.push(...g.coordinates);
  });
  for (const poly of polygons) {
    // unwrap longitudes so rings crossing the antimeridian stay continuous, then draw 3 copies
    const rings = poly.map((ring) => {
      let prev = ring[0][0], shift = 0;
      return ring.map(([lon, lat]) => {
        if (lon - prev > 180) shift -= 360; else if (prev - lon > 180) shift += 360;
        prev = lon;
        return [lon + shift, lat];
      });
    });
    for (const off of [-360, 0, 360]) {
      m.beginPath();
      for (const ring of rings) {
        ring.forEach(([lon, lat], i) => {
          const x = ((lon + off + 180) / 360) * MW, y = ((90 - lat) / 180) * MH;
          if (i) m.lineTo(x, y); else m.moveTo(x, y);
        });
        m.closePath();
      }
      m.fill('evenodd');
    }
  }
  const maskData = m.getImageData(0, 0, MW, MH).data;
  const isLand = (lat, lon) => {
    const x = Math.floor(((lon + 180) / 360) * MW), y = Math.floor(((90 - lat) / 180) * MH);
    if (x < 0 || x >= MW || y < 0 || y >= MH) return false;
    return maskData[(y * MW + x) * 4 + 3] > 127;
  };

  /* ---------- layout + static dot layer ---------- */
  let W = 0, H = 0, dpr = 1, scale = 1, cx = 0, cy = 0;
  // Wide screens: whole world across the width, shifted so Rabat sits just right of the name.
  // Narrow screens: zoom in around Europe/Africa so the map is not a thin strip.
  let LON0 = -20, LAT0 = 18;
  const project = (lat, lon) => [cx + (lon - LON0) * scale, cy - (lat - LAT0) * scale];
  const dots = document.createElement('canvas');
  let theme = {};

  function readTheme() {
    const light = document.documentElement.dataset.theme === 'light';
    theme = {
      light,
      dot: light ? 'rgba(40, 64, 100, .36)' : 'rgba(111, 195, 223, .46)',
      grid: light ? 'rgba(40, 64, 100, .08)' : 'rgba(111, 195, 223, .08)',
      label: css('--muted'),
      home: css('--signal'),
      colors: [css('--alert'), css('--alert'), css('--alert'), css('--amber'), css('--amber'), css('--d-grc')],
      blend: light ? 'source-over' : 'lighter',
    };
  }

  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const wide = W / H >= 1.3;
    scale = wide ? W / 360 : Math.max(W / 360, H / 230);
    LON0 = wide ? -20 : 12;
    cx = W / 2; cy = H / 2;
    buildDots();
    homeXY = project(HOME.lat, HOME.lon);
    cityXY = CITIES.map(([, lat, lon]) => project(lat, lon));
  }

  function buildDots() {
    dots.width = canvas.width; dots.height = canvas.height;
    const d = dots.getContext('2d');
    d.setTransform(dpr, 0, 0, dpr, 0, 0);
    // graticule every 30 degrees
    d.strokeStyle = theme.grid; d.lineWidth = 1;
    d.beginPath();
    for (let lon = -180; lon <= 180; lon += 30) { const [x] = project(0, lon); d.moveTo(x, 0); d.lineTo(x, H); }
    for (let lat = -60; lat <= 90; lat += 30) { const [, y] = project(lat, 0); d.moveTo(0, y); d.lineTo(W, y); }
    d.stroke();
    // land dots
    const step = small ? 7 : 8;
    const r = small ? 1.1 : 1.2;
    d.fillStyle = theme.dot;
    d.beginPath();
    for (let y = step / 2; y < H; y += step) {
      const lat = LAT0 - (y - cy) / scale;
      if (lat > 84 || lat < -60) continue;
      for (let x = step / 2; x < W; x += step) {
        const lon = LON0 + (x - cx) / scale;
        if (lon < -180 || lon > 180) continue;
        if (isLand(lat, lon)) { d.moveTo(x + r, y); d.arc(x, y, r, 0, Math.PI * 2); }
      }
    }
    d.fill();
  }

  /* ---------- attacks ---------- */
  let homeXY = [0, 0], cityXY = [];
  const arcs = [], booms = [];
  const MAX = small ? 8 : 18;
  const EVERY = small ? 460 : 230; // ms between launches

  function launch(now) {
    if (arcs.length >= MAX) return;
    const si = Math.floor(Math.random() * CITIES.length);
    const toHome = Math.random() < 0.22;
    let di = Math.floor(Math.random() * CITIES.length);
    if (di === si) di = (di + 7) % CITIES.length;
    const [x0, y0] = cityXY[si];
    const [x1, y1] = toHome ? homeXY : cityXY[di];
    const dist = Math.hypot(x1 - x0, y1 - y0);
    if (dist < 30) return;
    const lift = Math.min(H * 0.28, dist * 0.38);
    const color = toHome ? theme.colors[0] : theme.colors[Math.floor(Math.random() * theme.colors.length)];
    arcs.push({
      x0, y0, x1, y1, qx: (x0 + x1) / 2, qy: (y0 + y1) / 2 - lift,
      t0: now, dur: Math.min(2600, Math.max(1100, 700 + dist * 1.6)), color, home: toHome,
    });
    booms.push({ x: x0, y: y0, t0: now, dur: 700, kind: 'launch', color });
  }

  const at = (a, t) => {
    const u = 1 - t;
    return [u * u * a.x0 + 2 * u * t * a.qx + t * t * a.x1, u * u * a.y0 + 2 * u * t * a.qy + t * t * a.y1];
  };

  function drawArc(a, now) {
    const raw = (now - a.t0) / a.dur;
    const p = ease(raw);
    const fade = raw > 1 ? Math.max(0, 1 - (raw - 1) * 2.2) : 1;
    // faint track
    ctx.globalAlpha = 0.28 * fade;
    ctx.strokeStyle = a.color; ctx.lineWidth = 1;
    ctx.beginPath();
    const N = 28;
    for (let i = 0; i <= N; i++) {
      const [x, y] = at(a, (i / N) * Math.min(1, p));
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.stroke();
    if (raw >= 1) return;
    // bright trail behind the head
    const TR = 12, len = 0.2;
    for (let i = 0; i < TR; i++) {
      const t0 = Math.max(0, p - len + (len * i) / TR), t1 = Math.max(0, p - len + (len * (i + 1)) / TR);
      const [ax, ay] = at(a, t0), [bx, by] = at(a, t1);
      ctx.globalAlpha = (i + 1) / TR;
      ctx.lineWidth = 0.6 + (2.2 * (i + 1)) / TR;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    // warhead with glow
    const [hx, hy] = at(a, p);
    ctx.fillStyle = a.color;
    ctx.globalAlpha = 0.14; ctx.beginPath(); ctx.arc(hx, hy, 9, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(hx, hy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(hx, hy, 2.2, 0, Math.PI * 2); ctx.fill();
  }

  function drawBoom(b, now) {
    const t = (now - b.t0) / b.dur;
    if (t >= 1) return false;
    const k = 1 - t;
    ctx.strokeStyle = b.color; ctx.fillStyle = b.color;
    if (b.kind === 'launch') {
      ctx.globalAlpha = k * 0.8; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, 2 + t * 10, 0, Math.PI * 2); ctx.stroke();
      return true;
    }
    if (b.kind === 'block') {
      // shield: a hexagon flashes around Rabat and the attack is stopped
      ctx.globalAlpha = k; ctx.lineWidth = 1.6;
      ctx.beginPath();
      const R = 13 + t * 6;
      for (let i = 0; i <= 6; i++) {
        const ang = (Math.PI / 3) * i + Math.PI / 6;
        const x = b.x + Math.cos(ang) * R, y = b.y + Math.sin(ang) * R;
        if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = k * 0.25; ctx.fill();
      return true;
    }
    // impact: flash, two shockwaves and debris
    ctx.globalAlpha = k * k; ctx.beginPath(); ctx.arc(b.x, b.y, 3 + t * 7, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = k; ctx.beginPath(); ctx.arc(b.x, b.y, t * 30, 0, Math.PI * 2); ctx.stroke();
    if (t > 0.15) {
      const t2 = (t - 0.15) / 0.85;
      ctx.globalAlpha = (1 - t2) * 0.6; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y, t2 * 46, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = k;
    for (let i = 0; i < 7; i++) {
      const ang = b.seed + (i / 7) * Math.PI * 2;
      const d = 4 + t * (16 + (i % 3) * 6);
      ctx.fillRect(b.x + Math.cos(ang) * d - 1, b.y + Math.sin(ang) * d - 1, 2, 2);
    }
    return true;
  }

  function drawHome(now) {
    const [x, y] = homeXY;
    const pulse = reduced ? 0.5 : (now / 1600) % 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = theme.home; ctx.fillStyle = theme.home;
    ctx.globalAlpha = 0.9 * (1 - pulse); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, 5 + pulse * 16, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    if (small) return; // phones: marker only, the label would crowd the hero text
    ctx.globalAlpha = 0.85;
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.fillStyle = theme.label;
    ctx.fillText('RABAT · DEFENDED', x + 10, y - 8);
  }

  function frame(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(dots, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = theme.blend;
    for (let i = arcs.length - 1; i >= 0; i--) {
      const a = arcs[i];
      const raw = (now - a.t0) / a.dur;
      if (raw >= 1 && !a.landed) {
        a.landed = true;
        booms.push(a.home
          ? { x: a.x1, y: a.y1, t0: now, dur: 900, kind: 'block', color: theme.home }
          : { x: a.x1, y: a.y1, t0: now, dur: 1000, kind: 'hit', color: a.color, seed: Math.random() * 6 });
      }
      if (raw > 1.5) { arcs.splice(i, 1); continue; }
      drawArc(a, now);
    }
    for (let i = booms.length - 1; i >= 0; i--) if (!drawBoom(booms[i], now)) booms.splice(i, 1);
    drawHome(now);
  }

  /* ---------- loop ---------- */
  let raf = 0, last = 0, nextLaunch = 0, tick = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (small && (tick++ & 1)) return; // phones: 30 fps is plenty for a background
    if (now >= nextLaunch) { launch(now); nextLaunch = now + EVERY * (0.6 + Math.random() * 0.8); }
    frame(now);
    last = now;
  }
  function start() { if (!raf && !reduced) raf = requestAnimationFrame(loop); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  function staticFrame() {
    // calm version: the map, Rabat, and a few finished tracks
    const now = performance.now();
    arcs.length = 0; booms.length = 0;
    [[7, 0], [26, 18], [12, 22], [4, 13]].forEach(([s, d]) => {
      const [x0, y0] = cityXY[s], [x1, y1] = cityXY[d];
      const dist = Math.hypot(x1 - x0, y1 - y0);
      arcs.push({ x0, y0, x1, y1, qx: (x0 + x1) / 2, qy: (y0 + y1) / 2 - Math.min(H * 0.28, dist * 0.38), t0: now - 1000, dur: 1000, color: theme.colors[3], landed: true });
    });
    frame(now);
    arcs.length = 0;
  }

  readTheme();
  layout();
  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { layout(); arcs.length = 0; booms.length = 0; if (reduced) staticFrame(); }, 150);
  });
  onThemeChange(() => { readTheme(); buildDots(); if (reduced) staticFrame(); else frame(performance.now()); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });

  if (reduced) staticFrame(); else start();
  canvas.classList.add('ready');
}
