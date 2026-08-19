/**
 * timing.js —— 正时齿轮室：惰轮及惰轮轴、喷油泵驱动齿轮、
 *              齿轮室壳体（外形取各齿轮包络的凸包）、齿轮室盖、垫片、螺栓
 *
 * 齿轮系啮合几何（YZ 平面内的轴心坐标，单位 mm）：
 *   曲轴 22T  r=55    (0, 0)
 *   惰轮 33T  r=82.5  (−17.1, −136.5)   与曲轴中心距 137.5 = 55+82.5 ✔
 *   凸轮 44T  r=110   (172, −100)       与惰轮中心距 192.5 = 82.5+110 ✔
 *   泵  18T(m4) r=36  (196, −168)       与凸轮辅助齿轮中心距 72 = 36+36 ✔（1:1）
 */
import * as THREE from 'three';
import * as U from '../core/util.js';

/** Andrew monotone chain 凸包（用于生成齿轮室外形） */
function convexHull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

export function build(world) {
  const { P, mats } = world;
  const T = P.timing;
  const G = world.group('timing');
  const H = world.group('housing');
  const F = world.group('fasteners');

  // ---------------- 惰轮 + 惰轮轴 ----------------
  const idler = new THREE.Group();
  idler.position.set(T.gearPlaneX, T.idlerGear.y, T.idlerGear.z);
  {
    const gg = U.gearGeometry(T.idlerGear.teeth, T.idlerGear.module, T.idlerGear.thk, 54);
    gg.rotateY(-Math.PI / 2);
    const gm = U.mesh(gg, mats.gearSteel);
    idler.add(gm);
    idler.add(U.mesh(U.tubeX(54, 44, T.idlerGear.thk + 2, 24), mats.bushBronze));
    G.add(idler);
    world.reg(gm, 'timing.idlerGear', {
      state: (st) => `惰轮 ${T.idlerGear.teeth} 齿 · ${(st.rpm * T.crankGear.teeth / T.idlerGear.teeth).toFixed(0)} r/min · 传递曲轴→凸轮轴动力并调整旋向`,
    });
  }
  {
    const shaft = U.mesh(U.cylX(44, 74, 24), mats.nitridedSteel,
      [T.gearPlaneX + 10, T.idlerGear.y, T.idlerGear.z]);
    G.add(shaft);
    world.reg(shaft, 'timing.idlerShaft', {
      state: (st) => `惰轮轴 · 内部通压力油润滑衬套（${(st.op.oilPressure * 10).toFixed(1)} bar）`,
    });
  }

  // ---------------- 喷油泵驱动齿轮（18T m4，与凸轮辅助齿轮 1:1）----------------
  const pumpGear = new THREE.Group();
  pumpGear.position.set(T.pumpGear.x, T.pumpGear.y, T.pumpGear.z);
  {
    const gg = U.gearGeometry(T.pumpGear.teeth, T.pumpGear.module, T.pumpGear.thk, 26);
    gg.rotateY(-Math.PI / 2);
    const gm = U.mesh(gg, mats.gearSteel);
    pumpGear.add(gm);
    pumpGear.add(U.mesh(U.cylX(26, 90, 20), mats.nitridedSteel, [26, 0, 0]));   // 驱动轴伸向油泵
    pumpGear.add(U.mesh(U.tubeX(46, 26, 16, 20), mats.alumMachined, [58, 0, 0])); // 联轴节法兰
    G.add(pumpGear);
    world.reg(gm, 'timing.pumpDriveGear', {
      state: (st) => `喷油泵驱动齿轮 · ${(st.rpm / 2).toFixed(0)} r/min（0.5×曲轴）· 供油提前角随负荷微调`,
    });
  }

  // ---------------- 齿轮室壳体（凸包外形）----------------
  const circles = [
    { y: 0, z: 0, r: 76 },
    { y: T.idlerGear.y, z: T.idlerGear.z, r: 103 },
    { y: T.camGear.y, z: T.camGear.z, r: 131 },
    { y: T.pumpGear.y, z: T.pumpGear.z, r: 58 },
  ];
  const samples = [];
  for (const c of circles) {
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      samples.push([c.z + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r]); // (z, y)
    }
  }
  const hull = convexHull(samples);
  const hullInner = hull.map(([z, y]) => {
    // 向内缩进 13mm（相对形心）
    const cz = hull.reduce((s, p) => s + p[0], 0) / hull.length;
    const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
    const dz = z - cz, dy = y - cy, d = Math.hypot(dz, dy);
    return [cz + dz * (d - 13) / d, cy + dy * (d - 13) / d];
  });

  {
    // 壳体（框形，沿 X 挤出）
    const g = U.extrudePoly(hull, T.caseDepth, { holes: [hullInner.slice().reverse()] });
    g.rotateY(-Math.PI / 2);
    const shell = U.mesh(g, mats.castIron, [T.casePlaneX - T.caseDepth / 2, 0, 0]);
    H.add(shell);
    world.reg(shell, 'timing.gearCase', {
      state: () => '正时齿轮室：保证齿轮啮合中心距（公差 ±0.05mm）并封存齿轮润滑油',
    });
  }
  {
    // 齿轮室盖（可拆解）
    const g = U.extrudePoly(hull, 10, { holes: [U.circlePts(27, 28, 0, 0)] });
    g.rotateY(-Math.PI / 2);
    const cover = U.mesh(g, mats.alumCast, [T.coverX, 0, 0]);
    H.add(cover);
    world.reg(cover, 'timing.gearCaseCover', {
      state: () => '齿轮室盖（铝合金）· 内藏曲轴前油封，拆下即可检查齿轮啮合间隙',
      explode: [-320, 0, 0],
    });
    // 垫片
    const gk = U.extrudePoly(hull, 2, { holes: [U.circlePts(30, 24, 0, 0)] });
    gk.rotateY(-Math.PI / 2);
    const gm = U.mesh(gk, mats.gasketPaper, [T.coverX + 6, 0, 0]);
    F.add(gm);
    world.reg(gm, 'seal.timingCoverGasket', { state: () => '齿轮室盖纸垫（涂密封胶装配）' });
    // 螺栓
    const tf = hull.filter((_, i) => i % 2 === 0).map(([z, y]) => {
      const cz = hull.reduce((s, p) => s + p[0], 0) / hull.length;
      const cy = hull.reduce((s, p) => s + p[1], 0) / hull.length;
      const d = Math.hypot(z - cz, y - cy);
      return { pos: [T.coverX - 5, cy + (y - cy) * (d - 8) / d, cz + (z - cz) * (d - 8) / d], rot: [0, 0, Math.PI / 2] };
    });
    const bolts = U.instances(U.hexBolt(13, 8, 8, 26), mats.boltSteel, tf, 'timingCoverBolts');
    F.add(bolts);
    world.reg(bolts, 'fastener.timingCoverBolt', { state: () => `M8×30 · 力矩 24 N·m（${tf.length} 条）` });
  }

  // ---------------- 动画：齿轮旋转（严格按齿数比与旋向）----------------
  world.addUpdater((st) => {
    const th = st.crankAngle * Math.PI / 180;
    idler.rotation.x = -th * (T.crankGear.teeth / T.idlerGear.teeth);
    pumpGear.rotation.x = -th * 0.5;   // 与凸轮辅助齿轮反向、转速 0.5×曲轴
  });
}
