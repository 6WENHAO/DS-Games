/**
 * 功能测试：第一视角行走/碰撞/跳跃、升降塔搭乘、图解标签、重新生成、模式切换。
 */
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11'] });
let fail = 0;
const ok = (c, m) => { console.log((c ? '  PASS  ' : '  FAIL  ') + m); if (!c) fail++; };

try {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5178/?readback=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#boot')?.classList.contains('gone'), null, { timeout: 240000 });
  await page.waitForTimeout(2000);

  // ── 模式切换 ──
  for (const m of ['fps', 'cine', 'orbit']) {
    await page.evaluate((mm) => document.querySelector(`#topbar .modes button[data-mode="${mm}"]`).click(), m);
    await page.waitForTimeout(400);
    const cur = await page.evaluate(() => window.__ds.state.mode);
    ok(cur === m, `模式切换到 ${m}`);
  }

  // ── 第一视角行走 ──
  await page.evaluate(() => {
    document.querySelector('#vpList button[data-vp="approach"]').click();
  });
  await page.waitForTimeout(700);
  const p0 = await page.evaluate(() => {
    const p = window.__ds.fp.pos; return [p.x, p.y, p.z];
  });
  // 直接驱动按键集合（headless 下 pointerlock 不可靠）
  await page.evaluate(() => { window.__ds.fp.keys.add('KeyW'); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__ds.fp.keys.delete('KeyW'); });
  const p1 = await page.evaluate(() => {
    const f = window.__ds.fp; return { p: [f.pos.x, f.pos.y, f.pos.z], onGround: f.onGround };
  });
  const dist = Math.hypot(p1.p[0] - p0[0], p1.p[2] - p0[2]);
  ok(dist > 6, `前进有效（移动 ${dist.toFixed(1)} 体素）`);
  ok(Math.abs(p1.p[1] - p0[1]) < 3, `没有掉下去 / 没被弹起（y ${p0[1]} → ${p1.p[1]}）`);
  ok(p1.onGround === true, '站在地面上');

  // ── 撞墙不穿模 ──
  await page.evaluate(() => {
    const f = window.__ds.fp;
    f.placeAt([-236, 3, -62], -Math.PI / 2 - 0.2, 0, false);
    f.yaw = Math.PI;          // 转向 +z 方向的街区
    f.keys.add('KeyW'); f.keys.add('ShiftLeft');
  });
  await page.waitForTimeout(2500);
  const wall = await page.evaluate(() => {
    const f = window.__ds.fp;
    f.keys.clear();
    const inside = f.hits(f.pos.x, f.pos.y, f.pos.z);
    return { inside, p: [Math.round(f.pos.x), Math.round(f.pos.y), Math.round(f.pos.z)] };
  });
  ok(wall.inside === false, `疾行撞墙后没有卡进实体 @${wall.p.join(',')}`);

  // ── 跳跃 ──
  await page.evaluate(() => {
    const f = window.__ds.fp;
    f.placeAt([-236, 3, -62], -Math.PI / 2, 0, false);
    f.vel.y = 15.5; f.onGround = false;
  });
  await page.waitForTimeout(160);
  const jumpUp = await page.evaluate(() => window.__ds.fp.pos.y);
  await page.waitForTimeout(1200);
  const jumpDown = await page.evaluate(() => ({ y: window.__ds.fp.pos.y, g: window.__ds.fp.onGround }));
  ok(jumpUp > 0.4, `跳起来了（峰值 y=${jumpUp.toFixed(1)}）`);
  ok(jumpDown.g === true && Math.abs(jumpDown.y) < 1.5, `落回地面（y=${jumpDown.y.toFixed(1)}）`);

  // ── 飞行 ──
  await page.evaluate(() => {
    const f = window.__ds.fp;
    f.fly = true; f.pitch = 0.9; f.keys.add('KeyW'); f.keys.add('ShiftLeft');
  });
  await page.waitForTimeout(1500);
  const flew = await page.evaluate(() => { const f = window.__ds.fp; f.keys.clear(); f.fly = false; return f.pos.y; });
  ok(flew > 60, `飞行可用（升到 y=${flew.toFixed(0)}）`);

  // ── 升降塔搭乘 ──
  await page.evaluate(() => {
    const ds = window.__ds;
    ds.fp.placeAt([-70, 3, 70], 0, 0, false);
    ds.fp.enterRide(ds.genData().elevators, ds.state.time);
  });
  await page.waitForTimeout(2600);
  const ride = await page.evaluate(() => {
    const f = window.__ds.fp;
    return { riding: !!f.ride, y: f.pos.y, hintVisible: !document.querySelector('#rideHint').classList.contains('hidden') };
  });
  ok(ride.riding, '进入升降塔');
  ok(ride.y > 10, `轿厢在上升（y=${ride.y.toFixed(0)}）`);
  ok(ride.hintVisible, '升降塔提示已显示');
  await page.evaluate(() => { window.__ds.fp.exitRide(); });
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => !window.__ds.fp.ride && window.__ds.fp.fly), '离开升降塔后自动转飞行');

  // ── 图解标签 ──
  await page.evaluate(() => document.querySelector('#vpList button[data-vp="orbit"]').click());
  await page.waitForTimeout(1600);
  const annos = await page.evaluate(() => {
    const all = [...document.querySelectorAll('.anno')];
    return { total: all.length, shown: all.filter((a) => a.classList.contains('show')).length };
  });
  ok(annos.total >= 8, `图解标签已创建（${annos.total} 条）`);
  ok(annos.shown >= 1, `沙盘视角有标签可见（${annos.shown} 条）`);

  // ── 参数面板 ──
  await page.evaluate(() => {
    document.querySelector('#btnPanel').click();
    for (const id of ['#tShadow', '#tAnno', '#tProps', '#tClouds', '#tGrade', '#tAA', '#tSpin']) document.querySelector(id).click();
  });
  await page.waitForTimeout(900);
  const toggled = await page.evaluate(() => {
    const s = window.__ds.state;
    return [s.shadows, s.showAnno, s.showProps, s.showClouds, s.grade, s.aa, s.spin];
  });
  ok(JSON.stringify(toggled) === JSON.stringify([false, false, false, false, false, false, true]), '七个开关全部生效: ' + JSON.stringify(toggled));
  await page.evaluate(() => {
    for (const id of ['#tShadow', '#tAnno', '#tProps', '#tClouds', '#tGrade', '#tAA', '#tSpin']) document.querySelector(id).click();
  });
  await page.waitForTimeout(600);

  // ── 天空预设 ──
  const presets = await page.evaluate(() => [...document.querySelectorAll('#skyPresets button')].map((b) => b.dataset.sky));
  ok(presets.length === 6, `六个天空预设: ${presets.join(',')}`);
  for (const p of presets) {
    await page.evaluate((pp) => document.querySelector(`#skyPresets button[data-sky="${pp}"]`).click(), p);
    await page.waitForTimeout(280);
  }
  ok(true, '所有天空预设切换无报错');

  // ── 重新生成 ──
  const before = await page.evaluate(() => window.__ds.state.seed);
  await page.evaluate(() => document.querySelector('#btnReseed').click());
  await page.waitForFunction(() => document.querySelector('#boot').classList.contains('gone'), null, { timeout: 240000 });
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({
    seed: window.__ds.state.seed, ready: window.__ds.state.ready,
    solid: window.__ds.genData().stats.solid,
  }));
  ok(after.seed !== before, `重新生成换了种子（${before} → ${after.seed}）`);
  ok(after.ready && after.solid > 1e7, `新沙盘生成完成（${after.solid.toLocaleString()} 体素）`);

  // 重新生成后第一视角仍可用
  await page.evaluate(() => {
    document.querySelector('#vpList button[data-vp="plaza"]').click();
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => { window.__ds.fp.keys.add('KeyW'); });
  await page.waitForTimeout(1200);
  const after2 = await page.evaluate(() => { const f = window.__ds.fp; f.keys.clear(); return { inside: f.hits(f.pos.x, f.pos.y, f.pos.z), y: f.pos.y }; });
  ok(after2.inside === false, '重新生成后第一视角行走正常');

  console.log('\nconsole errors: ' + errors.length);
  errors.slice(0, 10).forEach((e) => console.log('  ' + e));
  if (errors.length) fail++;
  await page.close();
} finally {
  await browser.close();
}
console.log(fail === 0 ? '\n全部通过' : `\n${fail} 项失败`);
process.exit(fail === 0 ? 0 : 1);
