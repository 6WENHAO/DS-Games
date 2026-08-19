/**
 * air.js —— 进排气与增压系统（Air Intake / Exhaust / Turbocharging System）
 * ------------------------------------------------------------------------------
 * 全流程：
 *   空气滤清器（滤筒 + 进气罩）→ 进气软管 → 压气机（12 叶后弯式）
 *   → 增压热管 → 空-空中冷器（进气室 / 扁管芯体 + 散热带 / 出气室）
 *   → 增压冷管 → 进气歧管稳压腔 + 4 支管 → 缸盖进气法兰（Z=−138 / Y=386.5）
 *   缸盖排气法兰（Z=+138）→ 4-2-1 等长排气歧管 → 涡轮蜗壳（11 叶径流式涡轮）
 *   → 涡轮出口 → 排气管 → 消声器 → 尾管；旁通支路：废气旁通阀 + 膜片式执行器
 *
 * 坐标：1 unit = 1 mm；+X 后端(飞轮) / −X 前端(正时齿轮室) / +Y 上 / +Z 排气侧
 * 空间占位（见 docs/MODULE-CONTRACT.md）：
 *   进气歧管 Z≈−210(Y 354…430)、排气歧管 Z≈+150…+250、涡轮增压器 (330, 300, 232)
 *   中冷器 X≈−586、空滤 Y≈522/Z≈−300、管路走 |Z|>150 外侧
 *
 * 空间校核（已对整机场景做点云最小距离实测，单位 mm）：
 *   · 中冷器放在散热器(X≈−640)与风扇(X≈−520)之间的 X≈−586，出气室出口颈改为端面轴向伸出
 *     → 与 cooling.fan 44.8、fanShroud 25.2 以上；
 *   · 进气软管走气门室罩上方 Y≈575，跨过曲轴箱通风器(X 191…339 / Y≤510) → 33.4；
 *   · 增压器回油管向前下方绕开飞轮(R188)/飞轮齿圈(R210) → 齿圈 9.7、飞轮 11.5；
 *   · 与燃油系统：leakOffPipe 6.2、hpPipe 8.0、filterBase 8.3（静-静件，允许）；
 *   · 与润滑系统：lube.filterHousing ≥13.9；
 *   · 有意「贴合/穿入」的三处是正确装配关系：歧管法兰经 δ2 垫片贴缸盖法兰面(1.5)、
 *     歧管螺栓螺纹段旋入缸盖、增压器进/回油管端部法兰贴合缸体壁、支管示意腔延伸进缸盖气道。
 *
 * 只使用 three.js 内置几何 + core/util.js；不修改任何 core / 其它模块文件。
 */
import * as THREE from 'three';
import * as U from '../core/util.js';

const D2R = Math.PI / 180;
const YUP = new THREE.Vector3(0, 1, 0);
const ZAX = new THREE.Vector3(0, 0, 1);

/* ============================================================
 * 一、与 src/parts/head.js 实际几何严格对齐的接口尺寸
 * ============================================================ */
/** 进/排气道中心高度：缸盖底平面 (330+1.5) + 55 */
const PORT_Y = 386.5;
/** 缸盖进气法兰外端面 Z（halfWidthZ 122 + 8 + 板厚 8） */
const IN_FACE = -138;
/** 缸盖排气法兰外端面 Z */
const EX_FACE = 138;
/** 气道法兰孔直径（P.head.portDia） */
const PORT_D = 46;
/** 法兰螺栓相对气道中心的 X 偏置（与缸盖法兰上的 φ12 孔一致） */
const BOLT_DX = 42;
/** 缸心 X（P.cylPitch=130）与同缸进/排气门 X 偏置（P.valvetrain.valveOffsetX=23） */
const CYLX = [-195, -65, 65, 195];
const VOFF = 23;
/** 4 个进气口 / 排气口中心 X */
const IN_PX = CYLX.map((x) => x - VOFF);   // [-218, -88,  42, 172]
const EX_PX = CYLX.map((x) => x + VOFF);   // [-172, -42,  88, 218]

/* ============================================================
 * 二、本模块设计常量
 * ============================================================ */
/** 进气歧管稳压腔（沿 X 的铸铝“log”腔，φ76） */
const PLEN = { y: 392, z: -210, r: 38, x0: -176, x1: 258, inletX: -40 };
/** 进气支管在稳压腔上的分支 X（1 缸支管前移，避开燃油滤清器空间） */
const BRANCH_X = [-160, -88, 42, 172];
/** 法兰板 / 垫片 */
const FL = { w: 104, h: 44, t: 13, gasket: 2 };
/** 排气歧管 */
const EXM = {
  runnerD: 46, runnerD2: 52, collD: 58, mergeD: 70,
  jaZ: 196, jaY: 396, jaX: -110,        // 1-2 缸汇合点
  jbZ: 196, jbY: 380, jbX: 152,         // 3-4 缸汇合点
  merge: [196, 342, 228],               // 2-1 总汇合点
  flange: [218, 322, 230],              // 涡轮进口法兰中心（避开机油滤清器顶部 Y=270）
};
/** 涡轮增压器（P.air.turbo：x330 y300 z232 / 涡轮 φ78 / 压气机 φ86 / 蜗壳 R96） */
const TB = {
  org: [330, 300, 232],
  tR: 39,            // 涡轮叶轮半径
  cR: 43,            // 压气机叶轮半径
  tScroll: { a0: 205, a1: 535, r0: 70, r1: 50, d0: 50, d1: 18, y: -53 },
  cScroll: { a0: 30, a1: 360, r0: 58, r1: 72, d0: 20, d1: 46, y: 28 },
  nBladeT: 11, nBladeC: 12,
  wgA: 115,          // 旁通阀口所在蜗壳角度
};
/**
 * 中冷器（空-空，扁管沿 Z，冷却空气沿 X 穿过散热带）
 * X 定位在散热器（X≈−640）与风扇（X≈−520）之间的空档，避免与风扇扫掠面干涉
 */
const IC = {
  x: -586, coreW: 50, tubeH: 3.2, pitch: 10, nTube: 19,
  y0: 240, lenZ: 400, tankZ: 226, tankT: 52,
  inY: 382, outY: 300, neckX: -557,
};
/** 空气滤清器（横置于进气歧管上方） */
const AF = { x: 10, y: 522, z: -300, od: 160, len: 300, elemOD: 122, elemLen: 210 };
/** 管路直径 */
const PIPE = { inlet: 80, hot: 76, cold: 76, down: 76, tail: 66 };
/** 消声器 */
const MUF = { x: 40, y: 48, z: 338, od: 168, len: 300 };

/* ============================================================
 * 三、局部几何工具
 * ============================================================ */
/** 混合索引/非索引几何的安全合并（ExtrudeGeometry 无 index） */
function mg(list) {
  return U.merge(list.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g)));
}

/** 折线 → 光滑采样点（CatmullRom） */
function smooth(list, n, tension = 0.4) {
  const c = new THREE.CatmullRomCurve3(
    list.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(p[0], p[1], p[2]))),
    false, 'catmullrom', tension);
  return c.getPoints(n);
}

/**
 * 沿点列扫掠“变直径圆锥段链”→ 一个几何（用于蜗壳渐缩、锥形支管）
 * @param {THREE.Vector3[]} pts
 * @param {number|number[]} dias 每点直径（数组长度需与 pts 相同）
 */
function sweep(pts, dias, seg = 14, over = 1.6) {
  const out = [];
  const dir = new THREE.Vector3();
  for (let i = 0; i < pts.length - 1; i++) {
    dir.subVectors(pts[i + 1], pts[i]);
    const len = dir.length();
    if (len < 1e-4) continue;
    const d0 = Array.isArray(dias) ? dias[i] : dias;
    const d1 = Array.isArray(dias) ? dias[i + 1] : dias;
    const g = U.cyl(d0, len + over, seg, d1);          // 底=d0(起点) 顶=d1(终点)
    const q = new THREE.Quaternion().setFromUnitVectors(YUP, dir.clone().normalize());
    const mid = new THREE.Vector3().addVectors(pts[i], pts[i + 1]).multiplyScalar(0.5);
    g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
    out.push(g);
  }
  return mg(out);
}

/** 折线 + 起终直径 → 锥形管（内部先光滑采样） */
function taper(list, d0, d1, samples = 12, seg = 14, tension = 0.4) {
  const pts = smooth(list, samples, tension);
  const dias = pts.map((_, i) => U.lerp(d0, d1, i / (pts.length - 1)));
  return sweep(pts, dias, seg);
}

/** 涡壳（蜗形渐缩）：绕局部 Y 轴的螺旋 + 截面渐变 */
function voluteGeo(o, steps = 26, seg = 14) {
  const pts = [];
  const dias = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const a = U.lerp(o.a0, o.a1, u) * D2R;
    const r = U.lerp(o.r0, o.r1, u);
    pts.push(new THREE.Vector3(Math.cos(a) * r, o.y, Math.sin(a) * r));
    dias.push(U.lerp(o.d0, o.d1, u));
  }
  return sweep(pts, dias, seg, 0.8);
}

/** 二次 Bezier（用于叶片子午线） */
function qb(p0, p1, p2, t) {
  const it = 1 - t;
  return [
    it * it * p0[0] + 2 * it * t * p1[0] + t * t * p2[0],
    it * it * p0[1] + 2 * it * t * p1[1] + t * t * p2[1],
  ];
}

/**
 * 叶轮叶片：把 BoxGeometry 的顶点映射到 (子午线 u, 叶高 t, 厚度 s) 参数曲面
 * hub/shroud = [[r,y] 起点, 控制点, 终点]（局部 Y 为转子轴）
 */
function bladeGeo(o) {
  const g = new THREE.BoxGeometry(1, 1, 1, o.uSeg || 7, 1, o.tSeg || 3);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const u = U.clamp(v.x + 0.5, 0, 1);
    const t = U.clamp(v.z + 0.5, 0, 1);
    const s = v.y * 2;                                     // −1 / +1 两个叶面
    const h = qb(o.hub[0], o.hub[1], o.hub[2], u);
    const sh = qb(o.shroud[0], o.shroud[1], o.shroud[2], u);
    const r = U.lerp(h[0], sh[0], t);
    const y = U.lerp(h[1], sh[1], t);
    const thk = o.thk * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, u))));
    const a = o.wrap * D2R * Math.pow(u, o.wrapPow || 1.25) + (s * thk / 2) / Math.max(5, r);
    pos.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
  }
  g.computeVertexNormals();
  return g;
}

/** 绕 Y 轴复制 n 份并合并（叶轮） */
function ring(geo, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(geo.clone().rotateY((i / n) * Math.PI * 2));
  return mg(out);
}

/** 法兰板（截面在 XY、厚度沿 Z，含气道孔 + 2 个螺栓孔） */
function flangeGeo(w, h, t, portD, boltDx) {
  const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  const holes = [U.circlePts(portD / 2, 24)];
  if (boltDx) {
    holes.push(U.circlePts(7, 10, -boltDx, 0));
    holes.push(U.circlePts(7, 10, boltDx, 0));
  }
  return U.extrudePoly(pts, t, { holes, curveSegments: 1 });
}

/** 把“厚度沿 +Z”的几何摆到 pos，并让 +Z 指向 dir */
function orientZ(geo, dir, pos) {
  const q = new THREE.Quaternion().setFromUnitVectors(ZAX, dir.clone().normalize());
  return geo.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(pos[0], pos[1], pos[2]), q, new THREE.Vector3(1, 1, 1)));
}

/** 把“轴向沿 +Y”的几何摆到 pos，并让 +Y 指向 dir */
function orientY(geo, dir, pos) {
  const q = new THREE.Quaternion().setFromUnitVectors(YUP, dir.clone().normalize());
  return geo.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(pos[0], pos[1], pos[2]), q, new THREE.Vector3(1, 1, 1)));
}

/** 卡箍实例变换（轴向沿 dir） */
function bandTx(p, dir, s = 1) {
  const q = new THREE.Quaternion().setFromUnitVectors(YUP, dir.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  return { pos: [p.x, p.y, p.z], rot: [e.x, e.y, e.z], scale: [s, 1, s] };
}

/** 螺栓实例变换（螺栓头朝 −dir，螺杆沿 +dir 拧入） */
function boltTx(p, dir) {
  const q = new THREE.Quaternion().setFromUnitVectors(YUP, dir.clone().normalize().negate());
  const e = new THREE.Euler().setFromQuaternion(q);
  return { pos: [p[0], p[1], p[2]], rot: [e.x, e.y, e.z] };
}

/** 转子显示角速度上限 rad/s（60 fps 下每帧 ≤15.8°，小于 11 叶节距 32.7° 的一半，不会频闪） */
const W_VIS_MAX = 16.5;

const f0 = (v) => v.toFixed(0);
const f1 = (v) => v.toFixed(1);
const f2 = (v) => v.toFixed(2);

/* ============================================================
 * 四、构建
 * ============================================================ */
export function build(world) {
  const { P, mats } = world;
  const G = world.group('air');
  const GF = world.group('fasteners');
  const GV = world.group('fluidVol');
  const O = TB.org;                       // 增压器原点
  const maxBoost = P.air.maxBoost;        // 0.14 MPa

  /* ---------- 4.0 工况换算（全部由 st 实时算） ---------- */
  const AMB = 25;                         // 环境温度 ℃
  function calc(st) {
    const boost = Math.max(0, st.op.boost);              // MPa 表压
    const pr = (0.1 + boost) / 0.1;                      // 压气机压比
    const t2 = (AMB + 273.15) * Math.pow(pr, 0.2857 / 0.72) - 273.15;  // 压气机出口 ℃
    const nr = U.clamp(st.rpm / P.meta.ratedSpeed, 0, 1.25);
    const etaIC = 0.83 - 0.11 * nr;                      // 中冷器效率
    const t3 = t2 - etaIC * Math.max(0, t2 - (AMB + 6)); // 中冷后 ℃
    const ev = U.clamp(0.95 - 0.17 * Math.pow((st.rpm - P.meta.peakTorqueSpeed) / 1300, 2), 0.55, 1);
    const rho = ((0.1 + boost) * 1e6) / (287 * (t3 + 273.15));   // 歧管空气密度 kg/m³
    const vhL = P.meta.displacementL / P.nCyl;           // 单缸工作容积 L
    const chargeL = ev * vhL;                            // 每循环每缸进气体积 L
    const chargeG = chargeL * 1e-3 * rho * 1000;         // 每循环每缸进气质量 g
    const cps = st.rpm / 120;                            // 每缸每秒循环数
    const mdot = chargeG * cps * P.nCyl * 3.6;           // 空气流量 kg/h
    const qv = (mdot / 1.185) / 60;                      // 体积流量 m³/min（标态）
    const dpF = 3.0 * Math.pow(mdot / 680, 2);           // 滤芯压降 kPa
    const dpIC = 7.0 * Math.pow(mdot / 680, 2);          // 中冷器压降 kPa
    const pit = 1 + 0.78 * (pr - 1);                     // 涡轮膨胀比
    const tOut = (st.op.egt + 273.15) * (1 - 0.76 * (1 - Math.pow(pit, -0.2857))) - 273.15;
    const wg = U.smoothstep(U.clamp((boost - 0.86 * maxBoost) / (0.14 * maxBoost), 0, 1));
    // 正在进气的缸
    let ci = -1;
    if (st.cyl && st.cyl.length) {
      ci = 0;
      for (let i = 1; i < st.cyl.length; i++) if (st.cyl[i].intakeLift > st.cyl[ci].intakeLift) ci = i;
    }
    const lift = ci >= 0 ? st.cyl[ci].intakeLift : 0;
    return {
      boost, pr, t2, t3, etaIC, ev, mdot, qv, chargeL, chargeG, dpF, dpIC, pit, tOut, wg, ci, lift,
      egt: st.op.egt, nTurbo: st.op.turboRpm, run: st.running !== false,
    };
  }
  /** 进气缸号描述 */
  function cylTxt(st, c) {
    if (c.ci < 0) return '换气过程';
    const cy = st.cyl[c.ci];
    if (c.lift < 0.25) return '4 缸进气门均已关闭（歧管稳压）';
    return `第 ${cy.n} 缸进气门${cy.intakeOpening ? '开启中' : '关闭中'}（升程 ${f1(c.lift)} mm）`;
  }

  /* ---------- 4.1 自建材质（克隆，绝不改共享材质） ---------- */
  // 排气侧高温件：随 egt 变暗红；保留 isHousing 以参与透视/剖切
  const matHot = mats.castIronDark.clone();
  matHot.name = '耐热铸铁 HT-Si（排气歧管/涡壳，随排温变色）';
  matHot.userData.isHousing = true;
  matHot.emissive = new THREE.Color(0x000000);
  matHot.emissiveIntensity = 1;
  // 涡轮/压气机高速旋转的“运动模糊”环
  const matBlurT = mats.turbineAlloy.clone();
  matBlurT.name = '涡轮高速旋转视觉残影';
  matBlurT.transparent = true; matBlurT.opacity = 0.0; matBlurT.depthWrite = false;
  matBlurT.userData.isHousing = false;
  const matBlurC = mats.alumMachined.clone();
  matBlurC.name = '压气机高速旋转视觉残影';
  matBlurC.transparent = true; matBlurC.opacity = 0.0; matBlurC.depthWrite = false;
  matBlurC.userData.isHousing = false;
  // 4 个进气支管示意腔（各自克隆，用于按缸做气流脉动）
  const matRun = [0, 1, 2, 3].map(() => {
    const m = mats.intakeVol.clone();
    m.userData.isHousing = false;
    return m;
  });

  /** 让克隆的 housing 材质跟随 mats.setMode 的显示模式（solid/ghost/section） */
  function syncHousing(c, b) {
    const sig = `${b.transparent}|${b.opacity}|${b.depthWrite}|${b.side}|${(b.clippingPlanes || []).length}`;
    if (c.userData._sig === sig) return;
    c.userData._sig = sig;
    c.transparent = b.transparent; c.opacity = b.opacity;
    c.depthWrite = b.depthWrite; c.side = b.side;
    c.clippingPlanes = b.clippingPlanes; c.clipShadows = b.clipShadows;
    c.needsUpdate = true;
  }

  const clampTx = [];      // 卡箍实例
  const boltList = [];     // 螺栓实例

  /* =========================================================
   * 4.2 进气歧管（铸铝 ZL104：稳压腔 + 4 支管 + 4 法兰）
   * ========================================================= */
  {
    const geos = [];
    // 稳压腔（φ76 铸铝腔，两端球形封头）
    const prof = [
      [1, PLEN.x0], [16, PLEN.x0 + 5], [26, PLEN.x0 + 11], [33, PLEN.x0 + 19],
      [37, PLEN.x0 + 31], [PLEN.r, PLEN.x0 + 66], [PLEN.r, PLEN.x1 - 78],
      [37, PLEN.x1 - 44], [34, PLEN.x1 - 22], [26, PLEN.x1 - 8], [14, PLEN.x1 - 2], [1, PLEN.x1],
    ];
    geos.push(U.lathe(prof, 28).rotateZ(-Math.PI / 2).translate(0, PLEN.y, PLEN.z));

    // 4 条支管（等长化：1 缸支管前伸，避让燃油滤清器）
    const runnerPaths = [];
    IN_PX.forEach((px, i) => {
      const bx = BRANCH_X[i];
      const base = [bx, PLEN.y - PLEN.r * Math.sin(22 * D2R), PLEN.z + PLEN.r * Math.cos(22 * D2R)];
      const path = i === 0
        ? [base, [bx - 14, 379, -172], [px + 16, 384, -160], [px, PORT_Y, -152], [px, PORT_Y, -144]]
        : [base, [px, 381, -166], [px, 384, -156], [px, PORT_Y, -148], [px, PORT_Y, -144]];
      runnerPaths.push(path);
      geos.push(taper(path, 54, PORT_D + 2, 10, 14));
      // 法兰板 + 铸造加强环
      geos.push(flangeGeo(FL.w, FL.h, FL.t, PORT_D, BOLT_DX).translate(px, PORT_Y, -146.5));
      geos.push(U.tubeShell(PORT_D + 16, PORT_D, 8, 20).rotateX(Math.PI / 2).translate(px, PORT_Y, -144));
      // 法兰螺栓（沿 +Z 拧入缸盖）
      boltList.push(boltTx([px - BOLT_DX, PORT_Y, -153], ZAX));
      boltList.push(boltTx([px + BOLT_DX, PORT_Y, -153], ZAX));
    });

    // 增压空气进口颈（接中冷器冷管）
    geos.push(taper([[PLEN.inletX, PLEN.y, PLEN.z + 4], [PLEN.inletX, PLEN.y, -258],
      [PLEN.inletX, PLEN.y, -284]], 80, PIPE.cold, 8, 16));
    geos.push(U.tubeShell(PIPE.cold + 14, PIPE.cold - 2, 9, 20)
      .rotateX(Math.PI / 2).translate(PLEN.inletX, PLEN.y, -280));
    // 空滤支架安装座
    for (const bx of [-110, 110]) {
      geos.push(U.roundBox(26, 16, 40, 3).translate(bx, PLEN.y + PLEN.r - 4, PLEN.z - 12));
    }
    // 歧管加强筋（沿 X 的铸造肋）
    geos.push(U.roundBox(PLEN.x1 - PLEN.x0 - 90, 10, 26, 3)
      .translate((PLEN.x0 + PLEN.x1) / 2, PLEN.y - PLEN.r - 2, PLEN.z + 6));

    const man = U.mesh(mg(geos), mats.alumCast, [0, 0, 0], [0, 0, 0], 'air.intakeManifold');
    G.add(man);
    world.reg(man, 'air.intakeManifold', {
      explode: [0, 40, -220],
      state: (st) => {
        const c = calc(st);
        return `${cylTxt(st, c)} · 歧管增压 ${f0(c.boost * 1000)} kPa（${f0(c.t3)}℃）`
          + ` · 充量 ${f2(c.chargeL)} L/循环·缸（${f2(c.chargeG)} g，充气效率 ${f0(c.ev * 100)}%）`;
      },
    });

    // ---- 4 支管气流示意腔（fluidVol，按缸做进气脉动） ----
    const runVols = [];
    runnerPaths.forEach((path, i) => {
      const p = [[path[0][0], PLEN.y, PLEN.z]].concat(path.slice(1));
      const t = U.pipeFromPoints(p, PORT_D - 6, 12, 0.4);
      const m = U.mesh(t.geo, matRun[i], [0, 0, 0], [0, 0, 0], 'air.intakeRunnerVol' + i);
      m.castShadow = false; m.receiveShadow = false;
      GV.add(m);
      runVols.push(m);
    });
    world.reg(runVols, 'air.intakeRunnerVol', {
      state: (st) => {
        const c = calc(st);
        const v = (st.cyl || []).map((cy) => (cy.intakeLift > 0.25 ? '●' : '○')).join('');
        const rho = ((0.1 + c.boost) * 1e6) / (287 * (c.t3 + 273.15));
        const area = Math.PI * Math.pow((PORT_D - 6) / 2000, 2);
        const vRun = (c.mdot / 3600 / P.nCyl) / rho / area * 2.5;   // 进气期间平均流速
        return `支管气流脉动 ${v}（点火顺序 1-3-4-2 依次进气）· 支管流速 ≈${f0(vRun)} m/s`
          + ` · 总进气量 ${f1(c.qv)} m³/min`;
      },
    });
  }

  /* =========================================================
   * 4.3 排气歧管（耐热铸铁 4-2-1 等长支管）
   * ========================================================= */
  {
    const geos = [];
    // 4 条支管：1&2 → A，3&4 → B
    const A = [EXM.jaX, EXM.jaY, EXM.jaZ];
    const B = [EXM.jbX, EXM.jbY, EXM.jbZ];
    const runners = [
      [[EX_PX[0], PORT_Y, 144], [EX_PX[0], 388, 160], [EX_PX[0] + 8, 392, 176], [A[0] - 26, 396, 190], A],
      [[EX_PX[1], PORT_Y, 144], [EX_PX[1], 388, 160], [EX_PX[1] - 12, 392, 176], [A[0] + 22, 396, 190], A],
      [[EX_PX[2], PORT_Y, 144], [EX_PX[2], 388, 160], [EX_PX[2] + 12, 388, 176], [B[0] - 24, 381, 190], B],
      [[EX_PX[3], PORT_Y, 144], [EX_PX[3], 388, 160], [EX_PX[3] - 10, 386, 176], [B[0] + 26, 381, 190], B],
    ];
    runners.forEach((path, i) => {
      geos.push(taper(path, EXM.runnerD, EXM.runnerD2, 12, 14));
      geos.push(flangeGeo(FL.w, FL.h, FL.t, PORT_D, BOLT_DX).translate(EX_PX[i], PORT_Y, 146.5));
      geos.push(U.tubeShell(PORT_D + 18, PORT_D, 9, 20).rotateX(Math.PI / 2).translate(EX_PX[i], PORT_Y, 144));
      boltList.push(boltTx([EX_PX[i] - BOLT_DX, PORT_Y, 153], ZAX.clone().negate()));
      boltList.push(boltTx([EX_PX[i] + BOLT_DX, PORT_Y, 153], ZAX.clone().negate()));
    });
    // 汇合腔（两个 2-into-1 集气包）
    geos.push(U.lathe([[1, -26], [22, -22], [30, -8], [30, 10], [20, 22], [1, 26]], 18)
      .rotateZ(-Math.PI / 2).translate(A[0], A[1], A[2]));
    geos.push(U.lathe([[1, -26], [22, -22], [30, -8], [30, 10], [20, 22], [1, 26]], 18)
      .rotateZ(-Math.PI / 2).translate(B[0], B[1], B[2]));
    // 前支管总管 A → 总汇合点（从 3-4 缸汇合点下方穿过）
    geos.push(taper([A, [-70, 372, 200], [-10, 340, 204], [60, 320, 207],
      [130, 316, 212], [172, 326, 220], EXM.merge], EXM.collD, EXM.mergeD, 20, 14));
    // 后支管总管 B → 总汇合点
    geos.push(taper([B, [172, 368, 208], [188, 352, 220], EXM.merge], EXM.collD, EXM.mergeD, 10, 14));
    // 总管 → 涡轮进口法兰
    const fl = EXM.flange;
    geos.push(taper([EXM.merge, [206, 334, 229], [213, 327, 230], fl], EXM.mergeD, 58, 8, 14));
    // 涡轮进口法兰（法向 = 气流方向）
    const dIn = new THREE.Vector3(fl[0] - EXM.merge[0], fl[1] - EXM.merge[1], fl[2] - EXM.merge[2]).normalize();
    geos.push(orientZ(flangeGeo(96, 82, 14, 56, 0), dIn, [fl[0] - dIn.x * 7, fl[1] - dIn.y * 7, fl[2] - dIn.z * 7]));
    // 涡轮法兰 4 个螺栓
    const t1 = new THREE.Vector3().crossVectors(dIn, YUP).normalize();
    const t2 = new THREE.Vector3().crossVectors(dIn, t1).normalize();
    for (const a of [-38, 38]) {
      for (const b of [-30, 30]) {
        const p = new THREE.Vector3(fl[0], fl[1], fl[2])
          .addScaledVector(dIn, -14).addScaledVector(t1, a).addScaledVector(t2, b);
        boltList.push(boltTx([p.x, p.y, p.z], dIn));
      }
    }
    // 隔热罩安装耳
    geos.push(U.roundBox(30, 12, 34, 3).translate(-60, 404, 208));
    geos.push(U.roundBox(30, 12, 34, 3).translate(120, 392, 208));

    const exm = U.mesh(mg(geos), matHot, [0, 0, 0], [0, 0, 0], 'air.exhaustManifold');
    G.add(exm);
    world.reg(exm, 'air.exhaustManifold', {
      explode: [0, 30, 220],
      state: (st) => {
        const c = calc(st);
        const glow = c.egt > 720 ? '管壁暗红热' : c.egt > 560 ? '管壁 500℃+ 微暗红' : '管壁未见红热';
        return `涡前排温 ${f0(c.egt)}℃ · ${glow} · 排气流量 ${f0(c.mdot * 1.03)} kg/h`
          + ` · 4-2-1 脉冲：${(st.cyl || []).map((cy) => (cy.exhaustLift > 0.3 ? '●' : '○')).join('')}`;
      },
    });
  }

  /* =========================================================
   * 4.4 废气涡轮增压器（转子轴竖直：涡轮在下、压气机在上）
   * ========================================================= */
  const turbo = new THREE.Group();
  turbo.name = 'air.turbo';
  turbo.position.set(O[0], O[1], O[2]);
  G.add(turbo);

  /* ---- 4.4.1 涡轮蜗壳 ---- */
  {
    const geos = [];
    geos.push(voluteGeo(TB.tScroll, 26, 14));
    // 叶轮罩壳 + 排气出口锥（封闭截面：内壁下行 → 外壁回升）
    geos.push(U.lathe([
      [42, -42], [42, -58], [40, -68], [37, -80], [35, -88], [35, -104],
      [42, -104], [44, -88], [47, -74], [50, -58], [50, -42], [42, -42],
    ], 30));
    geos.push(U.tubeShell(84, 68, 30, 28).translate(0, -103, 0));
    geos.push(U.disc(108, 10, 68, 28).translate(0, -116, 0));       // 出口法兰
    geos.push(U.disc(114, 9, 74, 28).translate(0, -40, 0));         // 与中间体连接法兰
    // 进口导管（法兰 → 蜗壳起点，切向进入）
    const s0 = TB.tScroll;
    const a0 = s0.a0 * D2R;
    const vStart = [Math.cos(a0) * s0.r0, s0.y, Math.sin(a0) * s0.r0];
    const flL = [EXM.flange[0] - O[0], EXM.flange[1] - O[1], EXM.flange[2] - O[2]];
    geos.push(taper([flL, [-108, 2, -6], [-98, -20, -12], [-84, -40, -20], vStart], 58, s0.d0, 12, 14));
    const dIn = new THREE.Vector3(
      EXM.flange[0] - EXM.merge[0], EXM.flange[1] - EXM.merge[1], EXM.flange[2] - EXM.merge[2]).normalize();
    geos.push(orientZ(flangeGeo(96, 82, 14, 58, 0), dIn, [flL[0] + dIn.x * 7, flL[1] + dIn.y * 7, flL[2] + dIn.z * 7]));
    // 旁通阀口凸台
    const wa = TB.wgA * D2R;
    const u = (TB.wgA + 360 - s0.a0) / (s0.a1 - s0.a0);
    const rW = U.lerp(s0.r0, s0.r1, u) + U.lerp(s0.d0, s0.d1, u) / 2;
    const nW = new THREE.Vector3(Math.cos(wa), 0, Math.sin(wa));
    const pW = new THREE.Vector3(nW.x * rW, s0.y, nW.z * rW);
    geos.push(orientY(U.tubeShell(50, 30, 14, 20), nW, [pW.x + nW.x * 6, pW.y, pW.z + nW.z * 6]));
    geos.push(orientY(U.disc(58, 6, 30, 20), nW, [pW.x + nW.x * 12, pW.y, pW.z + nW.z * 12]));
    // 旁通排气管（阀后 → 涡轮出口）
    geos.push(taper([[pW.x + nW.x * 26, s0.y - 4, pW.z + nW.z * 26], [-44, -72, 86],
      [-34, -92, 62], [-22, -101, 40]], 34, 34, 10, 12));

    const th = U.mesh(mg(geos), matHot, [0, 0, 0], [0, 0, 0], 'air.turbineHousing');
    turbo.add(th);
    world.reg(th, 'air.turbineHousing', {
      explode: [40, -80, 60],
      state: (st) => {
        const c = calc(st);
        return `蜗壳进口 ${f0(c.egt)}℃ / ${f2(0.1 * c.pit)} MPa（绝对）→ 出口 ${f0(c.tOut)}℃`
          + ` · 膨胀比 ${f2(c.pit)} · A/R 0.72`;
      },
    });
    turbo.userData.wgPort = { p: pW, n: nW };
  }

  /* ---- 4.4.2 转子（涡轮叶轮 + 压气机叶轮 + 轴，同轴同速） ---- */
  const rotor = new THREE.Group();
  rotor.name = 'air.turboRotor';
  turbo.add(rotor);
  let blurT, blurC;
  {
    // 涡轮叶轮（11 叶径流式：径向进气 → 轴向排气）
    const tHub = U.lathe([
      [1, -42], [TB.tR, -42], [TB.tR, -47], [34, -56], [26, -68], [18, -78], [11, -86], [8, -93], [1, -93],
    ], 28);
    const tBlade = bladeGeo({
      hub: [[TB.tR, -46], [30, -64], [11, -85]],
      shroud: [[TB.tR, -60], [37, -74], [30, -85]],
      wrap: -52, wrapPow: 1.25, thk: 3.4, uSeg: 7, tSeg: 3,
    });
    const tw = U.mesh(mg([tHub, ring(tBlade, TB.nBladeT)]), mats.turbineAlloy,
      [0, 0, 0], [0, 0, 0], 'air.turbineWheel');
    rotor.add(tw);
    world.reg(tw, 'air.turbineWheel', {
      state: (st) => {
        const c = calc(st);
        return `${f0(c.nTurbo)} r/min（${f1(c.nTurbo / 60)} r/s）· 叶尖线速度 ${f0(TB.tR * 2 * Math.PI * c.nTurbo / 60 / 1000)} m/s`
          + ` · 涡前 ${f0(c.egt)}℃ → 涡后 ${f0(c.tOut)}℃`;
      },
    });
    blurT = U.mesh(U.disc(TB.tR * 2 - 2, 1.4, 16, 20), matBlurT, [0, -55, 0]);
    blurT.castShadow = false; blurT.receiveShadow = false;
    rotor.add(blurT);
    world.reg(blurT, 'air.turbineWheel', { pick: false });

    // 压气机叶轮（12 叶后弯式：轴向进气 → 径向排气）
    const cHub = U.lathe([
      [1, 12], [46, 12], [46, 17], [43, 18], [38, 26], [30, 34], [21, 42], [13, 47], [7, 51], [1, 51],
    ], 28);
    const cBlade = bladeGeo({
      hub: [[11, 46], [15, 27], [TB.cR, 17]],
      shroud: [[27, 46], [34, 33], [TB.cR, 26]],
      wrap: -34, wrapPow: 1.3, thk: 3.0, uSeg: 7, tSeg: 3,
    });
    const cw = U.mesh(mg([cHub, ring(cBlade, TB.nBladeC)]), mats.alumMachined,
      [0, 0, 0], [0, 0, 0], 'air.compressorWheel');
    rotor.add(cw);
    world.reg(cw, 'air.compressorWheel', {
      state: (st) => {
        const c = calc(st);
        return `${f0(c.nTurbo)} r/min · 压比 ${f2(c.pr)} · 出口 ${f0(c.t2)}℃`
          + ` · 流量 ${f0(c.mdot)} kg/h（${f1(c.qv)} m³/min）· 叶尖 ${f0(TB.cR * 2 * Math.PI * c.nTurbo / 60 / 1000)} m/s`;
      },
    });
    blurC = U.mesh(U.disc(TB.cR * 2 - 2, 1.4, 16, 20), matBlurC, [0, 30, 0]);
    blurC.castShadow = false; blurC.receiveShadow = false;
    rotor.add(blurC);
    world.reg(blurC, 'air.compressorWheel', { pick: false });

    // 转子轴（浮动轴承颈 + 压气机锁紧螺母）
    const shaft = U.mesh(mg([
      U.lathe([[1, -44], [9, -44], [9, -30], [11, -28], [11, -8], [9, -6], [9, 14],
        [8, 16], [8, 22], [1, 22]], 22),
      U.disc(22, 9, 0, 6).translate(0, 54, 0),
    ]), mats.nitridedSteel, [0, 0, 0], [0, 0, 0], 'air.rotorShaft');
    rotor.add(shaft);
    world.reg(shaft, 'air.rotorShaft', {
      state: (st) => {
        const c = calc(st);
        return `转速 ${f0(c.nTurbo)} r/min · 轴承圆周速度 ${f1(11 * 2 * Math.PI * c.nTurbo / 60 / 1000)} m/s`
          + ` · 浮动轴承油膜 ${c.run ? '已建立' : '停机（惰转）'}`;
      },
    });
  }

  /* ---- 4.4.3 中间体（轴承壳）+ 油口 ---- */
  {
    const prof = [
      [13, -40], [56, -40], [56, -32], [40, -28], [33, -14], [31, 2], [36, 16],
      [52, 22], [52, 30], [13, 30], [13, -40],
    ];
    const geos = [U.lathe(prof, 30)];
    geos.push(U.cyl(26, 20, 18).translate(-34, 39, 0));                 // 进油凸台
    geos.push(orientY(U.tubeShell(34, 22, 24, 18), new THREE.Vector3(0.6, -0.8, 0), [46, -24, 0])); // 回油凸台
    geos.push(orientY(U.disc(52, 8, 22, 18), new THREE.Vector3(0.6, -0.8, 0), [52, -32, 0]));
    geos.push(U.tubeShell(96, 74, 6, 24).translate(0, -36, 0));         // 涡轮侧隔热挡板
    const bh = U.mesh(mg(geos), mats.castIron, [0, 0, 0], [0, 0, 0], 'air.bearingHousing');
    turbo.add(bh);
    world.reg(bh, 'air.bearingHousing', {
      explode: [60, 70, 60],
      state: (st) => {
        const c = calc(st);
        return `供油压力 ${f2(st.op.oilPressure)} MPa / ${f0(st.op.oilTemp)}℃ · 轴承带走热量 ≈${f1(1.1 + 2.6 * c.boost / maxBoost)} kW`
          + ` · 转子 ${f0(c.nTurbo)} r/min`;
      },
    });
  }

  /* ---- 4.4.4 压气机蜗壳 ---- */
  {
    const geos = [];
    geos.push(voluteGeo(TB.cScroll, 26, 14));
    // 进气道 + 叶轮罩（封闭剖面）
    geos.push(U.lathe([
      [43, 96], [43, 58], [34, 49], [29, 45], [46, 24], [50, 20], [58, 20],
      [56, 34], [52, 52], [51, 74], [51, 92], [58, 92], [58, 98], [43, 98], [43, 96],
    ], 30));
    geos.push(U.disc(112, 8, 86, 28).translate(0, 96, 0));        // 进气口法兰
    geos.push(U.disc(104, 8, 30, 28).translate(0, 12, 0));        // 背板
    geos.push(U.disc(114, 9, 66, 28).translate(0, 24, 0));        // 与中间体连接法兰
    // 出口导管（切向 +Z）+ 法兰
    const s = TB.cScroll;
    geos.push(taper([[s.r1, s.y, 0], [s.r1, s.y, 22], [s.r1, s.y, 42]], s.d1, PIPE.hot, 6, 16));
    geos.push(U.disc(PIPE.hot + 26, 9, PIPE.hot - 4, 24).rotateX(Math.PI / 2).translate(s.r1, s.y, 42));
    const ch = U.mesh(mg(geos), mats.alumCast, [0, 0, 0], [0, 0, 0], 'air.compressorHousing');
    turbo.add(ch);
    world.reg(ch, 'air.compressorHousing', {
      explode: [40, 90, 40],
      state: (st) => {
        const c = calc(st);
        return `进口 ${f0(AMB)}℃/−${f1(c.dpF)} kPa → 出口 ${f0(c.t2)}℃ / ${f2(0.1 + c.boost)} MPa（绝对）`
          + ` · 压比 ${f2(c.pr)} · 效率 ≈72%`;
      },
    });
  }

  /* ---- 4.4.5 废气旁通阀（阀片 0→25°）+ 膜片式执行器 ---- */
  const wgSwing = new THREE.Group();
  const wgRod = new THREE.Group();
  {
    const { p: pW, n: nW } = turbo.userData.wgPort;
    // 铰轴局部坐标系：X = 铰轴、Y = 阀面内竖直向下、Z = 阀口法向
    const ex = new THREE.Vector3(-Math.sin(TB.wgA * D2R), 0, Math.cos(TB.wgA * D2R)).normalize();
    const ey = new THREE.Vector3(0, -1, 0);
    const ez = new THREE.Vector3().crossVectors(ex, ey).normalize();
    if (ez.dot(nW) < 0) { ex.negate(); ez.crossVectors(ex, ey).normalize(); }
    const face = pW.clone().addScaledVector(nW, 14);           // 阀口密封面
    const hinge = face.clone().add(new THREE.Vector3(0, 28, 0));
    const pivot = new THREE.Group();
    pivot.position.copy(hinge);
    pivot.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ex, ey, ez));
    pivot.add(wgSwing);
    turbo.add(pivot);

    const vg = mg([
      U.cylZ(44, 7, 24).translate(0, 28, -3.5),                // 阀片
      U.cylZ(20, 5, 16).translate(0, 28, -8),                  // 阀片背面加强
      U.roundBox(13, 32, 8, 2).translate(0, 14, -6),           // 阀片摇臂
      U.cylX(13, 46, 16),                                      // 阀轴
      U.roundBox(11, 34, 7, 2).translate(0, -16, 0),           // 外摇臂
      U.cylZ(9, 16, 12).translate(0, -30, 0),                  // 连杆销
    ]);
    const wgv = U.mesh(vg, mats.turbineAlloy, [0, 0, 0], [0, 0, 0], 'air.wastegateValve');
    wgSwing.add(wgv);
    world.reg(wgv, 'air.wastegateValve', {
      state: (st) => {
        const c = calc(st);
        return c.wg < 0.02
          ? `全关（全部废气经涡轮）· 增压 ${f0(c.boost * 1000)}/${f0(maxBoost * 1000)} kPa`
          : `开度 ${f0(c.wg * 100)}% · 阀片转角 ${f1(c.wg * 25)}° · 旁通 ≈${f0(c.wg * 24)}% 废气 · 增压限值 ${f0(maxBoost * 1000)} kPa`;
      },
    });

    // 执行器：膜片室 + 推杆 + 支架 + 增压信号软管
    const rodLen = 46;
    const pin = hinge.clone().add(new THREE.Vector3(0, 30, 0));   // 外摇臂销（阀轴上方 30）
    const canFace = pin.clone().addScaledVector(nW, rodLen);
    const canCtr = canFace.clone().addScaledVector(nW, 18);
    const ag = [];
    ag.push(orientY(U.lathe([[1, -18], [40, -18], [46, -13], [46, 13], [40, 18], [1, 18]], 24),
      nW, [canCtr.x, canCtr.y, canCtr.z]));
    ag.push(orientY(U.tubeShell(96, 88, 8, 24), nW, [canCtr.x, canCtr.y, canCtr.z]));
    ag.push(orientY(U.cyl(11, 16, 12), nW, [canCtr.x + nW.x * 24, canCtr.y, canCtr.z + nW.z * 24])); // 信号接嘴
    // 支架：执行器 → 压气机蜗壳（φ12 拉杆 + 卡箍座）
    ag.push(sweep([new THREE.Vector3(canCtr.x, canCtr.y + 30, canCtr.z),
      new THREE.Vector3(TB.cScroll.r1 * 0.55, TB.cScroll.y + 4, 34)], 12, 10));
    ag.push(orientY(U.tubeShell(104, 92, 12, 24), nW, [canCtr.x, canCtr.y + 26, canCtr.z]));
    // 增压信号软管（压气机出口 → 膜片室）
    ag.push(U.pipeFromPoints([
      [canCtr.x + nW.x * 30, canCtr.y + 4, canCtr.z + nW.z * 30],
      [canCtr.x + 6, canCtr.y + 26, canCtr.z + 10], [40, 40, 66], [TB.cScroll.r1 - 4, TB.cScroll.y + 6, 30],
    ], 9, 10, 0.4).geo);
    const act = U.mesh(mg(ag), mats.steelSheet, [0, 0, 0], [0, 0, 0], 'air.wastegateActuator');
    turbo.add(act);
    world.reg(act, 'air.wastegateActuator', {
      explode: [30, 40, 90],
      state: (st) => {
        const c = calc(st);
        const p = c.boost * 1000;
        return `膜片信号压力 ${f0(p)} kPa（开启点 ${f0(0.86 * maxBoost * 1000)} kPa）`
          + ` · 推杆伸出 ${f1(c.wg * 30 * Math.sin(25 * D2R))} mm · ${c.wg > 0.02 ? '正在泄压' : '弹簧压紧关闭'}`;
      },
    });

    // 推杆（父组固定在膜片室端面，沿 −nW 指向连杆销；靠 scale.z 伸缩）
    wgRod.position.copy(canFace);
    wgRod.quaternion.setFromUnitVectors(ZAX, nW.clone().negate());
    const rod = U.mesh(U.cylZ(9, rodLen, 12).translate(0, 0, rodLen / 2), mats.hardChrome);
    wgRod.add(rod);
    wgRod.userData.rodLen = rodLen;
    turbo.add(wgRod);
    world.reg(rod, 'air.wastegateActuator', { pick: false });
  }

  /* ---- 4.4.6 增压器进油 / 回油管 ---- */
  {
    const feed = U.pipeFromPoints([
      [O[0] - 34, O[1] + 44, O[2]], [296, 336, 208], [274, 320, 180], [268, 300, 152], [266, 284, 134],
    ], 11, 10, 0.4);
    const fm = U.mesh(mg([
      feed.geo,
      U.hexBolt(19, 12, 12, 14).translate(O[0] - 34, O[1] + 50, O[2]),          // 中空进油螺栓
      U.disc(30, 12, 12, 16).translate(O[0] - 34, O[1] + 44, O[2]),             // 铰接（banjo）接头
      orientY(U.disc(28, 12, 12, 16), new THREE.Vector3(-0.15, -0.7, -0.7), [266, 288, 138]),
    ]), mats.chrome, [0, 0, 0], [0, 0, 0], 'air.oilFeedLine');
    G.add(fm);
    world.reg(fm, 'air.oilFeedLine', {
      explode: [40, 60, -40],
      state: (st) => `进油压力 ${f2(st.op.oilPressure)} MPa · 油温 ${f0(st.op.oilTemp)}℃`
        + ` · 流量 ≈${f1(1.4 + 2.2 * st.op.oilPressure / 0.42)} L/min（含 φ1.6 限流孔）`,
    });

    // 向前下方绕开飞轮/飞轮壳（飞轮 X 323…379 / R188、飞轮齿圈 R210、飞轮壳 X≥349）
    const drain = U.pipeFromPoints([
      [O[0] + 48, O[1] - 30, O[2]], [350, 202, 206], [330, 164, 178], [308, 112, 164], [296, 68, 150], [292, 40, 140],
    ], 26, 12, 0.4);
    const dm = U.mesh(mg([
      drain.geo,
      orientY(U.disc(56, 10, 24, 18), new THREE.Vector3(0.6, -0.8, 0), [O[0] + 46, O[1] - 26, O[2]]),
      U.disc(52, 10, 26, 18).rotateX(Math.PI / 2).translate(292, 42, 138),
    ]), mats.steelSheet, [0, 0, 0], [0, 0, 0], 'air.oilDrainLine');
    G.add(dm);
    world.reg(dm, 'air.oilDrainLine', {
      explode: [50, -30, 60],
      state: (st) => {
        const c = calc(st);
        return `回油自流至曲轴箱 · 中间体出油温度 ≈${f0(st.op.oilTemp + 22 + 46 * c.boost / maxBoost)}℃`
          + ` · 管径 φ26（不得节流，否则封油环漏油）`;
      },
    });
  }

  /* =========================================================
   * 4.5 中冷器（空-空，X≈−566）
   * ========================================================= */
  {
    const tubeY = [];
    for (let i = 0; i < IC.nTube; i++) tubeY.push(IC.y0 + i * IC.pitch);
    // 扁管 + 上下侧板
    const coreGeos = tubeY.map((y) => U.roundBox(IC.coreW, IC.tubeH, IC.lenZ, IC.tubeH / 2, 2)
      .translate(IC.x, y, 0));
    coreGeos.push(U.roundBox(IC.coreW + 8, 7, IC.lenZ + 6, 3).translate(IC.x, IC.y0 - 8, 0));
    coreGeos.push(U.roundBox(IC.coreW + 8, 7, IC.lenZ + 6, 3).translate(IC.x, tubeY[IC.nTube - 1] + 8, 0));
    const core = U.mesh(mg(coreGeos), mats.alumMachined, [0, 0, 0], [0, 0, 0], 'air.intercoolerCore');
    G.add(core);
    world.reg(core, 'air.intercoolerCore', {
      explode: [-160, 0, 0],
      state: (st) => {
        const c = calc(st);
        return `芯体传热量 ≈${f1(c.mdot / 3600 * 1005 * Math.max(0, c.t2 - c.t3) / 1000)} kW`
          + ` · 进气 ${f0(c.t2)}℃ → 出气 ${f0(c.t3)}℃ · 空气侧压降 ${f1(c.dpIC)} kPa`;
      },
    });

    // 散热带（实例化：每个管间隙内的波纹翅片）
    const finGeo = new THREE.BoxGeometry(IC.coreW - 3, 6.6, 1.1);
    const tx = [];
    for (let i = 0; i < IC.nTube - 1; i++) {
      const y = (tubeY[i] + tubeY[i + 1]) / 2;
      for (let z = -IC.lenZ / 2 + 6; z < IC.lenZ / 2 - 4; z += 11) {
        tx.push({ pos: [IC.x, y, z], rot: [(tx.length % 2 ? 20 : -20) * D2R, 0, 0] });
      }
    }
    const fins = U.instances(finGeo, mats.copper, tx, 'air.intercoolerFins');
    G.add(fins);
    world.reg(fins, 'air.intercoolerFins', {
      state: (st) => {
        const c = calc(st);
        return `${tx.length} 片波纹散热带（${IC.nTube - 1} 个管间隙）· 迎面风速 ≈${f1(2.2 + 5.4 * st.rpm / P.meta.maxSpeed)} m/s`
          + ` · 中冷效率 ${f0(c.etaIC * 100)}%`;
      },
    });

    // 进 / 出气室
    const tankGeo = (z, neckY, axial) => {
      const g = [];
      const cy = (IC.y0 + tubeY[IC.nTube - 1]) / 2;
      g.push(U.roundBox(IC.coreW + 8, IC.pitch * IC.nTube + 4, IC.tankT, 8).translate(IC.x, cy, z));
      // 主板（管端胀接板，朝芯体一侧）
      g.push(U.roundBox(IC.coreW + 8, IC.pitch * IC.nTube + 10, 8, 3)
        .translate(IC.x, cy, z - Math.sign(z) * (IC.tankT / 2)));
      if (axial) {
        // 出口颈沿 ±Z 从端面伸出（避开风扇扫掠面）
        const zn = z + Math.sign(z) * (IC.tankT / 2 + 8);
        g.push(U.cylZ(PIPE.cold, 40, 20).translate(IC.x, neckY, zn));
        g.push(U.tubeShell(PIPE.cold + 14, PIPE.cold - 2, 9, 20).rotateX(Math.PI / 2)
          .translate(IC.x, neckY, zn + Math.sign(z) * 12));
      } else {
        // 进口颈沿 +X 伸出（朝发动机侧）
        g.push(U.cylX(PIPE.hot, 34, 20).translate(IC.neckX + 8, neckY, z - Math.sign(z) * 10));
        g.push(U.tubeShell(PIPE.hot + 14, PIPE.hot - 2, 9, 20).rotateZ(Math.PI / 2)
          .translate(IC.neckX + 20, neckY, z - Math.sign(z) * 10));
      }
      return mg(g);
    };
    const inTank = U.mesh(tankGeo(IC.tankZ, IC.inY), mats.alumCast, [0, 0, 0], [0, 0, 0], 'air.intercoolerInTank');
    const outTank = U.mesh(tankGeo(-IC.tankZ, IC.outY, true), mats.alumCast, [0, 0, 0], [0, 0, 0], 'air.intercoolerOutTank');
    G.add(inTank, outTank);
    world.reg(inTank, 'air.intercoolerInTank', {
      explode: [-140, 0, 120],
      state: (st) => {
        const c = calc(st);
        return `热端进气室 ${f0(c.t2)}℃ / ${f2(0.1 + c.boost)} MPa · 流量 ${f0(c.mdot)} kg/h`;
      },
    });
    world.reg(outTank, 'air.intercoolerOutTank', {
      explode: [-140, 0, -120],
      state: (st) => {
        const c = calc(st);
        return `冷端出气室 ${f0(c.t3)}℃ · 密度提高 ${f0(((273 + c.t2) / (273 + c.t3) - 1) * 100)}%`
          + ` · 压降 ${f1(c.dpIC)} kPa`;
      },
    });
  }

  /* =========================================================
   * 4.6 空气滤清器
   * ========================================================= */
  {
    // 壳体（横置，出口在 +X 端）
    const hg = [];
    hg.push(U.lathe([
      [1, -AF.len / 2 - 4], [52, -AF.len / 2 - 4], [70, -AF.len / 2 + 6], [AF.od / 2, -AF.len / 2 + 20],
      [AF.od / 2, AF.len / 2 - 26], [72, AF.len / 2 - 8], [46, AF.len / 2], [40, AF.len / 2 + 14],
      [40, AF.len / 2 + 30], [1, AF.len / 2 + 30],
    ], 30).rotateZ(-Math.PI / 2).translate(AF.x, AF.y, AF.z));
    hg.push(U.tubeShell(96, 92, AF.elemLen, 24).rotateZ(Math.PI / 2).translate(AF.x - 6, AF.y, AF.z)); // 内支撑网
    // 抱箍 + 支腿（固定到进气歧管安装座）
    for (const bx of [-110, 110]) {
      hg.push(U.tubeShell(AF.od + 12, AF.od + 2, 16, 24).rotateZ(Math.PI / 2).translate(bx, AF.y, AF.z));
      hg.push(U.roundBox(20, 90, 14, 3).translate(bx, AF.y - AF.od / 2 - 28, AF.z + 26));
      hg.push(U.roundBox(22, 14, 120, 3).translate(bx, PLEN.y + PLEN.r + 2, AF.z + 44));
    }
    hg.push(U.tubeShell(PIPE.inlet + 14, PIPE.inlet - 2, 9, 20).rotateZ(Math.PI / 2)
      .translate(AF.x + AF.len / 2 + 22, AF.y, AF.z));
    const afh = U.mesh(mg(hg), mats.steelSheet, [0, 0, 0], [0, 0, 0], 'air.airFilterHousing');
    G.add(afh);
    world.reg(afh, 'air.airFilterHousing', {
      explode: [0, 140, -80],
      state: (st) => {
        const c = calc(st);
        return `进气量 ${f1(c.qv)} m³/min · 壳内负压 −${f1(c.dpF)} kPa`
          + ` · 报警值 −6.2 kPa（${c.dpF > 6.2 ? '需保养' : '滤芯正常'}）`;
      },
    });

    // 主滤芯（褶皱滤纸）
    const pleat = U.polarExtrude((a) => AF.elemOD / 2 - 6 + 6 * Math.abs(Math.sin(a * 24)), AF.elemLen, 168)
      .rotateY(Math.PI / 2).translate(AF.x - 6, AF.y, AF.z);
    const elem = U.mesh(mg([
      pleat,
      U.tubeShell(AF.elemOD + 6, AF.elemOD - 16, 10, 24).rotateZ(Math.PI / 2).translate(AF.x - 6 - AF.elemLen / 2, AF.y, AF.z),
      U.tubeShell(AF.elemOD + 6, AF.elemOD - 16, 10, 24).rotateZ(Math.PI / 2).translate(AF.x - 6 + AF.elemLen / 2, AF.y, AF.z),
    ]), mats.filterPaper, [0, 0, 0], [0, 0, 0], 'air.airFilterElement');
    G.add(elem);
    world.reg(elem, 'air.airFilterElement', {
      explode: [-200, 60, -40],
      state: (st) => {
        const c = calc(st);
        return `过滤风量 ${f1(c.qv)} m³/min · 滤纸面积 2.1 m² · 面速 ${f1(c.qv / 2.1 / 60 * 100)} cm/s`
          + ` · 压差 ${f1(c.dpF)} kPa · 过滤效率 99.8%（≥5 μm）`;
      },
    });

    // 进气罩 / 雨帽 + 前端盖
    const hood = U.mesh(mg([
      U.lathe([[1, -18], [58, -18], [70, -8], [70, 8], [40, 16], [1, 16]], 24)
        .rotateZ(-Math.PI / 2).translate(AF.x - AF.len / 2 - 14, AF.y, AF.z),
      U.pipeFromPoints([[AF.x - AF.len / 2 - 20, AF.y, AF.z], [-196, AF.y + 2, AF.z],
        [-222, AF.y - 6, AF.z - 20], [-234, AF.y - 26, AF.z - 40]], 76, 14, 0.4).geo,
      orientY(U.lathe([[1, 0], [62, 0], [62, 8], [1, 8]], 24), new THREE.Vector3(-0.4, -0.7, -0.6),
        [-238, AF.y - 34, AF.z - 48]),
    ]), mats.steelSheet, [0, 0, 0], [0, 0, 0], 'air.airFilterHood');
    G.add(hood);
    world.reg(hood, 'air.airFilterHood', {
      explode: [-180, 40, -60],
      state: (st) => {
        const c = calc(st);
        return `雨帽进气 ${f1(c.qv)} m³/min · 进气口流速 ${f0(c.qv / 60 / (Math.PI * 0.038 * 0.038))} m/s`
          + ` · 预滤（惯性分离）除尘 ≈70%`;
      },
    });
  }

  /* =========================================================
   * 4.7 连接管路（进气软管 / 增压热管 / 增压冷管 / 排气管 / 消声器）
   * ========================================================= */
  {
    // ---- 空滤 → 压气机进口 ----
    // 走气门室罩上方（Y≈570），跨过曲轴箱通风器（X 191…339 / Y≤510 / Z −200…−54）
    const inlet = U.pipeFromPoints([
      [AF.x + AF.len / 2 + 26, AF.y, AF.z], [232, 542, -258], [268, 564, -196], [292, 574, -100],
      [306, 576, 10], [314, 566, 120], [320, 540, 190], [326, 478, 222], [330, 428, 230], [330, 404, 232],
    ], PIPE.inlet, 14, 0.4);
    const ih = U.mesh(inlet.geo, mats.silicone, [0, 0, 0], [0, 0, 0], 'air.inletHose');
    G.add(ih);
    world.reg(ih, 'air.inletHose', {
      explode: [40, 120, 0],
      state: (st) => {
        const c = calc(st);
        return `管内负压 −${f1(c.dpF + 0.6)} kPa · 流速 ${f0(c.qv / 60 / (Math.PI * Math.pow(PIPE.inlet / 2000 - 0.004, 2)))} m/s`
          + ` · 空气温度 ${f0(AMB)}℃`;
      },
    });
    clampTx.push(bandTx(inlet.curve.getPointAt(0.012), inlet.curve.getTangentAt(0.012), PIPE.inlet / PIPE.hot));
    clampTx.push(bandTx(inlet.curve.getPointAt(0.985), inlet.curve.getTangentAt(0.985), PIPE.inlet / PIPE.hot));

    // ---- 压气机出口 → 中冷器进气室（热管） ----
    const hot = U.pipeFromPoints([
      [O[0] + TB.cScroll.r1, O[1] + TB.cScroll.y, O[2] + 44], [408, 336, 300], [398, 356, 322],
      [372, 380, 330], [330, 398, 326], [240, 414, 318], [100, 428, 308], [-100, 432, 300],
      [-300, 426, 292], [-410, 410, 276], [-490, 394, 240], [IC.neckX + 22, IC.inY, IC.tankZ - 10],
    ], PIPE.hot, 14, 0.4);
    const hp = U.mesh(hot.geo, mats.alumMachined, [0, 0, 0], [0, 0, 0], 'air.hotChargePipe');
    G.add(hp);
    world.reg(hp, 'air.hotChargePipe', {
      explode: [0, 120, 60],
      state: (st) => {
        const c = calc(st);
        return `热端增压空气 ${f0(c.t2)}℃ / ${f0(c.boost * 1000)} kPa（表压）`
          + ` · 流速 ${f0(c.qv / 60 * (1.185 / (c.boost + 0.1) * 0.1) / (Math.PI * Math.pow(PIPE.hot / 2000 - 0.003, 2)))} m/s`;
      },
    });
    clampTx.push(bandTx(hot.curve.getPointAt(0.01), hot.curve.getTangentAt(0.01), 1));
    clampTx.push(bandTx(hot.curve.getPointAt(0.99), hot.curve.getTangentAt(0.99), 1));

    // ---- 中冷器出气室 → 进气歧管（冷管） ----
    const cold = U.pipeFromPoints([
      [IC.x, IC.outY, -IC.tankZ - IC.tankT / 2 - 24], [-540, 300, -300], [-460, 306, -316], [-360, 316, -316],
      [-250, 330, -310], [-160, 348, -306], [-100, 366, -298], [-62, 382, -292],
      [PLEN.inletX, PLEN.y, -284],
    ], PIPE.cold, 14, 0.4);
    const cp = U.mesh(cold.geo, mats.alumMachined, [0, 0, 0], [0, 0, 0], 'air.coldChargePipe');
    G.add(cp);
    world.reg(cp, 'air.coldChargePipe', {
      explode: [0, -40, -160],
      state: (st) => {
        const c = calc(st);
        return `冷端增压空气 ${f0(c.t3)}℃ / ${f0((c.boost - c.dpIC / 1000) * 1000)} kPa`
          + ` · 充量 ${f2(c.chargeG)} g/循环·缸 · 密度 ${f2(((0.1 + c.boost) * 1e6) / (287 * (c.t3 + 273.15)))} kg/m³`;
      },
    });
    clampTx.push(bandTx(cold.curve.getPointAt(0.012), cold.curve.getTangentAt(0.012), 1));
    clampTx.push(bandTx(cold.curve.getPointAt(0.988), cold.curve.getTangentAt(0.988), 1));

    // ---- 涡轮出口 → 排气管 ----
    const down = U.pipeFromPoints([
      [O[0], O[1] - 118, O[2]], [330, 158, 240], [322, 126, 258], [304, 100, 278],
      [268, 76, 300], [230, 58, 316], [MUF.x + MUF.len / 2 + 10, MUF.y + 2, MUF.z - 10],
    ], PIPE.down, 14, 0.4);
    const dp = U.mesh(mg([
      down.geo,
      U.disc(112, 10, PIPE.down - 6, 24).translate(O[0], O[1] - 116, O[2]),
      U.roundBox(60, 10, 40, 3).translate(300, 108, 282),
    ]), mats.steelSheet, [0, 0, 0], [0, 0, 0], 'air.exhaustDownPipe');
    G.add(dp);
    world.reg(dp, 'air.exhaustDownPipe', {
      explode: [40, -80, 100],
      state: (st) => {
        const c = calc(st);
        return `涡后排气 ${f0(c.tOut)}℃ · 背压 ${f1(4 + 14 * Math.pow(c.mdot / 680, 2))} kPa`
          + ` · 流量 ${f0(c.mdot * 1.03)} kg/h`;
      },
    });

    // ---- 消声器 + 尾管 ----
    const muf = U.mesh(mg([
      U.lathe([[1, -MUF.len / 2 - 16], [60, -MUF.len / 2 - 12], [MUF.od / 2 - 6, -MUF.len / 2],
        [MUF.od / 2, -MUF.len / 2 + 14], [MUF.od / 2, MUF.len / 2 - 14], [MUF.od / 2 - 6, MUF.len / 2],
        [60, MUF.len / 2 + 12], [1, MUF.len / 2 + 16]], 28)
        .rotateZ(-Math.PI / 2).translate(MUF.x, MUF.y, MUF.z),
      U.tubeShell(MUF.od + 10, MUF.od, 14, 24).rotateZ(Math.PI / 2).translate(MUF.x - 70, MUF.y, MUF.z),
      U.tubeShell(MUF.od + 10, MUF.od, 14, 24).rotateZ(Math.PI / 2).translate(MUF.x + 70, MUF.y, MUF.z),
      U.pipeFromPoints([[MUF.x - MUF.len / 2 - 12, MUF.y, MUF.z], [-160, 66, MUF.z + 12],
        [-200, 110, MUF.z + 22], [-222, 170, MUF.z + 28], [-232, 230, MUF.z + 32]], PIPE.tail, 12, 0.4).geo,
      orientY(U.tubeShell(PIPE.tail + 8, PIPE.tail - 4, 16, 20), new THREE.Vector3(-0.16, 0.97, 0.06),
        [-232, 234, MUF.z + 33]),
    ]), mats.steelSheet, [0, 0, 0], [0, 0, 0], 'air.muffler');
    G.add(muf);
    world.reg(muf, 'air.muffler', {
      explode: [-40, -60, 140],
      state: (st) => {
        const c = calc(st);
        return `排气噪声衰减 ≈24 dB(A) · 尾管排温 ${f0(c.tOut * 0.86)}℃`
          + ` · 排气流量 ${f1(c.mdot * 1.03 / 3600 / (((0.1) * 1e6) / (287 * (c.tOut * 0.86 + 273.15))) * 60)} m³/min`;
      },
    });
  }

  /* =========================================================
   * 4.8 卡箍 / 垫片 / 螺栓（fasteners 图层）
   * ========================================================= */
  {
    const bandGeo = U.tubeShell(PIPE.hot + 16, PIPE.hot + 3, 15, 20);
    const bands = U.instances(bandGeo, mats.boltSteel, clampTx, 'air.hoseClamps');
    GF.add(bands);
    world.reg(bands, 'air.hoseClamps', {
      state: (st) => {
        const c = calc(st);
        return `${clampTx.length} 只 T 型卡箍 · 承受管内压 ${f0(c.boost * 1000)} kPa`
          + ` · 拧紧扭矩 8 N·m（${c.boost > 0.9 * maxBoost ? '接近最大增压，密封受考验' : '密封良好'}）`;
      },
    });

    const inG = [];
    const exG = [];
    IN_PX.forEach((px) => inG.push(flangeGeo(FL.w, FL.h, FL.gasket, PORT_D, BOLT_DX).translate(px, PORT_Y, -139)));
    EX_PX.forEach((px) => exG.push(flangeGeo(FL.w, FL.h, FL.gasket, PORT_D, BOLT_DX).translate(px, PORT_Y, 139)));
    const dIn = new THREE.Vector3(
      EXM.flange[0] - EXM.merge[0], EXM.flange[1] - EXM.merge[1], EXM.flange[2] - EXM.merge[2]).normalize();
    exG.push(orientZ(flangeGeo(96, 82, 2, 58, 0), dIn, EXM.flange));
    const gi = U.mesh(mg(inG), mats.gasketPaper, [0, 0, 0], [0, 0, 0], 'air.intakeGasket');
    const ge = U.mesh(mg(exG), mats.gasketMat, [0, 0, 0], [0, 0, 0], 'air.exhaustGasket');
    GF.add(gi, ge);
    world.reg(gi, 'air.intakeGasket', {
      state: (st) => `4 处进气法兰密封 · 承受 ${f0(calc(st).boost * 1000)} kPa 增压（漏气将直接损失充量）`,
    });
    world.reg(ge, 'air.exhaustGasket', {
      state: (st) => `5 处排气密封（4 缸口 + 涡轮进口）· 工作温度 ${f0(calc(st).egt)}℃ · 热态压紧`,
    });

    const bolts = U.instances(U.hexBolt(19, 12, 12, 44), mats.boltSteel, boltList, 'air.manifoldBolts');
    GF.add(bolts);
    world.reg(bolts, 'air.manifoldBolts', {
      state: (st) => {
        const c = calc(st);
        return `${boltList.length} 条 M12 螺栓/螺柱 · 排气侧热膨胀伸长 ≈${f2(0.0000115 * 44 * (c.egt * 0.45))} mm`
          + ` · 冷态扭矩 45 N·m`;
      },
    });
  }

  /* =========================================================
   * 4.9 每帧动画
   * ========================================================= */
  const hotEmis = new THREE.Color();
  let wgNow = 0;
  world.addUpdater((st) => {
    const c = calc(st);

    // ---- 转子高速旋转 ----
    // 真实角速度 120 000 r/min = 12 570 rad/s，60 fps 下每帧 3350°，远超叶片节距 32.7°，
    // 直接显示只会频闪甚至倒转；故做上限压缩：ω_vis = 16.5·(n/n_max)^0.8 rad/s
    // （≈真实值的 1/770，每帧 ≤15.8° < 半个叶片节距），再叠加残影环表现高速感。
    const wVis = W_VIS_MAX * Math.pow(U.clamp(c.nTurbo / 120000, 0, 1), 0.8) * (c.run ? 1 : 0);
    rotor.rotation.y -= wVis * (st.dt || 0);
    if (rotor.rotation.y < -Math.PI * 2) rotor.rotation.y += Math.PI * 2;
    // 残影环：转速越高越明显（弥补压缩后的视觉损失）
    const bl = U.clamp((c.nTurbo - 15000) / 95000, 0, 1) * (c.run ? 1 : 0);
    matBlurT.opacity = 0.06 + 0.34 * bl;
    matBlurC.opacity = 0.06 + 0.34 * bl;
    blurT.visible = blurC.visible = bl > 0.02;
    blurT.scale.setScalar(1 + 0.02 * bl);
    blurC.scale.setScalar(1 + 0.02 * bl);

    // ---- 废气旁通阀：boost → 0…25°（带执行器迟滞）----
    wgNow += (c.wg - wgNow) * Math.min(1, (st.dt || 0) * 4.5);
    wgSwing.rotation.x = wgNow * 25 * D2R;
    wgRod.scale.z = 1 + (30 * Math.sin(wgNow * 25 * D2R)) / wgRod.userData.rodLen;

    // ---- 排气歧管/涡壳高温红热（400℃ 起，900℃ 到暗红 ≈#8c1206）----
    const h = U.clamp((c.egt - 400) / 500, 0, 1);
    const k = Math.pow(h, 1.7);
    hotEmis.setRGB(0.30 * k, 0.004 * k, 0.0006 * k);   // 线性空间 → 显示为暗红
    matHot.emissive.copy(hotEmis);
    matHot.emissiveIntensity = 0.4 + 0.9 * k;
    syncHousing(matHot, mats.castIronDark);

    // ---- 进气支管气流脉动（跟随各缸进气门升程）----
    const vis = mats.intakeVol.visible !== false;
    for (let i = 0; i < matRun.length; i++) {
      const lift = st.cyl && st.cyl[i] ? st.cyl[i].intakeLift : 0;
      const q = U.clamp(lift / P.valvetrain.valveLift, 0, 1);
      matRun[i].opacity = U.clamp(mats.intakeVol.opacity * (0.35 + 1.15 * q), 0, 1);
      matRun[i].visible = vis;
      matRun[i].color.copy(mats.intakeVol.color).offsetHSL(0, 0, 0.16 * q);
    }
  });
}
