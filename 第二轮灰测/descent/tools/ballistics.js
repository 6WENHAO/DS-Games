/* 离线弹道体检：验证每颗星球的可玩性（峰值热 / 过载 / 落地速度 / 时长） */
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = path.join(__dirname, '..', 'js');
const ctx = { console, Math, Date, JSON, parseFloat, parseInt, isNaN, Number, String, Array, Object };
ctx.window = ctx;
ctx.document = { querySelector: () => null, querySelectorAll: () => [] };
vm.createContext(ctx);
['util.js', 'planets.js', 'physics.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }));
const { u, PLANETS, Phys } = ctx;

function run(p, opt) {
  const st = Phys.mk(p);
  const dt = 0.02;
  let n = 0, burnAlt = null, chuteFail = false;
  while (n < 400000) {
    if (st.chuteState === 0 && opt.chuteAlt && st.alt < opt.chuteAlt) {
      const vMax = 0.85 * Math.sqrt(2 * Phys.M * p.g / (p.rho0 * 1.06)) * 3.2;
      if (st.relSpeed > vMax) { chuteFail = true; st.chuteState = 3; }
      else { st.chuteState = 1; st.chuteT = 0; }
    }
    Phys.step(st, p, dt, { body: opt.body, sx: 0, sz: 0 });
    if (st.hp <= 0 && burnAlt === null) burnAlt = st.alt;
    if (p.objective.type === 'depth' ? st.alt <= 0 : st.alt <= 0) break;
    if (st.alt < -30000) break;
    n++;
  }
  const vEval = Math.abs(st.vy) + 0.4 * Math.hypot(st.vx, st.vz);
  return {
    t: st.time, peakG: st.peakG, peakT: st.peakT, vImp: st.speed, vEval: vEval,
    hp: st.hp, burnAlt: burnAlt, chuteFail: chuteFail, vy: Math.abs(st.vy), vh: Math.hypot(st.vx, st.vz)
  };
}

const pred = {};
for (const p of PLANETS.list) pred[p.id] = Phys.simPath(p);
const strat = [
  { name: 'spread all', body: 1, chuteAlt: 1500 },
  { name: 'neutral', body: 0.4, chuteAlt: 1200 },
  { name: 'tuck, no chute', body: -1, chuteAlt: 0 },
  { name: 'tuck+chute', body: -1, chuteAlt: 1200 },
  { name: 'spread nochute', body: 1, chuteAlt: 0 }
];
for (const p of PLANETS.list) {
  console.log('\n=== ' + p.name + ' (' + p.id + ')  g=' + p.g + ' rho0=' + p.rho0 + ' H=' + p.H +
    ' start=' + (p.startAlt / 1000) + 'km v=' + p.startVel + '  safe<' + p.objective.safe);
  const pr = pred[p.id];
  console.log('  [simPath 参考线] t=' + pr.t.toFixed(0) + 's  peakG=' + pr.peakG.toFixed(1) + '  peakT=' + Math.round(pr.peakT) + 'K  vImpact=' + pr.vImpact.toFixed(1) + '  hp=' + Math.round(pr.hp) + '  needChute=' + pr.needChute + '  vtSpread=' + pr.vtSpread.toFixed(1));
  for (const s of strat) {
    const r = run(p, s);
    console.log('  ' + s.name.padEnd(15) +
      ' t=' + r.t.toFixed(0).padStart(5) + 's  peakG=' + r.peakG.toFixed(1).padStart(5) +
      '  peakT=' + Math.round(r.peakT).toString().padStart(5) + 'K  vy=' + r.vy.toFixed(1).padStart(6) +
      '  vh=' + r.vh.toFixed(1).padStart(5) + '  vEval=' + r.vEval.toFixed(1).padStart(6) +
      '  hp=' + Math.round(r.hp).toString().padStart(3) +
      (r.burnAlt !== null ? '  BURNED@' + Math.round(r.burnAlt / 1000) + 'km' : '') +
      (r.chuteFail ? '  CHUTE-TORN' : ''));
  }
}
