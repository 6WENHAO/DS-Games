/* =======================================================================
 *  impact.js  —  撞击物理引擎（纯计算，无渲染依赖，可在 Node 下单测）
 *
 *  两个阶段：
 *   1) 大气进入：沿直线路径对 (v, m, r) 做数值积分（自适应子步），含气动阻力、
 *      烧蔽质量损失、解体判据 (ρ_air·v² > 强度) 与“薄饼模型”碎片云横向膨胀，
 *      给出 烧毁 / 空爆 / 陨落 / 落地成坑 四种结局及剩余质量与速度。
 *   2) 成坑与环境效应：Collins, Melosh & Marcus (2005)《Earth Impact Effects
 *      Program》的 π 标度律：瞬时坑 → 最终坑、坑深、坑缘、熔融体积、地震震级、
 *      火球热辐射、喷出物毯厚度、空气冲击波超压与风速、复发周期。
 *      冲击波按 Sachs 定律换算到各行星真实地表气压。
 *
 *  参考文献：
 *   - Collins G.S., Melosh H.J., Marcus R.A. (2005) Meteoritics & Planet. Sci. 40, 817
 *   - Holsapple K.A. (1993) Annu. Rev. Earth Planet. Sci. 21, 333（π 标度律）
 *   - Chyba, Thomas & Zahnle (1993) Nature 361, 40（薄饼解体模型）
 *   - Ward S.N. & Asphaug E. (2000) Icarus 145, 64（撞击海啸，简化式）
 *   - Melosh H.J. (1989) Impact Cratering: A Geologic Process
 * ======================================================================= */
(function (global) {
  'use strict';

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const J_PER_MT = 4.184e15;      // 1 百万吨 TNT 当量
  const J_PER_KT = 4.184e12;
  const HIROSHIMA = 6.276e13;     // 15 kt
  const P_EARTH = 101325, C_EARTH = 340;

  const Impact = {};

  /* --------------------------- 基本换算 ------------------------------- */
  Impact.massOf = (L, rho) => (Math.PI / 6) * rho * L * L * L;
  Impact.lengthOf = (m, rho) => Math.cbrt((6 * m) / (Math.PI * rho));
  Impact.energyOf = (m, v) => 0.5 * m * v * v;

  /** 由密度估算抗压强度 Pa —— Collins 2005 式 (10) 经验拟合 */
  Impact.strengthOf = (rho) => Math.pow(10, 2.107 + 0.0624 * Math.sqrt(rho));
  /** 烧蔽系数 σ (kg/J)：疏松冰体远高于铁镍 */
  Impact.ablationOf = (rho) => clamp(6e-9 * Math.pow(3000 / rho, 0.75), 8e-10, 3e-8);
  /** 等温大气地表气压 P = ρ0·g·H */
  Impact.surfacePressure = (atmo, g) => (atmo ? atmo.rho0 * g * atmo.H * 1000 : 0);

  /* ==================================================================
   *  阶段一：大气进入
   * ================================================================== */
  Impact.entry = function (opt) {
    const { L, rho, v0, gSurf } = opt;
    const theta = clamp(opt.angle, 2, 90) * Math.PI / 180;
    const sinT = Math.sin(theta);
    const strength = opt.strength || Impact.strengthOf(rho);
    const sigma = opt.sigma !== undefined ? opt.sigma : Impact.ablationOf(rho);
    const Cd = 2.0;
    const atmo = opt.atmo;
    const m0 = Impact.massOf(L, rho);
    const E0 = Impact.energyOf(m0, v0);

    const out = {
      profile: [], outcome: 'ground', burstAlt: 0, breakupAlt: 0, fragmented: false,
      spreadRatio: 1, m: m0, v: v0, L, energy: E0, energyFraction: 1,
      m0, E0, strength, sigma, peakDeposit: 0, peakDepositAlt: 0,
      depositedEnergy: 0, effectiveL: L,
    };

    if (!atmo || !(atmo.rho0 > 1e-9)) {              // 真空世界：原样落地
      out.profile.push({ z: 0, v: v0, m: m0, dEdz: 0, rad: L / 2 });
      return out;
    }

    const zTop = atmo.top * 1000, H = atmo.H * 1000;
    // 气体巨行星没有地面：允许继续往“1 bar 面”以下积分，用压强表示爆发深度
    const zFloor = opt.gasTarget ? -9 * H : 0;
    let z = zTop, v = v0, m = m0, frag = false;
    let rDrag = L / 2;      // 阻力/烧蔽用的本体等效半径（随烧蔽收缩）
    let rCloud = L / 2;     // 碎片云横向半径（只用于判定彻底崩解）
    let lastE = E0;
    const nSteps = 1400;
    const dzBase = zTop / nSteps;
    // 空爆判据：碎片云半径达到 burstSpread × 初始直径时视为彻底崩解。
    // 注意：碎片云的横向膨胀只决定“何时彻底崩解”，减速与烧蔽仍按本体弹道系数
    // 计算（与 Collins 2005 一致）—— 否则会把几百米级天体错误地完全刹停。
    // 该系数用三个实测事件标定过：通古斯 1908（60 m 石质 → 约 6 km 空爆）、
    // 车里雅宾斯克 2013（19 m → 约 30 km 空爆）、巴林杰铁陨石（50 m 铁 → 落地成坑）。
    const burstSpread = 10.0;

    outer:
    while (z > zFloor) {
      const rhoA0 = atmo.rho0 * Math.exp(-z / H);
      const A0 = Math.PI * rDrag * rDrag;
      const dvds0 = (Cd * rhoA0 * A0 * v) / (2 * m);  // |dv/ds|
      const need = Math.abs(dvds0 * dzBase / sinT) / (0.015 * v + 1e-9);
      const sub = clamp(Math.ceil(need), 1, 128);
      const dz = Math.min(dzBase, z - zFloor) / sub;

      for (let k = 0; k < sub; k++) {
        const rhoA = atmo.rho0 * Math.exp(-z / H);
        const A = Math.PI * rDrag * rDrag;
        const ds = dz / sinT;

        if (!frag && rhoA * v * v > strength) {
          frag = true; out.fragmented = true; out.breakupAlt = z;
        }
        if (frag) rCloud += Math.sqrt((3.5 * rhoA) / rho) * ds;

        // dv/ds = -(Cd ρ A v)/(2m) + g·sinθ/v
        v += (-(Cd * rhoA * A * v) / (2 * m) + (gSurf * sinT) / v) * ds;
        // dm/ds = -(σ/2)·Cd·ρ·A·v²
        m += -(sigma / 2) * Cd * rhoA * A * v * v * ds;
        v = Math.max(20, v);
        m = Math.max(1e-9 * m0, m);
        rDrag = Impact.lengthOf(m, rho) / 2;

        const E = Impact.energyOf(m, v);
        const dEdz = (lastE - E) / dz;
        lastE = E;
        out.depositedEnergy = E0 - E;
        if (dEdz > out.peakDeposit) { out.peakDeposit = dEdz; out.peakDepositAlt = z; }

        z -= dz;
        if (frag && rCloud >= burstSpread * L) { out.outcome = 'airburst'; out.burstAlt = z; break outer; }
        if (m <= 2e-3 * m0) { out.outcome = 'burnup'; out.burstAlt = Math.max(z, zFloor); break outer; }
        if (z <= zFloor) { if (zFloor < 0) { out.outcome = 'airburst'; out.burstAlt = z; } break outer; }
      }
      if (out.profile.length < 240) out.profile.push({ z, v, m, dEdz: out.peakDeposit, rad: rCloud });
    }

    out.spreadRatio = (2 * rCloud) / L;
    out.m = m; out.v = v;
    out.L = Impact.lengthOf(m, rho);
    out.energy = Impact.energyOf(m, v);
    out.energyFraction = out.energy / E0;
    // 成坑等效直径按残余质量计（与 Collins 一致）；展宽只用于提示是否形成坑群
    out.effectiveL = out.L;
    if (out.outcome === 'ground') {
      out.burstAlt = 0;
      if (v < 1500) out.outcome = 'fall';            // 减速到亚音速 → 陨石陨落，不成坑
    }
    return out;
  };

  /* ==================================================================
   *  时间步进版进入积分器
   *  与 Impact.entry() 使用完全相同的运动方程，只把自变量由高度换成时间，
   *  供实时可视化使用 —— 于是屏幕上看到的减速、发光、解体高度就是物理结果，
   *  而不是美术动画。
   * ================================================================== */
  Impact.makeEntry = function (opt) {
    const L = opt.L, rho = opt.rho, atmo = opt.atmo;
    const Rb = opt.Rbody;                       // m
    const g0 = opt.gSurf;
    const GM = g0 * Rb * Rb;
    const theta = clamp(opt.angle, 2, 90) * Math.PI / 180;
    const sinT = Math.sin(theta);
    const strength = opt.strength || Impact.strengthOf(rho);
    const sigma = opt.sigma !== undefined ? opt.sigma : Impact.ablationOf(rho);
    const Cd = 2.0;
    const m0 = Impact.massOf(L, rho);
    const H = atmo ? atmo.H * 1000 : 1;
    const zTop = atmo ? atmo.top * 1000 : 0;

    const s = {
      z: opt.z0, v: 0, m: m0, r: L / 2, rCloud: L / 2, frag: false, burst: false, burnt: false,
      landed: false, burstAlt: 0, breakupAlt: 0, lum: 0, peakRate: 1e-9,
      m0, L, rho, strength, sigma, theta, sinT, H, zTop, Rb, GM,
      energy() { return 0.5 * this.m * this.v * this.v; },
    };
    // 由能量守恒回推该高度处的速度（v0 定义为大气顶 / 地表处的撞击速度）
    const rRef = Rb + (atmo ? zTop : 0);
    const rNow = Rb + s.z;
    const v0 = opt.v0;
    s.v = Math.sqrt(Math.max(1, v0 * v0 - 2 * GM * (1 / rRef - 1 / rNow)));

    s.step = function (dt) {
      if (this.burst || this.burnt || this.landed || dt <= 0) return;
      // 自适应子步：单步速度变化不超过 1.5%
      let remain = dt;
      let guard = 0;
      while (remain > 1e-9 && guard++ < 4000) {
        const rhoA = (atmo && this.z < zTop) ? atmo.rho0 * Math.exp(-this.z / H) : 0;
        const A = Math.PI * this.r * this.r;
        const dvdt = (Cd * rhoA * A * this.v * this.v) / (2 * this.m);
        const h = Math.min(remain, dvdt > 1e-9 ? (0.015 * this.v) / dvdt : remain);
        const gz = GM / ((Rb + Math.max(this.z, 0)) * (Rb + Math.max(this.z, 0)));
        const E0s = 0.5 * this.m * this.v * this.v;

        if (!this.frag && rhoA * this.v * this.v > strength) {
          this.frag = true;
          this.breakupAlt = this.z;
        }
        if (this.frag) this.rCloud += Math.sqrt((3.5 * rhoA) / rho) * this.v * h;

        this.v += (-(Cd * rhoA * A * this.v) / (2 * this.m) * this.v + gz * sinT) * h;
        this.m += -(sigma / 2) * Cd * rhoA * A * this.v * this.v * this.v * h;
        this.v = Math.max(20, this.v);
        this.m = Math.max(1e-9 * m0, this.m);
        this.r = Impact.lengthOf(this.m, rho) / 2;
        this.z -= this.v * sinT * h;

        const rate = Math.max(0, (E0s - 0.5 * this.m * this.v * this.v) / Math.max(h, 1e-9));
        if (rate > this.peakRate) this.peakRate = rate;
        this.lum = clamp(rate / this.peakRate, 0, 1) * (rhoA > 0 ? 1 : 0);

        if (this.frag && this.rCloud >= 10.0 * L) { this.burst = true; this.burstAlt = this.z; break; }
        if (this.m <= 2e-3 * m0) { this.burnt = true; this.burstAlt = Math.max(this.z, 0); break; }
        if (this.z <= 0) { this.z = 0; this.landed = true; break; }
        remain -= h;
      }
    };
    return s;
  };

  /* ==================================================================
   *  空气冲击波（Collins 2005 式 54，Sachs 定律换算到各行星地表气压）
   * ================================================================== */
  /** 地球标准大气下的超压 (Pa) */
  function overpressureEarth(r, E, burstAlt) {
    const Ekt = Math.max(1e-12, E / J_PER_KT);
    const rx = 290 * Math.cbrt(Ekt);
    const px = 75000;
    const rg = Math.sqrt(r * r + (burstAlt || 0) * (burstAlt || 0));
    const rr = Math.max(rx * 0.02, rg);
    let p = (px * rx) / (4 * rr) * (1 + 3 * Math.pow(rx / rr, 1.3));
    if (burstAlt > 0) {
      const rm = 550 * Math.cbrt(Ekt);               // 空爆最优反射区
      if (rg < rm) p *= 1 + 0.6 * (1 - rg / rm);
    }
    return p;
  }
  /** 目标行星地表超压：Δp = k·Δp_earth(r·k^(1/3))，k = P/P_earth */
  Impact.overpressure = function (r, E, burstAlt, pressure) {
    const k = (pressure === undefined ? P_EARTH : pressure) / P_EARTH;
    if (k <= 0) return 0;
    const s = Math.cbrt(k);
    return k * overpressureEarth(r * s, E, (burstAlt || 0) * s);
  };
  /** 反解达到指定超压的地面半径 */
  Impact.blastRadius = function (p, E, burstAlt, pressure) {
    const f = (r) => Impact.overpressure(r, E, burstAlt, pressure);
    if (f(1) < p) return 0;
    let lo = 1, hi = 4e7;
    if (f(hi) > p) return hi;
    for (let i = 0; i < 70; i++) {
      const mid = Math.sqrt(lo * hi);
      if (f(mid) > p) lo = mid; else hi = mid;
    }
    return Math.sqrt(lo * hi);
  };
  Impact.windSpeed = function (p, pressure, c) {
    const P = pressure === undefined ? P_EARTH : pressure;
    const cc = c === undefined ? C_EARTH : c;
    if (P <= 0) return 0;
    return ((5 * p) / (7 * P)) * cc / Math.sqrt(1 + (6 * p) / (7 * P));
  };

  Impact.fireballRadius = (E) => 0.002 * Math.cbrt(E);
  Impact.thermalFluence = (r, E, K) => ((K === undefined ? 3e-3 : K) * E) / (2 * Math.PI * r * r);

  function blastPack(E, burstAlt, body) {
    const P = Impact.surfacePressure(body.atmo, body.g);
    if (P < 20) {
      return { none: true, pressure: P, note: '几乎没有大气：不存在空气冲击波，破坏只来自地震波与弹道喷出物。' };
    }
    const f = (p) => Impact.blastRadius(p, E, burstAlt, P);
    const pk = P / P_EARTH;
    return {
      pressure: P, k: pk,
      r_lethal: f(70000 * pk),   // 70 kPa：几乎全毁
      r_total: f(20000 * pk),    // 20 kPa：多层建筑倒塌
      r_forest: f(6900 * pk),    // 6.9 kPa：树木倒伏（通古斯标定）
      r_glass: f(2000 * pk),     // 2 kPa：玻璃破碎
      windTotal: Impact.windSpeed(20000 * pk, P),
      windForest: Impact.windSpeed(6900 * pk, P),
    };
  }

  /** 撞击引起的自转 / 转轴变化（角动量交换） */
  function spinChange(body, m, v, angleDeg) {
    const Rb = body.radius * 1000;
    const th = clamp(angleDeg, 0, 90) * Math.PI / 180;
    const I = 0.33 * body.mass * Rb * Rb;
    const Ltan = m * v * Math.cos(th) * Rb;
    const rotSec = Math.abs(body.rotHours) * 3600;
    const omega = (2 * Math.PI) / rotSec;
    const Lspin = I * omega;
    const dOmega = Ltan / I;
    const newRot = (2 * Math.PI) / (omega + dOmega);
    return {
      ratio: Ltan / Lspin,
      rotDeltaSec: newRot - rotSec,
      relative: -dOmega / omega,
      tiltDeltaDeg: Math.atan2(Ltan, Lspin) * 180 / Math.PI,
      catastrophic: Ltan / Lspin > 0.25,
    };
  }

  /* ==================================================================
   *  主入口
   * ================================================================== */
  Impact.simulate = function (opt) {
    const body = opt.body;
    const L = Math.max(0.01, opt.diameter);
    const rho = opt.density;
    const v0 = Math.max(200, opt.velocity * 1000);
    const angle = clamp(opt.angle, 3, 90);
    const g = body.g;
    const Rb = body.radius * 1000;
    const ocean = !!opt.ocean;
    const targetType = ocean ? 'water' : body.target.type;
    const rhoT = ocean ? 1000 : body.target.density;
    const oceanDepth = opt.oceanDepth || 4000;

    const m0 = Impact.massOf(L, rho);
    const E0 = Impact.energyOf(m0, v0);
    const entry = Impact.entry({
      L, rho, v0, angle, atmo: body.atmo, gSurf: g,
      strength: opt.strength || Impact.strengthOf(rho),
      gasTarget: targetType === 'gas',
    });

    const res = {
      input: { L, rho, v0, angle, targetType, rhoT, bodyId: body.id, ocean },
      m0, E0, E0mt: E0 / J_PER_MT, hiroshima: E0 / HIROSHIMA,
      entry, outcome: entry.outcome, notes: [],
      crater: null, seismic: null, thermal: null, blast: null, ejecta: null,
      tsunami: null, gas: null, spin: null, sun: null,
      globalDust: 0, globalHeat: 0, severity: 0.05,
    };

    /* -------- 气体巨行星：没有地面 -------- */
    if (targetType === 'gas') {
      const E = Math.max(entry.depositedEnergy, E0 * 0.5);
      const scarKm = clamp(12000 * Math.pow(E / 6e21, 0.32), body.radius * 0.004, body.radius * 1.6);
      // 爆发深度：由积分得到的（负）高度换算成压强 P = ρ0·g·H·exp(-z/H)
      const Hm = body.atmo.H * 1000;
      const zb = entry.burstAlt;
      const pBurst = Impact.surfacePressure(body.atmo, g) * Math.exp(-zb / Hm);
      res.outcome = 'gasburst';
      res.gas = {
        burstAlt: zb,
        plumeHeightKm: clamp(3000 * Math.pow(E / 6e21, 0.28), 30, 9000),
        scarKm,
        lifetimeDays: clamp(60 * Math.pow(E / 6e21, 0.25), 1.5, 900),
        depthBar: pBurst / 1e5,
        energy: E,
      };
      res.thermal = { fireballR: Impact.fireballRadius(E), altitude: res.gas.burstAlt };
      res.severity = clamp(Math.log10(Math.max(1, E / 1e17)) / 8, 0.05, 1);
      res.notes.push('气体巨行星没有固体表面：入射体在数百公里深的云层中彻底解体，动能变成一团上冲数千公里的高温羽流。');
      res.notes.push('随后留下的深色伤痕是被抛到高空的有机质与硫化物气溶胶，会被时速上千公里的环流剪切拉长，' + res.gas.lifetimeDays.toFixed(0) + ' 天左右消散。');
      return res;
    }

    /* -------- 恒星：直接汽化 -------- */
    if (targetType === 'plasma') {
      res.outcome = 'vaporized';
      res.severity = 0.4;
      res.sun = { seconds: E0 / 3.828e26, flareKm: clamp(4000 * Math.pow(E0 / 1e24, 0.3), 200, 300000) };
      res.notes.push('在 5772 K 的光球面前，任何天体都会在触及“表面”之前被辐射与潮汐撕成等离子体。');
      res.notes.push('这次撞击释放的能量相当于太阳自身 ' + fmtTime(res.sun.seconds) + ' 的总辐射输出——对太阳来说毫无影响。');
      return res;
    }

    const P_atm = Impact.surfacePressure(body.atmo, g);

    /* -------- 全程烧毁 -------- */
    if (entry.outcome === 'burnup') {
      const Ed = entry.depositedEnergy;
      res.outcome = 'burnup';
      res.severity = clamp(Math.log10(Math.max(1, E0 / 1e10)) / 13, 0.02, 0.3);
      res.thermal = { fireballR: Impact.fireballRadius(Ed * 0.5), altitude: entry.burstAlt };
      res.blast = blastPack(Ed * 0.3, entry.burstAlt, body);
      res.notes.push('全程烧毁：大气在 ' + (entry.burstAlt / 1000).toFixed(1) + ' km 高空就把它磨成了发光的尘埃，地面只会看到一颗极亮的火流星。');
      res.notes.push('这就是每天有上百吨行星际物质落向' + body.name + '、地面却毫无察觉的原因。');
      return res;
    }

    /* -------- 空爆 -------- */
    if (entry.outcome === 'airburst') {
      const Eb = Math.max(entry.energy, entry.depositedEnergy * 0.5);
      res.outcome = 'airburst';
      res.thermal = {
        fireballR: Impact.fireballRadius(Eb), altitude: entry.burstAlt,
        fluenceGround: Impact.thermalFluence(Math.max(100, entry.burstAlt), Eb),
      };
      res.blast = blastPack(Eb, entry.burstAlt, body);
      res.seismic = { M: Math.max(0, 0.67 * Math.log10(Math.max(1, Eb)) - 6.3) };
      res.spin = spinChange(body, entry.m, entry.v, angle);
      res.severity = clamp(Math.log10(Math.max(1, Eb / 1e12)) / 11, 0.05, 0.9);
      // 空爆不挖坑，只有入射体自身被磨碎的粉尘进入平流层
      res.globalDust = body.atmo
        ? Impact.dustOpticalDepth(entry.m0 / rho, rho, Rb, 0.05) : 0;
      res.damagedFraction = Impact.damagedFraction(res, body);
      res.insolation = Impact.insolationFactor(res.globalDust);
      res.notes.push('空爆：碎片云在 ' + (entry.burstAlt / 1000).toFixed(1) + ' km 高度被气动压力彻底压碎，动能在几毫秒内释放成火球，地表不会出现撞击坑。');
      if (!res.blast.none && res.blast.r_forest > 1000) {
        res.notes.push('冲击波以超压环扩散：半径 ' + fmtLen(res.blast.r_forest) + ' 内的树木会被整片压倒——1908 年通古斯正是如此，至今找不到坑。');
      }
      return res;
    }

    /* -------- 减速到亚音速的陨落 -------- */
    if (entry.outcome === 'fall') {
      res.outcome = 'fall';
      res.severity = 0.03;
      res.blast = blastPack(entry.energy, 0, body);
      res.thermal = { fireballR: Impact.fireballRadius(entry.depositedEnergy * 0.3), altitude: entry.burstAlt };
      res.recovered = { mass: entry.m, L: entry.L, v: entry.v };
      res.notes.push('大气把它减速到了 ' + entry.v.toFixed(0) + ' m/s（亚音速自由落体），撞击不再有超高速成坑能力。');
      res.notes.push('结果是一块 ' + fmtMass(entry.m) + '、直径约 ' + fmtLen(entry.L) + ' 的陨石静静躺在地上，只砸出一个浅坑。');
      return res;
    }

    /* ================= 落地成坑 ================= */
    const Li = entry.effectiveL;
    const vi = entry.v;
    const Eg = entry.energy;
    const th = angle * Math.PI / 180;

    // 瞬时坑直径（Collins 2005 式 21，重力主导区）
    const Dtc = 1.161 * Math.pow(rho / rhoT, 1 / 3) * Math.pow(Li, 0.78) *
      Math.pow(vi, 0.44) * Math.pow(g, -0.22) * Math.pow(Math.sin(th), 1 / 3);
    const dtc = Dtc / 2.828;
    // 简单坑 → 复杂坑转换直径（随重力反比缩放；冰质靶体更易塌陷）
    const Dcx = 3200 * (9.807 / g) * (targetType === 'ice' ? 0.55 : 1.0);

    let Dfr, dfr, type;
    if (Dtc * 1.25 < Dcx) {
      Dfr = 1.25 * Dtc;
      dfr = 294 * Math.pow(Dfr / 1000, 0.301);
      type = 'simple';
    } else {
      Dfr = (1.17 * Math.pow(Dtc, 1.13)) / Math.pow(Dcx, 0.13);
      dfr = 400 * Math.pow(Dfr / 1000, 0.3);
      type = Dfr > 0.12 * 2 * Rb ? 'basin' : 'complex';
    }
    const rim = 0.07 * Math.pow(Dtc, 4) / Math.pow(Dfr, 3);
    const meltVol = vi > 12000 ? 8.9e-12 * Eg : 0;
    const meltDepth = Dtc > 0 ? (4 * meltVol) / (Math.PI * Dtc * Dtc) : 0;

    let DfrEff = Dfr, oceanNote = null;
    if (ocean) {
      if (Dtc < 4 * oceanDepth) { DfrEff = 0; oceanNote = 'refilled'; }
      else { DfrEff = Dfr * 0.45; oceanNote = 'partial'; }
    }

    res.crater = {
      Dtc, dtc, Dfr, DfrEff, dfr, rim, type,
      meltVol, meltDepth,
      volume: (Math.PI / 24) * Math.pow(Dtc, 3),
      angRadius: (DfrEff / 2) / Rb,
      craterField: entry.spreadRatio > 3.0,
      centralPeak: type !== 'simple',
      terraces: Dfr > 2.5 * Dcx,
      transientAngRadius: (Dtc / 2) / Rb,
      oceanNote,
    };
    res.seismic = { M: 0.67 * Math.log10(Math.max(1, Eg)) - 5.87 };
    res.thermal = {
      fireballR: Impact.fireballRadius(Eg), altitude: 0,
      fluenceAt: (r) => Impact.thermalFluence(r, Eg),
      // 火球顶端刚好落到地平线以下的距离（球面几何）
      horizonKm: Math.sqrt(Math.max(0, 2 * Rb * Impact.fireballRadius(Eg))) / 1000,
    };
    res.blast = blastPack(Eg, 0, body);

    /* ---- 喷出物：全部由“喷出物毯厚度 ∝ r^-3”这一条定律推出 ----
     * 毯厚 t(r) = Dtc⁴/(112 r³)（Melosh 1989），落点半径大于 r 的总质量
     *   M(>r) = ∫ t ρ 2πr dr ∝ 1/r
     * 于是单个抛出物落点半径的分布为 P(range > r) = r_min/r，
     * 45° 弹道给出发射速度 v = sqrt(g·r)。逃逸质量比例因此是
     *   f_esc = r_min / r_esc,  r_esc = v_esc²/g
     * 这与“月球陨石很罕见”这一观测事实量级一致。 */
    const rMin = Dtc / 2;
    const rEsc = (body.vesc * 1000) * (body.vesc * 1000) / g;
    res.ejecta = {
      thicknessAt: (r) => Math.pow(Dtc, 4) / (112 * Math.pow(Math.max(r, Dtc / 2), 3)),
      radiusKm: (Dtc * 2.5) / 1000,
      rMin, rEsc,
      vMin: Math.sqrt(g * rMin),
      escapeFraction: clamp(rMin / rEsc, 0, 0.9),
      rayReach: body.atmo && P_atm > 5000 ? 3.0 : 10.0,
      massLost: 0,
      // 视觉熔融辉光时长：熔体表面辐射结壳的时标 ρ c d ΔT /(σT⁴)
      glowSeconds: Impact.meltGlowSeconds(meltDepth),
    };
    res.ejecta.massLost = res.ejecta.escapeFraction * res.crater.volume * rhoT;

    if (ocean) {
      const Rc = Dtc / 2;
      const amp = Math.min(oceanDepth, 0.14 * Rc);
      res.tsunami = {
        cavityKm: (2 * Rc) / 1000,
        rimWaveM: amp,
        at1000km: (amp * Rc) / 1e6,
        speedKmh: Math.sqrt(9.807 * oceanDepth) * 3.6,
        runupFactor: 6,
        depth: oceanDepth,
      };
    }

    res.spin = spinChange(body, entry.m, vi, angle);
    res.recurrenceYears = 109 * Math.pow(Math.max(1e-12, Eg / J_PER_MT), 0.78);
    res.severity = clamp(Math.log10(Math.max(1, Eg / 1e12)) / 12, 0.03, 1);
    // 全球尘幕光学厚度（第一性原理推算，见 Impact.dustOpticalDepth）
    res.globalDust = body.atmo ? Impact.dustOpticalDepth(res.crater.volume, rhoT, Rb) : 0;
    res.damagedFraction = Impact.damagedFraction(res, body);
    res.insolation = Impact.insolationFactor(res.globalDust);

    /* -------- 定性解读 -------- */
    if (type === 'basin') res.notes.push('盆地级事件：坑径已经能与' + body.name + '的曲率相比，坑缘隆起成环形山脉，整块地壳被抬升又回落。');
    else if (type === 'complex') res.notes.push('复杂坑：坑底在重力作用下反弹形成中央峰，坑壁塌落成阶地——' + body.name + '上直径超过 ' + fmtLen(Dcx) + ' 的坑都是这种形态。');
    else res.notes.push('简单碗形坑：深径比约 1:5，坑底堆着回落的角砾岩透镜体。');

    if (res.crater.craterField) res.notes.push('入射体在空中已散成一群碎块（横向展宽 ' + entry.spreadRatio.toFixed(1) + ' 倍），落地形成密集坑群而非单个大坑。');
    if (meltVol > res.crater.volume * 0.05) res.notes.push('冲击熔融量巨大：坑底会积起厚约 ' + fmtLen(meltDepth) + ' 的熔岩池，冷却需要上万年。');
    if (res.ejecta.escapeFraction > 0.25) res.notes.push('低重力的代价：约 ' + (res.ejecta.escapeFraction * 100).toFixed(0) + '% 的喷出物直接逃逸到行星际空间，可能在未来落到别的天体上。');
    if (oceanNote === 'refilled') res.notes.push('这是一次深海撞击：瞬时空腔比水深小得多，海水会在几分钟内完全回填，海底几乎不留永久坑——但海啸已经出发。');
    else if (oceanNote === 'partial') res.notes.push('空腔已经击穿整层海水直达洋壳，会留下一个被沉积物半掩埋的海底坑。');
    if (res.globalDust > 0.15) res.notes.push('抛入平流层的细尘光学厚度 τ≈' + res.globalDust.toFixed(2) +
      '，到达地表的阳光只剩 ' + (res.insolation * 100).toFixed(res.insolation < 0.1 ? 2 : 0) +
      '%。尘幕以约 1.5 年的 e 折时标沉降 —— 推进时间就能看到它褪去。');
    if (res.spin.catastrophic) res.notes.push('角动量已可与' + body.name + '自身的自转相比：这种量级的撞击足以改变它的自转周期与转轴指向。');

    return res;
  };

  /**
   * 抛入平流层的细尘造成的全球光学厚度（无量纲）。
   * 由挖掘体积出发：τ = 3·f·V·ρ_t / (4·ρ_p·a·A)
   *   f  = 被抬升到平流层的亚微米级细尘质量比例（取 1e-3）
   *   a  = 尘粒半径 0.5 µm，ρ_p = 2500 kg/m³，A = 星球表面积
   * 标定检验：希克苏鲁伯量级 → τ≈200（数月全球黑暗，与 K-Pg 证据一致）；
   *           1 km 级撞击 → τ≈0.6（全球气候可测，与文献阈值一致）；
   *           皮纳图博火山 2e10 kg 气溶胶 → τ≈0.15。
   */
  Impact.dustOpticalDepth = function (craterVolume, rhoTarget, bodyRadiusM, fineFraction) {
    if (!(craterVolume > 0)) return 0;
    const f = fineFraction === undefined ? 1e-3 : fineFraction;
    const a = 0.5e-6, rhoP = 2500;
    const A = 4 * Math.PI * bodyRadiusM * bodyRadiusM;
    return (3 * f * craterVolume * rhoTarget) / (4 * rhoP * a * A);
  };

  /* ==================================================================
   *  撞击后的行星尺度物理响应（供 world.js 演化使用）
   * ================================================================== */

  /**
   * 熔体表面辐射结壳（可见辉光消失）的时标：
   *   t ≈ ρ·c·d·ΔT / (σ·T⁴)
   * 取 ρ=2500 kg/m³, c=1000 J/(kg·K), ΔT=800 K, T=1500 K。
   * 厚度 d 越大，热容越大 → 亮得越久（内部真正冷却要上万年，那是传导时标）。
   */
  Impact.meltGlowSeconds = function (dMelt) {
    if (!(dMelt > 0)) return 0;
    const rho = 2500, c = 1000, dT = 800, T = 1500, sig = 5.670374e-8;
    const t = (rho * c * Math.min(dMelt, 2000) * dT) / (sig * Math.pow(T, 4));
    return clamp(t, 30, 3.2e7);
  };

  /**
   * 平流层尘埃的光学厚度 → 到达地表的日照比例。
   * 观测标定：皮纳图博 1991 年注入约 2e10 kg 硫酸盐气溶胶，
   * 全球平均光学厚度 ≈0.15，地表日照下降约 2.5%，e 折时标约 1 年。
   * 这里把撞击抛出的细尘按同一比例外推。
   */
  Impact.insolationFactor = function (tau) {
    return Math.exp(-Math.max(0, tau));
  };

  /**
   * 一维能量平衡：日照下降 → 平衡温度下降 → 雪线纬度移动。
   *   T = T0 · f^(1/4)，dT/dφ ≈ 0.55 K/度（地球实测年均温梯度）
   * 返回雪线纬度相对基准的移动量（度，正 = 向赤道推进）。
   */
  Impact.snowLineShift = function (tau, T0, gradPerDeg) {
    const f = Impact.insolationFactor(tau);
    const dT = (T0 || 255) * (Math.pow(f, 0.25) - 1);   // 负值
    return clamp(-dT / (gradPerDeg || 0.55), 0, 90);
  };

  /**
   * 一次撞击直接破坏的球面面积占比：
   * 以热辐射致燃半径（球面几何截断）与 20 kPa 冲击波半径中的较大者为准。
   */
  Impact.damagedFraction = function (res, body) {
    const Rb = body.radius * 1000;
    let r = 0;
    if (res.blast && !res.blast.none) r = Math.max(r, res.blast.r_total);
    if (res.thermal && res.thermal.fireballR) {
      // 点燃木材约需 1e6 J/m²（Collins 2005 表 3）
      const E = res.crater ? res.entry.energy : (res.entry.depositedEnergy || res.E0);
      const rIgnite = Math.sqrt(Math.max(0, (3e-3 * E) / (2 * Math.PI * 1e6)));
      r = Math.max(r, Math.min(rIgnite, Math.PI * Rb));
    }
    // 球冠面积 / 全球面积，考虑地平线遮挡
    const ang = Math.min(Math.PI, r / Rb);
    return clamp((1 - Math.cos(ang)) / 2, 0, 1);
  };

  /* --------------------------- 格式化 -------------------------------- */
  function fmtLen(m) {
    if (!isFinite(m)) return '—';
    if (m < 0.01) return (m * 1000).toFixed(1) + ' mm';
    if (m < 1) return (m * 100).toFixed(1) + ' cm';
    if (m < 1000) return m.toFixed(m < 10 ? 2 : 0) + ' m';
    if (m < 1e6) return (m / 1000).toFixed(m < 1e4 ? 2 : 1) + ' km';
    return (m / 1000).toExponential(2) + ' km';
  }
  function fmtMass(kg) {
    if (kg < 1) return (kg * 1000).toFixed(0) + ' g';
    if (kg < 1000) return kg.toFixed(1) + ' kg';
    if (kg < 1e9) return (kg / 1000).toExponential(2) + ' 吨';
    return (kg / 1e12).toExponential(2) + ' 亿吨';
  }
  function fmtTime(s) {
    if (s < 1e-6) return (s * 1e9).toFixed(1) + ' 纳秒';
    if (s < 1e-3) return (s * 1e6).toFixed(1) + ' 微秒';
    if (s < 1) return (s * 1e3).toFixed(1) + ' 毫秒';
    if (s < 60) return s.toFixed(2) + ' 秒';
    if (s < 3600) return (s / 60).toFixed(1) + ' 分钟';
    if (s < 86400) return (s / 3600).toFixed(1) + ' 小时';
    if (s < 3.156e7) return (s / 86400).toFixed(1) + ' 天';
    return (s / 3.156e7).toExponential(2) + ' 年';
  }
  Impact.fmtLen = fmtLen;
  Impact.fmtMass = fmtMass;
  Impact.fmtTime = fmtTime;
  Impact.J_PER_MT = J_PER_MT;
  Impact.HIROSHIMA = HIROSHIMA;
  Impact.P_EARTH = P_EARTH;

  if (typeof module !== 'undefined' && module.exports) module.exports = Impact;
  if (global) {
    global.SS = global.SS || {};
    global.SS.Impact = Impact;
  }
})(typeof window !== 'undefined' ? window : globalThis);
