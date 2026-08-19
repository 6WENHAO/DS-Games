/**
 * valvetrain.js —— 配气机构：凸轮轴（桃形由升程规律反求生成）、挺柱、推杆、
 *                  摇臂轴/摇臂/调整螺钉、气门、气门弹簧、弹簧座与锁夹、气门油封
 *
 * 关键：凸轮桃形几何 r(ψ) = 基圆半径 + camLift( 2(ψ−90°) − 该缸相位 )
 *      因此凸轮外形与配气相位在数学上严格同源，旋转 θ/2 时挺柱升程与
 *      解析式 camLift(循环角) 完全一致 —— 相位不可能"跑偏"。
 */
import * as THREE from 'three';
import * as U from '../core/util.js';
import { CYL_X, CYL_PHASE } from '../core/params.js';

const R2D = 180 / Math.PI;

/** 让物体的局部 +Y 轴指向 a→b，并置于中点 */
function alignY(obj, a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  obj.position.copy(a).addScaledVector(dir, 0.5);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
}

export function build(world) {
  const { P, K, mats } = world;
  const V = P.valvetrain, B = P.block;
  const G = world.group('valvetrain');
  const F = world.group('fasteners');
  const y0 = 330 + P.head.gasketThk;         // 缸盖底面 = 气门关闭位置

  // ==================================================== 凸轮轴
  const cam = new THREE.Group();
  cam.name = 'camshaft';
  cam.position.set(0, B.camY, B.camZ);
  G.add(cam);

  const camGeos = [];
  for (const x of [-260, -130, 0, 130, 260]) {
    const g = U.cylX(V.camJournalDia, 24, 32);
    g.translate(x, 0, 0);
    camGeos.push(g);
  }
  // 轴身
  {
    const g = U.cylX(V.camJournalDia - 12, 640, 24);
    g.translate(0, 0, 0);
    camGeos.push(g);
    const front = U.cylX(46, 120, 24);
    front.translate(-378, 0, 0);
    camGeos.push(front);
    const thrust = U.cylX(96, 12, 32);
    thrust.translate(-338, 0, 0);
    camGeos.push(thrust);
  }
  // 凸轮桃（8 个）
  const lobeProfile = (cyl, which) => (psi) => {
    const camRotDeg = psi * R2D - 90;
    let a = (2 * camRotDeg - CYL_PHASE[cyl]) % 720;
    if (a < 0) a += 720;
    return V.camBaseR + K.camLift(a, which);
  };
  CYL_X.forEach((x, i) => {
    const cyl = i + 1;
    for (const [dx, which] of [[-V.pushrodOffsetX, 'intake'], [V.pushrodOffsetX, 'exhaust']]) {
      const g = U.polarExtrude(lobeProfile(cyl, which), V.camLobeWidth, 300);
      g.rotateY(-Math.PI / 2);
      g.translate(x + dx, 0, 0);
      camGeos.push(g);
    }
  });
  const camMesh = U.mesh(U.merge(camGeos), mats.forgedSteel, [0, 0, 0], [0, 0, 0], 'camshaftBody');
  cam.add(camMesh);
  world.reg(camMesh, 'valvetrain.camshaft', {
    state: (st) => `凸轮轴转角 ${((st.crankAngle / 2) % 360).toFixed(0)}° · ${(st.rpm / 2).toFixed(0)} r/min（曲轴的 1/2）`,
  });
  // 凸轮轴齿轮（44 齿，与惰轮啮合）
  {
    const cg = P.timing.camGear;
    const gear = U.mesh(U.gearGeometry(cg.teeth, cg.module, cg.thk, 46), mats.gearSteel, [-372, 0, 0]);
    gear.geometry.rotateY(-Math.PI / 2);
    cam.add(gear);
    world.reg(gear, 'timing.camGear', {
      state: (st) => `${cg.teeth} 齿 · 与曲轴齿轮传动比 2:1 · 相位偏差 <0.5°CA`,
    });
    // 喷油泵驱动用辅助齿轮（18T 模数 4，与泵齿轮 1:1）
    const ag = P.timing.auxCamGear;
    const aux = U.mesh(U.gearGeometry(ag.teeth, ag.module, ag.thk, 40), mats.gearSteel, [ag.x, 0, 0]);
    aux.geometry.rotateY(-Math.PI / 2);
    cam.add(aux);
    world.reg(aux, 'timing.auxCamGear', {
      state: (st) => `凸轮轴辅助齿轮 ${ag.teeth} 齿 · 1:1 驱动喷油泵（${(st.rpm / 2).toFixed(0)} r/min）`,
    });
  }
  world.addUpdater((st) => { cam.rotation.x = (st.crankAngle / 2) * Math.PI / 180; });

  // ==================================================== 摇臂轴
  {
    const shaft = U.mesh(U.tubeX(26, 12, 700, 28), mats.nitridedSteel, [0, V.rockerPivotY, V.rockerPivotZ]);
    G.add(shaft);
    world.reg(shaft, 'valvetrain.rockerShaft', {
      state: (st) => `空心摇臂轴 · 内部通油润滑，油压 ${(st.op.oilPressure * 10).toFixed(1)} bar`,
    });
    const oil = U.mesh(U.cylX(11, 690, 16), mats.oilVol, [0, V.rockerPivotY, V.rockerPivotZ]);
    world.group('fluidVol').add(oil);
    world.reg(oil, 'lube.rockerGallery', {
      state: (st) => `摇臂轴油道 · 向 8 个摇臂衬套供油 · ${(st.op.oilPressure * 10).toFixed(1)} bar`,
    });
  }

  // ==================================================== 逐缸 × 2 气门
  const rig = [];
  CYL_X.forEach((x, i) => {
    const cyl = i + 1;
    [['intake', -1], ['exhaust', 1]].forEach(([which, sgn]) => {
      const xValve = x + sgn * V.valveOffsetX;
      const xPush = x + sgn * V.pushrodOffsetX;
      const isIn = which === 'intake';
      const headDia = isIn ? V.intakeHeadDia : V.exhaustHeadDia;
      const lash = isIn ? V.lashIntake : V.lashExhaust;

      // ---- 挺柱 ----
      const tappet = new THREE.Group();
      tappet.add(U.mesh(U.lathe([
        [0, 0], [V.tappetDia / 2, 0], [V.tappetDia / 2, V.tappetLen - 8],
        [V.tappetDia / 2 - 3, V.tappetLen - 4], [8, V.tappetLen], [0, V.tappetLen - 2],
      ], 28), mats.nitridedSteel));
      // 推杆球窝
      tappet.add(U.mesh(new THREE.SphereGeometry(V.pushrodBallR + 1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        mats.nitridedSteel, [0, V.tappetLen - 3, 0]));
      tappet.position.set(xPush, V.tappetBottomY, V.pushrodZ);
      G.add(tappet);
      world.reg(tappet, isIn ? 'valvetrain.tappetIntake' : 'valvetrain.tappetExhaust', {
        state: (st) => {
          const l = isIn ? st.cyl[i].camLiftIn : st.cyl[i].camLiftEx;
          return `第 ${cyl} 缸${isIn ? '进' : '排'}气挺柱 · 升程 ${l.toFixed(2)} mm · ${l > 0.02 ? '被凸轮顶起' : '位于基圆（无升程）'}`;
        },
      });

      // ---- 推杆 ----
      const pushrod = new THREE.Group();
      const prLen = V.pushrodLen;
      pushrod.add(U.mesh(U.cyl(V.pushrodDia, prLen - 2 * V.pushrodBallR, 14), mats.nitridedSteel));
      for (const s of [-1, 1]) {
        pushrod.add(U.mesh(new THREE.SphereGeometry(V.pushrodBallR, 14, 10), mats.hardChrome,
          [0, s * (prLen / 2 - V.pushrodBallR), 0]));
      }
      G.add(pushrod);
      world.reg(pushrod, isIn ? 'valvetrain.pushrodIntake' : 'valvetrain.pushrodExhaust', {
        state: (st) => {
          const l = isIn ? st.cyl[i].camLiftIn : st.cyl[i].camLiftEx;
          return `第 ${cyl} 缸${isIn ? '进' : '排'}气推杆 · 上顶 ${l.toFixed(2)} mm · 承受压杆稳定性载荷`;
        },
      });

      // ---- 摇臂 ----
      const rocker = new THREE.Group();
      rocker.position.set(xValve, V.rockerPivotY, V.rockerPivotZ);
      const dxPush = xPush - xValve;                     // 推杆侧在 X 上的偏置
      rocker.add(U.mesh(U.tubeX(48, 26.1, 34, 24), mats.nodularIron));      // 轴套/衬套座
      rocker.add(U.mesh(U.tubeX(26.1, 26.1 - 3, 32, 20), mats.bushBronze)); // 摇臂衬套
      // 推杆侧臂（带 X 向斜置）
      {
        const len = Math.hypot(dxPush, V.rockerArmPush);
        const arm = U.mesh(new THREE.BoxGeometry(17, 15, len), mats.nodularIron,
          [dxPush / 2, 0, -V.rockerArmPush / 2], [0, Math.atan2(dxPush, -V.rockerArmPush), 0]);
        rocker.add(arm);
        // 气门间隙调整螺钉 + 锁紧螺母
        rocker.add(U.mesh(U.cyl(13, 26, 12), mats.boltSteel, [dxPush, -7, -V.rockerArmPush]));
        rocker.add(U.mesh(U.cyl(19, 8, 6), mats.boltSteel, [dxPush, 4, -V.rockerArmPush]));
        rocker.add(U.mesh(new THREE.SphereGeometry(V.pushrodBallR + 1.4, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
          mats.hardChrome, [dxPush, -19, -V.rockerArmPush]));
      }
      // 气门侧臂 + 压帽
      {
        const arm = U.mesh(new THREE.BoxGeometry(17, 15, V.rockerArmValve), mats.nodularIron,
          [0, 0, V.rockerArmValve / 2]);
        rocker.add(arm);
        rocker.add(U.mesh(new THREE.BoxGeometry(16, 5, 22), mats.hardChrome, [0, -7.7, V.rockerArmValve]));
      }
      G.add(rocker);
      world.reg(rocker, isIn ? 'valvetrain.rockerIntake' : 'valvetrain.rockerExhaust', {
        state: (st) => {
          const l = isIn ? st.cyl[i].intakeLift : st.cyl[i].exhaustLift;
          return `第 ${cyl} 缸${isIn ? '进' : '排'}气摇臂 · 杠杆比 ${V.rockerRatio} · 气门升程 ${l.toFixed(2)} mm · 冷态间隙 ${lash} mm`;
        },
      });

      // ---- 气门 ----
      const stemR = V.stemDia / 2;
      const valveGeo = U.lathe([
        [0, 0], [headDia / 2 - 4, 0], [headDia / 2, 3.2], [headDia / 2, 5.6],
        [stemR + 8, 11], [stemR, 26], [stemR, V.stemLen - 4], [stemR - 1.2, V.stemLen], [0, V.stemLen],
      ], 40);
      const valve = new THREE.Group();
      const vBody = U.mesh(valveGeo, isIn ? mats.valveSteel : mats.valveFace);
      valve.add(vBody);
      // 锥面硬化带
      valve.add(U.mesh(U.lathe([[headDia / 2 - 4.2, 0.1], [headDia / 2 - 0.1, 3.3], [headDia / 2 - 0.1, 5.5], [headDia / 2 - 4.2, 5.5]], 40),
        mats.valveFace));
      valve.position.set(xValve, y0, V.valveZ);
      G.add(valve);
      world.reg(valve, isIn ? 'valvetrain.valveIntake' : 'valvetrain.valveExhaust', {
        state: (st) => {
          const c = st.cyl[i];
          const l = isIn ? c.intakeLift : c.exhaustLift;
          const opening = isIn ? c.intakeOpening : c.exhaustOpening;
          if (l < 0.05) return `第 ${cyl} 缸${isIn ? '进' : '排'}气门 关闭 · 落座密封（${c.stroke.cn}冲程）`;
          return `第 ${cyl} 缸${isIn ? '进' : '排'}气门 ${opening ? '开启中↓' : '关闭中↑'} · 升程 ${l.toFixed(2)}/${V.valveLift} mm`;
        },
      });

      // ---- 气门弹簧 + 弹簧座 + 锁夹 + 油封 ----
      const spring = U.mesh(U.coilSpring(V.springOD, V.springWire, V.springCoils, V.springInstalledLen, 7),
        mats.springSteel, [xValve, V.springSeatY, V.valveZ]);
      G.add(spring);
      world.reg(spring, isIn ? 'valvetrain.springIntake' : 'valvetrain.springExhaust', {
        state: (st) => {
          const l = isIn ? st.cyl[i].intakeLift : st.cyl[i].exhaustLift;
          const f = 420 + 34 * l;   // 预紧 420N，刚度 34 N/mm
          return `气门弹簧 · 压缩 ${l.toFixed(2)} mm · 弹簧力 ${f.toFixed(0)} N · 自由长 ${V.springFreeLen} mm`;
        },
      });
      const retainer = U.mesh(U.lathe([
        [stemR + 0.5, 0], [V.springOD / 2 + 1, 3], [V.springOD / 2 + 1, 7], [stemR + 6, 11], [stemR + 0.5, 11],
      ], 28), mats.springSteel, [xValve, V.springSeatY + V.springInstalledLen - 6, V.valveZ]);
      G.add(retainer);
      world.reg(retainer, 'valvetrain.retainer', { state: () => '弹簧座（上）+ 两片锥形锁夹，锁在气门杆锁槽内' });
      const keeper = U.mesh(U.lathe([[stemR, 0], [stemR + 4.5, 6], [stemR, 6]], 20), mats.nitridedSteel,
        [xValve, V.springSeatY + V.springInstalledLen - 2, V.valveZ]);
      G.add(keeper);
      world.reg(keeper, 'valvetrain.keeper', { state: () => '锥形锁夹（半月夹）：靠弹簧力自锁' });
      const vseal = U.mesh(U.oring(V.stemDia + 7, 4, 20), mats.rubber, [xValve, V.guideTopY - 4, V.valveZ], [Math.PI / 2, 0, 0]);
      F.add(vseal);
      world.reg(vseal, 'seal.valveStemSeal', { state: () => '气门杆油封：控制机油沿导管下窜（减少机油消耗）' });

      rig.push({ i, cyl, which, isIn, lash, xValve, xPush, tappet, pushrod, rocker, valve, spring, retainer, keeper, dxPush });
    });
  });

  // ==================================================== 动画
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  world.addUpdater((st) => {
    for (const r of rig) {
      const c = st.cyl[r.i];
      const camLift = r.isIn ? c.camLiftIn : c.camLiftEx;
      const valveLift = r.isIn ? c.intakeLift : c.exhaustLift;

      // 挺柱：随凸轮升程平动
      r.tappet.position.y = V.tappetBottomY + camLift;

      // 摇臂：φ = asin(挺柱升程 / 推杆侧臂长)
      const phi = Math.asin(Math.min(0.9, camLift / V.rockerArmPush));
      r.rocker.rotation.x = phi;

      // 推杆：底端在挺柱球窝，顶端跟随摇臂球窝（真实摆动）
      const socketY = V.rockerPivotY + (-1.5 * Math.cos(phi) + V.rockerArmPush * Math.sin(phi));
      const socketZ = V.rockerPivotZ + (-1.5 * Math.sin(phi) - V.rockerArmPush * Math.cos(phi));
      a.set(r.xPush, V.tappetBottomY + camLift + V.tappetLen - 3, V.pushrodZ);
      b.set(r.xValve + r.dxPush, socketY - 3, socketZ);
      alignY(r.pushrod, a, b);

      // 气门：升程扣除气门间隙（冷态间隙可见）
      const disp = Math.max(0, valveLift - r.lash);
      r.valve.position.y = y0 - disp;
      r.retainer.position.y = V.springSeatY + V.springInstalledLen - 6 - disp;
      r.keeper.position.y = V.springSeatY + V.springInstalledLen - 2 - disp;
      r.spring.scale.y = (V.springInstalledLen - disp) / V.springInstalledLen;
    }
  });
}
