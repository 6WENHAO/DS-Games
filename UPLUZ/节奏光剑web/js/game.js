/* ============================================================
 * game.js — 节奏光剑 Web 版核心
 *   双光剑镜像操控 / 方向切割判定 / 连击倍率 / 能量条
 *   方块切半物理 / 火花粒子 / 剑光拖尾 / Bloom 泛光
 * ============================================================ */
"use strict";

/* ---------------- 常量 ---------------- */
const LANE_X = [-0.9, -0.3, 0.3, 0.9];
const ROW_Y = [0.85, 1.35, 1.85];
const SABER_Z = -1.6;
const SPAWN_DIST = 73.4;
const MISS_Z = -0.35;
const CUT_WINDOW = 1.15;
const CUT_RADIUS = 0.6;
const MIN_SPEED = 1.1;
const DIR_VEC = [
  [0, 1], [0, -1], [-1, 0], [1, 0],
  [-0.7071, 0.7071], [0.7071, 0.7071], [-0.7071, -0.7071], [0.7071, -0.7071], [0, 0]
];
const DIR_ROT = [0, Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4, 0];

/* ---------------- 全局 ---------------- */
let renderer, scene, camera, composer, clock;
let synth = null, player = null;
let env = null;
let saberL = null, saberR = null;
let envTex = null; // 金属反射环境贴图
const G = {
  state: "menu",
  songIdx: 0, song: null, meta: null,
  startAt: 0, t: -10, lastBeat: -1, lastCount: 99,
  noteIdx: 0, wallIdx: 0,
  notes: [], walls: [], halves: [], bursts: [], texts: [],
  score: 0, combo: 0, maxCombo: 0, judged: 0, hits: 0,
  level: 0, prog: 0, energy: 0.5,
  cumMax: [], totalNotes: 0,
  lean: 0, leanTarget: 0, shake: 0,
  hitZ: SABER_Z, hexL: "#ff2bd0", hexR: "#00e5ff",
  mouse: { x: 0.35, y: 0.3 },
  customIdx: null,
  auto: false,
  pausedByBlur: false
};

/* WebXR 状态 */
const XR = {
  supported: false, active: false, session: null,
  ctrlL: null, ctrlR: null, srcL: null, srcR: null,
  handL: null, handR: null, useHands: false, pinchL: 0, pinchR: 0,
  rays: [], menuGroup: null, menuPanels: [], hovered: -2,
  autoPanel: null, hoverAuto: false, reticle: null,
  hud: null, msg: null, hudTimer: 0, wallHapT: 0
};
const NEED = [2, 4, 8];
const MULT = [1, 2, 4, 8];

/* ---------------- DOM ---------------- */
const $ = id => document.getElementById(id);
const dom = {};
["menu", "cards", "hud", "score", "acc", "combo", "mult", "energy-fill", "progress-fill",
 "song-label", "countdown", "count-num", "pause", "results", "fail", "vignette", "flash",
 "rank", "r-score", "r-acc", "r-combo", "r-hits", "results-title", "fail-sub"]
  .forEach(id => dom[id.replace(/-/g, "_")] = $(id));
const multRing = document.querySelector("#mult-ring .fg");
const RING_C = 238.76;

/* ============================================================
 * 初始化
 * ============================================================ */
function initThree() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local-floor");
  document.body.insertBefore(renderer.domElement, document.body.firstChild);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 600);
  camera.position.set(0, 1.7, 0);

  scene.add(new THREE.AmbientLight(0x8890b0, 0.75));
  const dl = new THREE.DirectionalLight(0xffffff, 0.8);
  dl.position.set(2, 6, 3);
  scene.add(dl);

  try {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    const bloom = new THREE.UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight), 0.95, 0.55, 0.32);
    composer.addPass(bloom);
  } catch (e) { composer = null; console.warn("Bloom 不可用，使用普通渲染", e); }

  envTex = makeEnvMap();

  clock = new THREE.Clock();
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    if (composer) composer.setSize(innerWidth, innerHeight);
  });
}

/* ---------------- 纹理 ---------------- */
function makeTex(w, h, fn) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  fn(c.getContext("2d"), w, h);
  return new THREE.CanvasTexture(c);
}

/* 程序化生成演播室风格环境贴图（等距柱状 → PMREM），提供金属反光 */
function makeEnvMap() {
  try {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "#46507e");
    gr.addColorStop(0.42, "#151b30");
    gr.addColorStop(0.55, "#06080f");
    gr.addColorStop(1, "#020309");
    g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
    // 顶部环形灯带 + 侧向霓虹光源（磨砂金属高光来源）
    const streak = (x, y, w2, h2, col, blur) => {
      g.save();
      g.shadowColor = col; g.shadowBlur = blur;
      g.fillStyle = col;
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, w2, h2, h2 / 2); else g.rect(x, y, w2, h2);
      g.fill();
      g.restore();
    };
    streak(30, 28, 130, 12, "rgba(255,255,255,0.95)", 26);
    streak(220, 20, 90, 10, "rgba(255,255,255,0.85)", 22);
    streak(380, 32, 110, 12, "rgba(255,255,255,0.9)", 26);
    streak(80, 88, 70, 8, "rgba(255,120,230,0.8)", 20);
    streak(300, 96, 80, 8, "rgba(90,220,255,0.8)", 20);
    streak(440, 84, 50, 8, "rgba(255,210,120,0.7)", 18);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromEquirectangular(tex);
    tex.dispose();
    pmrem.dispose();
    return rt.texture;
  } catch (e) { console.warn("环境贴图生成失败", e); return null; }
}
let arrowTex, dotTex, glowTex, sparkTex, hotTex;
function initTextures() {
  arrowTex = makeTex(128, 128, g => {
    g.shadowColor = "rgba(255,255,255,0.9)"; g.shadowBlur = 12;
    g.fillStyle = "#fff";
    g.beginPath();
    g.moveTo(64, 18); g.lineTo(102, 62); g.lineTo(78, 62);
    g.lineTo(78, 110); g.lineTo(50, 110); g.lineTo(50, 62); g.lineTo(26, 62);
    g.closePath(); g.fill();
  });
  dotTex = makeTex(128, 128, g => {
    g.shadowColor = "rgba(255,255,255,0.9)"; g.shadowBlur = 12;
    g.fillStyle = "#fff";
    g.beginPath(); g.arc(64, 64, 21, 0, Math.PI * 2); g.fill();
  });
  glowTex = makeTex(128, 128, g => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.35, "rgba(255,255,255,0.35)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
  sparkTex = makeTex(64, 64, g => {
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  });
  // 切割断面：边缘高亮 + 熔融微光
  hotTex = makeTex(128, 128, g => {
    const gr = g.createRadialGradient(64, 64, 8, 64, 64, 84);
    gr.addColorStop(0, "rgba(255,255,255,0.5)");
    gr.addColorStop(0.7, "rgba(255,255,255,0.18)");
    gr.addColorStop(1, "rgba(255,255,255,0.05)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.lineWidth = 9;
    g.strokeStyle = "rgba(255,255,255,1)";
    g.shadowColor = "#fff"; g.shadowBlur = 16;
    g.strokeRect(5, 5, 118, 118);
    g.strokeRect(5, 5, 118, 118);
  });
}

/* ============================================================
 * 光剑（含主题化剑柄 + 拖尾）
 * ============================================================ */
class Trail {
  constructor(color) {
    this.N = 14;
    this.pts = [];
    const pos = new Float32Array(this.N * 2 * 3);
    const col = new Float32Array(this.N * 2 * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < this.N; i++) {
      const k = Math.pow(1 - i / (this.N - 1), 1.7) * 0.85;
      for (let j = 0; j < 2; j++) {
        col[(i * 2 + j) * 3] = c.r * k;
        col[(i * 2 + j) * 3 + 1] = c.g * k;
        col[(i * 2 + j) * 3 + 2] = c.b * k;
      }
    }
    const idx = [];
    for (let i = 0; i < this.N - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    this.mesh.frustumCulled = false;
    this.inited = false;
  }
  update(tip, base) {
    if (!this.inited) {
      for (let i = 0; i < this.N; i++) this.pts.push({ t: tip.clone(), b: base.clone() });
      this.inited = true;
    }
    this.pts.pop();
    this.pts.unshift({ t: tip.clone(), b: base.clone() });
    const p = this.geo.attributes.position.array;
    for (let i = 0; i < this.N; i++) {
      const o = i * 6;
      p[o] = this.pts[i].t.x; p[o + 1] = this.pts[i].t.y; p[o + 2] = this.pts[i].t.z;
      p[o + 3] = this.pts[i].b.x; p[o + 4] = this.pts[i].b.y; p[o + 5] = this.pts[i].b.z;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

class Saber {
  constructor(hand, color, style) {
    this.hand = hand;
    this.color = color;
    this.style = style;
    this.pos = new THREE.Vector3(hand === "L" ? -0.5 : 0.5, 1.15, SABER_Z);
    this.prev = this.pos.clone();
    this.vel = new THREE.Vector3();
    this.speed = 0;
    this.rx = -0.45; this.rz = 0;

    const g = new THREE.Group();
    // 剑柄
    const handleGeo = style === "neon"
      ? new THREE.CylinderGeometry(0.034, 0.042, 0.3, 6)
      : new THREE.CylinderGeometry(0.034, 0.04, 0.3, 16);
    const handle = new THREE.Mesh(handleGeo, new THREE.MeshLambertMaterial({ color: 0x181820 }));
    handle.position.y = 0;
    g.add(handle);
    const accent = style === "ink" ? 0xd8b45a : color;
    [[0.145, 0.045], [-0.13, 0.042]].forEach(([y, r]) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.009, 8, 24),
        new THREE.MeshBasicMaterial({ color: accent })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      g.add(ring);
    });
    if (style === "ink") { // 剑穗
      const tassel = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.14, 0.02),
        new THREE.MeshLambertMaterial({ color: 0xbb2222 })
      );
      tassel.position.y = -0.24;
      g.add(tassel);
      this.tassel = tassel;
    }
    // 剑刃
    const BL = 1.05, by = 0.15 + BL / 2;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, BL, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    core.position.y = by; g.add(core);
    this.glow1 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, BL * 1.01, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.glow1.position.y = by; g.add(this.glow1);
    this.glow2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, BL * 1.03, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.glow2.position.y = by; g.add(this.glow2);
    const tipGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    tipGlow.scale.set(0.3, 0.3, 1);
    tipGlow.position.y = 0.15 + BL;
    g.add(tipGlow);
    if (style === "space") { // 星尘
      const n = 10, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 0.16;
        pos[i * 3 + 1] = 0.2 + Math.random() * BL;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.16;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      this.dust = new THREE.Points(sg, new THREE.PointsMaterial({
        map: sparkTex, color: 0xffffff, size: 0.07, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      g.add(this.dust);
    }
    this.light = new THREE.PointLight(color, 1.1, 7);
    this.light.position.y = by;
    g.add(this.light);

    g.position.copy(this.pos);
    g.rotation.x = this.rx;
    this.group = g;
    this.trail = new Trail(color);
    scene.add(g);
    scene.add(this.trail.mesh);
    this.tipV = new THREE.Vector3();
    this.baseV = new THREE.Vector3();
    this.prevTipV = new THREE.Vector3();
    this.prevBaseV = new THREE.Vector3();
    this._vrInit = false;
  }
  attachTo(parent, vr) {
    if (this.group.parent) this.group.parent.remove(this.group);
    parent.add(this.group);
    if (vr) {
      this.group.position.set(0, 0, -0.03);
      this.group.rotation.set(-Math.PI / 2, 0, 0); // 剑刃沿手柄指向
      this._vrInit = false;
    }
  }
  _fx(dt) {
    if (this.style === "neon") {
      this.glow1.material.opacity = 0.48 + Math.random() * 0.16;
      this.glow2.material.opacity = 0.13 + Math.random() * 0.07;
    }
    if (this.dust) {
      this.dust.rotation.y += dt * 3;
      this.dust.material.opacity = 0.5 + 0.4 * Math.sin(performance.now() * 0.006);
    }
    if (this.tassel) this.tassel.rotation.z = THREE.MathUtils.clamp(this.vel.x * 0.06, -0.9, 0.9);
  }
  _sampleBlade() {
    this.prevTipV.copy(this.tipV);
    this.prevBaseV.copy(this.baseV);
    this.group.updateMatrixWorld(true);
    this.tipV.set(0, 1.22, 0); this.group.localToWorld(this.tipV);
    this.baseV.set(0, 0.05, 0); this.group.localToWorld(this.baseV);
    if (!this._vrInit) {
      this.prevTipV.copy(this.tipV);
      this.prevBaseV.copy(this.baseV);
      this._vrInit = true;
    }
  }
  update(dt, tx, ty) { // 桌面鼠标模式
    this.prev.copy(this.pos);
    const k = 1 - Math.exp(-dt * 28);
    this.pos.x += (tx - this.pos.x) * k;
    this.pos.y += (ty - this.pos.y) * k;
    this.vel.set((this.pos.x - this.prev.x) / dt, (this.pos.y - this.prev.y) / dt, 0);
    this.speed = this.vel.length();
    this.group.position.copy(this.pos);
    const trx = -0.45 + THREE.MathUtils.clamp(this.vel.y * 0.035, -0.45, 0.45);
    const trz = THREE.MathUtils.clamp(-this.vel.x * 0.04, -0.6, 0.6);
    const rk = 1 - Math.exp(-dt * 14);
    this.rx += (trx - this.rx) * rk;
    this.rz += (trz - this.rz) * rk;
    this.group.rotation.set(this.rx, 0, this.rz);
    this._sampleBlade();
    this.trail.update(this.tipV, this.baseV);
    this._fx(dt);
  }
  updateVR(dt) { // VR 手柄模式
    this._sampleBlade();
    this.vel.subVectors(this.tipV, this.prevTipV).divideScalar(dt || 1e-4);
    this.speed = this.vel.length();
    this.trail.update(this.tipV, this.baseV);
    this._fx(dt);
  }
  updateFromHand(dt, hand) { // Vision Pro 手部追踪模式
    if (hand && hand.joints) {
      const w = hand.joints["wrist"];
      const m = hand.joints["middle-finger-metacarpal"] || hand.joints["middle-finger-phalanx-proximal"];
      if (w && m) {
        _hw.setFromMatrixPosition(w.matrixWorld);
        _hm.setFromMatrixPosition(m.matrixWorld);
        _hd.subVectors(_hm, _hw);
        if (_hd.lengthSq() > 1e-8) {
          _hd.normalize();
          this.group.position.copy(_hm);
          _hq.setFromUnitVectors(_yUp, _hd); // 剑刃沿腕→掌方向（前臂延伸）
          this.group.quaternion.slerp(_hq, 1 - Math.exp(-dt * 30));
        }
      }
    }
    this._sampleBlade();
    this.vel.subVectors(this.tipV, this.prevTipV).divideScalar(dt || 1e-4);
    this.speed = this.vel.length();
    this.trail.update(this.tipV, this.baseV);
    this._fx(dt);
  }
  dispose() {
    if (this.group.parent) this.group.parent.remove(this.group);
    scene.remove(this.trail.mesh);
    this.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.trail.geo.dispose();
    this.trail.mesh.material.dispose();
  }
}

/* ============================================================
 * 方块 / 炸弹 / 光墙
 * ============================================================ */
let noteGeo, arrowGeo, faceGlowGeo, bombGeo, halfGeo, hotGeo;
let matL, matR, arrowMat, dotMat, arrowGlowMat, dotGlowMat, bombMat, wallMat;
function initSongAssets(meta) {
  const RB = THREE.RoundedBoxGeometry;
  noteGeo = noteGeo || (RB ? new RB(0.5, 0.5, 0.5, 4, 0.075) : new THREE.BoxGeometry(0.5, 0.5, 0.5));
  halfGeo = halfGeo || (RB ? new RB(0.5, 0.24, 0.5, 3, 0.05) : new THREE.BoxGeometry(0.5, 0.24, 0.5));
  arrowGeo = arrowGeo || new THREE.PlaneGeometry(0.32, 0.32);
  faceGlowGeo = faceGlowGeo || new THREE.PlaneGeometry(0.42, 0.42);
  bombGeo = bombGeo || new THREE.IcosahedronGeometry(0.23, 1);
  hotGeo = hotGeo || new THREE.PlaneGeometry(0.46, 0.46);
  const dim = c => new THREE.Color(c).multiplyScalar(0.55);
  const metal = c => new THREE.MeshStandardMaterial({
    color: dim(c), metalness: 0.88, roughness: 0.42,          // 金属磨砂
    envMap: envTex, envMapIntensity: 1.35,
    emissive: c, emissiveIntensity: 0.3
  });
  matL = metal(meta.colorL);
  matR = metal(meta.colorR);
  arrowMat = new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true, depthWrite: false });
  dotMat = new THREE.MeshBasicMaterial({ map: dotTex, transparent: true, depthWrite: false });
  // 箭头辉光层（叠加发光）
  arrowGlowMat = new THREE.MeshBasicMaterial({
    map: arrowTex, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  dotGlowMat = new THREE.MeshBasicMaterial({
    map: dotTex, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  bombMat = new THREE.MeshStandardMaterial({
    color: 0x0d0d13, metalness: 0.92, roughness: 0.32,
    envMap: envTex, envMapIntensity: 1.1,
    emissive: 0x330000, emissiveIntensity: 1
  });
  wallMat = new THREE.MeshBasicMaterial({ color: 0xff2233, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
}

function spawnNote(d) {
  const g = new THREE.Group();
  if (d.type === 3) {
    g.add(new THREE.Mesh(bombGeo, bombMat));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xff2200, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(0.7, 0.7, 1);
    g.add(glow);
  } else {
    g.add(new THREE.Mesh(noteGeo, d.type === 0 ? matL : matR));
    const rot = DIR_ROT[d.dir];
    const face = new THREE.Mesh(arrowGeo, d.dir === 8 ? dotMat : arrowMat);
    face.position.z = 0.258;
    face.rotation.z = rot;
    g.add(face);
    const halo = new THREE.Mesh(faceGlowGeo, d.dir === 8 ? dotGlowMat : arrowGlowMat);
    halo.position.z = 0.254;
    halo.rotation.z = rot;
    g.add(halo);
  }
  g.position.set(LANE_X[d.x], ROW_Y[d.y], G.hitZ - SPAWN_DIST);
  g.userData.spin = (Math.random() - 0.5) * 1.4;
  scene.add(g);
  G.notes.push({ d, g, cut: false, missed: false });
}

function spawnWall(w) {
  const len = w.dur * G.meta.speed;
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.9, len), wallMat);
  const edge = new THREE.LineSegments(
    new THREE.EdgesGeometry(m.geometry),
    new THREE.LineBasicMaterial({ color: 0xff5566, transparent: true, opacity: 0.6 })
  );
  m.add(edge);
  m.position.set(w.side * 0.58, 1.55, G.hitZ - SPAWN_DIST);
  scene.add(m);
  G.walls.push({ w, m, len });
}

/* ---------------- 切割特效 ---------------- */
function spawnHalves(note, angle, sp, good) {
  const src = note.d.type === 0 ? matL : matR;
  const noteCol = note.d.type === 0 ? G.meta.colorL : G.meta.colorR;
  const nx = -Math.sin(angle), ny = Math.cos(angle);
  for (let s = -1; s <= 1; s += 2) {
    const grp = new THREE.Group();
    const mat = src.clone();
    mat.transparent = true;
    if (!good) mat.emissiveIntensity = 0.12;
    grp.add(new THREE.Mesh(halfGeo, mat));
    // 断面：熔融高亮边缘
    const hotBase = good ? 1 : 0.35;
    const hotMat = new THREE.MeshBasicMaterial({
      map: hotTex, transparent: true, opacity: hotBase,
      color: new THREE.Color(noteCol).lerp(new THREE.Color(0xffffff), good ? 0.6 : 0.15),
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const hot = new THREE.Mesh(hotGeo, hotMat);
    hot.rotation.x = s * Math.PI / 2;   // 朝向切割断面
    hot.position.y = -s * 0.122;
    grp.add(hot);
    grp.position.copy(note.g.position);
    grp.rotation.z = angle;
    grp.position.x += nx * 0.13 * s;
    grp.position.y += ny * 0.13 * s;
    G.halves.push({
      m: grp, mat, hotMat, hotBase,
      vx: nx * s * (1.6 + sp * 0.25) + (Math.random() - 0.5),
      vy: ny * s * (1.6 + sp * 0.25) + 1.2,
      vz: 3.5 + Math.random() * 2,
      rx: (Math.random() - 0.5) * 9, rz: (Math.random() - 0.5) * 9,
      life: 0.7
    });
    scene.add(grp);
  }
}

function spawnBurst(pos, color, n = 14, size = 0.12, spd = 5) {
  const posArr = new Float32Array(n * 3);
  const vels = [];
  for (let i = 0; i < n; i++) {
    posArr[i * 3] = pos.x; posArr[i * 3 + 1] = pos.y; posArr[i * 3 + 2] = pos.z;
    const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.5) * Math.PI;
    const v = spd * (0.4 + Math.random() * 0.6);
    vels.push(new THREE.Vector3(Math.cos(a) * Math.cos(b) * v, Math.sin(b) * v + 1, Math.sin(a) * Math.cos(b) * v * 0.5 + 2));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({
    map: sparkTex, color, size, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  scene.add(pts);
  G.bursts.push({ pts, vels, life: 0.45, max: 0.45 });
  const flash = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  flash.position.copy(pos);
  flash.scale.set(0.3, 0.3, 1);
  scene.add(flash);
  G.texts.push({ sp: flash, life: 0.16, max: 0.16, rise: 0, grow: 9 });
}

function spawnText(pos, str, color) {
  const c = document.createElement("canvas");
  c.width = 192; c.height = 96;
  const g = c.getContext("2d");
  g.font = "bold 56px 'Avenir Next','PingFang SC',sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = color; g.shadowBlur = 16;
  g.fillStyle = color;
  g.fillText(str, 96, 48);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, opacity: 1, depthWrite: false
  }));
  sp.position.copy(pos);
  sp.position.z += 0.3;
  sp.scale.set(0.85, 0.42, 1);
  scene.add(sp);
  G.texts.push({ sp, life: 0.75, max: 0.75, rise: 1.1, grow: 0, tex });
}

/* ============================================================
 * 判定与计分
 * ============================================================ */
function multNeed() { return G.level < 3 ? NEED[G.level] : Infinity; }

function addCombo() {
  G.combo++;
  G.maxCombo = Math.max(G.maxCombo, G.combo);
  G.prog++;
  if (G.prog >= multNeed()) { G.level = Math.min(3, G.level + 1); G.prog = 0; }
  dom.combo.textContent = G.combo;
  dom.combo.classList.remove("pop");
  void dom.combo.offsetWidth;
  dom.combo.classList.add("pop");
}
function breakCombo() {
  G.combo = 0;
  G.level = Math.max(0, G.level - 1);
  G.prog = 0;
  dom.combo.textContent = "0";
}
function addEnergy(v) {
  if (G.auto && v < 0) return; // 纯享模式永不失败
  G.energy = THREE.MathUtils.clamp(G.energy + v, 0, 1);
  dom.energy_fill.style.width = (G.energy * 100) + "%";
  dom.energy_fill.classList.toggle("low", G.energy < 0.3);
  if (v < 0) {
    dom.vignette.style.opacity = Math.min(1, -v * 8);
    setTimeout(() => { if (G.state === "playing") dom.vignette.style.opacity = 0; }, 150);
  }
  if (G.energy <= 0 && G.state === "playing") failSong();
}
function updateHUD() {
  dom.score.textContent = G.score.toLocaleString();
  const accMax = G.judged > 0 ? G.cumMax[Math.min(G.judged, G.cumMax.length - 1)] : 0;
  dom.acc.textContent = accMax > 0 ? ((G.score / accMax) * 100).toFixed(1) + "%" : "100.0%";
  dom.mult.textContent = "x" + MULT[G.level];
  const frac = G.level >= 3 ? 1 : G.prog / multNeed();
  multRing.style.strokeDashoffset = RING_C * (1 - frac);
}

function haptic(src, amp, ms) {
  try {
    if (src && src.gamepad && src.gamepad.hapticActuators && src.gamepad.hapticActuators[0])
      src.gamepad.hapticActuators[0].pulse(amp, ms);
  } catch (e) { /* 忽略不支持震动的设备 */ }
}
function saberHaptic(saber, amp, ms) {
  if (!XR.active) return;
  haptic(saber.hand === "L" ? XR.srcL : XR.srcR, amp, ms);
}

/* ---------------- 纯享模式：光剑自动演示 ---------------- */
function autoAim(saber, t) {
  const type = saber.hand === "L" ? 0 : 1;
  let target = null;
  for (const n of G.notes) {
    if (n.cut || n.missed || n.d.type !== type) continue;
    if (!target || n.d.t < target.d.t) target = n;
  }
  if (!target || target.d.t - t > 1.6) {
    const ix = saber.hand === "L" ? -0.55 : 0.55;
    const ph = type ? 1.7 : 0;
    return { x: ix + Math.sin(t * 1.3 + ph) * 0.14, y: 1.15 + Math.sin(t * 1.8 + ph) * 0.09 };
  }
  const d = target.d;
  const nx = LANE_X[d.x], ny = ROW_Y[d.y];
  const dv = DIR_VEC[d.dir === 8 ? 1 : d.dir]; // 圆点按下切处理
  if (d.t - t > 0.05) {
    return { x: nx - dv[0] * 0.55, y: ny - dv[1] * 0.55 }; // 预备位
  }
  return { x: nx + dv[0] * 0.85, y: ny + dv[1] * 0.85 };  // 挥砍穿过
}

function goodCut(note, saber, dist) {
  const sp = saber.speed;
  const pts = Math.round(70 + Math.min(30, sp * 3.4) + Math.max(0, 1 - dist / CUT_RADIUS) * 15);
  G.score += pts * MULT[G.level];
  G.judged++; G.hits++;
  addCombo();
  addEnergy(0.012);
  const angle = Math.atan2(saber.vel.y, saber.vel.x);
  spawnHalves(note, angle, sp, true);
  spawnBurst(note.g.position, saber.color, 16, 0.13, 5.5);
  spawnText(note.g.position, String(pts), pts >= 108 ? "#ffd76e" : (pts >= 95 ? "#ffffff" : "#9fb0ff"));
  synth.sfxSlash(saber.hand === "L" ? -0.4 : 0.4);
  saberHaptic(saber, 0.55, 60);
  G.shake = Math.min(0.5, G.shake + 0.12);
  removeNote(note);
  updateHUD();
}
function badCut(note, saber) {
  G.judged++;
  breakCombo();
  addEnergy(-0.08);
  const angle = Math.atan2(saber.vel.y, saber.vel.x);
  spawnHalves(note, angle, saber.speed, false);
  spawnText(note.g.position, "×", "#ff5566");
  synth.sfxBad();
  saberHaptic(saber, 0.9, 130);
  removeNote(note);
  updateHUD();
}
function missNote(note) {
  note.missed = true;
  G.judged++;
  breakCombo();
  addEnergy(-0.1);
  spawnText(note.g.position, "MISS", "#ff5566");
  synth.sfxMiss();
  updateHUD();
}
function bombHit(note) {
  breakCombo();
  addEnergy(-0.15);
  spawnBurst(note.g.position, 0xff3300, 22, 0.16, 7);
  synth.sfxBomb();
  if (XR.active) { haptic(XR.srcL, 1, 250); haptic(XR.srcR, 1, 250); }
  G.shake = 0.8;
  removeNote(note);
  updateHUD();
}
function removeNote(note) {
  note.cut = true;
  scene.remove(note.g);
}

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = THREE.MathUtils.clamp(t, 0, 1);
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
const _sv1 = new THREE.Vector3(), _sv2 = new THREE.Vector3(), _sv3 = new THREE.Vector3();
const _hw = new THREE.Vector3(), _hm = new THREE.Vector3(), _hd = new THREE.Vector3();
const _hq = new THREE.Quaternion(), _yUp = new THREE.Vector3(0, 1, 0);
function distPointSeg3(p, a, b) {
  _sv1.subVectors(b, a);
  const l2 = _sv1.lengthSq();
  let t = l2 > 0 ? _sv2.subVectors(p, a).dot(_sv1) / l2 : 0;
  t = THREE.MathUtils.clamp(t, 0, 1);
  _sv3.copy(a).addScaledVector(_sv1, t);
  return _sv3.distanceTo(p);
}

function checkCuts() {
  const vr = XR.active && !G.auto; // 纯享模式统一用平面扫掠判定
  const minSpeed = vr ? 0.9 : MIN_SPEED;
  const radius = vr ? 0.5 : CUT_RADIUS;
  for (const saber of [saberL, saberR]) {
    for (const note of G.notes) {
      if (note.cut || note.missed) continue;
      const z = note.g.position.z;
      let d;
      if (vr) {
        if (z < G.hitZ - 2 || z > 0.8) continue;
        d = Math.min(
          distPointSeg3(note.g.position, saber.baseV, saber.tipV),
          distPointSeg3(note.g.position, saber.prevBaseV, saber.prevTipV)
        );
      } else {
        if (Math.abs(z - G.hitZ) > CUT_WINDOW) continue;
        d = distToSeg(
          note.g.position.x, note.g.position.y,
          saber.prev.x, saber.prev.y, saber.pos.x, saber.pos.y
        );
      }
      if (note.d.type === 3) {
        if (!G.auto && d < 0.42) bombHit(note); // 纯享模式不碰炸弹
        continue;
      }
      if (d > radius || saber.speed < minSpeed) continue;
      const typeOK = (saber.hand === "L") === (note.d.type === 0);
      let dirOK = true;
      if (note.d.dir !== 8) {
        const dv = DIR_VEC[note.d.dir];
        const vxy = Math.hypot(saber.vel.x, saber.vel.y) || 1;
        const dot = (saber.vel.x * dv[0] + saber.vel.y * dv[1]) / vxy;
        dirOK = dot > 0.42; // ~65°
      }
      if (typeOK && dirOK) goodCut(note, saber, d * (CUT_RADIUS / radius));
      else badCut(note, saber);
    }
  }
}

/* ============================================================
 * 流程控制
 * ============================================================ */
function ensureAudio() {
  if (!synth) { synth = new Synth(); player = new MusicPlayer(synth); }
  if (synth.ctx.state === "suspended") synth.ctx.resume();
}

function startSong(idx) {
  ensureAudio();
  G.songIdx = idx;
  G.meta = SONGS[idx];
  G.song = G.meta.build();
  G.hitZ = XR.active ? -0.65 : SABER_Z; // VR 中判定面在手部自然位置
  initSongAssets(G.meta);
  clearPlayfield();

  if (env) env.dispose();
  env = createEnv(G.meta.env, scene, G.meta.colorL, G.meta.colorR);
  // 倒计时期间预热方块着色器（微缩渲染 1 次，避免首块出现时掉帧）
  if (G.warm) scene.remove(G.warm);
  G.warm = new THREE.Group();
  [matL, matR, bombMat].forEach((m, i) => {
    const w = new THREE.Mesh(noteGeo, m);
    w.position.x = (i - 1) * 0.01;
    G.warm.add(w);
  });
  G.warm.scale.setScalar(0.001);
  G.warm.position.set(0, 1.6, -6);
  scene.add(G.warm);
  if (saberL) saberL.dispose();
  if (saberR) saberR.dispose();
  saberL = new Saber("L", G.meta.colorL, G.meta.env);
  saberR = new Saber("R", G.meta.colorR, G.meta.env);
  if (G.auto) {
    saberL.pos.z = saberR.pos.z = G.hitZ; // 自动演示：世界空间自主挥剑
  } else if (XR.active && !XR.useHands) {
    if (XR.ctrlL) saberL.attachTo(XR.ctrlL, true);
    if (XR.ctrlR) saberR.attachTo(XR.ctrlR, true);
  }

  // 主题色注入 UI
  const hexL = "#" + G.meta.colorL.toString(16).padStart(6, "0");
  const hexR = "#" + G.meta.colorR.toString(16).padStart(6, "0");
  G.hexL = hexL; G.hexR = hexR;
  document.documentElement.style.setProperty("--pl", hexL);
  document.documentElement.style.setProperty("--pr", hexR);

  // 计分
  G.score = 0; G.combo = 0; G.maxCombo = 0; G.judged = 0; G.hits = 0;
  G.level = 0; G.prog = 0; G.energy = 0.5;
  G.noteIdx = 0; G.wallIdx = 0; G.lastBeat = -1; G.lastCount = 99;
  G.lean = 0; G.leanTarget = 0; G.shake = 0;
  G.totalNotes = G.song.notes.filter(n => n.type !== 3).length;
  G.cumMax = [0];
  for (let i = 1; i <= G.totalNotes; i++) {
    const m = i <= 2 ? 1 : i <= 6 ? 2 : i <= 14 ? 4 : 8;
    G.cumMax.push(G.cumMax[i - 1] + 115 * m);
  }

  dom.song_label.innerHTML = `《${G.meta.name}》<small>${G.meta.style} · ${G.meta.bpm} BPM${G.auto ? " · 纯享演示" : ""}</small>`;
  dom.energy_fill.style.width = "50%";
  dom.combo.textContent = "0";
  updateHUD();

  dom.menu.classList.add("hidden");
  dom.results.classList.add("hidden");
  dom.fail.classList.add("hidden");
  dom.pause.classList.add("hidden");
  dom.hud.classList.remove("hidden");
  dom.countdown.classList.remove("hidden");
  dom.count_num.textContent = "";
  if (!XR.active && !G.auto) document.body.classList.add("playing-cursor");
  if (XR.active) {
    XR.menuGroup.visible = false;
    setRayVisible(false);
    XR.hud.mesh.visible = true;
    hideVRMsg();
    drawVRHUD();
  }

  player.load(G.song.events);
  if (G.song.buffer) player.loadBuffer(G.song.buffer);
  G.startAt = synth.ctx.currentTime + 3.6;
  player.start(G.startAt);
  G.state = "playing";
}

function clearPlayfield() {
  G.notes.forEach(n => scene.remove(n.g));
  G.walls.forEach(w => { scene.remove(w.m); w.m.geometry.dispose(); });
  G.halves.forEach(h => { scene.remove(h.m); h.mat.dispose(); h.hotMat.dispose(); });
  G.bursts.forEach(b => { scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); });
  G.texts.forEach(t => { scene.remove(t.sp); if (t.tex) t.tex.dispose(); t.sp.material.dispose(); });
  G.notes = []; G.walls = []; G.halves = []; G.bursts = []; G.texts = [];
}

/* VR 内操作提示（手柄 / 手势自适应） */
function xrHint(primary, secondary) {
  return XR.useHands
    ? `右手捏合 ${primary} · 左手捏合 ${secondary}`
    : `扳机 ${primary} · 握把 ${secondary}`;
}

function pauseSong() {
  if (G.state !== "playing") return;
  G.state = "paused";
  synth.ctx.suspend();
  dom.pause.classList.remove("hidden");
  document.body.classList.remove("playing-cursor");
  if (XR.active) drawVRMsg(["已暂停", xrHint("继续", "返回菜单")]);
}
function resumeSong() {
  if (G.state !== "paused") return;
  G.state = "playing";
  synth.ctx.resume();
  dom.pause.classList.add("hidden");
  if (!XR.active) document.body.classList.add("playing-cursor");
  else hideVRMsg();
}
function quitToMenu() {
  if (player) player.stop();
  dom.vignette.style.opacity = 0;
  clearPlayfield();
  if (env) { env.dispose(); env = null; }
  if (saberL) { saberL.dispose(); saberL = null; }
  if (saberR) { saberR.dispose(); saberR = null; }
  dom.hud.classList.add("hidden");
  dom.pause.classList.add("hidden");
  dom.results.classList.add("hidden");
  dom.fail.classList.add("hidden");
  dom.countdown.classList.add("hidden");
  document.body.classList.remove("playing-cursor");
  if (synth && synth.ctx.state === "suspended") synth.ctx.resume();
  if (XR.active) {
    G.state = "vrmenu";
    showVRMenu();
  } else {
    G.state = "menu";
    dom.menu.classList.remove("hidden");
  }
}
function failSong() {
  G.state = "failed";
  player.stop();
  dom.vignette.style.opacity = 0;
  dom.fail_sub.textContent = `完成度 ${Math.round(G.t / G.song.duration * 100)}% · 得分 ${G.score.toLocaleString()}`;
  dom.fail.classList.remove("hidden");
  document.body.classList.remove("playing-cursor");
  synth.sfxBomb();
  if (XR.active) drawVRMsg([
    "能量耗尽",
    `完成度 ${Math.round(G.t / G.song.duration * 100)}% · 得分 ${G.score.toLocaleString()}`,
    xrHint("重试", "返回菜单")
  ]);
}
function finishSong() {
  G.state = "results";
  const accMax = G.cumMax[G.totalNotes] || 1;
  const acc = G.score / accMax;
  const rank = acc >= 0.95 ? "SS" : acc >= 0.9 ? "S" : acc >= 0.8 ? "A" : acc >= 0.65 ? "B" : acc >= 0.5 ? "C" : "D";
  const fc = G.hits === G.totalNotes && G.totalNotes > 0;
  dom.results_title.textContent = (G.auto ? "纯享演示 · " : "") + (fc ? "全连击！FULL COMBO" : "通关！");
  dom.rank.textContent = rank;
  dom.r_score.textContent = G.score.toLocaleString();
  dom.r_acc.textContent = (acc * 100).toFixed(1) + "%";
  dom.r_combo.textContent = G.maxCombo;
  dom.r_hits.textContent = `${G.hits} / ${G.totalNotes}`;
  dom.results.classList.remove("hidden");
  document.body.classList.remove("playing-cursor");
  if (XR.active) drawVRMsg([
    (G.auto ? "纯享演示 · " : "") + (fc ? "全连击！FULL COMBO" : "通关！"),
    `评级 ${rank} · 得分 ${G.score.toLocaleString()}`,
    `准确率 ${(acc * 100).toFixed(1)}% · 最高连击 ${G.maxCombo}`,
    xrHint("再来一次", "返回菜单")
  ]);
}

/* ============================================================
 * 主循环
 * ============================================================ */
const _target = new THREE.Vector3();
function mouseToWorld() {
  const v = _target.set(G.mouse.x, G.mouse.y, 0.5).unproject(camera);
  const dir = v.sub(camera.position).normalize();
  const k = (SABER_Z - camera.position.z) / dir.z;
  return {
    x: THREE.MathUtils.clamp(camera.position.x + dir.x * k, -2.6, 2.6),
    y: THREE.MathUtils.clamp(camera.position.y + dir.y * k, 0.15, 2.9)
  };
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.state === "menu") return;
  const time = performance.now() * 0.001;

  if (G.state === "vrmenu") {
    updateVRMenuHover();
    renderer.render(scene, camera);
    return;
  }

  if (G.state === "playing") {
    G.t = synth.ctx.currentTime - G.startAt;
    const t = G.t;

    // 倒计时
    if (t < 0.6) {
      const n = Math.ceil(-t - 0.15);
      if (n !== G.lastCount) {
        G.lastCount = n;
        if (n >= 1 && n <= 3) {
          dom.count_num.textContent = n;
          dom.count_num.style.animation = "none";
          void dom.count_num.offsetWidth;
          dom.count_num.style.animation = "";
          synth.sfxCount(false);
          if (XR.active) drawVRMsg([String(n)], true);
        } else if (n === 0) {
          dom.count_num.textContent = "GO!";
          dom.count_num.style.animation = "none";
          void dom.count_num.offsetWidth;
          dom.count_num.style.animation = "";
          synth.sfxCount(true);
          if (XR.active) drawVRMsg(["GO!"], true);
        }
      }
    } else if (!dom.countdown.classList.contains("hidden")) {
      dom.countdown.classList.add("hidden");
      if (XR.active) hideVRMsg();
    }

    // 节拍脉冲（自定义歌曲带相位偏移）
    if (t >= 0) {
      const beat = Math.floor((t - (G.song.beatOffset || 0)) / G.song.spb);
      if (beat !== G.lastBeat) { G.lastBeat = beat; if (env) env.onBeat(beat); }
    }
    if (G.warm && t > -1.5) { scene.remove(G.warm); G.warm = null; }

    // 生成
    const ahead = SPAWN_DIST / G.meta.speed;
    const ns = G.song.notes;
    while (G.noteIdx < ns.length && ns[G.noteIdx].t - t < ahead) spawnNote(ns[G.noteIdx++]);
    const ws = G.song.walls;
    while (G.wallIdx < ws.length && ws[G.wallIdx].t - t < ahead) spawnWall(ws[G.wallIdx++]);

    // 方块运动
    for (let i = G.notes.length - 1; i >= 0; i--) {
      const n = G.notes[i];
      const z = G.hitZ + (t - n.d.t) * G.meta.speed;
      n.g.position.z = z;
      const born = (z - (G.hitZ - SPAWN_DIST)) / 14;
      if (born < 1) {
        const e = Math.max(0, Math.min(1, born));
        const s = 0.45 + 0.55 * e;
        n.g.scale.set(s, s, s);
        n.g.rotation.z = n.g.userData.spin * (1 - e);
      } else if (n.g.scale.x !== 1) {
        n.g.scale.set(1, 1, 1);
        n.g.rotation.z = 0;
      }
      if (n.d.type === 3) n.g.rotation.y += dt * 2;
      const missZ = XR.active ? 0.35 : MISS_Z;
      if (!n.cut && !n.missed && n.d.type !== 3 && z > missZ) missNote(n);
      if (!n.cut && n.d.type === 3 && z > 1.5) { n.cut = true; scene.remove(n.g); }
      if ((n.cut || n.missed) && z > 2.5) { scene.remove(n.g); G.notes.splice(i, 1); }
      else if (n.cut && n.d.type !== 3 && !n.missed) { G.notes.splice(i, 1); }
    }

    // 光墙
    let inWall = false;
    const headX = camera.position.x, headZ = XR.active ? camera.position.z : 0;
    for (let i = G.walls.length - 1; i >= 0; i--) {
      const o = G.walls[i];
      const frontZ = G.hitZ + (t - o.w.t) * G.meta.speed;
      o.m.position.z = frontZ - o.len / 2;
      if (frontZ > headZ - 0.15 && frontZ - o.len < headZ + 0.4) {
        if (Math.abs(headX - o.w.side * 0.58) < 0.78) inWall = true;
      }
      if (frontZ - o.len > 3) {
        scene.remove(o.m);
        o.m.traverse(c => { if (c.geometry) c.geometry.dispose(); });
        G.walls.splice(i, 1);
      }
    }
    if (inWall && !G.auto) {
      addEnergy(-0.22 * dt);
      dom.vignette.style.opacity = 0.85;
      G.shake = Math.min(0.6, G.shake + dt * 2);
      if (XR.active) {
        XR.wallHapT -= dt;
        if (XR.wallHapT <= 0) { XR.wallHapT = 0.1; haptic(XR.srcL, 0.5, 40); haptic(XR.srcR, 0.5, 40); }
      }
    } else if (G.state === "playing" && G.energy > 0) {
      const cur = parseFloat(dom.vignette.style.opacity || 0);
      if (cur > 0.5) dom.vignette.style.opacity = 0;
    }

    // 光剑
    if (G.auto) {
      const ta = autoAim(saberL, t), tb = autoAim(saberR, t);
      saberL.update(dt, ta.x, ta.y);
      saberR.update(dt, tb.x, tb.y);
    } else if (XR.active && XR.useHands) {
      saberL.updateFromHand(dt, XR.handL);
      saberR.updateFromHand(dt, XR.handR);
    } else if (XR.active) {
      saberL.updateVR(dt);
      saberR.updateVR(dt);
    } else {
      const mp = mouseToWorld();
      saberR.update(dt, mp.x, mp.y);
      saberL.update(dt, -mp.x, mp.y);
    }
    if (t > -0.5) checkCuts();

    // 相机侧身（VR 中由头显姿态控制，跳过）
    if (!XR.active) {
      if (G.auto) { // 自动躲墙
        G.leanTarget = 0;
        for (const o of G.walls) {
          const frontZ = G.hitZ + (t - o.w.t) * G.meta.speed;
          if (frontZ > -14 && frontZ - o.len < 1) { G.leanTarget = -o.w.side * 0.85; break; }
        }
      }
      G.lean += (G.leanTarget - G.lean) * (1 - Math.exp(-dt * 9));
      camera.position.x = G.lean;
      camera.rotation.z = -G.lean * 0.07;
      if (G.shake > 0.001) {
        G.shake *= Math.exp(-dt * 7);
        camera.position.y = 1.7 + (Math.random() - 0.5) * G.shake * 0.05;
        camera.position.x += (Math.random() - 0.5) * G.shake * 0.05;
      } else camera.position.y = 1.7;
    }

    // VR HUD 刷新
    if (XR.active) {
      XR.hudTimer -= dt;
      if (XR.hudTimer <= 0) { XR.hudTimer = 0.12; drawVRHUD(); }
    }

    // 进度
    dom.progress_fill.style.width = Math.min(100, Math.max(0, t / G.song.duration * 100)) + "%";
    if (t > G.song.duration + 1.2) finishSong();
  }

  // 切半方块
  for (let i = G.halves.length - 1; i >= 0; i--) {
    const h = G.halves[i];
    h.life -= dt;
    if (h.life <= 0) {
      scene.remove(h.m);
      h.mat.dispose();
      h.hotMat.dispose();
      G.halves.splice(i, 1); continue;
    }
    h.vy -= 8 * dt;
    h.m.position.x += h.vx * dt;
    h.m.position.y += h.vy * dt;
    h.m.position.z += h.vz * dt;
    h.m.rotation.x += h.rx * dt;
    h.m.rotation.z += h.rz * dt;
    const k = h.life / 0.7;
    h.mat.opacity = k;
    h.hotMat.opacity = h.hotBase * Math.pow(k, 0.5); // 断面亮光稍慢熄灭
  }
  // 火花
  for (let i = G.bursts.length - 1; i >= 0; i--) {
    const b = G.bursts[i];
    b.life -= dt;
    if (b.life <= 0) {
      scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose();
      G.bursts.splice(i, 1); continue;
    }
    const p = b.pts.geometry.attributes.position.array;
    for (let j = 0; j < b.vels.length; j++) {
      b.vels[j].y -= 7 * dt;
      p[j * 3] += b.vels[j].x * dt;
      p[j * 3 + 1] += b.vels[j].y * dt;
      p[j * 3 + 2] += b.vels[j].z * dt;
    }
    b.pts.geometry.attributes.position.needsUpdate = true;
    b.pts.material.opacity = b.life / b.max;
  }
  // 浮动文字 / 闪光
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const o = G.texts[i];
    o.life -= dt;
    if (o.life <= 0) {
      scene.remove(o.sp);
      if (o.tex) o.tex.dispose();
      o.sp.material.dispose();
      G.texts.splice(i, 1); continue;
    }
    const k = 1 - o.life / o.max;
    if (o.rise) o.sp.position.y += o.rise * dt;
    if (o.grow) { const s = 0.3 + k * o.grow * 0.18; o.sp.scale.set(s, s, 1); }
    o.sp.material.opacity = 1 - k * k;
  }

  if (env) env.update(dt, time);
  if (composer && !XR.active) composer.render(); else renderer.render(scene, camera);
}

/* ============================================================
 * 输入 & UI
 * ============================================================ */
function initInput() {
  addEventListener("mousemove", e => {
    G.mouse.x = (e.clientX / innerWidth) * 2 - 1;
    G.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  });
  addEventListener("keydown", e => {
    if (e.code === "Escape") {
      if (G.state === "playing") pauseSong();
      else if (G.state === "paused") resumeSong();
    }
    if (e.code === "KeyA" || e.code === "ArrowLeft") G.leanTarget = -0.85;
    if (e.code === "KeyD" || e.code === "ArrowRight") G.leanTarget = 0.85;
    if (e.code === "KeyR" && (G.state === "playing" || G.state === "paused")) startSong(G.songIdx);
  });
  addEventListener("keyup", e => {
    if ((e.code === "KeyA" || e.code === "ArrowLeft") && G.leanTarget < 0) G.leanTarget = 0;
    if ((e.code === "KeyD" || e.code === "ArrowRight") && G.leanTarget > 0) G.leanTarget = 0;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && G.state === "playing" && !XR.active) pauseSong();
  });

  $("btn-resume").onclick = () => resumeSong();
  $("btn-restart").onclick = () => { synth.ctx.resume(); startSong(G.songIdx); };
  $("btn-quit").onclick = () => { synth.ctx.resume(); quitToMenu(); };
  $("btn-again").onclick = () => startSong(G.songIdx);
  $("btn-menu").onclick = () => quitToMenu();
  $("btn-retry").onclick = () => startSong(G.songIdx);
  $("btn-fail-menu").onclick = () => quitToMenu();
  $("auto-toggle").onclick = () => {
    G.auto = !G.auto;
    $("auto-toggle").classList.toggle("on", G.auto);
    if (synth) synth.sfxClick();
    if (XR.autoPanel) { drawAutoPanel(false); }
  };
}

function buildMenu() {
  SONGS.forEach((s, i) => {
    const hexL = "#" + s.colorL.toString(16).padStart(6, "0");
    const hexR = "#" + s.colorR.toString(16).padStart(6, "0");
    const card = document.createElement("div");
    card.className = "card";
    card.style.setProperty("--ac", hexR);
    card.style.setProperty("--acGlow", hexR + "55");
    card.style.setProperty("--envBg", s.cardBg);
    card.innerHTML = `
      <div class="env"></div>
      <h2>${s.name}</h2>
      <h3>${s.en} · ${s.style}</h3>
      <p>${s.desc}</p>
      <div class="meta">
        <span>${s.bpm} BPM</span>
        <span class="diff">难度 · ${s.diff}</span>
      </div>`;
    card.onclick = () => { ensureAudio(); synth.sfxClick(); startSong(i); };
    dom.cards.appendChild(card);
  });
  createUploadCard();
}

/* ============================================================
 * 本地音乐上传 → 自动谱面
 * ============================================================ */
const ENV_THEME = {
  neon: { style: "赛博霓虹" },
  ink: { style: "水墨夜山" },
  space: { style: "深空星云" }
};
let uploadCard = null, uploadInput = null, uploadBusy = false;

function createUploadCard() {
  uploadInput = document.createElement("input");
  uploadInput.type = "file";
  uploadInput.accept = "audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac";
  uploadInput.style.display = "none";
  uploadInput.onchange = () => {
    if (uploadInput.files && uploadInput.files[0]) handleMusicFile(uploadInput.files[0]);
    uploadInput.value = "";
  };
  document.body.appendChild(uploadInput);

  uploadCard = document.createElement("div");
  uploadCard.className = "card upload-card";
  uploadCard.style.setProperty("--ac", "#ffd76e");
  uploadCard.style.setProperty("--acGlow", "#ffd76e55");
  uploadCard.style.setProperty("--envBg", "linear-gradient(160deg,#20242f,#161a26 55%,#101420)");
  drawUploadIdle();
  dom.cards.appendChild(uploadCard);

  addEventListener("dragover", e => e.preventDefault());
  addEventListener("drop", e => {
    e.preventDefault();
    if (G.state !== "menu" || uploadBusy) return;
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleMusicFile(f);
  });
}

function drawUploadIdle(statusText, isErr) {
  uploadCard.innerHTML = `
    <div class="env upload-plus">＋</div>
    <h2>上传音乐</h2>
    <h3>AUTO MAP · 本地歌曲</h3>
    <p>${statusText
      ? `<span style="color:${isErr ? "#ff6677" : "#ffd76e"}">${statusText}</span>`
      : "点击选择或拖入音频文件（mp3 / wav / m4a…），自动分析节拍与情绪，生成谱面与匹配场景。"}</p>
    <div class="meta"><span>本地文件不会上传</span><span class="diff">自动难度</span></div>`;
  uploadCard.onclick = () => { if (!uploadBusy) { ensureAudio(); uploadInput.click(); } };
}

function fmtTime(s) {
  const m = Math.floor(s / 60), ss = Math.round(s % 60);
  return m + ":" + String(ss).padStart(2, "0");
}

function drawUploadReady(meta) {
  const hexR = "#" + meta.colorR.toString(16).padStart(6, "0");
  uploadCard.style.setProperty("--ac", hexR);
  uploadCard.style.setProperty("--acGlow", hexR + "55");
  uploadCard.style.setProperty("--envBg", meta.cardBg);
  const name = meta.name.length > 10 ? meta.name.slice(0, 10) + "…" : meta.name;
  uploadCard.innerHTML = `
    <div class="env"></div>
    <h2>${name}</h2>
    <h3>CUSTOM · ${ENV_THEME[meta.env].style}</h3>
    <p>${meta.bpm} BPM · ${meta.noteCount} 方块 · ${fmtTime(meta.duration)}<br>
    场景：<span class="env-pick">
      <span data-env="neon" class="${meta.env === "neon" ? "sel" : ""}">霓虹</span>
      <span data-env="ink" class="${meta.env === "ink" ? "sel" : ""}">水墨</span>
      <span data-env="space" class="${meta.env === "space" ? "sel" : ""}">星空</span>
    </span></p>
    <div class="meta"><span class="rechoose">换一首</span><span class="diff">难度 · ${meta.diff}</span></div>`;
  uploadCard.onclick = () => { ensureAudio(); synth.sfxClick(); startSong(G.customIdx); };
  uploadCard.querySelector(".rechoose").onclick = e => {
    e.stopPropagation();
    if (!uploadBusy) { ensureAudio(); uploadInput.click(); }
  };
  uploadCard.querySelectorAll(".env-pick span").forEach(el => {
    el.onclick = e => {
      e.stopPropagation();
      setCustomEnv(el.dataset.env);
    };
  });
}

function setCustomEnv(envId) {
  const meta = SONGS[G.customIdx];
  if (!meta || meta.env === envId) return;
  const ref = SONGS.find(s => s.env === envId && !s.custom);
  meta.env = envId;
  meta.colorL = ref.colorL;
  meta.colorR = ref.colorR;
  meta.cardBg = ref.cardBg;
  meta.style = "自定义 · " + ENV_THEME[envId].style;
  drawUploadReady(meta);
  updateVRCustomPanel();
  if (synth) synth.sfxClick();
}

async function handleMusicFile(file) {
  if (uploadBusy) return;
  uploadBusy = true;
  ensureAudio();
  try {
    drawUploadIdle("解码音频…");
    const arr = await file.arrayBuffer();
    const buf = await synth.ctx.decodeAudioData(arr);
    if (buf.duration < 20) throw new Error("音频太短，至少需要 20 秒");
    if (buf.duration > 600) throw new Error("音频太长，请控制在 10 分钟内");
    const res = await analyzeAudioBuffer(buf, s => drawUploadIdle(s));
    if (res.notes.length < 10) throw new Error("节拍太弱，无法生成有效谱面");
    registerCustomSong(file.name.replace(/\.[^.]+$/, ""), buf, res);
    if (synth) synth.sfxCount(true);
  } catch (e) {
    drawUploadIdle("失败：" + (e && e.message ? e.message : "无法解码该文件"), true);
  }
  uploadBusy = false;
}

function registerCustomSong(name, buffer, res) {
  const ref = SONGS.find(s => s.env === res.mood && !s.custom);
  const noteCount = res.notes.filter(n => n.type !== 3).length;
  const nps = noteCount / res.duration;
  const meta = {
    id: "custom",
    name, en: "CUSTOM",
    style: "自定义 · " + ENV_THEME[res.mood].style,
    desc: `本地音乐自动谱面：检测 ${res.bpm} BPM，${noteCount} 个方块。`,
    bpm: res.bpm,
    diff: nps < 1 ? "简单" : nps < 1.8 ? "普通" : "困难",
    env: res.mood,
    speed: Math.max(12, Math.min(20, Math.round((0.136 * res.bpm + 1.55) * 10) / 10)),
    colorL: ref.colorL, colorR: ref.colorR, cardBg: ref.cardBg,
    custom: true,
    noteCount,
    duration: res.duration,
    build: () => ({
      events: [], buffer,
      notes: res.notes, walls: res.walls,
      duration: res.duration + 1,
      bpm: res.bpm, spb: res.spb, beatOffset: res.phase
    })
  };
  if (G.customIdx == null) { G.customIdx = SONGS.length; SONGS.push(meta); }
  else SONGS[G.customIdx] = meta;
  drawUploadReady(meta);
  updateVRCustomPanel();
}

function updateVRCustomPanel() {
  if (!XR.menuGroup || G.customIdx == null) return;
  while (XR.menuPanels.length < SONGS.length) {
    const p = makeCanvasPanel(512, 640, 1.05, 1.31);
    XR.menuGroup.add(p.mesh);
    XR.menuPanels.push(p);
  }
  const n = XR.menuPanels.length;
  XR.menuPanels.forEach((p, i) => {
    p.mesh.position.set((i - (n - 1) / 2) * 1.3, 1.55, -2.6);
    p.mesh.lookAt(0, 1.6, 0.6);
    drawSongPanel(p.ctx, SONGS[i], false);
    p.tex.needsUpdate = true;
  });
  XR.hovered = -2;
}

/* ============================================================
 * WebXR — 会话管理 / 手柄 / VR 菜单 / 世界空间 UI
 * ============================================================ */
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function wrapText(c, text, x, y, maxW, lh) {
  let line = "", yy = y;
  for (const ch of text) {
    if (c.measureText(line + ch).width > maxW) {
      c.fillText(line, x, yy);
      line = ch; yy += lh;
    } else line += ch;
  }
  if (line) c.fillText(line, x, yy);
}
function makeCanvasPanel(pw, ph, mw, mh) {
  const cv = document.createElement("canvas");
  cv.width = pw; cv.height = ph;
  const tex = new THREE.CanvasTexture(cv);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(mw, mh),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  return { cv, ctx: cv.getContext("2d"), tex, mesh };
}

/* ---------- VR HUD（得分板悬于赛道上方） ---------- */
function drawVRHUD() {
  const { ctx: c, cv, tex } = XR.hud;
  const W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  rr(c, 0, 0, W, H, 28);
  c.fillStyle = "rgba(8,10,22,0.55)"; c.fill();
  c.textBaseline = "middle";
  c.textAlign = "left";
  c.fillStyle = "#fff";
  c.font = "bold 72px sans-serif";
  c.fillText(G.score.toLocaleString(), 40, 80);
  const accMax = G.judged > 0 ? G.cumMax[Math.min(G.judged, G.cumMax.length - 1)] : 0;
  c.font = "26px sans-serif";
  c.fillStyle = "#8f9bd4";
  c.fillText("准确率 " + (accMax > 0 ? ((G.score / accMax) * 100).toFixed(1) : "100.0") + "%", 42, 134);
  c.textAlign = "center";
  c.fillStyle = "#fff";
  c.font = "bold 78px sans-serif";
  c.fillText(String(G.combo), W / 2, 80);
  c.font = "24px sans-serif";
  c.fillStyle = "#8f9bd4";
  c.fillText(G.auto ? "COMBO · 纯享演示" : "COMBO", W / 2, 134);
  c.textAlign = "right";
  c.font = "bold 64px sans-serif";
  c.fillStyle = G.hexR;
  c.fillText("x" + MULT[G.level], W - 44, 84);
  const ex = 40, ew = W - 80, ey = H - 60, eh = 26;
  rr(c, ex, ey, ew, eh, 13);
  c.fillStyle = "rgba(255,255,255,0.12)"; c.fill();
  rr(c, ex, ey, Math.max(14, ew * G.energy), eh, 13);
  c.fillStyle = G.energy < 0.3 ? "#ff4b5c" : "#39c8ff"; c.fill();
  tex.needsUpdate = true;
}

/* ---------- VR 消息面板（倒计时/暂停/结算） ---------- */
function drawVRMsg(lines, big) {
  const { ctx: c, cv, tex, mesh } = XR.msg;
  const W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  c.textAlign = "center"; c.textBaseline = "middle";
  if (big) {
    c.font = "bold 280px sans-serif";
    c.fillStyle = "#fff";
    c.shadowColor = G.hexR; c.shadowBlur = 60;
    c.fillText(lines[0], W / 2, H / 2);
    c.shadowBlur = 0;
  } else {
    rr(c, 0, 0, W, H, 34);
    c.fillStyle = "rgba(8,10,22,0.72)"; c.fill();
    const n = lines.length, lh = 84, y0 = H / 2 - ((n - 1) * lh) / 2;
    lines.forEach((s, i) => {
      c.font = i === 0 ? "bold 68px sans-serif" : "40px sans-serif";
      c.fillStyle = i === 0 ? "#fff" : "#aab3d0";
      c.fillText(s, W / 2, y0 + i * lh);
    });
  }
  tex.needsUpdate = true;
  mesh.visible = true;
}
function hideVRMsg() { if (XR.msg) XR.msg.mesh.visible = false; }
function setRayVisible(v) { XR.rays.forEach(r => r.visible = v); }

/* ---------- VR 曲目面板 ---------- */
function drawSongPanel(c, s, hover) {
  const W = 512, H = 640;
  const hex = "#" + s.colorR.toString(16).padStart(6, "0");
  const hexL = "#" + s.colorL.toString(16).padStart(6, "0");
  c.clearRect(0, 0, W, H);
  const gr = c.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, hover ? "#1d2545" : "#12172a");
  gr.addColorStop(1, "#0a0d1a");
  rr(c, 8, 8, W - 16, H - 16, 26);
  c.fillStyle = gr; c.fill();
  c.lineWidth = hover ? 10 : 4;
  c.strokeStyle = hex;
  c.shadowColor = hex; c.shadowBlur = hover ? 34 : 12;
  c.stroke();
  c.shadowBlur = 0;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.font = "bold 74px sans-serif"; c.fillStyle = "#fff";
  c.fillText(s.name, W / 2, 120);
  c.font = "28px sans-serif"; c.fillStyle = hex;
  c.fillText(s.en + " · " + s.style, W / 2, 195);
  c.fillStyle = hexL; rr(c, W / 2 - 92, 240, 82, 14, 7); c.fill();
  c.fillStyle = hex; rr(c, W / 2 + 10, 240, 82, 14, 7); c.fill();
  c.font = "26px sans-serif"; c.fillStyle = "#aab3d0";
  wrapText(c, s.desc, W / 2, 320, 420, 42);
  c.font = "30px sans-serif"; c.fillStyle = "#cfd6f5";
  c.fillText(s.bpm + " BPM · 难度 " + s.diff, W / 2, 500);
  if (hover) {
    c.font = "bold 34px sans-serif"; c.fillStyle = "#fff";
    c.fillText("— 扣扳机开始 —", W / 2, 575);
  }
}

function drawAutoPanel(hover) {
  if (!XR.autoPanel) return;
  const { ctx: c, cv, tex } = XR.autoPanel;
  const W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  const col = G.auto ? "#ffd76e" : "#6a7494";
  rr(c, 6, 6, W - 12, H - 12, 22);
  c.fillStyle = hover ? "rgba(30,36,64,0.9)" : "rgba(14,17,32,0.85)";
  c.fill();
  c.lineWidth = hover ? 8 : 4;
  c.strokeStyle = col;
  c.shadowColor = col; c.shadowBlur = hover ? 26 : (G.auto ? 14 : 4);
  c.stroke();
  c.shadowBlur = 0;
  c.textAlign = "center"; c.textBaseline = "middle";
  c.font = "bold 44px sans-serif";
  c.fillStyle = G.auto ? "#ffd76e" : "#aab3d0";
  c.fillText(`纯享模式（自动挥剑）：${G.auto ? "开" : "关"}`, W / 2, H / 2);
  tex.needsUpdate = true;
}

function buildVRMenu() {
  const g = new THREE.Group();
  g.visible = false;
  g.add(new THREE.GridHelper(26, 26, 0x2a3550, 0x131b2e));
  const title = makeCanvasPanel(1024, 192, 3.4, 0.64);
  const tc = title.ctx;
  tc.textAlign = "center"; tc.textBaseline = "middle";
  tc.font = "bold 88px sans-serif"; tc.fillStyle = "#fff";
  tc.shadowColor = "#00e5ff"; tc.shadowBlur = 30;
  tc.fillText("节奏光剑 · 选择曲目", 512, 70);
  tc.shadowBlur = 0;
  tc.font = "34px sans-serif"; tc.fillStyle = "#8f9bd4";
  tc.fillText("手柄指向扣扳机 / 注视并捏合确认 · 游戏中握把或双手捏合暂停", 512, 150);
  title.tex.needsUpdate = true;
  title.mesh.position.set(0, 2.75, -3.4);
  g.add(title.mesh);
  SONGS.forEach((s, i) => {
    const p = makeCanvasPanel(512, 640, 1.05, 1.31);
    drawSongPanel(p.ctx, s, false);
    p.tex.needsUpdate = true;
    p.mesh.position.set((i - 1) * 1.35, 1.55, -2.6);
    p.mesh.lookAt(0, 1.6, 0.6);
    g.add(p.mesh);
    XR.menuPanels.push(p);
  });
  XR.autoPanel = makeCanvasPanel(768, 128, 1.85, 0.31);
  XR.autoPanel.mesh.position.set(0, 0.66, -2.45);
  XR.autoPanel.mesh.lookAt(0, 1.6, 0.6);
  drawAutoPanel(false);
  g.add(XR.autoPanel.mesh);
  scene.add(g);
  XR.menuGroup = g;
}

function showVRMenu() {
  scene.background = new THREE.Color(0x04060d);
  scene.fog = null;
  XR.menuGroup.visible = true;
  XR.hud.mesh.visible = false;
  hideVRMsg();
  setRayVisible(true);
  XR.hovered = -2;
  dom.hud.classList.add("hidden");
}

const _rc = new THREE.Raycaster();
const _rcMat = new THREE.Matrix4();
function updateVRMenuHover() {
  const c = XR.ctrlR || XR.ctrlL;
  let idx = -1, hoverAuto = false, hasRay = false;
  if (XR.useHands || !c) {
    // Vision Pro：注视选择
    if (XR.active) {
      _rcMat.identity().extractRotation(camera.matrixWorld);
      _rc.ray.origin.setFromMatrixPosition(camera.matrixWorld);
      _rc.ray.direction.set(0, 0, -1).applyMatrix4(_rcMat);
      hasRay = true;
    }
  } else {
    _rcMat.identity().extractRotation(c.matrixWorld);
    _rc.ray.origin.setFromMatrixPosition(c.matrixWorld);
    _rc.ray.direction.set(0, 0, -1).applyMatrix4(_rcMat);
    hasRay = true;
  }
  if (hasRay) {
    const targets = XR.menuPanels.map(p => p.mesh);
    if (XR.autoPanel) targets.push(XR.autoPanel.mesh);
    const hits = _rc.intersectObjects(targets, false);
    if (hits.length) {
      if (XR.autoPanel && hits[0].object === XR.autoPanel.mesh) hoverAuto = true;
      else idx = XR.menuPanels.findIndex(p => p.mesh === hits[0].object);
    }
  }
  // 凝视光标
  if (XR.reticle) {
    XR.reticle.visible = XR.useHands && XR.active;
    if (XR.reticle.visible) {
      XR.reticle.position.copy(_rc.ray.origin).addScaledVector(_rc.ray.direction, 2.3);
      XR.reticle.material.opacity = (idx >= 0 || hoverAuto) ? 0.95 : 0.4;
    }
  }
  if (hoverAuto !== XR.hoverAuto) {
    XR.hoverAuto = hoverAuto;
    drawAutoPanel(hoverAuto);
    if (hoverAuto) haptic(XR.srcR, 0.2, 20);
  }
  if (idx !== XR.hovered) {
    XR.hovered = idx;
    XR.menuPanels.forEach((p, i) => {
      const h = i === idx;
      p.mesh.scale.setScalar(h ? 1.08 : 1);
      drawSongPanel(p.ctx, SONGS[i], h);
      p.tex.needsUpdate = true;
    });
    if (idx >= 0) { haptic(XR.srcR, 0.25, 25); if (synth) synth.sfxClick(); }
  }
}

/* ---------- 手柄事件 ---------- */
function onXRSelect() {
  if (XR.useHands) return; // 手势模式由会话级 pinch 事件处理
  switch (G.state) {
    case "vrmenu":
      if (XR.hoverAuto) {
        G.auto = !G.auto;
        $("auto-toggle").classList.toggle("on", G.auto);
        drawAutoPanel(true);
        if (synth) synth.sfxClick();
        haptic(XR.srcR, 0.4, 40);
      } else if (XR.hovered >= 0) startSong(XR.hovered);
      break;
    case "paused": resumeSong(); break;
    case "results":
    case "failed": startSong(G.songIdx); break;
  }
}
function onXRSqueeze() {
  if (XR.useHands) return;
  switch (G.state) {
    case "playing": pauseSong(); break;
    case "paused":
    case "results":
    case "failed": quitToMenu(); break;
  }
}
function reattachSabers() {
  if (!XR.active || G.auto || XR.useHands) return;
  if (saberL && XR.ctrlL) saberL.attachTo(XR.ctrlL, true);
  if (saberR && XR.ctrlR) saberR.attachTo(XR.ctrlR, true);
}
function initControllers() {
  for (let i = 0; i < 2; i++) {
    const c = renderer.xr.getController(i);
    c.addEventListener("connected", e => {
      // Vision Pro 的瞬态捏合指针不占用手柄位
      if (e.data.targetRayMode === "transient-pointer") return;
      if (e.data.handedness === "left") { XR.ctrlL = c; XR.srcL = e.data; }
      else { XR.ctrlR = c; XR.srcR = e.data; }
      reattachSabers();
    });
    c.addEventListener("disconnected", () => {
      if (XR.ctrlL === c) { XR.ctrlL = null; XR.srcL = null; }
      if (XR.ctrlR === c) { XR.ctrlR = null; XR.srcR = null; }
    });
    c.addEventListener("selectstart", onXRSelect);
    c.addEventListener("squeezestart", onXRSqueeze);
    const rg = new THREE.BufferGeometry().setFromPoints(
      [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -6)]);
    const ray = new THREE.Line(rg, new THREE.LineBasicMaterial({
      color: 0x8fb8ff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending
    }));
    ray.visible = false;
    c.add(ray);
    XR.rays.push(ray);
    scene.add(c);

    // Vision Pro / Quest 手部追踪
    const h = renderer.xr.getHand(i);
    h.addEventListener("connected", e => {
      if (!e.data.hand) return;
      if (e.data.handedness === "left") XR.handL = h; else XR.handR = h;
      XR.useHands = true;
      setRayVisible(false);
      reattachSabers();
    });
    h.addEventListener("disconnected", () => {
      if (XR.handL === h) XR.handL = null;
      if (XR.handR === h) XR.handR = null;
      if (!XR.handL && !XR.handR) XR.useHands = false;
    });
    scene.add(h);
  }
}

/* ---------- Vision Pro 手势（注视 + 捏合） ---------- */
function onXRSessionSelect(e) {
  if (!XR.useHands) return;
  const hand = e.inputSource ? e.inputSource.handedness : "right";
  switch (G.state) {
    case "vrmenu":
      if (XR.hoverAuto) {
        G.auto = !G.auto;
        $("auto-toggle").classList.toggle("on", G.auto);
        drawAutoPanel(true);
        if (synth) synth.sfxClick();
      } else if (XR.hovered >= 0) startSong(XR.hovered);
      break;
    case "playing": {
      // 双手同时捏合（600ms 内）暂停，避免挥剑误触
      const now = performance.now();
      if (hand === "left") XR.pinchL = now; else XR.pinchR = now;
      if (Math.abs(XR.pinchL - XR.pinchR) < 600 && XR.pinchL > 0 && XR.pinchR > 0) {
        XR.pinchL = XR.pinchR = 0;
        pauseSong();
      }
      break;
    }
    case "paused":
      if (hand === "left") quitToMenu(); else resumeSong();
      break;
    case "results":
    case "failed":
      if (hand === "left") quitToMenu(); else startSong(G.songIdx);
      break;
  }
}

function initVRUI() {
  XR.hud = makeCanvasPanel(1024, 256, 4.4, 1.1);
  XR.hud.mesh.position.set(0, 3.3, -8);
  XR.hud.mesh.visible = false;
  scene.add(XR.hud.mesh);
  XR.msg = makeCanvasPanel(768, 420, 2.3, 1.26);
  XR.msg.mesh.position.set(0, 1.75, -3.6);
  XR.msg.mesh.visible = false;
  scene.add(XR.msg.mesh);
  XR.reticle = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xaaccff, transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false
  }));
  XR.reticle.scale.set(0.06, 0.06, 1);
  XR.reticle.visible = false;
  scene.add(XR.reticle);
  buildVRMenu();
}

/* ---------- 会话 ---------- */
async function enterVR() {
  ensureAudio();
  try {
    const s = await navigator.xr.requestSession("immersive-vr", {
      optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"]
    });
    renderer.xr.setSession(s);
    XR.session = s; XR.active = true;
    s.addEventListener("end", onXREnd);
    s.addEventListener("select", onXRSessionSelect);
    dom.menu.classList.add("hidden");
    G.state = "vrmenu";
    showVRMenu();
  } catch (e) {
    alert("无法进入 VR：" + (e.message || e) +
      "\n请确认通过 localhost 或 HTTPS 访问，且头显已连接。");
  }
}
function onXREnd() {
  XR.active = false; XR.session = null;
  XR.handL = null; XR.handR = null; XR.useHands = false;
  XR.pinchL = XR.pinchR = 0;
  if (XR.reticle) XR.reticle.visible = false;
  if (player) player.stop();
  clearPlayfield();
  if (env) { env.dispose(); env = null; }
  if (saberL) { saberL.dispose(); saberL = null; }
  if (saberR) { saberR.dispose(); saberR = null; }
  XR.menuGroup.visible = false;
  XR.hud.mesh.visible = false;
  hideVRMsg();
  setRayVisible(false);
  ["hud", "pause", "results", "fail", "countdown"].forEach(k => dom[k].classList.add("hidden"));
  G.state = "menu";
  dom.menu.classList.remove("hidden");
  document.body.classList.remove("playing-cursor");
  if (synth && synth.ctx.state === "suspended") synth.ctx.resume();
}
function initXR() {
  const btn = $("btn-vr");
  if (!navigator.xr || !navigator.xr.isSessionSupported) {
    btn.textContent = "此浏览器不支持 WebXR（可用桌面模式游玩）";
    return;
  }
  navigator.xr.isSessionSupported("immersive-vr").then(ok => {
    XR.supported = ok;
    if (ok) {
      btn.classList.remove("vr-off");
      btn.textContent = "进入 VR 模式";
      btn.onclick = enterVR;
    } else {
      btn.textContent = window.isSecureContext
        ? "未检测到 VR 头显（可用桌面模式游玩）"
        : "VR 需通过 localhost / HTTPS 访问";
    }
  }).catch(() => { btn.textContent = "WebXR 检测失败（可用桌面模式游玩）"; });
}

/* ---------- 启动 ---------- */
initThree();
initTextures();
initInput();
buildMenu();
initControllers();
initVRUI();
initXR();
renderer.setAnimationLoop(tick);

/* 调试自检：index.html#autotest 依次加载三首曲目 */
if (location.hash === "#autotest") {
  const step = (i, off, next) => {
    try { startSong(i); G.startAt = synth.ctx.currentTime - off; }
    catch (e) { console.error("AUTOTEST-FAIL", i, e); }
    if (next) setTimeout(next, 1500); else setTimeout(() => {
      try { quitToMenu(); console.log("AUTOTEST-PASS"); }
      catch (e) { console.error("AUTOTEST-FAIL quit", e); }
    }, 1500);
  };
  setTimeout(() => step(0, 30, () => step(1, 50, () => step(2, 60, null))), 600);
}

/* 调试自检：index.html#autotest-auto 纯享模式自动挥剑 3 秒，验证自动命中 */
if (location.hash === "#autotest-auto") {
  setTimeout(() => {
    try {
      ensureAudio();
      G.auto = true;
      startSong(0);
      const f0 = renderer.info.render.frame;
      setTimeout(() => {
        const fps = (renderer.info.render.frame - f0) / 14;
        console.log(`AUTO score=${G.score} hits=${G.hits} judged=${G.judged} combo=${G.combo} fps=${fps.toFixed(1)}`);
        if (G.hits > 0 && G.hits === G.judged) console.log("AUTOTEST-AUTO-PASS");
        else console.error("AUTOTEST-AUTO-FAIL");
        quitToMenu();
      }, 14000);
    } catch (e) { console.error("AUTOTEST-AUTO-FAIL", e); }
  }, 600);
}

/* 调试自检：index.html#autotest-upload 合成测试音频→分析→生成谱面→试玩 */
if (location.hash === "#autotest-upload") {
  setTimeout(async () => {
    try {
      ensureAudio();
      const sr = 44100, dur = 40, TB = 123.7;
      const buf = synth.ctx.createBuffer(1, sr * dur, sr);
      const d = buf.getChannelData(0);
      const spb2 = 60 / TB;
      for (let b = 0; b * spb2 < dur; b++) {
        const o = Math.floor(b * spb2 * sr);
        for (let i = 0; i < 3000 && o + i < d.length; i++)
          d[o + i] += Math.sin(2 * Math.PI * 60 * i / sr) * Math.exp(-i / 900) * 0.9;
        if (b % 2 === 1)
          for (let i = 0; i < 1500 && o + i < d.length; i++)
            d[o + i] += (Math.random() * 2 - 1) * Math.exp(-i / 400) * 0.4;
      }
      const res = await analyzeAudioBuffer(buf, s => console.log("STAGE " + s));
      let err = 0;
      const half = spb2 / 2;
      for (const n of res.notes) {
        const dd = ((n.t % half) + half) % half;
        err += Math.min(dd, half - dd);
      }
      console.log(`ANALYZE bpm=${res.bpm}(真值${TB}) phase=${res.phase.toFixed(3)} mood=${res.mood} notes=${res.notes.length} walls=${res.walls.length} gridErr=${(err / res.notes.length * 1000).toFixed(1)}ms`);
      registerCustomSong("测试曲", buf, res);
      startSong(G.customIdx);
      G.startAt = synth.ctx.currentTime - 10;
      setTimeout(() => { quitToMenu(); console.log("AUTOTEST-UPLOAD-PASS"); }, 1500);
    } catch (e) { console.error("AUTOTEST-UPLOAD-FAIL", e); }
  }, 600);
}
