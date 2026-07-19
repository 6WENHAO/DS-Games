/* vehicles.js — 载具工厂
   建模约定:① 车身=侧影 Shape(含轮拱弧)挤出+倒角,侧窗用 Shape.holes 挖洞
            ② 轮胎/轮毂罩 Lathe,辐条盘=圆形 Shape + 5 孔挖洞挤出
            ③ 保险杠/灯/后视镜/座椅等 = 声明式零件(rbox/cyl/sph)
   1 单位 = 1 米;枢轴:车轮=轮毂心,车门=铰链;local +Z = 车头 */
window.G = window.G || {};
(function () {
  const U = G.U;
  const V = {};
  G.VEH = V;

  /* ---------------- 规格 ---------------- */
  V.specs = {
    sedan:  { name: '猎鹰', L: 4.70, W: 1.80, H: 1.42, wb: 2.70, wr: 0.325, tw: 0.20, track: 0.72, mass: 1300, power: 10.5, top: 44, grip: 8.6,  seatZ: 0.12, seatY: 0.55 },
    sports: { name: '蝰蛇GT', L: 4.42, W: 1.88, H: 1.21, wb: 2.62, wr: 0.330, tw: 0.24, track: 0.76, mass: 1250, power: 16.5, top: 58, grip: 10.4, seatZ: -0.05, seatY: 0.46 },
    van:    { name: '骡子', L: 5.30, W: 2.02, H: 2.30, wb: 3.20, wr: 0.360, tw: 0.22, track: 0.78, mass: 2100, power: 8.0, top: 34, grip: 7.2,  seatZ: 1.35, seatY: 0.78 },
    taxi:   { name: '出租车', L: 4.70, W: 1.80, H: 1.42, wb: 2.70, wr: 0.325, tw: 0.20, track: 0.72, mass: 1300, power: 10.5, top: 43, grip: 8.6, seatZ: 0.12, seatY: 0.55 }
  };
  V.paints = {
    sedan: [0x8a9096, 0x27436e, 0x7d1f1f, 0x22262a, 0xcfd2d6, 0x35502e],
    sports: [0xd8a413, 0xc4501b, 0x1f9aa8, 0x5a2a9d, 0xc42660],
    van: [0xd8d5cc, 0x7a8087, 0x6e5233, 0x3f5e73],
    taxi: [0xe8b83a]
  };

  /* ---------------- 共享材质 ---------------- */
  let SM = null;
  V.sharedMats = function () {
    if (SM) return SM;
    const t = G.TEX.t;
    SM = {
      plastic: new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.85, metalness: 0.1 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.22, metalness: 0.95 }),
      glass: new THREE.MeshPhysicalMaterial({ color: 0x131c22, roughness: 0.06, metalness: 0.9, transparent: true, opacity: 0.62, clearcoat: 1, side: THREE.DoubleSide }),
      tire: new THREE.MeshStandardMaterial({ map: t.tire.map, roughness: 0.94, metalness: 0 }),
      rim: new THREE.MeshStandardMaterial({ color: 0xc4c9ce, roughness: 0.3, metalness: 0.9 }),
      dash: new THREE.MeshStandardMaterial({ map: t.dash.map, emissiveMap: t.dash.ems, emissive: 0x000000, roughness: 0.9 }),
      seat: new THREE.MeshStandardMaterial({ map: t.seat.map, roughness: 0.92 }),
      inner: new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.95 }),
      plate: new THREE.MeshStandardMaterial({ map: t.plate.map, roughness: 0.5, metalness: 0.4 }),
      disc: new THREE.MeshStandardMaterial({ color: 0x8f9499, roughness: 0.45, metalness: 0.8 })
    };
    G.MATENV = G.MATENV || [];
    G.MATENV.push(SM.chrome, SM.glass, SM.rim);
    return SM;
  };
  V.paintMat = function (color) {
    const m = new THREE.MeshPhysicalMaterial({ color, metalness: 0.72, roughness: 0.34, clearcoat: 0.85, clearcoatRoughness: 0.22 });
    G.MATENV = G.MATENV || [];
    G.MATENV.push(m);
    return m;
  };

  /* ---------------- 侧影定义(x=纵向 -尾/+头, y=高) ---------------- */
  function silhouette(type, s) {
    const sh = new THREE.Shape();
    const fa = s.wb / 2 + (type === 'van' ? 0.55 : 0);        // 前轴 x(货车驾驶室前移)
    const ra = -s.wb / 2 + (type === 'van' ? 0.55 : 0);
    const AR = s.wr + 0.095;                                   // 轮拱半径
    const cy = s.wr;                                           // 轮心高
    const rockY = 0.16, L2 = s.L / 2 - 0.06;
    const aIn = Math.asin((cy - rockY) / AR);                  // 拱与底边交角
    sh.moveTo(ra - AR * Math.cos(aIn) - 0.12, rockY + 0.1);
    sh.lineTo(ra - AR * Math.cos(aIn), rockY);
    sh.absarc(ra, cy, AR, Math.PI + aIn, -aIn, true);          // 后轮拱
    sh.lineTo(fa - AR * Math.cos(aIn), rockY);
    sh.absarc(fa, cy, AR, Math.PI + aIn, -aIn, true);          // 前轮拱
    sh.lineTo(L2 - 0.1, rockY);
    const H = s.H - 0.06;
    if (type === 'sports') {
      sh.lineTo(L2, 0.30); sh.quadraticCurveTo(L2, 0.52, L2 - 0.24, 0.58);
      sh.quadraticCurveTo(L2 - 0.9, 0.70, 0.72, 0.76);
      sh.quadraticCurveTo(0.25, H, -0.28, H);
      sh.quadraticCurveTo(-1.05, H - 0.02, -1.62, 0.82);
      sh.lineTo(-L2 + 0.06, 0.74); sh.quadraticCurveTo(-L2, 0.72, -L2, 0.5);
      sh.lineTo(-L2 + 0.03, 0.30);
    } else if (type === 'van') {
      sh.lineTo(L2, 0.42); sh.quadraticCurveTo(L2, 0.66, L2 - 0.12, 0.72);
      sh.lineTo(L2 - 0.55, 0.80);
      sh.quadraticCurveTo(L2 - 1.1, H - 0.28, L2 - 1.45, H);
      sh.lineTo(-L2 + 0.16, H); sh.quadraticCurveTo(-L2, H, -L2, H - 0.2);
      sh.lineTo(-L2, 0.4);
    } else {
      sh.lineTo(L2, 0.26); sh.quadraticCurveTo(L2 + 0.02, 0.5, L2 - 0.06, 0.56);
      sh.lineTo(L2 - 0.5, 0.63);
      sh.quadraticCurveTo(0.95, 0.80, 0.78, 0.82);
      sh.quadraticCurveTo(0.35, H, -0.30, H);
      sh.quadraticCurveTo(-1.2, H - 0.03, -1.58, 0.88);
      sh.quadraticCurveTo(-2.1, 0.82, -L2 + 0.05, 0.80);
      sh.quadraticCurveTo(-L2 - 0.02, 0.76, -L2, 0.52);
      sh.lineTo(-L2 + 0.02, 0.30);
    }
    sh.closePath();
    /* 侧窗挖洞 */
    const holes = [];
    function winHole(pts) {
      const p = new THREE.Path();
      p.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
      p.closePath();
      holes.push(p);
    }
    if (type === 'sports') {
      winHole([[0.55, 0.80], [0.12, H - 0.10], [-0.30, H - 0.10], [-0.30, 0.80]]);
      winHole([[-0.42, 0.80], [-0.42, H - 0.12], [-0.78, H - 0.14], [-1.25, 0.82]]);
    } else if (type === 'van') {
      winHole([[L2 - 0.6, 0.9], [L2 - 0.72, H - 0.24], [L2 - 1.55, H - 0.24], [L2 - 1.55, 0.9]]);
    } else {
      winHole([[0.62, 0.88], [0.24, H - 0.12], [-0.26, H - 0.12], [-0.26, 0.88]]);
      winHole([[-0.40, 0.88], [-0.40, H - 0.12], [-0.72, H - 0.13], [-1.34, 0.90]]);
    }
    holes.forEach(h => sh.holes.push(h));
    return { shape: sh, fa, ra, H };
  }

  function extrudeBody(shape, width, bev) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: width - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 10 });
    g.translate(0, 0, -(width - 2 * bev) / 2);
    g.rotateY(-Math.PI / 2);                       // +X长度 → +Z 车头
    g.computeVertexNormals();
    return g;
  }

  /* ---------------- 车轮(Lathe + 辐条挖洞) ---------------- */
  const wheelCache = {};
  function buildWheel(wr, tw) {
    const key = wr + '_' + tw;
    if (wheelCache[key]) return wheelCache[key];
    const rimR = wr * 0.60, hw = tw / 2;
    const tirePts = [
      [rimR, -hw], [wr * 0.86, -hw * 0.96], [wr * 0.97, -hw * 0.62], [wr, -hw * 0.3],
      [wr, hw * 0.3], [wr * 0.97, hw * 0.62], [wr * 0.86, hw * 0.96], [rimR, hw]
    ].map(p => new THREE.Vector2(p[0], p[1]));
    const tire = new THREE.LatheGeometry(tirePts, 22);
    tire.rotateZ(Math.PI / 2);                     // 轴向 → X
    /* 轮毂盘:圆 + 5 个挖洞窗口 */
    const disc = new THREE.Shape();
    disc.absarc(0, 0, rimR * 0.98, 0, U.TAU, false);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * U.TAU, ho = new THREE.Path();
      const cr = rimR * 0.52, hr = rimR * 0.26;
      ho.absarc(Math.cos(a) * cr, Math.sin(a) * cr, hr, 0, U.TAU, true);
      disc.holes.push(ho);
    }
    const spokes = new THREE.ExtrudeGeometry(disc, { depth: tw * 0.22, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 8 });
    spokes.rotateY(Math.PI / 2);
    spokes.translate(hw * 0.30, 0, 0);
    /* 轮辋(车削) + 中心帽 + 刹车盘 */
    const rimPts = [[rimR * 0.4, -hw * 0.1], [rimR * 0.96, -hw * 0.55], [rimR * 0.99, hw * 0.28]].map(p => new THREE.Vector2(p[0], p[1]));
    const rimG = new THREE.LatheGeometry(rimPts, 18);
    rimG.rotateZ(Math.PI / 2);
    const hub = new THREE.SphereGeometry(rimR * 0.22, 10, 8);
    hub.scale(0.5, 1, 1); hub.translate(hw * 0.42, 0, 0);
    const discG = new THREE.CylinderGeometry(rimR * 0.8, rimR * 0.8, 0.024, 16);
    discG.rotateZ(Math.PI / 2);
    wheelCache[key] = { tire, rimMerged: U.mergeGeos([spokes, rimG, hub]), disc: discG };
    return wheelCache[key];
  }

  /* ---------------- 车门(带窗洞的侧影薄片) ---------------- */
  function doorGeo(type, s, H) {
    const front = type === 'van' ? 1.9 : 0.62, rear = type === 'van' ? 0.9 : -0.36;
    const top = H - 0.13, belt = 0.85, bot = 0.24;
    const sh = new THREE.Shape();
    sh.moveTo(rear, bot); sh.lineTo(front, bot); sh.lineTo(front, belt + (type === 'van' ? 0.05 : 0.02));
    sh.lineTo(front - (type === 'van' ? 0.12 : 0.34), top); sh.lineTo(rear + 0.08, top); sh.lineTo(rear, belt);
    sh.closePath();
    const hole = new THREE.Path();
    hole.moveTo(rear + 0.10, belt + 0.05); hole.lineTo(front - 0.10, belt + 0.05);
    hole.lineTo(front - (type === 'van' ? 0.20 : 0.40), top - 0.06); hole.lineTo(rear + 0.16, top - 0.06);
    hole.closePath();
    sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 });
    g.rotateY(-Math.PI / 2);
    return { geo: g, front, rear, belt, top };
  }

  /* ---------------- 参数化零件:后视镜 ---------------- */
  function mirrorParts(x, y, z) {
    return [
      { t: 'cyl', s: [0.018, 0.018, 0.12], p: [x - 0.05, y, z], r: [0, 0, Math.PI / 2 * 0.9], m: 'plastic', mirror: true },
      { t: 'rbox', s: [0.06, 0.11, 0.17], rr: 0.02, p: [x, y + 0.03, z], m: 'paint', mirror: true },
      { t: 'box', s: [0.012, 0.085, 0.13], p: [x + 0.015, y + 0.03, z - 0.012], m: 'chrome', mirror: true }
    ];
  }

  /* ---------------- 整车构建 ---------------- */
  V.build = function (type, opt) {
    opt = opt || {};
    const s = V.specs[type];
    const mats = Object.assign({}, V.sharedMats());
    const color = opt.color != null ? opt.color : U.pick(U.rng(opt.seed || (Math.random() * 1e9) | 0), V.paints[type]);
    mats.paint = V.paintMat(color);
    mats.default = mats.plastic;

    const root = new THREE.Group(); root.name = 'veh_' + type;
    const body = new THREE.Group(); body.name = 'body';
    root.add(body);

    const { shape, fa, ra, H } = silhouette(type, s);
    const bev = 0.06;
    const shell = new THREE.Mesh(extrudeBody(shape, s.W - 0.16, bev), mats.paint);
    shell.castShadow = shell.receiveShadow = true;
    body.add(shell);

    /* 玻璃体:侧窗内衬板 + 前后风挡 */
    const gw = s.W - 0.30;
    const gs = new THREE.Shape();
    if (type === 'van') {
      gs.moveTo(2.5, 0.86); gs.lineTo(0.8, 0.86); gs.lineTo(0.8, H - 0.20); gs.lineTo(2.42, H - 0.20);
    } else if (type === 'sports') {
      gs.moveTo(0.62, 0.78); gs.lineTo(-1.30, 0.78); gs.lineTo(-0.80, H - 0.11); gs.lineTo(0.16, H - 0.11);
    } else {
      gs.moveTo(0.68, 0.86); gs.lineTo(-1.40, 0.86); gs.lineTo(-0.75, H - 0.11); gs.lineTo(0.28, H - 0.11);
    }
    gs.closePath();
    const glassIn = new THREE.Mesh(extrudeBody(gs, gw, 0.02), mats.glass);
    body.add(glassIn);

    const P = [];  // 零件表
    const L2 = s.L / 2;
    /* 风挡(贴坡面) */
    if (type === 'van') {
      P.push({ t: 'box', s: [s.W - 0.5, 0.62, 0.03], p: [0, H - 0.58, L2 - 0.86], r: [0.42, 0, 0], m: 'glass' });
      P.push({ t: 'box', s: [s.W - 0.6, 0.5, 0.03], p: [0, H - 0.5, -L2 + 0.10], r: [-0.06, 0, 0], m: 'glass' });
    } else if (type === 'sports') {
      P.push({ t: 'box', s: [s.W - 0.62, 0.52, 0.025], p: [0, H - 0.32, 0.47], r: [0.95, 0, 0], m: 'glass' });
      P.push({ t: 'box', s: [s.W - 0.72, 0.5, 0.025], p: [0, H - 0.33, -0.62], r: [-1.05, 0, 0], m: 'glass' });
    } else {
      P.push({ t: 'box', s: [s.W - 0.62, 0.62, 0.025], p: [0, H - 0.36, 0.52], r: [0.72, 0, 0], m: 'glass' });
      P.push({ t: 'box', s: [s.W - 0.7, 0.55, 0.025], p: [0, H - 0.37, -1.06], r: [-0.82, 0, 0], m: 'glass' });
    }
    /* 保险杠 */
    const bumpY = type === 'van' ? 0.42 : 0.34, bw = s.W - 0.06;
    P.push({ t: 'rbox', s: [bw, 0.22, 0.16], rr: 0.05, p: [0, bumpY, L2 - 0.04], m: 'plastic' });
    P.push({ t: 'rbox', s: [bw, 0.22, 0.16], rr: 0.05, p: [0, bumpY, -L2 + 0.04], m: 'plastic' });
    P.push({ t: 'rbox', s: [bw - 0.3, 0.10, 0.06], rr: 0.02, p: [0, 0.18, L2 - 0.01], m: 'plastic' });
    /* 进气格栅 */
    if (type !== 'van') {
      P.push({ t: 'rbox', s: [0.62, 0.10, 0.04], rr: 0.02, p: [0, 0.52, L2 - 0.005], m: 'plastic' });
      P.push({ t: 'box', s: [0.58, 0.015, 0.045], p: [0, 0.50, L2 - 0.002], m: 'chrome' });
    } else P.push({ t: 'rbox', s: [1.0, 0.16, 0.04], rr: 0.03, p: [0, 0.56, L2 - 0.005], m: 'plastic' });
    /* 大灯 / 尾灯 */
    const hlY = type === 'sports' ? 0.52 : (type === 'van' ? 0.62 : 0.56);
    P.push({ t: 'rbox', s: [0.34, 0.10, 0.05], rr: 0.03, p: [s.W / 2 - 0.32, hlY, L2 - 0.02], m: 'lightF', mirror: true, name: 'hl' });
    P.push({ t: 'rbox', s: [0.30, 0.09, 0.05], rr: 0.03, p: [s.W / 2 - 0.30, hlY + 0.02, -L2 + 0.02], m: 'lightR', mirror: true, name: 'tl' });
    P.push({ t: 'rbox', s: [0.10, 0.07, 0.04], rr: 0.02, p: [s.W / 2 - 0.55, hlY, -L2 + 0.02], m: 'lightW', mirror: true });
    /* 门把手 */
    P.push({ t: 'rbox', s: [0.03, 0.03, 0.14], rr: 0.01, p: [s.W / 2 - 0.045, 0.78, type === 'van' ? 1.15 : 0.30], m: 'chrome', mirror: true });
    /* 排气 */
    if (type !== 'van') P.push({ t: 'cyl', s: [0.035, 0.035, 0.12], p: [s.W / 2 - 0.35, 0.20, -L2 + 0.02], r: [Math.PI / 2, 0, 0], m: 'chrome', mirror: type === 'sports' });
    /* 车顶天线 / 尾翼 / 出租车顶灯 */
    if (type === 'sedan') P.push({ t: 'cyl', s: [0.006, 0.004, 0.3], p: [0.55, H + 0.14, -0.62], r: [-0.3, 0, 0], m: 'plastic' });
    if (type === 'sports') {
      P.push({ t: 'rbox', s: [1.5, 0.03, 0.28], rr: 0.01, p: [0, H + 0.13, -L2 + 0.32], m: 'paint' });
      P.push({ t: 'box', s: [0.04, 0.12, 0.16], p: [0.55, H + 0.05, -L2 + 0.34], m: 'paint', mirror: true });
    }
    if (type === 'taxi') P.push({ t: 'rbox', s: [0.52, 0.16, 0.24], rr: 0.04, p: [0, H + 0.1, 0.1], m: 'taxiSign' });
    /* 雨刮 */
    if (type !== 'sports') P.push({ t: 'box', s: [0.34, 0.012, 0.012], p: [0.25, type === 'van' ? H - 0.92 : 0.78, type === 'van' ? L2 - 0.55 : 0.83], r: [0, 0.35, 0], m: 'plastic', mirror: true });
    /* 内饰:仪表台 / 座椅 / 地板 */
    const dashZ = type === 'van' ? L2 - 1.15 : 0.62, floorY = 0.32;
    P.push({ t: 'rbox', s: [s.W - 0.4, 0.30, 0.34], rr: 0.05, p: [0, floorY + 0.42, dashZ], m: 'dash' });
    P.push({ t: 'box', s: [s.W - 0.36, 0.1, type === 'van' ? 2.6 : 3.1], p: [0, floorY - 0.05, type === 'van' ? 0.9 : -0.2], m: 'inner' });
    const seatZ = s.seatZ, seatY = s.seatY;
    for (const sx of [0.38, -0.38]) {
      P.push({ t: 'rbox', s: [0.52, 0.14, 0.55], rr: 0.05, p: [sx, seatY, seatZ], m: 'seat' });
      P.push({ t: 'rbox', s: [0.52, 0.62, 0.13], rr: 0.05, p: [sx, seatY + 0.33, seatZ - 0.3], r: [-0.16, 0, 0], m: 'seat' });
      P.push({ t: 'rbox', s: [0.24, 0.12, 0.08], rr: 0.03, p: [sx, seatY + 0.70, seatZ - 0.36], r: [-0.16, 0, 0], m: 'seat' });
    }
    if (type !== 'van') for (const sx of [0.38, -0.38]) P.push({ t: 'rbox', s: [0.5, 0.12, 0.5], rr: 0.04, p: [sx, seatY + 0.02, seatZ - 1.12], m: 'seat' });
    /* 后视镜 */
    mirrorParts(s.W / 2 + 0.06, 0.92, type === 'van' ? L2 - 0.95 : 0.72).forEach(d => P.push(d));
    /* 车牌 */
    P.push({ t: 'box', s: [0.36, 0.18, 0.012], p: [0, bumpY + 0.02, L2 + 0.045], m: 'plate' });
    P.push({ t: 'box', s: [0.36, 0.18, 0.012], p: [0, bumpY + 0.02, -L2 - 0.045], r: [0, Math.PI, 0], m: 'plate' });

    mats.lightF = new THREE.MeshStandardMaterial({ color: 0xd8e2e8, roughness: 0.2, metalness: 0.4, emissive: 0x000000 });
    mats.lightR = new THREE.MeshStandardMaterial({ color: 0x6e1414, roughness: 0.3, metalness: 0.2, emissive: 0x000000 });
    mats.lightW = new THREE.MeshStandardMaterial({ color: 0xcfd4d8, roughness: 0.3, metalness: 0.2 });
    if (type === 'taxi') mats.taxiSign = new THREE.MeshStandardMaterial({ color: 0xf2e6c4, roughness: 0.5, emissive: 0x000000 });

    const parts = U.buildParts(P, mats);
    body.add(parts.group);

    /* 车门(驾驶侧 +X,铰链前缘) */
    const dg = doorGeo(type, s, H);
    const hingeZ = dg.front, doorX = s.W / 2 - 0.055;
    const doorPivot = new THREE.Group();
    doorPivot.position.set(doorX, 0, hingeZ);
    const doorMesh = new THREE.Mesh(dg.geo, [mats.paint, mats.paint][0]);
    doorMesh.castShadow = true;
    doorMesh.position.set(0.02, 0, -hingeZ);
    /* 把门几何平移到铰链原点坐标系 */
    doorPivot.add(doorMesh);
    const dhandle = new THREE.Mesh(U.rbox(0.03, 0.03, 0.13, 0.01), mats.chrome);
    dhandle.position.set(0.05, 0.79, dg.rear - hingeZ + 0.25);
    doorPivot.add(dhandle);
    const dglass = new THREE.Mesh(U.rbox(0.02, dg.top - dg.belt - 0.10, hingeZ - dg.rear - 0.3, 0.008), mats.glass);
    dglass.position.set(0, dg.belt + (dg.top - dg.belt) / 2 - 0.02, (dg.rear - hingeZ) / 2 + (type === 'van' ? 0.16 : 0.1));
    dglass.rotation.x = 0;
    doorPivot.add(dglass);
    body.add(doorPivot);

    /* 方向盘 */
    const swG = new THREE.Group();
    const rimT = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 8, 20), mats.inner);
    swG.add(rimT);
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.18, 6), mats.inner);
      const a = i / 3 * U.TAU + Math.PI / 6;
      sp.position.set(Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0);
      sp.rotation.z = a + Math.PI / 2;
      swG.add(sp);
    }
    const hubC = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mats.inner);
    swG.add(hubC);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.25, 8), mats.inner);
    col.position.set(0, 0, -0.1); col.rotation.x = Math.PI / 2;
    swG.add(col);
    const wheelPos = new THREE.Vector3(0.38, seatY + 0.52, seatZ + 0.52);
    swG.position.copy(wheelPos);
    swG.rotation.x = -0.42;
    body.add(swG);

    /* 车轮 ×4(枢轴=轮毂心;前轮外层转向枢轴) */
    const wg = buildWheel(s.wr, s.tw + (type === 'sports' ? 0.05 : 0));
    const wheels = [];
    const xOff = s.W / 2 - s.track * 0.5 + 0.1;
    const axles = [[fa, true], [ra, false]];
    for (const [az, steer] of axles) for (const sideX of [1, -1]) {
      const steerG = new THREE.Group();
      steerG.position.set(sideX * (s.W / 2 - 0.20), s.wr, az);
      const spin = new THREE.Group();
      const tire = new THREE.Mesh(wg.tire, mats.tire);
      const rim = new THREE.Mesh(wg.rimMerged, mats.rim);
      const disc = new THREE.Mesh(wg.disc, mats.disc);
      if (sideX < 0) { tire.rotation.y = Math.PI; rim.rotation.y = Math.PI; }
      tire.castShadow = true;
      spin.add(tire, rim, disc);
      steerG.add(spin);
      root.add(steerG);
      wheels.push({ steerG, spin, steer, side: sideX, z: az });
    }

    /* 前后灯光晕精灵 + 大灯 SpotLight 由 player 侧挂载 */
    root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    const veh = {
      type, spec: s, root, body, wheels, doorPivot, color,
      mats, swG, wheelPos, seatL: new THREE.Vector3(0.38, seatY + 0.02, seatZ),
      seatR: new THREE.Vector3(-0.38, seatY + 0.02, seatZ),
      doorOut: new THREE.Vector3(s.W / 2 + 0.75, 0, (dg.front + dg.rear) / 2),
      halfW: s.W / 2, halfL: s.L / 2,
      lightsOn: false
    };
    veh.setLights = function (on) {
      veh.lightsOn = on;
      mats.lightF.emissive.setHex(on ? 0xfff2cc : 0x000000);
      mats.lightF.emissiveIntensity = on ? 2.4 : 0;
      mats.lightR.emissive.setHex(on ? 0xff2a1a : 0x000000);
      mats.lightR.emissiveIntensity = on ? 1.6 : 0;
      mats.dash.emissive.setHex(on ? 0xffffff : 0x000000);
      mats.dash.emissiveIntensity = on ? 0.8 : 0;
      if (mats.taxiSign) { mats.taxiSign.emissive.setHex(on ? 0xffe9b0 : 0x000000); mats.taxiSign.emissiveIntensity = on ? 1.5 : 0; }
    };
    veh.brakeGlow = function (on) {
      mats.lightR.emissiveIntensity = veh.lightsOn ? (on ? 3.4 : 1.6) : (on ? 2.6 : 0);
      if (!veh.lightsOn) mats.lightR.emissive.setHex(on ? 0xff2a1a : 0x000000);
    };
    return veh;
  };
})();
