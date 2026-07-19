/* shots/trees_shots.js - 树生成优化+新树种截图（近景/远景/巨树跨区块）
 * 用法: node shots/trees_shots.js <tag> */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const SEED = 20260718;
const TAG = process.argv[2] || 'after';
const DIR = path.join(__dirname, 'trees');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR);

const SCENES = [
  {
    name: 'birchwood', x: -555, z: 45, vd: 640,   // 白桦纯林片
    views: [
      { name: 'near', dx: -36, dz: 26, dy: 10, look: true, aim: 8 },
      { name: 'aerial', dx: 0, dz: 0, dy: 85, yaw: 0, pitch: -1.35 },
    ]
  },
  {
    name: 'maplewood', x: 345, z: -405, vd: 640,  // 枫树纯林片（橙红）
    views: [
      { name: 'near', dx: -36, dz: 26, dy: 10, look: true, aim: 8 },
      { name: 'aerial', dx: 0, dz: 0, dy: 85, yaw: 0, pitch: -1.35 },
    ]
  },
  {
    name: 'oakwood', x: 495, z: 45, vd: 1024,     // 橡树纯林片 + 远景 LOD
    views: [
      { name: 'near', dx: -36, dz: 26, dy: 10, look: true, aim: 8 },
      { name: 'aerial', dx: 0, dz: 0, dy: 85, yaw: 0, pitch: -1.35 },
      { name: 'far', dx: 620, dz: 380, dy: 230, look: true, aim: 30 },
    ]
  },
  {
    name: 'junglewood', x: 45, z: 495, vd: 640,   // 丛林树纯林片
    views: [
      { name: 'near', dx: -36, dz: 26, dy: 10, look: true, aim: 10 },
      { name: 'aerial', dx: 0, dz: 0, dy: 90, yaw: 0, pitch: -1.35 },
    ]
  },
  {
    name: 'cherrypatch', x: 945, z: -555, vd: 640, // 森林内稀有樱花片
    views: [
      { name: 'aerial', dx: 0, dz: 0, dy: 85, yaw: 0, pitch: -1.35 },
    ]
  },
  {
    name: 'cherryland', x: 1850, z: 1650, vd: 640, // 樱花林群系：纯樱花密植
    views: [
      { name: 'aerial', dx: 0, dz: 0, dy: 90, yaw: 0, pitch: -1.35 },
    ]
  },
  {
    name: 'acacia', x: -1600, z: -912, vd: 512,    // 沙漠边缘金合欢
    views: [
      { name: 'near', dx: -30, dz: 22, dy: 8, look: true, aim: 7 },
    ]
  },
  {
    name: 'nogiant1', x: 141, z: 973, vd: 640,     // 旧红杉巨树点位：应无巨树
    views: [
      { name: 'aerial', dx: 0, dz: 0, dy: 90, yaw: 0, pitch: -1.35 },
    ]
  },
  {
    name: 'nogiant2', x: 37, z: 35, vd: 640,       // 旧巨橡点位：应无巨树
    views: [
      { name: 'aerial', dx: 0, dz: 0, dy: 90, yaw: 0, pitch: -1.35 },
    ]
  },
];

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* 像素统计（含 orange=枫叶橙）：本模型不看图，以数字为准 */
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
      const c = { fog: 0, white: 0, ice: 0, gray: 0, brown: 0, green: 0, pink: 0, orange: 0, dark: 0, blue: 0, other: 0 };
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), br = (r + g + b) / 3;
        if (Math.abs(r - 194) + Math.abs(g - 216) + Math.abs(b - 238) < 26) c.fog++;
        else if (mn > 185 && mx - mn < 40) c.white++;
        else if (b > 170 && b - r > 25 && g > 150) c.ice++;
        else if (b - r > 40 && b > 140) c.blue++;
        else if (g - Math.max(r, b) > 10) c.green++;
        else if (r > 180 && b > 150 && r - g > 25) c.pink++;
        else if (r > 130 && r - b > 60 && g > 45 && g < 150 && b < 95) c.orange++;
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
      bot: stat(0, h >> 1, w, h),
      ctr: stat(w >> 2, h >> 2, w - (w >> 2), h - (h >> 2)),
    };
  }, b64);
}

(async () => {
  console.log('=== 树木优化/新树种截图 [' + TAG + '] ===');
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
      if (!ok) console.log('[TIMEOUT ready]', sc.name);

      for (const v of sc.views) {
        await page.evaluate((sc, v) => {
          const tx = v.ax !== undefined ? v.ax : sc.x, tz = v.az !== undefined ? v.az : sc.z;
          const th = G.column(Math.floor(tx), Math.floor(tz)).h + G.Y0;
          const ex = tx + (v.dx || 0), ez = tz + (v.dz || 0);
          const eh = G.column(Math.floor(ex), Math.floor(ez)).h + G.Y0;
          let ey = th + (v.dy || 0);
          if (ey < eh + 3) ey = eh + 3;
          let yaw = v.yaw || 0;
          if (v.look) yaw = Math.atan2(-(tx - ex), -(tz - ez));
          let pitch = v.pitch;
          if (pitch === undefined && v.look) {
            const dxz = Math.hypot(tx - ex, tz - ez) || 1;
            pitch = Math.atan2((th + (v.aim || 0) + 2) - ey, dxz);
          }
          Player.pos.set(ex, ey, ez);
          Player.setView(yaw, pitch || 0);
        }, sc, v);
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
        console.log('   bot :', JSON.stringify(st.bot));
        console.log('   ctr :', JSON.stringify(st.ctr));
      }
      // 物品栏注册自检（首个场景顺带）
      if (sc === SCENES[0]) {
        const inv = await page.evaluate(() => {
          const keys = ['b89', 'b91', 'b92', 'b94', 'b95', 'b97', 'b98', 'b100', 'b101', 'b103', 'b104', 'b105', 'b106', 'b107', 'b108', 'b109', 'b90', 'b93', 'b96', 'b99', 'b102'];
          return keys.map(k => (ITEMS.get(k) ? 1 : 0)).join('');
        });
        console.log('[ITEMS] 新方块注册:', inv, inv.indexOf('0') < 0 ? 'OK' : 'MISSING!');
        if (inv.indexOf('0') >= 0) errsAll.push('ITEMS_MISSING');
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
