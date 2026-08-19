/**
 * cooling.js —— 冷却系统（强制循环 闭式压力水冷）
 * ------------------------------------------------------------------
 *  离心式水泵（蜗壳 / 7 叶离心叶轮 / 泵轴 / 水封 / 轴承 / 皮带轮驱动端）
 *      装在正时齿轮室盖前端面（X=-409）之前：本体 X ∈ [-450,-410]，轴线 Y=190 Z=0
 *  蜡式节温器（感温包 / 主阀 / 旁通阀 / 壳体罩盖）轴线 X=-404，主阀座 Y=434
 *      （缸盖前端出水口，法兰贴缸盖前端面 X=-350）
 *  散热器（上下水室 / 扁管+波纹散热带芯体 / 加水口盖 / 溢流管 / 框架）
 *      X ∈ [-659,-621]，Y ∈ [52,528]，Z ∈ [-208,208]
 *  风扇 φ430 8 叶（X=-512）+ 导风罩 + V 带传动（曲轴皮带轮 → 水泵 / 风扇）
 *  缸体水套（缸筒外 φ119→φ138 环腔 + 缸间连通）/ 缸盖火力面水套（fluidVol）
 *  出水管 / 回水管 / 小循环旁通管 / 泵出水管 / 暖风与膨胀水箱接管
 *  缸体放水阀 / 水温传感器 / 螺栓 / 垫片
 *
 *  单位 1 unit = 1 mm；+X 后端（飞轮），-X 前端；Y=0 曲轴中心线；+Z 排气侧。
 */
import * as THREE from 'three';
import * as U from '../core/util.js';

export function build(world) {
  const { P, mats } = world;
  const C = P.cooling;
  const g = world.group('cooling');       // 结构件
  const gv = world.group('fluidVol');     // 半透明冷却液示意腔
  const gf = world.group('fasteners');    // 螺栓 / 垫片

  // 4 个缸心 X（与 params.CYL_X 同算法）
  const CX = Array.from({ length: P.nCyl }, (_, i) => (i - (P.nCyl - 1) / 2) * P.cylPitch);

  // ---------------- 关键坐标 ----------------
  const PY = 190;                 // 水泵轴线 Y
  const VX = -425.5;              // 蜗壳腔中心 X（腔 X ∈ [-433,-418]）
  const TX = -404;                // 节温器轴线 X
  const RX = -640;                // 散热器中心 X
  const FX = -506, FY = 295;      // 风扇叶片平面 X / 风扇轴线 Y
  const BA = -470, BB = -483;     // V 带平面：A=曲轴→水泵，B=水泵→风扇
  const RC = 99;                // 曲轴皮带轮（crank.damper，外径 φ186）带中心半径
  const AMB = 22;                 // 环境温度

  // ---------------- 轴向变换助手 ----------------
  const toX = (geo) => { geo.rotateZ(-Math.PI / 2); return geo; };   // 旋转体：绕 Y → 绕 X
  const toZ = (geo) => { geo.rotateX(Math.PI / 2); return geo; };    // 旋转体：绕 Y → 绕 Z
  // 挤出件（截面 XY、厚度沿 Z）→ 厚度沿 X：截面 x→世界 z、y→世界 y（见契约）
  const secX = (geo) => { geo.rotateY(-Math.PI / 2); return geo; };
  const at = (geo, x = 0, y = 0, z = 0) => { geo.translate(x, y, z); return geo; };
  const M = (geo, mat, pos, rot, name) => U.mesh(geo, mat, pos, rot, name);

  // ---------------- 本系统专用材质（克隆，不影响其它系统）----------------
  const coolant = mats.coolantVol.clone();
  coolant.name = '冷却液示意腔（冷却系统）';
  coolant.transparent = true;
  coolant.depthWrite = false;
  coolant.side = THREE.DoubleSide;
  coolant.userData = {
    baseOpacity: mats.coolantVol.userData.baseOpacity,
    baseTransparent: true,
    baseSide: THREE.DoubleSide,
    isHousing: false,
  };
  const coreMat = mats.copper.clone();                 // 散热器芯体（随水温轻微着色）
  coreMat.name = '散热器芯体 紫铜';
  coreMat.side = THREE.DoubleSide;
  coreMat.userData = { baseOpacity: 1, baseTransparent: false, baseSide: THREE.DoubleSide, isHousing: false };

  // =========================================================================
  // 0. 工况换算（全部由 st.op 实时值推算）
  // =========================================================================
  function ops(st) {
    const T = st.op.coolantTemp;
    const t = U.clamp(st.op.thermostatOpen, 0, 1);
    const n = st.rpm / P.meta.ratedSpeed;
    const pumpRpm = st.rpm * 1.15;
    const fanRpm = st.rpm * 1.0;
    const flow = 165 * n;                                   // L/min（∝转速）
    const dp = 90 * n * n;                                  // 泵出口表压 kPa
    const heat = 3 + 0.68 * (st.op.power || 0);             // 传给冷却液的热量 kW
    const air = 210 * n;                                    // 风扇风量 m³/min
    const qrad = Math.min(heat + 8, 1.09 * t * Math.max(0, T - AMB) * (0.35 + 0.65 * n));
    const dT = (flow > 2 && t > 0.02) ? qrad * 60 / (flow * Math.max(0.08, t) * 4.187) : 0;
    const sysP = U.clamp((T - 84) * 6.5, 0, 96);            // 系统表压 kPa
    const boil = 100 + sysP * 0.22;
    const ntc = 2500 * Math.exp(-0.04 * (T - 20));          // 传感器阻值 Ω
    const pumpKW = flow / 60000 * dp / 0.62;                // 泵轴功率 kW
    const fanKW = 2.6 * n * n * n;
    const loop = t < 0.03 ? '小循环（节温器全关）'
      : t > 0.97 ? '大循环（节温器全开）'
        : `大循环 ${(t * 100).toFixed(0)}% / 小循环 ${((1 - t) * 100).toFixed(0)}%`;
    return { T, t, n, pumpRpm, fanRpm, flow, dp, heat, air, qrad, dT, sysP, boil, ntc, pumpKW, fanKW, loop, lift: 9 * t };
  }

  // =========================================================================
  // 1. 离心式水泵（X ∈ [-484,-410]，轴线 Y=190 Z=0）
  // =========================================================================
  const rotor = new THREE.Group();          // 泵轴 + 叶轮 + 皮带轮（绕 X 旋转）
  rotor.position.set(0, PY, 0);
  g.add(rotor);

  // 1.1 蜗壳体（一体铸铝：螺旋壁 / 前壁 / 吸入室 / 轴承座 / 进出水口 / 安装法兰）
  //     螺旋自 135°（出水口方位）沿叶轮旋转方向（+Y→+Z）逐渐扩张，收尾处形成隔舌
  const volutePts = (() => {
    const seg = 48, rIn = 53, grow = 10, wall = 8, a0 = Math.PI * 0.75;
    const out = [], inn = [];
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, a = a0 - u * U.TAU, r = rIn + grow * u;
      out.push([Math.cos(a) * (r + wall), Math.sin(a) * (r + wall)]);
      inn.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return out.concat(inn.reverse());
  })();
  const dischargeNeck = (od, id, len, r) => {
    const q = U.tubeShell(od, id, len, 24);
    q.translate(0, r, 0);
    q.rotateX(-Math.PI / 4);        // 指向左上 45°（+Y / -Z）
    return q;
  };
  const pumpHousing = M(U.merge([
    at(secX(U.extrudePoly(volutePts, 15, { curveSegments: 1 })), VX),                 // 蜗壳螺旋壁
    at(toX(U.tubeShell(144, 74, 8, 40)), -437),                                      // 蜗壳前壁（吸入口 φ74）
    at(toX(U.tubeShell(150, 122, 8, 40)), -414),                                     // 安装法兰环
    at(toX(U.tubeShell(96, 88, 9, 32)), -445.5),                                     // 吸入室外壳
    at(toX(U.tubeShell(96, 50, 6, 32)), -447),                                       // 吸入室前壁
    at(toX(U.tubeShell(46, 34, 21, 28)), -451.5),                                    // 轴承座（干腔）
    at(toZ(U.tubeShell(48, 42, 36, 24)), -438, 0, -62),                              // 进水口（接下水管）
    at(toZ(U.tubeShell(68, 48, 6, 24)), -438, 0, -78),                               // 进水口法兰
    at(dischargeNeck(60, 52, 32, 62), VX),                                           // 出水口（45°）
    at(dischargeNeck(82, 60, 7, 80), VX),                                            // 出水口法兰
    at(toZ(U.tubeShell(30, 22, 30, 16)), -444, 40, -42),                             // 暖风回水接管座
  ]), mats.alumCast, [0, PY, 0], [0, 0, 0], 'cooling.pumpHousing');
  g.add(pumpHousing);
  world.reg(pumpHousing, 'cooling.pumpHousing', {
    explode: [-120, 0, 0],
    state: (st) => {
      const o = ops(st);
      return `蜗壳集水 · 流量 ${o.flow.toFixed(0)} L/min · 出口压 ${o.dp.toFixed(0)} kPa（扬程 ${(o.dp / 9.8).toFixed(1)} m）`;
    },
  });

  // 1.2 泵盖（后盖板，封闭蜗壳并贴合正时齿轮室盖前端面）
  const pumpCover = M(toX(U.tubeShell(122, 26, 8, 40)), mats.alumMachined, [-414, PY, 0], [0, 0, 0], 'cooling.pumpCover');
  g.add(pumpCover);
  world.reg(pumpCover, 'cooling.pumpCover', {
    explode: [130, 0, 0],
    state: (st) => `密封面压紧 · 腔内压力 ${ops(st).dp.toFixed(0)} kPa · 水温 ${st.op.coolantTemp.toFixed(0)}℃`,
  });

  // 1.3 离心叶轮（7 片后弯叶片 + 轮盘 + 轮毂）
  const vaneGeo = (() => {
    const n = 9, r0 = 17, r1 = 50, sweep = 0.9, half = 1.9, pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, r = U.lerp(r0, r1, t), a = sweep * t + half / r;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    for (let i = n; i >= 0; i--) {
      const t = i / n, r = U.lerp(r0, r1, t), a = sweep * t - half / r;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return secX(U.extrudePoly(pts, 9, { curveSegments: 1 }));
  })();
  const vanes = U.instances(vaneGeo, mats.alumMachined,
    Array.from({ length: C.impellerBlades }, (_, i) => ({ rot: [i * U.TAU / C.impellerBlades, 0, 0] })),
    'cooling.impellerVanes');
  vanes.position.set(-428.5, 0, 0);
  const impDisc = M(toX(U.disc(100, 6, 0, 40)), mats.alumMachined, [-421, 0, 0]);
  const impHub = M(toX(U.tubeShell(30, 20, 16, 24)), mats.alumMachined, [-432, 0, 0]);
  rotor.add(vanes, impDisc, impHub);
  world.reg([vanes, impDisc, impHub], 'cooling.pumpImpeller', {
    state: (st) => {
      const o = ops(st);
      return `叶轮 ${o.pumpRpm.toFixed(0)} r/min（曲轴×1.15）· 流量 ${o.flow.toFixed(0)} L/min · 出口压 ${o.dp.toFixed(0)} kPa`;
    },
  });

  // 1.4 泵轴
  const pumpShaft = M(U.cylX(20, 92, 24), mats.nitridedSteel, [-462, 0, 0], [0, 0, 0], 'cooling.pumpShaft');
  rotor.add(pumpShaft);
  world.reg(pumpShaft, 'cooling.pumpShaft', {
    state: (st) => {
      const o = ops(st);
      return `${o.pumpRpm.toFixed(0)} r/min · 传递扭矩 ${(9550 * (o.pumpKW + 0.05) / Math.max(80, o.pumpRpm)).toFixed(2)} N·m · 无轴向窜动`;
    },
  });

  // 1.5 轴承（单列球轴承，在轴承座干腔内）
  const brRings = M(U.merge([
    toX(U.tubeShell(34, 28, 18, 24)),
    toX(U.tubeShell(24, 20, 18, 24)),
  ]), mats.bearingAlloy, [-451, PY, 0]);
  const balls = U.instances(new THREE.SphereGeometry(3.4, 8, 6), mats.nitridedSteel,
    Array.from({ length: 9 }, (_, i) => {
      const a = i * U.TAU / 9;
      return { pos: [-451, PY + Math.cos(a) * 13.5, Math.sin(a) * 13.5] };
    }), 'cooling.pumpBalls');
  g.add(brRings, balls);
  world.reg([brRings, balls], 'cooling.pumpBearing', {
    state: (st) => {
      const o = ops(st);
      return `${o.pumpRpm.toFixed(0)} r/min · dn 值 ${(27 * o.pumpRpm / 1000).toFixed(0)}×10³ mm·r/min · 轴承温度 ≈ ${(st.op.coolantTemp + 12).toFixed(0)}℃`;
    },
  });

  // 1.6 水封（骨架橡胶 + 石墨端面，隔开吸入水与轴承干腔）
  const pumpSeal = M(toX(U.tubeShell(42, 22, 7, 24)), mats.rubber, [-437, PY, 0], [0, 0, 0], 'cooling.pumpSeal');
  const sealFace = M(toX(U.tubeShell(32, 22, 3, 24)), mats.gasketMat, [-432, PY, 0]);
  g.add(pumpSeal, sealFace);
  world.reg([pumpSeal, sealFace], 'cooling.pumpSeal', {
    state: (st) => {
      const o = ops(st);
      return `端面线速度 ${(Math.PI * 0.027 * o.pumpRpm / 60).toFixed(2)} m/s · 密封水温 ${o.T.toFixed(0)}℃ · 无渗漏（泄水孔干燥）`;
    },
  });

  // 1.7 皮带轮（驱动端，双槽：曲轴 φ186 → 后槽 φ172 得 i=1.15；前槽 φ90 引出风扇带）
  const grooved = (rOut, w) => U.lathe([
    [11, -w / 2], [rOut - 11, -w / 2], [rOut - 11, -w / 2 + 3], [rOut, -w / 2 + 5.5],
    [rOut, w / 2 - 5.5], [rOut - 11, w / 2 - 3], [rOut - 11, w / 2], [11, w / 2], [11, -w / 2],
  ], 30);
  const pumpPulley = M(U.merge([
    at(toX(grooved(90, 14)), BA),                        // 后槽：节圆 φ172，曲轴驱动（i=1.15）
    at(toX(U.tubeShell(56, 20, 30, 24)), -478),          // 双槽间轮毂套筒
    at(toX(grooved(47, 10)), BB),                        // 前槽：节圆 φ90，驱动风扇
  ]), mats.steelSheet, [0, 0, 0], [0, 0, 0], 'cooling.pumpPulley');
  rotor.add(pumpPulley);
  world.reg(pumpPulley, 'cooling.pumpPulley', {
    state: (st) => {
      const o = ops(st);
      return `${o.pumpRpm.toFixed(0)} r/min · 后槽节圆 φ172（曲轴驱动 1.15）· 带速 ${(Math.PI * 0.172 * o.pumpRpm / 60).toFixed(1)} m/s · 传递 ${(o.pumpKW + o.fanKW).toFixed(2)} kW`;
    },
  });

  // =========================================================================
  // 2. 蜡式节温器（轴线 X=-404，主阀座 Y=434，法兰贴缸盖前端面）
  // =========================================================================
  const tMove = new THREE.Group();          // 主阀 + 旁通阀（随蜡包升程同步下移）
  g.add(tMove);

  const coverProfile = [
    [52, 432], [52, 441], [48, 452], [40, 466], [24, 476], [0, 478],
    [0, 471], [19, 469], [33, 459], [41, 447], [45, 439], [45, 432], [52, 432],
  ];
  const tHousing = M(U.merge([
    at(U.tubeShell(100, 84, 34, 36), 0, 417),                       // 出水腔壁（Y 400…434）
    at(U.tubeShell(84, 44, 6, 32), 0, 403),                         // 腔底 + 旁通口 φ44
    at(U.tubeShell(84, 62, 6, 32), 0, 437),                         // 主阀座圈
    U.lathe(coverProfile, 36),                                      // 罩盖
    at(toX(U.tubeShell(58, 50, 12, 24)), 47, 410),                  // 进水颈（接缸盖前端面）
    at(toX(U.tubeShell(96, 58, 8, 24)), 51, 410),                   // 进水法兰（贴 X=-350）
    at(toZ(U.tubeShell(58, 50, 40, 24)), 0, 462, 56),               // 出水接管（指向 +Z）
    at(toZ(U.tubeShell(78, 58, 7, 24)), 0, 462, 78),                // 出水接管法兰
    at(toZ(U.tubeShell(30, 20, 22, 16)), 0, 452, -40),              // 水温传感器座
  ]), mats.alumCast, [TX, 0, 0], [0, 0, 0], 'cooling.thermostatHousing');
  g.add(tHousing);
  world.reg(tHousing, 'cooling.thermostatHousing', {
    explode: [0, 140, 0],
    state: (st) => {
      const o = ops(st);
      return `缸盖出水 ${o.T.toFixed(1)}℃ · ${o.loop} · 通过流量 ${o.flow.toFixed(0)} L/min`;
    },
  });

  // 2.2 蜡式感温包（固定于支架，石蜡受热膨胀顶出推杆）
  const waxBody = M(U.lathe([[0, 436], [11, 437], [12, 440], [12, 458], [0, 460]], 24), mats.copper, [TX, 0, 0]);
  const waxBridge = M(U.merge([
    U.roundBox(70, 7, 18, 3),
    at(U.roundBox(8, 26, 10, 2), 0, -14, 30),
    at(U.roundBox(8, 26, 10, 2), 0, -14, -30),
  ]), mats.springSteel, [TX, 467, 0]);
  const waxRod = M(U.cyl(7, 1, 14), mats.nitridedSteel, [TX, 435, 0]);   // 推杆（scale.y 伸缩）
  g.add(waxBody, waxBridge, waxRod);
  world.reg([waxBody, waxBridge, waxRod], 'cooling.thermostatWax', {
    state: (st) => {
      const o = ops(st);
      return `感温包 ${o.T.toFixed(1)}℃ · 推杆伸出 ${o.lift.toFixed(1)} mm（${C.openTemp}℃ 始开 / ${C.fullOpenTemp}℃ 全开）`;
    },
  });

  // 2.3 主阀门（下移离座 → 通往散热器的大循环）
  const mainValve = M(U.merge([
    U.disc(72, 4, 0, 36),
    at(U.tubeShell(24, 12, 8, 20), 0, -6),
  ]), mats.springSteel, [TX, 432, 0], [0, 0, 0], 'cooling.thermostatMainValve');
  tMove.add(mainValve);
  world.reg(mainValve, 'cooling.thermostatMainValve', {
    state: (st) => {
      const o = ops(st);
      return `主阀开度 ${(o.t * 100).toFixed(0)}% · 升程 ${o.lift.toFixed(1)}/9 mm · ${o.loop} / 水温 ${o.T.toFixed(0)}℃`;
    },
  });

  // 2.4 旁通阀门（与主阀反向动作：主阀开 → 旁通关）
  const bypassValve = M(U.merge([
    U.disc(52, 3, 0, 28),
    at(U.cyl(10, 24, 16), 0, 13),
  ]), mats.springSteel, [TX, 416.5, 0], [0, 0, 0], 'cooling.thermostatBypassValve');
  tMove.add(bypassValve);
  world.reg(bypassValve, 'cooling.thermostatBypassValve', {
    state: (st) => {
      const o = ops(st);
      return `旁通开度 ${((1 - o.t) * 100).toFixed(0)}%（间隙 ${(9 - o.lift).toFixed(1)} mm）· 小循环 ${(o.flow * (1 - o.t)).toFixed(0)} L/min`;
    },
  });

  // 2.5 回位弹簧（座在腔底，压紧主阀）
  const tSpring = M(U.coilSpring(76, 3, 4, 24, 6), mats.springSteel, [TX, 406, 0], [0, 0, 0], 'cooling.thermostatSpring');
  g.add(tSpring);
  world.reg(tSpring, 'cooling.thermostatSpring', {
    state: (st) => {
      const o = ops(st);
      return `压缩 ${o.lift.toFixed(1)} mm · 弹簧力 ≈ ${(26 + 4.6 * o.lift).toFixed(0)} N · ${o.t > 0.02 ? '被蜡包顶开' : '压紧主阀关闭'}`;
    },
  });

  // =========================================================================
  // 3. 散热器
  // =========================================================================
  const CORE_Y0 = 112, CORE_Y1 = 468, CORE_CY = (CORE_Y0 + CORE_Y1) / 2, CORE_H = CORE_Y1 - CORE_Y0;
  const N_TUBE = 38, TUBE_PITCH = 400 / (N_TUBE - 1);

  const topTank = M(U.merge([
    U.roundBox(38, 60, 416, 8),
    at(toX(U.tubeShell(58, 50, 34, 24)), 26, 2, 128),        // 进水接管
    at(toX(U.tubeShell(76, 58, 6, 24)), 41, 2, 128),
  ]), mats.brass, [RX, 498, 0], [0, 0, 0], 'cooling.radiatorTopTank');
  g.add(topTank);
  world.reg(topTank, 'cooling.radiatorTopTank', {
    explode: [0, 110, 0],
    state: (st) => {
      const o = ops(st);
      return `进水 ${o.T.toFixed(1)}℃ · 流量 ${(o.flow * o.t).toFixed(0)} L/min · 表压 ${o.sysP.toFixed(0)} kPa`;
    },
  });

  const botTank = M(U.merge([
    U.roundBox(38, 60, 416, 8),
    at(toX(U.tubeShell(58, 50, 34, 24)), 26, 0, -100),       // 出水接管
    at(toX(U.tubeShell(76, 58, 6, 24)), 41, 0, -100),
    at(U.tubeShell(30, 22, 26, 16), 0, -40, 150),            // 放水塞
  ]), mats.brass, [RX, 82, 0], [0, 0, 0], 'cooling.radiatorBottomTank');
  g.add(botTank);
  world.reg(botTank, 'cooling.radiatorBottomTank', {
    explode: [0, -110, 0],
    state: (st) => {
      const o = ops(st);
      return `出水 ${(o.T - o.dT).toFixed(1)}℃ · 芯体温降 ${o.dT.toFixed(1)}℃ · 流量 ${(o.flow * o.t).toFixed(0)} L/min`;
    },
  });

  // 3.3 芯体：38 根扁管（实例化）+ 37 组波纹散热带（折板，合并为一个网格）
  const tubes = U.instances(new THREE.BoxGeometry(30, CORE_H, 2.4), coreMat,
    Array.from({ length: N_TUBE }, (_, i) => ({ pos: [RX, CORE_CY, -200 + i * TUBE_PITCH] })), 'cooling.radTubes');
  const finBank = (z) => {
    const p = new THREE.PlaneGeometry(30, CORE_H, 1, 30);
    const pos = p.attributes.position;
    const step = CORE_H / 30;
    for (let i = 0; i < pos.count; i++) {
      const row = Math.round((pos.getY(i) + CORE_H / 2) / step);
      pos.setZ(i, row % 2 === 0 ? 3.6 : -3.6);
    }
    p.computeVertexNormals();
    p.translate(0, 0, z);
    return p;
  };
  const finGeos = [];
  for (let i = 0; i < N_TUBE - 1; i++) finGeos.push(finBank(-200 + (i + 0.5) * TUBE_PITCH));
  const fins = M(U.merge(finGeos), coreMat, [RX, CORE_CY, 0]);
  g.add(tubes, fins);
  world.reg([tubes, fins], 'cooling.radiatorCore', {
    state: (st) => {
      const o = ops(st);
      return `散热功率 ≈ ${o.qrad.toFixed(1)} kW · 进/出水 ${o.T.toFixed(0)}→${(o.T - o.dT).toFixed(0)}℃（Δ${o.dT.toFixed(1)}℃）· 迎面风量 ${o.air.toFixed(0)} m³/min`;
    },
  });

  // 3.4 加水口盖（压力阀 90 kPa + 真空阀）
  const radCap = M(U.merge([
    at(U.tubeShell(62, 52, 22, 24), 0, 11),
    U.lathe([[0, 22], [39, 22], [39, 34], [30, 44], [0, 46]], 28),
    at(U.coilSpring(34, 2.4, 3, 16, 6), 0, 4),
  ]), mats.steelSheet, [RX, 528, -120], [0, 0, 0], 'cooling.radiatorCap');
  g.add(radCap);
  world.reg(radCap, 'cooling.radiatorCap', {
    state: (st) => {
      const o = ops(st);
      return `系统表压 ${o.sysP.toFixed(0)}/90 kPa · 沸点提高至 ${o.boil.toFixed(0)}℃ · ${o.sysP > 88 ? '蒸汽阀开启排汽' : '密封'}`;
    },
  });

  // 3.5 溢流管 + 通气管
  const overflow = M(U.merge([
    U.pipeFromPoints([[RX, 546, -140], [RX - 8, 574, -152], [RX - 8, 596, -162]], 14, 8, 0.4).geo,
    U.pipeFromPoints([[RX - 8, 548, -168], [RX - 14, 340, -186], [RX - 10, 150, -196], [RX - 6, 96, -196]], 14, 8, 0.4).geo,
  ]), mats.chrome, [0, 0, 0], [0, 0, 0], 'cooling.radiatorOverflow');
  g.add(overflow);
  world.reg(overflow, 'cooling.radiatorOverflow', {
    state: (st) => {
      const o = ops(st);
      return `${o.sysP > 88 ? '正在向膨胀水箱溢流' : '无溢流'} · 系统压力 ${o.sysP.toFixed(0)} kPa · 水温 ${o.T.toFixed(0)}℃`;
    },
  });

  // 3.6 框架（两侧钢板 + 减振支脚）
  const radFrame = M(U.merge([
    at(U.roundBox(38, 480, 8, 4), 0, 290, 206),
    at(U.roundBox(38, 480, 8, 4), 0, 290, -206),
    at(U.roundBox(66, 14, 46, 3), 0, 46, 160),
    at(U.roundBox(66, 14, 46, 3), 0, 46, -160),
  ]), mats.steelSheet, [RX, 0, 0], [0, 0, 0], 'cooling.radiatorFrame');
  g.add(radFrame);
  world.reg(radFrame, 'cooling.radiatorFrame', {
    state: (st) => `承受风扇负压 ${(0.12 * ops(st).air).toFixed(0)} Pa · 橡胶减振垫工作正常`,
  });

  // =========================================================================
  // 4. 风扇 + 导风罩 + V 带传动
  // =========================================================================
  const fan = new THREE.Group();
  fan.position.set(0, FY, 0);
  g.add(fan);

  const bladeGeo = (() => {
    const pts = [[-24, 0], [-32, 58], [-30, 118], [-19, 150], [13, 155], [28, 118], [26, 58], [20, 0]];
    const q = U.extrudePoly(pts, 3.2, { curveSegments: 1 });
    q.rotateY(Math.PI / 2 - 0.52);      // 30° 安装角（叶尖 r=215 → φ430）
    q.translate(0, 60, 0);
    return q;
  })();
  const blades = U.instances(bladeGeo, mats.steelSheet,
    Array.from({ length: C.fanBlades }, (_, i) => ({ rot: [i * U.TAU / C.fanBlades, 0, 0] })), 'cooling.fanBlades');
  blades.position.set(FX, 0, 0);
  const fanHub = M(U.merge([
    at(toX(U.disc(116, 8, 34, 32)), FX - 4),
    at(toX(U.tubeShell(56, 34, 26, 24)), -496),
  ]), mats.steelSheet, [0, 0, 0]);
  const fanShaft = M(U.cylX(32, 116, 24), mats.forgedSteel, [-455, 0, 0]);
  fan.add(blades, fanHub, fanShaft);
  world.reg([blades, fanHub, fanShaft], 'cooling.fan', {
    explode: [-160, 0, 0],
    state: (st) => {
      const o = ops(st);
      return `${o.fanRpm.toFixed(0)} r/min · 叶尖线速度 ${(Math.PI * 0.43 * o.fanRpm / 60).toFixed(1)} m/s · 风量 ${o.air.toFixed(0)} m³/min · 耗功 ${o.fanKW.toFixed(2)} kW`;
    },
  });

  // 4.2 导风罩（文丘里环 + 4 根斜撑到散热器框架）
  //     环带在 +Y/+Z 象限（方位 5°…50°）留出让增压空气管通过的缺口——与钣金件实际做法一致
  const NOTCH_START = -5 * Math.PI / 180, NOTCH_LEN = 315 * Math.PI / 180;
  const ringBand = (od, id, len, seg = 40) => new THREE.LatheGeometry(
    [[id / 2, -len / 2], [od / 2, -len / 2], [od / 2, len / 2], [id / 2, len / 2], [id / 2, -len / 2]]
      .map(([r, y]) => new THREE.Vector2(r, y)), seg, NOTCH_START, NOTCH_LEN);
  const stay = (dy, dz) => U.pipeFromPoints([
    [-485, FY + dy, dz], [-556, FY + dy * 1.05, dz * 1.12], [-624, FY + dy * 1.08, dz * 1.26],
  ], 14, 6, 0.4).geo;
  const shroud = M(U.merge([
    at(toX(ringBand(447, 442, 34)), FX + 4),
    at(toX(ringBand(456, 445, 5)), -485),
    at(toX(ringBand(452, 442, 5)), -520),
  ]), mats.steelSheet, [0, FY, 0]);
  const stays = M(U.merge([stay(158, 158), stay(158, -158), stay(-158, 158), stay(-158, -158)]),
    mats.steelSheet, [0, 0, 0]);
  g.add(shroud, stays);
  world.reg([shroud, stays], 'cooling.fanShroud', {
    state: (st) => {
      const o = ops(st);
      return `叶尖间隙 6 mm · 罩内平均风速 ${(o.air / 60 / 0.145).toFixed(1)} m/s · 抑制回流损失 ≈ 8%（上侧留增压管让位缺口）`;
    },
  });

  // 4.3 风扇皮带轮 + 支架轴承座 + V 带（水泵前槽 φ90 → 风扇 φ104，合成 1:1 曲轴）
  const fanPulley = M(U.merge([
    at(toX(grooved(54, 10)), BB),
    at(toX(U.tubeShell(48, 32, 12, 24)), BB),
  ]), mats.steelSheet, [0, 0, 0], [0, 0, 0], 'cooling.fanPulley');
  fan.add(fanPulley);
  world.reg(fanPulley, 'cooling.fanPulley', {
    state: (st) => {
      const o = ops(st);
      return `${o.fanRpm.toFixed(0)} r/min · 节圆 φ104（由水泵前槽驱动，合成 1:1 曲轴）· 传递 ${o.fanKW.toFixed(2)} kW`;
    },
  });

  const fanBracket = M(U.merge([
    at(U.roundBox(14, 130, 92, 6), -353, 300, 50),
    at(U.roundBox(58, 60, 14, 5), -374, 312, 50),
    at(U.roundBox(34, 72, 60, 5), -414, 306, 26),
    at(toX(U.tubeShell(56, 34, 46, 28)), -425, FY, 0),
  ]), mats.castIron, [0, 0, 0], [0, 0, 0], 'cooling.fanBracket');
  g.add(fanBracket);
  world.reg(fanBracket, 'cooling.fanBracket', {
    state: (st) => {
      const o = ops(st);
      return `承受风扇轴向推力 ≈ ${(0.31 * o.air).toFixed(0)} N · 轴承座温度 ${(AMB + 26 + 0.2 * o.T).toFixed(0)}℃ · 振动正常`;
    },
  });

  const beltLoop = (x, cy1, r1, cy2, r2, width = 13.5) => {
    const d = cy2 - cy1, s = (r2 - r1) / d, cb = Math.sqrt(1 - s * s);
    const th1 = Math.atan2(-s, cb), th2 = Math.atan2(-s, -cb);
    const arc = (cy, r, a0, a1, n) => {
      const o = [];
      for (let i = 0; i <= n; i++) {
        const a = U.lerp(a0, a1, i / n);
        o.push([0, cy + Math.sin(a) * r, Math.cos(a) * r]);
      }
      return o;
    };
    const pts = arc(cy2, r2, th1, th2, 12).concat(arc(cy1, r1, th2, th1 + U.TAU, 12));
    const q = U.pipeFromPoints(pts, 9, 8, 0.05, true).geo;
    q.scale(width / 9, 1, 1);        // 截面压成 V 带断面（在 x=0 处缩放后再平移）
    q.translate(x, 0, 0);
    return q;
  };
  const fanBelt = M(U.merge([
    beltLoop(BA, 0, RC, PY, 86),      // 曲轴 φ186 → 水泵后槽 φ172（i=1.15）
    beltLoop(BB, PY, 45, FY, 52, 10.8),   // 水泵前槽 φ90 → 风扇 φ104（合成 1.00）
  ]), mats.rubber, [0, 0, 0], [0, 0, 0], 'cooling.fanBelt');
  g.add(fanBelt);
  world.reg(fanBelt, 'cooling.fanBelt', {
    state: (st) => {
      const o = ops(st);
      return `带速 ${(Math.PI * 0.186 * st.rpm / 60).toFixed(1)} m/s · 传动比 水泵 1.15 / 风扇 1.00 · 传递 ${(o.pumpKW + o.fanKW).toFixed(2)} kW`;
    },
  });

  // =========================================================================
  // 5. 水套示意腔（fluidVol）
  // =========================================================================
  // 5.1 缸体水套：4 个缸筒外 φ119.2→φ138 环腔 + 缸间连通 + 上平面横向通道 + 进水道
  const blockJacketGeos = [];
  for (const x of CX) {
    blockJacketGeos.push(at(U.tubeShell(138, 119.2, 172, 28), x, 236));
    for (const z of [-42, 42]) blockJacketGeos.push(at(U.cyl(26, 22, 12), x, 331, z));   // 缸垫过水孔
  }
  for (let i = 0; i < CX.length - 1; i++) {
    blockJacketGeos.push(at(U.cylX(30, 46, 16), (CX[i] + CX[i + 1]) / 2, 214));          // 缸间连通
  }
  blockJacketGeos.push(at(U.roundBox(560, 18, 44, 6), 0, 314));                          // 上平面横向水道
  blockJacketGeos.push(U.pipeFromPoints([[-350, 316, -88], [-320, 300, -74], [-278, 268, -52]], 40, 12, 0.4).geo);
  const blockJacket = M(U.merge(blockJacketGeos), coolant, [0, 0, 0], [0, 0, 0], 'cooling.blockJacket');
  gv.add(blockJacket);
  world.reg(blockJacket, 'cooling.blockJacket', {
    state: (st) => {
      const o = ops(st);
      return `水套水温 ${o.T.toFixed(1)}℃ · 缸筒外壁流速 ≈ ${(o.flow / 60000 / 0.0042).toFixed(2)} m/s · 带走热量 ${(o.heat * 0.62).toFixed(0)} kW`;
    },
  });

  // 5.2 缸盖水套（火力面层 Y 334…358）：包覆两气门座圈与喷油器套 + 前端出水通道
  const headJacketGeos = [];
  for (const x of CX) {
    const outer = [], rw = 66, zd0 = -42, zd1 = 50, cr = 14;
    const corner = (cx, cz, a0) => {
      for (let i = 0; i <= 4; i++) {
        const a = a0 + (i / 4) * Math.PI / 2;
        outer.push([cx + Math.cos(a) * cr, cz + Math.sin(a) * cr]);
      }
    };
    corner(x + rw - cr, zd1 - cr, 0);
    corner(x - rw + cr, zd1 - cr, Math.PI / 2);
    corner(x - rw + cr, zd0 + cr, Math.PI);
    corner(x + rw - cr, zd0 + cr, -Math.PI / 2);
    const holes = [
      U.circlePts(21, 16, x - P.valvetrain.valveOffsetX, P.valvetrain.valveZ),
      U.circlePts(21, 16, x + P.valvetrain.valveOffsetX, P.valvetrain.valveZ),
      U.circlePts(13, 12, x, 34),
    ];
    const q = U.extrudePoly(outer, 24, { holes, curveSegments: 1 });
    q.rotateX(Math.PI / 2);          // 截面 → 世界 XZ 平面，厚度沿 Y
    headJacketGeos.push(at(q, 0, 346, 0));
  }
  headJacketGeos.push(U.pipeFromPoints([[-262, 346, 4], [-302, 362, 2], [-338, 386, 0], [-352, 410, 0]], 44, 12, 0.4).geo);
  const headJacket = M(U.merge(headJacketGeos), coolant, [0, 0, 0], [0, 0, 0], 'cooling.headJacket');
  gv.add(headJacket);
  world.reg(headJacket, 'cooling.headJacket', {
    state: (st) => {
      const o = ops(st);
      return `火力面水温 ${(o.T + 6).toFixed(1)}℃ · 排气门座圈处 ${(o.T + 14 + 26 * st.load).toFixed(0)}℃ · 带走热量 ${(o.heat * 0.38).toFixed(0)} kW`;
    },
  });

  // =========================================================================
  // 6. 管路（外层胶管 + 内部冷却液示意芯）
  // =========================================================================
  const pipe = (id, pts, od, mat, opts) => {
    const ms = M(U.pipeFromPoints(pts, od, 12, 0.4).geo, mat, [0, 0, 0], [0, 0, 0], id);
    const mc = M(U.pipeFromPoints(pts, od - 9, 8, 0.4).geo, coolant, [0, 0, 0], [0, 0, 0], id + '.core');
    g.add(ms); gv.add(mc);
    world.reg([ms, mc], id, opts);
    return ms;
  };

  // 6.1 出水管：节温器出水口 → 散热器上水室（绕过风扇导风罩外侧）
  pipe('cooling.outletPipe', [
    [-404, 462, 82], [-432, 480, 108], [-464, 498, 138], [-492, 510, 150],
    [-524, 516, 152], [-566, 514, 146], [-604, 508, 134], [-620, 505, 128],
  ], C.pipeOD, mats.silicone, {
    state: (st) => {
      const o = ops(st);
      return o.t > 0.02
        ? `大循环流量 ${(o.flow * o.t).toFixed(0)} L/min · 管内 ${o.T.toFixed(1)}℃ · 压力 ${o.sysP.toFixed(0)} kPa`
        : `节温器全关 · 无流动 · 管内 ${o.T.toFixed(1)}℃`;
    },
  });

  // 6.2 回水管：散热器下水室 → 水泵进水口（从风扇/皮带下方绕过）
  pipe('cooling.returnPipe', [
    [-612, 80, -100], [-556, 58, -104], [-505, 44, -112], [-470, 52, -125],
    [-448, 96, -128], [-436, 150, -112], [-437, 180, -86],
  ], C.pipeOD, mats.silicone, {
    state: (st) => {
      const o = ops(st);
      return `回水 ${(o.T - o.dT).toFixed(1)}℃ · 流量 ${(o.flow * o.t).toFixed(0)} L/min · 泵前真空度 ${(4 + 8 * o.n).toFixed(0)} kPa`;
    },
  });

  // 6.3 小循环旁通管：节温器旁通口 → 泵进水（三通汇入回水管）
  pipe('cooling.bypassPipe', [
    [-404, 398, 0], [-404, 358, -32], [-408, 318, -62], [-414, 266, -90],
    [-418, 212, -110], [-424, 168, -116],
  ], 32, mats.silicone, {
    state: (st) => {
      const o = ops(st);
      return `小循环流量 ${(o.flow * (1 - o.t)).toFixed(0)} L/min（${((1 - o.t) * 100).toFixed(0)}%）· ${o.t < 0.98 ? '暖机/保温中' : '旁通已关闭'}`;
    },
  });

  // 6.4 泵出水管：水泵出口 → 缸体水套进水（越过正时齿轮室上方）
  pipe('cooling.pumpDischargePipe', [
    [-425, 250, -60], [-416, 290, -76], [-398, 316, -86], [-370, 320, -88], [-350, 316, -88],
  ], 52, mats.silicone, {
    state: (st) => {
      const o = ops(st);
      return `全流量 ${o.flow.toFixed(0)} L/min · 压力 ${o.dp.toFixed(0)} kPa · 流速 ${(o.flow / 60000 / 0.00159).toFixed(2)} m/s`;
    },
  });

  // 6.5 暖风 / 膨胀水箱接管（示意）
  const hp1 = [[-406, 452, -46], [-420, 438, -96], [-434, 420, -140], [-446, 406, -168]];
  const hp2 = [[-444, 230, -44], [-432, 258, -84], [-414, 282, -126], [-396, 308, -158], [-388, 330, -172]];
  const heaterPipes = M(U.merge([
    U.pipeFromPoints(hp1, 22, 10, 0.4).geo,
    U.pipeFromPoints(hp2, 22, 10, 0.4).geo,
    U.pipeFromPoints([[-648, 596, -158], [-662, 570, -142], [-656, 552, -128]], 16, 8, 0.4).geo,
  ]), mats.silicone, [0, 0, 0], [0, 0, 0], 'cooling.heaterPipes');
  const heaterCore = M(U.merge([
    U.pipeFromPoints(hp1, 13, 6, 0.4).geo,
    U.pipeFromPoints(hp2, 13, 6, 0.4).geo,
  ]), coolant, [0, 0, 0]);
  g.add(heaterPipes); gv.add(heaterCore);
  world.reg([heaterPipes, heaterCore], 'cooling.heaterPipes', {
    state: (st) => {
      const o = ops(st);
      return `暖风支路 ${(o.flow * 0.06).toFixed(1)} L/min · 送风温度 ≈ ${Math.max(AMB, o.T - 12).toFixed(0)}℃ · 膨胀水箱补水口常通`;
    },
  });

  // 6.6 膨胀水箱（示意）
  const expTank = M(U.merge([
    U.lathe([[0, 540], [44, 542], [48, 548], [48, 620], [42, 628], [22, 632], [22, 640], [0, 640]], 28),
    at(U.tubeShell(28, 20, 14, 16), 0, 646),
  ]), mats.filterPaper, [-648, 0, -158], [0, 0, 0], 'cooling.expansionTank');
  g.add(expTank);
  world.reg(expTank, 'cooling.expansionTank', {
    state: (st) => {
      const o = ops(st);
      const lv = 45 + 42 * U.clamp((o.T - AMB) / 80, 0, 1);
      return `液面 ${lv.toFixed(0)}%（冷 MIN → 热 MAX）· 膨胀量 ≈ ${(560 * U.clamp((o.T - AMB) / 80, 0, 1)).toFixed(0)} mL · 水温 ${o.T.toFixed(0)}℃`;
    },
  });

  // =========================================================================
  // 7. 小件：缸体放水阀 / 水温传感器
  // =========================================================================
  const drain = M(U.merge([
    at(toZ(U.tubeShell(20, 12, 30, 16)), 0, 0, -145),
    at(toZ(new THREE.CylinderGeometry(11, 11, 10, 6)), 0, 0, -126),
    at(U.cyl(11, 22, 14), 0, -14, -152),
    at(toZ(U.roundBox(34, 7, 5, 2)), 0, 0, -163),
  ]), mats.brass, [-300, 168, 0], [0, 0, 0], 'cooling.drainValve');
  g.add(drain);
  world.reg(drain, 'cooling.drainValve', {
    state: (st) => {
      const o = ops(st);
      return `关闭状态 · 阀前压力 ${(o.sysP + o.dp * 0.5).toFixed(0)} kPa · 缸体水温 ${o.T.toFixed(1)}℃`;
    },
  });

  const sensor = M(U.merge([
    at(toZ(new THREE.CylinderGeometry(11, 11, 12, 6)), 0, 0, -46),
    at(toZ(U.cyl(16, 22, 16)), 0, 0, -63),
    at(toZ(U.cyl(9, 12, 12)), 0, 0, -80),
  ]), mats.brass, [TX, 452, 0], [0, 0, 0], 'cooling.tempSensor');
  g.add(sensor);
  world.reg(sensor, 'cooling.tempSensor', {
    state: (st) => {
      const o = ops(st);
      return `水温 ${o.T.toFixed(1)}℃ → 阻值 ${o.ntc.toFixed(0)} Ω · ${o.T > 105 ? '报警：过热！' : o.T < 60 ? '预热区' : '正常绿区'}`;
    },
  });

  // =========================================================================
  // 8. 螺栓 / 垫片（fasteners 图层）
  // =========================================================================
  const boltXf = [];
  for (let i = 0; i < 6; i++) {                    // 泵体安装螺栓
    const a = i * U.TAU / 6 + 0.3;
    boltXf.push({ pos: [-418, PY + Math.cos(a) * 60, Math.sin(a) * 60], rot: [0, 0, Math.PI / 2] });
  }
  for (let i = 0; i < 4; i++) {                    // 节温器罩盖螺栓
    const a = i * U.TAU / 4 + 0.7;
    boltXf.push({ pos: [TX + Math.cos(a) * 44, 441, Math.sin(a) * 44], rot: [0, 0, 0] });
  }
  for (const p of [[-352, 352, 50], [-352, 250, 50], [-352, 352, 18], [-352, 250, 18]]) {
    boltXf.push({ pos: p, rot: [0, 0, Math.PI / 2] });   // 风扇支架螺栓
  }
  for (let i = 0; i < 4; i++) {                    // 导风罩螺栓
    const a = i * U.TAU / 4 + Math.PI / 4;
    boltXf.push({ pos: [-483, FY + Math.cos(a) * 228, Math.sin(a) * 228], rot: [0, 0, -Math.PI / 2] });
  }
  const bolts = U.instances(U.hexBolt(16, 9, 10, 24), mats.boltSteel, boltXf, 'cooling.bolts');
  gf.add(bolts);
  world.reg(bolts, 'cooling.bolts', {
    state: (st) => `M10 预紧力矩 24 N·m（${boltXf.length} 条）· 工作温度 ${(ops(st).T - 6).toFixed(0)}℃ · 无松动`,
  });

  const gaskets = M(U.merge([
    at(toX(U.tubeShell(150, 122, 1.5, 36)), -409.5, PY, 0),          // 泵体—齿轮室盖纸垫
    at(U.tubeShell(100, 78, 1.5, 32), TX, 432.5, 0),                 // 节温器罩盖垫
    at(toX(U.tubeShell(96, 58, 2, 24)), -350, 410, 0),               // 出水法兰垫（贴缸盖前端面）
    at(toZ(U.tubeShell(68, 48, 2, 24)), -438, PY, -81),              // 进水口垫
  ]), mats.gasketPaper, [0, 0, 0], [0, 0, 0], 'cooling.gaskets');
  gf.add(gaskets);
  world.reg(gaskets, 'cooling.gaskets', {
    state: (st) => `密封面比压合格 · 承受 ${ops(st).sysP.toFixed(0)} kPa 系统压力 · 无渗漏`,
  });

  // =========================================================================
  // 9. 每帧动画
  // =========================================================================
  const cWarm = new THREE.Color(0xc4552f);
  world.addUpdater((st) => {
    const D2R = Math.PI / 180;
    // 9.1 水泵（曲轴×1.15）与风扇（曲轴×1.00）
    rotor.rotation.x = st.crankTotal * 1.15 * D2R;
    fan.rotation.x = st.crankTotal * 1.0 * D2R;

    // 9.2 节温器：升程 0→9mm，主阀开启 / 旁通同步关闭（反向动作）
    const lift = 9 * U.clamp(st.op.thermostatOpen, 0, 1);
    tMove.position.y = -lift;
    waxRod.scale.y = 2 + lift;
    waxRod.position.y = 436 - (2 + lift) / 2;
    tSpring.scale.y = (24 - lift) / 24;

    // 9.3 冷却液示意腔：40℃ 蓝 → 105℃ 红（并跟随全局流体腔透明度）
    const u = U.clamp((st.op.coolantTemp - 40) / 65, 0, 1);
    coolant.color.setHSL(U.lerp(0.58, 0.0, u), 0.74, U.lerp(0.44, 0.5, u));
    coolant.opacity = mats.coolantVol.opacity;
    coolant.visible = mats.coolantVol.visible;

    // 9.4 散热器芯体高温轻微着色
    coreMat.color.setHex(0xb06a35).lerp(cWarm, 0.75 * U.clamp((st.op.coolantTemp - 85) / 25, 0, 1));
  });
}
