/* =====================================================================
 * app.js —— 倒立摆教学仿真平台：主逻辑
 * ---------------------------------------------------------------------
 * 结构：
 *   1. 状态定义与预设
 *   2. 设计流水线 redesign()：参数 → 线性化 → LQR/PID 增益 → 分析指标
 *   3. 仿真核心 stepSim()：ZOH 采样 + 传感器模型 + 扰动 + RK4 积分
 *   4. 主循环 loop()：固定步长物理 + 可变帧率渲染
 *   5. 界面：数据驱动的滑块生成 + 六个面板 + 实验预设
 * ===================================================================== */
(function (global) {
  'use strict';
  const LA = global.LinAlg, CP = global.CartPole, LQR = global.LQR;
  const CTRL = global.Controllers, AN = global.Analysis, Plots = global.Plots;

  /* =================== 1. 状态 =================== */
  const MODES = {
    none: { label: '无控制', desc: '开环自由倒下：先看清"敌人"长什么样' },
    pid: { label: '单环 PID', desc: '只反馈角度：摆能站住，但小车一定漂走' },
    cascade: { label: '串级 PID', desc: '外环位置 → 内环角度，两个自由度都管住' },
    lqr: { label: 'LQR', desc: '全状态最优反馈：一次解 Riccati，四个状态一起管' },
    lqi: { label: 'LQR + 积分', desc: '增广 LQI：消除常值扰动下的位置静差' },
    swingup: { label: '摆起 + LQR', desc: '能量法把摆甩起来，进入捕获区后交给 LQR' },
    compare: { label: '⚔ PID vs LQR', desc: '同一扰动、同一模型，两种控制器并排对比' }
  };

  const S = {
    running: true, speed: 1, mode: 'lqr', t: 0, stepOnce: false,
    dt: 0.002,                        // 物理积分步长
    Ts: 0.01,                         // 控制器采样周期（零阶保持）
    delaySteps: 0,                    // 控制延迟（采样周期数）
    design: Object.assign({}, CP.DEFAULT_PARAMS),
    mismatch: { m: 1, L: 1, M: 1 },   // 真实 / 设计 参数比（鲁棒性实验）
    weights: Object.assign({}, LQR.DEFAULT_WEIGHTS),
    pid: JSON.parse(JSON.stringify(CTRL.DEFAULT_PID)),
    pidMode: 'shape',                 // 'shape' 按 ωn/ζ 设计；'raw' 直接给增益
    pidShape: { wn: 12, zi: 0.9, ki: 4.0, wo: 1.2, zo: 0.7, kio: 0.05, thetaMax: 0.18 },
    sensor: { sigTheta: 0, sigX: 0, quantTheta: 0, quantX: 0 },
    dist: { wind: 0, kick: 2.0, push: 0 },
    ref: { mode: 'const', x: 0, amp: 0.3, period: 8 },
    init: { theta0: 0.12, x0: 0, hang: false },
    plot4: 'phase',
    sims: [], design_: null, autoReset: true
  };

  const PRESETS = {
    standard: { label: '标准实验台', p: { M: 0.5, m: 0.2, L: 0.6, b: 0.1, c: 0.005, uMax: 10, railHalf: 1.2 } },
    heavy: { label: '重摆（m=0.6）', p: { M: 0.5, m: 0.6, L: 0.6, b: 0.1, c: 0.005, uMax: 10, railHalf: 1.2 } },
    long: { label: '长摆（L=1.2）', p: { M: 0.5, m: 0.2, L: 1.2, b: 0.1, c: 0.005, uMax: 12, railHalf: 1.5 } },
    short: { label: '短摆（L=0.25，难）', p: { M: 0.5, m: 0.2, L: 0.25, b: 0.1, c: 0.005, uMax: 10, railHalf: 1.2 } },
    frictionless: { label: '无摩擦理想台', p: { M: 0.5, m: 0.2, L: 0.6, b: 0, c: 0, uMax: 10, railHalf: 1.2 } },
    weak: { label: '弱执行器（u≤4 N）', p: { M: 0.5, m: 0.2, L: 0.6, b: 0.1, c: 0.005, uMax: 4, railHalf: 1.2 } }
  };

  const WEIGHT_PRESETS = {
    balanced: { label: '均衡', w: { qx: 1, qv: 0.1, qth: 10, qw: 0.5, r: 1, qi: 0 } },
    aggressive: { label: '激进（快但费力）', w: { qx: 4, qv: 0.5, qth: 40, qw: 2, r: 0.1, qi: 0 } },
    gentle: { label: '省力（慢而温柔）', w: { qx: 0.4, qv: 0.05, qth: 4, qw: 0.2, r: 20, qi: 0 } },
    angleOnly: { label: '只顾角度', w: { qx: 0.02, qv: 0.02, qth: 60, qw: 1, r: 1, qi: 0 } },
    posFirst: { label: '位置优先', w: { qx: 20, qv: 1, qth: 8, qw: 0.4, r: 1, qi: 0 } }
  };

  /* =================== 工具 =================== */
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const fmt = (v, n) => (isFinite(v) ? Number(v).toFixed(n === undefined ? 3 : n) : '—');
  const fmtE = (v, n) => (isFinite(v) ? Number(v).toExponential(n === undefined ? 2 : n) : '—');
  const deg = (r) => r * 180 / Math.PI;
  function fmtZ(z) {
    if (Math.abs(z.im) < 1e-9) return fmt(z.re, 3);
    return `${fmt(z.re, 3)} ${z.im >= 0 ? '+' : '−'} ${fmt(Math.abs(z.im), 3)}i`;
  }
  let gaussSpare = null;
  function gauss() {
    if (gaussSpare !== null) { const v = gaussSpare; gaussSpare = null; return v; }
    let u = 0, v = 0, s = 0;
    do { u = Math.random() * 2 - 1; v = Math.random() * 2 - 1; s = u * u + v * v; } while (s === 0 || s >= 1);
    const f = Math.sqrt(-2 * Math.log(s) / s);
    gaussSpare = v * f; return u * f;
  }
  function quantize(v, step) { return step > 0 ? Math.round(v / step) * step : v; }
  function getPath(obj, path) { return path.split('.').reduce((o, k) => o[k], obj); }
  function setPath(obj, path, val) {
    const ks = path.split('.'); const last = ks.pop();
    ks.reduce((o, k) => o[k], obj)[last] = val;
  }

  /* 真实（被控）参数 = 设计参数 × 误差比 */
  function truePhys() {
    const d = S.design, mm = S.mismatch;
    return Object.assign({}, d, { M: d.M * mm.M, m: d.m * mm.m, L: d.L * mm.L });
  }

  /* =================== 2. 设计流水线 =================== */
  function syncPidFromShape() {
    const d = CP.derived(S.design);
    const g0 = S.design.m * d.l / d.D0;
    const p2 = S.design.m * S.design.g * d.l * (S.design.M + S.design.m) / d.D0;
    const sh = S.pidShape;
    S.pid.inner.Kp = (sh.wn * sh.wn + p2) / g0;
    S.pid.inner.Kd = 2 * sh.zi * sh.wn / g0;
    S.pid.inner.Ki = sh.ki;
    S.pid.outer.Kp = sh.wo * sh.wo / S.design.g;
    S.pid.outer.Kd = 2 * sh.zo * sh.wo / S.design.g;
    S.pid.outer.Ki = sh.kio;
    S.pid.outer.thetaMax = sh.thetaMax;
  }

  function redesign() {
    if (S.pidMode === 'shape') syncPidFromShape();
    const p = S.design;
    const lin = CP.linearize(p);
    const ana = CP.analyze(p);
    const w = Object.assign({}, S.weights, { uMax: p.uMax });
    const QR = LQR.brysonWeights(w, p);
    let lqrOut = null, lqiOut = null, err = null;
    try {
      lqrOut = LQR.lqr(lin.A, lin.B, QR.Q, QR.R);
      const qz = (S.weights.qi || 0) / Math.pow(S.weights.zMax || 0.5, 2);
      lqiOut = LQR.lqrIntegral(lin.A, lin.B, QR.Q, QR.R, qz);
    } catch (e) { err = e.message; }

    const cfg = { pid: S.pid, K: null };
    const modeK = (m) => (m === 'lqi' ? (lqiOut && lqiOut.K) : (lqrOut && lqrOut.K));
    const D = {
      p: p, lin: lin, ana: ana, Q: QR.Q, R: QR.R,
      lqr: lqrOut, lqi: lqiOut, err: err, cfg: cfg,
      byMode: {}
    };
    // 为每种模式准备闭环分析
    for (const m of ['none', 'pid', 'cascade', 'lqr', 'lqi', 'swingup']) {
      const c = { pid: S.pid, K: modeK(m) };
      let cl = null, gm = null, cs = null;
      try {
        cl = AN.closedLoop(m === 'swingup' ? 'lqr' : m, lin, c);
        if (m !== 'none') {
          gm = AN.gainMarginInterval(cl, lin.B);
          cs = AN.criticalSampling(lin, cl, S.pid.outer);
        }
      } catch (e) { /* 忽略：极端参数下分析可能失败 */ }
      D.byMode[m] = { cl: cl, poles: cl ? LA.eigenvalues(cl.A) : [], gm: gm, cs: cs };
    }
    S.design_ = D;
    return D;
  }

  /* =================== 3. 仿真 =================== */
  function makeCtrl(mode, K) {
    const p = truePhys();               // 控制器的限幅按真实执行器能力
    switch (mode) {
      case 'pid': return new CTRL.AnglePID(S.pid.inner, p);
      case 'cascade': return new CTRL.CascadePID(S.pid, p);
      case 'lqr': case 'lqi': return new CTRL.LQRController(K, p);
      case 'swingup': return new CTRL.SwingUpController(K, p);
      default: return null;
    }
  }

  function makeSim(mode, label, color) {
    const D = S.design_;
    const K = (mode === 'lqi') ? (D.lqi && D.lqi.K) : (D.lqr && D.lqr.K);
    const hang = S.init.hang || mode === 'swingup';
    const sim = {
      mode: mode, label: label, color: color,
      s: [S.init.x0, 0, hang ? Math.PI : S.init.theta0, 0],
      u: 0, uCmd: 0, nextSample: 0, delayBuf: [],
      ctrl: makeCtrl(mode, K), failed: null, info: {},
      met: { maxTheta: 0, maxX: 0, u2: 0, J: 0, settleT: 0, samples: 0, satCount: 0, hitRail: 0 }
    };
    return sim;
  }

  function resetSims() {
    S.t = 0;
    const lanes = (S.mode === 'compare')
      ? [['cascade', '串级 PID', '#e0a84c'], ['lqr', 'LQR', '#5fd08a']]
      : [[S.mode, MODES[S.mode].label, '#7fb2e8']];
    S.sims = lanes.map(([m, l, c]) => makeSim(m, l, c));
    for (const sc of Object.values(SCOPES)) if (sc.clear) sc.clear();
    if (PHASE) PHASE.clear();
    if (RENDER) RENDER.clearTrails();
  }

  function refAt(t) {
    if (S.ref.mode === 'square') {
      const ph = (t % S.ref.period) / S.ref.period;
      return (ph < 0.5 ? S.ref.amp : -S.ref.amp);
    }
    return S.ref.x;
  }

  // 单步物理推进（所有 lane 共享同一时间轴、同一扰动与同一传感器噪声实现）
  function stepSim(dt) {
    const p = truePhys();
    const t = S.t;
    const xRef = refAt(t);
    const D = S.design_;
    // 共享噪声：对比模式下两个控制器必须看到完全相同的测量值，比较才公平
    const nTh = S.sensor.sigTheta > 0 ? S.sensor.sigTheta * gauss() : 0;
    const nX = S.sensor.sigX > 0 ? S.sensor.sigX * gauss() : 0;
    for (const sim of S.sims) {
      // --- 控制器采样（零阶保持）---
      if (sim.ctrl && t >= sim.nextSample - 1e-12) {
        // 传感器模型：噪声 + 量化（只影响控制器看到的值，不影响真实状态）
        const meas = sim.s.slice();
        meas[2] += nTh; meas[0] += nX;
        if (S.sensor.quantTheta > 0) meas[2] = quantize(meas[2], S.sensor.quantTheta);
        if (S.sensor.quantX > 0) meas[0] = quantize(meas[0], S.sensor.quantX);
        let uNew = 0;
        try { uNew = sim.ctrl.compute(meas, t, { xRef: xRef, thetaRef: 0 }); } catch (e) { uNew = 0; }
        // 控制延迟：u 进入 FIFO，取出 delaySteps 拍之前算出的那个
        sim.delayBuf.push(uNew);
        while (sim.delayBuf.length > S.delaySteps) sim.uCmd = sim.delayBuf.shift();
        sim.nextSample += S.Ts;
        sim.met.samples++;
        sim.info = sim.ctrl.info ? sim.ctrl.info() : {};
        if (sim.info.saturated) sim.met.satCount++;
      }
      // --- 实际作用力 = 控制力 + 风扰 + 键盘推力 ---
      const uTotal = CP.clampForce(sim.uCmd + S.dist.wind + S.dist.push, p);
      sim.u = sim.uCmd;
      sim.s = CP.rk4Step(sim.s, uTotal, p, dt);

      // --- 导轨限位：非弹性碰撞 ---
      if (Math.abs(sim.s[0]) > p.railHalf) {
        sim.s[0] = Math.sign(sim.s[0]) * p.railHalf;
        sim.s[1] = 0;
        sim.met.hitRail++;
        if (S.mode !== 'none' && !sim.failed) sim.failed = '撞到导轨限位 —— 控制失败';
      }
      // --- 指标 ---
      const th = CP.wrapPi(sim.s[2]);
      sim.met.maxTheta = Math.max(sim.met.maxTheta, Math.abs(th));
      sim.met.maxX = Math.max(sim.met.maxX, Math.abs(sim.s[0]));
      sim.met.u2 += sim.u * sim.u * dt;
      if (D && D.Q) {
        const e = [sim.s[0] - xRef, sim.s[1], th, sim.s[3]];
        let q = 0;
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) q += e[i] * D.Q[i][j] * e[j];
        sim.met.J += (q + D.R[0][0] * sim.u * sim.u) * dt;
      }
      if (!(Math.abs(th) < 0.02 && Math.abs(sim.s[0] - xRef) < 0.03)) sim.met.settleT = t;
      // --- 失败判定 ---
      if (S.mode !== 'none' && sim.mode !== 'swingup' && !sim.failed && Math.abs(th) > 1.3) {
        sim.failed = '摆已倒下 (|θ| > 75°) —— 控制失败';
      }
    }
    S.t += dt;
  }

  function kick(amount) {
    for (const sim of S.sims) sim.s[3] += (amount === undefined ? S.dist.kick : amount);
  }

  /* =================== 4. 绘图对象 =================== */
  let RENDER = null, PHASE = null, POLEMAP = null;
  const SCOPES = {};
  const LANE_COLORS = ['#e0a84c', '#5fd08a'];

  function buildScopes() {
    const p = truePhys();
    const two = S.mode === 'compare';
    const mk = (id, title, unit, series, extra) => new Plots.Scope($(id), Object.assign({
      title: title, unit: unit, window: 10, series: series
    }, extra || {}));
    const seriesFor = (extraSeries) => {
      const out = [];
      if (two) {
        out.push({ label: '串级 PID', color: LANE_COLORS[0] });
        out.push({ label: 'LQR', color: LANE_COLORS[1] });
      } else {
        out.push({ label: '实测', color: '#7fb2e8' });
      }
      return out.concat(extraSeries || []);
    };
    SCOPES.theta = mk('scTheta', '摆角 θ', '°', seriesFor([{ label: '内环给定 θ_ref', color: '#c86fd8', dash: [4, 3], width: 1.2 }]), { symmetric: true, minSpan: 4 });
    SCOPES.x = mk('scX', '小车位置 x', 'm', seriesFor([{ label: '目标 x_ref', color: '#c86fd8', dash: [4, 3], width: 1.2 }]), { minSpan: 0.1, bands: [{ y: p.railHalf, color: '#7a3b3b' }, { y: -p.railHalf, color: '#7a3b3b' }] });
    SCOPES.u = mk('scU', '驱动力 u', 'N', seriesFor(), { symmetric: true, minSpan: 1, bands: [{ y: p.uMax, color: '#7a3b3b' }, { y: -p.uMax, color: '#7a3b3b' }] });
    SCOPES.energy = mk('sc4e', '摆杆能量 E 与目标 mgl', 'J', seriesFor([{ label: '目标 E=mgl', color: '#c86fd8', dash: [4, 3], width: 1.2 }]), { minSpan: 0.2 });
  }

  function pushPlots() {
    const two = S.mode === 'compare';
    const xRef = refAt(S.t);
    const p = truePhys();
    const thVals = [], xVals = [], uVals = [], eVals = [];
    S.sims.forEach((sim, i) => {
      thVals[i] = deg(CP.wrapPi(sim.s[2]));
      xVals[i] = sim.s[0];
      uVals[i] = sim.u;
      eVals[i] = CP.pendulumEnergy(sim.s, p);
    });
    const nLane = two ? 2 : 1;
    const thRef = (S.sims[0].info && S.sims[0].info.thetaRef !== undefined) ? deg(S.sims[0].info.thetaRef) : 0;
    SCOPES.theta.push(S.t, thVals.concat([thRef]));
    SCOPES.x.push(S.t, xVals.concat([xRef]));
    SCOPES.u.push(S.t, uVals);
    SCOPES.energy.push(S.t, eVals.concat([p.m * p.g * CP.derived(p).l]));
    if (PHASE) S.sims.forEach((sim, i) => PHASE.push(CP.wrapPi(sim.s[2]), sim.s[3], i));
  }

  /* =================== 5. 主循环 =================== */
  let lastWall = 0, acc = 0;
  function loop(ts) {
    if (!lastWall) lastWall = ts;
    let wall = (ts - lastWall) / 1000;
    lastWall = ts;
    if (wall > 0.25) wall = 0.25;                     // 切后台回来不要暴走
    if (S.running || S.stepOnce) {
      const target = S.stepOnce ? S.dt : wall * S.speed;
      acc += target;
      let guard = 0;
      while (acc >= S.dt && guard < 4000) {
        stepSim(S.dt); acc -= S.dt; guard++;
        if (guard % 5 === 0) pushPlots();
      }
      pushPlots();
      S.stepOnce = false;
    }
    drawAll();
    requestAnimationFrame(loop);
  }

  function drawAll() {
    const p = truePhys();
    const xRef = refAt(S.t);
    const lanes = S.sims.map((sim, i) => ({
      s: sim.s, u: sim.u, p: p, xRef: xRef, wind: S.dist.wind,
      label: `${sim.label}${S.mode === 'compare' ? '' : ' — ' + MODES[S.mode].desc}`,
      color: S.mode === 'compare' ? LANE_COLORS[i] : '#c8d6ea',
      failed: sim.failed,
      thetaRef: sim.info && sim.info.thetaRef,
      extra: extraLine(sim)
    }));
    RENDER.draw(lanes);
    SCOPES.theta.draw(S.t); SCOPES.x.draw(S.t); SCOPES.u.draw(S.t);
    if (S.plot4 === 'phase') PHASE.draw(S.mode === 'compare' ? LANE_COLORS : ['#7fb2e8']);
    else if (S.plot4 === 'poles') drawPoleMap();
    else SCOPES.energy.draw(S.t);
    updateReadout();
  }

  function extraLine(sim) {
    const bits = [];
    if (sim.info && sim.info.mode) bits.push('控制器: ' + sim.info.mode);
    if (sim.info && sim.info.energyGap !== undefined && sim.mode === 'swingup') {
      bits.push(`E-mgl = ${fmt(sim.info.energyGap, 3)} J`);
      if (sim.info.switchTime !== null && sim.info.switchTime !== undefined) bits.push(`切换于 t=${fmt(sim.info.switchTime, 2)} s`);
    }
    if (sim.info && sim.info.integ !== undefined && Math.abs(sim.info.integ) > 1e-9) bits.push(`积分器 z=${fmt(sim.info.integ, 3)}`);
    return bits.join('   ');
  }

  function drawPoleMap() {
    const D = S.design_;
    if (!D) return;
    const m = S.mode === 'compare' ? 'lqr' : S.mode;
    const groups = [
      { poles: D.ana.poles.map((z) => ({ re: z.re, im: z.im })), color: '#d0555a', symbol: 'x', label: '开环极点（不稳定）' }
    ];
    if (S.mode === 'compare') {
      const a = D.byMode.cascade, b = D.byMode.lqr;
      if (a) groups.push({ poles: a.poles, color: LANE_COLORS[0], symbol: 'x', label: '串级 PID 闭环' });
      if (b) groups.push({ poles: b.poles, color: LANE_COLORS[1], symbol: 'x', label: 'LQR 闭环' });
    } else if (D.byMode[m] && D.byMode[m].poles.length) {
      groups.push({ poles: D.byMode[m].poles, color: '#5fd08a', symbol: 'x', label: MODES[S.mode].label + ' 闭环' });
    }
    groups.push({ poles: [{ re: D.ana.zRHP, im: 0 }, { re: D.ana.zLHP, im: 0 }], color: '#c86fd8', symbol: 'o', label: 'u→x 通道零点（含 RHP 零点）' });
    POLEMAP.draw(groups);
  }

  /* =================== 读数条 =================== */
  function updateReadout() {
    const box = $('readout');
    const p = truePhys();
    const rows = [];
    rows.push(['t', fmt(S.t, 2) + ' s']);
    S.sims.forEach((sim) => {
      const th = CP.wrapPi(sim.s[2]);
      const tag = S.mode === 'compare' ? sim.label + ' ' : '';
      rows.push([tag + 'θ', fmt(deg(th), 2) + '°']);
      rows.push([tag + 'x', fmt(sim.s[0], 3) + ' m']);
      rows.push([tag + 'u', fmt(sim.u, 2) + ' N']);
      rows.push([tag + 'max|θ|', fmt(deg(sim.met.maxTheta), 1) + '°']);
      rows.push([tag + '∫u²dt', fmt(sim.met.u2, 2)]);
      rows.push([tag + '代价 J', fmt(sim.met.J, 1)]);
      rows.push([tag + '饱和率', (sim.met.samples ? fmt(100 * sim.met.satCount / sim.met.samples, 0) : '0') + '%']);
    });
    box.innerHTML = '';
    for (const [k, v] of rows) {
      const d = el('div', 'ro');
      d.appendChild(el('span', 'k', k));
      d.appendChild(el('span', 'v', v));
      box.appendChild(d);
    }
  }

  /* =================== 6. 界面构建 =================== */
  function slider(spec) {
    const wrap = el('div', 'ctl');
    const lab = el('label');
    lab.appendChild(el('span', 'lab', spec.label));
    const val = el('span', 'val');
    lab.appendChild(val);
    wrap.appendChild(lab);
    const inp = document.createElement('input');
    inp.type = 'range';
    const isLog = !!spec.log;
    const toSlider = (v) => isLog ? (Math.log(v) - Math.log(spec.min)) / (Math.log(spec.max) - Math.log(spec.min)) * 1000 : (v - spec.min) / (spec.max - spec.min) * 1000;
    const fromSlider = (q) => isLog ? Math.exp(Math.log(spec.min) + (q / 1000) * (Math.log(spec.max) - Math.log(spec.min))) : spec.min + (q / 1000) * (spec.max - spec.min);
    inp.min = 0; inp.max = 1000; inp.step = 1;
    const render = () => {
      const v = getPath(S, spec.path);
      inp.value = String(Math.max(0, Math.min(1000, toSlider(v))));
      val.textContent = (spec.fmt ? spec.fmt(v) : fmt(v, spec.dec === undefined ? 3 : spec.dec)) + (spec.unit || '');
    };
    inp.addEventListener('input', () => {
      let v = fromSlider(+inp.value);
      if (spec.snap) v = Math.round(v / spec.snap) * spec.snap;
      setPath(S, spec.path, v);
      val.textContent = (spec.fmt ? spec.fmt(v) : fmt(v, spec.dec === undefined ? 3 : spec.dec)) + (spec.unit || '');
      onChange(spec);
    });
    wrap.appendChild(inp);
    if (spec.hint) wrap.appendChild(el('div', 'hint', spec.hint));
    wrap._render = render;
    render();
    return wrap;
  }

  function toggle(spec) {
    const wrap = el('div', 'ctl row');
    const lab = el('label', 'chk');
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.checked = !!getPath(S, spec.path);
    inp.addEventListener('change', () => { setPath(S, spec.path, inp.checked); onChange(spec); });
    lab.appendChild(inp); lab.appendChild(el('span', 'lab', spec.label));
    wrap.appendChild(lab);
    if (spec.hint) wrap.appendChild(el('div', 'hint', spec.hint));
    wrap._render = () => { inp.checked = !!getPath(S, spec.path); };
    return wrap;
  }

  function buttonRow(items, cls) {
    const row = el('div', 'btnrow ' + (cls || ''));
    for (const it of items) {
      const b = el('button', 'mini', it.label);
      b.addEventListener('click', it.onClick);
      row.appendChild(b);
    }
    return row;
  }

  const RENDERABLES = [];
  function section(parent, title, hint) {
    const s = el('div', 'sect');
    const h = el('div', 'sect-h', title);
    s.appendChild(h);
    if (hint) s.appendChild(el('div', 'sect-hint', hint));
    parent.appendChild(s);
    return s;
  }
  function addAll(parent, specs) {
    for (const sp of specs) {
      const node = sp.type === 'toggle' ? toggle(sp) : slider(sp);
      parent.appendChild(node);
      if (node._render) RENDERABLES.push(node);
    }
  }

  function onChange(spec) {
    if (spec && spec.reset) { redesign(); resetSims(); buildScopes(); }
    else { redesign(); }
    if (spec && spec.rebuildScopes) buildScopes();
    refreshPanels();
  }

  /* ---------- 控制器面板 ---------- */
  function buildCtrlPanel() {
    const root = $('panel-ctrl');
    root.innerHTML = '';
    RENDERABLES.length = 0;

    const s0 = section(root, 'LQR 权重（Bryson 定则）',
      'Q = diag(qᵢ/xᵢ,max²)、R = ρ/u_max²。qᵢ 是"我有多在意这个量偏离零"，ρ 是"我有多心疼执行器"。改动后 ARE 会立即重解。');
    addAll(s0, [
      { path: 'weights.qth', label: '角度权重 q_θ', min: 0.1, max: 300, log: true, dec: 1 },
      { path: 'weights.qx', label: '位置权重 q_x', min: 0.01, max: 100, log: true, dec: 2 },
      { path: 'weights.qw', label: '角速度权重 q_ω', min: 0.01, max: 50, log: true, dec: 2 },
      { path: 'weights.qv', label: '车速权重 q_v', min: 0.01, max: 50, log: true, dec: 2 },
      { path: 'weights.r', label: '控制代价 ρ', min: 0.01, max: 300, log: true, dec: 2, hint: 'ρ 越大越省力、响应越慢；ρ→0 会逼近"无限增益"，实机上必然被饱和与噪声打败。' },
      { path: 'weights.qi', label: '积分权重 q_I（LQI）', min: 0, max: 50, dec: 2, hint: '仅在 LQR+积分 模式生效：q_I=0 时自动退化为普通 LQR。' }
    ]);
    root.appendChild(buttonRow(Object.entries(WEIGHT_PRESETS).map(([k, v]) => ({
      label: v.label, onClick: () => { Object.assign(S.weights, v.w); redesign(); refreshPanels(); }
    }))));

    const s1 = section(root, 'PID 参数', '两种给法：按"闭环形状"(ωn/ζ) 反解增益，或直接给 Kp/Ki/Kd。');
    const modeRow = el('div', 'btnrow');
    for (const [k, lbl] of [['shape', '按 ωn/ζ 设计'], ['raw', '直接给增益']]) {
      const b = el('button', 'mini' + (S.pidMode === k ? ' on' : ''), lbl);
      b.addEventListener('click', () => { S.pidMode = k; redesign(); buildCtrlPanel(); refreshPanels(); });
      modeRow.appendChild(b);
    }
    s1.appendChild(modeRow);
    if (S.pidMode === 'shape') {
      addAll(s1, [
        { path: 'pidShape.wn', label: '内环带宽 ωn', min: 4, max: 30, dec: 1, unit: ' rad/s', hint: '必须明显大于不稳定极点 p（默认 5.59 rad/s），否则角度环压不住重力。' },
        { path: 'pidShape.zi', label: '内环阻尼 ζ', min: 0.3, max: 1.5, dec: 2 },
        { path: 'pidShape.ki', label: '内环积分 Ki', min: 0, max: 40, dec: 1 },
        { path: 'pidShape.wo', label: '外环带宽 ωo', min: 0.2, max: 4, dec: 2, unit: ' rad/s', hint: '必须明显小于右半平面零点 z（默认 4.95 rad/s），经验上 ωo < z/2。调大试试就知道为什么。' },
        { path: 'pidShape.zo', label: '外环阻尼 ζo', min: 0.3, max: 1.5, dec: 2 },
        { path: 'pidShape.kio', label: '外环积分 Kio', min: 0, max: 1, dec: 3, hint: '消除常值风扰下的位置静差，代价是响应变慢。' },
        { path: 'pidShape.thetaMax', label: '倾角给定限幅', min: 0.02, max: 0.5, dec: 2, unit: ' rad' }
      ]);
    } else {
      addAll(s1, [
        { path: 'pid.inner.Kp', label: '内环 Kp', min: 1, max: 200, log: true, dec: 1 },
        { path: 'pid.inner.Ki', label: '内环 Ki', min: 0, max: 60, dec: 1 },
        { path: 'pid.inner.Kd', label: '内环 Kd', min: 0, max: 30, dec: 2 },
        { path: 'pid.inner.tauD', label: '内环微分滤波 τ_D', min: 0.001, max: 0.2, log: true, dec: 3, unit: ' s' },
        { path: 'pid.outer.Kp', label: '外环 Kp', min: 0.01, max: 2, log: true, dec: 3 },
        { path: 'pid.outer.Ki', label: '外环 Ki', min: 0, max: 1, dec: 3 },
        { path: 'pid.outer.Kd', label: '外环 Kd', min: 0, max: 2, dec: 3 },
        { path: 'pid.outer.thetaMax', label: '倾角给定限幅', min: 0.02, max: 0.5, dec: 2, unit: ' rad' }
      ]);
    }

    const s2 = section(root, '数字实现', '真实控制器是"离散采样 + 计算延迟"的，这两个旋钮能把任何漂亮的设计毁掉。');
    addAll(s2, [
      { path: 'Ts', label: '采样周期 Ts', min: 0.001, max: 0.12, log: true, dec: 4, unit: ' s', reset: false, hint: '分析面板给出临界采样周期 Ts_crit，超过它必然失稳。' },
      { path: 'delaySteps', label: '控制延迟', min: 0, max: 10, dec: 0, snap: 1, unit: ' × Ts' }
    ]);
    RENDERABLES.forEach((n) => n._render && n._render());
  }

  /* ---------- 模型面板 ---------- */
  function buildModelPanel() {
    const root = $('panel-model');
    root.innerHTML = '';
    const s0 = section(root, '物理参数（同时用于控制器设计）', '改这些参数会立刻重新设计控制器：这就是"基于模型"的含义。');
    const specs = [
      { path: 'design.M', label: '小车质量 M', min: 0.1, max: 3, dec: 2, unit: ' kg' },
      { path: 'design.m', label: '摆杆质量 m', min: 0.02, max: 2, dec: 2, unit: ' kg' },
      { path: 'design.L', label: '摆杆长度 L', min: 0.15, max: 1.6, dec: 2, unit: ' m' },
      { path: 'design.b', label: '小车摩擦 b', min: 0, max: 2, dec: 3, unit: ' N·s/m' },
      { path: 'design.c', label: '转轴摩擦 c', min: 0, max: 0.1, dec: 4, unit: ' N·m·s' },
      { path: 'design.g', label: '重力 g', min: 1.6, max: 25, dec: 2, unit: ' m/s²', hint: '试试月球 1.62：不稳定极点变慢，控制立刻变简单。' },
      { path: 'design.uMax', label: '执行器上限 u_max', min: 1, max: 40, dec: 1, unit: ' N' },
      { path: 'design.railHalf', label: '导轨半长', min: 0.3, max: 3, dec: 2, unit: ' m' }
    ];
    const nodes = [];
    for (const sp of specs) { sp.reset = false; const n = slider(sp); s0.appendChild(n); nodes.push(n); }
    root.appendChild(buttonRow(Object.entries(PRESETS).map(([k, v]) => ({
      label: v.label,
      onClick: () => { Object.assign(S.design, v.p); redesign(); resetSims(); buildScopes(); buildModelPanel(); refreshPanels(); }
    }))));

    const s1 = section(root, '初始条件', '');
    const n1 = [
      slider({ path: 'init.theta0', label: '初始倾角 θ₀', min: -0.6, max: 0.6, dec: 3, unit: ' rad', reset: true }),
      slider({ path: 'init.x0', label: '初始位置 x₀', min: -1, max: 1, dec: 2, unit: ' m', reset: true }),
      toggle({ path: 'init.hang', label: '从下垂位置开始（θ₀ = π）', reset: true, hint: '配合"摆起 + LQR"模式使用。' })
    ];
    n1.forEach((n) => s1.appendChild(n));

    const s2 = section(root, '模型误差（鲁棒性实验）',
      '控制器仍按上面的"设计参数"计算，但真实被控对象按下面的倍数改变。这是检验控制器鲁棒性的标准做法。');
    const n2 = [
      slider({ path: 'mismatch.m', label: '真实摆杆质量 / 设计值', min: 0.3, max: 3, dec: 2, unit: '×', reset: false }),
      slider({ path: 'mismatch.L', label: '真实摆长 / 设计值', min: 0.5, max: 2, dec: 2, unit: '×', reset: false }),
      slider({ path: 'mismatch.M', label: '真实小车质量 / 设计值', min: 0.3, max: 3, dec: 2, unit: '×', reset: false })
    ];
    n2.forEach((n) => s2.appendChild(n));
    root.appendChild(buttonRow([{ label: '清除模型误差', onClick: () => { S.mismatch = { m: 1, L: 1, M: 1 }; buildModelPanel(); refreshPanels(); } }]));
  }

  /* ---------- 传感与扰动面板 ---------- */
  function buildDistPanel() {
    const root = $('panel-dist');
    root.innerHTML = '';
    const s0 = section(root, '传感器（只影响控制器看到的量）', '真实实验里编码器有量化、陀螺仪有噪声。噪声一大，微分项就开始"发疯"。');
    [
      { path: 'sensor.sigTheta', label: '角度噪声 σ_θ', min: 0, max: 0.05, dec: 4, unit: ' rad' },
      { path: 'sensor.sigX', label: '位置噪声 σ_x', min: 0, max: 0.05, dec: 4, unit: ' m' },
      { path: 'sensor.quantTheta', label: '角度量化步长', min: 0, max: 0.05, dec: 4, unit: ' rad', hint: '2000 线编码器 ≈ 0.003 rad。' },
      { path: 'sensor.quantX', label: '位置量化步长', min: 0, max: 0.02, dec: 4, unit: ' m' }
    ].forEach((sp) => s0.appendChild(slider(sp)));

    const s1 = section(root, '扰动', '');
    [
      { path: 'dist.wind', label: '恒定风扰（作用在小车上）', min: -6, max: 6, dec: 2, unit: ' N', hint: '普通 LQR 会留下 d/K_x 的静差；开 LQR+积分 模式看差别。' },
      { path: 'dist.kick', label: '冲击强度（角速度）', min: 0.5, max: 8, dec: 1, unit: ' rad/s' }
    ].forEach((sp) => s1.appendChild(slider(sp)));
    root.appendChild(buttonRow([
      { label: '给摆一击 (K)', onClick: () => kick() },
      { label: '反向一击', onClick: () => kick(-S.dist.kick) }
    ]));

    const s2 = section(root, '位置给定', '');
    const row = el('div', 'btnrow');
    for (const [k, lbl] of [['const', '恒定'], ['square', '方波']]) {
      const b = el('button', 'mini' + (S.ref.mode === k ? ' on' : ''), lbl);
      b.addEventListener('click', () => { S.ref.mode = k; buildDistPanel(); });
      row.appendChild(b);
    }
    s2.appendChild(row);
    [
      { path: 'ref.x', label: '目标位置 x_ref', min: -1, max: 1, dec: 2, unit: ' m' },
      { path: 'ref.amp', label: '方波幅值', min: 0.05, max: 1, dec: 2, unit: ' m' },
      { path: 'ref.period', label: '方波周期', min: 2, max: 30, dec: 1, unit: ' s' }
    ].forEach((sp) => s2.appendChild(slider(sp)));
    s2.appendChild(el('div', 'hint', '提示：按住键盘 ← → 可以直接用手推小车（±4 N），松手即停。'));
  }

  /* ---------- 分析面板 ---------- */
  function matHTML(M, rowLabels, colLabels, dec) {
    const rows = LA.toRows(M);
    let h = '<table class="mat"><tr><th></th>' + (colLabels || []).map((c) => `<th>${c}</th>`).join('') + '</tr>';
    rows.forEach((r, i) => {
      h += '<tr><th>' + ((rowLabels && rowLabels[i]) || '') + '</th>' + r.map((v) => `<td>${fmt(v, dec === undefined ? 3 : dec)}</td>`).join('') + '</tr>';
    });
    return h + '</table>';
  }

  function buildAnalysisPanel() {
    const root = $('panel-analysis');
    const D = S.design_;
    if (!D) { root.innerHTML = '设计失败'; return; }
    const m = S.mode === 'compare' ? 'lqr' : S.mode;
    const bm = D.byMode[m] || {};
    const p = D.p, d = D.ana.derived;
    const st = ['x', 'ẋ', 'θ', 'θ̇'];
    const K = (m === 'lqi' ? (D.lqi && D.lqi.K) : (D.lqr && D.lqr.K));
    const trueP = truePhys();
    const mism = (Math.abs(S.mismatch.m - 1) + Math.abs(S.mismatch.L - 1) + Math.abs(S.mismatch.M - 1)) > 1e-6;

    let h = '';
    h += `<div class="sect"><div class="sect-h">系统结构性质</div>
      <table class="kv">
      <tr><td>等效转动惯量 J = I + m l²</td><td>${fmt(d.J, 5)} kg·m²</td></tr>
      <tr><td>耦合行列式 D₀ = (M+m)J − (ml)²</td><td>${fmt(d.D0, 5)}</td></tr>
      <tr><td>不稳定极点：无摩擦解析 √(mgl(M+m)/D₀)</td><td>${fmt(D.ana.pUnstable, 4)} rad/s</td></tr>
      <tr><td>不稳定极点：<b>含摩擦实际值</b></td><td><b>${fmt(D.ana.pTrue, 4)}</b> rad/s</td></tr>
      <tr><td>误差倍增时间 ln2 / p（按实际值）</td><td><b>${fmt(D.ana.doublingTimeTrue, 4)}</b> s ← 留给控制器的反应时间</td></tr>
      <tr><td>u→x 通道零点（含摩擦精确值）</td><td><b>+${fmt(D.ana.zRHP, 4)}</b> / ${fmt(D.ana.zLHP, 4)} rad/s（RHP 零点 ⇒ 非最小相位）</td></tr>
      <tr><td>u→θ 通道</td><td>${p.b > 1e-12 ? `1 个原点零点（因 b=${fmt(p.b, 3)}≠0），DC 增益 = 0` : '无有限零点（b=0）'}</td></tr>
      <tr><td>能控性矩阵秩 / 条件数</td><td>${D.ana.rank} / 4 ，cond = ${fmt(D.ana.cond, 1)}</td></tr>
      <tr><td>开环极点</td><td>${D.ana.poles.map(fmtZ).join(' , ')}</td></tr>
      </table>
      <div class="hint">两条硬约束来自不同的环：<b>内环</b>（角度）必须比不稳定极点快，经验值 ω<sub>n</sub> ≳ 2p = ${fmt(2 * D.ana.pUnstable, 2)} rad/s，否则压不住重力；
      <b>外环</b>（位置）必须比右半平面零点慢，经验值 ω<sub>o</sub> ≲ z/2 = ${fmt(D.ana.zRHP / 2, 2)} rad/s，否则"欲进先退"会变成正反馈。
      由于 z &lt; p 恒成立（无摩擦时 p/z = ${fmt(D.ana.pzRatio, 4)}，只取决于质量比），两个环之间被迫至少相差 ${fmt(2 * D.ana.pUnstable / (D.ana.zRHP / 2), 1)} 倍带宽 —— 这就是串级结构的理论依据。
      ${p.b > 1e-12 ? `另外：因 b≠0，u→θ 通道存在原点零点，可证<b>纯 PD 角度环恒不可稳</b>，积分增益必须满足 <b>Ki &gt; b·g = ${fmt(D.ana.kiMinAngleLoop, 3)}</b>（见理论文档 §5.1）。` : ''}</div></div>`;

    h += `<div class="sect"><div class="sect-h">状态空间矩阵（在 θ=0 处线性化）</div>
      ${matHTML(D.lin.A, st, st, 3)}
      <div class="mat-cap">B ᵀ = [ ${LA.toRows(D.lin.B).map((r) => fmt(r[0], 3)).join(' , ')} ]</div>
      <div class="hint">注意 B 的第 4 项是<b>负数</b>：向右推小车会让摆杆向左转。这一个负号就是倒立摆"反直觉"的全部来源。</div></div>`;

    if (D.err) h += `<div class="sect warn">ARE 求解失败：${D.err}</div>`;

    if (K && (m === 'lqr' || m === 'lqi' || m === 'swingup' || S.mode === 'compare')) {
      const src = (m === 'lqi') ? D.lqi : D.lqr;
      const names = (m === 'lqi') ? ['kᵢ', 'K_x', 'K_v', 'K_θ', 'K_ω'] : ['K_x', 'K_v', 'K_θ', 'K_ω'];
      h += `<div class="sect"><div class="sect-h">LQR 求解结果</div>
        <table class="kv">
        <tr><td>反馈增益 K</td><td>${Array.from(K[0]).map((v, i) => `${names[i]}=${fmt(v, 3)}`).join(' , ')}</td></tr>
        <tr><td>ARE 残差（绝对 / 归一化 res/(1+‖P‖<sub>F</sub>)）</td><td>${fmtE(src.residual)} / ${fmtE(src.residual / (1 + LA.normF(src.P)))}（牛顿 ${src.iters} 步，初值 ${src.init}）</td></tr>
        <tr><td>闭环极点</td><td>${bm.poles.map(fmtZ).join(' , ')}</td></tr>
        <tr><td>P 的特征值（应全为正）</td><td>${src.eigP.map((v) => fmt(v, 3)).join(' , ')}</td></tr>
        <tr><td>精确不变量 K_x = −√(q_x/R)</td><td>−√(${fmt(D.Q[0][0], 3)}/${fmtE(D.R[0][0])}) = ${fmt(-Math.sqrt(D.Q[0][0] / D.R[0][0]), 4)}（与实际 K_x 一致，可手算校验）</td></tr>
        <tr><td>当前状态的理论最小代价 s₀ᵀPs₀</td><td>${fmt(src.cost(m === 'lqi' ? [0].concat(S.sims[0] ? Array.from(S.sims[0].s) : [0, 0, 0, 0]) : (S.sims[0] ? S.sims[0].s : [0, 0, 0, 0])), 3)}</td></tr>
        </table>
        <div class="mat-cap">Riccati 解 P =</div>${matHTML(src.P, null, null, 3)}</div>`;
    }

    if (m === 'pid' || m === 'cascade' || S.mode === 'compare') {
      const cm = (S.mode === 'compare') ? 'cascade' : m;
      const cbm = D.byMode[cm];
      h += `<div class="sect"><div class="sect-h">PID 的闭环极点（把积分器当成状态算出来的）</div>
        <table class="kv">
        <tr><td>内环 Kp / Ki / Kd</td><td>${fmt(S.pid.inner.Kp, 2)} / ${fmt(S.pid.inner.Ki, 2)} / ${fmt(S.pid.inner.Kd, 3)}</td></tr>
        <tr><td>外环 Kp / Ki / Kd</td><td>${fmt(S.pid.outer.Kp, 3)} / ${fmt(S.pid.outer.Ki, 3)} / ${fmt(S.pid.outer.Kd, 3)}</td></tr>
        <tr><td>闭环极点（${cbm.cl ? cbm.cl.labels.length : 0} 阶）</td><td>${cbm.poles.map(fmtZ).join(' , ')}</td></tr>
        </table>
        <div class="hint">单环 PID 会看到一个位于原点的极点：那正是"小车位置无人管"的数学表现（临界稳定，任何扰动都会让它匀速漂走）。
        更进一步：因小车摩擦 b≠0 使 u→θ 通道出现原点零点，可证<b>纯 PD（Ki=0）角度环恒不可稳</b>，
        必须满足 <b>Ki &gt; b·g = ${fmt(D.ana.kiMinAngleLoop, 3)}</b>；把内环 Ki 调到 0 试试就知道了。</div></div>`;
    }

    if (bm.gm) {
      const gm = bm.gm;
      h += `<div class="sect"><div class="sect-h">鲁棒性与数字实现</div>
        <table class="kv">
        <tr><td>增益裕度区间（执行器增益乘 α 仍稳定）</td><td>α ∈ [${fmt(gm.lo, 3)}, ${gm.hi === Infinity ? '∞' : fmt(gm.hi, 2)}]</td></tr>
        <tr><td>临界采样周期 Ts_crit</td><td>${bm.cs && isFinite(bm.cs.Ts) ? '<b>' + fmt(bm.cs.Ts * 1000, 1) + '</b> ms（即 ' + fmt(1 / bm.cs.Ts, 0) + ' Hz）' : (bm.cs ? bm.cs.note : '—')}</td></tr>
        <tr><td>当前采样周期</td><td>${fmt(S.Ts * 1000, 1)} ms ${bm.cs && isFinite(bm.cs.Ts) ? (S.Ts < bm.cs.Ts ? '<span class="ok">✓ 安全</span>' : '<span class="bad">✗ 已超过临界值，必然失稳</span>') : ''}</td></tr>
        <tr><td>p · Ts_crit（无量纲）</td><td>${bm.cs && isFinite(bm.cs.Ts) ? fmt(D.ana.pUnstable * bm.cs.Ts, 3) : '—'}</td></tr>
        </table>
        <div class="hint">LQR 的理论保证：增益裕度区间必然包含 [0.5, ∞)，相位裕度 ≥ 60°。PID 没有这种普适保证，区间通常是有限的。</div></div>`;
    }

    if (mism) {
      h += `<div class="sect warn"><div class="sect-h">⚠ 模型误差已开启</div>
        <table class="kv">
        <tr><td>设计用参数</td><td>M=${fmt(p.M, 3)} kg, m=${fmt(p.m, 3)} kg, L=${fmt(p.L, 3)} m</td></tr>
        <tr><td>真实被控对象</td><td>M=${fmt(trueP.M, 3)} kg, m=${fmt(trueP.m, 3)} kg, L=${fmt(trueP.L, 3)} m</td></tr>
        <tr><td>真实对象的不稳定极点</td><td>${fmt(CP.analyze(trueP).pUnstable, 3)} rad/s（设计时以为是 ${fmt(D.ana.pUnstable, 3)}）</td></tr>
        </table></div>`;
    }
    root.innerHTML = h;
  }

  function refreshPanels() {
    buildAnalysisPanel();
    RENDERABLES.forEach((n) => n._render && n._render());
    // 模式说明
    $('modeDesc').textContent = MODES[S.mode].desc;
    document.querySelectorAll('#modeTabs button').forEach((b) => {
      b.classList.toggle('on', b.dataset.mode === S.mode);
    });
    $('btnPlay').textContent = S.running ? '⏸ 暂停' : '▶ 运行';
  }

  /* =================== 7. 实验预设 =================== */
  const LABS = [
    {
      title: '实验 1：认识对手 —— 开环有多快倒',
      goal: '测量误差倍增时间，理解"为什么必须高频采样"。',
      steps: '选无控制模式 → 观察 θ 从 0.12 rad 涨到 0.24 rad 用了多久 → 与分析面板给出的 ln2/p 对比。',
      apply: () => { S.mode = 'none'; S.init.theta0 = 0.12; S.init.hang = false; S.dist.wind = 0; }
    },
    {
      title: '实验 2：单环 PID 的天花板',
      goal: '亲眼看到"一个执行器管不了两个自由度"。',
      steps: '选单环 PID → 摆稳住了，但小车持续漂走直到撞限位 → 在分析面板找到那个位于原点的闭环极点。',
      apply: () => { S.mode = 'pid'; S.init.theta0 = 0.1; S.init.hang = false; S.dist.wind = 0; }
    },
    {
      title: '实验 3：串级 PID —— 为什么外环必须慢',
      goal: '体验右半平面零点带来的带宽上限。',
      steps: '选串级 PID → 把外环带宽 ωo 从 1.2 一路调到 4 rad/s（接近 z=4.95）→ 观察位置响应先反向、再振荡、最后失稳。',
      apply: () => { S.mode = 'cascade'; S.pidShape.wo = 1.2; S.ref.mode = 'square'; S.ref.amp = 0.3; S.ref.period = 10; }
    },
    {
      title: '实验 4：LQR 的权重直觉',
      goal: '把 Q/R 与闭环极点位置、控制能量联系起来。',
      steps: '选 LQR → 第四张图切到"极点图" → 单独拉 ρ（0.01→300），看极点如何从"远离虚轴"收缩回来，同时 ∫u²dt 下降。',
      apply: () => { S.mode = 'lqr'; S.plot4 = 'poles'; S.init.theta0 = 0.15; }
    },
    {
      title: '实验 5：PID vs LQR 同台竞技',
      goal: '在完全相同的扰动下定量比较两种控制器。',
      steps: '选对比模式 → 按几次"给摆一击" → 比较 max|θ|、∫u²dt、代价 J；再把方波给定打开比较跟踪能力。',
      apply: () => { S.mode = 'compare'; S.dist.kick = 3; S.ref.mode = 'const'; S.ref.x = 0; }
    },
    {
      title: '实验 6：常值风扰与积分作用',
      goal: '理解静差的来源 x_ss = d / K_x，以及 LQI 如何消除它。',
      steps: '选 LQR，风扰调到 2 N → 记录稳态位置偏差，并与 d/K_x 对比 → 切到 LQR+积分（q_I 调到 4）→ 静差消失。',
      apply: () => { S.mode = 'lqr'; S.dist.wind = 2; S.weights.qi = 0; }
    },
    {
      title: '实验 7：采样周期与延迟的杀伤力',
      goal: '找到临界采样周期，验证解析预测。',
      steps: '选 LQR → 分析面板读出 Ts_crit → 把 Ts 调到 0.8×Ts_crit（仍稳）与 1.2×Ts_crit（发散）→ 再单独加 2~3 拍延迟看后果。',
      apply: () => { S.mode = 'lqr'; S.Ts = 0.01; S.delaySteps = 0; S.init.theta0 = 0.05; }
    },
    {
      title: '实验 8：噪声与微分项',
      goal: '看清"微分放大噪声"这句话的实际后果。',
      steps: '选串级 PID → 角度噪声 σ_θ 调到 0.01 rad → 观察驱动力开始高频抖动、饱和率上升 → 增大内环微分滤波 τ_D 后抖动减小但相位滞后增加。',
      apply: () => { S.mode = 'cascade'; S.pidMode = 'raw'; S.sensor.sigTheta = 0.01; }
    },
    {
      title: '实验 9：模型误差下的鲁棒性',
      goal: '比较 PID 与 LQR 面对"真实对象和设计模型不一致"时的表现。',
      steps: '选对比模式 → 把"真实摆杆质量/设计值"拉到 2.0×、"真实摆长"拉到 1.5× → 谁先倒？再用增益裕度区间解释结果。',
      apply: () => { S.mode = 'compare'; S.mismatch = { m: 2.0, L: 1.5, M: 1 }; }
    },
    {
      title: '实验 10：能量摆起',
      goal: '理解基于能量的非线性控制与"局部最优 + 全局策略"的分工。',
      steps: '选摆起+LQR 模式 → 观察 E−mgl 如何逐周期逼近 0 → 记录切换时刻 → 把执行器上限降到 4 N，看它是否还能摆起来。',
      apply: () => { S.mode = 'swingup'; S.init.hang = true; S.plot4 = 'energy'; }
    }
  ];

  /* 载入实验前先回到干净基线：实验必须可复现，不能继承上一个实验的残留设置 */
  function baseline() {
    Object.assign(S.design, PRESETS.standard.p);
    S.mismatch = { m: 1, L: 1, M: 1 };
    S.weights = Object.assign({}, LQR.DEFAULT_WEIGHTS);
    S.pidMode = 'shape';
    S.pidShape = { wn: 12, zi: 0.9, ki: 4.0, wo: 1.2, zo: 0.7, kio: 0.05, thetaMax: 0.18 };
    S.pid = JSON.parse(JSON.stringify(CTRL.DEFAULT_PID));
    S.sensor = { sigTheta: 0, sigX: 0, quantTheta: 0, quantX: 0 };
    S.dist = { wind: 0, kick: 2.0, push: 0 };
    S.ref = { mode: 'const', x: 0, amp: 0.3, period: 8 };
    S.init = { theta0: 0.12, x0: 0, hang: false };
    S.Ts = 0.01; S.delaySteps = 0; S.speed = 1; S.plot4 = 'phase';
  }

  function buildLabPanel() {
    const root = $('panel-lab');
    root.innerHTML = '<div class="sect-hint">每个实验都有明确的"该看什么"。点击载入会先把全部参数复位到基线（保证实验可复现），再设置本实验所需的参数并重启仿真。完整版实验手册见 docs/教学实验手册.md。</div>';
    LABS.forEach((lab, i) => {
      const box = el('div', 'lab');
      box.appendChild(el('div', 'lab-t', lab.title));
      const g = el('div', 'lab-g'); g.innerHTML = '<b>目标：</b>' + lab.goal; box.appendChild(g);
      const s = el('div', 'lab-s'); s.innerHTML = '<b>步骤：</b>' + lab.steps; box.appendChild(s);
      const b = el('button', 'mini', '载入实验 ' + (i + 1));
      b.addEventListener('click', () => {
        baseline();
        lab.apply();
        setPlot4(S.plot4);
        redesign(); resetSims(); buildScopes();
        buildCtrlPanel(); buildModelPanel(); buildDistPanel(); refreshPanels();
        S.running = true;
        selectPanel('analysis');
      });
      box.appendChild(b);
      root.appendChild(box);
    });
  }

  /* =================== 8. 初始化与事件 =================== */
  function setPlot4(kind) {
    S.plot4 = kind;
    $('sc4p').style.display = kind === 'phase' ? '' : 'none';
    $('sc4m').style.display = kind === 'poles' ? '' : 'none';
    $('sc4e').style.display = kind === 'energy' ? '' : 'none';
    document.querySelectorAll('#plot4Tabs button').forEach((b) => b.classList.toggle('on', b.dataset.plot === kind));
  }

  function selectPanel(name) {
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('on', p.id === 'panel-' + name));
    document.querySelectorAll('#panelTabs button').forEach((b) => b.classList.toggle('on', b.dataset.panel === name));
  }

  function switchMode(mode) {
    S.mode = mode;
    if (mode === 'swingup') S.init.hang = true;
    if (mode !== 'swingup' && S.init.hang && mode !== 'none') S.init.hang = false;
    redesign(); resetSims(); buildScopes();
    buildCtrlPanel(); buildModelPanel(); refreshPanels();
  }

  function init() {
    // 模式标签
    const tabs = $('modeTabs');
    for (const [k, v] of Object.entries(MODES)) {
      const b = el('button', '', v.label);
      b.dataset.mode = k;
      b.addEventListener('click', () => switchMode(k));
      tabs.appendChild(b);
    }
    // 面板标签
    const ptabs = $('panelTabs');
    for (const [k, lbl] of [['ctrl', '控制器'], ['model', '模型'], ['dist', '传感与扰动'], ['analysis', '分析'], ['theory', '理论'], ['lab', '实验']]) {
      const b = el('button', '', lbl);
      b.dataset.panel = k;
      b.addEventListener('click', () => selectPanel(k));
      ptabs.appendChild(b);
    }
    // 第四张图的标签
    const p4 = $('plot4Tabs');
    for (const [k, lbl] of [['phase', '相图 θ–θ̇'], ['poles', 's 平面极点'], ['energy', '能量']]) {
      const b = el('button', '', lbl);
      b.dataset.plot = k;
      b.addEventListener('click', () => setPlot4(k));
      p4.appendChild(b);
    }

    RENDER = new global.Renderer($('stage'));
    PHASE = new Plots.Phase($('sc4p'));
    POLEMAP = new Plots.PoleMap($('sc4m'));

    $('btnPlay').addEventListener('click', () => { S.running = !S.running; refreshPanels(); });
    $('btnStep').addEventListener('click', () => { S.running = false; S.stepOnce = true; refreshPanels(); });
    $('btnReset').addEventListener('click', () => { resetSims(); refreshPanels(); });
    $('btnKick').addEventListener('click', () => kick());
    $('speed').addEventListener('change', (e) => { S.speed = +e.target.value; });

    document.addEventListener('keydown', (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); S.running = !S.running; refreshPanels(); }
      else if (e.key === 'r' || e.key === 'R') { resetSims(); }
      else if (e.key === 'k' || e.key === 'K') { kick(); }
      else if (e.key === 'ArrowLeft') { S.dist.push = -4; }
      else if (e.key === 'ArrowRight') { S.dist.push = 4; }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') S.dist.push = 0;
    });

    redesign();
    resetSims();
    buildScopes();
    buildCtrlPanel(); buildModelPanel(); buildDistPanel(); buildLabPanel();
    setPlot4('phase');
    selectPanel('ctrl');
    refreshPanels();
    requestAnimationFrame(loop);
    global.__DSH_PENDULUM__ = { S: S, redesign: redesign, LA: LA, CP: CP, LQR: LQR, AN: AN };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
