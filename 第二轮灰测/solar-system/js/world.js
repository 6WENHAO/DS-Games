/* =======================================================================
 *  world.js  —  太阳系状态：开普勒轨道传播、自转、每个天体的可变状态
 *  （撞击坑清单 / 尘埃 / 生物圈 / 冰盖 / 自转变化 / 伤痕图）
 *  长度单位：1 unit = 1000 km；时间：儒略日（自 J2000 起算的天数）
 * ======================================================================= */
(function (global) {
  'use strict';
  const SS = (global.SS = global.SS || {});
  const M = SS.M, V = SS.M.v3, M3 = SS.M.m3;
  const DEG = Math.PI / 180;

  function Body(def, index) {
    this.def = def;
    this.index = index;
    this.id = def.id;
    this.radius = def.radius / 1000;          // units
    this.radiusM = def.radius * 1000;         // m
    this.pos = [0, 0, 0];
    this.posLocal = [0, 0, 0];                // 相对母天体
    this.parent = null;
    this.spin = Math.random() * Math.PI * 2;
    this.rotM = M3.identity();
    this.tiltM = M3.identity();
    this.north = [0, 1, 0];
    this.orbitBasis = M3.identity();
    this.orbitA = 0; this.orbitB = 0; this.orbitPhase = 0;
    this.screenSize = 0;                      // 上一帧的屏幕占比（用于 LOD）
    this.scar = null;                         // 伤痕图 render target（惰性分配）
    this.craters = [];                        // 解析坑（最近 4 个）
    this.blots = [];                          // 气体行星伤痕
    this.rings = [];                          // 表面事件环（冲击波 / 海啸）
    this.seed = (index * 137.13) % 100;
    this.st = {
      dust: 0, tau: 0, insolation: 1, damaged: 0, green: 1, iceBoost: 0, cityLights: 1,
      snowLineLat: null,
      impacts: 0, energy: 0, craterCount: 0, massLost: 0,
      rotHours: def.rotHours, tilt: def.tilt,
      biggestCraterKm: 0, lastOutcome: null, escapedMass: 0,
    };
  }

  Body.prototype.reset = function () {
    this.craters.length = 0;
    this.blots.length = 0;
    this.rings.length = 0;
    this.st.dust = 0; this.st.tau = 0; this.st.insolation = 1; this.st.damaged = 0;
    this.st.green = 1;
    this.st.iceBoost = 0; this.st.cityLights = 1;
    this.st.impacts = 0; this.st.energy = 0; this.st.craterCount = 0;
    this.st.massLost = 0; this.st.escapedMass = 0;
    this.st.rotHours = this.def.rotHours; this.st.tilt = this.def.tilt;
    this.st.biggestCraterKm = 0; this.st.lastOutcome = null;
    this.st.tau = 0; this.st.damaged = 0; this.st.insolation = 1;
    this.st.snowLineLat = null;
    if (this.scar) this.scarDirty = 'clear';
  };

  const World = {
    bodies: [],
    byId: {},
    simDays: 0,          // 自 J2000 起算
    fxTime: 0,           // 特效用的真实秒数
  };

  World.init = function () {
    World.bodies = SS.DATA.BODIES.map((d, i) => new Body(d, i));
    World.byId = {};
    World.bodies.forEach((b) => { World.byId[b.id] = b; });
    World.bodies.forEach((b) => {
      if (b.def.parent) b.parent = World.byId[b.def.parent];
    });
    // 以当前真实时刻作为起点（J2000 = 2000-01-01 12:00 TT）
    World.simDays = (Date.now() - Date.UTC(2000, 0, 1, 12, 0, 0)) / 86400000;
    World.update(0);
    return World;
  };

  /** 轨道平面基：列向量 = (近点方向, 法线, 副法线) */
  function orbitBasis(el, parentTilt) {
    const O = el.om * DEG, i = el.i * DEG, w = el.w * DEG;
    const cO = Math.cos(O), sO = Math.sin(O);
    const cI = Math.cos(i), sI = Math.sin(i);
    const cW = Math.cos(w), sW = Math.sin(w);
    // 黄道坐标 (X,Y,Z=north) → 引擎坐标 (x, y=north, z=-Y)
    const toEngine = (X, Y, Z) => [X, Z, -Y];
    const px = toEngine(cO * cW - sO * sW * cI, sO * cW + cO * sW * cI, sW * sI);
    const py = toEngine(-cO * sW - sO * cW * cI, -sO * sW + cO * cW * cI, cW * sI);
    const pn = V.norm(V.cross(px, py));
    let basis = M3.fromBasis(px, pn, py);
    if (parentTilt) basis = M3.mul(parentTilt, basis);
    return basis;
  }

  /** 天体的自转矩阵：转轴倾角 + 自转相位 */
  function spinMatrix(tiltDeg, nodeDeg, spin) {
    const node = nodeDeg * DEG;
    const axis = [Math.cos(node), 0, Math.sin(node)];
    const tilt = M3.axisAngle(axis, tiltDeg * DEG);
    return { rot: M3.mul(tilt, M3.rotY(spin)), tilt };
  }

  World.update = function (dDays) {
    World.simDays += dDays;
    const t = World.simDays;

    for (const b of World.bodies) {
      const d = b.def;
      // ---- 自转：相位是增量积分的 ----
      // （不能用 t·24/rotHours 直接算：撞击改变自转周期后，
      //   那样会把过去几千天的自转历史也一起改写）
      const rotH = b.st.rotHours || 1e9;
      if (b.spinPhase === undefined) {
        b.spinPhase = (t * 24 / rotH) * Math.PI * 2 + b.seed;
      } else {
        b.spinPhase += (dDays * 24 / rotH) * Math.PI * 2;
      }
      b.spin = b.spinPhase;
      const nodeDeg = (b.index * 47.3) % 360;
      const sm = spinMatrix(b.st.tilt, nodeDeg, b.spinPhase);
      b.rotM = sm.rot;
      b.tiltM = sm.tilt;
      b.north = M3.xform(sm.tilt, [0, 1, 0]);

      // ---- 轨道 ----
      if (!d.orbit) { b.pos[0] = b.pos[1] = b.pos[2] = 0; continue; }
      const el = d.orbit;
      const isMoon = !!(b.parent && b.parent.def.parent !== null) || (b.parent && b.parent.id !== 'sun');
      const basis = orbitBasis(el, isMoon ? b.parent.tiltM : null);
      const n = (Math.PI * 2) / el.T;                 // 平均角速度 rad/day
      const Mean = el.M0 * DEG + n * t;
      const E = M.solveKepler(((Mean % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), el.e);
      const aU = el.a / 1000;                          // km → units
      const bU = aU * Math.sqrt(Math.max(0, 1 - el.e * el.e));
      const xp = aU * (Math.cos(E) - el.e);
      const zp = bU * Math.sin(E);
      const local = M3.xform(basis, [xp, 0, zp]);
      b.posLocal = local;
      b.orbitBasis = basis;
      b.orbitA = aU; b.orbitB = bU;
      b.orbitPhase = Math.atan2(zp, xp) / (Math.PI * 2);
      b.orbitCenterOffset = -aU * el.e;                // 椭圆中心相对焦点
      const base = b.parent ? b.parent.pos : [0, 0, 0];
      b.pos[0] = base[0] + local[0];
      b.pos[1] = base[1] + local[1];
      b.pos[2] = base[2] + local[2];
    }

    // 母天体先算完再算卫星（按数据顺序保证：母天体总在前）
    for (const b of World.bodies) {
      if (b.parent && b.def.orbit) {
        b.pos[0] = b.parent.pos[0] + b.posLocal[0];
        b.pos[1] = b.parent.pos[1] + b.posLocal[1];
        b.pos[2] = b.parent.pos[2] + b.posLocal[2];
      }
    }
  };

  /* ------------------------------------------------------------------ *
   *  行星尺度的物理演化
   *  dtSim = 本帧推进的模拟秒数；dDays = 同一段时间的天数
   *  尘幕沉降、雪线移动、植被恢复、熔体冷却、冲击环扩散全部用物理时标
   * ------------------------------------------------------------------ */
  const YEAR = 365.25;
  const DUST_TAU_YEARS = 1.5;      // 平流层气溶胶 e 折沉降时标（皮纳图博 ~1 年）
  const REGROW_YEARS = 500;        // 植被覆盖恢复（原生林恢复的量级）
  const CIVIL_YEARS = 120;         // 受灾区重建的量级（非物理定律，仅作指示）

  World.evolve = function (dtSim, dDays) {
    World.fxTime += dtSim;
    const yr = dDays / YEAR;
    for (const b of World.bodies) {
      const st = b.st;
      const def = b.def;

      // ---- 平流层尘幕：指数沉降 ----
      if (st.tau > 1e-4) {
        st.tau *= Math.exp(-yr / DUST_TAU_YEARS);
        if (st.tau < 5e-4) st.tau = 0;
      }
      st.dust = st.tau;                                 // 供着色器使用
      st.insolation = SS.Impact.insolationFactor(st.tau);

      // ---- 一维能量平衡 → 雪线纬度移动 ----
      if (def.look.ice > 0) {
        const T0 = def.id === 'earth' ? 255 : (def.id === 'mars' ? 210 : 200);
        const shiftDeg = SS.Impact.snowLineShift(st.tau, T0, 0.55);
        const lat0 = Math.asin(Math.min(1, def.look.ice)) * 180 / Math.PI;
        const lat1 = Math.max(0, lat0 - shiftDeg);
        // 着色器里比较的是 sin(纬度)，这里直接给出偏移量
        st.iceBoost = Math.min(def.look.ice, Math.sin(lat0 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180));
        st.snowLineLat = lat1;
      }

      // ---- 生物圈：光合作用需要光；被直接摧毁的面积另算 ----
      if (def.id === 'earth') {
        const photo = M.clamp((st.insolation - 0.04) / 0.45, 0, 1);
        const target = M.clamp((1 - st.damaged) * photo, 0.02, 1);
        st.green += (target - st.green) * (1 - Math.exp(-yr / (REGROW_YEARS / 3)));
        if (st.green > target) st.green = Math.max(target, st.green * Math.exp(-yr / 0.15));
        // 受灾面积按重建时标缓慢恢复
        st.damaged *= Math.exp(-yr / CIVIL_YEARS);
        const cityTarget = M.clamp((1 - st.damaged) * M.clamp(st.insolation * 1.6, 0.05, 1), 0.01, 1);
        st.cityLights += (cityTarget - st.cityLights) * (1 - Math.exp(-yr / (CIVIL_YEARS / 4)));
      }

      // ---- 熔体辉光：辐射结壳时标（Impact.meltGlowSeconds）----
      for (const c of b.craters) {
        if (c.hot > 0) {
          c.hot = c.glowSeconds > 0 ? c.hot * Math.exp(-dtSim / c.glowSeconds) : 0;
          if (c.hot < 0.004) c.hot = 0;
        }
      }

      // ---- 气体行星伤痕：被环流剪切并随时间消散 ----
      for (let i = b.blots.length - 1; i >= 0; i--) {
        const bl = b.blots[i];
        bl.age += dDays / bl.lifeDays;
        bl.shear = Math.min(1.8, bl.shear + (dDays / bl.lifeDays) * 1.1);
        if (bl.age >= 1) b.blots.splice(i, 1);
      }

      // ---- 表面波环：真实波速传播，振幅按超压/几何扩散衰减 ----
      for (let i = b.rings.length - 1; i >= 0; i--) {
        const r = b.rings[i];
        r.t += dtSim;
        r.ang = (r.speed * r.t) / b.radiusM;
        // 波前拉宽（弥散）
        r.width = r.width0 * (1 + r.ang * 1.5);
        // 冲击波超压按 Collins 式衰减；地震/海啸按球面几何 1/√sinθ
        if (r.type === 0) {
          r.k = r.k0 / (1 + Math.pow(r.ang / Math.max(r.angRef, 1e-4), 1.3));
        } else {
          const sp = Math.max(Math.sin(Math.min(r.ang, Math.PI - 1e-3)), 0.02);
          r.k = r.k0 * Math.sqrt(Math.max(r.angRef, 1e-4) / sp) * Math.exp(-r.ang / 3.2);
        }
        if (r.ang > Math.PI * 1.02 || r.k < 0.004) b.rings.splice(i, 1);
      }
    }
  };

  /* ------------------------------------------------------------------ *
   *  撞击落地：把物理结果转成持久的视觉改造
   * ------------------------------------------------------------------ */
  World.applyImpact = function (body, dirLocal, res, mat) {
    const st = body.st;
    st.impacts++;
    st.energy += res.E0;
    st.lastOutcome = res.outcome;
    const def = body.def;
    const look = def.look;

    // --- 气体巨行星：深色气溶胶伤痕 ---
    if (res.outcome === 'gasburst' && res.gas) {
      const angR = (res.gas.scarKm / 2) / def.radius;
      body.blots.unshift({
        dir: V.clone(dirLocal),
        angR: Math.max(0.004, Math.min(1.2, angR)),
        depth: 0.95,
        age: 0,
        shear: 0,
        lifeDays: res.gas.lifetimeDays,
      });
      if (body.blots.length > 4) body.blots.length = 4;
      body.rings.push(ringSpec(body, dirLocal, 'shock', res, 1.0));
      return;
    }

    // --- 恒星 / 烧毁 / 亚音速陨落：没有持久地貌 ---
    if (res.outcome === 'vaporized' || res.outcome === 'burnup') return;

    // --- 空爆：地表没有坑，但有冲击波环与（大气行星上的）尘环 ---
    if (res.outcome === 'airburst') {
      body.rings.push(ringSpec(body, dirLocal, 'shock', res, 1.0));
      if (res.blast && !res.blast.none && res.blast.r_forest > body.radiusM * 0.002) {
        const angR = res.blast.r_forest / body.radiusM;
        pushCrater(body, {
          dir: V.clone(dirLocal), angR,
          depth: 0, rim: 0, peak: 0, ejecta: 0,
          albFloor: -0.22, albRay: 0.05, melt: 0,
          type: 0, rayReach: 1.6, seed: Math.random() * 50,
          terrace: 0, hot: 0.15, glowSeconds: 40, isBlast: true,
        });
      }
      st.tau += res.globalDust || 0;
      st.damaged = Math.min(1, st.damaged + (res.damagedFraction || 0));
      return;
    }

    if (res.outcome === 'fall') {
      body.rings.push(ringSpec(body, dirLocal, 'shock', res, 0.25));
      return;
    }

    // --- 落地成坑 ---
    const cr = res.crater;
    if (!cr) return;
    const isIce = def.target.type === 'ice';
    const isOcean = res.input.ocean;
    const airless = !def.atmo || SS.Impact.surfacePressure(def.atmo, def.g) < 5000;

    const angR = Math.max(1.5e-5, cr.angRadius);
    const dfr = cr.DfrEff > 0 ? cr.dfr : cr.dtc * 0.25;
    const ejectaRef = res.ejecta ? res.ejecta.thicknessAt(Math.max(cr.Dfr / 2, 1)) : 0;
    const meltFrac = Math.min(1, cr.meltDepth / Math.max(dfr, 1)) * 0.9;

    let albFloor, albRay;
    if (isIce) { albFloor = 0.35; albRay = 0.75; }
    else if (body.id === 'earth') { albFloor = -0.18; albRay = 0.12; }
    else if (body.id === 'mars') { albFloor = -0.12; albRay = 0.28; }
    else if (body.id === 'io') { albFloor = -0.30; albRay = 0.35; }
    else { albFloor = -0.20; albRay = 0.45; }
    if (isOcean) { albFloor = -0.05; albRay = 0.0; }

    if (cr.DfrEff > 0) {
      pushCrater(body, {
        dir: V.clone(dirLocal),
        angR,
        depth: dfr,
        rim: cr.rim,
        peak: cr.centralPeak ? dfr * 0.45 : 0,
        ejecta: ejectaRef,
        albFloor, albRay,
        melt: meltFrac,
        type: cr.type === 'simple' ? 0 : (cr.type === 'basin' ? 2 : 1),
        rayReach: airless ? Math.min(9, res.ejecta.rayReach) : Math.min(3.2, res.ejecta.rayReach),
        seed: Math.random() * 50,
        terrace: cr.terraces ? 1 : 0,
        hot: 1,
        // 辉光寿命 = 熔体表面辐射结壳时标（见 Impact.meltGlowSeconds）
        glowSeconds: Math.max(20, res.ejecta ? res.ejecta.glowSeconds : 60),
      });
      st.craterCount++;
      st.biggestCraterKm = Math.max(st.biggestCraterKm, cr.Dfr / 1000);
    }

    // 冲击波 / 海啸环
    body.rings.push(ringSpec(body, dirLocal, 'shock', res, 1.0));
    if (isOcean && res.tsunami) body.rings.push(ringSpec(body, dirLocal, 'tsunami', res, 1.0));
    if (!airless && res.severity > 0.35) body.rings.push(ringSpec(body, dirLocal, 'dust', res, 1.0));

    // 全球效应：尘幕光学厚度、直接受灾面积、逃逸质量
    st.tau += res.globalDust || 0;
    st.damaged = Math.min(1, st.damaged + (res.damagedFraction || 0));
    st.escapedMass += res.ejecta ? res.ejecta.massLost : 0;
    // 自转 / 转轴（真实但通常极小）
    if (res.spin) {
      const newRot = Math.abs(st.rotHours) + res.spin.rotDeltaSec / 3600;
      st.rotHours = Math.sign(st.rotHours || 1) * Math.max(0.05, newRot);
      st.tilt += res.spin.tiltDeltaDeg * (Math.random() < 0.5 ? 1 : -1);
    }
  };

  function pushCrater(body, c) {
    body.craters.unshift(c);
    // 超出解析槽位的坑交给伤痕图烘焙（由 renderer 处理）
    while (body.craters.length > 4) {
      const old = body.craters.pop();
      body.bakeQueue = body.bakeQueue || [];
      body.bakeQueue.push(old);
    }
  }

  /**
   * 表面波环：波速与衰减全部取物理量
   *  · 空气冲击波：起步是强激波，很快退化到当地声速 c=√(γRT/M)，这里用各行星的
   *    实测声速量级；振幅按 Collins 超压衰减律（以 20 kPa 半径为参考尺度）。
   *  · 真空天体：没有空气冲击波，取地壳瑞利波 ~3.5 km/s。
   *  · 海啸：长波速度 √(g·h)。
   *  · 尘暴：由冲击波推动的地面尘幕，速度取声速的 0.6 倍。
   */
  const SOUND_SPEED = {          // m/s，地表附近
    earth: 340, venus: 410, mars: 240, titan: 195, jupiter: 900,
    saturn: 780, uranus: 600, neptune: 600, pluto: 180, triton: 180,
  };

  function ringSpec(body, dir, type, res, scale) {
    const def = body.def;
    const P = SS.Impact.surfacePressure(def.atmo, def.g);
    const hasAir = P > 500;
    const c = SOUND_SPEED[def.id] || 340;
    let speed, k0, width0, angRef;
    const Rm = body.radiusM;
    if (type === 'tsunami') {
      speed = res.tsunami ? (res.tsunami.speedKmh * 1000) / 3600 : Math.sqrt(9.807 * 4000);
      k0 = 0.85 * scale;
      width0 = 0.004;
      angRef = res.crater ? (res.crater.Dtc / 2) / Rm : 0.002;
    } else if (type === 'dust') {
      speed = c * 0.6;
      k0 = 0.30 * scale;
      width0 = 0.018;
      angRef = res.blast && !res.blast.none ? res.blast.r_total / Rm : 0.01;
    } else {
      speed = hasAir ? c : 3500;                    // 空气声速 / 地壳瑞利波
      k0 = 1.3 * (0.35 + (res.severity || 0.2)) * scale;
      width0 = 0.003;
      angRef = res.blast && !res.blast.none
        ? Math.max(res.blast.r_total / Rm, 1e-4)
        : (res.crater ? Math.max((res.crater.Dtc * 3) / Rm, 1e-4) : 0.01);
    }
    return {
      dir: V.clone(dir), t: 0, ang: 0, speed,
      k0, k: k0, width0, width: width0, angRef,
      type: type === 'shock' ? 0 : (type === 'tsunami' ? 1 : 2),
    };
  }

  /* ------------------------------------------------------------------ *
   *  拾取
   * ------------------------------------------------------------------ */
  /** 射线（相机相对）拾取天体，返回 {body, t} */
  World.pick = function (camPos, rd, sizeBoost, minPixelRadius) {
    let best = null;
    for (const b of World.bodies) {
      const rel = [b.pos[0] - camPos[0], b.pos[1] - camPos[1], b.pos[2] - camPos[2]];
      const dist = V.len(rel);
      let R = b.radius * (b.id === 'sun' ? 1 : sizeBoost);
      // 远处天体给一个最小拾取半径，便于点选
      R = Math.max(R, dist * (minPixelRadius || 0.004));
      const t = M.raySphere([-rel[0], -rel[1], -rel[2]], rd, R);
      if (t > 0 && (!best || t < best.t)) best = { body: b, t };
    }
    return best;
  };

  /** 命中天体表面 → 体坐标单位方向 */
  World.pickSurface = function (body, camPos, rd, sizeBoost) {
    const rel = [body.pos[0] - camPos[0], body.pos[1] - camPos[1], body.pos[2] - camPos[2]];
    const R = body.radius * (body.id === 'sun' ? 1 : sizeBoost);
    const ro = [-rel[0], -rel[1], -rel[2]];
    const t = M.raySphere(ro, rd, R);
    if (t <= 0) return null;
    const hit = [ro[0] + rd[0] * t, ro[1] + rd[1] * t, ro[2] + rd[2] * t];
    const n = V.norm(hit);
    const inv = M3.transpose(body.rotM);
    return V.norm(M3.xform(inv, n));
  };

  /** 由体坐标方向求世界坐标（含地形半径） */
  World.surfacePoint = function (body, dirLocal, altUnits, sizeBoost) {
    const R = body.radius * (body.id === 'sun' ? 1 : sizeBoost) + (altUnits || 0);
    const w = M3.xform(body.rotM, dirLocal);
    return [body.pos[0] + w[0] * R, body.pos[1] + w[1] * R, body.pos[2] + w[2] * R];
  };

  /** 该天体上的日期文本（自 J2000 的儒略日 → UTC） */
  World.dateString = function () {
    const ms = Date.UTC(2000, 0, 1, 12, 0, 0) + World.simDays * 86400000;
    const d = new Date(ms);
    if (!isFinite(ms)) return '—';
    const p = (n, w) => String(Math.abs(n)).padStart(w || 2, '0');
    const y = d.getUTCFullYear();
    return (y < 0 ? '公元前 ' + p(-y, 4) : y) + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) +
      ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ' UTC';
  };

  SS.World = World;
})(window);
