import { chromium } from 'playwright';
import url from 'url';
const ROOT = '/home/a7067567/deepseek/rogue-knight';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
const errs = [];
page.on('pageerror', e => errs.push('ERR: ' + e.message + ' @@ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ')));
page.on('console', m => { if (m.type() === 'error') errs.push('CON: ' + m.text()); });
await page.goto(url.pathToFileURL(ROOT + '/index.html').href);
await page.waitForTimeout(400);

/* ---------- 安装测试工具 ---------- */
await page.evaluate(() => {
  const K = window.K;
  K.Game.loop = function () { };
  K.Snd.play = function () { }; K.Snd.music = function () { };
  window.T = { pass: 0, fail: 0, rows: [] };
  window.chk = (name, ok, info) => { window.T.rows.push({ name, ok: !!ok, info: info === undefined ? '' : String(info) }); ok ? window.T.pass++ : window.T.fail++; };
  window.steps = n => { for (let i = 0; i < n; i++) K.Game.step(); };
  window.keys = obj => { for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyE', 'KeyF', 'Space', 'KeyQ']) K.In.setRaw(k, obj && obj[k] ? 1 : 0); };
  /* 空旷场地 + 假人 */
  window.arena = () => {
    const K = window.K, G = K.Game;
    G.newRun('knight');
    const r = K.D.rooms[0];
    G.player.x = r.wx; G.player.y = r.wy;
    G.enemies.length = 0; K.B.reset(); K.I.reset(); K.FX.reset();
    G.props.length = 0;
    for (const rm of K.D.rooms) { rm.state = 'clear'; rm.cleared = 1; rm.spawns.length = 0; }
    G.curRoom = r;
    return G.player;
  };
  window.dummy = (dx, dy, hp) => {
    const e = K.E.spawn('slime', K.Game.player.x + dx, K.Game.player.y + dy, {});
    e.hpMax = e.hp = hp || 999999; e.stun = 999999; e.spawnT = 0; e.contact = 0; e.coin = 0;
    return e;
  };
  /* BFS 寻路（给自动游玩机器人用） */
  window.path = (fx, fy, tx, ty) => {
    const D = K.D.D, TS = K.TS, W = D.w, H = D.h;
    const sx = Math.floor(fx / TS), sy = Math.floor(fy / TS), gx = Math.floor(tx / TS), gy = Math.floor(ty / TS);
    if (sx === gx && sy === gy) return [[tx, ty]];
    const prev = new Int32Array(W * H).fill(-1);
    const q = [sy * W + sx]; prev[sy * W + sx] = sy * W + sx;
    let head = 0, found = -1;
    while (head < q.length) {
      const cur = q[head++], cx = cur % W, cy = (cur / W) | 0;
      if (cx === gx && cy === gy) { found = cur; break; }
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [ox, oy] of nb) {
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (prev[ni] !== -1 || K.D.solid(nx, ny)) continue;
        prev[ni] = cur; q.push(ni);
      }
    }
    if (found < 0) return null;
    const out = [];
    let cur = found;
    while (prev[cur] !== cur) { out.push([(cur % W + .5) * TS, (((cur / W) | 0) + .5) * TS]); cur = prev[cur]; }
    out.reverse();
    return out;
  };
  window.bot = { wp: null, t: 0, stuckT: 0, lx: 0, ly: 0, jitter: 0 };
  window.playFrame = () => {
    const K = window.K, G = K.Game, p = G.player, b = window.bot;
    if (!p || !p.alive || G.scene !== 'play') { window.keys({}); return; }
    b.t++;
    const e = K.B.nearest(p.x, p.y, 0, 900);
    let tx, ty;
    if (e) { tx = e.x; ty = e.y; }
    else {
      const port = K.I.items.filter(i => i.kind === 'portal')[0];
      const chest = K.I.items.filter(i => i.kind === 'chest' && !i.opened && !i._bot)[0];
      const wp = K.I.items.filter(i => !i._bot && (i.kind === 'relic' || (i.kind === 'weapon' && Math.hypot(i.x - p.x, i.y - p.y) > 60)))[0];
      const rm = K.D.rooms.filter(r => r.spawns.length && !r.cleared)[0] || K.D.rooms.filter(r => !r.visited)[0];
      const t = port || chest || wp || rm;
      if (t) { tx = t.x !== undefined ? t.x : t.wx; ty = t.y !== undefined ? t.y : t.wy; }
      else { tx = p.x; ty = p.y; }
    }
    /* 每 18 帧重算路径 */
    if (b.t % 18 === 0 || !b.wp) b.wp = window.path(p.x, p.y, tx, ty);
    let dirx = 0, diry = 0;
    if (b.wp && b.wp.length) {
      let node = b.wp[0];
      while (b.wp.length > 1 && Math.hypot(node[0] - p.x, node[1] - p.y) < 26) { b.wp.shift(); node = b.wp[0]; }
      dirx = node[0] - p.x; diry = node[1] - p.y;
    } else { dirx = tx - p.x; diry = ty - p.y; }
    /* 与目标距离过近则停 */
    const d = e ? Math.hypot(e.x - p.x, e.y - p.y) : 999;
    const melee = p.weapons[p.slot].style === 'melee';
    if (e && !melee && d < 100) { dirx = -dirx; diry = -diry; }
    if (Math.hypot(p.x - b.lx, p.y - b.ly) < .6) b.stuckT++; else b.stuckT = 0;
    b.lx = p.x; b.ly = p.y;
    if (b.stuckT > 24) { b.jitter = 26; b.stuckT = 0; b.wp = null; }
    if (b.jitter > 0) { b.jitter--; const a = b.t * .3; dirx = Math.cos(a) * 60; diry = Math.sin(a) * 60; }
    const kk = {};
    if (dirx > 12) kk.KeyD = 1; else if (dirx < -12) kk.KeyA = 1;
    if (diry > 12) kk.KeyS = 1; else if (diry < -12) kk.KeyW = 1;
    if (e && d < 620) kk.KeyJ = 1;
    if (e && d < 300 && p.skillCd <= 0) kk.KeyF = 1;
    const nn = K.I.nearest(p);
    if (nn && b.t % 8 === 0 && (nn.kind === 'portal' || nn.kind === 'shrine' || !nn._bot)) { kk.KeyE = 1; if (nn.kind !== 'portal') nn._bot = 1; }
    if (e && d < 70 && p.dashCd <= 0 && b.t % 50 === 0) kk.Space = 1;
    window.keys(kk);
    K.Game.step();
  };
});

/* ---------- A. 数据完整性 ---------- */
const A = await page.evaluate(() => {
  const K = window.K, chk = window.chk;
  const bad = [];
  K.W.LIST.forEach(w => {
    if (!K.Art.WSHAPE[w.shape]) bad.push(w.id + ' 缺武器外形 ' + w.shape);
    if (!w.name || !w.desc) bad.push(w.id + ' 缺名称/描述');
    if (w.rarity < 1 || w.rarity > 5) bad.push(w.id + ' 稀有度非法');
    if (w.elem && !K.W.ELEM[w.elem]) bad.push(w.id + ' 元素非法');
    if (!(w.dmg > 0) || !(w.rate > 0)) bad.push(w.id + ' 数值非法');
  });
  const ids = K.W.LIST.map(w => w.id);
  if (new Set(ids).size !== ids.length) bad.push('武器 id 重复');
  K.E.LIST.concat(K.E.BOSSES).forEach(e => { if (!K.Art.EART[e.art]) bad.push(e.id + ' 缺美术 ' + e.art); });
  K.P.CHARS.forEach(c => {
    if (!K.W.BY[c.weapon]) bad.push(c.id + ' 初始武器无效');
    if (!c.skill || !c.skill.id) bad.push(c.id + ' 缺技能');
  });
  K.I.RELICS.forEach(r => {
    const m = K.P.baseMods(), p = { hpMax: 100, hp: 100, armorMax: 2, armor: 2, energyMax: 100, energy: 100, mods: m };
    try { r.f(m, p); } catch (e) { bad.push('遗物 ' + r.id + ' 报错: ' + e.message); }
  });
  chk('数据完整性（武器/敌人/角色/遗物）', bad.length === 0, bad.slice(0, 6).join(' | '));
  return { weapons: K.W.LIST.length, byCat: K.W.LIST.reduce((a, w) => { a[w.cat] = (a[w.cat] || 0) + 1; return a; }, {}),
    byRarity: K.W.LIST.reduce((a, w) => { a[w.rarity] = (a[w.rarity] || 0) + 1; return a; }, {}),
    styles: [...new Set(K.W.LIST.map(w => w.style))], chars: K.P.CHARS.length, enemies: K.E.LIST.length,
    bosses: K.E.BOSSES.length, relics: K.I.RELICS.length, bad };
});

/* ---------- B. 49 把武器全部能造成伤害 ---------- */
const Bres = await page.evaluate(() => {
  const K = window.K, G = K.Game;
  const rows = [];
  for (const w of K.W.LIST) {
    const p = window.arena();
    p.weapons = [w, w]; p.slot = 0; p.fireCd = 0; p.chargeT = 0; p.burst = null;
    p.energyMax = 9999; p.energy = 9999; p.mods.crit = 0;
    const dist = w.style === 'melee' ? 42 : 90;
    const e = window.dummy(dist, 0);
    const hp0 = e.hp;
    for (let i = 0; i < 150; i++) { window.keys({ KeyJ: 1 }); K.Game.step(); }
    const dealt = hp0 - e.hp;
    rows.push({ id: w.id, name: w.name, cat: w.cat, rarity: w.rarity, dealt: Math.round(dealt), dps: Math.round(K.W.dps(w)) });
  }
  const zero = rows.filter(r => r.dealt <= 0);
  window.chk('全部 ' + rows.length + ' 把武器均可造成伤害', zero.length === 0, zero.map(z => z.id + '/' + z.name).join(','));
  return rows;
});

/* ---------- C. 判定范围准确性 ---------- */
const C = await page.evaluate(() => {
  const K = window.K, chk = window.chk;
  /* 近战：刚好在范围外不应命中，范围内应命中 */
  const w = K.W.BY['w1'];  // 铁剑 r1=52
  let p = window.arena();
  p.weapons = [w]; p.slot = 0; p.fireCd = 0;
  const far = window.dummy(52 + 9 + 15 + 26, 0);   // r1 + 判定宽 + 敌人半径 + 余量
  const hp0 = far.hp;
  for (let i = 0; i < 40; i++) { window.keys({ KeyJ: 1 }); K.Game.step(); }
  const outHit = hp0 - far.hp;
  p = window.arena();
  p.weapons = [w]; p.slot = 0; p.fireCd = 0;
  const near = window.dummy(40, 0);
  const hp1 = near.hp;
  for (let i = 0; i < 40; i++) { window.keys({ KeyJ: 1 }); K.Game.step(); }
  const inHit = hp1 - near.hp;
  chk('近战范围外不命中', outHit === 0, '范围外伤害=' + outHit.toFixed(1));
  chk('近战范围内命中', inHit > 0, '范围内伤害=' + inHit.toFixed(1));
  /* 近战背后不命中（扇形朝向）：显式朝 +x 挥砍 */
  p = window.arena();
  p.weapons = [w]; p.slot = 0; p.fireCd = 0;
  const back = window.dummy(-40, 0);
  const bh = back.hp;
  for (let i = 0; i < 30; i++) { p.fireCd = 0; K.W.fire(p, w, 0, p.mods); window.keys({}); K.Game.step(); }
  chk('近战背后不命中（扇形方向正确）', bh - back.hp === 0, '背后伤害=' + (bh - back.hp).toFixed(1));
  /* 子弹：侧向偏移超过「弹丸半径+敌人半径」即不应命中（显式水平射击） */
  const pw = K.W.BY['p1'];
  p = window.arena();
  p.weapons = [pw]; p.slot = 0;
  const off = 15 + pw.size + 14;
  const dSide = window.dummy(200, off);
  const hs = dSide.hp;
  for (let i = 0; i < 70; i++) { p.fireCd = 0; K.W.fire(p, pw, 0, p.mods); window.keys({}); K.Game.step(); }
  chk('侧向偏移超出判定和 -> 不命中', hs - dSide.hp === 0, '偏移' + off + 'px 伤害=' + (hs - dSide.hp).toFixed(1));
  p = window.arena();
  p.weapons = [pw]; p.slot = 0;
  const dLine = window.dummy(200, 0);
  const hl = dLine.hp;
  for (let i = 0; i < 70; i++) { p.fireCd = 0; K.W.fire(p, pw, 0, p.mods); window.keys({}); K.Game.step(); }
  chk('弹道上的目标 -> 命中', hl - dLine.hp > 0, '正对伤害=' + (hl - dLine.hp).toFixed(0));
  /* 爆炸范围 */
  p = window.arena();
  const inR = window.dummy(60, 0), outR = window.dummy(300, 0);
  const i0 = inR.hp, o0 = outR.hp;
  K.B.explode(p.x, p.y, 120, 40, 0, '#fff');
  window.steps(2);
  chk('爆炸只伤害半径内目标', i0 - inR.hp > 0 && o0 - outR.hp === 0, '内=' + (i0 - inR.hp).toFixed(0) + ' 外=' + (o0 - outR.hp).toFixed(0));
  /* 墙体阻挡子弹 */
  p = window.arena();
  p.weapons = [K.W.BY['p1']]; p.slot = 0;
  const room = K.D.rooms[0];
  p.x = (room.x0 + 1.5) * K.TS; p.y = room.wy;
  const behind = window.dummy(-200, 0);   // 墙外
  const bh2 = behind.hp;
  for (let i = 0; i < 60; i++) { window.keys({ KeyJ: 1 }); K.Game.step(); }
  chk('子弹被墙体拦下（墙后目标安全）', bh2 - behind.hp === 0, '墙后伤害=' + (bh2 - behind.hp).toFixed(1));
  return {};
});

/* ---------- D. 8 名角色技能 ---------- */
const Dres = await page.evaluate(() => {
  const K = window.K, rows = [];
  for (const c of K.P.CHARS) {
    K.Game.newRun(c.id);
    const p = K.Game.player;
    const r = K.D.rooms[0];
    p.x = r.wx; p.y = r.wy;
    K.Game.enemies.length = 0;
    const e = window.dummy(170, 0);
    const hp0 = e.hp, hp1 = p.hp;
    p.energy = p.energyMax; p.skillCd = 0;
    let err = '';
    try {
      const used = K.P.useSkill(p);
      for (let i = 0; i < 150; i++) { window.keys({}); K.Game.step(); }
      rows.push({ id: c.id, name: c.name, skill: c.skill.name, used: !!used,
        dmg: Math.round(hp0 - e.hp), heal: Math.round(p.hp - hp1), cd: p.skillCd > 0, allies: K.Game.allies.length,
        buff: (p.invis > 0 ? 'invis ' : '') + (p.rageT > 0 ? 'rage ' : '') + (p.critBonus ? 'crit' : '') });
    } catch (ex) { err = ex.message; rows.push({ id: c.id, err }); }
  }
  const bad = rows.filter(r => r.err || !r.used);
  window.chk('8 名角色技能均可释放且无报错', bad.length === 0, JSON.stringify(bad).slice(0, 160));
  const eff = rows.filter(r => (r.dmg > 0 || r.heal > 0 || r.allies > 0 || (r.buff && r.buff.trim())));
  window.chk('8 个技能均产生可测效果（伤害/治疗/召唤/增益）', eff.length === 8,
    eff.length + '/8 · ' + rows.map(r => r.name.split(' ')[0] + '=' + (r.dmg || 0) + 'dmg/' + (r.heal || 0) + 'hp/' + r.allies + 'ally/' + (r.buff || '-')).join(' '));
  return rows;
});

/* ---------- E. 敌人与 Boss ---------- */
const E = await page.evaluate(() => {
  const K = window.K, rows = [];
  for (const def of K.E.LIST) {
    const p = window.arena();
    p.hp = p.hpMax = 99999; p.armor = 0;
    const e = K.E.spawn(def.id, p.x + 150, p.y, {});
    e.spawnT = 0;
    const hp0 = p.hp;
    let err = '';
    try { for (let i = 0; i < 420; i++) { window.keys({}); K.Game.step(); } } catch (ex) { err = ex.message; }
    rows.push({ id: def.id, name: def.name, err: err, dmgToPlayer: Math.round(hp0 - p.hp), alive: e.alive,
      moved: Math.abs(e.x - (p.x + 150)) > 4 || def.ai === 'turret' });
  }
  const bad = rows.filter(r => r.err);
  window.chk('12 种敌人 AI 运行无报错', bad.length === 0, JSON.stringify(bad).slice(0, 200));
  window.chk('敌人能够威胁到玩家', rows.filter(r => r.dmgToPlayer > 0).length >= 8, rows.filter(r => r.dmgToPlayer > 0).length + '/12 造成伤害');
  /* Boss 全招式 */
  const brows = [];
  for (let bi = 0; bi < K.E.BOSSES.length; bi++) {
    const def = K.E.BOSSES[bi];
    for (const act of def.acts) {
      const p = window.arena();
      p.hp = p.hpMax = 99999;
      const e = K.E.spawnBoss(bi, p.x + 150, p.y);
      e.spawnT = 0;
      let err = '';
      try {
        for (let phase = 1; phase <= 2; phase++) {
          e.phase = phase;
          e.act = act; e.actT = 0; e.cd = 0;
          for (let i = 0; i < 240; i++) { window.keys({}); K.Game.step(); if (!e.act) { e.act = act; e.actT = 0; } }
        }
      } catch (ex) { err = ex.message + ' @' + String(ex.stack || '').split('\n')[1]; }
      brows.push({ boss: def.id, act: act, err: err, bullets: K.B.count, dmg: Math.round(99999 - p.hp) });
    }
  }
  const bbad = brows.filter(r => r.err);
  window.chk('3 个 Boss × 全部招式无报错', bbad.length === 0, JSON.stringify(bbad).slice(0, 240));
  const perBoss = {};
  brows.forEach(function (r) { perBoss[r.boss] = (perBoss[r.boss] || 0) + (r.dmg > 0 ? 1 : 0); });
  window.chk('每个 Boss 均有多种能命中玩家的招式', Object.keys(perBoss).length === 3 && Object.keys(perBoss).every(function (k) { return perBoss[k] >= 2; }),
    JSON.stringify(perBoss) + ' (命中招式数)');
  return { rows, brows };
});

/* ---------- F. 地牢生成（60 次） ---------- */
const Fres = await page.evaluate(() => {
  const K = window.K;
  let bad = [], stats = { rooms: 0, doors: 0, spawns: 0, n: 0 };
  for (let s = 0; s < 60; s++) {
    const R = new K.M.RNG(1000 + s * 37);
    const floor = 1 + (s % 5);
    K.I.reset();
    K.D.gen(floor, R);
    const D = K.D.D;
    /* BFS 连通性 */
    const W = D.w, H = D.h, seen = new Uint8Array(W * H);
    const st = D.start, q = [[Math.floor(st.x / K.TS), Math.floor(st.y / K.TS)]];
    seen[q[0][1] * W + q[0][0]] = 1;
    let head = 0;
    while (head < q.length) {
      const [cx, cy] = q[head++];
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        if (seen[ny * W + nx] || !K.D.isFloor(nx, ny)) continue;
        seen[ny * W + nx] = 1; q.push([nx, ny]);
      }
    }
    for (const r of D.rooms) {
      if (!seen[r.cy * W + r.cx]) bad.push('seed' + s + ' 房间 ' + r.id + '(' + r.type + ') 不可达');
      if (r.spawns.length && !r.doors.length) bad.push('seed' + s + ' 战斗房无门 ' + r.id);
      for (const sp of r.spawns) if (K.D.solid(Math.floor(sp.x / K.TS), Math.floor(sp.y / K.TS))) bad.push('seed' + s + ' 刷怪点在墙里');
    }
    const types = D.rooms.map(r => r.type);
    if (types.indexOf('boss') < 0) bad.push('seed' + s + ' 无 Boss 房');
    if (types.indexOf('start') < 0) bad.push('seed' + s + ' 无起始房');
    stats.rooms += D.rooms.length; stats.doors += D.doors.length;
    stats.spawns += D.rooms.reduce((a, r) => a + r.spawns.length, 0); stats.n++;
  }
  window.chk('60 次随机生成：房间全部可达 / 结构完整', bad.length === 0, bad.slice(0, 4).join(' | '));
  return { avgRooms: +(stats.rooms / stats.n).toFixed(1), avgDoors: +(stats.doors / stats.n).toFixed(1), avgSpawns: +(stats.spawns / stats.n).toFixed(1), bad: bad.slice(0, 5) };
});

/* ---------- G. 自动游玩长测 ---------- */
const Gres = await page.evaluate(() => {
  const K = window.K, G = K.Game;
  G.newRun('knight');
  window.bot = { wp: null, t: 0, stuckT: 0, lx: 0, ly: 0, jitter: 0 };
  const t0 = performance.now();
  let frames = 0, maxFloor = 1, err = '', roomsCleared = 0, deaths = 0;
  try {
    for (let i = 0; i < 30000; i++) {
      window.playFrame();
      if (i % 6 === 0) G.render();
      frames++;
      maxFloor = Math.max(maxFloor, G.floor);
      if (i % 300 === 0) roomsCleared = Math.max(roomsCleared, K.D.rooms.filter(r => r.cleared).length);
      if (G.scene === 'dead' || G.scene === 'win') {
        deaths++;
        roomsCleared = Math.max(roomsCleared, K.D.rooms.filter(r => r.cleared).length);
        if (deaths >= 4) break;
        G.newRun(['ranger', 'mage', 'rogue', 'knight'][deaths % 4]);
        window.bot = { wp: null, t: 0, stuckT: 0, lx: 0, ly: 0, jitter: 0 };
      }
      const p = G.player;
      if (p && (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.hp))) throw new Error('玩家状态 NaN');
    }
  } catch (ex) { err = ex.message + ' @ ' + String(ex.stack || '').split('\n')[1]; }
  const ms = performance.now() - t0;
  window.chk('自动游玩 ' + frames + ' 帧无崩溃', !err, err);
  window.chk('机器人长时间自动游玩：清房与拾取正常', roomsCleared >= 2 && (G.player ? G.player.kills : 0) >= 10,
    '清房 ' + roomsCleared + ', 击杀 ' + (G.player ? G.player.kills : 0) + ', 遗物 ' + (G.player ? G.player.relics.length : 0) + ', 最深第 ' + maxFloor + ' 层');
  return { frames, maxFloor, deaths, roomsCleared, msPerFrame: +(ms / frames).toFixed(2),
    kills: G.player ? G.player.kills : 0, hp: G.player ? Math.round(G.player.hp) + '/' + G.player.hpMax : 0,
    coins: G.player ? G.player.coins : 0, relics: G.player ? G.player.relics.length : 0,
    weapons: G.player ? G.player.weapons.map(function (w) { return w.name; }) : [], gems: K.Game.meta.gems, scene: G.scene };
});

/* ---------- G2. 确定性通关流程：5 层 Boss -> 传送门 -> 胜利 ---------- */
const G2 = await page.evaluate(() => {
  const K = window.K, G = K.Game, log = [];
  G.newRun('knight');
  let ok = true, msg = '';
  for (let f = 1; f <= 5; f++) {
    const boss = K.D.rooms.filter(r => r.type === 'boss')[0];
    if (!boss) { ok = false; msg = 'floor' + f + ' 无 Boss 房'; break; }
    G.player.x = boss.wx; G.player.y = boss.wy;
    window.keys({}); G.step();
    const fighting = boss.state === 'fighting';
    const bossAlive = G.enemies.filter(e => e.alive && e.boss).length;
    /* 击杀房内全部敌人 */
    for (let i = 0; i < 40 && G.enemies.filter(e => e.alive && e.room === boss.id).length; i++) {
      G.enemies.filter(e => e.alive && e.room === boss.id).forEach(e => G.hurtEnemy(e, 1e7, { dirX: 1, dirY: 0 }));
      G.step();
    }
    G.step();
    const port = K.I.items.filter(i => i.kind === 'portal')[0];
    log.push({ floor: f, boss: boss.state, fighting: fighting, bossSpawned: bossAlive, cleared: !!boss.cleared, portal: !!port });
    if (!fighting || !bossAlive || !boss.cleared || !port) { ok = false; msg = 'floor' + f + ' 流程异常 ' + JSON.stringify(log[log.length - 1]); break; }
    G.player.x = port.x; G.player.y = port.y;
    K.In.setRaw('KeyE', 1); G.step(); K.In.setRaw('KeyE', 0); G.step();
    if (f < 5 && G.floor !== f + 1) { ok = false; msg = '第' + f + '层传送失败 floor=' + G.floor; break; }
  }
  window.chk('5 层流程：Boss 触发 -> 击破 -> 传送门 -> 通关', ok && G.scene === 'win', msg || ('scene=' + G.scene + ' floor=' + G.floor));
  return { log, scene: G.scene, gems: G.meta.gems, wins: G.meta.stats.wins };
});

/* ---------- H. 存档 / 菜单 ---------- */
const Hres = await page.evaluate(() => {
  const K = window.K, G = K.Game;
  G.meta.gems = 500; G.saveMeta();
  const raw = window.localStorage.getItem('rk_save_v1');
  G.meta.gems = 0; G.loadMeta();
  window.chk('存档读写（localStorage）', !!raw && G.meta.gems === 500, 'gems=' + G.meta.gems);
  /* 天赋购买 */
  const before = G.meta.up.hp || 0;
  G.scene = 'upgrade'; G.upSel = 0;
  K.In.setRaw('Enter', 1); G.step(); K.In.setRaw('Enter', 0); G.step();
  window.chk('天赋强化可购买', (G.meta.up.hp || 0) === before + 1, 'hp lv=' + (G.meta.up.hp || 0));
  /* 解锁角色 */
  G.scene = 'select'; G.sel = 4;
  const locked0 = G.meta.unlocked.length;
  K.In.setRaw('Enter', 1); G.step(); K.In.setRaw('Enter', 0); G.step();
  window.chk('宝石解锁英雄', G.meta.unlocked.length === locked0 + 1, '已解锁 ' + G.meta.unlocked.length + ' 名');
  /* 菜单路径 */
  const path = [];
  G.scene = 'title'; path.push(G.scene);
  const tap = c => { K.In.setRaw(c, 1); G.step(); K.In.setRaw(c, 0); G.step(); };
  tap('Enter'); path.push(G.scene);
  tap('KeyU'); path.push(G.scene);
  tap('Escape'); path.push(G.scene);
  tap('Escape'); path.push(G.scene);
  window.chk('菜单流转正常', path.join('>') === 'title>select>upgrade>select>title', path.join('>'));
  /* 属性成长真的生效 */
  G.meta.up = { hp: 5, dmg: 5, crit: 4, armor: 3, energy: 3, speed: 3, luck: 3, magnet: 2 };
  const p2 = K.P.create('knight', G.meta);
  const base = K.P.CHARS[0];
  window.chk('天赋影响角色属性', p2.hpMax > base.hp && p2.mods.dmgMul > 1.2 && p2.armorMax > base.armor,
    'hp ' + base.hp + '->' + p2.hpMax + ', dmg x' + p2.mods.dmgMul.toFixed(2) + ', armor ' + base.armor + '->' + p2.armorMax);
  return { raw: !!raw };
});

const T = await page.evaluate(() => window.T);
console.log('=== 测试结果 ' + T.pass + '/' + (T.pass + T.fail) + ' ===');
for (const r of T.rows) console.log((r.ok ? ' OK  ' : ' FAIL') + '  ' + r.name + (r.info ? '   [' + r.info + ']' : ''));
console.log('\n武器统计: ' + JSON.stringify(A.byCat) + ' 稀有度 ' + JSON.stringify(A.byRarity));
console.log('射击原型: ' + A.styles.join(','));
console.log('武器伤害抽样: ' + Bres.slice(0, 6).map(r => r.name + '=' + r.dealt).join(', '));
console.log('零伤害武器: ' + JSON.stringify(Bres.filter(r => r.dealt <= 0)));
console.log('地牢: ' + JSON.stringify(Fres));
console.log('自动游玩: ' + JSON.stringify(Gres));
console.log('通关流程: ' + JSON.stringify(G2));
console.log('敌人伤害: ' + E.rows.map(r => r.id + ':' + r.dmgToPlayer).join(' '));
console.log('Boss 招式: ' + E.brows.map(r => r.boss + '.' + r.act + '=' + r.dmg).join(' '));
console.log('角色技能: ' + Dres.map(r => r.name + '(' + (r.dmg || 0) + 'dmg/' + (r.heal || 0) + 'hp)').join(' '));
console.log('PAGE ERRORS(' + errs.length + '): ' + JSON.stringify(errs.slice(0, 6), null, 1));
await browser.close();
