import { chromium } from 'playwright';
import url from 'url';
const ROOT = '/home/a7067567/deepseek/rogue-knight';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 810 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e.message)));
await page.goto(url.pathToFileURL(ROOT + '/index.html').href);
await page.waitForTimeout(350);
await page.evaluate(() => {
  const K = window.K;
  K.Game.loop = function () { }; K.Snd.play = function () { }; K.Snd.music = function () { };
  window.KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyJ', 'KeyE', 'KeyF', 'Space'];
  window.keys = o => { for (const k of window.KEYS) K.In.setRaw(k, o && o[k] ? 1 : 0); };
  window.path = (fx, fy, tx, ty) => {
    const D = K.D.D, TS = K.TS, W = D.w, H = D.h;
    const sx = Math.floor(fx / TS), sy = Math.floor(fy / TS), gx = Math.floor(tx / TS), gy = Math.floor(ty / TS);
    const prev = new Int32Array(W * H).fill(-1); const q = [sy * W + sx]; prev[sy * W + sx] = sy * W + sx;
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
  };
  window.B = { wp: null, t: 0, stuck: 0, lx: 0, ly: 0, jit: 0 };
  window.frame = () => {
    const G = K.Game, p = G.player, b = window.B;
    if (!p || !p.alive || G.scene !== 'play') { window.keys({}); return; }
    b.t++;
    const e = K.B.nearest(p.x, p.y, 0, 900);
    let tx, ty;
    if (e) { tx = e.x; ty = e.y; } else {
      const port = K.I.items.filter(i => i.kind === 'portal')[0];
      const pick = K.I.items.filter(i => !i._bot && (i.kind === 'relic' || (i.kind === 'chest' && !i.opened) || (i.kind === 'weapon' && Math.hypot(i.x - p.x, i.y - p.y) > 60)))[0];
      const rm = K.D.rooms.filter(r => r.spawns.length && !r.cleared)[0] || K.D.rooms.filter(r => !r.visited)[0];
      const t = port || pick || rm;
      tx = t ? (t.x !== undefined ? t.x : t.wx) : p.x; ty = t ? (t.y !== undefined ? t.y : t.wy) : p.y;
    }
    if (b.t % 16 === 0 || !b.wp) b.wp = window.path(p.x, p.y, tx, ty);
    let dx = 0, dy = 0;
    if (b.wp && b.wp.length) { while (b.wp.length > 1 && Math.hypot(b.wp[0][0] - p.x, b.wp[0][1] - p.y) < 26) b.wp.shift(); dx = b.wp[0][0] - p.x; dy = b.wp[0][1] - p.y; }
    else { dx = tx - p.x; dy = ty - p.y; }
    const d = e ? Math.hypot(e.x - p.x, e.y - p.y) : 999;
    const melee = p.weapons[p.slot].style === 'melee';
    if (e && !melee && d < 100) { dx = -dx; dy = -dy; }
    if (Math.hypot(p.x - b.lx, p.y - b.ly) < .5) b.stuck++; else b.stuck = 0;
    b.lx = p.x; b.ly = p.y;
    if (b.stuck > 20) { b.jit = 24; b.stuck = 0; b.wp = null; }
    if (b.jit > 0) { b.jit--; dx = Math.cos(b.t * .4) * 50; dy = Math.sin(b.t * .4) * 50; }
    const kk = {};
    if (dx > 10) kk.KeyD = 1; else if (dx < -10) kk.KeyA = 1;
    if (dy > 10) kk.KeyS = 1; else if (dy < -10) kk.KeyW = 1;
    if (e && d < 640) kk.KeyJ = 1;
    if (e && d < 320 && p.skillCd <= 0) kk.KeyF = 1;
    const nn = K.I.nearest(p);
    if (nn && !nn._bot && b.t % 8 === 0) { kk.KeyE = 1; nn._bot = 1; }
    window.keys(kk);
    K.Game.step();
  };
});
async function shot(name, fn) { await page.evaluate(fn); await page.screenshot({ path: ROOT + '/tools/shots/' + name + '.png' }); }
await shot('01-title', () => { K.Game.scene = 'title'; K.Game.render(); });
await shot('02-select', () => { K.Game.scene = 'select'; K.Game.sel = 2; K.Game.meta.gems = 260; K.Game.render(); });
await shot('03-upgrade', () => { K.Game.scene = 'upgrade'; K.Game.upSel = 2; K.Game.render(); });
await shot('04-help', () => { K.Game.scene = 'help'; K.Game.render(); });
/* 战斗中 */
await shot('05-combat', () => {
  const K = window.K, G = K.Game;
  G.newRun('ranger');
  for (let i = 0; i < 4000; i++) {
    window.frame();
    const inFight = G.curRoom && G.curRoom.state === 'fighting';
    const n = G.enemies.filter(e => e.alive).length;
    if (inFight && n >= 4 && K.B.count > 3 && i > 200) break;
  }
  G.render();
});
await shot('06-combat-debug', () => { K.Game.debug = true; for (let i = 0; i < 3; i++) window.frame(); K.Game.render(); });
await shot('07-combat2', () => {
  K.Game.debug = false;
  for (let i = 0; i < 260; i++) window.frame();
  K.Game.render();
});
/* Boss 战 */
await shot('08-boss', () => {
  const K = window.K, G = K.Game;
  const boss = K.D.rooms.filter(r => r.type === 'boss')[0];
  G.player.x = boss.wx; G.player.y = boss.wy + 150;
  G.player.hp = G.player.hpMax; G.player.weapons[0] = K.W.BY['x1']; G.player.slot = 0;
  for (let i = 0; i < 200; i++) window.frame();
  G.render();
});
await shot('09-boss2', () => { for (let i = 0; i < 200; i++) window.frame(); K.Game.render(); });
/* 商店 */
await shot('10-shop', () => {
  const K = window.K, G = K.Game;
  const shop = K.D.rooms.filter(r => r.type === 'shop')[0] || K.D.rooms.filter(r => r.type === 'treasure')[0];
  if (shop) { G.player.x = shop.wx; G.player.y = shop.wy + 60; G.player.coins = 200; G.curRoom = shop; shop.visited = 1; }
  for (let i = 0; i < 30; i++) { window.keys({}); G.step(); }
  G.render();
});
/* 死亡结算 */
await shot('11-dead', () => {
  const K = window.K, G = K.Game;
  G.player.hp = 1; G.hurtPlayer(999, { dirX: 1, dirY: 0 });
  for (let i = 0; i < 40; i++) { window.keys({}); G.step(); }
  G.render();
});
/* 像素对齐检查：敌人/玩家是否画在碰撞体位置 */
const align = await page.evaluate(() => {
  const K = window.K, G = K.Game;
  G.newRun('knight');
  for (let i = 0; i < 1500; i++) { window.frame(); if (G.enemies.filter(e => e.alive).length >= 3) break; }
  G.render();
  const cv = document.getElementById('game'), ctx = cv.getContext('2d');
  const V = G.view();
  function sample(wx, wy, r) {
    const x = Math.round(V.tx(wx)), y = Math.round(V.ty(wy)), R = Math.round(r * V.z);
    if (x - R < 0 || y - R < 0 || x + R > cv.width || y + R > cv.height) return null;
    const d = ctx.getImageData(x - R, y - R, R * 2, R * 2).data;
    /* 与地板色差异较大的像素占比 */
    let diff = 0, tot = 0;
    for (let i = 0; i < d.length; i += 4) {
      tot++;
      const lum = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2];
      if (lum > 120 || lum < 30) diff++;
    }
    return +(diff / tot).toFixed(3);
  }
  const rows = [];
  rows.push({ what: 'player', frac: sample(G.player.x, G.player.y - 8, G.player.r) });
  G.enemies.filter(e => e.alive).slice(0, 4).forEach(e => rows.push({ what: e.def.id, frac: sample(e.x, e.y - 6, e.r) }));
  /* 空地对照 */
  const rm = G.curRoom;
  rows.push({ what: 'empty-floor', frac: sample((rm.x0 + 1.5) * K.TS, (rm.y0 + 1.5) * K.TS, 14) });
  return rows;
});
console.log('像素占位检查(与地板差异明显像素占比): ' + JSON.stringify(align));
console.log('ERRORS ' + JSON.stringify(errs.slice(0, 4)));
await browser.close();
