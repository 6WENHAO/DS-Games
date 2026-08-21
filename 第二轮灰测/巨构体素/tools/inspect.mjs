/**
 * 画面核对：
 *  1) 归一化亮度 ASCII 图（看曝光与层次）
 *  2) 剪影图（隐藏城市取一张“只有天空”的参考帧，做差 → 直接看到巨构轮廓）
 *  3) 发光图（自发光像素分布，看夜景是否亮起来）
 * 无图形界面也能判断构图是否成立。
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('shots');
fs.mkdirSync(OUT, { recursive: true });
const URL = 'http://127.0.0.1:5178/?readback=1';
const RAMP = ' .:-=+*oO8@';
const GW = 100, GH = 42;

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

function normMap(g) {
  let mn = 1e9, mx = -1e9;
  for (const row of g.cells) for (const c of row) { const l = lum(c); if (l < mn) mn = l; if (l > mx) mx = l; }
  const span = Math.max(1, mx - mn);
  return g.cells.map((row) => row.map((c) => {
    const t = (lum(c) - mn) / span;
    return RAMP[Math.min(RAMP.length - 1, Math.floor(t * RAMP.length))];
  }).join('')).join('\n');
}

function diffMap(a, b, thresh = 9) {
  return a.cells.map((row, y) => row.map((c, x) => {
    const d = Math.abs(lum(c) - lum(b.cells[y][x]))
      + Math.abs(c[0] - b.cells[y][x][0]) * 0.3
      + Math.abs(c[2] - b.cells[y][x][2]) * 0.3;
    return d > thresh * 4 ? '#' : d > thresh * 1.6 ? '+' : d > thresh ? '.' : ' ';
  }).join('')).join('\n');
}

function glowMap(g, hi = 165) {
  return g.cells.map((row) => row.map((c) => {
    const l = lum(c);
    const warm = c[0] - c[2];
    if (l > hi + 45) return '@';
    if (l > hi) return warm > 20 ? 'o' : 'x';
    if (l > hi - 45) return warm > 15 ? '.' : ',';
    return ' ';
  }).join('')).join('\n');
}

const browser = await chromium.launch({
  channel: 'chrome', headless: true,
  args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'],
});
const rep = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('#boot')?.classList.contains('gone'), null, { timeout: 240000 });
  await page.waitForTimeout(2500);

  // headless 下第一次 readPixels 常常拿到未刷新的缓冲，重试到拿到有效帧
  const grab = async () => {
    for (let i = 0; i < 5; i++) {
      const g = await page.evaluate((n) => window.__grab(n[0], n[1]), [GW, GH]);
      if (g.meanLum > 0.4 || g.maxLum > 2) return g;
      await page.waitForTimeout(180);
    }
    return page.evaluate((n) => window.__grab(n[0], n[1]), [GW, GH]);
  };
  const setCity = (v) => page.evaluate((vv) => { window.__ds.cityVisible(vv); }, v);

  const scenes = [
    ['01-sandbox-dusk', 'orbit', true],
    ['02-orbit-low', 'orbit-low', true],
    ['03-fps-approach', 'approach', true],
    ['04-fps-gate', 'gate', true],
    ['05-fps-plaza', 'plaza', true],
    ['06-fps-canopy', 'canopy', true],
    ['07-fps-abyss', 'abyss', false],
    ['08-fps-span', 'span', false],
    ['09-fps-crown', 'crown', true],
  ];

  for (const [name, vp, wantSil] of scenes) {
    await page.evaluate((id) => document.querySelector(`#vpList button[data-vp="${id}"]`).click(), vp);
    await page.waitForTimeout(1700);
    const g = await grab();
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    let block = `\n${'='.repeat(GW + 2)}\n### ${name}  meanLum=${g.meanLum.toFixed(1)} min=${g.minLum.toFixed(0)} max=${g.maxLum.toFixed(0)} fps=${g.fps.toFixed(0)}\n[归一化亮度]\n${normMap(g)}`;
    if (wantSil) {
      await setCity(false);
      await page.waitForTimeout(420);
      const sky = await grab();
      await setCity(true);
      await page.waitForTimeout(300);
      block += `\n[巨构剪影 = 有城市 vs 只有天空]\n${diffMap(g, sky)}`;
    }
    rep.push(block);
    console.log('captured', name);
  }

  // 夜景
  await page.evaluate(() => {
    document.querySelector('#skyPresets button[data-sky="night"]').click();
    document.querySelector('#vpList button[data-vp="orbit"]').click();
  });
  await page.waitForTimeout(1900);
  await page.screenshot({ path: path.join(OUT, '10-night-sandbox.png') });
  let g = await grab();
  rep.push(`\n${'='.repeat(GW + 2)}\n### 10-night-sandbox meanLum=${g.meanLum.toFixed(1)} max=${g.maxLum.toFixed(0)}\n[归一化亮度]\n${normMap(g)}\n[发光分布]\n${glowMap(g, 110)}`);
  console.log('captured night sandbox');

  await page.evaluate(() => document.querySelector('#vpList button[data-vp="plaza"]').click());
  await page.waitForTimeout(1700);
  await page.screenshot({ path: path.join(OUT, '11-night-plaza.png') });
  g = await grab();
  rep.push(`\n${'='.repeat(GW + 2)}\n### 11-night-plaza meanLum=${g.meanLum.toFixed(1)} max=${g.maxLum.toFixed(0)}\n[归一化亮度]\n${normMap(g)}\n[发光分布]\n${glowMap(g, 110)}`);
  console.log('captured night plaza');

  // 阴天剪影（最能看清体量）
  await page.evaluate(() => {
    document.querySelector('#skyPresets button[data-sky="overcast"]').click();
    document.querySelector('#vpList button[data-vp="orbit"]').click();
  });
  await page.waitForTimeout(1900);
  await page.screenshot({ path: path.join(OUT, '12-overcast.png') });
  g = await grab();
  await setCity(false); await page.waitForTimeout(420);
  const sky2 = await grab();
  await setCity(true); await page.waitForTimeout(300);
  rep.push(`\n${'='.repeat(GW + 2)}\n### 12-overcast meanLum=${g.meanLum.toFixed(1)}\n[归一化亮度]\n${normMap(g)}\n[巨构剪影]\n${diffMap(g, sky2)}`);
  console.log('captured overcast');

  // 巡航
  await page.evaluate(() => {
    document.querySelector('#skyPresets button[data-sky="dusk"]').click();
    document.querySelector('#topbar .modes button[data-mode="cine"]').click();
  });
  for (const t of [7, 21, 34, 47, 66, 86]) {
    await page.evaluate((tt) => window.__setCineTime(tt), t);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, `cine-${t}.png`) });
    const gg = await grab();
    rep.push(`\n${'='.repeat(GW + 2)}\n### cine@${t}s meanLum=${gg.meanLum.toFixed(1)} fps=${gg.fps.toFixed(0)}\n${normMap(gg)}`);
    console.log('captured cine', t);
  }

  const perf = await page.evaluate(async () => {
    const bench = async (label) => {
      const t0 = performance.now(); let n = 0;
      await new Promise((res) => {
        const tick = () => { n++; if (performance.now() - t0 > 2200) res(); else requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      });
      return `${label}: ${(n / ((performance.now() - t0) / 1000)).toFixed(1)} fps`;
    };
    const out = [];
    document.querySelector('#topbar .modes button[data-mode="orbit"]').click();
    document.querySelector('#vpList button[data-vp="orbit"]').click();
    out.push(await bench('沙盘全景'));
    document.querySelector('#vpList button[data-vp="orbit-low"]').click();
    out.push(await bench('贴地环视'));
    document.querySelector('#tShadow').click();
    out.push(await bench('贴地环视/无阴影'));
    document.querySelector('#tShadow').click();
    document.querySelector('#tProps').click();
    out.push(await bench('贴地环视/无道具'));
    document.querySelector('#tProps').click();
    return out;
  });
  rep.push('\n\n### 性能\n' + perf.join('\n'));
  rep.push('\n### console errors (' + errors.length + ')\n' + errors.slice(0, 30).join('\n'));

  fs.writeFileSync(path.join(OUT, 'report.txt'), rep.join('\n'), 'utf8');
  console.log('\nreport ->', path.join(OUT, 'report.txt'));
  await page.close();
} finally {
  await browser.close();
}
