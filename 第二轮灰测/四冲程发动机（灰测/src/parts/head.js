/**
 * head.js —— 气缸盖总成：缸盖本体、进/排气道（半透明示意腔）、气门导管、
 *            气门座圈、喷油器铜套、推杆护套孔、进/排气法兰、气门室罩盖、
 *            缸盖水套（由 cooling 模块补充缸体水套）
 */
import * as THREE from 'three';
import * as U from '../core/util.js';
import { CYL_X } from '../core/params.js';
import { plateXZ } from './block.js';

export function build(world) {
  const { P, mats } = world;
  const H = P.head, V = P.valvetrain;
  const G = world.group('housing');
  const F = world.group('fasteners');
  const FV = world.group('fluidVol');

  const y0 = 330 + H.gasketThk;      // 缸盖底平面
  const yTop = H.topY;               // 缸盖顶面 434
  const geos = [];

  // ---------- 缸盖底板（含气门口、喷油器孔、推杆孔）----------
  {
    const outline = [[-350, -H.halfWidthZ], [350, -H.halfWidthZ], [350, H.halfWidthZ], [-350, H.halfWidthZ]];
    const holes = [];
    for (const x of CYL_X) {
      holes.push(U.circlePts(V.intakeHeadDia / 2 + 1, 28, x - V.valveOffsetX, V.valveZ));
      holes.push(U.circlePts(V.exhaustHeadDia / 2 + 1, 28, x + V.valveOffsetX, V.valveZ));
      holes.push(U.circlePts(14, 20, x, 34));                                    // 喷油器
      holes.push(U.circlePts(11, 14, x - V.pushrodOffsetX, V.pushrodZ));         // 推杆
      holes.push(U.circlePts(11, 14, x + V.pushrodOffsetX, V.pushrodZ));
    }
    for (const x of CYL_X.flatMap((x) => [x - 50, x + 50])) for (const z of [-74, 74]) holes.push(U.circlePts(9, 10, x, z));
    const g = plateXZ(outline, 30, holes);
    g.translate(0, y0 + 15, 0);
    geos.push(g);
  }
  // ---------- 缸盖侧壁 / 端壁 / 缸间隔板 ----------
  for (const z of [-116, 116]) {
    const g = new THREE.BoxGeometry(700, yTop - y0 - 30, 12);
    g.translate(0, (y0 + 30 + yTop) / 2, z);
    geos.push(g);
  }
  for (const x of [-344, 344]) {
    const g = new THREE.BoxGeometry(12, yTop - y0 - 30, 232);
    g.translate(x, (y0 + 30 + yTop) / 2, 0);
    geos.push(g);
  }
  for (const x of [-130, 0, 130]) {
    const g = new THREE.BoxGeometry(12, yTop - y0 - 30, 232);
    g.translate(x, (y0 + 30 + yTop) / 2, 0);
    geos.push(g);
  }
  // ---------- 缸盖顶板（摇臂座安装面）----------
  {
    const outline = [[-350, -H.halfWidthZ], [350, -H.halfWidthZ], [350, H.halfWidthZ], [-350, H.halfWidthZ]];
    const holes = [];
    for (const x of CYL_X) {
      holes.push(U.circlePts(20, 20, x, 34));
      holes.push(U.circlePts(13, 14, x - V.pushrodOffsetX, V.pushrodZ));
      holes.push(U.circlePts(13, 14, x + V.pushrodOffsetX, V.pushrodZ));
      holes.push(U.circlePts(11, 14, x - V.valveOffsetX, V.valveZ));
      holes.push(U.circlePts(11, 14, x + V.valveOffsetX, V.valveZ));
    }
    const g = plateXZ(outline, 16, holes);
    g.translate(0, yTop - 8, 0);
    geos.push(g);
  }
  // ---------- 气门弹簧座凹台 ----------
  for (const x of CYL_X) {
    for (const dx of [-V.valveOffsetX, V.valveOffsetX]) {
      const g = U.tubeShell(58, V.springOD + 3, 12, 24);
      g.translate(x + dx, V.springSeatY - 6, V.valveZ);
      geos.push(g);
    }
  }
  // ---------- 进/排气法兰 ----------
  for (const [z, sign] of [[-H.halfWidthZ - 8, -1], [H.halfWidthZ + 8, 1]]) {
    const outline = [];
    // 竖直法兰板：截面在 (x,y) 平面，厚度沿 Z
    const pts = [[-350, y0 + 34], [350, y0 + 34], [350, y0 + 76], [-350, y0 + 76]];
    const holes = CYL_X.map((x) => U.circlePts(H.portDia / 2, 24, x + sign * V.valveOffsetX, y0 + 55));
    for (const x of CYL_X) { holes.push(U.circlePts(6, 10, x + sign * V.valveOffsetX - 42, y0 + 55)); holes.push(U.circlePts(6, 10, x + sign * V.valveOffsetX + 42, y0 + 55)); }
    const g = U.extrudePoly(pts, 16, { holes });
    g.translate(0, 0, z);
    geos.push(g);
    void outline;
  }
  // ---------- 摇臂轴支座（5 个）----------
  for (const x of [-260, -130, 0, 130, 260]) {
    const post = new THREE.BoxGeometry(34, 40, 44);
    post.translate(x, yTop + 12, V.rockerPivotZ);
    geos.push(post);
  }

  const headMesh = U.mesh(U.merge(geos), mats.castIronHead, [0, 0, 0], [0, 0, 0], 'cylinderHead');
  G.add(headMesh);
  world.reg(headMesh, 'head.cylinderHead', {
    state: (st) => `底面承受 ${st.cyl[0].pressure.toFixed(0)} bar 燃气压力 · 排气门座区温度 ≈${(st.op.egt * 0.42 + 120).toFixed(0)}℃`,
    explode: [0, 260, 0],
  });

  // ---------- 气门导管 ----------
  const guides = new THREE.Group();
  for (const x of CYL_X) {
    for (const dx of [-V.valveOffsetX, V.valveOffsetX]) {
      const len = V.guideTopY - V.guideBottomY;
      guides.add(U.mesh(U.tubeShell(20, V.guideBore, len, 24), mats.bushBronze,
        [x + dx, (V.guideBottomY + V.guideTopY) / 2, V.valveZ]));
    }
  }
  G.add(guides);
  world.reg(guides, 'head.valveGuide', {
    state: () => `气门导管 · 杆-管间隙 ${P.clearance.valveStemToGuide} mm（保证导向与散热）`,
  });

  // ---------- 气门座圈 ----------
  const seats = new THREE.Group();
  for (const x of CYL_X) {
    for (const [dx, hd] of [[-V.valveOffsetX, V.intakeHeadDia], [V.valveOffsetX, V.exhaustHeadDia]]) {
      const g = U.lathe([
        [hd / 2 - 5, 0], [hd / 2 + 6, 0], [hd / 2 + 6, 9], [hd / 2 - 1.2, 9],
        [hd / 2 - 5.2, 4.4], [hd / 2 - 5, 0],
      ], 32);
      seats.add(U.mesh(g, mats.valveFace, [x + dx, y0, V.valveZ]));
    }
  }
  G.add(seats);
  world.reg(seats, 'head.valveSeat', {
    state: () => `45° 硬质合金座圈 · 密封带宽 ${V.seatWidth} mm，冷镶入缸盖`,
  });

  // ---------- 喷油器铜套 ----------
  const sleeves = new THREE.Group();
  for (const x of CYL_X) {
    sleeves.add(U.mesh(U.tubeShell(34, 27, 104, 24), mats.copper, [x, y0 + 52, 34]));
  }
  G.add(sleeves);
  world.reg(sleeves, 'head.injectorSleeve', {
    state: (st) => `喷油器铜套 · 直接被冷却液包围，喷嘴区温度 ≈${(st.op.egt * 0.3 + 140).toFixed(0)}℃`,
  });

  // ---------- 推杆护孔（铸孔内壁示意）----------
  const prTubes = new THREE.Group();
  for (const x of CYL_X) {
    for (const dx of [-V.pushrodOffsetX, V.pushrodOffsetX]) {
      prTubes.add(U.mesh(U.tubeShell(22, 15, yTop - y0, 16), mats.castIronHead,
        [x + dx, (y0 + yTop) / 2, V.pushrodZ]));
    }
  }
  G.add(prTubes);
  world.reg(prTubes, 'head.pushrodBore', { state: () => '推杆铸孔：兼作缸盖回油通道' });

  // ---------- 进气道 / 排气道（半透明示意腔）----------
  const ports = new THREE.Group();
  CYL_X.forEach((x, i) => {
    const xi = x - V.valveOffsetX, xe = x + V.valveOffsetX;
    const inPort = U.pipeFromPoints([
      [xi, y0 + 55, -H.halfWidthZ - 10], [xi, y0 + 52, -84], [xi, y0 + 44, -46],
      [xi, y0 + 24, -20], [xi, y0 + 3, V.valveZ],
    ], H.portDia, 16, 0.5);
    const im = U.mesh(inPort.geo, mats.intakeVol);
    const exPort = U.pipeFromPoints([
      [xe, y0 + 3, V.valveZ], [xe, y0 + 24, 22], [xe, y0 + 44, 52],
      [xe, y0 + 52, 88], [xe, y0 + 55, H.halfWidthZ + 10],
    ], H.portDia - 6, 16, 0.5);
    const em = U.mesh(exPort.geo, mats.exhaustVol);
    ports.add(im, em);
    world.reg(im, 'head.intakePort', {
      state: (st) => `第 ${i + 1} 缸进气道 · 气门升程 ${st.cyl[i].intakeLift.toFixed(1)} mm · ${st.cyl[i].intakeLift > 0.2 ? '正在进气（涡流进气道）' : '关闭'}`,
    });
    world.reg(em, 'head.exhaustPort', {
      state: (st) => `第 ${i + 1} 缸排气道 · 气门升程 ${st.cyl[i].exhaustLift.toFixed(1)} mm · 排温 ${st.op.egt.toFixed(0)}℃`,
    });
    world.userDataPorts = world.userDataPorts || [];
    world.userDataPorts.push({ i, inCurve: inPort.curve, exCurve: exPort.curve });
  });
  FV.add(ports);

  // ---------- 缸盖水套（示意腔）----------
  const jacket = new THREE.Group();
  for (const x of CYL_X) {
    const g = U.roundBox(112, 34, 190, 14);
    jacket.add(U.mesh(g, mats.coolantVol, [x, y0 + 46, 0]));
  }
  FV.add(jacket);
  world.reg(jacket, 'head.waterJacket', {
    state: (st) => `缸盖水套 · 冷却液 ${st.op.coolantTemp.toFixed(0)}℃ · 重点冷却气门座与喷油器套`,
  });

  // ---------- 气门室罩盖 ----------
  {
    const cg = [];
    const top = plateXZ([[-352, -120], [352, -120], [352, 120], [-352, 120]], 8, null);
    top.translate(0, H.coverTopY - 4, 0);
    cg.push(top);
    for (const z of [-118, 118]) {
      const g = new THREE.BoxGeometry(704, H.coverTopY - yTop - 8, 5);
      g.translate(0, (yTop + H.coverTopY - 8) / 2, z);
      cg.push(g);
    }
    for (const x of [-350, 350]) {
      const g = new THREE.BoxGeometry(5, H.coverTopY - yTop - 8, 236);
      g.translate(x, (yTop + H.coverTopY - 8) / 2, 0);
      cg.push(g);
    }
    // 加油口
    const filler = U.tubeShell(76, 62, 40, 24);
    filler.translate(-300, H.coverTopY + 16, 60);
    cg.push(filler);
    const cover = U.mesh(U.merge(cg), mats.alumCast, [0, 0, 0], [0, 0, 0], 'rockerCover');
    G.add(cover);
    world.reg(cover, 'head.rockerCover', {
      state: () => '气门室罩盖：密封润滑油、隔声，内含油气分离挡板',
      explode: [0, 360, 0],
    });
    const cap = U.mesh(U.lathe([[0, 0], [40, 0], [40, 14], [32, 18], [0, 18]], 24), mats.rubber,
      [-300, H.coverTopY + 36, 60]);
    F.add(cap);
    world.reg(cap, 'head.fillerCap', { state: () => '机油加注口盖（带通气迷宫）' });
    // 罩盖胶垫
    const gk = plateXZ([[-352, -120], [352, -120], [352, 120], [-352, 120]], 4,
      [[[-340, -108], [-340, 108], [340, 108], [340, -108]]]);
    const gm = U.mesh(gk, mats.rubber, [0, yTop + 2, 0]);
    F.add(gm);
    world.reg(gm, 'seal.coverGasket', { state: () => '气门室罩橡胶密封垫（可重复使用）' });
  }
}
