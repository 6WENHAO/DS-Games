/**
 * crankshaft.js —— 曲轴（主轴颈、连杆颈、曲柄臂、平衡重、前端轴颈、后端法兰）
 *                  + 飞轮（含飞轮齿圈）+ 扭转减振器 + 曲轴内部斜油道示意
 *
 * 局部坐标：曲轴组绕 X 轴旋转，rotation.x = 曲轴转角（弧度）
 * 转角 0° 时第 1/4 缸连杆颈位于 +Y（上止点）
 */
import * as THREE from 'three';
import * as U from '../core/util.js';
import { CYL_X } from '../core/params.js';
import { plateYZ } from './block.js';

export function build(world) {
  const { P, K, mats } = world;
  const C = P.crank;
  const G = world.group('crankTrain');

  const crank = new THREE.Group();
  crank.name = 'crankshaft';
  G.add(crank);

  const MAIN_X = [-260, -130, 0, 130, 260];
  const geos = [];

  // ---------- 主轴颈 ----------
  for (const x of MAIN_X) {
    const g = U.cylX(C.mainDia, C.mainWidth, 40);
    g.translate(x, 0, 0);
    geos.push(g);
  }

  // ---------- 连杆颈 ----------
  CYL_X.forEach((x, i) => {
    const cyl = i + 1;
    const up = (cyl === 1 || cyl === 4) ? 1 : -1;   // 1、4 缸曲柄向上，2、3 缸向下
    const g = U.cylX(C.rodDia, C.rodWidth, 36);
    g.translate(x, up * P.crankR, 0);
    geos.push(g);
  });

  // ---------- 曲柄臂 + 平衡重（8 片）----------
  // 轴向空间核算：连杆颈中心↔主轴颈中心 = 65mm，两者半宽 23 + 21 → 曲柄臂厚 21mm
  // 平衡重在半径 > 62mm 处加厚到 34mm（该半径已越过主轴颈外圆，轴向不干涉）
  const webProfile = (upSign, rFloor, rMin) => (a) => {
    const pinDir = upSign > 0 ? Math.PI / 2 : -Math.PI / 2;
    const cwDir = pinDir + Math.PI;
    // 连杆颈包容圆
    const d = P.crankR, rb = C.rodDia / 2 + 8;
    const dth = Math.atan2(Math.sin(a - pinDir), Math.cos(a - pinDir));
    let rPin = rFloor;
    const s = d * Math.sin(dth);
    if (Math.abs(s) < rb) {
      const c = d * Math.cos(dth) + Math.sqrt(rb * rb - s * s);
      if (c > 0) rPin = Math.max(rFloor, c);
    }
    // 平衡重扇形（148°，带圆角过渡）
    const dcw = Math.abs(Math.atan2(Math.sin(a - cwDir), Math.cos(a - cwDir)));
    const half = (C.cwAngle / 2) * Math.PI / 180;
    let rCw = 0;
    if (dcw < half) rCw = C.cwR;
    else if (dcw < half + 0.18) rCw = C.cwR - (dcw - half) / 0.18 * (C.cwR - rFloor);
    return Math.max(rMin, rPin, rCw);
  };

  CYL_X.forEach((x, i) => {
    const cyl = i + 1;
    const up = (cyl === 1 || cyl === 4) ? 1 : -1;
    for (const sx of [-1, 1]) {
      const wx = x + sx * (C.rodWidth / 2 + C.webThk / 2);
      // 曲柄臂本体（厚 21）
      const g = U.polarExtrude(webProfile(up, 50, 12), C.webThk, 168);
      g.rotateY(-Math.PI / 2);
      g.translate(wx, 0, 0);
      geos.push(g);
      // 平衡重加厚部分（厚 34，仅 r>62）
      const thick = U.polarExtrude(webProfile(-up * 0 + up, 62, 62), C.cwThk, 132);
      thick.rotateY(-Math.PI / 2);
      thick.translate(wx, 0, 0);
      geos.push(thick);
    }
  });

  // ---------- 前端轴颈 / 后端法兰 ----------
  {
    const stub = U.cylX(C.frontStubDia, C.frontStubLen, 32);
    stub.translate(-350 - C.frontStubLen / 2 + 40, 0, 0);
    geos.push(stub);
    const nose = U.cylX(44, 104, 24);
    nose.translate(-412, 0, 0);
    geos.push(nose);
    const flange = U.cylX(C.rearFlangeDia, C.rearFlangeThk, 44);
    flange.translate(300 + C.rearFlangeThk / 2, 0, 0);
    geos.push(flange);
    const spigot = U.cylX(70, 24, 28);
    spigot.translate(330, 0, 0);
    geos.push(spigot);
  }

  const crankMesh = U.mesh(U.merge(geos), mats.forgedSteel, [0, 0, 0], [0, 0, 0], 'crankshaftBody');
  crank.add(crankMesh);
  world.reg(crankMesh, 'crank.crankshaft', {
    state: (st) => `转角 ${st.crankAngle.toFixed(0)}° · ${st.rpm.toFixed(0)} r/min · 输出扭矩 ${st.op.torque.toFixed(0)} N·m`,
  });

  // ---------- 曲轴内部斜油道（示意，随曲轴旋转）----------
  const oilGroup = new THREE.Group();
  CYL_X.forEach((x, i) => {
    const cyl = i + 1;
    const up = (cyl === 1 || cyl === 4) ? 1 : -1;
    const nearMain = x < 0 ? x - 65 : x + 65;
    const { geo } = U.pipeFromPoints([
      [nearMain, 0, 0],
      [(nearMain + x) / 2, up * P.crankR * 0.45, 6],
      [x, up * (P.crankR - 6), 0],
    ], 9, 8, 0.5);
    oilGroup.add(U.mesh(geo, mats.oilVol));
  });
  crank.add(oilGroup);
  world.reg(oilGroup, 'crank.oilDrilling', {
    state: (st) => `主轴颈→连杆颈斜油道 · 供油压力 ${(st.op.oilPressure * 10).toFixed(1)} bar`,
  });

  // ---------- 正时齿轮（曲轴齿轮，随曲轴同步）----------
  {
    const tg = P.timing.crankGear;
    const gear = U.mesh(U.gearGeometry(tg.teeth, tg.module, tg.thk, 60), mats.gearSteel, [tg.x, 0, 0]);
    gear.geometry.rotateY(-Math.PI / 2);
    crank.add(gear);
    world.reg(gear, 'timing.crankGear', {
      state: (st) => `${tg.teeth} 齿 · 驱动惰轮 · ${st.rpm.toFixed(0)} r/min`,
    });
  }

  // ---------- 扭转减振器 / 皮带轮 ----------
  {
    const grp = new THREE.Group();
    grp.add(U.mesh(U.tubeX(196, 46, 26, 44), mats.nodularIron, [-442, 0, 0]));
    grp.add(U.mesh(U.tubeX(210, 196, 22, 44), mats.rubber, [-442, 0, 0]));
    grp.add(U.mesh(U.tubeX(236, 210, 30, 44), mats.nodularIron, [-442, 0, 0]));
    for (const dx of [-8, 4]) {
      grp.add(U.mesh(U.tubeX(186, 150, 12, 40), mats.steelSheet, [-462 + dx, 0, 0]));
    }
    crank.add(grp);
    world.reg(grp, 'crank.damper', {
      state: (st) => `硅油/橡胶扭振减振器 · 抑制 ${(st.rpm * 2 / 60).toFixed(0)} Hz 主谐次扭振`,
      explode: [-160, 0, 0],
    });
  }

  // ---------- 飞轮 + 齿圈 ----------
  {
    const fw = new THREE.Group();
    const FW = P.flywheel;
    const body = U.mesh(U.tubeX(FW.dia - 2 * FW.ringThk, 80, FW.thk, 56), mats.nodularIron, [352, 0, 0]);
    const hub = U.mesh(U.tubeX(180, 80, 26, 44), mats.nodularIron, [336, 0, 0]);
    const clutchFace = U.mesh(U.tubeX(FW.dia - 2 * FW.ringThk - 4, 190, 6, 56), mats.chrome, [352 + FW.thk / 2 + 1, 0, 0]);
    fw.add(body, hub, clutchFace);
    // 齿圈（128 齿，用实例化小块示意齿形）
    const ring = U.mesh(U.tubeX(FW.dia, FW.dia - 2 * FW.ringThk, 26, 72), mats.gearSteel, [352, 0, 0]);
    fw.add(ring);
    const toothGeo = new THREE.BoxGeometry(24, 8, 6.2);
    const tf = [];
    for (let i = 0; i < FW.teeth; i++) {
      const a = (i / FW.teeth) * Math.PI * 2;
      tf.push({ pos: [352, Math.sin(a) * (FW.dia / 2 - 3.5), Math.cos(a) * (FW.dia / 2 - 3.5)], rot: [-a, 0, 0] });
    }
    const teeth = U.instances(toothGeo, mats.gearSteel, tf, 'ringGearTeeth');
    fw.add(teeth);
    // 飞轮螺栓
    const btf = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      btf.push({ pos: [332, Math.sin(a) * FW.boltCircle, Math.cos(a) * FW.boltCircle], rot: [0, 0, Math.PI / 2] });
    }
    fw.add(U.instances(U.hexBolt(20, 12, 14, 34), mats.boltSteel, btf, 'flywheelBolts'));
    crank.add(fw);
    world.reg([body, hub, clutchFace], 'crank.flywheel', {
      state: (st) => `储存动能 ${(0.5 * 1.35 * Math.pow(st.rpm * 2 * Math.PI / 60, 2) / 1000).toFixed(1)} kJ · 转速波动 δ≈${(0.9 / (1 + st.rpm / 600)).toFixed(3)}`,
    });
    world.reg([ring, teeth], 'crank.ringGear', {
      state: () => `${FW.teeth} 齿 · 与起动机小齿轮啮合（传动比 ≈13:1）`,
    });
  }

  // ---------- 动画 ----------
  world.addUpdater((st) => {
    crank.rotation.x = st.crankAngle * Math.PI / 180;
  });

  return crank;
}
