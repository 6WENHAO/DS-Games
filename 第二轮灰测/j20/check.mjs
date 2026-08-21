/* J-20 几何校验：在 node 里把 three 注入几何模块，检查尺寸/法线/退化面 */
import * as THREE from './vendor/three.module.mjs';
import fs from 'node:fs';

const src = fs.readFileSync(new URL('./src/j20-geometry.js', import.meta.url), 'utf8');
const names = Object.keys(THREE).filter((n) => /^[A-Za-z_$][\w$]*$/.test(n));
const factory = new Function(...names,
  src + '\nreturn { buildJ20, buildFuselage, FUSE_STATIONS, makeWingGeo, makeCanardGeo, makeVTailGeo, makeVentralGeo, fuseRing, mirrorZ };');
const api = factory(...names.map((n) => THREE[n]));

const mat = (name) => Object.assign(new THREE.MeshStandardMaterial(), { name });
const M = {};
for (const k of ['skin', 'dark', 'glass', 'frame', 'cockpit', 'sensor', 'nozzle', 'exhaust',
  'flameCore', 'flameHalo', 'missile', 'tire', 'metal']) M[k] = mat(k);

const problems = [];
const ok = (c, msg) => { if (!c) problems.push(msg); };
const near = (v, want, tol, msg) => ok(Math.abs(v - want) <= tol,
  `${msg}: 实测 ${v.toFixed(3)}，期望 ${want}±${tol}`);

/* ---------- 1. 构建 ---------- */
const { root, parts, doors, gdoors } = api.buildJ20(M);
root.updateMatrixWorld(true);

/* ---------- 2. NaN / 退化三角形 ---------- */
let meshes = 0, tris = 0, nan = 0, degenerate = 0;
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
root.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  const g = o.geometry, p = g.attributes.position;
  for (let i = 0; i < p.count; i++)
    if (!Number.isFinite(p.getX(i)) || !Number.isFinite(p.getY(i)) || !Number.isFinite(p.getZ(i))) nan++;
  const idx = g.index ? g.index.array : null;
  const n = idx ? idx.length / 3 : p.count / 3;
  tris += n;
  for (let t = 0; t < n; t++) {
    const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
    a.fromBufferAttribute(p, i0); b.fromBufferAttribute(p, i1); c.fromBufferAttribute(p, i2);
    if (b.sub(a).cross(c.sub(a)).lengthSq() < 1e-14) degenerate++;
  }
});
ok(nan === 0, `存在 ${nan} 个 NaN 顶点`);
ok(degenerate / tris < 0.06, `退化三角形过多：${degenerate}/${tris}`);

/* ---------- 3. 与真机三维尺寸对标 ---------- */
const bboxOf = (obj) => new THREE.Box3().setFromObject(obj);
const airframe = new THREE.Box3();
for (const k of ['fuselage', 'wing_L', 'wing_R', 'canard_L', 'canard_R', 'vtail_L', 'vtail_R',
  'ventral_L', 'ventral_R', 'intake_L', 'intake_R', 'canopy'])
  if (parts[k]) airframe.union(bboxOf(parts[k]));
const nz = bboxOf(parts.nozzle_group);
airframe.union(nz);
const size = airframe.getSize(new THREE.Vector3());
near(size.x, 20.4, 0.9, '全长（不含空速管）');
near(size.z, 12.88, 0.12, '翼展');

const wing = bboxOf(parts.wing_R);
near(wing.max.z, 6.44, 0.02, '右翼翼尖 z');
const leSweep = Math.atan2(2.75 - (-2.02), 6.44 - 1.35) / Math.PI * 180;
near(leSweep, 43, 2.5, '主翼前缘后掠角');

const vt = bboxOf(parts.vtail_R);
ok(vt.max.z > 1.6, `V 尾应向外倾（右侧 max z=${vt.max.z.toFixed(2)}，应 >1.6）`);
ok(vt.max.y > 2.0 && vt.max.y < 2.35, `V 尾顶端高度异常：${vt.max.y.toFixed(2)}`);
const vf = bboxOf(parts.ventral_R);
ok(vf.min.y < -1.4, `腹鳍应向下伸出：min y=${vf.min.y.toFixed(2)}`);
ok(vf.max.z > 1.2, `腹鳍应外倾：max z=${vf.max.z.toFixed(2)}`);

const gearBox = bboxOf(parts.gear_group);
near(gearBox.min.y, -2.30, 0.05, '轮胎触地高度');
const total = airframe.clone().union(gearBox);
near(total.max.y - gearBox.min.y, 4.45, 0.15, '全高（地面到 V 尾顶）');

const canard = bboxOf(parts.canard_R);
near(canard.max.z, 2.90, 0.05, '鸭翼翼尖 z');
ok(canard.min.y < 0.30, `鸭翼应有下反：翼尖 y=${canard.min.y.toFixed(2)}`);
ok(canard.max.x < bboxOf(parts.wing_R).max.x + 2.0 && canard.min.x > wing.max.x - 1.5,
  '鸭翼纵向位置应在主翼之前');

/* ---------- 4. 法线朝外 ---------- */
const outward = (mesh, pick, expect, label) => {
  const g = mesh.geometry, p = g.attributes.position, n = g.attributes.normal;
  let best = -Infinity, bi = 0;
  for (let i = 0; i < p.count; i++) {
    const v = pick(p.getX(i), p.getY(i), p.getZ(i));
    if (v > best) { best = v; bi = i; }
  }
  const nv = new THREE.Vector3(n.getX(bi), n.getY(bi), n.getZ(bi));
  ok(nv.dot(expect) > 0.35, `${label} 法线朝内：n=(${nv.x.toFixed(2)},${nv.y.toFixed(2)},${nv.z.toFixed(2)})`);
};
outward(parts.fuselage, (x, y) => (x > -2 && x < 2 ? y : -99), new THREE.Vector3(0, 1, 0), '机身上表面');
outward(parts.fuselage, (x, y) => (x > -2 && x < 2 ? -y : -99), new THREE.Vector3(0, -1, 0), '机身下表面');
outward(parts.fuselage, (x, y, z) => (x > -2 && x < 2 ? z : -99), new THREE.Vector3(0, 0, 1), '机身右侧');
outward(parts.wing_R, (x, y, z) => (z > 3 ? y : -99), new THREE.Vector3(0, 1, 0), '右翼上表面');
outward(parts.wing_L, (x, y, z) => (z < -3 ? y : -99), new THREE.Vector3(0, 1, 0), '左翼上表面');
outward(parts.wing_L, (x, y, z) => (z < -3 ? -y : -99), new THREE.Vector3(0, -1, 0), '左翼下表面');
outward(parts.intake_R, (x, y, z) => (x > 2 ? z : -99), new THREE.Vector3(0, 0, 1), '右进气道外侧');

/* ---------- 5. 部件清单 ---------- */
const want = ['fuselage', 'wing_L', 'wing_R', 'canard_L', 'canard_R', 'vtail_L', 'vtail_R',
  'ventral_L', 'ventral_R', 'intake_L', 'intake_R', 'duct_L', 'duct_R', 'dsi_L', 'dsi_R',
  'canopy', 'cockpit_tub', 'seat', 'hud', 'eots', 'pitot', 'nozzle_group', 'flames',
  'bay_group', 'weapons', 'gear_group', 'gear_nose', 'gear_main_L', 'gear_main_R'];
for (const k of want) ok(parts[k], `缺少部件：${k}`);
ok(doors.length === 4, `弹舱门数量应为 4，实为 ${doors.length}`);
ok(gdoors.length === 3, `起落架舱门数量应为 3，实为 ${gdoors.length}`);

/* ---------- 输出 ---------- */
console.log(`网格数 ${meshes}，三角面 ${tris}，退化面 ${degenerate}`);
console.log(`外形包围盒：长 ${size.x.toFixed(2)} m × 宽 ${size.z.toFixed(2)} m × 高 ${(total.max.y - gearBox.min.y).toFixed(2)} m`);
console.log(`主翼前缘后掠 ${leSweep.toFixed(1)}°，V 尾外倾至 z=${vt.max.z.toFixed(2)}，顶端 y=${vt.max.y.toFixed(2)}`);
if (problems.length) { console.log(`\n发现 ${problems.length} 个问题：`); problems.forEach((p) => console.log(' - ' + p)); process.exitCode = 1; }
else console.log('\n几何校验全部通过。');
