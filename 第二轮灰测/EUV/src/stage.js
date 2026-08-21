/**
 * stage.js — 光刻机硬件几何（程序化生成，剖切式）
 * ==================================================================
 * 全部部件的位置与朝向从 layout.js 读取，不在本文件另行摆位。
 * 采用「剖切腔体」表现：真空腔体缺一个观察扇区，观众得以看见内部，
 * 同时腔体本身仍完整成立 —— 这是技术演示动画的通行做法。
 *
 * 返回的 refs 供 script.js / camera.js / fx 模块驱动动画，
 * 每个可动件（掩模台、晶圆台、快门、气帘）都在 refs 中暴露。
 */

import * as THREE from 'three';
import {
  PLASMA, IF_POINT, ELLIPSOID, COLLECTOR_APERTURE, COLLECTOR_VERTEX, COLLECTOR_REF,
  DROPLET_NOZZLE, DROPLET_CATCHER, LASER_ORIGIN,
  ILLUMINATOR, MASK, POB, WAFER, PURITY, CHAIN_BY_KEY,
  collectorPoint, collectorNormal, nodeNormal, mirrorRadius, mm, MM_PER_UNIT, vec,
} from './layout.js';
import {
  curvedDisc, facetedDisc, ellipsoidCollectorGeometry, orient, span, flange, truss, fins,
  mergeGeometries, V3,
} from './geom.js';
import { chipLayout, gridTexture, emissive, srgb } from './materials.js';
import { BRAND } from './config.js';

const C = BRAND.colors;

export function buildStage(scene, mats, quality) {
  const root = new THREE.Group();
  root.name = 'STAGE';
  scene.add(root);

  const refs = {
    groups: {}, labels: [], moving: {}, cutaway: [], housing: [],
  };

  const G = (name) => { const g = new THREE.Group(); g.name = name; root.add(g); refs.groups[name] = g; return g; };

  // ═════════════════════════════════════════════════════════════════
  // A. 源腔体（超高真空）—— 剖切圆柱腔，缺口朝 +Z 观察侧
  // ═════════════════════════════════════════════════════════════════
  const gSource = G('sourceVessel');
  {
    const R = 15.4, L = 30, gapDeg = 132;
    const thetaLen = (360 - gapDeg) * Math.PI / 180;
    // CylinderGeometry 绕 Z 旋转 π/2 后：局部 θ=0 对应世界 +Z。
    // 因此缺口居中于 +Z（观察侧）只需 thetaStart = gapDeg/2，不可再加 π/2。
    const thetaStart = (gapDeg / 2) * Math.PI / 180;

    const shellOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R, L, 128, 1, true, thetaStart, thetaLen), mats.steel);
    const shellInner = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.985, R * 0.985, L, 128, 1, true, thetaStart, thetaLen), mats.innerDark);
    for (const m of [shellOuter, shellInner]) { m.rotation.z = Math.PI / 2; m.position.set(PLASMA.x, 0, 0); }
    // 剖切边缘壁厚
    const edgeGeos = [];
    for (const sgn of [0, 1]) {
      const a = thetaStart + (sgn ? thetaLen : 0);
      const g = new THREE.BoxGeometry(L, R * 0.015, R * 0.99);
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-a, 0, 0));
      m4.makeRotationFromQuaternion(q);
      m4.setPosition(new THREE.Vector3(0, Math.sin(a) * R * 0.5, Math.cos(a) * R * 0.5));
      g.applyMatrix4(m4);
      edgeGeos.push(g);
    }
    const edges = new THREE.Mesh(mergeGeometries(edgeGeos), mats.anodized);
    edges.position.set(PLASMA.x, 0, 0);

    // 端盖：环形（中央留出光路与激光通路）
    const capA = new THREE.Mesh(new THREE.RingGeometry(2.4, R, 96, 1, thetaStart - Math.PI / 2, thetaLen), mats.steel);
    capA.position.set(PLASMA.x - L / 2, 0, 0); capA.rotation.y = -Math.PI / 2; capA.material.side = THREE.DoubleSide;
    const capB = new THREE.Mesh(new THREE.RingGeometry(3.4, R, 96, 1, thetaStart - Math.PI / 2, thetaLen), mats.steel);
    capB.position.set(PLASMA.x + L / 2, 0, 0); capB.rotation.y = Math.PI / 2; capB.material.side = THREE.DoubleSide;

    // 法兰与加强环
    const ribs = new THREE.Group();
    for (const x of [-L / 2 + 2, -6, 6, L / 2 - 2]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(R * 1.012, 0.34, 10, 128, thetaLen), mats.anodized);
      rib.rotation.y = Math.PI / 2; rib.rotation.z = thetaStart;
      rib.position.set(PLASMA.x + x, 0, 0);
      ribs.add(rib);
    }
    // 真空泵接口（下方）
    const pumpPort = new THREE.Group();
    for (const x of [-9, 9]) {
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 4.4, 32), mats.steel);
      neck.position.set(PLASMA.x + x, -R - 1.6, 0);
      const fl = flange(2.1, 3.0, 0.5, 12, mats.anodized, mats.steel);
      fl.rotation.x = Math.PI / 2; fl.position.set(PLASMA.x + x, -R - 3.7, 0);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.9, 4.2, 32), mats.anodized);
      body.position.set(PLASMA.x + x, -R - 6.2, 0);
      pumpPort.add(neck, fl, body);
    }
    gSource.add(shellOuter, shellInner, edges, capA, capB, ribs, pumpPort);
    refs.cutaway.push(shellOuter, shellInner, edges, capA, capB);
  }

  // ═════════════════════════════════════════════════════════════════
  // B. 锡滴发生器（顶部）+ 锡滴捕集器（底部）
  // ═════════════════════════════════════════════════════════════════
  const gDroplet = G('dropletGenerator');
  {
    const nz = V3(DROPLET_NOZZLE);
    // 熔融锡储罐（加热保温）
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 6.2, 48), mats.steel);
    tank.position.set(nz.x, nz.y + 7.2, 0);
    const tankCap = new THREE.Mesh(new THREE.SphereGeometry(2.5, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), mats.steel);
    tankCap.position.set(nz.x, nz.y + 10.3, 0);
    // 加热带
    const heaters = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const h = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.2, 8, 48), mats.copper);
      h.rotation.x = Math.PI / 2; h.position.set(nz.x, nz.y + 5.0 + i * 1.1, 0);
      heaters.add(h);
    }
    // 压电驱动堆叠（决定 50,000 滴/秒的调制频率）
    const piezo = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.22, 32), i % 2 ? mats.ceramic : mats.copper);
      d.position.set(nz.x, nz.y + 3.5 - i * 0.26, 0);
      piezo.add(d);
    }
    // 喷嘴锥
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.16, 1.7, 40), mats.ceramic);
    nozzle.position.set(nz.x, nz.y + 0.9, 0);
    const nozzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.11, 0.35, 24), mats.steel);
    nozzleTip.position.set(nz.x, nz.y + 0.05, 0);
    // 支撑臂
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 5.2, 2.4), mats.anodized);
    arm.position.set(nz.x - 3.0, nz.y + 6.0, 0);
    const armX = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.8, 1.6), mats.anodized);
    armX.position.set(nz.x - 1.6, nz.y + 8.2, 0);

    // 锡滴捕集器（底部）
    const ct = V3(DROPLET_CATCHER);
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 0.7, 3.4, 48, 1, true), mats.steel);
    funnel.material = mats.steel; funnel.position.set(ct.x, ct.y + 1.2, 0);
    const funnelIn = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 0.66, 3.4, 48, 1, true), mats.innerDark);
    funnelIn.position.set(ct.x, ct.y + 1.2, 0);
    const catcherBody = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.0, 40), mats.anodized);
    catcherBody.position.set(ct.x, ct.y - 1.4, 0);
    const catcherFins = fins(18, 2.0, 2.2, 0.14, mats.copper);
    catcherFins.position.set(ct.x, ct.y - 1.4, 0);
    catcherFins.rotation.x = Math.PI / 2;

    gDroplet.add(tank, tankCap, heaters, piezo, nozzle, nozzleTip, arm, armX,
      funnel, funnelIn, catcherBody, catcherFins);
    refs.moving.nozzleTip = nozzleTip;
  }

  // ═════════════════════════════════════════════════════════════════
  // C. 多层膜椭球集光镜（真实椭球面片 + 中心孔）
  // ═════════════════════════════════════════════════════════════════
  const gCollector = G('collector');
  {
    const geo = ellipsoidCollectorGeometry({
      collectorPoint, collectorNormal,
      phiMin: COLLECTOR_APERTURE.phiMin, phiMax: COLLECTOR_APERTURE.phiMax,
      uSeg: quality.taaLevel >= 2 ? 96 : 64, vSeg: quality.taaLevel >= 2 ? 192 : 128,
    });
    const mirror = new THREE.Mesh(geo, mats.multilayer);
    mirror.name = 'COLLECTOR_SURFACE';

    // 背面镜体（略微外扩的同族椭球面，形成壁厚）
    const backGeo = ellipsoidCollectorGeometry({
      collectorPoint: (phi, th) => {
        const p = collectorPoint(phi, th);
        const n = collectorNormal(p.point);
        return { point: { x: p.point.x + n.x * 0.7, y: p.point.y + n.y * 0.7, z: p.point.z + n.z * 0.7 } };
      },
      collectorNormal, phiMin: COLLECTOR_APERTURE.phiMin, phiMax: COLLECTOR_APERTURE.phiMax,
      uSeg: 48, vSeg: 96,
    });
    const back = new THREE.Mesh(backGeo, mats.mirrorBody);
    back.material = mats.mirrorBody.clone(); back.material.side = THREE.BackSide;

    // 冷却管路环（多层膜必须主动冷却，否则周期热膨胀失谐）
    const cool = new THREE.Group();
    for (const phiFrac of [0.28, 0.52, 0.76, 0.95]) {
      const phi = COLLECTOR_APERTURE.phiMin + (COLLECTOR_APERTURE.phiMax - COLLECTOR_APERTURE.phiMin) * phiFrac;
      const pts = [];
      for (let j = 0; j <= 96; j++) {
        const th = (j / 96) * Math.PI * 2;
        const p = collectorPoint(phi, th).point;
        const n = collectorNormal(p);
        pts.push(new THREE.Vector3(p.x + n.x * 0.95, p.y + n.y * 0.95, p.z + n.z * 0.95));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      cool.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 128, 0.22, 8, true), mats.copper));
    }
    // 外缘环与支撑
    const rimPhi = COLLECTOR_APERTURE.phiMax;
    const rimPts = [];
    for (let j = 0; j <= 128; j++) {
      const th = (j / 128) * Math.PI * 2;
      const p = collectorPoint(rimPhi, th).point;
      rimPts.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    const rim = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPts, true), 160, 0.42, 10, true), mats.anodized);

    // 中心孔护圈（CO₂ 驱动激光由此穿过）
    const holePt = collectorPoint(COLLECTOR_APERTURE.phiMin, 0).point;
    const holeR = Math.hypot(holePt.y, holePt.z);
    const holeRing = new THREE.Mesh(new THREE.TorusGeometry(holeR, 0.16, 10, 64), mats.anodized);
    holeRing.position.set(COLLECTOR_VERTEX.x + 0.05, 0, 0);
    holeRing.rotation.y = Math.PI / 2;

    gCollector.add(mirror, back, cool, rim, holeRing);
    refs.moving.collectorSurface = mirror;
  }

  // ═════════════════════════════════════════════════════════════════
  // D. CO₂ 驱动激光链（放大级 + 束传输 + 最终聚焦）
  // ═════════════════════════════════════════════════════════════════
  const gLaser = G('driveLaser');
  {
    const y0 = 0;
    // 主振荡器 + 放大级（MOPA 链）
    for (let i = 0; i < 4; i++) {
      const x = LASER_ORIGIN.x + 2.5 + i * 5.6;
      const amp = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.2, 3.2), mats.anodized);
      amp.position.set(x, y0, 0);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 5.6, 24), mats.steel);
      tube.rotation.z = Math.PI / 2; tube.position.set(x + 2.8, y0, 0);
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), emissive(C.warn, 2.2));
      led.position.set(x, y0 + 1.72, 1.2);
      gLaser.add(amp, tube, led);
    }
    // 束传输管到集光镜背后
    const tubeStart = LASER_ORIGIN.x + 25.5;
    const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, COLLECTOR_VERTEX.x - tubeStart, 28), mats.steel);
    bt.rotation.z = Math.PI / 2;
    bt.position.set((tubeStart + COLLECTOR_VERTEX.x) / 2, y0, 0);
    // 最终聚焦组件（穿过集光镜中心孔）
    const foc = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 0.72, 2.4, 36), mats.anodized);
    foc.rotation.z = -Math.PI / 2;
    foc.position.set(COLLECTOR_VERTEX.x - 2.0, y0, 0);
    gLaser.add(bt, foc);
  }

  // ═════════════════════════════════════════════════════════════════
  // E. 氢气碎屑防护 + 光谱纯化 + 中间焦点限束孔
  // ═════════════════════════════════════════════════════════════════
  const gPurity = G('purity');
  {
    // 氢气环形喷嘴（两道气帘）
    for (const p of [PURITY.gasCurtain.from, PURITY.gasCurtain.to]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(PURITY.gasCurtain.radius, 0.24, 10, 64), mats.steel);
      ring.position.set(p.x, 0, 0); ring.rotation.y = Math.PI / 2;
      const jets = new THREE.Group();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const j = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 8), mats.ceramic);
        j.position.set(p.x, Math.sin(a) * (PURITY.gasCurtain.radius - 0.3), Math.cos(a) * (PURITY.gasCurtain.radius - 0.3));
        j.lookAt(p.x, 0, 0);
        jets.add(j);
      }
      // 氢气供气管
      const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.2, 16), mats.copper);
      feed.position.set(p.x, PURITY.gasCurtain.radius + 1.6, 0);
      gPurity.add(ring, jets, feed);
    }
    // 光谱纯化组件（滤除 10.6 µm 红外与带外辐射）
    const spf = new THREE.Mesh(new THREE.CylinderGeometry(PURITY.spf.radius, PURITY.spf.radius, 0.5, 64), mats.anodized);
    spf.rotation.z = Math.PI / 2; spf.position.set(PURITY.spf.pos.x, 0, 0);
    const spfMesh = new THREE.Mesh(new THREE.CylinderGeometry(PURITY.spf.radius * 0.86, PURITY.spf.radius * 0.86, 0.06, 64),
      new THREE.MeshPhysicalMaterial({ color: srgb('#5d6d7d'), metalness: 1, roughness: 0.22, side: THREE.DoubleSide }));
    spfMesh.rotation.z = Math.PI / 2; spfMesh.position.set(PURITY.spf.pos.x, 0, 0);
    // 中间焦点限束孔（IF aperture）
    const ap = new THREE.Mesh(new THREE.RingGeometry(PURITY.ifAperture.radius, 2.6, 64), mats.anodized);
    ap.position.set(IF_POINT.x, 0, 0); ap.rotation.y = Math.PI / 2; ap.material.side = THREE.DoubleSide;
    const apCone = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.2, 2.0, 48, 1, true), mats.innerDark);
    apCone.rotation.z = Math.PI / 2; apCone.position.set(IF_POINT.x - 1.2, 0, 0);
    gPurity.add(spf, spfMesh, ap, apCone);
    refs.moving.spf = spfMesh;
    refs.moving.ifAperture = ap;
  }

  // ═════════════════════════════════════════════════════════════════
  // F. 照明光学系统（场面镜 / 光瞳面镜 / 末镜）
  // ═════════════════════════════════════════════════════════════════
  const gIllum = G('illuminator');
  const mirrorRefs = {};
  {
    for (const m of ILLUMINATOR.mirrors) {
      const r = mirrorRadius(m.key);
      const holder = new THREE.Group();
      holder.name = m.key;
      const isFacet = m.shape === 'faceted';
      const surf = new THREE.Mesh(
        isFacet ? facetedDisc(r, 0.3, 0.055, m.key === 'ILL_FIELD' ? 5 : 9) : curvedDisc(r, r * 0.11, 72, 26),
        mats.multilayer);
      surf.name = m.key + '_SURFACE';
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.06, r * 1.12, 0.9, 64), mats.mirrorBody);
      body.rotation.x = Math.PI / 2; body.position.z = -0.62;
      const back = fins(20, r * 1.05, 0.8, 0.1, mats.copper);
      back.position.z = -1.15;
      holder.add(surf, body, back);
      orient(holder, m.pos, m.normal);
      gIllum.add(holder);
      mirrorRefs[m.key] = { holder, surf, radius: r };
      refs.labels.push({ key: m.key, pos: m.pos, zh: m.zh, en: m.en, step: 'illuminator' });
    }
    // 照明系统外壳（开放桁架，可见内部）
    const t = truss(9, 26, 8, 0.16, mats.anodized, 2, 4);
    t.position.set(-6.0, 10.0, 0);
    gIllum.add(t);
  }

  // ═════════════════════════════════════════════════════════════════
  // G. 反射式多层膜掩模 + 掩模台
  // ═════════════════════════════════════════════════════════════════
  const gMask = G('maskStage');
  {
    const holder = new THREE.Group(); holder.name = 'MASK_HOLDER';
    const bw = MASK.blank.w, bh = MASK.blank.h, bt = MASK.blank.t;
    // 石英基板
    const sub = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bt), mats.maskSubstrate);
    sub.position.z = -bt / 2 - 0.02;
    // Mo/Si 多层膜面（朝向入射光）
    const ml = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), mats.multilayer);
    // 图形化吸收层（TaBN）—— 与晶圆共用同一版图数据
    const absorberMat = new THREE.MeshPhysicalMaterial({
      map: chipLayout(1024, 'mask'), color: 0xffffff,
      metalness: 0.55, roughness: 0.42, transparent: true,
      alphaMap: chipLayout(1024, 'mask'), side: THREE.DoubleSide,
      envMap: mats.multilayer.envMap, envMapIntensity: 0.7,
    });
    const abs = new THREE.Mesh(new THREE.PlaneGeometry(MASK.field.w, MASK.field.h), absorberMat);
    abs.position.z = 0.012;
    // 图形场边框标记
    const fieldEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(MASK.field.w, MASK.field.h)), mats.hudLine);
    fieldEdge.position.z = 0.02;
    // 掩模夹持与台体
    const chuck = new THREE.Mesh(new THREE.BoxGeometry(bw * 1.22, bh * 1.22, 0.7), mats.anodized);
    chuck.position.z = -bt - 0.42;
    const stageBar = new THREE.Mesh(new THREE.BoxGeometry(bw * 2.9, 0.55, 1.5), mats.anodized);
    stageBar.position.z = -bt - 1.1;
    // 直线电机定子
    const motor = new THREE.Mesh(new THREE.BoxGeometry(bw * 3.4, 0.9, 2.4), mats.steel);
    motor.position.set(0, 0, -bt - 2.2);
    holder.add(sub, ml, abs, fieldEdge, chuck, stageBar, motor);
    orient(holder, MASK.pos, MASK.normal);
    gMask.add(holder);
    // 掩模台在其自身平面内扫描（局部 X 方向）
    refs.moving.maskHolder = holder;
    refs.moving.maskScanNode = new THREE.Group();
    refs.moving.maskAbsorber = abs;
    refs.moving.maskMultilayer = ml;
    refs.labels.push({ key: 'MASK', pos: MASK.pos, zh: '反射式多层膜掩模', en: 'Reflective Multilayer Mask', step: 'mask' });
  }

  // ═════════════════════════════════════════════════════════════════
  // H. 投影物镜 POB（6 片非球面反射镜 + 桁架镜筒）
  // ═════════════════════════════════════════════════════════════════
  const gPob = G('projectionOptics');
  {
    for (const m of POB) {
      const r = mirrorRadius(m.key);
      const holder = new THREE.Group(); holder.name = m.key;
      const sag = (m.shape === 'convex' ? -1 : 1) * r * 0.14;
      const surf = new THREE.Mesh(curvedDisc(r, sag, 80, 28), mats.multilayer);
      surf.name = m.key + '_SURFACE';
      const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.07, r * 1.16, 1.1, 72), mats.mirrorBody);
      body.rotation.x = Math.PI / 2; body.position.z = -0.75;
      const back = fins(22, r * 1.06, 1.0, 0.1, mats.copper);
      back.position.z = -1.4;
      // 三点柔性支撑（纳米级面形稳定）
      const sup = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 10), mats.steel);
        rod.position.set(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, -2.1);
        sup.add(rod);
      }
      holder.add(surf, body, back, sup);
      orient(holder, m.pos, m.normal);
      gPob.add(holder);
      mirrorRefs[m.key] = { holder, surf, radius: r };
      refs.labels.push({ key: m.key, pos: m.pos, zh: m.zh, en: m.en, step: 'projection' });
    }
    // 镜筒桁架：包住 6 片镜
    const ys = POB.map((m) => m.pos.y), xs = POB.map((m) => m.pos.x);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const t = truss(Math.max(...xs) - Math.min(...xs) + 9, Math.max(...ys) - Math.min(...ys) + 7, 9, 0.19, mats.anodized, 2, 5);
    t.position.set(cx, cy, 0);
    gPob.add(t);
  }

  // ═════════════════════════════════════════════════════════════════
  // I. 晶圆台
  // ═════════════════════════════════════════════════════════════════
  const gWafer = G('waferStage');
  {
    const holder = new THREE.Group(); holder.name = 'WAFER_HOLDER';
    const rW = WAFER.diameter / 2;
    // 硅晶圆
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(rW, rW, mm(0.775), 128), mats.silicon);
    disc.rotation.x = Math.PI / 2;
    // 光刻胶膜
    const resistFilm = new THREE.Mesh(new THREE.CircleGeometry(rW * 0.985, 128), mats.resist);
    resistFilm.position.z = mm(0.775) / 2 + 0.004;
    // 已曝光芯片阵列（显影后图形）—— 与掩模共用同一版图
    const chipMat = new THREE.MeshPhysicalMaterial({
      map: chipLayout(1024, 'wafer'), metalness: 0.86, roughness: 0.16,
      iridescence: 0.7, iridescenceIOR: 1.55, iridescenceThicknessRange: [220, 640],
      envMap: mats.multilayer.envMap, envMapIntensity: 1.3,
      transparent: true, opacity: 0,
    });
    const chips = new THREE.Group();
    const fw = WAFER.field.w, fh = WAFER.field.h;
    const nx = Math.ceil(rW * 2 / fw), ny = Math.ceil(rW * 2 / fh);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const x = (i - (nx - 1) / 2) * fw, y = (j - (ny - 1) / 2) * fh;
      if (Math.hypot(Math.abs(x) + fw / 2, Math.abs(y) + fh / 2) > rW * 0.98) continue;
      const c = new THREE.Mesh(new THREE.PlaneGeometry(fw * 0.94, fh * 0.94), chipMat);
      c.position.set(x, y, mm(0.775) / 2 + 0.012);
      c.userData.field = { i, j, x, y };
      chips.add(c);
    }
    // 晶圆吸盘
    const chuck = new THREE.Mesh(new THREE.CylinderGeometry(rW * 1.04, rW * 1.1, 0.55, 96), mats.ceramic);
    chuck.rotation.x = Math.PI / 2; chuck.position.z = -0.3;
    // 台体 + 直线电机 + 干涉仪测量镜
    const stageBody = new THREE.Mesh(new THREE.BoxGeometry(rW * 2.6, rW * 2.6, 0.9), mats.anodized);
    stageBody.position.z = -1.05;
    const ifmA = new THREE.Mesh(new THREE.BoxGeometry(rW * 2.6, 0.5, 0.7), mats.multilayer);
    ifmA.position.set(0, -rW * 1.35, -0.5);
    const ifmB = new THREE.Mesh(new THREE.BoxGeometry(0.5, rW * 2.6, 0.7), mats.multilayer);
    ifmB.position.set(-rW * 1.35, 0, -0.5);
    holder.add(disc, resistFilm, chips, chuck, stageBody, ifmA, ifmB);
    orient(holder, WAFER.pos, WAFER.normal);
    gWafer.add(holder);

    // 长行程台导轨
    const rails = new THREE.Group();
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(rW * 5.2, 0.6, 0.9), mats.steel);
      rail.position.set(WAFER.pos.x, WAFER.pos.y - 1.9, s * rW * 1.7);
      rails.add(rail);
    }
    gWafer.add(rails);

    refs.moving.waferHolder = holder;
    refs.moving.waferDisc = disc;
    refs.moving.resistFilm = resistFilm;
    refs.moving.chips = chips;
    refs.moving.chipMat = chipMat;
    refs.labels.push({ key: 'WAFER', pos: WAFER.pos, zh: '晶圆 / 光刻胶', en: 'Wafer / Photoresist', step: 'exposure' });
  }

  // ═════════════════════════════════════════════════════════════════
  // I-b. 扫描机真空腔（照明 + 掩模 + 投影 + 晶圆同处真空中）
  //      剖切式：+Z 观察面敞开。EUV 在任何气体中都会被吸收，
  //      因此不只是光源腔，整条下游光路同样必须在真空里 ——
  //      缺少此结构本身即为科学性错误，同时也让画面失去体量与照度参考。
  // ═════════════════════════════════════════════════════════════════
  const gScanner = G('scannerVessel');
  {
    const xs = [...ILLUMINATOR.mirrors.map((m) => m.pos.x), MASK.pos.x, ...POB.map((m) => m.pos.x), WAFER.pos.x];
    const ys = [...ILLUMINATOR.mirrors.map((m) => m.pos.y), MASK.pos.y, ...POB.map((m) => m.pos.y), WAFER.pos.y];
    const pad = 6.4;
    const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
    const y0 = Math.min(...ys) - pad - 2.6, y1 = Math.max(...ys) + pad;
    const z1 = 11.8, z0 = -11.8;
    const W = x1 - x0, H = y1 - y0, D = z1 - z0;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const wall = 0.55;

    const panel = (w, h, d, px, py, pz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats.steel);
      m.position.set(px, py, pz);
      return m;
    };
    // 后壁 / 左壁 / 右壁 / 顶 / 底（前面 +Z 敞开作剖切观察面）
    gScanner.add(
      panel(W, H, wall, cx, cy, z0),
      panel(wall, H, D, x0, cy, 0),
      panel(wall, H, D, x1, cy, 0),
      panel(W, wall, D, cx, y1, 0),
      panel(W, wall, D, cx, y0, 0),
    );
    // 内壁（吸光但可读）
    const innerMat = new THREE.MeshPhysicalMaterial({
      color: srgb('#2a3542'), metalness: 0.26, roughness: 0.7,
      envMap: mats.steel.envMap, envMapIntensity: 0.95,
    });
    const inBack = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, H - 0.2), innerMat);
    inBack.position.set(cx, cy, z0 + wall / 2 + 0.04);
    const inLeft = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.2, H - 0.2), innerMat);
    inLeft.position.set(x0 + wall / 2 + 0.04, cy, 0); inLeft.rotation.y = Math.PI / 2;
    const inRight = new THREE.Mesh(new THREE.PlaneGeometry(D - 0.2, H - 0.2), innerMat);
    inRight.position.set(x1 - wall / 2 - 0.04, cy, 0); inRight.rotation.y = -Math.PI / 2;
    const inTop = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, D - 0.2), innerMat);
    inTop.position.set(cx, y1 - wall / 2 - 0.04, 0); inTop.rotation.x = Math.PI / 2;
    const inBottom = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, D - 0.2), innerMat);
    inBottom.position.set(cx, y0 + wall / 2 + 0.04, 0); inBottom.rotation.x = -Math.PI / 2;
    gScanner.add(inBack, inLeft, inRight, inTop, inBottom);

    // 剖切前沿框：说明此处是被剖开的，而非本来无壁
    const lipT = 0.95;
    for (const [w, h, px, py] of [[W, lipT, cx, y1 - lipT / 2], [W, lipT, cx, y0 + lipT / 2],
                                  [lipT, H, x0 + lipT / 2, cy], [lipT, H, x1 - lipT / 2, cy]]) {
      const lip = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.5), mats.anodized);
      lip.position.set(px, py, z1 - 0.75);
      gScanner.add(lip);
    }
    // 加强筋
    for (let i = 1; i < 5; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.7, H - 1.6, 1.15), mats.anodized);
      rib.position.set(x0 + (W * i) / 5, cy, z0 + 1.25);
      gScanner.add(rib);
    }
    for (let i = 1; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(W - 1.6, 0.7, 0.95), mats.anodized);
      rib.position.set(cx, y0 + (H * i) / 4, z0 + 1.15);
      gScanner.add(rib);
    }
    // 真空泵接口
    for (const py of [y0 + H * 0.22, y0 + H * 0.62]) {
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 3.6, 28), mats.steel);
      neck.rotation.z = Math.PI / 2; neck.position.set(x1 + 2.0, py, 0);
      const fl = flange(1.7, 2.5, 0.45, 12, mats.anodized, mats.steel);
      fl.rotation.y = Math.PI / 2; fl.position.set(x1 + 3.9, py, 0);
      gScanner.add(neck, fl);
    }
    // 线缆槽与冷却总管
    for (const pz of [-6.6, 6.6]) {
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.9, H - 3.2, 1.5), mats.anodized);
      tray.position.set(x0 + 1.7, cy, pz);
      gScanner.add(tray);
      for (let i = 0; i < 9; i++) {
        const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, H - 4.4, 8), mats.copper);
        cable.position.set(x0 + 1.7 + (i % 3 - 1) * 0.33, cy, pz + (Math.floor(i / 3) - 1) * 0.39);
        gScanner.add(cable);
      }
    }
    const coolant = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, H - 2.2, 14), mats.copper);
    coolant.position.set(x1 - 1.8, cy, z0 + 2.3);
    gScanner.add(coolant);
    // 掩模换模端口
    const loadPort = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 2.4, 32), mats.steel);
    loadPort.position.set(MASK.pos.x, y1 + 1.2, 0);
    gScanner.add(loadPort);
    // 源腔 → 扫描机的过渡束管（中间焦点所在）
    const link = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.9, Math.abs(x0 - (IF_POINT.x - 1.0)), 40, 1, true), mats.steel);
    link.rotation.z = Math.PI / 2;
    link.position.set((x0 + IF_POINT.x - 1.0) / 2, 0, 0);
    gScanner.add(link);

    refs.scannerBounds = { x0, x1, y0, y1, z0, z1, cx, cy, W, H, D };
  }

  // ═════════════════════════════════════════════════════════════════
  // J. 机架、隔振与地面参考
  // ═════════════════════════════════════════════════════════════════
  const gFrame = G('frame');
  {
    const baseY = Math.min(DROPLET_CATCHER.y, WAFER.pos.y) - 7.5;
    const base = new THREE.Mesh(new THREE.BoxGeometry(112, 2.2, 34), mats.anodized);
    base.position.set(-14, baseY, 0);
    base.receiveShadow = true;
    // 隔振器
    for (let i = 0; i < 6; i++) {
      const x = -62 + i * 19;
      for (const z of [-13, 13]) {
        const iso = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 2.6, 24), mats.steel);
        iso.position.set(x, baseY - 2.4, z);
        gFrame.add(iso);
      }
    }
    // 支撑立柱到各子系统
    const columns = [
      { x: WAFER.pos.x, top: WAFER.pos.y - 2.6 },
      { x: MASK.pos.x - 3.2, top: MASK.pos.y - 1.0 },
      { x: PLASMA.x, top: DROPLET_CATCHER.y - 3.6 },
    ];
    for (const c of columns) {
      const h = c.top - (baseY + 1.1);
      if (h <= 0) continue;
      const col = new THREE.Mesh(new THREE.BoxGeometry(2.4, h, 2.4), mats.anodized);
      col.position.set(c.x, baseY + 1.1 + h / 2, 0);
      gFrame.add(col);
    }
    // 地面参考网格（HUD 风格，不受光）
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(260, 130),
      new THREE.MeshBasicMaterial({ map: gridTexture(512, 8), transparent: true, opacity: 0.16, depthWrite: false }));
    grid.rotation.x = -Math.PI / 2;
    grid.position.set(-14, baseY - 3.9, 0);
    grid.material.map.repeat.set(13, 6.5);
    gFrame.add(base, grid);
    refs.baseY = baseY;
  }

  // ═════════════════════════════════════════════════════════════════
  // K. 外壳板（开场镜头用，随后溶解露出内部）
  // ═════════════════════════════════════════════════════════════════
  const gHousing = G('housing');
  {
    const panelMat = new THREE.MeshPhysicalMaterial({
      color: srgb('#79848f'), metalness: 0.20, roughness: 0.48,
      clearcoat: 0.5, clearcoatRoughness: 0.3,
      envMap: mats.steel.envMap, envMapIntensity: 0.42,
      transparent: true, opacity: 1,
    });
    const panels = [];
    const mk = (w, h, d, x, y, z) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), panelMat);
      p.position.set(x, y, z);
      panels.push(p); gHousing.add(p);
      return p;
    };
    const baseY = refs.baseY;
    // 源模块外壳
    mk(38, 40, 40, PLASMA.x, baseY + 21, 0);
    // 扫描机模块外壳
    mk(46, 54, 40, 6, baseY + 28, 0);
    // 激光模块外壳
    mk(30, 16, 20, LASER_ORIGIN.x + 12, baseY + 9, 0);
    refs.housing = panels;
    refs.moving.housingMat = panelMat;
  }

  refs.mirrorRefs = mirrorRefs;
  refs.root = root;

  /**
   * 阴影策略（§1.3 无闪烁 / 画面可读性）：
   * 只让「机架 + 外壳板」投射阴影。真空腔壳体、桁架、镜体一律不投影 ——
   * 否则剖切腔体内部会被自身壳体的阴影完全遮黑（这是本项目实测到的真实缺陷）。
   */
  const NO_CAST = new Set(['sourceVessel', 'scannerVessel', 'collector', 'illuminator', 'projectionOptics', 'purity', 'driveLaser', 'maskStage', 'waferStage']);
  for (const [name, grp] of Object.entries(refs.groups)) {
    const allowCast = quality.shadows && !NO_CAST.has(name);
    grp.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = true;
      const r = o.geometry?.boundingSphere?.radius ?? 0;
      o.castShadow = allowCast && r > 2.0;
      o.receiveShadow = quality.shadows && r > 1.2;
    });
  }

  return refs;
}
