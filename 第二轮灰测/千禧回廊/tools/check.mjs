// tools/check.mjs —— 关卡 + 渲染 端到端体检（不需要浏览器，也不需要眼睛）
//  1) 编译全部关卡；2) 出生点可站；3) 洪水填充连通性；4) 可交互物 / 精灵是否够得到
//  5) 离屏渲染若干视点，统计画面亮度 / 色彩丰富度 / 是否出现"材质缺失"洋红
import fs from 'node:fs';
import path from 'node:path';
import { encodePNG, upscale } from './png.mjs';
import { compile, isSolid, collides, setCell } from '../src/world/compile.js';import { ZONE_DEFS, ZONE_ORDER } from '../src/world/zones.js';
import { Renderer } from '../src/gfx/raycast.js';
import { animateProps } from '../src/gfx/props.js';

const W = 384, H = 216;
let fail = 0;
const ok = (c, msg) => { console.log(`${c ? '  ✔' : '  ✘'} ${msg}`); if (!c) fail++; };

function flood(world, sx, sy, links = []) {
  const seen = new Set();
  const jump = new Map();
  for (const [a, b] of links) {
    jump.set(`${a[0]},${a[1]}`, b);
    jump.set(`${b[0]},${b[1]}`, a);   // 传送门当成双向通道来验连通性
  }
  const q = [[Math.floor(sx), Math.floor(sy)]];
  seen.add(`${q[0][0]},${q[0][1]}`);
  while (q.length) {
    const [x, y] = q.pop();
    const neigh = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    const j = jump.get(`${x},${y}`);
    if (j) neigh.push(j);
    for (const [nx, ny] of neigh) {
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      if (isSolid(world, nx, ny)) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}

// —— 真·可走性：用玩家的碰撞体在半米格子上泛洪 ——
//    这一步专抓"格子上通、身体过不去"的几何夹角（斜向门洞、被家具堵死的过道）
const NAV = 0.25, RAD = 0.31;
function navFlood(world, sx, sy, links = []) {
  const gw = Math.ceil(world.w / NAV), gh = Math.ceil(world.h / NAV);
  const ok = (nx, ny) => nx >= 0 && ny >= 0 && nx < gw && ny < gh
    && !collides(world, (nx + 0.5) * NAV, (ny + 0.5) * NAV, RAD);
  const seen = new Uint8Array(gw * gh);
  const toNode = (x, y) => [Math.floor(x / NAV), Math.floor(y / NAV)];
  const jump = new Map();
  for (const [a, b] of links) {
    const A = toNode(a[0] + 0.5, a[1] + 0.5), B = toNode(b[0] + 0.5, b[1] + 0.5);
    jump.set(A[1] * gw + A[0], B);
    jump.set(B[1] * gw + B[0], A);
  }
  const s = toNode(sx, sy);
  if (!ok(...s)) return { seen, gw, gh, ok, bad: 'spawn' };
  seen[s[1] * gw + s[0]] = 1;
  const q = [s];
  while (q.length) {
    const [x, y] = q.pop();
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    const j = jump.get(y * gw + x);
    if (j) nb.push(j);
    for (const [nx, ny] of nb) {
      if (!ok(nx, ny)) continue;
      const k = ny * gw + nx;
      if (seen[k]) continue;
      seen[k] = 1; q.push([nx, ny]);
    }
  }
  return { seen, gw, gh, ok };
}

function frameStats(data) {  let lum = 0, magenta = 0, blown = 0;
  const bucket = new Set();
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    lum += 0.299 * r + 0.587 * g + 0.114 * b;
    if (r > 150 && b > 150 && g < 70) magenta++;
    if (0.299 * r + 0.587 * g + 0.114 * b > 248) blown++;
    bucket.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
  }
  const n = data.length / 4;
  return { lum: lum / n, magentaPct: (magenta / n) * 100, blownPct: (blown / n) * 100, colors: bucket.size };
}

const outDir = path.resolve('preview');
fs.mkdirSync(outDir, { recursive: true });
const renderer = new Renderer(W, H);
let openFloors = 0;

for (const id of ZONE_ORDER) {
  const def = ZONE_DEFS[id];
  console.log(`\n【${id}】${def.name}`);
  let world;
  try { world = compile(def); } catch (e) { ok(false, `编译失败: ${e.message}`); continue; }
  ok(true, `尺寸 ${world.w}×${world.h}`);

  // 体检按"全部机关都已打开、全部灯都已亮"的终局状态来验，
  // 否则会把故意封着的通道误报成设计错误
  for (const [x, y, ch] of def.checkOpen || []) setCell(world, x, y, ch);
  for (const l of world.lights) l.on = true;

  // 网格自洽：每格必须是"墙"或"有地面"
  let bogus = 0;
  for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
    if (!world.walls[y][x] && !world.floors[y][x]) bogus++;
  }
  ok(bogus === 0, `每格都有归属（既非墙又无地面的格子：${bogus}）`);

  // 出生点
  const sp = def.spawn;
  ok(!isSolid(world, Math.floor(sp.x), Math.floor(sp.y)), `出生点 (${sp.x},${sp.y}) 不在墙里`);
  ok(!collides(world, sp.x, sp.y, 0.26), '出生点不与精灵/墙相撞');

  // 连通性（传送门算通道）
  const links = (def.teleports || []).map((t) => [t.from, [Math.floor(t.to.x), Math.floor(t.to.y)]]);
  const reach = flood(world, sp.x, sp.y, links);
  let total = 0;
  for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) if (!isSolid(world, x, y)) total++;
  openFloors += total;
  ok(reach.size === total, `可走格 ${total} 个，从出生点可达 ${reach.size} 个`);
  if (reach.size !== total) {
    const lost = [];
    for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
      if (!isSolid(world, x, y) && !reach.has(`${x},${y}`)) lost.push(`${x},${y}`);
    }
    console.log(`     孤岛格：${lost.slice(0, 30).join(' ')}${lost.length > 30 ? ` …共${lost.length}` : ''}`);
  }

  // 可交互物是否站得到（周围 1 格内要有可达地面）
  const unreachable = [];
  for (const it of world.interactables) {
    let good = false;
    for (let dy = -2; dy <= 2 && !good; dy++) for (let dx = -2; dx <= 2 && !good; dx++) {
      const cx = Math.floor(it.x) + dx, cy = Math.floor(it.y) + dy;
      if (!reach.has(`${cx},${cy}`)) continue;
      const d = Math.hypot(cx + 0.5 - it.x, cy + 0.5 - it.y);
      if (d < (it.r || 1.2)) good = true;
    }
    if (!good) unreachable.push(it.id);
  }
  ok(unreachable.length === 0, `${world.interactables.length} 个可交互物都能走到${unreachable.length ? `（够不到：${unreachable.join(', ')}）` : ''}`);

  // 精灵是否卡在墙里
  const stuck = world.sprites.filter((s) => isSolid(world, Math.floor(s.x), Math.floor(s.y)))
    .map((s) => `${s.p}@${s.x},${s.y}`);
  ok(stuck.length === 0, `${world.sprites.length} 个精灵都在可走格里${stuck.length ? `（埋墙里：${stuck.join(', ')}）` : ''}`);

  // —— 身体真的过得去吗（0.5m 格 + 玩家碰撞体）——
  const nav = navFlood(world, sp.x, sp.y, links);
  if (nav.bad === 'spawn') {
    ok(false, '出生点连身体都放不下');
  } else {
    let navTotal = 0, navSeen = 0;
    const orphanCells = new Set();
    for (let ny = 0; ny < nav.gh; ny++) for (let nx = 0; nx < nav.gw; nx++) {
      if (!nav.ok(nx, ny)) continue;
      navTotal++;
      if (nav.seen[ny * nav.gw + nx]) navSeen++;
      else orphanCells.add(`${Math.floor((nx + 0.5) * NAV)},${Math.floor((ny + 0.5) * NAV)}`);
    }
    const pct = ((navSeen / navTotal) * 100).toFixed(1);
    ok(navSeen === navTotal,
      `可站点 ${navTotal} 个，身体走得到 ${navSeen} 个（${pct}%）` +
      (orphanCells.size ? ` ← 夹角/被堵：${[...orphanCells].slice(0, 12).join(' ')}` : ''));

    // 可交互物必须有一个"站得住又够得到"的落脚点
    const noStand = [];
    for (const it of world.interactables) {
      let good = false;
      const r = (it.r || 1.3) * 0.85;
      const span = Math.ceil(r / NAV) + 1;
      const cx = Math.floor(it.x / NAV), cy = Math.floor(it.y / NAV);
      for (let dy = -span; dy <= span && !good; dy++) for (let dx = -span; dx <= span && !good; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= nav.gw || ny >= nav.gh) continue;
        if (!nav.seen[ny * nav.gw + nx]) continue;
        if (Math.hypot((nx + 0.5) * NAV - it.x, (ny + 0.5) * NAV - it.y) <= r) good = true;
      }
      if (!good) noStand.push(it.id);
    }
    ok(noStand.length === 0, `每个可交互物都有落脚点${noStand.length ? `（站不到：${noStand.join(', ')}）` : ''}`);
  }

  // —— 离屏渲染 4 个朝向 ——
  animateProps(1.7);
  const shots = [];
  for (let k = 0; k < 4; k++) {
    const cam = { x: sp.x, y: sp.y, a: sp.a + (k * Math.PI) / 2, fov: 1.16, ez: 1.62, pitch: 0 };
    const data = renderer.render(world, cam, { grain: 6.5, scanlines: 0.05, warm: 1.3, sat: 1.06, bloom: 0.45, bloomThreshold: 192, time: 1.7 });
    const st = frameStats(data);
    shots.push({ k, ...st });
    const buf = new Uint8ClampedArray(data);
    fs.writeFileSync(path.join(outDir, `${id}-${k}.png`), encodePNG(W, H, buf));
  }
  for (const s of shots) {
    const bad = s.magentaPct > 0.5 || s.lum < 14 || s.lum > 215 || s.colors < 22 || s.blownPct > 6;
    console.log(`  ${bad ? '✘' : '✔'} 视角${s.k}: 亮度 ${s.lum.toFixed(1)}  色彩数 ${s.colors}  过曝 ${s.blownPct.toFixed(1)}%  洋红 ${s.magentaPct.toFixed(2)}%`);
    if (bad) fail++;
  }
}

// 一张 5 场景拼图，方便一眼看全
console.log(`\n总可走格：${openFloors}`);
console.log(fail === 0 ? '\n✔ 全部体检通过' : `\n✘ ${fail} 项不通过`);
process.exit(fail === 0 ? 0 : 1);
