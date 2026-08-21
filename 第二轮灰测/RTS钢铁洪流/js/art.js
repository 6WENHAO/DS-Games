/* ===================================================================
   art.js — 程序化美术模块（零资源：全部像素在运行时用 Canvas2D 画出）

   设计约定
     · 经典脚本，挂载到 window.R.Art，加载顺序在 util.js / config.js 之后。
     · 所有随机数走 R.rng(固定种子)，同一份代码每次生成完全一致。
     · 光照统一假设来自 **左上**：所有精灵在画完后用 source-atop 叠一层
       左上偏亮 / 右下偏暗的对角渐变（applyLight），因此 16 向旋转的载具
       也能保持世界一致的顺光方向，而不是跟着车头转。
     · 载具/炮塔在局部坐标系里一律「+X = 车头/炮口方向」，再整体 rotate。
     · 建筑用「顶面 + 南墙」的低矮挤出（box()）表现体积，阴影落在右下。
     · 精灵尺寸：步兵 16×16、载具 ≤42×42、炮塔 ≤44×44、建筑 = 占地格 ×24。

   缓存：init() 预生成 地形/矿脉/建筑(含受损)/炮塔/单位，全部塞进 Map；
         运行期 tile()/unit()/building() 均为 O(1) 查表。未命中时懒生成。
   =================================================================== */
(function () {
  'use strict';

  const R = (typeof window !== 'undefined' ? window.R : null);
  if (!R || !R.U) return;

  const U = R.U, Col = R.Col, T = R.TILE;
  const TAU = U.TAU;

  /* =================================================================
     §0  基础调色板
     低饱和金属基色为主体，阵营色只做点缀（车体条纹 / 建筑顶板 / 衣服）
     ================================================================= */
  const P = {
    outline: '#131417',

    olive:  { d: '#2a3122', b: '#525d3e', l: '#7c8a5e' },   // 通用军绿
    oliveD: { d: '#222819', b: '#414a32', l: '#616d49' },   // 更深（犀牛/重装）
    sand:   { d: '#4a4029', b: '#907f56', l: '#c3b07f' },   // 沙色（工程车辆）
    gray:   { d: '#282c31', b: '#666d75', l: '#98a0a9' },   // 钢灰
        grayL:  { d: '#33383e', b: '#7c848d', l: '#aeb6bf' },
    track:  { d: '#15171a', b: '#33373c', l: '#4d535a' },   // 履带
    tire:   { d: '#101113', b: '#232528', l: '#383c41' },   // 轮胎
    glass:  { d: '#0e1a24', b: '#2f6a8c', l: '#8fd3ee' },   // 玻璃
    conc:   { d: '#3b3f3c', b: '#858a80', l: '#b1b6ab' },   // 混凝土（亮）
    conc2:  { d: '#2d312f', b: '#6a6f66', l: '#93988d' },   // 混凝土（暗，基座）
    white:  { d: '#666c71', b: '#ccd3d9', l: '#f3f7fa' },   // 实验楼白
    amber:  { d: '#6a4210', b: '#d3961f', l: '#ffe08c' },   // 矿石琥珀
    cyan:   { d: '#123a4e', b: '#2f9ec4', l: '#c2f4ff' },   // 离子能量
    rust:   '#7c4626',
    gold:   '#d7b24c',
    hazY:   '#e0ba2c',
    hazD:   '#1e1b13',
    smoke:  '#181819',
    ember:  '#d9581c',
  };

  const NEUTRAL = { c: (R.NEUTRAL_COLOR || '#9aa4ae'), c2: '#dce3ea', d: '#31363b', id: 'neutral' };

  /** 阵营色三件套；未知阵营 → 中性灰（不抛异常） */
  function facPal(fid) {
    const f = R.FACTIONS && R.FACTIONS[fid];
    if (!f) return NEUTRAL;
    return { c: f.color, c2: f.color2, d: f.dark, id: fid };
  }

  /* =================================================================
     §1  低阶绘制工具（全部对桩件 ctx 安全：不读返回值、不用 measureText）
     ================================================================= */
  const warned = Object.create(null);
  function warnOnce(msg) {
    if (warned[msg]) return;
    warned[msg] = 1;
    if (typeof console !== 'undefined' && console.warn) console.warn('[R.Art] ' + msg);
  }

  function ctxOf(cv) {
    try { return (cv && cv.getContext) ? cv.getContext('2d') : null; } catch (e) { return null; }
  }
  /** 新建离屏画布 + ctx（ctx 可能为 null：Node 桩件） */
  function newCv(w, h) {
    w = Math.max(1, Math.round(w) || 1);
    h = Math.max(1, Math.round(h) || 1);
    const cv = R.makeCanvas(w, h);
    const ctx = ctxOf(cv);
    if (ctx) { ctx.imageSmoothingEnabled = false; ctx.lineJoin = 'miter'; ctx.lineCap = 'butt'; }
    return { cv: cv, ctx: ctx, w: w, h: h };
  }

  function rect(ctx, x, y, w, h, c) { if (w <= 0 || h <= 0) return; ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function orect(ctx, x, y, w, h, c, oc) {
    if (c) rect(ctx, x, y, w, h, c);
    if (oc && w > 1 && h > 1) { ctx.strokeStyle = oc; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
  }
  function circle(ctx, cx, cy, r, c) { if (r <= 0) return; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); }
  function ring(ctx, cx, cy, r, c, lw) { if (r <= 0) return; ctx.strokeStyle = c; ctx.lineWidth = lw || 1; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); }
  function arcs(ctx, cx, cy, r, a0, a1, c, lw) { if (r <= 0) return; ctx.strokeStyle = c; ctx.lineWidth = lw || 1; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke(); }
  function line(ctx, x0, y0, x1, y1, c, lw) {
    ctx.strokeStyle = c; ctx.lineWidth = lw || 1;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  function polyPath(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function poly(ctx, pts, c, oc, lw) {
    polyPath(ctx, pts);
    if (c) { ctx.fillStyle = c; ctx.fill(); }
    if (oc) { ctx.strokeStyle = oc; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function rrPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
  function rrect(ctx, x, y, w, h, r, c, oc) {
    if (w <= 0 || h <= 0) return;
    rrPath(ctx, x, y, w, h, r);
    if (c) { ctx.fillStyle = c; ctx.fill(); }
    if (oc) { ctx.strokeStyle = oc; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function withRot(ctx, cx, cy, ang, fn) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang); fn(); ctx.restore(); }

  /** 线性渐变（桩件下退化为末端纯色，保证不抛异常） */
  function lgrad(ctx, x0, y0, x1, y1, stops) {
    let g = null;
    try { g = ctx.createLinearGradient ? ctx.createLinearGradient(x0, y0, x1, y1) : null; } catch (e) { g = null; }
    if (!g || typeof g.addColorStop !== 'function') return stops[stops.length - 1][1];
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }
  function rgrad(ctx, cx, cy, r0, r1, stops) {
    let g = null;
    try { g = ctx.createRadialGradient ? ctx.createRadialGradient(cx, cy, r0, cx, cy, r1) : null; } catch (e) { g = null; }
    if (!g || typeof g.addColorStop !== 'function') return stops[0][1];
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }

  /** 统一顺光：左上亮、右下暗，只作用在已有像素上（source-atop） */
  function applyLight(ctx, w, h, up, dn) {
    up = (up === undefined ? 0.11 : up);
    dn = (dn === undefined ? 0.15 : dn);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = lgrad(ctx, 0, 0, w, h, [
      [0, 'rgba(255,255,255,' + up + ')'],
      [0.42, 'rgba(255,255,255,0)'],
      [0.58, 'rgba(0,0,0,0)'],
      [1, 'rgba(0,0,0,' + dn + ')'],
    ]);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /** 黄黑警示斜条 */
  function stripes(ctx, x, y, w, h, sw, cA, cB) {
    if (w <= 0 || h <= 0) return;
    sw = sw || 3;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    rect(ctx, x, y, w, h, cA || P.hazY);
    ctx.fillStyle = cB || P.hazD;
    for (let i = -h - sw; i < w + h; i += sw * 2) {
      polyPath(ctx, [[x + i, y + h], [x + i + sw, y + h], [x + i + sw + h, y], [x + i + h, y]]);
      ctx.fill();
    }
    ctx.restore();
  }

  /** 随机斑点（脏化 / 噪点） */
  function speckle(ctx, x, y, w, h, seed, n, c, sz) {
    const rnd = R.rng(seed);
    ctx.fillStyle = c;
    sz = sz || 1;
    for (let i = 0; i < n; i++) ctx.fillRect(Math.floor(x + rnd() * w), Math.floor(y + rnd() * h), sz, sz);
  }

  /** 铆钉排 */
  function rivets(ctx, x0, y0, x1, y1, step, c) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) return;
    const n = Math.max(1, Math.floor(len / step));
    ctx.fillStyle = c;
    for (let i = 0; i <= n; i++) ctx.fillRect(x0 + dx * i / n - 0.5, y0 + dy * i / n - 0.5, 1, 1);
  }

  /** 竖立圆柱（俯视：圆顶 + 侧壁环 + 左上高光） */
  function cyl(ctx, cx, cy, r, pal, ridges) {
    circle(ctx, cx, cy, r, pal.d);
    circle(ctx, cx, cy, r - 1.2, Col.mix(pal.b, pal.d, 0.35));
    circle(ctx, cx - r * 0.14, cy - r * 0.16, Math.max(0.8, r - 2.6), pal.b);
    circle(ctx, cx - r * 0.26, cy - r * 0.3, Math.max(0.6, r - 4.4), Col.mix(pal.b, pal.l, 0.55));
    if (ridges) {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
      for (let i = 0; i < ridges; i++) {
        const a = i * TAU / ridges + 0.3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.42, cy + Math.sin(a) * r * 0.42);
        ctx.lineTo(cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1));
        ctx.stroke();
      }
    }
    arcs(ctx, cx, cy, r - 1.6, Math.PI * 1.05, Math.PI * 1.62, 'rgba(255,255,255,0.30)', 1.3);
    ring(ctx, cx, cy, r, P.outline, 1);
  }

  /** 蒸汽 / 烟（半透明叠圆） */
  function puff(ctx, x, y, r, c, n, dx, dy) {
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      circle(ctx, x + dx * t, y + dy * t, r * (0.6 + t * 0.9), c);
    }
  }

  /** 建筑通用：落地阴影 + 混凝土基座（四周留 1~3px 让格线透出）
      注：render.js 另外会在占地外侧画一层地面阴影，这里只做贴地的浅影 */
  function padBase(ctx, W, H, seed, pal) {
    pal = pal || P.conc2;
    rect(ctx, 3, 3, W - 4, H - 4, 'rgba(0,0,0,0.22)');
    orect(ctx, 1, 1, W - 5, H - 5, pal.b, P.outline);
    rect(ctx, 2, 2, W - 7, 1, pal.l);
    rect(ctx, 2, 2, 1, H - 7, Col.mix(pal.b, pal.l, 0.6));
    speckle(ctx, 2, 2, W - 7, H - 7, seed, Math.round(W * H / 26), 'rgba(0,0,0,0.10)');
    speckle(ctx, 2, 2, W - 7, H - 7, seed + 7, Math.round(W * H / 60), 'rgba(255,255,255,0.06)');
  }

  /** 低矮挤出块：顶面 + 南墙（ht = 南墙高度像素） */
  function box(ctx, x, y, w, h, ht, pal, roofCol) {
    if (w <= 1 || h <= 1) return;
    ht = Math.min(ht, h - 2);
    const top = roofCol || pal.b;
    rect(ctx, x, y + h - ht, w, ht, pal.d);                        // 南墙
    rect(ctx, x, y + h - ht, w, 1, Col.mix(top, pal.d, 0.45));     // 檐口
    rect(ctx, x, y + h - 1, w, 1, Col.scale(pal.d, 0.55));         // 墙脚
    rect(ctx, x, y, w, h - ht, top);                               // 顶面
    rect(ctx, x, y, w, 1, Col.mix(top, pal.l, 0.85));              // 顶面上沿高光
    rect(ctx, x, y, 1, h - ht, Col.mix(top, pal.l, 0.6));          // 左沿高光
    rect(ctx, x + w - 1, y, 1, h - ht, Col.mix(top, pal.d, 0.55)); // 右沿暗
    orect(ctx, x, y, w, h, null, P.outline);
  }

  /* =================================================================
     §2  地形
     每种 4 个 variant。为了拼接无缝：
       · 逐像素纹理用「在 24px 内周期循环」的值噪声（texField），
         所以同 variant 相邻时完全连续；
       · 各 variant 共用同一条颜色 ramp、平均亮度一致，跨 variant
         的边界也看不出接缝；
       · 花色元素（草簇/石块/卵石）一律内缩，不压边。
     ================================================================= */
  const VARIANTS = 4;

  /** 以 TILE 为周期的值噪声，cells 必须整除 TILE */
  function texField(seed, cells) {
    const rnd = R.rng(seed);
    const g = new Float64Array(cells * cells);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    const S = T / cells;
    return function (x, y) {
      const fx = x / S, fy = y / S;
      let x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = U.smooth(fx - x0), ty = U.smooth(fy - y0);
      x0 = ((x0 % cells) + cells) % cells; y0 = ((y0 % cells) + cells) % cells;
      const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
      const a = g[y0 * cells + x0], b = g[y0 * cells + x1], c = g[y1 * cells + x0], d = g[y1 * cells + x1];
      return U.lerp(U.lerp(a, b, tx), U.lerp(c, d, tx), ty);
    };
  }
  function ramp(c0, c1, n) {
    const a = new Array(n);
    for (let i = 0; i < n; i++) a[i] = Col.mix(c0, c1, i / (n - 1));
    return a;
  }
  /** 逐像素铺底：val(x,y) → 0..1 → ramp 量化，得到硬边像素质感 */
  function fillNoise(ctx, cols, val) {
    const n = cols.length;
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        let q = Math.floor(val(x, y) * n);
        if (q < 0) q = 0; else if (q >= n) q = n - 1;
        ctx.fillStyle = cols[q];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  const GRASS_RAMP = ramp('#3b4630', '#5d6d42', 7);
  const DIRT_RAMP  = ramp('#6a5738', '#a08c5e', 7);
  const ROCK_RAMP  = ramp('#43464a', '#767a7e', 6);
  const WATER_RAMP = ramp('#132f4c', '#1f5c85', 6);
  const SHORE_RAMP = ramp('#6f6a4c', '#b0a479', 7);

  function tileGrass(ctx, v) {
    const n1 = texField(9101 + v * 13, 4), n2 = texField(9201 + v * 13, 8), n3 = texField(9301 + v * 13, 24);
    fillNoise(ctx, GRASS_RAMP, function (x, y) { return n1(x, y) * 0.45 + n2(x, y) * 0.33 + n3(x, y) * 0.22; });
    const rnd = R.rng(4400 + v);
    // 草簇（内缩 3px，避免压边产生规律感）
    for (let i = 0, n = rnd.int(3, 5); i < n; i++) {
      const x = rnd.range(4, T - 4), y = rnd.range(6, T - 3);
      for (let k = 0; k < 3; k++) {
        const dx = rnd.range(-1.6, 1.6), hh = rnd.range(2, 3.8);
        line(ctx, x + dx, y, x + dx + rnd.range(-0.9, 0.9), y - hh, k === 1 ? '#7d9152' : '#33401f', 1);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x - 1, y, 3, 1);
    }
    speckle(ctx, 1, 1, T - 2, T - 2, 5500 + v, 10, 'rgba(120,140,80,0.35)');
    speckle(ctx, 1, 1, T - 2, T - 2, 5600 + v, 8, 'rgba(20,26,14,0.30)');
  }

  function tileDirt(ctx, v) {
    const n1 = texField(1101 + v * 17, 4), n2 = texField(1201 + v * 17, 12), n3 = texField(1301 + v * 17, 24);
    fillNoise(ctx, DIRT_RAMP, function (x, y) { return n1(x, y) * 0.5 + n2(x, y) * 0.3 + n3(x, y) * 0.2; });
    const rnd = R.rng(1900 + v);
    for (let i = 0, n = rnd.int(4, 7); i < n; i++) {         // 卵石
      const x = rnd.range(3, T - 4), y = rnd.range(3, T - 4), r = rnd.range(0.9, 1.9);
      circle(ctx, x + 0.6, y + 0.6, r, 'rgba(0,0,0,0.28)');
      circle(ctx, x, y, r, '#8d8471');
      circle(ctx, x - 0.4, y - 0.4, r * 0.55, '#b7ae98');
    }
    for (let i = 0, n = rnd.int(2, 3); i < n; i++) {         // 车辙
      const y = rnd.range(4, T - 4);
      ctx.strokeStyle = 'rgba(60,46,26,0.30)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= T; x += 4) ctx[x === 0 ? 'moveTo' : 'lineTo'](x, y + Math.sin(x * 0.4 + i) * 0.9);
      ctx.stroke();
    }
    speckle(ctx, 1, 1, T - 2, T - 2, 2100 + v, 14, 'rgba(255,240,200,0.10)');
  }

  function tileRock(ctx, v) {
    const n1 = texField(3101 + v * 19, 4), n2 = texField(3201 + v * 19, 12);
    fillNoise(ctx, ROCK_RAMP, function (x, y) { return n1(x, y) * 0.6 + n2(x, y) * 0.4; });
    rect(ctx, 0, 0, T, T, 'rgba(20,22,26,0.18)');
    const rnd = R.rng(3900 + v);
    // 2~3 块有明显体积的岩块：右下投影 + 左上受光面 + 深色轮廓
    for (let i = 0, n = rnd.int(2, 3); i < n; i++) {
      const cx = rnd.range(6, T - 6), cy = rnd.range(6, T - 6), rr = rnd.range(4.5, 8);
      const pts = [], k = rnd.int(5, 6);
      for (let j = 0; j < k; j++) {
        const a = j * TAU / k + rnd.range(-0.22, 0.22), d = rr * rnd.range(0.72, 1.05);
        pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]);
      }
      const sh = pts.map(function (p) { return [p[0] + 2.2, p[1] + 2.4]; });
      poly(ctx, sh, 'rgba(10,12,14,0.45)');
      poly(ctx, pts, '#5c6167', P.outline, 1);
      const lit = pts.map(function (p) { return [cx + (p[0] - cx) * 0.62 - 1.2, cy + (p[1] - cy) * 0.62 - 1.4]; });
      poly(ctx, lit, '#878d94');
      const top = pts.map(function (p) { return [cx + (p[0] - cx) * 0.3 - 1.8, cy + (p[1] - cy) * 0.3 - 2]; });
      poly(ctx, top, '#a4abb2');
      // 裂纹
      line(ctx, cx - rr * 0.4, cy + rr * 0.1, cx + rr * 0.5, cy + rr * 0.45, 'rgba(15,17,20,0.55)', 1);
    }
    speckle(ctx, 1, 1, T - 2, T - 2, 4100 + v, 16, 'rgba(0,0,0,0.30)');
    speckle(ctx, 1, 1, T - 2, T - 2, 4200 + v, 10, 'rgba(200,210,220,0.14)');
  }

  function tileWater(ctx, v) {
    const n1 = texField(7101 + v * 23, 4), n2 = texField(7201 + v * 23, 8);
    fillNoise(ctx, WATER_RAMP, function (x, y) {
      const w = Math.sin((x * 0.55 + y * 0.22 + v * 1.7)) * 0.5 + 0.5;
      return n1(x, y) * 0.5 + n2(x, y) * 0.28 + w * 0.22;
    });
    // 波纹：周期 12px（整除 24），跨格延续
    const rnd = R.rng(7700 + v);
    for (let i = 0, n = rnd.int(3, 5); i < n; i++) {
      const y = rnd.range(2, T - 2), x0 = rnd.range(1, T - 8), len = rnd.range(4, 8);
      ctx.strokeStyle = 'rgba(190,225,245,' + rnd.range(0.16, 0.34).toFixed(2) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= len; x += 2) {
        const yy = y + Math.sin((x0 + x) * (TAU / 12)) * 0.9;
        ctx[x === 0 ? 'moveTo' : 'lineTo'](x0 + x, yy);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const x = rnd.range(3, T - 3), y = rnd.range(3, T - 3);
      rect(ctx, x, y, 2, 1, 'rgba(220,240,255,0.22)');
    }
    rect(ctx, 0, 0, T, T, 'rgba(10,30,60,0.10)');
  }

  function tileShore(ctx, v) {
    const n1 = texField(6101 + v * 29, 4), n2 = texField(6201 + v * 29, 12), n3 = texField(6301 + v * 29, 24);
    fillNoise(ctx, SHORE_RAMP, function (x, y) { return n1(x, y) * 0.48 + n2(x, y) * 0.3 + n3(x, y) * 0.22; });
    const rnd = R.rng(6900 + v);
    // 湿痕（偏蓝的浸水斑）
    for (let i = 0, n = rnd.int(3, 5); i < n; i++) {
      const x = rnd.range(2, T - 4), y = rnd.range(2, T - 4), r = rnd.range(2.5, 5.5);
      circle(ctx, x, y, r, 'rgba(40,80,110,0.26)');
      circle(ctx, x - 0.6, y - 0.6, r * 0.6, 'rgba(60,110,140,0.20)');
    }
    // 浪花细线
    for (let i = 0; i < 3; i++) {
      const y = rnd.range(3, T - 3);
      ctx.strokeStyle = 'rgba(235,245,250,0.30)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= T; x += 3) ctx[x === 0 ? 'moveTo' : 'lineTo'](x, y + Math.sin(x * (TAU / 12) + i) * 1.1);
      ctx.stroke();
    }
    for (let i = 0, n = rnd.int(3, 6); i < n; i++) {   // 贝壳/卵石
      const x = rnd.range(3, T - 3), y = rnd.range(3, T - 3), r = rnd.range(0.8, 1.6);
      circle(ctx, x + 0.5, y + 0.6, r, 'rgba(0,0,0,0.25)');
      circle(ctx, x, y, r, '#cdc4a6');
    }
    speckle(ctx, 1, 1, T - 2, T - 2, 7000 + v, 14, 'rgba(255,255,240,0.12)');
  }

  const TILE_FN = { grass: tileGrass, dirt: tileDirt, rock: tileRock, water: tileWater, shore: tileShore };

  /* ---------------- 矿脉 ---------------- */
  function drawOre(ctx, level) {
    const lv = U.clamp(Math.round(level) || 1, 1, 4);
    const rnd = R.rng(8800 + lv * 31);
    const n = [0, 5, 8, 12, 17][lv];
    const bright = (lv - 1) / 3;
    if (lv >= 3) {   // 高储量：底下一层暖光
      ctx.fillStyle = rgrad(ctx, T / 2, T / 2, 1, T * 0.44, [
        [0, 'rgba(255,205,90,' + (0.10 + bright * 0.16).toFixed(2) + ')'],
        [1, 'rgba(255,190,60,0)'],
      ]);
      ctx.fillRect(0, 0, T, T);
    }
    const base = Col.mix('#8a5f14', '#e8ab24', bright);
    const lit = Col.mix('#d09a28', '#fff0b0', bright);
    for (let i = 0; i < n; i++) {
      // 全部限制在 3..T-3，四周留透明便于叠加
      const x = rnd.range(3.5, T - 3.5), y = rnd.range(3.5, T - 3.5);
      const s = rnd.range(1.5, 2.2 + bright * 1.5);
      const w = s * 0.72;
      circle(ctx, x + 0.7, y + 0.9, s * 0.7, 'rgba(20,12,0,0.30)');
      poly(ctx, [[x, y - s], [x + w, y], [x, y + s], [x - w, y]], base, '#3d2606', 1);
      poly(ctx, [[x, y - s * 0.9], [x + w * 0.45, y - s * 0.1], [x - w * 0.3, y]], lit);
      if (lv >= 2) rect(ctx, x - 0.5, y - s + 0.4, 1, 1, '#fff4c8');
    }
    if (lv >= 4) {   // 闪光十字
      for (let i = 0; i < 4; i++) {
        const x = Math.round(rnd.range(5, T - 5)), y = Math.round(rnd.range(5, T - 5));
        rect(ctx, x - 2, y, 5, 1, 'rgba(255,250,220,0.85)');
        rect(ctx, x, y - 2, 1, 5, 'rgba(255,250,220,0.85)');
      }
    }
  }

  /* =================================================================
     §3  步兵（8 向 × 4 帧，16×16，+X = 面朝方向）
     ================================================================= */
  const INF = {
    rifleman:  { uni: '#4f5a3d', hel: '#3c4632', skin: '#c39a70', pack: 1, wep: 'rifle' },
    rocketeer: { uni: '#47523a', hel: '#39422e', skin: '#c39a70', pack: 1, wep: 'tube' },
    engineer:  { uni: '#d6a92b', hel: '#ece2c4', skin: '#c39a70', pack: 0, wep: 'tool' },
    sniper:    { uni: '#3a4736', hel: '#2f3a2b', skin: '#b8905f', pack: 1, wep: 'sniper' },
    flamer:    { uni: '#4b4536', hel: '#38342a', skin: '#c39a70', pack: 2, wep: 'flame' },
  };
  const INF_CV = 16;

  function drawInfantry(ctx, art, F, dir, frame) {
    const S = INF[art];
    const c = INF_CV / 2;
    const ang = (dir & 7) * (TAU / 8);
    const ph = [0, 1, 0, -1][frame & 3];
    const bob = [0, -0.5, 0, -0.4][frame & 3];

    // 脚下阴影（世界固定，不随朝向旋转）
    circle(ctx, c + 1.2, c + 1.8, 4.1, 'rgba(0,0,0,0.26)');

    withRot(ctx, c, c + bob, ang, function () {
      // 腿（走路帧交替前后）
      rect(ctx, -1.6 + ph * 1.5, 1.2, 3.4, 2.2, '#2c3226');
      rect(ctx, -1.6 - ph * 1.5, -3.4, 3.4, 2.2, '#2c3226');
      orect(ctx, -1.6 + ph * 1.5, 1.2, 3.4, 2.2, null, 'rgba(0,0,0,0.55)');
      orect(ctx, -1.6 - ph * 1.5, -3.4, 3.4, 2.2, null, 'rgba(0,0,0,0.55)');

      // 背包 / 燃料罐
      if (S.pack === 1) rrect(ctx, -5.2, -2.2, 3, 4.4, 1, Col.scale(S.uni, 0.72), P.outline);
      if (S.pack === 2) {
        rrect(ctx, -6, -2.6, 3.6, 5.2, 1.6, '#3b3f44', P.outline);
        rect(ctx, -5.4, -1.8, 2.4, 1, '#7a828a');
        rect(ctx, -5.4, 0.6, 2.4, 1, P.hazY);
      }

      // 躯干
      rrect(ctx, -3.4, -3.2, 7.2, 6.4, 2.2, S.uni, P.outline);
      rect(ctx, -3.4, -3.2, 7.2, 1, Col.mix(S.uni, '#ffffff', 0.18));
      // 肩章 / 胸带 —— 阵营色点缀
      rect(ctx, 0.4, -3.4, 2.6, 1.8, F.c);
      rect(ctx, 0.4, 1.6, 2.6, 1.8, F.c);
      rect(ctx, 0.4, -3.4, 2.6, 0.7, F.c2);

      // 武器
      drawInfWeapon(ctx, S.wep, F);

      // 头 + 钢盔（顶部一圈阵营色）
      circle(ctx, 1.9, 0, 2.6, P.outline);
      circle(ctx, 1.9, 0, 2.1, S.hel);
      circle(ctx, 2.3, -0.5, 1.2, Col.mix(S.hel, '#ffffff', 0.32));
      if (S.wep === 'tool') {                       // 工程师：白色安全帽
        circle(ctx, 1.9, 0, 2.1, '#efe6c8');
        circle(ctx, 2.3, -0.5, 1.1, '#fffbe8');
      }
      rect(ctx, 0.6, -2.0, 1.2, 4.0, F.c);
      if (art === 'sniper') { rect(ctx, -0.4, -2.4, 1.2, 4.8, '#2b3327'); }  // 伪装罩
      rect(ctx, 3.4, -0.6, 1, 1.2, S.skin);                                  // 露出的面部
    });
  }

  function drawInfWeapon(ctx, kind, F) {
    if (kind === 'rifle') {
      rect(ctx, 1.2, 1.0, 6.6, 1.6, '#26282b');
      rect(ctx, 1.2, 1.0, 6.6, 0.6, '#5a6066');
      rect(ctx, 7.4, 1.1, 1.2, 1.4, '#15161a');
      rect(ctx, 0.4, 0.8, 2, 2, '#4a3a25');            // 枪托
    } else if (kind === 'sniper') {
      rect(ctx, 0.6, 1.0, 8.4, 1.4, '#22252a');
      rect(ctx, 0.6, 1.0, 8.4, 0.5, '#5e666e');
      rect(ctx, 2.6, -0.2, 2.4, 1.2, '#101215');        // 瞄准镜
      rect(ctx, 8.6, 1.0, 1.4, 1.4, '#0f1013');
      rect(ctx, 0.0, 0.6, 2.2, 2.2, '#3f3324');
    } else if (kind === 'tube') {
      rrect(ctx, 0.4, -3.2, 8.4, 2.6, 1.2, '#3a4238', P.outline);   // 肩扛发射筒
      rect(ctx, 8.0, -3.0, 1.2, 2.2, '#14161a');
      rect(ctx, 0.4, -3.0, 1.4, 2.2, '#12141a');
      rect(ctx, 3.4, -3.4, 2.2, 0.9, F.c);
      rect(ctx, 1.6, 1.2, 3.4, 1.4, '#2c3128');                     // 扶手
    } else if (kind === 'flame') {
      rect(ctx, 1.4, 0.8, 5.2, 1.6, '#31363b');
      rect(ctx, 6.4, 0.6, 1.8, 2.0, '#54595e');
      rect(ctx, 8.0, 1.0, 1.2, 1.2, '#ff9b3c');                     // 点火嘴
      line(ctx, -3.4, 1.6, 1.6, 1.6, '#20242a', 1);                 // 输料软管
    } else if (kind === 'tool') {
      rrect(ctx, 1.6, 1.4, 4.4, 3.2, 0.8, '#8d939a', P.outline);    // 工具箱
      rect(ctx, 1.6, 2.4, 4.4, 0.9, '#3c4247');
      rect(ctx, 3.0, 0.8, 1.6, 0.8, '#5c6268');
      rect(ctx, -2.0, -1.0, 2.0, 2.0, P.hazY);                      // 反光条
    }
  }

  /* =================================================================
     §4  载具 / 空中（16 向，+X = 车头）
     ================================================================= */
  function hullPath(ctx, xb, xf, hw, cf, cr) {
    ctx.beginPath();
    ctx.moveTo(xf - cf, -hw);
    ctx.lineTo(xf, -hw + cf);
    ctx.lineTo(xf, hw - cf);
    ctx.lineTo(xf - cf, hw);
    ctx.lineTo(xb + cr, hw);
    ctx.lineTo(xb, hw - cr);
    ctx.lineTo(xb, -hw + cr);
    ctx.lineTo(xb + cr, -hw);
    ctx.closePath();
  }
  function hullFill(ctx, xb, xf, hw, cf, cr, pal) {
    hullPath(ctx, xb, xf, hw, cf, cr);
    ctx.fillStyle = pal.b; ctx.fill();
    ctx.strokeStyle = P.outline; ctx.lineWidth = 1; ctx.stroke();
  }
  function clipHull(ctx, xb, xf, hw, cf, cr, fn) {
    ctx.save(); hullPath(ctx, xb, xf, hw, cf, cr); ctx.clip(); fn(); ctx.restore();
  }
  /** 履带：沿 X 延伸的两条，hw = 中心距，tw = 宽 */
  function tracks(ctx, xb, xf, hw, tw, pal) {
    pal = pal || P.track;
    for (let s = -1; s <= 1; s += 2) {
      const y = s * hw - tw / 2;
      orect(ctx, xb, y, xf - xb, tw, pal.b, P.outline);
      ctx.fillStyle = pal.l;
      for (let x = xb + 1.5; x < xf - 1; x += 3) ctx.fillRect(x, y + 1, 1, tw - 2);
      rect(ctx, xb + 1, y + tw / 2 - 0.5, xf - xb - 2, 1, 'rgba(0,0,0,0.40)');
      rect(ctx, xb, y, xf - xb, 1, 'rgba(255,255,255,0.10)');
    }
  }
  /** 轮子 */
  function wheels(ctx, list, rw, rh) {
    for (let i = 0; i < list.length; i++) {
      const x = list[i][0], y = list[i][1];
      rrect(ctx, x - rw / 2, y - rh / 2, rw, rh, Math.min(rw, rh) * 0.45, P.tire.b, P.outline);
      rect(ctx, x - rw / 2 + 1, y - rh / 2 + 1, rw - 2, 1, P.tire.l);
    }
  }
  /** 车体阴影：世界固定右下偏移 */
  function vehShadow(ctx, cv, ang, xb, xf, hw, cf, cr) {
    withRot(ctx, cv / 2 + 1.6, cv / 2 + 1.8, ang, function () {
      hullPath(ctx, xb, xf, hw, cf, cr);
      ctx.fillStyle = 'rgba(0,0,0,0.30)'; ctx.fill();
    });
  }
  function hatch(ctx, x, y, r, pal) {
    circle(ctx, x, y, r, Col.scale(pal.b, 0.7));
    circle(ctx, x - r * 0.2, y - r * 0.25, r * 0.6, Col.mix(pal.b, pal.l, 0.5));
    ring(ctx, x, y, r, P.outline, 1);
  }

  /* ---- 采矿车：大、笨重、前部滚筒，沙色工业涂装 ---- */
  function drawHarvester(ctx, cv, F, ang) {
    const xb = -14, xf = 11, hw = 7.5;
    vehShadow(ctx, cv, ang, xb, xf + 3, 10.5, 3, 2);
    withRot(ctx, cv / 2, cv / 2, ang, function () {
      tracks(ctx, xb, xf, 8.6, 5.4);
      hullFill(ctx, xb, xf, hw, 3, 2, P.sand);
      clipHull(ctx, xb, xf, hw, 3, 2, function () {
        rect(ctx, xb, -hw, 26, 1.4, Col.mix(P.sand.b, '#ffffff', 0.22));
        // 矿仓 + 可见矿石
        orect(ctx, xb + 1, -5.6, 12, 11.2, Col.scale(P.sand.b, 0.78), 'rgba(0,0,0,0.5)');
        for (let i = 0; i < 9; i++) {
          const rnd = R.rng(31 + i);
          const x = xb + 2 + rnd() * 10, y = -4.6 + rnd() * 9;
          circle(ctx, x, y, 1.2, '#c9911f');
          rect(ctx, x - 0.5, y - 1.2, 1, 1, '#ffe08c');
        }
        // 阵营色仓侧条
        rect(ctx, xb + 1, -6.4, 12, 2.0, F.c);
        rect(ctx, xb + 1, 4.4, 12, 2.0, F.c);
        rect(ctx, xb + 1, -6.4, 12, 0.7, F.c2);
        // 驾驶室
        orect(ctx, 1, -5, 7.5, 10, P.sand.l, P.outline);
        rect(ctx, 4.4, -3.6, 3.4, 7.2, P.glass.b);
        rect(ctx, 4.4, -3.6, 3.4, 1.2, P.glass.l);
        rect(ctx, 1, -5.6, 7.5, 1.8, F.c);
        // 排气管
        rect(ctx, -2, -7.4, 2, 2.4, '#3a3d40');
      });
      // 前部滚筒（铲斗）
      rect(ctx, 8, -3, 4, 6, '#5d5a52');
      orect(ctx, 11, -10.5, 4.4, 21, '#4a4b4d', P.outline);
      ctx.fillStyle = '#7d8085';
      for (let y = -9.6; y < 10; y += 2.6) ctx.fillRect(11.4, y, 3.6, 1.2);
      rect(ctx, 14.2, -10.5, 1.4, 21, '#2c2d2f');
      ctx.fillStyle = P.amber.l;                     // 采掘齿
      for (let y = -9.4; y < 10; y += 3.4) ctx.fillRect(14.6, y, 1.4, 1.6);
      stripes(ctx, 8, -10.5, 3, 3.4, 2);             // 警示条
      stripes(ctx, 8, 7.1, 3, 3.4, 2);
      rect(ctx, 11, -10.5, 4.4, 1, 'rgba(255,255,255,0.16)');
    });
  }

  /* ---- 侦察车：小轮式 + 车顶小机枪（无独立炮塔） ---- */
  function drawScout(ctx, cv, F, ang) {
    const xb = -9, xf = 9.5, hw = 5.4;
    vehShadow(ctx, cv, ang, xb, xf, 7.4, 3, 2);
    withRot(ctx, cv / 2, cv / 2, ang, function () {
      wheels(ctx, [[-5.6, -6.4], [-5.6, 6.4], [5.6, -6.4], [5.6, 6.4]], 5.6, 3.4);
      hullFill(ctx, xb, xf, hw, 3.4, 1.6, P.olive);
      clipHull(ctx, xb, xf, hw, 3.4, 1.6, function () {
        rect(ctx, xb, -hw, 19, 1.2, Col.mix(P.olive.b, '#ffffff', 0.25));
        rect(ctx, -1.4, -hw, 3.4, hw * 2, F.c);                 // 阵营色纵条
        rect(ctx, -1.4, -hw, 1, hw * 2, F.c2);
        rect(ctx, xb + 0.6, -3.4, 2.4, 6.8, F.c);               // 尾板
        rect(ctx, 3.2, -3.6, 3.4, 7.2, P.glass.b);              // 风挡
        rect(ctx, 3.2, -3.6, 3.4, 1.1, P.glass.l);
        rect(ctx, 7.2, -3, 1.6, 6, '#3d423c');                  // 前格栅
      });
      // 车顶机枪
      circle(ctx, -1.6, 0, 2.6, Col.scale(P.olive.b, 0.8));
      ring(ctx, -1.6, 0, 2.6, P.outline, 1);
      rect(ctx, 0.4, -0.7, 7, 1.4, '#23262a');
      rect(ctx, 0.4, -0.7, 7, 0.5, '#5b6167');
      rect(ctx, 7.0, -0.9, 1.2, 1.8, '#14161a');
      rect(ctx, 8.6, -4.6, 1.2, 1.2, '#d9e6ee');               // 车灯
      rect(ctx, 8.6, 3.4, 1.2, 1.2, '#d9e6ee');
    });
  }

  /* ---- 通用坦克车体（炮塔另出） ---- */
  function tankBody(ctx, cv, F, ang, o) {
    vehShadow(ctx, cv, ang, o.xb, o.xf, o.tHw + o.tw / 2, o.cf, o.cr);
    withRot(ctx, cv / 2, cv / 2, ang, function () {
      tracks(ctx, o.xb, o.xf, o.tHw, o.tw, o.trk);
      if (o.skirt) {          // 侧裙
        for (let s = -1; s <= 1; s += 2) {
          const y = s * (o.tHw) - 1;
          orect(ctx, o.xb + 1, y - 0.6, (o.xf - o.xb) - 3, 2.2, Col.scale(o.pal.b, 0.85), 'rgba(0,0,0,0.45)');
        }
      }
      hullFill(ctx, o.xb, o.xf, o.hw, o.cf, o.cr, o.pal);
      clipHull(ctx, o.xb, o.xf, o.hw, o.cf, o.cr, function () {
        rect(ctx, o.xb, -o.hw, o.xf - o.xb, 1.2, Col.mix(o.pal.b, '#ffffff', 0.22));
        // 首下装甲板
        rect(ctx, o.xf - o.cf - 3.4, -o.hw, 3.4, o.hw * 2, Col.mix(o.pal.b, o.pal.l, 0.45));
        // 阵营色：尾甲板 + 两侧纵条（约 30% 面积）
        rect(ctx, o.xb + 0.8, -o.hw, 4.4, o.hw * 2, F.c);
        rect(ctx, o.xb + 0.8, -o.hw, 1, o.hw * 2, F.c2);
        rect(ctx, o.xb + 5.6, -o.hw, o.xf - o.xb - 8, 1.8, F.c);
        rect(ctx, o.xb + 5.6, o.hw - 1.8, o.xf - o.xb - 8, 1.8, F.c);
        // 前部阵营色 V 字
        poly(ctx, [[o.xf - 2.4, -o.hw + 0.6], [o.xf - 0.6, 0], [o.xf - 2.4, o.hw - 0.6],
                   [o.xf - 4.2, o.hw - 0.6], [o.xf - 2.4, 0], [o.xf - 4.2, -o.hw + 0.6]], F.c2);
        if (o.rivet) {
          rivets(ctx, o.xb + 2, -o.hw + 1.4, o.xf - 2, -o.hw + 1.4, 3, 'rgba(255,255,255,0.22)');
          rivets(ctx, o.xb + 2, o.hw - 1.4, o.xf - 2, o.hw - 1.4, 3, 'rgba(0,0,0,0.35)');
        }
        if (o.applique) {      // 附加装甲块
          for (let i = 0; i < 3; i++) {
            orect(ctx, o.xb + 3 + i * 4.6, -o.hw + 1.6, 3.6, 2.6, Col.scale(o.pal.b, 1.12), 'rgba(0,0,0,0.4)');
            orect(ctx, o.xb + 3 + i * 4.6, o.hw - 4.2, 3.6, 2.6, Col.scale(o.pal.b, 0.8), 'rgba(0,0,0,0.4)');
          }
        }
        // 工具箱
        orect(ctx, o.xb + 1.6, -o.hw + 1.2, 3, 2.4, '#5b5f52', 'rgba(0,0,0,0.5)');
      });
      // 炮塔座圈
      circle(ctx, o.ring || 0, 0, o.ringR, Col.scale(o.pal.b, 0.62));
      ring(ctx, o.ring || 0, 0, o.ringR, P.outline, 1);
      ring(ctx, o.ring || 0, 0, o.ringR - 1.4, 'rgba(255,255,255,0.10)', 1);
      if (o.exhaust) { rect(ctx, o.xb - 0.6, -4.4, 2, 2.4, '#33363a'); rect(ctx, o.xb - 0.6, 2, 2, 2.4, '#33363a'); }
    });
  }

  function drawLightTank(ctx, cv, F, ang) {
    tankBody(ctx, cv, F, ang, { xb: -10, xf: 10, hw: 5.6, cf: 3.2, cr: 1.6, tHw: 7.2, tw: 4.6, ringR: 4.6, pal: P.olive, skirt: 0 });
  }
  function drawGrizzly(ctx, cv, F, ang) {
    tankBody(ctx, cv, F, ang, { xb: -12, xf: 12, hw: 6.6, cf: 4, cr: 2, tHw: 8.4, tw: 5.4, ringR: 5.6, pal: P.olive, skirt: 1, exhaust: 1 });
  }
  function drawRhino(ctx, cv, F, ang) {
    tankBody(ctx, cv, F, ang, { xb: -12, xf: 12.5, hw: 7.4, cf: 2.4, cr: 1.4, tHw: 9.2, tw: 6.4, ringR: 6, pal: P.oliveD, skirt: 1, rivet: 1, exhaust: 1 });
  }
  function drawApoc(ctx, cv, F, ang) {
    tankBody(ctx, cv, F, ang, { xb: -15, xf: 15, hw: 8.4, cf: 3, cr: 2, tHw: 10.4, tw: 7.2, ringR: 7.2, pal: P.oliveD, skirt: 1, rivet: 1, applique: 1, exhaust: 1 });
  }

  /* ---- 自行火炮：低平底盘 + 尾部驻锄 ---- */
  function drawArtillery(ctx, cv, F, ang) {
    const xb = -12, xf = 11, hw = 6;
    vehShadow(ctx, cv, ang, xb, xf, 8.4, 3, 2);
    withRot(ctx, cv / 2, cv / 2, ang, function () {
      tracks(ctx, xb, xf, 7.6, 5.2);
      // 尾部驻锄
      poly(ctx, [[xb - 2.6, -5], [xb, -3.4], [xb, -1.4], [xb - 2.6, -2.6]], '#4a4d50', P.outline, 1);
      poly(ctx, [[xb - 2.6, 5], [xb, 3.4], [xb, 1.4], [xb - 2.6, 2.6]], '#3e4144', P.outline, 1);
      hullFill(ctx, xb, xf, hw, 3, 1.6, P.olive);
      clipHull(ctx, xb, xf, hw, 3, 1.6, function () {
        rect(ctx, xb, -hw, xf - xb, 1.2, Col.mix(P.olive.b, '#ffffff', 0.22));
        rect(ctx, xb + 0.8, -hw, 3.6, hw * 2, F.c);
        rect(ctx, xb + 4.6, -hw, 12, 1.8, F.c);
        rect(ctx, xb + 4.6, hw - 1.8, 12, 1.8, F.c);
        orect(ctx, 4.4, -4.4, 5.4, 8.8, Col.mix(P.olive.b, P.olive.l, 0.5), 'rgba(0,0,0,0.4)'); // 驾驶室
        rect(ctx, 7.6, -3, 2.2, 6, P.glass.b);
        orect(ctx, -9.8, -4, 4.4, 8, Col.scale(P.olive.b, 0.82), 'rgba(0,0,0,0.45)');           // 弹药架
        ctx.fillStyle = '#8a7340';
        for (let i = 0; i < 4; i++) ctx.fillRect(-9.2, -3.2 + i * 2, 3.2, 1.2);
      });
      circle(ctx, 0, 0, 5, Col.scale(P.olive.b, 0.6));
      ring(ctx, 0, 0, 5, P.outline, 1);
      ring(ctx, 0, 0, 3.4, 'rgba(255,255,255,0.10)', 1);
    });
  }

  /* ---- 防空车：半履带（前轮 + 后履带）+ 敞篷载台 ---- */
  function drawFlakTrack(ctx, cv, F, ang) {
    const xb = -11, xf = 11, hw = 6;
    vehShadow(ctx, cv, ang, xb, xf, 8, 3, 2);
    withRot(ctx, cv / 2, cv / 2, ang, function () {
      wheels(ctx, [[8.4, -6.8], [8.4, 6.8]], 5.4, 3.2);
      tracks(ctx, xb, 4.5, 7.4, 5, P.track);
      hullFill(ctx, xb, xf, hw, 3.2, 1.6, P.olive);
      clipHull(ctx, xb, xf, hw, 3.2, 1.6, function () {
        rect(ctx, xb, -hw, xf - xb, 1.2, Col.mix(P.olive.b, '#ffffff', 0.22));
        // 前驾驶室
        orect(ctx, 4.8, -5.2, 6.6, 10.4, Col.mix(P.olive.b, P.olive.l, 0.4), 'rgba(0,0,0,0.4)');
        rect(ctx, 8.4, -3.6, 2.6, 7.2, P.glass.b);
        rect(ctx, 8.4, -3.6, 2.6, 1.1, P.glass.l);
        rect(ctx, 4.8, -5.8, 6.6, 1.8, F.c);
        // 敞篷后载台（炮塔就架在正中）
        orect(ctx, xb + 1, -5.4, 14.4, 10.8, '#3b4034', 'rgba(0,0,0,0.55)');
        rect(ctx, xb + 1, -5.6, 14.4, 1.6, F.c);
        rect(ctx, xb + 1, 4, 14.4, 1.6, F.c);
        ctx.fillStyle = '#6a6f5c';                                   // 弹药箱
        for (let i = 0; i < 3; i++) ctx.fillRect(xb + 1.6 + i * 2.6, -1.4, 2, 2.8);
        rivets(ctx, xb + 2, -4.6, 3, -4.6, 3, 'rgba(255,255,255,0.18)');
      });
      circle(ctx, 0, 0, 4.6, Col.scale(P.olive.b, 0.58));
      ring(ctx, 0, 0, 4.6, P.outline, 1);
      ring(ctx, 0, 0, 3.2, 'rgba(255,255,255,0.10)', 1);
    });
  }

  /* ---- 基地车：超大工程卡车，6 轮 + 折叠货箱 ---- */
  function drawMcv(ctx, cv, F, ang) {
    const xb = -15, xf = 15, hw = 8.4;
    vehShadow(ctx, cv, ang, xb, xf, 10, 3, 2);
    withRot(ctx, cv / 2, cv / 2, ang, function () {
      wheels(ctx, [[-11, -9.2], [-11, 9.2], [-5.4, -9.2], [-5.4, 9.2], [9.4, -9.2], [9.4, 9.2]], 6.4, 3.8);
      hullFill(ctx, xb, xf, hw, 3, 1.6, P.sand);
      clipHull(ctx, xb, xf, hw, 3, 1.6, function () {
        rect(ctx, xb, -hw, xf - xb, 1.4, Col.mix(P.sand.b, '#ffffff', 0.25));
        // 货箱（折叠中的建造厂）
        orect(ctx, xb + 1, -7.4, 18, 14.8, Col.scale(P.sand.b, 0.8), 'rgba(0,0,0,0.5)');
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(xb + 1 + i * 4.5, -7.4); ctx.lineTo(xb + 1 + i * 4.5, 7.4); ctx.stroke(); }
        rect(ctx, xb + 1, -7.6, 18, 2.4, F.c);
        rect(ctx, xb + 1, 5.2, 18, 2.4, F.c);
        rect(ctx, xb + 1, -7.6, 18, 0.8, F.c2);
        // 驾驶室
        orect(ctx, 5.4, -6.6, 9, 13.2, P.sand.l, P.outline);
        rect(ctx, 10.6, -4.8, 3.4, 9.6, P.glass.b);
        rect(ctx, 10.6, -4.8, 3.4, 1.3, P.glass.l);
        rect(ctx, 5.4, -7, 9, 2, F.c);
        rect(ctx, 4.2, -6.6, 1.6, 13.2, '#4b4f45');
      });
      // 折叠吊臂 + 警示灯
      orect(ctx, -12, -1.4, 20, 2.8, '#585d61', P.outline);
      rect(ctx, -12, -1.4, 20, 1, '#8a9096');
      orect(ctx, 5.6, -2.4, 3, 4.8, '#43474b', P.outline);
      stripes(ctx, -12, -1.4, 4, 2.8, 2);
      circle(ctx, 3.4, -7.4, 1.5, '#ffcf4a'); circle(ctx, 3.4, -7.4, 0.7, '#fff6d0');
      circle(ctx, 3.4, 7.4, 1.5, '#ffcf4a'); circle(ctx, 3.4, 7.4, 0.7, '#fff6d0');
      rect(ctx, 14.4, -5.4, 1.4, 1.6, '#e6f0f6'); rect(ctx, 14.4, 3.8, 1.4, 1.6, '#e6f0f6');
    });
  }

  /* ---- 武装直升机：机身 + 挂弹巢 + 半透明旋翼盘 ---- */
  function drawGunship(ctx, cv, F, ang) {
    const c = cv / 2;
    withRot(ctx, c + 2.4, c + 2.8, ang, function () {         // 机身投影（渲染器另有地面阴影）
      rrect(ctx, -17, -3.4, 29, 6.8, 3, 'rgba(0,0,0,0.22)');
    });
    withRot(ctx, c, c, ang, function () {
      // 尾梁 + 尾桨
      orect(ctx, -17, -1.6, 9, 3.2, P.gray.b, P.outline);
      poly(ctx, [[-18.4, -1.8], [-14.6, -1.8], [-15.6, -6.4], [-17.4, -6.4]], P.gray.d, P.outline, 1);
      rect(ctx, -17.6, -6.4, 3, 1.4, F.c);
      circle(ctx, -17.4, -4.6, 3.6, 'rgba(210,225,240,0.16)');
      ring(ctx, -17.4, -4.6, 3.6, 'rgba(225,238,250,0.28)', 1);
      line(ctx, -20.4, -5.6, -14.4, -3.6, 'rgba(230,240,250,0.4)', 1);

      // 短翼 + 火箭巢
      orect(ctx, -3.4, -10.4, 5.6, 4.4, P.olive.b, P.outline);
      orect(ctx, -3.4, 6, 5.6, 4.4, P.olive.b, P.outline);
      for (let s = -1; s <= 1; s += 2) {
        const y = s < 0 ? -10.2 : 6.2;
        orect(ctx, -4.6, y, 8, 4, '#40453c', P.outline);
        ctx.fillStyle = '#16181b';
        for (let i = 0; i < 3; i++) ctx.fillRect(2, y + 0.8 + i * 1.1, 1.4, 0.9);
        rect(ctx, -4.6, y, 8, 1, F.c);
      }
      // 机身
      poly(ctx, [[12.4, -2], [13.6, 0], [12.4, 2], [-8, 3.6], [-8.6, 0], [-8, -3.6]], P.olive.b, P.outline, 1);
      rect(ctx, -6, -3.2, 12, 1.2, Col.mix(P.olive.b, '#ffffff', 0.25));
      rect(ctx, -7.4, -2.6, 4.4, 5.2, F.c);                     // 阵营色机腹带
      rect(ctx, -7.4, -2.6, 1.2, 5.2, F.c2);
      // 座舱玻璃
      poly(ctx, [[12, -1.8], [13, 0], [12, 1.8], [5, 2.6], [5, -2.6]], P.glass.b, P.outline, 1);
      poly(ctx, [[11.4, -1.4], [12, 0], [8, 0.6], [7.4, -2]], P.glass.l);
      // 起落橇
      line(ctx, -2, -6.6, 5, -6.6, '#2a2d31', 1.4);
      line(ctx, -2, 6.6, 5, 6.6, '#2a2d31', 1.4);
      // 主旋翼盘（半透明虚影）
      circle(ctx, 2, 0, 16, 'rgba(198,214,230,0.09)');
      ring(ctx, 2, 0, 16, 'rgba(220,235,250,0.20)', 1.4);
      ring(ctx, 2, 0, 11, 'rgba(220,235,250,0.10)', 1);
      for (let i = 0; i < 3; i++) {
        const a = i * TAU / 3 + 0.5;
        ctx.strokeStyle = 'rgba(232,242,252,0.38)'; ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(2 + Math.cos(a) * 2.6, Math.sin(a) * 2.6);
        ctx.lineTo(2 + Math.cos(a) * 15.4, Math.sin(a) * 15.4);
        ctx.stroke();
      }
      circle(ctx, 2, 0, 3, '#3c4146'); ring(ctx, 2, 0, 3, P.outline, 1);
      circle(ctx, 2, 0, 1.2, '#8d949b');
    });
  }

  /* ---- 载具表（off 全部为 0：炮塔环一律画在精灵正中心，见 turretOffset 注释） ---- */
  const VEH = {
    harvester: { cv: 38, L: 30, W: 22, pal: P.sand,   draw: drawHarvester, off: { x: 0, y: 0 } },
    scout:     { cv: 26, L: 20, W: 15, pal: P.olive,  draw: drawScout,     off: { x: 0, y: 0 } },
    lightTank: { cv: 30, L: 22, W: 18, pal: P.olive,  draw: drawLightTank, off: { x: 0, y: 0 } },
    grizzly:   { cv: 34, L: 26, W: 20, pal: P.olive,  draw: drawGrizzly,   off: { x: 0, y: 0 } },
    rhino:     { cv: 36, L: 26, W: 22, pal: P.oliveD, draw: drawRhino,     off: { x: 0, y: 0 } },
    flakTrack: { cv: 32, L: 24, W: 18, pal: P.olive,  draw: drawFlakTrack, off: { x: 0, y: 0 } },
    artillery: { cv: 34, L: 26, W: 18, pal: P.olive,  draw: drawArtillery, off: { x: 0, y: 0 } },
    apoc:      { cv: 42, L: 32, W: 24, pal: P.oliveD, draw: drawApoc,      off: { x: 0, y: 0 } },
    mcv:       { cv: 40, L: 32, W: 22, pal: P.sand,   draw: drawMcv,       off: { x: 0, y: 0 } },
    gunship:   { cv: 40, L: 30, W: 14, pal: P.olive,  draw: drawGunship,   off: { x: 0, y: 0 } },
  };

  /* =================================================================
     §5  炮塔（旋转中心 = canvas 正中心，炮口朝 +X）
     ================================================================= */
  function drawTurretBody(ctx, cv, F, S, ang) {
    const c = cv / 2;
    // 阴影：世界固定右下
    withRot(ctx, c + 1.4, c + 1.6, ang, function () {
      hullPath(ctx, -S.back, S.front, S.hw, S.cf || 2, S.cr || 1.4);
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
      for (let i = 0; i < S.barrels.length; i++) {
        const b = S.barrels[i];
        rect(ctx, S.front - 1, (b.y || 0) - b.w / 2, b.len - S.front + 1, b.w, 'rgba(0,0,0,0.24)');
      }
    });
    withRot(ctx, c, c, ang, function () {
      const pal = S.pal || P.olive;
      // 炮管
      for (let i = 0; i < S.barrels.length; i++) {
        const b = S.barrels[i], y = b.y || 0;
        const x0 = S.front - 2;
        orect(ctx, x0, y - b.w / 2, b.len - x0, b.w, P.gray.d, P.outline);
        rect(ctx, x0, y - b.w / 2, b.len - x0, Math.max(0.8, b.w * 0.34), P.gray.b);
        if (b.brake) {
          orect(ctx, b.len - 3.2, y - b.w / 2 - 0.9, 3.2, b.w + 1.8, P.gray.b, P.outline);
          rect(ctx, b.len - 2, y - b.w / 2 - 0.9, 0.8, b.w + 1.8, P.gray.d);
        } else {
          rect(ctx, b.len - 1.2, y - b.w / 2, 1.2, b.w, '#101215');
        }
        if (b.holes) {   // 高炮散热孔
          ctx.fillStyle = 'rgba(0,0,0,0.55)';
          for (let x = x0 + 2; x < b.len - 3; x += 2.4) ctx.fillRect(x, y - b.w / 2 + 0.3, 1, b.w - 0.6);
        }
      }
      // 防盾 / 炮塔体
      hullPath(ctx, -S.back, S.front, S.hw, S.cf || 2, S.cr || 1.4);
      ctx.fillStyle = pal.b; ctx.fill();
      ctx.strokeStyle = P.outline; ctx.lineWidth = 1; ctx.stroke();
      ctx.save();
      hullPath(ctx, -S.back, S.front, S.hw, S.cf || 2, S.cr || 1.4);
      ctx.clip();
      rect(ctx, -S.back, -S.hw, S.back + S.front, 1.2, Col.mix(pal.b, '#ffffff', 0.26));
      // 阵营色顶板（醒目但不占满）
      rect(ctx, -S.back + 0.8, -S.hw + 1.2, (S.back + S.front) * 0.52, S.hw * 2 - 2.4, F.c);
      rect(ctx, -S.back + 0.8, -S.hw + 1.2, 1.2, S.hw * 2 - 2.4, F.c2);
      rect(ctx, S.front - 3, -S.hw, 3, S.hw * 2, Col.mix(pal.b, pal.l, 0.4));
      ctx.restore();
      // 舱盖 / 观瞄
      hatch(ctx, -S.back * 0.35, S.hw * 0.25, Math.max(1.4, S.hw * 0.4), pal);
      rect(ctx, S.front - 1.6, -S.hw - 1.2, 2.4, 1.4, '#2f3338');
      if (S.mg) { rect(ctx, 0.4, -S.hw - 1.6, 5.4, 1.4, '#23262a'); }
      // 后部配重箱
      if (S.basket) orect(ctx, -S.back - 2.4, -S.hw * 0.7, 2.4, S.hw * 1.4, '#4c5147', P.outline);
    });
  }

  const TUR = {
    lightTank: { cv: 34, hw: 5,   back: 6,   front: 6,   pal: P.olive,  barrels: [{ len: 15, w: 2.2 }] },
    grizzly:   { cv: 38, hw: 6,   back: 7,   front: 6.5, pal: P.olive,  barrels: [{ len: 17, w: 2.6, brake: 1 }], basket: 1, mg: 1 },
    rhino:     { cv: 40, hw: 6.6, back: 7.6, front: 6.6, cf: 1.6, pal: P.oliveD, barrels: [{ len: 18, w: 3, brake: 1 }], basket: 1 },
    flakTrack: { cv: 30, hw: 5.4, back: 5,   front: 4.4, pal: P.olive,  barrels: [{ len: 12.5, w: 1.8, y: -2.2, holes: 1 }, { len: 12.5, w: 1.8, y: 2.2, holes: 1 }] },
    artillery: { cv: 44, hw: 5.4, back: 7,   front: 5,   pal: P.olive,  barrels: [{ len: 21, w: 2.4, brake: 1 }], basket: 1 },
    apoc:      { cv: 42, hw: 7.4, back: 8,   front: 7.4, pal: P.oliveD, barrels: [{ len: 19, w: 2.8, y: -3, brake: 1 }, { len: 19, w: 2.8, y: 3, brake: 1 }], basket: 1, mg: 1 },
    pillbox:   { cv: 20, hw: 3.4, back: 3.4, front: 3,   pal: P.conc,   barrels: [{ len: 9, w: 1.6, holes: 1 }] },
    turret:    { cv: 32, hw: 5.8, back: 6,   front: 5.6, pal: P.gray,   barrels: [{ len: 14, w: 3, brake: 1 }] },
    aa:        { cv: 28, hw: 4.8, back: 4.8, front: 4,   pal: P.gray,   barrels: [{ len: 12.5, w: 1.6, y: -2, holes: 1 }, { len: 12.5, w: 1.6, y: 2, holes: 1 }] },
  };

  /* =================================================================
     §6  建筑（canvas = 占地格 ×TILE，左上角对齐）
     ================================================================= */
  /** 建造厂 3×3 */
  function bConyard(ctx, W, H, F) {
    padBase(ctx, W, H, 11);
    const cw = 19, ch = 17;
    const cs = [[3, 3], [W - cw - 4, 3], [3, H - ch - 4], [W - cw - 4, H - ch - 4]];
    for (let i = 0; i < cs.length; i++) {
      box(ctx, cs[i][0], cs[i][1], cw, ch, 5, P.gray);
      rect(ctx, cs[i][0] + 2, cs[i][1] + 2, cw - 4, 4.4, F.c);
      rect(ctx, cs[i][0] + 2, cs[i][1] + 2, cw - 4, 1, F.c2);
      rivets(ctx, cs[i][0] + 2, cs[i][1] + ch - 7, cs[i][0] + cw - 2, cs[i][1] + ch - 7, 4, 'rgba(0,0,0,0.35)');
    }
    // 中央主楼
    box(ctx, 22, 19, 27, 33, 7, P.conc);
    rect(ctx, 24, 21, 23, 9, F.c);
    rect(ctx, 24, 21, 23, 1.4, F.c2);
    rect(ctx, 24, 32, 23, 8, Col.scale(P.conc.b, 0.82));
    rivets(ctx, 24, 31, 46, 31, 4, 'rgba(255,255,255,0.22)');
    // 塔吊：塔身桁架 + 长臂 + 吊钩
    orect(ctx, 30, 26, 12, 12, '#5a5f64', P.outline);
    ctx.strokeStyle = '#9aa1a8'; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(31, 27 + i * 3.6); ctx.lineTo(41, 30.6 + i * 3.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(41, 27 + i * 3.6); ctx.lineTo(31, 30.6 + i * 3.6); ctx.stroke();
    }
    rect(ctx, 30, 26, 12, 1.4, '#b0b7be');
    // 吊臂（斜向右下，投影在下）
    withRot(ctx, 36, 32, 0.5, function () {
      rect(ctx, -2, 12, 30, 4, 'rgba(0,0,0,0.28)');
      orect(ctx, -3, -2, 31, 4, '#787f86', P.outline);
      rect(ctx, -3, -2, 31, 1.2, '#b6bec6');
      stripes(ctx, 21, -2, 3, 4, 2);
      orect(ctx, 14, -3.4, 4.4, 6.8, '#4c5156', P.outline);
      line(ctx, 16, 3.4, 16, 9, '#2b2e32', 1);
      orect(ctx, 14.4, 9, 3.4, 3, '#3a3e42', P.outline);
    });
    circle(ctx, 36, 32, 3.6, '#484d52'); ring(ctx, 36, 32, 3.6, P.outline, 1);
    circle(ctx, 35.2, 31.2, 1.6, '#8e959c');
    // 天线 + 通风机组
    line(ctx, 12, 24, 12, 12, '#8e959c', 1);
    circle(ctx, 12, 11, 1.6, '#e04b3a');
    for (let i = 0; i < 3; i++) orect(ctx, 51, 24 + i * 8, 8, 6, '#6d747b', P.outline);
    for (let i = 0; i < 3; i++) { ring(ctx, 55, 27 + i * 8, 2.2, 'rgba(0,0,0,0.4)', 1); }
    // 地面通道标线
    stripes(ctx, 22, 63, 26, 4, 3);
  }

  /** 发电厂 2×2 */
  function bPower(ctx, W, H, F) {
    padBase(ctx, W, H, 21);
    box(ctx, 3, 12, 24, 30, 6, P.gray);
    rect(ctx, 5, 14, 20, 6, F.c);
    rect(ctx, 5, 14, 20, 1.2, F.c2);
    // 屋顶闪电标
    poly(ctx, [[14, 23], [19, 23], [16, 28], [20, 28], [12, 37], [15, 30], [11.5, 30]], P.hazY, '#3a2f08', 1);
    // 散热片
    ctx.fillStyle = '#4b5157';
    for (let i = 0; i < 5; i++) ctx.fillRect(5, 30 + i * 2.2, 20, 1.2);
    // 两座冷却塔
    cyl(ctx, 36, 13, 8, P.conc, 8);
    cyl(ctx, 36, 33, 8, P.conc, 8);
    circle(ctx, 36, 13, 3.4, '#2e3330'); circle(ctx, 36, 33, 3.4, '#2e3330');
    // 蒸汽
    puff(ctx, 34, 9, 2.6, 'rgba(230,238,244,0.20)', 3, -4, -5);
    puff(ctx, 34, 29, 2.2, 'rgba(230,238,244,0.16)', 3, -4, -5);
    // 管道
    orect(ctx, 26, 16, 5, 3.4, '#6f767d', P.outline);
    orect(ctx, 26, 30, 5, 3.4, '#6f767d', P.outline);
    // 变压器
    orect(ctx, 4, 4, 10, 6, '#5c6268', P.outline);
    for (let i = 0; i < 3; i++) { rect(ctx, 5.4 + i * 3, 2.4, 1.4, 2, '#a8b0b8'); circle(ctx, 6.1 + i * 3, 2.2, 1, '#d6dde3'); }
  }

  /** 矿石精炼厂 3×2（卸矿口在下方，对齐 dock={x:0.5,y:2.1} → 12px 处） */
  function bRefinery(ctx, W, H, F) {
    padBase(ctx, W, H, 31);
    // 主厂房（右侧）
    box(ctx, 46, 5, 22, 30, 6, P.gray);
    rect(ctx, 48, 7, 18, 6, F.c);
    rect(ctx, 48, 7, 18, 1.2, F.c2);
    ctx.fillStyle = '#4d5359';
    for (let i = 0; i < 4; i++) ctx.fillRect(48, 16 + i * 3, 18, 1.4);
    // 两个大罐体
    cyl(ctx, 17, 15, 10.5, P.sand, 10);
    cyl(ctx, 36, 14, 8.5, P.sand, 8);
    rect(ctx, 8, 13.5, 18, 3, F.c);            // 罐体阵营色环带
    rect(ctx, 8, 13.5, 18, 1, F.c2);
    circle(ctx, 17, 15, 3.6, '#5c5238'); ring(ctx, 17, 15, 3.6, P.outline, 1);
    circle(ctx, 36, 14, 3, '#5c5238');
    // 管道网
    orect(ctx, 25, 10, 4, 3, '#7c838a', P.outline);
    orect(ctx, 43, 12, 5, 3, '#7c838a', P.outline);
    line(ctx, 17, 25, 17, 32, '#6d747b', 3);
    line(ctx, 36, 22, 36, 30, '#6d747b', 3);
    // 底部卸料区
    stripes(ctx, 3, 36, 42, 8, 3);
    orect(ctx, 3, 36, 42, 8, null, P.outline);
    // 卸矿槽（中心 x=12，正对 dock）
    poly(ctx, [[5, 33], [19, 33], [16.5, 44.5], [7.5, 44.5]], '#3a3f43', P.outline, 1);
    poly(ctx, [[6.6, 34.4], [17.4, 34.4], [15.6, 43], [8.4, 43]], '#22262a');
    rect(ctx, 8.6, 40, 6.8, 4, '#14171a');                    // 槽口
    // 溢出的矿石
    const rnd = R.rng(777);
    for (let i = 0; i < 12; i++) {
      const x = rnd.range(7, 17), y = rnd.range(35, 44);
      circle(ctx, x, y, rnd.range(0.8, 1.6), '#c9911f');
      rect(ctx, x - 0.5, y - 1.4, 1, 1, '#ffe08c');
    }
    line(ctx, 6.4, 33, 6.4, 44.5, '#8d949b', 1);
    line(ctx, 17.6, 33, 17.6, 44.5, '#8d949b', 1);
    // 传送带（槽 → 罐）
    orect(ctx, 11, 24, 4.4, 9, '#54595e', P.outline);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 4; i++) ctx.fillRect(11.4, 25 + i * 2, 3.6, 1);
    // 右下卸料指示灯
    circle(ctx, 22, 40, 1.6, '#3ad07a'); circle(ctx, 22, 40, 0.7, '#d6ffe8');
  }

  /** 兵营 2×2 */
  function bBarracks(ctx, W, H, F) {
    padBase(ctx, W, H, 41);
    box(ctx, 4, 6, 40, 32, 7, P.olive);
    // 屋脊 + 屋面板缝
    rect(ctx, 4, 14, 40, 1.6, Col.mix(P.olive.b, '#ffffff', 0.32));
    ctx.strokeStyle = 'rgba(0,0,0,0.30)'; ctx.lineWidth = 1;
    for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(4 + i * 6.4, 7); ctx.lineTo(4 + i * 6.4, 31); ctx.stroke(); }
    rect(ctx, 4, 6, 40, 4, F.c);                       // 阵营色屋脊带
    rect(ctx, 4, 6, 40, 1, F.c2);
    // 窗
    for (let i = 0; i < 4; i++) { orect(ctx, 8 + i * 8.6, 24, 4.4, 3.4, P.glass.b, P.outline); rect(ctx, 8 + i * 8.6, 24, 4.4, 1, P.glass.l); }
    // 门廊（朝下）
    orect(ctx, 16, 30, 16, 5, F.c, P.outline);
    rect(ctx, 16, 30, 16, 1.2, F.c2);
    orect(ctx, 18.5, 34, 11, 9, '#20242a', P.outline);
    rect(ctx, 20, 35, 8, 7, '#0f1114');
    rect(ctx, 18.5, 34, 11, 1.2, '#7d848b');
    for (let i = 0; i < 2; i++) rect(ctx, 17.5, 42.5 + i * 1.4, 13, 1, i ? '#5c6167' : '#8b9299');
    // 沙袋掩体
    for (let i = 0; i < 4; i++) { circle(ctx, 6.5 + i * 3.2, 41, 2.1, '#8d8259'); circle(ctx, 6.5 + i * 3.2, 40.4, 1.4, '#b6a97a'); }
    // 旗杆
    line(ctx, 40, 6, 40, 42, '#8d949b', 1);
    poly(ctx, [[40, 38], [46, 39.4], [40, 42.6]], F.c, P.outline, 1);
  }

  /** 战车工厂 3×3 */
  function bFactory(ctx, W, H, F) {
    padBase(ctx, W, H, 51);
    box(ctx, 3, 6, 66, 52, 9, P.gray);
    // 锯齿采光顶
    for (let i = 0; i < 4; i++) {
      const y = 10 + i * 9;
      poly(ctx, [[6, y + 6], [63, y + 6], [63, y + 2], [6, y + 2]], '#4e545a');
      poly(ctx, [[6, y + 2], [63, y + 2], [63, y], [6, y]], P.glass.b);
      rect(ctx, 6, y, 57, 1, P.glass.l);
    }
    rect(ctx, 3, 6, 66, 4, F.c);
    rect(ctx, 3, 6, 66, 1, F.c2);
    // 屋顶行车轨
    rect(ctx, 8, 47, 56, 2.4, '#5b6167');
    orect(ctx, 30, 45.4, 10, 5.4, '#787f86', P.outline);
    // 卷帘门（朝下）
    orect(ctx, 22, 49, 28, 15, '#2b2f34', P.outline);
    ctx.fillStyle = '#3d4247';
    for (let i = 0; i < 6; i++) ctx.fillRect(23, 50 + i * 2.2, 26, 1.4);
    rect(ctx, 22, 49, 28, 2, F.c);
    // 门口黄黑警示 + 引导线
    stripes(ctx, 19, 64, 34, 4, 3);
    stripes(ctx, 19, 49, 3, 15, 2.6);
    stripes(ctx, 50, 49, 3, 15, 2.6);
    // 排气烟囱
    cyl(ctx, 60, 14, 4.6, P.conc, 6); circle(ctx, 60, 14, 2, '#26292c');
    cyl(ctx, 60, 26, 4.6, P.conc, 6); circle(ctx, 60, 26, 2, '#26292c');
    puff(ctx, 58, 10, 2, 'rgba(120,124,128,0.22)', 3, -4, -5);
    // 侧面工具架
    for (let i = 0; i < 3; i++) orect(ctx, 5, 20 + i * 9, 6, 6, '#5f666c', P.outline);
  }

  /** 雷达站 2×2 */
  function bRadar(ctx, W, H, F) {
    padBase(ctx, W, H, 61);
    box(ctx, 3, 16, 24, 26, 6, P.gray);
    rect(ctx, 5, 18, 20, 5, F.c);
    rect(ctx, 5, 18, 20, 1, F.c2);
    ctx.fillStyle = '#4b5157';
    for (let i = 0; i < 3; i++) ctx.fillRect(5, 27 + i * 3, 20, 1.4);
    orect(ctx, 7, 34, 6, 4, P.glass.b, P.outline);
    // 支架 + 碟形天线
    circle(ctx, 33, 30, 6.4, 'rgba(0,0,0,0.3)');
    orect(ctx, 30, 24, 6, 14, '#5c6268', P.outline);
    withRot(ctx, 34, 20, -0.5, function () {
      ctx.save();
      ctx.scale(1, 0.66);
      circle(ctx, 0, 0, 12, '#3f4449');
      circle(ctx, 0, 0, 11, '#b3bcc4');
      circle(ctx, -1.4, -1.4, 8.4, '#cdd6dd');
      ctx.restore();
      ring(ctx, 0, 0, 11, P.outline, 1);
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 4;
        ctx.beginPath(); ctx.moveTo(-Math.cos(a) * 10, -Math.sin(a) * 6.6); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 6.6); ctx.stroke();
      }
      line(ctx, 0, 0, 8, -5, '#8d949b', 1);
      circle(ctx, 8.4, -5.2, 1.6, '#dfe6ec');
      rect(ctx, -11, -1, 22, 1, 'rgba(255,255,255,0.22)');
    });
    circle(ctx, 25, 40, 1.6, '#e04b3a'); circle(ctx, 25, 40, 0.7, '#ffd9d2');
    line(ctx, 8, 16, 8, 6, '#8d949b', 1); circle(ctx, 8, 5, 1.4, '#9fd0ff');
  }

  /** 维修厂 3×3：低平平台 */
  function bRepair(ctx, W, H, F) {
    padBase(ctx, W, H, 71, P.conc2);
    // 黄黑斜条边框
    stripes(ctx, 2, 2, W - 7, 6, 3);
    stripes(ctx, 2, H - 11, W - 7, 6, 3);
    stripes(ctx, 2, 8, 6, H - 19, 3);
    stripes(ctx, W - 11, 8, 6, H - 19, 3);
    orect(ctx, 2, 2, W - 7, H - 7, null, P.outline);
    // 内平台
    orect(ctx, 9, 9, W - 20, H - 20, P.conc.b, P.outline);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(9 + i * 13.5, 9); ctx.lineTo(9 + i * 13.5, H - 11); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(9, 9 + i * 13.5); ctx.lineTo(W - 11, 9 + i * 13.5); ctx.stroke();
    }
    speckle(ctx, 10, 10, W - 22, H - 22, 72, 26, 'rgba(0,0,0,0.16)', 2);
    // 中央大扳手
    withRot(ctx, W / 2, H / 2, -0.72, function () {
      const c = '#3f454b', hl = '#7f878f';
      rect(ctx, -3.2, -13, 6.4, 26, c);
      rect(ctx, -3.2, -13, 2, 26, hl);
      poly(ctx, [[-7, -18], [7, -18], [7, -10], [3, -10], [3, -13.6], [-3, -13.6], [-3, -10], [-7, -10]], c);
      poly(ctx, [[-7, 18], [7, 18], [7, 10], [3, 10], [3, 13.6], [-3, 13.6], [-3, 10], [-7, 10]], c);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1;
      ctx.strokeRect(-3.2, -13, 6.4, 26);
    });
    // 阵营色控制棚（很低）
    box(ctx, 4, H - 22, 14, 12, 3, P.gray, Col.mix(P.gray.b, F.c, 0.75));
    rect(ctx, 5.4, H - 21, 11, 2, F.c2);
    // 四角信号灯
    const L = [[6, 6], [W - 9, 6], [6, H - 9], [W - 9, H - 9]];
    for (let i = 0; i < 4; i++) {
      circle(ctx, L[i][0], L[i][1], 2.4, '#2a2d31');
      circle(ctx, L[i][0], L[i][1], 1.5, '#ffcf4a');
      circle(ctx, L[i][0] - 0.4, L[i][1] - 0.4, 0.7, '#fff8dc');
    }
  }

  /** 直升机坪 2×2 */
  function bHelipad(ctx, W, H, F) {
    padBase(ctx, W, H, 81, P.conc2);
    stripes(ctx, 2, 2, W - 7, 4.4, 2.6);
    stripes(ctx, 2, H - 9, W - 7, 4.4, 2.6);
    orect(ctx, 3, 7, W - 9, H - 17, P.conc.b, P.outline);
    speckle(ctx, 4, 8, W - 11, H - 19, 82, 20, 'rgba(0,0,0,0.14)');
    ring(ctx, W / 2, H / 2, 15, 'rgba(240,246,250,0.85)', 2);
    ring(ctx, W / 2, H / 2, 15, 'rgba(0,0,0,0.35)', 0.6);
    // H 标
    const hx = W / 2, hy = H / 2;
    rect(ctx, hx - 8, hy - 9, 4.4, 18, '#eef4f8');
    rect(ctx, hx + 3.6, hy - 9, 4.4, 18, '#eef4f8');
    rect(ctx, hx - 8, hy - 2, 16, 4, '#eef4f8');
    orect(ctx, hx - 8, hy - 9, 4.4, 18, null, 'rgba(0,0,0,0.4)');
    orect(ctx, hx + 3.6, hy - 9, 4.4, 18, null, 'rgba(0,0,0,0.4)');
    // 阵营色边条 + 灯
    rect(ctx, 3, 7, W - 9, 2.4, F.c);
    rect(ctx, 3, H - 12.4, W - 9, 2.4, F.c);
    const L = [[6, 10], [W - 8, 10], [6, H - 13], [W - 8, H - 13]];
    for (let i = 0; i < 4; i++) { circle(ctx, L[i][0], L[i][1], 1.8, '#2a2d31'); circle(ctx, L[i][0], L[i][1], 1, '#ffe38a'); }
    // 油桶
    cyl(ctx, 9, H - 6.5, 3, P.gray, 4); rect(ctx, 7.4, H - 8, 3.2, 1, P.hazY);
  }

  /** 科技中心 3×3 */
  function bTech(ctx, W, H, F) {
    padBase(ctx, W, H, 91);
    box(ctx, 4, 14, 42, 50, 8, P.white);
    ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(4, 14 + i * 8); ctx.lineTo(46, 14 + i * 8); ctx.stroke(); }
    rect(ctx, 4, 14, 42, 4.4, F.c);
    rect(ctx, 4, 14, 42, 1, F.c2);
    for (let i = 0; i < 4; i++) { orect(ctx, 7 + i * 10, 46, 6, 4.4, P.glass.b, P.outline); rect(ctx, 7 + i * 10, 46, 6, 1.2, P.glass.l); }
    // 侧翼
    box(ctx, 4, 4, 30, 11, 4, P.white);
    rect(ctx, 5.4, 5, 27, 3, F.c);
    // 玻璃穹顶
    circle(ctx, 52, 32, 15, 'rgba(0,0,0,0.28)');
    circle(ctx, 51, 31, 14.4, '#7f8a92');
    ctx.fillStyle = rgrad(ctx, 46, 26, 1, 15, [[0, '#f2fbff'], [0.45, '#9fdcf5'], [1, '#2f6f92']]);
    ctx.beginPath(); ctx.arc(51, 31, 13, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { arcs(ctx, 51, 31, 4 + i * 4.2, 0, TAU, 'rgba(255,255,255,0.30)', 1); }
    line(ctx, 38, 31, 64, 31, 'rgba(255,255,255,0.28)', 1);
    line(ctx, 51, 18, 51, 44, 'rgba(255,255,255,0.28)', 1);
    circle(ctx, 46, 25, 4.2, 'rgba(255,255,255,0.42)');
    ring(ctx, 51, 31, 13, P.outline, 1);
    // 天线阵
    line(ctx, 60, 55, 60, 44, '#8d949b', 1); circle(ctx, 60, 43, 1.6, F.c2);
    line(ctx, 64, 58, 64, 50, '#8d949b', 1); circle(ctx, 64, 49, 1.2, '#e04b3a');
    orect(ctx, 52, 56, 14, 8, P.white.d, P.outline);
    rect(ctx, 53, 57, 12, 2, F.c);
  }

  /** 混凝土墙 1×1（仅内缩 1px，相邻自然连片） */
  function bWall(ctx, W, H, F) {
    rect(ctx, 2, 2, W - 3, H - 3, 'rgba(0,0,0,0.30)');
    orect(ctx, 1, 1, W - 4, H - 4, P.conc.b, P.outline);
    rect(ctx, 2, 2, W - 6, 1.6, P.conc.l);
    rect(ctx, 2, 2, 1.6, H - 6, Col.mix(P.conc.b, P.conc.l, 0.7));
    rect(ctx, W - 4.4, 2, 1.4, H - 6, Col.mix(P.conc.b, P.conc.d, 0.6));
    rect(ctx, 2, H - 5.4, W - 6, 1.4, Col.mix(P.conc.b, P.conc.d, 0.75));
    line(ctx, 1, H / 2, W - 3, H / 2, 'rgba(0,0,0,0.28)', 1);
    speckle(ctx, 3, 3, W - 8, H - 8, 101, 12, 'rgba(0,0,0,0.16)');
    rivets(ctx, 4, 5, W - 6, 5, 5, 'rgba(255,255,255,0.24)');
    rect(ctx, W / 2 - 3, H - 8, 6, 2.4, F.c);
  }

  /** 机枪碉堡 1×1（炮塔另出） */
  function bPillbox(ctx, W, H, F) {
    const c = W / 2;
    circle(ctx, c + 1.6, c + 1.8, 9.4, 'rgba(0,0,0,0.30)');
    // 沙包环
    for (let i = 0; i < 9; i++) {
      const a = i * TAU / 9 + 0.2, x = c + Math.cos(a) * 8, y = c + Math.sin(a) * 8;
      circle(ctx, x, y, 3.1, '#6f6647');
      circle(ctx, x - 0.5, y - 0.7, 2.2, '#a1946a');
      circle(ctx, x - 0.9, y - 1.2, 1.1, '#c0b382');
      ring(ctx, x, y, 3.1, 'rgba(0,0,0,0.35)', 1);
    }
    circle(ctx, c, c, 6.4, P.conc.d);
    circle(ctx, c, c, 5.4, P.conc.b);
    circle(ctx, c - 0.8, c - 1, 3.6, P.conc.l);
    ring(ctx, c, c, 5.4, P.outline, 1);
    rect(ctx, c - 4.4, c - 1, 8.8, 2, F.c);
  }

  /** 要塞炮塔 1×1 底座 */
  function bTurretBase(ctx, W, H, F) {
    const c = W / 2;
    circle(ctx, c + 1.6, c + 1.8, 10, 'rgba(0,0,0,0.32)');
    const pts = [];
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + Math.PI / 8; pts.push([c + Math.cos(a) * 10.2, c + Math.sin(a) * 10.2]); }
    poly(ctx, pts, P.conc.b, P.outline, 1);
    const in2 = pts.map(function (p) { return [c + (p[0] - c) * 0.72 - 0.8, c + (p[1] - c) * 0.72 - 1]; });
    poly(ctx, in2, P.conc.l);
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + Math.PI / 8; circle(ctx, c + Math.cos(a) * 8.4, c + Math.sin(a) * 8.4, 0.9, 'rgba(0,0,0,0.45)'); }
    circle(ctx, c, c, 5.6, Col.scale(P.gray.b, 0.75));
    ring(ctx, c, c, 5.6, P.outline, 1);
    rect(ctx, c - 9.6, c - 1.4, 4.4, 2.8, F.c);
    rect(ctx, c + 5.2, c - 1.4, 4.4, 2.8, F.c);
  }

  /** 防空阵地 1×1 底座 */
  function bAaBase(ctx, W, H, F) {
    const c = W / 2;
    rect(ctx, 3.6, 3.6, W - 4, H - 4, 'rgba(0,0,0,0.30)');
    orect(ctx, 2, 2, W - 5, H - 5, P.conc2.b, P.outline);
    rect(ctx, 3, 3, W - 7, 1.4, P.conc2.l);
    // 角落沙袋 + 弹药箱
    for (let i = 0; i < 4; i++) {
      const x = (i % 2) ? W - 5.4 : 5.4, y = (i > 1) ? H - 5.4 : 5.4;
      circle(ctx, x, y, 2.8, '#6f6647'); circle(ctx, x - 0.6, y - 0.7, 1.9, '#a1946a');
    }
    orect(ctx, 3.4, c - 1.6, 4.4, 3.4, F.c, P.outline);
    orect(ctx, W - 8, c - 1.6, 4.4, 3.4, F.c, P.outline);
    circle(ctx, c, c, 6.2, Col.scale(P.gray.b, 0.7));
    ring(ctx, c, c, 6.2, P.outline, 1);
    ring(ctx, c, c, 4.4, 'rgba(255,255,255,0.14)', 1);
  }

  /** 离子炮 2×2：超级武器 */
  function bIon(ctx, W, H, F) {
    padBase(ctx, W, H, 111, P.conc2);
    const c = W / 2, cy = H / 2;
    // 八角金属基座
    const pts = [];
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + Math.PI / 8; pts.push([c + Math.cos(a) * 21, cy + Math.sin(a) * 21]); }
    poly(ctx, pts, '#4c535a', P.outline, 1);
    const in2 = pts.map(function (p) { return [c + (p[0] - c) * 0.86 - 0.8, cy + (p[1] - cy) * 0.86 - 1]; });
    poly(ctx, in2, '#666e76');
    // 四根支撑柱（阵营色柱头）
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + Math.PI / 4;
      withRot(ctx, c + Math.cos(a) * 15, cy + Math.sin(a) * 15, a, function () {
        orect(ctx, -4, -3.4, 8, 6.8, '#3f464d', P.outline);
        rect(ctx, -4, -3.4, 8, 1.6, '#7d858d');
        rect(ctx, 1.6, -3.4, 2.4, 6.8, F.c);
      });
    }
    // 能量环
    ring(ctx, c, cy, 17, P.gold, 1.6);
    ring(ctx, c, cy, 14.4, '#2b5f78', 3);
    ring(ctx, c, cy, 14.4, 'rgba(120,225,255,0.55)', 1);
    ring(ctx, c, cy, 10.6, '#1d4a60', 3);
    ring(ctx, c, cy, 10.6, 'rgba(150,240,255,0.6)', 1);
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8 + 0.35;
      circle(ctx, c + Math.cos(a) * 14.4, cy + Math.sin(a) * 14.4, 1.5, '#d9fbff');
      circle(ctx, c + Math.cos(a) * 14.4, cy + Math.sin(a) * 14.4, 0.8, '#ffffff');
    }
    // 中央发射透镜
    circle(ctx, c, cy, 8.6, '#101c24');
    ctx.fillStyle = rgrad(ctx, c - 2, cy - 2, 0.5, 8.4, [[0, '#ffffff'], [0.3, '#c8f6ff'], [0.65, '#2f9ec4'], [1, '#123a4e']]);
    ctx.beginPath(); ctx.arc(c, cy, 8, 0, TAU); ctx.fill();
    ring(ctx, c, cy, 8, P.gold, 1.2);
    ring(ctx, c, cy, 8.8, P.outline, 1);
    circle(ctx, c - 2.6, cy - 3, 2.4, 'rgba(255,255,255,0.75)');
    rect(ctx, c - 8, cy - 0.5, 16, 1, 'rgba(230,250,255,0.45)');
    rect(ctx, c - 0.5, cy - 8, 1, 16, 'rgba(230,250,255,0.45)');
    // 高压电缆
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4;
      line(ctx, c + Math.cos(a) * 18, cy + Math.sin(a) * 18, c + Math.cos(a) * 22, cy + Math.sin(a) * 22, '#2c3136', 2);
    }
  }

  const BLD = {
    conyard: bConyard, power: bPower, refinery: bRefinery, barracks: bBarracks,
    factory: bFactory, radar: bRadar, repair: bRepair, helipad: bHelipad,
    tech: bTech, wall: bWall, pillbox: bPillbox, turret: bTurretBase,
    aa: bAaBase, ion: bIon,
  };

  /** art → 占地格（从 config 反查，跟着配置走） */
  const BSIZE = {};
  (function () {
    for (const k in R.BUILDINGS) {
      const d = R.BUILDINGS[k];
      if (d && d.art) BSIZE[d.art] = { w: (d.size && d.size.w) || 1, h: (d.size && d.size.h) || 1 };
    }
  })();
  /* ---------------- 受损版覆盖层 ---------------- */
  function damageOverlay(ctx, W, H, seed) {
    const rnd = R.rng(seed);
    const lim = Math.min(W, H);
    // 焦痕
    for (let i = 0; i < 6; i++) {
      const x = rnd.range(5, W - 5), y = rnd.range(5, H - 5), r = rnd.range(3, Math.max(4, lim * 0.22));
      circle(ctx, x, y, r, 'rgba(18,14,12,0.40)');
      circle(ctx, x, y, r * 0.55, 'rgba(10,8,6,0.42)');
    }
    // 裂缝
    for (let i = 0; i < 4; i++) {
      let x = rnd.range(6, W - 6), y = rnd.range(6, H - 6);
      ctx.strokeStyle = 'rgba(12,10,9,0.7)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += rnd.range(-6, 6); y += rnd.range(-6, 6); ctx.lineTo(U.clamp(x, 3, W - 3), U.clamp(y, 3, H - 3)); }
      ctx.stroke();
    }
    // 破洞 + 余烬
    for (let i = 0; i < 2; i++) {
      const x = rnd.range(8, W - 8), y = rnd.range(8, H - 8), r = rnd.range(3.5, 6);
      const pts = [];
      for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + rnd.range(-0.3, 0.3); const d = r * rnd.range(0.7, 1.15); pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d]); }
      poly(ctx, pts, '#15120f', '#3c342b', 1);
      circle(ctx, x, y, r * 0.4, 'rgba(216,80,24,0.55)');
      circle(ctx, x, y, r * 0.2, 'rgba(255,190,90,0.7)');
    }
    // 黑烟（向上飘）
    const sx = W * 0.5 + (rnd() - 0.5) * W * 0.2;
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      circle(ctx, sx - t * W * 0.14, H * 0.46 - t * H * 0.34, 3.4 + t * (lim * 0.16), 'rgba(26,26,28,' + (0.34 - t * 0.16).toFixed(2) + ')');
    }
    circle(ctx, sx, H * 0.47, 2.4, 'rgba(255,150,50,0.5)');
    // 掉落碎块
    for (let i = 0; i < 8; i++) {
      const x = rnd.range(3, W - 4), y = rnd.range(3, H - 4);
      rect(ctx, x, y, rnd.int(1, 2), rnd.int(1, 2), 'rgba(30,26,22,0.6)');
    }
  }

  /* ---------------- 残骸 ---------------- */
  function drawWreck(ctx, art, cv) {
    const S = VEH[art];
    const c = cv / 2;
    const L = S ? S.L : 20, Wd = S ? S.W : 14;
    const rnd = R.rng(1234 + L * 7);
    // 地面焦痕
    circle(ctx, c + 1, c + 1.4, L * 0.44, 'rgba(16,14,12,0.38)');
    circle(ctx, c - 2, c + 3, L * 0.26, 'rgba(16,14,12,0.30)');
    withRot(ctx, c, c, 0.34, function () {
      const xb = -L * 0.44, xf = L * 0.42, hw = Wd * 0.3;
      // 断裂履带/轮
      for (let s = -1; s <= 1; s += 2) {
        const y = s * (Wd * 0.4) - 2;
        rect(ctx, xb, y, (xf - xb) * 0.55, 4, '#1c1d1f');
        rect(ctx, xb + (xf - xb) * 0.7, y + 1, (xf - xb) * 0.3, 3.4, '#1c1d1f');
      }
      // 焦黑壳体
      hullPath(ctx, xb, xf, hw, 3, 2);
      ctx.fillStyle = '#2c2a27'; ctx.fill();
      ctx.strokeStyle = '#141310'; ctx.lineWidth = 1; ctx.stroke();
      clipHull(ctx, xb, xf, hw, 3, 2, function () {
        rect(ctx, xb, -hw, xf - xb, 1.2, '#4a463f');
        for (let i = 0; i < 5; i++) {
          const x = rnd.range(xb + 1, xf - 2), y = rnd.range(-hw, hw - 1);
          circle(ctx, x, y, rnd.range(1, 2.6), '#131210');
        }
        rect(ctx, xb + 2, -1, (xf - xb) * 0.5, 2, '#3b332c');
      });
      // 撕裂的装甲片
      poly(ctx, [[xf - 2, -hw], [xf + 3, -hw - 3], [xf + 1, -hw + 2]], '#211f1c', '#141310', 1);
      poly(ctx, [[xb + 1, hw], [xb - 3, hw + 3.4], [xb + 3, hw + 1]], '#211f1c', '#141310', 1);
      // 残余炮管
      if (TUR[art]) { rect(ctx, 1, -1.2, L * 0.34, 2.4, '#232120'); rect(ctx, 1, -1.2, L * 0.34, 0.8, '#3e3a36'); }
      // 余烬
      circle(ctx, 0, 0, 2.2, 'rgba(190,70,20,0.35)');
    });
    // 淡烟
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      circle(ctx, c - 1 - t * 3, c - 4 - t * 6, 2.2 + t * 3.2, 'rgba(40,40,42,' + (0.22 - t * 0.08).toFixed(2) + ')');
    }
  }

  /* =================================================================
     §7  缓存 + 对外 API
     ================================================================= */
  const cTile = new Map();     // kind|variant
  const cOre = new Map();      // level
  const cUnit = new Map();     // art|fac|dir|frame
  const cTur = new Map();      // art|fac|dir
  const cBld = new Map();      // art|fac
  const cDmg = new Map();      // art|fac
  const cWreck = new Map();    // art
  const cIcon = new Map();     // defId
  const cPlace = new Map();    // w|h

  let probeFailed = false;
  function canDraw() {
    const o = newCv(2, 2);
    return !!o.ctx;
  }

  /** 未知 key 的占位图：洋红方块 + 叉 */
  function placeholder(w, h) {
    const key = w + '|' + h;
    let cv = cPlace.get(key);
    if (cv) return cv;
    const o = newCv(w, h);
    cv = o.cv;
    if (o.ctx) {
      const ctx = o.ctx;
      rect(ctx, 0, 0, w, h, '#ff00d0');
      orect(ctx, 0, 0, w, h, null, '#280023');
      line(ctx, 1, 1, w - 1, h - 1, '#280023', 1);
      line(ctx, w - 1, 1, 1, h - 1, '#280023', 1);
      rect(ctx, w * 0.5 - 1, h * 0.5 - 1, 2, 2, '#ffffff');
    }
    cPlace.set(key, cv);
    return cv;
  }

  /* ---- 生成器（未命中时懒生成） ---- */
  function genTile(kind, variant) {
    const fn = TILE_FN[kind];
    const v = ((Math.round(variant) || 0) % VARIANTS + VARIANTS) % VARIANTS;
    const key = kind + '|' + v;
    let cv = cTile.get(key);
    if (cv) return cv;
    if (!fn) { warnOnce('未知地形 kind: ' + kind); return placeholder(T, T); }
    const o = newCv(T, T);
    if (o.ctx) fn(o.ctx, v);
    cTile.set(key, o.cv);
    return o.cv;
  }

  function genOre(level) {
    const lv = U.clamp(Math.round(level) || 1, 1, 4);
    let cv = cOre.get(lv);
    if (cv) return cv;
    const o = newCv(T, T);
    if (o.ctx) { drawOre(o.ctx, lv); }
    cOre.set(lv, o.cv);
    return o.cv;
  }

  function genUnit(art, fid, dir, frame) {
    const inf = INF[art], veh = VEH[art];
    if (!inf && !veh) { warnOnce('未知单位 artKey: ' + art); return placeholder(24, 24); }
    const F = facPal(fid);
    const d = inf ? (((Math.round(dir) || 0) % 8) + 8) % 8 : (((Math.round(dir) || 0) % 16) + 16) % 16;
    const fr = inf ? (((Math.round(frame) || 0) % 4) + 4) % 4 : 0;
    const key = art + '|' + F.id + '|' + d + '|' + fr;
    let cv = cUnit.get(key);
    if (cv) return cv;
    if (inf) {
      const o = newCv(INF_CV, INF_CV);
      if (o.ctx) { drawInfantry(o.ctx, art, F, d, fr); applyLight(o.ctx, INF_CV, INF_CV, 0.13, 0.16); }
      cUnit.set(key, o.cv);
      return o.cv;
    }
    const o = newCv(veh.cv, veh.cv);
    if (o.ctx) { veh.draw(o.ctx, veh.cv, F, d * (TAU / 16)); applyLight(o.ctx, veh.cv, veh.cv, 0.10, 0.15); }
    cUnit.set(key, o.cv);
    return o.cv;
  }

  function genTurret(art, fid, dir) {
    const S = TUR[art];
    if (!S) return null;
    const F = facPal(fid);
    const d = (((Math.round(dir) || 0) % 16) + 16) % 16;
    const key = art + '|' + F.id + '|' + d;
    let cv = cTur.get(key);
    if (cv) return cv;
    const o = newCv(S.cv, S.cv);
    if (o.ctx) { drawTurretBody(o.ctx, S.cv, F, S, d * (TAU / 16)); applyLight(o.ctx, S.cv, S.cv, 0.12, 0.16); }
    cTur.set(key, o.cv);
    return o.cv;
  }

  function genBuilding(art, fid) {
    const fn = BLD[art], sz = BSIZE[art];
    if (!fn || !sz) { warnOnce('未知建筑 artKey: ' + art); return placeholder(T * 2, T * 2); }
    const F = facPal(fid);
    const key = art + '|' + F.id;
    let cv = cBld.get(key);
    if (cv) return cv;
    const W = sz.w * T, H = sz.h * T;
    const o = newCv(W, H);
    if (o.ctx) { fn(o.ctx, W, H, F); applyLight(o.ctx, W, H, 0.08, 0.12); }
    cBld.set(key, o.cv);
    return o.cv;
  }

  function genDamaged(art, fid) {
    const sz = BSIZE[art];
    if (!BLD[art] || !sz) { warnOnce('未知建筑 artKey: ' + art); return placeholder(T * 2, T * 2); }
    const F = facPal(fid);
    const key = art + '|' + F.id;
    let cv = cDmg.get(key);
    if (cv) return cv;
    const W = sz.w * T, H = sz.h * T;
    const o = newCv(W, H);
    if (o.ctx) {
      const base = genBuilding(art, fid);
      o.ctx.drawImage(base, 0, 0);
      damageOverlay(o.ctx, W, H, 500 + art.length * 37);
    }
    cDmg.set(key, o.cv);
    return o.cv;
  }

  function genWreck(art) {
    if (INF[art]) return null;
    if (!VEH[art]) { warnOnce('未知残骸 artKey: ' + art); return placeholder(24, 24); }
    let cv = cWreck.get(art);
    if (cv) return cv;
    const size = VEH[art].cv;
    const o = newCv(size, size);
    if (o.ctx) { drawWreck(o.ctx, art, size); applyLight(o.ctx, size, size, 0.08, 0.18); }
    cWreck.set(art, o.cv);
    return o.cv;
  }

  /** 图标 56×46：深底 + 细边框 + 中性配色缩略图 */
  const ICON_W = 56, ICON_H = 46;
  function genIcon(defId) {
    let cv = cIcon.get(defId);
    if (cv) return cv;
    const def = R.def ? R.def(defId) : null;
    const o = newCv(ICON_W, ICON_H);
    const ctx = o.ctx;
    if (!def) { warnOnce('未知图标 defId: ' + defId); cIcon.set(defId, placeholder(ICON_W, ICON_H)); return cIcon.get(defId); }
    if (ctx) {
      // 背景
      ctx.fillStyle = lgrad(ctx, 0, 0, 0, ICON_H, [[0, '#2b3238'], [0.55, '#1d2328'], [1, '#141a1f']]);
      ctx.fillRect(0, 0, ICON_W, ICON_H);
      speckle(ctx, 2, 2, ICON_W - 4, ICON_H - 4, 900 + defId.length, 26, 'rgba(255,255,255,0.04)');
      // 缩略图（中性色）
      let src = null, extra = null, ex = 0, ey = 0, isBld = false;
      if (R.BUILDINGS[defId]) {
        isBld = true;
        src = genBuilding(def.art, 'neutral');
        if (TUR[def.art]) extra = genTurret(def.art, 'neutral', 14);
      } else {
        const isInf = def.kind === 'infantry';
        src = genUnit(def.art, 'neutral', isInf ? 2 : 14, 0);
        if (TUR[def.art]) {
          extra = genTurret(def.art, 'neutral', 14);
          const off = VEH[def.art] ? VEH[def.art].off : { x: 0, y: 0 };
          ex = off.x; ey = off.y;
        }
      }
      if (src && src.width > 0 && src.height > 0) {
        const maxW = ICON_W - 8, maxH = ICON_H - 8;
        // 精灵画布本身留了旋转余量，单位放大 1.25 倍让缩略图更饱满
        const boxW = Math.max(src.width, extra ? extra.width : 0);
        const boxH = Math.max(src.height, extra ? extra.height : 0);
        let s = Math.min(maxW / boxW, maxH / boxH) * (isBld ? 1.0 : 1.22);
        s = U.clamp(s, 0.4, 2.4);
        ctx.imageSmoothingEnabled = true;
        const dw = src.width * s, dh = src.height * s;
        const dx = (ICON_W - dw) / 2, dy = (ICON_H - dh) / 2;
        ctx.drawImage(src, dx, dy, dw, dh);
        if (extra && extra.width > 0) {
          const tw = extra.width * s, th = extra.height * s;
          ctx.drawImage(extra, ICON_W / 2 - tw / 2 + ex * s, ICON_H / 2 - th / 2 + ey * s, tw, th);
        }
        ctx.imageSmoothingEnabled = false;
      }
      // 边框
      orect(ctx, 0, 0, ICON_W, ICON_H, null, '#0d1114');
      orect(ctx, 1, 1, ICON_W - 2, ICON_H - 2, null, '#5b6670');
      rect(ctx, 2, 2, ICON_W - 4, 1, 'rgba(255,255,255,0.16)');
      rect(ctx, 2, ICON_H - 3, ICON_W - 4, 1, 'rgba(0,0,0,0.45)');
    }
    cIcon.set(defId, o.cv);
    return o.cv;
  }

  /* ---- 预生成 ---- */
  function buildAllTiles() {
    for (const k in TILE_FN) for (let v = 0; v < VARIANTS; v++) genTile(k, v);
    for (let l = 1; l <= 4; l++) genOre(l);
  }
  function buildAllBuildings() {
    const facs = ['guard', 'steel'];
    for (const art in BLD) {
      if (!BSIZE[art]) continue;
      for (let i = 0; i < facs.length; i++) { genBuilding(art, facs[i]); genDamaged(art, facs[i]); }
    }
  }
  function buildAllTurrets() {
    const facs = ['guard', 'steel'];
    for (const art in TUR) for (let i = 0; i < facs.length; i++) for (let d = 0; d < 16; d++) genTurret(art, facs[i], d);
  }
  function buildAllUnits() {
    const facs = ['guard', 'steel'];
    for (let i = 0; i < facs.length; i++) {
      for (const art in VEH) { for (let d = 0; d < 16; d++) genUnit(art, facs[i], d, 0); }
      for (const art in INF) { for (let d = 0; d < 8; d++) for (let f = 0; f < 4; f++) genUnit(art, facs[i], d, f); }
    }
    for (const art in VEH) genWreck(art);
  }
  function buildAllIcons() {
    for (const k in R.BUILDINGS) genIcon(k);
    for (const k in R.UNITS) genIcon(k);
  }

  /* =================================================================
     §8  导出
     ================================================================= */
  const Art = {
    ready: false,
    /** init() 耗时（ms），便于性能自检 */
    initMs: 0,
    /** 每种地形的花色数量 */
    TILE_VARIANTS: VARIANTS,
    ICON_W: ICON_W, ICON_H: ICON_H,

    init: function () {
      if (Art.ready) return true;
      if (probeFailed) return false;
      if (!canDraw()) { probeFailed = true; Art.ready = false; return false; }
      const t0 = U.now();
      buildAllTiles();
      buildAllBuildings();
      buildAllTurrets();
      buildAllUnits();
      buildAllIcons();
      Art.initMs = U.now() - t0;
      Art.ready = true;
      return true;
    },

    /** 地形：TILE×TILE，variant 任意整数（内部取模） */
    tile: function (kind, variant) { return genTile(kind, variant || 0); },
    /** 矿脉：TILE×TILE，level 1..4，四周留透明 */
    ore: function (level) { return genOre(level); },
    /** 单位：中心对齐。载具 dir 0..15，步兵 dir 0..7 + frame 0..3 */
    unit: function (artKey, factionId, dir, frame) { return genUnit(artKey, factionId, dir || 0, frame || 0); },
    /** 炮塔：中心对齐，dir 0..15；无炮塔返回 null */
    turretSprite: function (artKey, factionId, dir) { return genTurret(artKey, factionId, dir || 0); },
    /** 建筑：正好 size.w*TILE × size.h*TILE，左上角对齐 */
    building: function (artKey, factionId) { return genBuilding(artKey, factionId); },
    /** 受损建筑：同尺寸，焦痕/裂缝/破洞/黑烟 */
    buildingDamaged: function (artKey, factionId) { return genDamaged(artKey, factionId); },
    /** 载具残骸（中心对齐）；步兵返回 null */
    wreck: function (artKey) { return genWreck(artKey); },
    /** 侧边栏图标：56×46 */
    icon: function (defId) { return genIcon(defId); },

    /**
     * 炮塔挂点微调。返回 {x,y}，单位 = 屏幕像素，**不随车体角度旋转**
     * （与 render.js 的用法一致：drawImage(t, px - w/2 + o.x, py - h/2 + o.y)）。
     * 因此本模块把所有载具的炮塔环都画在精灵正中心，这里一律返回 {0,0}，
     * 渲染器可以直接忽略此函数；保留它是为了以后个别车型微调时不用改渲染器。
     */
    turretOffset: function (artKey) {
      const v = VEH[artKey];
      if (v && v.off) return { x: v.off.x, y: v.off.y };
      return { x: 0, y: 0 };
    },

    /** 调试用：各缓存条目数 */
    stats: function () {
      return {
        tile: cTile.size, ore: cOre.size, unit: cUnit.size, turret: cTur.size,
        building: cBld.size, damaged: cDmg.size, wreck: cWreck.size, icon: cIcon.size,
        initMs: Art.initMs, ready: Art.ready,
      };
    },
  };

  R.Art = Art;
})();
