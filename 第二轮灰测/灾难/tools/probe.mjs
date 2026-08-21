/**
 * Direct disaster probe (dev tool). Drives deterministic frames through the
 * debug handle (headless Chromium throttles rAF to ~1 fps) and reports exactly
 * what each disaster changed in the world.
 *
 * Usage: node tools/probe.mjs [url]
 */
import { chromium } from 'playwright-core';
import { CHROMIUM_ARGS, EXE } from './frames.mjs';

const URL = process.argv[2] ?? 'http://127.0.0.1:5180/';

const browser = await chromium.launch({ executablePath: EXE, args: CHROMIUM_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + (e.stack ?? '')));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push('console.error: ' + m.text());
});
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => Boolean(window.__sandbox));

/** Run `seconds` of simulation at a fixed 60 Hz step (no rendering: SwiftShader
 *  is far too slow to render every probe frame). */
async function run(seconds, render = false) {
  const total = Math.round(seconds * 60);
  let done = 0;
  while (done < total) {
    const n = Math.min(60, total - done);
    await page.evaluate(([k, r]) => window.__sandbox.step(k, 1 / 60, r), [n, render]);
    done += n;
  }
}

const target = await page.evaluate(() => {
  const g = window.__sandbox;
  let best = g.sandbox.city.states[0];
  for (const s of g.sandbox.city.states) {
    if (Math.hypot(s.cx, s.cz) > 45) continue;
    if (s.levels > best.levels) best = s;
  }
  return { x: best.cx, z: best.cz, levels: best.levels, total: best.total };
});
console.log('target building:', target);

const snap = () =>
  page.evaluate(() => {
    const g = window.__sandbox;
    return {
      vox: g.sandbox.field.count,
      deb: g.sandbox.debris.count,
      chunk: g.sandbox.chunks.count,
      part: g.sandbox.particleCount,
      collapses: g.sandbox.city.collapses,
      water: +g.sandbox.water.level.toFixed(2),
      storm: +g.sandbox.sky.storm.toFixed(2),
      peds: g.sandbox.crowd.aliveCount,
      groups: g.sandbox.chunks.activeGroups,
      cars: g.sandbox.traffic.count,
      quake: +g.sandbox.stress.toFixed(2),
      decals: g.sandbox.decals.group.children.filter((c) => c.visible).length,
    };
  });

const tests = [
  ['blast', 3],
  ['meteor', 5],
  ['lightning', 3],
  ['tornado', 8],
  ['blackhole', 13],
  ['nuke', 12],
  ['quake', 12],
  ['flood', 10],
  ['storm', 8],
];

const rows = [];
for (const [id, seconds] of tests) {
  await page.evaluate(() => {
    window.__sandbox.manager.reset();
    window.__sandbox.sandbox.rebuild();
  });
  await run(0.5);
  const before = await snap();
  const fire = await page.evaluate(
    ([tid, tx, tz]) => {
      const g = window.__sandbox;
      g.manager.select(tid);
      const armed = g.manager.armed;
      const fired = g.manager.release({ x: tx, y: 0, z: tz });
      return { armed, fired };
    },
    [id, target.x, target.z],
  );
  await run(seconds);
  const after = await snap();
  const running = await page.evaluate((tid) => window.__sandbox.manager.isRunning(tid), id);
  const hint = await page.evaluate(() => window.__sandbox.manager.hint());
  rows.push({
    id,
    fired: fire.fired,
    run: running,
    voxLost: before.vox - after.vox,
    deb: after.deb,
    chunk: after.chunk,
    part: after.part,
    coll: after.collapses,
    water: after.water,
    storm: after.storm,
    quake: after.quake,
    decals: after.decals,
    pedsLost: before.peds - after.peds,
  });
  console.log(`${id}: ${hint}`);
  if (running) {
    await page.evaluate((tid) => window.__sandbox.manager.select(tid), id);
    await run(3);
    const stopped = await snap();
    rows[rows.length - 1].afterStopWater = stopped.water;
    rows[rows.length - 1].afterStopStorm = stopped.storm;
    rows[rows.length - 1].afterStopQuake = stopped.quake;
  }
}

// ---- rebuild integrity + pool caps
await page.evaluate(() => {
  window.__sandbox.manager.reset();
  window.__sandbox.sandbox.rebuild();
});
await run(1);
const rebuilt = await snap();

// hammer it: 25 max-power blasts everywhere
await page.evaluate(() => {
  const g = window.__sandbox;
  g.sandbox.power = 2.2;
  g.manager.select('nuke');
});
await page.evaluate(() => window.__sandbox.manager.release({ x: 0, y: 0, z: 0 }));
await run(14);
const afterNuke = await snap();
await page.evaluate(() => {
  const g = window.__sandbox;
  g.manager.select('blast');
  for (let i = 0; i < 25; i++)
    g.manager.release({ x: -60 + (i % 5) * 30, y: 0, z: -60 + Math.floor(i / 5) * 30 });
});
await run(6);
const stress = await snap();
await run(25);
const settled = await snap();
const caps = await page.evaluate(() => {
  const q = window.__sandbox.engine.quality;
  return {
    debrisCap: q.debrisCap,
    chunkCap: q.chunkCap,
    sparkCap: q.sparkCap,
    smokeCap: q.smokeCap,
    tier: q.tier,
    programs: window.__sandbox.engine.renderer.info.programs.length,
    geometries: window.__sandbox.engine.renderer.info.memory.geometries,
    textures: window.__sandbox.engine.renderer.info.memory.textures,
  };
});

console.table(rows);
console.log('rebuilt   :', rebuilt);
console.log('afterNuke :', afterNuke);
console.log('stress    :', stress);
console.log('settled   :', settled);
console.log('caps      :', caps);
console.log('\nerrors:', errors.length);
for (const e of errors.slice(0, 10)) console.log(e);
await browser.close();
