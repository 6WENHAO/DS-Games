/**
 * 把 PNG 转成 ASCII 亮度图 + 主色统计（用浏览器的 2D canvas 解码，不依赖 readPixels）。
 * 用法: node tools/png2ascii.mjs shots/01-sandbox-dusk.png [宽 高]
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const files = process.argv.slice(2).filter((a) => a.endsWith('.png'));
const nums = process.argv.slice(2).filter((a) => !a.endsWith('.png')).map(Number);
const GW = nums[0] || 100, GH = nums[1] || 40;
const RAMP = ' .:-=+*oO8@';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto('data:text/html,<body></body>');
  for (const f of files) {
    const buf = fs.readFileSync(f);
    const b64 = buf.toString('base64');
    const res = await page.evaluate(async ({ b64, GW, GH }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = GW; cv.height = GH;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, GW, GH);
      const d = ctx.getImageData(0, 0, GW, GH).data;
      const cells = [];
      for (let y = 0; y < GH; y++) {
        const row = [];
        for (let x = 0; x < GW; x++) {
          const i = (y * GW + x) * 4;
          row.push([d[i], d[i + 1], d[i + 2]]);
        }
        cells.push(row);
      }
      // 全分辨率直方图（判断反差是否成立，而不是被降采样平均掉）
      const fv = document.createElement('canvas');
      fv.width = img.naturalWidth; fv.height = img.naturalHeight;
      const fx = fv.getContext('2d');
      fx.drawImage(img, 0, 0);
      const fd = fx.getImageData(0, 0, fv.width, fv.height).data;
      const hist = new Array(16).fill(0);
      let n = 0, sum = 0;
      for (let i = 0; i < fd.length; i += 4) {
        const l = 0.2126 * fd[i] + 0.7152 * fd[i + 1] + 0.0722 * fd[i + 2];
        hist[Math.min(15, Math.floor(l / 16))]++;
        sum += l; n++;
      }
      return { cells, w: img.naturalWidth, h: img.naturalHeight, hist, n, fullMean: sum / n };
    }, { b64, GW, GH });

    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    let mn = 1e9, mx = -1e9, sum = 0, n = 0;
    for (const r of res.cells) for (const c of r) { const l = lum(c); mn = Math.min(mn, l); mx = Math.max(mx, l); sum += l; n++; }
    const span = Math.max(1, mx - mn);
    console.log(`\n${'='.repeat(GW + 2)}\n### ${path.basename(f)}  ${res.w}x${res.h}  mean=${(sum / n).toFixed(1)} min=${mn.toFixed(0)} max=${mx.toFixed(0)}`);
    console.log(`[全分辨率直方图] 均值=${res.fullMean.toFixed(1)}`);
    const maxH = Math.max(...res.hist);
    for (let i = 0; i < 16; i++) {
      const pct = (res.hist[i] / res.n) * 100;
      console.log(`  ${String(i * 16).padStart(3)}-${String(i * 16 + 15).padStart(3)} ${'#'.repeat(Math.round((res.hist[i] / maxH) * 44)).padEnd(44)} ${pct.toFixed(1)}%`);
    }
    console.log('[绝对亮度]');
    for (const r of res.cells) {
      console.log(r.map((c) => RAMP[Math.min(10, Math.floor((lum(c) / 255) ** 0.75 * 11))]).join(''));
    }
    console.log('[归一化 · 拉满对比]');
    for (const r of res.cells) {
      console.log(r.map((c) => RAMP[Math.min(10, Math.floor(((lum(c) - mn) / span) * 11))]).join(''));
    }
  }
} finally { await browser.close(); }
