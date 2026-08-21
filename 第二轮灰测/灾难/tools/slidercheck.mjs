import { chromium } from "playwright-core";
import { CHROMIUM_ARGS, EXE } from "./frames.mjs";
const browser = await chromium.launch({ executablePath: EXE, args: CHROMIUM_ARGS });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(process.argv[2] ?? "http://127.0.0.1:5180/", { waitUntil: "load" });
await page.waitForFunction(() => Boolean(window.__sandbox), null, { polling: 30 });
const read = () => page.evaluate(() => {
  const g = window.__sandbox;
  g.manager.select("blast");
  const r = { power:+g.sandbox.power.toFixed(2), blastR:+g.manager.reticleRadius().toFixed(1), label:document.getElementById("o-power").textContent, tilt:+g.engine.tilt.amount.toFixed(2), tiltLabel:document.getElementById("o-tilt").textContent };
  g.manager.cancel();
  return r;
});
for (const v of ["35","100","220"]) {
  await page.locator("#c-power").fill(v);
  await page.locator("#c-power").dispatchEvent("input");
  console.log("power slider", v, JSON.stringify(await read()));
}
for (const v of ["0","45","100"]) {
  await page.locator("#c-tilt").fill(v);
  await page.locator("#c-tilt").dispatchEvent("input");
  console.log("tilt slider ", v, JSON.stringify(await read()));
}
// damage radius really scales with power
for (const v of ["35","220"]) {
  await page.locator("#c-power").fill(v);
  await page.locator("#c-power").dispatchEvent("input");
  const lost = await page.evaluate(() => {
    const g = window.__sandbox;
    g.manager.reset(); g.sandbox.rebuild();
    const before = g.sandbox.field.count;
    g.manager.select("blast"); g.manager.release({x:10,y:0,z:10});
    for (let i=0;i<90;i++) g.engine.frame(1/60,false);
    return before - g.sandbox.field.count;
  });
  console.log("power", v, "-> voxels destroyed", lost);
}
await browser.close();
