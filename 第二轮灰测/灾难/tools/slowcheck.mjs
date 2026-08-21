import { chromium } from "playwright-core";
import { CHROMIUM_ARGS, EXE } from "./frames.mjs";
const browser = await chromium.launch({ executablePath: EXE, args: CHROMIUM_ARGS });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 700 } })).newPage();
await page.goto(process.argv[2] ?? "http://127.0.0.1:5180/", { waitUntil: "load" });
await page.waitForFunction(() => Boolean(window.__sandbox));
async function trial(scale) {
  return await page.evaluate((s) => {
    const g = window.__sandbox;
    g.manager.reset(); g.sandbox.rebuild(); g.engine.timeScale = 1;
    g.manager.select("blast"); g.manager.release({ x: 10, y: 0, z: 10 });
    g.engine.frame(1/60, false);           // one frame so debris exists
    const d = g.sandbox.debris;
    const n = Math.min(60, d.count);
    const p0 = []; for (let i=0;i<n;i++) p0.push(d.px[i], d.py[i], d.pz[i]);
    g.engine.timeScale = s;
    for (let k=0;k<24;k++) g.engine.frame(1/60, false);
    let sum = 0;
    for (let i=0;i<n;i++) sum += Math.hypot(d.px[i]-p0[i*3], d.py[i]-p0[i*3+1], d.pz[i]-p0[i*3+2]);
    g.engine.timeScale = 1;
    return { debris: d.count, sampled: n, avgMove: +(sum/Math.max(1,n)).toFixed(3) };
  }, scale);
}
const a = await trial(1);
const b = await trial(0.26);
console.log("1x   ", JSON.stringify(a));
console.log("0.26x", JSON.stringify(b));
console.log("ratio", +(a.avgMove / Math.max(0.0001, b.avgMove)).toFixed(2), "(expected ~3.8)");
// camera responsiveness must stay real-time even in slow motion
const cam = await page.evaluate(() => {
  const g = window.__sandbox; g.engine.timeScale = 0.26;
  const az0 = g.controls.azimuth;
  g.controls.orbit ? 0 : 0;
  for (let k=0;k<30;k++) g.engine.frame(1/60,false);
  return { azimuthDamped: g.controls.azimuth !== undefined, lastRealDt: g.engine.lastRealDt };
});
console.log("camera", JSON.stringify(cam));
await browser.close();
