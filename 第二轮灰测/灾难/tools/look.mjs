/**
 * PNG -> text inspector (dev tool). Renders each screenshot as an ASCII
 * luminance map plus a coarse hex colour grid and sharpness-per-band metrics,
 * so rendering problems can be diagnosed without an image viewer.
 *
 * Usage: node tools/look.mjs shots/01-city-1440x900.png [more.png ...]
 */
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const EXE =
  process.env.CHROMIUM_PATH ??
  `${process.env.LOCALAPPDATA}\\ms-playwright\\chromium-1234\\chrome-win64\\chrome.exe`;

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node tools/look.mjs <png> [...]');
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage();
await page.setContent('<body></body>');

for (const f of files) {
  const b64 = readFileSync(f).toString('base64');
  const res = await page.evaluate(async (dataB64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + dataB64;
    await img.decode();
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H).data;
    const lum = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];

    // ---- ascii luminance map
    const AW = 64;
    const AH = 30;
    const chars = ' .:-=+*#%@';
    let ascii = '';
    const grid = [];
    for (let ay = 0; ay < AH; ay++) {
      let line = '';
      for (let ax = 0; ax < AW; ax++) {
        const x0 = Math.floor((ax * W) / AW);
        const x1 = Math.floor(((ax + 1) * W) / AW);
        const y0 = Math.floor((ay * H) / AH);
        const y1 = Math.floor(((ay + 1) * H) / AH);
        let s = 0;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let y = y0; y < y1; y += 2)
          for (let x = x0; x < x1; x += 2) {
            const i = (y * W + x) * 4;
            s += lum(i);
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            n++;
          }
        const L = s / Math.max(1, n) / 255;
        line += chars[Math.min(chars.length - 1, Math.floor(L * chars.length))];
        grid.push({
          ax,
          ay,
          r: Math.round(r / n),
          g: Math.round(g / n),
          b: Math.round(b / n),
        });
      }
      ascii += line + '\n';
    }

    // ---- global stats
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sat = 0;
    let count = 0;
    let dark = 0;
    let bright = 0;
    for (let y = 0; y < H; y += 3)
      for (let x = 0; x < W; x += 3) {
        const i = (y * W + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        sumR += r;
        sumG += g;
        sumB += b;
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        sat += mx === 0 ? 0 : (mx - mn) / mx;
        const L = lum(i);
        if (L < 28) dark++;
        if (L > 235) bright++;
        count++;
      }

    // ---- sharpness per horizontal band (gradient energy), for tilt-shift check
    const bands = 6;
    const sharp = [];
    for (let bi = 0; bi < bands; bi++) {
      const y0 = Math.floor((bi * H) / bands) + 1;
      const y1 = Math.floor(((bi + 1) * H) / bands) - 1;
      let e = 0;
      let n = 0;
      for (let y = y0; y < y1; y += 2)
        for (let x = 1; x < W - 1; x += 2) {
          const i = (y * W + x) * 4;
          const l = lum(i);
          e += Math.abs(l - lum(i + 4)) + Math.abs(l - lum(i + W * 4));
          n++;
        }
      sharp.push(+(e / Math.max(1, n)).toFixed(2));
    }

    // ---- coarse colour grid (16 x 9)
    const CW = 16;
    const CH = 9;
    const colours = [];
    for (let cy = 0; cy < CH; cy++) {
      const row = [];
      for (let cx = 0; cx < CW; cx++) {
        const x0 = Math.floor((cx * W) / CW);
        const x1 = Math.floor(((cx + 1) * W) / CW);
        const y0 = Math.floor((cy * H) / CH);
        const y1 = Math.floor(((cy + 1) * H) / CH);
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (let y = y0; y < y1; y += 3)
          for (let x = x0; x < x1; x += 3) {
            const i = (y * W + x) * 4;
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            n++;
          }
        row.push(
          '#' +
            [r / n, g / n, b / n]
              .map((v) => Math.round(v).toString(16).padStart(2, '0'))
              .join(''),
        );
      }
      colours.push(row.join(' '));
    }

    // ---- hue histogram of vivid pixels: proves the toy palette is on screen
    const hueBins = new Array(12).fill(0);
    let vivid = 0;
    for (let y = 0; y < H; y += 2)
      for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4;
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        const mx = Math.max(r, g, b);
        const mn = Math.min(r, g, b);
        const s = mx === 0 ? 0 : (mx - mn) / mx;
        if (s < 0.3 || mx < 0.25) continue;
        vivid++;
        let h;
        const d2 = mx - mn;
        if (mx === r) h = ((g - b) / d2 + 6) % 6;
        else if (mx === g) h = (b - r) / d2 + 2;
        else h = (r - g) / d2 + 4;
        hueBins[Math.min(11, Math.floor((h * 60) / 30))]++;
      }

    return {
      W,
      H,
      ascii,
      mean: [sumR / count, sumG / count, sumB / count].map((v) => Math.round(v)),
      saturation: +(sat / count).toFixed(3),
      darkPct: +((dark / count) * 100).toFixed(1),
      clippedPct: +((bright / count) * 100).toFixed(1),
      sharpnessBands: sharp,
      colours,
      gridSample: grid.length,
      vividPct: +((vivid / (count / 2.25)) * 100).toFixed(1),
      hueBins,
    };
  }, b64);

  console.log('='.repeat(78));
  console.log(`${basename(f)}  ${res.W}x${res.H}`);
  console.log(
    `mean rgb=${res.mean.join(',')}  saturation=${res.saturation}  dark%=${res.darkPct}  clipped%=${res.clippedPct}`,
  );
  console.log(`sharpness by band (top→bottom): ${res.sharpnessBands.join('  ')}`);
  const HUES = ['red', 'orange', 'yellow', 'y-grn', 'green', 'sprg', 'cyan', 'azure', 'blue', 'violet', 'mgnta', 'rose'];
  console.log(
    `vivid pixels: ${res.vividPct}%  hues: ` +
      res.hueBins
        .map((v, i) => `${HUES[i]}=${((v / Math.max(1, res.hueBins.reduce((a, b) => a + b, 0))) * 100).toFixed(0)}%`)
        .join(' '),
  );
  console.log('-'.repeat(78));
  console.log(res.ascii);
  console.log('colour grid (16x9):');
  for (const row of res.colours) console.log('  ' + row);
}

await browser.close();
