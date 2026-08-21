/* 把 j20.html 里内联的模块脚本抠出来，便于单独做语法检查 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(dir, 'j20.html'), 'utf8');
const open = '<script type="module">';
const a = html.indexOf(open) + open.length;
const b = html.lastIndexOf('</script>');
const code = html.slice(a, b);
const out = path.join(dir, '.bundle.mjs');
fs.writeFileSync(out, code);
console.log(`已导出 ${(code.length / 1048576).toFixed(2)} MB → ${path.basename(out)}`);
