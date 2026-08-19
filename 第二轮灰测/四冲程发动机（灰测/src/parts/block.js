/**
 * block.js —— 固定件：气缸体、气缸套、主轴承座/盖/轴瓦、油底壳、飞轮壳、
 *              缸垫、油封、机脚、以及主要螺栓组
 */
import * as THREE from 'three';
import * as U from '../core/util.js';
import { CYL_X } from '../core/params.js';

/** 截面在 (x, z) 平面、厚度沿 Y 的水平板 */
export function plateXZ(points, t, holes = null) {
  const g = U.extrudePoly(points, t, { holes });
  g.rotateX(Math.PI / 2);
  return g;
}
/** 截面在 (z, y) 平面、厚度沿 X 的垂直板（轴承座、齿轮等） */
export function plateYZ(points, t, holes = null) {
  const g = U.extrudePoly(points, t, { holes });
  g.rotateY(-Math.PI / 2);
  return g;
}
/** 半圆环瓦片（轴瓦），截面在 (z,y)，厚度沿 X */
export function halfShell(rOut, rIn, from, to, t, seg = 40) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const a = from + (to - from) * (i / seg);
    pts.push([Math.cos(a) * rOut, Math.sin(a) * rOut]);
  }
  for (let i = seg; i >= 0; i--) {
    const a = from + (to - from) * (i / seg);
    pts.push([Math.cos(a) * rIn, Math.sin(a) * rIn]);
  }
  return plateYZ(pts, t);
}

export function build(world) {
  const { P, mats } = world;
  const G = world.group('housing');
  const F = world.group('fasteners');
  const B = P.block;

  const HEAD_BOLT_X = CYL_X.flatMap((x) => [x - 50, x + 50]);
  const HEAD_BOLT_Z = [-74, 74];
  const MAIN_X = [-260, -130, 0, 130, 260];

  // ============================================================ 气缸体本体
  const blockGeos = [];
  // 上平面板（含 4 个缸套孔 + 缸盖螺栓孔）
  {
    const outline = [
      [-350, -130], [350, -130], [350, 130], [-350, 130],
    ];
    const holes = CYL_X.map((x) => U.circlePts(B.linerOD / 2, 40, x, 0));
    for (const x of HEAD_BOLT_X) for (const z of HEAD_BOLT_Z) holes.push(U.circlePts(8, 12, x, z));
    const g = plateXZ(outline, 330 - B.deckPlateY, holes);
    g.translate(0, (330 + B.deckPlateY) / 2, 0);
    blockGeos.push(g);
  }
  // 缸筒段侧壁（水套外壁）
  for (const z of [-124, 124]) {
    const g = new THREE.BoxGeometry(700, B.deckPlateY - B.crankcaseTopY, 12);
    g.translate(0, (B.deckPlateY + B.crankcaseTopY) / 2, z);
    blockGeos.push(g);
  }
  // 缸筒段端壁
  for (const x of [-344, 344]) {
    const g = new THREE.BoxGeometry(12, B.deckPlateY - B.crankcaseTopY, 248);
    g.translate(x, (B.deckPlateY + B.crankcaseTopY) / 2, 0);
    blockGeos.push(g);
  }
  // 缸间加强隔板（12mm，正好落在两缸套之间）
  for (const x of [-130, 0, 130]) {
    const g = new THREE.BoxGeometry(11, B.deckPlateY - B.crankcaseTopY, 248);
    g.translate(x, (B.deckPlateY + B.crankcaseTopY) / 2, 0);
    blockGeos.push(g);
  }
  // 曲轴箱侧壁
  for (const z of [-112, 112]) {
    const g = new THREE.BoxGeometry(700, B.crankcaseTopY - B.panFlangeY, 12);
    g.translate(0, (B.crankcaseTopY + B.panFlangeY) / 2, z);
    blockGeos.push(g);
  }
  for (const x of [-344, 344]) {
    const g = new THREE.BoxGeometry(12, B.crankcaseTopY - B.panFlangeY, 224);
    g.translate(x, (B.crankcaseTopY + B.panFlangeY) / 2, 0);
    blockGeos.push(g);
  }
  // 缸筒下端环（缸套下支承 + 水套底密封面）
  for (const x of CYL_X) {
    const g = U.tubeShell(150, B.linerOD - 1, 16, 32);
    g.translate(x, B.crankcaseTopY + 8, 0);
    blockGeos.push(g);
  }
  // 油底壳法兰
  {
    const outer = [[-345, -118], [345, -118], [345, 118], [-345, 118]];
    const inner = [[-320, -96], [-320, 96], [320, 96], [320, -96]];
    const g = plateXZ(outer, 10, [inner]);
    g.translate(0, B.panFlangeY - 5, 0);
    blockGeos.push(g);
  }
  // 主轴承座隔板（5 道）
  for (const x of MAIN_X) {
    const rB = P.crank.mainDia / 2 + 2.5;   // 座孔半径 = 轴颈 + 轴瓦壁厚
    const pts = [[-100, 0], [-rB, 0]];
    const seg = 26;
    for (let i = seg; i >= 0; i--) {
      const a = (i / seg) * Math.PI;
      pts.push([Math.cos(a) * rB, Math.sin(a) * rB]);
    }
    pts.push([100, 0], [100, B.crankcaseTopY], [-100, B.crankcaseTopY]);
    const g = plateYZ(pts, 26);
    g.translate(x, 0, 0);
    blockGeos.push(g);
  }
  // 凸轮轴轴承孔座（缸体内 Z=-100）
  for (const x of MAIN_X) {
    const g = U.tubeX(88, P.valvetrain.camJournalDia + 4, 24, 24);
    g.translate(x, B.camY, B.camZ);
    blockGeos.push(g);
  }
  // 挺柱导孔座
  for (const x of CYL_X) {
    for (const dx of [-P.valvetrain.pushrodOffsetX, P.valvetrain.pushrodOffsetX]) {
      const g = U.cyl(42, 54, 20);
      g.translate(x + dx, B.camY + 40, B.pushrodZ ?? P.valvetrain.pushrodZ);
      blockGeos.push(g);
    }
  }
  // 机脚支座
  for (const z of [-138, 138]) {
    for (const x of [-210, 210]) {
      const g = new THREE.BoxGeometry(120, 26, 40);
      g.translate(x, 40, z);
      blockGeos.push(g);
    }
  }

  const blockMesh = U.mesh(U.merge(blockGeos), mats.castIron, [0, 0, 0], [0, 0, 0], 'cylinderBlock');
  G.add(blockMesh);
  world.reg(blockMesh, 'block.cylinderBlock', {
    state: (st) => `承受最高爆压 ${st.cyl[0].pressure.toFixed(0)} bar · 缸体温度≈${(st.op.coolantTemp + 6).toFixed(0)}℃`,
  });

  // ============================================================ 湿式气缸套
  const linerGroup = new THREE.Group();
  for (const x of CYL_X) {
    const h = 330 - B.crankcaseTopY;
    const body = U.mesh(U.tubeShell(B.linerOD, B.linerID, h, 48), mats.nodularIron,
      [x, B.crankcaseTopY + h / 2, 0]);
    const flange = U.mesh(U.tubeShell(B.linerFlangeOD, B.linerID, 9, 48), mats.nodularIron,
      [x, 330 - 4.5, 0]);
    linerGroup.add(body, flange);
    // 水套密封胶圈（缸套下部两道）
    for (const y of [B.crankcaseTopY + 26, B.crankcaseTopY + 48]) {
      const o = U.mesh(U.oring(B.linerOD + 5, 5, 32), mats.rubber, [x, y, 0], [Math.PI / 2, 0, 0]);
      world.reg(o, 'seal.linerOring', { state: () => '密封缸套与缸体水套接合面' });
      F.add(o);
    }
  }
  G.add(linerGroup);
  world.reg(linerGroup, 'block.linerSleeve', {
    state: (st) => `第 1 缸活塞在缸套内 ${st.cyl[0].stroke.cn} · 缸壁滑动速度 ${(Math.abs(st.pistonSpeed1) / 1000).toFixed(2)} m/s`,
  });

  // ============================================================ 主轴承盖 + 轴瓦
  const capGroup = new THREE.Group();
  const shellGroup = new THREE.Group();
  const rB = P.crank.mainDia / 2 + 2.5;
  for (let i = 0; i < MAIN_X.length; i++) {
    const x = MAIN_X[i];
    const pts = [[-58, 0], [-rB, 0]];
    const seg = 26;
    for (let k = 0; k <= seg; k++) {
      const a = Math.PI + (k / seg) * Math.PI;
      pts.push([Math.cos(a) * rB, Math.sin(a) * rB]);
    }
    pts.push([58, 0], [58, -46], [-58, -46]);
    const cap = U.mesh(plateYZ(pts, 26), mats.nodularIron, [x, 0, 0]);
    capGroup.add(cap);
    // 上下轴瓦（铜铅合金三层瓦）
    const up = U.mesh(halfShell(rB - 0.02, P.crank.mainDia / 2 + P.crank.mainClearance / 2, 0, Math.PI, P.crank.mainWidth - 2),
      mats.bearingAlloy, [x, 0, 0]);
    const dn = U.mesh(halfShell(rB - 0.02, P.crank.mainDia / 2 + P.crank.mainClearance / 2, Math.PI, Math.PI * 2, P.crank.mainWidth - 2),
      mats.bearingAlloy, [x, 0, 0]);
    shellGroup.add(up, dn);
  }
  G.add(capGroup, shellGroup);
  world.reg(capGroup, 'block.mainCap', {
    state: (st) => `承受连杆惯性力与爆发压力 · ${st.rpm.toFixed(0)} r/min 下交变载荷`,
    explode: [0, -70, 0],
  });
  world.reg(shellGroup, 'block.mainBearingShell', {
    state: (st) => `油膜压力 ${(st.op.oilPressure * 10).toFixed(1)} bar · 配合间隙 ${P.crank.mainClearance.toFixed(2)} mm`,
  });

  // 主轴承螺栓（每盖 2 条 M16，从下方装入）
  const mainBoltGeo = U.hexBolt(24, 15, 16, 92);
  const mainBoltTf = [];
  for (const x of MAIN_X) for (const z of [-46, 46]) mainBoltTf.push({ pos: [x, -46, z], rot: [Math.PI, 0, 0] });
  const mainBolts = U.instances(mainBoltGeo, mats.boltSteel, mainBoltTf, 'mainBolts');
  F.add(mainBolts);
  world.reg(mainBolts, 'fastener.mainBolt', {
    state: () => `预紧力矩 210 N·m + 转角 90°（塑性区拧紧）`,
  });

  // ============================================================ 油底壳
  const panGeos = [];
  const pd = P.oilPan.depth, panBottom = B.panFlangeY - pd;
  panGeos.push((() => { const g = new THREE.BoxGeometry(P.oilPan.lenX, 8, 236); g.translate(0, panBottom + 4, 0); return g; })());
  for (const z of [-116, 116]) {
    const g = new THREE.BoxGeometry(P.oilPan.lenX, pd, 6);
    g.translate(0, panBottom + pd / 2, z);
    panGeos.push(g);
  }
  for (const x of [-317, 317]) {
    const g = new THREE.BoxGeometry(6, pd, 232);
    g.translate(x, panBottom + pd / 2, 0);
    panGeos.push(g);
  }
  {
    const outer = [[-345, -118], [345, -118], [345, 118], [-345, 118]];
    const inner = [[-320, -96], [-320, 96], [320, 96], [320, -96]];
    const g = plateXZ(outer, 8, [inner]);
    g.translate(0, B.panFlangeY - 12, 0);
    panGeos.push(g);
  }
  // 加深的集油坑（前部）
  panGeos.push((() => { const g = new THREE.BoxGeometry(180, 44, 200); g.translate(-230, panBottom - 18, 0); return g; })());
  const pan = U.mesh(U.merge(panGeos), mats.steelSheet, [0, 0, 0], [0, 0, 0], 'oilPan');
  G.add(pan);
  world.reg(pan, 'block.oilPan', {
    state: (st) => `储油 12 L · 油温 ${st.op.oilTemp.toFixed(0)}℃ · 液面随机油泵抽吸波动`,
    explode: [0, -220, 0],
  });
  // 放油螺塞
  const drain = U.mesh(U.hexBolt(26, 14, 18, 16), mats.boltSteel, [-230, panBottom - 40, 0], [Math.PI, 0, 0]);
  F.add(drain);
  world.reg(drain, 'fastener.drainPlug', { state: () => '放油螺塞（带磁性，吸附金属磨屑）' });

  // 油底壳垫片
  {
    const outer = [[-345, -118], [345, -118], [345, 118], [-345, 118]];
    const inner = [[-322, -98], [-322, 98], [322, 98], [322, -98]];
    const g = plateXZ(outer, 2, [inner]);
    const gk = U.mesh(g, mats.gasketPaper, [0, B.panFlangeY - 17, 0]);
    F.add(gk);
    world.reg(gk, 'seal.panGasket', { state: () => '耐油纸垫（压缩量 30%，防止渗漏机油）' });
  }
  // 油底壳螺栓
  const panBoltTf = [];
  for (let i = -6; i <= 6; i++) for (const z of [-108, 108]) panBoltTf.push({ pos: [i * 52, B.panFlangeY - 18, z], rot: [Math.PI, 0, 0] });
  const panBolts = U.instances(U.hexBolt(13, 8, 8, 22), mats.boltSteel, panBoltTf, 'panBolts');
  F.add(panBolts);
  world.reg(panBolts, 'fastener.panBolt', { state: () => `M8×25 · 力矩 24 N·m（26 条）` });

  // ============================================================ 缸垫
  {
    const outline = [[-350, -130], [350, -130], [350, 130], [-350, 130]];
    const holes = CYL_X.map((x) => U.circlePts(P.bore / 2 - 0.5, 40, x, 0));
    for (const x of HEAD_BOLT_X) for (const z of HEAD_BOLT_Z) holes.push(U.circlePts(8.5, 10, x, z));
    // 水孔、油孔
    for (const x of [-260, -130, 0, 130, 260]) holes.push(U.circlePts(9, 10, x, 96));
    for (const x of [-300, 300]) holes.push(U.circlePts(6, 10, x, -96));
    const gk = U.mesh(plateXZ(outline, P.head.gasketThk, holes), mats.gasketMat, [0, 330 + P.head.gasketThk / 2, 0]);
    G.add(gk);
    world.reg(gk, 'seal.headGasket', {
      state: (st) => `密封 ${st.cyl[0].pressure.toFixed(0)} bar 燃气 + 水道 + 油道 · 装配压缩后厚 ${P.head.gasketThk} mm`,
      explode: [0, 60, 0],
    });
    // 缸口包边（不锈钢火口圈）
    for (const x of CYL_X) {
      const ring = U.mesh(U.tubeShell(P.bore + 9, P.bore - 1, P.head.gasketThk + 0.6, 40), mats.chrome,
        [x, 330 + P.head.gasketThk / 2, 0]);
      G.add(ring);
      world.reg(ring, 'seal.fireRing', { state: () => '不锈钢火口圈，承受缸口高温高压燃气冲刷' });
    }
  }

  // 缸盖螺栓（16 条 M14×130）
  const headBoltTf = [];
  for (const x of HEAD_BOLT_X) for (const z of HEAD_BOLT_Z) headBoltTf.push({ pos: [x, P.head.topY, z] });
  const headBolts = U.instances(U.hexBolt(22, 14, 14, 128), mats.boltSteel, headBoltTf, 'headBolts');
  F.add(headBolts);
  world.reg(headBolts, 'fastener.headBolt', {
    state: () => `M14×130 · 分三次拧紧至 130 N·m + 转角 90°`,
  });

  // ============================================================ 飞轮壳
  {
    const hg = [];
    const shell = U.tubeX(P.flywheelHousing.od, P.flywheelHousing.od - 2 * P.flywheelHousing.wallThk,
      P.flywheelHousing.len, 56);
    shell.translate(350 + P.flywheelHousing.len / 2, 0, 0);
    hg.push(shell);
    // 前端连接板（贴缸体后端面）
    const plate = U.tubeX(P.flywheelHousing.od, 442, 12, 56);
    plate.translate(355, 0, 0);
    hg.push(plate);
    // 后端法兰（接变速器）
    const rear = U.tubeX(P.flywheelHousing.od + 18, 340, 16, 56);
    rear.translate(438, 0, 0);
    hg.push(rear);
    const fh = U.mesh(U.merge(hg), mats.castIron, [0, 0, 0], [0, 0, 0], 'flywheelHousing');
    G.add(fh);
    world.reg(fh, 'block.flywheelHousing', {
      state: () => '包围飞轮与离合器，保证与变速器同轴度 ≤0.15 mm',
      explode: [220, 0, 0],
    });
    const tf = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      tf.push({ pos: [364, Math.sin(a) * 230, Math.cos(a) * 230], rot: [0, 0, -Math.PI / 2] });
    }
    const hb = U.instances(U.hexBolt(18, 11, 12, 30), mats.boltSteel, tf, 'housingBolts');
    F.add(hb);
    world.reg(hb, 'fastener.housingBolt', { state: () => 'M12×35 · 力矩 78 N·m（12 条）' });
  }

  // ============================================================ 曲轴前后油封
  {
    const rear = U.mesh(U.tubeX(190, 150, 14, 40), mats.rubber, [352, 0, 0]);
    G.add(rear);
    world.reg(rear, 'seal.rearMainSeal', {
      state: (st) => `唇形骨架油封 · 线速度 ${(Math.PI * 0.15 * st.rpm / 60).toFixed(1)} m/s`,
    });
    const front = U.mesh(U.tubeX(96, 60, 12, 36), mats.rubber, [-356, 0, 0]);
    G.add(front);
    world.reg(front, 'seal.frontMainSeal', { state: () => 'PTFE 唇形油封，防止曲轴前端漏油' });
  }

  // 曲轴箱通风管（示意）
  {
    const { geo } = U.pipeFromPoints([[300, 470, -60], [330, 500, -110], [300, 430, -180], [200, 200, -190]], 20, 12);
    const vent = U.mesh(geo, mats.silicone, [0, 0, 0]);
    G.add(vent);
    world.reg(vent, 'block.breather', {
      state: (st) => `曲轴箱窜气量随负荷变化 · 当前负荷 ${(st.load * 100).toFixed(0)}%`,
    });
  }
}
