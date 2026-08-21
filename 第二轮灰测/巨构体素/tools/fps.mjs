// 帧率对照：MSAA 采样数 / 渲染倍率
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11'] });
try {
  for (const q of process.argv.slice(2)) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.goto('http://127.0.0.1:5178/?' + q, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#boot')?.classList.contains('gone'), null, { timeout: 240000 });
    await page.waitForTimeout(2500);
    const out = [];
    for (const vp of ['orbit', 'orbit-low', 'plaza']) {
      await page.evaluate((id) => document.querySelector(`#vpList button[data-vp="${id}"]`).click(), vp);
      await page.waitForTimeout(1200);
      const fps = await page.evaluate(async () => {
        const t0 = performance.now(); let n = 0;
        await new Promise((r) => { const t = () => { n++; if (performance.now() - t0 > 2600) r(); else requestAnimationFrame(t); }; requestAnimationFrame(t); });
        return (n / ((performance.now() - t0) / 1000));
      });
      out.push(`${vp}=${fps.toFixed(1)}`);
    }
    const samples = await page.evaluate(() => window.__ds.composer.renderTarget1.samples);
    console.log(`?${q || '(默认)'}  samples=${samples}  ${out.join('  ')}`);
    await page.close();
  }
} finally { await browser.close(); }
