/**
 * robot.js —— 机体装配
 *
 * 关键设计：
 *  1) 严格的父子关节链（core→waist→chest→肩→臂 / core→髋→膝→踝），
 *     所以任何一个关节参数改变都会正确带动下游零件；
 *  2) 每个关节都登记进 rig.joints 注册表（含中文名 + 分组 + 结构基准位姿），
 *     GUI 与变形控制器都只跟注册表打交道；
 *  3) 尺寸集中在 D 里，机器人态站高 / 载具态轮距都由它推导，两态严格自洽：
 *       机器人态：脚底 y=0  ← coreY = 踝高 + 小腿 + 大腿 + 髋偏移
 *       载具态：  轮心 y=R  ← coreY' = R + 0.14
 */
import * as THREE from 'three';
import { bevelBox, cyl, sph, part, grp, deg, makeWheel, emblemTexture, trailerTexture } from './geom.js';

/* ---------------- 尺寸表（单位≈0.35m） ---------------- */
export const D = {
  coreY: 3.10, coreYVeh: 0.56,
  hipX: 0.44, hipY: -0.14,
  thigh: 1.30, shin: 1.40, ankleY: 0.26,
  waistY: 0.15, chestY: 0.25,
  chestW: 1.52, chestH: 1.00, chestD: 0.86,
  shoulderX: 0.84, shoulderY: 0.78,
  upperArm: 0.82, foreArm: 0.88,
  wheelR: 0.42, wheelW: 0.30, trackX: 0.74,
  frontAxleZ: 0.10,
};

/* ---------------- 关节注册 ---------------- */
function J(rig, parent, name, label, group, p = [0, 0, 0]) {
  const g = grp(parent, p, name);
  rig.joints[name] = {
    name, label, group, obj: g,
    base: g.position.clone(),      // 结构基准位置（GUI 复位用）
  };
  return g;
}

/* ================================================================== *
 *  头部
 * ================================================================== */
function buildHead(rig, M, neck) {
  const head = J(rig, neck, 'head', '头部', 'head', [0, 0.14, 0]);
  part(head, bevelBox(0.62, 0.40, 0.56, { r: 0.10 }), M.blue, [0, 0.20, 0], [0, 0, 0], '头盔');
  part(head, bevelBox(0.17, 0.13, 0.46, { r: 0.05 }), M.blue, [0, 0.40, 0.02]);      // 头冠
  part(head, bevelBox(0.46, 0.28, 0.10, { r: 0.05 }), M.metal, [0, 0.17, 0.27]);     // 面甲
  part(head, bevelBox(0.34, 0.11, 0.08, { r: 0.03 }), M.metal, [0, 0.05, 0.29]);     // 口罩
  part(head, bevelBox(0.30, 0.05, 0.06, { r: 0.02 }), M.dark, [0, 0.30, 0.29]);      // 眉线
  rig.eyes = [-1, 1].map((s) =>
    part(head, bevelBox(0.14, 0.055, 0.05, { r: 0.02 }), M.glow, [s * 0.125, 0.235, 0.30], [0, 0, 0], '眼'));
  for (const s of [-1, 1]) {
    part(head, cyl(0.075, 0.085, 0.11, 12), M.blue, [s * 0.33, 0.24, 0.0], [0, 0, deg(90)]);  // 耳罩
    part(head, cyl(0.022, 0.022, 0.16, 8), M.chrome, [s * 0.33, 0.36, -0.02], [deg(-14), 0, 0]); // 天线
  }
  part(head, cyl(0.14, 0.16, 0.14, 12), M.joint, [0, -0.02, 0]);                      // 颈根
  return head;
}

/* ================================================================== *
 *  手（可握拳 + 可挂武器）
 * ================================================================== */
function buildHand(rig, M, wrist, side, tag) {
  const hand = J(rig, wrist, `hand${tag}`, `手掌·${tag === 'L' ? '左' : '右'}`, `arm${tag}`, [0, -0.06, 0]);
  part(hand, bevelBox(0.32, 0.30, 0.36, { r: 0.06 }), M.metal, [0, -0.14, 0], [0, 0, 0], '掌');
  part(hand, bevelBox(0.34, 0.10, 0.38, { r: 0.04 }), M.dark, [0, -0.01, 0]);
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const f = grp(hand, [-0.105 + i * 0.07, -0.29, 0.09]);
    part(f, bevelBox(0.055, 0.19, 0.10, { r: 0.022, bevel: 0.014 }), M.metal, [0, -0.09, 0]);
    const f2 = grp(f, [0, -0.185, 0]);
    part(f2, bevelBox(0.05, 0.15, 0.09, { r: 0.02, bevel: 0.013 }), M.dark, [0, -0.07, 0]);
    f.userData.tip = f2;
    fingers.push(f);
  }
  const thumb = grp(hand, [side * 0.17, -0.20, -0.06]);
  part(thumb, bevelBox(0.07, 0.18, 0.10, { r: 0.025, bevel: 0.015 }), M.metal, [0, -0.08, 0]);
  hand.userData.fingers = fingers;
  hand.userData.thumb = thumb;
  hand.userData.side = side;
  rig.hands[tag] = hand;
  return hand;
}

/** 离子炮（挂右手，可开关） */
function buildBlaster(rig, M, hand) {
  const g = grp(hand, [0, -0.34, 0.16], 'blaster');
  g.rotation.x = deg(-96);
  part(g, bevelBox(0.20, 0.22, 0.52, { r: 0.05 }), M.dark, [0, 0.06, 0.10]);          // 机匣
  part(g, cyl(0.085, 0.10, 0.86, 16), M.metal, [0, 0.04, 0.72], [deg(90), 0, 0]);      // 炮管
  part(g, cyl(0.12, 0.12, 0.10, 16), M.chrome, [0, 0.04, 1.10], [deg(90), 0, 0]);      // 炮口
  part(g, bevelBox(0.10, 0.30, 0.14, { r: 0.03 }), M.dark, [0, -0.14, -0.02]);         // 握把
  part(g, bevelBox(0.14, 0.10, 0.30, { r: 0.03 }), M.blue, [0, 0.20, 0.16]);           // 瞄具
  const muzzle = grp(g, [0, 0.04, 1.18], 'muzzle');
  const flash = part(g, sph(0.13, 10), M.boltGlow, [0, 0.04, 1.16]);
  flash.visible = false;
  rig.blaster = { root: g, muzzle, flash };
  g.visible = false;
  return g;
}

/* ================================================================== *
 *  手臂（肩球3轴 → 肘 → 腕 → 手）
 * ================================================================== */
function buildArm(rig, M, chest, side) {
  const tag = side < 0 ? 'L' : 'R';
  const zh = side < 0 ? '左' : '右';
  const sh = J(rig, chest, `shoulder${tag}`, `肩关节·${zh}`, `arm${tag}`, [side * D.shoulderX, D.shoulderY, 0]);

  /* 肩甲（独立关节，变形时会内收） */
  const pa = J(rig, sh, `pauldron${tag}`, `肩甲·${zh}`, `arm${tag}`, [0, 0, 0]);
  part(pa, bevelBox(0.46, 0.48, 0.88, { r: 0.10 }), M.red, [side * 0.13, 0.10, 0], [0, 0, 0], '肩甲');
  part(pa, bevelBox(0.20, 0.20, 0.90, { r: 0.05 }), M.blueDark, [side * 0.30, -0.10, 0]);
  if (side < 0) {   // 左肩徽标
    const em = new THREE.MeshStandardMaterial({
      map: emblemTexture(M.palette.red), transparent: true, roughness: 0.5, metalness: 0.2,
    });
    rig.emblemMat = em;
    part(pa, new THREE.PlaneGeometry(0.34, 0.34), em, [side * 0.365, 0.12, 0], [0, deg(-90) * side, 0]);
  }
  /* 排气管 */
  const st = J(rig, pa, `stack${tag}`, `排气管·${zh}`, `arm${tag}`, [side * 0.30, 0.26, -0.24]);
  part(st, cyl(0.078, 0.088, 0.88, 14), M.chrome, [0, 0.44, 0]);
  part(st, cyl(0.105, 0.105, 0.07, 14), M.chrome, [0, 0.86, 0]);
  for (let i = 0; i < 3; i++) part(st, cyl(0.10, 0.10, 0.035, 12), M.metal, [0, 0.16 + i * 0.16, 0]);
  part(st, bevelBox(0.10, 0.22, 0.10, { r: 0.03 }), M.dark, [0, 0.06, 0]);
  const tip = grp(st, [0, 0.92, 0], `stackTip${tag}`);
  rig.stackTips.push(tip);

  /* 上臂 */
  part(sh, sph(0.21, 14), M.joint, [0, 0, 0]);
  part(sh, bevelBox(0.34, D.upperArm, 0.38, { r: 0.08 }), M.red, [0, -0.45, 0], [0, 0, 0], '上臂');
  part(sh, cyl(0.05, 0.05, 0.56, 10), M.dark, [0, -0.44, -0.20]);      // 液压杆
  part(sh, bevelBox(0.10, 0.30, 0.12, { r: 0.03 }), M.metal, [side * 0.19, -0.30, 0.06]);

  /* 肘 */
  const el = J(rig, sh, `elbow${tag}`, `肘关节·${zh}`, `arm${tag}`, [0, -D.upperArm, 0]);
  part(el, cyl(0.155, 0.155, 0.38, 14), M.joint, [0, 0, 0], [0, 0, deg(90)]);

  /* 前臂（相对肘略偏 Z，变形折叠时才不会自穿模） */
  const fa = J(rig, el, `foreArm${tag}`, `前臂·${zh}`, `arm${tag}`, [0, -0.03, 0.05]);
  part(fa, bevelBox(0.42, D.foreArm, 0.44, { r: 0.09 }), M.blue, [0, -0.46, 0], [0, 0, 0], '前臂');
  part(fa, bevelBox(0.45, 0.26, 0.47, { r: 0.06 }), M.metal, [0, -0.17, 0]);          // 银箍
  part(fa, bevelBox(0.14, 0.52, 0.10, { r: 0.03 }), M.chrome, [side * 0.19, -0.55, 0.10]); // 侧刃
  part(fa, bevelBox(0.30, 0.16, 0.12, { r: 0.04 }), M.dark, [0, -0.62, 0.24]);

  /* 腕 + 手 */
  const wr = J(rig, fa, `wrist${tag}`, `腕关节·${zh}`, `arm${tag}`, [0, -D.foreArm, 0]);
  part(wr, cyl(0.13, 0.13, 0.14, 12), M.joint, [0, -0.02, 0]);
  const hand = buildHand(rig, M, wr, side, tag);
  if (side > 0) buildBlaster(rig, M, hand);
  return sh;
}

/* ================================================================== *
 *  腿（髋3轴 → 膝 → 踝 → 脚尖），小腿外侧带后轮
 * ================================================================== */
function buildLeg(rig, M, core, side) {
  const tag = side < 0 ? 'L' : 'R';
  const zh = side < 0 ? '左' : '右';

  /* 轮组工厂：机器人态是腿部外侧轮，载具态就是中桥/后桥 */
  const mkWheel = (parent, name, label, y) => {
    const mount = J(rig, parent, name, label, `leg${tag}`, [side * 0.30, y, 0.02]);
    const w = makeWheel(M, { radius: D.wheelR, width: D.wheelW, flip: side < 0 });
    mount.add(w);
    part(mount, cyl(0.09, 0.09, 0.34, 10), M.dark, [side * -0.16, 0, 0], [0, 0, deg(90)]);
    rig.wheels.push(w);
    return mount;
  };

  const hip = J(rig, core, `hip${tag}`, `髋关节·${zh}`, `leg${tag}`, [side * D.hipX, D.hipY, 0]);
  part(hip, sph(0.23, 14), M.joint, [0, 0, 0]);
  part(hip, bevelBox(0.38, 0.42, 0.52, { r: 0.09 }), M.red, [side * 0.15, -0.01, 0], [0, 0, 0], '髋甲');
  part(hip, bevelBox(0.52, D.thigh, 0.58, { r: 0.10 }), M.blue, [0, -0.68, 0], [0, 0, 0], '大腿');
  part(hip, cyl(0.055, 0.055, 0.72, 10), M.dark, [0, -0.72, -0.26]);
  part(hip, bevelBox(0.56, 0.20, 0.30, { r: 0.05 }), M.metal, [0, -1.14, 0.16]);
  mkWheel(hip, `rwheel${tag}2`, `中桥轮·${zh}`, -0.95);       // 大腿外侧

  /* 膝（小腿挂这里） */
  const knee = J(rig, hip, `knee${tag}`, `膝关节·${zh}`, `leg${tag}`, [0, -D.thigh, 0]);
  part(knee, cyl(0.20, 0.20, 0.42, 16), M.joint, [0, 0, 0], [0, 0, deg(90)]);
  part(knee, bevelBox(0.46, 0.32, 0.22, { r: 0.06 }), M.metal, [0, -0.03, 0.27], [0, 0, 0], '护膝');
  part(knee, bevelBox(0.56, D.shin, 0.62, { r: 0.10 }), M.blue, [0, -0.72, 0], [0, 0, 0], '小腿');
  part(knee, bevelBox(0.50, 0.74, 0.13, { r: 0.05 }), M.metal, [0, -0.60, 0.335]);
  part(knee, bevelBox(0.30, 0.50, 0.14, { r: 0.04 }), M.dark, [0, -1.10, -0.33]);
  mkWheel(knee, `rwheel${tag}1`, `后桥轮·${zh}`, -0.70);       // 小腿外侧

  /* 踝 + 脚 */
  const ank = J(rig, knee, `ankle${tag}`, `踝关节·${zh}`, `leg${tag}`, [0, -D.shin, 0]);
  part(ank, cyl(0.16, 0.16, 0.34, 12), M.joint, [0, 0, 0], [0, 0, deg(90)]);
  part(ank, bevelBox(0.64, 0.28, 0.86, { r: 0.08 }), M.dark, [0, -0.07, 0.12], [0, 0, 0], '脚掌');
  part(ank, bevelBox(0.68, 0.10, 0.90, { r: 0.05 }), M.metal, [0, -0.18, 0.12], [0, 0, 0], '脚底板');
  part(ank, bevelBox(0.42, 0.22, 0.22, { r: 0.05 }), M.metal, [0, -0.04, -0.34]);     // 后跟
  const toe = J(rig, ank, `toe${tag}`, `脚尖·${zh}`, `leg${tag}`, [0, -0.07, 0.53]);
  part(toe, bevelBox(0.60, 0.24, 0.28, { r: 0.06 }), M.metal, [0, 0, 0.10]);
  return hip;
}

/* ================================================================== *
 *  躯干（含挡风 / 车顶 / 前脸总成）
 * ================================================================== */
function buildTorso(rig, M, core) {
  /* 胯部 */
  part(core, bevelBox(1.06, 0.52, 0.66, { r: 0.10 }), M.metal, [0, -0.10, 0], [0, 0, 0], '胯部');
  part(core, bevelBox(1.16, 0.22, 0.72, { r: 0.06 }), M.dark, [0, 0.12, 0]);
  part(core, bevelBox(0.40, 0.36, 0.20, { r: 0.05 }), M.blueDark, [0, -0.12, -0.36]);

  /* 前轮（挂在 core 上，变形时不跟腿跑；含转向组） */
  for (const s of [-1, 1]) {
    const tagf = s < 0 ? 'L' : 'R';
    const st = J(rig, core, `steer${tagf}`, `前轮转向·${s < 0 ? '左' : '右'}`, 'chassis',
      [s * D.trackX, D.hipY, D.frontAxleZ]);
    const w = makeWheel(M, { radius: D.wheelR, width: D.wheelW, flip: s < 0 });
    st.add(w);
    rig.wheels.push(w);
    rig.steer.push(st);
    part(st, cyl(0.10, 0.10, 0.30, 10), M.dark, [s * -0.16, 0, 0], [0, 0, deg(90)]);
    part(st, bevelBox(0.16, 0.30, 0.62, { r: 0.05 }), M.redDark, [s * 0.04, 0.34, 0]);  // 挡泥板
  }

  /* 前脸总成：机器人态=腰腹护板，载具态=前保险杠 */
  const gr = J(rig, core, 'grille', '前脸总成(格栅/保险杠/大灯)', 'chassis', [0, 0.10, 0.36]);
  part(gr, bevelBox(1.32, 0.36, 0.12, { r: 0.05 }), M.chrome, [0, 0.10, 0], [0, 0, 0], '格栅');
  for (let i = 0; i < 5; i++) part(gr, bevelBox(1.22, 0.028, 0.14, { r: 0.01, bevel: 0.008 }), M.dark, [0, -0.02 + i * 0.06, 0.01]);
  part(gr, bevelBox(1.64, 0.22, 0.26, { r: 0.06 }), M.chrome, [0, -0.15, 0.02], [0, 0, 0], '保险杠');
  part(gr, bevelBox(0.30, 0.16, 0.30, { r: 0.04 }), M.dark, [0, -0.15, -0.06]);
  rig.lampMeshes = [];
  for (const s of [-1, 1]) {
    part(gr, cyl(0.115, 0.115, 0.08, 16), M.chrome, [s * 0.56, 0.09, 0.02], [deg(90), 0, 0]);
    rig.lampMeshes.push(part(gr, cyl(0.095, 0.095, 0.06, 16), M.lamp, [s * 0.56, 0.09, 0.06], [deg(90), 0, 0], '大灯'));
    part(gr, cyl(0.055, 0.055, 0.05, 10), M.amber, [s * 0.74, -0.02, 0.04], [deg(90), 0, 0]);
    /* 车灯光锥 */
    const sp = new THREE.SpotLight(0xfff0cf, 0, 26, deg(24), 0.45, 1.4);
    sp.position.set(s * 0.56, 0.09, 0.10);
    const tgt = new THREE.Object3D();
    tgt.position.set(s * 0.9, -1.2, 14);
    gr.add(sp, tgt);
    sp.target = tgt;
    rig.headlights.push(sp);
  }

  /* 腰（Y 轴扭转） */
  const waist = J(rig, core, 'waist', '腰部扭转', 'torso', [0, D.waistY, 0]);
  part(waist, cyl(0.34, 0.38, 0.26, 16), M.joint, [0, 0.06, 0]);

  /* 胸腔 */
  const chest = J(rig, waist, 'chest', '胸腔(俯仰/侧倾)', 'torso', [0, D.chestY, 0]);
  part(chest, bevelBox(D.chestW, D.chestH, D.chestD, { r: 0.12 }), M.red, [0, 0.50, 0], [0, 0, 0], '胸甲');
  part(chest, bevelBox(1.22, 0.34, 0.82, { r: 0.07 }), M.metal, [0, 0.06, 0], [0, 0, 0], '腹甲');
  part(chest, bevelBox(1.42, 0.82, 0.12, { r: 0.06 }), M.blueDark, [0, 0.54, -0.42]);        // 背板
  part(chest, bevelBox(0.34, 0.40, 0.86, { r: 0.07 }), M.red, [-0.78, 0.66, 0]);             // 肩座
  part(chest, bevelBox(0.34, 0.40, 0.86, { r: 0.07 }), M.red, [0.78, 0.66, 0]);
  for (const s of [-1, 1]) {
    part(chest, bevelBox(0.22, 0.22, 0.10, { r: 0.03 }), M.dark, [s * 0.52, 0.20, 0.44]);    // 进气口
    part(chest, bevelBox(0.10, 0.62, 0.10, { r: 0.03 }), M.chrome, [s * 0.70, 0.50, 0.40]);  // 车门立柱
  }

  /* 挡风玻璃总成（机器人态=胸窗，载具态=前挡风）
     窗宽刻意小于胸甲宽，让经典红装甲在两侧露出来 */
  const ws = J(rig, chest, 'windshield', '挡风玻璃', 'torso', [0, 0.62, 0.44]);
  part(ws, bevelBox(1.20, 0.46, 0.07, { r: 0.05 }), M.dark, [0, 0, 0], [0, 0, 0], '窗框');
  for (const s of [-1, 1]) {
    part(ws, bevelBox(0.52, 0.36, 0.05, { r: 0.04 }), M.glass, [s * 0.295, 0, 0.035], [0, 0, 0], '玻璃');
    part(ws, bevelBox(0.42, 0.03, 0.03, { r: 0.01, bevel: 0.008 }), M.dark, [s * 0.29, -0.14, 0.07], [0, 0, deg(4)]); // 雨刷
    /* 后视镜 */
    const mg = grp(ws, [s * 0.78, 0.02, 0.02]);
    part(mg, cyl(0.024, 0.024, 0.30, 8), M.chrome, [s * 0.10, 0, 0], [0, 0, deg(90)]);
    part(mg, bevelBox(0.05, 0.24, 0.16, { r: 0.03 }), M.dark, [s * 0.24, 0.02, 0]);
  }

  /* 车顶板（机器人态=背包，载具态=驾驶室顶） */
  const roof = J(rig, chest, 'roof', '车顶板/背包', 'torso', [0, 0.98, -0.42]);
  part(roof, bevelBox(1.38, 0.76, 0.16, { r: 0.06 }), M.red, [0, -0.36, 0.03], [0, 0, 0], '车顶');
  part(roof, bevelBox(1.10, 0.18, 0.10, { r: 0.04 }), M.chrome, [0, -0.66, 0.06]);
  for (let i = -1; i <= 1; i++) part(roof, cyl(0.045, 0.045, 0.05, 8), M.amber, [i * 0.34, -0.70, 0.09], [deg(90), 0, 0]);
  part(roof, bevelBox(0.16, 0.62, 0.10, { r: 0.04 }), M.blueDark, [-0.58, -0.34, 0.06]);
  part(roof, bevelBox(0.16, 0.62, 0.10, { r: 0.04 }), M.blueDark, [0.58, -0.34, 0.06]);

  /* 颈 + 头 */
  const neck = J(rig, chest, 'neck', '颈部(伸缩)', 'head', [0, 0.96, -0.05]);
  part(neck, cyl(0.16, 0.18, 0.20, 12), M.dark, [0, 0.02, 0]);
  buildHead(rig, M, neck);

  return chest;
}

/* ================================================================== *
 *  挂车（可选，载具态拖挂）
 * ================================================================== */
export function buildTrailer(M) {
  const g = new THREE.Group();
  const box = new THREE.MeshStandardMaterial({ color: '#dfe4ea', metalness: 0.5, roughness: 0.42 });
  const side = new THREE.MeshStandardMaterial({ map: trailerTexture(), metalness: 0.35, roughness: 0.5 });
  const L = 5.8, W = 2.06, H = 1.92, y0 = 1.02;

  const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, L), box);
  body.position.set(0, y0, -L / 2 - 0.5);
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, H * 0.92, L * 0.94), side);
    p.position.set(s * (W / 2 + 0.02), y0, -L / 2 - 0.5);
    p.castShadow = true;
    g.add(p);
  }
  part(g, bevelBox(W + 0.1, 0.14, L * 0.98, { r: 0.05 }), M.chrome, [0, y0 + H / 2, -L / 2 - 0.5]);
  part(g, bevelBox(W - 0.06, 0.22, L * 0.96, { r: 0.05 }), M.dark, [0, y0 - H / 2 - 0.06, -L / 2 - 0.5]); // 底架
  part(g, bevelBox(W - 0.2, 0.5, 0.16, { r: 0.05 }), M.red, [0, y0, -L - 0.42]);        // 尾门
  for (const s of [-1, 1]) {
    part(g, cyl(0.07, 0.07, 0.09, 12), M.amber, [s * 0.7, y0 - 0.7, -L - 0.46], [deg(90), 0, 0]);
    part(g, cyl(0.07, 0.07, 0.09, 12), M.amber, [s * 0.7, y0 + 0.7, -L - 0.46], [deg(90), 0, 0]);
  }
  /* 牵引销 + 支撑腿 */
  part(g, cyl(0.16, 0.16, 0.22, 12), M.metal, [0, 0.34, -0.16]);
  for (const s of [-1, 1]) part(g, bevelBox(0.12, 0.62, 0.12, { r: 0.03 }), M.dark, [s * 0.5, 0.30, -1.5]);

  const wheels = [];
  for (const s of [-1, 1]) {
    for (const z of [-4.1, -4.95]) {
      const m = grp(g, [s * 0.86, 0.42, z]);
      const w = makeWheel(M, { radius: 0.42, width: 0.28, flip: s < 0 });
      m.add(w);
      wheels.push(w);
      part(m, cyl(0.09, 0.09, 0.3, 10), M.dark, [s * -0.16, 0, 0], [0, 0, deg(90)]);
    }
    part(g, bevelBox(0.06, 0.5, 0.4, { r: 0.03 }), M.dark, [s * 0.98, 0.3, -5.5]);   // 挡泥皮
  }
  g.userData.wheels = wheels;
  g.userData.axleZ = -4.5;   // 后桥中心（拖挂运动学用）
  g.visible = false;
  return g;
}

/* ================================================================== *
 *  总装
 * ================================================================== */
export function buildRobot(M) {
  const rig = {
    root: new THREE.Group(),     // 世界移动（驾驶/行走）
    lift: new THREE.Group(),     // 变形腾空 / 抖动
    joints: {}, wheels: [], steer: [], stackTips: [], headlights: [], hands: {},
    meshes: [], D,
  };
  rig.root.add(rig.lift);
  rig.root.name = 'OptimusRig';

  const core = J(rig, rig.lift, 'core', '底盘升降(胯部)', 'chassis', [0, D.coreY, 0]);
  const chest = buildTorso(rig, M, core);
  buildArm(rig, M, chest, -1);
  buildArm(rig, M, chest, 1);
  buildLeg(rig, M, core, -1);
  buildLeg(rig, M, core, 1);

  /* 统计 + 爆炸图方向（以机器人态世界位置为基准，转到各自父空间） */
  rig.root.updateMatrixWorld(true);
  const center = new THREE.Vector3(0, D.coreY * 0.62, 0);
  const wp = new THREE.Vector3(), q = new THREE.Quaternion();
  rig.root.traverse((o) => {
    if (!o.isMesh) return;
    rig.meshes.push(o);
    o.getWorldPosition(wp);
    const dir = wp.sub(center);
    if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
    dir.normalize();
    o.parent.getWorldQuaternion(q).invert();
    o.userData.expl = dir.applyQuaternion(q);
    o.userData.home = o.position.clone();
  });
  rig.jointCount = Object.keys(rig.joints).length;
  return rig;
}
