/* ===================================================================
   tools/browsercheck.js — 解析 browsercheck.ps1 dump 出来的页面自检报告，
   对"真实浏览器里的渲染结果"做断言。

   为什么要这么绕：无头环境下没法用眼睛看截图，所以让页面在真实
   Canvas 上渲染完后把像素统计写进 DOM，这里再把它读出来判定。
   能查出的问题包括：画面全黑、精灵没画出来、阵营色缺失、
   小地图空白、侧边栏没生成按钮、帧耗时异常、JS 报错等。

   用法： node tools/browsercheck.js
   =================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'shots', 'reports');

let pass = 0, fail = 0;
const failures = [];
function ok(cond, name, detail) {
  if (cond) { pass++; return true; }
  fail++;
  failures.push(name + (detail !== undefined ? '　→ ' + detail : ''));
  return false;
}

function parseReport(file) {
  const html = fs.readFileSync(file, 'utf8');
  const m = /<pre id="report"[^>]*>([\s\S]*?)<\/pre>/.exec(html);
  if (!m) return null;
  const out = {};
  const txt = m[1]
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  for (const line of txt.split('\n')) {
    const i = line.indexOf('=');
    if (i < 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const num = (r, k) => parseFloat(r[k]);
const bool = (r, k) => r[k] === 'true' || r[k] === '1';

if (!fs.existsSync(DIR)) {
  console.log('找不到 ' + DIR + '，请先运行 tools/browsercheck.ps1');
  process.exit(1);
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.html')).sort();
console.log('浏览器渲染自检　共 ' + files.length + ' 个场景\n');

const rows = [];
for (const f of files) {
  const name = f.replace(/\.html$/, '');
  const r = parseReport(path.join(DIR, f));
  if (!r) { ok(false, '[' + name + '] 页面生成了自检报告', '未找到 <pre id="report">，可能启动就崩了'); continue; }

  const tag = '[' + name + '] ';
  /* --- 基础健康 --- */
  ok(r.OK === '1', tag + '报告完整生成', r.REPORT_ERROR);
  ok(num(r, 'ERRORS') === 0, tag + '页面无 JS 异常', r.ERR_FIRST);
  ok(num(r, 'FRAMES') >= 1, tag + '至少渲染了一帧', r.FRAMES);
  ok(bool(r, 'ART_READY'), tag + 'R.Art 初始化成功');
  ok(num(r, 'CANVAS_W') > 400, tag + '主画布尺寸有效', r.CANVAS_W + 'x' + r.CANVAS_H);

  /* --- 画面真的画出了东西 --- */
  const colors = num(r, 'PIX_COLORS');
  const meanLum = num(r, 'PIX_MEAN_LUM');
  const black = num(r, 'PIX_BLACK_PCT');
  ok(colors > 400, tag + '画面颜色数充足（不是纯色/空白）', colors);
  ok(meanLum > 6, tag + '画面不是全黑', 'lum=' + meanLum);
  ok(meanLum < 200, tag + '画面不是全白', 'lum=' + meanLum);
  ok(black < 92, tag + '纯黑占比不过分', black + '%');

  /* --- 单位与建筑真的被渲染 --- */
  const p0c = num(r, 'PIX_P0_COLOR_PCT');
  const p1c = num(r, 'PIX_P1_COLOR_PCT');
  ok(num(r, 'BUILDINGS') > 0, tag + '场上有建筑', r.BUILDINGS);
  ok(num(r, 'UNITS') > 0, tag + '场上有单位', r.UNITS);
  ok(num(r, 'ON_SCREEN_UNITS') + num(r, 'ON_SCREEN_BUILDINGS') > 0,
    tag + '视野内有实体', r.ON_SCREEN_UNITS + '单位 ' + r.ON_SCREEN_BUILDINGS + '建筑');
  // 最硬的判据：关掉实体层再渲染一帧，差异像素就是精灵真正画出的面积
  const dpct = num(r, 'PIX_ENTITY_DIFF_PCT');
  const entities = num(r, 'ON_SCREEN_UNITS') + num(r, 'ON_SCREEN_BUILDINGS');
  ok(dpct > Math.min(0.25, entities * 0.02),
    tag + '实体精灵确实画到了画布上（关掉实体层的差分）',
    dpct + '%　视野内实体 ' + entities);
  ok(p0c + p1c > 0.005 || dpct > 0.5, tag + '能看到阵营色或明显的实体覆盖',
    'P0=' + p0c + '% P1=' + p1c + '% diff=' + dpct + '%');

  /* --- 小地图 --- */
  ok(num(r, 'MM_COLORS') > 12, tag + '小地图有内容', r.MM_COLORS);
  ok(num(r, 'MM_MEAN') > 3, tag + '小地图不是全黑', r.MM_MEAN);

  /* --- 侧边栏 DOM --- */
  ok(num(r, 'UI_CARDS') > 0, tag + '侧边栏生成了建造按钮', r.UI_CARDS);
  ok(num(r, 'UI_CARD_ICONS') === num(r, 'UI_CARDS'), tag + '每个按钮都有图标 canvas',
    r.UI_CARD_ICONS + '/' + r.UI_CARDS);
  ok(num(r, 'UI_TABS') === 5, tag + '五个分类页签', r.UI_TABS);
  ok(/\d/.test(r.UI_CREDITS_TEXT || ''), tag + '资金数字已刷新', r.UI_CREDITS_TEXT);

  /* --- 性能 --- */
  const ms = num(r, 'FRAME_MS');
  ok(ms < 60, tag + '单帧渲染耗时可接受', ms + 'ms');
  if (r.BENCH_TOTAL_MS !== undefined) {
    const bt = num(r, 'BENCH_TOTAL_MS');
    ok(bt < 16.7, tag + '渲染+逻辑单帧 < 16.7ms（可跑满 60fps）',
      'render=' + r.BENCH_RENDER_MS + ' update=' + r.BENCH_UPDATE_MS + ' → ' + r.BENCH_EST_FPS + 'fps');
  }

  /* --- 场景特有断言 --- */
  if (name === 'fresh') {
    ok(num(r, 'GAME_TIME') < 12, tag + '开局时间接近 0', r.GAME_TIME);
    ok(black > 25, tag + '开局迷雾遮住了大部分地图', black + '%');
    ok(num(r, 'P0_B') === 1 && num(r, 'P1_B') === 1, tag + '双方各 1 座建造厂',
      r.P0_B + '/' + r.P1_B);
  }
  if (name === 'nofog') {
    ok(black < 12, tag + '关闭迷雾后画面几乎无纯黑', black + '%');
    ok(num(r, 'PIX_ORE_PCT') > 0.02, tag + '能看到矿脉', r.PIX_ORE_PCT + '%');
  }
  if (name === 'mid' || name === 'late' || name === 'steel') {
    // 注意：这里断言的是"累计采矿"这类单调递增的统计量，
    // 而不是当前建筑数 —— 对局可能在预热期间就打完了，
    // 用瞬时值断言会把"AI 赢得太快"误判成"渲染有问题"。
    ok(num(r, 'P0_HARVESTED') > 1200, tag + '我方经济已启动', r.P0_HARVESTED);
    ok(num(r, 'P1_HARVESTED') > 1200, tag + '敌方经济已启动', r.P1_HARVESTED);
    ok(num(r, 'P0_B') + num(r, 'P1_B') >= 8, tag + '双方合计建成多座建筑',
      r.P0_B + '+' + r.P1_B);
    ok(num(r, 'UNITS') >= 8, tag + '场上单位数量合理', r.UNITS);
    ok(num(r, 'GAME_TIME') > 100, tag + '对局至少推进到 100 秒', r.GAME_TIME);
  }
  if (name === 'battle') {
    ok(num(r, 'PARTICLES') > 0 || num(r, 'PROJECTILES') > 0 || num(r, 'DECALS') > 0,
      tag + '战斗产生了弹药/粒子/残骸', 'proj=' + r.PROJECTILES + ' part=' + r.PARTICLES + ' dec=' + r.DECALS);
    ok(num(r, 'P0_KILLS') + num(r, 'P1_KILLS') > 0, tag + '已经打出击杀',
      r.P0_KILLS + '/' + r.P1_KILLS);
    ok(num(r, 'ON_SCREEN_UNITS') >= 8, tag + '镜头对准了混战区域', r.ON_SCREEN_UNITS);
  }
  if (name === 'place') {
    ok((r.UI_MODEHINT || '').indexOf('放置') >= 0, tag + '建造模式提示已显示', r.UI_MODEHINT);
  }
  if (name === 'ion') {
    ok((r.UI_MODEHINT || '').indexOf('离子炮') >= 0, tag + '离子炮瞄准提示已显示', r.UI_MODEHINT);
  }
  if (name === 'sel') {
    ok(bool(r, 'UI_SEL_VISIBLE'), tag + '选中信息栏已显示');
  }
  if (name === 'zoomin') {
    ok(Math.abs(num(r, 'ZOOM') - 1.9) < 0.01, tag + '缩放参数生效', r.ZOOM);
  }
  if (name === 'audio') {
    // 这是唯一能证明"音频在真实游戏页面里活着"的场景：
    // 其它场景没有用户手势，浏览器不允许建 AudioContext。
    ok(bool(r, 'AUDIO_READY'), tag + 'R.Audio 在游戏页面里初始化成功', r.AUDIO_CTX_STATE);
    ok(r.AUDIO_CTX_STATE === 'running' || r.AUDIO_CTX_STATE === 'suspended',
      tag + 'AudioContext 状态正常', r.AUDIO_CTX_STATE);
    ok(num(r, 'AUDIO_VOICES') > 0, tag + '实际发出了声音（活跃源 > 0）', r.AUDIO_VOICES);
    ok(r.AUDIO_MISSING_SFX === 'none', tag + '所有武器音效名都有实现', r.AUDIO_MISSING_SFX);
  }
  // 无论哪个场景，音效名覆盖都必须完整（Node 下也能查）
  if (r.AUDIO_MISSING_SFX !== undefined) {
    ok(r.AUDIO_MISSING_SFX === 'none', tag + '武器音效名无缺失', r.AUDIO_MISSING_SFX);
  }
  if (name === 'large') {
    ok(num(r, 'CHUNKS') > 4, tag + '地形分块缓存已建立', r.CHUNKS);
  }

  rows.push({
    name, colors, lum: meanLum, black,
    b: r.P0_B + '/' + r.P1_B, u: r.UNITS,
    ons: r.ON_SCREEN_UNITS + '/' + r.ON_SCREEN_BUILDINGS,
    diff: dpct,
    harv: r.P0_HARVESTED + '/' + r.P1_HARVESTED,
    kills: r.P0_KILLS + '/' + r.P1_KILLS,
    ms, bench: r.BENCH_TOTAL_MS || '-', fps: r.BENCH_EST_FPS || '-',
    cards: r.UI_CARDS, mm: r.MM_COLORS, t: r.GAME_TIME,
  });
}

/* ---- 概览表 ---- */
console.log('场景      时间   颜色数 亮度 纯黑% 建筑  单位 视野内 实体像素% 采矿(我/敌)     击杀  帧ms 基准ms  估fps');
for (const r of rows) {
  const f = (v, w) => String(v).padStart(w);
  console.log(
    String(r.name).padEnd(9) + f(r.t, 6) + f(r.colors, 7) + f(r.lum, 6) + f(r.black, 6) +
    f(r.b, 6) + f(r.u, 5) + f(r.ons, 7) + f(r.diff, 10) + f(r.harv, 14) + f(r.kills, 7) +
    f(r.ms, 6) + f(r.bench, 7) + f(r.fps, 7));
}

console.log('\n' + '='.repeat(66));
if (fail === 0) console.log('浏览器渲染自检全部通过：' + pass + ' / ' + pass + '　✔');
else {
  console.log('结果：' + pass + ' 通过，' + fail + ' 失败\n\n失败项：');
  for (const f of failures) console.log('  · ' + f);
}
console.log('='.repeat(66));
process.exit(fail === 0 ? 0 : 1);
