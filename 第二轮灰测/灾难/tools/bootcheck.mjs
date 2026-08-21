import { chromium } from "playwright-core";
import { CHROMIUM_ARGS, EXE } from "./frames.mjs";
const browser = await chromium.launch({ executablePath: EXE, args: CHROMIUM_ARGS });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const t0 = Date.now();
await page.goto(process.argv[2] ?? "http://127.0.0.1:5180/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => Boolean(window.__sandbox), null, { polling: 30 });
const ready = Date.now() - t0;
const marks = await page.evaluate(() => {
  const n = performance.getEntriesByType("navigation")[0];
  return { domContentLoaded: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) || null,
           voxels: window.__sandbox.sandbox.voxelCount, peds: window.__sandbox.sandbox.crowd.aliveCount,
           cars: window.__sandbox.sandbox.traffic.count };
});
console.log("dev-server first interactive:", ready, "ms", JSON.stringify(marks));
await browser.close();
