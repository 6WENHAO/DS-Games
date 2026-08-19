// tools/export-maps.js — 把设计器输出导出为静态地图文件 js/maps.generated.js
// 用法：node tools/export-maps.js
'use strict';
const fs = require('fs');
const path = require('path');
const { buildAll } = require('./designer.js');

const all = buildAll();
let out = '// 自动生成（node tools/export-maps.js）—— 请勿手改，改动请修改 tools/designer.js\n';
out += "'use strict';\nconst MAPDATA = {\n";
for (const name of Object.keys(all)) {
  const m = all[name];
  out += `  ${name}: { w: ${m.w}, h: ${m.h}, rows: [\n`;
  for (const row of m.rows) out += `    '${row}',\n`;
  out += '  ] },\n';
}
out += '};\n';
out += "if (typeof module !== 'undefined' && module.exports) module.exports = MAPDATA;\n";

const dest = path.join(__dirname, '..', 'js', 'maps.generated.js');
fs.writeFileSync(dest, out, 'utf8');
console.log('written', dest, out.length + ' bytes');

// 校验
const errs = [];
for (const name of Object.keys(all)) {
  const m = all[name];
  if (m.rows.length !== m.h) errs.push(name + ' rows!=h');
  m.rows.forEach((r, i) => { if (r.length !== m.w) errs.push(name + ' row ' + i + ' len=' + r.length); });
  let n = 0;
  for (const r of m.rows) for (const ch of r) if (ch !== '.') n++;
  if (n < 40) errs.push(name + ' 有效像素过少 ' + n);
}
if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); process.exit(1); }
console.log('all maps validated OK');
