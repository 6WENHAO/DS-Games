/* shots/take.js - Phase 2 无头截图自检（含镜面反射） */
const puppeteer = require('puppeteer');
const path = require('path');
const SEED = 20260718;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  console.log('=== Phase 2 镜面反射 无头截图 ===\n');
  const errs = [];
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist',
      '--use-gl=angle','--use-angle=swiftshader','--disable-gpu-sandbox','--enable-unsafe-swiftshader']
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => { if (msg.type() === 'error') errs.push(msg.text()); });
    page.on('pageerror', e => errs.push(e.message));

    const url = 'file:///' + path.resolve('index.html').replace(/\\/g, '/') +
      '?shot=1&seed=' + SEED + '&vd=512&near=8';
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.setViewport({ width: 1280, height: 720 });

    // Wait for ready
    for (let i = 0; i < 120; i++) {
      if (await page.evaluate(() => window.__ready === true)) break;
      await sleep(500);
    }

    const s = await page.evaluate(() => ({
      ready: window.__ready, fps: window.__fps,
      room: window.__roomOrigin, mirror: !!window.__mirror,
      errs: window.__errors ? window.__errors().n : -1
    }));
    console.log('Init:', JSON.stringify(s));
    if (s.errs > 0) errs.push('JS_ERRORS:' + s.errs);
    if (!s.room) throw new Error('No roomOrigin');
    if (!s.mirror) errs.push('NO_MIRROR');

    const ro = s.room;
    const RC = { sizeX: 14, sizeZ: 10, sizeY: 6 };

    function teleport(x, y, z, yaw, pitch) {
      return page.evaluate((x, y, z, yaw, pitch) => {
        Player.pos.set(x, y, z);
        Player.setView(yaw, pitch);
      }, x, y, z, yaw, pitch).then(() => sleep(500));
    }

    // Shot 1: 室内面朝镜面（南墙），可看到室内反射
    const ix = ro.x + RC.sizeX / 2 + 0.5;
    const iy = ro.y + 2;
    const iz = ro.z + RC.sizeZ - 3;
    await teleport(ix, iy, iz, Math.PI, -0.05);
    await page.screenshot({ path: path.join(__dirname, 'p2_01_interior_mirror.png') });
    console.log('[OK] p2_01_interior_mirror.png');

    // Shot 2: 侧角看镜面（从房间一侧看镜面 + 反射内容）
    await teleport(ro.x + 3, ro.y + 2, ro.z + RC.sizeZ - 2, Math.PI * 0.75, -0.05);
    await page.screenshot({ path: path.join(__dirname, 'p2_02_angle_mirror.png') });
    console.log('[OK] p2_02_angle_mirror.png');

    // Shot 3: 室外绕楼角度（南侧外看镜面背后 + 房间整体）
    const ex = ro.x + RC.sizeX + 12;
    const ey = ro.y + 9;
    const ez = ro.z + RC.sizeZ + 10;
    const edx = (ro.x + RC.sizeX / 2) - ex;
    const edz = (ro.z + RC.sizeZ / 2) - ez;
    await teleport(ex, ey, ez, Math.atan2(-edx, -edz), -0.25);
    await page.screenshot({ path: path.join(__dirname, 'p2_03_exterior.png') });
    console.log('[OK] p2_03_exterior.png');

    await page.close();
  } catch (e) {
    console.error('FATAL:', e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }

  console.log('\n=== Phase 2 Check ===');
  console.log('Errors:', errs.length, errs.length ? errs.join('; ') : '');
  console.log(errs.length === 0 ? '[PASS]' : '[FAIL]');
  process.exit(errs.length > 0 ? 1 : 0);
})();
