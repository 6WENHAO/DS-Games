/**
 * build3d.js — three.js 场景构建：整车、悬架、路面
 *
 * 车身坐标系（bodyGroup 局部系）：原点 = 质心，y=0 位于离地 hCG=0.55 m 处
 *   +x 右, +y 上, +z 前
 * 角点坐标系（cornerGroup，bodyGroup 的子节点）：原点 = 静态轮心
 *   规范定义中 +x = 朝车辆中心线（内侧）；右侧使用镜像硬点
 */

import * as THREE from 'three';
import {
  frontDoubleWishbone, rearFiveLink, mirrorDef, CornerSolver, dist,
} from './kinematics.js';

export const WHEEL_R = 0.350;
export const TIRE_W = 0.245;

/* ============================ 材质库 ============================ */
export function makeMaterials(accent) {
  const M = {};
  M.shell = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(accent.body), metalness: 0.55, roughness: 0.28,
    clearcoat: 1.0, clearcoatRoughness: 0.08, side: THREE.DoubleSide,
  });
  M.glass = new THREE.MeshPhysicalMaterial({
    color: 0x1a2430, metalness: 0.1, roughness: 0.12, transparent: true, opacity: 0.62,
    side: THREE.DoubleSide, clearcoat: 1, transmission: 0.25,
  });
  M.edge = new THREE.LineBasicMaterial({ color: new THREE.Color(accent.edge), transparent: true, opacity: 0.55 });
  M.chassis = new THREE.MeshStandardMaterial({ color: 0x33404f, metalness: 0.85, roughness: 0.45 });
  M.armUpper = new THREE.MeshStandardMaterial({ color: 0xdfe5ee, metalness: 0.9, roughness: 0.3 });
  M.armLower = new THREE.MeshStandardMaterial({ color: 0xb9c2cf, metalness: 0.9, roughness: 0.33 });
  M.toeLink = new THREE.MeshStandardMaterial({ color: 0xffc46b, metalness: 0.8, roughness: 0.35 });
  M.knuckle = new THREE.MeshStandardMaterial({ color: 0x8f9aa8, metalness: 0.75, roughness: 0.5 });
  M.joint = new THREE.MeshStandardMaterial({ color: 0x1d2530, metalness: 0.4, roughness: 0.6 });
  M.spring = new THREE.MeshStandardMaterial({ color: new THREE.Color(accent.spring), metalness: 0.85, roughness: 0.32 });
  M.damperTube = new THREE.MeshStandardMaterial({ color: 0x2a3340, metalness: 0.8, roughness: 0.4 });
  M.damperRod = new THREE.MeshStandardMaterial({ color: 0xe8edf4, metalness: 0.98, roughness: 0.09 });
  M.actuator = new THREE.MeshStandardMaterial({
    color: 0x334455, emissive: new THREE.Color(0x000000), emissiveIntensity: 1, metalness: 0.6, roughness: 0.35,
  });
  M.arb = new THREE.MeshStandardMaterial({ color: 0xd94f4f, metalness: 0.85, roughness: 0.35 });
  M.tire = new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.0, roughness: 0.92 });
  M.rim = new THREE.MeshStandardMaterial({ color: 0xc9d2de, metalness: 0.95, roughness: 0.18 });
  M.disc = new THREE.MeshStandardMaterial({ color: 0x6f7783, metalness: 0.9, roughness: 0.42 });
  M.caliper = new THREE.MeshStandardMaterial({ color: new THREE.Color(accent.caliper), metalness: 0.5, roughness: 0.45 });
  M.seat = new THREE.MeshStandardMaterial({ color: 0x2a3240, metalness: 0.2, roughness: 0.8 });
  M.marker = new THREE.MeshBasicMaterial({ color: new THREE.Color(accent.marker) });
  M.airWarn = new THREE.MeshBasicMaterial({ color: 0xff3b30, transparent: true, opacity: 0.9 });
  return M;
}

/* ============================ 几何工具 ============================ */
const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 14, 1, false);
const UNIT_SPH = new THREE.SphereGeometry(1, 14, 10);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);

/** 一段「杆」：用单位圆柱通过 position/quaternion/scale 精确对齐到 p→q */
class Segment {
  constructor(parent, mat, radius, opts = {}) {
    this.mesh = new THREE.Mesh(UNIT_CYL, mat);
    this.mesh.castShadow = !!opts.shadow;
    this.r = radius;
    parent.add(this.mesh);
  }
  set(p, q, radius = this.r) {
    _v1.set(p[0], p[1], p[2]); _v2.set(q[0], q[1], q[2]);
    _v3.subVectors(_v2, _v1);
    const L = _v3.length() || 1e-6;
    this.mesh.position.copy(_v1).addScaledVector(_v3, 0.5);
    _q.setFromUnitVectors(_up, _v3.normalize());
    this.mesh.quaternion.copy(_q);
    this.mesh.scale.set(radius, L, radius);
  }
  set visible(v) { this.mesh.visible = v; }
}

function ball(parent, mat, r) {
  const m = new THREE.Mesh(UNIT_SPH, mat);
  m.scale.setScalar(r);
  parent.add(m);
  return m;
}
const setPos = (m, p) => m.position.set(p[0], p[1], p[2]);

/** 单位高度螺旋弹簧（y: 0→1），用 scale.y 拉伸即模拟弹簧压缩/伸长 */
function springGeometry(turns, radius, coilR) {
  const pts = [];
  const N = Math.ceil(turns * 14);
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    // 两端各留 6% 做平坦座圈
    const t = Math.min(1, Math.max(0, (u - 0.06) / 0.88));
    const a = t * turns * Math.PI * 2;
    const rr = radius * (u < 0.06 || u > 0.94 ? 1.04 : 1);
    pts.push(new THREE.Vector3(Math.cos(a) * rr, u, Math.sin(a) * rr));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, N, coilR, 7, false);
}

/* ============================ 车轮 ============================ */
function buildWheel(parent, M, mirrored) {
  const g = new THREE.Group();
  // 轮胎（沿 x 轴）
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, TIRE_W, 34, 1, false), M.tire);
  tire.rotation.z = Math.PI / 2;
  tire.castShadow = true;
  g.add(tire);
  // 胎侧凹槽
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R * 0.93, 0.018, 6, 30), M.tire);
    side.rotation.y = Math.PI / 2;
    side.position.x = sx * TIRE_W * 0.46;
    g.add(side);
  }
  // 轮辋
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R * 0.66, WHEEL_R * 0.66, TIRE_W * 0.72, 26, 1, false), M.rim);
  rim.rotation.z = Math.PI / 2;
  g.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(WHEEL_R * 0.655, 26), M.rim);
  face.rotation.y = (mirrored ? 1 : -1) * Math.PI / 2;
  face.position.x = (mirrored ? 1 : -1) * TIRE_W * 0.36;
  g.add(face);
  // 五辐
  for (let i = 0; i < 5; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.030, WHEEL_R * 0.60, 0.052), M.rim);
    sp.position.set((mirrored ? 1 : -1) * TIRE_W * 0.30, 0, 0);
    sp.rotation.x = (i / 5) * Math.PI * 2;
    sp.position.y = Math.cos((i / 5) * Math.PI * 2) * WHEEL_R * 0.30;
    sp.position.z = Math.sin((i / 5) * Math.PI * 2) * WHEEL_R * 0.30;
    g.add(sp);
  }
  parent.add(g);
  return g;
}

/* ============================ 一个角点（悬架总成） ============================ */
class Corner {
  /**
   * @param bodyGroup 车身组
   * @param def       硬点定义（已按左右镜像）
   * @param offset    角点原点在车身系中的位置 [x,y,z]
   * @param M         材质
   * @param isFront   前/后
   */
  constructor(bodyGroup, def, offset, M, isFront, mirrored) {
    this.def = def; this.M = M; this.isFront = isFront; this.mirrored = mirrored;
    this.solver = new CornerSolver(def);
    this.offset = offset;

    const g = new THREE.Group();
    g.position.set(offset[0], offset[1], offset[2]);
    bodyGroup.add(g);
    this.group = g;

    const statics = new THREE.Group(); g.add(statics);
    const moving = new THREE.Group(); g.add(moving);
    this.staticsGroup = statics;
    this.linkGroup = moving;

    /* --- 车身侧固定铰点（衬套） --- */
    const bushings = [];
    if (def.type === 'dw') {
      bushings.push(def.uca.a, def.uca.b, def.lca.a, def.lca.b, def.tie.in);
      // 上下摆臂内点连线（模拟副车架安装轴）
      this.axisSegs = [new Segment(statics, M.chassis, 0.012), new Segment(statics, M.chassis, 0.014)];
      this.axisSegs[0].set(def.uca.a, def.uca.b);
      this.axisSegs[1].set(def.lca.a, def.lca.b);
    } else {
      for (const l of def.links) bushings.push(l.in);
    }
    bushings.push(def.damper.top);
    for (const b of bushings) {
      const m = ball(statics, M.joint, 0.022); setPos(m, b);
    }
    // 减振器上支座
    const topMount = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.028, 14), M.chassis);
    setPos(topMount, def.damper.top); topMount.position.y += 0.012;
    statics.add(topMount);

    /* --- 摆臂 / 连杆 --- */
    if (def.type === 'dw') {
      this.uca1 = new Segment(moving, M.armUpper, 0.0155, { shadow: true });
      this.uca2 = new Segment(moving, M.armUpper, 0.0155, { shadow: true });
      this.lca1 = new Segment(moving, M.armLower, 0.0195, { shadow: true });
      this.lca2 = new Segment(moving, M.armLower, 0.0195, { shadow: true });
      this.tieSeg = new Segment(moving, M.toeLink, 0.0125, { shadow: true });
      // 叉臂三角腹板
      this.ucaWeb = this._plate(moving, M.armUpper);
      this.lcaWeb = this._plate(moving, M.armLower);
    } else {
      this.linkSegs = def.links.map((l, i) => new Segment(moving, i === 4 ? M.toeLink : (i < 2 ? M.armUpper : M.armLower), i === 4 ? 0.0125 : 0.0155, { shadow: true }));
    }

    /* --- 转向节 / 轮毂支架 --- */
    const kn = new THREE.Group();
    kn.matrixAutoUpdate = false;
    g.add(kn);
    this.knuckle = kn;
    this.uprightSegs = [];
    const up = def.upright;
    for (let i = 0; i < up.length - 1; i++) {
      const s = new Segment(kn, M.knuckle, 0.024, { shadow: true });
      s.set(up[i], up[up.length - 1]);
      this.uprightSegs.push(s);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.075, 16), M.knuckle);
    hub.rotation.z = Math.PI / 2;
    kn.add(hub);
    for (const p of up) { const m = ball(kn, M.joint, 0.019); setPos(m, p); }

    /* --- 制动盘 + 卡钳 --- */
    const spin = new THREE.Group();
    kn.add(spin);
    this.spin = spin;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(def.brake.r, def.brake.r, def.brake.t, 30), M.disc);
    disc.rotation.z = Math.PI / 2;
    disc.position.x = (mirrored ? 1 : -1) * 0.052;
    spin.add(disc);
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.10, 0.052), M.caliper);
    const ca = def.brake.caliperAng;
    cal.position.set((mirrored ? 1 : -1) * 0.052, Math.cos(ca) * def.brake.r * 0.92, Math.sin(ca) * def.brake.r * 0.92);
    cal.rotation.x = -ca + Math.PI / 2;
    kn.add(cal);

    /* --- 车轮 --- */
    this.wheel = buildWheel(spin, M, mirrored);

    /* --- 弹簧 / 减振器 / 作动器 --- */
    const sg = new THREE.Group(); g.add(sg);
    this.springGroup = sg;
    this.springMesh = new THREE.Mesh(springGeometry(def.springTurns, def.springR, def.coilR), M.spring);
    this.springMesh.castShadow = true;
    sg.add(this.springMesh);

    this.damperTube = new Segment(g, M.damperTube, 0.030, { shadow: true });
    this.damperRod = new Segment(g, M.damperRod, 0.0135);
    // 作动器（主动悬架可视化：环形，颜色/亮度表示出力）
    this.actMat = M.actuator.clone();
    this.actuator = new Segment(g, this.actMat, 0.040);
    this.actuator.visible = false;

    /* --- 横向稳定杆连接（扭杆本体在轴级别绘制） --- */
    if (def.arb) {
      this.arbArm = new Segment(g, M.arb, 0.0135);
      this.arbLink = new Segment(g, M.arb, 0.0105);
      this.arbTipBall = ball(g, M.joint, 0.017);
    }

    /* --- 离地警示环 --- */
    const ring = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R * 1.12, 0.022, 6, 26), M.airWarn);
    ring.rotation.y = Math.PI / 2;
    ring.visible = false;
    g.add(ring);
    this.airRing = ring;

    this.damperL0 = dist(def.damper.top, def.damper.bottom);
    this.update(0, 0, 0, 1);
  }

  _plate(parent, mat) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
    geo.setIndex([0, 1, 2]);
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    parent.add(m);
    return m;
  }
  _setPlate(m, a, b, c) {
    const pa = m.geometry.attributes.position;
    pa.array.set([a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]]);
    pa.needsUpdate = true;
    m.geometry.computeVertexNormals();
  }

  /**
   * @param travel  轮跳量 m（>0 压缩）
   * @param spinAng 车轮自旋角
   * @param actF    作动器出力 N
   * @param contact 1=接地 0=离地
   */
  update(travel, spinAng, actF, contact) {
    const def = this.def;
    const o = this.solver.solve(travel);
    this.out = o;

    if (def.type === 'dw') {
      this.uca1.set(def.uca.a, o.pts.ucaOut);
      this.uca2.set(def.uca.b, o.pts.ucaOut);
      this.lca1.set(def.lca.a, o.pts.lcaOut);
      this.lca2.set(def.lca.b, o.pts.lcaOut);
      this.tieSeg.set(def.tie.in, o.pts.tieOut);
      this._setPlate(this.ucaWeb, def.uca.a, def.uca.b, o.pts.ucaOut);
      this._setPlate(this.lcaWeb, def.lca.a, def.lca.b, o.pts.lcaOut);
    } else {
      for (let i = 0; i < 5; i++) this.linkSegs[i].set(def.links[i].in, o.pts.linkOut[i]);
    }

    // 转向节位姿
    const rv = o.rotVec;
    const ang = Math.hypot(rv[0], rv[1], rv[2]);
    if (ang < 1e-9) _q.identity();
    else _q.setFromAxisAngle(_v1.set(rv[0] / ang, rv[1] / ang, rv[2] / ang), ang);
    _v2.set(o.pose[0], o.pose[1], o.pose[2]);
    this.knuckle.matrix.compose(_v2, _q, _v3.set(1, 1, 1));
    this.knuckle.matrixWorldNeedsUpdate = true;
    this.spin.rotation.x = spinAng * (this.mirrored ? -1 : 1);

    // 弹簧 / 减振器
    const bo = o.damperBottom, tp = o.damperTop;
    _v1.set(bo[0], bo[1], bo[2]); _v2.set(tp[0], tp[1], tp[2]);
    _v3.subVectors(_v2, _v1);
    const L = _v3.length();
    this.springGroup.position.copy(_v1);
    _q.setFromUnitVectors(_up, _v3.clone().normalize());
    this.springGroup.quaternion.copy(_q);
    this.springGroup.scale.set(1, L, 1);

    const tubeL = this.damperL0 * 0.52;
    const dir = _v3.clone().normalize();
    const tubeEnd = [bo[0] + dir.x * tubeL, bo[1] + dir.y * tubeL, bo[2] + dir.z * tubeL];
    this.damperTube.set(bo, tubeEnd);
    this.damperRod.set(tubeEnd, tp);

    // 作动器视觉：环带长度固定，颜色随出力（红=顶起车身/压缩，蓝=回缩）
    if (this.actuator.mesh.visible) {
      const a0 = [bo[0] + dir.x * tubeL * 0.35, bo[1] + dir.y * tubeL * 0.35, bo[2] + dir.z * tubeL * 0.35];
      const a1 = [bo[0] + dir.x * tubeL * 0.95, bo[1] + dir.y * tubeL * 0.95, bo[2] + dir.z * tubeL * 0.95];
      this.actuator.set(a0, a1);
      const n = Math.max(-1, Math.min(1, actF / 3500));
      const mag = Math.abs(n);
      this.actMat.emissive.setRGB(n > 0 ? mag : mag * 0.15, mag * 0.25, n < 0 ? mag : mag * 0.15);
      this.actMat.emissiveIntensity = 0.15 + 1.9 * mag;
    }

    // 横向稳定杆
    if (def.arb && o.arbTip) {
      this.arbArm.set(o.arbPivot, o.arbTip);
      this.arbLink.set(o.arbTip, o.arbAttach);
      setPos(this.arbTipBall, o.arbTip);
    }

    this.airRing.visible = contact < 0.5;
    if (this.airRing.visible) setPos(this.airRing, o.wheelCenter);
    return o;
  }
}

/* ============================ 车壳（可半透明） ============================ */
function sedanLowerProfile() {
  // (z, y)：车身下部，从车头底部逆时针；含前后轮拱（挖出轮罩）
  const s = new THREE.Shape();
  const archF = { z: 1.45, y: -0.20, r: 0.445 };
  const archR = { z: -1.50, y: -0.20, r: 0.445 };
  const sillY = -0.325;
  const dzF = Math.sqrt(archF.r ** 2 - (sillY - archF.y) ** 2);
  const dzR = Math.sqrt(archR.r ** 2 - (sillY - archR.y) ** 2);

  s.moveTo(2.28, 0.055);
  s.lineTo(2.305, -0.095);
  s.quadraticCurveTo(2.29, -0.27, 2.16, -0.30);
  s.lineTo(archF.z + dzF, sillY);
  s.absarc(archF.z, archF.y, archF.r, Math.atan2(sillY - archF.y, dzF), Math.atan2(sillY - archF.y, -dzF), false);
  s.lineTo(archR.z + dzR, sillY);
  s.absarc(archR.z, archR.y, archR.r, Math.atan2(sillY - archR.y, dzR), Math.atan2(sillY - archR.y, -dzR), false);
  s.lineTo(-2.14, -0.30);
  s.quadraticCurveTo(-2.33, -0.27, -2.335, -0.075);
  s.lineTo(-2.315, 0.115);
  s.quadraticCurveTo(-2.24, 0.375, -2.02, 0.392);
  s.lineTo(-1.62, 0.405);
  s.lineTo(0.95, 0.398);
  s.quadraticCurveTo(1.55, 0.375, 1.80, 0.325);
  s.quadraticCurveTo(2.14, 0.245, 2.28, 0.055);
  return s;
}
function sedanCabinProfile() {
  const s = new THREE.Shape();
  s.moveTo(0.98, 0.365);
  s.quadraticCurveTo(0.62, 0.60, 0.24, 0.845);   // 前风挡
  s.lineTo(-0.30, 0.868);
  s.quadraticCurveTo(-0.70, 0.878, -1.02, 0.855); // 车顶
  s.quadraticCurveTo(-1.42, 0.72, -1.63, 0.44);   // 后风挡
  s.lineTo(-1.63, 0.355);
  s.lineTo(0.98, 0.355);
  return s;
}

function extrudeAcross(shape, width, bevel) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 1.1,
    bevelSegments: 3, curveSegments: 16,
  });
  geo.rotateY(-Math.PI / 2);   // shape.x -> +z(车前), shape.z -> -x
  geo.translate(width / 2, 0, 0);
  geo.computeVertexNormals();
  return geo;
}

function buildShell(bodyGroup, M) {
  const grp = new THREE.Group();
  bodyGroup.add(grp);

  const lower = extrudeAcross(sedanLowerProfile(), 1.845, 0.030);
  const lowerMesh = new THREE.Mesh(lower, M.shell);
  lowerMesh.castShadow = true;
  grp.add(lowerMesh);

  const cabin = extrudeAcross(sedanCabinProfile(), 1.685, 0.022);
  const cabinMesh = new THREE.Mesh(cabin, M.glass);
  cabinMesh.castShadow = true;
  grp.add(cabinMesh);

  // 轮廓线：低透明度时仍能看清车形
  const eL = new THREE.LineSegments(new THREE.EdgesGeometry(lower, 24), M.edge);
  const eC = new THREE.LineSegments(new THREE.EdgesGeometry(cabin, 24), M.edge);
  grp.add(eL, eC);

  return { group: grp, lower: lowerMesh, cabin: cabinMesh, edges: [eL, eC] };
}

/* ============================ 底盘内部件 ============================ */
function buildChassis(bodyGroup, M, p) {
  const g = new THREE.Group();
  bodyGroup.add(g);
  const rail = (x) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 3.55), M.chassis);
    m.position.set(x, -0.275, -0.02);
    g.add(m);
  };
  rail(-0.44); rail(0.44);
  for (const z of [p.lf + 0.08, p.lf - 0.42, -p.lr + 0.40, -p.lr - 0.14, 0.30, -0.55]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.070, 0.085), M.chassis);
    m.position.set(0, -0.272, z);
    g.add(m);
  }
  // 动力总成 / 油箱 / 排气
  const eng = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.66), M.chassis);
  eng.position.set(0, -0.06, 1.26); g.add(eng);
  const gbx = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 0.72, 14), M.chassis);
  gbx.rotation.x = Math.PI / 2; gbx.position.set(0, -0.16, 0.60); g.add(gbx);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.22, 0.52), M.chassis);
  tank.position.set(0, -0.20, -1.10); g.add(tank);
  const exh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.9, 10), M.chassis);
  exh.rotation.x = Math.PI / 2; exh.position.set(0.24, -0.30, -0.70); g.add(exh);

  // 座椅（关键测点所在）
  const mkSeat = (x, z) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.11, 0.48), M.seat);
    base.position.set(x, 0.11, z); g.add(base);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.11), M.seat);
    back.position.set(x, 0.40, z - 0.26); back.rotation.x = -0.14; g.add(back);
  };
  mkSeat(p.seat.lx, p.seat.lz);
  mkSeat(-p.seat.lx, p.seat.lz);
  mkSeat(-0.40, -0.92); mkSeat(0.40, -0.92);

  // 方向盘
  const sw = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.022, 7, 22), M.chassis);
  sw.position.set(p.seat.lx, 0.46, p.seat.lz + 0.54);
  sw.rotation.x = 1.16; g.add(sw);
  return g;
}

/* ============================ 整车 ============================ */
export class CarRig {
  constructor(scene, p, accent, opts = {}) {
    this.p = p;
    this.M = makeMaterials(accent);
    this.accent = accent;
    this.isActive = !!opts.active;

    const root = new THREE.Group();
    scene.add(root);
    this.root = root;

    const body = new THREE.Group();
    body.position.y = p.hCG;
    root.add(body);
    this.body = body;

    this.shell = buildShell(body, this.M);
    this.chassis = buildChassis(body, this.M, p);

    /* 四个角点 */
    const yOff = WHEEL_R - p.hCG;
    const fL = frontDoubleWishbone(), fR = mirrorDef(frontDoubleWishbone());
    const rL = rearFiveLink(), rR = mirrorDef(rearFiveLink());
    this.corners = [
      new Corner(body, fL, [p.lx[0], yOff, p.lz[0]], this.M, true, false),
      new Corner(body, fR, [p.lx[1], yOff, p.lz[1]], this.M, true, true),
      new Corner(body, rL, [p.lx[2], yOff, p.lz[2]], this.M, false, false),
      new Corner(body, rR, [p.lx[3], yOff, p.lz[3]], this.M, false, true),
    ];
    if (this.isActive) for (const c of this.corners) c.actuator.visible = true;

    /* 横向稳定杆扭杆本体（跨左右） */
    this.arbBars = [];
    for (const [iL, iR] of [[0, 1], [2, 3]]) {
      const dL = this.corners[iL].def.arb, dR = this.corners[iR].def.arb;
      if (!dL) continue;
      const yb = yOff + dL.axis[1];
      const a = [p.lx[iL] + dL.pivotX, yb, p.lz[iL] + dL.axis[2]];
      const b = [p.lx[iR] + dR.pivotX, yb, p.lz[iR] + dR.axis[2]];
      const seg = new Segment(body, this.M.arb, 0.0135);
      seg.set(a, b);
      this.arbBars.push(seg);
    }

    /* 关键测点标记（驾驶员座椅处） */
    const kp = new THREE.Group();
    kp.position.set(p.seat.lx, 0.30, p.seat.lz);
    body.add(kp);
    const kpBall = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 12), this.M.marker);
    kp.add(kpBall);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.10, 0.010, 6, 24), this.M.marker);
    halo.rotation.x = Math.PI / 2; kp.add(halo);
    this.keyPoint = kp;
    this.keyPointBall = kpBall;

    /* 关键测点世界轨迹（拖尾）—— 直观显示车身起伏 */
    this.trailN = 320;
    this.trailPos = new Float32Array(this.trailN * 3);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(this.trailPos, 3));
    this.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({
      color: new THREE.Color(accent.marker), transparent: true, opacity: 0.95,
    }));
    this.trail.frustumCulled = false;
    scene.add(this.trail);
    this.trailData = [];

    /* 预瞄扫描射线（仅主动车） */
    if (this.isActive) {
      const sg = new THREE.BufferGeometry();
      this.scanN = 60;
      this.scanPos = new Float32Array(this.scanN * 3);
      sg.setAttribute('position', new THREE.BufferAttribute(this.scanPos, 3));
      this.scanLine = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: 0x5ce0ff, transparent: true, opacity: 0.85 }));
      this.scanLine.frustumCulled = false;
      scene.add(this.scanLine);
      const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.05, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x101820, emissive: 0x2299cc, emissiveIntensity: 1.2 }));
      sensor.position.set(0, 0.80, 0.34);
      body.add(sensor);
    }

    this.spinAng = 0;
    this.setShellOpacity(1);
  }

  /** 车壳透明度 0..1 */
  setShellOpacity(v) {
    this.shellOpacity = v;
    const t = v < 0.995;
    for (const m of [this.M.shell]) {
      m.transparent = t; m.opacity = v; m.depthWrite = !t; m.needsUpdate = true;
    }
    this.M.glass.opacity = Math.min(0.62, v * 0.72);
    this.M.glass.depthWrite = v > 0.995;
    this.M.edge.opacity = t ? 0.30 + 0.45 * (1 - v) : 0.35;
    for (const e of this.shell.edges) e.visible = true;
  }

  setVisible(flags) {
    this.shell.group.visible = flags.shell !== false;
    for (const c of this.corners) {
      c.wheel.visible = flags.wheels !== false;
      c.airRing.visible = c.airRing.visible && flags.wheels !== false;
    }
    this.chassis.visible = flags.chassis !== false;
    this.keyPoint.visible = flags.keyPoint !== false;
    this.trail.visible = flags.trail !== false;
    if (this.scanLine) this.scanLine.visible = flags.scan !== false && this.isActive;
    for (const b of this.arbBars) b.visible = flags.arb !== false;
    for (const c of this.corners) {
      if (c.arbArm) { c.arbArm.visible = flags.arb !== false; c.arbLink.visible = flags.arb !== false; }
    }
  }

  /**
   * 由物理状态驱动整车
   * @param unit  Sim 中的 Unit（含 x / diag / ctrl）
   * @param s     里程
   * @param v     车速
   * @param dt    帧时间
   * @param road  Road
   */
  update(unit, s, v, dt, road) {
    const p = this.p, x = unit.x, d = unit.diag;
    this.body.position.y = p.hCG + x[0];
    this.body.rotation.x = -x[2];     // 俯仰：θ>0 车头抬起 -> rotation.x 取负
    this.body.rotation.z = x[1];      // 侧倾：φ>0 右侧抬起 -> rotation.z 取正

    this.spinAng -= (v / WHEEL_R) * dt;
    for (let i = 0; i < 4; i++) {
      this.corners[i].update(d.defl[i], this.spinAng, unit.ctrl.force[i], d.contact[i]);
    }

    /* 关键测点世界轨迹：把历史点画在车后，形成「振动留痕」 */
    const kpWorld = _v1.set(p.seat.lx, 0.30, p.seat.lz);
    this.body.localToWorld(kpWorld);
    this.trailData.push({ s, y: kpWorld.y, x: kpWorld.x });
    const keep = 30;   // 保留 30 m
    while (this.trailData.length > 1 && s - this.trailData[0].s > keep) this.trailData.shift();
    // 暂停时 s 不再增长，上面的距离裁剪不会生效 —— 必须再加长度上限防止无界增长
    if (this.trailData.length > 3000) this.trailData.splice(0, this.trailData.length - 3000);
    const n = Math.min(this.trailN, this.trailData.length);
    const start = this.trailData.length - n;
    for (let i = 0; i < this.trailN; i++) {
      const k = start + Math.min(n - 1, Math.floor((i / (this.trailN - 1)) * (n - 1)));
      const e = this.trailData[Math.max(0, k)] || { s, y: kpWorld.y, x: kpWorld.x };
      this.trailPos[i * 3] = e.x;
      this.trailPos[i * 3 + 1] = e.y;
      this.trailPos[i * 3 + 2] = p.seat.lz - (s - e.s);
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.computeBoundingSphere();

    /* 预瞄扫描线 */
    if (this.scanLine) {
      const D = unit.ctrl.gains.scanDistance;
      for (let i = 0; i < this.scanN; i++) {
        const t = i / (this.scanN - 1);
        const zz = p.lf + 0.4 + t * D;
        this.scanPos[i * 3] = p.lx[0] * 0.55;
        this.scanPos[i * 3 + 1] = road.height(s + zz, -1) + 0.012;
        this.scanPos[i * 3 + 2] = zz;
      }
      this.scanLine.geometry.attributes.position.needsUpdate = true;
      this.scanLine.geometry.computeBoundingSphere();
    }
  }

  /** 悬架几何读数（用于 HUD） */
  readout() {
    return this.corners.map((c) => ({
      camber: c.out.camber, toe: c.out.toe,
      stroke: c.out.damperStroke * 1000, travel: c.solver.target * 1000,
      iters: c.solver.iters, err: c.solver.err,
    }));
  }
}

/* ============================ 路面 ============================ */
export class RoadMesh {
  /**
   * 路面网格：车辆固定在 z=0，路面高程逐帧按里程重算（车辆前后 zBack..zFront）
   * 关键优化：每「行」只调用 2 次路面函数（左/右轮迹），横向插值 —— 每帧仅 ~1400 次求值
   */
  constructor(road, { zBack = -18, zFront = 42, dz = 0.085, halfW = 2.7, nx = 26 } = {}) {
    this.road = road;
    this.zBack = zBack; this.zFront = zFront; this.dz = dz;
    this.nz = Math.floor((zFront - zBack) / dz) + 1;
    this.nx = nx; this.halfW = halfW;

    const nz = this.nz, N = nz * nx;
    this.pos = new Float32Array(N * 3);
    this.nrm = new Float32Array(N * 3);
    this.uv = new Float32Array(N * 2);
    const idx = [];
    for (let iz = 0; iz < nz - 1; iz++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        const a = iz * nx + ix, b = a + 1, c = a + nx, dd = c + 1;
        idx.push(a, c, b, b, c, dd);
      }
    }
    for (let iz = 0; iz < nz; iz++) {
      const z = zBack + iz * dz;
      for (let ix = 0; ix < nx; ix++) {
        const k = iz * nx + ix;
        const xx = -halfW + (2 * halfW * ix) / (nx - 1);
        this.pos[k * 3] = xx; this.pos[k * 3 + 1] = 0; this.pos[k * 3 + 2] = z;
        this.nrm[k * 3 + 1] = 1;
        this.uv[k * 2] = (xx + halfW) / (2 * halfW) * 2.2;
        this.uv[k * 2 + 1] = z / 6.0;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    g.setIndex(idx);
    this.geometry = g;

    this.tex = makeAsphaltTexture();
    this.material = new THREE.MeshStandardMaterial({
      map: this.tex, roughness: 0.94, metalness: 0.0, color: 0xffffff,
    });
    this.zL = new Float64Array(nz);
    this.zR = new Float64Array(nz);
    // 横向权重：左轮迹 -> 右轮迹 平滑过渡，使单侧坑洼只出现在对应轮迹
    this.wx = new Float64Array(nx);
    for (let ix = 0; ix < nx; ix++) {
      const xx = -halfW + (2 * halfW * ix) / (nx - 1);
      const t = Math.max(0, Math.min(1, (xx + 0.62) / 1.24));
      this.wx[ix] = t * t * (3 - 2 * t);
    }
    this.update(0);
  }

  /** 在场景中加入一个共享此几何体的 Mesh（两个视口共享，只需更新一次） */
  addTo(scene) {
    const m = new THREE.Mesh(this.geometry, this.material);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  }

  update(s) {
    const { nz, nx, dz, zBack, road, pos, nrm, zL, zR, wx } = this;
    for (let iz = 0; iz < nz; iz++) {
      const sz = s + zBack + iz * dz;
      zL[iz] = road.height(sz, -1);
      zR[iz] = road.height(sz, 1);
    }
    for (let iz = 0; iz < nz; iz++) {
      const l = zL[iz], r = zR[iz];
      const base = iz * nx;
      for (let ix = 0; ix < nx; ix++) {
        pos[(base + ix) * 3 + 1] = l + (r - l) * wx[ix];
      }
    }
    // 解析法向（高度场）
    const dx = (2 * this.halfW) / (nx - 1);
    for (let iz = 0; iz < nz; iz++) {
      const izm = Math.max(0, iz - 1), izp = Math.min(nz - 1, iz + 1);
      const sz = (izp - izm) * dz;
      for (let ix = 0; ix < nx; ix++) {
        const ixm = Math.max(0, ix - 1), ixp = Math.min(nx - 1, ix + 1);
        const hzm = pos[(izm * nx + ix) * 3 + 1], hzp = pos[(izp * nx + ix) * 3 + 1];
        const hxm = pos[(iz * nx + ixm) * 3 + 1], hxp = pos[(iz * nx + ixp) * 3 + 1];
        const gx = (hxp - hxm) / ((ixp - ixm) * dx), gz = (hzp - hzm) / sz;
        const inv = 1 / Math.hypot(gx, 1, gz);
        const k = (iz * nx + ix) * 3;
        nrm[k] = -gx * inv; nrm[k + 1] = inv; nrm[k + 2] = -gz * inv;
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.computeBoundingSphere();
    this.tex.offset.y = -s / 6.0;
  }
}

function makeAsphaltTexture() {
  const S = 512;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3d42';
  g.fillRect(0, 0, S, S);
  // 骨料噪点
  const img = g.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 46;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  // 补丁 / 裂纹
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(${30 + Math.random() * 26 | 0},${30 + Math.random() * 26 | 0},${34 + Math.random() * 26 | 0},0.55)`;
    g.beginPath();
    g.ellipse(Math.random() * S, Math.random() * S, 8 + Math.random() * 44, 5 + Math.random() * 26, Math.random() * 3, 0, 7);
    g.fill();
  }
  // 两侧边线
  g.fillStyle = 'rgba(232,232,226,0.80)';
  g.fillRect(S * 0.055, 0, S * 0.020, S);
  g.fillRect(S * 0.925, 0, S * 0.020, S);
  // 中心虚线
  g.fillStyle = 'rgba(226,222,190,0.72)';
  for (let y = 0; y < S; y += 128) g.fillRect(S * 0.492, y, S * 0.016, 74);

  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  t.anisotropy = 8;
  return t;
}

/* ============================ 环境 / 灯光 ============================ */
export function setupEnvironment(scene, tint) {
  scene.background = new THREE.Color(tint.bg);
  scene.fog = new THREE.Fog(tint.bg, 34, 88);

  const hemi = new THREE.HemisphereLight(0xdceaff, 0x2a2f38, 0.85);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff4e2, 2.0);
  sun.position.set(-7, 12, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const d = 7.5;
  sun.shadow.camera.left = -d; sun.shadow.camera.right = d;
  sun.shadow.camera.top = d; sun.shadow.camera.bottom = -d;
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0012;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x9fc4ff, 0.55);
  fill.position.set(8, 5, -7);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(0, 3, -12);
  scene.add(rim);

  // 路肩草地
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 200),
    new THREE.MeshStandardMaterial({ color: tint.ground, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.09;
  ground.receiveShadow = true;
  scene.add(ground);

  return { sun, hemi };
}

/** 路边标杆（提供速度感） */
export class RoadsidePosts {
  constructor(scene, { count = 26, spacing = 6, x = 3.35, zBack = -16, zFront = 42 } = {}) {
    this.spacing = spacing; this.zBack = zBack; this.zFront = zFront;
    const geo = new THREE.CylinderGeometry(0.045, 0.055, 1.0, 7);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 0.7 });
    this.mesh = new THREE.InstancedMesh(geo, mat, count * 2);
    this.mesh.frustumCulled = false;
    this.count = count; this.x = x;
    scene.add(this.mesh);
    this.m = new THREE.Matrix4();
    this.update(0);
  }
  update(s) {
    const span = this.zFront - this.zBack;
    let k = 0;
    for (const sx of [-1, 1]) {
      for (let i = 0; i < this.count; i++) {
        let z = ((i * this.spacing - s) % span + span) % span + this.zBack;
        this.m.makeTranslation(sx * this.x, -0.08, z);
        this.mesh.setMatrixAt(k++, this.m);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
