import { chromium } from "playwright-core";
import { CHROMIUM_ARGS, EXE } from "./frames.mjs";
const browser = await chromium.launch({ executablePath: EXE, args: CHROMIUM_ARGS });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
await page.goto(process.argv[2] ?? "http://127.0.0.1:5180/", { waitUntil: "load" });
await page.waitForFunction(() => Boolean(window.__sandbox));
const probe = () => page.evaluate(() => {
  const c = window.__sandbox.engine.renderer.domElement;
  const dpr = window.__sandbox.engine.quality.pixelRatio;
  return { inner: `${window.innerWidth}x${window.innerHeight}`,
           buffer: `${c.width}x${c.height}`,
           expect: `${Math.round(window.innerWidth*dpr)}x${Math.round(window.innerHeight*dpr)}`,
           aspectOk: Math.abs(window.__sandbox.engine.camera.aspect - window.innerWidth/window.innerHeight) < 0.01,
           fov: window.__sandbox.engine.camera.fov,
           toolbarTop: Math.round(document.getElementById("toolbar").getBoundingClientRect().top),
           hudFits: (() => { const ids=["brand","stats","hintline","toolbar"]; for (const id of ids){ const r=document.getElementById(id).getBoundingClientRect(); if (r.left<-1||r.top<-1||r.right>window.innerWidth+1||r.bottom>window.innerHeight+1) return id+" overflows"; } return "ok"; })() };
});
// headless chromium does not deliver resize / ResizeObserver notifications while
// rAF is throttled, so nudge the handler the way a real browser would.
const sizes = [[1024,768],[1920,1080],[1280,720],[390,844],[430,932],[820,1180],[1440,900]];
for (const [w,h] of sizes) {
  await page.setViewportSize({ width: w, height: h });
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await page.evaluate(() => window.__sandbox.step(2, 1/60, false));
  console.log(String(w).padStart(4)+"x"+String(h).padEnd(5), JSON.stringify(await probe()));
}
console.log("errors", errs);
await browser.close();
