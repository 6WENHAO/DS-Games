import { chromium } from "playwright-core";
import { CHROMIUM_ARGS, EXE } from "./frames.mjs";
const browser = await chromium.launch({ executablePath: EXE, args: CHROMIUM_ARGS });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(process.argv[2] ?? "http://127.0.0.1:5180/", { waitUntil: "load" });
await page.waitForFunction(() => Boolean(window.__sandbox));
const run = async (sec) => { let n = Math.round(sec*60); while (n>0){ const k=Math.min(60,n); await page.evaluate(kk=>window.__sandbox.step(kk,1/60,false),k); n-=k; } };
const st = () => page.evaluate(() => { const s = window.__sandbox.sandbox; return { water:+s.water.level.toFixed(2), panic:s.crowd.panicCount, peds:s.crowd.aliveCount, ragdoll:s.crowd.ragdollCount ?? -1 }; });

// ---- flood phases
await page.evaluate(() => { window.__sandbox.manager.reset(); window.__sandbox.sandbox.rebuild(); window.__sandbox.manager.select("flood"); window.__sandbox.manager.release({x:0,y:0,z:0}); });
for (const t of [0.5, 2, 4, 7]) { await run(t === 0.5 ? 0.5 : t - (t===2?0.5:t===4?2:4)); console.log("flood t="+t, JSON.stringify(await st())); }
await page.evaluate(() => window.__sandbox.manager.select("flood"));
for (const t of [2,5]) { await run(t===2?2:3); console.log("recede +"+t, JSON.stringify(await st())); }

// ---- slow motion effect on simulation
await page.evaluate(() => { window.__sandbox.manager.reset(); window.__sandbox.sandbox.rebuild(); window.__sandbox.engine.timeScale = 1; window.__sandbox.manager.select("blast"); window.__sandbox.manager.release({x:10,y:0,z:10}); });
await run(0.2);
const measure = () => page.evaluate(() => { const d = window.__sandbox.sandbox.debris; let sum=0; for (let i=0;i<d.count;i++) sum += Math.abs(d.vx[i])+Math.abs(d.vy[i])+Math.abs(d.vz[i]); return { count:d.count, speed:+(sum/Math.max(1,d.count)).toFixed(3) }; });
const before = await measure();
const posDelta = async (scale) => {
  await page.evaluate(s => { window.__sandbox.engine.timeScale = s; }, scale);
  const p0 = await page.evaluate(() => { const d = window.__sandbox.sandbox.debris; return [d.px[0], d.py[0], d.pz[0]]; });
  await page.evaluate(() => window.__sandbox.step(30, 1/60, false));
  const p1 = await page.evaluate(() => { const d = window.__sandbox.sandbox.debris; return [d.px[0], d.py[0], d.pz[0]]; });
  return +Math.hypot(p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]).toFixed(3);
};
const fast = await posDelta(1);
const slow = await posDelta(0.26);
console.log("debris", JSON.stringify(before), "move@1x", fast, "move@0.26x", slow, "ratio", +(fast/Math.max(0.0001,slow)).toFixed(2));

// ---- vehicles destroyed by a nuke
await page.evaluate(() => { window.__sandbox.engine.timeScale = 1; window.__sandbox.manager.reset(); window.__sandbox.sandbox.rebuild(); window.__sandbox.sandbox.power = 1.6; window.__sandbox.manager.select("nuke"); window.__sandbox.manager.release({x:0,y:0,z:0}); });
await run(6);
console.log("cars", await page.evaluate(() => { const t = window.__sandbox.sandbox.traffic; let loose=0; for (let i=0;i<t.count;i++) if (t.mode[i]===2) loose++; return { total:t.count, loose, wrecks:t.wreckCount ?? -1 }; }));
console.log("errors", errs);
await browser.close();
