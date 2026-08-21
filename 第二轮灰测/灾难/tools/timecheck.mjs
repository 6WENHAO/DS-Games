import { chromium } from "playwright-core";
import { CHROMIUM_ARGS, EXE } from "./frames.mjs";
const browser = await chromium.launch({ executablePath: EXE, args: CHROMIUM_ARGS });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(process.argv[2] ?? "http://127.0.0.1:5180/", { waitUntil: "load" });
await page.waitForFunction(() => Boolean(window.__sandbox));
console.log(await page.evaluate(() => {
  const g = window.__sandbox;
  const t0 = performance.now(); g.sandbox.rebuild(); const rebuild = performance.now() - t0;
  const t1 = performance.now(); g.engine.frame(1/60, false); const sim = performance.now() - t1;
  const t2 = performance.now(); g.engine.frame(1/60, true); const render1 = performance.now() - t2;
  const t3 = performance.now(); g.engine.frame(1/60, true); const render2 = performance.now() - t3;
  return { rebuildMs:+rebuild.toFixed(1), simMs:+sim.toFixed(2), render1Ms:+render1.toFixed(1), render2Ms:+render2.toFixed(1),
           moduleCount: performance.getEntriesByType("resource").length,
           slowest: performance.getEntriesByType("resource").map(r=>({u:r.name.split("/").pop(), d:Math.round(r.duration)})).sort((a,b)=>b.d-a.d).slice(0,6) };
}));
await browser.close();
