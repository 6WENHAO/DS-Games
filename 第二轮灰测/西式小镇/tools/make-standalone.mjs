// ---------------------------------------------------------------------------
// make-standalone.mjs — 把整个小镇打包成「单文件 HTML」：
//   双击 standalone.html 即可用 file:// 直接打开，无需任何服务器。
//
//   node tools/make-standalone.mjs [输出路径]
//
// 原理：ES Module 在 file:// 下会被浏览器 CORS 拦截，所以这里用一个迷你
// 模块系统把全部代码内联进一个 <script type="module">：
//   * import * as X from 'a'   →  const X = __req('a');
//   * import { a, b as c }     →  const { a, b: c } = __req('a');
//   * export function/const/…  →  去掉 export 关键字，模块末尾追加 exports.X = X;
// 所有模块函数共享 __defs / __req，行为与 ESM 一致（本仓库无循环依赖、
// 无动态 import、无 export default，已断言）。
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.dirname(path.dirname(url.fileURLToPath(import.meta.url)));
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'standalone.html'));

/* ------------------------------ 模块解析 -------------------------------- */
function resolveSpec(spec, importerId) {
  if (spec === 'three') return 'vendor/three.module.js';
  if (spec.startsWith('three/addons/')) return 'vendor/addons/' + spec.slice('three/addons/'.length);
  let p = path.posix.normalize(path.posix.join(path.posix.dirname(importerId), spec));
  if (!path.posix.extname(p)) p += '.js';
  return p;
}

/* --------------------- 注释掩码（保持长度不变） ----------------------------
   只掩码 // 行注释与块注释。字符串/模板字面量不掩码：否则引号内内容被抹掉，
   import … from 'spec' 就提取不到 spec 了。字符串里出现 import/export 语句
   形态的概率可忽略，且打包后有「残留 import/export 断言 + Node 全量建模 +
   无头浏览器真机」三重验证兜底。 */
function maskNonCode(src) {
  const out = src.split('');
  const n = src.length;
  const blank = (from, to) => {
    for (let k = from; k < to && k < n; k++) if (src[k] !== '\n' && src[k] !== '\r') out[k] = ' ';
  };
  let i = 0;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') {
      let j = i + 2;
      while (j < n && src[j] !== '\n') j++;
      blank(i, j);
      i = j;
    } else if (c === '/' && src[i + 1] === '*') {
      let j = i + 2;
      while (j < n && !(src[j] === '*' && src[j + 1] === '/')) j++;
      blank(i, Math.min(j + 2, n));
      i = j + 2;
    } else {
      i++;
    }
  }
  return out.join('');
}

/* --------------------------- 具名列表解析 -------------------------------- */
function parseNamedList(text) {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const parts = item.split(/\s+as\s+/);
      return parts.length === 2
        ? { local: parts[0].trim(), alias: parts[1].trim() }
        : { local: item, alias: item };
    });
}

/* ----------------------------- 模块改写 ---------------------------------- */
function transformModule(src, importerId) {
  const masked = maskNonCode(src);
  const patches = [];
  const exportNames = [];
  const exportAliases = [];
  const reExports = [];
  const imports = [];

  const pushPatch = (start, end, text) => patches.push({ start, end, text });

  // import 语句（支持跨行、* as、具名、默认）
  const importRe =
    /import\s*(?:([A-Za-z_$][\w$]*)\s*,\s*)?(?:\*\s*as\s+([A-Za-z_$][\w$]*)|{([\s\S]*?)})\s*from\s*['"]([^'"]+)['"]\s*;?/g;
  let m;
  while ((m = importRe.exec(masked)) !== null) {
    const [full, def, star, named, spec] = m;
    const id = resolveSpec(spec, importerId);
    imports.push(id);
    let rep;
    if (star) {
      rep = `const ${star} = __req(${JSON.stringify(id)});`;
    } else if (named) {
      const names = parseNamedList(named);
      const parts = names.map(({ local, alias }) =>
        alias === local ? local : `${local}: ${alias}`
      );
      rep = `const { ${parts.join(', ')} } = __req(${JSON.stringify(id)});`;
    } else if (def) {
      rep = `const ${def} = __req(${JSON.stringify(id)}).default;`;
    } else {
      rep = `__req(${JSON.stringify(id)});`;
    }
    pushPatch(m.index, m.index + full.length, rep);
  }
  // 副作用 import：import 'x';
  const sideRe = /import\s*['"]([^'"]+)['"]\s*;?/g;
  while ((m = sideRe.exec(masked)) !== null) {
    const id = resolveSpec(m[1], importerId);
    imports.push(id);
    pushPatch(m.index, m.index + m[0].length, `__req(${JSON.stringify(id)});`);
  }

  // export function/class/const/let/var NAME …
  const declRe = /export\s+(function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g;
  while ((m = declRe.exec(masked)) !== null) {
    exportNames.push(m[2]);
    pushPatch(m.index, m.index + 'export '.length, '');
  }

  // export { a, b as c } 或 export { a } from 'x'
  const listRe = /export\s*{([\s\S]*?)}\s*(?:from\s*['"]([^'"]+)['"])?\s*;?/g;
  while ((m = listRe.exec(masked)) !== null) {
    const list = parseNamedList(m[1]);
    if (m[2]) {
      const id = resolveSpec(m[2], importerId);
      imports.push(id);
      for (const { local, alias } of list) reExports.push({ alias, id, name: local });
    } else {
      for (const { local, alias } of list) exportAliases.push({ alias, local });
    }
    pushPatch(m.index, m.index + m[0].length, '');
  }

  // export default 在本仓库不存在；若出现直接报错，避免悄悄写错
  if (/export\s+default\b/.test(masked)) {
    throw new Error(`${importerId}: 存在 export default，打包器不支持`);
  }

  // 应用补丁（从后往前，保证偏移不失效）
  patches.sort((a, b) => b.start - a.start);
  let body = src;
  for (const p of patches) {
    body = body.slice(0, p.start) + p.text + body.slice(p.end);
  }

  // 模块末尾统一导出
  const lines = [];
  for (const name of exportNames) lines.push(`exports.${name} = ${name};`);
  for (const { alias, local } of exportAliases) lines.push(`exports.${alias} = ${local};`);
  for (const { alias, id, name } of reExports)
    lines.push(`exports.${alias} = __req(${JSON.stringify(id)}).${name};`);

  return { body: body + '\n' + lines.join('\n'), imports };
}

/* --------------------------- 依赖图收集 ---------------------------------- */
const defs = {};
const seen = new Set();

function collect(id) {
  if (seen.has(id)) return;
  seen.add(id);
  const file = path.join(ROOT, id);
  if (!fs.existsSync(file)) throw new Error(`找不到模块: ${id} (${file})`);
  const { body, imports } = transformModule(fs.readFileSync(file, 'utf8'), id);
  defs[id] = body;
  for (const dep of imports) collect(dep);
}

collect('src/main.js');

/* ------------------------------ 生成代码 --------------------------------- */
const defLines = Object.entries(defs).map(
  ([id, body]) => `  ${JSON.stringify(id)}: function (exports, __req) {\n${body}\n  },`
);

const bundle = `(() => {
  'use strict';
  const __defs = {
${defLines.join('\n')}
  };
  const __cache = Object.create(null);
  function __req(id) {
    const hit = __cache[id];
    if (hit) return hit.exports;
    const exports = {};
    __cache[id] = { exports };
    __defs[id](exports, __req);
    return exports;
  }
  /*__ENTRY__*/
  __req('src/main.js');
})();
`;

// 安全断言：打包结果里不应再有 import/export 语句
const leftover = bundle.split('\n').filter((l) => /^\s*(import|export)\b/.test(l));
if (leftover.length) {
  throw new Error(`打包后仍有 ${leftover.length} 行 import/export：\n${leftover.slice(0, 5).join('\n')}`);
}

/* ------------------------------ 组装 HTML -------------------------------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');

// 注意：必须用「函数」替换，不能传字符串——否则 bundle 里的 $'、$&、$$ 等
// 会被 String.replace 当成特殊替换模式展开（three.js 里有大量 $ 字符）。
let out = html
  .replace('<link rel="stylesheet" href="./styles.css" />', () => `<style>\n${css}\n</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>/, () => '')
  .replace(
    '<script type="module" src="./src/main.js"></script>',
    () =>
      `<!-- 单文件离线版：双击即可打开（打包自 make-standalone.mjs） -->\n    <script type="module">\n${bundle}\n    </script>`
  );

fs.writeFileSync(OUT, out);
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`✓ 已生成 ${path.relative(ROOT, OUT)}（${kb} KB，${Object.keys(defs).length} 个模块）`);
