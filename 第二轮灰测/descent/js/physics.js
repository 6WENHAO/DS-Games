/* ============================================================
   physics.js — 自由落体 / 大气阻力 / 气动加热 / 伞 / 过载
   （游戏与离线弹道预测共用同一套积分器）
   ============================================================ */
(function (glob) {
  'use strict';

  const M = 118;            // 人 + 装备 kg
  const CD_TUCK = 0.26, CD_NEUTRAL = 0.60, CD_SPREAD = 1.06;
  const CHUTE_CDA = 30;     // 伞完全张开的 Cd·A
  const LIFT_A = 0.35;      // 机动用等效升力面积
  const T_MAX = 2300;       // 隔热壳许可温度 K
  const Q_DEPLOY = 1500;    // 开伞许可动压 Pa（超过就撕伞）
  const G0 = 9.80665;

  function mk(p) {
    return {
      time: 0, alt: p.startAlt, x: 0, z: 0,
      vx: 0, vy: -p.startVel, vz: 0,
      shellT: 250, hp: 100,
      chute: 0, chuteState: 0, chuteT: 0,
      rho: 0, q: 0, mach: 0, gForce: 1, heat: 0, drag: 0, speed: p.startVel, relSpeed: p.startVel,
      windX: 0, windZ: 0, peakG: 1, peakT: 250, dead: null
    };
  }

  function bodyCdA(body) {
    return body < 0 ? u.lerp(CD_NEUTRAL, CD_TUCK, -body) : u.lerp(CD_NEUTRAL, CD_SPREAD, body);
  }

  /* inp = { body:-1..1, sx, sz, } —— sx/sz 为世界系单位机动方向 */
  function step(st, p, dt, inp) {
    const rho = u.density(st.alt, p.rho0, p.H);
    const w = PLANETS.windAt(p, st.alt, st.time);
    st.windX = w[0]; st.windZ = w[1];
    const rvx = st.vx - w[0], rvy = st.vy, rvz = st.vz - w[1];
    const rs = Math.sqrt(rvx * rvx + rvy * rvy + rvz * rvz) || 1e-6;

    /* 伞张开过程：动压越高，滑块（slider）让伞衣张得越慢 */
    let chuteMul = 1;
    if (st.chuteState === 1) {
      st.chuteT += dt;
      const infl = 1.1 + 2.4 * u.clamp(st.q / 1500, 0, 1);
      st.chute = Math.min(1, st.chuteT / infl);
      const x = (st.chuteT - infl * 0.55) / (infl * 0.25);
      chuteMul = 1 + 0.30 * Math.exp(-x * x);
      if (st.chuteT >= infl) { st.chuteState = 2; st.chute = 1; }
    } else if (st.chuteState === 2) { st.chute = 1; }
    else if (st.chuteState === 3 || st.chuteState === 4) { st.chute = 0; }

    const q = 0.5 * rho * rs * rs;
    let dragA = q * bodyCdA(inp.body) / M;
    /* 伞衣变形 + 滑块：伞贡献的减速度封顶 11 G（真实开伞冲击量级） */
    if (st.chute > 0) dragA += Math.min(q * st.chute * CHUTE_CDA * chuteMul / M, 11 * G0);

    /* 机动权限随动压增长，封顶 */
    const steerMax = (st.chute > 0.4 ? 0.50 : 0.40) * p.g;
    const sa = Math.min(steerMax, q * LIFT_A / M);

    let nx = -dragA * rvx / rs + sa * (inp.sx || 0);
    let ny = -dragA * rvy / rs;
    let nz = -dragA * rvz / rs + sa * (inp.sz || 0);

    st.vx += nx * dt;
    st.vy += (ny - p.g) * dt;
    st.vz += nz * dt;
    st.x += st.vx * dt; st.z += st.vz * dt;
    st.alt += st.vy * dt;
    st.time += dt;

    /* 气动加热：只有超声速才显著（近似 Sutton-Graves） */
    const mach = rs / p.cSound;
    const gate = Math.pow(u.clamp((mach - 1.15) / 2.6, 0, 1), 1.4);
    const qflux = Math.sqrt(Math.max(rho, 0)) * rs * rs * rs * gate;
    const Tamb = u.lerp(170, p.Tsurf || 280, u.clamp(rho / p.rho0, 0, 1));
    const Tt = Tamb + 13 * Math.pow(qflux, 0.25);
    st.shellT += (Tt - st.shellT) * (1 - Math.exp(-dt / 2.2));

    st.rho = rho; st.q = q; st.mach = mach;
    st.drag = dragA;
    st.gForce = Math.sqrt(nx * nx + ny * ny + nz * nz) / G0;
    st.speed = Math.sqrt(st.vx * st.vx + st.vy * st.vy + st.vz * st.vz);
    st.relSpeed = rs;
    st.heat = u.clamp((st.shellT - 700) / 1750, 0, 1);
    if (st.gForce > st.peakG) st.peakG = st.gForce;
    if (st.shellT > st.peakT) st.peakT = st.shellT;

    /* 损伤 */
    if (st.shellT > T_MAX) st.hp -= (st.shellT - T_MAX) * 0.0075 * dt;
    if (st.gForce > 9) st.hp -= (st.gForce - 9) * 1.2 * dt;
    if (st.hp < 0) st.hp = 0;
    return st;
  }

  /* 离线预测：模拟一条"合理玩法"的弹道（再入展开散热 → 中段收拢 → 末段展开开伞）
     用于信标 / 危险区布点，以及菜单里的时长估算 */
  function simPath(p) {
    const st = mk(p);
    const path = [];
    const dt = 0.05;
    const deep = p.objective.type === 'depth';
    const stop = deep ? p.objective.target : 0;
    const vtSpread = Math.sqrt(2 * M * p.g / (p.rho0 * CD_SPREAD));
    const needChute = !deep && vtSpread > p.objective.safe * 0.9;
    const flare = needChute ? u.clamp(52 * vtSpread, 1200, 4200) : 600;
    let n = 0;
    while (st.alt > stop && n < 80000) {
      let body = 0.9;
      if (st.shellT < 1400 && st.mach < 1.3 && st.alt > flare * 2.2) body = -0.85;
      if (st.alt < flare) body = 1;
      if (needChute && st.chuteState === 0 && st.alt < flare && st.q < Q_DEPLOY * 0.85) { st.chuteState = 1; st.chuteT = 0; }
      step(st, p, dt, { body: body, sx: 0, sz: 0 });
      if (n % 8 === 0) path.push({ alt: st.alt, x: st.x, z: st.z, v: st.speed, T: st.shellT, g: st.gForce });
      n++;
    }
    return { path: path, peakG: st.peakG, peakT: st.peakT, vImpact: st.speed, t: st.time, hp: st.hp, needChute: needChute, vtSpread: vtSpread };
  }

  glob.Phys = {
    M: M, CHUTE_CDA: CHUTE_CDA, T_MAX: T_MAX, G0: G0, Q_DEPLOY: Q_DEPLOY,
    CD_SPREAD: CD_SPREAD, CD_TUCK: CD_TUCK,
    mk: mk, step: step, simPath: simPath, bodyCdA: bodyCdA
  };
})(window);
