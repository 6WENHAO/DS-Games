/**
 * smoke.mjs —— Node 侧自检（无浏览器）：
 *   ① 装配无异常  ② 两态几何自洽（脚底着地 / 六轮同高 / 尺寸合理）
 *   ③ 变形全程无 NaN  ④ 预设姿势不穿地  ⑤ 关键零件不互相穿模
 *   ⑥ 动画/运动 300 帧稳定  ⑦ 姿势序列化闭环  ⑧ 关节参数可写
 * 运行： node tools/smoke.mjs   （需根目录 node_modules/three 垫片，仅测试用）
 */
import * as THREE from 'three';

/* ---------- 最小 DOM/Canvas 垫片（程序化贴图需要） ---------- */
const ctxStub = () => {
  const noop = () => {};
  const grad = { addColorStop: noop };
  return new Proxy({}, {
    get: (t, k) => {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      if (k === 'canvas') return { width: 1, height: 1 };
      if (k === 'measureText') return () => ({ width: 10 });
      return noop;
    },
    set: () => true,
  });
};
globalThis.document = {
  createElement: (tag) => (tag === 'canvas'
    ? { width: 1, height: 1, getContext: ctxStub, toDataURL: () => '' }
    : { style: {}, appendChild() {}, setAttribute() {} }),
};
globalThis.window = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener() {} };

const { createMaterials } = await import('../src/model/materials.js');
const { buildRobot, buildTrailer, D } = await import('../src/model/robot.js');
const { Transformer } = await import('../src/rig/transformer.js');
const { Animator } = await import('../src/rig/animations.js');
const { Motion } = await import('../src/systems/motion.js');
const { Effects } = await import('../src/systems/effects.js');
const { PRESETS } = await import('../src/rig/poses.js');

let fails = 0, checks = 0;
const ok = (cond, msg, extra = '') => {
  checks++;
  if (!cond) fails++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}${extra ? '  → ' + extra : ''}`);
};
const n3 = (v) => Math.round(v * 1000) / 1000;

/* ---------- 装配 ---------- */
const M = createMaterials();
const rig = buildRobot(M);
const scene = new THREE.Scene();
scene.add(rig.root);
const trailer = buildTrailer(M);
scene.add(trailer);
const tf = new Transformer(rig, M);
const anim = new Animator(rig, tf, M);
const motion = new Motion(rig, tf, anim);
motion.attachTrailer(trailer);
const fx = new Effects(scene, rig, M, tf);

console.log('=== 装配统计 ===');
console.log('关节数:', rig.jointCount, ' 网格数:', rig.meshes.length,
  ' 车轮:', rig.wheels.length, ' 排气管:', rig.stackTips.length, ' 大灯:', rig.headlights.length);
ok(rig.jointCount >= 30, `关节数 ≥30 (=${rig.jointCount})`);
ok(rig.wheels.length === 6, `车轮 6 个 (=${rig.wheels.length})`);
ok(rig.meshes.length > 150, `零件数 >150 (=${rig.meshes.length})`);

/* ---------- 工具（只统计机体网格，排除粒子/特效对象） ---------- */
const sync = () => rig.root.updateMatrixWorld(true);
const mbox = (m) => { sync(); return new THREE.Box3().setFromObject(m); };
const modelBox = () => {
  sync();
  const b = new THREE.Box3();
  for (const m of rig.meshes) b.expandByObject(m);
  return b;
};
const jbox = (n) => {
  sync();
  const b = new THREE.Box3();
  rig.joints[n].obj.traverse((o) => { if (o.isMesh) b.expandByObject(o); });
  return b;
};
const dump = (name, b) => console.log(
  `  ${name.padEnd(11)} X[${n3(b.min.x)},${n3(b.max.x)}] Y[${n3(b.min.y)},${n3(b.max.y)}] Z[${n3(b.min.z)},${n3(b.max.z)}]`);
const lowest = (n = 3) => rig.meshes
  .map((m) => ({ n: m.name || '(无名)', y: n3(mbox(m).min.y) }))
  .sort((a, b) => a.y - b.y).slice(0, n).map((o) => `${o.n}@${o.y}`).join('  ');

const byName = (n) => rig.meshes.filter((m) => m.name === n);
const interVol = (a, b) => {
  const ba = mbox(a), bb = mbox(b);
  if (!ba.intersectsBox(bb)) return 0;
  const s = ba.clone().intersect(bb).getSize(new THREE.Vector3());
  return Math.max(0, s.x) * Math.max(0, s.y) * Math.max(0, s.z);
};
const worstOverlap = (na, nb) => {
  let w = 0;
  for (const a of byName(na)) for (const b of byName(nb)) { if (a !== b) w = Math.max(w, interVol(a, b)); }
  return n3(w);
};
const checkPairs = (title, pairs) => {
  console.log('\n=== 穿模体积（' + title + '，越小越好） ===');
  for (const [a, bn, lim] of pairs) {
    if (!byName(a).length || !byName(bn).length) { console.log(`  (跳过 ${a}×${bn}：无此命名零件)`); continue; }
    const v = worstOverlap(a, bn);
    ok(v <= lim, `「${a}」×「${bn}」重叠 ≤ ${lim}`, `${v}`);
  }
};

/* ---------- ① 机器人态 ---------- */
tf.setProgress(0);
let b = modelBox();
console.log('\n=== 机器人态 ===');
dump('整机', b);
console.log('  最低零件:', lowest());
ok(b.min.y > -0.03 && b.min.y < 0.06, `脚底贴地 (min.y=${n3(b.min.y)})`);
ok(b.max.y > 4.6 && b.max.y < 5.8, `站高 4.6~5.8 (=${n3(b.max.y)})`);
console.log(`  身高 ${n3(b.max.y)} 单位 ≈ ${n3(b.max.y * 1.7)} m ｜ 肩宽 ${n3(b.max.x - b.min.x)}`);
for (const nm of ['head', 'chest', 'ankleL']) dump(nm, jbox(nm));
checkPairs('机器人态', [
  ['tire', 'tire', 0], ['tire', '脚掌', 0.002], ['tire', '脚底板', 0.002],
  /* 轮胎刻意嵌进腿部装甲 0.11 单位，做出"轮舱"效果，非穿模缺陷 */
  ['tire', '大腿', 0.13], ['tire', '小腿', 0.13], ['头盔', '胸甲', 0],
  ['掌', '大腿', 0.004], ['前臂', '胸甲', 0.004],
]);

/* ---------- ② 载具态 ---------- */
tf.setProgress(1);
b = modelBox();
console.log('\n=== 载具态 ===');
dump('整车', b);
const L = b.max.z - b.min.z, W = b.max.x - b.min.x, H = b.max.y - b.min.y;
console.log(`  长 ${n3(L)} × 宽 ${n3(W)} × 高 ${n3(H)} 单位 → ${n3(L * 1.7)}m × ${n3(W * 1.7)}m × ${n3(H * 1.7)}m`);
ok(Math.abs(b.min.y) < 0.06, `车轮触地 (min.y=${n3(b.min.y)})`);
ok(L / H > 1.6 && L / H < 3.2, `长高比 1.6~3.2 (=${n3(L / H)})`);
ok(L / W > 1.55, `长宽比 >1.55 (=${n3(L / W)})`);

const wy = rig.wheels.map((w) => { sync(); return n3(w.getWorldPosition(new THREE.Vector3()).y); });
console.log('  六轮轮心高:', wy.join(', '));
ok(Math.max(...wy) - Math.min(...wy) < 0.03, '六轮同高', `Δ=${n3(Math.max(...wy) - Math.min(...wy))}`);
ok(Math.abs(wy[0] - D.wheelR) < 0.03, `轮心高 = 轮半径 ${D.wheelR}`, `${wy[0]}`);
for (const nm of ['head', 'roof', 'grille', 'windshield', 'shoulderL', 'foreArmL', 'handL', 'stackL', 'ankleL']) dump(nm, jbox(nm));

/* 头必须收进胸腔内部 */
const hb = jbox('head'), chestMesh = mbox(byName('胸甲')[0]);
ok(hb.min.z > chestMesh.min.z - 0.02 && hb.max.z < chestMesh.max.z + 0.02 &&
   hb.min.y > chestMesh.min.y - 0.02 && hb.max.y < chestMesh.max.y + 0.02,
  '载具态头部完全收进驾驶室', `head Z[${n3(hb.min.z)},${n3(hb.max.z)}] ⊂ chest Z[${n3(chestMesh.min.z)},${n3(chestMesh.max.z)}]`);
/* 排气管高于车顶 */
ok(jbox('stackL').max.y > jbox('roof').max.y, '排气管高于车顶',
  `${n3(jbox('stackL').max.y)} > ${n3(jbox('roof').max.y)}`);
/* 车顶板确实翻到水平（高度接近整车最高的车身面） */
const rf = jbox('roof');
ok(rf.max.y - rf.min.y < 0.4 && rf.max.z > 0.1, '车顶板已翻成水平顶盖',
  `厚 ${n3(rf.max.y - rf.min.y)}，前缘 z=${n3(rf.max.z)}`);

/* ---------- ⑤ 关键零件穿模检查（载具态） ---------- */
checkPairs('载具态', [
  ['tire', 'tire', 0], ['掌', 'tire', 0.002], ['前臂', 'tire', 0.008],
  ['脚掌', 'tire', 0.002], ['脚底板', 'tire', 0.002],
  ['胸甲', '前臂', 0.02], ['胸甲', '上臂', 0.03], ['车顶', '头盔', 0.004],
  ['小腿', '胸甲', 0.02], ['格栅', 'tire', 0.004],
]);

/* ---------- ③ 变形扫描 ---------- */
console.log('\n=== 变形扫描（0→1，81 步） ===');
let worstY = 9, nan = false, worstAt = 0;
for (let i = 0; i <= 80; i++) {
  tf.setProgress(i / 80);
  const bb = modelBox();
  if ([bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].some((v) => !Number.isFinite(v))) nan = true;
  if (bb.min.y < worstY) { worstY = bb.min.y; worstAt = i / 80; }
}
ok(!nan, '变形全程无 NaN');
ok(worstY > -0.30, `变形过程最低点 >-0.30 (=${n3(worstY)} @progress ${n3(worstAt)})`);

/* ---------- ④ 预设姿势 ---------- */
console.log('\n=== 预设姿势 ===');
tf.setProgress(0);
for (const p of PRESETS) {
  tf.applyPreset(p.id, 0.001);
  for (let i = 0; i < 8; i++) tf.update(0.05);
  const bb = modelBox();
  const dy = n3(bb.min.y);
  ok(dy > -0.10, `预设「${p.name}」不穿地 (min.y=${dy}, 高=${n3(bb.max.y)})`, dy < -0.05 ? lowest(2) : '');
}
tf.applyPreset('stand', 0.001);
for (let i = 0; i < 8; i++) tf.update(0.05);

/* ---------- ⑥ 动画 + 运动 300 帧 ---------- */
console.log('\n=== 动画/运动 300 帧 ===');
motion.keys.add('w');
let err = null;
try {
  for (let i = 0; i < 300; i++) {
    if (i === 100) tf.setTarget(1);
    if (i === 200) motion.keys.add('a');
    tf.update(1 / 60);
    const ctx = motion.update(1 / 60);
    anim.update(1 / 60, ctx);
    fx.update(1 / 60, ctx);
  }
} catch (e) { err = e; }
ok(!err, '300 帧无异常', err ? err.message + '\n' + err.stack : '');
const pos = rig.root.position;
ok(Number.isFinite(pos.x) && pos.length() > 1, '机体确实开动了', `pos=(${n3(pos.x)},${n3(pos.z)}) heading=${n3(motion.heading)}`);
ok(Math.abs(rig.wheels[0].rotation.x) > 1, '车轮在滚动', `θ=${n3(rig.wheels[0].rotation.x)}`);
ok(Number.isFinite(trailer.rotation.y), '拖挂运动学无 NaN');
/* 行走态步态 */
tf.setProgress(0);
motion.reset(); motion.keys.clear(); motion.keys.add('w');
for (let i = 0; i < 120; i++) { tf.update(1 / 60); const c = motion.update(1 / 60); anim.update(1 / 60, c); }
ok(anim.walkW > 0.8, '机器人态进入行走动画', `walkW=${n3(anim.walkW)}`);
ok(rig.root.position.length() > 1.5, '行走位移正常', `${n3(rig.root.position.length())}`);
const wb = modelBox();
ok(wb.min.y > -0.25, `行走中脚不明显穿地 (min.y=${n3(wb.min.y)})`);
motion.keys.clear();

/* ---------- ⑦ 序列化 ---------- */
const json = tf.toJSON();
const txt = JSON.stringify(json);
tf.fromJSON(JSON.parse(txt));
ok(txt.length > 1000 && Object.keys(json.joints).length === rig.jointCount, '姿势 JSON 导出/导入闭环', `${(txt.length / 1024).toFixed(1)} KB`);

/* ---------- ⑧ 关节参数即时生效 ---------- */
motion.reset();
tf.setProgress(0);
tf.resetAll();
const before = jbox('foreArmL').min.x;
tf.map.shoulderL.r0[2] = -45; tf.apply();
const after = jbox('foreArmL').min.x;
ok(after < before - 0.3, '改关节参数立即生效（左肩外张45°）', `foreArm min.x ${n3(before)} → ${n3(after)}`);
tf.resetJoint('shoulderL', 0);

console.log(`\n================  ${checks - fails}/${checks} 通过  ================`);
process.exit(fails ? 1 : 0);
