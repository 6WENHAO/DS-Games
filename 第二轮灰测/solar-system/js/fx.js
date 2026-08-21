/* =======================================================================
 *  fx.js  —  特效系统（全部由物理量驱动，不使用美术假动画）
 *
 *   · 来袭天体：调用 Impact.makeEntry() 做真实的气动阻力 + 烧蔽 + 解体积分，
 *     屏幕上的减速、增亮、解体高度、空爆位置都是方程解出来的。
 *   · 喷出物：落点半径分布由喷出物毯厚度定律 t(r) ∝ r⁻³ 推出
 *     （P(range>r) = r_min/r），45° 弹道给出发射速度 v = √(g·r)，
 *     之后按真实引力场 a = −GM/r² 做弹道积分，超过逃逸速度的自然飞走。
 *   · 火球寿命取膨胀时标 R_f / 3 km·s⁻¹；熔体辉光取辐射结壳时标。
 *   · 全部演化使用“模拟时钟”（秒），与行星自转、公转、尘埃沉降共用同一个时间轴。
 * ======================================================================= */
(function (global) {
  'use strict';
  const SS = (global.SS = global.SS || {});
  const M = SS.M, V = SS.M.v3, M3 = SS.M.m3;

  const MAXP = 14000;

  const FX = {
    meteors: [],
    flashes: [],
    // 粒子位置一律存"相对所属天体中心"的坐标。
    // 这一点很关键：Float32 在 5 AU 处的最小间隔约 47 km，若存世界坐标，
    // 喷出物离地几公里的位移会被浮点精度直接吞掉。
    P: {
      pos: new Float32Array(MAXP * 3),
      vel: new Float32Array(MAXP * 3),
      attr: new Float32Array(MAXP * 4),   // size(单位), 温度, 寿命比, 类型
      body: new Int16Array(MAXP),
      life: new Float32Array(MAXP),
      maxLife: new Float32Array(MAXP),
      alive: new Uint8Array(MAXP),
      head: 0, count: 0,
    },
    // 绘制缓冲同样是天体本地坐标，由渲染器加上"天体−相机"的双精度偏移
    draw: {
      pos: new Float32Array(MAXP * 3),
      attr: new Float32Array(MAXP * 4),
      body: new Int16Array(MAXP),
      n: 0,
    },
    onImpact: null,
    onLaunchInfo: null,
    dbgKill: { radius: 0, life: 0, spawned: 0 },
  };

  /* ------------------------------ 粒子池 ----------------------------- */
  /** pos / vel 均为相对该天体中心的坐标（单位 / 单位每秒） */
  function spawn(bodyIdx, pos, vel, size, temp, life, kind) {
    const P = FX.P;
    let i = -1;
    for (let k = 0; k < 96; k++) {
      const j = (P.head + k) % MAXP;
      if (!P.alive[j]) { i = j; break; }
    }
    if (i < 0) i = P.head % MAXP;
    P.head = (i + 1) % MAXP;
    P.alive[i] = 1;
    P.pos[i * 3] = pos[0]; P.pos[i * 3 + 1] = pos[1]; P.pos[i * 3 + 2] = pos[2];
    P.vel[i * 3] = vel[0]; P.vel[i * 3 + 1] = vel[1]; P.vel[i * 3 + 2] = vel[2];
    P.attr[i * 4] = size; P.attr[i * 4 + 1] = temp; P.attr[i * 4 + 2] = 0; P.attr[i * 4 + 3] = kind;
    P.body[i] = bodyIdx;
    P.life[i] = 0; P.maxLife[i] = life;
    FX.dbgKill.spawned++;
  }
  FX.spawn = spawn;

  FX.clear = function () {
    FX.P.alive.fill(0);
    FX.meteors.length = 0;
    FX.flashes.length = 0;
  };

  /* --------------------------- 发射来袭天体 -------------------------- */
  /**
   * @param opt {body, dirLocal, angle(°), azimuth(rad), velocity(km/s),
   *             diameter(m), material, result}
   * 返回值含 flightSeconds —— 真实的物理飞行时间（秒），供 UI 设定时间倍率
   */
  FX.launch = function (opt) {
    const body = opt.body;
    const def = body.def;
    const n = V.norm(V.clone(opt.dirLocal));
    // 由入射角与方位角构造入射速度方向（体坐标）
    const t0 = V.perp(n);
    const b0 = V.cross(n, t0);
    const az = opt.azimuth || 0;
    const tang = V.norm([
      t0[0] * Math.cos(az) + b0[0] * Math.sin(az),
      t0[1] * Math.cos(az) + b0[1] * Math.sin(az),
      t0[2] * Math.cos(az) + b0[2] * Math.sin(az),
    ]);
    const th = M.clamp(opt.angle, 3, 90) * Math.PI / 180;
    const vDirLocal = V.norm([
      -(Math.sin(th) * n[0] + Math.cos(th) * tang[0]),
      -(Math.sin(th) * n[1] + Math.cos(th) * tang[1]),
      -(Math.sin(th) * n[2] + Math.cos(th) * tang[2]),
    ]);

    // 起始高度：有大气 → 大气顶之上一段，便于看到"进入"；真空 → 固定 300 km
    const atmoTop = def.atmo ? def.atmo.top * 1000 : 0;
    const z0 = def.atmo ? atmoTop * 2.2 : Math.min(400000, def.radius * 1000 * 0.12);

    const sim = SS.Impact.makeEntry({
      L: opt.diameter, rho: opt.material.density, v0: opt.velocity * 1000,
      angle: opt.angle, atmo: def.atmo, gSurf: def.g, Rbody: def.radius * 1000,
      strength: opt.material.strength, z0,
    });

    // 物理飞行时间估算（用于时间倍率）：真空段匀速 + 大气段减速
    const vAvg = Math.max(sim.v * 0.55, 500);
    const flightSeconds = (z0 / Math.sin(th)) / vAvg;

    const m = {
      body, res: opt.result, mat: opt.material,
      dirLocal: n, vDirLocal, tangLocal: tang, angle: opt.angle, th,
      sim, z0, flightSeconds,
      trail: [], lum: 0, alt: z0, t: 0,
      L: opt.diameter,
      radiusUnits: Math.max(opt.diameter / 2e6, body.radius * 0.0012),
      pos: [0, 0, 0],
      done: false,
    };
    FX.meteors.push(m);
    return m;
  };

  /** 沿入射直线、精确落在半径 R+z 球面上的那一点 */
  function pointAtAltitude(impactPoint, center, vDirW, R, z) {
    const I = [impactPoint[0] - center[0], impactPoint[1] - center[1], impactPoint[2] - center[2]];
    const b = V.dot(I, vDirW);                            // = -R·sinθ
    const s = -b + Math.sqrt(Math.max(0, b * b + 2 * R * z + z * z));
    return [
      impactPoint[0] - vDirW[0] * s,
      impactPoint[1] - vDirW[1] * s,
      impactPoint[2] - vDirW[2] * s,
    ];
  }

  /* --------------------------- 撞击瞬间 ------------------------------ */
  FX.spawnImpact = function (body, dirLocal, res, opts) {
    const world = SS.World;
    const sizeBoost = (opts && opts.sizeBoost) || 1;
    const R = body.radius * (body.id === 'sun' ? 1 : sizeBoost);   // 单位
    const Rm = body.radiusM;
    const nWorld = V.norm(M3.xform(body.rotM, dirLocal));
    const sev = res.severity || 0.2;
    const gasburst = res.outcome === 'gasburst';
    const airburst = res.outcome === 'airburst' || res.outcome === 'burnup';
    const altUnits = (airburst || gasburst) ? (res.entry.burstAlt || 0) / 1e6 : 0;
    // 撞击点（天体本地坐标）：地表半径 + 爆发高度
    const origin = V.scale(nWorld, R + altUnits);

    // ---- 火球：半径 R_f = 0.002·E^(1/3)，寿命取 R_f / 3 km·s⁻¹ 的膨胀时标 ----
    const fbRm = res.thermal ? Math.max(res.thermal.fireballR, Rm * 2e-4) : Rm * 4e-4;
    const fbR = fbRm / 1e6;
    const fbLife = M.clamp(fbRm / 3000, 0.25, 400);
    FX.flashes.push({
      pos: origin, t: 0, dur: fbLife,
      size0: fbR * 0.28, size1: fbR * (gasburst ? 4.5 : 1.9),
      color: [1.0, 0.93, 0.80], peak: 40 + sev * 240,
      core: 0.5, turb: 0.35, body, dirLocal, alt: altUnits,
    });
    // 冷却中的余烬（同一团火球的后期，寿命更长、更红）
    FX.flashes.push({
      pos: origin, t: 0, dur: fbLife * 6,
      size0: fbR * 0.5, size1: fbR * (gasburst ? 11 : 4.2),
      color: [1.0, 0.48, 0.16], peak: 4 + sev * 26,
      core: 0.2, turb: 0.9, body, dirLocal, alt: altUnits,
    });

    if (res.outcome === 'vaporized' || res.outcome === 'burnup' && !res.blast) return;

    /* ---- 喷出物：由 t(r) ∝ r⁻³ 推出的落点分布 ---- */
    const g = body.def.g;
    const ej = res.ejecta;
    const rMin = ej ? ej.rMin : (res.entry ? res.entry.effectiveL * 3 : 50);
    const rEsc = ej ? ej.rEsc : (body.def.vesc * 1000) ** 2 / g;
    let count = Math.floor(200 + sev * 5000);
    if (gasburst) count = Math.floor(500 + sev * 2200);
    if (airburst) count = Math.floor(120 + sev * 700);
    count = Math.min(count, 6200);

    const t1 = V.perp(nWorld);
    const t2 = V.cross(nWorld, t1);
    // 斜撞击的下游方向 = 入射速度的水平分量（喷出物在下游明显更多）
    let downRange = [0, 0, 0];
    if (opts && opts.vDirLocal) {
      const vW = V.norm(M3.xform(body.rotM, opts.vDirLocal));
      const horiz = V.sub(vW, V.scale(nWorld, V.dot(vW, nWorld)));
      if (V.len2(horiz) > 1e-12) downRange = V.norm(horiz);
    }
    const obliquity = 1 - Math.sin(M.clamp(res.input.angle, 3, 90) * Math.PI / 180);

    const rangeCap = Math.max(rMin * 4, Math.min(rEsc * 2.5, Math.PI * Rm * 4));
    for (let i = 0; i < count; i++) {
      // P(range > r) = rMin / r  →  range = rMin / u
      const u = Math.max(1e-4, Math.random());
      const range = Math.min(rMin / u, rangeCap);
      const vMag = Math.sqrt(g * range);                     // 45° 弹道
      const launch = (45 + (Math.random() - 0.5) * 14) * Math.PI / 180;  // 观测 40–50°
      let azr = Math.random() * Math.PI * 2;
      const dirH = [
        t1[0] * Math.cos(azr) + t2[0] * Math.sin(azr),
        t1[1] * Math.cos(azr) + t2[1] * Math.sin(azr),
        t1[2] * Math.cos(azr) + t2[2] * Math.sin(azr),
      ];
      // 斜撞击：下游方向权重更高
      const bias = obliquity * 0.6 * Math.random();
      const dir = V.norm([
        nWorld[0] * Math.sin(launch) + dirH[0] * Math.cos(launch) + downRange[0] * bias,
        nWorld[1] * Math.sin(launch) + dirH[1] * Math.cos(launch) + downRange[1] * bias,
        nWorld[2] * Math.sin(launch) + dirH[2] * Math.cos(launch) + downRange[2] * bias,
      ]);
      const off = R * (0.0004 + Math.random() * 0.0035);
      const escaping = vMag > body.def.vesc * 1000;
      // 温度：坑内近处物质更热（受冲击更强）
      const temp = M.clamp(0.25 + 0.75 * Math.pow(u, 0.35), 0, 1);
      const life = escaping ? 4e5 : Math.max(8, (2 * vMag * Math.sin(launch) / g) * 1.25);
      spawn(body.index,
        [origin[0] + dir[0] * off, origin[1] + dir[1] * off, origin[2] + dir[2] * off],
        V.scale(dir, vMag / 1e6),
        R * 0.0012 * (0.35 + Math.random() * 1.4), temp, life, escaping ? 2 : 0);
    }

    /* ---- 高温蒸气羽流：速度量级为撞击速度的若干分之一 ---- */
    const vi = res.entry ? res.entry.v : 1e4;
    const plumeN = Math.floor(60 + sev * 800);
    for (let i = 0; i < plumeN; i++) {
      const jitter = V.norm([
        nWorld[0] + (Math.random() - 0.5) * 0.55,
        nWorld[1] + (Math.random() - 0.5) * 0.55,
        nWorld[2] + (Math.random() - 0.5) * 0.55,
      ]);
      const sp = vi * (0.08 + Math.random() * 0.22) * (gasburst ? 1.6 : 1.0);
      spawn(body.index, [
        origin[0] + jitter[0] * R * 0.002,
        origin[1] + jitter[1] * R * 0.002,
        origin[2] + jitter[2] * R * 0.002,
      ], V.scale(jitter, sp / 1e6), R * 0.0035 * (0.5 + Math.random()), 1.0,
        Math.max(12, (2 * sp * 0.7) / g), 1);
    }

    /* ---- 逃逸物质入轨：只有速度介于环绕与逃逸之间的碎屑能留下 ---- */
    if (!gasburst && ej && ej.escapeFraction > 0.002 && sev > 0.45) {
      const vCirc = Math.sqrt(g * Rm);
      const ringN = Math.floor(200 + sev * 1200);
      for (let i = 0; i < ringN; i++) {
        const azr = Math.random() * Math.PI * 2;
        const dirH = [
          t1[0] * Math.cos(azr) + t2[0] * Math.sin(azr),
          t1[1] * Math.cos(azr) + t2[1] * Math.sin(azr),
          t1[2] * Math.cos(azr) + t2[2] * Math.sin(azr),
        ];
        const launch = (12 + Math.random() * 28) * Math.PI / 180;
        const dir = V.norm([
          nWorld[0] * Math.sin(launch) + dirH[0] * Math.cos(launch),
          nWorld[1] * Math.sin(launch) + dirH[1] * Math.cos(launch),
          nWorld[2] * Math.sin(launch) + dirH[2] * Math.cos(launch),
        ]);
        const sp = vCirc * (0.94 + Math.random() * 0.44);       // 环绕 ~ 逃逸之间
        spawn(body.index, [
          origin[0] + nWorld[0] * R * 0.01,
          origin[1] + nWorld[1] * R * 0.01,
          origin[2] + nWorld[2] * R * 0.01,
        ], V.scale(dir, sp / 1e6), R * 0.0014 * (0.4 + Math.random()), 0.2, 4e5, 3);
      }
    }
  };

  /* --------------------------- 每帧更新 ------------------------------ *
   *  dtSim = 本帧推进的“模拟秒数”（= 天数 × 86400），与世界时钟一致
   * ------------------------------------------------------------------ */
  FX.update = function (dtSim, sizeBoost) {
    const world = SS.World;
    sizeBoost = sizeBoost || 1;

    /* ---------- 来袭天体 ---------- */
    for (let i = FX.meteors.length - 1; i >= 0; i--) {
      const m = FX.meteors[i];
      const body = m.body;
      const R = body.radius * (body.id === 'sun' ? 1 : sizeBoost);
      const Rm = body.radiusM;
      m.t += dtSim;
      m.sim.step(dtSim);
      const s = m.sim;
      m.lum = s.lum;
      m.alt = s.z;

      const impactPoint = world.surfacePoint(body, m.dirLocal, 0, sizeBoost);
      const vDirW = V.norm(M3.xform(body.rotM, m.vDirLocal));
      m.pos = pointAtAltitude(impactPoint, body.pos, vDirW, R, (s.z / 1e6) * (R / body.radius));

      // 等离子尾迹（真实尾迹可见数秒）
      if (s.z < (body.def.atmo ? body.def.atmo.top * 1000 : 1e9)) {
        m.trail.push({ p: V.clone(m.pos), t: 0, lum: m.lum });
        if (m.trail.length > 130) m.trail.shift();
      }
      for (const tp of m.trail) tp.t += dtSim;
      while (m.trail.length && m.trail[0].t > 4) m.trail.shift();

      // 烧蔽碎屑：单位时间抛出的质量 ∝ 沉积功率
      if (m.lum > 0.03) {
        const nSp = Math.min(6, Math.floor(m.lum * 6 * Math.min(dtSim, 1) * 8) + 1);
        for (let k = 0; k < nSp; k++) {
          const j = [
            (Math.random() - 0.5) * m.radiusUnits * 4,
            (Math.random() - 0.5) * m.radiusUnits * 4,
            (Math.random() - 0.5) * m.radiusUnits * 4,
          ];
          spawn(body.index, [
            m.pos[0] - body.pos[0] + j[0],
            m.pos[1] - body.pos[1] + j[1],
            m.pos[2] - body.pos[2] + j[2],
          ], V.scale(vDirW, (s.v * 0.25) / 1e6),
            m.radiusUnits * (0.5 + Math.random() * 2.2), 1.0, 1.5 + Math.random() * 3, 1);
        }
      }

      if (s.burst || s.burnt || s.landed || m.t > m.flightSeconds * 12) {
        FX.meteors.splice(i, 1);
        m.done = true;
        // 物理判定的落点/爆点写回结果（与预测一致，取实测值更诚实）
        if (m.res && m.res.entry) {
          if (s.burst || s.burnt) m.res.entry.liveBurstAlt = s.burstAlt;
          m.res.entry.liveV = s.v;
        }
        FX.spawnImpact(body, m.dirLocal, m.res, { sizeBoost, vDirLocal: m.vDirLocal });
        world.applyImpact(body, m.dirLocal, m.res, m.mat);
        if (FX.onImpact) FX.onImpact(body, m.res, m.dirLocal);
      }
    }

    /* ---------- 闪光 ---------- */
    for (let i = FX.flashes.length - 1; i >= 0; i--) {
      const f = FX.flashes[i];
      f.t += dtSim;
      if (f.body) f.pos = SS.World.surfacePoint(f.body, f.dirLocal, f.alt || 0, sizeBoost);
      if (f.t > f.dur) FX.flashes.splice(i, 1);
    }

    /* ---------- 弹道粒子（真实引力场积分） ---------- */
    const P = FX.P, D = FX.draw;
    // 大步长时拆成子步；若倍率过高，弹道早已结束 → 让它们落定消失
    let steps = Math.max(1, Math.ceil(dtSim / 25));
    let dropBallistic = false;
    if (steps > 10) { steps = 10; dropBallistic = true; }
    const h = dtSim / steps;

    let n = 0;
    for (let i = 0; i < MAXP; i++) {
      if (!P.alive[i]) continue;
      const kind = P.attr[i * 4 + 3];
      P.life[i] += dtSim;
      if (P.life[i] >= P.maxLife[i] || (dropBallistic && kind !== 3 && kind !== 2)) {
        P.alive[i] = 0; FX.dbgKill.life++; continue;
      }
      const body = world.bodies[P.body[i]];
      const R = body.radius * (body.id === 'sun' ? 1 : sizeBoost);
      const gUnits = body.def.g / 1e6;              // m/s² → 单位/s²
      let px = P.pos[i * 3], py = P.pos[i * 3 + 1], pz = P.pos[i * 3 + 2];
      let vx = P.vel[i * 3], vy = P.vel[i * 3 + 1], vz = P.vel[i * 3 + 2];
      let dead = false;
      for (let k = 0; k < steps; k++) {
        const r = Math.hypot(px, py, pz) || 1e-12;
        // a = −g₀·(R/r)²·r̂   （真实平方反比引力）
        const a = -gUnits * (body.radius / r) * (body.radius / r);
        vx += (px / r) * a * h; vy += (py / r) * a * h; vz += (pz / r) * a * h;
        px += vx * h; py += vy * h; pz += vz * h;
        const r2 = Math.hypot(px, py, pz);
        if (r2 < R * 1.0002) { dead = true; break; }
        if (r2 > R * 4000) { dead = true; break; }
      }
      if (dead) { P.alive[i] = 0; FX.dbgKill.radius++; continue; }
      P.pos[i * 3] = px; P.pos[i * 3 + 1] = py; P.pos[i * 3 + 2] = pz;
      P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz;
      // 辐射降温：热碎屑在几十秒内变暗
      const coolTau = kind === 1 ? 25 : (kind === 3 ? 600 : 60);
      P.attr[i * 4 + 1] *= Math.exp(-dtSim / coolTau);
      P.attr[i * 4 + 2] = P.life[i] / P.maxLife[i];

      D.pos[n * 3] = px; D.pos[n * 3 + 1] = py; D.pos[n * 3 + 2] = pz;
      D.attr[n * 4] = P.attr[i * 4]; D.attr[n * 4 + 1] = P.attr[i * 4 + 1];
      D.attr[n * 4 + 2] = Math.min(P.attr[i * 4 + 2], 0.999); D.attr[n * 4 + 3] = kind;
      D.body[n] = P.body[i];
      n++;
    }
    D.n = n;
    P.count = n;
  };

  SS.FX = FX;
})(window);
