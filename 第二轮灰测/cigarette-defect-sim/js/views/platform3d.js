/**
 * platform3d.js —— 可拆解三维平台模型（论文 2.1 图2-1 / 图2-10）
 * ---------------------------------------------------------------------------
 * 几何布局严格按 2.1.1：从右到左 = 料斗鼓轮 → 接驳轮1 → 接驳轮2 → 剔除轮，
 * 中间两个接驳轮为相机检测轮；上下各一组相机、每组两台呈 90 度夹角；
 * 各筒轮内部负压吸附；底部滚轮 + 伸缩座支持可移动部署。
 *
 * 主坐标：MCP 槽位（见 sim/engine.js STATIONS）。1 单位 = 10 mm。
 * 相邻鼓轮啮合反向旋转：料斗轮 CCW / 接驳轮1 CW / 接驳轮2 CCW / 剔除轮 CW
 *   → 接驳轮1 中段在底部（下组相机），接驳轮2 中段在顶部（上组相机），
 *     恰好覆盖烟支两个侧面，与"避免侧边信息遗漏"一致。
 * ---------------------------------------------------------------------------
 */
import * as THREE from '../../vendor/three.module.js';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from '../../vendor/CSS2DRenderer.js';
import { HARDWARE, DEFECT_CLASSES, CIGARETTE_GEOM } from '../data/thesis-data.js';
import { STATIONS } from '../sim/engine.js';
import { clamp } from '../core/store.js';

var R = 6.0;              // 鼓轮半径（60 mm）
var DRUM_W = 9.0;         // 鼓轮宽度（沿 Z，容纳 84 mm 烟支）
var CENTERS = {
  hopper: new THREE.Vector3(21, 0, 0),
  t1: new THREE.Vector3(7, 0, 0),
  t2: new THREE.Vector3(-7, 0, 0),
  rej: new THREE.Vector3(-21, 0, 0),
};
var DIRS = { hopper: 1, t1: -1, t2: 1, rej: -1 };   // +1 = CCW
var SEGS = [
  { key: 'hopper', from: 0,  to: 12 },
  { key: 't1',     from: 12, to: 24 },
  { key: 't2',     from: 24, to: 36 },
  { key: 'rej',    from: 36, to: 48 },
];

/* ---- 零件元数据：BOM 树 / 点选信息面板 / 分区隔离 ---- */
export var PART_META = {
  frame:      { name: '可移动机架', zone: '输送机构', model: '铝型材焊接框架', fn: '承载全部鼓轮、相机与控制箱，形成刚性检测本体', src: '2.1.1' },
  casters:    { name: '滚轮 + 伸缩座', zone: '输送机构', model: '重载脚轮 x4 + 调平伸缩座 x4', fn: '支持在不同车间、不同机台间移动部署与就位调平', src: '1.2.3 / 2.1.1' },
  hopper:     { name: '料斗鼓轮', zone: '输送机构', model: '负压吸附鼓轮 · 24 槽', fn: '烟支入料与单元化，负压吸附固定烟支姿态', src: '2.1.1 图2-1' },
  t1:         { name: '接驳轮1（检测轮·下组）', zone: '输送机构', model: '负压吸附接驳轮 · 24 槽', fn: '中段位于底部，由下组两台相机以 90 度夹角拍摄烟支一个侧面', src: '2.1.1 图2-1' },
  t2:         { name: '接驳轮2（检测轮·上组）', zone: '输送机构', model: '负压吸附接驳轮 · 24 槽', fn: '中段位于顶部，由上组两台相机拍摄烟支另一侧面，避免侧边信息遗漏', src: '2.1.1 图2-1' },
  rej:        { name: '剔除轮', zone: '输送机构', model: '负压吸附剔除轮 · 24 槽', fn: '承载烟支通过剔除工位，缺陷烟支在此被气流吹离输送路径', src: '2.1.1 图2-1' },
  vacuum:     { name: '负压管路', zone: '输送机构', model: '真空泵 + 分配歧管', fn: '各筒轮内部通过负压吸附烟支，保证高速运动中姿态稳定', src: '2.1.1' },
  hopperBin:  { name: '上料料斗', zone: '输送机构', model: '倾斜料仓', fn: '批量烟支盘装上料，配合鼓轮完成单元化', src: '1.2.3 [24] 工艺路线' },
  cam0:       { name: 'CAM1 面阵相机（下组 A）', zone: '检测区域', model: '汇川 VC21-0045C-450-X', fn: '接驳轮1 底部 -45 度视角，720x540 全局快门，450 fps', src: '表2-1 / 2.1.1' },
  cam1:       { name: 'CAM2 面阵相机（下组 B）', zone: '检测区域', model: '汇川 VC21-0045C-450-X', fn: '与 CAM1 呈 90 度夹角，同时拍摄同一侧面', src: '表2-1 / 2.1.1' },
  cam2:       { name: 'CAM3 面阵相机（上组 A）', zone: '检测区域', model: '汇川 VC21-0045C-450-X', fn: '接驳轮2 顶部 +45 度视角，覆盖烟支另一侧面', src: '表2-1 / 2.1.1' },
  cam3:       { name: 'CAM4 面阵相机（上组 B）', zone: '检测区域', model: '汇川 VC21-0045C-450-X', fn: '与 CAM3 呈 90 度夹角，同时拍摄同一侧面', src: '表2-1 / 2.1.1' },
  light0:     { name: '条形光源（下）', zone: '检测区域', model: '汇川 IL-LI23728G', fn: '绿色光 12 W，发光面 225x22 mm，沿烟支轴向均匀照明', src: '表2-1 / 图2-6' },
  light1:     { name: '条形光源（上）', zone: '检测区域', model: '汇川 IL-LI23728G', fn: '与上组相机配合，曝光期间保持稳定亮度', src: '表2-1 / 图2-6' },
  syncgear:   { name: '同步齿轮', zone: '检测区域', model: '与输送机构机械同步', fn: '齿槽变化经光电传感器转为脉冲，反映烟支相对位置', src: '表2-1 / 图2-7' },
  photo:      { name: '光电传感器', zone: '检测区域', model: '槽型光电开关', fn: '检测齿槽产生 DCP/MCP 脉冲，送同步处理板与 PLC', src: '表2-1 / 图2-7' },
  cabinet:    { name: '控制箱体', zone: '控制区域', model: '钣金电控箱', fn: '容纳视觉工作站、交换机、同步处理板与 PLC，并做屏蔽与散热', src: '2.1.1' },
  hmi:        { name: '工业触摸屏', zone: '控制区域', model: '汇川 IT7150E', fn: '15 英寸 1024x600，显示检测界面、调参、查看结果与导出数据', src: '表2-1 / 图2-2' },
  workstation:{ name: '视觉工作站', zone: '控制区域', model: 'GPU + CPU 工作站', fn: '运行 YOLOv11 推理、结果统计与数据保存，系统计算核心', src: '表2-1' },
  switch:     { name: '千兆交换机', zone: '控制区域', model: '华为 S1730S-L8P1T-A', fn: '相机与工作站之间 GigE 图像数据汇聚，无风扇设计', src: '表2-1 / 图2-3' },
  syncboard:  { name: '同步处理板', zone: '控制区域', model: 'NI sbRIO-9607', fn: 'Zynq-7020：ARM 实时核 + FPGA，输出相机/光源硬件触发', src: '表2-1 / 图2-4' },
  plc:        { name: 'PLC', zone: '控制区域', model: '汇川 H5U-1614MTD-A8', fn: '接收 Modbus TCP 结果、DCP/MCP 槽位跟踪、输出剔除数字量', src: '表2-1 / 图2-8' },
  valve:      { name: '高速电磁阀', zone: '执行区域', model: 'MAC 52A-11-D08-DM-DDFA-1BA', fn: '双线圈脉冲控制，断电保位，驱动压缩空气完成剔除', src: '表2-1 / 图2-9' },
  airprep:    { name: '气路组件', zone: '执行区域', model: '过滤减压阀 + 压力表 + 气管', fn: '为剔除喷嘴提供稳定压缩空气，气压影响剔除力度', src: '2.1.1 执行区域' },
  nozzle:     { name: '剔除喷嘴', zone: '执行区域', model: '定向气吹喷嘴', fn: '位于剔除轮下游侧，将缺陷烟支吹离正常输送路径', src: '2.1.1 执行区域' },
  wastebin:   { name: '缺陷品收集盒', zone: '执行区域', model: '留样盒', fn: '收集被剔除的缺陷烟支，供缺陷成因追溯分析', src: '1.2.3 [24] / 2.2.3(7)' },
  goodtray:   { name: '合格品收集盘', zone: '执行区域', model: '烟盘', fn: '无缺陷烟支经收集装置有序回盘', src: '1.2.3 [24]' },
  cables:     { name: '信号与电气线缆', zone: '控制区域', model: '同步/触发/GigE/Modbus TCP/DO', fn: '按图2-10 电气原理连接各单元，运行时可见信号流动', src: '图2-10' },
};

/* ---- 线缆定义（图2-10 电气原理） ---- */
var CABLE_DEFS = [
  { key: 'photo2sync', label: '同步脉冲', color: 0xffc14d, evt: 'sync',
    pts: [[24.5, -3.2, 3.4], [22, -6.2, 5.5], [6, -8.4, 9.6], [-4, -6.4, 11.6]] },
  { key: 'photo2plc', label: 'DCP/MCP', color: 0xffa03d, evt: 'sync',
    pts: [[24.5, -3.4, 3.0], [20, -7.4, 6.0], [2, -9.0, 10.4], [-9.4, -7.4, 11.4]] },
  { key: 'sync2cam', label: '相机触发', color: 0x63f5c8, evt: 'trigger',
    pts: [[-4, -5.2, 11.4], [0, -7.4, 8.0], [6.4, -8.6, 2.4], [7.6, -8.0, 0]] },
  { key: 'sync2light', label: '光源触发', color: 0x8bff9c, evt: 'trigger',
    pts: [[-4.4, -5.0, 11.2], [-2, -6.0, 7.0], [-6.6, -8.2, 2.0], [-7.2, 7.6, 0]] },
  { key: 'cam2switch', label: 'GigE', color: 0xffe066, evt: 'gige',
    pts: [[7.6, -8.4, 0.6], [4, -7.0, 6.0], [-2, -3.2, 11.0], [-5.6, -1.4, 11.4]] },
  { key: 'switch2ws', label: 'GigE', color: 0xffe066, evt: 'gige',
    pts: [[-5.6, -1.6, 11.4], [-8.0, -0.4, 11.6], [-10.4, 1.2, 11.4]] },
  { key: 'ws2plc', label: 'Modbus TCP', color: 0x4db8ff, evt: 'modbus',
    pts: [[-10.6, 0.6, 11.4], [-10.2, -3.4, 11.6], [-9.6, -6.6, 11.4]] },
  { key: 'plc2valve', label: 'DO 剔除', color: 0xff5b6e, evt: 'do',
    pts: [[-9.8, -7.2, 10.6], [-14, -8.6, 7.0], [-20, -9.2, 2.4], [-23.0, -8.4, 0.6]] },
];

function mat(color, opts) {
  var o = opts || {};
  return new THREE.MeshStandardMaterial({
    color: color,
    metalness: o.metalness === undefined ? 0.55 : o.metalness,
    roughness: o.roughness === undefined ? 0.45 : o.roughness,
    emissive: o.emissive === undefined ? 0x000000 : o.emissive,
    emissiveIntensity: o.emissiveIntensity === undefined ? 1 : o.emissiveIntensity,
    transparent: !!o.transparent,
    opacity: o.opacity === undefined ? 1 : o.opacity,
    side: o.side || THREE.FrontSide,
  });
}
function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); }
function cyl(rt, rb, h, m, seg) { return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 24), m); }

/* 槽位 → 世界坐标（与 engine 的 slotPos 完全一致） */
export function slotToPos(slotPos) {
  for (var i = 0; i < SEGS.length; i++) {
    var s = SEGS[i];
    if (slotPos < s.to || i === SEGS.length - 1) {
      var u = clamp((slotPos - s.from) / (s.to - s.from), -0.4, 1.6);
      var c = CENTERS[s.key];
      var th = DIRS[s.key] * u * Math.PI;
      var rr = R + 0.45;
      if (slotPos > 48) {
        // 出料滑道
        var over = slotPos - 48;
        return new THREE.Vector3(c.x - rr - over * 1.1, c.y - over * 0.9, 0);
      }
      return new THREE.Vector3(c.x + rr * Math.cos(th), c.y + rr * Math.sin(th), 0);
    }
  }
  return new THREE.Vector3(0, 0, 0);
}
export function drumAngle(key, slotBase) {
  return DIRS[key] * (slotBase % 24) / 24 * Math.PI * 2;
}

export function createPlatform3D(container, store, engine) {
  /* ---------------- 渲染器 / 场景 / 相机 ---------------- */
  var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  var labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.className = 'label-layer';
  container.appendChild(labelRenderer.domElement);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1017);
  scene.fog = new THREE.Fog(0x0d1017, 120, 260);

  var camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.5, 600);
  camera.position.set(46, 34, 62);

  var controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, -1, 0);
  controls.maxPolarAngle = Math.PI * 0.92;

  scene.add(new THREE.HemisphereLight(0x93b4d8, 0x1a1d26, 0.85));
  var key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(34, 46, 40);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -60; key.shadow.camera.right = 60;
  key.shadow.camera.top = 60; key.shadow.camera.bottom = -60;
  key.shadow.camera.far = 200;
  scene.add(key);
  var fill = new THREE.DirectionalLight(0x88b0ff, 0.5);
  fill.position.set(-40, 18, -30);
  scene.add(fill);

  var grid = new THREE.GridHelper(220, 44, 0x243040, 0x161c26);
  grid.position.y = -22.5;
  scene.add(grid);
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat(0x11151d, { metalness: 0.1, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -22.55;
  floor.receiveShadow = true;
  scene.add(floor);

  /* ---------------- 零件容器 ---------------- */
  var root = new THREE.Group();
  scene.add(root);
  var parts = {};            // key -> { group, dir, dist, meshes[] }
  var labels = [];

  function addPart(key, group, dir, dist) {
    group.userData.partKey = key;
    group.traverse(function (o) {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.partKey = key; }
    });
    var home = group.position.clone();
    parts[key] = { key: key, group: group, dir: dir.clone().normalize(), dist: dist, home: home };
    root.add(group);
    var meta = PART_META[key];
    if (meta) {
      var d = document.createElement('div');
      d.className = 'p3d-label';
      d.textContent = meta.name;
      var lb = new CSS2DObject(d);
      lb.position.set(0, 0, 0);
      group.add(lb);
      labels.push({ obj: lb, el: d, key: key });
    }
    return group;
  }

  /* ---------------- 机架 + 底盘 ---------------- */
  var frame = new THREE.Group();
  var alu = mat(0x5b6474, { metalness: 0.7, roughness: 0.4 });
  var beam;
  var xs = [-30, 30], zs = [-6.4, 6.4];
  for (var a = 0; a < 2; a++) for (var b = 0; b < 2; b++) {
    beam = box(1.6, 15, 1.6, alu);
    beam.position.set(xs[a], -14.4, zs[b]);
    frame.add(beam);
  }
  for (var yy = 0; yy < 2; yy++) {
    var y = yy === 0 ? -7.2 : -21.4;
    for (b = 0; b < 2; b++) {
      beam = box(62, 1.5, 1.5, alu);
      beam.position.set(0, y, zs[b]);
      frame.add(beam);
    }
    for (a = 0; a < 2; a++) {
      beam = box(1.5, 1.5, 14.3, alu);
      beam.position.set(xs[a], y, 0);
      frame.add(beam);
    }
  }
  var deck = box(62, 0.8, 14.3, mat(0x39404e, { metalness: 0.6, roughness: 0.5 }));
  deck.position.set(0, -7.9, 0);
  frame.add(deck);
  var panel = box(62, 12, 0.4, mat(0x2b313c, { metalness: 0.4, roughness: 0.7 }));
  panel.position.set(0, -14.4, -6.4);
  frame.add(panel);
  addPart('frame', frame, new THREE.Vector3(0, -1, 0), 6);

  var casters = new THREE.Group();
  var rub = mat(0x15181f, { metalness: 0.2, roughness: 0.9 });
  var steel = mat(0x9aa3b4, { metalness: 0.85, roughness: 0.3 });
  for (a = 0; a < 2; a++) for (b = 0; b < 2; b++) {
    var cg = new THREE.Group();
    var fork = box(1.4, 1.8, 2.4, steel);
    fork.position.y = -0.4;
    cg.add(fork);
    var wheel = cyl(1.5, 1.5, 1.0, rub, 20);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.y = -2.1;
    cg.add(wheel);
    cg.position.set(xs[a] * 0.94, -22.0 + 1.2, zs[b] * 0.86);
    casters.add(cg);
    // 伸缩座（调平脚）
    var foot = new THREE.Group();
    var rod = cyl(0.42, 0.42, 3.0, steel, 12);
    rod.position.y = -1.2;
    foot.add(rod);
    var pad = cyl(1.25, 1.4, 0.7, mat(0x2a3140, { metalness: 0.5, roughness: 0.6 }), 18);
    pad.position.y = -2.9;
    foot.add(pad);
    foot.position.set(xs[a] * 0.72, -20.6, zs[b] * 0.86);
    casters.add(foot);
  }
  addPart('casters', casters, new THREE.Vector3(0, -1, 0), 12);

  /* ---------------- 鼓轮 ---------------- */
  var drumBody = mat(0x59616f, { metalness: 0.82, roughness: 0.32 });
  var drumFace = mat(0x3d4552, { metalness: 0.7, roughness: 0.45 });
  var pocketMat = mat(0x22272f, { metalness: 0.35, roughness: 0.8 });
  var drumGroups = {};

  function buildDrum(key, slots) {
    var g = new THREE.Group();
    var spin = new THREE.Group();          // 旋转部分
    g.add(spin);
    var core = cyl(R, R, DRUM_W, drumBody, 48);
    core.rotation.x = Math.PI / 2;
    spin.add(core);
    var f1 = cyl(R + 0.55, R + 0.55, 0.5, drumFace, 48);
    f1.rotation.x = Math.PI / 2; f1.position.z = DRUM_W / 2 + 0.2; spin.add(f1);
    var f2 = f1.clone(); f2.position.z = -DRUM_W / 2 - 0.2; spin.add(f2);
    // 负压吸附槽
    for (var i = 0; i < slots; i++) {
      var th = i / slots * Math.PI * 2;
      var pk = box(1.05, 0.75, DRUM_W * 0.92, pocketMat);
      pk.position.set((R + 0.1) * Math.cos(th), (R + 0.1) * Math.sin(th), 0);
      pk.rotation.z = th;
      spin.add(pk);
      var hole = cyl(0.2, 0.2, 1.2, mat(0x0b0e13, { metalness: 0.2, roughness: 0.9 }), 8);
      hole.rotation.z = Math.PI / 2 + th;
      hole.position.set((R - 0.4) * Math.cos(th), (R - 0.4) * Math.sin(th), 0);
      spin.add(hole);
    }
    var shaft = cyl(0.9, 0.9, DRUM_W + 6, steel, 18);
    shaft.rotation.x = Math.PI / 2;
    g.add(shaft);
    var srv = box(3.2, 3.2, 3.6, mat(0x2c313b, { metalness: 0.5, roughness: 0.6 }));
    srv.position.z = -DRUM_W / 2 - 4.2;
    g.add(srv);
    g.position.copy(CENTERS[key]);
    drumGroups[key] = spin;
    return g;
  }
  var slotsPerDrum = 24;
  addPart('hopper', buildDrum('hopper', slotsPerDrum), new THREE.Vector3(1, 0.35, 0), 12);
  addPart('t1', buildDrum('t1', slotsPerDrum), new THREE.Vector3(0.25, -1, 0), 12);
  addPart('t2', buildDrum('t2', slotsPerDrum), new THREE.Vector3(-0.25, 1, 0), 12);
  addPart('rej', buildDrum('rej', slotsPerDrum), new THREE.Vector3(-1, 0.35, 0), 12);

  /* 上料料斗 */
  var bin = new THREE.Group();
  var binMat = mat(0x8f98a8, { metalness: 0.6, roughness: 0.45, transparent: true, opacity: 0.55 });
  var wall1 = box(9, 8, 0.3, binMat); wall1.position.set(0, 0, 4.6); bin.add(wall1);
  var wall2 = wall1.clone(); wall2.position.z = -4.6; bin.add(wall2);
  var wall3 = box(0.3, 8, 9.2, binMat); wall3.position.set(4.4, 0, 0); bin.add(wall3);
  var wall4 = wall3.clone(); wall4.position.x = -4.4; bin.add(wall4);
  bin.position.set(26.5, 8.5, 0);
  bin.rotation.z = -0.22;
  addPart('hopperBin', bin, new THREE.Vector3(1, 1, 0), 12);

  /* 负压管路 */
  var vac = new THREE.Group();
  var vacMat = mat(0x2f6f8f, { metalness: 0.5, roughness: 0.5 });
  var manifold = cyl(1.0, 1.0, 56, vacMat, 16);
  manifold.rotation.z = Math.PI / 2;
  manifold.position.set(0, -5.2, -5.6);
  vac.add(manifold);
  var dk = ['hopper', 't1', 't2', 'rej'];
  for (var i2 = 0; i2 < dk.length; i2++) {
    var br = cyl(0.42, 0.42, 6.4, vacMat, 12);
    br.position.set(CENTERS[dk[i2]].x, -3.4, -5.6);
    br.rotation.x = Math.PI / 2 * 0;
    vac.add(br);
  }
  var pump = box(5.4, 4.2, 4.2, mat(0x36404e, { metalness: 0.6, roughness: 0.5 }));
  pump.position.set(28.5, -5.0, -5.6);
  vac.add(pump);
  addPart('vacuum', vac, new THREE.Vector3(0, -0.3, -1), 12);

  /* ---------------- 相机 + 光源 ---------------- */
  var camBody = mat(0x24272e, { metalness: 0.6, roughness: 0.42 });
  var lensMat = mat(0x14161b, { metalness: 0.4, roughness: 0.3 });
  var glassMat = mat(0x63b7ff, { metalness: 0.1, roughness: 0.1, emissive: 0x0d2a44 });
  var camMeshes = [];

  function buildCamera(idx, center, angleDeg, dist) {
    var g = new THREE.Group();
    var body = box(3.0, 3.0, 3.6, camBody);
    g.add(body);
    var lens = cyl(1.05, 1.15, 2.6, lensMat, 20);
    lens.rotation.x = Math.PI / 2;
    lens.position.z = 3.0;
    g.add(lens);
    var glass = cyl(0.92, 0.92, 0.16, glassMat, 20);
    glass.rotation.x = Math.PI / 2;
    glass.position.z = 4.32;
    g.add(glass);
    var conn = box(1.2, 0.8, 0.5, mat(0xd8c76a, { metalness: 0.8, roughness: 0.3 }));
    conn.position.set(0, -1.0, -1.9);
    g.add(conn);
    // 指向鼓轮中心：先摆到极角位置，再朝向圆心
    var th = angleDeg * Math.PI / 180;
    var px = center.x + Math.cos(th) * dist;
    var py = center.y + Math.sin(th) * dist;
    g.position.set(px, py, 0);
    g.lookAt(center.x, center.y, 0);
    var flash = new THREE.PointLight(0xbfe8ff, 0, 16);
    flash.position.set(0, 0, 4.6);
    g.add(flash);
    g.userData.flash = flash;
    camMeshes.push(g);
    return g;
  }
  // 下组：接驳轮1 底部，两台相隔 90 度（-135 / -45）
  addPart('cam0', buildCamera(0, CENTERS.t1, -135, 12.5), new THREE.Vector3(0.6, -1, 0), 10);
  addPart('cam1', buildCamera(1, CENTERS.t1, -45, 12.5), new THREE.Vector3(-0.6, -1, 0), 10);
  // 上组：接驳轮2 顶部（135 / 45）
  addPart('cam2', buildCamera(2, CENTERS.t2, 135, 12.5), new THREE.Vector3(0.6, 1, 0), 10);
  addPart('cam3', buildCamera(3, CENTERS.t2, 45, 12.5), new THREE.Vector3(-0.6, 1, 0), 10);

  var lightGlows = [];
  function buildBar(center, angleDeg, dist) {
    var g = new THREE.Group();
    var shell = box(2.8, 2.7, 23.7, mat(0x8d95a4, { metalness: 0.75, roughness: 0.35 }));
    g.add(shell);
    var emit = box(2.2, 0.35, 22.5, new THREE.MeshStandardMaterial({
      color: 0x9dff9d, emissive: 0x35d94f, emissiveIntensity: 1.6, roughness: 0.5, metalness: 0.1,
    }));
    emit.position.y = -1.45;
    g.add(emit);
    var pl = new THREE.PointLight(0x66ff88, 0.7, 24);
    pl.position.y = -2.4;
    g.add(pl);
    lightGlows.push({ emit: emit, light: pl });
    var th = angleDeg * Math.PI / 180;
    g.position.set(center.x + Math.cos(th) * dist, center.y + Math.sin(th) * dist, 0);
    g.rotation.z = th + Math.PI / 2;
    return g;
  }
  addPart('light0', buildBar(CENTERS.t1, -90, 9.4), new THREE.Vector3(0, -1, 0.3), 9);
  addPart('light1', buildBar(CENTERS.t2, 90, 9.4), new THREE.Vector3(0, 1, 0.3), 9);

  /* ---------------- 同步传感器 ---------------- */
  var gearGroup = new THREE.Group();
  var gearSpin = new THREE.Group();
  var gearMat = mat(0xb9a24a, { metalness: 0.85, roughness: 0.28 });
  var hub = cyl(3.0, 3.0, 1.0, gearMat, 32);
  hub.rotation.x = Math.PI / 2;
  gearSpin.add(hub);
  for (i2 = 0; i2 < 24; i2++) {
    var t = i2 / 24 * Math.PI * 2;
    var tooth = box(0.62, 1.05, 1.0, gearMat);
    tooth.position.set(3.35 * Math.cos(t), 3.35 * Math.sin(t), 0);
    tooth.rotation.z = t;
    gearSpin.add(tooth);
  }
  gearGroup.add(gearSpin);
  gearGroup.position.set(CENTERS.hopper.x + 3.5, -3.0, 5.6);
  addPart('syncgear', gearGroup, new THREE.Vector3(1, -0.3, 1), 10);

  var photoG = new THREE.Group();
  var pb = box(1.3, 3.4, 1.2, mat(0x2a5fa8, { metalness: 0.5, roughness: 0.5 }));
  photoG.add(pb);
  var pf1 = box(1.3, 1.0, 1.2, mat(0x2a5fa8, { metalness: 0.5, roughness: 0.5 }));
  pf1.position.set(1.5, 1.2, 0); photoG.add(pf1);
  var pf2 = pf1.clone(); pf2.position.y = -1.2; photoG.add(pf2);
  var led = cyl(0.22, 0.22, 0.3, new THREE.MeshStandardMaterial({ color: 0xff5555, emissive: 0xff2222, emissiveIntensity: 2 }), 10);
  led.rotation.z = Math.PI / 2;
  led.position.set(1.9, 0, 0);
  photoG.add(led);
  photoG.userData.led = led;
  photoG.position.set(CENTERS.hopper.x + 3.5, -6.9, 5.6);
  addPart('photo', photoG, new THREE.Vector3(0.6, -1, 0.6), 9);

  /* ---------------- 控制箱 ---------------- */
  var cab = new THREE.Group();
  var cabMat = mat(0xc9d0dc, { metalness: 0.45, roughness: 0.55 });
  var shell2 = box(26, 17, 11, cabMat);
  cab.add(shell2);
  var glassDoor = box(23, 14, 0.3, mat(0x2a3140, { metalness: 0.3, roughness: 0.25, transparent: true, opacity: 0.28 }));
  glassDoor.position.z = 5.6;
  cab.add(glassDoor);
  var vent = box(20, 0.35, 0.2, mat(0x8b93a2, { metalness: 0.6, roughness: 0.5 }));
  for (i2 = 0; i2 < 5; i2++) { var v = vent.clone(); v.position.set(0, -7.0 + i2 * 0.7, 5.62); cab.add(v); }
  cab.position.set(-9, -1.5, 12.5);
  addPart('cabinet', cab, new THREE.Vector3(0, 0.2, 1), 16);

  /* 工业触摸屏 IT7150E：15" 1024x600 → 33 x 19.3 单位 */
  var hmiG = new THREE.Group();
  var bezel = box(34, 21, 1.4, mat(0x1c2029, { metalness: 0.5, roughness: 0.5 }));
  hmiG.add(bezel);
  var screenMat = new THREE.MeshStandardMaterial({ color: 0x0f1b2b, emissive: 0x1a4f7a, emissiveIntensity: 0.85, roughness: 0.35, metalness: 0.1 });
  var screen = box(31.4, 18.4, 0.2, screenMat);
  screen.position.z = 0.82;
  hmiG.add(screen);
  var armM = mat(0x3a4150, { metalness: 0.7, roughness: 0.4 });
  var arm = cyl(0.6, 0.6, 9, armM, 12);
  arm.position.set(0, -14, -1.2);
  hmiG.add(arm);
  hmiG.position.set(-9, 17.5, 12.0);
  hmiG.rotation.x = -0.16;
  hmiG.userData.screenMat = screenMat;
  addPart('hmi', hmiG, new THREE.Vector3(0, 1, 0.3), 14);

  function buildModule(w, h, d, color, ledColor, n) {
    var g = new THREE.Group();
    var body = box(w, h, d, mat(color, { metalness: 0.55, roughness: 0.5 }));
    g.add(body);
    var lm = new THREE.MeshStandardMaterial({ color: ledColor, emissive: ledColor, emissiveIntensity: 2.2 });
    var leds = [];
    for (var i = 0; i < (n || 4); i++) {
      var L = box(0.42, 0.42, 0.1, lm);
      L.position.set(-w / 2 + 1.0 + i * 0.75, h / 2 - 0.9, d / 2 + 0.06);
      g.add(L);
      leds.push(L);
    }
    g.userData.leds = leds;
    g.userData.ledMat = lm;
    return g;
  }
  var ws = buildModule(20, 5.4, 9, 0x2f3644, 0x59ff8f, 5);
  ws.position.set(-9, 3.6, 12.4);
  addPart('workstation', ws, new THREE.Vector3(-0.2, 0.6, 1), 15);

  var sw = buildModule(17, 2.2, 8, 0x3d4553, 0xffd24d, 8);
  sw.position.set(-9, -0.4, 12.4);
  addPart('switch', sw, new THREE.Vector3(-0.6, 0.1, 1), 15);

  var sb = buildModule(11, 2.0, 7.4, 0x1f3a2c, 0x7dffb0, 4);
  sb.position.set(-3.8, -4.0, 12.4);
  addPart('syncboard', sb, new THREE.Vector3(0.7, -0.2, 1), 15);

  var plcG = buildModule(9.4, 4.6, 7.4, 0x263346, 0x66c8ff, 6);
  plcG.position.set(-13.4, -5.4, 12.4);
  addPart('plc', plcG, new THREE.Vector3(-0.8, -0.4, 1), 15);

  /* ---------------- 执行区域 ---------------- */
  var valveG = new THREE.Group();
  var vbody = box(3.0, 6.4, 3.0, mat(0xb2b8c4, { metalness: 0.8, roughness: 0.3 }));
  valveG.add(vbody);
  var coilMat = mat(0x2a2f38, { metalness: 0.4, roughness: 0.65 });
  var coil1 = cyl(1.25, 1.25, 2.4, coilMat, 18);
  coil1.position.y = 4.2; valveG.add(coil1);
  var coil2 = coil1.clone(); coil2.position.y = -4.2; valveG.add(coil2);
  var vLed = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10),
    new THREE.MeshStandardMaterial({ color: 0xff4455, emissive: 0xff2233, emissiveIntensity: 0.2 }));
  vLed.position.set(1.8, 0, 1.7);
  valveG.add(vLed);
  valveG.userData.led = vLed;
  valveG.position.set(-27.5, -9.5, 3.4);
  addPart('valve', valveG, new THREE.Vector3(-1, -0.3, 0.4), 12);

  var air = new THREE.Group();
  var filt = cyl(1.5, 1.5, 4.2, mat(0x9aa3b4, { metalness: 0.7, roughness: 0.4 }), 20);
  filt.position.set(-31.5, -12.6, 3.4);
  air.add(filt);
  var bowl = cyl(1.3, 1.3, 2.4, mat(0x6ec8ff, { metalness: 0.2, roughness: 0.15, transparent: true, opacity: 0.5 }), 20);
  bowl.position.set(-31.5, -15.6, 3.4);
  air.add(bowl);
  var gauge = cyl(1.15, 1.15, 0.6, mat(0xe6e9ef, { metalness: 0.5, roughness: 0.4 }), 20);
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(-31.5, -10.0, 4.2);
  air.add(gauge);
  var tubeMat = mat(0x35c0ff, { metalness: 0.2, roughness: 0.35, transparent: true, opacity: 0.75 });
  var tcurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-31.5, -11.4, 3.4), new THREE.Vector3(-30.2, -10.0, 3.4),
    new THREE.Vector3(-28.6, -9.6, 3.4), new THREE.Vector3(-27.5, -9.5, 3.4),
  ]);
  air.add(new THREE.Mesh(new THREE.TubeGeometry(tcurve, 24, 0.34, 10, false), tubeMat));
  var tcurve2 = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-27.5, -6.0, 3.4), new THREE.Vector3(-26.6, -4.0, 2.4),
    new THREE.Vector3(-25.6, -3.4, 1.0), new THREE.Vector3(-25.1, -3.9, 0),
  ]);
  air.add(new THREE.Mesh(new THREE.TubeGeometry(tcurve2, 26, 0.3, 10, false), tubeMat));
  addPart('airprep', air, new THREE.Vector3(-1, -0.6, 0.2), 12);

  var nozG = new THREE.Group();
  var nz = cyl(0.28, 0.62, 2.4, mat(0xc9a24a, { metalness: 0.85, roughness: 0.28 }), 16);
  nozG.add(nz);
  var nzBase = box(1.5, 1.0, 1.5, mat(0x6b7382, { metalness: 0.7, roughness: 0.4 }));
  nzBase.position.y = -1.6;
  nozG.add(nzBase);
  // 喷嘴指向剔除轮 slot 45 处
  var nozTarget = slotToPos(STATIONS.NOZZLE);
  var nozPos = nozTarget.clone().sub(CENTERS.rej).normalize().multiplyScalar(R + 4.2).add(CENTERS.rej);
  nozG.position.copy(nozPos);
  var dirV = nozTarget.clone().sub(nozPos).normalize();
  nozG.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dirV);
  var jetMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0 });
  var jet = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.0, 14, 1, true), jetMat);
  jet.position.y = -2.6;
  jet.rotation.x = Math.PI;
  nozG.add(jet);
  nozG.userData.jet = jet;
  nozG.userData.jetMat = jetMat;
  addPart('nozzle', nozG, dirV.clone().negate(), 8);

  var wb = new THREE.Group();
  var wbMat = mat(0xd05a5a, { metalness: 0.3, roughness: 0.7, transparent: true, opacity: 0.55 });
  var wbw1 = box(10, 6, 0.35, wbMat); wbw1.position.set(0, 0, 5.0); wb.add(wbw1);
  var wbw2 = wbw1.clone(); wbw2.position.z = -5.0; wb.add(wbw2);
  var wbw3 = box(0.35, 6, 10, wbMat); wbw3.position.set(5, 0, 0); wb.add(wbw3);
  var wbw4 = wbw3.clone(); wbw4.position.x = -5; wb.add(wbw4);
  var wbb = box(10, 0.35, 10, wbMat); wbb.position.y = -3; wb.add(wbb);
  wb.position.set(-33.5, -4.0, 0);
  addPart('wastebin', wb, new THREE.Vector3(-1, -0.4, 0), 12);

  var gt = new THREE.Group();
  var gtMat = mat(0x6fbf7a, { metalness: 0.3, roughness: 0.7, transparent: true, opacity: 0.5 });
  var tray = box(12, 0.4, 11, gtMat); gt.add(tray);
  var lip = box(12, 2.4, 0.35, gtMat); lip.position.set(0, 1.2, 5.4); gt.add(lip);
  var lip2 = lip.clone(); lip2.position.z = -5.4; gt.add(lip2);
  var lip3 = box(0.35, 2.4, 11, gtMat); lip3.position.set(-6, 1.2, 0); gt.add(lip3);
  gt.position.set(-31.5, -17.6, 0);
  addPart('goodtray', gt, new THREE.Vector3(-1, -0.6, 0), 12);

  /* ---------------- 线缆（图2-10） ---------------- */
  var cableG = new THREE.Group();
  var cableRuns = [];
  for (i2 = 0; i2 < CABLE_DEFS.length; i2++) {
    var def = CABLE_DEFS[i2];
    var pts = [];
    for (var j = 0; j < def.pts.length; j++) pts.push(new THREE.Vector3(def.pts[j][0], def.pts[j][1], def.pts[j][2]));
    var curve = new THREE.CatmullRomCurve3(pts);
    var m = new THREE.MeshStandardMaterial({
      color: def.color, emissive: def.color, emissiveIntensity: 0.12,
      metalness: 0.2, roughness: 0.7,
    });
    var tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.16, 8, false), m);
    cableG.add(tube);
    var beadMat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0 });
    var bead = new THREE.Mesh(new THREE.SphereGeometry(0.44, 12, 10), beadMat);
    cableG.add(bead);
    cableRuns.push({ def: def, curve: curve, mat: m, bead: bead, beadMat: beadMat, pulses: [] });
  }
  addPart('cables', cableG, new THREE.Vector3(0, 0.4, 0.8), 10);

  /* ---------------- 烟支池 ---------------- */
  var CIG_POOL = 72;
  var cigMeshes = [];
  var rodMat = mat(0xf2efe6, { metalness: 0.05, roughness: 0.75 });
  var tipMat = mat(0xa9763c, { metalness: 0.08, roughness: 0.72 });
  var ngMat = new THREE.MeshStandardMaterial({ color: 0xff4d5e, emissive: 0xff2233, emissiveIntensity: 1.1, roughness: 0.5 });
  var okMat = new THREE.MeshStandardMaterial({ color: 0x3ddc84, emissive: 0x17a95c, emissiveIntensity: 0.5, roughness: 0.5 });
  var cigScale = 0.1;   // mm → unit
  for (i2 = 0; i2 < CIG_POOL; i2++) {
    var g2 = new THREE.Group();
    var rod = cyl(CIGARETTE_GEOM.diameterMm * cigScale / 2, CIGARETTE_GEOM.diameterMm * cigScale / 2,
      CIGARETTE_GEOM.rodLenMm * cigScale, rodMat, 12);
    rod.rotation.x = Math.PI / 2;
    rod.position.z = CIGARETTE_GEOM.tipLenMm * cigScale / 2;
    g2.add(rod);
    var tip = cyl(CIGARETTE_GEOM.diameterMm * cigScale / 2 + 0.005, CIGARETTE_GEOM.diameterMm * cigScale / 2 + 0.005,
      CIGARETTE_GEOM.tipLenMm * cigScale, tipMat, 12);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = -CIGARETTE_GEOM.rodLenMm * cigScale / 2;
    g2.add(tip);
    var mark = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), ngMat);
    mark.position.set(0, 0.7, 0);
    mark.visible = false;
    g2.add(mark);
    g2.visible = false;
    g2.userData.mark = mark;
    root.add(g2);
    cigMeshes.push(g2);
  }

  /* ---------------- 站位标记 ---------------- */
  var stationMarks = new THREE.Group();
  function addStationMark(slot, text, color) {
    var p = slotToPos(slot);
    var ringMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    var ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 24), ringMat);
    ring.position.copy(p);
    ring.position.z = 5.2;
    stationMarks.add(ring);
    var d = document.createElement('div');
    d.className = 'p3d-station';
    d.textContent = text;
    var lb = new CSS2DObject(d);
    lb.position.copy(p);
    lb.position.z = 5.6;
    stationMarks.add(lb);
  }
  addStationMark(STATIONS.D1, 'D1 检测工位（下组 CAM1/CAM2）', 0x63f5c8);
  addStationMark(STATIONS.D2, 'D2 检测工位（上组 CAM3/CAM4）', 0x63f5c8);
  addStationMark(STATIONS.NOZZLE, '剔除工位（喷嘴）', 0xff5b6e);
  root.add(stationMarks);

  /* ---------------- 选中高亮 ---------------- */
  var selBox = new THREE.BoxHelper(new THREE.Object3D(), 0x6ee7ff);
  selBox.visible = false;
  scene.add(selBox);

  var raycaster = new THREE.Raycaster();
  var mouse = new THREE.Vector2();
  var hoverKey = null;

  function pick(ev) {
    var rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var hits = raycaster.intersectObjects(root.children, true);
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      while (o && !o.userData.partKey) o = o.parent;
      if (o && o.userData.partKey && parts[o.userData.partKey] && parts[o.userData.partKey].group.visible) {
        return o.userData.partKey;
      }
    }
    return null;
  }
  renderer.domElement.addEventListener('pointermove', function (ev) {
    var k = pick(ev);
    if (k !== hoverKey) {
      hoverKey = k;
      renderer.domElement.style.cursor = k ? 'pointer' : 'default';
      store.emit('p3d-hover', k);
    }
  });
  renderer.domElement.addEventListener('click', function (ev) {
    var k = pick(ev);
    api.select(k);
  });

  /* ---------------- 视角预设 ---------------- */
  var VIEWS = {
    overview: { pos: [46, 34, 62], tgt: [0, -1, 0] },
    detect: { pos: [10, 6, 30], tgt: [0, 0, 0] },
    reject: { pos: [-34, -6, 26], tgt: [-24, -6, 0] },
    control: { pos: [-6, 8, 44], tgt: [-9, 2, 6] },
    sync: { pos: [40, 4, 26], tgt: [24, -4, 3] },
    top: { pos: [0, 70, 0.01], tgt: [0, 0, 0] },
    front: { pos: [0, 0, 78], tgt: [0, -2, 0] },
  };
  var camTween = null;
  function flyTo(name) {
    var v = VIEWS[name];
    if (!v) return;
    camTween = {
      t: 0,
      fromPos: camera.position.clone(), toPos: new THREE.Vector3(v.pos[0], v.pos[1], v.pos[2]),
      fromTgt: controls.target.clone(), toTgt: new THREE.Vector3(v.tgt[0], v.tgt[1], v.tgt[2]),
    };
  }
  function focusPart(k) {
    var p = parts[k];
    if (!p) return;
    var bb = new THREE.Box3().setFromObject(p.group);
    var c = bb.getCenter(new THREE.Vector3());
    var sz = bb.getSize(new THREE.Vector3()).length();
    var dirp = new THREE.Vector3(0.55, 0.4, 1).normalize().multiplyScalar(Math.max(14, sz * 1.9));
    camTween = {
      t: 0, fromPos: camera.position.clone(), toPos: c.clone().add(dirp),
      fromTgt: controls.target.clone(), toTgt: c.clone(),
    };
  }

  /* ---------------- 主循环 ---------------- */
  var clock = new THREE.Clock();
  var explodeCur = 0;
  var lastEventIdx = 0;

  function resize() {
    var w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  function applyExplode(v) {
    var keys = Object.keys(parts);
    for (var i = 0; i < keys.length; i++) {
      var p = parts[keys[i]];
      p.group.position.copy(p.home).addScaledVector(p.dir, p.dist * v);
    }
  }

  function applyZones() {
    var z = store.ui.zones;
    var keys = Object.keys(parts);
    for (var i = 0; i < keys.length; i++) {
      var meta = PART_META[keys[i]];
      var vis = !meta || z[meta.zone] !== false;
      if (parts[keys[i]].hidden) vis = false;
      parts[keys[i]].group.visible = vis;
    }
    for (i = 0; i < labels.length; i++) {
      var p2 = parts[labels[i].key];
      labels[i].el.style.display = (store.ui.labels && p2 && p2.group.visible) ? '' : 'none';
    }
  }

  function setWireframe(on) {
    root.traverse(function (o) {
      if (o.isMesh && o.material && 'wireframe' in o.material) o.material.wireframe = on;
    });
  }

  function pulseCable(evtKind) {
    for (var i = 0; i < cableRuns.length; i++) {
      if (cableRuns[i].def.evt === evtKind) cableRuns[i].pulses.push(0);
    }
  }

  function animate() {
    var dt = clock.getDelta();
    requestAnimationFrame(animate);
    // 视图隐藏时不渲染，避免后台空转（仿真内核仍由 main.js 主循环推进）
    if (container.offsetParent === null) return;
    // 相机补间
    if (camTween) {
      camTween.t = Math.min(1, camTween.t + dt * 1.8);
      var e = 1 - Math.pow(1 - camTween.t, 3);
      camera.position.lerpVectors(camTween.fromPos, camTween.toPos, e);
      controls.target.lerpVectors(camTween.fromTgt, camTween.toTgt, e);
      if (camTween.t >= 1) camTween = null;
    }
    // 爆炸
    var tgtEx = store.ui.explode;
    if (Math.abs(tgtEx - explodeCur) > 0.001) {
      explodeCur += (tgtEx - explodeCur) * Math.min(1, dt * 6);
      applyExplode(explodeCur);
    }
    // 鼓轮旋转（与 engine 槽位计数同步）
    var slotBase = engine.counter + engine.counterFrac;
    var ks = ['hopper', 't1', 't2', 'rej'];
    for (var i = 0; i < ks.length; i++) {
      if (drumGroups[ks[i]]) drumGroups[ks[i]].rotation.z = DIRS[ks[i]] * (slotBase / 24) * Math.PI * 2;
    }
    gearSpin.rotation.z = -(slotBase / 24) * Math.PI * 2;
    // 光电传感器 LED 随脉冲闪
    var frac = engine.counterFrac;
    photoG.userData.led.material.emissiveIntensity = frac < 0.35 ? 2.6 : 0.35;

    // 烟支
    var n = Math.min(engine.cigs.length, CIG_POOL);
    for (i = 0; i < CIG_POOL; i++) {
      if (i >= n) { cigMeshes[i].visible = false; continue; }
      var c = engine.cigs[i];
      var mesh = cigMeshes[i];
      mesh.visible = true;
      var p = slotToPos(c.slotPos);
      if (c.ejected) {
        var k2 = c.ejectT / 260;
        p.x -= 4 + k2 * 12;
        p.y -= 1 + k2 * k2 * 16;
        mesh.rotation.z = k2 * 6;
      } else {
        mesh.rotation.z = 0;
      }
      mesh.position.copy(p);
      var showMark = (c.verdict === 'NG') || (c.trueClass !== null && store.ui.showTruth);
      mesh.userData.mark.visible = !!showMark;
      if (showMark) {
        mesh.userData.mark.material = (c.verdict === 'NG') ? ngMat : okMat;
      }
    }

    // 相机闪光 / 光源
    for (i = 0; i < camMeshes.length; i++) camMeshes[i].userData.flash.intensity *= Math.pow(0.02, dt);
    for (i = 0; i < engine.flashes.length; i++) {
      var f = engine.flashes[i];
      var cm = camMeshes[f.cam];
      if (cm) cm.userData.flash.intensity = 9 * f.life;
    }
    var lightOn = store.ui.running ? 1 : 0.35;
    for (i = 0; i < lightGlows.length; i++) {
      lightGlows[i].emit.material.emissiveIntensity = 1.1 + 0.7 * lightOn;
      lightGlows[i].light.intensity = 0.35 + 0.5 * lightOn;
    }

    // 气吹
    var jetAmt = 0;
    for (i = 0; i < engine.jets.length; i++) jetAmt = Math.max(jetAmt, engine.jets[i].life);
    nozG.userData.jetMat.opacity = 0.75 * jetAmt;
    nozG.userData.jet.scale.set(1 + jetAmt * 0.3, 1, 1 + jetAmt * 0.3);
    valveG.userData.led.material.emissiveIntensity = 0.2 + 3.2 * jetAmt;

    // 线缆信号
    var evts = engine.events;
    if (evts.length < lastEventIdx) lastEventIdx = 0;
    for (i = lastEventIdx; i < evts.length; i++) pulseCable(evts[i].kind);
    lastEventIdx = evts.length;
    for (i = 0; i < engine.packets.length; i++) {
      var pk = engine.packets[i];
      if (pk.life > 0.985) pulseCable(pk.kind);
    }
    for (i = 0; i < cableRuns.length; i++) {
      var cr = cableRuns[i];
      var maxP = -1;
      for (var q = cr.pulses.length - 1; q >= 0; q--) {
        cr.pulses[q] += dt * 1.7;
        if (cr.pulses[q] > 1) cr.pulses.splice(q, 1);
        else if (cr.pulses[q] > maxP) maxP = cr.pulses[q];
      }
      if (maxP >= 0) {
        var pos = cr.curve.getPointAt(clamp(maxP, 0, 1));
        cr.bead.position.copy(pos);
        cr.beadMat.opacity = 0.95;
        cr.mat.emissiveIntensity = 0.9;
      } else {
        cr.beadMat.opacity *= Math.pow(0.05, dt);
        cr.mat.emissiveIntensity = 0.12 + (cr.mat.emissiveIntensity - 0.12) * Math.pow(0.1, dt);
      }
    }

    // 触摸屏亮度呼吸
    hmiG.userData.screenMat.emissiveIntensity = 0.6 + 0.25 * Math.sin(performance.now() / 700);

    if (selBox.visible) selBox.update();
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  var api = {
    parts: parts,
    select: function (k) {
      store.setUI('selected', k);
      if (k && parts[k]) {
        selBox.setFromObject(parts[k].group);
        selBox.visible = true;
      } else {
        selBox.visible = false;
      }
    },
    focus: focusPart,
    flyTo: flyTo,
    setVisible: function (k, v) {
      if (parts[k]) { parts[k].hidden = !v; applyZones(); }
    },
    isVisible: function (k) { return parts[k] && !parts[k].hidden; },
    applyZones: applyZones,
    setWireframe: setWireframe,
    resize: resize,
    slotToPos: slotToPos,
  };

  store.on('ui', function (e) {
    if (e.key === 'zones' || e.key === 'labels') applyZones();
    if (e.key === 'wireframe') setWireframe(e.value);
    if (e.key === 'selected') {
      if (e.value && parts[e.value]) { selBox.setFromObject(parts[e.value].group); selBox.visible = true; }
      else selBox.visible = false;
    }
  });

  applyZones();
  animate();
  setTimeout(resize, 40);
  return api;
}
