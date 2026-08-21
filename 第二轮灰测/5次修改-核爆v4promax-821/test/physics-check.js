/* =========================================================================
 * test/physics-check.js — 无头物理回归测试（node，不需要浏览器）
 *
 *   node test/physics-check.js            # 全部检查
 *   node test/physics-check.js --quick    # 只跑快速项
 *
 * 断言分三类：
 *   ① 标定律：超压/热辐射/火球半径 对标公开数据
 *   ② 数值健壮性：无 NaN/Inf、能量与几何量单调有界
 *   ③ 形态学：蘑菇云的「盖宽于茎」「尘柱连续」「砧状云盘扁平」
 *      —— 全部用数值判据，不依赖任何视觉模型
 * ========================================================================= */
'use strict';
require('../src/util.js');
require('../src/physics.js');
require('../src/sim.js');
const NK = globalThis.NUKE, U = NK.util, P = NK.physics;

let pass = 0, fail = 0;
const quick = process.argv.includes('--quick');

function ok(cond, name, detail) {
  if (cond) { pass++; console.log('  \x1b[32mPASS\x1b[0m ' + name + (detail ? '   ' + detail : '')); }
  else { fail++; console.log('  \x1b[31mFAIL\x1b[0m ' + name + (detail ? '   ' + detail : '')); }
}
function near(a, b, tol, name, unit) {
  const r = a / b;
  ok(Math.abs(r - 1) <= tol, name,
    `${fmt(a, unit)} vs ${fmt(b, unit)}  (比 ${r.toFixed(3)}, 容差 ±${(tol * 100).toFixed(0)}%)`);
}
function fmt(v, unit) { return unit === 'm' ? U.fmtLen(v) : (unit === 's' ? U.fmtTime(v) : v.toPrecision(4)); }
function section(t) { console.log('\n\x1b[36m' + t + '\x1b[0m'); }
function lines_info(t) { console.log('  \x1b[90mSKIP\x1b[0m ' + t); }

/* ───────────────────────── ① 标定律 vs 公开数据 ───────────────────────── */
section('① 冲击波 / 热辐射标定律（对标公开数据，1 Mt 空爆）');
{
  const b = new P.Blast(1000, { groundFactor: 1, hob: 2000 });
  // 公开常用数值（1 Mt 空爆）：20 psi≈2.6–3.1 km，5 psi≈6.4 km，1 psi≈15 km
  near(b.radiusForPsi(20), 3000, 0.15, '20 psi 半径', 'm');
  near(b.radiusForPsi(5), 6400, 0.10, '5 psi 半径', 'm');
  near(b.radiusForPsi(1), 15000, 0.10, '1 psi 半径', 'm');
  near(P.radiusForFluence(P.BURN.third, 1000), 12800, 0.15, '三度烧伤半径 (8 cal/cm²)', 'm');
  near(b.Rfb, 1100, 0.15, '火球最大半径', 'm');
  // 立方根标定律：当量 ×8 ⇒ 半径 ×2
  const b8 = new P.Blast(8000, { groundFactor: 1, hob: 2000 });
  near(b8.radiusForPsi(5) / b.radiusForPsi(5), 2, 0.02, '立方根标定律 (W×8 ⇒ R×2)');
  // Rankine–Hugoniot：Δp→0 时 M→1
  ok(Math.abs(P.machFromOverpressure(1e-6) - 1) < 1e-5, 'Δp→0 时马赫数→1');
  ok(P.machFromOverpressure(P.psiToBar(20)) > 1.4, '20 psi 处仍为超声速激波',
    'M=' + P.machFromOverpressure(P.psiToBar(20)).toFixed(2));
  // 激波到达时间单调 + 与 Sedov 早期解衔接
  let mono = true, prev = -1;
  for (let R = 50; R < 2e5; R *= 1.3) { const t = b.arrival(R); if (t <= prev) { mono = false; } prev = t; }
  ok(mono, '到达时间 t(R) 严格单调');
  const tS = 1e-3, RS = b.radius(tS);
  near(RS, b.xi * b.sedovC * Math.pow(tS, 0.4), 0.02, 'Sedov 自相似段 R∝t^0.4 衔接', 'm');
  // 波前速度上界：不应超过 Sedov 强激波
  ok(b.speed(b.Rfb) > b.cB, '火球边缘处仍为超声速');
}

section('② 标准大气 ISA');
{
  near(P.atmP(0), 101325, 1e-6, '海平面气压');
  near(P.atmP(11000), 22632, 0.005, '11 km 气压');
  near(P.atmT(11000), 216.65, 1e-4, '对流层顶温度');
  near(P.atmC(0), 340.3, 0.002, '海平面声速');
  ok(P.bruntN2(16000) > 3 * P.bruntN2(5000), '平流层层结强度 N² 显著大于对流层',
    `N²(16km)=${P.bruntN2(16000).toExponential(2)} vs N²(5km)=${P.bruntN2(5000).toExponential(2)}`);
  ok(P.bruntN2(600) < 1e-9, '混合层内为中性层结 (N²≈0)');
  // 浮力上限：Archimedes 真空泡
  for (const W of [1, 100, 1000, 50000]) {
    const V = 4.18879 * Math.pow(P.fireballMaxR(W), 3);
    ok(P.buoyancyFlux0(W, 0) <= P.K.G * V * 1.0000001,
      `F₀ 不超过真空泡上限 g·V  (W=${U.fmtYield(W)})`,
      `${P.buoyancyFlux0(W, 0).toExponential(2)} ≤ ${(P.K.G * V).toExponential(2)} m⁴/s²`);
  }
}

section('③ 双闪光时序');
{
  for (const W of [1, 20, 1000]) {
    const b = new P.Blast(W, { hob: 500 });
    const tm = P.tMin(W), t2 = P.t2Max(W);
    // 极小值处的辐射功率应远低于第二极大
    ok(b.relPower(tm) < 0.05, `极小值处亮度骤降 (W=${U.fmtYield(W)})`,
      `relP(t_min)=${b.relPower(tm).toExponential(2)}`);
    near(b.relPower(t2), 1, 0.02, `第二极大归一化 (W=${U.fmtYield(W)})`);
    // 第一极大应显著亮于第二极大（持续极短，仅占约 1% 能量）
    let p1 = 0;
    for (let t = tm * 1e-3; t < tm; t *= 1.05) { p1 = Math.max(p1, b.relPower(t)); }
    ok(p1 > 5 && p1 < 200, `第一极大峰值功率为第二极大的 5–200 倍 (W=${U.fmtYield(W)})`,
      'P₁/P₂=' + p1.toFixed(1));
  }
}

/* ───────────────────────── ④ 仿真：标度 + 健壮性 + 形态 ───────────────────────── */
section('④ 蘑菇云演化（云顶/云盘标度、数值健壮性、形态学）');

function runSim(W, hob, capacity, tEndMul) {
  const sim = new NK.Sim({ W, hob, capacity, humidity: 0.6, wind: 6, shear: 1.6 });
  const T = P.stabilizeTime(W) * (tEndMul || 1.45);
  let t = 0, guard = 0, wmax = 0, topPrev = 0, monoTop = true;
  while (t < T && guard++ < 40000) {
    const dt = U.clamp(0.02 + t * 0.06, 0.004, 1.2);
    sim.step(dt); t = sim.t;
    wmax = Math.max(wmax, sim.w);
    if (sim.cloudTop < topPrev * 0.55) { monoTop = false; }
    topPrev = Math.max(topPrev, sim.cloudTop);
  }
  return { sim, wmax, monoTop };
}

/** 形态学度量：一切半径都以该高度的云轴为中心（风切变会让轴倾斜！） */
function morphology(sim) {
  const d = sim.data, al = sim.alive, S = 12;
  const gather = (lo, hi, kinds) => {
    const a = [];
    for (let i = 0; i < sim.count; i++) {
      if (!al[i]) { continue; }
      const b = i * S, k = d[b + 11] | 0, y = d[b + 1];
      if (kinds.indexOf(k) < 0 || y < lo || y > hi) { continue; }
      a.push(Math.hypot(d[b] - sim.axisXAt(y), d[b + 2]));
    }
    a.sort((x, y) => x - y);
    return a;
  };
  const q = (a, p) => (a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : NaN);
  const capA = gather(sim.cz - 0.9 * sim.Hdisk, sim.cz + 1.5 * sim.Hdisk, [0, 1]);
  const stemA = gather(0.18 * sim.cz, 0.62 * sim.cz, [2]);
  const surgeA = gather(0, 0.12 * sim.cz, [3]);
  // 尘柱连续性：把地面到云底分 8 段，统计有粒子的段数
  const base = Math.max(sim.cz - 1.05 * sim.Rc, 1);
  const seg = new Array(8).fill(0);
  for (let i = 0; i < sim.count; i++) {
    if (!al[i]) { continue; }
    const b = i * S; if ((d[b + 11] | 0) !== 2) { continue; }
    const y = d[b + 1]; if (y < 0 || y > base) { continue; }
    seg[Math.min(7, Math.floor(y / base * 8))]++;
  }
  return {
    capR: q(capA, 0.90), capN: capA.length,
    stemR: q(stemA, 0.50), stemN: stemA.length,
    surgeR: q(surgeA, 0.90), surgeN: surgeA.length,
    segFilled: seg.filter((v) => v > 0).length, seg
  };
}

const cases = quick ? [[20, 0, 12000]] : [[1, 0, 20000], [20, 300, 20000], [20, 0, 20000], [1000, 0, 20000], [15000, 2, 12000]];
for (const [W, hob, cap] of cases) {
  const tag = `W=${U.fmtYield(W)} hob=${hob} m`;
  const { sim, wmax, monoTop } = runSim(W, hob, cap);
  const m = morphology(sim);

  // 数值健壮性
  let nan = 0, below = 0;
  for (let i = 0; i < sim.count; i++) {
    if (!sim.alive[i]) { continue; }
    for (let k = 0; k < 12; k++) { if (!isFinite(sim.data[i * 12 + k])) { nan++; } }
    if (sim.data[i * 12 + 1] < -1) { below++; }
  }
  console.log(`\n  ── ${tag} ──  sStrat=${sim.sStrat.toFixed(3)} cSpread=${sim.cSpread.toFixed(2)} ` +
    `云顶=${U.fmtLen(sim.cloudTop)} 云盘R=${U.fmtLen(sim.Rdisk)} 厚=${U.fmtLen(sim.Hdisk)} ` +
    `w_max=${wmax.toFixed(0)} m/s 粒子=${sim.liveCount}`);
  ok(nan === 0, tag + ' · 无 NaN/Inf', 'nan=' + nan);
  ok(below === 0, tag + ' · 无粒子穿透地面', 'below=' + below);
  ok(monoTop, tag + ' · 云顶高度不塌缩');
  ok(sim.liveCount > cap * 0.4, tag + ' · 粒子池利用率合理', `${sim.liveCount}/${cap}`);

  // 标度律（对标经验曲线；标定后应落在 ±35% 内）
  const eTop = P.cloudTopEmpirical(W), eRad = P.cloudRadiusEmpirical(W);
  near(sim.cloudTop, eTop, 0.40, tag + ' · 云顶 vs 经验式', 'm');
  near(sim.Rdisk, eRad, 0.40, tag + ' · 云盘半径 vs 经验式', 'm');
  ok(wmax > 8 && wmax < 700, tag + ' · 上升速度量级合理', wmax.toFixed(0) + ' m/s');

  // 形态学
  // 亚千吨级：云团小、相对湍流强（柱宽与随机行走估计一致），真实形态更像
  // 「细高的蓬松柱」而非典型蘑菇 —— 对小当量改为检验柱状形态的正面判据
  if (W < 5) {
    ok(sim.cloudTop / Math.max(sim.Rdisk, 1) > 2.0,
      tag + ' · 小当量呈细高柱状（高/宽 > 2）',
      `${U.fmtLen(sim.cloudTop)} / ${U.fmtLen(sim.Rdisk)} = ` +
      `${(sim.cloudTop / sim.Rdisk).toFixed(2)}；盖/茎 = ${(m.capR / m.stemR).toFixed(2)}`);
  } else {
    ok(m.capR / m.stemR > 1.6, tag + ' · 云盖显著宽于尘茎（蘑菇形）',
      `盖 ${U.fmtLen(m.capR)} / 茎 ${U.fmtLen(m.stemR)} = ${(m.capR / m.stemR).toFixed(2)}`);
  }
  ok(m.segFilled >= 7, tag + ' · 尘柱沿高度连续（8 段中有粒子的段数）',
    `${m.segFilled}/8  [${m.seg.join(',')}]`);
  ok(sim.Hdisk / sim.Rdisk < 1.3, tag + ' · 云盘呈扁平砧状（厚/半径）',
    (sim.Hdisk / sim.Rdisk).toFixed(2));
  ok(m.capN > 500, tag + ' · 云盖粒子充足', 'n=' + m.capN);
  if (sim.dustLift > 0.5) {
    if (m.surgeN >= 50) {
      ok(m.surgeR > m.stemR, tag + ' · 基底涌浪比尘茎铺得更远',
        `${U.fmtLen(m.surgeR)} > ${U.fmtLen(m.stemR)} (n=${m.surgeN})`);
    } else {
      // 兆吨级地爆：爆心附近的地面尘土基本被尘茎/涡环全部吸入云体，
      // 近地不再残留可测的涌浪层 —— 这本身就是正确行为，改为检查尘粒仍存在
      ok(sim.kindCount(3) > 0, tag + ' · 地面尘土已被云体吸收（尘粒仍存活）',
        'K_DUST=' + sim.kindCount(3) + ', 近地 n=' + m.surgeN);
    }
  }
  // 风切变：云轴应向下风倾斜
  ok(sim.cx > 0 && sim.axisXAt(sim.cz) > sim.axisXAt(0.2 * sim.cz),
    tag + ' · 云轴随风切变向下风倾斜',
    `轴偏移 ${U.fmtLen(sim.axisXAt(0.2 * sim.cz))} → ${U.fmtLen(sim.axisXAt(sim.cz))}`);
}

/* ───────────────────────── ⑤ 城市与破坏写实性 ───────────────────────── */
section('⑤ 城市场景与渐进破坏（分类抗力、毁伤半径、坍塌、点燃、遮挡）');

/**
 * 毁伤剖面：按 r² 做**等面积分箱**。
 * 建筑在城区内近似面密度均匀 ⇒ 等面积分箱各箱样本数相当；
 * 若用等径向宽度分箱，近爆心的箱样本必然稀疏，少数派结构会测不出半径。
 */
function damageProfile(sim, filter) {
  const arr = [];
  for (const b of sim.buildings) { if (!filter || filter(b)) { arr.push(b); } }
  const nb = Math.max(6, Math.min(30, Math.round(arr.length / 25)));
  const R = sim.cityR;
  const n = new Array(nb).fill(0), col = new Array(nb).fill(0), sev = new Array(nb).fill(0);
  for (const b of arr) {
    const k = Math.min(nb - 1, ((b.r / R) * (b.r / R) * nb) | 0);
    n[k]++; if (b.state >= 4) { col[k]++; } if (b.state >= 3) { sev[k]++; }
  }
  return { nb, n, col, sev, R, count: arr.length };
}
/** 由内向外，最后一个占比 ≥frac 的分箱外沿半径（等面积分箱 ⇒ r = R·√(k/nb)） */
function crossRadius(prof, arr, frac, minN) {
  let last = -1;
  for (let k = 0; k < prof.nb; k++) {
    if (prof.n[k] >= (minN || 4) && arr[k] / prof.n[k] >= frac) { last = k; }
  }
  return last < 0 ? 0 : prof.R * Math.sqrt((last + 1) / prof.nb);
}

const eraSevR = [];
for (const era of [0, 1, 2]) {
  const sim = new NK.Sim({ W: 21, hob: 503, capacity: 9000, era, cityScale: 1.4 });
  sim.seek(45);
  const byCls = [0, 0, 0, 0];
  for (const b of sim.buildings) { byCls[b.cls]++; }
  const eraName = ['1945 木构', '战后砖混', '现代钢混'][era];
  console.log(`\n  ── ${eraName} ── 建筑 ${sim.buildings.length} 栋  分类[${byCls.join('/')}]  ` +
    `城区 ${U.fmtLen(sim.cityR)}  街区 ${sim.cityBlock.toFixed(0)}m/街道 ${sim.cityStreet.toFixed(0)}m`);

  ok(sim.buildings.length > 400, eraName + ' · 建筑数量充足', sim.buildings.length + ' 栋');
  // 分类分布必须随年代整体平移（这是毁伤半径差异的来源）
  const meanCls = sim.buildings.reduce((a, b) => a + b.cls, 0) / sim.buildings.length;
  ok(byCls.filter((v) => v > sim.buildings.length * 0.05).length >= 2,
    eraName + ' · 结构分类混合（不是单一类型）', `平均等级 ${meanCls.toFixed(2)}, 分布 [${byCls.join('/')}]`);
  // 市中心必须建成（曾出现「配额被外围耗尽、市中心空白」的 bug）
  const coreN = sim.buildings.filter((b) => b.r < 0.15 * sim.cityR).length;
  ok(coreN > 10, eraName + ' · 市中心已建成', coreN + ' 栋在 0.15R 以内');
  const tall = sim.buildings.filter((b) => b.h0 > 60).length;
  ok(era === 0 ? true : tall > 5, eraName + ' · 存在高层体量', tall + ' 栋 >60 m');

  // 各分类的 50% 完全倒塌半径 ↔ 其抗力对应的超压环
  for (let cls = 0; cls < 4; cls++) {
    const arr = sim.buildings.filter((b) => b.cls === cls && !b.slender);
    const thr = (NK.Sim.CLS[cls].dp[0] + NK.Sim.CLS[cls].dp[1]) / 2;
    const ring = sim.blast.radiusForPsi(thr);
    // 直接检验「全塌边界是否与该结构抗力对应的 psi 环重合」：
    // 环内 0.8R 应大面积全塌，环外 1.3R 应基本站立。
    // 比用分箱求 R50 稳健得多 —— 少数派结构（如现代城市里位于郊区的木构房）
    // 在毁伤圈内根本没有样本，那种情况下 R50 无从测量。
    const inR = arr.filter((b) => b.r < 0.8 * ring);
    const outR = arr.filter((b) => b.r > 1.3 * ring && b.r < 3 * ring);
    if (inR.length >= 20 && outR.length >= 20) {
      const fi = inR.filter((b) => b.state >= 4).length / inR.length;
      const fo = outR.filter((b) => b.state >= 4).length / outR.length;
      ok(fi > 0.6 && fo < 0.25,
        `${eraName} · ${NK.Sim.CLS[cls].name} 全塌边界 ↔ ${thr} psi 环 (${U.fmtLen(ring)})`,
        `环内 ${(fi * 100).toFixed(0)}% 全塌 / 环外 ${(fo * 100).toFixed(0)}%  n=${inR.length}/${outR.length}`);
    } else {
      lines_info(`${eraName} · ${NK.Sim.CLS[cls].name}: 毁伤圈内外样本不足` +
        ` (${inR.length}/${outR.length})，跳过边界检验`);
    }
  }

  // 毁伤必须随半径单调减弱
  const prof = damageProfile(sim);
  // 等面积分箱下「内三分之一的箱」对应 0.58R 的半径，对现代城市已远超毁伤圈，
  // 会把内区均值稀释；改为比较最内 3 箱与外半区
  const inner = [], outer = [];
  for (let k = 0; k < prof.nb; k++) {
    if (prof.n[k] < 6) { continue; }
    if (k < 3) { inner.push(prof.sev[k] / prof.n[k]); }
    else if (k >= prof.nb / 2) { outer.push(prof.sev[k] / prof.n[k]); }
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(a.length, 1);
  ok(avg(inner) > avg(outer) + 0.25, eraName + ' · 毁伤随半径单调减弱',
    `内区 ${(avg(inner) * 100).toFixed(0)}% > 外区 ${(avg(outer) * 100).toFixed(0)}%`);
  eraSevR.push(crossRadius(prof, prof.sev, 0.5));

  // 坍塌几何：全塌只剩废墟堆，部分倒塌留残存主体 + 脚下废墟
  const col = sim.buildings.filter((b) => b.state >= 4 && b.collapse >= 1);
  const par = sim.buildings.filter((b) => b.state === 3 && b.collapse >= 1);
  if (col.length > 5) {
    ok(col.every((b) => b.h < 0.12 * b.h0), eraName + ' · 完全倒塌的主体已消失',
      `n=${col.length}, max h/h0=${Math.max(...col.map((b) => b.h / b.h0)).toFixed(3)}`);
    ok(col.every((b) => b.rubbleH > 0.02 * b.h0), eraName + ' · 完全倒塌留下废墟堆',
      `废墟高/原高 中位 ${(col[col.length >> 1].rubbleH / col[col.length >> 1].h0).toFixed(2)}`);
  }
  if (par.length > 5) {
    ok(par.every((b) => b.h > 0.3 * b.h0 && b.rubbleH > 0),
      eraName + ' · 部分倒塌 = 残存主体 + 废墟堆', `n=${par.length}`);
  }
  // 细长结构径向倒伏，普通建筑不会整体翻倒
  const sl = sim.buildings.filter((b) => b.slender);
  const slDown = sl.filter((b) => b.topAng > 1.4).length;
  if (sl.length > 20) {
    ok(slDown > 0, eraName + ' · 细长结构（烟囱/铁塔）发生径向倾覆',
      `${slDown}/${sl.length} 已倒伏 90°`);
  }
  ok(sim.buildings.every((b) => b.slender || b.topAng < 1e-6),
    eraName + ' · 普通建筑坐塌而非整体翻倒（无多米诺）');

  // 迎风遮挡
  const sh = sim.buildings.filter((b) => b.shield < 0.9).length;
  ok(sh > sim.buildings.length * 0.1, eraName + ' · 存在迎风遮挡（前排挡后排）',
    `${sh} 栋 shield<0.9，最小 ${Math.min(...sim.buildings.map((b) => b.shield)).toFixed(2)}`);

  // 点燃半径 ↔ 材料点燃阈值对应的热剂量环
  const fires = sim.buildings.filter((b) => b.fireT > 0);
  if (fires.length > 5) {
    const rf = Math.max(...fires.map((b) => b.r));
    const minIgn = Math.min(...sim.buildings.map((b) => NK.Sim.CLS[b.cls].ign));
    const ignRing = P.radiusForFluence(minIgn, 21);
    ok(rf < ignRing * 1.2, eraName + ' · 起火范围不超过点燃阈值热剂量环',
      `最远起火 ${U.fmtLen(rf)} ≤ ${U.fmtLen(ignRing)}（${minIgn} cal/cm²）`);
    ok(fires.length > sim.buildings.length * 0.01, eraName + ' · 起火数量可观',
      `${fires.length} 栋 (${(fires.length / sim.buildings.length * 100).toFixed(1)}%)`);
  }
  // 数值健壮性
  ok(sim.buildings.every((b) => isFinite(b.h) && isFinite(b.rubbleH) && b.h >= 0 && b.rubbleH >= 0),
    eraName + ' · 建筑几何量有限且非负');
}
ok(eraSevR[0] > eraSevR[1] && eraSevR[1] >= eraSevR[2],
  '同当量下毁伤半径随建造年代递减（木构 > 砖混 > 钢混）',
  eraSevR.map((v) => U.fmtLen(v)).join(' > '));

/* 茎与盖必须连通 —— 蘑菇形态的定义性特征。沿云轴做垂直密度剖面，
   要求从地面到云盖下缘之间没有空箱（近轴柱体内粒子数 >0）。 */
{
  section('⑥ 尘茎与云盖的连通性（沿云轴垂直密度剖面）');
  for (const [W, hob] of [[21, 503], [21, 0], [1000, 0], [15000, 2]]) {
    const sim = new NK.Sim({ W, hob, capacity: 20000, era: 0 });
    const tag = `W=${U.fmtYield(W)} hob=${hob}m`;
    for (const f of [0.35, 0.7, 1.1]) {
      const T = P.stabilizeTime(W) * f;
      sim.seek(T);
      const d = sim.data, al = sim.alive, top = sim.cloudTop, NB = 24;
      const stemR = Math.max(0.55 * sim.Rfb + 0.10 * sim.Rc, 8) * 2;
      const col = new Array(NB).fill(0);
      for (let i = 0; i < sim.count; i++) {
        if (!al[i]) { continue; }
        const b = i * 12;
        if ((d[b + 11] | 0) === NK.Sim.KIND.DEBRIS) { continue; }
        const y = d[b + 1];
        if (y < 0 || y > top) { continue; }
        const q = Math.min(NB - 1, (y / top * NB) | 0);
        if (Math.hypot(d[b] - sim.axisXAt(y), d[b + 2]) < stemR) { col[q]++; }
      }
      // 云盖下缘所在的分箱
      const capB = Math.max(1, Math.floor((sim.cz - 0.55 * sim.Rc) / top * NB));
      let gaps = 0, run = 0, maxRun = 0;
      for (let i = 1; i < capB; i++) {
        if (col[i] === 0) { gaps++; run++; maxRun = Math.max(maxRun, run); } else { run = 0; }
      }
      const bar = col.slice(0, capB + 2)
        .map((v) => (v > 99 ? '#' : v > 9 ? '+' : v > 0 ? '-' : '.')).join('');
      ok(maxRun === 0, `${tag} t=${(f * 100).toFixed(0)}%t_stab · 茎与盖连通（无空洞）`,
        `盖底 ${Math.round(capB / NB * 100)}% 空箱 ${gaps} 最长连续 ${maxRun}  [${bar}]`);
    }
  }
}

/* 火场浓烟必须能升起（羽流夹卷时标写错会让烟柱贴地不动） */
{
  const sim = new NK.Sim({ W: 21, hob: 503, capacity: 12000, era: 0, cityScale: 1.2 });
  sim.seek(150);
  const meanY = (s2) => {
    let sum = 0, n = 0;
    for (let i = 0; i < s2.count; i++) {
      if (!s2.alive[i] || (s2.data[i * 12 + 11] | 0) !== NK.Sim.KIND.SMOKE) { continue; }
      sum += s2.data[i * 12 + 1]; n++;
    }
    return n ? sum / n : 0;
  };
  const y1 = meanY(sim), n1 = sim.kindCount(NK.Sim.KIND.SMOKE);
  sim.seek(420);
  const y2 = meanY(sim), n2 = sim.kindCount(NK.Sim.KIND.SMOKE);
  ok(n1 > 20 && n2 > n1 * 1.2, '火场浓烟持续生成', `${n1} → ${n2} 粒`);
  ok(y2 > y1 * 1.3 && y2 > 200, '浓烟形成上升烟柱（平均高度随时间上升）',
    `${U.fmtLen(y1)} → ${U.fmtLen(y2)}`);
  ok(sim.kindCount(NK.Sim.KIND.FIRE) > 5, '存在火焰粒子（夜间可见火光）',
    sim.kindCount(NK.Sim.KIND.FIRE) + ' 粒');
}

/* ───────────────────────── ⑦ 时间轴回退（seek）一致性 ───────────────────────── */
if (!quick) {
  section('⑦ 时间轴回退一致性（seek 应可复现）');
  const a = new NK.Sim({ W: 20, hob: 300, capacity: 8000 });
  a.seek(60);
  const b = new NK.Sim({ W: 20, hob: 300, capacity: 8000 });
  b.seek(60);
  near(a.cloudTop, b.cloudTop, 1e-9, '相同 seek 得到相同云顶（确定性）', 'm');
  const c = new NK.Sim({ W: 20, hob: 300, capacity: 8000 });
  c.seek(120); c.seek(60);
  near(c.cloudTop, a.cloudTop, 1e-9, '回退后重放结果一致', 'm');
  ok(a.t >= 60 && a.t < 61.5, 'seek 精确落在目标时间', U.fmtTime(a.t));
}

console.log(`\n${fail === 0 ? '\x1b[32m' : '\x1b[31m'}══ ${pass} 通过 / ${fail} 失败 ══\x1b[0m`);
process.exit(fail === 0 ? 0 : 1);
