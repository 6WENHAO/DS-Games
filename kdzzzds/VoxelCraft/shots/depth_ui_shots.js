/* shots/depth_ui_shots.js - 深度-1000/深盆地/飞行修复/MC UI 渲染验证 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const SEED = 20260718;
const DIR = path.join(__dirname, 'depth');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR);

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
      const c = { fog: 0, white: 0, gray: 0, brown: 0, green: 0, blue: 0, dark: 0, other: 0 };
      let lum = 0;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), br = (r + g + b) / 3;
        lum += br;
        if (Math.abs(r - 194) + Math.abs(g - 216) + Math.abs(b - 238) < 26) c.fog++;
        else if (mn > 185 && mx - mn < 40) c.white++;
        else if (b - r > 30 && b > 90) c.blue++;
        else if (g - Math.max(r, b) > 10) c.green++;
        else if (br < 60) c.dark++;
        else if (mx - mn < 30) c.gray++;
        else if (r - b >= 15 && r > 60) c.brown++;
        else c.other++;
      }
      const o = { lum: Math.round(lum / n) };
      for (const k in c) { const v = Math.round(c[k] / n * 1000) / 10; if (v >= 0.5) o[k] = v; }
      return o;
    }
    const w = cv.width, h = cv.height;
    return { full: stat(0, 0, w, h), ctr: stat(w >> 2, h >> 2, w - (w >> 2), h - (h >> 2)), bot: stat(0, h >> 1, w, h) };
  }, b64);
}

(async () => {
  console.log('=== 深度 -1000 / 深盆地 / 飞行修复 / MC UI 验证 ===');
  const errsAll = [];
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist',
      '--use-gl=angle', '--use-angle=swiftshader', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader']
  });
  const fileUrl = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');

  async function newPage(params, waitReady) {
    const page = await browser.newPage();
    page._errs = [];
    page.on('console', m => { if (m.type() === 'error') page._errs.push(m.text()); });
    page.on('pageerror', e => page._errs.push(e.message));
    await page.goto(fileUrl + params, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.setViewport({ width: 1280, height: 720 });
    if (waitReady) {
      for (let i = 0; i < 240; i++) {
        if (await page.evaluate(() => window.__ready === true)) break;
        await sleep(500);
      }
    } else {
      for (let i = 0; i < 240; i++) {
        const ok = await page.evaluate(() => window.G && window.World && World.queuesEmpty() && World.nearComplete(3));
        if (ok) break;
        await sleep(500);
      }
    }
    return page;
  }
  async function tp(page, ex, ey, ez, yaw, pitch) {
    await page.evaluate((ex, ey, ez, yaw, pitch) => {
      Player.pos.set(ex, ey, ez);
      Player.setView(yaw, pitch);
    }, ex, ey, ez, yaw, pitch);
    for (let i = 0; i < 160; i++) {
      const idle = await page.evaluate(() => World.queuesEmpty());
      if (idle && i > 6) break;
      await sleep(400);
    }
    await sleep(900);
  }
  async function shoot(page, name) {
    const f = path.join(DIR, name + '.png');
    const buf = await page.screenshot({ path: f });
    const st = await pixelStats(page, buf);
    console.log('[OK]', name + '.png');
    console.log('   full:', JSON.stringify(st.full));
    console.log('   ctr :', JSON.stringify(st.ctr));
    return st;
  }

  try {
    /* ---------- ① 深盆地全景 + 盆底近景 ---------- */
    {
      const page = await newPage('?shot=1&seed=' + SEED + '&vd=2048&near=5&x=-64&z=-1152', true);
      // 盆心上空俯瞰全盆
      await tp(page, -64, 380, -1152, 0, -1.35);
      await shoot(page, 'basin_pano_top');
      // 盆缘望盆心（跨越护堤视角）
      await tp(page, -64, 320, 300, Math.PI, -0.42);
      await shoot(page, 'basin_pano_rim');
      // 盆底湖岸近景（世界 -630 左右，深暗+湖水）
      const floorY = await page.evaluate(() => G.column(-160, -1152).h + G.Y0);
      await tp(page, -160, Math.max(floorY, -520) + 14, -1152, -Math.PI / 2, -0.15);
      const stFloor = await shoot(page, 'basin_floor');
      if (stFloor.full.lum > 120) errsAll.push('BASIN_FLOOR_NOT_DARK lum=' + stFloor.full.lum);
      // 方块级抽查（在玩家附近已加载区块内）：湖面 -520、世界底基岩
      const probe = await page.evaluate(() => {
        const out = { water520: World.getBlock(-160, -520, -1152), air519: World.getBlock(-160, -519, -1152) };
        out.bedrockBelow = World.getBlock(-160, -1001, -1152);
        out.floorH = G.column(-160, -1152).h + G.Y0;
        return out;
      });
      console.log('   probe:', JSON.stringify(probe));
      if (probe.floorH < -521 && probe.water520 !== 11 && probe.water520 !== 10) errsAll.push('NO_BASIN_LAKE@-520 got=' + probe.water520);
      if (probe.bedrockBelow !== 12) errsAll.push('NO_FLOOR_BEDROCK got=' + probe.bedrockBelow);
      if (page._errs.length) errsAll.push(...page._errs);
      await page.close();
    }

    /* ---------- ② 挖到 -1000：竖井 + 井底截图 ---------- */
    {
      const page = await newPage('?shot=1&seed=' + SEED + '&vd=512&near=4&x=120&z=80', true);
      const dug = await page.evaluate(() => {
        const sx = 120, sz = 80;
        const top = G.column(sx, sz).h + G.Y0;
        const list = [];
        for (let y = top; y >= -996; y--)
          for (let dx = 0; dx < 2; dx++) for (let dz = 0; dz < 2; dz++)
            list.push({ x: sx + dx, y: y, z: sz + dz, id: 0 });
        World.stampBlocks(list);
        return { top: top, n: list.length, bottom: World.getBlock(sx, -997, sz), below: World.getBlock(sx, -1000, sz) };
      });
      console.log('   shaft:', JSON.stringify(dug));
      await sleep(1200);
      // 井底看基岩壁（世界 -993）
      await tp(page, 121, -993, 81, 0, -0.5);
      const stPit = await shoot(page, 'dig_bottom');
      if (stPit.full.lum > 90) errsAll.push('PIT_NOT_DARK lum=' + stPit.full.lum);
      const probes = await page.evaluate(() => ({
        atNeg998: World.getBlock(121, -998, 80),   // 井壁（未挖列）
        below: World.getBlock(121, -1001, 81),      // 世界底以下 → 基岩
        yShown: Math.round(Player.pos.y)
      }));
      console.log('   probe:', JSON.stringify(probes));
      if (probes.below !== 12) errsAll.push('BELOW_WORLD_NOT_BEDROCK');
      if (page._errs.length) errsAll.push(...page._errs);
      await page.close();
    }

    /* ---------- ③ 飞行修复：按住空格连续上升不卡、不来回蹦 ---------- */
    {
      const page = await newPage('?seed=' + SEED + '&vd=512&near=4&x=120&z=80', false);   // 非 shot 模式（有按键监听）
      await page.evaluate(() => { document.querySelector('.overlay').style.display = 'none'; });
      const res = await page.evaluate(async () => {
        function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
        function kd(repeat) { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: repeat, bubbles: true })); }
        function ku() { document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })); }
        const fly0 = Player.isFly();
        Player.pos.set(120, 90, 80);
        const samples = [];
        kd(false);                                   // 按下
        for (let t = 0; t < 100; t++) {              // 按住 3s：系统重复 keydown(repeat=true)
          kd(true);
          if (t % 7 === 0) samples.push(Player.pos.y);
          await sleep(30);
        }
        ku();
        const flyHeld = Player.isFly();
        // 单调性检查：上升途中不允许回落 >0.6（旧 bug 会反复蹦）
        let drops = 0;
        for (let i = 1; i < samples.length; i++) if (samples[i] < samples[i - 1] - 0.6) drops++;
        // 真实双击：应切换飞行
        kd(false); ku(); await sleep(120); kd(false); ku();
        const flyToggled = Player.isFly();
        await sleep(60);
        return {
          fly0: fly0, flyHeld: flyHeld, flyToggled: flyToggled, drops: drops,
          y0: samples[0], y1: samples[samples.length - 1], samples: samples.map(v => Math.round(v))
        };
      });
      console.log('   fly test:', JSON.stringify(res));
      if (!res.fly0 || !res.flyHeld) errsAll.push('FLY_TOGGLED_WHILE_HOLDING');
      if (res.drops > 0) errsAll.push('FLY_BOUNCE drops=' + res.drops);
      // SwiftShader 低帧率下 dt 钳制为 0.05s/帧，3s 实时≈0.6s 模拟 → 期望 dy≈10；关键是单调上升+飞行态不被误切
      if (res.y1 - res.y0 < 6) errsAll.push('FLY_STUCK dy=' + (res.y1 - res.y0));
      if (res.flyToggled) errsAll.push('DOUBLE_TAP_BROKEN');
      if (page._errs.length) errsAll.push(...page._errs);
      await page.close();
    }

    /* ---------- ④ MC UI：主菜单 / 设置 / 背包 / HUD ---------- */
    {
      const page = await newPage('?seed=' + SEED + '&vd=512&near=4&x=120&z=80', false);
      await sleep(600);
      const stMenu = await shoot(page, 'ui_menu');            // 主菜单（暗泥土底+石质按钮）
      if ((stMenu.full.brown || 0) + (stMenu.full.dark || 0) < 50) errsAll.push('MENU_NOT_DIRT');
      await page.evaluate(() => { document.querySelectorAll('.smallbtn').forEach(b => { if (b.textContent === '设置') b.click(); }); });
      await sleep(300);
      await shoot(page, 'ui_settings');                       // 设置（浅石面板+MC 滑杆）
      await page.evaluate(() => { document.querySelectorAll('.bigbtn').forEach(b => { if (b.textContent === '返回') b.click(); }); });
      await sleep(200);
      await page.evaluate(() => { document.querySelector('.overlay').style.display = 'none'; });
      await page.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true })); });
      await sleep(500);
      await shoot(page, 'ui_inventory');                      // 背包（石面板+内凹槽位）
      await page.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true })); });
      await sleep(300);
      await page.evaluate(() => { document.querySelector('.overlay').style.display = 'none'; });
      await sleep(400);
      await shoot(page, 'ui_hud');                            // HUD（物品栏+准星+提示）
      const uiCheck = await page.evaluate(() => {
        const cs = getComputedStyle(document.querySelector('.slot'));
        const btn = getComputedStyle(document.querySelector('.bigbtn'));
        return {
          slotBg: cs.backgroundImage.slice(0, 30),
          btnBg: btn.backgroundImage.slice(0, 30),
          cross: !!document.querySelector('.crosshair svg'),
          imgs: document.querySelectorAll('img[src^="data:image/svg"]').length,
          extImgs: [...document.querySelectorAll('img')].filter(i => !i.src.startsWith('data:')).length
        };
      });
      console.log('   ui probe:', JSON.stringify(uiCheck));
      if (uiCheck.slotBg.indexOf('data:image/svg') < 0) errsAll.push('SLOT_NOT_SVG');
      if (uiCheck.btnBg.indexOf('data:image/svg') < 0) errsAll.push('BTN_NOT_SVG');
      if (!uiCheck.cross) errsAll.push('CROSSHAIR_NOT_SVG');
      if (uiCheck.extImgs > 0) errsAll.push('EXTERNAL_IMAGES=' + uiCheck.extImgs);
      if (page._errs.length) errsAll.push(...page._errs);
      await page.close();
    }
  } catch (e) {
    console.error('FATAL:', e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
  console.log('\nIssues:', errsAll.length, errsAll.length ? errsAll.join(' | ') : '');
  console.log(errsAll.length === 0 ? '[PASS]' : '[FAIL]');
  process.exit(errsAll.length ? 1 : 0);
})();
