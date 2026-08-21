/* =========================================================
   tools/ascii.js — 文本化验收美术（无需图形环境）
   用法:
     node tools/ascii.js steve            角色/方块/道具彩色像素图
     node tools/ascii.js steve --sil      只看剪影（大精灵判形状）
     node tools/ascii.js run --anim       打印一整套动画帧的剪影
     node tools/ascii.js --list           列出全部素材名
   ========================================================= */
'use strict';
const { install, load, ALL } = require('./env.js');
install();
const G = load(['core.js', 'art.js']);

const CHARS = '@#%&$*=+o~-:.·^';

function grab(name, frame) {
  const PX = G.PX;
  if (PX.mobNames.indexOf(name) >= 0) return PX.mob(name, frame | 0);
  if (PX.tileNames.indexOf(name) >= 0) return PX.tile(name, 0, 0);
  if (PX.itemNames.indexOf(name) >= 0) return PX.item(name, frame | 0);
  if (PX.decoNames.indexOf(name) >= 0) return PX.deco(name);
  if (PX.playerPoses.indexOf(name) >= 0) return PX.player(name, frame | 0);
  return null;
}

function silhouette(title, cv) {
  const w = cv.width, h = cv.height, d = cv.data;
  const lines = [];
  for (let y = 0; y < h; y++) {
    let s = '';
    for (let x = 0; x < w; x++) {
      const a = d[(y * w + x) * 4 + 3];
      s += a < 24 ? ' ' : (a < 150 ? '+' : '#');
    }
    lines.push(s.replace(/\s+$/, ''));
  }
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  console.log(`\n┌─ 剪影 ${title} ${w}x${h}`);
  lines.forEach(l => console.log('│ ' + l));
  console.log('└─');
}

// 亮度 ramp：判读带明暗的像素画最直观（暗→亮）
const RAMP = ' .:-=+*x#%@';
function luma(title, cv) {
  const w = cv.width, h = cv.height, d = cv.data;
  const lines = [];
  for (let y = 0; y < h; y++) {
    let s = '';
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      if (d[p + 3] < 24) { s += ' '; continue; }
      const L = (d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11) / 255;
      s += RAMP[Math.min(RAMP.length - 1, Math.max(1, Math.round(L * (RAMP.length - 1))))];
    }
    lines.push(s.replace(/\s+$/, ''));
  }
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  console.log(`\n┌─ 明暗 ${title} ${w}x${h}   (暗 ${RAMP.trim()} 亮)`);
  lines.forEach(l => console.log('│ ' + l));
  console.log('└─');
}

// 数值体检：确认描边 / 顶光 / 底部遮蔽真的生效
function stats(title, cv) {
  const w = cv.width, h = cv.height, d = cv.data;
  let opaque = 0, uniq = new Set(), edge = 0;
  let topSum = 0, topN = 0, botSum = 0, botN = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      if (d[p + 3] < 24) continue;
      opaque++;
      uniq.add((d[p] >> 3) << 10 | (d[p + 1] >> 3) << 5 | (d[p + 2] >> 3));
      const L = d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11;
      if (L < 42) edge++;                       // 近黑 = 描边像素
      if (y < h * 0.3) { topSum += L; topN++; }
      if (y > h * 0.7) { botSum += L; botN++; }
    }
  }
  const top = topN ? topSum / topN : 0, bot = botN ? botSum / botN : 0;
  console.log(`${title.padEnd(16)} ${w}x${h} 不透明 ${String(opaque).padStart(5)} 色阶 ${String(uniq.size).padStart(3)} ` +
    `描边 ${String(edge).padStart(4)} 上部亮度 ${top.toFixed(0).padStart(3)} 下部亮度 ${bot.toFixed(0).padStart(3)} ` +
    (top > bot ? '✔上亮下暗' : '⚠明暗方向异常'));
  return { opaque, uniq: uniq.size, edge, top, bot };
}

function dump(title, cv) {
  const w = cv.width, h = cv.height, d = cv.data;
  const counts = new Map();
  for (let i = 0; i < w * h; i++) {
    if (d[i * 4 + 3] < 24) continue;
    const k = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]].join(',');
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const map = new Map();
  sorted.forEach(([k], i) => map.set(k, CHARS[i] || '?'));
  const lines = [];
  for (let y = 0; y < h; y++) {
    let s = '';
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      s += d[i + 3] < 24 ? ' ' : (map.get([d[i], d[i + 1], d[i + 2]].join(',')) || '?');
    }
    lines.push(s.replace(/\s+$/, ''));
  }
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  console.log(`\n╔═ ${title}  ${w}x${h}  颜色 ${sorted.length}`);
  lines.forEach(l => console.log('║ ' + l));
  console.log('╚═ ' + sorted.slice(0, 12).map(([k], i) => {
    const rgb = k.split(',').map(Number);
    return CHARS[i] + '=#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
  }).join(' '));
  return sorted.length;
}

const args = process.argv.slice(2);
const names = args.filter(a => !a.startsWith('--'));
const sil = args.includes('--sil');
const lum = args.includes('--luma');
const st = args.includes('--stats');
const anim = args.includes('--anim');
const fArg = args.filter(a => /^--f\d+$/.test(a))[0];
const frame = fArg ? Number(fArg.slice(3)) : 0;

if (args.includes('--list')) {
  console.log('角色姿态:', G.PX.playerPoses.join(' '));
  console.log('怪物    :', G.PX.mobNames.join(' '));
  console.log('方块    :', G.PX.tileNames.join(' '));
  console.log('道具    :', G.PX.itemNames.join(' '));
  console.log('装饰    :', G.PX.decoNames.join(' '));
  process.exit(0);
}
if (args.includes('--all-stats')) {
  console.log('=== 全部素材数值体检 ===');
  G.PX.playerPoses.forEach(n => stats('姿态 ' + n, G.PX.player(n, 0)));
  G.PX.mobNames.forEach(n => stats('怪物 ' + n, G.PX.mob(n, 0)));
  G.PX.itemNames.forEach(n => stats('道具 ' + n, G.PX.item(n, 0)));
  G.PX.decoNames.forEach(n => stats('装饰 ' + n, G.PX.deco(n)));
  G.PX.tileNames.forEach(n => stats('方块 ' + n, G.PX.tile(n, 0, 0)));
  process.exit(0);
}

if (!names.length) { console.log('用法: node tools/ascii.js <名称...> [--luma|--sil|--stats|--anim|--fN] | --list | --all-stats'); process.exit(1); }

for (const n of names) {
  if (anim) {
    const frames = G.PX.poseFrames(n) || 1;
    for (let f = 0; f < frames; f++) {
      const cv = grab(n, f);
      if (cv) (lum ? luma : silhouette)(n + ' 帧' + f, cv);
    }
    continue;
  }
  const cv = grab(n, frame);
  if (!cv) { console.log('未找到素材: ' + n); continue; }
  if (st) stats(n, cv);
  else if (lum) luma(n + ' f' + frame, cv);
  else if (sil) silhouette(n + ' f' + frame, cv);
  else dump(n + ' f' + frame, cv);
}
