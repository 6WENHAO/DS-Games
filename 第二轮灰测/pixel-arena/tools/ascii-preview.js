// tools/ascii-preview.js — 设计器输出 ASCII 预览
// 用法：node tools/ascii-preview.js [FIREFOX_F|SPROUTAUR_F|...|all]
'use strict';
const PAL = require('../js/palette.js').PAL;
const { buildAll, DESIGNERS } = require('./designer.js');

const LUM_CHARS = ' .:-=+*#%@';
function lum(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return Math.floor((0.299 * r + 0.587 * g + 0.114 * b) / 256 * (LUM_CHARS.length - 1));
}

const all = buildAll();
function render(m, label) {
  console.log('==== ' + label + ' (' + m.w + 'x' + m.h + ') ====');
  for (const row of m.rows) {
    let out = '';
    for (const ch of row) {
      if (ch === '.') { out += ' '; continue; }
      const code = ch.charCodeAt(0);
      const idx = code >= 48 && code <= 57 ? code - 48 : code - 65 + 10;
      out += LUM_CHARS[lum(PAL[idx])] || '?';
    }
    console.log(out);
  }
}

const which = process.argv[2] || 'FIREFOX_F';
if (which === 'all') {
  for (const name of Object.keys(DESIGNERS)) render(all[name], name);
} else {
  if (!all[which]) { console.log('unknown: ' + which + '; available: ' + Object.keys(DESIGNERS).join(', ')); process.exit(1); }
  render(all[which], which);
}
