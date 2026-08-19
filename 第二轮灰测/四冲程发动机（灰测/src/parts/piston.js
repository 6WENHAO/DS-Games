/**
 * piston.js —— 活塞组（活塞、ω 形燃烧室、三道活塞环、活塞销、卡环）
 *              + 连杆总成（杆身、小头衬套、大头瓦、连杆盖、连杆螺栓）
 *
 * 运动：活塞沿 Y 往复；连杆绕活塞销摆动 β = asin(r·sinθ/L)
 * 说明：LatheGeometry 的轮廓按「外表面自下而上」的顺序给出，保证法线朝外。
 */
import * as THREE from 'three';
import * as U from '../core/util.js';
import { CYL_X } from '../core/params.js';
import { plateYZ, halfShell } from './block.js';

export function build(world) {
  const { P, mats } = world;
  const PS = P.piston, RD = P.rod;
  const G = world.group('crankTrain');

  const top = PS.compHeight;                 // 顶面（销中心为 y=0）
  const bot = top - PS.height;               // 裙部下缘
  const rTop = PS.topLandDia / 2;
  const rSkirt = PS.dia / 2;
  const bowlR = PS.bowlDia / 2, lipR = PS.bowlLipDia / 2;

  // ---------------- 活塞本体轮廓 ----------------
  const pistonGeo = (() => {
    const prof = [
      [0, top - PS.crownThk - 3],                   // 内腔顶（销上方）
      [14, top - PS.crownThk - 3],
      [PS.pinBoreDia / 2 + 13, top - 32],
      [PS.pinBoreDia / 2 + 13, top - 48],
      [rSkirt - 15, top - 54],
      [rSkirt - 15, bot],                            // 裙部内壁
      [rSkirt - 3.5, bot],
      [rSkirt, bot + 7],                             // 裙部外圆（φ104.9）
      [rSkirt, top - 41],
      [rTop, top - 35],                              // 过渡到头部（φ104.4）
    ];
    // 三道环槽（自下而上）
    const grooves = [...PS.ringGrooves].sort((a, b) => b.y - a.y);
    for (const rg of grooves) {
      const gBot = top - rg.y - rg.h / 2, gTop = top - rg.y + rg.h / 2;
      prof.push([rTop, gBot], [rTop - rg.depth, gBot], [rTop - rg.depth, gTop], [rTop, gTop]);
    }
    prof.push([rTop, top - 2.6], [rTop - 2.0, top], [lipR + 2, top]);
    // ω 形燃烧室（向下凹）
    prof.push(
      [lipR, top - 2.2],
      [bowlR, top - PS.bowlDepth * 0.36],
      [bowlR * 0.94, top - PS.bowlDepth],
      [bowlR * 0.55, top - PS.bowlDepth + 3.2],
      [bowlR * 0.2, top - PS.bowlDepth * 0.55],
      [0, top - PS.bowlDepth * 0.42],
    );
    return U.lathe(prof, 72);
  })();

  // 燃烧室表面（深色，单独一层贴合显示）
  const bowlGeo = new THREE.LatheGeometry([
    [0, top - PS.bowlDepth * 0.42 + 0.2],
    [bowlR * 0.2, top - PS.bowlDepth * 0.55 + 0.2],
    [bowlR * 0.55, top - PS.bowlDepth + 3.4],
    [bowlR * 0.94, top - PS.bowlDepth + 0.2],
    [bowlR - 0.2, top - PS.bowlDepth * 0.36],
    [lipR - 0.2, top - 2.2],
  ].map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y)), 72);

  // ---------------- 连杆几何（截面在 (z,y)，厚度沿 X）----------------
  const L = RD.length;
  const seR = RD.smallEndOD / 2, beR = RD.bigEndOD / 2, w = RD.shankW / 2;
  const rodBodyGeo = (() => {
    const pts = [];
    const seg = 22;
    // 小头上半圆：0° → 180°
    for (let i = 0; i <= seg; i++) {
      const a = Math.PI * (i / seg);
      pts.push([Math.cos(a) * seR, Math.sin(a) * seR]);
    }
    // 左侧杆身
    pts.push([-w - 1, -26], [-w - 5, -L * 0.55], [-beR * 0.72, -L + 34]);
    // 大头左侧弧 135° → 180°
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (0.75 + 0.25 * (i / 8));
      pts.push([Math.cos(a) * beR, -L + Math.sin(a) * beR]);
    }
    // 剖分面（连杆盖结合面）
    pts.push([beR, -L]);
    // 大头右侧弧 0° → 45°
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * 0.25 * (i / 8);
      pts.push([Math.cos(a) * beR, -L + Math.sin(a) * beR]);
    }
    pts.push([beR * 0.72, -L + 34], [w + 5, -L * 0.55], [w + 1, -26]);
    const holes = [
      U.circlePts(RD.smallEndID / 2, 28, 0, 0),
      U.circlePts(RD.bigEndID / 2, 34, 0, -L),
    ];
    return plateYZ(pts, RD.shankT, holes);
  })();

  // I 形杆身凸缘
  const rodShankGeo = (() => {
    const g = [];
    for (const sz of [-1, 1]) {
      const b = new THREE.BoxGeometry(RD.shankT + 13, L - 96, 9);
      b.translate(0, -L / 2 - 6, sz * (w - 1));
      g.push(b);
    }
    return U.merge(g);
  })();

  const rodCapGeo = (() => {
    const pts = [];
    const seg = 26;
    for (let i = 0; i <= seg; i++) {
      const a = Math.PI * (1 + i / seg);       // 180° → 360°
      pts.push([Math.cos(a) * beR, Math.sin(a) * beR]);
    }
    // 两侧螺栓耳
    pts.push([beR, -8], [-beR, -8]);
    const holes = [U.circlePts(RD.bigEndID / 2, 34, 0, 0)];
    return plateYZ(pts, RD.shankT, holes);
  })();

  // 活塞环几何（真实环带 + 端隙缺口）
  const ringGeo = (rg, idx) => {
    const rOut = rTop / 1 + 0.25;                    // 环外圆 ≈ 缸径 − 0.1
    const rIn = rOut - rg.depth + 0.5;
    const gap = P.clearance.ringEndGap / rOut;       // 端隙角
    const h = rg.h - P.clearance.ringSide;
    const prof = [
      [rIn, -h / 2], [rOut, -h / 2], [rOut, h / 2], [rIn, h / 2], [rIn, -h / 2],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(prof, 60, idx * 2.09 + gap / 2, Math.PI * 2 - gap);
  };

  // ---------------- 逐缸装配 ----------------
  const asm = [];
  CYL_X.forEach((x, i) => {
    const cyl = i + 1;

    // ======== 活塞总成 ========
    const pistonAsm = new THREE.Group();
    pistonAsm.name = `pistonAssembly${cyl}`;
    const pMesh = U.mesh(pistonGeo, mats.pistonAlloy, [0, 0, 0], [0, 0, 0], `piston${cyl}`);
    const bMesh = U.mesh(bowlGeo, mats.pistonBowl);
    bMesh.material = mats.pistonBowl;
    pistonAsm.add(pMesh, bMesh);
    // 销座
    for (const sz of [-1, 1]) {
      pistonAsm.add(U.mesh(U.tubeX(PS.pinBoreDia + 24, PS.pinBoreDia + 0.06, 20, 28), mats.pistonAlloy,
        [0, 0, sz * 20]));
    }
    world.reg([pMesh, bMesh], 'piston.piston', {
      state: (st) => {
        const c = st.cyl[i];
        return `第 ${cyl} 缸 · ${c.stroke.cn}冲程 · 活塞${c.speed > 0 ? '上行' : '下行'} · 顶面 Y=${c.pistonY.toFixed(1)} mm · ${(Math.abs(c.speed) / 1000).toFixed(2)} m/s`;
      },
    });

    // 活塞环
    PS.ringGrooves.forEach((rg, k) => {
      const ring = U.mesh(ringGeo(rg, k), mats.ringSteel, [0, top - rg.y, 0]);
      ring.material = mats.ringSteel;
      pistonAsm.add(ring);
      const ids = ['piston.ring1', 'piston.ring2', 'piston.ring3'];
      const desc = [
        (st) => `第一道气环 · 背压 ${st.cyl[i].pressure.toFixed(0)} bar 压紧缸壁，密封燃气`,
        () => '第二道气环 · 辅助密封并向下刮油',
        (st) => `组合油环 · 刮下多余机油，油膜厚度 ≈${(2.5 + st.op.oilTemp / 60).toFixed(1)} μm`,
      ];
      world.reg(ring, ids[k], { state: desc[k] });
    });

    // 活塞销 + 卡环
    const pin = U.mesh(U.tubeX(P.pin.dia, P.pin.boreDia, P.pin.length, 32), mats.nitridedSteel);
    pistonAsm.add(pin);
    for (const sx of [-1, 1]) {
      const clip = U.mesh(U.oring(P.pin.dia + 2.5, 2.6, 24), mats.springSteel,
        [sx * (P.pin.length / 2 - 3), 0, 0], [0, 0, Math.PI / 2]);
      pistonAsm.add(clip);
      world.reg(clip, 'piston.pinClip', { state: () => '弹性挡圈：限制活塞销轴向窜动' });
    }
    world.reg(pin, 'piston.pin', {
      state: (st) => `全浮式活塞销 · 承受气体力 ${(st.cyl[i].pressure * 1e5 * Math.PI * (P.bore / 1000) ** 2 / 4 / 1000).toFixed(0)} kN`,
    });

    // ======== 连杆总成 ========
    const rodAsm = new THREE.Group();
    rodAsm.name = `conrodAssembly${cyl}`;
    const rodBody = U.mesh(rodBodyGeo, mats.forgedSteel, [0, 0, 0], [0, 0, 0], `conrod${cyl}`);
    const shank = U.mesh(rodShankGeo, mats.forgedSteel);
    rodAsm.add(rodBody, shank);
    const bush = U.mesh(U.tubeX(RD.smallEndID, P.pin.dia + P.clearance.pinToBush, RD.shankT - 1, 28), mats.bushBronze);
    rodAsm.add(bush);
    world.reg(bush, 'rod.smallEndBush', {
      state: (st) => `锡青铜衬套 · 摆动润滑，间隙 ${P.clearance.pinToBush} mm`,
    });
    const upShell = U.mesh(halfShell(RD.bigEndID / 2, P.crank.rodDia / 2 + P.crank.rodClearance / 2, 0, Math.PI, RD.shankT - 2),
      mats.bearingAlloy, [0, -L, 0]);
    const dnShell = U.mesh(halfShell(RD.bigEndID / 2, P.crank.rodDia / 2 + P.crank.rodClearance / 2, Math.PI, Math.PI * 2, RD.shankT - 2),
      mats.bearingAlloy, [0, -L, 0]);
    rodAsm.add(upShell, dnShell);
    const cap = U.mesh(rodCapGeo, mats.forgedSteel, [0, -L, 0]);
    rodAsm.add(cap);
    for (const sz of [-1, 1]) {
      rodAsm.add(U.mesh(U.hexBolt(19, 12, RD.boltDia, 60), mats.boltSteel,
        [0, -L - beR - 6, sz * (RD.boltSpacing / 2)], [Math.PI, 0, 0]));
    }
    world.reg([rodBody, shank], 'rod.conrod', {
      state: (st) => {
        const c = st.cyl[i];
        return `第 ${cyl} 缸连杆 · 摆角 ${(c.swing * 180 / Math.PI).toFixed(1)}° · ${c.stroke.cn}冲程`;
      },
    });
    world.reg([upShell, dnShell], 'rod.bigEndBearing', {
      state: (st) => `大头瓦 · 间隙 ${P.crank.rodClearance} mm · 峰值油膜压力 ≈${(st.cyl[i].pressure * 0.5).toFixed(0)} bar`,
    });
    world.reg(cap, 'rod.cap', { state: () => '连杆盖 · 与杆身涨断/齿形定位面配对，不可互换' });

    G.add(pistonAsm, rodAsm);
    asm.push({ i, pistonAsm, rodAsm, x });
  });

  // ---------------- 动画 ----------------
  world.addUpdater((st) => {
    for (const a of asm) {
      const c = st.cyl[a.i];
      a.pistonAsm.position.set(a.x, c.pinY, 0);
      a.rodAsm.position.set(a.x, c.pinY, 0);
      a.rodAsm.rotation.x = -c.swing;
    }
  });
}
