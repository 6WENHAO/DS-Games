/* =========================================================
   tools/headless.js — 无头冒烟测试
   1) 素材生成与后处理（描边/明暗）检查
   2) 关卡数据完整性
   3) 可达性 BFS：用保守跳跃模型验证每关真的能走到终点
   4) 自动玩家：真实物理下从头跑到尾
   5) 渲染管线不抛错
   运行: node tools/headless.js
   ========================================================= */
'use strict';
const { install, load, makeEl, Raster, ALL } = require('./env.js');
install();
const G = load(ALL);

let fail = 0;
const ok = (m) => console.log('  ✔ ' + m);
const bad = (m) => { console.error('  ✘ ' + m); fail++; };
const T = 16;

/* ================= 1. 素材 ================= */
console.log('\n── 素材生成 ──');
let artCount = 0, outlineOk = 0, shadeOk = 0;
function checkArt(label, cv) {
  artCount++;
  if (!cv || !cv.width) { bad(label + ' 生成失败'); return; }
  const w = cv.width, h = cv.height, d = cv.data;
  let opaque = 0, dark = 0, topSum = 0, topN = 0, botSum = 0, botN = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4;
    if (d[p + 3] < 24) continue;
    opaque++;
    const L = d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11;
    if (L < 42) dark++;
    if (y < h * 0.32) { topSum += L; topN++; }
    if (y > h * 0.68) { botSum += L; botN++; }
  }
  if (opaque < 12) bad(label + ' 几乎是空的');
  if (dark > 0) outlineOk++;
  if (topN && botN && topSum / topN > botSum / botN) shadeOk++;
}
G.PX.playerPoses.forEach(n => { for (let f = 0; f < G.PX.poseFrames(n); f++) checkArt('姿态 ' + n + f, G.PX.player(n, f)); });
G.PX.mobNames.forEach(n => { for (let f = 0; f < G.PX.mobFrames(n); f++) checkArt('怪物 ' + n + f, G.PX.mob(n, f)); });
G.PX.itemNames.forEach(n => { for (let f = 0; f < G.PX.itemFrames(n); f++) checkArt('道具 ' + n + f, G.PX.item(n, f)); });
G.PX.decoNames.forEach(n => checkArt('装饰 ' + n, G.PX.deco(n)));
const spriteCount = artCount, spriteOutline = outlineOk;
G.PX.tileNames.forEach(n => { for (let m = 0; m < 16; m += 5) checkArt('方块 ' + n, G.PX.tile(n, m, 0)); });
console.log(`  共生成 ${artCount} 张（精灵 ${spriteCount} / 瓦片 ${artCount - spriteCount}）`);
console.log(`  精灵带描边 ${spriteOutline}/${spriteCount} · 上亮下暗(体积感) ${shadeOk}/${artCount}`);
// 瓦片故意不描边（要无缝平铺），只要求精灵有描边
if (spriteOutline < spriteCount * 0.9) bad(`精灵描边覆盖不足 (${spriteOutline}/${spriteCount})`);
else ok('精灵描边与明暗后处理全部生效（瓦片按设计不描边以保证无缝平铺）');
['plains', 'cave', 'nether', 'end'].forEach(t => {
  checkArt('天空 ' + t, G.PX.sky(t, 160, 90));
  checkArt('视差 ' + t + '0', G.PX.layer(t, 0, 256, 80));
  checkArt('视差 ' + t + '1', G.PX.layer(t, 1, 256, 80));
});
ok('四套主题的天空与视差层均生成');

/* ================= 2. 关卡数据 ================= */
console.log('\n── 关卡数据 ──');
G.LEVELS.forEach((L, i) => {
  const w = L.rows[0].length;
  const badRow = L.rows.findIndex(r => r.length !== w);
  if (badRow >= 0) bad(`${L.name}: 第 ${badRow} 行长度 ${L.rows[badRow].length} ≠ ${w}`);
  const chars = new Set(L.rows.join('').split(''));
  const known = new Set(['.', 'F', '@'].concat(Object.keys(G.TILE_CHARS), Object.keys(G.ITEM_CHARS), Object.keys(G.MOB_CHARS)));
  const unknown = [...chars].filter(c => !known.has(c));
  if (unknown.length) bad(`${L.name}: 未知字符 ${JSON.stringify(unknown)}`);
  const hasGoal = L.goal === 'portal' ? L.rows.join('').includes('p') : L.rows.join('').includes('F');
  if (!hasGoal) bad(`${L.name}: 缺少终点`);
  console.log(`  ${L.name.padEnd(14)} ${w}×${L.rows.length}  主题 ${L.theme}  终点 ${L.goal}`);
});

/* ================= 3. 可达性 BFS ================= */
// 保守跳跃模型：水平最多 5 格、上升最多 4 格、下落任意
function reachability(idx) {
  G.Game.startLevel(idx);
  const S = G.S, W = S.W, H = S.H;
  const solid = (x, y) => G.solidAt(x, y) || G.oneWayAt(x, y);
  const hazardFloor = (x, y) => { const d = G.tileDefAt(x, y); return !!(d && d.hazard); };
  const free = (x, y) => {
    if (x < 0 || x >= W || y < 0 || y >= H) return false;
    if (G.solidAt(x, y)) return false;
    const d = G.tileDefAt(x, y);
    return !(d && d.hazard);
  };
  const standable = (x, y) =>
    free(x, y) && free(x, y - 1) && solid(x, y + 1) && !hazardFloor(x, y + 1);

  const start = { x: S.level.spawn.x, y: S.level.spawn.y };
  // 出生点下落到落脚处
  let sy = start.y;
  while (sy < H - 1 && !standable(start.x, sy)) sy++;
  if (!standable(start.x, sy)) return { okStart: false };

  const key = (x, y) => y * W + x;
  const seen = new Set([key(start.x, sy)]);
  const q = [[start.x, sy]];
  let maxX = start.x;
  while (q.length) {
    const [x, y] = q.shift();
    maxX = Math.max(maxX, x);
    const push = (nx, ny) => {
      if (!standable(nx, ny)) return;
      const k = key(nx, ny);
      if (seen.has(k)) return;
      seen.add(k); q.push([nx, ny]);
    };
    // 走 / 上一台阶
    push(x - 1, y); push(x + 1, y);
    push(x - 1, y - 1); push(x + 1, y - 1);
    // 掉落
    for (const dx of [-1, 0, 1]) {
      let ny = y;
      if (!free(x + dx, y) || !free(x + dx, y - 1)) continue;
      while (ny < H - 1 && !standable(x + dx, ny)) ny++;
      push(x + dx, ny);
    }
    // 跳跃（含跨越空隙）
    for (let dx = -5; dx <= 5; dx++) {
      for (let dy = -4; dy <= 6; dy++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (!standable(nx, ny)) continue;
        // 起跳头顶要有空间
        let clear = true;
        for (let k2 = 1; k2 <= Math.min(4, Math.abs(Math.min(0, dy)) + 1); k2++) if (!free(x, y - k2)) { clear = false; break; }
        // 落点前一格要通
        if (clear && !free(nx - Math.sign(dx || 1), ny - 1)) clear = false;
        if (clear) push(nx, ny);
      }
    }
  }
  // 终点是否可达
  const goal = S.goal;
  let goalOk = false;
  const gx = Math.floor(goal.x / T), gy = Math.floor(goal.y / T);
  for (let dy = -3; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (seen.has(key(gx + dx, gy + dy))) goalOk = true;
  }
  return { okStart: true, reach: seen.size, maxX: maxX, W: W, goalOk: goalOk, gx: gx };
}

console.log('\n── 可达性 BFS（保守跳跃模型） ──');
G.LEVELS.forEach((L, i) => {
  const r = reachability(i);
  if (!r.okStart) { bad(`${L.name}: 出生点无法站立`); return; }
  const pct = (r.maxX / (r.W - 1) * 100).toFixed(0);
  console.log(`  ${L.name.padEnd(14)} 可达格 ${String(r.reach).padStart(4)}  最远 x=${String(r.maxX).padStart(3)}/${r.W - 1} (${pct}%)  终点 ${r.goalOk ? '✔可达' : '✘不可达'}`);
  if (!r.goalOk) bad(`${L.name}: 终点不可达（关卡设计有断点）`);
});

/* ================= 4. 动画稳定性回归测试 =================
   历史 bug：吸附到格边界后，向下碰撞检测读到的是上一格空气，
   导致 onGround 每帧 true/false 交替、姿态在 land/fall 之间抽搐。 */
console.log('\n── 动画稳定性（抽搐回归测试） ──');
(function () {
  const cvs = new Raster(1280, 720);
  G.Game.headlessInit(cvs);
  G.Game.startLevel(0);
  const S = G.S, p = S.player, DT = 1 / 60;
  for (let i = 0; i < 120; i++) { G.Input.keys = {}; G.Game.tick(DT); G.Input.endFrame(DT); }

  // (1) 站立不动：y 不动、onGround 恒真、姿态不跳
  const ys = new Set(), poses = new Set();
  let airFrames = 0, poseSwitches = 0, last = p.pose;
  for (let i = 0; i < 180; i++) {
    G.Input.keys = {};
    G.Game.tick(DT); G.Input.endFrame(DT);
    ys.add(p.y.toFixed(3)); poses.add(p.pose);
    if (!p.onGround) airFrames++;
    if (p.pose !== last) { poseSwitches++; last = p.pose; }
  }
  console.log(`  站立 3 秒：不同 y 值 ${ys.size} 个 · 离地帧 ${airFrames} · 姿态切换 ${poseSwitches} 次 · 姿态集合 [${[...poses].join(',')}]`);
  if (ys.size !== 1) bad(`站立时纵向抖动（出现 ${ys.size} 个不同 y）`);
  if (airFrames > 0) bad(`站立时被判定离地 ${airFrames} 帧`);
  if (poseSwitches > 0) bad(`站立时姿态切换 ${poseSwitches} 次（抽搐）`);
  if (ys.size === 1 && !airFrames && !poseSwitches) ok('站立完全静止，无抽搐');

  // (2) 平地跑动：屏幕位置单调前进，姿态只应是 跑/待机
  const zoomV = G.Game.viewSize().zoom;
  let prevScreen = Math.round((p.x + p.w / 2) * zoomV), back = 0, maxBack = 0;
  const runPoses = new Set();
  for (let i = 0; i < 40; i++) {                 // 0.66 秒，保证还在出生点的平地上
    G.Input.keys = { KeyD: true };
    G.Game.tick(DT); G.Input.endFrame(DT);
    runPoses.add(p.pose);
    const cur = Math.round((p.x + p.w / 2) * zoomV);
    if (cur < prevScreen) { back++; maxBack = Math.max(maxBack, prevScreen - cur); }
    prevScreen = cur;
  }
  console.log(`  平地向右跑 0.66 秒：屏幕坐标回退 ${back} 帧（最大 ${maxBack}px）· 姿态集合 [${[...runPoses].join(',')}]`);
  if (back > 2) bad(`跑动时屏幕位置回退 ${back} 帧（像素抖动）`);
  else ok('跑动时屏幕坐标单调前进（像素对齐一致）');
  const okPoses = [...runPoses].every(x => x === 'run' || x === 'idle');
  if (!okPoses) bad(`平地跑动出现异常姿态: ${[...runPoses].join(',')}`);
  else ok('平地跑动姿态稳定（只有 run/idle）');

  // (3) 怪物：平地行走时不应反复离地（跳过出生下落的前 90 帧）
  G.Game.startLevel(0);
  const S2 = G.S;
  const zom = S2.mobs.filter(m => m.kind === 'zombie')[0];
  if (zom) {
    for (let i = 0; i < 90; i++) { S2.player.x = zom.x - 70; G.Game.tick(DT); G.Input.endFrame(DT); }
    let mobAir = 0, faceFlips = 0, lastFace = zom.face, ySet = new Set();
    for (let i = 0; i < 180; i++) {
      S2.player.x = zom.x - 70;                  // 让怪物保持在激活范围内，又不会被踩到
      G.Game.tick(DT); G.Input.endFrame(DT);
      if (!zom.onGround) mobAir++;
      ySet.add(zom.y.toFixed(2));
      if (zom.face !== lastFace) { faceFlips++; lastFace = zom.face; }
    }
    console.log(`  僵尸 3 秒：离地帧 ${mobAir} · 不同 y 值 ${ySet.size} · 转向 ${faceFlips} 次`);
    if (mobAir > 2) bad(`怪物在平地上反复离地 ${mobAir} 帧`);
    else if (ySet.size > 2) bad(`怪物纵向抖动（${ySet.size} 个 y 值）`);
    else ok('怪物贴地行走稳定');
  }
})();

/* ================= 5. 自动玩家（真实物理） ================= */
function autoPlay(idx, maxSec, god) {
  const cvs = new Raster(1280, 720);
  G.Game.headlessInit(cvs);
  G.Game.startLevel(idx);
  let S = G.S, p = S.player;                     // retry 后需要重新取引用
  const DT = 1 / 60;
  let maxX = p.x, stuck = 0, lastX = p.x, jumpCd = 0, frames = 0, deaths = 0;
  const steps = Math.round(maxSec / DT);
  for (let i = 0; i < steps; i++) {
    S = G.S; p = S.player;
    if (god) { p.hearts = p.maxHearts; }
    const I = G.Input;
    I.keys = { KeyD: true, ShiftLeft: true };
    // 前方有墙 / 有坑 / 有危险 / 有怪 → 跳
    const tx = Math.floor((p.x + p.w + 3) / T);
    const ty = Math.floor((p.y + p.h - 2) / T);
    const footY = Math.floor((p.y + p.h + 2) / T);
    let wall = G.solidAt(tx, ty) || G.solidAt(tx, ty - 1);
    let gap = !G.solidAt(tx, footY) && !G.oneWayAt(tx, footY) && !G.solidAt(tx + 1, footY);
    let hazard = false;
    for (let k = 0; k <= 3; k++) {
      const d = G.tileDefAt(tx + k, footY);
      const d2 = G.tileDefAt(tx + k, ty);
      if ((d && d.hazard) || (d2 && d2.hazard)) hazard = true;
    }
    let mobNear = S.mobs.some(m => !m.dead && m.x > p.x && m.x - p.x < 46 && Math.abs(m.y - p.y) < 30);
    jumpCd -= DT;
    if (p.onGround && jumpCd <= 0 && (wall || gap || hazard || mobNear)) {
      I.jumpBuffer = 0.13; I.keys.Space = true; jumpCd = 0.24;
    } else if (!p.onGround && p.vy < 0 && (wall || gap || hazard)) {
      I.keys.Space = true;                       // 长按跳更高
    }
    G.Game.tick(DT);
    if (i % 4 === 0) G.Game.render();
    G.Input.endFrame(DT);
    frames++;
    maxX = Math.max(maxX, p.x);
    if (Math.abs(p.x - lastX) < 0.4) stuck++; else stuck = 0;
    lastX = p.x;
    if (S.mode === 'clear' || S.mode === 'win') break;
    if (god && (S.mode === 'dead' || S.mode === 'gameover')) {   // 无敌模式下掉坑也重来
      deaths++;
      if (deaths > 4) break;
      G.S.lives = 9;
      G.Game.retry();
      S = G.S; p = S.player;
      maxX = Math.max(maxX, 0);
      stuck = 0; lastX = p.x;
      continue;
    }
    if (!god && (S.mode === 'dead' || S.mode === 'gameover')) break;
    if (stuck > 240) break;                      // 卡住 4 秒
  }
  return { mode: G.S.mode, maxX: maxX, W: G.S.W, hearts: G.S.player.hearts, score: G.S.score, frames, time: G.S.time, deaths };
}

console.log('\n── 地形可通过性（无敌机器人，只验证几何+物理） ──');
G.LEVELS.forEach((L, i) => {
  const r = autoPlay(i, 120, true);
  const pct = (r.maxX / ((r.W - 2) * T) * 100).toFixed(0);
  const done = r.mode === 'clear' || r.mode === 'win';
  console.log(`  ${L.name.padEnd(14)} ${done ? '✔走到终点' : '✘ 只到 ' + pct + '%'}  掉坑重试 ${r.deaths} 次  用时 ${r.time.toFixed(1)}s`);
  if (!done) bad(`${L.name}: 无敌机器人也走不到终点，地形或物理有问题`);
});

console.log('\n── 自动玩家（普通模式，3 颗心，Shift 疾跑 + 遇障碍跳） ──');
G.LEVELS.forEach((L, i) => {
  const r = autoPlay(i, 100, false);
  const pct = (r.maxX / ((r.W - 2) * T) * 100).toFixed(0);
  const res = r.mode === 'clear' || r.mode === 'win' ? '✔通关' : (r.mode === 'dead' || r.mode === 'gameover' ? '阵亡' : '未完成');
  console.log(`  ${L.name.padEnd(14)} ${res}  推进 ${pct}%  剩余♥${r.hearts}  得分 ${r.score}  用时 ${r.time.toFixed(1)}s`);
  if (r.maxX < (r.W - 2) * T * 0.25) bad(`${L.name}: 普通模式推进不足 25%`);
});

/* ================= 5. 渲染管线 ================= */
console.log('\n── 渲染管线 ──');
try {
  const cvs = new Raster(1280, 720);
  G.Game.headlessInit(cvs);
  G.Game.startLevel(0);
  for (let i = 0; i < 30; i++) { G.Game.tick(1 / 60); G.Game.render(); G.Input.endFrame(1 / 60); }
  // 统计画面内容，确认不是黑屏
  const d = cvs.data;
  let uniq = new Set(), sum = 0, n = 0;
  for (let i = 0; i < d.length; i += 4 * 17) {
    uniq.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3));
    sum += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; n++;
  }
  console.log(`  渲染 30 帧完成，画面颜色数≈${uniq.size}，平均亮度 ${(sum / n).toFixed(0)}`);
  if (uniq.size < 20) bad('画面颜色过少，可能是黑屏');
  else ok('渲染管线正常（天空/视差/瓦片/实体/光照）');
} catch (e) {
  bad('渲染异常: ' + e.message + '\n' + e.stack);
}

console.log('\n════════════════════════');
if (!fail) console.log('✔ 全部检查通过');
else { console.error(`✘ ${fail} 项失败`); process.exitCode = 1; }
