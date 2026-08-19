/* ============================================================================
 *  10 · 程序化 PBR 贴图工厂（全部 canvas 生成，零外部资源）
 * ==========================================================================*/

const TILE = 2.0;          // 主蒙皮贴图覆盖 2m × 2m
const TEXSZ = 1536;        // 颜色贴图分辨率
const TEXSZ_N = 1024;      // 高度/法线/粗糙度分辨率

/* ---------------------------------------------------------------- 主蒙皮漆 */
/* 返回 { map, normalMap, roughnessMap, aoMap } —— 军绿哑光漆 + 面板缝 + 铆钉 + 做旧 */
function makePaint({
  baseColor = '#4a5046', dark = '#343a31', light = '#5c6255',
  panel = 0.55, rivets = true, wear = 1, seed = 1,
} = {}) {
  const S = TEXSZ, N = TEXSZ_N, K = N / S;
  const { c: cc, x: cx } = canvas2d(S, S);   // albedo
  const { c: hc, x: hx } = canvas2d(N, N);   // height
  const { c: rc, x: rx } = canvas2d(N, N);   // roughness

  /* --- 底色 --- */
  cx.fillStyle = baseColor; cx.fillRect(0, 0, S, S);
  // 大尺度色斑（不同批次补漆）
  const spot = fbmCanvas(256, { octaves: 5, base: 3, gain: 0.6 });
  cx.save(); cx.globalAlpha = 0.16; cx.globalCompositeOperation = 'overlay';
  cx.drawImage(spot, 0, 0, S, S); cx.restore();
  // 细粒噪声（漆面颗粒）
  cx.save(); cx.globalAlpha = 0.05; cx.globalCompositeOperation = 'overlay';
  cx.drawImage(noiseCanvas(256), 0, 0, S, S); cx.restore();

  hx.fillStyle = '#808080'; hx.fillRect(0, 0, N, N);
  hx.save(); hx.globalAlpha = 0.25; hx.globalCompositeOperation = 'overlay';
  hx.drawImage(fbmCanvas(256, { octaves: 4, base: 4 }), 0, 0, N, N);
  hx.globalAlpha = 0.10; hx.drawImage(noiseCanvas(256), 0, 0, N, N);
  hx.restore();

  rx.fillStyle = '#9a9a9a'; rx.fillRect(0, 0, N, N);  // 哑光漆 rough≈0.6
  rx.save(); rx.globalAlpha = 0.30; rx.globalCompositeOperation = 'overlay';
  rx.drawImage(fbmCanvas(128, { octaves: 4, base: 3 }), 0, 0, N, N); rx.restore();

  /* --- 面板缝（网格 + 随机分割） --- */
  const lines = [];   // {x0,y0,x1,y1}
  const R = mulberry32(1000 + seed * 77);
  const gridX = [0, S * 0.31, S * 0.62, S], gridY = [0, S * 0.27, S * 0.53, S * 0.79, S];
  for (const gx of gridX) lines.push([gx, 0, gx, S]);
  for (const gy of gridY) lines.push([0, gy, S, gy]);
  for (let i = 0; i < 10; i++) {   // 内部随机短缝
    const horiz = R() < 0.5;
    const a = R() * S, b = R() * S, len = S * (0.12 + R() * 0.26);
    if (horiz) lines.push([a, b, a + len, b]); else lines.push([a, b, a, b + len]);
  }
  const drawLines = (ctx, sc, colorMain, colorHi, w) => {
    ctx.save();
    ctx.lineCap = 'butt';
    for (const [x0, y0, x1, y1] of lines) {
      ctx.strokeStyle = colorMain; ctx.lineWidth = w * sc;
      ctx.beginPath(); ctx.moveTo(x0 * sc, y0 * sc); ctx.lineTo(x1 * sc, y1 * sc); ctx.stroke();
      if (colorHi) {  // 缝旁高光（漆边磨损）
        ctx.strokeStyle = colorHi; ctx.lineWidth = Math.max(1, w * 0.5 * sc);
        const off = (w * 0.9) * sc;
        const dx = (y1 === y0) ? 0 : off, dy = (y1 === y0) ? off : 0;
        ctx.beginPath(); ctx.moveTo(x0 * sc + dx, y0 * sc + dy); ctx.lineTo(x1 * sc + dx, y1 * sc + dy); ctx.stroke();
      }
    }
    ctx.restore();
  };
  cx.globalAlpha = panel; drawLines(cx, 1, 'rgba(18,22,18,0.92)', 'rgba(158,164,152,0.16)', 3.0); cx.globalAlpha = 1;
  drawLines(hx, K, 'rgba(40,40,40,1)', null, 3.6);        // 凹槽
  drawLines(rx, K, 'rgba(190,190,190,0.6)', null, 3.6);   // 缝内更粗糙

  /* --- 铆钉 --- */
  if (rivets) {
    const rivet = (X, Y) => {
      const r = 2.4;
      cx.fillStyle = 'rgba(28,32,28,0.5)';
      cx.beginPath(); cx.arc(X, Y, r, 0, TAU); cx.fill();
      cx.fillStyle = 'rgba(155,160,150,0.22)';
      cx.beginPath(); cx.arc(X - 0.7, Y - 0.7, r * 0.62, 0, TAU); cx.fill();
      hx.fillStyle = '#c9c9c9';
      hx.beginPath(); hx.arc(X * K, Y * K, r * K * 1.15, 0, TAU); hx.fill();
      rx.fillStyle = 'rgba(120,120,120,0.75)';
      rx.beginPath(); rx.arc(X * K, Y * K, r * K * 1.2, 0, TAU); rx.fill();
    };
    for (const [x0, y0, x1, y1] of lines) {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const step = 26 + R() * 10;
      const cnt = Math.floor(len / step);
      const ox = (y1 === y0) ? 0 : 7, oy = (y1 === y0) ? 7 : 0;
      for (let i = 0; i <= cnt; i++) {
        const t = i / Math.max(1, cnt);
        rivet(lerp(x0, x1, t) + ox, lerp(y0, y1, t) + oy);
      }
    }
    // 检修口盖 + 螺钉圈
    for (let i = 0; i < 5; i++) {
      const X = 60 + R() * (S - 120), Y = 60 + R() * (S - 120);
      const w = 90 + R() * 170, h = 70 + R() * 130;
      cx.save(); cx.globalAlpha = 0.5;
      rrect(cx, X, Y, w, h, 12); cx.strokeStyle = 'rgba(22,26,22,0.9)'; cx.lineWidth = 3; cx.stroke();
      cx.restore();
      hx.save(); rrect(hx, X * K, Y * K, w * K, h * K, 12 * K);
      hx.strokeStyle = '#3a3a3a'; hx.lineWidth = 3.4 * K; hx.stroke(); hx.restore();
      const per = 22;
      const peri = 2 * (w + h), cnt = Math.floor(peri / per);
      for (let k = 0; k < cnt; k++) {
        const t = k / cnt * peri;
        let px, py;
        if (t < w) { px = X + t; py = Y + 6; }
        else if (t < w + h) { px = X + w - 6; py = Y + (t - w); }
        else if (t < 2 * w + h) { px = X + w - (t - w - h); py = Y + h - 6; }
        else { px = X + 6; py = Y + h - (t - 2 * w - h); }
        rivet(px, py);
      }
    }
  }

  /* --- 做旧：漆面掉漆 / 划痕 / 油污 --- */
  if (wear > 0) {
    // 掉漆露金属
    for (let i = 0; i < 150 * wear; i++) {
      const X = R() * S, Y = R() * S, r = 2 + R() * 9;
      cx.save();
      cx.globalAlpha = 0.12 + R() * 0.35;
      cx.fillStyle = R() < 0.55 ? '#7c8177' : '#9aa096';
      cx.beginPath();
      const n = 6 + Math.floor(R() * 4);
      for (let k = 0; k < n; k++) {
        const a = k / n * TAU, rr = r * (0.55 + R() * 0.7);
        const px = X + Math.cos(a) * rr, py = Y + Math.sin(a) * rr;
        k ? cx.lineTo(px, py) : cx.moveTo(px, py);
      }
      cx.closePath(); cx.fill(); cx.restore();
      rx.save(); rx.globalAlpha = 0.5; rx.fillStyle = '#606060';
      rx.beginPath(); rx.arc(X * K, Y * K, r * K, 0, TAU); rx.fill(); rx.restore();
    }
    // 细划痕
    for (let i = 0; i < 95 * wear; i++) {
      const X = R() * S, Y = R() * S, a = R() * TAU, L = 20 + R() * 160;
      cx.save();
      cx.globalAlpha = 0.05 + R() * 0.12;
      cx.strokeStyle = R() < 0.5 ? '#b9bfb4' : '#2a2e28';
      cx.lineWidth = 0.7 + R() * 1.4;
      cx.beginPath(); cx.moveTo(X, Y);
      cx.quadraticCurveTo(X + Math.cos(a) * L * 0.5 + R() * 12, Y + Math.sin(a) * L * 0.5, X + Math.cos(a) * L, Y + Math.sin(a) * L);
      cx.stroke(); cx.restore();
    }
    // 油污渗漏（暗斑 + 高光泽）
    const stain = fbmCanvas(128, { octaves: 5, base: 2 });
    cx.save(); cx.globalAlpha = 0.10; cx.globalCompositeOperation = 'multiply';
    cx.drawImage(stain, 0, 0, S, S); cx.restore();
    rx.save(); rx.globalAlpha = 0.35; rx.globalCompositeOperation = 'multiply';
    rx.drawImage(stain, 0, 0, N, N); rx.restore();
  }

  const nc = heightToNormal(hc, 1.5);
  return {
    map: tex(cc, { srgb: true, repeat: 1 / TILE }),
    normalMap: tex(nc, { repeat: 1 / TILE }),
    roughnessMap: tex(rc, { repeat: 1 / TILE }),
  };
}

/* ------------------------------------------------------------ 金属 / 复材 */
function makeMetal({ base = '#8d9298', rough = '#6a6a6a', brushed = true, scale = 1 } = {}) {
  const N = 512;
  const { c: cc, x: cx } = canvas2d(N, N);
  const { c: hc, x: hx } = canvas2d(N, N);
  const { c: rc, x: rx } = canvas2d(N, N);
  cx.fillStyle = base; cx.fillRect(0, 0, N, N);
  hx.fillStyle = '#808080'; hx.fillRect(0, 0, N, N);
  rx.fillStyle = rough; rx.fillRect(0, 0, N, N);
  if (brushed) {                    // 拉丝纹：小图案 + 平铺，避免上万次 stroke
    const T = 128;
    const { c: tc, x: tx } = canvas2d(T, T);
    for (let i = 0; i < 900; i++) {
      const Y = RND() * T, L = 12 + RND() * 90, X = RND() * T;
      tx.strokeStyle = `rgba(${RND() < 0.5 ? '255,255,255' : '0,0,0'},${(0.03 + RND() * 0.07).toFixed(3)})`;
      tx.lineWidth = 0.6 + RND() * 1.1;
      tx.beginPath(); tx.moveTo(X, Y); tx.lineTo(X + L, Y + (RND() - 0.5) * 1.5); tx.stroke();
    }
    const pat = cx.createPattern(tc, 'repeat');
    cx.save(); cx.globalAlpha = 0.9; cx.fillStyle = pat; cx.fillRect(0, 0, N, N); cx.restore();
    hx.save(); hx.globalAlpha = 0.35; hx.fillStyle = hx.createPattern(tc, 'repeat'); hx.fillRect(0, 0, N, N); hx.restore();
  }
  rx.save(); rx.globalAlpha = 0.3; rx.globalCompositeOperation = 'overlay';
  rx.drawImage(fbmCanvas(128, { octaves: 4, base: 3 }), 0, 0, N, N); rx.restore();
  return {
    map: tex(cc, { srgb: true, repeat: scale }),
    normalMap: tex(heightToNormal(hc, 0.8), { repeat: scale }),
    roughnessMap: tex(rc, { repeat: scale }),
  };
}

/* 桨叶 / 复合材料：细纤维纹 + 轻微不均 */
function makeComposite() {
  const N = 512, W = 16;
  const { c: cc, x: cx } = canvas2d(N, N);
  const { c: rc, x: rx } = canvas2d(N, N);
  const { c: hc, x: hx } = canvas2d(N, N);
  cx.fillStyle = '#22252a'; cx.fillRect(0, 0, N, N);
  hx.fillStyle = '#808080'; hx.fillRect(0, 0, N, N);
  rx.fillStyle = '#7d7d7d'; rx.fillRect(0, 0, N, N);
  // 编织图案：2×2 单元平铺
  const T = W * 2;
  const { c: tc, x: tx } = canvas2d(T, T);
  const { c: th, x: thx } = canvas2d(T, T);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const on = ((i + j) % 2) === 0;
    tx.fillStyle = on ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.065)';
    tx.fillRect(i * W, j * W, W, W);
    thx.fillStyle = on ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
    thx.fillRect(i * W, j * W, W, W);
  }
  cx.fillStyle = cx.createPattern(tc, 'repeat'); cx.fillRect(0, 0, N, N);
  hx.save(); hx.globalAlpha = 0.3; hx.fillStyle = hx.createPattern(th, 'repeat'); hx.fillRect(0, 0, N, N); hx.restore();
  cx.save(); cx.globalAlpha = 0.2; cx.globalCompositeOperation = 'overlay';
  cx.drawImage(fbmCanvas(128, { octaves: 4, base: 3 }), 0, 0, N, N); cx.restore();
  rx.save(); rx.globalAlpha = 0.35; rx.globalCompositeOperation = 'overlay';
  rx.drawImage(fbmCanvas(128, { octaves: 4, base: 4 }), 0, 0, N, N); rx.restore();
  return {
    map: tex(cc, { srgb: true, repeat: 1 / 0.8 }),
    normalMap: tex(heightToNormal(hc, 0.55), { repeat: 1 / 0.8 }),
    roughnessMap: tex(rc, { repeat: 1 / 0.8 }),
  };
}

/* 轮胎：胎面花纹 */
function makeTire() {
  const N = 256;
  const { c: cc, x: cx } = canvas2d(N, N);
  const { c: hc, x: hx } = canvas2d(N, N);
  cx.fillStyle = '#141414'; cx.fillRect(0, 0, N, N);
  hx.fillStyle = '#909090'; hx.fillRect(0, 0, N, N);
  for (let i = 0; i < N; i += 13) {      // 横向沟槽
    hx.fillStyle = '#4a4a4a'; hx.fillRect(i, 0, 5, N);
    cx.fillStyle = 'rgba(0,0,0,0.55)'; cx.fillRect(i, 0, 5, N);
  }
  hx.save(); hx.globalAlpha = 0.35; hx.globalCompositeOperation = 'overlay';
  hx.drawImage(noiseCanvas(128), 0, 0, N, N); hx.restore();
  cx.save(); cx.globalAlpha = 0.15; cx.globalCompositeOperation = 'overlay';
  cx.drawImage(fbmCanvas(128, { octaves: 3, base: 6 }), 0, 0, N, N); cx.restore();
  return {
    map: tex(cc, { srgb: true, repeat: 1 }),
    normalMap: tex(heightToNormal(hc, 1.6), { repeat: 1 }),
  };
}

/* 排气/热区变色（沿轴向色带） */
function makeHeatRamp() {
  const N = 256;
  const { c, x } = canvas2d(N, N);
  const g = x.createLinearGradient(0, 0, 0, N);
  g.addColorStop(0.00, '#2b2b2e');
  g.addColorStop(0.25, '#3b3540');
  g.addColorStop(0.45, '#5b4a4f');
  g.addColorStop(0.62, '#6d5a48');
  g.addColorStop(0.78, '#4a4348');
  g.addColorStop(1.00, '#26262a');
  x.fillStyle = g; x.fillRect(0, 0, N, N);
  x.save(); x.globalAlpha = 0.25; x.globalCompositeOperation = 'overlay';
  x.drawImage(fbmCanvas(128, { octaves: 4, base: 4 }), 0, 0, N, N); x.restore();
  // 烟炱
  x.save(); x.globalAlpha = 0.5;
  const s = x.createLinearGradient(0, N * 0.55, 0, N);
  s.addColorStop(0, 'rgba(10,10,10,0)'); s.addColorStop(1, 'rgba(8,8,8,0.85)');
  x.fillStyle = s; x.fillRect(0, 0, N, N); x.restore();
  return tex(c, { srgb: true, repeat: 1 });
}

/* 传感器镜片：同心镀膜环 */
function makeLens(tint = '#123f3a') {
  const N = 512;
  const { c, x } = canvas2d(N, N);
  x.fillStyle = tint; x.fillRect(0, 0, N, N);
  for (let i = 0; i < 26; i++) {
    x.strokeStyle = `rgba(${120 + RND() * 90},${180 + RND() * 60},${200},${0.05 + RND() * 0.07})`;
    x.lineWidth = 1 + RND() * 3;
    x.beginPath(); x.arc(N / 2, N / 2, 8 + i * 9.4, 0, TAU); x.stroke();
  }
  const g = x.createRadialGradient(N * 0.34, N * 0.30, 4, N * 0.5, N * 0.5, N * 0.58);
  g.addColorStop(0, 'rgba(225,255,250,0.55)');
  g.addColorStop(0.22, 'rgba(120,210,205,0.18)');
  g.addColorStop(0.55, 'rgba(40,110,110,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  x.fillStyle = g; x.fillRect(0, 0, N, N);
  return tex(c, { srgb: true, repeat: 1, wrap: THREE.ClampToEdgeWrapping });
}

/* 进气口滤网 alpha */
function makeScreenAlpha(cell = 10) {
  const N = 256;
  const { c, x } = canvas2d(N, N);
  x.fillStyle = '#000'; x.fillRect(0, 0, N, N);
  x.strokeStyle = '#fff'; x.lineWidth = 2.2;
  for (let i = 0; i <= N; i += cell) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, N); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(N, i); x.stroke();
  }
  return tex(c, { repeat: 1 });
}

/* 旋翼虚化盘：径向渐变 + 桨影拖尾 */
function makeRotorDisc(blades = 4) {
  const N = 1024;
  const { c, x } = canvas2d(N, N);
  x.clearRect(0, 0, N, N);
  const cxp = N / 2;
  const g = x.createRadialGradient(cxp, cxp, N * 0.06, cxp, cxp, N * 0.5);
  g.addColorStop(0.00, 'rgba(30,32,34,0.00)');
  g.addColorStop(0.10, 'rgba(28,30,32,0.10)');
  g.addColorStop(0.55, 'rgba(26,28,30,0.16)');
  g.addColorStop(0.93, 'rgba(30,32,34,0.26)');
  g.addColorStop(0.985, 'rgba(150,150,140,0.30)');
  g.addColorStop(1.00, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.beginPath(); x.arc(cxp, cxp, N * 0.5, 0, TAU); x.fill();
  // 桨影
  for (let b = 0; b < blades; b++) {
    for (let k = 0; k < 26; k++) {
      const a = b / blades * TAU + k * 0.019;
      x.save();
      x.translate(cxp, cxp); x.rotate(a);
      x.globalAlpha = 0.030 * (1 - k / 26);
      x.fillStyle = '#0e1012';
      x.fillRect(N * 0.08, -N * 0.012, N * 0.415, N * 0.024);
      x.restore();
    }
  }
  return tex(c, { srgb: true, repeat: 1, wrap: THREE.ClampToEdgeWrapping });
}

/* ------------------------------------------------------------------ 贴花 */
/* 生成带透明底的贴花贴图；drawFn 在 (0,0,w,h) 内绘制 */
function decalTex(w, h, drawFn) {
  const { c, x } = canvas2d(w, h);
  drawFn(x, w, h);
  const t = tex(c, { srgb: true, repeat: 1, wrap: THREE.ClampToEdgeWrapping });
  return t;
}
const DECAL = {
  text: (s, { color = '#c9cdc4', font = 'bold 78px "Arial Narrow", Arial, sans-serif', pad = 8, alpha = 0.85, w = 512, h = 128 } = {}) =>
    decalTex(w, h, (x, W, H) => {
      x.clearRect(0, 0, W, H);
      x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.globalAlpha = alpha; x.fillStyle = color;
      x.fillText(s, W / 2, H / 2 + 2);
      x.globalAlpha = alpha * 0.25; x.strokeStyle = '#000'; x.lineWidth = 1.5;
      x.strokeText(s, W / 2, H / 2 + 2);
    }),
  star: () => decalTex(512, 512, (x, W, H) => {
    x.clearRect(0, 0, W, H);
    const cxp = W / 2, cyp = H / 2, R = W * 0.42;
    x.save(); x.globalAlpha = 0.8;
    // 低可视度深灰星徽（美军旋翼机常见）
    x.strokeStyle = '#8e948a'; x.lineWidth = 7; x.fillStyle = 'rgba(0,0,0,0)';
    x.beginPath();
    for (let i = 0; i < 5; i++) {
      const a0 = -PI / 2 + i / 5 * TAU;
      const a1 = a0 + TAU / 10;
      const p0 = [cxp + Math.cos(a0) * R, cyp + Math.sin(a0) * R];
      const p1 = [cxp + Math.cos(a1) * R * 0.4, cyp + Math.sin(a1) * R * 0.4];
      i ? x.lineTo(...p0) : x.moveTo(...p0);
      x.lineTo(...p1);
    }
    x.closePath(); x.stroke();
    // 两侧条带
    x.beginPath();
    x.rect(cxp - R * 1.65, cyp - R * 0.30, R * 0.62, R * 0.6); x.stroke();
    x.beginPath();
    x.rect(cxp + R * 1.03, cyp - R * 0.30, R * 0.62, R * 0.6); x.stroke();
    x.restore();
  }),
  warn: (s = 'DANGER') => decalTex(512, 256, (x, W, H) => {
    x.clearRect(0, 0, W, H);
    x.globalAlpha = 0.9;
    x.strokeStyle = '#c8b23a'; x.lineWidth = 8;
    x.beginPath(); x.moveTo(W / 2, 24); x.lineTo(W - 40, H - 60); x.lineTo(40, H - 60); x.closePath(); x.stroke();
    x.fillStyle = '#c8b23a'; x.font = 'bold 92px Arial'; x.textAlign = 'center';
    x.fillText('!', W / 2, H - 88);
    x.font = 'bold 40px "Arial Narrow", Arial'; x.fillStyle = '#b9bdb4';
    x.fillText(s, W / 2, H - 14);
  }),
  stencil: (lines, { size = 34, color = '#b4b9af' } = {}) => decalTex(512, 256, (x, W, H) => {
    x.clearRect(0, 0, W, H);
    x.globalAlpha = 0.8; x.fillStyle = color;
    x.font = `bold ${size}px "Arial Narrow", Arial, sans-serif`;
    x.textAlign = 'left'; x.textBaseline = 'top';
    lines.forEach((l, i) => x.fillText(l, 10, 10 + i * size * 1.25));
  }),
  stripe: (color = '#b8a83a') => decalTex(256, 64, (x, W, H) => {
    x.clearRect(0, 0, W, H);
    x.fillStyle = color; x.globalAlpha = 0.92; x.fillRect(0, 0, W, H);
    x.globalAlpha = 0.25; x.globalCompositeOperation = 'multiply';
    x.drawImage(fbmCanvas(64, { octaves: 3, base: 4 }), 0, 0, W, H);
  }),
};

/* ------------------------------------------------------------------ 地面 */
function makeHelipad(N = 1536) {
  const HN = 512;
  const { c: cc, x: cx } = canvas2d(N, N);
  const { c: hc, x: hx } = canvas2d(HN, HN);
  const { c: rc, x: rx } = canvas2d(HN, HN);
  const K = HN / N;
  /* 水泥底 */
  cx.fillStyle = '#5a5b57'; cx.fillRect(0, 0, N, N);
  cx.save(); cx.globalAlpha = 0.35; cx.globalCompositeOperation = 'overlay';
  cx.drawImage(fbmCanvas(512, { octaves: 6, base: 3 }), 0, 0, N, N);
  cx.globalAlpha = 0.12; cx.drawImage(noiseCanvas(1024), 0, 0, N, N);
  cx.restore();
  hx.fillStyle = '#8a8a8a'; hx.fillRect(0, 0, HN, HN);
  hx.save(); hx.globalAlpha = 0.5; hx.globalCompositeOperation = 'overlay';
  hx.drawImage(fbmCanvas(256, { octaves: 5, base: 4 }), 0, 0, HN, HN); hx.restore();
  rx.fillStyle = '#b0b0b0'; rx.fillRect(0, 0, HN, HN);
  rx.save(); rx.globalAlpha = 0.4; rx.globalCompositeOperation = 'overlay';
  rx.drawImage(fbmCanvas(256, { octaves: 5, base: 3 }), 0, 0, HN, HN); rx.restore();

  /* 混凝土分块缝 */
  cx.strokeStyle = 'rgba(30,30,28,0.45)'; cx.lineWidth = 5;
  hx.strokeStyle = '#4a4a4a'; hx.lineWidth = 6;
  for (let i = 1; i < 6; i++) {
    const p = N * i / 6;
    cx.beginPath(); cx.moveTo(p, 0); cx.lineTo(p, N); cx.stroke();
    cx.beginPath(); cx.moveTo(0, p); cx.lineTo(N, p); cx.stroke();
    hx.beginPath(); hx.moveTo(p * K, 0); hx.lineTo(p * K, HN); hx.stroke();
    hx.beginPath(); hx.moveTo(0, p * K); hx.lineTo(HN, p * K); hx.stroke();
  }
  /* 停机坪标识：圆 + H */
  const cxp = N / 2;
  cx.save();
  cx.strokeStyle = 'rgba(226,228,220,0.62)'; cx.lineWidth = N * 0.014;
  cx.beginPath(); cx.arc(cxp, cxp, N * 0.335, 0, TAU); cx.stroke();
  cx.lineWidth = N * 0.008; cx.globalAlpha = 0.45;
  cx.beginPath(); cx.arc(cxp, cxp, N * 0.30, 0, TAU); cx.stroke();
  cx.restore();
  cx.save();
  cx.fillStyle = 'rgba(228,230,222,0.60)';
  const bw = N * 0.045, bh = N * 0.30, gap = N * 0.115;
  cx.fillRect(cxp - gap - bw / 2, cxp - bh / 2, bw, bh);
  cx.fillRect(cxp + gap - bw / 2, cxp - bh / 2, bw, bh);
  cx.fillRect(cxp - gap, cxp - bw * 0.5, gap * 2, bw);
  cx.restore();
  /* 漆面磨损（擦掉一部分标线） */
  cx.save(); cx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 320; i++) {
    const X = RND() * N, Y = RND() * N, r = 6 + RND() * 34;
    cx.globalAlpha = 0.02 + RND() * 0.10;
    cx.beginPath(); cx.arc(X, Y, r, 0, TAU); cx.fill();
  }
  cx.restore();
  cx.save(); cx.globalAlpha = 0.5; cx.globalCompositeOperation = 'multiply';
  cx.drawImage(fbmCanvas(256, { octaves: 5, base: 2 }), 0, 0, N, N); cx.restore();
  /* 轮胎痕 / 油渍 */
  for (let i = 0; i < 16; i++) {
    cx.save();
    cx.globalAlpha = 0.05 + RND() * 0.10;
    cx.fillStyle = '#1b1b19';
    const X = RND() * N, Y = RND() * N;
    cx.translate(X, Y); cx.rotate(RND() * TAU);
    cx.fillRect(-N * 0.09, -6, N * 0.18, 12);
    cx.restore();
  }
  return {
    map: tex(cc, { srgb: true, repeat: 1, wrap: THREE.ClampToEdgeWrapping, aniso: 16 }),
    normalMap: tex(heightToNormal(hc, 0.9), { repeat: 1, wrap: THREE.ClampToEdgeWrapping, aniso: 16 }),
    roughnessMap: tex(rc, { repeat: 1, wrap: THREE.ClampToEdgeWrapping, aniso: 16 }),
  };
}

/* 软阴影贴片（接地暗角，补足阴影贴图精度） */
function makeContactShadow() {
  const N = 512;
  const { c, x } = canvas2d(N, N);
  const g = x.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, N, N);
  return tex(c, { srgb: true, repeat: 1, wrap: THREE.ClampToEdgeWrapping });
}
