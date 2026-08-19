/**
 * flows.js —— 流体流动可视化：润滑油、冷却液、进气、排气
 *   · 半透明流线（TubeGeometry）示意管路走向，可注册悬浮信息
 *   · 粒子沿流线按真实方向流动，流量随转速/负荷/节温器开度动态变化
 *   · 进排气支管的粒子按各缸气门升程"脉动"，直观体现换气过程
 */
import * as THREE from 'three';
import * as U from '../core/util.js';
import { CYL_X } from '../core/params.js';

/** 生成柔和圆形粒子贴图（运行时生成，无外部资源） */
function sprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const rad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rad.addColorStop(0, 'rgba(255,255,255,1)');
  rad.addColorStop(0.35, 'rgba(255,255,255,0.85)');
  rad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

class FlowSystem {
  /**
   * @param {object} cfg {key, color, size, count, tubeR, opacity}
   * @param {Array}  segs [{pts, weight, speed, gate}]
   */
  constructor(cfg, segs, tex, world) {
    this.cfg = cfg;
    this.group = new THREE.Group();
    this.group.name = 'flow:' + cfg.key;
    this.segs = [];
    let total = 0;
    for (const s of segs) {
      const curve = new THREE.CatmullRomCurve3(
        s.pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', s.tension ?? 0.4);
      const len = curve.getLength();
      const N = 220;
      const samples = curve.getSpacedPoints(N);
      this.segs.push({ curve, len, samples, N, speed: s.speed ?? 1, gate: s.gate || null, weight: s.weight ?? 1 });
      total += s.weight ?? 1;
    }
    // 粒子分配
    const count = cfg.count;
    this.pt = [];
    const pos = new Float32Array(count * 3);
    let idx = 0;
    this.segs.forEach((sg, si) => {
      const n = Math.max(6, Math.round(count * (sg.weight / total)));
      for (let k = 0; k < n && idx < count; k++, idx++) {
        this.pt.push({
          si, t: k / n,
          jx: (Math.random() - 0.5), jy: (Math.random() - 0.5), jz: (Math.random() - 0.5),
        });
      }
    });
    while (this.pt.length < count) this.pt.push({ si: 0, t: Math.random(), jx: 0, jy: 0, jz: 0 });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.mat = new THREE.PointsMaterial({
      color: cfg.color, size: cfg.size, map: tex, transparent: true, opacity: 0.95,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    // 流线管
    this.tubeMat = new THREE.MeshBasicMaterial({
      color: cfg.color, transparent: true, opacity: cfg.opacity ?? 0.14, depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.tubes = new THREE.Group();
    for (const sg of this.segs) {
      const g = new THREE.TubeGeometry(sg.curve, Math.max(20, Math.round(sg.len / 22)), cfg.tubeR, 8, false);
      const m = new THREE.Mesh(g, this.tubeMat);
      m.userData.partId = cfg.partId;
      this.tubes.add(m);
    }
    // 流向箭头（静止时也能看出方向）
    {
      const arrowMat = new THREE.MeshBasicMaterial({
        color: cfg.color, transparent: true, opacity: 0.62, depthWrite: false,
      });
      this.arrowMat = arrowMat;
      const cone = new THREE.ConeGeometry(cfg.tubeR * 1.85, cfg.tubeR * 4.6, 7);
      const tfs = [];
      const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      const mtx = new THREE.Matrix4(), sc = new THREE.Vector3(1, 1, 1);
      for (const sg of this.segs) {
        const n = Math.max(1, Math.round(sg.len / 150));
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const p = sg.curve.getPointAt(Math.min(0.999, t));
          const tan = sg.curve.getTangentAt(Math.min(0.999, t)).normalize();
          q.setFromUnitVectors(up, tan);
          tfs.push(new THREE.Matrix4().compose(p, q, sc));
        }
      }
      const im = new THREE.InstancedMesh(cone, arrowMat, tfs.length);
      tfs.forEach((m2, i) => im.setMatrixAt(i, m2));
      im.instanceMatrix.needsUpdate = true;
      im.userData.partId = cfg.partId;
      im.frustumCulled = false;
      this.arrows = im;
      this.tubes.add(im);
      void mtx;
    }
    this.group.add(this.tubes);
    this.attr = geo.getAttribute('position');
    this.jitter = cfg.jitter ?? 3.2;
  }

  update(st, flow) {
    const arr = this.attr.array;
    const dt = Math.min(0.05, st.dt);
    for (let i = 0; i < this.pt.length; i++) {
      const p = this.pt[i];
      const sg = this.segs[p.si];
      let f = flow * sg.speed;
      if (sg.gate) f *= sg.gate(st);
      p.t += (f * 900 * dt) / sg.len;
      if (p.t > 1) p.t -= 1;
      if (p.t < 0) p.t += 1;
      const s = sg.samples[Math.min(sg.N, Math.max(0, Math.round(p.t * sg.N)))];
      const j = this.jitter;
      arr[i * 3] = s.x + p.jx * j;
      arr[i * 3 + 1] = s.y + p.jy * j;
      arr[i * 3 + 2] = s.z + p.jz * j;
    }
    this.attr.needsUpdate = true;
  }
}

export function build(world) {
  const { P, mats } = world;
  const FG = world.group('flow');
  const tex = sprite();
  const systems = {};

  // ================= 润滑油：压力油路 =================
  const gy = P.block.galleryY, gz = P.block.galleryZ;
  const oilSegs = [
    { // 集滤器 → 机油泵 → 限压阀 → 机油冷却器 → 滤清器 → 主油道
      pts: [[-300, -185, 0], [-300, -140, 12], [-296, -112, 30], [-240, -60, 90],
        [-60, 0, 150], [-60, 60, 160], [60, 90, 170], [150, 140, 168], [150, 118, 120], [40, gy, gz]],
      weight: 2.4, speed: 1.0,
    },
    { pts: [[40, gy, gz], [330, gy, gz]], weight: 1.0, speed: 1.1 },
    { pts: [[40, gy, gz], [-330, gy, gz]], weight: 1.4, speed: 1.1 },
  ];
  // 主轴承支路
  for (const x of [-260, -130, 0, 130, 260]) {
    oilSegs.push({ pts: [[x, gy, gz], [x, 70, 42], [x, 20, 12], [x, 0, 0]], weight: 0.5, speed: 0.8 });
  }
  // 凸轮轴 / 挺柱支路
  for (const x of [-260, 0, 260]) {
    oilSegs.push({ pts: [[x, gy, gz], [x, 150, 0], [x, P.block.camY, P.block.camZ + 20]], weight: 0.35, speed: 0.7 });
  }
  // 缸盖供油 + 摇臂轴
  oilSegs.push({ pts: [[300, gy, gz], [318, 260, 40], [318, 400, -20], [300, 452, -60]], weight: 0.8, speed: 0.9 });
  oilSegs.push({ pts: [[300, 458, -60], [-300, 458, -60]], weight: 1.0, speed: 0.85 });
  // 活塞冷却喷油（连杆小头喷孔 → 活塞内腔）
  for (const x of CYL_X) {
    oilSegs.push({ pts: [[x, 120, 0], [x, 180, 0], [x, 235, 0]], weight: 0.25, speed: 1.2 });
  }
  systems.oil = new FlowSystem(
    { key: 'oil', color: 0xffb02e, size: 7.5, count: 900, tubeR: 4.5, opacity: 0.13, partId: 'flow.oilCircuit' },
    oilSegs, tex, world);

  // ================= 润滑油：回油 =================
  const retSegs = [
    { pts: [[-300, 440, -100], [-300, 200, -108], [-300, -20, -100], [-300, -150, -60]], weight: 1, speed: 0.5 },
    { pts: [[300, 440, -100], [300, 200, -108], [300, -20, -100], [300, -150, -40]], weight: 1, speed: 0.5 },
    { pts: [[0, 300, 0], [0, 150, 40], [-60, -60, 60], [-180, -170, 20]], weight: 1.2, speed: 0.45 },
  ];
  systems.oilReturn = new FlowSystem(
    { key: 'oilReturn', color: 0xa86a12, size: 6.5, count: 320, tubeR: 5, opacity: 0.08, partId: 'flow.oilReturn' },
    retSegs, tex, world);

  // ================= 冷却液：大循环 =================
  const coolSegs = [
    { pts: [[-400, 190, 0], [-350, 176, -40], [-320, 150, -60], [-260, 150, -70]], weight: 0.6, speed: 1.0 },
  ];
  // 缸体水套（沿缸列前后穿行）
  for (let i = 0; i < CYL_X.length; i++) {
    const x = CYL_X[i];
    coolSegs.push({
      pts: [[x - 60, 200, -66], [x, 232, -66], [x + 40, 250, -30], [x, 258, 30], [x - 40, 250, 66], [x, 232, 66], [x + 60, 220, 40]],
      weight: 0.7, speed: 0.85,
    });
    // 缸体 → 缸盖（水孔）
    coolSegs.push({ pts: [[x, 300, 60], [x, 340, 40], [x, 372, 0], [x, 372, -40]], weight: 0.5, speed: 0.8 });
  }
  // 缸盖 → 节温器 → 散热器 → 水泵
  coolSegs.push({ pts: [[195, 380, -20], [0, 392, -10], [-260, 400, 0], [-330, 424, 0]], weight: 1.0, speed: 1.0 });
  coolSegs.push({
    pts: [[-330, 430, 0], [-420, 468, 0], [-560, 476, 0], [-640, 466, 0]], weight: 0.8, speed: 1.0,
    gate: (st) => 0.15 + 0.85 * st.op.thermostatOpen,
  });
  coolSegs.push({
    pts: [[-640, 460, 0], [-648, 300, 60], [-640, 140, -60], [-640, 96, 0]], weight: 1.0, speed: 0.9,
    gate: (st) => 0.15 + 0.85 * st.op.thermostatOpen,
  });
  coolSegs.push({
    pts: [[-640, 90, 0], [-560, 110, 20], [-470, 150, 10], [-412, 178, 0]], weight: 0.8, speed: 1.0,
    gate: (st) => 0.15 + 0.85 * st.op.thermostatOpen,
  });
  systems.coolant = new FlowSystem(
    { key: 'coolant', color: 0x35b6ff, size: 8, count: 900, tubeR: 5.5, opacity: 0.12, partId: 'flow.coolantCircuit' },
    coolSegs, tex, world);

  // ================= 冷却液：小循环（旁通）=================
  systems.bypass = new FlowSystem(
    {
      key: 'bypass', color: 0x7fe0ff, size: 7, count: 180, tubeR: 4.5, opacity: 0.1,
      partId: 'flow.coolantBypass',
    },
    [{
      pts: [[-330, 424, -20], [-372, 340, -40], [-396, 250, -30], [-404, 196, -14]], weight: 1, speed: 1.0,
      gate: (st) => 1.05 - st.op.thermostatOpen,
    }], tex, world);

  // ================= 进气 =================
  const airSegs = [
    { pts: [[-200, 470, -270], [80, 500, -250], [300, 470, -60], [352, 420, 160], [340, 372, 262]], weight: 1.2, speed: 1.1 },
    { pts: [[330, 330, 300], [200, 400, 300], [-120, 400, 280], [-420, 360, 250], [-556, 340, 200]], weight: 1.4, speed: 1.3 },
    { pts: [[-560, 330, 180], [-560, 330, -180]], weight: 0.9, speed: 1.0 },
    { pts: [[-560, 330, -196], [-460, 360, -210], [-330, 382, -180], [-260, 384, -152]], weight: 1.0, speed: 1.1 },
    { pts: [[-260, 384, -152], [260, 384, -152]], weight: 1.0, speed: 1.0 },
  ];
  CYL_X.forEach((x, i) => {
    airSegs.push({
      pts: [[x, 384, -150], [x - 23, 378, -126], [x - 23, 372, -84], [x - 23, 352, -30], [x - 23, 336, -10], [x - 23, 300, -6]],
      weight: 0.8, speed: 1.3,
      gate: (st) => 0.08 + 2.0 * (st.cyl[i].intakeLift / P.valvetrain.valveLift),
    });
  });
  systems.intake = new FlowSystem(
    { key: 'intake', color: 0x7fe8ff, size: 7, count: 800, tubeR: 6, opacity: 0.09, partId: 'flow.intakeAir' },
    airSegs, tex, world);

  // ================= 排气 =================
  const exSegs = [];
  CYL_X.forEach((x, i) => {
    exSegs.push({
      pts: [[x + 23, 300, -6], [x + 23, 336, -10], [x + 23, 352, 30], [x + 23, 372, 84], [x + 23, 378, 126], [x, 382, 150]],
      weight: 0.8, speed: 1.4,
      gate: (st) => 0.06 + 2.2 * (st.cyl[i].exhaustLift / P.valvetrain.valveLift),
    });
  });
  exSegs.push({ pts: [[-200, 382, 152], [0, 372, 156], [200, 350, 158], [300, 330, 180], [330, 318, 212]], weight: 1.4, speed: 1.5 });
  exSegs.push({ pts: [[330, 292, 250], [360, 300, 300], [420, 340, 330], [470, 420, 340]], weight: 1.2, speed: 1.6 });
  systems.exhaust = new FlowSystem(
    { key: 'exhaust', color: 0xff7a3c, size: 8.5, count: 700, tubeR: 6.5, opacity: 0.09, partId: 'flow.exhaustGas' },
    exSegs, tex, world);

  for (const k in systems) FG.add(systems[k].group);

  // ---- 流线注册（可悬浮查看回路信息）----
  const regTube = (sys, id, state) => {
    for (const m of sys.tubes.children) { m.userData.partId = id; world.pickables.push(m); }
    if (sys.arrows) sys.arrows.userData.partId = id;
    world.reg(sys.tubes, id, { state, pick: false });
  };
  regTube(systems.oil, 'flow.oilCircuit', (st) =>
    `主油道压力 ${(st.op.oilPressure * 10).toFixed(1)} bar · 循环流量 ≈${(st.rpm * 0.019).toFixed(0)} L/min · 油温 ${st.op.oilTemp.toFixed(0)}℃`);
  regTube(systems.oilReturn, 'flow.oilReturn', (st) =>
    `回油（自流）· 缸盖与齿轮室经回油孔流回油底壳 · 油温 ${st.op.oilTemp.toFixed(0)}℃`);
  regTube(systems.coolant, 'flow.coolantCircuit', (st) =>
    `大循环（经散热器）· 节温器开度 ${(st.op.thermostatOpen * 100).toFixed(0)}% · 流量 ≈${(st.rpm * 0.075 * (0.2 + 0.8 * st.op.thermostatOpen)).toFixed(0)} L/min · 水温 ${st.op.coolantTemp.toFixed(0)}℃`);
  regTube(systems.bypass, 'flow.coolantBypass', (st) =>
    `小循环（旁通，不经散热器）· 占比 ${((1 - st.op.thermostatOpen) * 100).toFixed(0)}% · 用于冷机快速暖机`);
  regTube(systems.intake, 'flow.intakeAir', (st) =>
    `进气：空滤→压气机→中冷器→进气歧管 · 增压 ${(st.op.boost * 1000).toFixed(0)} kPa · 进气量 ≈${(st.rpm * 4.4 * 0.5 * (1 + st.op.boost / 0.1) / 1000).toFixed(1)} m³/min`);
  regTube(systems.exhaust, 'flow.exhaustGas', (st) =>
    `排气：气门→排气歧管→涡轮→消声器 · 排温 ${st.op.egt.toFixed(0)}℃ · 涡轮 ${(st.op.turboRpm / 1000).toFixed(0)}k r/min`);

  // ---- 每帧更新 ----
  world.addUpdater((st) => {
    const nr = st.rpm / P.meta.ratedSpeed;
    const oilF = 0.25 + 1.15 * nr;
    const coolF = 0.2 + 1.2 * nr;
    const airF = (0.25 + 1.0 * nr) * (0.6 + 0.7 * st.load);
    systems.oil.update(st, oilF);
    systems.oilReturn.update(st, oilF * 0.8);
    systems.coolant.update(st, coolF);
    systems.bypass.update(st, coolF);
    systems.intake.update(st, airF);
    systems.exhaust.update(st, airF * 1.15);
    // 冷却液颜色随水温（蓝→红）
    const t = U.clamp((st.op.coolantTemp - 40) / 65, 0, 1);
    systems.coolant.mat.color.setRGB(0.2 + 0.8 * t, 0.71 - 0.45 * t, 1.0 - 0.75 * t);
    systems.coolant.tubeMat.color.copy(systems.coolant.mat.color);
    systems.coolant.arrowMat.color.copy(systems.coolant.mat.color);
    // 排气颜色随排温
    const e = U.clamp((st.op.egt - 200) / 600, 0, 1);
    systems.exhaust.mat.color.setRGB(0.55 + 0.45 * e, 0.35 + 0.12 * e, 0.3 - 0.18 * e);
    systems.exhaust.arrowMat.color.copy(systems.exhaust.mat.color);
  });

  return {
    systems,
    setVisible(key, v) { if (systems[key]) systems[key].group.visible = v; },
    setTubesVisible(v) { for (const k in systems) systems[k].tubes.visible = v; },
    setParticlesVisible(v) { for (const k in systems) systems[k].points.visible = v; },
  };
}
