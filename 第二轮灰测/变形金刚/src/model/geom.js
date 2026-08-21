/**
 * geom.js —— 零件级几何工厂
 * 全部零件都用「倒角盒 / 圆柱 / 轮胎」三类基元拼出来，
 * 保证机械感（有倒角、有分件缝隙）又不依赖任何外部模型文件。
 */
import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * 圆角矩形截面（供挤出用）
 * ------------------------------------------------------------------ */
function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.max(0.002, Math.min(r, Math.min(w, h) / 2 - 0.002));
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

const _cache = new Map();

/**
 * 倒角盒：外轮廓精确为 w×h×d，四边圆角 + 前后倒角。
 * 这是整台机体的主力基元（装甲板、肢节、面板…）
 */
export function bevelBox(w, h, d, opt = {}) {
  const { r = 0.05, bevel = 0.028, curveSegments = 3, bevelSegments = 1 } = opt;
  const key = `bb|${w}|${h}|${d}|${r}|${bevel}|${curveSegments}|${bevelSegments}`;
  if (_cache.has(key)) return _cache.get(key);

  const bv = Math.max(0.004, Math.min(bevel, d / 2 - 0.004, Math.min(w, h) / 4));
  const rr = Math.max(bv + 0.006, Math.min(r, Math.min(w, h) / 2 - 0.004));
  const geo = new THREE.ExtrudeGeometry(roundedRect(w, h, rr), {
    depth: Math.max(0.004, d - bv * 2),
    bevelEnabled: true, bevelThickness: bv, bevelSize: bv,
    bevelSegments, curveSegments, steps: 1,
  });
  geo.center();
  geo.computeVertexNormals();
  _cache.set(key, geo);
  return geo;
}

/** 圆柱（缓存版） */
export function cyl(rt, rb, h, seg = 16, open = false) {
  const key = `cy|${rt}|${rb}|${h}|${seg}|${open}`;
  if (_cache.has(key)) return _cache.get(key);
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  _cache.set(key, g);
  return g;
}

export function sph(r, seg = 14) {
  const key = `sp|${r}|${seg}`;
  if (_cache.has(key)) return _cache.get(key);
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1));
  _cache.set(key, g);
  return g;
}

/* ------------------------------------------------------------------ *
 * 装配辅助
 * ------------------------------------------------------------------ */
/** 建网格并挂到 parent；p=位置, r=欧拉角(弧度) */
export function part(parent, geo, mat, p = [0, 0, 0], r = [0, 0, 0], name = '') {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(p[0], p[1], p[2]);
  m.rotation.set(r[0], r[1], r[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  if (name) m.name = name;
  parent.add(m);
  return m;
}

/** 空组（关节 / 定位点） */
export function grp(parent, p = [0, 0, 0], name = '') {
  const g = new THREE.Group();
  g.position.set(p[0], p[1], p[2]);
  if (name) g.name = name;
  if (parent) parent.add(g);
  return g;
}

export const deg = (d) => (d * Math.PI) / 180;

/* ------------------------------------------------------------------ *
 * 轮胎：整组绕自身 X 轴自转即为「滚动」
 * ------------------------------------------------------------------ */
export function makeWheel(M, opt = {}) {
  const { radius = 0.42, width = 0.30, bolts = 6, flip = false } = opt;
  const g = new THREE.Group();
  const AX = Math.PI / 2; // 圆柱默认沿 Y，转 90° 让轴向对齐 X

  const tire = part(g, cyl(radius, radius, width, 30), M.tire, [0, 0, 0], [0, 0, AX]);
  tire.name = 'tire';
  // 胎肩（两侧稍小的环，做出胎壁弧度）
  part(g, cyl(radius * 0.985, radius * 0.90, width * 0.16, 26), M.tire, [width * 0.5, 0, 0], [0, 0, AX]);
  part(g, cyl(radius * 0.90, radius * 0.985, width * 0.16, 26), M.tire, [-width * 0.5, 0, 0], [0, 0, AX]);
  // 胎面花纹
  const tread = bevelBox(width * 0.82, 0.055, 0.13, { r: 0.02, bevel: 0.014 });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const m = part(g, tread, M.tireTread,
      [0, Math.cos(a) * (radius - 0.012), Math.sin(a) * (radius - 0.012)], [-a, 0, 0]);
    m.castShadow = false;
  }
  // 轮辋 + 轮毂 + 螺栓
  const side = flip ? -1 : 1;
  part(g, cyl(radius * 0.62, radius * 0.62, width * 0.72, 24), M.chrome, [0, 0, 0], [0, 0, AX]);
  part(g, cyl(radius * 0.30, radius * 0.30, width * 0.92, 18), M.metal, [0, 0, 0], [0, 0, AX]);
  const hubX = side * (width * 0.42);
  part(g, cyl(radius * 0.17, radius * 0.20, 0.06, 14), M.chrome, [hubX, 0, 0], [0, 0, AX]);
  for (let i = 0; i < bolts; i++) {
    const a = (i / bolts) * Math.PI * 2;
    part(g, cyl(0.026, 0.026, 0.05, 6), M.metal,
      [hubX, Math.cos(a) * radius * 0.40, Math.sin(a) * radius * 0.40], [0, 0, AX]);
  }
  g.userData.radius = radius;
  return g;
}

/* ------------------------------------------------------------------ *
 * 程序化贴图
 * ------------------------------------------------------------------ */
function canvas2d(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

/** 柔和圆点：粒子（排烟 / 火花 / 光晕）用 */
export function softDot(size = 128, hardness = 0.28) {
  const [c, x] = canvas2d(size);
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(hardness, 'rgba(255,255,255,.72)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 汽车人风格「面甲」徽标（程序化绘制，非位图素材） */
export function emblemTexture(color = '#d3202a') {
  const [c, x] = canvas2d(256);
  x.clearRect(0, 0, 256, 256);
  x.fillStyle = color;
  x.beginPath();
  x.moveTo(128, 232);
  x.bezierCurveTo(74, 208, 44, 158, 46, 100);
  x.lineTo(72, 100); x.lineTo(72, 36); x.lineTo(104, 62);
  x.lineTo(128, 30); x.lineTo(152, 62); x.lineTo(184, 36);
  x.lineTo(184, 100); x.lineTo(210, 100);
  x.bezierCurveTo(212, 158, 182, 208, 128, 232);
  x.closePath(); x.fill();
  x.globalCompositeOperation = 'destination-out';
  x.fillRect(70, 116, 42, 18);
  x.fillRect(144, 116, 42, 18);
  x.fillRect(96, 162, 64, 13);
  x.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** 地面：沥青 + 细网格 + 中央车库线 */
export function groundTexture() {
  const [c, x] = canvas2d(512);
  x.fillStyle = '#14171d';
  x.fillRect(0, 0, 512, 512);
  // 噪点
  for (let i = 0; i < 5200; i++) {
    const a = Math.random() * 0.05;
    x.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.6})`;
    x.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
  }
  x.strokeStyle = 'rgba(120,170,255,.07)';
  x.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(22, 22);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** 展台贴花：红蓝双环 + 刻度 */
export function padTexture() {
  const [c, x] = canvas2d(1024);
  const R = 512;
  x.clearRect(0, 0, 1024, 1024);
  const ring = (r, w, col) => { x.beginPath(); x.arc(R, R, r, 0, 7); x.lineWidth = w; x.strokeStyle = col; x.stroke(); };
  x.fillStyle = 'rgba(10,14,22,.55)';
  x.beginPath(); x.arc(R, R, 500, 0, 7); x.fill();
  ring(498, 7, 'rgba(224,52,60,.85)');
  ring(470, 3, 'rgba(47,124,224,.75)');
  ring(300, 2, 'rgba(140,190,255,.28)');
  ring(150, 2, 'rgba(140,190,255,.18)');
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, long = i % 6 === 0;
    x.beginPath();
    x.moveTo(R + Math.cos(a) * 462, R + Math.sin(a) * 462);
    x.lineTo(R + Math.cos(a) * (long ? 424 : 446), R + Math.sin(a) * (long ? 424 : 446));
    x.lineWidth = long ? 5 : 2;
    x.strokeStyle = long ? 'rgba(224,52,60,.6)' : 'rgba(140,190,255,.35)';
    x.stroke();
  }
  x.fillStyle = 'rgba(160,200,255,.55)';
  x.font = 'bold 40px Consolas,monospace';
  x.textAlign = 'center';
  x.fillText('CYBERTRON  ·  ASSEMBLY  BAY  07', R, R + 400);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** 挂车侧板贴图 */
export function trailerTexture() {
  const [c, x] = canvas2d(512);
  x.fillStyle = '#e6e9ee'; x.fillRect(0, 0, 512, 512);
  x.fillStyle = '#cfd5de';
  for (let i = 0; i < 512; i += 32) x.fillRect(i, 0, 3, 512);
  x.fillStyle = '#d3202a'; x.fillRect(0, 196, 512, 84);
  x.fillStyle = '#1f4fa0'; x.fillRect(0, 280, 512, 20);
  x.fillStyle = '#f4f6fa';
  x.font = 'bold 62px "Segoe UI",Arial,sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('AUTOBOT', 256, 238);
  x.fillStyle = '#5b6472';
  x.font = 'bold 22px Consolas,monospace';
  x.fillText('PRIME  ·  LONG  HAUL  ·  01', 256, 340);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
