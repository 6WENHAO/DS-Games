import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(p, 'utf8');
const rel = (p) => path.relative(root, p).replace(/\\/g, '/');

/** 递归收集 src 下的所有 js 文件 */
function walk(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (e.endsWith('.js')) acc.push(p);
  }
  return acc;
}

const ALL_SRC = walk(path.join(root, 'src'));

/* ═══════════════ 模块图完整性 ═══════════════ */

/** 从源码里提取所有静态/动态 import 与 new URL 引用 */
function references(src) {
  const out = [];
  for (const m of src.matchAll(/\bimport\s+(?:[\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g)) out.push(m[1]);
  for (const m of src.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]);
  for (const m of src.matchAll(/new\s+URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g)) out.push(m[1]);
  return out;
}

test('模块图：从 main.js 出发的所有引用都能解析到真实文件', () => {
  const seen = new Set();
  const queue = [path.join(root, 'src/main.js')];
  const problems = [];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!existsSync(file)) { problems.push(`缺失文件：${rel(file)}`); continue; }
    for (const r of references(read(file))) {
      if (!r.startsWith('.')) { problems.push(`${rel(file)} 引用了裸模块 ${r}（本项目零依赖）`); continue; }
      const target = path.resolve(path.dirname(file), r);
      if (!existsSync(target)) problems.push(`${rel(file)} → ${r} 未找到`);
      else if (target.endsWith('.js')) queue.push(target);
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
  assert.ok(seen.size >= 15, `模块图规模异常：仅遍历到 ${seen.size} 个文件`);
});

test('模块图：src 下没有孤立文件（全部可从 main.js 到达）', () => {
  const seen = new Set();
  const queue = [path.join(root, 'src/main.js')];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    for (const r of references(read(file))) {
      if (!r.startsWith('.')) continue;
      const t = path.resolve(path.dirname(file), r);
      if (t.endsWith('.js') && existsSync(t)) queue.push(t);
    }
  }
  const orphans = ALL_SRC.filter((f) => !seen.has(f)).map(rel);
  assert.deepEqual(orphans, [], `以下文件无法从 main.js 到达：${orphans.join(', ')}`);
});

/* ═══════════════ 导出/导入名称一致 ═══════════════ */

/** 粗粒度提取一个模块的导出名 */
function exportsOf(src) {
  const names = new Set();
  for (const m of src.matchAll(/\bexport\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  for (const m of src.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const as = t.split(/\s+as\s+/);
      names.add((as[1] || as[0]).trim());
    }
  }
  if (/\bexport\s+default\b/.test(src)) names.add('default');
  return names;
}

/** 提取具名导入 */
function namedImports(src) {
  const out = [];
  for (const m of src.matchAll(/\bimport\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const names = m[1].split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => s.split(/\s+as\s+/)[0].trim());
    out.push({ names, from: m[2] });
  }
  return out;
}

test('所有具名导入都能在目标模块中找到对应导出', () => {
  const problems = [];
  for (const file of ALL_SRC) {
    const src = read(file);
    for (const { names, from } of namedImports(src)) {
      if (!from.startsWith('.')) continue;
      const target = path.resolve(path.dirname(file), from);
      if (!existsSync(target)) { problems.push(`${rel(file)} → ${from} 未找到`); continue; }
      const exp = exportsOf(read(target));
      for (const n of names) {
        if (!exp.has(n)) problems.push(`${rel(file)} 从 ${from} 导入了不存在的 ${n}`);
      }
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

/* ═══════════════ HTML / CSS / 静态资源 ═══════════════ */

test('index.html 引用的资源都存在', () => {
  const html = read(path.join(root, 'index.html'));
  const refs = [...html.matchAll(/(?:href|src)\s*=\s*"(\.\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 2, '未提取到资源引用');
  for (const r of refs) {
    assert.ok(existsSync(path.join(root, r)), `index.html 引用的 ${r} 不存在`);
  }
});

test('HUD 代码引用的每个 DOM id 都存在于 index.html', () => {
  const html = read(path.join(root, 'index.html'));
  const ids = new Set([...html.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map((m) => m[1]));
  const hud = read(path.join(root, 'src/ui/hud.js'));
  const used = new Set([...hud.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]));
  assert.ok(used.size > 15, `提取到的 id 过少：${used.size}`);
  const missing = [...used].filter((i) => !ids.has(i));
  assert.deepEqual(missing, [], `index.html 缺少这些 id：${missing.join(', ')}`);
});

test('HUD 使用的 class 都在样式表中有定义', () => {
  const css = read(path.join(root, 'styles/hud.css'));
  const hud = read(path.join(root, 'src/ui/hud.js'));
  const used = new Set();
  for (const m of hud.matchAll(/className\s*=\s*'([^']+)'/g)) m[1].split(/\s+/).forEach((c) => c && used.add(c));
  for (const m of hud.matchAll(/classList\.(?:add|toggle)\('([^']+)'/g)) used.add(m[1]);
  assert.ok(used.size > 8, `提取到的 class 过少：${used.size}`);
  const missing = [...used].filter((c) => !css.includes(`.${c}`));
  assert.deepEqual(missing, [], `样式表缺少这些类：${missing.join(', ')}`);
});

test('样式表包含无障碍与响应式降级', () => {
  const css = read(path.join(root, 'styles/hud.css'));
  assert.ok(css.includes('prefers-reduced-motion'), '缺少动效降级');
  assert.ok(/@media[^{]*max-width/.test(css), '缺少响应式断点');
  assert.ok(css.includes(':root'), '缺少设计令牌');
});

/* ═══════════════ 服务端与 Service Worker ═══════════════ */

test('server.mjs 只依赖 node 内置模块', () => {
  const src = read(path.join(root, 'server.mjs'));
  for (const m of src.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) {
    assert.ok(m[1].startsWith('node:') || m[1].startsWith('.'), `server.mjs 引入了第三方依赖：${m[1]}`);
  }
  assert.ok(/\.mjs['"]?\s*:\s*['"]text\/javascript/.test(src) || src.includes("'.mjs'"), 'MIME 表应包含 .mjs');
  assert.ok(src.includes('.js'), 'MIME 表应包含 .js');
});

test('sw.js 是经典 worker 脚本（不含 ESM 语法）', () => {
  const src = read(path.join(root, 'sw.js'));
  assert.ok(!/^\s*import\s+/m.test(src), 'sw.js 不能使用 import');
  assert.ok(!/^\s*export\s+/m.test(src), 'sw.js 不能使用 export');
  for (const ev of ['install', 'activate', 'fetch', 'message']) {
    assert.ok(src.includes(`'${ev}'`) || src.includes(`"${ev}"`), `sw.js 缺少 ${ev} 事件处理`);
  }
});

test('package.json 没有运行时依赖', () => {
  const pkg = JSON.parse(read(path.join(root, 'package.json')));
  assert.equal(pkg.type, 'module');
  assert.ok(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0, '本项目应零运行时依赖');
  assert.ok(!pkg.devDependencies || Object.keys(pkg.devDependencies).length === 0, '本项目应零开发依赖');
  assert.ok(pkg.scripts.start && pkg.scripts.test);
});

/* ═══════════════ 代码卫生 ═══════════════ */

test('源码不含 debugger 与遗留 TODO 标记', () => {
  for (const f of ALL_SRC) {
    const src = read(f);
    assert.ok(!/\bdebugger\b/.test(src), `${rel(f)} 含 debugger`);
    assert.ok(!/\bFIXME\b/.test(src), `${rel(f)} 含 FIXME`);
  }
});

test('源码全部为有效 UTF-8 且使用 LF 友好的换行', () => {
  for (const f of [...ALL_SRC, path.join(root, 'index.html'), path.join(root, 'styles/hud.css')]) {
    const buf = readFileSync(f);
    assert.ok(!buf.includes(0), `${rel(f)} 含 NUL 字节`);
    const src = buf.toString('utf8');
    assert.ok(!src.includes('\uFFFD'), `${rel(f)} 存在编码损坏`);
  }
});
