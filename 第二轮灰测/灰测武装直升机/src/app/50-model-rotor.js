/* ============================================================================
 *  50 · 旋翼系统：四片主旋翼 / 桨毂总成 / 龙弓雷达 / X 型尾桨 / 传动
 * ==========================================================================*/

const MAST = { x: 1.15, y: 3.30 };        // 主旋翼桨毂中心
const RBLADE = 7.32;                      // 主桨半径
const TAILROT = { x: -7.26, y: 2.94, z: -0.46, r: 1.40 };

/* 前缘包铁（开放放样窄带） */
function ribbonRing(chord, thick, cov, grow, n, twist, dx, dy) {
  const yt = xc => 5 * thick * (0.2969 * Math.sqrt(xc) - 0.126 * xc - 0.3516 * xc * xc + 0.2843 * xc ** 3 - 0.1036 * xc ** 4);
  const raw = [];
  for (let i = n; i >= 0; i--) { const xc = cov * i / n; raw.push([xc * chord - 0.004, yt(xc) * chord * grow]); }
  for (let i = 1; i <= n; i++) { const xc = cov * i / n; raw.push([xc * chord - 0.004, -yt(xc) * chord * grow]); }
  const cos = Math.cos(twist || 0), sin = Math.sin(twist || 0);
  return raw.map(([px, py]) => {
    const xr = px - chord * 0.25;
    let x = xr * cos - py * sin, y = xr * sin + py * cos;
    return [y + (dy || 0), x + (dx || 0)];
  });
}
function loftRibbon(stations, { cov = 0.13, grow = 1.07, n = 12, uvScale = 1 } = {}) {
  const secs = stations.map(st => ({
    x: st.s, ring: ribbonRing(st.chord, st.thick, cov, grow, n, st.twist, st.dx, st.dy),
  }));
  const g = loft(secs, { openRing: true, uvScale });
  g.applyMatrix4(new THREE.Matrix4().makeRotationY(-PI / 2));
  return g;
}

/* ------------------------------------------------------------- 主桨叶 */
function buildMainBlade() {
  const g = group('blade');
  /* 展向站位: [s, 弦长, 厚度比, 扭转, 后掠dx] */
  const st = [
    { s: 0.86, chord: 0.535, thick: 0.155, twist: 4.0 * DEG, dx: 0 },
    { s: 1.20, chord: 0.535, thick: 0.135, twist: 3.4 * DEG, dx: 0 },
    { s: 2.20, chord: 0.535, thick: 0.115, twist: 2.2 * DEG, dx: 0 },
    { s: 3.60, chord: 0.535, thick: 0.105, twist: 0.6 * DEG, dx: 0 },
    { s: 5.20, chord: 0.535, thick: 0.100, twist: -1.4 * DEG, dx: 0 },
    { s: 6.40, chord: 0.535, thick: 0.096, twist: -3.0 * DEG, dx: 0 },
    { s: 6.86, chord: 0.520, thick: 0.094, twist: -3.6 * DEG, dx: 0.075 },
    { s: 7.10, chord: 0.480, thick: 0.092, twist: -4.0 * DEG, dx: 0.180 },
    { s: 7.26, chord: 0.400, thick: 0.096, twist: -4.2 * DEG, dx: 0.285 },
    { s: 7.32, chord: 0.300, thick: 0.110, twist: -4.3 * DEG, dx: 0.345 },
  ];
  const skin = loftAirfoil(resample(st, 3), { n: 38, uvScale: 1, spanAxis: 'z', capRoot: true, capTip: true });
  g.add(mesh(skin, MATS.blade, { name: 'blade-skin' }));
  /* 钛合金前缘包条 */
  g.add(mesh(loftRibbon(resample(st, 3), { cov: 0.135, grow: 1.06, n: 14 }), MATS.titanium, { name: 'blade-le', shadow: false }));
  /* 桨尖高可视色带 */
  const tipSt = st.slice(-3).map(s => ({ ...s }));
  g.add(mesh(loftRibbon(tipSt, { cov: 0.52, grow: 1.035, n: 16 }), MATS.decalOf(DECAL.stripe('#c9b23c'), { rough: 0.45 }), { name: 'blade-tip-mark', shadow: false }));
  /* 后缘调整片 */
  for (const s of [3.05, 4.35, 5.65]) {
    g.add(mesh(box(0.09, 0.012, 0.34, 4), MATS.alu, { pos: [-0.30, 0.004, s], rot: [0, 0, 0.03] }));
  }
  /* 桨根套筒 + 连接夹板 + 变距摇臂 */
  g.add(mesh(cyl(0.105, 0.115, 0.44, 20, false, 4), MATS.alu, { pos: [0.02, 0, 0.68], rot: [PI / 2, 0, 0] }));
  const cuff = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18, s = 0.44 + t * 0.52;
    const w = lerp(0.16, 0.28, t), h = lerp(0.105, 0.085, t);
    cuff.push({ x: s, ring: ringSuperellipse(w, h, 0, { eTop: 3.6, eBot: 3.6, count: 40 }) });
  }
  const cuffG = loft(cuff, { capStart: true, capEnd: false });
  cuffG.applyMatrix4(new THREE.Matrix4().makeRotationY(-PI / 2));   // 展向 x → z
  g.add(mesh(cuffG, MATS.alu, { name: 'blade-cuff' }));
  g.add(mesh(box(0.10, 0.05, 0.14, 4), MATS.gunMetal, { pos: [0.20, -0.02, 0.52] }));    // 变距摇臂
  g.add(mesh(cyl(0.026, 0.026, 0.09, 12, false, 6), MATS.steel, { pos: [0.245, -0.02, 0.52], rot: [PI / 2, 0, 0] }));
  g.add(flangeBolts([0, 0, 0.47], 'z', 0.085, 8, 0.011, 0.012, MATS.steel));
  return g;
}

/* --------------------------------------------------------- 主旋翼总成 */
function buildMainRotor() {
  const root = group('main-rotor', [], [MAST.x, 0, 0]);

  /* 静止部分：桅整流 / 桨盘作动筒 / 不动环 */
  const stat = group('rotor-static');
  stat.add(mesh(latheProfile([[0.30, 2.60], [0.30, 2.68], [0.255, 2.80], [0.215, 2.92], [0.19, 3.00]], 30, 3), MATS.paintDark, { name: 'mast-fairing' }));
  stat.add(mesh(cyl(0.098, 0.098, 0.92, 24, false, 4), MATS.steel, { pos: [0, 3.14, 0], name: 'mast' }));
  // 不动环
  stat.add(mesh(new THREE.TorusGeometry(0.30, 0.045, 14, 44), MATS.gunMetal, { pos: [0, 3.03, 0], rot: [PI / 2, 0, 0], name: 'swash-fixed' }));
  stat.add(mesh(cyl(0.20, 0.22, 0.10, 24, false, 4), MATS.gunMetal, { pos: [0, 3.03, 0] }));
  // 三个液压作动筒
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * TAU + 0.5;
    const p0 = [Math.cos(a) * 0.30, 2.63, Math.sin(a) * 0.30];
    const p1 = [Math.cos(a) * 0.285, 2.99, Math.sin(a) * 0.285];
    stat.add(pipeMesh(p0, p1, 0.038, MATS.gunMetal, 12));
    stat.add(pipeMesh([p0[0], p0[1] + 0.10, p0[2]], p1, 0.024, MATS.steel, 10));
    stat.add(mesh(box(0.10, 0.06, 0.10, 4), MATS.gunMetal, { pos: [p0[0], 2.60, p0[2]] }));
  }
  root.add(stat);

  /* 旋转部分 */
  const spin = group('rotor-spin');
  // 动环
  spin.add(mesh(new THREE.TorusGeometry(0.315, 0.042, 14, 44), MATS.steel, { pos: [0, 3.115, 0], rot: [PI / 2, 0, 0], name: 'swash-rot' }));
  // 剪式驱动
  for (const s of [1, -1]) {
    spin.add(pipeMesh([0.10 * s, 3.24, 0.02 * s], [0.26 * s, 3.14, 0.14 * s], 0.017, MATS.steel, 8));
    spin.add(pipeMesh([0.26 * s, 3.14, 0.14 * s], [0.30 * s, 3.13, 0.05 * s], 0.015, MATS.steel, 8));
  }
  // 桨毂本体
  spin.add(mesh(cyl(0.235, 0.255, 0.30, 32, false, 4), MATS.alu, { pos: [0, MAST.y, 0], name: 'hub' }));
  spin.add(mesh(latheProfile([[0, 0.15], [0.14, 0.14], [0.22, 0.09], [0.245, 0], [0.245, -0.02]], 32, 4), MATS.alu, { pos: [0, MAST.y + 0.15, 0], name: 'hub-cap' }));
  spin.add(flangeBolts([0, MAST.y + 0.155, 0], 'y', 0.175, 12, 0.013, 0.014, MATS.steel));
  spin.add(mesh(cyl(0.26, 0.26, 0.03, 32, false, 4), MATS.gunMetal, { pos: [0, MAST.y - 0.16, 0] }));

  /* 四片桨叶 + 桨毂臂 + 变距拉杆 + 减摆器 */
  const bladeGeoGroup = buildMainBlade();
  const blades = [];
  for (let i = 0; i < 4; i++) {
    const az = i / 4 * TAU;
    const arm = group('blade-arm-' + i);
    arm.rotation.y = az;
    // 桨毂臂
    arm.add(mesh(box(0.30, 0.20, 0.30, 4), MATS.alu, { pos: [0, MAST.y, 0.30] }));
    arm.add(mesh(cyl(0.085, 0.085, 0.20, 16, false, 4), MATS.steel, { pos: [0, MAST.y, 0.42], rot: [PI / 2, 0, 0] }));
    // 弹性轴承
    arm.add(mesh(cyl(0.105, 0.09, 0.10, 18, false, 4), MATS.rubber, { pos: [0, MAST.y, 0.50], rot: [PI / 2, 0, 0] }));
    // 减摆器
    arm.add(pipeMesh([0.16, MAST.y - 0.06, 0.20], [0.10, MAST.y - 0.05, 0.52], 0.026, MATS.gunMetal, 10));
    // 变距拉杆（动环 → 摇臂）
    arm.add(pipeMesh([0.223, 3.125, 0.223], [0.245, MAST.y - 0.02, 0.52], 0.016, MATS.steel, 8));
    // 桨叶（含挥舞/锥度节点）
    const cone = group('cone-' + i, [], [0, MAST.y, 0]);
    const b = bladeGeoGroup.clone(true);
    b.position.set(0, 0, 0);
    cone.add(b);
    arm.add(cone);
    blades.push(cone);
    spin.add(arm);
  }

  /* 旋翼虚化盘 */
  const disc = mesh(new THREE.CircleGeometry(RBLADE * 1.005, 96), MATS.disc, { pos: [0, MAST.y - 0.02, 0], rot: [-PI / 2, 0, 0], shadow: false });
  disc.renderOrder = 5;
  disc.visible = false;
  spin.add(disc);
  root.add(spin);

  /* ---- AN/APG-78 龙弓毫米波雷达（桅顶，不随桨盘旋转） ---- */
  const radar = group('longbow');
  radar.add(mesh(cyl(0.085, 0.085, 0.46, 20, false, 4), MATS.steel, { pos: [0, 3.72, 0] }));
  radar.add(mesh(cyl(0.15, 0.17, 0.10, 24, false, 4), MATS.gunMetal, { pos: [0, 3.95, 0] }));
  radar.add(mesh(cyl(0.235, 0.235, 0.16, 32, false, 4), MATS.paintDark, { pos: [0, 4.06, 0] }));
  // 雷达罩（扁鼓形）
  radar.add(mesh(latheProfile([
    [0, 0], [0.30, 0.005], [0.40, 0.03], [0.44, 0.09], [0.445, 0.22], [0.43, 0.32],
    [0.38, 0.40], [0.28, 0.455], [0.14, 0.485], [0, 0.49],
  ], 40, 2.2), MATS.radome, { pos: [0, 4.14, 0], name: 'radome' }));
  radar.add(mesh(new THREE.TorusGeometry(0.443, 0.014, 10, 40), MATS.matteBlack, { pos: [0, 4.30, 0], rot: [PI / 2, 0, 0] }));
  radar.add(mesh(cyl(0.30, 0.30, 0.012, 32, false, 4), MATS.matteBlack, { pos: [0, 4.146, 0] }));
  root.add(radar);

  hot([MAST.x + 0.1, 4.35, 0.2], 'AN/APG-78 龙弓火控雷达', '桅顶毫米波 · 32km 扫描 / 128 目标', 'radar');
  hot([MAST.x + 0.35, 3.45, 0.45], '全铰接四片桨毂', '弹性轴承 + 液压减摆器 + 变距拉杆', 'hub');
  return { root, spin, blades, disc, radar, stat };
}

/* ------------------------------------------------------------ X 型尾桨 */
function buildTailRotor() {
  const g = group('tail-rotor');
  const { x, y, z, r } = TAILROT;

  /* 尾传动齿轮箱 + 输出轴 */
  g.add(mesh(latheProfile([[0, 0], [0.14, 0.01], [0.16, 0.06], [0.15, 0.14], [0.10, 0.20], [0, 0.21]], 26, 4), MATS.paintDark,
    { pos: [x, y, z + 0.12], rot: [PI / 2, 0, 0] }));
  g.add(mesh(cyl(0.055, 0.055, 0.34, 18, false, 4), MATS.steel, { pos: [x, y, z - 0.02], rot: [PI / 2, 0, 0] }));
  g.add(mesh(box(0.30, 0.46, 0.16, 4), MATS.paint, { pos: [x + 0.06, y - 0.06, z + 0.26] }));

  /* 两组跷跷板桨毂（互成 55°）—— 阿帕奇标志性 X 尾桨 */
  const spin = group('tr-spin', [], [x, y, z]);
  const bladeGeo = (() => {
    const st = [
      { s: 0.16, chord: 0.30, thick: 0.20, twist: 0 },
      { s: 0.30, chord: 0.285, thick: 0.15, twist: 0 },
      { s: 0.60, chord: 0.275, thick: 0.12, twist: 0 },
      { s: 1.05, chord: 0.265, thick: 0.11, twist: 0 },
      { s: 1.30, chord: 0.245, thick: 0.11, twist: 0 },
      { s: 1.40, chord: 0.175, thick: 0.13, twist: 0 },
    ];
    const geo = loftAirfoil(resample(st, 3), { n: 28, uvScale: 1, spanAxis: 'z', capRoot: true, capTip: true });
    geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-PI / 2));   // 展向 z → y
    return geo;
  })();
  const leGeo = (() => {
    const st = [
      { s: 0.30, chord: 0.285, thick: 0.15 }, { s: 0.60, chord: 0.275, thick: 0.12 },
      { s: 1.05, chord: 0.265, thick: 0.11 }, { s: 1.40, chord: 0.175, thick: 0.13 },
    ];
    const geo = loftRibbon(st, { cov: 0.15, grow: 1.06, n: 10 });
    geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-PI / 2));
    return geo;
  })();

  const pairAngles = [0, 55 * DEG];
  for (let p = 0; p < 2; p++) {
    const hub = group('tr-hub-' + p, [], [0, 0, p === 0 ? 0.06 : -0.10]);
    hub.rotation.z = pairAngles[p];
    // 跷跷板毂
    hub.add(mesh(cyl(0.075, 0.075, 0.10, 18, false, 4), MATS.alu, { rot: [PI / 2, 0, 0] }));
    hub.add(mesh(box(0.13, 0.30, 0.09, 4), MATS.alu, {}));
    for (const s of [1, -1]) {
      const b = mesh(bladeGeo, MATS.blade, { name: 'tr-blade' });
      const le = mesh(leGeo, MATS.titanium, { shadow: false });
      const bg = group('tr-blade-g', [b, le]);
      bg.rotation.z = s > 0 ? 0 : PI;
      bg.rotation.y = 0;
      hub.add(bg);
      // 桨根夹板 + 变距拉杆
      hub.add(mesh(box(0.10, 0.16, 0.05, 4), MATS.gunMetal, { pos: [0, s * 0.15, 0] }));
      hub.add(pipeMesh([0.07, s * 0.16, 0.05], [0.07, s * 0.22, 0.05], 0.012, MATS.steel, 8));
    }
    spin.add(hub);
  }
  // 桨毂中心罩
  spin.add(mesh(latheProfile([[0, 0], [0.06, 0.01], [0.075, 0.05], [0.05, 0.09], [0, 0.10]], 20, 5), MATS.alu, { pos: [0, 0, -0.16], rot: [-PI / 2, 0, 0] }));
  g.add(spin);

  hot([x - 0.2, y + 1.2, z - 0.6], 'X 型尾桨', '两组跷跷板桨毂互成 55° · 低噪声', 'tailrotor');
  return { g, spin };
}
