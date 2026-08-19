/* =========================================================================
   桥体：Art Deco 主塔 · 主缆 · 吊索 · 加劲桁架 · 桥面 · 锚碇/塔门 ·
   堡垒点钢拱 · 南北引桥 · 塔基围堰
   ========================================================================= */
const TRZ = 13.6;                        // 桁架 / 主缆平面 (间距 27.2m)
const DX = [];                           // 桥面纵向采样
(function () { for (let x = B.endS; x <= B.endN + 0.01; x += 3.81) DX.push(x); })();

let bridge = null, xrayTargets = [];

function buildBridge(scene) {
  bridge = new THREE.Group(); bridge.name = 'bridge';
  scene.add(bridge);
  buildPiers(bridge);
  buildTower(bridge, -1);
  buildTower(bridge, +1);
  buildCables(bridge);
  buildTruss(bridge);
  buildDeckSurfaces(bridge);
  buildRailings(bridge);
  buildAnchorage(bridge, -1);
  buildAnchorage(bridge, +1);
  buildFortPointArch(bridge);
  buildApproaches(bridge);
  return bridge;
}

/* ---------------- 塔基 / 围堰 ---------------- */
function buildPiers(par) {
  const b = new Batch(G.box, MAT.concrete, { name: 'piers' });
  // 南塔水中沉箱 + 椭圆防撞围堰（真实为 90m 长椭圆护圈）
  b.box(-640, -14, 0, 36, 48, 64);
  b.box(-640, 8.0, 0, 32, 8, 58);
  b.box(-640, 13.0, 0, 27, 4, 50);
  const ring = new Batch(G.box, MAT.concreteS, { name: 'fender' });
  for (let i = 0; i < 56; i++) {
    const a = i / 56 * TAU;
    const rx = 46, rz = 31;
    const x = -640 + Math.cos(a) * rx, z = Math.sin(a) * rz;
    const tang = Math.atan2(-Math.sin(a) * rx, Math.cos(a) * rz);
    ring.boxR(x, 1.6, z, 6.6, 13, 5.6, tang);
  }
  ring.build(par);
  // 北塔基座（近岸浅水岩基）
  b.box(640, -6, 0, 34, 34, 60);
  b.box(640, 9, 0, 30, 8, 55);
  b.box(640, 14, 0, 26, 4, 48);
  b.build(par);
}

/* ---------------- 主塔（每座两根塔柱 + 门式横撑，Art Deco 退台与竖槽） ---------------- */
function legHalf(t) {   // t: 0(基) → 1(顶)
  const p = Math.pow(t, 0.9);
  return [lerp(B.legBX, B.legTX, p), lerp(B.legBZ, B.legTZ, p)];
}
const TOWER_CUTS = [0, 0.155, 0.325, 0.49, 0.645, 0.79, 0.915, 1.0];
function buildTower(par, sx) {
  const X = B.towerX * sx;
  const body = new Batch(G.box, MAT.orange, { name: 'tower' });
  const trim = new Batch(G.box, MAT.orangeD, { name: 'towerTrim' });
  const yBase = -8, yTop = B.towerTop;
  for (const sz of [-1, 1]) {
    const Z = B.legZ * sz;
    for (let s = 0; s < TOWER_CUTS.length - 1; s++) {
      const t0 = TOWER_CUTS[s], t1 = TOWER_CUTS[s + 1];
      const y0 = lerp(yBase, yTop, t0), y1 = lerp(yBase, yTop, t1);
      const [hx, hz] = legHalf((t0 + t1) * 0.5);
      const h = y1 - y0;
      body.box(X, (y0 + y1) / 2, Z, hx * 2, h, hz * 2);
      // 退台压顶（段顶挑出的水平线脚）
      if (s < TOWER_CUTS.length - 2) trim.box(X, y1 - 0.7, Z, hx * 2 + 1.0, 1.9, hz * 2 + 1.0);
      // 大面竖槽（Art Deco fluting）：法向 ±X 的面上分 5 条肋
      const nRib = 5;
      for (let r = 0; r < nRib; r++) {
        const fz = (r + 0.5) / nRib * 2 - 1;
        const zz = Z + fz * (hz * 0.78);
        const w = (hz * 2 * 0.78 / nRib) * 0.52;
        for (const fx of [-1, 1]) trim.box(X + fx * (hx + 0.22), (y0 + y1) / 2 + 0.5, zz, 0.56, h - 2.6, w);
      }
      // 侧面（沿桥轴）竖肋
      for (const fz2 of [-1, 1]) {
        trim.box(X, (y0 + y1) / 2 + 0.5, Z + fz2 * (hz + 0.2), hx * 0.5, h - 2.6, 0.5);
        trim.box(X, (y0 + y1) / 2 + 0.5, Z + fz2 * (hz + 0.14), hx * 1.3, h - 2.6, 0.34);
      }
    }
    // 索鞍
    const [tx, tz] = legHalf(1);
    body.box(X, yTop + 1.4, Z, tx * 2 + 1.8, 2.8, tz * 2 + 1.8);
    trim.box(X, yTop + 3.4, Z, 3.6, 3.0, tz * 2 - 0.8);
  }
  // 门式横撑
  const struts = [
    [20, 5.4], [46, 5.0], [63.2, 4.4],        // 桥面以下
    [88, 6.4], [123, 6.2], [158, 5.8], [192, 5.4], [217, 5.6],
  ];
  for (const [y, hh] of struts) {
    const t = clamp((y - yBase) / (yTop - yBase), 0, 1);
    const [hx, hz] = legHalf(t);
    const inner = B.legZ - hz;
    const L = inner * 2;
    body.box(X, y, 0, hx * 1.74, hh, L);
    trim.box(X, y + hh / 2 - 0.35, 0, hx * 1.74 + 0.7, 1.2, L);
    trim.box(X, y - hh / 2 + 0.35, 0, hx * 1.74 + 0.7, 1.2, L);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const z = lerp(-L / 2 + 2.4, L / 2 - 2.4, i / (n - 1));
      for (const fx of [-1, 1]) trim.box(X + fx * (hx * 0.87 + 0.16), y, z, 0.5, hh - 2.6, 1.1);
    }
  }
  body.build(par); trim.build(par);
  // 塔顶航空障碍灯
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.3, 10, 8), MAT.red.clone());
  beacon.position.set(X, B.towerTop + 4.8, B.legZ);
  beacon.userData.beacon = 1; par.add(beacon);
  const b2 = beacon.clone(); b2.material = beacon.material; b2.position.z = -B.legZ; par.add(b2);
  BEACONS.push(beacon, b2);
}
const BEACONS = [];

/* ---------------- 主缆 + 吊索 ---------------- */
function cablePath(sz) {
  const pts = [];
  const step = 8;
  for (let x = -B.anchorX - 14; x <= B.anchorX + 14; x += step) {
    const ax = Math.abs(x);
    let y = cableY(clamp(x, -B.anchorX, B.anchorX));
    let z = TRZ * sz;
    if (ax > B.anchorX - 46) {                       // 末端向外撇入锚碇（散索）
      const t = smoothstep(B.anchorX - 46, B.anchorX + 14, ax);
      z = lerp(TRZ, 18.4, t) * sz;
      y = lerp(y, B.cableAnchor - 5.5, smoothstep(B.anchorX - 10, B.anchorX + 14, ax));
    }
    pts.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.25);
}
function buildCables(par) {
  for (const sz of [-1, 1]) {
    const curve = cablePath(sz);
    const g = new THREE.TubeGeometry(curve, 620, B.cableR, 12, false);
    const m = new THREE.Mesh(g, MAT.cable);
    m.castShadow = true; m.receiveShadow = true; m.name = 'maincable';
    par.add(m);
  }
  // 吊索 + 索夹
  const rope = new Batch(G.cylC, MAT.rope, { name: 'suspenders', recv: false });
  const band = new Batch(G.box, MAT.orangeD, { name: 'bands' });
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
  for (const sz of [-1, 1]) {
    const Z = TRZ * sz;
    for (let x = -B.anchorX + 10; x <= B.anchorX - 10; x += B.hang) {
      const ax = Math.abs(x);
      if (Math.abs(ax - B.towerX) < 12) continue;
      const cy = cableY(x), dy = deckY(x) - 0.95;
      if (cy - dy < 1.4) continue;
      band.box(x, cy - B.cableR * 0.2, Z, 1.7, 1.3, B.cableR * 2 + 0.7);
      for (const off of [-0.62, 0.62]) {
        p0.set(x + off, cy - 0.4, Z); p1.set(x + off, dy, Z);
        rope.rod(p0, p1, 0.15);
      }
    }
  }
  rope.build(par); band.build(par);
}

/* ---------------- 加劲桁架（25ft 节间，Warren 式 + 下平联） ---------------- */
function buildTruss(par) {
  const b = new Batch(G.box, MAT.orange, { name: 'truss' });
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3();
  const N = Math.round((B.anchorX * 2) / B.panel);
  let flip = 0;
  for (let i = 0; i < N; i++) {
    const xa = -B.anchorX + i * B.panel, xb = xa + B.panel;
    const ta = deckY(xa) - 0.95, tb = deckY(xb) - 0.95;
    const ba = ta - B.truss, bb = tb - B.truss;
    for (const sz of [-1, 1]) {
      const Z = TRZ * sz;
      p0.set(xa, ta, Z); p1.set(xb, tb, Z); b.strut(p0, p1, 1.05, 0.62);          // 上弦
      p0.set(xa, ba, Z); p1.set(xb, bb, Z); b.strut(p0, p1, 1.05, 0.62);          // 下弦
      p0.set(xa, ba, Z); p1.set(xa, ta, Z); b.strut(p0, p1, 0.55, 0.55);          // 竖杆
      if (flip) { p0.set(xa, ta, Z); p1.set(xb, bb, Z); } else { p0.set(xa, ba, Z); p1.set(xb, tb, Z); }
      b.strut(p0, p1, 0.46, 0.46);                                                // 斜杆
    }
    // 横向：横梁 + 下平联斜撑
    p0.set(xa, ba, -TRZ); p1.set(xa, ba, TRZ); b.strut(p0, p1, 0.6, 0.95);
    p0.set(xa, ta, -TRZ); p1.set(xa, ta, TRZ); b.strut(p0, p1, 0.5, 0.42);
    p0.set(xa, ba - 0.1, -TRZ); p1.set(xb, bb - 0.1, TRZ); b.strut(p0, p1, 0.34, 0.34);
    p2.set(xa, ba - 0.1, TRZ); p3.set(xb, bb - 0.1, -TRZ); b.strut(p2, p3, 0.34, 0.34);
    flip ^= 1;
  }
  // 端部竖杆
  const im = b.build(par);
  if (im) xrayTargets.push(im);
}

/* ---------------- 桥面：路面 / 人行道 / 缘石 / 底板 / 中央护栏 ---------------- */
function buildDeckSurfaces(par) {
  const R = B.roadHalf, W0 = 9.8, W1 = 13.3;
  const road = ribbon(DX, -R, R, 0, 0, MAT.road, 48);
  road.name = 'road'; par.add(road);
  for (const s of [-1, 1]) {
    const f = s < 0;
    par.add(ribbon(DX, W0 * s, W1 * s, 0.26, 0.26, MAT.walk, 6, f));         // 人行道
    par.add(ribbon(DX, R * s, W0 * s, 0.0, 0.26, MAT.walk, 6, f));           // 缘石斜面
    par.add(ribbon(DX, W1 * s, W1 * s, 0.26, -1.15, MAT.orangeD, 6, f));     // 外侧檐板
  }
  par.add(ribbon(DX, -W1, W1, -1.15, -1.15, MAT.concreteS, 12, true));        // 桥面底板
  // 中央可移动护栏（黄色混凝土块列）
  const med = new Batch(G.box, new THREE.MeshStandardMaterial({ color: 0xcfbd8e, roughness: .85 }), { name: 'median' });
  for (let x = -B.anchorX; x < B.anchorX; x += 3.2) med.box(x, deckY(x) + 0.42, 0, 3.0, 0.84, 0.64);
  med.build(par);
}

/* ---------------- 栏杆 + 灯柱 ---------------- */
function buildRailings(par) {
  const post = new Batch(G.box, MAT.orange, { name: 'rail', recv: false });
  const rail = new Batch(G.box, MAT.orange, { name: 'railTop', recv: false });
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
  const Z = 13.15;
  for (const sz of [-1, 1]) {
    for (let x = B.endS; x <= B.endN; x += 1.524) {
      post.box(x, deckY(x) + 0.26 + 0.62, Z * sz, 0.1, 1.24, 0.1);
    }
    for (let i = 0; i < DX.length - 1; i++) {
      const xa = DX[i], xb = DX[i + 1];
      p0.set(xa, deckY(xa) + 1.5, Z * sz); p1.set(xb, deckY(xb) + 1.5, Z * sz);
      rail.strut(p0, p1, 0.19, 0.17);
      p0.y -= 0.62; p1.y -= 0.62; rail.strut(p0, p1, 0.1, 0.1);
      p0.y -= 0.5; p1.y -= 0.5; rail.strut(p0, p1, 0.1, 0.1);
    }
  }
  post.build(par); rail.build(par);

  // 灯柱（每 61m / 200ft）
  const pole = new Batch(G.cyl, MAT.steelDark, { name: 'poles', recv: false });
  const head = new Batch(G.box, MAT.lampOn, { name: 'lamps', recv: false });
  for (const sz of [-1, 1]) {
    for (let x = -B.anchorX + 30; x < B.anchorX; x += 61) {
      const y = deckY(x) + 0.26, Zp = 12.4 * sz;
      pole.box(x, y + 4.4, Zp, 0.22, 8.8, 0.22);
      // 弯臂
      const n = 5;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const a0 = t0 * Math.PI / 2, a1 = t1 * Math.PI / 2;
        const r = 2.6;
        pole.rod(
          new THREE.Vector3(x, y + 8.8 + Math.sin(a0) * r * 0.42, Zp - Math.sin(a0) * r * sz),
          new THREE.Vector3(x, y + 8.8 + Math.sin(a1) * r * 0.42, Zp - Math.sin(a1) * r * sz),
          0.16);
      }
      head.box(x, y + 10.2, Zp - 2.6 * sz, 0.7, 0.4, 1.5);
    }
  }
  pole.build(par); LAMPMESH = head.build(par);
}
let LAMPMESH = null;

/* ---------------- 锚碇 + 塔门（混凝土 pylon） ---------------- */
function buildAnchorage(par, sx) {
  const X = B.anchorX * sx;
  const b = new Batch(G.box, MAT.concrete, { name: 'anchor' });
  const gy = Math.max(-6, landHeight(X, 0) - 6);
  // 基座（分级退台）
  b.box(X + 6 * sx, (gy + 44) / 2, 0, 86, 44 - gy, 62);
  b.box(X + 2 * sx, 52, 0, 74, 18, 54);
  // 两侧索室（主缆由此入锚）
  for (const sz of [-1, 1]) {
    b.box(X - 5 * sx, 72, 18.8 * sz, 58, 30, 17);
    b.box(X - 8 * sx, 88, 18.8 * sz, 46, 8, 19);
  }
  // 桥面从两索室之间穿过 —— 过渡挡墙
  for (const sz of [-1, 1]) b.box(X + 22 * sx, 65, 15.6 * sz, 22, 14, 4.2);
  b.build(par);

  // 塔门 pylon（两对：锚碇处 + 更外侧）
  const py = new Batch(G.box, MAT.concreteS, { name: 'pylon' });
  const trim = new Batch(G.box, MAT.concrete, { name: 'pylonTrim' });
  const spots = sx < 0 ? [[-1006, 40], [-1196, 36]] : [[1006, 40], [1186, 34]];
  for (const [px, hh] of spots) {
    const base = deckY(px);
    for (const sz of [-1, 1]) {
      const Z = 20.5 * sz;
      const g0 = Math.max(-2, landHeight(px, Z));
      const H = base + hh - g0;
      const SEGP = 7;
      for (let s = 0; s < SEGP; s++) {
        const t0 = s / SEGP, t1 = (s + 1) / SEGP;
        const y0 = g0 + H * t0, y1 = g0 + H * t1;
        const w = lerp(9.4, 6.4, Math.pow(t0, .8)), d = lerp(8.0, 5.6, Math.pow(t0, .8));
        py.box(px, (y0 + y1) / 2, Z, w, y1 - y0, d);
        if (s < SEGP - 1) trim.box(px, y1 - 0.3, Z, w + 0.5, 0.95, d + 0.5);
        for (const fx of [-1, 1]) trim.box(px + fx * (w / 2 + 0.12), (y0 + y1) / 2, Z, 0.36, (y1 - y0) - 1.2, d * 0.34);
      }
      trim.box(px, g0 + H + 1.2, Z, 7.4, 2.4, 6.6);
    }
  }
  py.build(par); trim.build(par);
}

/* ---------------- 堡垒点钢拱（320ft 钢拱跨越 1861 年古堡） ---------------- */
function buildFortPointArch(par) {
  const b = new Batch(G.box, MAT.orange, { name: 'arch' });
  const x0 = B.arch0, x1 = B.arch1;                       // -1010 → -1170
  const mid = (x0 + x1) / 2, half = (x0 - x1) / 2;
  const springY = 9, crownY = deckY(mid) - 11;
  const arcY = (x) => { const t = (x - mid) / half; return crownY - (crownY - springY) * t * t; };
  const N = 26, p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
  for (const sz of [-1, 1]) {
    const Z = 11.6 * sz;
    for (let i = 0; i < N; i++) {
      const xa = lerp(x1, x0, i / N), xb = lerp(x1, x0, (i + 1) / N);
      p0.set(xa, arcY(xa), Z); p1.set(xb, arcY(xb), Z);
      b.strut(p0, p1, 2.6, 1.9);                                        // 拱肋
      // 拱上立柱
      const xm = (xa + xb) / 2, ym = arcY(xm), dy = deckY(xm) - 9.2;
      if (dy - ym > 2) { p0.set(xm, ym, Z); p1.set(xm, dy, Z); b.strut(p0, p1, 0.9, 0.9); }
    }
    // 拱肋间横撑
    for (let i = 1; i < N; i += 3) {
      const xm = lerp(x1, x0, i / N);
      p0.set(xm, arcY(xm), -11.6); p1.set(xm, arcY(xm), 11.6); b.strut(p0, p1, 0.7, 0.7);
    }
  }
  // 拱脚混凝土
  const c = new Batch(G.box, MAT.concrete, { name: 'archBase' });
  for (const sz of [-1, 1]) for (const px of [x0, x1]) c.box(px, 4, 11.6 * sz, 14, 14, 12);
  b.build(par); c.build(par);
}

/* ---------------- 南北引桥（钢排架 + 板梁）+ 北端隧道口 ---------------- */
function buildApproaches(par) {
  const st = new Batch(G.box, MAT.orangeD, { name: 'trestle' });
  const gir = new Batch(G.box, MAT.orangeD, { name: 'girder' });
  const p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
  // 板梁：悬吊段以外（贴地段不再架梁，避免插入地形）
  for (let x = B.endS; x < B.endN; x += 7.62) {
    const ax = Math.abs(x);
    if (ax < B.anchorX + 4) continue;
    const clr = deckY(x) - Math.max(landHeight(x, 0), landHeight(x, 10));
    if (clr < 4.4) continue;
    const y = deckY(x) - 2.2, y2 = deckY(x + 7.62) - 2.2;
    for (const sz of [-1, 1]) {
      p0.set(x, y, 11.4 * sz); p1.set(x + 7.62, y2, 11.4 * sz);
      gir.strut(p0, p1, 3.0, 1.3);
    }
    p0.set(x, y - 0.4, -11.4); p1.set(x, y - 0.4, 11.4); gir.strut(p0, p1, 1.2, 0.7);
  }
  // 南引桥钢排架
  for (let x = -1240; x > B.endS + 40; x -= 46) {
    const dy = deckY(x) - 3.6;
    for (const sz of [-1, 1]) {
      const Z = 10.2 * sz;
      const g = Math.max(-2, landHeight(x, Z));
      if (dy - g < 7) continue;
      for (const dx of [-6, 6]) {
        p0.set(x + dx, g, Z); p1.set(x + dx * 0.55, dy, Z); st.strut(p0, p1, 1.5, 1.5);
      }
      // X 撑
      const lv = Math.max(1, Math.floor((dy - g) / 13));
      for (let i = 0; i < lv; i++) {
        const ya = lerp(g, dy, i / lv), yb = lerp(g, dy, (i + 1) / lv);
        const fa = lerp(1, 0.55, i / lv), fb = lerp(1, 0.55, (i + 1) / lv);
        p0.set(x - 6 * fa, ya, Z); p1.set(x + 6 * fb, yb, Z); st.strut(p0, p1, 0.6, 0.6);
        p0.set(x + 6 * fa, ya, Z); p1.set(x - 6 * fb, yb, Z); st.strut(p0, p1, 0.6, 0.6);
        p0.set(x - 6 * fb, yb, Z); p1.set(x + 6 * fb, yb, Z); st.strut(p0, p1, 0.7, 0.7);
      }
    }
    // 横向连系
    const g2 = Math.max(-2, landHeight(x, 0));
    if (dy - g2 > 8) {
      p0.set(x, dy - 1, -10.2); p1.set(x, dy - 1, 10.2); st.strut(p0, p1, 1.2, 1.2);
      p0.set(x, (dy + g2) / 2, -9.5); p1.set(x, (dy + g2) / 2, 9.5); st.strut(p0, p1, 0.8, 0.8);
    }
  }
  // 北引桥矮墩
  const bent = new Batch(G.box, MAT.concrete, { name: 'bent' });
  for (let x = B.anchorX + 40; x < B.endN - 30; x += 42) {
    const dy = deckY(x) - 3.4;
    for (const sz of [-1, 1]) {
      const Z = 10.2 * sz, g = Math.max(-2, landHeight(x, Z));
      if (dy - g < 2.5) continue;
      bent.box(x, (g + dy) / 2, Z, 3.4, dy - g, 3.0);
    }
    const g0 = Math.max(-2, landHeight(x, 0));
    if (dy - g0 > 3) bent.box(x, dy - 1.2, 0, 3.0, 2.4, 23);
  }
  // 北端隧道口（双侧墙 + 门楣 + 洞口）
  const tx = B.endN - 40, ty = deckY(tx);
  for (const sz of [-1, 1]) {
    bent.box(tx, ty + 9, 23 * sz, 16, 34, 22);
    bent.box(tx - 8.6, ty + 7, 20 * sz, 3.2, 26, 15);
  }
  bent.box(tx, ty + 19.5, 0, 16, 9, 68);
  bent.box(tx - 8.6, ty + 17.5, 0, 3.2, 6.5, 44);
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x090a0c, roughness: 1 });
  const hole = new THREE.Mesh(new THREE.BoxGeometry(40, 13, 23), holeMat);
  hole.position.set(tx + 14, ty + 6.2, 0); par.add(hole);
  st.build(par); gir.build(par); bent.build(par);
}
