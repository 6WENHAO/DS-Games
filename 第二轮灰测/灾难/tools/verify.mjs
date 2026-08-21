/**
 * Full browser verification (dev tool).
 *
 * Headless Chromium throttles requestAnimationFrame to ~1 fps, so the harness
 * drives the app's own frame function through the debug handle: simulation runs
 * un-rendered (SwiftShader is slow) and a few real rendered frames are produced
 * before each screenshot.
 *
 * Usage: node tools/verify.mjs [url]
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHROMIUM_ARGS, EXE } from './frames.mjs';

const URL = process.argv[2] ?? 'http://127.0.0.1:5180/';
const OUT = resolve('shots');
mkdirSync(OUT, { recursive: true });

const problems = [];
const logs = [];
const report = { url: URL, desktop: {}, mobile: {}, problems: [], logs: [] };

const browser = await chromium.launch({ executablePath: EXE, args: CHROMIUM_ARGS });

function attach(page, name) {
  page.on('console', (m) => {
    const t = m.type();
    const text = `[${name}] console.${t}: ${m.text()}`;
    logs.push(text);
    if (t === 'error' || t === 'warning') problems.push(text);
  });
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) =>
    problems.push(`[${name}] requestfailed: ${r.url()} ${r.failure()?.errorText ?? ''}`),
  );
}

/** Grab the WebGL drawing buffer directly (the compositor is unusable here). */
async function shoot(page, file) {
  const url = await page.evaluate(() => window.__sandbox.capture());
  if (!url || !url.startsWith('data:image/png;base64,')) {
    problems.push('capture failed for ' + file);
    return;
  }
  writeFileSync(resolve(OUT, file + '.png'), Buffer.from(url.slice(22), 'base64'));
}

function makeRunner(page) {
  return async function run(seconds, render = false) {
    const total = Math.round(seconds * 60);
    let done = 0;
    while (done < total) {
      const n = Math.min(60, total - done);
      await page.evaluate(([k, r]) => window.__sandbox.step(k, 1 / 60, r), [n, render]);
      done += n;
    }
  };
}

const snap = (page) =>
  page.evaluate(() => {
    const g = window.__sandbox;
    const info = g.engine.renderer.info;
    return {
      voxels: g.sandbox.voxelCount,
      field: g.sandbox.field.count,
      total: g.sandbox.field.total,
      debris: g.sandbox.debrisCount,
      particles: g.sandbox.particleCount,
      peds: g.sandbox.crowd.aliveCount,
      collapses: g.sandbox.city.collapses,
      water: +g.sandbox.water.level.toFixed(2),
      storm: +g.sandbox.sky.storm.toFixed(2),
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs.length,
      tier: g.engine.quality.tier,
      hint: g.manager.hint(),
      panicking: g.sandbox.crowd.panicCount,
      audio: g.sandbox.audio.contextState,
      voices: g.sandbox.audio.voiceCount,
      bootGone: document.getElementById('boot') === null,
    };
  });

const layout = (page) =>
  page.evaluate(() => {
    const ids = ['brand', 'stats', 'hintline', 'toolbar'];
    const rects = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      rects[id] = {
        x: +r.x.toFixed(1),
        y: +r.y.toFixed(1),
        w: +r.width.toFixed(1),
        h: +r.height.toFixed(1),
      };
    }
    const overlaps = [];
    const keys = Object.keys(rects);
    for (let i = 0; i < keys.length; i++)
      for (let j = i + 1; j < keys.length; j++) {
        const a = rects[keys[i]];
        const b = rects[keys[j]];
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y)
          overlaps.push(`${keys[i]} x ${keys[j]}`);
      }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const outside = [];
    for (const [k, r] of Object.entries(rects))
      if (r.x < -1 || r.y < -1 || r.x + r.w > vw + 1 || r.y + r.h > vh + 1)
        outside.push(`${k} ${JSON.stringify(r)}`);
    const clipped = [];
    document.querySelectorAll('#hud .lbl, #hint, #stats, .chip, .slider, #brand h1').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 2)
        clipped.push(`${el.className || el.id}: ${el.textContent?.trim()}`);
    });
    return { rects, overlaps, outside, clipped, vw, vh };
  });

// ============================================================ desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  attach(page, 'desktop');
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__sandbox));
  // SwiftShader cannot render 1440x900 at full DPR in reasonable time
  await page.evaluate(() => window.__sandbox.engine.setPixelRatio(0.55));
  const run = makeRunner(page);

  await run(1);
  report.desktop.boot = await snap(page);
  report.desktop.layout = await layout(page);
  await shoot(page, 'a1-city');
  // one composited shot so the DOM chrome is verified too
  try {
    await page.screenshot({ path: resolve(OUT, 'a0-page-1440x900.png'), timeout: 20000 });
  } catch (e) {
    problems.push('composited desktop screenshot failed: ' + String(e).slice(0, 120));
  }

  // hover reticle + armed cursor
  await page.evaluate(() => window.__sandbox.manager.select('nuke'));
  await page.mouse.move(720, 500);
  await run(0.3);
  await shoot(page, 'a2-reticle-nuke');
  report.desktop.reticleHint = (await snap(page)).hint;
  await page.evaluate(() => window.__sandbox.manager.cancel());

  const shots = [
    ['blast', 'b1-blast', 0.1, 1.3],
    ['meteor', 'b2-meteor', 0.8, 0.65],
    ['lightning', 'b3-lightning', 0.05, 0.9],
    ['tornado', 'b4-tornado', 4, 0],
    ['blackhole', 'b5-blackhole', 3.5, 0],
    ['nuke', 'b6-nuke-flash', 2.0, 0],
    ['nuke2', 'b7-nuke-cloud', 3.2, 0],
    ['quake', 'b8-quake', 9, 0],
    ['flood', 'b9-flood', 7, 0],
    ['storm', 'c1-storm', 4, 0],
  ];

  for (const [tool, file, at, extra] of shots) {
    if (tool !== 'nuke2') {
      await page.evaluate(() => {
        window.__sandbox.manager.reset();
        window.__sandbox.sandbox.rebuild();
      });
      await run(0.4);
      await page.evaluate((t) => {
        const g = window.__sandbox;
        g.manager.select(t);
        g.manager.release({ x: 12, y: 0, z: 8 });
      }, tool);
    }
    await run(at);
    await run(0.02);
    await shoot(page, file);
    report.desktop[file] = await snap(page);
    if (extra > 0) {
      await run(extra);
      await run(0.02);
      await shoot(page, file + '-late');
    }
    const running = await page.evaluate(
      (t) => (t === 'nuke2' ? false : window.__sandbox.manager.isRunning(t)),
      tool,
    );
    if (running) {
      await page.evaluate((t) => window.__sandbox.manager.select(t), tool);
      await run(2.5);
      report.desktop[file + '-stopped'] = await snap(page);
    }
  }

  // tilt slider extremes
  await page.evaluate(() => {
    window.__sandbox.manager.reset();
    window.__sandbox.sandbox.rebuild();
  });
  await run(0.4);
  for (const v of ['0', '100']) {
    await page.locator('#c-tilt').fill(v);
    await page.locator('#c-tilt').dispatchEvent('input');
    await run(0.2);
    await shoot(page, 'd-tilt-' + v);
  }
  await page.locator('#c-tilt').fill('45');
  await page.locator('#c-tilt').dispatchEvent('input');
  report.desktop.tiltAmount = await page.evaluate(() => window.__sandbox.engine.tilt.amount);

  // slow-motion + sound toggles
  await page.locator('#c-slow').click();
  report.desktop.timeScaleSlow = await page.evaluate(() => window.__sandbox.engine.timeScale);
  await page.locator('#c-slow').click();
  report.desktop.timeScaleNormal = await page.evaluate(() => window.__sandbox.engine.timeScale);
  await page.locator('#c-sound').click();
  report.desktop.soundOff = await page.evaluate(() => !window.__sandbox.sandbox.audio.enabled);
  await page.locator('#c-sound').click();
  report.desktop.soundOn = await page.evaluate(() => window.__sandbox.sandbox.audio.enabled);

  // camera interaction: drag-orbit must not fire a disaster
  await page.evaluate(() => window.__sandbox.manager.select('blast'));
  const beforeDrag = await snap(page);
  await page.mouse.move(700, 450);
  await page.mouse.down();
  for (let i = 0; i < 10; i++) await page.mouse.move(700 + i * 12, 450 + i * 3);
  await page.mouse.up();
  await run(0.4);
  const afterDrag = await snap(page);
  report.desktop.dragDidNotFire = beforeDrag.field === afterDrag.field;
  report.desktop.cameraMoved = await page.evaluate(
    () => Math.abs(window.__sandbox.controls.azimuth - 0.72) > 0.02,
  );
  // right click cancels
  await page.mouse.click(700, 450, { button: 'right' });
  await run(0.2);
  report.desktop.rightClickCancelled = await page.evaluate(
    () => window.__sandbox.manager.armed === null,
  );

  // real click fires
  await page.evaluate(() => window.__sandbox.manager.select('blast'));
  const b2 = await snap(page);
  await page.mouse.click(700, 460);
  await run(0.6);
  const a2 = await snap(page);
  report.desktop.clickFired = a2.field < b2.field;

  await run(1);
  await shoot(page, 'd-final');
  report.desktop.final = await snap(page);
  await ctx.close();
}

// ============================================================ mobile
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  attach(page, 'mobile');
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.__sandbox));
  await page.evaluate(() => window.__sandbox.engine.setPixelRatio(0.8));
  const run = makeRunner(page);
  await run(1);
  report.mobile.boot = await snap(page);
  report.mobile.layout = await layout(page);
  await shoot(page, 'm1-city');
  try {
    await page.screenshot({ path: resolve(OUT, 'm0-page-390x844.png'), timeout: 20000 });
  } catch (e) {
    problems.push('composited mobile screenshot failed: ' + String(e).slice(0, 120));
  }

  // tap to fire through the touch path
  await page.locator('.tool').filter({ hasText: '定点爆破' }).click();
  const before = await snap(page);
  await page.touchscreen.tap(195, 430);
  await run(1.4);
  await run(0.02);
  await shoot(page, 'm2-blast');
  const after = await snap(page);
  report.mobile.tapFired = after.field < before.field;
  report.mobile.afterBlast = after;

  await page.locator('.tool').filter({ hasText: '核弹' }).click();
  await page.touchscreen.tap(195, 430);
  await run(3.4);
  await run(0.02);
  await shoot(page, 'm3-nuke');
  report.mobile.afterNuke = await snap(page);
  report.mobile.layoutAfter = await layout(page);
  await ctx.close();
}

await browser.close();
report.problems = problems.filter((p) => !p.includes('404'));
report.logs = logs.slice(-40);
writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`\nproblems: ${report.problems.length}`);
for (const p of report.problems.slice(0, 30)) console.log(' - ' + p);
