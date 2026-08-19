/**
 * fuel.js —— 燃油系统 / Fuel Injection System
 * ------------------------------------------------------------------
 * 直列柱塞式高压油泵（4 缸、机械离心调速器、活塞式输油泵、油量调节齿杆）
 * + 4 × 多孔式喷油器（针阀偶件 / 压紧螺帽 / 进回油接头 / 铜垫圈）
 * + 4 根等长 φ6.35 厚壁高压油管（带典型盘绕弯）
 * + 燃油粗滤器 / 细滤器（座、壳体、滤芯、放气螺钉）
 * + 低压输油管路（油箱→输油泵→粗滤→细滤→高压泵）与回油管
 * + 油量控制（调速手柄 / 油门拉杆）
 *
 * 单位 1 unit = 1 mm；+X 曲轴轴线（−X 前端/正时齿轮室），+Y 上（Y=0 曲轴中心线），
 * +Z 排气侧（−Z 进气侧）。本模块空间占用（与 MODULE-CONTRACT.md 分区一致，并已避让
 * 进气歧管稳压腔 Z=−210/r38、支管、增压冷管与泵传动齿轮）：
 *   高压油泵   泵纵轴 Z = −176、Y 148…273、X −165…85（进气侧缸体外壁，法兰贴 Z=−130）
 *   调速器/输油泵  X 85…178、Y 148…254 / X ≈ −88、Z −212…−264
 *   滤清器组   X −354…−188、Z ≈ −218、Y 216…384（托装于缸体进气侧，位于进气支管之下）
 *   喷油器     X = 缸心、Z = +34、Y 328…512（穿缸盖与气门室罩，喷嘴尖 Y = 328）
 *   高压油管   泵顶 Y≈273 → Y−Z 平面盘绕弯（中心 Y306/Z−186、r30）→ 支管间空档竖直段
 *              （Z = −166、X = −126/−24/110/136）→ 气门室罩上方 Y 506…524 → 喷油器 Y≈497
 */
import * as THREE from 'three';
import * as U from '../core/util.js';
import { CYL_X, CYL_PHASE } from '../core/params.js';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;

/* ==================== 本模块局部尺寸常量（不修改 params.js） ==================== */

// —— 高压油泵本体 ——
const PUMP = {
  z: -176,                       // 泵纵轴（凸轮轴 / 柱塞）所在 Z
  x0: -165, x1: 85,              // 泵体 X 范围（长 250）
  camY: 166,                     // 泵凸轮轴中心 Y
  camDia: 30,                    // 凸轮轴轴颈 φ30
  baseR: 13,                     // 凸轮基圆半径
  lift: 10,                      // 凸轮升程 = 柱塞行程 10 mm
  camW: 16,                      // 凸轮宽度
  camHalf: 62,                   // 凸轮工作段半角（泵轴角，度）
  bodyY0: 148, bodyY1: 208, bodyD: 84,   // 凸轮室（下泵体）
  headY0: 208, headY1: 246, headD: 72,   // 泵头（柱塞套体）
  plungerX: [-130, -70, -10, 50],        // 4 副柱塞偶件 X（泵内节距 60）
  govX0: 85, govX1: 155, govY1: 246, govD: 72,  // 调速器壳体
};

// —— 柱塞组各段绝对 Y（柱塞处于下止点时）——
const STK = {
  tappetY0: 186, tappetY1: 206, tappetDia: 28,
  rollerY: 188, rollerDia: 18, rollerW: 14,
  footY0: 202, footY1: 207, footDia: 17,
  plY0: 204, plY1: 239, plDia: 10,        // 柱塞：上止点时 214…249
  slY0: 219, slY1: 231, slDia: 26,        // 控制套（齿圈）
  brY0: 231, brY1: 249, brDia: 22,        // 柱塞套
  dvY0: 246, dvY1: 264, dvAcross: 21,     // 出油阀体（六方）
  nipY0: 262, nipY1: 273, nipDia: 13,     // 高压油管接头
  rackY: 225, rackZ: -194, rackDia: 8,    // 油量调节齿杆
};

// —— 喷油器（每缸一套，X = 缸心，Z = +34）——
const INJ = {
  z: 34,
  tipY: 328,                    // 喷孔尖端（缸盖底面 Y=330 以下 2 mm）
  washY: 331.7, washOD: 24, washID: 7.4, washH: 3.2,   // 铜垫圈
  nutY0: 333.5, nutY1: 390, nutDia: 23, nutHexY0: 372, nutHex: 27,
  bodyY0: 386, bodyY1: 496, capY1: 512,
  inletY: 497, retY: 506,
  ndlY0: 329.5, ndlY1: 398,
};

// —— 滤清器组（吊装在缸体进气侧，位于进气歧管/支管之下、增压冷管之内的空档）——
const FLT = {
  z: -218,                      // 滤清器轴线 Z
  coarseX: -316, coarseDia: 76, coarseY0: 284,   // 粗滤（沉淀杯）：让开泵传动齿轮
  fineX: -232, fineY0: 216,     // 细滤 φ96 = P.fuel.filterDia
  bowlY1: 350,                  // 壳体顶（= 滤清器座底面），低于进气支管 Y≈355
  baseY0: 350, baseY1: 384, baseD: 60,
};

// —— 油路 ——
const LINE = { hpOD: 6.35, lpOD: 10, hoseOD: 14, retOD: 9 };
// 高压油管：竖直段（走进气支管之间的空档）+ Y−Z 平面内的盘绕弯
const HP = {
  runZ: -166,                   // 竖直段所在 Z（进气歧管稳压腔之内侧）
  runX: [-126, -24, 110, 136],  // 4 根竖直段 X（分别位于 1/2、2/3、3/4 支管之间的空档）
  coilY: 306, coilZ: -186, coilR: 30,   // 盘绕弯中心与半径
  crossY0: 506, crossDY: 6,     // 跨越气门室罩上方的高度
};

// —— 喷油/供油正时 ——
const ADV = 18;                  // 供油提前角 18 °CA（上止点前）
const INJ_START = 720 - ADV;     // 循环角 702° 开始供油/喷射
const CAM_PEAK = 745;            // 泵凸轮桃尖对应循环角（≈上止点后 25 °CA）
const NEEDLE_LIFT = 0.6;         // 针阀升程（真实 0.30 mm，放大 2× 便于观察）
const Q_RATED = 95;              // 额定循环供油量 mm³/循环

/* ==================== 小工具 ==================== */

const mergeAll = (list) => U.merge(list.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g)));
const down = (g, y) => { g.translate(0, -y, 0); return g; };   // 绝对 Y 几何 → 以 y 为原点

/** 泵凸轮型线：d = 距桃尖的泵轴角（度）→ 无量纲升程 0..1 */
function camBump(d) {
  let x = ((d + 180) % 360 + 360) % 360 - 180;
  const t = 1 - Math.abs(x) / PUMP.camHalf;
  if (t <= 0) return 0;
  return Math.pow(Math.sin(t * Math.PI / 2), 1.6);
}

/** 循环角（0..720），优先取 st.cyl[i].cycle */
function cycOf(st, i) {
  const c = st && st.cyl && st.cyl[i];
  if (c && typeof c.cycle === 'number') return c.cycle;
  const ph = CYL_PHASE[i + 1] || 0;
  let a = (((st && st.crankAngle) || 0) - ph) % 720;
  return a < 0 ? a + 720 : a;
}

const ld = (st) => U.clamp((st && st.load) || 0, 0, 1);
const rpmOf = (st) => Math.max(0, (st && st.rpm) || 0);
/** 每循环供油量 mm³（怠速 ~8 → 额定 95） */
const qCycle = (st) => 6 + (Q_RATED - 6) * ld(st);
/** 喷油持续角（°CA）：负荷越大越长 */
const injDur = (st) => 10 + 16 * ld(st);
/** 燃油消耗量 L/h（4 缸 × 每循环油量 × 转速/2） */
const flowLh = (st) => 1.2e-4 * qCycle(st) * rpmOf(st);
/** 喷油器针阀开启压力 MPa */
const popPressure = (st) => 18 + 3.5 * ld(st);
/** 管内最高喷射压力 MPa */
const peakPressure = (st) => 24 + (120 - 24) * (0.25 + 0.75 * ld(st)) * (0.55 + 0.45 * Math.min(1, rpmOf(st) / 2200));

/** 当前正在喷油的缸；返回 {i, n, u, dur} 或 null */
function activeInj(st) {
  const dur = injDur(st);
  for (let i = 0; i < 4; i++) {
    let d = cycOf(st, i) - INJ_START;
    if (d < 0) d += 720;
    if (d < dur) return { i, n: i + 1, u: d / dur, dur };
  }
  return null;
}
/** 针阀升程形状（放大后 mm） */
const needleShape = (u) => NEEDLE_LIFT * Math.min(1, Math.sin(Math.PI * U.clamp(u, 0, 1)) * 1.9);
/** 齿杆行程 0..10 mm（含调速器超速减油） */
function rackTravel(st) {
  const droop = Math.max(0, (rpmOf(st) - 2500) / 90);
  return U.clamp(ld(st) * 10 + 0.4 - droop, 0, 10);
}

/* ==================== 构建 ==================== */

export function build(world) {
  const { P, mats } = world;
  const G = world.group('fuel');
  const FST = world.group('fasteners');
  const VOL = world.group('fluidVol');
  const FP = P.fuel;

  /* ---------------------------------------------------------------
   * 1. 高压油泵泵体（凸轮室 + 泵头 + 安装法兰 + 进/回油接头）
   * ------------------------------------------------------------- */
  {
    const parts = [];
    const bl = PUMP.x1 - PUMP.x0;
    // 凸轮室
    let g = U.roundBox(bl, PUMP.bodyY1 - PUMP.bodyY0, PUMP.bodyD, 7);
    g.translate((PUMP.x0 + PUMP.x1) / 2, (PUMP.bodyY0 + PUMP.bodyY1) / 2, PUMP.z);
    parts.push(g);
    // 泵头（柱塞套体）
    g = U.roundBox(bl, PUMP.headY1 - PUMP.headY0, PUMP.headD, 5);
    g.translate((PUMP.x0 + PUMP.x1) / 2, (PUMP.headY0 + PUMP.headY1) / 2, PUMP.z);
    parts.push(g);
    // 与缸体贴合的安装法兰（Z = −138…−130，紧贴缸体进气侧外壁 Z = −130）
    g = U.roundBox(bl - 20, 60, 8, 4);
    g.translate((PUMP.x0 + PUMP.x1) / 2, 178, -134);
    parts.push(g);
    // 前端（−X）凸轮轴轴承座凸台
    g = U.cylX(56, 24, 20); g.translate(PUMP.x0 - 12, PUMP.camY, PUMP.z); parts.push(g);
    // 低压进油接头（来自细滤器）：泵头外侧面 Z = −212
    g = U.cylZ(16, 18, 14); g.translate(-145, 228, -221); parts.push(g);
    g = U.cylZ(20, 6, 6); g.translate(-145, 228, -227); parts.push(g);
    // 溢流（回油）接头：泵头外侧面
    g = U.cylZ(14, 16, 12); g.translate(60, 236, -220); parts.push(g);
    // 4 个柱塞套安装孔凸台
    for (const px of PUMP.plungerX) {
      g = U.cyl(34, 14, 16); g.translate(px, PUMP.headY1 - 5, PUMP.z); parts.push(g);
    }
    const pumpBody = U.mesh(mergeAll(parts), mats.alumCast, [0, 0, 0], [0, 0, 0], 'fuel.hpPump');
    G.add(pumpBody);
    world.reg(pumpBody, 'fuel.hpPump', {
      explode: [0, 0, -190],
      state: (st) => {
        const a = activeInj(st);
        const n = rpmOf(st) / 2;
        return `泵轴 ${n.toFixed(0)} r/min（曲轴 ½）· 循环供油量 ${qCycle(st).toFixed(1)} mm³`
          + ` · ${a ? `第 ${a.n} 缸供油中` : '各缸供油间歇'} · 供油量 ${flowLh(st).toFixed(1)} L/h`;
      },
    });

    // 泵安装螺栓（4 × M12，穿法兰拧入缸体）
    const bg = U.hexBolt(19, 11, 12, 26);
    bg.rotateX(-Math.PI / 2);          // 头部朝 −Z，螺杆朝 +Z 拧入缸体
    const bolts = U.instances(bg, mats.boltSteel, [
      { pos: [-140, 160, -138] }, { pos: [-140, 198, -138] },
      { pos: [58, 160, -138] }, { pos: [58, 198, -138] },
    ], 'fuel.pumpMountBolt');
    FST.add(bolts);
    world.reg(bolts, 'fuel.pumpMountBolt', {
      state: (st) => `预紧 ${(78 + 6 * ld(st)).toFixed(0)} N·m · 承受泵体 ${(2.4 + 9 * ld(st)).toFixed(1)} kN 冲击反力`,
    });
  }

  /* ---------------------------------------------------------------
   * 2. 泵凸轮轴（含 4 个按点火顺序 1-3-4-2 布置的凸轮）+ 驱动端联轴节
   * ------------------------------------------------------------- */
  const camMesh = (() => {
    const parts = [];
    // 轴身（含 −X 驱动端伸出、+X 伸入调速器）
    let g = U.cylX(PUMP.camDia, 335, 20); g.translate(-27.5, 0, 0); parts.push(g);
    // 5 道轴颈略粗
    for (const jx of [-150, -100, -40, 20, 75]) {
      g = U.cylX(PUMP.camDia + 4, 18, 20); g.translate(jx, 0, 0); parts.push(g);
    }
    // 4 个凸轮：桃尖角 = 90° + (相位 + 桃尖循环角)/2
    PUMP.plungerX.forEach((px, i) => {
      const nose = 90 + (CYL_PHASE[i + 1] + CAM_PEAK) / 2;
      const cg = U.polarExtrude(
        (a) => PUMP.baseR + PUMP.lift * camBump(a / D2R - nose), PUMP.camW, 72);
      cg.rotateY(-Math.PI / 2);        // 截面 x→世界 z、y→世界 y，厚度沿 X
      cg.translate(px, 0, 0);
      parts.push(cg);
    });
    // 驱动端半圆键
    g = U.roundBox(18, 6, 8, 1); g.rotateY(Math.PI / 2); g.translate(-176, 15, 0); parts.push(g);
    const m = U.mesh(mergeAll(parts), mats.nitridedSteel, [0, PUMP.camY, PUMP.z], [0, 0, 0], 'fuel.pumpCamshaft');
    G.add(m);
    world.reg(m, 'fuel.pumpCamshaft', {
      state: (st) => {
        const a = activeInj(st);
        return `${(rpmOf(st) / 2).toFixed(0)} r/min（曲轴转速 ×0.5）· 凸轮升程 ${PUMP.lift} mm`
          + ` · 桃尖顺序 1-3-4-2 · ${a ? `第 ${a.n} 缸柱塞处于有效供油行程` : '4 缸均在进油/回油行程'}`;
      },
    });
    return m;
  })();

  const couplingMesh = (() => {
    const parts = [];
    let g = U.cylX(60, 16, 24); g.translate(-186, 0, 0); parts.push(g);   // 联轴节凸缘
    g = U.cylX(42, 22, 20); g.translate(-171, 0, 0); parts.push(g);       // 轮毂
    g = U.cylX(26, 14, 16); g.translate(-201, 0, 0); parts.push(g);       // 与正时齿轮相连的花键轴头
    for (let k = 0; k < 3; k++) {                                          // 3 个连接螺栓孔凸台
      const a = k * TAU / 3 + 0.4;
      g = U.cylX(11, 20, 10); g.translate(-186, Math.sin(a) * 22, Math.cos(a) * 22); parts.push(g);
    }
    const m = U.mesh(mergeAll(parts), mats.forgedSteel, [0, PUMP.camY, PUMP.z], [0, 0, 0], 'fuel.driveCoupling');
    G.add(m);
    world.reg(m, 'fuel.driveCoupling', {
      explode: [-140, 0, 0],
      state: (st) => `由正时齿轮（z=${P.timing.pumpGear.z}）驱动 ${(rpmOf(st) / 2).toFixed(0)} r/min`
        + ` · 传递扭矩 ≈ ${(9 + 26 * ld(st)).toFixed(1)} N·m · 供油提前角 ${ADV}°CA`,
    });
    return m;
  })();

  /* ---------------------------------------------------------------
   * 3. 柱塞偶件：滚轮挺柱 / 柱塞 / 控制套 / 柱塞套 / 出油阀
   * ------------------------------------------------------------- */
  const tappetMs = [], plungerMs = [], sleeveMs = [];
  {
    const tappets = [], plungers = [], sleeves = [], barrels = [], dvalves = [];
    PUMP.plungerX.forEach((px, i) => {
      // —— 滚轮挺柱（含滚子），随凸轮升程上下 ——
      const tp = [];
      let g = U.tubeShell(STK.tappetDia, 19, STK.tappetY1 - STK.tappetY0, 18);
      g.translate(0, (STK.tappetY0 + STK.tappetY1) / 2, 0); tp.push(g);
      g = U.disc(STK.tappetDia, 4, 0, 18); g.translate(0, STK.tappetY1 - 2, 0); tp.push(g);
      g = U.cylX(STK.rollerDia, STK.rollerW, 16); g.translate(0, STK.rollerY, 0); tp.push(g);   // 滚子
      g = U.cylX(7, STK.rollerW + 10, 10); g.translate(0, STK.rollerY, 0); tp.push(g);          // 滚子轴
      const tGeo = down(mergeAll(tp), STK.tappetY0);
      const tHolder = new THREE.Group();
      tHolder.position.set(px, STK.tappetY0, PUMP.z);
      const tM = U.mesh(tGeo, mats.forgedSteel, [0, 0, 0], [0, 0, 0], 'fuel.rollerTappet');
      tHolder.add(tM); G.add(tHolder);
      tappetMs.push(tM); tappets.push(tHolder);

      // —— 柱塞（下端凸缘 + 螺旋斜槽示意）——
      const pp = [];
      g = U.disc(STK.footDia, STK.footY1 - STK.footY0, 0, 16);
      g.translate(0, (STK.footY0 + STK.footY1) / 2, 0); pp.push(g);
      g = U.cyl(STK.plDia, STK.plY1 - STK.plY0, 16);
      g.translate(0, (STK.plY0 + STK.plY1) / 2, 0); pp.push(g);
      g = U.cyl(STK.plDia + 1.2, 3, 16); g.translate(0, STK.plY1 - 9, 0); pp.push(g);   // 斜槽台肩示意
      const pGeo = down(mergeAll(pp), STK.plY0);
      const pHolder = new THREE.Group();
      pHolder.position.set(px, STK.plY0, PUMP.z);
      const pM = U.mesh(pGeo, mats.hardChrome, [0, 0, 0], [0, 0, 0], 'fuel.plunger');
      pHolder.add(pM); G.add(pHolder);
      plungerMs.push(pM); plungers.push(pHolder);

      // —— 控制套（齿圈，绕柱塞转动改变供油量）——
      const sp = [];
      g = U.tubeShell(STK.slDia, STK.plDia + 0.6, STK.slY1 - STK.slY0, 18); sp.push(g);
      for (let k = 0; k < 14; k++) {          // 外圈齿
        const a = (k / 14) * TAU;
        const tg = U.roundBox(3.2, STK.slY1 - STK.slY0 - 3, 2.6, 0.6);
        tg.translate(0, 0, STK.slDia / 2);
        tg.rotateY(a);
        sp.push(tg);
      }
      const sM = U.mesh(mergeAll(sp), mats.gearSteel,
        [px, (STK.slY0 + STK.slY1) / 2, PUMP.z], [0, 0, 0], 'fuel.controlSleeve');
      G.add(sM); sleeveMs.push(sM); sleeves.push(sM);

      // —— 柱塞套（与柱塞研配间隙 1~2 μm）——
      const bg = U.tubeShell(STK.brDia, STK.plDia + 0.4, STK.brY1 - STK.brY0, 20);
      const bM = U.mesh(bg, mats.nitridedSteel, [px, (STK.brY0 + STK.brY1) / 2, PUMP.z]);
      G.add(bM); barrels.push(bM);

      // —— 出油阀（阀体六方 + 高压油管接头 + 内部锥阀示意）——
      const dp = [];
      g = U.disc(STK.dvAcross, STK.dvY1 - STK.dvY0, 0, 6);
      g.translate(0, (STK.dvY0 + STK.dvY1) / 2, 0); dp.push(g);
      g = U.cyl(STK.nipDia, STK.nipY1 - STK.nipY0, 14);
      g.translate(0, (STK.nipY0 + STK.nipY1) / 2, 0); dp.push(g);
      g = U.cyl(STK.nipDia + 5, 5, 14); g.translate(0, STK.nipY0 + 2, 0); dp.push(g);
      g = U.cyl(9, 9, 12, 4); g.translate(0, STK.dvY0 + 6, 0); dp.push(g);     // 锥形出油阀芯
      const dM = U.mesh(mergeAll(dp), mats.forgedSteel, [px, 0, PUMP.z]);
      G.add(dM); dvalves.push(dM);
    });

    world.reg(tappets, 'fuel.rollerTappet', {
      explode: [0, -80, 0],
      state: (st) => {
        const a = activeInj(st);
        const i = a ? a.i : 0;
        const lift = PUMP.lift * camBump((cycOf(st, i) - CAM_PEAK) / 2);
        return `第 ${i + 1} 缸挺柱升程 ${lift.toFixed(2)}/${PUMP.lift} mm`
          + ` · 滚子接触应力 ≈ ${(420 + 380 * ld(st)).toFixed(0)} MPa`;
      },
    });
    world.reg(plungers, 'fuel.plunger', {
      explode: [0, 130, 0],
      state: (st) => {
        const a = activeInj(st);
        if (!a) {
          const lift = PUMP.lift * camBump((cycOf(st, 0) - CAM_PEAK) / 2);
          return `第 1 缸柱塞升程 ${lift.toFixed(2)}/${PUMP.lift} mm · 进油/回油行程（斜槽与回油孔连通）`;
        }
        const lift = PUMP.lift * camBump((cycOf(st, a.i) - CAM_PEAK) / 2);
        return `第 ${a.n} 缸柱塞升程 ${lift.toFixed(2)}/${PUMP.lift} mm · 有效行程供油中`
          + ` · 泵端压力 ≈ ${peakPressure(st).toFixed(0)} MPa`;
      },
    });
    world.reg(sleeves, 'fuel.controlSleeve', {
      state: (st) => `随齿杆转过 ${(rackTravel(st) / (STK.slDia / 2) / D2R).toFixed(0)}°`
        + ` · 有效行程对应供油量 ${qCycle(st).toFixed(1)} mm³/循环`,
    });
    world.reg(barrels, 'fuel.plungerBarrel', {
      explode: [0, 90, 0],
      state: (st) => `与柱塞研配间隙 1~2 μm · 套内压力 ${(activeInj(st) ? peakPressure(st) : 1.8).toFixed(1)} MPa`
        + ` · 泄漏量 < ${(0.4 + 0.9 * ld(st)).toFixed(2)} mm³/循环`,
    });
    world.reg(dvalves, 'fuel.deliveryValve', {
      explode: [0, 150, 0],
      state: (st) => {
        const a = activeInj(st);
        return a
          ? `第 ${a.n} 缸出油阀开启 · 管内压力 ${peakPressure(st).toFixed(0)} MPa · 卸载容积回吸中`
          : `全闭 · 保持管内残压 ${(14 + 4 * ld(st)).toFixed(0)} MPa（防止二次喷射）`;
      },
    });
  }

  /* ---------------------------------------------------------------
   * 4. 油量调节齿杆（拉杆）—— 随 st.load 沿 X 移动
   * ------------------------------------------------------------- */
  const rackHolder = new THREE.Group();
  {
    const parts = [];
    let g = U.cylX(STK.rackDia, 265, 12); parts.push(g);
    for (const px of PUMP.plungerX) {          // 与控制套啮合的齿段
      g = U.roundBox(20, 7, 3.4, 0.8);
      g.translate(px + 32.5, 0, 3.6); parts.push(g);
    }
    g = U.cylX(14, 10, 12); g.translate(120, 0, 0); parts.push(g);    // 与调速器连接的球头
    const geo = mergeAll(parts);
    geo.translate(-32.5, 0, 0);                // 使几何中心对应 X = −32.5（杆跨 −165…100）
    const m = U.mesh(geo, mats.nitridedSteel, [0, 0, 0], [0, 0, 0], 'fuel.rack');
    rackHolder.position.set(-32.5, STK.rackY, STK.rackZ);
    rackHolder.add(m); G.add(rackHolder);
    world.reg(rackHolder, 'fuel.rack', {
      explode: [0, 60, -40],
      state: (st) => {
        const t = rackTravel(st);
        const over = rpmOf(st) > 2500;
        return `齿杆位置 ${t.toFixed(1)}/10 mm · 负荷 ${(ld(st) * 100).toFixed(0)}%`
          + ` · 循环供油量 ${qCycle(st).toFixed(1)} mm³ · ${over ? '调速器超速减油中' : '调速器随动'}`;
      },
    });
    rackHolder.userData.rackMesh = m;
  }

  /* ---------------------------------------------------------------
   * 5. 机械式离心调速器壳体 + 调速手柄 + 油门拉杆
   * ------------------------------------------------------------- */
  {
    const parts = [];
    let g = U.roundBox(PUMP.govX1 - PUMP.govX0, PUMP.govY1 - PUMP.bodyY0, PUMP.govD, 8);
    g.translate((PUMP.govX0 + PUMP.govX1) / 2, (PUMP.bodyY0 + PUMP.govY1) / 2, PUMP.z);
    parts.push(g);
    g = U.cylX(72, 17, 24); g.translate(163, 190, PUMP.z); parts.push(g);       // 后端盖
    g = U.cylX(30, 8, 16); g.translate(174, 190, PUMP.z); parts.push(g);        // 转速调整螺塞
    g = U.cyl(26, 10, 16); g.translate(130, PUMP.govY1 + 3, -200); parts.push(g); // 手柄轴承座
    g = U.cylZ(22, 14, 14); g.translate(120, 200, -221); parts.push(g);         // 停车拉钮座
    const m = U.mesh(mergeAll(parts), mats.alumCast, [0, 0, 0], [0, 0, 0], 'fuel.governor');
    G.add(m);
    world.reg(m, 'fuel.governor', {
      explode: [150, 0, -60],
      state: (st) => {
        const r = rpmOf(st);
        const w = U.clamp((r - 600) / (2600 - 600), 0, 1);
        const mode = r > 2500 ? '高速限速段（飞球张开、强制减油）'
          : (r < 820 ? '怠速稳速段（怠速弹簧起作用）' : '调速弹簧与飞球离心力平衡');
        return `设定 ${r.toFixed(0)} r/min · 飞球张开度 ${(w * 100).toFixed(0)}% · ${mode}`;
      },
    });

    // 调速手柄（绕 Z 摆动，几何以枢轴为原点）
    const lever = U.mesh(
      U.extrudePoly([[-6, -8], [6, -8], [-16, 26], [-26, 26], [-26, 18], [-14, 14]], 8, { bevel: 0.6 }),
      mats.forgedSteel, [130, PUMP.govY1 + 6, -224], [0, 0, 0], 'fuel.governorLever');
    G.add(lever);
    world.reg(lever, 'fuel.governorLever', {
      state: (st) => `油门开度 ${(ld(st) * 100).toFixed(0)}% · 手柄转角 ${(rackTravel(st) * 2.4).toFixed(0)}°`
        + ` · 对应目标转速 ${rpmOf(st).toFixed(0)} r/min`,
    });
    lever.userData.pivot = true;

    // 油门 / 油量控制拉杆（沿 X，随负荷平移）
    const rodHolder = new THREE.Group();
    const rodParts = [];
    let rg = U.cylX(9, 224, 12); rodParts.push(rg);
    rg = U.cylX(16, 12, 12); rg.translate(-112, 0, 0); rodParts.push(rg);         // 前端球头接头
    rg = U.disc(15, 8, 0, 12); rg.translate(104, 0, 0); rodParts.push(rg);        // 与手柄连接叉
    const rodGeo = mergeAll(rodParts);
    rodGeo.translate(-8, 0, 0);
    const rod = U.mesh(rodGeo, mats.paintedBlack, [0, 0, 0], [0, 0, 0], 'fuel.throttleRod');
    rodHolder.position.set(-8, 272, -224);
    rodHolder.add(rod); G.add(rodHolder);
    world.reg(rodHolder, 'fuel.throttleRod', {
      explode: [0, 60, -60],
      state: (st) => `拉杆行程 ${(rackTravel(st) * 1.6).toFixed(1)} mm · 油门 ${(ld(st) * 100).toFixed(0)}%`
        + ` · ${ld(st) > 0.92 ? '全负荷止点（最大供油限位）' : '部分负荷'}`,
    });

    world.addUpdater((st) => {
      const t = rackTravel(st);
      lever.rotation.z = -(t - 5) * 0.055;
      rod.position.x = (t - 5) * 1.6;
    });
  }

  /* ---------------------------------------------------------------
   * 6. 输油泵（活塞式，带手压泵），装在泵体外侧、由泵凸轮轴驱动
   * ------------------------------------------------------------- */
  {
    const parts = [];
    let g = U.cylZ(36, 26, 20); g.translate(-88, 178, -231); parts.push(g);       // 泵体
    g = U.cylZ(44, 8, 20); g.translate(-88, 178, -216); parts.push(g);            // 安装凸缘
    g = U.cylZ(22, 16, 16); g.translate(-88, 178, -252); parts.push(g);           // 手压泵缸筒
    g = U.cylZ(28, 6, 16); g.translate(-88, 178, -261); parts.push(g);            // 手压泵手柄帽
    g = U.cylX(13, 20, 12); g.translate(-104, 170, -231); parts.push(g);          // 进油接头
    g = U.cyl(13, 16, 12); g.translate(-88, 199, -231); parts.push(g);            // 出油接头
    g = U.cyl(17, 5, 12); g.translate(-88, 205, -231); parts.push(g);
    const m = U.mesh(mergeAll(parts), mats.alumCast, [0, 0, 0], [0, 0, 0], 'fuel.feedPump');
    G.add(m);
    world.reg(m, 'fuel.feedPump', {
      explode: [0, 0, -140],
      state: (st) => {
        const p = 0.05 + 0.13 * Math.min(1, rpmOf(st) / 1800);
        return `输油压力 ${p.toFixed(2)} MPa · 供油量 ${(flowLh(st) * 3.4 + 6).toFixed(0)} L/h`
          + `（喷油量的 3~4 倍，多余燃油经回油阀返回）`;
      },
    });
  }

  /* ---------------------------------------------------------------
   * 7. 4 × 喷油器（喷嘴偶件 / 压紧螺帽 / 体 / 进回油接头 / 铜垫圈 / 喷雾）
   * ------------------------------------------------------------- */
  const needleMs = [], bodyMats = [], sprayMs = [];
  {
    const nozzles = [], nuts = [], bodies = [], inlets = [], returns = [], washers = [], sprays = [];

    // 喷雾锥（7 孔 × 150° 锥角，示意；长度受限于缸套内壁与活塞燃烧室，取 15 mm）
    const sprayGeo = (() => {
      const jets = [];
      for (let k = 0; k < 7; k++) {
        const jg = U.cyl(6.5, 15, 6, 1.2);
        jg.translate(0, -7.5, 0);
        jg.rotateZ(75 * D2R);
        jg.rotateY((k / 7) * TAU);
        jets.push(jg);
      }
      return mergeAll(jets);
    })();
    const sprayMat = mats.oilVol.clone();
    sprayMat.name = '柴油雾束（示意）';
    sprayMat.color = new THREE.Color(0xffd9a8);
    sprayMat.opacity = 0.34;

    CYL_X.forEach((cx, i) => {
      // —— 针阀偶件（喷嘴体）：φ17 体 + φ6.8 头部 + 7 × φ0.22 喷孔尖端 ——
      const nz = U.lathe([
        [0.7, INJ.tipY], [1.7, INJ.tipY + 0.7], [3.4, 331.4], [3.4, 333.2],
        [8.5, 336], [8.5, 366], [10.5, 368], [10.5, 372], [0.7, 372],
      ], 20);
      const nzM = U.mesh(nz, mats.nitridedSteel, [cx, 0, INJ.z], [0, 0, 0], 'fuel.nozzle');
      G.add(nzM); nozzles.push(nzM);

      // —— 针阀（可动，升程放大到 0.6 mm）——
      const ndGeo = down(U.lathe([
        [0.3, INJ.ndlY0], [0.9, INJ.ndlY0 + 1.4], [0.9, 333], [2.6, 335.4],
        [2.6, 352], [3.0, 353], [3.0, 392], [4.6, 393], [4.6, INJ.ndlY1], [0.3, INJ.ndlY1],
      ], 14), INJ.ndlY0);
      const ndHolder = new THREE.Group();
      ndHolder.position.set(cx, INJ.ndlY0, INJ.z);
      const ndM = U.mesh(ndGeo, mats.hardChrome, [0, 0, 0], [0, 0, 0], 'fuel.needle');
      ndHolder.add(ndM); G.add(ndHolder);
      needleMs.push(ndM);
      if (i === 0) world.reg(ndHolder, 'fuel.needle', {
        explode: [0, -230, 0],
        state: (st) => {
          const a = activeInj(st);
          if (!a) return `落座关闭 · 开启压力 ${popPressure(st).toFixed(1)} MPa · 承压面为 φ6 针阀锥面`;
          const lf = needleShape(a.u);
          return `第 ${a.n} 缸针阀升程 ${lf.toFixed(2)} mm（真实 ${(lf / 2).toFixed(2)} mm）`
            + ` · 开启压力 ${popPressure(st).toFixed(1)} MPa`;
        },
      });
      else world.reg(ndHolder, 'fuel.needle');

      // —— 压紧螺帽（喷嘴紧帽）——
      const ntParts = [];
      let g = U.tubeShell(INJ.nutDia, 17.4, INJ.nutHexY0 - INJ.nutY0, 18);
      g.translate(0, (INJ.nutY0 + INJ.nutHexY0) / 2, 0); ntParts.push(g);
      g = U.disc(INJ.nutHex, INJ.nutY1 - INJ.nutHexY0, 17.4, 6);
      g.translate(0, (INJ.nutHexY0 + INJ.nutY1) / 2, 0); ntParts.push(g);
      const ntM = U.mesh(mergeAll(ntParts), mats.forgedSteel, [cx, 0, INJ.z], [0, 0, 0], 'fuel.injNut');
      G.add(ntM); nuts.push(ntM);

      // —— 喷油器体（含调压弹簧腔、上端护帽）——
      const bd = U.lathe([
        [0.8, INJ.bodyY0], [15.5, INJ.bodyY0], [15.5, 402], [13, 404], [13, 430],
        [15, 432], [15, 436], [13, 438], [13, 470], [11, 472], [11, 494],
        [10, 496], [10, INJ.capY1], [0.8, INJ.capY1],
      ], 20);
      const bMat = mats.forgedSteel.clone();
      bMat.name = '喷油器体（合金钢）';
      bMat.emissive = new THREE.Color(0xff7a28);
      bMat.emissiveIntensity = 0;
      bodyMats.push(bMat);
      const bM = U.mesh(bd, bMat, [cx, 0, INJ.z], [0, 0, 0], 'fuel.injBody');
      G.add(bM); bodies.push(bM);

      // —— 进油接头（−Z 侧，接高压油管）——
      const inParts = [];
      g = U.cylZ(14, 18, 14); g.translate(0, 0, 1); inParts.push(g);          // 世界 Z 6…24
      g = U.disc(17, 11, 0, 6); g.rotateX(Math.PI / 2); g.translate(0, 0, -5.5); inParts.push(g);
      g = U.cylZ(8, 7, 10); g.translate(0, 0, -11); inParts.push(g);          // 油管锥面接口
      const inM = U.mesh(mergeAll(inParts), mats.chrome, [cx, INJ.inletY, INJ.z - 20]);
      G.add(inM); inlets.push(inM);

      // —— 回油管接头（+Z 侧）——
      const rtParts = [];
      g = U.cylZ(12, 16, 12); g.translate(0, 0, 8); rtParts.push(g);
      g = U.disc(15, 9, 0, 6); g.rotateX(Math.PI / 2); g.translate(0, 0, 13); rtParts.push(g);
      const rtM = U.mesh(mergeAll(rtParts), mats.brass, [cx, INJ.retY, INJ.z + 10]);
      G.add(rtM); returns.push(rtM);

      // —— 铜垫圈（喷油器与缸盖底面之间的密封垫）——
      const wM = U.mesh(U.tubeShell(INJ.washOD, INJ.washID, INJ.washH, 20),
        mats.copper, [cx, INJ.washY, INJ.z]);
      FST.add(wM); washers.push(wM);

      // —— 喷雾锥（示意）——
      const spM = U.mesh(sprayGeo, sprayMat, [cx, INJ.tipY - 0.5, INJ.z]);
      spM.castShadow = false; spM.receiveShadow = false; spM.visible = false;
      VOL.add(spM); sprays.push(spM); sprayMs.push(spM);
    });

    world.reg(nozzles, 'fuel.nozzle', {
      explode: [0, -170, 0],
      state: (st) => {
        const a = activeInj(st);
        return a
          ? `第 ${a.n} 缸喷射中 · ${FP.nozzleHoles} × φ${FP.nozzleHoleDia} mm 喷孔 · 喷射压力 ${peakPressure(st).toFixed(0)} MPa`
          : `关闭 · 座面密封（残压 ${(14 + 4 * ld(st)).toFixed(0)} MPa）· 喷孔 ${FP.nozzleHoles} × φ${FP.nozzleHoleDia} mm`;
      },
    });
    world.reg(nuts, 'fuel.injNut', {
      explode: [0, -110, 0],
      state: (st) => `拧紧力矩 70 N·m · 压紧针阀偶件端面（承受 ${peakPressure(st).toFixed(0)} MPa 内压）`,
    });
    world.reg(bodies, 'fuel.injBody', {
      explode: [0, 90, 0],
      state: (st) => {
        const a = activeInj(st);
        if (!a) {
          const s = st && st.cyl && st.cyl[0] && st.cyl[0].stroke;
          return `关闭 · 等待压缩行程（${(s && s.cn) || '压缩'}）· 开启压力 ${popPressure(st).toFixed(1)} MPa`;
        }
        return `第 ${a.n} 缸 · 喷油中（供油提前角 ${ADV}°CA）· 持续 ${a.dur.toFixed(0)}°CA`
          + ` · 本循环 ${qCycle(st).toFixed(1)} mm³`;
      },
    });
    world.reg(inlets, 'fuel.injInlet', {
      state: (st) => {
        const a = activeInj(st);
        return `进油接头（φ${LINE.hpOD} 高压油管）· ${a ? `第 ${a.n} 缸压力波 ${peakPressure(st).toFixed(0)} MPa` : `残压 ${(14 + 4 * ld(st)).toFixed(0)} MPa`}`;
      },
    });
    world.reg(returns, 'fuel.injReturn', {
      state: (st) => `回油（漏泄）量 ${(0.9 + 2.6 * ld(st)).toFixed(1)} L/h · 燃油温度 ${(28 + 46 * ld(st)).toFixed(0)} ℃`,
    });
    world.reg(washers, 'fuel.copperWasher', {
      explode: [0, -250, 0],
      state: (st) => `密封燃烧室（缸压 ${(st && st.cyl && st.cyl[0] ? st.cyl[0].pressure || 0 : 0).toFixed(0)} bar）`
        + ` · 兼作喷油器向缸盖的导热路径（${(180 + 90 * ld(st)).toFixed(0)} ℃）`,
    });
    world.reg(sprays, 'fuel.sprayCone', {
      state: (st) => {
        const a = activeInj(st);
        return a
          ? `第 ${a.n} 缸 ${FP.nozzleHoles} 束油雾 · 贯穿度 ≈ ${(18 + 12 * ld(st)).toFixed(0)} mm · 索特平均直径 ≈ 22 μm`
          : `无喷射 · 下一次喷射在压缩上止点前 ${ADV}°CA`;
      },
    });
  }

  /* ---------------------------------------------------------------
   * 8. 燃油粗 / 细滤清器（座、支架、壳体、滤芯、放气螺钉）
   * ------------------------------------------------------------- */
  {
    // 滤清器座（两只独立铸铝座）
    const baseParts = [];
    let g = U.roundBox(76, FLT.baseY1 - FLT.baseY0, FLT.baseD, 5);
    g.translate(FLT.coarseX, (FLT.baseY0 + FLT.baseY1) / 2, FLT.z); baseParts.push(g);
    g = U.roundBox(72, FLT.baseY1 - FLT.baseY0, FLT.baseD, 5);
    g.translate(FLT.fineX, (FLT.baseY0 + FLT.baseY1) / 2, FLT.z); baseParts.push(g);
    g = U.cylX(20, 16, 12); g.translate(FLT.coarseX - 42, 366, FLT.z); baseParts.push(g); // 粗滤进油接头（−X 端）
    g = U.cylZ(16, 16, 12); g.translate(FLT.coarseX, 370, FLT.z - 32); baseParts.push(g); // 连通管接口
    g = U.cylZ(16, 16, 12); g.translate(FLT.fineX, 370, FLT.z - 32); baseParts.push(g);
    g = U.cylX(20, 16, 12); g.translate(FLT.fineX + 40, 366, FLT.z); baseParts.push(g);   // 细滤出油接头（+X 端）
    for (const bx of [FLT.coarseX, FLT.fineX]) {   // 中心螺杆头
      g = U.disc(20, 10, 0, 6); g.translate(bx, FLT.baseY1 + 4, FLT.z - 14); baseParts.push(g);
    }
    const baseM = U.mesh(mergeAll(baseParts), mats.alumCast, [0, 0, 0], [0, 0, 0], 'fuel.filterBase');
    G.add(baseM);
    world.reg(baseM, 'fuel.filterBase', {
      explode: [-60, 40, -60],
      state: (st) => `进油 ${(flowLh(st) * 3.4 + 6).toFixed(0)} L/h · 座内压力 ${(0.05 + 0.13 * Math.min(1, rpmOf(st) / 1800)).toFixed(2)} MPa`,
    });

    // 支架：每只滤清器一条自缸体进气侧外壁（Z=−130）伸出的横臂 + 一根立柱托住滤清器座；
    //       全部位于进气支管（Y≳355）之下、增压冷管（Z≲−266）之内的空档
    const brParts = [];
    for (const bx of [FLT.coarseX, FLT.fineX]) {
      g = U.roundBox(34, 26, 90, 4); g.translate(bx, 296, -175); brParts.push(g);   // 横臂 Z −220…−130
      g = U.roundBox(34, 60, 30, 4); g.translate(bx, 326, -213); brParts.push(g);   // 立柱 Y 296…356
      g = U.roundBox(46, 40, 8, 3); g.translate(bx, 300, -128); brParts.push(g);    // 缸体侧固定板
      g = U.disc(15, 9, 0, 6); g.translate(bx - 15, 312, -136); brParts.push(g);    // 固定螺栓头
      g = U.disc(15, 9, 0, 6); g.translate(bx + 15, 288, -136); brParts.push(g);
    }
    const brM = U.mesh(mergeAll(brParts), mats.steelSheet, [0, 0, 0], [0, 0, 0], 'fuel.filterBracket');
    G.add(brM);
    world.reg(brM, 'fuel.filterBracket', {
      explode: [0, 40, -120],
      state: (st) => `托装滤清器组（含燃油约 6.5 kg）· 承受 ${(1.1 + 0.9 * Math.min(1, rpmOf(st) / 2200)).toFixed(1)} g 振动惯性力`
        + ` · 4 × M10 固定于缸体进气侧`,
    });

    // 粗滤器壳体（沉淀杯式，底部放水螺塞）
    const cs = U.lathe([
      [0.6, FLT.coarseY0 - 1], [12, FLT.coarseY0 - 3], [26, FLT.coarseY0], [36, FLT.coarseY0 + 9],
      [FLT.coarseDia / 2, FLT.coarseY0 + 20], [FLT.coarseDia / 2, FLT.bowlY1 - 6],
      [30, FLT.bowlY1], [0.6, FLT.bowlY1],
    ], 22);
    const csM = U.mesh(cs, mats.steelSheet, [FLT.coarseX, 0, FLT.z], [0, 0, 0], 'fuel.coarseFilter');
    G.add(csM);
    world.reg(csM, 'fuel.coarseFilter', {
      explode: [0, -150, -60],
      state: (st) => `通过流量 ${(flowLh(st) * 3.4 + 6).toFixed(0)} L/h · 压差 ${(0.004 + 0.010 * ld(st)).toFixed(3)} MPa`
        + ` · 滤除 > 60 μm 杂质并沉淀水分`,
    });

    // 细滤器壳体（纸质滤芯，φ96）
    const fd = FP.filterDia;
    const fs = U.lathe([
      [0.6, FLT.fineY0 + 2], [14, FLT.fineY0], [34, FLT.fineY0 + 2], [fd / 2 - 3, FLT.fineY0 + 12],
      [fd / 2, FLT.fineY0 + 22], [fd / 2, FLT.bowlY1 - 8], [fd / 2 - 6, FLT.bowlY1 - 2],
      [34, FLT.bowlY1], [0.6, FLT.bowlY1],
    ], 24);
    const fsM = U.mesh(fs, mats.steelSheet, [FLT.fineX, 0, FLT.z], [0, 0, 0], 'fuel.fineFilter');
    G.add(fsM);
    world.reg(fsM, 'fuel.fineFilter', {
      explode: [0, -150, -60],
      state: (st) => `通过流量 ${(flowLh(st) * 3.4 + 6).toFixed(0)} L/h · 压差 ${(0.010 + 0.026 * ld(st)).toFixed(3)} MPa`
        + ` · 过滤精度 5 μm（保护柱塞偶件与针阀偶件）`,
    });

    // 滤芯（褶皱纸芯，2 只）
    const elems = [];
    [[FLT.coarseX, 60, FLT.coarseY0 + 12, FLT.bowlY1 - 12],
    [FLT.fineX, 78, FLT.fineY0 + 26, FLT.bowlY1 - 14]].forEach(([x, dia, y0, y1]) => {
      const pleat = U.polarExtrude(
        (a) => dia / 2 - 2 + 2 * Math.sin(a * 26), y1 - y0, 132);
      pleat.rotateX(-Math.PI / 2);                    // 截面 → XZ 平面，厚度沿 Y
      const core = U.tubeShell(dia * 0.42, dia * 0.34, y1 - y0, 16);
      const geo = mergeAll([pleat, core]);
      const m = U.mesh(geo, mats.filterPaper, [x, (y0 + y1) / 2, FLT.z]);
      G.add(m); elems.push(m);
    });
    world.reg(elems, 'fuel.filterElement', {
      explode: [0, -190, -60],
      state: (st) => `已通过燃油 ${(flowLh(st)).toFixed(1)} L/h · 建议 200 h 更换`
        + ` · 当前流通阻力 ${(0.010 + 0.026 * ld(st)).toFixed(3)} MPa`,
    });

    // 放气螺钉（2 只，装在滤清器座顶面最高处）
    const bs = [];
    for (const x of [FLT.coarseX + 20, FLT.fineX + 20]) {
      const m = U.mesh(U.hexBolt(13, 7, 8, 13), mats.boltSteel, [x, FLT.baseY1, FLT.z + 16]);
      FST.add(m); bs.push(m);
    }
    world.reg(bs, 'fuel.bleedScrew', {
      state: (st) => `${rpmOf(st) > 0 ? '关闭（系统已排净空气）' : '起动前需松开放气，排出滤清器内空气'}`
        + ` · 低压油路压力 ${(0.05 + 0.13 * Math.min(1, rpmOf(st) / 1800)).toFixed(2)} MPa`,
    });
  }

  /* ---------------------------------------------------------------
   * 9. 高压油管（4 根等长 φ6.35 × φ2 厚壁钢管，带盘绕弯）
   * ------------------------------------------------------------- */
  const hpLen = [];
  {
    const path = (i, turns) => {
      const x0 = PUMP.plungerX[i], rx = HP.runX[i], xe = CYL_X[i];
      const crossY = HP.crossY0 + HP.crossDY * i;
      const cx = rx - 12;                       // 盘绕弯起始 X（沿 +X 每圈进给 6mm）
      const p = [
        [x0, STK.nipY1, PUMP.z],                // 出油阀接头
        [x0, STK.nipY1 + 14, PUMP.z],
        [(x0 + cx) / 2, 288, PUMP.z - 4],
      ];
      // 盘绕弯：Y−Z 平面内的螺旋（典型等长化盘绕，轴向沿 X 微进给）
      const n = Math.max(16, Math.round(turns * 18));
      for (let k = 0; k <= n; k++) {
        const t = k / n, a = -Math.PI / 2 + t * turns * TAU;
        p.push([cx + t * turns * 6,
          HP.coilY + Math.sin(a) * HP.coilR,
          HP.coilZ + Math.cos(a) * HP.coilR]);
      }
      // 转入竖直段（走两条进气支管之间的空档），再跨越气门室罩上方
      p.push([rx, 352, HP.runZ]);
      p.push([rx, 400, HP.runZ]);
      p.push([rx, 444, HP.runZ]);
      p.push([rx, 470, HP.runZ - 2]);
      p.push([rx + (xe - rx) * 0.22, crossY - 6, -150]);
      p.push([rx + (xe - rx) * 0.56, crossY, -104]);
      p.push([rx + (xe - rx) * 0.86, crossY, -46]);
      p.push([xe, crossY - 6, -20]);
      p.push([xe, 504, -8]);
      p.push([xe, INJ.inletY + 1, 2]);
      return p;
    };
    const clen = (p) => new THREE.CatmullRomCurve3(
      p.map((q) => new THREE.Vector3(q[0], q[1], q[2])), false, 'catmullrom', 0.35).getLength();

    const TMIN = 1.0, TMAX = 1.95;
    let target = 0;
    for (let i = 0; i < 4; i++) target = Math.max(target, clen(path(i, TMIN)));
    target += 26;

    const pipes = [];
    for (let i = 0; i < 4; i++) {
      let turns = TMAX;
      if (clen(path(i, TMAX)) > target) {
        let lo = TMIN, hi = TMAX;
        for (let k = 0; k < 24; k++) {
          const mid = (lo + hi) / 2;
          if (clen(path(i, mid)) < target) lo = mid; else hi = mid;
        }
        turns = (lo + hi) / 2;
      }
      const pts = path(i, turns);
      const { geo, curve } = U.pipeFromPoints(pts, LINE.hpOD, 8, 0.35);
      hpLen.push(curve.getLength());
      const m = U.mesh(geo, mats.chrome, [0, 0, 0], [0, 0, 0], 'fuel.hpPipe');
      G.add(m); pipes.push(m);
      // 两端油管接头螺母
      const nutA = U.mesh(U.disc(15, 12, 0, 6), mats.chrome, [PUMP.plungerX[i], STK.nipY1 + 4, PUMP.z]);
      const nutB = U.mesh(U.disc(15, 12, 0, 6), mats.chrome, [CYL_X[i], INJ.inletY + 8, 3], [0.5, 0, 0]);
      G.add(nutA); G.add(nutB); pipes.push(nutA, nutB);
    }
    const avg = hpLen.reduce((a, b) => a + b, 0) / hpLen.length;
    const spread = Math.max(...hpLen) - Math.min(...hpLen);
    world.reg(pipes, 'fuel.hpPipe', {
      state: (st) => {
        const a = activeInj(st);
        return `4 根等长钢管 ${avg.toFixed(0)} mm（极差 ${spread.toFixed(1)} mm）`
          + ` · ${a ? `第 ${a.n} 缸压力波传播中，峰值 ${peakPressure(st).toFixed(0)} MPa` : `静置残压 ${(14 + 4 * ld(st)).toFixed(0)} MPa`}`
          + ` · 压力波传播 ≈ 1400 m/s`;
      },
    });
  }

  /* ---------------------------------------------------------------
   * 10. 低压油路：吸油软管 / 输油泵→粗滤→细滤→高压泵 / 回油管
   * ------------------------------------------------------------- */
  {
    // 油箱 → 输油泵（橡胶吸油软管，−X 端为至油箱示意接口）
    const suction = U.pipeFromPoints([
      [-364, 194, -244], [-300, 188, -246], [-230, 182, -244],
      [-160, 180, -240], [-118, 176, -236], [-104, 172, -232],
    ], LINE.hoseOD, 10, 0.4).geo;
    const sucM = U.mesh(suction, mats.rubber, [0, 0, 0], [0, 0, 0], 'fuel.suctionHose');
    const sucEnd = U.mesh(U.cylX(20, 16, 12), mats.brass, [-364, 194, -244]);
    G.add(sucM); G.add(sucEnd);
    world.reg([sucM, sucEnd], 'fuel.suctionHose', {
      state: (st) => `吸油量 ${(flowLh(st) * 3.4 + 6).toFixed(0)} L/h · 真空度 ${(0.008 + 0.012 * Math.min(1, rpmOf(st) / 1800)).toFixed(3)} MPa`
        + ` · 内壁耐柴油 NBR 软管`,
    });

    // 输油泵 → 粗滤器（钢管，从泵体外侧沿缸体下方前行，再在正时齿轮室外侧上行）
    const lp1 = U.pipeFromPoints([
      [-88, 208, -231], [-140, 200, -236], [-240, 196, -240], [-330, 196, -238],
      [-348, 224, -234], [-350, 290, -230], [-348, 348, -226], [-352, 364, -222],
      [FLT.coarseX - 50, 366, FLT.z],
    ], LINE.lpOD, 8, 0.35).geo;
    // 粗滤 → 细滤（外侧连通管）
    const lp2 = U.pipeFromPoints([
      [FLT.coarseX, 370, FLT.z - 34], [FLT.coarseX + 8, 378, FLT.z - 44],
      [-274, 382, FLT.z - 46], [FLT.fineX - 8, 378, FLT.z - 44], [FLT.fineX, 370, FLT.z - 34],
    ], LINE.lpOD, 8, 0.4).geo;
    // 细滤 → 高压泵（钢管，沿泵前方下行至泵头进油接头）
    const lp3 = U.pipeFromPoints([
      [FLT.fineX + 44, 366, FLT.z], [-184, 350, -222], [-176, 316, -224], [-166, 272, -228],
      [-152, 240, -232], [-145, 230, -228],
    ], LINE.lpOD, 8, 0.35).geo;
    const lpM = [lp1, lp2, lp3].map((geo) => {
      const m = U.mesh(geo, mats.chrome, [0, 0, 0], [0, 0, 0], 'fuel.lpPipe');
      G.add(m); return m;
    });
    world.reg(lpM, 'fuel.lpPipe', {
      state: (st) => `低压输油：输油泵→粗滤→细滤→高压泵 · 流量 ${(flowLh(st) * 3.4 + 6).toFixed(0)} L/h`
        + ` · 压力 ${(0.05 + 0.13 * Math.min(1, rpmOf(st) / 1800)).toFixed(2)} MPa`,
    });

    // 喷油器回油总管（4 缸串联，越过气门室罩后从 X≈85 的支管空档下行到泵体回油接头）
    const leak = U.pipeFromPoints([
      [CYL_X[0], INJ.retY, INJ.z + 26], [CYL_X[0] + 40, 502, 58], [CYL_X[1], 500, 60],
      [CYL_X[1] + 40, 502, 58], [CYL_X[2], 500, 60], [CYL_X[2] + 40, 502, 58],
      [CYL_X[3], INJ.retY, INJ.z + 26], [CYL_X[3] - 10, 500, 62], [160, 502, 10],
      [128, 502, -80], [100, 500, -140], [85, 470, -156], [85, 400, -163],
      [85, 320, -168], [82, 274, -190], [70, 252, -208], [62, 244, -218],
    ], LINE.retOD, 8, 0.35).geo;
    const leakM = U.mesh(leak, mats.chrome, [0, 0, 0], [0, 0, 0], 'fuel.leakOffPipe');
    G.add(leakM);
    world.reg(leakM, 'fuel.leakOffPipe', {
      state: (st) => `4 缸漏泄回油 ${(3.6 + 10 * ld(st)).toFixed(1)} L/h · 油温 ${(28 + 46 * ld(st)).toFixed(0)} ℃`
        + ` · 兼作针阀偶件冷却与润滑`,
    });

    // 回油管（高压泵溢流阀 → 油箱）
    const ret = U.pipeFromPoints([
      [60, 244, -226], [20, 238, -232], [-60, 230, -236], [-160, 216, -240],
      [-240, 206, -244], [-320, 202, -248], [-366, 202, -250],
    ], LINE.retOD, 8, 0.35).geo;
    const retM = U.mesh(ret, mats.chrome, [0, 0, 0], [0, 0, 0], 'fuel.returnPipe');
    const retEnd = U.mesh(U.cylX(16, 14, 12), mats.brass, [-366, 202, -250]);
    G.add(retM); G.add(retEnd);
    world.reg([retM, retEnd], 'fuel.returnPipe', {
      state: (st) => `回油 ${(flowLh(st) * 2.4 + 4).toFixed(0)} L/h（多余燃油带走热量返回油箱）`
        + ` · 溢流阀开启压力 0.17 MPa`,
    });
  }

  /* ---------------------------------------------------------------
   * 11. 动画：泵凸轮轴 / 柱塞 / 挺柱 / 控制套 / 齿杆 / 针阀 / 喷雾 / 发光
   * ------------------------------------------------------------- */
  world.addUpdater((st) => {
    const ca = (st && st.crankAngle) || 0;
    // 泵凸轮轴：曲轴转速的 1/2
    camMesh.rotation.x = ca * 0.5 * D2R;
    couplingMesh.rotation.x = ca * 0.5 * D2R;

    // 齿杆位置（随负荷）+ 控制套/柱塞转角
    const travel = rackTravel(st);
    const rackMesh = rackHolder.userData.rackMesh;
    if (rackMesh) rackMesh.position.x = travel - 5;
    const sleeveAng = (travel - 5) / (STK.slDia / 2);

    const dur = injDur(st);
    for (let i = 0; i < 4; i++) {
      const cyc = cycOf(st, i);
      // 柱塞 / 挺柱升程（与凸轮型线一致）
      const lift = PUMP.lift * camBump((cyc - CAM_PEAK) / 2);
      if (plungerMs[i]) {
        plungerMs[i].position.y = lift;
        plungerMs[i].rotation.y = sleeveAng;
      }
      if (tappetMs[i]) tappetMs[i].position.y = lift;
      if (sleeveMs[i]) sleeveMs[i].rotation.y = sleeveAng;

      // 喷油：循环角 702° 起，持续 dur °CA
      let d = cyc - INJ_START;
      if (d < 0) d += 720;
      const on = d < dur && (st ? st.running !== false : true);
      const nl = on ? needleShape(d / dur) : 0;
      if (needleMs[i]) needleMs[i].position.y = nl;
      if (bodyMats[i]) bodyMats[i].emissiveIntensity = (nl / NEEDLE_LIFT) * 1.15;
      const sp = sprayMs[i];
      if (sp) {
        sp.visible = on && nl > 0.04;
        if (sp.visible) {
          const k = 0.55 + 0.45 * (nl / NEEDLE_LIFT);
          sp.scale.set(k, k * (0.7 + 0.5 * ld(st)), k);
        }
      }
    }
  });
}
