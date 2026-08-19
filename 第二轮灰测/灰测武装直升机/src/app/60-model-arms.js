/* ============================================================================
 *  60 · 武器 / 短翼 / 挂架 / 起落架 / 细节件
 * ==========================================================================*/

/* ---------------------------------------------------- M230 30mm 链式机炮 */
function buildGun() {
  const g = group('gun-assembly');
  /* 固定支座（机腹炮塔环） */
  g.add(mesh(box(0.46, 0.10, 0.44, 3), MATS.paint, { pos: [3.46, 1.03, 0] }));
  g.add(mesh(cyl(0.19, 0.21, 0.12, 26, false, 4), MATS.gunMetal, { pos: [3.46, 0.95, 0] }));
  g.add(flangeBolts([3.46, 0.90, 0], 'y', 0.165, 10, 0.012, 0.012, MATS.steel));

  /* 方位回转组 */
  const yaw = group('gun-yaw', [], [3.46, 0.90, 0]);
  yaw.add(mesh(cyl(0.155, 0.155, 0.14, 24, false, 4), MATS.gunMetal, { pos: [0, -0.06, 0] }));
  // 俯仰耳轴
  for (const s of [-1, 1]) yaw.add(mesh(box(0.16, 0.26, 0.06, 4), MATS.gunMetal, { pos: [-0.02, -0.20, s * 0.155] }));

  /* 俯仰组：炮身 + 炮管 */
  const pitch = group('gun-pitch', [], [0, -0.26, 0]);
  pitch.rotation.z = -2.5 * DEG;
  // 炮身（M230 受弹机 + 机匣）
  pitch.add(mesh(roundBox(0.62, 0.24, 0.22, 0.03, 3, 4), MATS.gunMetal, { pos: [-0.05, 0, 0] }));
  pitch.add(mesh(box(0.20, 0.19, 0.26, 4), MATS.gunMetal, { pos: [-0.28, -0.01, 0] }));
  pitch.add(mesh(box(0.12, 0.14, 0.30, 4), MATS.matteBlack, { pos: [-0.34, 0.03, 0] }));   // 链传动马达
  pitch.add(mesh(cyl(0.045, 0.045, 0.16, 14, false, 5), MATS.steel, { pos: [-0.30, -0.06, 0.16], rot: [PI / 2, 0, 0] }));
  // 炮管 + 消焰器
  pitch.add(mesh(cyl(0.031, 0.034, 1.02, 20, false, 6), MATS.barrel, { pos: [0.76, 0.005, 0], rot: [0, 0, PI / 2] }));
  pitch.add(mesh(cyl(0.046, 0.046, 0.10, 20, false, 6), MATS.barrel, { pos: [1.32, 0.005, 0], rot: [0, 0, PI / 2] }));
  pitch.add(mesh(cyl(0.031, 0.031, 0.04, 18, true, 6), MATS.matteBlack, { pos: [1.36, 0.005, 0], rot: [0, 0, PI / 2] }));
  for (let i = 0; i < 5; i++) pitch.add(mesh(new THREE.TorusGeometry(0.038, 0.006, 8, 20), MATS.barrel, { pos: [0.45 + i * 0.14, 0.005, 0], rot: [0, PI / 2, 0] }));
  // 炮管支承环
  pitch.add(mesh(cyl(0.055, 0.055, 0.05, 18, false, 5), MATS.gunMetal, { pos: [0.30, 0.005, 0], rot: [0, 0, PI / 2] }));
  // 后坐缓冲
  for (const s of [-1, 1]) pitch.add(pipeMesh([-0.30, 0.10, s * 0.10], [0.24, 0.10, s * 0.10], 0.018, MATS.steel, 8));
  yaw.add(pitch);
  g.add(yaw);

  /* 供弹通道（弹药舱 → 炮身） */
  g.add(mesh(box(0.22, 0.34, 0.16, 4), MATS.paint, { pos: [3.34, 1.05, 0.12] }));
  const feed = tube([[3.30, 1.12, 0.13], [3.34, 0.98, 0.14], [3.42, 0.86, 0.10], [3.46, 0.76, 0.02]], 0.055, { radial: 10 });
  g.add(mesh(boxUV(feed, 4), MATS.rubber, { name: 'ammo-feed' }));
  /* 炮口烟痕 */
  g.add(decal(DECAL.stripe('#131211'), 0.5, 0.22, [4.30, 0.72, 0], [PI / 2, 0, 0], { opacity: 0.22, rough: 0.85 }));

  hot([4.2, 0.62, 0.0], 'M230 30mm 链式机炮', '625 发/分 · 1200 发弹舱 · 随头瞄转动', 'gun');
  return { g, yaw, pitch };
}

/* ----------------------------------------------------- AGM-114 地狱火 */
function buildHellfire() {
  const g = group('agm-114');
  const R = 0.089, LEN = 1.30;
  /* 弹体 */
  g.add(mesh(cyl(R, R, LEN, 26, false, 4), MATS.missile, { pos: [0, 0, 0], rot: [0, 0, PI / 2] }));
  /* 头锥 + 激光导引头窗口 */
  g.add(mesh(latheProfile([
    [R, 0], [R, 0.02], [0.086, 0.08], [0.078, 0.16], [0.064, 0.24], [0.046, 0.30], [0.026, 0.335], [0, 0.345],
  ], 26, 4), MATS.missileNose, { pos: [LEN / 2, 0, 0], rot: [0, 0, -PI / 2] }));
  g.add(mesh(sph(0.026, 18, 6), MATS.lens, { pos: [LEN / 2 + 0.335, 0, 0], scale: [0.7, 1, 1] }));
  /* 尾部喷管 */
  g.add(mesh(cyl(R, 0.075, 0.06, 26, false, 4), MATS.gunMetal, { pos: [-LEN / 2 - 0.03, 0, 0], rot: [0, 0, PI / 2] }));
  g.add(mesh(cyl(0.052, 0.052, 0.03, 20, true, 6), MATS.matteBlack, { pos: [-LEN / 2 - 0.055, 0, 0], rot: [0, 0, PI / 2] }));
  /* 弹带 */
  for (const x of [0.42, -0.10, -0.46]) g.add(mesh(cyl(R + 0.004, R + 0.004, 0.02, 26, false, 4), MATS.missileNose, { pos: [x, 0, 0], rot: [0, 0, PI / 2] }));
  /* 中部弹翼 ×4 + 尾翼 ×4 */
  const fin = (len, chord, thick, x, rot) => {
    const st = [
      { s: R - 0.01, chord, thick, twist: 0 },
      { s: R + len * 0.55, chord: chord * 0.92, thick: thick * 0.9, twist: 0, dx: chord * 0.05 },
      { s: R + len, chord: chord * 0.62, thick: thick * 1.0, twist: 0, dx: chord * 0.18 },
    ];
    const geo = loftAirfoil(st, { n: 14, uvScale: 1, spanAxis: 'z' });
    const m = mesh(geo, MATS.missileNose, { pos: [x, 0, 0] });
    m.rotation.x = rot;
    return m;
  };
  for (let i = 0; i < 4; i++) {
    const a = PI / 4 + i * PI / 2;
    g.add(fin(0.075, 0.20, 0.10, 0.28, a));
    g.add(fin(0.155, 0.30, 0.08, -0.44, a));
  }
  /* 挂弹吊耳 */
  g.add(mesh(box(0.10, 0.05, 0.05, 5), MATS.gunMetal, { pos: [0.30, R + 0.02, 0] }));
  g.add(mesh(box(0.10, 0.05, 0.05, 5), MATS.gunMetal, { pos: [-0.30, R + 0.02, 0] }));
  g.add(decal(DECAL.stencil(['AGM-114L'], { size: 26, color: '#c9cbc2' }), 0.24, 0.06, [0.05, R + 0.001, 0], [-PI / 2, 0, 0]));
  return g;
}

/* -------------------------------------------- M299 四联发射梁 + 挂弹 */
function buildHellfireRack() {
  const g = group('m299');
  /* 发射梁主体 */
  g.add(mesh(roundBox(1.12, 0.14, 0.16, 0.02, 3, 4), MATS.gunMetal, { pos: [0.02, -0.05, 0] }));
  g.add(mesh(box(0.30, 0.10, 0.24, 4), MATS.gunMetal, { pos: [0.0, 0.02, 0] }));
  /* 四条导轨 + 四发导弹 */
  const missile = buildHellfire();
  const slots = [[-0.235, 0.215], [-0.235, -0.215], [-0.60, 0.215], [-0.60, -0.215]];
  const missiles = [];
  for (const [dy, dz] of slots) {
    // 导轨
    g.add(mesh(box(1.30, 0.05, 0.055, 4), MATS.gunMetal, { pos: [0.0, dy + 0.10, dz] }));
    g.add(mesh(box(0.10, 0.16, 0.05, 4), MATS.gunMetal, { pos: [0.32, dy + 0.06, dz] }));
    g.add(mesh(box(0.10, 0.16, 0.05, 4), MATS.gunMetal, { pos: [-0.36, dy + 0.06, dz] }));
    const m = missile.clone(true);
    m.position.set(0.02, dy, dz);
    g.add(m);
    missiles.push(m);
  }
  return { g, missiles };
}

/* ------------------------------------------------ M261 19 联装火箭巢 */
function buildRocketPod() {
  const g = group('m261');
  const RO = 0.228, LEN = 1.66;
  /* 外壳 */
  const shell = [];
  for (let i = 0; i <= 26; i++) {
    const t = i / 26, x = -LEN / 2 + t * LEN;
    let r = RO;
    if (t > 0.88) r = RO * (1 - (t - 0.88) / 0.12 * 0.10);
    if (t < 0.06) r = RO * (0.94 + t / 0.06 * 0.06);
    shell.push({ x, ring: ringSuperellipse(r, r, 0, { eTop: 2, eBot: 2, count: 40 }) });
  }
  g.add(mesh(loft(shell, { capStart: false, capEnd: false }), MATS.podOlive, { name: 'pod-shell' }));
  /* 前唇口 + 后底板 */
  g.add(mesh(new THREE.TorusGeometry(RO * 0.94, 0.014, 10, 40), MATS.gunMetal, { pos: [LEN / 2 - 0.005, 0, 0], rot: [0, PI / 2, 0] }));
  g.add(mesh(cyl(RO * 0.99, RO * 0.99, 0.03, 40, false, 4), MATS.matteBlack, { pos: [-LEN / 2 + 0.01, 0, 0], rot: [0, 0, PI / 2] }));
  /* 19 管六角排布 */
  const d = 0.0825, tubes = [];
  for (let q = -2; q <= 2; q++) {
    for (let r2 = -2; r2 <= 2; r2++) {
      if (Math.abs(q + r2) > 2) continue;
      tubes.push([d * (q + r2 / 2), d * (r2 * Math.sqrt(3) / 2)]);
    }
  }
  const tubeGeo = cyl(0.0375, 0.0375, LEN * 0.94, 16, true, 4);
  const inner = MATS.matteBlack.clone(); inner.side = THREE.DoubleSide;
  const tubeMesh = new THREE.InstancedMesh(tubeGeo, inner, tubes.length);
  const mx = new THREE.Matrix4(), q0 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), PI / 2);
  tubes.forEach(([z, y], i) => {
    mx.compose(new THREE.Vector3(-0.02, y, z), q0, new THREE.Vector3(1, 1, 1));
    tubeMesh.setMatrixAt(i, mx);
  });
  tubeMesh.castShadow = tubeMesh.receiveShadow = true;
  g.add(tubeMesh);
  /* 火箭弹头（部分管内可见） */
  const rk = new THREE.InstancedMesh(
    boxUV(new THREE.ConeGeometry(0.034, 0.13, 14), 6), MATS.missileNose, tubes.length);
  const qr = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -PI / 2);
  tubes.forEach(([z, y], i) => {
    mx.compose(new THREE.Vector3(LEN / 2 - 0.12, y, z), qr, new THREE.Vector3(1, 1, 1));
    rk.setMatrixAt(i, mx);
  });
  g.add(rk);
  /* 管间隔板（视觉厚度） */
  g.add(mesh(cyl(RO * 0.965, RO * 0.965, 0.02, 40, false, 4), MATS.gunMetal, { pos: [LEN / 2 - 0.03, 0, 0], rot: [0, 0, PI / 2] }));
  /* 挂梁 + 贴花 */
  g.add(mesh(box(0.46, 0.09, 0.12, 4), MATS.gunMetal, { pos: [0.0, RO + 0.02, 0] }));
  g.add(decal(DECAL.stencil(['M261 · 2.75 IN'], { size: 24 }), 0.34, 0.085, [0.10, 0, RO + 0.001], [0, 0, 0]));
  return g;
}

/* -------------------------------------------------------------- 短翼 */
function buildWings() {
  const g = group('wings');
  const st = [
    { s: 0.62, chord: 1.60, thick: 0.175, twist: 0, dy: 0.00 },
    { s: 1.05, chord: 1.56, thick: 0.165, twist: 0, dy: -0.01 },
    { s: 1.60, chord: 1.50, thick: 0.155, twist: 0, dy: -0.025 },
    { s: 2.15, chord: 1.43, thick: 0.150, twist: -0.5 * DEG, dy: -0.045 },
    { s: 2.50, chord: 1.36, thick: 0.152, twist: -1.0 * DEG, dy: -0.058 },
    { s: 2.62, chord: 1.20, thick: 0.165, twist: -1.2 * DEG, dy: -0.065, dx: 0.06 },
  ];
  const geo = loftAirfoil(resample(st, 3), { n: 34, uvScale: 1, spanAxis: 'z', capRoot: true, capTip: true });
  const WX = 1.42, WY = 1.66;
  for (const s of [1, -1]) {
    const w = mesh(geo, MATS.paint, { name: 'wing' + s, pos: [WX, WY, 0] });
    if (s < 0) w.scale.z = -1;
    g.add(w);
    /* 翼根整流 */
    const fair = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, x = 2.10 - t * 1.85;
      const k = Math.sin(PI * Math.min(1, 0.10 + t * 0.92));
      fair.push({ x, ring: ringSuperellipse(0.12 * k + 0.02, 0.20 * k + 0.03, WY - 0.02, { eTop: 3, eBot: 3, count: 22 }) });
    }
    const fg = mesh(loft(fair, { capStart: true, capEnd: true }), MATS.paint, { pos: [0, 0, s * 0.70] });
    g.add(fg);
    /* 翼尖整流罩 + 航行灯 + 雷达告警天线 */
    g.add(mesh(roundBox(1.30, 0.19, 0.16, 0.03, 3, 3), MATS.paint, { pos: [WX + 0.06, WY - 0.065, s * 2.66] }));
    g.add(mesh(sph(0.055, 16, 6), s > 0 ? MATS.navGreen : MATS.navRed, { pos: [WX + 0.70, WY - 0.055, s * 2.70], shadow: false }));
    g.add(mesh(box(0.10, 0.09, 0.10, 5), MATS.matteBlack, { pos: [WX - 0.60, WY - 0.02, s * 2.70] }));
    g.add(mesh(box(0.16, 0.05, 0.04, 5), MATS.paintDark, { pos: [WX - 0.20, WY + 0.06, s * 2.70] }));

    /* 两个挂架 */
    const pylons = [1.32, 2.24];
    pylons.forEach((pz, pi) => {
      const py = WY - 0.11 - Math.abs(pz - 0.62) * 0.028;
      const p = group('pylon', [], [WX + 0.02, py, s * pz]);
      p.add(mesh(roundBox(0.92, 0.30, 0.20, 0.03, 3, 4), MATS.paintDark, { pos: [0, -0.10, 0] }));
      p.add(mesh(box(0.30, 0.16, 0.24, 4), MATS.paintDark, { pos: [0.0, 0.04, 0] }));
      // 挂钩 + 定向器
      for (const dx of [-0.20, 0.20]) {
        p.add(mesh(box(0.05, 0.12, 0.14, 5), MATS.gunMetal, { pos: [dx, -0.26, 0] }));
        p.add(pipeMesh([dx, -0.20, 0.075], [dx, -0.30, 0.11], 0.012, MATS.steel, 8));
        p.add(pipeMesh([dx, -0.20, -0.075], [dx, -0.30, -0.11], 0.012, MATS.steel, 8));
      }
      // 随动调平连杆
      p.add(pipeMesh([-0.42, -0.02, 0.06], [-0.62, 0.10, 0.06], 0.018, MATS.gunMetal, 8));
      g.add(p);

      const store = group('store', [], [WX + 0.02, py - 0.42, s * pz]);
      if (pi === 0) {
        const { g: rack } = buildHellfireRack();
        rack.position.y = 0.12;
        store.add(rack);
        store.userData.kind = 'hellfire';
      } else {
        const pod = buildRocketPod();
        pod.position.y = -0.05;
        store.add(pod);
        store.userData.kind = 'rocket';
      }
      g.add(store);
    });
  }
  hot([1.4, 1.05, 1.30], 'AGM-114L 长弓地狱火', '毫米波雷达制导 · 8-16 联挂载', 'hellfire');
  hot([1.4, 1.05, 2.30], 'M261 火箭巢', '19 × Hydra-70 通用航空火箭', 'rocket');
  hot([1.9, 1.66, 2.0], '短翼挂架', '4 个随动调平挂点 · 载荷 771kg', 'wing');
  return g;
}

/* -------------------------------------------------------- 起落架 */
function buildGear() {
  const g = group('gear');
  MATS.tire.map.repeat.set(14, 1); MATS.tire.normalMap.repeat.set(14, 1);

  const wheel = (r, w) => {
    const wg = group('wheel');
    const prof = [
      [r * 0.42, -w / 2], [r * 0.62, -w / 2 - 0.004], [r * 0.86, -w / 2 + 0.004],
      [r * 0.985, -w * 0.33], [r, -w * 0.12], [r, w * 0.12], [r * 0.985, w * 0.33],
      [r * 0.86, w / 2 - 0.004], [r * 0.62, w / 2 + 0.004], [r * 0.42, w / 2],
    ];
    const tireG = new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 40);
    wg.add(mesh(tireG, MATS.tire, { rot: [PI / 2, 0, 0], name: 'tire' }));
    wg.add(mesh(cyl(r * 0.44, r * 0.44, w * 0.98, 26, false, 5), MATS.alu, { rot: [PI / 2, 0, 0], name: 'rim' }));
    wg.add(mesh(cyl(r * 0.30, r * 0.30, w * 1.06, 24, false, 5), MATS.steel, { rot: [PI / 2, 0, 0] }));
    for (const s of [-1, 1]) {
      wg.add(mesh(cyl(r * 0.20, r * 0.20, 0.02, 20, false, 6), MATS.gunMetal, { pos: [0, 0, s * w * 0.52], rot: [PI / 2, 0, 0] }));
      wg.add(flangeBolts([0, 0, s * w * 0.53], 'z', r * 0.28, 6, 0.011, 0.012, MATS.steel));
    }
    return wg;
  };

  /* 主起落架（拖曳臂 + 油气减震支柱） */
  for (const s of [1, -1]) {
    const mg = group('main-gear' + s);
    const axle = [2.36, 0.335, s * 1.10];
    const pivot = [3.02, 0.90, s * 0.80];
    const upper = [3.06, 1.62, s * 0.62];
    const knee = [2.52, 0.60, s * 1.02];
    // 机身接头
    mg.add(mesh(box(0.22, 0.24, 0.16, 4), MATS.paint, { pos: [pivot[0] + 0.05, pivot[1] + 0.10, s * 0.72] }));
    // 拖曳臂
    mg.add(pipeMesh(pivot, axle, 0.055, MATS.gunMetal, 14));
    mg.add(mesh(box(0.16, 0.14, 0.10, 4), MATS.gunMetal, { pos: [pivot[0], pivot[1], s * 0.86] }));
    // 减震支柱（外筒 + 活塞）
    mg.add(pipeMesh(upper, [lerp(upper[0], knee[0], 0.55), lerp(upper[1], knee[1], 0.55), lerp(upper[2], knee[2], 0.55)], 0.062, MATS.gunMetal, 14));
    mg.add(pipeMesh([lerp(upper[0], knee[0], 0.45), lerp(upper[1], knee[1], 0.45), lerp(upper[2], knee[2], 0.45)], knee, 0.042, MATS.steel, 12));
    mg.add(mesh(box(0.14, 0.12, 0.12, 4), MATS.gunMetal, { pos: knee }));
    // 斜撑
    mg.add(pipeMesh([3.32, 1.20, s * 0.70], [2.60, 0.52, s * 1.00], 0.028, MATS.gunMetal, 10));
    // 刹车油管
    mg.add(mesh(boxUV(tube([[3.02, 1.30, s * 0.66], [2.86, 0.98, s * 0.80], [2.62, 0.62, s * 0.96], [2.44, 0.42, s * 1.02]], 0.012, { radial: 8 }), 6), MATS.rubber));
    // 轮
    const w = wheel(0.335, 0.205);
    w.position.set(...axle);
    mg.add(w);
    g.add(mg);
  }

  /* 尾轮 */
  const tg = group('tail-gear');
  tg.add(mesh(box(0.20, 0.16, 0.14, 4), MATS.paint, { pos: [-5.52, 1.60, 0] }));
  tg.add(pipeMesh([-5.52, 1.56, 0], [-5.72, 0.46, 0], 0.052, MATS.gunMetal, 14));
  tg.add(pipeMesh([-5.70, 0.60, 0], [-5.78, 0.22, 0], 0.036, MATS.steel, 12));
  tg.add(pipeMesh([-5.40, 1.44, 0], [-5.70, 0.66, 0], 0.024, MATS.gunMetal, 10));
  for (const s of [-1, 1]) tg.add(mesh(box(0.10, 0.30, 0.03, 4), MATS.gunMetal, { pos: [-5.78, 0.34, s * 0.10] }));
  const tw = wheel(0.195, 0.12);
  tw.position.set(-5.79, 0.195, 0);
  tg.add(tw);
  g.add(tg);
  return g;
}

/* -------------------------------------------------------- 细节 & 灯光 */
function buildDetails() {
  const g = group('details');
  const lamps = [];

  /* AN/ALQ-144 红外干扰机（尾梁上"迪斯科灯"） */
  const jam = group('alq-144', [], [-2.62, 2.56, 0]);
  jam.add(mesh(cyl(0.125, 0.135, 0.30, 22, false, 4), MATS.matteBlack));
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * TAU;
    jam.add(mesh(box(0.02, 0.22, 0.05, 5), MATS.gunMetal, { pos: [Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13], rot: [0, -a, 0] }));
  }
  jam.add(mesh(cyl(0.10, 0.13, 0.06, 22, false, 4), MATS.gunMetal, { pos: [0, 0.17, 0] }));
  jam.add(mesh(cyl(0.14, 0.14, 0.04, 22, false, 4), MATS.paintDark, { pos: [0, -0.16, 0] }));
  g.add(jam);

  /* APU 排气 + 空调排气 */
  g.add(mesh(cyl(0.075, 0.075, 0.10, 18, false, 5), MATS.exhaust, { pos: [-1.62, 2.10, -0.50], rot: [PI / 2, 0, 0.2] }));
  g.add(mesh(cyl(0.055, 0.055, 0.08, 16, false, 5), MATS.gunMetal, { pos: [2.30, 1.30, 0.70], rot: [PI / 2, 0, 0] }));

  /* M130 干扰弹投放器 */
  const disp = group('m130', [], [-3.70, 1.63, 0]);
  disp.add(mesh(box(0.52, 0.10, 0.34, 4), MATS.paintDark));
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
    disp.add(mesh(cyl(0.021, 0.021, 0.02, 12, false, 6), MATS.matteBlack, { pos: [-0.20 + i * 0.10, -0.055, -0.10 + j * 0.10] }));
  }
  g.add(disp);

  /* 刀形天线 / 空速管 / 静压孔 / 系留环 */
  const blade = (x, y, z, h, rot = 0, mat = MATS.paintDark) => {
    const m = mesh(box(0.16, h, 0.022, 5), mat, { pos: [x, y, z] });
    m.rotation.y = rot;
    g.add(m);
  };
  blade(-0.30, 0.98, 0.10, 0.24, 0, MATS.paintDark);
  blade(-1.90, 1.42, -0.12, 0.22, 0);
  blade(-4.30, 2.28, 0, 0.26, 0);
  blade(5.20, 1.20, 0.16, 0.18, 0);
  blade(-5.05, 1.58, 0.14, 0.16, 0);
  // UHF 线天线
  g.add(mesh(boxUV(tube([[-3.10, 2.42, 0.05], [-4.60, 2.30, 0.05], [-6.10, 2.42, 0.05], [-6.85, 2.90, 0.05]], 0.006, { radial: 5 }), 6), MATS.matteBlack, { shadow: false }));
  // 雷达告警天线（四角）
  for (const [x, y, z] of [[6.00, 1.78, 0.30], [6.00, 1.78, -0.30], [-6.30, 2.10, 0.22], [-6.30, 2.10, -0.22]]) {
    g.add(mesh(box(0.08, 0.09, 0.07, 5), MATS.matteBlack, { pos: [x, y, z] }));
  }
  // 系留环 / 踏板 / 把手
  for (const [x, z] of [[3.90, 0.62], [3.90, -0.62], [-0.80, 0.55], [-0.80, -0.55]]) {
    g.add(mesh(new THREE.TorusGeometry(0.035, 0.009, 8, 16), MATS.steel, { pos: [x, 1.05, z], rot: [0, 0, PI / 2] }));
  }
  for (const s of [-1, 1]) {
    for (const [x, y] of [[4.02, 1.42], [3.60, 1.72]]) {
      g.add(mesh(box(0.16, 0.03, 0.05, 5), MATS.alu, { pos: [x, y, s * 0.70] }));
    }
    g.add(pipeMesh([4.42, 1.92, s * 0.70], [4.60, 1.92, s * 0.70], 0.014, MATS.alu, 8));
    g.add(pipeMesh([2.96, 2.20, s * 0.70], [3.14, 2.20, s * 0.70], 0.014, MATS.alu, 8));
  }
  /* 编队灯带 */
  for (const s of [-1, 1]) {
    g.add(mesh(box(0.34, 0.035, 0.012, 6), MATS.formation, { pos: [-4.20, 2.12, s * 0.265], shadow: false }));
    g.add(mesh(box(0.30, 0.035, 0.012, 6), MATS.formation, { pos: [1.60, 2.30, s * 0.735], shadow: false }));
  }
  /* 机腹防撞灯 */
  const bellyStrobe = mesh(sph(0.04, 14, 6), MATS.strobe, { pos: [-0.10, 0.96, 0], shadow: false });
  g.add(mesh(latheProfile([[0, 0], [0.05, 0], [0.055, 0.02], [0.04, 0.045], [0, 0.05]], 16, 6), MATS.matteBlack, { pos: [-0.10, 1.02, 0], rot: [PI, 0, 0] }));
  g.add(bellyStrobe);
  lamps.push(bellyStrobe);

  /* 尾梁检修口盖 + 加强条 */
  for (let i = 0; i < 5; i++) {
    const x = -2.4 - i * 0.85;
    g.add(barMesh([x, 1.70, 0.22], [x, 2.16, 0.24], 0.014, 0.012, MATS.paint, 4));
    g.add(barMesh([x, 1.70, -0.22], [x, 2.16, -0.24], 0.014, 0.012, MATS.paint, 4));
  }
  hot([-2.62, 2.78, 0.0], 'AN/ALQ-144 红外干扰机', '尾梁上方 · 抗红外制导导弹', 'jammer');
  return { g, lamps };
}
