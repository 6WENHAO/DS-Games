/* shots/snow_shots.js - 积雪优化前后对比截图
 * 用法: node shots/snow_shots.js before | after */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const SEED = 20260718;
const TAG = process.argv[2] || 'before';
const DIR = path.join(__dirname, 'snow');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR);

/* 每个场景 = 一次页面加载（x,z 出生点 + vd），页内多机位 */
const SCENES = [
  {
    name: 'snowmt', x: -2304, z: -2352, vd: 1024,
    views: [
      { name: 'aerial', dx: 0, dz: 0, dy: 95, yaw: 0, pitch: -1.35 },           // 顶拍：积雪分布
      { name: 'side', dx: -170, dz: 120, dy: 60, look: true, aim: 25 },         // 侧看山坡/岩壁
      { name: 'far', dx: 320, dz: 260, dy: 180, look: true, aim: 40 },          // 跨 L1/L2 环：近/远景衔接
    ]
  },
  {
    name: 'snowline', x: 192, z: 1008, vd: 640,
    views: [
      { name: 'aerial', dx: 0, dz: 0, dy: 110, yaw: 0, pitch: -1.35 },          // 雪线过渡带俯拍
      { name: 'oblique', dx: -150, dz: -110, dy: 55, look: true, aim: 0 },      // 斜看过渡
      { name: 'forest', ax: 114, az: 983, dx: -30, dz: 26, dy: 16, look: true, aim: 8 }, // 雪线附近树木
    ]
  },
  {
    name: 'highsnow', x: -6176, z: -4448, vd: 640,
    views: [
      { name: 'aerial', dx: 0, dz: 0, dy: 120, yaw: 0, pitch: -1.35 },          // 冰面湖俯拍
      { name: 'oblique', dx: -160, dz: 130, dy: 40, look: true, aim: 0 },       // 雪原边坡
    ]
  },
  {
    name: 'peak', x: 8032, z: -2144, vd: 1536,
    views: [
      { name: 'aerial', dx: 0, dz: 0, dy: 150, yaw: 0, pitch: -1.35 },          // 峰顶俯拍：陡壁露岩
      { name: 'cliff', dx: -240, dz: 170, dy: -40, look: true, aim: 0 },        // 仰看雪冠陡壁
      { name: 'far', dx: 550, dz: -330, dy: 120, look: true, aim: 0 },          // 远观整座高雪山
    ]
  },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* 像素统计：把截图回灌页面解码，按色系分类计数（本模型不看图，以数字为准） */
async function pixelStats(page, buf) {
  const b64 = buf.toString('base64');
  return page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0);
    function stat(x0, y0, x1, y1) {
      const d = cx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      const n = d.length / 4;
      const c = { fog: 0, white: 0, ice: 0, gray: 0, brown: 0, green: 0, pink: 0, dark: 0, blue: 0, other: 0 };
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), br = (r + g + b) / 3;
        if (Math.abs(r - 194) + Math.abs(g - 216) + Math.abs(b - 238) < 26) c.fog++;   // 雾/天空 0xc2d8ee
        else if (mn > 185 && mx - mn < 40) c.white++;
        else if (b > 170 && b - r > 25 && g > 150) c.ice++;
        else if (b - r > 40 && b > 140) c.blue++;
        else if (g - Math.max(r, b) > 10) c.green++;
        else if (r > 180 && b > 150 && r - g > 25) c.pink++;
        else if (br < 70) c.dark++;
        else if (mx - mn < 30 && br <= 200) c.gray++;
        else if (r - b >= 15 && r > 85) c.brown++;
        else c.other++;
      }
      const o = {};
      for (const k in c) { const v = Math.round(c[k] / n * 1000) / 10; if (v >= 0.5) o[k] = v; }
      return o;
    }
    const w = cv.width, h = cv.height;
    return {
      full: stat(0, 0, w, h),
      top: stat(0, 0, w, h >> 1),
      bot: stat(0, h >> 1, w, h),
      ctr: stat(w >> 2, h >> 2, w - (w >> 2), h - (h >> 2)),
    };
  }, b64);
}

(async () => {
  console.log('=== 积雪对比截图 [' + TAG + '] ===');
  const errsAll = [];
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist',
      '--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader']
  });
  try {
    for (const sc of SCENES) {
      const page = await browser.newPage();
      const errs = [];
      page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      page.on('pageerror', e => errs.push(e.message));
      const url = 'file:///' + path.resolve('index.html').replace(/\\/g, '/') +
        `?shot=1&seed=${SEED}&vd=${sc.vd}&near=5&x=${sc.x}&z=${sc.z}`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
      await page.setViewport({ width: 1280, height: 720 });
      let ok = false;
      for (let i = 0; i < 240; i++) {
        if (await page.evaluate(() => window.__ready === true)) { ok = true; break; }
        await sleep(500);
      }
      if (!ok) { console.log('[TIMEOUT ready]', sc.name); }

      for (const v of sc.views) {
        await page.evaluate((sc, v) => {
          const tx = v.ax !== undefined ? v.ax : sc.x, tz = v.az !== undefined ? v.az : sc.z;
          const th = G.column(Math.floor(tx), Math.floor(tz)).h + G.Y0;
          const ex = tx + (v.dx || 0), ez = tz + (v.dz || 0);
          const eh = G.column(Math.floor(ex), Math.floor(ez)).h + G.Y0;
          let ey = th + (v.dy || 0);
          if (ey < eh + 3) ey = eh + 3;                       // 不落入地下
          let yaw = v.yaw || 0;
          if (v.look) yaw = Math.atan2(-(tx - ex), -(tz - ez));
          let pitch = v.pitch;
          if (pitch === undefined && v.look) {   // 自动瞄准目标高度
            const dxz = Math.hypot(tx - ex, tz - ez) || 1;
            pitch = Math.atan2((th + (v.aim || 0) + 2) - ey, dxz);
          }
          Player.pos.set(ex, ey, ez);
          Player.setView(yaw, pitch || 0);
        }, sc, v);
        // 等待落区块+LOD 空队列
        for (let i = 0; i < 160; i++) {
          const idle = await page.evaluate(() => World.queuesEmpty());
          if (idle && i > 6) break;
          await sleep(400);
        }
        await sleep(900);
        const f = path.join(DIR, `${TAG}_${sc.name}_${v.name}.png`);
        const buf = await page.screenshot({ path: f });
        const st = await pixelStats(page, buf);
        console.log('[OK]', path.basename(f));
        console.log('   full:', JSON.stringify(st.full));
        console.log('   top :', JSON.stringify(st.top));
        console.log('   bot :', JSON.stringify(st.bot));
        console.log('   ctr :', JSON.stringify(st.ctr));
      }
      if (errs.length) { console.log('[JS ERRORS]', sc.name, errs.slice(0, 5)); errsAll.push(...errs); }
      await page.close();
    }
  } catch (e) {
    console.error('FATAL:', e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
  console.log('JS errors total:', errsAll.length);
  process.exit(errsAll.length ? 1 : 0);
})();
