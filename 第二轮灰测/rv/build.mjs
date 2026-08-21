/* 构建：把 src/* 内联为单文件 index.html */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(fileURLToPath(import.meta.url));
const src = p => readFileSync(join(root, 'src', p), 'utf8');
const js = ['/* ===== mesh.js ===== */', src('mesh.js'), '/* ===== rv.js ===== */', src('rv.js'),
  '/* ===== render.js ===== */', src('render.js'), '/* ===== app.js ===== */', src('app.js')].join('\n');
if (/<\/script/i.test(js)) throw new Error('脚本含 </script 字面量');
const html = src('index.template.html').replace('/*__CSS__*/', () => src('style.css')).replace('/*__JS__*/', () => js);
writeFileSync(join(root, 'index.html'), html);
console.log(`已生成 index.html (${(Buffer.byteLength(html) / 1024).toFixed(1)} KB)`);
