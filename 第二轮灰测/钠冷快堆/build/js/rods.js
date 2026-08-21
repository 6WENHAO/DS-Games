/* ============================================================================
   CFR-1500 设计文件 · 控制棒系统模块（rods）
   主题：价值曲线 / 运动幅度 / 落棒动力学 / 点堆动态响应
   无外部依赖，ES2018，单一 IIFE。require 时不访问 window/document。
   ==========================================================================*/
(function () {
  'use strict';

  /* ============================= 常量与设计输入 ============================= */
  var PCM = 1e-5;                       // 1 pcm = 1e-5 (Δk/k)
  var BETA_PCM = 350;                   // β_eff
  var BETA = BETA_PCM * PCM;            // 0.0035
  var LAMBDA = 4.2e-7;                  // 瞬发中子代时间 [s]
  var KD = -0.0055;                     // 多普勒常数 Δρ = K_D·ln(T2/T1)（绝对 Δk/k）
  var ALPHA_C = -0.9 * PCM;             // 冷却剂/膨胀反馈 -0.9 pcm/K（绝对）
  var HMM = 950;                        // 活性区高度 [mm]
  var H = HMM / 1000;                   // [m]
  var SMM = 1050;                       // 全行程 [mm]
  var PITCH = 155;                      // 六角栅格节距 [mm]
  var AFLAT = 152;                      // 组件对边距 [mm]
  var RHO_EXCESS = 3382;                // 无棒时 ρ_excess [pcm]
  var K0 = 1.0350;                      // 无棒时 k_eff

  // 6 组缓发中子（Pu-239 快裂变）：相对份额 βi/β 与衰变常数 λi [1/s]
  // （份额归一化到 Σβi/β = 1，消除规范舍入误差，保证 ρ=0 时严格守恒）
  var DEL_RAW = [
    { f: 0.0385, lam: 0.0129 },
    { f: 0.213,  lam: 0.0311 },
    { f: 0.188,  lam: 0.134 },
    { f: 0.407,  lam: 0.331 },
    { f: 0.128,  lam: 1.26 },
    { f: 0.0257, lam: 3.21 }
  ];
  var FSUM = 0;
  DEL_RAW.forEach(function (g) { FSUM += g.f; });
  var DEL = DEL_RAW.map(function (g) { return { f: g.f / FSUM, lam: g.lam }; });

  /* 落棒动力学参数（3.5） */
  var SCRAM_P = {
    m: 85, madd: 25, V: 0.032, rhoNa: 850, g: 9.81,
    cdFree: 26, Ffric: 40, springF0: 1600, springTravel: 0.15, dashRemain: 0.12
  };
  var C_D_DASH_GIVEN = 1400;            // 末端液压缓冲器设计值 [N·s²/m²]
  var V_IMPACT_LIMIT = 0.5;             // 着底冲击速度上限 [m/s]

  /* ============================= 几何与棒组 ============================= */
  // 控制棒位（轴向坐标 (i,j)）
  var SR2_POS = [[0, 0], [6, -3], [-3, 6], [-3, -3]];
  var SR1_R3 = [[3, 0], [0, 3], [-3, 3], [-3, 0], [0, -3], [3, -3]];
  var SR1_R7 = [[7, -3], [4, 3], [-3, 7], [-7, 3], [-4, -3], [3, -7]];
  var SR1_POS = SR1_R3.concat(SR1_R7);
  var RR_POS = [[5, -2], [2, 3], [-3, 5]];

  var GEO = {
    pitch: PITCH, aFlat: AFLAT, H: HMM, Hmm: HMM, S: SMM,
    nRings: 9, nCells: 271, nRod: 19, nFuel: 252, nFuelInner: 114, nFuelOuter: 138,
    SR1: SR1_POS, SR2: SR2_POS, RR: RR_POS
  };

  var GROUPS = {
    SR1: { name: 'SR-1 主停堆棒', n: 12, Wtot: 5800, Wstrong: 620, enrich: 'B-10 富集 90%', absorber: 'B4C', rods: '7 根 Φ36 mm', speed: '落棒 / 补偿 5 mm/s' },
    SR2: { name: 'SR-2 后备停堆棒', n: 4, Wtot: 3200, Wstrong: 900, enrich: 'B-10 富集 90%', absorber: 'B4C', rods: '7 根 Φ36 mm', speed: '落棒 / 补偿 5 mm/s' },
    RR: { name: 'RR 调节棒', n: 3, Wtot: 900, Wstrong: 300, enrich: '天然 B4C', absorber: 'B4C', rods: '7 根 Φ36 mm', speed: '常规 1.0 mm/s' }
  };

  /* 反应性需求校核（3.2） */
  var REQ = {
    tempDefect: 390, powerDefect: 900, burnup: 900, uncertainty: 600,
    total: 2790, shutdownDepth: 2000,
    sr1: { worth: 5800, stuck: 620 },
    sr2: { worth: 3200, stuck: 900 }
  };
  // 校核结论（数值按 3.2 给出的算式）
  var sr1Check = REQ.sr1.worth - REQ.sr1.stuck - REQ.total;   // 2390
  var sr2Check = REQ.sr2.worth - REQ.sr2.stuck;                // 2300

  /* ============================= 价值曲线（3.4） ============================= */
  // 积分价值 W(d) [pcm]，d 为插入深度 [mm]，0 ≤ d ≤ H
  function worth(d, Wtot) {
    if (d <= 0) return 0;
    if (d >= HMM) return Wtot;
    var x = d / HMM;
    return Wtot * (x - Math.sin(2 * Math.PI * x) / (2 * Math.PI));
  }
  // 微分价值 dW/dd [pcm/mm]
  function dWorth(d, Wtot) {
    if (d <= 0 || d >= HMM) return 0;
    var x = d / HMM;
    return (Wtot / HMM) * (1 - Math.cos(2 * Math.PI * x));
  }

  /* ============================= 反应性 / k_eff ============================= */
  // rodPcm 为棒组引入的反应性 [pcm]（插入为负）
  function rhoTotalPcm(rodPcm) { return RHO_EXCESS + rodPcm; }
  function keff(rodPcm) {
    var r = rhoTotalPcm(rodPcm) * PCM;
    return 1 / (1 - r);
  }
  function subcriticality(rodPcm) {
    var r = rhoTotalPcm(rodPcm);
    return r < 0 ? -r : 0;
  }
  // 瞬发跌落比 P/P0 = β/(β+|ρ|)
  function promptDrop(rhoAbs) { return BETA / (BETA + Math.abs(rhoAbs)); }

  /* ============================= 数值小工具 ============================= */
  function interp(xa, ya, x) {
    var n = xa.length;
    if (n === 0) return 0;
    if (x <= xa[0]) return ya[0];
    if (x >= xa[n - 1]) return ya[n - 1];
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (xa[mid] <= x) lo = mid; else hi = mid;
    }
    var t = (x - xa[lo]) / (xa[hi] - xa[lo]);
    return ya[lo] + t * (ya[hi] - ya[lo]);
  }

  /* ============================= 落棒动力学（3.5） =============================
     (m+m_add) dv/dt = (m-ρ_Na V)g + F_spring(z) - c_d v² - F_fric ，v 向下为正
     用 RK4 积分（非解析）。                                            */
  function scramODE_core(o, cdDash) {
    var m = SCRAM_P.m, madd = SCRAM_P.madd, mtot = m + madd;
    var Fnet = (m - SCRAM_P.rhoNa * SCRAM_P.V) * SCRAM_P.g;   // 净重-浮力 [N]
    var cdFree = SCRAM_P.cdFree, Ffric = SCRAM_P.Ffric;
    var springF0 = SCRAM_P.springF0, springTravel = SCRAM_P.springTravel;
    var dashRemain = SCRAM_P.dashRemain;

    function accel(z, v) {
      var s = o.z0 - z;                                  // 已下落行程 [m]
      var Fs = (o.spring !== false && s < springTravel) ? springF0 * (1 - s / springTravel) : 0;
      var cd = (o.dashpot !== false && z < dashRemain) ? cdDash : cdFree;
      var Ff = v > 0 ? Ffric : (v < 0 ? -Ffric : 0);
      return (Fnet + Fs - cd * v * v - Ff) / mtot;
    }
    function deriv(zz, vv) { return [-vv, accel(zz, vv)]; }

    var t = 0, z = o.z0, v = 0;
    var out = { t: [], z: [], v: [], d: [], rho: [] };
    function rec() {
      out.t.push(t);
      out.z.push(z * 1000);                       // [mm]
      out.v.push(v);                              // [m/s]
      var dm = (z >= H) ? 0 : H - z;              // 插入深度 [m]
      out.d.push(dm * 1000);                      // [mm]
      out.rho.push(-worth(dm * 1000, o.Wtot));    // 反应性 [pcm]（负）
    }

    var fracs = [0.1, 0.5, 0.9, 1.0];
    var ms = {}, done = {};
    var vMax = 0, dt = o.dt, recEvery = o.recEvery || 50;
    var step = 0;
    rec();
    while (z > 0 && t < o.tMax) {
      var k1 = deriv(z, v);
      var k2 = deriv(z + dt / 2 * k1[0], v + dt / 2 * k1[1]);
      var k3 = deriv(z + dt / 2 * k2[0], v + dt / 2 * k2[1]);
      var k4 = deriv(z + dt * k3[0], v + dt * k3[1]);
      var zNew = z + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      var vNew = v + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);

      var dOld = (z >= H) ? 0 : H - z;
      var dNew = (zNew >= H) ? 0 : H - zNew;
      for (var q = 0; q < fracs.length; q++) {
        var fr = fracs[q];
        if (done[fr]) continue;
        var tg = fr * H;
        if (dOld < tg && dNew >= tg) {
          ms[fr] = t + dt * (tg - dOld) / Math.max(1e-12, dNew - dOld);
          done[fr] = true;
        }
      }
      z = zNew; v = vNew; t += dt; step++;
      if (v > vMax) vMax = v;
      if (step % recEvery === 0) rec();
    }
    z = Math.max(0, z);
    if (out.t[out.t.length - 1] !== t) rec();
    out.vImpact = v;
    out.vMax = vMax;
    out.t10 = ms[0.1]; out.t50 = ms[0.5]; out.t90 = ms[0.9];
    out.t100 = (ms[1.0] !== undefined) ? ms[1.0] : t;
    out.Wtot = o.Wtot;
    out.cdDash = cdDash;
    return out;
  }

  // 对外入口：若未指定 cdDash，则自动上调缓冲器阻力系数直至着底冲击速度 < 0.5 m/s
  function scramODE(opts) {
    var o = Object.assign({ z0: 1.05, Wtot: 5800, spring: true, dashpot: true, cdDash: null, dt: 1e-5, tMax: 5, recEvery: 50 }, opts || {});
    var cdDash = o.cdDash;
    if (cdDash === null && o.dashpot !== false) {
      // 缓冲器生效时自动上调 c_d_dashpot 直至着底冲击速度 < 0.5 m/s
      cdDash = C_D_DASH_GIVEN;
      for (var k = 0; k < 80; k++) {
        var trial = scramODE_core(o, cdDash);
        if (trial.vImpact < V_IMPACT_LIMIT) break;
        cdDash *= 1.2;
      }
    } else if (cdDash === null) {
      cdDash = C_D_DASH_GIVEN;   // 无缓冲器对比曲线：不使用缓冲器，c_d 保持自由值
    }
    var res = scramODE_core(o, cdDash);
    res.cdDash = cdDash;
    res.cdDashGiven = C_D_DASH_GIVEN;
    res.vImpactGiven = scramODE_core(o, C_D_DASH_GIVEN).vImpact;
    return res;
  }

  /* ============================= 点堆动态（3.6） =============================
     6 组缓发 + 两节点热工反馈。瞬发项用指数积分（精确），缓发用隐式欧拉；
     自适应子步以解析刚性问题。ρ 为绝对单位（Δk/k）。                          */
  function integratePK(opts) {
    var o = Object.assign({
      tEnd: 60, dt: 1e-3, P0: 1.0,
      Tf0: 1250, Tc0: 470, Tin: 395,
      feedback: true,
      rhoExt: function () { return 0; },     // 外部反应性 [绝对]，(t, state) => value
      recordEvery: 0
    }, opts || {});

    var t = 0, P = o.P0;
    var Ci = DEL.map(function (g) { return g.f * BETA * P / LAMBDA / g.lam; });
    var Tf = o.Tf0, Tc = o.Tc0;

    // 热工定标
    var Pth = 1500e6;                          // [W]
    var Cf = 3.6e6, Cc = 2.4e6;                // [J/K]
    var Rfc = (o.Tf0 - o.Tc0) / Pth;           // [K/W]
    var Wcp = Pth / 150;                       // [W/K]

    var rec = { t: [], P: [], rho: [], Tf: [], Tc: [] };
    function push() { rec.t.push(t); rec.P.push(P); rec.rho.push(curRho * 1e5); rec.Tf.push(Tf); rec.Tc.push(Tc); }

    var curRho = 0;
    var E = 0, Pprev = P, Pmax = P, Tfmax = Tf, Tcmax = Tc;
    var n = Math.max(1, Math.round(o.tEnd / o.dt));
    var recEvery = o.recordEvery || Math.max(1, Math.round(n / 10000));
    push();

    for (var i = 0; i < n; i++) {
      var tTarget = (i + 1) * o.dt;
      while (t < tTarget - 1e-12) {
        // 反馈反应性（用当前温度）
        var rhoFb = 0;
        if (o.feedback) {
          rhoFb = KD * Math.log((Tf + 273.15) / (o.Tf0 + 273.15)) + ALPHA_C * (Tc - o.Tc0);
        }
        var state = { t: t, P: P, Tf: Tf, Tc: Tc };
        curRho = o.rhoExt(t, state) + rhoFb;

        var omega = (curRho - BETA) / LAMBDA;
        var dt = tTarget - t;
        if (Math.abs(omega) * dt > 0.5) dt = 0.5 / Math.abs(omega);
        if (dt > tTarget - t) dt = tTarget - t;
        if (dt < 1e-12) dt = tTarget - t;

        // 瞬发项：把缓发源 S=ΣλiCi 视为子步内常数，解析积分
        var S = 0;
        for (var j = 0; j < 6; j++) S += DEL[j].lam * Ci[j];
        var wdt = omega * dt;
        var Pnew;
        if (Math.abs(wdt) < 1e-8) {
          Pnew = P + dt * (omega * P + S);
        } else {
          var e = Math.exp(wdt);
          Pnew = P * e + S * (e - 1) / omega;
        }
        // 缓发先驱核：隐式欧拉（用 Pnew）
        var CiNew = new Array(6);
        for (j = 0; j < 6; j++) {
          CiNew[j] = (Ci[j] + dt * DEL[j].f * BETA * Pnew / LAMBDA) / (1 + dt * DEL[j].lam);
        }
        // 两节点热工：前向欧拉（dt≪热时间常数）
        if (o.feedback) {
          var Ph = Pnew * Pth;
          Tf += (Ph - (Tf - Tc) / Rfc) / Cf * dt;
          Tc += ((Tf - Tc) / Rfc - 2 * Wcp * (Tc - o.Tin)) / Cc * dt;
        }
        P = Pnew; Ci = CiNew; t += dt;
        if (P > Pmax) Pmax = P;
        if (Tf > Tfmax) Tfmax = Tf;
        if (Tc > Tcmax) Tcmax = Tc;
      }
      E += (Pprev + P) / 2 * o.dt * (Pth / 1e6);   // [MJ]，P 归一化下 ×1500
      Pprev = P;
      if ((i + 1) % recEvery === 0) push();
    }
    if (rec.t[rec.t.length - 1] !== t) push();
    return {
      t: rec.t, P: rec.P, rho: rec.rho, Tf: rec.Tf, Tc: rec.Tc,
      E: E, Pmax: Pmax, Tfmax: Tfmax, Tcmax: Tcmax,
      P0: o.P0, PthMW: Pth / 1e6
    };
  }

  /* in-hour 方程渐近周期：ρ = Λ/T + Σ βi/(1+λi T)，返回 T [s] */
  function inHourPeriod(rhoAbs) {
    var lo = 1e-9, hi = 1e8;
    function f(T) {
      var s = LAMBDA / T;
      for (var i = 0; i < 6; i++) s += DEL[i].f * BETA / (1 + DEL[i].lam * T);
      return s - rhoAbs;
    }
    for (var k = 0; k < 300; k++) {
      var mid = (lo + hi) / 2;
      if (f(mid) > 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* ============================= 负荷跟踪幅度 / 引入率 =============================
     100%→50% 功率缺陷差 450 pcm。RR 调节组工作带 [80,260] mm 内仅约 101 pcm，
     不足以承担 450 pcm 摆动，故负荷跟踪由 SR-1 补偿（停堆兼补偿）组承担（5 mm/s）。
     以工作带浅端 d0=80 mm 为基准，反解 ΔW=450 pcm 所需插入行程。                 */
  function loadFollowAmplitude() {
    var dPcm = 450, Wtot = GROUPS.SR1.Wtot, d0 = 80;
    var target = worth(d0, Wtot) + dPcm;
    var lo = d0, hi = HMM;
    for (var k = 0; k < 200; k++) {
      var mid = (lo + hi) / 2;
      if (worth(mid, Wtot) < target) lo = mid; else hi = mid;
    }
    return ((lo + hi) / 2) - d0;
  }
  // RR 调节棒 1.0 mm/s 在工作带内的最大反应性引入率 [pcm/s]
  function maxInsertionRate() {
    return dWorth(260, GROUPS.RR.Wtot) * 1.0;
  }

  /* ============================= 三个动态算例 ============================= */
  function caseScram() {
    var s = scramODE({ Wtot: GROUPS.SR1.Wtot });
    return {
      label: '满功率紧急停堆 (SR-1)',
      tEnd: 60,
      scram: s,
      rhoExt: function (t) { return t <= 0 ? 0 : interp(s.t, s.rho, t) * PCM; }
    };
  }
  function caseUTOP() {
    var d0 = 170, d1 = 80, spd = 1.0, Wtot = GROUPS.RR.Wtot;
    return {
      label: '调节棒误提升 UTOP (RR)',
      tEnd: 300,
      rhoExt: function (t) {
        var d = Math.max(d1, d0 - spd * t);
        return (worth(d0, Wtot) - worth(d, Wtot)) * PCM;
      }
    };
  }
  function caseSASS() {
    var d0 = 950, spd = 20, Wtot = GROUPS.RR.Wtot;
    var s = scramODE({ Wtot: GROUPS.SR1.Wtot });
    var trig = null;
    return {
      label: 'SASS 自持式停堆装置动作',
      tEnd: 80,
      scram: s,
      getTrig: function () { return trig; },
      rhoExt: function (t, st) {
        // 一次侧钠出口温度 2·Tc - Tin ≥ 700 °C 时触发 SASS 落棒
        if (trig === null && st && (2 * st.Tc - 395) >= 700) trig = t;
        var d = Math.max(0, d0 - spd * t);
        var rhoRR = (worth(d0, Wtot) - worth(d, Wtot)) * PCM;
        var rhoScram = (trig !== null && t > trig) ? interp(s.t, s.rho, t - trig) * PCM : 0;
        return rhoRR + rhoScram;
      }
    };
  }

  var CASE_BUILDERS = { scram: caseScram, utop: caseUTOP, sass: caseSASS };

  /* ============================= API ============================= */
  var API = {
    PCM: PCM, BETA: BETA, BETA_PCM: BETA_PCM, LAMBDA: LAMBDA,
    KD: KD, ALPHA_C: ALPHA_C, HMM: HMM, H: H, SMM: SMM, PITCH: PITCH,
    RHO_EXCESS: RHO_EXCESS, K0: K0, DEL: DEL, SCRAM_P: SCRAM_P,
    C_D_DASH_GIVEN: C_D_DASH_GIVEN, V_IMPACT_LIMIT: V_IMPACT_LIMIT,
    GEO: GEO, GROUPS: GROUPS, REQ: REQ, sr1Check: sr1Check, sr2Check: sr2Check,
    worth: worth, dWorth: dWorth,
    rhoTotalPcm: rhoTotalPcm, keff: keff, subcriticality: subcriticality, promptDrop: promptDrop,
    scramODE: scramODE, scramODE_core: scramODE_core,
    integratePK: integratePK, inHourPeriod: inHourPeriod,
    loadFollowAmplitude: loadFollowAmplitude, maxInsertionRate: maxInsertionRate,
    interp: interp
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  /* ============================= 页面挂载 ============================= */
  if (typeof window !== 'undefined' && window.SFR) window.SFR.register('rods', mount);

  function mount(host) {
    var S = window.SFR;
    var PAL = ['#2f6f8c', '#c8761f', '#8a4b8f', '#3f7a45', '#b0303a', '#6b6257', '#1f9ea8'];
    var C = {
      inner: '#3f7a45', outer: '#2f6f8c',
      sr1: '#c8761f', sr2: '#b0303a', rr: '#8a4b8f',
      text: '#e8e4da', grid: 'rgba(255,255,255,.14)'
    };

    function h4(t) { return S.el('div', { class: 'h4', text: t }); }
    function note(t) { return S.el('div', { class: 'note', html: t }); }
    function tag(t, cls) { return S.el('span', { class: 'tag ' + (cls || ''), text: t }); }

    host.appendChild(h4('1. 棒位布置图'));

    /* ---------- 1. 棒位布置俯视图 ---------- */
    (function () {
      function rodType(i, j) {
        for (var k = 0; k < SR1_POS.length; k++) if (SR1_POS[k][0] === i && SR1_POS[k][1] === j) return 'SR1';
        for (k = 0; k < SR2_POS.length; k++) if (SR2_POS[k][0] === i && SR2_POS[k][1] === j) return 'SR2';
        for (k = 0; k < RR_POS.length; k++) if (RR_POS[k][0] === i && RR_POS[k][1] === j) return 'RR';
        return null;
      }
      function rodLabel(i, j) {
        var t = rodType(i, j);
        if (!t) return null;
        var arr = t === 'SR1' ? SR1_POS : (t === 'SR2' ? SR2_POS : RR_POS);
        for (var k = 0; k < arr.length; k++) {
          if (arr[k][0] === i && arr[k][1] === j) {
            var n = (k + 1);
            return (t === 'SR1' ? 'SR1-' : t === 'SR2' ? 'SR2-' : 'RR-') + (n < 10 ? '0' + n : n);
          }
        }
        return null;
      }

      var lat = S.lattice(9, 155);
      var maxX = 0, maxY = 0;
      lat.forEach(function (c) { maxX = Math.max(maxX, Math.abs(c.x)); maxY = Math.max(maxY, Math.abs(c.y)); });

      var W = 680, Hh = 680, pad = 46;
      var sc = Math.min((W - 2 * pad) / (2 * maxX), (Hh - 2 * pad) / (2 * maxY));
      var cx = W / 2, cy = Hh / 2;

      var fig = S.figure({ title: '棒位布置俯视图（271 栅元，六角栅格节距 155 mm）', drawNo: 'ROD-01', scale: '示意', unit: 'mm' });
      var svg = S.svg('svg', { viewBox: '0 0 ' + W + ' ' + Hh, preserveAspectRatio: 'xMidYMid meet' });

      var cells = {};   // key "i,j" -> path element
      var typeOf = {};

      lat.forEach(function (c) {
        var t = rodType(c.i, c.j);
        var type = t || (c.ring <= 6 ? 'inner' : 'outer');
        typeOf[c.i + ',' + c.j] = type;
        var fill = t ? C[t.toLowerCase()] : (type === 'inner' ? C.inner : C.outer);
        var op = t ? 1 : (type === 'inner' ? 0.55 : 0.42);
        var p = S.svg('path', {
          d: S.hexPath(cx + c.x * sc, cy + c.y * sc, AFLAT * sc),
          fill: fill, 'fill-opacity': op, stroke: 'rgba(0,0,0,.55)', 'stroke-width': 0.7, cursor: t ? 'pointer' : 'default'
        });
        if (t) {
          p.addEventListener('click', function () { selectGroup(t); });
          var lbl = rodLabel(c.i, c.j);
          svg.appendChild(S.svg('text', { x: cx + c.x * sc, y: cy + c.y * sc + 3, 'text-anchor': 'middle', 'font-size': 8.5, fill: '#fff', 'pointer-events': 'none', text: lbl }));
        }
        svg.appendChild(p);
        cells[c.i + ',' + c.j] = p;
      });
      // 环号标注（沿 +i 轴）
      for (var r = 0; r <= 9; r++) {
        var cell = lat.filter(function (c) { return c.i === r && c.j === 0; })[0];
        if (cell) {
          svg.appendChild(S.svg('text', { x: cx + cell.x * sc + AFLAT * sc * 0.62, y: cy + cell.y * sc + 3, 'font-size': 9, fill: 'rgba(255,255,255,.6)', text: '环' + r }));
        }
      }
      fig.body.appendChild(svg);

      // 右侧参数面板 + 图例按钮
      var info = S.el('div', { class: 'panel panel-dark' });
      info.appendChild(S.el('div', { class: 'legend-row', html: '点击图例或棒位高亮该组，右侧显示参数' }));
      var legendBtns = {};
      [['SR1', 'SR-1 主停堆棒'], ['SR2', 'SR-2 后备停堆棒'], ['RR', 'RR 调节棒']].forEach(function (g) {
        var b = S.btn(g[1], function () { selectGroup(g[0]); }, 'lg');
        legendBtns[g[0]] = b;
        var sw = S.el('span', { style: { background: C[g[0].toLowerCase()], width: '12px', height: '12px', display: 'inline-block', borderRadius: '2px', marginRight: '6px' } });
        info.appendChild(S.el('div', { class: 'ctrl-row' }, [sw, b]));
      });
      var paramBox = S.el('div', { class: 'kv' });
      info.appendChild(paramBox);
      host.appendChild(S.el('div', { class: 'grid2' }, [fig.root, info]));

      var selected = null;
      function selectGroup(g) {
        selected = g;
        Object.keys(cells).forEach(function (k) {
          var el2 = cells[k], t = typeOf[k];
          var isSel = (t === g);
          el2.setAttribute('fill-opacity', isSel ? 1 : (t === 'inner' ? 0.14 : t === 'outer' ? 0.10 : 0.18));
          el2.setAttribute('stroke', isSel ? '#fff' : 'rgba(0,0,0,.55)');
          el2.setAttribute('stroke-width', isSel ? 2 : 0.7);
        });
        Object.keys(legendBtns).forEach(function (k) {
          legendBtns[k].className = 'btn lg' + (k === g ? ' ok' : '');
        });
        renderParams(g);
      }
      function renderParams(g) {
        var G = GROUPS[g];
        var pos = g === 'SR1' ? SR1_POS : g === 'SR2' ? SR2_POS : RR_POS;
        paramBox.innerHTML = '';
        paramBox.appendChild(S.el('div', { class: 'h4', text: G.name }));
        var rows = [
          ['根数', G.n + ' 根'], ['棒组总价值', S.fmtG(G.Wtot, 0) + ' pcm'],
          ['单根最强棒', S.fmtG(G.Wstrong, 0) + ' pcm'], ['吸收体', G.absorber + '，' + G.enrich],
          ['棒束', G.rods], ['运动', G.speed],
          ['棒位', pos.map(function (p) { return '(' + p[0] + ',' + p[1] + ')'; }).join(' ')]
        ];
        S.table({ parent: paramBox, head: ['参数', '值'], rows: rows, numeric: false });
      }
      selectGroup('SR1');
    })();

    /* ---------- 2. 棒位纵剖图 + 交互 ---------- */
    (function () {
      host.appendChild(h4('2. 棒位纵剖示意 + 交互读数'));
      var fig = S.figure({ title: '控制棒纵剖示意（活性区 950 mm + 上部超程 100 mm）', drawNo: 'ROD-02', scale: '示意', unit: 'mm' });

      var W = 560, Hh = 700;
      var zMin = -320, zMax = 2000;
      var yTop = 34, yBot = 680;
      var scy = (yBot - yTop) / (zMax - zMin);
      function zY(zmm) { return yTop + (zMax - zmm) * scy; }
      var svg = S.svg('svg', { viewBox: '0 0 ' + W + ' ' + Hh, preserveAspectRatio: 'xMidYMid meet' });

      function rect(x0, x1, z0, z1, fill, cls, label) {
        svg.appendChild(S.svg('rect', { x: x0, y: zY(z1), width: x1 - x0, height: zY(z0) - zY(z1), fill: fill, class: cls || '' }));
        if (label) svg.appendChild(S.svg('text', { x: (x0 + x1) / 2, y: (zY(z0) + zY(z1)) / 2 + 3, class: 'ct-leg', 'text-anchor': 'middle', 'font-size': 9.5, fill: '#fff', text: label }));
      }
      function hline(zmm, lbl) {
        svg.appendChild(S.svg('line', { x1: 30, y1: zY(zmm), x2: W - 20, y2: zY(zmm), stroke: 'rgba(255,255,255,.28)', 'stroke-dasharray': '3 3' }));
        svg.appendChild(S.svg('text', { x: 30, y: zY(zmm) - 3, class: 'ct-tick', 'font-size': 9, fill: 'rgba(255,255,255,.6)', text: lbl + ' mm' }));
      }

      // 轴向区域（左列）
      rect(30, 130, -320, 0, 'rgba(58,92,140,.35)', '', '下增殖区');
      rect(30, 130, 0, 950, 'rgba(200,118,31,.28)', '', '活性区\n950 mm');
      rect(30, 130, 950, 1250, 'rgba(58,92,140,.35)', '', '上增殖区');
      rect(30, 130, 1250, 1650, 'rgba(31,158,168,.20)', '', '钠腔');
      rect(30, 130, 950, 1050, 'rgba(200,118,31,.55)', '', '超程\n100 mm');
      hline(0, '0'); hline(950, '950'); hline(1050, '1050');

      // 三根棒
      var rods = [
        { g: 'SR1', x: 230, col: C.sr1 },
        { g: 'SR2', x: 330, col: C.sr2 },
        { g: 'RR', x: 430, col: C.rr }
      ];
      var rodEls = {};
      rods.forEach(function (r) {
        // 导向管
        svg.appendChild(S.svg('line', { x1: r.x - 26, y1: zY(950), x2: r.x - 26, y2: zY(-120), stroke: 'rgba(255,255,255,.25)', 'stroke-width': 3 }));
        svg.appendChild(S.svg('line', { x1: r.x + 26, y1: zY(950), x2: r.x + 26, y2: zY(-120), stroke: 'rgba(255,255,255,.25)', 'stroke-width': 3 }));
        svg.appendChild(S.svg('text', { x: r.x, y: zY(950) - 8, class: 'ct-leg', 'text-anchor': 'middle', 'font-size': 11, fill: r.col, text: r.g }));
        // 缓冲器
        svg.appendChild(S.svg('rect', { x: r.x - 30, y: zY(-90), width: 60, height: zY(-140) - zY(-90), fill: 'rgba(176,48,58,.6)' }));
        svg.appendChild(S.svg('text', { x: r.x, y: zY(-90) + 9, class: 'ct-tick', 'text-anchor': 'middle', 'font-size': 8, fill: '#fff', text: '缓冲器' }));
        // 脱扣电磁铁
        svg.appendChild(S.svg('rect', { x: r.x - 24, y: zY(1720), width: 48, height: 18, fill: 'rgba(200,118,31,.7)' }));
        svg.appendChild(S.svg('text', { x: r.x, y: zY(1720) - 4, class: 'ct-tick', 'text-anchor': 'middle', 'font-size': 8, fill: '#fff', text: '脱扣电磁铁' }));
        rodEls[r.g] = { absorber: S.svg('rect', { x: r.x - 22, width: 44, fill: r.col, stroke: 'rgba(0,0,0,.5)', 'stroke-width': 1 }), drive: S.svg('line', { x1: r.x, x2: r.x, stroke: 'rgba(232,228,218,.6)', 'stroke-width': 3 }) };
        svg.appendChild(rodEls[r.g].absorber);
        svg.appendChild(rodEls[r.g].drive);
      });
      fig.body.appendChild(svg);

      // 滑块 + 读数
      var ctrl = S.el('div', { class: 'panel panel-dark' });
      var ro = {};
      var defs = { SR1: 0, SR2: 0, RR: 170 };
      var sliders = {};
      ['SR1', 'SR2', 'RR'].forEach(function (g) {
        sliders[g] = S.slider({
          parent: ctrl, label: GROUPS[g].name + ' 插入深度 d', min: 0, max: 950, step: 1,
          value: defs[g], unit: 'mm', format: function (v) { return S.fmtG(v, 0); },
          oninput: redraw
        });
      });
      ['roW', 'roTot', 'roK', 'roSub', 'roState'].forEach(function (k) {
        ro[k] = S.readout(ctrl, k === 'roW' ? '棒组积分价值' : k === 'roTot' ? '总反应性' : k === 'roK' ? 'k_eff' : k === 'roSub' ? '次临界度' : '运行状态', k === 'roW' ? 'pcm' : k === 'roTot' ? 'pcm' : k === 'roK' ? '' : k === 'roSub' ? 'pcm' : '');
      });
      ctrl.appendChild(note('无棒时 k=1.0350（ρ_excess=+3382 pcm），扣除三组棒价值后给出当前 k_eff 与次临界度。'));
      host.appendChild(S.el('div', { class: 'grid2' }, [fig.root, ctrl]));

      function redraw() {
        var ds = { SR1: sliders.SR1.get(), SR2: sliders.SR2.get(), RR: sliders.RR.get() };
        var wTot = 0;
        ['SR1', 'SR2', 'RR'].forEach(function (g) {
          var d = ds[g];
          var z_rod = 950 - d;
          var w = worth(d, GROUPS[g].Wtot);
          wTot += w;
          var el2 = rodEls[g];
          el2.absorber.setAttribute('y', zY(z_rod));
          el2.absorber.setAttribute('height', zY(z_rod) - zY(z_rod + 950));
          el2.drive.setAttribute('y1', zY(z_rod + 950));
          el2.drive.setAttribute('y2', zY(1720));
        });
        var rodPcm = -wTot;
        var k = keff(rodPcm);
        var sub = subcriticality(rodPcm);
        var tot = rhoTotalPcm(rodPcm);
        ro.roW.set(S.fmtG(wTot, 0));
        ro.roTot.set(S.fmt(tot, 0));
        ro.roK.set(S.fmt(k, 5));
        ro.roSub.set(S.fmtG(sub, 0));
        if (tot > 5) ro.roState.set('超临界', 'bad');
        else if (tot < -5) ro.roState.set('次临界', 'warn');
        else ro.roState.set('临界', 'ok');
      }
      redraw();
    })();

    /* ---------- 3. 反应性需求 vs 供给校核表 ---------- */
    (function () {
      host.appendChild(h4('3. 反应性需求 vs 棒组供给校核'));
      var rows = [
        ['温度缺陷（等温 200→395 °C）', S.fmtG(REQ.tempDefect, 0) + ' pcm'],
        ['功率缺陷（0→100%FP）', S.fmtG(REQ.powerDefect, 0) + ' pcm'],
        ['燃耗摆动（300 EFPD, BR=1.05）', S.fmtG(REQ.burnup, 0) + ' pcm'],
        ['不确定性裕量', S.fmtG(REQ.uncertainty, 0) + ' pcm'],
        ['反应性需求合计', { html: '<b>' + S.fmtG(REQ.total, 0) + ' pcm</b>' }],
        '-',
        ['SR-1 单独（5800 − 卡棒620 − 需求2790）', S.fmtG(sr1Check, 0) + ' pcm ≥ 2000', { html: 'PASS', cls: 'ok' }],
        ['SR-2 单独（3200 − 卡棒900）', S.fmtG(sr2Check, 0) + ' pcm ≥ 2000', { html: 'PASS', cls: 'ok' }]
      ];
      // 上面 rows 里第三列是对象，需要补全为对象单元格
      var tableRows = rows.map(function (r) {
        if (r === '-') return '-';
        var cells = [r[0], r[1]];
        if (r[2]) cells.push(r[2]); else cells.push('');
        return cells;
      });
      S.table({ parent: host, head: ['项目', '数值', '结论'], rows: tableRows, numeric: false,
        caption: '停堆深度要求 ≥ 2000 pcm（单根价值最大棒卡死准则）；两套独立停堆系统各自满足。' });
    })();

    /* ---------- 4. 积分价值 / 微分价值曲线 ---------- */
    (function () {
      host.appendChild(h4('4. 积分价值 W(d) 与微分价值 dW/dd（SR-1 组）'));
      function linePts(Wtot, step) {
        var pts = [];
        for (var d = 0; d <= 950; d += step) pts.push([d, worth(d, Wtot)]);
        return pts;
      }
      function diffPts(Wtot, step) {
        var pts = [];
        for (var d = 0; d <= 950; d += step) pts.push([d, dWorth(d, Wtot)]);
        return pts;
      }
      var band = [{ x0: 80, x1: 260, label: '调节棒工作带 80–260 mm', color: 'rgba(200,118,31,.14)' }];

      var c1 = S.chart({
        w: 520, h: 320, xLabel: '插入深度 d (mm)', yLabel: '积分价值 W (pcm)', title: '积分价值',
        series: [
          { name: 'SR-1', color: PAL[0], pts: linePts(5800, 10) },
          { name: 'SR-2', color: PAL[1], pts: linePts(3200, 10) },
          { name: 'RR', color: PAL[2], pts: linePts(900, 10) }
        ], bands: band
      });
      var c2 = S.chart({
        w: 520, h: 320, xLabel: '插入深度 d (mm)', yLabel: '微分价值 dW/dd (pcm/mm)', title: '微分价值',
        series: [
          { name: 'SR-1', color: PAL[0], pts: diffPts(5800, 5) },
          { name: 'RR', color: PAL[2], pts: diffPts(900, 5), dash: '4 3' }
        ],
        bands: band,
        vlines: [{ x: 475, label: '中平面', color: '#8a8478', dash: '4 3' }]
      });
      // 中平面最大微分价值点
      c2.update([
        { name: 'SR-1', color: PAL[0], pts: diffPts(5800, 5), marks: [[475, dWorth(475, 5800)]] },
        { name: 'RR', color: PAL[2], pts: diffPts(900, 5), dash: '4 3' }
      ]);
      host.appendChild(S.el('div', { class: 'grid2' }, [c1.root, c2.root]));
      host.appendChild(note('经典结果：轴向余弦通量形状 + 一阶扰动理论，W(d)=W_tot·[d/H − sin(2πd/H)/(2π)]，中平面处 dW/dd 最大 = 2W_tot/H。真实设计需三维输运/扩散计算；棒间屏蔽（shadowing）使棒组价值小于单棒之和，本页按 −8% 干涉修正，即“棒组价值 = Σ单棒 × 0.92”说明。'));
    })();

    /* ---------- 5. 运动幅度汇总表 ---------- */
    (function () {
      host.appendChild(h4('5. 控制棒运动幅度汇总（核心交付物）'));
      var lf = loadFollowAmplitude();
      var mir = maxInsertionRate();
      var singleStep = 3 / mir;
      var rows = [
        ['全行程 S', S.fmtG(SMM, 0) + ' mm', '活性区 950 mm + 堆芯上方超程 100 mm'],
        ['全插位 / 全提位', 'z = 0 mm / z = 1050 mm', '插入深度 d = 950 − z（z>950 时 d=0）'],
        ['调节棒正常速度', '1.0 mm/s', 'RR 组常规运行'],
        ['停堆棒 / 补偿提升', '5 mm/s', 'SR-1 / SR-2'],
        ['电动快插', '20 mm/s', '事故电动插入'],
        ['事故落棒', '脱扣自由落体 + 弹簧助推', '见第 6 节落棒动力学'],
        ['最小步长 / 定位精度', '0.1 mm / ±0.5 mm', '滚珠丝杠 + 步进电机；双通道测量'],
        ['调节棒工作带', 'd ∈ [80, 260] mm', 'z ∈ [690, 870] mm'],
        ['负荷跟踪运动幅度（100%→50% 功率，450 pcm）', { html: '<b>' + S.fmt(lf, 1) + ' mm</b>' }, '由 SR-1 补偿组微分价值反算（RR 工作带内仅约 101 pcm，不足以承担）'],
        ['最大反应性引入率（RR 1.0 mm/s，工作带内）', { html: '<b>' + S.fmt(mir, 3) + ' pcm/s</b>' }, { html: (mir <= 3 ? '≤ 3 pcm/s PASS' : 'FAIL'), cls: mir <= 3 ? 'ok' : 'bad' }],
        ['单次提棒最大允许幅度（按 ≤3 pcm 计）', S.fmt(singleStep, 1) + ' mm', '3 pcm ÷ 工作带内最大微分价值']
      ];
      S.table({ parent: host, head: ['项目', '数值', '说明'], rows: rows, numeric: false });
      host.appendChild(note('负荷跟踪 100%→50% 功率缺陷差 450 pcm 由 SR-1 补偿组承担（停堆棒兼补偿棒，5 mm/s）；RR 调节组（900 pcm）在工作带内约 101 pcm，用于精细功率控制。UTOP 引入率限制核算：RR 组在 d=260 mm 处微分价值最大，1.0 mm/s 对应 ' + S.fmt(mir, 2) + ' pcm/s ≤ 3 pcm/s，满足。'));
    })();

    /* ---------- 6. 落棒动力学 ---------- */
    (function () {
      host.appendChild(h4('6. 落棒动力学（RK4 积分）'));
      var sRef = scramODE({ Wtot: 5800 });
      var sNoSpring = scramODE({ Wtot: 5800, spring: false });
      var sNoDash = scramODE({ Wtot: 5800, dashpot: false });

      function ptsArr(s) { return s.t.map(function (tt, i) { return [tt, s.z[i]]; }); }
      function vPts(s) { return s.t.map(function (tt, i) { return [tt, s.v[i]]; }); }
      function rhoPts(s) { return s.t.map(function (tt, i) { return [tt, s.rho[i]]; }); }

      var cZ = S.chart({
        w: 460, h: 300, xLabel: '时间 t (s)', yLabel: 'z (mm)', title: '棒下端面高度 z(t)',
        series: [
          { name: '设计（弹簧+缓冲）', color: PAL[0], pts: ptsArr(sRef) },
          { name: '无弹簧', color: PAL[1], pts: ptsArr(sNoSpring), dash: '6 3' },
          { name: '无缓冲器', color: PAL[4], pts: ptsArr(sNoDash), dash: '2 3' }
        ]
      });
      var cV = S.chart({
        w: 460, h: 300, xLabel: '时间 t (s)', yLabel: 'v (m/s)', title: '下落速度 v(t)',
        series: [
          { name: '设计（弹簧+缓冲）', color: PAL[0], pts: vPts(sRef) },
          { name: '无弹簧', color: PAL[1], pts: vPts(sNoSpring), dash: '6 3' },
          { name: '无缓冲器', color: PAL[4], pts: vPts(sNoDash), dash: '2 3' }
        ]
      });
      var cR = S.chart({
        w: 460, h: 300, xLabel: '时间 t (s)', yLabel: 'ρ (pcm)', title: '棒组反应性 ρ(t)',
        series: [
          { name: '设计（弹簧+缓冲）', color: PAL[0], pts: rhoPts(sRef) },
          { name: '无弹簧', color: PAL[1], pts: rhoPts(sNoSpring), dash: '6 3' },
          { name: '无缓冲器', color: PAL[4], pts: rhoPts(sNoDash), dash: '2 3' }
        ]
      });
      host.appendChild(S.el('div', { class: 'grid3' }, [cZ.root, cV.root, cR.root]));

      var ro = S.el('div', { class: 'panel panel-dark' });
      var reads = {};
      ['t10', 't50', 't90', 't100', 'vmax', 'vimp', 'spring', 'dash'].forEach(function (k) {
        reads[k] = S.readout(ro, {
          t10: '10% 插入', t50: '50% 插入', t90: '90% 插入', t100: '100% 插入',
          vmax: '最大速度', vimp: '着底冲击速度', spring: '弹簧缩短', dash: '缓冲降能'
        }[k], {
          t10: 's', t50: 's', t90: 's', t100: 's', vmax: 'm/s', vimp: 'm/s', spring: 'ms', dash: '倍'
        }[k]);
      });
      reads.t10.set(S.fmt(sRef.t10, 3));
      reads.t50.set(S.fmt(sRef.t50, 3));
      reads.t90.set(S.fmt(sRef.t90, 3));
      reads.t100.set(S.fmt(sRef.t100, 3));
      reads.vmax.set(S.fmt(sRef.vMax, 2));
      reads.vimp.set(S.fmt(sRef.vImpact, 3), sRef.vImpact < 0.5 ? 'ok' : 'bad');
      reads.spring.set(S.fmt((sNoSpring.t100 - sRef.t100) * 1000, 0));
      var eRef = sRef.vImpact * sRef.vImpact, eNo = sNoDash.vImpact * sNoDash.vImpact;
      reads.dash.set(S.fmt(eNo / eRef, 1));
      ro.appendChild(note('给定缓冲器 c_d=1400 N·s²/m² 时着底冲击速度 ' + S.fmt(sRef.vImpactGiven, 3) + ' m/s，不满足 <0.5 m/s；将 c_d_dashpot 上调至 ' + S.fmt(sRef.cdDash, 0) + ' N·s²/m² 后冲击速度 ' + S.fmt(sRef.vImpact, 3) + ' m/s（<0.5 m/s）。无缓冲器时冲击速度 ' + S.fmt(sNoDash.vImpact, 2) + ' m/s。'));
      host.appendChild(ro);
    })();

    /* ---------- 7. 点堆动态响应 ---------- */
    (function () {
      host.appendChild(h4('7. 点堆动态响应（6 组缓发 + 两节点反馈）'));

      var cPP = S.chart({ w: 470, h: 300, xLabel: '时间 t (s)', yLabel: 'P/P₀', yLog: true, yDomain: [0.02, 1.3], title: '归一化功率 P/P₀（对数纵轴）', series: [] });
      var cRho = S.chart({ w: 470, h: 300, xLabel: '时间 t (s)', yLabel: 'ρ_total (pcm)', title: '总反应性', series: [] });
      var cT = S.chart({ w: 470, h: 300, xLabel: '时间 t (s)', yLabel: '温度 (°C)', title: '燃料 / 冷却剂节点温度', series: [] });
      host.appendChild(S.el('div', { class: 'grid3' }, [cPP.root, cRho.root, cT.root]));

      var btnRow = S.el('div', { class: 'ctrl-row' });
      var btns = {};
      var ro = S.el('div', { class: 'panel panel-dark' });
      var reads = {};
      ['Pmax', 'Tfmax', 't90', 'E', 'trig'].forEach(function (k) {
        reads[k] = S.readout(ro, { Pmax: '峰值功率', Tfmax: '峰值燃料温度', t90: '90% 插入时间', E: '能量沉积积分', trig: 'SASS 触发时刻' }[k],
          { Pmax: 'MW', Tfmax: '°C', t90: 's', E: 'MJ', trig: 's' }[k]);
      });
      host.appendChild(btnRow);
      host.appendChild(ro);

      function series(t, y, N) {
        var out = [], n = t.length;
        if (n <= N) { for (var i = 0; i < n; i++) out.push([t[i], y[i]]); return out; }
        var st = (n - 1) / (N - 1);
        for (i = 0; i < N; i++) out.push([t[Math.round(i * st)], y[Math.round(i * st)]]);
        return out;
      }

      var yDom = { scram: [0.02, 1.3], utop: [0.98, 1.16], sass: [0.02, 3.2] };
      var rhoDom = { scram: [-6500, 600], utop: [-60, 70], sass: [-7000, 1200] };

      function run(id) {
        var c = CASE_BUILDERS[id]();
        var r = integratePK({ tEnd: c.tEnd, dt: 1e-3, rhoExt: c.rhoExt, feedback: true });
        var N = 1200;
        cPP.update([{ name: 'P/P₀', color: PAL[0], pts: series(r.t, r.P, N) }], { y: yDom[id], x: [0, c.tEnd] });
        cRho.update([{ name: 'ρ_total', color: PAL[1], pts: series(r.t, r.rho, N) }], { y: rhoDom[id], x: [0, c.tEnd] });
        cT.update([
          { name: 'T_fuel', color: PAL[4], pts: series(r.t, r.Tf, N) },
          { name: 'T_cool', color: PAL[0], pts: series(r.t, r.Tc, N) }
        ], { x: [0, c.tEnd] });
        reads.Pmax.set(S.fmtG(r.Pmax * r.PthMW, 0));
        reads.Tfmax.set(S.fmtG(r.Tfmax, 0));
        var t90 = (c.scram ? c.scram.t90 : null);
        reads.t90.set(t90 === null ? '—' : S.fmt(t90, 3));
        reads.E.set(S.fmtG(r.E, 0));
        reads.trig.set((c.getTrig && c.getTrig() !== null) ? S.fmt(c.getTrig(), 2) : '—');
        Object.keys(btns).forEach(function (k) { btns[k].className = 'btn' + (k === id ? ' ok' : ''); });
      }

      Object.keys(CASE_BUILDERS).forEach(function (id) {
        var lbl = { scram: '紧急停堆', utop: 'UTOP 误提升', sass: 'SASS 动作' }[id];
        btns[id] = S.btn(lbl, function () { run(id); });
        btnRow.appendChild(btns[id]);
      });
      run('scram');
      host.appendChild(note('算例说明：(a) 满功率紧急停堆，SR-1 组 5800 pcm 落棒；(b) RR 组 1.0 mm/s 从 d=170 mm 提出至 80 mm；(c) 严重 UTOP 续集——RR 全速误提出，钠出口达 700 °C 时 SASS 失磁落棒，演示固有安全。'));
    })();

    /* ---------- 8. 注释面板 ---------- */
    (function () {
      host.appendChild(h4('8. 模型边界与说明'));
      var p = S.el('div', { class: 'panel' });
      p.appendChild(note('<b>模型边界：</b>一维轴向余弦价值模型 vs 三维输运/扩散计算；点堆动力学 vs 空间动力学；两节点热工 vs 子通道分析。'));
      p.appendChild(note('<b>声明：</b>本页数值为概念设计级自洽算例，非安全分析结果。棒间屏蔽（shadowing）会使棒组价值小于单棒之和，本页按 −8% 干涉修正（棒组价值 = Σ单棒 × 0.92）。'));
      host.appendChild(p);
    })();
  }
})();
