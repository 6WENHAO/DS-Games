import { chromium } from "playwright-core";
import { CHROMIUM_ARGS, EXE } from "./frames.mjs";
const browser = await chromium.launch({ executablePath: EXE, args: CHROMIUM_ARGS });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(process.argv[2] ?? "http://127.0.0.1:5180/", { waitUntil: "load" });
await page.waitForFunction(() => Boolean(window.__sandbox), null, { polling: 30 });
console.log(await page.evaluate(() => ({
  tools: [...document.querySelectorAll("#tools .tool")].map(b => b.textContent.trim().replace(/\s+/g," ")),
  controls: [...document.querySelectorAll("#controls > *")].map(b => (b.id || b.className) + ":" + b.textContent.trim().replace(/\s+/g," ").slice(0,22)),
  stats: document.getElementById("stats").textContent.replace(/\s+/g," ").trim(),
  hint: document.getElementById("hint").textContent.trim(),
  sliders: [...document.querySelectorAll("input[type=range]")].map(s => ({ id:s.id, min:s.min, max:s.max, value:s.value })),
})));
// select each tool through the DOM and confirm hint + reticle radius change
for (const label of ["定点爆破","陨石","落雷","龙卷风","黑洞","核弹","地震","洪水","雷暴"]) {
  const r = await page.evaluate((lbl) => {
    const btn = [...document.querySelectorAll("#tools .tool")].find(b => b.textContent.includes(lbl));
    btn.click();
    const g = window.__sandbox;
    return { armed: g.manager.armed, hint: document.getElementById("hint").textContent.trim(), radius: +g.manager.reticleRadius().toFixed(1), active: btn.classList.contains("active") || btn.classList.contains("running") };
  }, label);
  console.log(label.padEnd(5), JSON.stringify(r));
  await page.keyboard.press("Escape");
}
console.log("after Esc armed =", await page.evaluate(() => window.__sandbox.manager.armed));
await browser.close();
