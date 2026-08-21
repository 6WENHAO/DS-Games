// ---------------------------------------------------------------------------
// verify-standalone.mjs — 对打包产物 standalone.html 做 Node 端全量验证：
//   把内联脚本里的入口换成测试入口，用 __req 取回各模块，跑「完整建模 +
//   健康体检」，口径与 tools/smoke.mjs 一致。
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
  const { buildPagoda, LAYOUT } = __req('src/pagoda/pagoda.js');
  const { buildJointBench, JOINTS } = __req('src/pagoda/joints.js');
  const CAI = __req('src/lib/cai.js');

  const warns = [];
  const ow = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));

  const t0 = performance.now();
  const { group, info } = buildPagoda();
  const ms = performance.now() - t0;
  const bench = buildJointBench({ gap: 4.3 });
  bench.update(0.6);
  bench.update(0);
  console.warn = ow;

  const scene = new THREE.Scene();
  scene.add(group);
  scene.add(bench.group);
  group.updateMatrixWorld(true);
  bench.group.updateMatrixWorld(true);

  let meshes = 0, tris = 0;
  const bad = [], mats = new Set();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    mats.add(o.material.name || o.material.type);
    const g = o.geometry;
    const pos = g.attributes.position;
    if (!pos) { bad.push(o.name + ': 无 position'); return; }
    const n = o.isInstancedMesh ? o.count : 1;
    tris += ((g.index ? g.index.count : pos.count) / 3) * n;
    g.computeBoundingBox();
    const bb = g.boundingBox;
    if (![bb.min.x, bb.min.y, bb.max.y].every(Number.isFinite)) bad.push(o.name + ': NaN 顶点');
    if (!g.attributes.uv) bad.push(o.name + ': 缺 uv');
    if (!g.attributes.normal) bad.push(o.name + ': 缺 normal');
  });

  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const jb = new THREE.Box3().setFromObject(bench.group);
  const jsz = jb.getSize(new THREE.Vector3());
  const line = '-'.repeat(60);
  const out = [];
  out.push(line);
  out.push('  材广 ' + (CAI.CAI * 100).toFixed(1) + ' cm   1 分° = ' + (CAI.FEN * 100).toFixed(2) + ' cm');
  out.push('  构建耗时        ' + ms.toFixed(0) + ' ms');
  out.push('  构件总数        ' + info.pieces.toLocaleString());
  out.push('  铺作朵数        ' + info.puzuoCount);
  out.push('  铺作变体        ' + info.bank.defs.size + '（实例 ' + info.instances + '）');
  out.push('  网格数          ' + meshes);
  out.push('  三角面          ' + Math.round(tris).toLocaleString());
  out.push('  材质            ' + mats.size);
  out.push(line);
  out.push('  塔身高（含刹）  ' + info.bodyHeight.toFixed(2) + ' m');
  out.push('  总高（含台基）  ' + info.totalHeight.toFixed(2) + ' m   目标 67.31 m');
  out.push('  包围盒          ' + size.x.toFixed(2) + ' × ' + size.y.toFixed(2) + ' × ' + size.z.toFixed(2) + ' m');
  out.push(line);
  out.push('  榫卯示教件      ' + JOINTS.length + ' 种，共 ' + bench.items.reduce((a, b) => a + b.parts.length, 0) + ' 个零件组');
  JOINTS.forEach((j, i) => {
    out.push('   ' + String(i + 1).padStart(2) + '. ' + j.name.padEnd(8) + ' ' + j.sub.padEnd(22) + ' 零件 ' + bench.items[i].parts.length);
  });
  out.push(line);
  out.push('  各层标高：');
  for (const L of info.layers) {
    out.push(
      '   ' + String(L.name).padEnd(6) + ' 地面 ' + (L.y0 ?? 0).toFixed(2).padStart(6) +
      '  檐口 ' + (L.yEave ?? 0).toFixed(2).padStart(6) + '  顶 ' + (L.yTop ?? 0).toFixed(2).padStart(6)
    );
  }

  globalThis.__VERIFY__ = {
    ok: bad.length === 0 && warns.length === 0,
    bad, warns, lines: out,
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
console.log('-'.repeat(60));
if (r.warns.length) {
  console.log('⚠ 警告 ' + r.warns.length + '：');
  [...new Set(r.warns)].slice(0, 8).forEach((w) => console.log('   ' + w));
}
if (r.bad.length) {
  console.log('✗ 几何问题 ' + r.bad.length + '：');
  [...new Set(r.bad)].slice(0, 12).forEach((b) => console.log('   ' + b));
}
console.log(r.ok ? '✓ 检查通过' : '△ 见上');
process.exit(r.ok ? 0 : 1);
