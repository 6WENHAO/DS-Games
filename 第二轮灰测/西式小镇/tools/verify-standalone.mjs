// ---------------------------------------------------------------------------
// verify-standalone.mjs — 对打包产物 standalone.html 做 Node 端全量验证：
//   把内联脚本里的入口换成测试入口，用 __req 取回各模块，跑「完整建模 +
//   健康体检 + 40 帧动画 + 片区落位核对」，口径与 tools/smoke.mjs 一致。
//   node tools/verify-standalone.mjs [standalone.html]
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import vm from 'node:vm';

const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const FILE = path.resolve(process.argv[2] || path.join(ROOT, 'standalone.html'));

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
globalThis.location = { search: '' };

/* ------------------------- 提取内联脚本并替换入口 ------------------------ */
const html = fs.readFileSync(FILE, 'utf8');
const m = html.match(/<script type="module">([\s\S]*?)<\/script>/);
if (!m) {
  console.error('✗ 未在 standalone.html 中找到内联模块脚本');
  process.exit(2);
}

const testEntry = `/*__ENTRY__*/
(() => {
  const THREE = __req('vendor/three.module.js');
  const { buildTown } = __req('src/world/town.js');
  const { buildTerrain, buildWater, buildForest } = __req('src/world/terrain.js');
  const { createSky } = __req('src/fx/sky.js');
  const { createSmoke, createSpray, createGlows, createBirds } = __req('src/fx/particles.js');
  const { DISTRICTS } = __req('src/world/districts.js');

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

  let meshes = 0, tris = 0, instanceCount = 0;
  const bad = [], mats = new Set();
  scene.traverse((o) => {
    if (!o.isMesh && !o.isPoints) return;
    meshes++;
    if (o.material) mats.add(o.material.name || o.material.type);
    const g = o.geometry;
    const pos = g && g.attributes && g.attributes.position;
    if (!pos) { bad.push(o.name + ': 缺少 position'); return; }
    const n = o.isInstancedMesh ? o.count : 1;
    if (o.isInstancedMesh) instanceCount += o.count;
    tris += ((g.index ? g.index.count : pos.count) / 3) * n;
    if (o.name === 'skyDome') return;
    g.computeBoundingBox();
    const bb = g.boundingBox;
    const vals = [bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z];
    if (vals.some((v) => !Number.isFinite(v))) bad.push(o.name + ': 顶点含 NaN/Inf');
    else if (!o.isPoints && (bb.max.y > 400 || bb.min.y < -400))
      bad.push(o.name + ': 高度可疑 ' + bb.min.y.toFixed(1) + '..' + bb.max.y.toFixed(1));
    if (o.isMesh && !g.attributes.uv) bad.push(o.name + ': 缺少 uv');
    if (o.isMesh && !g.attributes.normal) bad.push(o.name + ': 缺少 normal');
  });

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
  } catch (e) { animErr = e; }

  const line = '-'.repeat(58);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const out = [];
  out.push(line);
  out.push('  three.js        r' + THREE.REVISION);
  out.push('  片区数          ' + DISTRICTS.length);
  out.push('  构建耗时        ' + buildMs.toFixed(0) + ' ms');
  out.push('  合并后网格      ' + meshes);
  out.push('  三角面          ' + fmt(tris));
  out.push('  实例化对象      ' + fmt(instanceCount));
  out.push('  几何构件        ' + fmt(town.stats.pieces));
  out.push('  材质种类        ' + mats.size);
  out.push('  动画回调        ' + town.updates.length);
  out.push('  烟囱/烟源       ' + (town.anchors.smoke ?? []).length);
  out.push('  灯光光晕        ' + (town.anchors.glow ?? []).length);
  out.push('  喷泉            ' + (town.anchors.fountain ?? []).length);

  const box = new THREE.Box3();
  for (const child of town.group.children) {
    const id = child.userData.district || child.name;
    box.makeEmpty();
    box.expandByObject(child);
    if (!Number.isFinite(box.min.x)) continue;
    let mm = 0;
    child.traverse((o) => { if (o.isMesh) mm++; });
    const d = DISTRICTS.find((x) => x.id === id);
    let note = '';
    if (d) {
      const [bx0, bz0, bx1, bz1] = d.bounds;
      const slackX = Math.max(bx0 - box.min.x, box.max.x - bx1);
      const slackZ = Math.max(bz0 - box.min.z, box.max.z - bz1);
      if (slackX > 14 || slackZ > 14) note = '越界!';
    }
    out.push('  ' + String(id).padEnd(12) + ' 网格' + String(mm).padStart(3) + '  x[' + box.min.x.toFixed(0) + '..' + box.max.x.toFixed(0) + '] z[' + box.min.z.toFixed(0) + '..' + box.max.z.toFixed(0) + '] 高' + box.max.y.toFixed(1) + '  ' + note);
  }

  globalThis.__VERIFY__ = {
    ok: bad.length === 0 && !animErr,
    bad, animErr: animErr ? String(animErr) : null, lines: out,
  };
})();
`;

const code = m[1].replace(
  "/*__ENTRY__*/\n  __req('src/main.js');",
  testEntry
);
if (code === m[1]) {
  console.error('✗ 未能在内联脚本中定位入口标记');
  process.exit(2);
}

vm.runInThisContext(code, { filename: 'standalone-bundle.js' });

const r = globalThis.__VERIFY__;
if (!r) {
  console.error('✗ 测试入口未执行完成');
  process.exit(2);
}
console.log(r.lines.join('\n'));
console.log('-'.repeat(58));
if (r.bad.length) {
  console.log('✗ 几何问题 ' + r.bad.length + ' 条：');
  [...new Set(r.bad)].slice(0, 20).forEach((b) => console.log('   ' + b));
}
if (r.animErr) console.log('✗ 动画异常：\n' + r.animErr);
console.log(r.ok ? '✓ 全部检查通过' : '△ 见上方提示');
process.exit(r.ok ? 0 : 1);
