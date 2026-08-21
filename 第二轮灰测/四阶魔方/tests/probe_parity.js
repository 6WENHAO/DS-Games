const C = require('../src/cube4.js');

function describe(seq) {
  let st;
  try { st = C.applySeq(C.solvedState(), seq); } catch (e) { return 'parse error: ' + e.message; }
  const ce = C.centerErrors(st);
  const up = C.unpairedEdges(st);
  const r = C.reduce(st);
  if (!r) return `centers=${ce} unpaired=${up} (无法降阶)`;
  const flipped = [], moved = [], twisted = [], cmoved = [];
  for (let i = 0; i < 12; i++) { if (r.eo[i]) flipped.push(C.EDGE_SLOTS[i].name); if (r.ep[i] !== i) moved.push(C.EDGE_SLOTS[i].name); }
  for (let i = 0; i < 8; i++) { if (r.co[i]) twisted.push(C.CORNER_SLOTS[i].key); if (r.cp[i] !== i) cmoved.push(C.CORNER_SLOTS[i].key); }
  return `centers=${ce} unpaired=${up} | 翻棱[${flipped}] 换棱[${moved}] 扭角[${twisted}] 换角[${cmoved}]`;
}

const cands = {
  'OLL-parity A (2R=内层)': "2R2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 2R2",
  'OLL-parity B (Rw=宽层)': "Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2",
  'OLL-parity C (经典 Lucas)': "2R U2 2R U2 2R U2 2R U2 2R",
  'OLL-parity D': "2R2 B2 2R' U2 2R' U2 B2 2R' B2 2R B2 2R' B2 2R2 B2",
  'PLL-parity A (2R2 U2 2R2 Uw2 2R2 Uw2)': "2R2 U2 2R2 Uw2 2R2 Uw2",
  'PLL-parity B (Rw2 U2 Rw2 Uw2 Rw2 Uw2)': "Rw2 U2 Rw2 Uw2 Rw2 Uw2",
  'PLL-parity C (2R2 U2 2R2 2U2 2R2 2U2)': "2R2 U2 2R2 2U2 2R2 2U2",
  'PLL-parity D (2R2 B2 U2 2L U2 ...)': "2R2 U2 2R2 U2 2R2 U2",
};
for (const [k, v] of Object.entries(cands)) console.log(k.padEnd(44) + ' -> ' + describe(v));
