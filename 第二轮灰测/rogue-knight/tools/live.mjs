import { chromium } from 'playwright';
import url from 'url';
const ROOT = '/home/a7067567/deepseek/rogue-knight';
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 810 } });
const errs = [];
page.on('pageerror', e => errs.push(String(e.message)));
page.on('console', m => { if (m.type() === 'error') errs.push('C:' + m.text()); });
await page.goto(url.pathToFileURL(ROOT + '/index.html').href);
await page.waitForTimeout(700);
const t0 = Date.now();
const s0 = await page.evaluate(() => ({ t: K.Game.t, scene: K.Game.scene }));
/* 真实键鼠：进入游戏 */
await page.keyboard.press('Enter'); await page.waitForTimeout(300);   // title -> select
await page.keyboard.press('KeyD'); await page.waitForTimeout(150);
await page.keyboard.press('Enter'); await page.waitForTimeout(600);   // 开始（ranger）
/* 移动 + 射击 + 技能 + 翻滚 */
await page.mouse.move(900, 300);
async function hold(k, ms) { await page.keyboard.down(k); await page.waitForTimeout(ms); await page.keyboard.up(k); }
await hold('KeyD', 700);
await page.mouse.down(); await page.waitForTimeout(700); await page.mouse.up();
await page.keyboard.press('Space'); await page.waitForTimeout(200);
await page.keyboard.press('KeyF'); await page.waitForTimeout(300);
await page.keyboard.press('KeyQ'); await page.waitForTimeout(200);
await hold('KeyS', 500);
await page.mouse.move(500, 500);
await page.mouse.down(); await page.waitForTimeout(900); await page.mouse.up();
await page.keyboard.press('F1'); await page.waitForTimeout(400);
await page.screenshot({ path: ROOT + '/tools/shots/12-live-debug.png' });
await page.keyboard.press('F1');
await page.keyboard.press('KeyR'); await page.waitForTimeout(200);   // 自动瞄准切换
await hold('KeyA', 600);
await page.waitForTimeout(1200);
await page.screenshot({ path: ROOT + '/tools/shots/13-live.png' });
const s1 = await page.evaluate(() => {
  const K = window.K, G = K.Game, p = G.player;
  return { t: G.t, frame: G.frame, scene: G.scene, floor: G.floor, autoAim: G.autoAim,
    hp: p ? Math.round(p.hp) + '/' + p.hpMax : 0, energy: p ? Math.round(p.energy) : 0,
    slot: p ? p.slot : -1, weapons: p ? p.weapons.map(w => w.name) : [], kills: p ? p.kills : 0,
    coins: p ? p.coins : 0, enemies: G.enemies.length, bullets: K.B.count, parts: K.FX.count,
    room: G.curRoom ? G.curRoom.type + ':' + G.curRoom.state : '-', music: K.Snd.musicOn, audio: K.Snd.ok };
});
const secs = (Date.now() - t0) / 1000;
await page.keyboard.press('KeyP'); await page.waitForTimeout(250);
const paused = await page.evaluate(() => K.Game.paused);
await page.screenshot({ path: ROOT + '/tools/shots/14-pause.png' });
console.log(JSON.stringify({ start: s0, end: s1, wallSecs: +secs.toFixed(1), stepsPerSec: +((s1.t - s0.t) / secs).toFixed(1), paused, errs }, null, 1));
await browser.close();
