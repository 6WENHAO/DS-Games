// ---------------------------------------------------------------------------
// Node 端「冒烟测试」：用最小 DOM 桩在无浏览器环境里真正跑一遍建模流程，
// 提前抓出语法错误、API 误用、几何合并失败、NaN 顶点与动画异常。
//   node tools/smoke.mjs
// ---------------------------------------------------------------------------
import { register } from 'node:module';

register('./three-hooks.mjs', import.meta.url);

/* ------------------------------ DOM 桩 ---------------------------------- */
function makeCtx2D() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      return (...args) => {
        switch (k) {
          case 'createRadialGradient':
          case 'createLinearGradient':
            return { addColorStop() {} };
          case 'createImageData': {
            const w = Math.max(1, args[0] | 0);
            const h = Math.max(1, args[1] | 0);
            return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
          }
          case 'getImageData': {
            const w = Math.max(1, args[2] | 0);
            const h = Math.max(1, args[3] | 0);
            return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
          }
          case 'measureText':
            return { width: 8 };
          default:
            return undefined;
        }
      };
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
}

const canvasStub = () => ({
  width: 1,
  height: 1,
  style: {},
  getContext: () => makeCtx2D(),
  toDataURL: () => 'data:,',
  addEventListener() {},
  removeEventListener() {},
});

globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? canvasStub() : { style: {}, appendChild() {} }),
  createElementNS: () => canvasStub(),
  getElementById: () => null,
  addEventListener() {},
  body: { classList: { toggle() {} } },
};
globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  addEventListener() {},
};
globalThis.self = globalThis.window;
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(0), 0);

/* ------------------------------- 载入 ----------------------------------- */
const warns = [];
const origWarn = console.warn;
console.warn = (...a) => {
  warns.push(a.join(' '));
};

const THREE = await import('three');
const { buildTown } = await import('../src/world/town.js');
const { buildTerrain, buildWater, buildForest } = await import('../src/world/terrain.js');
const { createSky } = await import('../src/fx/sky.js');
const { createSmoke, createSpray, createGlows, createBirds } = await import('../src/fx/particles.js');
const { DISTRICTS } = await import('../src/world/districts.js');

/* ------------------------------- 建模 ----------------------------------- */
const scene = new THREE.Scene();
const t0 = performance.now();
const sky = createSky(scene);
scene.add(buildTerrain());
const water = buildWater();
scene.add(water.group);
scene.add(buildForest());
const town = buildTown();
scene.add(town.group);
const smoke = createSmoke(town.anchors.smoke ?? []);
const spray = createSpray(town.anchors.fountain ?? []);
const glows = createGlows(town.anchors.glow ?? []);
const birds = createBirds(20);
scene.add(smoke.points, spray.points, glows.points, birds.mesh);
const buildMs = performance.now() - t0;

/* ------------------------------- 体检 ----------------------------------- */
let meshes = 0;
let tris = 0;
let instanceCount = 0;
const bad = [];
const mats = new Set();
scene.traverse((o) => {
  if (!o.isMesh && !o.isPoints) return;
  meshes++;
  if (o.material) mats.add(o.material.name || o.material.type);
  const g = o.geometry;
  const pos = g && g.attributes && g.attributes.position;
  if (!pos) {
    bad.push(`${o.name || o.type}: 缺少 position`);
    return;
  }
  const n = o.isInstancedMesh ? o.count : 1;
  if (o.isInstancedMesh) instanceCount += o.count;
  tris += ((g.index ? g.index.count : pos.count) / 3) * n;
  if (o.name === 'skyDome') return; // 天空球本来就很大
  g.computeBoundingBox();
  const bb = g.boundingBox;
  const vals = [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z];
  if (vals.some((v) => !Number.isFinite(v))) bad.push(`${o.name || o.type}: 顶点含 NaN/Inf`);
  else if (!o.isPoints && (bb.max.y > 400 || bb.min.y < -400)) {
    bad.push(`${o.name || o.type}: 高度可疑 ${bb.min.y.toFixed(1)}..${bb.max.y.toFixed(1)}`);
  }
  if (o.isMesh && !g.attributes.uv) bad.push(`${o.name || o.type}: 缺少 uv`);
  if (o.isMesh && !g.attributes.normal) bad.push(`${o.name || o.type}: 缺少 normal`);
});

/* ----------------------------- 跑一段动画 ------------------------------- */
let animErr = null;
const focus = new THREE.Vector3(0, 6, 0);
try {
  for (let f = 0; f < 40; f++) {
    const t = f * 0.05;
    const info = sky.update((6 + t * 12) % 24, focus);
    sky.animateClouds(0.05);
    sky.setShadowRange(120 + f * 4);
    for (const fn of town.updates) fn(0.05, t);
    water.updates.forEach((fn) => fn(0.05, t));
    smoke.update(0.05, t);
    spray.update(0.05, t);
    glows.update(0.05, t, info.nightK);
    birds.update(0.05, t);
  }
} catch (e) {
  animErr = e;
}

console.warn = origWarn;

/* ------------------------------- 报告 ----------------------------------- */
const line = '─'.repeat(58);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
console.log(line);
console.log(`  three.js        r${THREE.REVISION}`);
console.log(`  片区数          ${DISTRICTS.length}`);
console.log(`  构建耗时        ${buildMs.toFixed(0)} ms`);
console.log(`  合并后网格      ${meshes}`);
console.log(`  三角面          ${fmt(tris)}`);
console.log(`  实例化对象      ${fmt(instanceCount)}`);
console.log(`  几何构件        ${fmt(town.stats.pieces)}`);
console.log(`  材质种类        ${mats.size}`);
console.log(`  动画回调        ${town.updates.length}`);
console.log(`  烟囱/烟源       ${(town.anchors.smoke ?? []).length}`);
console.log(`  灯光光晕        ${(town.anchors.glow ?? []).length}`);
console.log(`  喷泉            ${(town.anchors.fountain ?? []).length}`);
console.log(line);

/* --------------------------- 片区落位核对 ------------------------------- */
const box = new THREE.Box3();
const rows = [];
for (const child of town.group.children) {
  const id = child.userData.district || child.name;
  box.makeEmpty();
  box.expandByObject(child);
  if (!Number.isFinite(box.min.x)) continue;
  let m = 0;
  child.traverse((o) => {
    if (o.isMesh) m++;
  });
  const d = DISTRICTS.find((x) => x.id === id);
  let note = '';
  if (d) {
    const [bx0, bz0, bx1, bz1] = d.bounds;
    const slackX = Math.max(bx0 - box.min.x, box.max.x - bx1);
    const slackZ = Math.max(bz0 - box.min.z, box.max.z - bz1);
    note = `越界 x${slackX > 14 ? '↑' : ''}${slackX.toFixed(0)} z${slackZ > 14 ? '↑' : ''}${slackZ.toFixed(0)}`;
  }
  rows.push(
    `  ${String(id).padEnd(12)} 网格${String(m).padStart(3)}  ` +
      `x[${box.min.x.toFixed(0)}..${box.max.x.toFixed(0)}] ` +
      `z[${box.min.z.toFixed(0)}..${box.max.z.toFixed(0)}] ` +
      `高${box.max.y.toFixed(1)}  ${note}`
  );
}
console.log('── 片区落位 ' + '─'.repeat(46));
rows.forEach((r) => console.log(r));
console.log(line);

if (warns.length) {
  console.log(`⚠ three 警告 ${warns.length} 条：`);
  [...new Set(warns)].slice(0, 12).forEach((w) => console.log('   ' + w));
}
if (bad.length) {
  console.log(`✗ 几何问题 ${bad.length} 条：`);
  [...new Set(bad)].slice(0, 20).forEach((b) => console.log('   ' + b));
}
if (animErr) {
  console.log('✗ 动画异常：');
  console.log(animErr);
}
const ok = !bad.length && !animErr && !warns.length;
console.log(ok ? '✓ 全部检查通过' : '△ 见上方提示');
process.exit(ok ? 0 : 1);
