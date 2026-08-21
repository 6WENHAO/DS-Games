/* 撞击物理引擎的验证脚本：node test/impact-check.js
 * 用真实事件标定：通古斯（空爆）、车里雅宾斯克（高空解体）、
 * 巴林杰（铁陨石成坑）、希克苏鲁伯（K-Pg 灭绝）、SL9（木星伤痕）。 */
const Impact = require('../js/impact.js');

const BODY = {
  earth: {
    id: 'earth', name: '地球', radius: 6371, mass: 5.97237e24, g: 9.807, vesc: 11.186,
    rotHours: 23.9345, atmo: { rho0: 1.225, H: 8.5, top: 120 },
    target: { type: 'rock', density: 2700 },
  },
  venus: {
    id: 'venus', name: '金星', radius: 6051.8, mass: 4.8675e24, g: 8.87, vesc: 10.36,
    rotHours: -5832.6, atmo: { rho0: 65, H: 15.9, top: 250 },
    target: { type: 'rock', density: 2900 },
  },
  moon: {
    id: 'moon', name: '月球', radius: 1737.4, mass: 7.342e22, g: 1.62, vesc: 2.38,
    rotHours: 655.7, atmo: null, target: { type: 'rock', density: 2500 },
  },
  mars: {
    id: 'mars', name: '火星', radius: 3389.5, mass: 6.4171e23, g: 3.721, vesc: 5.027,
    rotHours: 24.62, atmo: { rho0: 0.020, H: 11.1, top: 90 }, target: { type: 'rock', density: 2600 },
  },
  jupiter: {
    id: 'jupiter', name: '木星', radius: 69911, mass: 1.8982e27, g: 24.79, vesc: 59.5,
    rotHours: 9.925, atmo: { rho0: 0.16, H: 27, top: 1200 }, target: { type: 'gas', density: 0.16 },
  },
  europa: {
    id: 'europa', name: '欧罗巴', radius: 1560.8, mass: 4.7998e22, g: 1.314, vesc: 2.025,
    rotHours: 85.2, atmo: null, target: { type: 'ice', density: 917 },
  },
};

// 与 data.js 中 IMPACTORS 保持一致的材质（密度 kg/m³ / 抗压强度 Pa）
const MAT = {
  comet: { density: 600, strength: 5e4 },
  ice: { density: 917, strength: 3e5 },
  carbon: { density: 2200, strength: 4e5 },
  stone: { density: 3000, strength: 1e6 },
  iron: { density: 7800, strength: 4e8 },
};

function sim(body, d, mat, v, angle, extra) {
  const m = MAT[mat];
  return Impact.simulate(Object.assign({
    body, diameter: d, density: m.density, strength: m.strength, velocity: v, angle,
  }, extra || {}));
}

const km = (m) => (m / 1000).toFixed(m < 1e4 ? 3 : 1) + ' km';

function show(title, r) {
  console.log('\n=== ' + title + ' ===');
  console.log('  动能        : ' + r.E0.toExponential(3) + ' J = ' + r.E0mt.toExponential(3) + ' Mt = ' + r.hiroshima.toExponential(2) + ' 颗广岛');
  console.log('  结局        : ' + r.outcome + (r.entry.fragmented ? '（解体高度 ' + km(r.entry.breakupAlt) + '）' : '（未解体）'));
  if (r.outcome === 'airburst' || r.outcome === 'burnup') {
    console.log('  爆发高度    : ' + km(r.entry.burstAlt) + '  剩余动能 ' + (r.entry.energyFraction * 100).toFixed(1) + '%');
    if (r.blast && !r.blast.none) {
      console.log('  倒伏/玻璃   : ' + km(r.blast.r_forest) + ' / ' + km(r.blast.r_glass) + '   20kPa ' + km(r.blast.r_total));
    }
  }
  if (r.outcome === 'fall') console.log('  落地        : ' + r.entry.v.toFixed(0) + ' m/s, 残余质量 ' + (r.entry.m / r.m0 * 100).toFixed(1) + '%');
  if (r.crater) {
    console.log('  落地        : ' + (r.entry.v / 1000).toFixed(2) + ' km/s, 残余质量 ' + (r.entry.m / r.m0 * 100).toFixed(1) + '%, 展宽 ' + r.entry.spreadRatio.toFixed(2) + '×');
    console.log('  瞬时/最终坑 : ' + km(r.crater.Dtc) + ' / ' + km(r.crater.Dfr) + ' [' + r.crater.type + ']  深 ' + km(r.crater.dfr) + ' 坑缘 ' + r.crater.rim.toFixed(0) + ' m');
    console.log('  地震/火球   : M ' + r.seismic.M.toFixed(2) + ' / ' + km(r.thermal.fireballR));
    if (r.blast && !r.blast.none) console.log('  20kPa/玻璃  : ' + km(r.blast.r_total) + ' / ' + km(r.blast.r_glass));
    console.log('  喷出物逃逸  : ' + (r.ejecta.escapeFraction * 100).toFixed(1) + '%   复发周期 ' + r.recurrenceYears.toExponential(2) + ' 年');
    console.log('  自转变化    : ' + (r.spin.rotDeltaSec * 1000).toExponential(2) + ' ms (相对 ' + r.spin.relative.toExponential(2) + ')');
  }
  if (r.gas) console.log('  暗斑/羽流   : ' + r.gas.scarKm.toFixed(0) + ' km / ' + r.gas.plumeHeightKm.toFixed(0) + ' km, 存续 ' + r.gas.lifetimeDays.toFixed(0) + ' 天');
  if (r.tsunami) console.log('  海啸        : 空腔 ' + r.tsunami.cavityKm.toFixed(1) + ' km, 坑缘浪高 ' + r.tsunami.rimWaveM.toFixed(0) + ' m, 1000km 处 ' + r.tsunami.at1000km.toFixed(1) + ' m');
  r.notes.forEach((n) => console.log('  · ' + n));
}

show('通古斯 1908（60 m 石质, 15 km/s, 45°）期望：空爆 5-10 km，倒伏 20-30 km',
  sim(BODY.earth, 60, 'stone', 15, 45));
show('车里雅宾斯克 2013（19 m 石质, 19 km/s, 18°）期望：解体 ~30 km',
  sim(BODY.earth, 19, 'stone', 19, 18));
show('巴林杰（50 m 铁, 12.8 km/s, 45°）期望：落地成坑 ≈1.2 km',
  sim(BODY.earth, 50, 'iron', 12.8, 45));
show('1 m 铁陨石（15 km/s）期望：减速到亚音速的陨落，无坑',
  sim(BODY.earth, 1, 'iron', 15, 45));
show('1 m 石块（15 km/s）期望：高空火流星',
  sim(BODY.earth, 1, 'stone', 15, 45));
show('希克苏鲁伯（12 km 碳质, 20 km/s, 60°）期望：140-180 km 复杂坑, ~4e23 J',
  sim(BODY.earth, 12000, 'carbon', 20, 60));
show('K-Pg 级天体砸进 4 km 深海（ocean）',
  sim(BODY.earth, 12000, 'carbon', 20, 60, { ocean: true }));
show('300 m 石块 → 金星（27 km/s）期望：浓密大气压成空爆',
  sim(BODY.venus, 300, 'stone', 27, 45));
show('300 m 石块 → 月球（18 km/s）期望：无大气，成 6-8 km 坑',
  sim(BODY.moon, 300, 'stone', 18, 45));
show('300 m 石块 → 火星（10.2 km/s）期望：薄大气，坑略小',
  sim(BODY.mars, 300, 'stone', 10.2, 45));
show('300 m 石块 → 欧罗巴冰壳（26 km/s）期望：冰质靶体更大更浅的坑',
  sim(BODY.europa, 300, 'stone', 26, 45));
show('SL9 碎片 → 木星（1.5 km 彗核, 60 km/s）期望：暗斑 ~1 万 km',
  sim(BODY.jupiter, 1500, 'comet', 60, 45));
