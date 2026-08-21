import { chromium } from "playwright-core";
import { CHROMIUM_ARGS, EXE } from "./frames.mjs";
const browser = await chromium.launch({ executablePath: EXE, args: CHROMIUM_ARGS });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 800 } })).newPage();
const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(process.argv[2] ?? "http://127.0.0.1:5180/", { waitUntil: "load" });
await page.waitForFunction(() => Boolean(window.__sandbox));
const run = async (sec) => { let n = Math.round(sec*60); while (n>0){ const k=Math.min(60,n); await page.evaluate(kk=>window.__sandbox.step(kk,1/60,false),k); n-=k; } };
const centre = (id) => page.evaluate((i) => {
  const s = window.__sandbox.sandbox;
  if (i === "tornado") return { x: +s.fields.vortices[0].x.toFixed(2), z: +s.fields.vortices[0].z.toFixed(2), active: s.fields.vortices[0].active };
  if (i === "blackhole") return { x: +s.fields.wells[0].x.toFixed(2), z: +s.fields.wells[0].z.toFixed(2), active: s.fields.wells[0].active };
  const impl = window.__sandbox.manager.impl.get(i);
  return { x: +impl.x.toFixed(2), z: +impl.z.toFixed(2), storm: +s.sky.storm.toFixed(2) };
}, id);

for (const id of ["tornado","blackhole","storm"]) {
  await page.evaluate(() => { window.__sandbox.manager.reset(); window.__sandbox.sandbox.rebuild(); });
  await run(0.3);
  await page.evaluate((i) => { window.__sandbox.manager.select(i); window.__sandbox.manager.release({x:-20,y:0,z:-20}); }, id);
  await run(0.5);
  const before = await centre(id);
  
  await page.keyboard.down("KeyD");
  await run(1.6);
  const midKeys = await page.evaluate(() => { const v = new (window.__sandbox.THREE?.Vector2 ?? Object)(); return window.__sandbox.controls.steerVector({x:0,y:0,set(a,b){this.x=a;this.y=b;return this;},lengthSq(){return this.x*this.x+this.y*this.y;},normalize(){const l=Math.hypot(this.x,this.y)||1;this.x/=l;this.y/=l;return this;}}); });
  await page.keyboard.up("KeyD");
  const after = await centre(id);
  console.log(id, "before", JSON.stringify(before), "after", JSON.stringify(after), "steerVec", JSON.stringify(midKeys), "running", await page.evaluate(i=>window.__sandbox.manager.isRunning(i), id));
  await page.evaluate(i => window.__sandbox.manager.select(i), id);
  await run(1);
  console.log("  stopped ->", await page.evaluate(i=>window.__sandbox.manager.isRunning(i), id), JSON.stringify(await centre(id)));
}
console.log("errors", errs);
await browser.close();
