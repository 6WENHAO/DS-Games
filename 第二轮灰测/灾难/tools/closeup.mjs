/**
 * Close-up captures (dev tool): drives the camera in tight so building colour,
 * window detail, debris and explosion cores can be inspected.
 *
 * Usage: node tools/closeup.mjs [url]
 */
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHROMIUM_ARGS, EXE } from './frames.mjs';

const URL = process.argv[2] ?? 'http://127.0.0.1:5180/';
const OUT = resolve('shots');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXE, args: CHROMIUM_ARGS });
const ctx = await browser.newContext({ viewport: { width: 900, height: 600 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => Boolean(window.__sandbox));

async function run(seconds) {
  const total = Math.round(seconds * 60);
  let done = 0;
  while (done < total) {
    const n = Math.min(60, total - done);
    await page.evaluate((k) => window.__sandbox.step(k, 1 / 60, false), n);
    done += n;
  }
}

async function shoot(file) {
  const url = await page.evaluate(() => window.__sandbox.capture());
  writeFileSync(resolve(OUT, file + '.png'), Buffer.from(url.slice(22), 'base64'));
}

async function camera(dist, el, az, tx, tz) {
  await page.evaluate(
    ([d, e, a, x, z]) => {
      const c = window.__sandbox.controls;
      c.distance = d;
      c.elevation = e;
      c.azimuth = a;
      c.gDist = d;
      c.gEl = e;
      c.gAz = a;
      c.target.set(x, 3, z);
      c.gTarget.set(x, 3, z);
    },
    [dist, el, az, tx, tz],
  );
  await run(0.2);
}

const target = await page.evaluate(() => {
  const g = window.__sandbox;
  let best = g.sandbox.city.states[0];
  for (const s of g.sandbox.city.states) {
    if (Math.hypot(s.cx, s.cz) > 40) continue;
    if (s.levels > best.levels) best = s;
  }
  return { x: best.cx, z: best.cz };
});

// 1) street-level detail of an intact block
await camera(70, 0.42, 0.8, target.x, target.z);
await shoot('e1-closeup-intact');

// 2) explosion core, very early
await page.evaluate(
  ([x, z]) => {
    const g = window.__sandbox;
    g.sandbox.power = 1;
    g.manager.select('blast');
    g.manager.release({ x: x - 6, y: 0, z: z - 6 });
  },
  [target.x, target.z],
);
await run(0.07);
await shoot('e2-blast-core');
await run(0.9);
await shoot('e3-blast-debris');
await run(3);
await shoot('e4-blast-after');

// 3) tornado close-up
await page.evaluate(() => {
  window.__sandbox.manager.reset();
  window.__sandbox.sandbox.rebuild();
});
await run(0.3);
await page.evaluate(
  ([x, z]) => {
    const g = window.__sandbox;
    g.manager.select('tornado');
    g.manager.release({ x, y: 0, z });
  },
  [target.x, target.z],
);
await run(3.2);
await camera(120, 0.34, 0.8, target.x, target.z);
await shoot('e5-tornado');
await page.evaluate(() => window.__sandbox.manager.select('tornado'));

// 4) black hole close-up
await page.evaluate(() => {
  window.__sandbox.manager.reset();
  window.__sandbox.sandbox.rebuild();
});
await run(0.3);
await page.evaluate(
  ([x, z]) => {
    const g = window.__sandbox;
    g.manager.select('blackhole');
    g.manager.release({ x, y: 0, z });
  },
  [target.x, target.z],
);
await run(3.5);
await shoot('e6-blackhole');
await page.evaluate(() => window.__sandbox.manager.select('blackhole'));
await run(0.4);
await shoot('e7-blackhole-collapse');

// 5) flood close-up
await page.evaluate(() => {
  window.__sandbox.manager.reset();
  window.__sandbox.sandbox.rebuild();
});
await run(0.3);
await page.evaluate(() => {
  const g = window.__sandbox;
  g.manager.select('flood');
  g.manager.release({ x: 0, y: 0, z: 0 });
});
await run(7);
await camera(150, 0.3, 0.8, 0, 0);
await shoot('e8-flood');

// 6) mid-topple silhouette
await page.evaluate(() => {
  window.__sandbox.manager.reset();
  window.__sandbox.sandbox.rebuild();
});
await run(0.3);
await camera(110, 0.4, 0.8, target.x, target.z);
await page.evaluate(
  ([x, z]) => {
    const g = window.__sandbox;
    g.manager.select('blast');
    g.manager.release({ x, y: 0, z });
  },
  [target.x, target.z],
);
await run(0.55);
await shoot('e9-topple');

console.log('closeups written');
await browser.close();
