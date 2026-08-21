import { chromium } from '/home/asus_pyqx/.nvm/versions/node/v24.19.0/lib/node_modules/playwright/index.mjs';
const url = process.argv[2] || 'file:///home/asus_pyqx/B3/forbidden-city/_dev/test.html';
const out = process.argv[3] || '/home/asus_pyqx/B3/forbidden-city/_dev/shot.png';
const W = +(process.argv[4] || 1280), H = +(process.argv[5] || 760);
const waitMs = +(process.env.WAIT || 1500);
const b = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox',
    '--disable-lcd-text', '--js-flags=--max-old-space-size=4096'],
});
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const msgs = [];
p.on('console', m => msgs.push('[' + m.type() + '] ' + m.text()));
p.on('pageerror', e => msgs.push('[pageerror] ' + e.message));
await p.goto(url, { waitUntil: 'load', timeout: 180000 });
await p.waitForTimeout(waitMs);
const log = await p.evaluate(() => (window.__log || []).join('\n') + (window.__stats ? '\n' + window.__stats() : ''));
console.log(log);
if (msgs.length) console.log('--- console ---\n' + msgs.join('\n'));
await p.screenshot({ path: out });
console.log('saved ' + out);
await b.close();
