// tools/playtest.mjs —— 无头通关测试：一个机器人真的把游戏从头玩到尾
//   用 BFS 寻路走到每个目标 → 按 E 交互 → 验证五个场景能依次推进直到结局
//   卡住 / 走不到 / 流程断了，这里都会红。
import { Renderer } from '../src/gfx/raycast.js';

// ——— 最小 DOM / 浏览器桩（游戏本体不改一行）———
globalThis.window = {
  innerWidth: 1280, innerHeight: 720,
  addEventListener() {}, removeEventListener() {},
};
globalThis.document = { addEventListener() {}, exitPointerLock() {} };
const fakeCtx = {
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  putImageData() {},
};
const fakeCanvas = { width: 0, height: 0, getContext: () => fakeCtx };

const { Game } = await import('../src/game/game.js');
const { isSolid, collides } = await import('../src/world/compile.js');
const { ZONE_DEFS } = await import('../src/world/zones.js');

const log = [];
const hud = {
  subs: [], zone: '', mem: [],
  setZoneName(n) { this.zone = n; log.push(`  ▸ 进入场景：${n}`); },
  setMemories(l) { this.mem = l; },
  flashMemory() {}, flashItem(n) { log.push(`  ▸ 拿到：${n}`); },
  setPrompt() {}, setSubtitle(t) { if (t) this.subs.push(t); },
  setFade() {}, blink() {}, hideTitle() {},
  showEnding(lines) { this.ending = lines; log.push('  ▸ 结局播放'); },
};

const game = new Game(fakeCanvas, hud);
game.loadZone('stair');
game.paused = false;
game.fade = 0; game.fadeDir = -1;

// ——— 通关剧本 ———
const PLAN = {
  stair: ['pot', 'door302'],
  home: ['calendar', 'cabinet', 'mirror', 'mahjong', 'stove', 'phone', 'homedoor'],
  lobby: ['banner', 'curtainwall', 'clock', 'elevator'],
  tower: ['core', 'lasttv'],
  roof: ['parapet', 'laundryline', 'endstool'],
};

// ——— 半米精度导航：直接拿玩家的碰撞体当通行判据（墙 + 实心精灵都算）———
const STEP = 0.25;
const R = 0.31;                       // 比玩家的 0.27 再留一点余量

function navOK(world, nx, ny) {
  return !collides(world, (nx + 0.5) * STEP, (ny + 0.5) * STEP, R);
}

function navBFS(world, start, goals) {
  const gw = Math.ceil(world.w / STEP), gh = Math.ceil(world.h / STEP);
  const key = (x, y) => y * gw + x;
  const goalSet = new Set(goals.map(([x, y]) => key(x, y)));
  if (!goalSet.size) return null;
  const prev = new Int32Array(gw * gh).fill(-2);
  const q = [start];
  prev[key(...start)] = -1;
  const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = null;
  while (q.length) {
    const [x, y] = q.shift();
    if (goalSet.has(key(x, y))) { found = [x, y]; break; }
    for (const [dx, dy] of N8) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
      const k = key(nx, ny);
      if (prev[k] !== -2) continue;
      if (!navOK(world, nx, ny)) continue;
      // 斜走要求两个正交方向也通，避免贴角穿墙
      if (dx && dy && (!navOK(world, x + dx, y) || !navOK(world, x, y + dy))) continue;
      prev[k] = key(x, y);
      q.push([nx, ny]);
    }
  }
  if (!found) return null;
  const path = [];
  let cur = key(...found);
  while (cur >= 0) {
    path.unshift([cur % gw, Math.floor(cur / gw)]);
    cur = prev[cur];
  }
  return path.map(([x, y]) => [(x + 0.5) * STEP, (y + 0.5) * STEP]);
}

function toNav(x, y) { return [Math.floor(x / STEP), Math.floor(y / STEP)]; }

/** 目标可交互物周围「站得住、又正好对着它」的落脚点：优先贴近，别停在半径边缘 */
function standNodes(world, it) {
  const [cx, cy] = toNav(it.x, it.y);
  for (const f of [0.42, 0.62, 0.85]) {
    const r = Math.max(0.32, (it.r || 1.3) * f);
    const out = [];
    const span = Math.ceil(r / STEP) + 1;
    for (let dy = -span; dy <= span; dy++) for (let dx = -span; dx <= span; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0) continue;
      const wx = (nx + 0.5) * STEP, wy = (ny + 0.5) * STEP;
      if (Math.hypot(wx - it.x, wy - it.y) > r) continue;
      if (!navOK(world, nx, ny)) continue;
      out.push([nx, ny]);
    }
    if (out.length) return out;
  }
  return [];
}

/** 走不到目标时的兜底：去传送门 / 去塔的检查点，把关卡机关触发出来 */
function fallbackNodes(game) {
  const def = ZONE_DEFS[game.zoneId];
  const cells = def.teleports?.length
    ? def.teleports.map((t) => t.from)
    : game.zoneId === 'tower'
      ? (game.get('cp', 'A') === 'A' ? [[2, 2]] : [[13, 13]])
      : [];
  const out = [];
  for (const [cx, cy] of cells) {
    if (isSolid(game.world, cx, cy)) continue;
    const [nx, ny] = toNav(cx + 0.5, cy + 0.5);
    if (navOK(game.world, nx, ny)) out.push([nx, ny]);
  }
  return out;
}

// ——— 跑 ———
const DT = 1 / 30;
let frames = 0, planIdx = 0, curZone = game.zoneId;
let lastPos = [0, 0], stuck = 0, renderTick = 0;
let interactCooldown = 0;
let path = null, pathAge = 0, pathKey = '';
let wrongFocus = 0;
const MAX_FRAMES = 30 * 900;   // 15 分钟模拟时间上限
let fails = 0;
const seenFail = new Set();
const fail = (msg) => { if (!seenFail.has(msg)) { seenFail.add(msg); log.push('  ✘ ' + msg); fails++; } };

log.push(`  ▸ 进入场景：${ZONE_DEFS.stair.name}`);

while (frames++ < MAX_FRAMES && !hud.ending) {
  if (game.zoneId !== curZone) { curZone = game.zoneId; planIdx = 0; path = null; }
  const plan = PLAN[curZone] || [];
  const targetId = plan[planIdx];

  if (!game.paused && game.fade < 0.2 && targetId) {
    const it = game.world.interactables.find((i) => i.id === targetId);
    if (!it) { fail(`${curZone} 里没有可交互物 ${targetId}`); planIdx++; continue; }
    const d = Math.hypot(it.x - game.cam.x, it.y - game.cam.y);
    const facing = Math.cos(Math.atan2(it.y - game.cam.y, it.x - game.cam.x) - game.cam.a);

    if (d < (it.r || 1.3) * 0.95) {
      // 到位了：先转向它，等游戏真的把它高亮出来（prompt 命中）再按 E
      game.keys.clear();
      game.cam.a = Math.atan2(it.y - game.cam.y, it.x - game.cam.x);
      if (game.prompt && game.prompt.id !== targetId) {
        // 被旁边的东西抢了焦点：挪一步再试
        wrongFocus++;
        if (wrongFocus > 20) {
          game.keys.add('KeyA');
          if (wrongFocus > 40) {
            fail(`${curZone}: 站在 ${targetId} 前面，但游戏高亮的是 ${game.prompt.id}`);
            planIdx++; wrongFocus = 0; path = null;
          }
        }
      } else if (facing > 0.4 && interactCooldown <= 0) {
        game.interact();
        interactCooldown = 0.45;
        planIdx++;
        wrongFocus = 0;
        path = null;
      }
    } else {
      const key = `${curZone}:${targetId}:${game.get('cp', '')}:${game.get('climb', 0)}`;
      if (!path || pathAge > 12 || pathKey !== key) {
        const start = toNav(game.cam.x, game.cam.y);
        path = navBFS(game.world, start, standNodes(game.world, it))
            || navBFS(game.world, start, fallbackNodes(game));
        pathAge = 0; pathKey = key;
        if (!path) { fail(`${curZone}: 走不到 ${targetId}，也没有兜底路线`); break; }
      }
      pathAge++;
      // 吃掉已经走过的路点
      while (path.length > 1 && Math.hypot(path[0][0] - game.cam.x, path[0][1] - game.cam.y) < 0.42) path.shift();
      const [tx, ty] = path[0];
      game.cam.a = Math.atan2(ty - game.cam.y, tx - game.cam.x);
      game.keys.clear();
      game.keys.add('KeyW');
      game.keys.add('ShiftLeft');
    }
  } else {
    game.keys.clear();
  }

  interactCooldown -= DT;
  game.update(DT);

  // 卡住检测
  const moved = Math.hypot(game.cam.x - lastPos[0], game.cam.y - lastPos[1]);
  if (game.keys.has('KeyW') && moved < 0.004) {
    if (++stuck > 60) {
      fail(`${curZone}: 在 (${game.cam.x.toFixed(1)},${game.cam.y.toFixed(1)}) 卡住，目标 ${targetId}`);
      stuck = 0; path = null;
      game.cam.a += 1.3;
    }
  } else stuck = 0;
  lastPos = [game.cam.x, game.cam.y];

  // 顺手每 3 秒渲一帧，确保渲染器在真实游戏状态下不炸
  if (++renderTick % 90 === 0) game.render();
}

// ——— 结论 ———
console.log('—— 无头通关记录 ——');
for (const l of log) console.log(l);
console.log(`\n模拟时长：${(frames * DT).toFixed(0)} 秒 / ${frames} 帧`);
console.log(`收集到的记忆：${hud.mem.length} 段  [${hud.mem.join(', ')}]`);
console.log(`字幕条数：${hud.subs.length}`);
console.log('\n—— 抽样字幕 ——');
for (const s of hud.subs.filter((_, i) => i % Math.max(1, Math.floor(hud.subs.length / 14)) === 0)) {
  console.log('   ' + s);
}
const done = !!hud.ending;
console.log(`\n${done ? '✔ 通关成功：五个场景全部走通，结局已播放' : '✘ 没能通关'}`);
if (fails) console.log(`✘ 过程中有 ${fails} 处异常`);
process.exit(done && fails === 0 ? 0 : 1);
