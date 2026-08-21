// tools/bundle.mjs —— 零依赖迷你打包器：把 ES 模块图内联成单个 HTML
//   目的：让游戏能直接双击打开（file:// 不允许加载 ES 模块）
//   做法：拓扑排序 → 每个模块包成函数 + 一个 __req 注册表 → 重写 import/export
//   打完包会在 Node 里真的跑一遍模块接线，确认没接错。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');

const RE_NS = /^[ \t]*import\s+\*\s+as\s+([\w$]+)\s+from\s+['"]([^'"]+)['"];?[ \t]*$/gm;
const RE_NAMED = /^[ \t]*import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];?[ \t]*$/gm;
const RE_SIDE = /^[ \t]*import\s+['"]([^'"]+)['"];?[ \t]*$/gm;

function moduleId(abs) { return './' + path.relative(SRC, abs).split(path.sep).join('/'); }

function readModule(abs) {
  const code = fs.readFileSync(abs, 'utf8');
  const deps = [];
  for (const re of [RE_NS, RE_NAMED, RE_SIDE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(code))) deps.push(m[m.length - 1]);
  }
  return { abs, id: moduleId(abs), code, deps };
}

function resolveDep(fromAbs, spec) {
  return path.resolve(path.dirname(fromAbs), spec);
}

/** 收集模块图（拓扑序） */
function collect(entryAbs) {
  const mods = new Map();
  const order = [];
  const visiting = new Set();
  (function visit(abs) {
    const id = moduleId(abs);
    if (mods.has(id)) return;
    if (visiting.has(id)) throw new Error(`循环依赖: ${id}`);
    visiting.add(id);
    const m = readModule(abs);
    for (const d of m.deps) visit(resolveDep(abs, d));
    visiting.delete(id);
    mods.set(id, m);
    order.push(m);
  })(entryAbs);
  return order;
}

/** 找出这个模块导出了哪些名字，并去掉 export 关键字 */
function transform(m) {
  let code = m.code;
  // import → __req
  code = code.replace(RE_NS, (_, name, spec) =>
    `const ${name} = __req(${JSON.stringify(normalize(m.abs, spec))});`);
  code = code.replace(RE_NAMED, (_, names, spec) =>
    `const {${names.replace(/\s+as\s+/g, ': ')}} = __req(${JSON.stringify(normalize(m.abs, spec))});`);
  code = code.replace(RE_SIDE, (_, spec) => `__req(${JSON.stringify(normalize(m.abs, spec))});`);

  // 收集导出名
  const names = new Set();
  for (const re of [
    /^[ \t]*export\s+(?:async\s+)?function\s+([\w$]+)/gm,
    /^[ \t]*export\s+class\s+([\w$]+)/gm,
    /^[ \t]*export\s+(?:const|let|var)\s+([\w$]+)/gm,
  ]) {
    re.lastIndex = 0;
    let mm;
    while ((mm = re.exec(code))) names.add(mm[1]);
  }
  // export { a, b }
  code = code.replace(/^[ \t]*export\s*\{([^}]*)\};?[ \t]*$/gm, (_, list) => {
    for (const part of list.split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop().trim();
      if (n) names.add(n);
    }
    return '';
  });
  // 去掉 export 关键字（只在行首）
  code = code.replace(/^([ \t]*)export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\s)/gm, '$1');

  const tail = [...names].map((n) => `  __x.${n} = ${n};`).join('\n');
  return { id: m.id, body: code, tail, names: [...names] };
}

function normalize(fromAbs, spec) { return moduleId(resolveDep(fromAbs, spec)); }

function buildBundle(entryId, entryAbs) {
  const order = collect(entryAbs).map(transform);
  const parts = order.map((m) => `
// ═══════════════════════════════════════ ${m.id}
__def(${JSON.stringify(m.id)}, function (__x, __req) {
${m.body}
${m.tail}
});`);
  return `(function () {
'use strict';
var __defs = {}, __cache = {};
function __def(id, fn) { __defs[id] = fn; }
function __req(id) {
  if (__cache[id]) return __cache[id];
  var fn = __defs[id];
  if (!fn) throw new Error('模块未打包: ' + id);
  var x = __cache[id] = {};
  fn(x, __req);
  return x;
}
${parts.join('\n')}
globalThis.__BUNDLE = __req(${JSON.stringify(entryId)});
})();`;
}

// ---------------------------------------------------------------------------
//  1) 先做一次接线自检：把 game.js 当入口在 Node 里跑一遍
// ---------------------------------------------------------------------------
const testCode = buildBundle('./game/game.js', path.join(SRC, 'game/game.js'));
try {
  // eslint-disable-next-line no-new-func
  new Function(testCode)();
  const G = globalThis.__BUNDLE;
  if (typeof G.Game !== 'function') throw new Error('打包后 Game 不是构造函数');
  console.log('✔ 接线自检通过：打包后的模块注册表能正确解析出 Game');
} catch (e) {
  console.error('✘ 打包后的代码跑不起来：' + e.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
//  2) 正式打包成单文件 HTML
// ---------------------------------------------------------------------------
const code = buildBundle('./main.js', path.join(SRC, 'main.js'));
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(
  /<script type="module"[^>]*><\/script>/,
  `<script>\n${code}\n</script>`
);
html = html.replace('<title>', '<!-- 单文件构建：全部代码内联，可直接双击打开 -->\n<title>');

const outDir = path.join(ROOT, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'qianxi-huilang.html');
fs.writeFileSync(out, html, 'utf8');

const kb = (fs.statSync(out).size / 1024).toFixed(0);
console.log(`✔ 单文件构建 → ${path.relative(ROOT, out)}  (${kb} KB，可直接双击打开)`);
