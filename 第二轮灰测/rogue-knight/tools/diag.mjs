import { chromium } from 'playwright';
import url from 'url';
const ROOT = '/home/a7067567/deepseek/rogue-knight';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
const errs = [];
page.on('pageerror', e => errs.push('ERR: ' + e.message + ' @@ ' + String(e.stack || '').split('\n').slice(1, 3).join(' | ')));
await page.goto(url.pathToFileURL(ROOT + '/index.html').href);
await page.waitForTimeout(300);
const r = await page.evaluate(() => {
  const K = window.K, G = K.Game;
  G.loop = function () { }; K.Snd.play = function () { }; K.Snd.music = function () { };
  /* ——— 机器人（带 BFS 寻路） ——— */
  function path(fx, fy, tx, ty) {
    const D = K.D.D, TS = K.TS, W = D.w, H = D.h;
    const sx = Math.floor(fx / TS), sy = Math.floor(fy / TS), gx = Math.floor(tx / TS), gy = Math.floor(ty / TS);
    const prev = new Int32Array(W * H).fill(-1);
    const q = [sy * W + sx]; prev[sy * W + sx] = sy * W + sx;
    let head = 0, found = -1;
    while (head < q.length) {
      const cur = q[head++], cx = cur % W, cy = (cur / W) | 0;
      if (cx === gx && cy === gy) { found = cur; break; }
      for (const o of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + o[0], ny = cy + o[1], ni = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev[ni] !== -1 || K.D.solid(nx, ny)) continue;
        prev[ni] = cur; q.push(ni);
      }
    }
    if (found < 0) return null;
    const out = []; let cur = found;
    while (prev[cur] !== cur) { out.push([(cur % W + .5) * TS, (((cur / W) | 0) + .5) * TS]); cur = prev[cur]; }
    return out.reverse();
  }
  const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyE', 'KeyF', 'Space'];
  function keys(o) { for (const k of KEYS) K.In.setRaw(k, o && o[k] ? 1 : 0); }
  let wp = null, bt = 0, stuck = 0, lx = 0, ly = 0, jit = 0;
  function frame() {
    const p = G.player;
    if (!p || !p.alive || G.scene !== 'play') { keys({}); return; }
    bt++;
    const e = K.B.nearest(p.x, p.y, 0, 900);
    let tx, ty;
    if (e) { tx = e.x; ty = e.y; }
    else {
      const port = K.I.items.filter(i => i.kind === 'portal')[0];
      const pick = K.I.items.filter(i => !i._bot && (i.kind === 'relic' || (i.kind === 'chest' && !i.opened) ||
        (i.kind === 'weapon' && Math.hypot(i.x - p.x, i.y - p.y) > 60)))[0];
      const rm = K.D.rooms.filter(r => r.spawns.length && !r.cleared)[0] || K.D.rooms.filter(r => !r.visited)[0];
      const t = port || pick || rm;
      tx = t ? (t.x !== undefined ? t.x : t.wx) : p.x;
      ty = t ? (t.y !== undefined ? t.y : t.wy) : p.y;
    }
    if (bt % 16 === 0 || !wp) wp = path(p.x, p.y, tx, ty);
    let dx = 0, dy = 0;
    if (wp && wp.length) {
      while (wp.length > 1 && Math.hypot(wp[0][0] - p.x, wp[0][1] - p.y) < 26) wp.shift();
      dx = wp[0][0] - p.x; dy = wp[0][1] - p.y;
    } else { dx = tx - p.x; dy = ty - p.y; }
    const d = e ? Math.hypot(e.x - p.x, e.y - p.y) : 999;
    const melee = p.weapons[p.slot].style === 'melee';
    if (e && !melee && d < 100) { dx = -dx; dy = -dy; }
    if (Math.hypot(p.x - lx, p.y - ly) < .5) stuck++; else stuck = 0;
    lx = p.x; ly = p.y;
    if (stuck > 20) { jit = 24; stuck = 0; wp = null; }
    if (jit > 0) { jit--; dx = Math.cos(bt * .4) * 50; dy = Math.sin(bt * .4) * 50; }
    const kk = {};
    if (dx > 10) kk.KeyD = 1; else if (dx < -10) kk.KeyA = 1;
    if (dy > 10) kk.KeyS = 1; else if (dy < -10) kk.KeyW = 1;
    if (e && d < 640) kk.KeyJ = 1;
    if (e && d < 320 && p.skillCd <= 0) kk.KeyF = 1;
    const nn = K.I.nearest(p);
    if (nn && !nn._bot && bt % 8 === 0) { kk.KeyE = 1; nn._bot = 1; }
    keys(kk);
    G.step();
  }
  /* ——— 逐段诊断 ——— */
  const log = [];
  G.newRun('knight');
  let lastKills = 0, lastFloor = 1, stall = 0;
  for (let i = 0; i < 30000; i++) {
    frame();
    if (i % 900 === 0) {
      const p = G.player, rm = G.curRoom;
      const alive = G.enemies.filter(x => x.alive && rm && x.room === rm.id).length;
      const outside = G.enemies.filter(x => x.alive && rm && x.room === rm.id &&
        (x.x < rm.x0 * K.TS || x.x > (rm.x1 + 1) * K.TS || x.y < rm.y0 * K.TS || x.y > (rm.y1 + 1) * K.TS)).length;
      log.push({ f: i, floor: G.floor, room: rm ? rm.id + ':' + rm.type + ':' + rm.state : '-', enemiesInRoom: alive,
        outsideRoom: outside, kills: p.kills, hp: Math.round(p.hp), cleared: K.D.rooms.filter(r => r.cleared).length,
        weapon: p.weapons[p.slot].name, relics: p.relics.length, scene: G.scene });
      if (p.kills === lastKills && G.floor === lastFloor) stall++; else stall = 0;
      lastKills = p.kills; lastFloor = G.floor;
    }
    if (G.scene === 'dead' || G.scene === 'win') break;
  }
  const p = G.player;
  return { log, final: { floor: G.floor, scene: G.scene, kills: p.kills, hp: Math.round(p.hp), gems: p.gems,
    cleared: K.D.rooms.filter(r => r.cleared).length, total: K.D.rooms.filter(r => r.spawns.length).length,
    weapons: p.weapons.map(w => w.name), relics: p.relics.map(r => r.name) } };
});
console.log('final: ' + JSON.stringify(r.final));
for (const l of r.log) console.log(JSON.stringify(l));
console.log('ERRORS ' + JSON.stringify(errs.slice(0, 4)));
await browser.close();
