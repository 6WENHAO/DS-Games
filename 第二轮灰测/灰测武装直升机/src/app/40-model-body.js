/* ============================================================================
 *  40 · 机体：机身放样 / 航电舱 / 多面座舱 / 座舱内构 / 头部传感器 /
 *            发动机舱 / 尾梁上盖 / 垂尾 / 全动平尾
 * ==========================================================================*/

const HOTSPOTS = [];
const hot = (pos, title, sub, key) => { HOTSPOTS.push({ pos, title, sub, key }); };

/* 机身站位表: [x, 半宽, 半高, 中心高, eTop, eBot, 侧鼓包] */
const FUSE_SECTIONS = [
  [6.66, 0.085, 0.072, 1.596, 3.2, 3.0, 0],
  [6.58, 0.170, 0.145, 1.600, 2.9, 2.7, 0],
  [6.44, 0.262, 0.222, 1.606, 2.7, 2.5, 0],
  [6.22, 0.352, 0.298, 1.616, 2.6, 2.45, 0],
  [5.95, 0.442, 0.372, 1.638, 2.6, 2.4, 0],
  [5.55, 0.552, 0.462, 1.668, 2.6, 2.4, 0],
  [5.10, 0.618, 0.525, 1.696, 2.6, 2.4, 0.02],
  [4.60, 0.658, 0.568, 1.718, 2.6, 2.4, 0.05],
  [4.10, 0.688, 0.602, 1.736, 2.6, 2.4, 0.07],
  [3.55, 0.708, 0.638, 1.750, 2.6, 2.4, 0.07],
  [3.00, 0.720, 0.678, 1.760, 2.7, 2.4, 0.05],
  [2.40, 0.728, 0.718, 1.770, 2.8, 2.5, 0.02],
  [1.80, 0.730, 0.748, 1.780, 2.9, 2.6, 0],
  [1.15, 0.722, 0.770, 1.790, 3.0, 2.7, 0],
  [0.50, 0.700, 0.778, 1.800, 3.0, 2.7, 0],
  [-0.15, 0.660, 0.760, 1.820, 2.9, 2.6, 0],
  [-0.85, 0.598, 0.710, 1.850, 2.8, 2.5, 0],
  [-1.55, 0.520, 0.628, 1.878, 2.7, 2.4, 0],
  [-2.25, 0.438, 0.540, 1.900, 2.6, 2.4, 0],
  [-3.00, 0.330, 0.416, 1.918, 2.5, 2.3, 0],
  [-3.80, 0.262, 0.330, 1.922, 2.4, 2.3, 0],
  [-4.60, 0.228, 0.288, 1.912, 2.4, 2.2, 0],
  [-5.40, 0.204, 0.256, 1.894, 2.3, 2.2, 0],
  [-6.20, 0.185, 0.232, 1.868, 2.3, 2.2, 0],
  [-6.90, 0.172, 0.216, 1.840, 2.3, 2.2, 0],
  [-7.45, 0.160, 0.202, 1.812, 2.3, 2.2, 0],
  [-7.85, 0.135, 0.175, 1.792, 2.4, 2.3, 0],
  [-8.04, 0.055, 0.085, 1.784, 2.6, 2.5, 0],
];

function buildFuselage() {
  const g = group('fuselage');
  const secs = resample(FUSE_SECTIONS, 3).map(([x, w, h, yc, eT, eB, bul]) => ({
    x,
    ring: ringSuperellipse(w, h, yc, {
      eTop: eT, eBot: eB, count: 76, bulge: bul, bulgeY: -0.35,
      wBot: 0.94,
    }),
  }));
  const skin = loft(secs, { capStart: true, capEnd: true, uvScale: 1 });
  g.add(mesh(skin, MATS.paint, { name: 'skin' }));

  /* 机腹弹药舱鼓包（M230 供弹舱） */
  const ammo = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, x = 3.55 - t * 2.15;
    const k = Math.sin(PI * Math.min(1, t * 1.06 + 0.02)) ** 0.65;
    ammo.push({ x, ring: ringSuperellipse(0.55 * k + 0.02, 0.26 * k + 0.01, 1.10 - 0.02 * t, { eTop: 4, eBot: 3.4, count: 44 }) });
  }
  g.add(mesh(loft(ammo, { capStart: true, capEnd: true }), MATS.paint, { name: 'ammo-bay' }));

  /* 主减速器 / 传动舱整流（座舱后上部） */
  const deck = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30, x = 2.62 - t * 3.0;
    const w = 0.44 + 0.20 * Math.sin(PI * t) - 0.06 * t;
    const h = 0.16 + 0.20 * Math.sin(PI * Math.min(1, t * 1.15)) - 0.02 * t;
    deck.push({ x, ring: ringSuperellipse(w, h, 2.52 + 0.10 * Math.sin(PI * t * 0.9), { eTop: 3.2, eBot: 6, count: 48 }) });
  }
  g.add(mesh(loft(deck, { capStart: true, capEnd: true }), MATS.paintDark, { name: 'xmsn-deck' }));

  /* 尾梁传动轴上盖 */
  const shaft = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30, x = -1.30 - t * 5.35;
    const w = 0.155 - 0.045 * t, h = 0.115 - 0.035 * t;
    const yy = 2.34 - t * 0.34 - 0.06 * t * t;
    shaft.push({ x, ring: ringSuperellipse(w, h, yy, { eTop: 3.0, eBot: 8, count: 38 }) });
  }
  g.add(mesh(loft(shaft, { capStart: true, capEnd: true }), MATS.paintDark, { name: 'driveshaft-cover' }));

  /* 前航电舱 EFAB（机身两侧特征鼓包） */
  const efab = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26, x = 5.60 - t * 2.55;
    const k = Math.pow(Math.sin(PI * Math.min(1, 0.06 + t * 0.98)), 0.5);
    efab.push({ x, ring: ringSuperellipse(0.16 * k + 0.01, 0.30 * k + 0.01, 1.80 - 0.04 * t, { eTop: 3.4, eBot: 3.0, count: 38 }) });
  }
  const efabG = loft(efab, { capStart: true, capEnd: true });
  const efabR = mesh(efabG, MATS.paint, { name: 'efab-r', pos: [0, 0, 0.70] });
  const efabL = mesh(efabG, MATS.paint, { name: 'efab-l', pos: [0, 0, -0.70] });
  efabL.scale.z = -1;
  g.add(efabR, efabL);

  /* 机头下方 FLIR / 探照灯整流 + 空速管 */
  g.add(mesh(latheProfile([[0, 0], [0.085, 0.004], [0.098, 0.03], [0.098, 0.10], [0.070, 0.135], [0, 0.145]], 24, 4), MATS.matteBlack,
    { name: 'searchlight', pos: [5.58, 1.245, 0], rot: [0, 0, PI * 0.53] }));
  g.add(mesh(cyl(0.088, 0.088, 0.016, 24, false, 6), MATS.lampGlass, { name: 'searchlight-glass', pos: [5.60, 1.235, 0], rot: [0, 0, PI * 0.53] }));
  g.add(mesh(new THREE.TorusGeometry(0.09, 0.008, 8, 24), MATS.alu, { pos: [5.605, 1.235, 0], rot: [0, PI * 0.53, PI / 2] }));

  for (const s of [-1, 1]) {
    g.add(pipeMesh([6.20, 1.70, s * 0.28], [6.52, 1.76, s * 0.38], 0.011, MATS.steel, 8));
    g.add(pipeMesh([6.52, 1.76, s * 0.38], [6.57, 1.765, s * 0.385], 0.016, MATS.matteBlack, 8));
    // 迎角传感器
    g.add(barMesh([6.30, 1.52, s * 0.29], [6.28, 1.52, s * 0.36], 0.02, 0.055, MATS.alu));
  }

  /* 舱门轮廓缝（两侧） */
  for (const sd of [-1, 1]) {
    const z = sd * 0.735;
    const door = [[5.02, 1.62], [5.02, 2.02], [4.30, 2.06], [4.30, 1.55]];
    const door2 = [[3.62, 1.78], [3.62, 2.15], [2.86, 2.18], [2.86, 1.72]];
    for (const poly of [door, door2]) {
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        g.add(barMesh([a[0], a[1], z * 0.985], [b[0], b[1], z * 0.985], 0.012, 0.014, MATS.paintDark, 6));
      }
    }
    // 舱门铰链
    for (const hy of [1.66, 1.96]) g.add(mesh(box(0.05, 0.03, 0.03, 6), MATS.alu, { pos: [4.32, hy, z] }));
  }

  /* 机身面板贴花 */
  g.add(decal(DECAL.stencil(['NO STEP'], { size: 30 }), 0.34, 0.10, [3.4, 2.575, 0.30], [-PI / 2, 0, 0]));
  g.add(decal(DECAL.stencil(['RESCUE'], { size: 30, color: '#c9b04a' }), 0.36, 0.11, [4.30, 2.10, 0.66], [0, PI / 2, -0.06]));
  g.add(decal(DECAL.text('APACHE', { w: 512, h: 128, color: '#b9beb4', alpha: 0.55 }), 0.62, 0.155, [1.05, 2.05, 0.735], [0, PI / 2, 0]));
  g.add(decal(DECAL.star(), 0.62, 0.62, [-1.15, 2.02, 0.628], [0, PI / 2, 0]));
  g.add(decal(DECAL.star(), 0.62, 0.62, [-1.15, 2.02, -0.628], [0, -PI / 2, 0]));
  g.add(decal(DECAL.text('0 4 2 3 1', { w: 512, h: 128, color: '#c6cabf', alpha: 0.6 }), 0.72, 0.18, [-4.30, 2.02, 0.30], [0, PI / 2, 0.02]));
  g.add(decal(DECAL.text('0 4 2 3 1', { w: 512, h: 128, color: '#c6cabf', alpha: 0.6 }), 0.72, 0.18, [-4.30, 2.02, -0.30], [0, -PI / 2, -0.02]));
  g.add(decal(DECAL.stencil(['U.S. ARMY'], { size: 32 }), 0.44, 0.12, [-2.55, 2.10, 0.44], [0, PI / 2, 0.03]));
  g.add(decal(DECAL.stencil(['U.S. ARMY'], { size: 32 }), 0.44, 0.12, [-2.55, 2.10, -0.44], [0, -PI / 2, -0.03]));
  g.add(decal(DECAL.warn('INTAKE'), 0.24, 0.13, [2.66, 2.42, 0.60], [0, PI / 2, 0]));
  g.add(decal(DECAL.stencil(['FUEL', 'JP-8'], { size: 26 }), 0.26, 0.13, [0.10, 2.02, 0.70], [0, PI / 2, 0]));

  hot([5.2, 1.05, 0.75], 'EFAB 前航电舱', 'Extended Forward Avionics Bay', 'efab');
  return g;
}

/* ------------------------------------------------------------ 多面座舱盖 */
/* 每个断面: {x, sill:[y,z], mid:[y,z], top:[y,z]} —— z 为半宽 */
const CANOPY_RINGS = [
  { x: 5.78, sill: [1.905, 0.400], mid: [2.010, 0.415], top: [2.075, 0.300] },
  { x: 5.06, sill: [1.965, 0.618], mid: [2.330, 0.560], top: [2.560, 0.330] },
  { x: 4.40, sill: [2.000, 0.655], mid: [2.360, 0.590], top: [2.565, 0.352] },
  { x: 4.26, sill: [2.008, 0.658], mid: [2.410, 0.592], top: [2.585, 0.356] },
  { x: 3.66, sill: [2.040, 0.665], mid: [2.620, 0.600], top: [2.975, 0.360] },
  { x: 2.92, sill: [2.075, 0.662], mid: [2.650, 0.596], top: [2.990, 0.352] },
  { x: 2.56, sill: [2.100, 0.640], mid: [2.520, 0.540], top: [2.720, 0.300] },
];
/* 每段材质：[下侧, 上侧, 顶] */
const CANOPY_BAYS = [
  ['glass', 'glass', 'glass'],   // 副驾驶/炮手风挡
  ['glass', 'glass', 'paint'],   // 炮手舱侧窗
  ['paint', 'paint', 'paint'],   // 阶差
  ['glass', 'glass', 'glass'],   // 驾驶员风挡
  ['glass', 'glass', 'paint'],   // 驾驶员侧窗
  ['paint', 'paint', 'paint'],   // 后整流
];

function ringPts(r) {
  const P = (a, s) => [r.x, r[a][0], s * r[a][1]];
  return {
    L: [P('sill', -1), P('mid', -1), P('top', -1)],
    R: [P('sill', 1), P('mid', 1), P('top', 1)],
  };
}

function buildCanopy() {
  const g = group('canopy');
  const glassG = [], paintG = [];
  const frames = [];
  for (let b = 0; b < CANOPY_RINGS.length - 1; b++) {
    const A = ringPts(CANOPY_RINGS[b]), B = ringPts(CANOPY_RINGS[b + 1]);
    const kind = CANOPY_BAYS[b];
    const push = (k, q) => (k === 'glass' ? glassG : paintG).push(q);
    for (const side of ['L', 'R']) {
      const a = A[side], bb = B[side];
      const flip = side === 'R';
      // 下侧板
      push(kind[0], flip ? quadGeom(a[0], a[1], bb[1], bb[0], 1) : quadGeom(a[0], bb[0], bb[1], a[1], 1));
      // 上侧板
      push(kind[1], flip ? quadGeom(a[1], a[2], bb[2], bb[1], 1) : quadGeom(a[1], bb[1], bb[2], a[2], 1));
      // 纵向框
      frames.push([a[0], bb[0], 0.030], [a[1], bb[1], 0.034], [a[2], bb[2], 0.030]);
    }
    // 顶板
    push(kind[2], quadGeom(A.L[2], B.L[2], B.R[2], A.R[2], 1));
    // 环向框
    for (const side of ['L', 'R']) {
      frames.push([A[side][0], A[side][1], 0.030], [A[side][1], A[side][2], 0.030]);
    }
    frames.push([A.L[2], A.R[2], 0.028]);
  }
  // 末端环框
  const last = ringPts(CANOPY_RINGS[CANOPY_RINGS.length - 1]);
  for (const side of ['L', 'R']) frames.push([last[side][0], last[side][1], 0.03], [last[side][1], last[side][2], 0.03]);

  const glass = mesh(mergeGeoms(glassG), MATS.glass, { name: 'canopy-glass', shadow: false });
  glass.renderOrder = 6;
  const shell = mesh(mergeGeoms(paintG), MATS.paint, { name: 'canopy-shell' });
  g.add(shell, glass);

  // 框架（方杆）
  for (const [p0, p1, w] of frames) g.add(barMesh(p0, p1, w, w * 0.85, MATS.matteBlack, 4));

  // 风挡雨刷
  for (const s of [-0.22, 0.22]) {
    const base = [5.36, 2.10 + Math.abs(s) * 0.0, s];
    g.add(pipeMesh(base, [5.10, 2.34, s * 1.5], 0.008, MATS.matteBlack, 6));
    g.add(barMesh([5.10, 2.34, s * 1.5], [5.02, 2.42, s * 1.9], 0.012, 0.02, MATS.rubber));
  }
  // 舱门把手 / 铰链
  for (const s of [-1, 1]) {
    g.add(barMesh([4.70, 2.06, s * 0.664], [4.86, 2.06, s * 0.664], 0.05, 0.035, MATS.alu));
    g.add(barMesh([3.20, 2.14, s * 0.672], [3.36, 2.14, s * 0.672], 0.05, 0.035, MATS.alu));
    for (const hx of [4.98, 4.44]) g.add(pipeMesh([hx, 2.42, s * 0.60], [hx, 2.50, s * 0.585], 0.018, MATS.alu, 8));
    for (const hx of [3.58, 3.02]) g.add(pipeMesh([hx, 2.72, s * 0.56], [hx, 2.80, s * 0.545], 0.018, MATS.alu, 8));
  }
  // 后视镜
  g.add(pipeMesh([5.30, 2.44, 0.44], [5.34, 2.60, 0.52], 0.010, MATS.alu, 8));
  g.add(mesh(box(0.02, 0.07, 0.10, 4), MATS.steel, { pos: [5.35, 2.63, 0.53], rot: [0, 0.3, 0] }));

  hot([4.6, 2.62, 0.30], '串列双座座舱', '7 片平板防弹风挡 / 炮手前座 · 驾驶员后座', 'canopy');
  return g;
}

/* -------------------------------------------------------------- 座舱内构 */
function buildCockpitInterior() {
  const g = group('cockpit-interior');
  const seatAt = (x, y) => {
    const s = group('seat');
    // 座盆 + 靠背 + 头靠
    s.add(mesh(box(0.52, 0.09, 0.50, 4), MATS.seat, { pos: [x, y, 0], shadow: false }));
    s.add(mesh(box(0.12, 0.66, 0.48, 4), MATS.seat, { pos: [x - 0.24, y + 0.36, 0], rot: [0, 0, 0.10], shadow: false }));
    s.add(mesh(box(0.10, 0.20, 0.34, 4), MATS.seat, { pos: [x - 0.30, y + 0.78, 0], shadow: false }));
    // 装甲侧板
    for (const sd of [-1, 1]) s.add(mesh(box(0.44, 0.34, 0.03, 4), MATS.cockpit, { pos: [x - 0.02, y + 0.22, sd * 0.26], shadow: false }));
    // 五点安全带
    for (const sd of [-1, 1]) s.add(barMesh([x - 0.20, y + 0.66, sd * 0.13], [x + 0.04, y + 0.06, sd * 0.06], 0.055, 0.012, MATS.cockpit, 4));
    return s;
  };
  // 炮手（前）/ 驾驶员（后）
  g.add(seatAt(4.52, 1.52), seatAt(3.14, 1.80));
  // 仪表板 + 多功能显示器
  const panel = (x, y, tilt) => {
    const p = group('panel');
    p.add(mesh(box(0.16, 0.42, 0.62, 4), MATS.cockpit, { pos: [x, y, 0], rot: [0, 0, tilt], shadow: false }));
    for (const sd of [-1, 1]) p.add(mesh(box(0.02, 0.17, 0.21, 4), MATS.mfd, { pos: [x - 0.08, y + 0.02, sd * 0.16], rot: [0, 0, tilt], shadow: false }));
    return p;
  };
  g.add(panel(5.02, 1.80, -0.22), panel(3.66, 2.08, -0.22));
  // 操纵杆 / 总距 / 脚蹬
  for (const [x, y] of [[4.72, 1.62], [3.34, 1.90]]) {
    g.add(pipeMesh([x + 0.30, y - 0.05, 0], [x + 0.30, y + 0.28, 0.02], 0.017, MATS.cockpit, 8));
    g.add(mesh(box(0.05, 0.10, 0.05, 4), MATS.cockpit, { pos: [x + 0.30, y + 0.33, 0.02], shadow: false }));
    g.add(pipeMesh([x + 0.10, y + 0.02, -0.26], [x + 0.42, y + 0.20, -0.30], 0.018, MATS.cockpit, 8));
    for (const sd of [-1, 1]) g.add(mesh(box(0.14, 0.05, 0.09, 4), MATS.cockpit, { pos: [x + 0.52, y - 0.20, sd * 0.14], rot: [0, 0, -0.25], shadow: false }));
  }
  // 炮手 TADS 光学瞄准柱 (ORT)
  g.add(mesh(box(0.30, 0.24, 0.30, 4), MATS.cockpit, { pos: [4.92, 1.62, 0], shadow: false }));
  g.add(mesh(box(0.10, 0.13, 0.16, 4), MATS.matteBlack, { pos: [4.76, 1.66, 0], shadow: false }));
  // 舱内地板 + 后隔框
  g.add(mesh(box(2.55, 0.04, 1.10, 2), MATS.cockpit, { pos: [4.0, 1.34, 0], shadow: false }));
  g.add(mesh(box(0.06, 0.80, 1.16, 2), MATS.cockpit, { pos: [2.72, 1.95, 0], shadow: false }));
  return g;
}

/* ------------------------------------------------- 机头 TADS / PNVS 转塔 */
function buildNoseSensors() {
  const g = group('nose-sensors');

  /* --- PNVS：机头上方飞行员夜视转塔 --- */
  const pnvsYaw = group('pnvs-yaw', [], [6.30, 1.82, 0]);
  const pnvsBase = mesh(latheProfile([[0, 0], [0.165, 0], [0.175, 0.035], [0.17, 0.085], [0.128, 0.112], [0, 0.118]], 28, 4), MATS.matteBlack, { name: 'pnvs-base' });
  pnvsYaw.add(pnvsBase);
  const pnvsHead = group('pnvs-head', [], [0, 0.115, 0]);
  const drum = mesh(cyl(0.138, 0.138, 0.27, 32, false, 4), MATS.matteBlack, { rot: [PI / 2, 0, 0] });
  pnvsHead.add(drum);
  pnvsHead.add(mesh(cyl(0.142, 0.142, 0.022, 32, false, 4), MATS.gunMetal, { pos: [0, 0, 0.148], rot: [PI / 2, 0, 0] }));
  pnvsHead.add(mesh(cyl(0.142, 0.142, 0.022, 32, false, 4), MATS.gunMetal, { pos: [0, 0, -0.148], rot: [PI / 2, 0, 0] }));
  // FLIR 窗口
  pnvsHead.add(mesh(box(0.022, 0.155, 0.185, 4), MATS.lensIR, { pos: [0.131, 0.005, 0] }));
  pnvsHead.add(mesh(box(0.032, 0.185, 0.215, 4), MATS.gunMetal, { pos: [0.118, 0.005, 0] }));
  pnvsYaw.add(pnvsHead);
  g.add(pnvsYaw);

  /* --- TADS：机头下方目标截获转塔 --- */
  const tadsYaw = group('tads-yaw', [], [6.02, 1.30, 0]);
  tadsYaw.add(mesh(latheProfile([[0, 0], [0.235, 0], [0.245, -0.05], [0.225, -0.12], [0.15, -0.17]], 32, 4), MATS.matteBlack, { name: 'tads-base' }));
  const tadsPitch = group('tads-pitch', [], [0, -0.235, 0]);
  // 转塔本体（圆柱 + 两侧法兰）
  tadsPitch.add(mesh(cyl(0.215, 0.215, 0.44, 36, false, 4), MATS.matteBlack, { rot: [PI / 2, 0, 0] }));
  tadsPitch.add(mesh(sph(0.215, 30, 4), MATS.matteBlack, { pos: [-0.03, 0, 0] }));
  for (const s of [-1, 1]) {
    tadsPitch.add(mesh(cyl(0.222, 0.222, 0.035, 36, false, 4), MATS.gunMetal, { pos: [0, 0, s * 0.232], rot: [PI / 2, 0, 0] }));
    tadsPitch.add(flangeBolts([0, 0, s * 0.252], 'z', 0.175, 12, 0.010, 0.009, MATS.gunMetal));
  }
  // 前面板：DTV 昼视 / DVO 直视光学 / FLIR / 激光
  tadsPitch.add(mesh(box(0.04, 0.35, 0.37, 4), MATS.gunMetal, { pos: [0.205, 0, 0] }));
  tadsPitch.add(mesh(cyl(0.095, 0.095, 0.022, 30, false, 6), MATS.lens, { pos: [0.232, 0.068, -0.092], rot: [0, 0, PI / 2] }));
  tadsPitch.add(mesh(cyl(0.068, 0.068, 0.022, 26, false, 6), MATS.lensIR, { pos: [0.232, 0.068, 0.105], rot: [0, 0, PI / 2] }));
  tadsPitch.add(mesh(box(0.022, 0.105, 0.142, 4), MATS.lens, { pos: [0.230, -0.092, -0.036] }));
  tadsPitch.add(mesh(cyl(0.034, 0.034, 0.024, 22, false, 6), MATS.lensIR, { pos: [0.232, -0.088, 0.124], rot: [0, 0, PI / 2] }));
  tadsPitch.add(mesh(box(0.05, 0.06, 0.06, 4), MATS.gunMetal, { pos: [0.215, -0.006, 0.19] }));
  tadsYaw.add(tadsPitch);
  g.add(tadsYaw);

  hot([6.20, 0.98, 0.20], 'TADS / PNVS', '目标截获指示 + 飞行员夜视传感器', 'tads');
  return { g, pnvsYaw, pnvsHead, tadsYaw, tadsPitch };
}

/* ---------------------------------------------------------- 发动机短舱 */
function buildNacelle(side) {
  const g = group('nacelle' + side);
  const secs = [];
  const table = [
    [2.62, 0.150, 0.170, 2.140],
    [2.50, 0.235, 0.245, 2.155],
    [2.30, 0.288, 0.292, 2.170],
    [1.95, 0.332, 0.325, 2.184],
    [1.40, 0.345, 0.335, 2.195],
    [0.70, 0.345, 0.335, 2.200],
    [0.00, 0.340, 0.326, 2.194],
    [-0.60, 0.305, 0.300, 2.175],
    [-1.05, 0.285, 0.282, 2.155],
    [-1.35, 0.250, 0.255, 2.135],
    [-1.55, 0.190, 0.205, 2.120],
  ];
  for (const [x, w, h, yc] of resample(table, 3)) {
    secs.push({ x, ring: ringSuperellipse(w, h, yc, { eTop: 3.0, eBot: 3.2, count: 56, wBot: 0.92 }) });
  }
  const skin = loft(secs, { capStart: false, capEnd: true, uvScale: 1 });
  const m = mesh(skin, MATS.paintDark, { name: 'nacelle-skin' });
  m.position.z = side * 1.05;
  if (side < 0) m.scale.z = -1;
  g.add(m);

  const Z = side * 1.05;
  /* 进气道：粒子分离器唇口 + 内锥 + 滤网 */
  const lip = latheProfile([[0.155, 0], [0.175, 0.02], [0.185, 0.06], [0.175, 0.10], [0.14, 0.12], [0.13, 0.10], [0.14, 0.04], [0.145, 0]], 30, 4);
  g.add(mesh(lip, MATS.alu, { pos: [2.60, 2.14, Z], rot: [0, 0, -PI / 2] }));
  g.add(mesh(cyl(0.148, 0.148, 0.02, 28, false, 4), MATS.screen, { pos: [2.52, 2.14, Z], rot: [0, 0, PI / 2], shadow: false }));
  g.add(mesh(latheProfile([[0, 0], [0.05, 0.02], [0.07, 0.08], [0.05, 0.16], [0, 0.18]], 22, 4), MATS.matteBlack, { pos: [2.46, 2.14, Z], rot: [0, 0, -PI / 2] }));
  g.add(mesh(cyl(0.152, 0.150, 0.14, 30, true, 4), MATS.matteBlack, { pos: [2.44, 2.14, Z], rot: [0, 0, PI / 2] }));

  /* 黑洞式红外抑制排气口（向外上偏转的矩形喷口） */
  const ex = group('exhaust', [], [-1.42, 2.16, Z + side * 0.06]);
  ex.rotation.set(0, side * -0.42, 0.12);
  const duct = mesh(box(0.34, 0.30, 0.44, 3), MATS.exhaust, { name: 'ir-suppressor' });
  ex.add(duct);
  ex.add(mesh(box(0.30, 0.26, 0.03, 4), MATS.matteBlack, { pos: [0.02, 0, 0.20] }));
  // 内部导流片
  for (let i = -1; i <= 1; i++) ex.add(mesh(box(0.28, 0.02, 0.24, 4), MATS.matteBlack, { pos: [0.01, i * 0.075, 0.10], rot: [0, 0, 0] }));
  ex.add(mesh(box(0.38, 0.34, 0.06, 4), MATS.gunMetal, { pos: [0, 0, -0.20] }));
  g.add(ex);
  // 排气烟痕
  g.add(decal(DECAL.stripe('#1b1a18'), 0.9, 0.36, [-2.05, 2.30, Z + side * 0.30], [0, 0, 0], { opacity: 0.35, rough: 0.9 }));

  /* 舱盖分缝 / 卡扣 / 加油口 / 散热百叶 */
  for (let i = 0; i < 5; i++) {
    const x = 1.9 - i * 0.62;
    g.add(barMesh([x, 2.49, Z - 0.14], [x, 2.49, Z + 0.14], 0.016, 0.012, MATS.paintDark, 4));
    g.add(mesh(box(0.05, 0.02, 0.07, 4), MATS.alu, { pos: [x - 0.02, 2.46, Z + side * 0.28] }));
  }
  for (let i = 0; i < 6; i++) {
    g.add(barMesh([0.5 - i * 0.12, 2.34, Z + side * 0.31], [0.5 - i * 0.12, 2.12, Z + side * 0.315], 0.05, 0.014, MATS.matteBlack, 4));
  }
  g.add(mesh(cyl(0.055, 0.055, 0.012, 20, false, 6), MATS.alu, { pos: [1.15, 2.505, Z + side * 0.10] }));
  g.add(decal(DECAL.stencil(['OIL'], { size: 26 }), 0.14, 0.07, [1.02, 2.512, Z + side * 0.10], [-PI / 2, 0, 0]));

  /* 短舱与机身之间的整流条 */
  g.add(barMesh([2.35, 2.36, Z - side * 0.29], [-1.20, 2.32, Z - side * 0.29], 0.10, 0.06, MATS.paintDark, 3));

  if (side > 0) hot([1.5, 2.62, side * 1.05], 'T700-GE-701D 涡轴发动机', '双发 · 1994 shp · 黑洞红外抑制排气', 'engine');
  return g;
}
/* -------------------------------------------------------------- 垂尾 */
function buildFin() {
  const g = group('fin');
  /* [高度y, 弦长, 前缘x, 厚度比] —— 后掠垂尾 */
  const table = [
    [1.50, 1.72, -6.31, 0.17],
    [1.90, 1.62, -6.42, 0.155],
    [2.35, 1.48, -6.60, 0.145],
    [2.80, 1.30, -6.80, 0.14],
    [3.24, 1.06, -7.02, 0.135],
    [3.56, 0.86, -7.18, 0.135],
    [3.76, 0.74, -7.28, 0.14],
    [3.86, 0.66, -7.33, 0.15],
  ];
  const X0 = table[0][2] + table[0][1] * 0.25;     // 根部 1/4 弦位置
  const st = table.map(([y, c, xle, th]) => ({
    s: y, chord: c, thick: th, twist: 0,
    dx: -((xle + c * 0.25) - X0),                  // 前缘后掠
  }));
  let geo = loftAirfoil(resample(st, 3), { n: 34, uvScale: 1, spanAxis: 'z', capRoot: true, capTip: true });
  geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-PI / 2));  // 展向 z → y
  geo.translate(X0, 0, 0);
  g.add(mesh(geo, MATS.paint, { name: 'fin-skin' }));

  /* 尾梁-垂尾 根部整流 */
  const root = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, x = -5.95 - t * 1.75;
    const k = Math.sin(PI * Math.min(1, 0.08 + t * 0.95));
    root.push({ x, ring: ringSuperellipse(0.10 * k + 0.02, 0.30 * k + 0.02, 1.98 + 0.16 * t, { eTop: 3, eBot: 3, count: 36 }) });
  }
  g.add(mesh(loft(root, { capStart: true, capEnd: true }), MATS.paint, { name: 'fin-root' }));

  /* 尾灯 + 编队灯 + 防撞灯 */
  g.add(mesh(sph(0.045, 16, 6), MATS.navWhite, { pos: [-7.44, 3.05, 0], shadow: false }));
  g.add(mesh(latheProfile([[0, 0], [0.05, 0], [0.06, 0.03], [0.05, 0.06], [0, 0.07]], 18, 5), MATS.matteBlack, { pos: [-7.36, 3.82, 0] }));
  const strobe = mesh(sph(0.042, 16, 6), MATS.strobe, { pos: [-7.36, 3.88, 0], shadow: false });
  g.add(strobe);
  g.add(decal(DECAL.text('0 4 2 3 1', { color: '#c6cabf', alpha: 0.55 }), 0.60, 0.15, [-6.90, 3.30, 0.075], [0, PI / 2, 0.28]));
  g.add(decal(DECAL.text('0 4 2 3 1', { color: '#c6cabf', alpha: 0.55 }), 0.60, 0.15, [-6.90, 3.30, -0.075], [0, -PI / 2, -0.28]));
  return { g, strobe };
}

/* ------------------------------------------------------- 全动平尾（可动） */
function buildStabilator() {
  const g = group('stabilator');
  const st = [];
  for (const [s, c, th, dx] of [[0.02, 0.86, 0.14, 0], [0.9, 0.82, 0.13, 0.02], [1.55, 0.70, 0.12, 0.06], [1.72, 0.40, 0.13, 0.14]]) {
    st.push({ s, chord: c, thick: th, twist: 0, dx, dy: 0 });
  }
  const half = loftAirfoil(resample(st, 3), { n: 30, uvScale: 1, spanAxis: 'z' });
  const r = mesh(half, MATS.paint, { name: 'stab-r' });
  const l = mesh(half, MATS.paint, { name: 'stab-l' });
  l.scale.z = -1;
  const pivot = group('stab-pivot', [r, l], [-6.72, 1.62, 0]);
  // 铰链整流 + 作动筒
  pivot.add(mesh(box(0.28, 0.18, 0.30, 3), MATS.paint, { pos: [-0.02, 0.02, 0] }));
  g.add(pivot);
  g.add(pipeMesh([-6.40, 1.90, 0.10], [-6.66, 1.72, 0.10], 0.032, MATS.gunMetal, 10));
  g.add(pipeMesh([-6.44, 1.92, -0.10], [-6.68, 1.74, -0.10], 0.032, MATS.gunMetal, 10));
  hot([-6.9, 1.62, 1.2], '全动式平尾', 'Stabilator · 随速度自动配平', 'stab');
  return { g, pivot };
}
