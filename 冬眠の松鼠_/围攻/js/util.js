/* ============ 围攻 Web —— 工具库：纹理 / 粒子 / 音效 / 数学 ============ */
'use strict';

const U = {};

/* ---------------- 数学 ---------------- */
U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
U.lerp = (a, b, t) => a + (b - a) * t;
U.rand = (a, b) => a + Math.random() * (b - a);
U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
U.pick = arr => arr[Math.floor(Math.random() * arr.length)];

U.v3 = (x, y, z) => new THREE.Vector3(x, y, z);
U.cv3 = (x, y, z) => new CANNON.Vec3(x, y, z);
U.toC = v => new CANNON.Vec3(v.x, v.y, v.z);
U.toT = v => new THREE.Vector3(v.x, v.y, v.z);
U.toCQ = q => new CANNON.Quaternion(q.x, q.y, q.z, q.w);
U.toTQ = q => new THREE.Quaternion(q.x, q.y, q.z, q.w);

// 将向量吸附到最近的坐标轴单位向量
U.snapAxis = function (v) {
  const ax = Math.abs(v.x), ay = Math.abs(v.y), az = Math.abs(v.z);
  if (ax >= ay && ax >= az) return new THREE.Vector3(Math.sign(v.x), 0, 0);
  if (ay >= ax && ay >= az) return new THREE.Vector3(0, Math.sign(v.y), 0);
  return new THREE.Vector3(0, 0, Math.sign(v.z));
};

// 让 +Z 指向 normal 的四元数
U.alignZTo = function (n) {
  const q = new THREE.Quaternion();
  if (n.z > 0.9) q.identity();
  else if (n.z < -0.9) q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
  else if (n.x > 0.9) q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  else if (n.x < -0.9) q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
  else if (n.y > 0.9) q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  else q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  return q;
};

// 计算相对四元数绕 axis(单位向量) 的扭转角
U.twistAngle = function (qRel, axis) {
  const d = qRel.x * axis.x + qRel.y * axis.y + qRel.z * axis.z;
  const twist = new THREE.Quaternion(axis.x * d, axis.y * d, axis.z * d, qRel.w).normalize();
  let ang = 2 * Math.acos(U.clamp(twist.w, -1, 1));
  if (d < 0) ang = -ang;
  if (ang > Math.PI) ang -= Math.PI * 2;
  if (ang < -Math.PI) ang += Math.PI * 2;
  return ang;
};

U.keyName = function (code) {
  if (!code) return '—';
  const map = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
    Space: '空格', Enter: '回车', AltLeft: 'L-Alt', AltRight: 'R-Alt',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return '小键盘' + code.slice(6);
  return code;
};

/* ---------------- 程序纹理 ---------------- */
U.tex = {};
U._mkCanvas = function (w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return [c, c.getContext('2d')];
};
U._noise = function (ctx, w, h, alpha, tone) {
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 2 * alpha * 255;
    d[i] = U.clamp(d[i] + n * (tone ? tone[0] : 1), 0, 255);
    d[i + 1] = U.clamp(d[i + 1] + n * (tone ? tone[1] : 1), 0, 255);
    d[i + 2] = U.clamp(d[i + 2] + n * (tone ? tone[2] : 1), 0, 255);
  }
  ctx.putImageData(img, 0, 0);
};

U.makeTextures = function () {
  // --- 木纹 ---
  {
    const [c, g] = U._mkCanvas(128, 128);
    g.fillStyle = '#a97c46'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = `rgba(${90 + U.randInt(-25, 5)},${58 + U.randInt(-15, 10)},${28},${U.rand(.12, .3)})`;
      g.lineWidth = U.rand(1, 3);
      g.beginPath();
      const y = U.rand(0, 128);
      g.moveTo(0, y);
      for (let x = 0; x <= 128; x += 16) g.lineTo(x, y + Math.sin(x * .1 + i) * 3);
      g.stroke();
    }
    U._noise(g, 128, 128, 0.05);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    U.tex.wood = t;
  }
  // --- 深色木 ---
  {
    const [c, g] = U._mkCanvas(128, 128);
    g.fillStyle = '#6b4a2a'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 22; i++) {
      g.strokeStyle = `rgba(40,26,12,${U.rand(.15, .35)})`;
      g.lineWidth = U.rand(1, 3);
      g.beginPath();
      const y = U.rand(0, 128);
      g.moveTo(0, y);
      for (let x = 0; x <= 128; x += 16) g.lineTo(x, y + Math.sin(x * .12 + i) * 3);
      g.stroke();
    }
    U._noise(g, 128, 128, 0.05);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    U.tex.darkwood = t;
  }
  // --- 金属 ---
  {
    const [c, g] = U._mkCanvas(64, 64);
    const grad = g.createLinearGradient(0, 0, 64, 64);
    grad.addColorStop(0, '#9a9da5'); grad.addColorStop(.5, '#7e828c'); grad.addColorStop(1, '#8f939c');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    U._noise(g, 64, 64, 0.04);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    U.tex.metal = t;
  }
  // --- 石头 ---
  {
    const [c, g] = U._mkCanvas(128, 128);
    g.fillStyle = '#a8a294'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(${120 + U.randInt(-20, 30)},${115 + U.randInt(-20, 30)},${105 + U.randInt(-20, 25)},.25)`;
      g.beginPath(); g.arc(U.rand(0, 128), U.rand(0, 128), U.rand(4, 18), 0, 7); g.fill();
    }
    U._noise(g, 128, 128, 0.06);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    U.tex.stone = t;
  }
  // --- 草地 ---
  {
    const [c, g] = U._mkCanvas(256, 256);
    g.fillStyle = '#7c9e4e'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${90 + U.randInt(-30, 40)},${140 + U.randInt(-35, 30)},${55 + U.randInt(-20, 25)},${U.rand(.1, .35)})`;
      g.fillRect(U.rand(0, 256), U.rand(0, 256), U.rand(1, 4), U.rand(1, 4));
    }
    for (let i = 0; i < 26; i++) { // 泥土斑
      g.fillStyle = `rgba(${150 + U.randInt(-10, 20)},${125 + U.randInt(-10, 15)},80,${U.rand(.04, .1)})`;
      g.beginPath(); g.arc(U.rand(0, 256), U.rand(0, 256), U.rand(8, 30), 0, 7); g.fill();
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(60, 60);
    U.tex.grass = t;
  }
  // --- 核心方块表情 ---
  {
    const [c, g] = U._mkCanvas(128, 128);
    g.fillStyle = '#e4b64c'; g.fillRect(0, 0, 128, 128);
    U._noise(g, 128, 128, 0.03);
    g.strokeStyle = '#7a5a18'; g.lineWidth = 5;
    g.strokeRect(6, 6, 116, 116);
    g.fillStyle = '#3a2c10';
    g.beginPath(); g.arc(45, 52, 9, 0, 7); g.fill();
    g.beginPath(); g.arc(83, 52, 9, 0, 7); g.fill();
    g.strokeStyle = '#3a2c10'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.arc(64, 68, 24, Math.PI * .18, Math.PI * .82); g.stroke();
    U.tex.coreFace = new THREE.CanvasTexture(c);
  }
  // --- 核心方块顶部箭头 ---
  {
    const [c, g] = U._mkCanvas(128, 128);
    g.fillStyle = '#e4b64c'; g.fillRect(0, 0, 128, 128);
    U._noise(g, 128, 128, 0.03);
    g.strokeStyle = '#7a5a18'; g.lineWidth = 5; g.strokeRect(6, 6, 116, 116);
    g.fillStyle = '#7a5a18';
    g.beginPath();
    g.moveTo(64, 18); g.lineTo(96, 62); g.lineTo(76, 62); g.lineTo(76, 108);
    g.lineTo(52, 108); g.lineTo(52, 62); g.lineTo(32, 62);
    g.closePath(); g.fill();
    U.tex.coreTop = new THREE.CanvasTexture(c);
  }
  // --- 圆形柔光粒子 ---
  {
    const [c, g] = U._mkCanvas(64, 64);
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    U.tex.particle = new THREE.CanvasTexture(c);
  }
  // --- 旗帜 ---
  {
    const [c, g] = U._mkCanvas(64, 48);
    g.fillStyle = '#b03030'; g.fillRect(0, 0, 64, 48);
    g.fillStyle = '#e8d080';
    g.beginPath(); g.arc(32, 24, 12, 0, 7); g.fill();
    g.fillStyle = '#b03030';
    g.beginPath(); g.arc(36, 20, 10, 0, 7); g.fill();
    U.tex.flag = new THREE.CanvasTexture(c);
  }
};

/* ---------------- 材质缓存 ---------------- */
U.mat = {};
U.makeMaterials = function () {
  const M = THREE.MeshLambertMaterial;
  U.mat.wood = new M({ map: U.tex.wood });
  U.mat.darkwood = new M({ map: U.tex.darkwood });
  U.mat.metal = new M({ map: U.tex.metal });
  U.mat.darkmetal = new M({ color: 0x4a4d55, map: U.tex.metal });
  U.mat.stone = new M({ map: U.tex.stone });
  U.mat.core = new M({ color: 0xe4b64c });
  U.mat.coreFace = new M({ map: U.tex.coreFace });
  U.mat.coreTop = new M({ map: U.tex.coreTop });
  U.mat.tire = new M({ color: 0x3c3833 });
  U.mat.hub = new M({ color: 0xc8a050, map: U.tex.wood });
  U.mat.red = new M({ color: 0xb03a2a });
  U.mat.orange = new M({ color: 0xd07828 });
  U.mat.balloon = new M({ color: 0xd05540 });
  U.mat.rope = new M({ color: 0x7a6a4a });
  U.mat.ghostOk = new THREE.MeshBasicMaterial({ color: 0x60d060, transparent: true, opacity: 0.45, depthWrite: false });
  U.mat.ghostBad = new THREE.MeshBasicMaterial({ color: 0xd04040, transparent: true, opacity: 0.45, depthWrite: false });
};

/* ---------------- 粒子系统 ---------------- */
class ParticleSystem {
  constructor(scene, max = 2600) {
    this.max = max;
    this.parts = [];
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.sizeAttr = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('psize', new THREE.BufferAttribute(this.sizeAttr, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: U.tex.particle } },
      vertexShader: `
        attribute float psize; attribute vec3 color; varying vec3 vColor;
        void main(){ vColor = color;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = psize * (240.0 / -mv.z);
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D map; varying vec3 vColor;
        void main(){ vec4 t = texture2D(map, gl_PointCoord);
          gl_FragColor = vec4(vColor, t.a); if(gl_FragColor.a < 0.02) discard; }`,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  spawn(o) {
    if (this.parts.length >= this.max) this.parts.shift();
    this.parts.push({
      x: o.x, y: o.y, z: o.z,
      vx: o.vx || 0, vy: o.vy || 0, vz: o.vz || 0,
      life: o.life || 1, age: 0,
      size: o.size || 1, endSize: o.endSize != null ? o.endSize : (o.size || 1),
      c0: o.c0 || [1, 1, 1], c1: o.c1 || o.c0 || [1, 1, 1],
      grav: o.grav || 0, drag: o.drag || 0,
    });
  }
  update(dt) {
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.age += dt;
      if (p.age >= p.life) { P.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      if (p.drag) { const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    const n = P.length;
    for (let i = 0; i < n; i++) {
      const p = P[i], t = p.age / p.life;
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
      this.col[i * 3] = U.lerp(p.c0[0], p.c1[0], t);
      this.col[i * 3 + 1] = U.lerp(p.c0[1], p.c1[1], t);
      this.col[i * 3 + 2] = U.lerp(p.c0[2], p.c1[2], t);
      this.sizeAttr[i] = U.lerp(p.size, p.endSize, t) * (1 - t * t * 0.4);
    }
    // 把没用到的槽位藏起来
    for (let i = n; i < this.max; i++) this.sizeAttr[i] = 0;
    this.geo.setDrawRange(0, Math.max(n, 1));
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.psize.needsUpdate = true;
  }
  /* ------ 预设效果 ------ */
  fire(x, y, z, scale = 1) {
    for (let i = 0; i < 2; i++) this.spawn({
      x: x + U.rand(-.25, .25) * scale, y: y + U.rand(-.1, .2) * scale, z: z + U.rand(-.25, .25) * scale,
      vx: U.rand(-.4, .4), vy: U.rand(1.5, 3.2) * scale, vz: U.rand(-.4, .4),
      life: U.rand(.35, .7), size: U.rand(.5, .9) * scale, endSize: .15,
      c0: [1, U.rand(.55, .8), .1], c1: [.85, .15, .02],
    });
    if (Math.random() < .3) this.spawn({ // 烟
      x, y: y + .4 * scale, z, vx: U.rand(-.3, .3), vy: U.rand(1, 2), vz: U.rand(-.3, .3),
      life: U.rand(.8, 1.6), size: .5 * scale, endSize: 1.4 * scale,
      c0: [.25, .22, .2], c1: [.45, .44, .43],
    });
  }
  explosion(x, y, z, r = 4) {
    for (let i = 0; i < 34; i++) {
      const a = U.rand(0, Math.PI * 2), b = U.rand(-1, 1), sp = U.rand(3, 11) * (r / 4);
      const cb = Math.sqrt(1 - b * b);
      this.spawn({
        x, y, z, vx: Math.cos(a) * cb * sp, vy: Math.abs(b) * sp + 2, vz: Math.sin(a) * cb * sp,
        life: U.rand(.4, .9), size: U.rand(.8, 1.8) * (r / 4), endSize: .2,
        c0: [1, U.rand(.6, .9), .2], c1: [.7, .12, .02], drag: 2,
      });
    }
    for (let i = 0; i < 22; i++) {
      const a = U.rand(0, Math.PI * 2), sp = U.rand(1, 5) * (r / 4);
      this.spawn({
        x, y: y + .5, z, vx: Math.cos(a) * sp, vy: U.rand(1.5, 5), vz: Math.sin(a) * sp,
        life: U.rand(1.2, 2.4), size: U.rand(1, 1.8) * (r / 4), endSize: 3.2 * (r / 4),
        c0: [.3, .28, .26], c1: [.55, .54, .52], drag: 1.2,
      });
    }
    this.spawn({ x, y, z, life: .18, size: r * 1.6, endSize: r * 2.2, c0: [1, .95, .7], c1: [1, .6, .2] });
  }
  splinters(x, y, z, color = [.55, .38, .18], n = 10) {
    for (let i = 0; i < n; i++) {
      const a = U.rand(0, Math.PI * 2);
      this.spawn({
        x, y, z, vx: Math.cos(a) * U.rand(1, 5), vy: U.rand(2, 6), vz: Math.sin(a) * U.rand(1, 5),
        life: U.rand(.5, 1.1), size: U.rand(.2, .45), endSize: .1,
        c0: color, c1: color.map(c => c * .6), grav: -12,
      });
    }
  }
  smokePuff(x, y, z, n = 6, scale = 1) {
    for (let i = 0; i < n; i++) this.spawn({
      x: x + U.rand(-.3, .3), y: y + U.rand(0, .3), z: z + U.rand(-.3, .3),
      vx: U.rand(-1, 1), vy: U.rand(.5, 2), vz: U.rand(-1, 1),
      life: U.rand(.6, 1.4), size: .6 * scale, endSize: 1.8 * scale,
      c0: [.75, .73, .7], c1: [.9, .89, .88], drag: 1.5,
    });
  }
  muzzleFlash(x, y, z, dir) {
    for (let i = 0; i < 10; i++) this.spawn({
      x, y, z,
      vx: dir.x * U.rand(4, 10) + U.rand(-1.5, 1.5),
      vy: dir.y * U.rand(4, 10) + U.rand(-1.5, 1.5),
      vz: dir.z * U.rand(4, 10) + U.rand(-1.5, 1.5),
      life: U.rand(.12, .3), size: U.rand(.5, 1), endSize: .15,
      c0: [1, .9, .4], c1: [1, .4, .1], drag: 3,
    });
    this.smokePuff(x, y, z, 4, .8);
  }
  flame(x, y, z, dir, spread = 0.25) {
    for (let i = 0; i < 3; i++) {
      const s = U.rand(9, 14);
      this.spawn({
        x: x + U.rand(-.1, .1), y: y + U.rand(-.1, .1), z: z + U.rand(-.1, .1),
        vx: dir.x * s + U.rand(-1, 1) * spread * s,
        vy: dir.y * s + U.rand(-1, 1) * spread * s,
        vz: dir.z * s + U.rand(-1, 1) * spread * s,
        life: U.rand(.25, .5), size: U.rand(.35, .6), endSize: 1.3,
        c0: [1, .85, .3], c1: [.9, .2, .03], drag: 2.5,
      });
    }
  }
}
U.ParticleSystem = ParticleSystem;

/* ---------------- 音效（WebAudio 合成） ---------------- */
const SFX = {
  ctx: null, master: null, lastPlay: {},
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) { /* 无音频环境 */ }
  },
  _throttle(name, ms) {
    const now = performance.now();
    if (this.lastPlay[name] && now - this.lastPlay[name] < ms) return true;
    this.lastPlay[name] = now;
    return false;
  },
  _noiseBuf() {
    if (this._nb) return this._nb;
    const len = this.ctx.sampleRate * 1;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._nb = buf;
    return buf;
  },
  _boom(freq, dur, vol, noiseVol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * .25), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
    const n = this.ctx.createBufferSource(), ng = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    n.buffer = this._noiseBuf();
    f.type = 'lowpass'; f.frequency.setValueAtTime(1200, t);
    f.frequency.exponentialRampToValueAtTime(120, t + dur);
    ng.gain.setValueAtTime(noiseVol, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(ng); ng.connect(this.master);
    n.start(t); n.stop(t + dur);
  },
  cannon() { if (this._throttle('cannon', 80)) return; this._boom(140, .5, .55, .5); },
  explosion() { if (this._throttle('exp', 120)) return; this._boom(70, 1.1, .8, .9); },
  crack() {
    if (!this.ctx || this._throttle('crack', 60)) return;
    const t = this.ctx.currentTime;
    const n = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    n.buffer = this._noiseBuf();
    f.type = 'bandpass'; f.frequency.value = U.rand(900, 1600); f.Q.value = 1;
    g.gain.setValueAtTime(.35, t); g.gain.exponentialRampToValueAtTime(.001, t + .18);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + .2);
  },
  click() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = 700;
    g.gain.setValueAtTime(.12, t); g.gain.exponentialRampToValueAtTime(.001, t + .06);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + .07);
  },
  place() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(180, t + .1);
    g.gain.setValueAtTime(.25, t); g.gain.exponentialRampToValueAtTime(.001, t + .12);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + .13);
  },
  remove() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(320, t + .1);
    g.gain.setValueAtTime(.2, t); g.gain.exponentialRampToValueAtTime(.001, t + .12);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + .13);
  },
  win() {
    if (!this.ctx) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      const t = this.ctx.currentTime + i * .16;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(.28, t); g.gain.exponentialRampToValueAtTime(.001, t + .5);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + .5);
    });
  },
  baa() {
    if (!this.ctx || this._throttle('baa', 400)) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(500, t);
    for (let i = 0; i < 6; i++) o.frequency.setValueAtTime(i % 2 ? 460 : 540, t + i * .05);
    g.gain.setValueAtTime(.06, t); g.gain.exponentialRampToValueAtTime(.001, t + .35);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + .36);
  },
};
window.SFX = SFX;
window.U = U;
