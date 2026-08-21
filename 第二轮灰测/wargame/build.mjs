/* 构建：把 src/* 内联为单文件 index.html（零依赖、可离线双击打开） */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(fileURLToPath(import.meta.url));
const src = p => readFileSync(join(root, 'src', p), 'utf8');

const js = [
  '/* ===== scenario.js ===== */', src('scenario.js'),
  '/* ===== engine.js ===== */', src('engine.js'),
  '/* ===== render3d.js ===== */', src('render3d.js'),
  '/* ===== ui.js ===== */', src('ui.js')
].join('\n');
if (/<\/script/i.test(js)) throw new Error('脚本内含 </script 字面量，会破坏内联');

const html = src('index.template.html')
  .replace('/*__CSS__*/', () => src('style.css'))
  .replace('/*__JS__*/', () => js);
const out = join(root, 'index.html');
writeFileSync(out, html);
console.log(`已生成 ${out}  (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
