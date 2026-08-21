/**
 * Performance + integrity probe (dev tool).
 *  - CPU cost of one simulation step (hardware independent; SwiftShader makes
 *    rendered fps meaningless here)
 *  - draw calls / triangles for one full frame
 *  - resize integrity: canvas buffer follows the viewport, no duplicated loops
 *
 * Usage: node tools/perf.mjs [url]
 */
import { chromium } from 'playwright-core';
import { CHROMIUM_ARGS, EXE } from './frames.mjs';

const URL = process.argv[2] ?? 'http://127.0.0.1:5180/';

const browser = await chromium.launch({ executablePath: EXE, args: CHROMIUM_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text());
});
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => Boolean(window.__sandbox));

const simCost = (frames) =>
  page.evaluate((n) => {
    const g = window.__sandbox;
    // warm up
    for (let i = 0; i < 10; i++) g.engine.frame(1 / 60, false);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) g.engine.frame(1 / 60, false);
    return +((performance.now() - t0) / n).toFixed(3);
  }, frames);

const drawInfo = () =>
  page.evaluate(() => {
    const g = window.__sandbox;
    const info = g.engine.renderer.info;
    info.autoReset = false;
    info.reset();
    g.engine.frame(1 / 60, true);
    const out = {
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs.length,
    };
    info.autoReset = true;
    return out;
  });

async function run(seconds) {
  const total = Math.round(seconds * 60);
  let done = 0;
  while (done < total) {
    const n = Math.min(60, total - done);
    await page.evaluate((k) => window.__sandbox.step(k, 1 / 60, false), n);
    done += n;
  }
}

const out = {};
out.simIdleMs = await simCost(240);
out.drawIdle = await drawInfo();

// worst case: max power nuke + storm + flood + quake all at once
await page.evaluate(() => {
  const g = window.__sandbox;
  g.sandbox.power = 2.2;
  g.manager.select('storm');
  g.manager.release({ x: 0, y: 0, z: 0 });
  g.manager.select('quake');
  g.manager.release({ x: 0, y: 0, z: 0 });
  g.manager.select('flood');
  g.manager.release({ x: 0, y: 0, z: 0 });
  g.manager.select('nuke');
  g.manager.release({ x: 10, y: 0, z: 10 });
});
await run(2.4);
out.simPeakMs = await simCost(120);
out.drawPeak = await drawInfo();
out.peakState = await page.evaluate(() => {
  const g = window.__sandbox;
  return {
    voxels: g.sandbox.field.count,
    debris: g.sandbox.debris.count,
    chunks: g.sandbox.chunks.count,
    particles: g.sandbox.particleCount,
    collapses: g.sandbox.city.collapses,
  };
});
await run(12);
out.simAfterMs = await simCost(120);

// ---- rebuild + resize integrity
await page.evaluate(() => {
  window.__sandbox.manager.reset();
  window.__sandbox.sandbox.rebuild();
});
await run(1);
out.afterRebuild = await page.evaluate(() => ({
  voxels: window.__sandbox.sandbox.field.count,
  total: window.__sandbox.sandbox.field.total,
  debris: window.__sandbox.sandbox.debris.count,
  particles: window.__sandbox.sandbox.particleCount,
  water: window.__sandbox.sandbox.water.level,
  storm: +window.__sandbox.sandbox.sky.storm.toFixed(2),
}));

const sizes = [
  [1024, 768],
  [1920, 1080],
  [390, 844],
  [1440, 900],
];
out.resize = [];
for (const [w, h] of sizes) {
  await page.setViewportSize({ width: w, height: h });
  // headless chromium withholds resize / ResizeObserver notifications while rAF
  // is throttled, so nudge the handler the way a real browser would
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  await run(0.2);
  out.resize.push(
    await page.evaluate(
      ([vw, vh]) => {
        const g = window.__sandbox;
        const c = g.engine.renderer.domElement;
        const dpr = g.engine.quality.pixelRatio;
        return {
          viewport: `${vw}x${vh}`,
          buffer: `${c.width}x${c.height}`,
          expected: `${Math.round(vw * dpr)}x${Math.round(vh * dpr)}`,
          fov: g.engine.camera.fov,
          aspectOk: Math.abs(g.engine.camera.aspect - vw / vh) < 0.01,
        };
      },
      [w, h],
    ),
  );
}
out.simAfterResize = await simCost(120);
out.errors = errors;

console.log(JSON.stringify(out, null, 2));
await browser.close();
