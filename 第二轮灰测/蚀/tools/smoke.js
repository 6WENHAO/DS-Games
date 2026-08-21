/* ===================================================================
   tools/smoke.js —— Node 无头逻辑冒烟测试
   用最小桩件加载游戏模块，检查：
   1) 图集生成不崩
   2) 12 层地牢生成：连通性 / 出生点合法 / 出口可达 / 刷怪点可达
   3) 60 秒模拟战斗：玩家挥砍 → 敌人死亡 → 血肉/贴花产出，无异常
   4) 渲染几何构建（矩阵路径）不崩且产出顶点
   运行： node tools/smoke.js
   =================================================================== */
'use strict';

/* --------------------------- 浏览器桩件 --------------------------- */
const grad = () => ({ addColorStop() { } });
const ctx2d = {
  imageSmoothingEnabled: false, globalAlpha: 1,
  fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '',
  fillRect() { }, clearRect() { }, strokeRect() { }, save() { }, restore() { },
  beginPath() { }, closePath() { }, rect() { }, clip() { }, arc() { },
  fill() { }, stroke() { }, moveTo() { }, lineTo() { }, quadraticCurveTo() { },
  bezierCurveTo() { }, fillText() { }, strokeText() { }, translate() { }, rotate() { }, scale() { },
  createLinearGradient: grad, createRadialGradient: grad, createPattern: () => null,
  getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() { },
  drawImage() { },
};
global.window = global;
global.document = {
  readyState: 'loading',
  addEventListener() { },
  removeEventListener() { },
  getElementById() { return null; },
  querySelectorAll() { return []; },
  createElement(tag) {
    return {
      tag: tag, width: 0, height: 0, style: {}, clientWidth: 960, clientHeight: 540,
      getContext() { return ctx2d; },
      addEventListener() { }, appendChild() { },
      classList: { add() { }, remove() { }, toggle() { } },
    };
  },
  body: { appendChild() { } },
};
try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'node' }, configurable: true }); } catch (e) { }
global.requestAnimationFrame = () => 0;
global.cancelAnimationFrame = () => { };
global.localStorage = {
  _d: {}, getItem(k) { return this._d[k] || null; },
  setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; },
};

/* --------------------------- 加载模块 --------------------------- */
const path = require('path');
const FILES = ['util.js', 'audio.js', 'gl.js', 'art.js', 'mapgen.js', 'gore.js',
  'entities.js', 'player.js', 'relics.js', 'render.js', 'ui.js', 'game.js'];
for (const f of FILES) require(path.join(__dirname, '..', 'js', f));

const G = global.G;
const U = G.U;

let failures = 0, checks = 0;
function ok(cond, label, extra) {
  checks++;
  if (cond) console.log('  ✓ ' + label);
  else { failures++; console.log('  ✗ ' + label + (extra !== undefined ? '  → ' + extra : '')); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

/* --------------------------- 1. 图集 --------------------------- */
section('纹理图集');
const atlas = G.Art.buildAtlas();
ok(!!atlas, '图集画布生成');
ok(Object.keys(G.Art.T).length >= 25, '图块 UV 数量 >= 25', Object.keys(G.Art.T).length);
ok(!!G.Art.T.stone && !!G.Art.T.gore && !!G.Art.T.white, '关键图块存在');
ok(G.Art.ditherUV[0] > 0 && G.Art.ditherUV[1] >= 0, '抖动矩阵 UV 已记录');

/* --------------------------- 2. 模型 --------------------------- */
section('体素模型');
for (const name of ['ghoul', 'hound', 'cultist', 'brute', 'wraith', 'apostle', 'bishop', 'lord']) {
  const m = G.Art.getModel(name);
  let boxes = 0;
  for (const pn of m.order) boxes += m.parts[pn].boxes.length;
  ok(m.order.length >= 3 && boxes >= 10, name + ' 模型部件/盒子充足（' + m.order.length + ' 部件 / ' + boxes + ' 盒）');
}
const sword = G.Art.buildSword();
let sboxes = sword.parts.blade.boxes.length;
ok(sboxes > 20, '巨剑由 ' + sboxes + ' 个盒子构成');

/* --------------------------- 3. 地牢生成 --------------------------- */
section('地牢生成（深度 1..12）');
function bfsReach(map) {
  const w = map.w, h = map.h;
  const seen = new Uint8Array(w * h);
  const si = Math.floor(map.spawn.x), sj = Math.floor(map.spawn.z);
  if (map.isSolidTile(si, sj)) return null;
  const q = [sj * w + si];
  seen[sj * w + si] = 1;
  let n = 0;
  while (q.length) {
    const k = q.pop(); n++;
    const i = k % w, j = (k / w) | 0;
    const nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]];
    for (const [ii, jj] of nb) {
      if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
      const kk = jj * w + ii;
      if (seen[kk] || map.solid[kk]) continue;
      seen[kk] = 1; q.push(kk);
    }
  }
  return { seen: seen, count: n };
}

let openTotal = 0, meshTotal = 0;
for (let d = 1; d <= 12; d++) {
  const map = G.Mapgen.generate(d, 12345 + d);
  const r = bfsReach(map);
  let open = 0;
  for (let k = 0; k < map.solid.length; k++) if (!map.solid[k]) open++;
  openTotal += open;
  const exitOk = r && r.seen[Math.floor(map.exit.z) * map.w + Math.floor(map.exit.x)] === 1;
  let spawnsOk = 0;
  for (const s of map.enemySpawns) {
    const k = Math.floor(s.z) * map.w + Math.floor(s.x);
    if (r && r.seen[k]) spawnsOk++;
  }
  const verts = map.meshB ? map.meshB.n : 0;
  meshTotal += verts;
  const lit = map.light.reduce((a, b) => a + b, 0) / map.light.length;
  ok(r && r.count > open * 0.9, 'D' + d + ' 连通（可达 ' + (r ? r.count : 0) + '/' + open + ' 格）');
  ok(exitOk, 'D' + d + ' 出口可达');
  ok(spawnsOk === map.enemySpawns.length, 'D' + d + ' 刷怪点全部可达 (' + spawnsOk + '/' + map.enemySpawns.length + ')');
  ok(verts > 5000 && verts % 3 === 0, 'D' + d + ' 几何顶点 ' + verts + '（三角形完整）');
  ok(lit > 0.05 && lit < 1.5, 'D' + d + ' 平均烘焙亮度 ' + lit.toFixed(3));
  ok(map.lights.length >= 4, 'D' + d + ' 火盆光源 ' + map.lights.length + ' 个');
  if (G.Mapgen.BOSS_DEPTHS[d]) ok(!!map.bossSpawn, 'D' + d + ' 存在 Boss 刷新点');
}

/* --------------------------- 4. 遗物 --------------------------- */
section('遗物系统');
const rng = new U.Rng(7);
ok(G.Relics.ALL.length >= 30, '遗物数量 ' + G.Relics.ALL.length);
const P = G.Player;
const fakeGame = {
  toasts: [], hits: 0, kills: 0, dismembers: 0, deaths: 0, pickups: 0,
  hitStopT: 0, timeScale: 1, slowT: 0,
  toast(t) { this.toasts.push(t); },
  shake() { },
  hitStop(t) { this.hitStopT = Math.min(0.16, Math.max(this.hitStopT, t)); },
  slowmo(scale, time) {
    this.timeScale = Math.min(this.timeScale, scale);
    this.slowT = Math.max(this.slowT, time);
  },
  onHit() { this.hits++; },
  onDismember() { this.dismembers++; },
  onEnemyKilled() { this.kills++; },
  onBossPhase() { },
  onPickup() { this.pickups++; },
  onPlayerHurt() { },
  onPlayerDeath() { this.deaths++; },
};
P.init(fakeGame);
P.newRun();
let applyErr = null;
for (const r of G.Relics.ALL) {
  try {
    P.relics = [Object.assign({ stacks: 2 }, r)];
    P.recomputeStats();
    if (!isFinite(P.stats.dmg) || !isFinite(P.maxHp) || P.maxHp <= 0) throw new Error('非法数值 ' + r.id + ' maxHp=' + P.maxHp);
  } catch (e) { applyErr = e; break; }
}
ok(!applyErr, '全部遗物 apply() 数值合法', applyErr && applyErr.message);
P.relics = []; P.recomputeStats();
const cards = G.Relics.roll(3, rng, [], 6, 0);
ok(cards.length === 3 && cards[0].id !== cards[1].id, '抽 3 张不重复遗物卡');

/* --------------------------- 5. 战斗模拟 --------------------------- */
section('战斗模拟（深度 3，60 秒）');
const map = G.Mapgen.generate(3, 999);
G.Gore.bind(map);
G.Entities.reset();
const ctx = { map: map, player: P, game: fakeGame };
G.Entities.ctx = ctx;
for (const s of map.enemySpawns) G.Entities.spawn(s.type, s.x, s.z, { depth: 3, elite: s.elite, carriesBrand: s.carriesBrand });
const spawnCount = G.Entities.list.length;
P.newRun(); P.placeOn(map);
P.hp = 100000; P.maxHp = 100000;         // 不死，专测战斗管线

const input = {
  fwd: 0, back: 0, left: 0, right: 0, jump: false, dash: false,
  attack: false, heavy: false, berserk: false, use: false, mdx: 0, mdy: 0,
};
let err = null, maxChunks = 0, insideWall = 0, entInsideWall = 0, swings = 0, lastState = 'idle';
/* 复刻主循环的时间管线（顿帧 / 慢放），否则测不出
   "顿帧被反复续期 → 挥砍推进不动 → 镜头踢动累积 → 视角锁在脚下" 这类 Bug */
const dtReal = 1 / 60;
let dt = dtReal;
let maxKick = 0, maxSwingFrames = 0, swingFrames = 0, maxHitStop = 0, frozenFrames = 0;
try {
  for (let f = 0; f < 3600; f++) {
    // 时间缩放
    if (fakeGame.hitStopT > 0) {
      fakeGame.hitStopT -= dtReal;
      dt = dtReal * 0.055;
      frozenFrames++;
    } else {
      if (fakeGame.slowT > 0) fakeGame.slowT -= dtReal;
      else fakeGame.timeScale = U.damp(fakeGame.timeScale, 1, 6, dtReal);
      dt = dtReal * fakeGame.timeScale;
    }
    maxHitStop = Math.max(maxHitStop, fakeGame.hitStopT);
    ctx.dtReal = dtReal;
    // 找最近的活敌
    let best = null, bd = 1e9;
    for (const e of G.Entities.list) {
      if (e.removeMe || !e.alive) continue;
      const d = U.dist2(e.x, e.z, P.x, P.z);
      if (d < bd) { bd = d; best = e; }
    }
    // 敌人被清光就再刷一波（含高血量的重兵，用来测断肢）
    if (!best) {
      for (let k = 0; k < 6; k++) {
        const p = map.randomOpen(rng, 3, P.x, P.z);
        G.Entities.spawn(k % 3 === 0 ? 'brute' : (k % 3 === 1 ? 'ghoul' : 'hound'),
          p.x, p.z, { depth: 6 });
      }
      for (const e of G.Entities.list) { e.seen = true; e.state = 'chase'; }
      continue;
    }
    // 测试机器人没有寻路能力：定期直接传送到目标旁边，
    // 这样才能把战斗管线（挥砍 / 命中 / 断肢 / 击杀）跑满
    if (best && (f % 90 === 0)) {
      const a = Math.random() * U.TAU;
      const tx = best.x + Math.cos(a) * 2.4, tz = best.z + Math.sin(a) * 2.4;
      if (!map.isSolidAt(tx, tz)) { P.x = tx; P.z = tz; P.y = map.floorAt(tx, tz); }
    }
    if (best) {
      const dx = best.x - P.x, dz = best.z - P.z;
      P.yaw = U.yawOf(dx, dz);
      const d = Math.sqrt(bd);
      input.fwd = d > 2.0 ? 1 : 0;
      input.attack = d < 3.4;
      input.heavy = (f % 240 < 30) && d < 3.6;
      input.dash = (f % 300 === 0);
    } else {
      input.fwd = 1; input.attack = false; input.heavy = false;
    }
    input.jump = (f % 180 === 0);
    input.berserk = (f % 600 === 0);
    input.mdx = 0; input.mdy = 0;

    P.update(dt, input, ctx);
    if (P.wState === 'swing' && lastState !== 'swing') swings++;
    if (P.wState === 'slam' && lastState !== 'slam') swings++;
    // 攻击窗口不允许无限延长；镜头踢动不允许无限累积
    if (P.wState === 'swing' || P.wState === 'slam') {
      swingFrames++;
      maxSwingFrames = Math.max(maxSwingFrames, swingFrames);
    } else swingFrames = 0;
    maxKick = Math.max(maxKick, Math.abs(P.camKickY), Math.abs(P.camKickX));
    lastState = P.wState;
    G.Entities.update(dt, ctx);
    G.Gore.update(dt, map);

    if (map.isSolidAt(P.x, P.z)) insideWall++;
    for (const e of G.Entities.list) if (!e.removeMe && map.isSolidAt(e.x, e.z)) entInsideWall++;
    const c = G.Gore.counts();
    maxChunks = Math.max(maxChunks, c.chunks);
    if (!isFinite(P.x) || !isFinite(P.y) || !isFinite(P.z)) throw new Error('玩家坐标 NaN @frame ' + f);
  }
} catch (e) { err = e; }

ok(!err, '60 秒模拟无异常', err && (err.message + '\n' + err.stack));
// 机器人没有寻路能力，能追到多少怪本身有波动；这里只要求武器状态机反复完整循环
ok(swings > 25, '挥砍次数 ' + swings);
ok(fakeGame.kills > 8, '发生击杀 ' + fakeGame.kills + ' / 生成 ' + spawnCount);
ok(fakeGame.hits > 20, '命中次数 ' + fakeGame.hits);
ok(P.totalDamage > 100, '累计伤害 ' + Math.round(P.totalDamage));
ok(maxChunks > 10, '同时存在的肢块峰值 ' + maxChunks);
ok(G.Gore.decals.filter(d => d.alive).length > 5, '地面血迹 ' + G.Gore.decals.filter(d => d.alive).length + ' 处');
ok(G.Gore.totalGibs > 30, '累计肢块产出 ' + G.Gore.totalGibs);
ok(insideWall === 0, '玩家从未卡进墙里', insideWall + ' 帧');
ok(entInsideWall < 3600, '敌人基本不卡墙（' + entInsideWall + ' 次采样）');
console.log('  · 模拟中随机触发断肢 ' + fakeGame.dismembers + ' 次（概率事件，不作断言）');
ok(P.bestCombo >= 2, '最高连斩 ' + P.bestCombo);

/* --- 断肢机制的确定性验证（不依赖概率） --- */
{
  const before = G.Gore.totalGibs;
  const dm = G.Entities.spawn('brute', map.spawn.x + 1.2, map.spawn.z, { depth: 3 });
  const partBoxes = dm.model.parts.armR.boxes.length;
  const cbBefore = fakeGame.dismembers;
  G.Entities.dismember(dm, 'armR', 1, 0, 2.0);
  ok(dm.lost.armR === true, '断肢：armR 已标记为缺失');
  ok(G.Gore.totalGibs - before >= partBoxes, '断肢：产出 ' + (G.Gore.totalGibs - before) + ' 块肢体（部件含 ' + partBoxes + ' 盒）');
  ok(fakeGame.dismembers === cbBefore + 1, '断肢：回调触发一次');
  const mb2 = new G.MeshB(8000);
  G.Entities.emit(mb2, G.Art.T, (x, z) => map.lightAt(x, z), dm.x, dm.z, 60);
  ok(mb2.n > 0, '断肢后仍能正常渲染（' + mb2.n + ' 顶点，含断口血肉）');
  dm.removeMe = true;
}

/* --- 回归：视角被"锁在脚下"的 Bug --- */
section('镜头 / 顿帧 回归（曾出现视角锁死在脚下）');
ok(maxKick <= 0.205, '镜头踢动始终受限 max=' + maxKick.toFixed(4) + ' rad（上限 0.20）');
ok(maxSwingFrames < 45, '单次挥砍窗口不会被顿帧无限延长，最长 ' + maxSwingFrames + ' 帧');
ok(maxHitStop <= 0.161, '单次顿帧不超过 0.16s，实测 ' + maxHitStop.toFixed(3) + 's');
ok(frozenFrames < 3600 * 0.55, '顿帧总占比 ' + (frozenFrames / 3600 * 100).toFixed(1) + '%（不应长期卡在慢动作）');
ok(Math.abs(P.pitch) < 1.31, '俯仰角未被顶到极限 pitch=' + P.pitch.toFixed(3));

/* --------------------------- 6. Boss --------------------------- */
section('Boss 战管线');
const bmap = G.Mapgen.generate(4, 4242);
G.Gore.bind(bmap);
G.Entities.reset();
const bctx = { map: bmap, player: P, game: fakeGame, dtReal: dtReal };
G.Entities.ctx = bctx;
const boss = G.Entities.spawn(bmap.bossSpawn.type, bmap.bossSpawn.x, bmap.bossSpawn.z, { depth: 4 });
P.placeOn(bmap); P.hp = 100000; P.maxHp = 100000;
let berr = null, phases = 0;
fakeGame.onBossPhase = () => phases++;
fakeGame.hitStopT = 0; fakeGame.timeScale = 1; fakeGame.slowT = 0;
let bossKick = 0, bossFrozen = 0;
try {
  for (let f = 0; f < 4200; f++) {
    // 同样复刻时间管线
    let bdt;
    if (fakeGame.hitStopT > 0) { fakeGame.hitStopT -= dtReal; bdt = dtReal * 0.055; bossFrozen++; }
    else {
      if (fakeGame.slowT > 0) fakeGame.slowT -= dtReal;
      else fakeGame.timeScale = U.damp(fakeGame.timeScale, 1, 6, dtReal);
      bdt = dtReal * fakeGame.timeScale;
    }
    const dx = boss.x - P.x, dz = boss.z - P.z;
    P.yaw = U.yawOf(dx, dz);
    const d = Math.sqrt(dx * dx + dz * dz);
    input.fwd = d > 3.0 ? 1 : 0;
    input.attack = d < 4.2;
    input.heavy = (f % 200 < 24);
    P.update(bdt, input, bctx);
    bossKick = Math.max(bossKick, Math.abs(P.camKickY), Math.abs(P.camKickX));
    G.Entities.update(bdt, bctx);
    G.Gore.update(bdt, bmap);
    if (boss.removeMe) break;
  }
} catch (e) { berr = e; }
ok(!berr, 'Boss 战模拟无异常', berr && (berr.message + '\n' + berr.stack));
ok(boss.removeMe, 'Boss 被击杀');
ok(phases >= 1, 'Boss 阶段推进 ' + phases + ' 次');
ok(bossKick <= 0.205, 'Boss 战镜头踢动受限 max=' + bossKick.toFixed(4) + ' rad');

/* --------------------------- 7. 渲染几何 --------------------------- */
section('渲染几何构建');
G.Entities.reset();
G.Entities.ctx = ctx;
for (let i = 0; i < 6; i++) G.Entities.spawn('ghoul', map.spawn.x + 2 + i * 0.6, map.spawn.z + 2, { depth: 1 });
G.Entities.spawn('brute', map.spawn.x + 3, map.spawn.z - 2, { depth: 5, elite: true });
G.Entities.spawnItem('soul', map.spawn.x + 1, map.spawn.z + 1, { value: 3 });
G.Entities.spawnBolt(map.spawn.x, 1, map.spawn.z, 1, 0, 0, 8, 10, {});
G.Gore.chunk(map.spawn.x, 0.5, map.spawn.z, 0.1, 0.1, 0.1, [1, 0, 0], 1, 1, 1, 'flesh');
G.Gore.spray(map.spawn.x, 1, map.spawn.z, 0, 1, 0, 20, 2);
G.Gore.addDecal(map.spawn.x, map.spawn.z, 1, 0.9);

let rerr = null, verts = { ent: 0, gore: 0, sword: 0, blend: 0 };
try {
  const T = G.Art.T, lightFn = (x, z) => map.lightAt(x, z);
  const mb = new G.MeshB(40000);
  G.Entities.emit(mb, T, lightFn, P.x, P.z, 60);
  verts.ent = mb.n;
  mb.reset();
  G.Gore.emitChunks(mb, T, lightFn);
  G.Gore.emitDrops(mb, T, 1, 0, 0, 0, 1, 0, lightFn);
  G.Gore.emitMists(mb, T, 1, 0, 0, 0, 1, 0, lightFn);
  G.Gore.emitDecals(mb, T, lightFn, P.x, P.z, 30);
  G.Entities.emitItems(mb, T, lightFn);
  G.Entities.emitItemGlow(mb, T, 1, 0, 0, 0, 1, 0);
  G.Entities.emitBolts(mb, T, 1, 0, 0, 0, 1, 0);
  verts.gore = mb.n;
  mb.reset();
  P.update(dt, input, ctx);
  P.emitSword(mb, T);
  P.emitTrail(mb, T);
  verts.sword = mb.n;
  // 检查所有顶点数值合法
  const d = mb.data();
  for (let i = 0; i < d.length; i++) if (!isFinite(d[i])) throw new Error('顶点数据 NaN @' + i);
} catch (e) { rerr = e; }
ok(!rerr, '几何构建无异常', rerr && (rerr.message + '\n' + rerr.stack));
ok(verts.ent > 1000, '敌人顶点 ' + verts.ent);
ok(verts.gore > 100, '血肉/道具顶点 ' + verts.gore);
ok(verts.sword > 200, '巨剑顶点 ' + verts.sword);

/* --------------------------- 结果 --------------------------- */
console.log('\n===============================');
console.log(failures === 0
  ? '全部通过：' + checks + ' 项检查'
  : failures + ' / ' + checks + ' 项检查失败');
console.log('===============================');
process.exit(failures ? 1 : 0);
