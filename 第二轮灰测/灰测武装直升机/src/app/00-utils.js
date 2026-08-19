/* ============================================================================
 *  00 · 基础工具 / 数学 / 噪声 / 画布
 * ==========================================================================*/

const PI = Math.PI, TAU = PI * 2, DEG = PI / 180;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);

/* 确定性随机（保证每次加载的做旧纹理一致） */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const RND = mulberry32(20260819);
const rnd = (a = 1, b) => b === undefined ? RND() * a : a + RND() * (b - a);
const rsign = () => RND() < 0.5 ? -1 : 1;

/* --- 画布 --- */
function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: false });
  return { c, x };
}

/* 低分辨率白噪声（后续放大插值 → 平滑噪声，比逐像素 fBm 快几十倍） */
function noiseCanvas(n, mono = true, alpha = false) {
  const { c, x } = canvas2d(n, n);
  const img = x.createImageData(n, n);
  const d = img.data;
  for (let i = 0; i < n * n; i++) {
    const v = RND() * 255;
    if (mono) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; }
    else { d[i * 4] = RND() * 255; d[i * 4 + 1] = RND() * 255; d[i * 4 + 2] = RND() * 255; }
    d[i * 4 + 3] = alpha ? v : 255;
  }
  x.putImageData(img, 0, 0);
  return c;
}

/* 多八度分形噪声：低分辨率噪声按倍数放大叠加（首层铺底，其余 overlay 保持中灰）*/
function fbmInto(x, w, h, { octaves = 5, base = 4, gain = 0.62, first = 'source-over', mode = 'overlay', alpha0 = 1 } = {}) {
  x.save();
  let a = alpha0, size = base;
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  for (let o = 0; o < octaves; o++) {
    const n = noiseCanvas(Math.max(2, Math.round(size)));
    x.globalAlpha = o === 0 ? 1 : a;
    x.globalCompositeOperation = o === 0 ? first : mode;
    x.drawImage(n, 0, 0, w, h);
    a *= gain; size *= 2;
  }
  x.restore();
}

/* 生成一张独立的 fbm 灰度画布 */
function fbmCanvas(n, opts = {}) {
  const { c, x } = canvas2d(n, n);
  fbmInto(x, n, n, opts);
  return c;
}

/* 由高度图生成法线贴图（Sobel，紧凑循环） */
function heightToNormal(srcCanvas, strength = 2.2) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const src = srcCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  // 抽取亮度到 Float32（省去逐次乘除）
  const L = new Float32Array(w * h);
  for (let i = 0, n = w * h; i < n; i++) L[i] = src[i * 4] * (1 / 255);
  const { c, x } = canvas2d(w, h);
  const out = x.createImageData(w, h);
  const d = out.data;
  const wm = w - 1, hm = h - 1;
  for (let j = 0; j < h; j++) {
    const j0 = ((j - 1) & hm) * w, j1 = j * w, j2 = ((j + 1) & hm) * w;
    for (let i = 0; i < w; i++) {
      const i0 = (i - 1) & wm, i2 = (i + 1) & wm;
      const tl = L[j0 + i0], t = L[j0 + i], tr = L[j0 + i2];
      const l = L[j1 + i0], r = L[j1 + i2];
      const bl = L[j2 + i0], b = L[j2 + i], br = L[j2 + i2];
      const dx = (tr + 2 * r + br) - (tl + 2 * l + bl);
      const dy = (bl + 2 * b + br) - (tl + 2 * t + tr);
      let nx = -dx * strength, ny = -dy * strength;
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const k = (j1 + i) * 4;
      d[k] = (nx * inv * 0.5 + 0.5) * 255;
      d[k + 1] = (ny * inv * 0.5 + 0.5) * 255;
      d[k + 2] = (inv * 0.5 + 0.5) * 255;
      d[k + 3] = 255;
    }
  }
  x.putImageData(out, 0, 0);
  return c;
}

/* --- 贴图封装 --- */
function tex(canvas, { srgb = false, repeat = 1, aniso = 8, wrap = null } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = wrap || THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = Math.min(aniso, MAXANISO);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

/* 圆角矩形路径 */
function rrect(x, X0, Y0, W, H, R) {
  const r = Math.min(R, W * 0.5, H * 0.5);
  x.beginPath();
  x.moveTo(X0 + r, Y0);
  x.lineTo(X0 + W - r, Y0); x.quadraticCurveTo(X0 + W, Y0, X0 + W, Y0 + r);
  x.lineTo(X0 + W, Y0 + H - r); x.quadraticCurveTo(X0 + W, Y0 + H, X0 + W - r, Y0 + H);
  x.lineTo(X0 + r, Y0 + H); x.quadraticCurveTo(X0, Y0 + H, X0, Y0 + H - r);
  x.lineTo(X0, Y0 + r); x.quadraticCurveTo(X0, Y0, X0 + r, Y0);
  x.closePath();
}

/* 统计 */
const STATS = { tris: 0, meshes: 0, verts: 0 };
function countScene(root) {
  STATS.tris = 0; STATS.meshes = 0; STATS.verts = 0;
  root.traverse(o => {
    if (!o.isMesh && !o.isInstancedMesh) return;
    const g = o.geometry; if (!g || !g.attributes.position) return;
    const n = o.isInstancedMesh ? o.count : 1;
    const v = g.attributes.position.count;
    const t = (g.index ? g.index.count : v) / 3;
    STATS.meshes += n; STATS.verts += v * n; STATS.tris += t * n;
  });
  return STATS;
}
