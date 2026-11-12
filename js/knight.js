// About section: a chess knight (the defender piece) built from the same glass triangles
// and glowing edges as the hero pyramid. Its faces are split into tiny pyramids, a ridge of
// small pyramids forms the mane, and it stands on a three-layer pyramid base.
// As the About section scrolls in, the triangles fly in and assemble the knight.
// Desktop only; decorative (the canvas is aria-hidden).
import * as THREE from 'three';
import { edgeGeometry, facesGeometry, glassMaterial, glowMaterial, sparkTexture, mulberry, themeMaterials, isLight } from './scene.js';

const V3 = THREE.Vector3;
const AMBER = 0xF2A93B;
const SIGNAL = 0x6FC3DF;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);

// Side profile of a chess knight, facing left (counter-clockwise, units ~ scene units).
const PROFILE = [
  [-0.55, 0], [0.75, 0], [0.78, 0.6], [0.72, 1.2], [0.6, 1.7], [0.4, 2.15], [0.15, 2.4],
  [0.12, 2.78], [-0.05, 2.45], [-0.3, 2.3], [-0.6, 2.0], [-0.95, 1.55], [-1.05, 1.3],
  [-0.9, 1.15], [-0.6, 1.15], [-0.35, 1.3], [-0.3, 1.0], [-0.5, 0.55], [-0.6, 0.25],
];
const HALF_DEPTH = 0.4;   // knight thickness / 2
const BEVEL = 0.1;        // silhouette ridge pushed outward
const FACET = 0.09;       // how far each face triangle's centre rises (tiny pyramids)
const SHIFT_X = -0.1;     // centre the neck on the base
const LIFT_Y = 0.03;

function frustum(hb, ht, y0, y1) {
  const b = [new V3(-hb, y0, -hb), new V3(hb, y0, -hb), new V3(hb, y0, hb), new V3(-hb, y0, hb)];
  const t = [new V3(-ht, y1, -ht), new V3(ht, y1, -ht), new V3(ht, y1, ht), new V3(-ht, y1, ht)];
  const segs = [], tris = [];
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    segs.push([b[k], b[n]], [t[k], t[n]], [b[k], t[k]]);
    tris.push([b[k], b[n], t[n]], [b[k], t[n], t[k]]);
  }
  tris.push([t[0], t[1], t[2]], [t[0], t[2], t[3]]);
  return { segs, tris };
}

function squarePyramid(half, h) {
  const apex = new V3(0, h, 0);
  const b = [new V3(-half, 0, -half), new V3(half, 0, -half), new V3(half, 0, half), new V3(-half, 0, half)];
  const segs = [], tris = [];
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    segs.push([b[k], b[n]], [b[k], apex]);
    tris.push([b[k], b[n], apex]);
  }
  tris.push([b[0], b[2], b[1]], [b[0], b[3], b[2]]);
  return { segs, tris };
}

export function createKnight(canvas, { reduced = false } = {}) {
  const section = canvas.closest('section') || document.body;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
  camera.position.set(0, 1.9, 9.2);
  camera.lookAt(0, 1.1, 0);

  const model = new THREE.Group();
  scene.add(model);
  const rnd = mulberry(7);
  const spark = sparkTexture();

  /* ---------- knight body: shards (triangles) that fly in ---------- */
  const n2 = PROFILE.length;
  const P = (i, z) => new V3(PROFILE[i][0] + SHIFT_X, PROFILE[i][1] + LIFT_Y, z);
  const normals2 = PROFILE.map((_, i) => {
    const a = PROFILE[(i - 1 + n2) % n2], b = PROFILE[i], c = PROFILE[(i + 1) % n2];
    const e1 = new THREE.Vector2(b[0] - a[0], b[1] - a[1]).normalize();
    const e2 = new THREE.Vector2(c[0] - b[0], c[1] - b[1]).normalize();
    return new THREE.Vector2(e1.y + e2.y, -e1.x - e2.x).normalize(); // outward for CCW
  });
  const ridge = (i) => P(i, 0).add(new V3(normals2[i].x * BEVEL, normals2[i].y * BEVEL, 0));

  const shards = [];
  // front and back faces, each triangle raised into a tiny pyramid
  const contour = PROFILE.map(([x, y]) => new THREE.Vector2(x, y));
  const faces = THREE.ShapeUtils.triangulateShape(contour, []);
  for (const side of [1, -1]) {
    for (const [i, j, k] of faces) {
      const a = P(i, side * HALF_DEPTH), b = P(j, side * HALF_DEPTH), c = P(k, side * HALF_DEPTH);
      const ct = a.clone().add(b).add(c).multiplyScalar(1 / 3);
      ct.z += side * FACET;
      shards.push([a, b, ct], [b, c, ct], [c, a, ct]);
    }
  }
  // sides: front edge -> silhouette ridge -> back edge
  for (let i = 0; i < n2; i++) {
    const j = (i + 1) % n2;
    if (i === 0) continue; // the flat bottom sits on the base
    const fi = P(i, HALF_DEPTH), fj = P(j, HALF_DEPTH);
    const bi = P(i, -HALF_DEPTH), bj = P(j, -HALF_DEPTH);
    const ri = ridge(i), rj = ridge(j);
    shards.push([fi, fj, rj], [fi, rj, ri], [ri, rj, bj], [ri, bj, bi]);
  }

  const shardData = shards.map(([a, b, c]) => {
    const center = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    // fly in mostly from the sides, below and towards the camera, so pieces stay inside the canvas
    const dir = new V3(rnd() * 2 - 1, rnd() * 1.1 - 0.75, rnd() * 1.6 - 0.4).normalize();
    return {
      center,
      offset: dir.multiplyScalar(1.6 + rnd() * 1.8),
      axis: new V3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
      angle: Math.PI * (1 + rnd() * 2),
      // bottom of the knight assembles first, then up to the ears
      delay: 0.12 + clamp(center.y / 2.8) * 0.45 + rnd() * 0.12,
      s: -1,
    };
  });

  const faceGeo = facesGeometry(shards);
  const faceTarget = faceGeo.attributes.position.array.slice();
  const shardSegs = [];
  for (const [a, b, c] of shards) shardSegs.push([a, b], [b, c], [c, a]);
  const wireGeo = edgeGeometry(shardSegs, 0.012);
  const wireTarget = wireGeo.attributes.position.array.slice();
  const WIRE_PER_SHARD = wireTarget.length / 3 / shards.length; // vertices per shard

  const faceMat = glassMaterial(new THREE.Color(SIGNAL), 0.9, 0.03);
  const wireMat = glowMaterial(new THREE.Color(SIGNAL), 0.5);
  const body = new THREE.Mesh(faceGeo, faceMat);
  const wire = new THREE.Mesh(wireGeo, wireMat);
  body.renderOrder = 0; wire.renderOrder = 2;
  model.add(body, wire);

  // amber silhouette ridge, fades in once the knight is whole
  const ridgeSegs = [];
  for (let i = 1; i < n2; i++) ridgeSegs.push([ridge(i), ridge((i + 1) % n2)]);
  const outlineMat = glowMaterial(new THREE.Color(AMBER), 0);
  const outlineHaloMat = glowMaterial(new THREE.Color(AMBER), 0);
  const outline = new THREE.Mesh(edgeGeometry(ridgeSegs, 0.03), outlineMat);
  const outlineHalo = new THREE.Mesh(edgeGeometry(ridgeSegs, 0.1), outlineHaloMat);
  outline.renderOrder = 3; outlineHalo.renderOrder = 1;
  model.add(outline, outlineHalo);

  // glowing eye on both sides
  const eyeMat = new THREE.SpriteMaterial({ map: spark, color: AMBER, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const z of [HALF_DEPTH + FACET + 0.02, -HALF_DEPTH - FACET - 0.02]) {
    const eye = new THREE.Sprite(eyeMat);
    eye.position.set(-0.5 + SHIFT_X, 1.95 + LIFT_Y, z);
    eye.scale.setScalar(0.32);
    model.add(eye);
  }

  /* ---------- mane: a ridge of small pyramids along the back of the neck ---------- */
  const mane = [];
  const maneCurve = new THREE.CatmullRomCurve3([3, 4, 5, 6].map((i) => ridge(i)));
  const Y = new V3(0, 1, 0);
  const maneParts = squarePyramid(0.085, 0.26);
  const maneGlassGeo = facesGeometry(maneParts.tris);
  const maneEdgeGeo = edgeGeometry(maneParts.segs, 0.02);
  for (let m = 0; m < 6; m++) {
    const u = 0.06 + (m / 5) * 0.88;
    const pos = maneCurve.getPoint(u);
    const tan = maneCurve.getTangent(u);
    const out = new V3(tan.y, -tan.x, 0).normalize(); // outward from the neck
    const g = new THREE.Group();
    const edgeMat = glowMaterial(new THREE.Color(AMBER), 0.95);
    const glassMat = glassMaterial(new THREE.Color(AMBER), 1, 0.03);
    g.add(new THREE.Mesh(maneGlassGeo, glassMat), new THREE.Mesh(maneEdgeGeo, edgeMat));
    g.position.copy(pos);
    g.quaternion.setFromUnitVectors(Y, out);
    g.scale.setScalar(0.001);
    model.add(g);
    mane.push({ g, edgeMat, glassMat, at: 0.62 + m * 0.045 });
  }

  /* ---------- base: three pyramid layers, like the hero's defense layers ---------- */
  const tiers = [
    { hb: 1.15, ht: 1.0, y0: -0.64, y1: -0.42, color: SIGNAL },
    { hb: 0.95, ht: 0.82, y0: -0.42, y1: -0.21, color: AMBER },
    { hb: 0.78, ht: 0.66, y0: -0.21, y1: 0, color: SIGNAL },
  ].map((t, i) => {
    const { segs, tris } = frustum(t.hb, t.ht, t.y0, t.y1);
    const g = new THREE.Group();
    const glassMat = glassMaterial(new THREE.Color(t.color), 1, 0.03);
    const edgeMat = glowMaterial(new THREE.Color(t.color), 0.95);
    const haloMat = glowMaterial(new THREE.Color(t.color), 0.12);
    const glass = new THREE.Mesh(facesGeometry(tris), glassMat);
    const edges = new THREE.Mesh(edgeGeometry(segs, 0.026), edgeMat);
    const halo = new THREE.Mesh(edgeGeometry(segs, 0.1), haloMat);
    glass.renderOrder = 0; halo.renderOrder = 1; edges.renderOrder = 2;
    g.add(glass, halo, edges);
    model.add(g);
    return { g, glassMat, edgeMat, haloMat, from: i * 0.08, to: 0.28 + i * 0.08 };
  });

  /* ---------- small wireframe pyramids orbiting the piece ---------- */
  const orbitParts = squarePyramid(0.12, 0.24);
  const orbitGeo = edgeGeometry(orbitParts.segs, 0.012);
  const orbiters = [];
  for (let k = 0; k < 7; k++) {
    const mat = glowMaterial(new THREE.Color(k % 2 ? AMBER : SIGNAL), 0);
    const m = new THREE.Mesh(orbitGeo, mat);
    model.add(m);
    orbiters.push({
      m, mat,
      r: 1.75 + rnd() * 0.55, y: 0.1 + rnd() * 2.9,
      a0: rnd() * Math.PI * 2, speed: (0.18 + rnd() * 0.18) * (k % 2 ? 1 : -1),
      spin: new V3(rnd(), rnd(), rnd()),
    });
  }

  /* ---------- state ---------- */
  const st = { T: reduced ? 1 : 0, px: 0, py: 0, rx: 0, ry: 0, visible: false, running: false, raf: 0 };
  const q = new THREE.Quaternion();
  const tmp = new V3();

  function targetT() {
    if (reduced) return 1;
    const r = section.getBoundingClientRect();
    const vh = window.innerHeight;
    // starts as About enters the screen, complete when its top reaches ~30% of the screen
    return clamp((vh * 0.95 - r.top) / (vh * 0.65));
  }

  function updateShards(T) {
    const tt = T * 1.12;
    const fp = faceGeo.attributes.position.array;
    const wp = wireGeo.attributes.position.array;
    let changed = false;
    for (let i = 0; i < shardData.length; i++) {
      const d = shardData[i];
      const s = easeOut((tt - d.delay) / 0.38);
      if (s === d.s) continue;
      d.s = s; changed = true;
      const inv = 1 - s;
      q.setFromAxisAngle(d.axis, d.angle * inv);
      const ox = d.offset.x * inv, oy = d.offset.y * inv, oz = d.offset.z * inv;
      const c = d.center;
      const move = (src, dst, idx) => {
        tmp.set(src[idx] - c.x, src[idx + 1] - c.y, src[idx + 2] - c.z).applyQuaternion(q);
        dst[idx] = tmp.x + c.x + ox; dst[idx + 1] = tmp.y + c.y + oy; dst[idx + 2] = tmp.z + c.z + oz;
      };
      for (let v = 0; v < 3; v++) move(faceTarget, fp, (i * 3 + v) * 3);
      const w0 = i * WIRE_PER_SHARD;
      for (let v = 0; v < WIRE_PER_SHARD; v++) move(wireTarget, wp, (w0 + v) * 3);
    }
    if (changed) {
      faceGeo.attributes.position.needsUpdate = true;
      wireGeo.attributes.position.needsUpdate = true;
    }
  }

  function render(now) {
    const t = now / 1000;
    const T = st.T;
    updateShards(T);

    const appear = smooth(0, 0.25, T);
    faceMat.uniforms.uOpacity.value = 0.9 * appear;
    wireMat.opacity = 0.5 * appear + 0.15 * smooth(0.85, 1, T);
    const whole = smooth(0.8, 1, T);
    outlineMat.opacity = 0.95 * whole;
    outlineHaloMat.opacity = 0.13 * whole;
    eyeMat.opacity = whole * (0.75 + 0.25 * Math.sin(t * 2.2));

    mane.forEach((m) => {
      const s = easeOut((T - m.at) / 0.18);
      m.g.scale.setScalar(Math.max(0.001, s));
      m.edgeMat.opacity = 0.95 * s;
      m.glassMat.uniforms.uOpacity.value = s;
    });
    tiers.forEach((tr) => {
      const s = easeOut((T - tr.from) / (tr.to - tr.from));
      tr.g.position.y = -(1 - s) * 1.4;
      tr.edgeMat.opacity = 0.95 * s;
      tr.haloMat.opacity = 0.12 * s;
      tr.glassMat.uniforms.uOpacity.value = s;
    });
    const orb = smooth(0.5, 0.9, T);
    orbiters.forEach((o, k) => {
      const a = o.a0 + (reduced ? 0 : t * o.speed);
      o.m.position.set(Math.cos(a) * o.r, o.y + (reduced ? 0 : Math.sin(t * 0.7 + k) * 0.12), Math.sin(a) * o.r);
      o.m.rotation.set(o.spin.x * t, o.spin.y * t, o.spin.z * t);
      o.mat.opacity = 0.65 * orb;
    });

    // slow turn showing the knight in three-quarter view, plus a tilt toward the cursor
    const idle = reduced ? 0 : Math.sin(t * 0.35) * 0.32;
    st.ry += ((-0.55 + idle + st.px * 0.45) - st.ry) * 0.06;
    st.rx += ((st.py * 0.12) - st.rx) * 0.06;
    model.rotation.set(st.rx, st.ry, 0);
    model.position.y = reduced ? 0 : Math.sin(t * 0.9) * 0.04;

    renderer.render(scene, camera);
  }

  function loop(now) {
    if (!st.running) return;
    st.raf = requestAnimationFrame(loop);
    st.T += (targetT() - st.T) * 0.08;
    if (Math.abs(targetT() - st.T) < 0.0005) st.T = targetT();
    render(now);
  }
  function start() {
    if (st.running || reduced) return;
    st.running = true;
    st.raf = requestAnimationFrame(loop);
  }
  function stop() { st.running = false; cancelAnimationFrame(st.raf); }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (reduced || !st.running) render(performance.now());
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // render only while the knight is on screen and the tab is visible
  new IntersectionObserver(([en]) => {
    st.visible = en.isIntersecting;
    if (st.visible && !document.hidden) start(); else stop();
  }, { rootMargin: '120px 0px' }).observe(canvas);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (st.visible) start();
  });

  if (!reduced) {
    window.addEventListener('pointermove', (e) => {
      st.px = (e.clientX / window.innerWidth) * 2 - 1;
      st.py = (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });
  }

  if (isLight()) themeMaterials(scene, true);
  if (reduced) render(performance.now()); // calm version: one still, finished frame
  canvas.classList.add('ready');

  return {
    setTheme(light) { themeMaterials(scene, light); render(performance.now()); },
  };
}
