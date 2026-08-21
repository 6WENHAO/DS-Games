/* 构建：把 src/* 内联成单文件 index.html（开箱即用，无任何外部依赖） */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const src = p => readFileSync(join(root, 'src', p), 'utf8');

const WORKER_GLUE = `
/* ---- Web Worker 入口 ---- */
if (typeof self !== 'undefined') {
  self.onmessage = function (e) {
    var d = e.data || {};
    try {
      var res = self.SOLVER.solve(Uint8Array.from(d.state), d.method, function (p) {
        self.postMessage({ type: 'progress', label: p.label, frac: p.frac });
      });
      self.postMessage({ type: 'done', res: res });
    } catch (err) {
      self.postMessage({ type: 'error', message: (err && err.message) || String(err) });
    }
  };
}
`;

const cube4 = src('cube4.js');
const solver = src('solver.js');
const render = src('render.js');
const app = src('app.js');
const css = src('style.css');

const workerBundle = [
  '/* ===== cube4.js ===== */', cube4,
  '/* ===== solver.js ===== */', solver,
  WORKER_GLUE
].join('\n');

const appBundle = [
  '/* ===== cube4.js ===== */', cube4,
  '/* ===== render.js ===== */', render,
  '/* ===== app.js ===== */', app
].join('\n');

for (const [name, text] of [['worker', workerBundle], ['app', appBundle]]) {
  if (/<\/script/i.test(text)) throw new Error(name + ' 包含 </script 字面量，会破坏内联');
}

let html = src('index.template.html')
  .replace('/*__CSS__*/', () => css)
  .replace('/*__WORKER__*/', () => workerBundle)
  .replace('/*__APP__*/', () => appBundle);

const out = join(root, 'index.html');
writeFileSync(out, html);
const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`已生成 ${out}  (${kb} KB)`);
