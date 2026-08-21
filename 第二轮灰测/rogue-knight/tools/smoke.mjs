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
const r = await page.evaluate(() => {
  const K = window.K;
  const out = { loaded: !!(K && K.Game && K.W && K.E && K.D && K.P), errors: [] };
  K.Game.loop = function () { };
  K.Snd.play = function () { };
  try {
    out.weapons = K.W.LIST.length; out.chars = K.P.CHARS.length; out.enemies = K.E.LIST.length;
    out.relics = K.I.RELICS.length; out.bosses = K.E.BOSSES.length;
    K.Game.newRun('knight');
    out.floor = K.Game.floor;
    out.rooms = K.D.rooms.length;
    out.props = K.Game.props.length;
    out.playerHp = K.Game.player.hp;
    for (let i = 0; i < 240; i++) { K.Game.step(); K.Game.render(); }
    out.afterSteps = { t: K.Game.t, enemies: K.Game.enemies.length, scene: K.Game.scene, x: Math.round(K.Game.player.x) };
  } catch (e) { out.errors.push(String(e.message) + ' @ ' + String(e.stack || '').split('\n')[1]); }
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log('PAGE ERRORS: ' + JSON.stringify(errs.slice(0, 8), null, 1));
await browser.close();
