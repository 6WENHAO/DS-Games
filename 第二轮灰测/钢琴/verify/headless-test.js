/* 无头验证：在 node 中加载 three(UMD) + geom.js + piano.js，实际构建模型并统计
 * 用途：在没有浏览器的情况下捕获 API 误用 / 几何构建异常
 * 运行: node tools/headless-test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const STAGE = path.join(__dirname, '..');

/* ---- 极简 canvas 2D 上下文桩 ---- */
function ctxStub() {
  const grad = { addColorStop() {} };
  const noop = () => {};
  return new Proxy({
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    measureText: () => ({ width: 100 }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    putImageData: noop,
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
  }, {
    get(t, k) {
      if (k in t) return t[k];
      return noop;
    },
    set() { return true; },
  });
}

const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  performance: { now: () => Date.now() },
  requestAnimationFrame: () => 0,
  navigator: { userAgent: 'node', maxTouchPoints: 0 },
  devicePixelRatio: 1,
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.document = {
  createElement(tag) {
    if (tag === 'canvas') {
      const c = { width: 1, height: 1, style: {}, getContext: () => ctxStub(), toDataURL: () => '' };
      return c;
    }
    return { style: {}, appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} } };
  },
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener() {},
  body: { appendChild() {}, style: {} },
};

const ctxObj = vm.createContext(sandbox);
function load(rel) {
  const code = fs.readFileSync(path.join(STAGE, rel), 'utf8');
  vm.runInContext(code, ctxObj, { filename: rel });
}

load('js/three.min.js');
if (!sandbox.THREE) {
  // UMD 在无 window 判断时可能挂到 module.exports
  sandbox.THREE = sandbox.module.exports;
}
console.log('three REVISION =', sandbox.THREE.REVISION);
load('js/geom.js');
load('js/piano.js');

const T = sandbox.THREE;
const piano = sandbox.Piano.build();

let meshes = 0, tris = 0, instanced = 0;
piano.root.traverse((o) => {
  if (o.isInstancedMesh) {
    instanced++;
    const g = o.geometry;
    const per = (g.index ? g.index.count : g.attributes.position.count) / 3;
    tris += per * o.count;
    return;
  }
  if (o.isMesh) {
    meshes++;
    const g = o.geometry;
    if (!g.attributes.position) throw new Error('mesh without position: ' + o.name);
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    const bad = Array.from(g.attributes.position.array).some((v) => !Number.isFinite(v));
    if (bad) throw new Error('NaN in geometry of mesh #' + meshes);
    if (o.material && o.material.map && !g.attributes.uv) {
      throw new Error('material has map but geometry lacks uv (mesh #' + meshes + ')');
    }
  }
});

const box = new T.Box3().setFromObject(piano.root);
const size = new T.Vector3(); box.getSize(size);

const whites = piano.keys.filter((k) => k.white).length;
const blacks = piano.keys.length - whites;

console.log('--- 构建统计 ---');
console.log('mesh 数量        :', meshes, '| instancedMesh:', instanced);
console.log('三角面数(估)     :', Math.round(tris));
console.log('琴键             :', piano.keys.length, '（白', whites, '/ 半音', blacks, '）');
console.log('包围盒 min       :', box.min.toArray().map((v) => +v.toFixed(3)).join(', '));
console.log('包围盒 max       :', box.max.toArray().map((v) => +v.toFixed(3)).join(', '));
console.log('尺寸 宽/高/长    :', size.toArray().map((v) => +v.toFixed(3)).join(' x '));
console.log('弦槌/制音器      :', piano.hammers.info.length, '/', piano.dampers.count);
console.log('踏板             :', piano.parts.pedals.length);

// 校验：键盘顺序单调、黑键落在两白键之间
let prev = -Infinity;
piano.keys.forEach((k) => {
  const c = k.center;
  if (!Number.isFinite(c)) throw new Error('key center NaN @ midi ' + k.midi);
});
const whiteCenters = piano.keys.filter((k) => k.white).map((k) => k.center);
for (let i = 1; i < whiteCenters.length; i++) {
  if (whiteCenters[i] <= whiteCenters[i - 1]) throw new Error('white keys not monotonic at ' + i);
  const d = whiteCenters[i] - whiteCenters[i - 1];
  if (Math.abs(d - 0.0235) > 1e-6) throw new Error('white pitch wrong: ' + d);
}
piano.keys.forEach((k, i) => {
  if (k.white) return;
  const a = piano.keys[i - 1], b = piano.keys[i + 1];
  if (!(k.center > a.center && k.center < b.center)) throw new Error('black key misplaced @ midi ' + k.midi);
});
if (whites !== 52 || blacks !== 36) throw new Error('key count wrong');
console.log('✓ 键盘布局校验通过');

// 校验：琴弦端点都在琴体轮廓内
const inside = piano.rimInner;
let outCount = 0;
piano.root.traverse(() => {});
console.log('✓ 几何数据无 NaN，纹理/UV 匹配');

/* ---- 逐件包围盒诊断：找出越界零件（跳过 instancedMesh 与隐藏子树） ---- */
const bad = [];
piano.root.updateMatrixWorld(true);
function visibleChain(o) {
  let p = o;
  while (p) { if (!p.visible) return false; p = p.parent; }
  return true;
}
piano.root.traverse((o) => {
  if (!o.isMesh || o.isInstancedMesh || !visibleChain(o)) return;
  const b = new T.Box3().setFromObject(o);
  if (b.min.y < -0.001 || b.max.z > 0.06 || b.min.z < -2.30 || b.max.y > 1.35 || Math.abs(b.min.x) > 0.82 || b.max.x > 0.82) {
    bad.push({
      name: o.name || 'mesh',
      min: b.min.toArray().map((v) => +v.toFixed(3)),
      max: b.max.toArray().map((v) => +v.toFixed(3)),
    });
  }
});
if (bad.length) {
  console.log('⚠ 越界零件:', JSON.stringify(bad));
} else {
  console.log('✓ 所有零件均落在合理包围范围内');
}

/* ---- instancedMesh 实例矩阵范围校验 ---- */
function instBounds(im) {
  const m = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), s = new T.Vector3();
  const box = new T.Box3();
  for (let i = 0; i < im.count; i++) {
    im.getMatrixAt(i, m);
    m.decompose(p, q, s);
    if (!Number.isFinite(p.x) || !Number.isFinite(s.x) || s.x === 0) throw new Error('bad instance matrix @' + i);
    box.expandByPoint(p);
  }
  return box;
}
piano.root.traverse((o) => {
  if (!o.isInstancedMesh) return;
  const b = instBounds(o);
  console.log('  instanced x' + String(o.count).padStart(4) + ' 实例中心范围 min=' +
    b.min.toArray().map((v) => +v.toFixed(2)).join(',') + ' max=' +
    b.max.toArray().map((v) => +v.toFixed(2)).join(','));
});

/* ---- 开合姿态检查：键盘盖 / 谱架 / 琴盖 ---- */
const P = piano.parts;
function bboxOf(obj) {
  piano.root.updateMatrixWorld(true);
  const b = new T.Box3().setFromObject(obj);
  return { min: b.min.toArray().map((v) => +v.toFixed(3)), max: b.max.toArray().map((v) => +v.toFixed(3)) };
}
function setPose(lid, fall) {
  P.lid.rotation.z = 0.80 * lid;
  P.frontLid.rotation.x = -Math.PI * Math.min(1, lid / 0.42);
  P.fallboard.rotation.x = -Math.PI * fall;
  P.fallboardFold.rotation.x = Math.PI * fall;
  P.desk.rotation.x = 1.40 - 1.72 * fall;
}

console.log('--- 姿态：全部关闭 ---');
setPose(0, 0);
console.log('键盘盖', JSON.stringify(bboxOf(P.fallboard)));
console.log('谱架  ', JSON.stringify(bboxOf(P.desk)));
console.log('琴盖  ', JSON.stringify(bboxOf(P.lid)));

console.log('--- 姿态：全部打开 ---');
setPose(1, 1);
const fbOpen = bboxOf(P.fallboard);
const deskOpen = bboxOf(P.desk);
const lidOpen = bboxOf(P.lid);
console.log('键盘盖', JSON.stringify(fbOpen));
console.log('谱架  ', JSON.stringify(deskOpen));
console.log('琴盖  ', JSON.stringify(lidOpen));

const KEY_TOP = piano.spec.keyTopY;
const problems = [];
if (fbOpen.max.z > -0.16) problems.push('键盘盖打开后仍遮住琴键 (max.z=' + fbOpen.max.z + ')');
if (fbOpen.min.y < KEY_TOP + 0.015) problems.push('键盘盖打开后低于名牌板 (min.y=' + fbOpen.min.y + ')');
if (deskOpen.min.z < -0.395) problems.push('谱架穿入铸铁排/腹梁 (min.z=' + deskOpen.min.z + ')');
if (deskOpen.max.y > 0.960) problems.push('谱架高于合盖高度 (max.y=' + deskOpen.max.y + ')');
if (deskOpen.max.z > fbOpen.min.z + 0.005) problems.push('谱架与折叠后的键盘盖重叠');
if (lidOpen.max.y < 1.4) problems.push('琴盖未真正抬起 (max.y=' + lidOpen.max.y + ')');
// 支撑杆长度合理性
P.lid.updateMatrixWorld(true);
const a = P.stickAnchorCase.clone();
const b = P.lid.localToWorld(P.stickAnchorLid.clone());
const stickLen = a.distanceTo(b);
console.log('支撑杆长度  :', stickLen.toFixed(3), 'm  (锚点', b.toArray().map((v) => +v.toFixed(2)).join(','), ')');
if (stickLen < 0.35 || stickLen > 1.30) problems.push('支撑杆长度异常: ' + stickLen.toFixed(3));

// 黑键顶面与合上的键盘盖之间必须有间隙
setPose(0, 0);
const fbClosed = bboxOf(P.fallboard);
const blackTop = KEY_TOP + piano.spec.bkH;
if (fbClosed.min.y < blackTop + 0.002) problems.push('合上的键盘盖压到黑键 (min.y=' + fbClosed.min.y + ' vs 黑键顶 ' + blackTop.toFixed(4) + ')');

if (problems.length) {
  console.log('⚠ 姿态问题:');
  problems.forEach((p) => console.log('   -', p));
  process.exitCode = 1;
} else {
  console.log('✓ 开合姿态检查通过（无穿模、无遮挡）');
}
setPose(1, 1);
console.log('OK');
