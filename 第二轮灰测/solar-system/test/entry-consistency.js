/* 一致性检验：预测用的“按高度积分”与可视化用的“按时间积分”必须给出同一个物理结局。
 * 若两者的解体/空爆高度或落地速度出现明显差异，屏幕上看到的过程就不再等于报告里的数字。
 * 用法: node test/entry-consistency.js */
const Impact = require('../js/impact.js');

const ATMO = {
  earth: { rho0: 1.225, H: 8.5, top: 120 },
  venus: { rho0: 65, H: 15.9, top: 250 },
  mars: { rho0: 0.020, H: 11.1, top: 90 },
  titan: { rho0: 5.3, H: 21.0, top: 600 },
  jupiter: { rho0: 0.16, H: 27, top: 1200 },
};
const G = { earth: 9.807, venus: 8.87, mars: 3.721, titan: 1.352, jupiter: 24.79 };
const R = { earth: 6371e3, venus: 6051.8e3, mars: 3389.5e3, titan: 2574.7e3, jupiter: 69911e3 };
const MAT = {
  comet: { density: 600, strength: 5e4 },
  carbon: { density: 2200, strength: 4e5 },
  stone: { density: 3000, strength: 1e6 },
  iron: { density: 7800, strength: 4e8 },
};

const CASES = [
  ['earth', 60, 'stone', 15, 45],
  ['earth', 19, 'stone', 19, 18],
  ['earth', 50, 'iron', 12.8, 45],
  ['earth', 1, 'iron', 15, 45],
  ['earth', 12000, 'carbon', 20, 60],
  ['earth', 300, 'stone', 20, 30],
  ['venus', 300, 'stone', 27, 45],
  ['mars', 300, 'stone', 10.2, 45],
  ['titan', 200, 'stone', 10.5, 45],
  ['jupiter', 1500, 'comet', 60, 45],
];

let fail = 0;
console.log('body      L(m)  mat     v(km/s)  ang | 高度积分            | 时间积分            | 判定');
for (const [bid, L, mat, v, ang] of CASES) {
  const m = MAT[mat];
  const a = Impact.entry({
    L, rho: m.density, v0: v * 1000, angle: ang, atmo: ATMO[bid],
    gSurf: G[bid], strength: m.strength,
  });
  const sim = Impact.makeEntry({
    L, rho: m.density, v0: v * 1000, angle: ang, atmo: ATMO[bid],
    gSurf: G[bid], Rbody: R[bid], strength: m.strength, z0: ATMO[bid].top * 1000,
  });
  let guard = 0;
  while (!sim.burst && !sim.burnt && !sim.landed && guard++ < 200000) sim.step(0.05);

  const outA = a.outcome;
  const outB = sim.burst ? 'airburst' : sim.burnt ? 'burnup' : (sim.v < 1500 ? 'fall' : 'ground');
  const zA = outA === 'ground' || outA === 'fall' ? 0 : a.burstAlt;
  const zB = outB === 'ground' || outB === 'fall' ? 0 : sim.burstAlt;
  const dz = Math.abs(zA - zB);
  const relZ = dz / Math.max(1000, Math.max(zA, zB));
  const dv = Math.abs(a.v - sim.v) / Math.max(a.v, sim.v, 1);
  const sameKind = (outA === outB) ||
    (['airburst', 'burnup'].includes(outA) && ['airburst', 'burnup'].includes(outB));
  const ok = sameKind && relZ < 0.25 && (zA > 0 || dv < 0.2);
  if (!ok) fail++;
  console.log(
    bid.padEnd(9) + String(L).padStart(6) + '  ' + mat.padEnd(7) +
    String(v).padStart(7) + String(ang).padStart(5) + ' | ' +
    (outA + ' ' + (zA / 1000).toFixed(1) + 'km v=' + (a.v / 1000).toFixed(2)).padEnd(20) + '| ' +
    (outB + ' ' + (zB / 1000).toFixed(1) + 'km v=' + (sim.v / 1000).toFixed(2)).padEnd(20) + '| ' +
    (ok ? 'PASS' : 'FAIL  Δz=' + (relZ * 100).toFixed(0) + '% Δv=' + (dv * 100).toFixed(0) + '%'));
}
console.log('\n' + (fail ? fail + ' 项不一致' : '全部一致：屏幕上看到的进入过程与报告里的物理量同源'));
process.exit(fail ? 1 : 0);
