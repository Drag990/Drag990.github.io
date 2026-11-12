// Hero 3D scene: a shape of five defense layers (pyramid → cube → ball, morphing every 20 s),
// nested shapes inside,
// and a field of floating pyramids. Decorative only (canvas is aria-hidden).
import * as THREE from 'three';

const V3 = THREE.Vector3;
const C = {
  ground: 0x050E1D,
  amber: 0xF2A93B,
  signal: 0x6FC3DF,
  net: 0x7FD6A4, cloud: 0x9FB7FF, ot: 0xF2A93B, soc: 0x6FC3DF, grc: 0xB9A6F5,
};
// bottom → top: the network is the foundation, governance is the apex
const LAYERS = ['net', 'cloud', 'ot', 'soc', 'grc'];
const LAYER_BASE_COLOR = [C.signal, C.amber, C.signal, C.amber, C.signal];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);

/* ---------- geometry helpers ---------- */

// Thin boxes along each segment: real thickness, unlike 1px WebGL lines.
function edgeGeometry(segments, thickness) {
  const box = new THREE.BoxGeometry(thickness, 1, thickness).toNonIndexed();
  const bp = box.attributes.position;
  const pos = [];
  const up = new V3(0, 1, 0), dir = new V3(), mid = new V3(), p = new V3(), s = new V3();
  const q = new THREE.Quaternion(), m = new THREE.Matrix4();
  for (const [a, b] of segments) {
    dir.subVectors(b, a);
    const len = dir.length();
    q.setFromUnitVectors(up, dir.normalize());
    mid.addVectors(a, b).multiplyScalar(0.5);
    m.compose(mid, q, s.set(1, len + thickness, 1));
    for (let i = 0; i < bp.count; i++) {
      p.fromBufferAttribute(bp, i).applyMatrix4(m);
      pos.push(p.x, p.y, p.z);
    }
  }
  box.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

// Same boxes as edgeGeometry, but in a buffer that can be rewritten every frame (morphing).
function morphEdges(segCount, thickness) {
  const box = new THREE.BoxGeometry(thickness, 1, thickness).toNonIndexed();
  const tpl = box.attributes.position.array.slice();
  box.dispose();
  const n = tpl.length / 3;
  const arr = new Float32Array(segCount * n * 3);
  const attr = new THREE.BufferAttribute(arr, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', attr);
  const up = new V3(0, 1, 0), dir = new V3(), mid = new V3(), sc = new V3(), p = new V3();
  const q = new THREE.Quaternion(), m = new THREE.Matrix4();
  function write(segs) {
    let o = 0;
    for (const [a, b] of segs) {
      dir.subVectors(b, a);
      const len = dir.length();
      if (len < 1e-5) { dir.set(0, 1, 0); sc.set(0, 0, 0); } // collapsed edge: hide it
      else { dir.divideScalar(len); sc.set(1, len + thickness, 1); }
      q.setFromUnitVectors(up, dir);
      mid.addVectors(a, b).multiplyScalar(0.5);
      m.compose(mid, q, sc);
      for (let i = 0; i < n; i++) {
        p.set(tpl[i * 3], tpl[i * 3 + 1], tpl[i * 3 + 2]).applyMatrix4(m);
        arr[o++] = p.x; arr[o++] = p.y; arr[o++] = p.z;
      }
    }
    attr.needsUpdate = true;
    geo.computeBoundingSphere();
  }
  return { geo, write };
}
function morphFaces(triCount) {
  const arr = new Float32Array(triCount * 9);
  const attr = new THREE.BufferAttribute(arr, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', attr);
  function write(tris) {
    let o = 0;
    for (const t of tris) for (const v of t) { arr[o++] = v.x; arr[o++] = v.y; arr[o++] = v.z; }
    attr.needsUpdate = true;
    geo.computeVertexNormals(); // non-indexed, so normals stay flat
    geo.computeBoundingSphere();
  }
  return { geo, write };
}

function facesGeometry(tris) {
  const pos = [];
  for (const t of tris) for (const v of t) pos.push(v.x, v.y, v.z);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals(); // non-indexed, so normals stay flat
  return g;
}

// Square pyramid, base centered at origin height 0..h
function pyramidParts(half, h, yOffset = 0) {
  const apex = new V3(0, h + yOffset, 0);
  const b = [
    new V3(-half, yOffset, -half), new V3(half, yOffset, -half),
    new V3(half, yOffset, half), new V3(-half, yOffset, half),
  ];
  const segs = [], tris = [];
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    segs.push([b[k], b[n]], [b[k], apex]);
    tris.push([b[k], b[n], apex]);
  }
  tris.push([b[0], b[2], b[1]], [b[0], b[3], b[2]]);
  return { segs, tris, apex, corners: b };
}

/* ---------- materials ---------- */

const glassVertex = /* glsl */`
  varying vec3 vN;
  varying vec3 vV;
  varying float vDepth;
  void main() {
    vec4 local = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
      n = mat3(instanceMatrix) * n;
    #endif
    vec4 mv = modelViewMatrix * local;
    vN = normalize(normalMatrix * n);
    vV = normalize(-mv.xyz);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const glassFragment = /* glsl */`
  uniform vec3 uBase;
  uniform vec3 uRim;
  uniform float uOpacity;
  uniform float uFog;
  varying vec3 vN;
  varying vec3 vV;
  varying float vDepth;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
    vec3 col = mix(uBase, uRim, rim * 0.55);
    float a = (0.22 + rim * 0.45) * uOpacity;
    float fog = 1.0 - exp(-uFog * uFog * vDepth * vDepth);
    a *= 1.0 - clamp(fog, 0.0, 1.0);
    gl_FragColor = vec4(col, a);
  }
`;
function glassMaterial(rim, opacity = 1, fog = 0.045) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(0x0A1C38) },
      uRim: { value: new THREE.Color(rim) },
      uOpacity: { value: opacity },
      uFog: { value: fog },
    },
    vertexShader: glassVertex,
    fragmentShader: glassFragment,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
function glowMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  });
}
// Day theme: additive glow vanishes on a light background, so additive materials switch to
// normal blending, colors are deepened (tone) and dark glass becomes frosted glass.
// Original values are stored once in userData, so switching back and forth is lossless.
const LIGHT = { ground: 0xEEF2F7, glass: 0xDCE6F2, tone: 0.72, blueTone: 0.46 };
const lightTone = (c) => (c.b > c.r ? LIGHT.blueTone : LIGHT.tone);
function themeMaterials(root, light) {
  root.traverse((o) => {
    if (!o.material) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      const u = m.userData;
      if (!u.themed) {
        u.themed = true;
        u.blend = m.blending;
        if (m.color) u.color = m.color.clone();
        if (m.uniforms && m.uniforms.uRim) { u.rim = m.uniforms.uRim.value.clone(); u.base = m.uniforms.uBase.value.clone(); }
      }
      m.blending = light && u.blend === THREE.AdditiveBlending ? THREE.NormalBlending : u.blend;
      if (u.color) m.color.copy(u.color).multiplyScalar(light ? lightTone(u.color) : 1);
      if (u.rim) {
        m.uniforms.uRim.value.copy(u.rim).multiplyScalar(light ? lightTone(u.rim) : 1);
        if (light) m.uniforms.uBase.value.setHex(LIGHT.glass); else m.uniforms.uBase.value.copy(u.base);
      }
    }
  });
}
const isLight = () => document.documentElement.dataset.theme === "light";

function sparkTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ========================================================= */

export function createScene(canvas, opts = {}) {
  const { reduced = false, small = false } = opts;

  // Antialiasing stays on for phones too: the pyramid is drawn small there, and without it
  // the thin glowing edges look jagged. Phone GPUs handle MSAA cheaply.
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
  });
  // Sharp on high-density screens (phones are 2x-3x); capped at 2 for performance.
  let maxDpr = 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.setClearColor(C.ground, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(C.ground, 0.045);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.set(0, 0.3, 12);
  const lookAt = new V3(0, 0, 0);

  const sparkTex = sparkTexture();

  /* ---------- main shape: pyramid → cube → ball, always five layers ---------- */
  // Every shape is described the same way: rings of RING points stacked by a height
  // parameter v (0 = bottom, 1 = top). Pyramid rings shrink to the apex, cube rings keep
  // their size, ball rings follow the latitude. Same topology, so the shapes morph smoothly.
  const H = 5.2, S = 3.0, Y0 = -H / 2;
  const CUBE = 1.9, BALL = 2.45, MID = -0.25;
  const RING = 16, CORNER_IDX = [0, 4, 8, 12], MER = 8;
  const SHAPE_TIME = 20, MORPH_TIME = 4; // seconds per shape, of which the last 4 are the morph
  const cuts = [0, 0.27, 0.49, 0.67, 0.83, 1];
  const SQ = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const core = new THREE.Group();
  scene.add(core);

  // shape 0 = pyramid, 1 = cube, 2 = ball. k scales nested shapes; base lifts nested pyramids.
  function shapeAt(shape, u, v, k, base, out) {
    if (shape === 2) {
      const a = Math.PI * 1.25 + u * Math.PI * 2;
      const r = BALL * k * Math.sin(Math.PI * v);
      return out.set(Math.cos(a) * r, MID - BALL * k * Math.cos(Math.PI * v), Math.sin(a) * r);
    }
    const f = u * 4, e = Math.floor(f) % 4, t = f - Math.floor(f);
    const c0 = SQ[e], c1 = SQ[(e + 1) % 4];
    const half = shape === 0 ? S * k * (1 - v) : CUBE * k;
    const y = shape === 0 ? Y0 + base + v * H * k : MID - CUBE * k + v * 2 * CUBE * k;
    return out.set((c0[0] + (c1[0] - c0[0]) * t) * half, y, (c0[1] + (c1[1] - c0[1]) * t) * half);
  }
  const morph = { a: 0, b: 0, w: 0, built: false };
  const pA = new V3(), pB = new V3();
  function place(out, u, v, k, base, vB = v) {
    shapeAt(morph.a, u, v, k, base, pA);
    if (morph.w > 0) { shapeAt(morph.b, u, vB, k, base, pB); pA.lerp(pB, morph.w); }
    return out.copy(pA);
  }
  const ring = () => Array.from({ length: RING }, () => new V3());

  const slices = [];
  LAYERS.forEach((domain, i) => {
    const gap = 0.012;
    const t0 = cuts[i] + (i ? gap : 0);
    const t1 = cuts[i + 1] - (i < 4 ? gap : 0);
    const cy = Y0 + ((t0 + t1) / 2) * H;
    const isApex = i === 4;

    const r0 = ring(), r1 = ring();
    const posts = CORNER_IDX.map(() => [new V3(), new V3(), new V3(), new V3()]);
    const segs = [], tris = [];
    for (let j = 0; j < RING; j++) {
      const n = (j + 1) % RING;
      segs.push([r0[j], r0[n]], [r1[j], r1[n]]);
      tris.push([r0[j], r0[n], r1[n]], [r0[j], r1[n], r1[j]]);
    }
    posts.forEach((p) => { for (let q = 0; q < 3; q++) segs.push([p[q], p[q + 1]]); });

    const baseColor = new THREE.Color(LAYER_BASE_COLOR[i]);
    const group = new THREE.Group();
    group.position.y = cy;

    const edgeMat = glowMaterial(baseColor.clone(), 0.95);
    const haloMat = glowMaterial(baseColor.clone(), 0.13);
    const glassMat = glassMaterial(baseColor.clone(), 1);
    // On phones the shape is shown at about half size, so its edges get thicker to stay crisp.
    const edgesM = morphEdges(segs.length, small ? 0.046 : 0.028);
    const haloM = morphEdges(segs.length, small ? 0.15 : 0.11);
    const facesM = morphFaces(tris.length);
    const glass = new THREE.Mesh(facesM.geo, glassMat);
    const edges = new THREE.Mesh(edgesM.geo, edgeMat);
    const halo = new THREE.Mesh(haloM.geo, haloMat);
    glass.renderOrder = 0; halo.renderOrder = 1; edges.renderOrder = 2;
    group.add(glass, halo, edges);

    // glowing vertices on the top ring's corners
    const sparkMat = new THREE.SpriteMaterial({
      map: sparkTex, color: baseColor.clone(), transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sprites = CORNER_IDX.map(() => {
      const sp = new THREE.Sprite(sparkMat);
      const sc = isApex ? 0.5 : 0.45;
      sp.scale.set(sc, sc, sc);
      group.add(sp);
      return sp;
    });

    core.add(group);
    // each layer leaves in its own direction
    const ang = (i / 5) * Math.PI * 2 + 0.6;
    slices.push({
      domain, group, edgeMat, haloMat, glassMat, sparkMat,
      r0, r1, posts, segs, tris, edgesM, haloM, facesM, sprites, t0, t1,
      baseY: cy,
      base: baseColor.clone(),
      color: baseColor.clone(),
      target: baseColor.clone(),
      dim: 1, dimTarget: 1,
      dir: new V3(Math.cos(ang) * (1.6 + i * 0.35), (i - 2) * 1.35, Math.sin(ang) * 1.2),
      spin: (i % 2 ? -1 : 1) * (0.5 + i * 0.18),
      tilt: (i - 2) * 0.22,
      drop: 0,
    });
  });

  // nested shapes inside the core (the layers within the layers):
  // a base ring, a top ring and four meridians. Pyramid: base + edges to the apex.
  // Cube: bottom + top squares + vertical edges. Ball: equator + two great circles.
  const nested = [];
  [[0.56, C.signal], [0.36, C.amber], [0.2, C.signal]].forEach(([k, col], j) => {
    const rb = ring(), rt = ring();
    const mer = CORNER_IDX.map(() => Array.from({ length: MER + 1 }, () => new V3()));
    const segs = [];
    for (let q = 0; q < RING; q++) {
      const n = (q + 1) % RING;
      segs.push([rb[q], rb[n]], [rt[q], rt[n]]);
    }
    mer.forEach((p) => { for (let q = 0; q < MER; q++) segs.push([p[q], p[q + 1]]); });
    const g = new THREE.Group();
    const em = glowMaterial(col, 0.75);
    const hm = glowMaterial(col, 0.1);
    const edges = morphEdges(segs.length, 0.02);
    const halo = morphEdges(segs.length, 0.08);
    g.add(new THREE.Mesh(edges.geo, em));
    g.add(new THREE.Mesh(halo.geo, hm));
    core.add(g);
    nested.push({ g, em, hm, k, rb, rt, mer, segs, edges, halo, speed: (j % 2 ? -1 : 1) * (0.35 + j * 0.25), baseOpacity: 0.75 });
  });

  // Rewrites all morphable geometry for the current morph state (only while it changes).
  function buildShape() {
    for (const s of slices) {
      for (let j = 0; j < RING; j++) {
        place(s.r0[j], j / RING, s.t0, 1, 0).y -= s.baseY;
        place(s.r1[j], j / RING, s.t1, 1, 0).y -= s.baseY;
      }
      s.posts.forEach((p, c) => {
        const u = CORNER_IDX[c] / RING;
        for (let q = 0; q < 4; q++) place(p[q], u, s.t0 + (s.t1 - s.t0) * (q / 3), 1, 0).y -= s.baseY;
      });
      s.edgesM.write(s.segs); s.haloM.write(s.segs); s.facesM.write(s.tris);
      s.sprites.forEach((sp, c) => sp.position.copy(s.r1[CORNER_IDX[c]]));
    }
    const vA = morph.a === 2 ? 0.5 : 0, vB = morph.b === 2 ? 0.5 : 0; // ball: base ring = equator
    for (const n of nested) {
      for (let q = 0; q < RING; q++) {
        place(n.rb[q], q / RING, vA, n.k, 0.06, vB);
        place(n.rt[q], q / RING, 1, n.k, 0.06);
      }
      n.mer.forEach((p, c) => {
        const u = CORNER_IDX[c] / RING;
        for (let q = 0; q <= MER; q++) place(p[q], u, q / MER, n.k, 0.06);
      });
      n.edges.write(n.segs); n.halo.write(n.segs);
    }
  }
  // which shape we are on, and how far into the morph to the next one
  function updateMorph(sec) {
    const idx = Math.floor(sec / SHAPE_TIME) % 3;
    const local = sec % SHAPE_TIME;
    let b = idx, w = 0;
    if (local > SHAPE_TIME - MORPH_TIME) {
      b = (idx + 1) % 3;
      w = smooth(0, 1, (local - (SHAPE_TIME - MORPH_TIME)) / MORPH_TIME);
    }
    if (morph.built && idx === morph.a && b === morph.b && Math.abs(w - morph.w) < 1e-4) return;
    morph.a = idx; morph.b = b; morph.w = w; morph.built = true;
    buildShape();
  }
  updateMorph(0);

  // radar rings on the floor
  const radar = new THREE.Group();
  radar.position.y = Y0 - 0.02;
  const radarMats = [];
  [3.6, 4.6, 5.8].forEach((r, i) => {
    const pts = [];
    for (let a = 0; a <= 128; a++) {
      const t = (a / 128) * Math.PI * 2;
      pts.push(new V3(Math.cos(t) * r, 0, Math.sin(t) * r));
    }
    const mat = new THREE.LineDashedMaterial({
      color: C.signal, transparent: true, opacity: 0.26 - i * 0.06,
      dashSize: 0.18 + i * 0.1, gapSize: 0.22, depthWrite: false,
    });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
    line.computeLineDistances();
    radarMats.push(mat);
    radar.add(line);
  });
  core.add(radar);

  /* ---------- floating field ---------- */
  const unit = pyramidParts(0.6, 1, -0.5);
  const fieldCount = small ? 22 : 64;
  const glassCount = Math.round(fieldCount * 0.45);
  const fieldEdges = new THREE.InstancedMesh(
    edgeGeometry(unit.segs, 0.03),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false, fog: true }),
    fieldCount,
  );
  const fieldGlass = new THREE.InstancedMesh(facesGeometry(unit.tris), glassMaterial(C.signal, 0.9, 0.05), glassCount);
  fieldEdges.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fieldGlass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fieldEdges.frustumCulled = false;
  fieldGlass.frustumCulled = false;

  const rand = mulberry(7);
  const palette = [C.amber, C.signal, C.signal, 0x2C5A8A, 0x9FB7FF];
  const field = [];
  const col = new THREE.Color();
  for (let i = 0; i < fieldCount; i++) {
    let x, y, z;
    do {
      x = (rand() - 0.5) * 34;
      y = (rand() - 0.5) * 20;
      z = -rand() * 30 + 3;
    } while (Math.abs(x) < 4.5 && Math.abs(y) < 3.5 && z > -6); // keep the hero pyramid clear
    const s = 0.35 + rand() * 1.1;
    field.push({
      p: new V3(x, y, z), s,
      r: new THREE.Euler(rand() * 6, rand() * 6, rand() * 0.6),
      vr: new V3((rand() - 0.5) * 0.3, (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.2),
      phase: rand() * Math.PI * 2,
      amp: 0.15 + rand() * 0.35,
    });
    col.setHex(palette[Math.floor(rand() * palette.length)]).multiplyScalar(0.5 + rand() * 0.5);
    fieldEdges.setColorAt(i, col);
  }
  fieldEdges.instanceColor.needsUpdate = true;
  const fieldGroup = new THREE.Group();
  fieldGroup.add(fieldGlass, fieldEdges);
  scene.add(fieldGroup);

  // dust
  const dustCount = small ? 160 : 420;
  const dustPos = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (rand() - 0.5) * 40;
    dustPos[i * 3 + 1] = (rand() - 0.5) * 24;
    dustPos[i * 3 + 2] = -rand() * 34 + 4;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    map: sparkTex, color: 0x6FC3DF, size: 0.09, transparent: true, opacity: 0.55,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: true,
  }));
  scene.add(dust);

  /* ---------- state ---------- */
  const state = {
    hero: 0,          // 0..1 hero scroll progress (pyramid breaks apart)
    page: 0,          // 0..1 whole page progress (field parallax)
    px: 0, py: 0,     // pointer, -1..1
    cx: 0, cy: 0,     // smoothed pointer
    heroVisible: true,
    running: false,
    focus: null,
    light: false,
  };
  const layout = { x: 0, y: 0, scale: 1 };

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const aspect = w / h;
    if (aspect < 0.8) {        // phone portrait: pyramid above the name
      layout.x = 0; layout.y = 2.55; layout.scale = 0.46;
    } else if (aspect < 1.25) {
      layout.x = 2.2; layout.y = 1.0; layout.scale = 0.6;
    } else {                   // desktop: centered-right of the name
      layout.x = Math.min(4.2, 1.6 + aspect * 1.1); layout.y = 1.0; layout.scale = 0.68;
    }
    if (reduced) render(performance.now());
  }

  /* ---------- update ---------- */
  const clock = { start: performance.now(), last: performance.now(), intro: performance.now() };
  const tmpE = new THREE.Euler();
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new V3(), tmpP = new V3();

  function update(now) {
    const t = (now - clock.start) / 1000;
    const dt = Math.min(0.05, (now - clock.last) / 1000);
    clock.last = now;

    // pointer smoothing
    const k = 1 - Math.pow(0.001, dt);
    state.cx += (state.px - state.cx) * k * 0.9;
    state.cy += (state.py - state.cy) * k * 0.9;

    const p = state.hero;
    const e = smooth(0, 0.6, p);       // layers separate
    const d = smooth(0.3, 1, p);       // layers drift into the background
    const intro = reduced ? 1 : (now - clock.intro) / 1000;
    if (!reduced) updateMorph(Math.max(0, intro - 1.5));
    const breath = 1 - 0.07 * Math.sin(Math.PI * morph.w);

    // camera parallax
    camera.position.x = state.cx * 0.9;
    camera.position.y = 0.3 - state.cy * 0.55 - state.page * 2.2;
    camera.position.z = 12;
    lookAt.set(state.cx * 0.2, -state.page * 2.4, 0);
    camera.lookAt(lookAt);

    // core placement
    core.position.set(
      layout.x * (1 - d * 0.6),
      layout.y + d * 0.6 - state.page * 2.4,
      -d * 4,
    );
    core.scale.setScalar(layout.scale * (1 + e * 0.12) * breath);
    const spin = reduced ? 0.6 : t * 0.16;
    core.rotation.y = spin + state.cx * 0.35;
    core.rotation.x = 0.1 + state.cy * 0.12 + d * 0.15;

    slices.forEach((s, i) => {
      // intro: layers drop in, foundation first
      const a = reduced ? 1 : easeOut((intro - 0.25 - i * 0.16) / 1.0);
      const g = s.group;
      g.position.set(
        s.dir.x * d,
        s.baseY + s.dir.y * e + (1 - a) * 3.2,
        s.dir.z * d - d * 2.5 * (i % 2 ? 1 : 0.6),
      );
      g.rotation.y = s.spin * e * 1.4 + (reduced ? 0 : t * 0.25 * s.spin * d);
      g.rotation.x = s.tilt * d;
      g.rotation.z = s.tilt * 0.6 * d;

      // color focus (layer highlight driven by the project filters)
      s.color.lerp(s.target, k * 0.6);
      s.dim += (s.dimTarget - s.dim) * k * 0.6;
      const fade = a * (1 - d * 0.55) * s.dim;
      s.edgeMat.color.copy(s.color);
      s.haloMat.color.copy(s.color);
      s.sparkMat.color.copy(s.color);
      s.glassMat.uniforms.uRim.value.copy(s.color);
      if (state.light) {
        const lt = lightTone(s.color);
        s.edgeMat.color.multiplyScalar(lt);
        s.haloMat.color.multiplyScalar(lt);
        s.sparkMat.color.multiplyScalar(lt);
        s.glassMat.uniforms.uRim.value.multiplyScalar(lt);
      }
      s.edgeMat.opacity = 0.95 * fade;
      s.haloMat.opacity = 0.14 * fade * (1 + (s.dimTarget > 1 ? 0.8 : 0));
      s.sparkMat.opacity = 0.9 * fade;
      s.glassMat.uniforms.uOpacity.value = fade;
    });

    nested.forEach((n, j) => {
      const a = reduced ? 1 : easeOut((intro - 1.0 - j * 0.2) / 0.9);
      n.g.rotation.y = (reduced ? j : t * n.speed);
      const o = a * (1 - e * 0.85);
      n.em.opacity = 0.75 * o;
      n.hm.opacity = 0.1 * o;
      n.g.visible = o > 0.01;
    });

    radar.rotation.y = reduced ? 0 : -t * 0.12;
    const ra = reduced ? 1 : easeOut((intro - 0.1) / 1.2);
    radarMats.forEach((m, i) => { m.opacity = (0.26 - i * 0.06) * ra * (1 - e); });
    radar.visible = e < 0.99;

    // field
    fieldGroup.position.y = state.page * 7;          // parallax against content
    fieldGroup.rotation.y = state.cx * 0.05;
    for (let i = 0; i < field.length; i++) {
      const f = field[i];
      const tt = reduced ? 0 : t;
      tmpP.set(
        f.p.x + Math.sin(tt * 0.2 + f.phase) * f.amp,
        f.p.y + Math.cos(tt * 0.17 + f.phase) * f.amp * 1.4,
        f.p.z,
      );
      tmpQ.setFromEuler(tmpE.set(f.r.x + f.vr.x * tt, f.r.y + f.vr.y * tt, f.r.z + f.vr.z * tt));
      tmpS.setScalar(f.s);
      tmpM.compose(tmpP, tmpQ, tmpS);
      fieldEdges.setMatrixAt(i, tmpM);
      if (i < glassCount) fieldGlass.setMatrixAt(i, tmpM);
    }
    fieldEdges.instanceMatrix.needsUpdate = true;
    fieldGlass.instanceMatrix.needsUpdate = true;

    dust.rotation.y = reduced ? 0 : t * 0.008;
    dust.position.y = state.page * 4;
  }

  function render(now) {
    update(now);
    renderer.render(scene, camera);
  }

  /* ---------- loop with throttling ---------- */
  let raf = 0, frame = 0;
  const perf = { samples: 0, sum: 0, downgraded: false, last: 0 };
  function loop(now) {
    if (!state.running) return;
    raf = requestAnimationFrame(loop);
    frame++;
    // hero off-screen: the field keeps drifting at a third of the frame rate
    if (!state.heroVisible && frame % 3) return;
    render(now);
    if (state.heroVisible && !perf.downgraded) {
      if (perf.last) {
        perf.sum += now - perf.last; perf.samples++;
        if (perf.samples === 120) {
          if (perf.sum / perf.samples > 26) downgrade();
          perf.sum = 0; perf.samples = 0;
        }
      }
      perf.last = now;
    } else perf.last = 0;
  }
  // Slow device? Cut background detail first and keep the hero pyramid sharp;
  // only lower the resolution (gently) if it is still slow after that.
  perf.level = 0;
  function downgrade() {
    perf.level++;
    if (perf.level === 1) {
      fieldEdges.count = Math.round(fieldCount * 0.5);
      fieldGlass.count = Math.round(glassCount * 0.4);
      dust.geometry.setDrawRange(0, Math.round(dustCount * 0.4));
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    maxDpr = perf.level === 2 ? Math.min(dpr, 1.5) : Math.min(dpr, 1.25);
    renderer.setPixelRatio(maxDpr);
    resize();
    if (perf.level >= 3) perf.downgraded = true; // stop measuring
  }
  function start() {
    if (state.running || reduced) return;
    state.running = true;
    clock.last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    state.running = false;
    cancelAnimationFrame(raf);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  let rt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(resize, 120);
  });
  function setTheme(light) {
    state.light = light;
    themeMaterials(scene, light);
    const g = light ? LIGHT.ground : C.ground;
    renderer.setClearColor(g, 1);
    scene.fog.color.setHex(g);
    dust.material.opacity = light ? 0.4 : 0.55;
    render(performance.now()); // repaint now so a theme transition snapshot is correct
  }

  resize();
  if (isLight()) setTheme(true);

  if (reduced) {
    render(performance.now());
  } else {
    start();
  }

  canvas.classList.add('ready');

  /* ---------- public API ---------- */
  return {
    setTheme,
    skip(sec) { clock.intro -= sec * 1000; }, // testing only: jump ahead in the shape cycle
    replayIntro() { clock.intro = performance.now(); },
    setHero(p) { state.hero = clamp(p); if (reduced) render(performance.now()); },
    setPage(p) { state.page = clamp(p); },
    setPointer(x, y) { state.px = x; state.py = y; },
    setHeroVisible(v) { state.heroVisible = v; },
    focus(domain) {
      state.focus = domain && domain !== 'all' ? domain : null;
      slices.forEach((s) => {
        if (!state.focus) {
          s.target.copy(s.base); s.dimTarget = 1;
        } else if (s.domain === state.focus) {
          s.target.setHex(C[s.domain]); s.dimTarget = 1.25;
        } else {
          s.target.copy(s.base); s.dimTarget = 0.28;
        }
      });
      if (reduced) {
        slices.forEach((s) => { s.color.copy(s.target); s.dim = s.dimTarget; });
        render(performance.now());
      }
    },
  };
}

// small deterministic RNG so the field looks the same on every visit
function mulberry(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shared with the About knight (js/knight.js) so both scenes use the same look.
export { edgeGeometry, facesGeometry, glassMaterial, glowMaterial, sparkTexture, mulberry, themeMaterials, isLight };
