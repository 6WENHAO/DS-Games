/* 构建单文件离线 HTML：把 three.js / OrbitControls / 几何 / 应用内联进一个 <script type="module">
 * 这样双击 file:// 打开也能跑（不会撞上 ES module 的 CORS 限制），且完全不依赖外网。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => fs.readFileSync(path.join(dir, p), 'utf8');

/* 1) three.js：删掉末尾唯一的 export 语句，符号留在模块作用域里 */
let three = read('vendor/three.module.mjs');
const eIdx = three.lastIndexOf('\nexport {');
if (eIdx < 0) throw new Error('未找到 three.js 的 export 语句');
three = three.slice(0, eIdx);

/* 2) OrbitControls：删掉 import 与 export，并包进独立作用域
 *    （它与 three.js 都在顶层声明了 _ray / _plane 等同名常量，
 *      直接拼进同一个模块作用域会「Identifier already declared」导致整包解析失败） */
let orbit = read('vendor/OrbitControls.js');
orbit = orbit.replace(/^import\s*\{[\s\S]*?\}\s*from\s*['"]three['"];?/m, '');
orbit = orbit.replace(/export\s*\{\s*OrbitControls\s*\};?/, '');
if (/^\s*import\s/m.test(orbit) || /^\s*export\s/m.test(orbit)) throw new Error('OrbitControls 仍残留 import/export');
orbit = `const OrbitControls = (function(){\n${orbit}\nreturn OrbitControls;\n})();`;

/* 3) 我的代码 */
const geom = read('src/j20-geometry.js');
const app = read('src/app.js');

const banner = `/* J-20 procedural 3D model — self-contained build
 * three.js r160 (MIT, © three.js authors) + OrbitControls, inlined.
 * 机体几何 / 蒙皮贴图 / 军徽 / 天空环境 全部由代码生成。
 * 生成时间 ${new Date().toISOString()}
 */`;

let bundle = [banner, three, orbit, geom, app].join('\n\n');
// 防止意外提前闭合 <script>
bundle = bundle.replace(/<\/script/gi, '<\\/script');

const shell = read('src/shell.html');
if (!shell.includes('/*__BUNDLE__*/')) throw new Error('shell.html 缺少注入点');
const out = shell.replace('/*__BUNDLE__*/', () => bundle);

const target = path.join(dir, 'j20.html');
fs.writeFileSync(target, out);

/* 4) 自检 */
let syntax = 'ok';
try { new Function(bundle); }               // 只编译不执行：可捕获重复声明等语法错误
catch (e) { syntax = (e && e.message) || String(e); }

const checks = [
  [syntax === 'ok', '整包语法错误：' + syntax],
  [!/^\s*import\s/m.test(bundle), 'bundle 中仍有 import 语句'],
  [!/^\s*export\s/m.test(bundle), 'bundle 中仍有 export 语句'],
  [/const OrbitControls = \(function\(\)\{/.test(bundle), 'OrbitControls 未被包进独立作用域'],
  [/function buildJ20/.test(bundle), '缺少 buildJ20'],
  [/const renderer = new WebGLRenderer/.test(bundle), '缺少渲染器初始化'],
  [!/<\/script>/i.test(out.slice(out.indexOf('<script type="module">') + 22, out.lastIndexOf('</script>'))), 'bundle 内出现了 </script>'],
];
const bad = checks.filter(([ok]) => !ok).map(([, m]) => m);
console.log(`已生成 ${path.relative(process.cwd(), target)}  ${(out.length / 1048576).toFixed(2)} MB`);
console.log(`  three.js ${(three.length / 1024).toFixed(0)} KB · OrbitControls ${(orbit.length / 1024).toFixed(0)} KB · 几何 ${(geom.length / 1024).toFixed(1)} KB · 应用 ${(app.length / 1024).toFixed(1)} KB`);
if (bad.length) { bad.forEach((m) => console.log(' - ' + m)); process.exitCode = 1; }
else console.log('  构建自检通过');
