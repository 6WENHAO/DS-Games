/**
 * tools/headless.mjs —— 无头浏览器端到端自检（CDP 驱动）
 *
 * 为什么用 CDP 而不是 `--dump-dom`：
 *   `--dump-dom` 在 load 事件后立即输出，而本应用需要先经由 Web Worker 池完成
 *   17 个舱段的建模与网格化；配合 `--virtual-time-budget` 时虚拟时间会在
 *   Worker 真实计算完成之前就被耗尽，导致抓到的永远是"建造中 0%"的快照。
 *   因此这里用 DevTools 协议按真实时间轮询自检报告，并同时收集控制台输出，
 *   使 GLSL 编译错误、WebGL 警告都能直接暴露出来。
 *
 * 用法：
 *   node server.mjs                       # 另开一个终端
 *   node tools/headless.mjs [--url http://127.0.0.1:8181/] [--timeout 90] [--keep]
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { findBrowser } from './probe.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const base = arg('url', 'http://127.0.0.1:8181/');
const target = base + (base.includes('?') ? '&' : '?') + 'selftest=1';
const budgetMs = +arg('timeout', '90') * 1000;
const port = +arg('port', '9412');

const browser = findBrowser();
if (!browser) { console.error('未找到 Chrome / Edge，无法执行无头自检。'); process.exit(2); }

const profile = mkdtempSync(path.join(tmpdir(), 'vss-cdp-'));
const child = spawn(browser, [
  '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--enable-unsafe-swiftshader',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--mute-audio',
  '--hide-scrollbars', '--disable-sync', '--disable-background-networking',
  '--window-size=1440,860', '--force-device-scale-factor=1',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
  'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });

let browserErr = '';
child.stderr.on('data', (d) => { browserErr += d; });

const cleanup = () => {
  try { child.kill('SIGKILL'); } catch { /* 已退出 */ }
  if (argv.includes('--keep')) return;
  // Windows 下浏览器进程可能仍持有 profile 目录句柄，重试几次后放弃（不影响结论）
  for (let i = 0; i < 3; i++) {
    try { rmSync(profile, { recursive: true, force: true }); return; } catch { /* 重试 */ }
  }
};
process.on('exit', cleanup);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── 等待 DevTools 端点就绪 ── */
let version = null;
for (let i = 0; i < 80; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (r.ok) { version = await r.json(); break; }
  } catch { /* 尚未监听 */ }
  await sleep(250);
}
if (!version) { console.error('DevTools 端点未就绪。'); console.error(browserErr.split('\n').slice(-10).join('\n')); process.exit(1); }

console.log(`浏览器：${version['Browser']}`);
console.log(`目标：  ${target}\n`);

/* ── 建立 CDP 会话 ── */
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
/** @type {Array<{level:string,text:string}>} */
const logs = [];

ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id !== undefined) {
    const p = pending.get(m.id);
    if (p) { pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    logs.push({ level: m.params.type, text: m.params.args.map(argToText).join(' ') });
  } else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    logs.push({ level: 'exception', text: d.exception?.description || d.text });
  } else if (m.method === 'Log.entryAdded') {
    logs.push({ level: m.params.entry.level, text: m.params.entry.text });
  }
};

const argToText = (a) => (a.value !== undefined ? String(a.value)
  : a.description || (a.preview ? JSON.stringify(a.preview.properties?.map((p) => `${p.name}=${p.value}`)) : a.type));

const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++msgId;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});

/* ── 打开目标页并附加 ── */
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await send('Log.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
await send('Page.navigate', { url: target }, sessionId);

const evaluate = async (expr) => {
  const r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true,
  }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

/* ── 轮询自检报告 ── */
const t0 = Date.now();
let report = null, lastStage = '';
while (Date.now() - t0 < budgetMs) {
  await sleep(500);
  let snapshot;
  try {
    snapshot = await evaluate(`(() => {
      const pre = document.getElementById('selftest');
      const fatal = document.getElementById('unsupported');
      return {
        report: pre ? pre.textContent : null,
        fatal: fatal && !fatal.hidden ? document.getElementById('unsupported-msg').textContent : null,
        stage: (document.getElementById('boot-stage') || {}).textContent || '',
        pct: (document.getElementById('boot-pct') || {}).textContent || '',
      };
    })()`);
  } catch (e) {
    continue;   // 导航过程中上下文可能短暂不可用
  }
  if (snapshot.fatal) {
    console.error(`✖ 页面报致命错误：\n${snapshot.fatal}`);
    dumpLogs();
    process.exit(1);
  }
  if (snapshot.report) { report = JSON.parse(snapshot.report); break; }
  const stage = `${snapshot.stage} ${snapshot.pct}`.trim();
  if (stage !== lastStage) { lastStage = stage; console.log(`  … ${stage}`); }
}

function dumpLogs() {
  const bad = logs.filter((l) => ['error', 'exception', 'assert'].includes(l.level));
  if (bad.length) {
    console.error('\n控制台错误：');
    for (const l of bad.slice(0, 20)) console.error(`  [${l.level}] ${l.text}`);
  }
  const dump = path.join(process.cwd(), 'tools', 'headless-logs.txt');
  writeFileSync(dump, logs.map((l) => `[${l.level}] ${l.text}`).join('\n'));
  console.error(`完整控制台日志：${dump}`);
}

if (!report) {
  console.error(`\n✖ ${budgetMs / 1000}s 内未取得自检报告（停在「${lastStage}」）`);
  dumpLogs();
  process.exit(1);
}

console.log('\n' + JSON.stringify(report, null, 2));

/* ── 断言 ── */
const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

check(report.glErrors.length === 0, `存在 GL 错误：${report.glErrors.join(', ')}`);
check(report.station.modules === report.station.expected,
  `舱段数量不符：${report.station.modules} / ${report.station.expected}`);
check(report.station.triangles > 100000, `三角面偏少：${report.station.triangles}`);
check(report.programs.length === 13, `着色器程序数量：${report.programs.length}`);
check(report.programs.every((p) => p.uniforms > 0), '有程序未取到任何 uniform（可能链接异常）');
check(report.frame.drawCalls > 10, `绘制批次过少：${report.frame.drawCalls}`);
check(report.frame.passes > 15, `渲染通道过少：${report.frame.passes}`);
check(report.pixels.nonBlack > 0.20, `画面过暗，非黑像素占比仅 ${report.pixels.nonBlack}`);
check(report.pixels.mean > 12 && report.pixels.mean < 150,
  `画面平均亮度 ${report.pixels.mean} 超出合理区间（12–150）`);
check(report.pixels.p05 < 60, `暗部不足：5% 分位亮度已达 ${report.pixels.p05}，画面被整体提亮`);
check(report.pixels.p95 > 120, `亮部不足：95% 分位亮度仅 ${report.pixels.p95}`);
check(report.pixels.unique > 150, `色彩层次不足，唯一色桶仅 ${report.pixels.unique}`);
check(report.pixels.max > 110, `画面缺少高光，最大亮度 ${report.pixels.max}`);
check(report.dom.bootDone, '启动层未正常收起');
check(report.dom.modules >= 15, `舱段清单条目：${report.dom.modules}`);
check(report.dom.toggles >= 12, `工具条开关：${report.dom.toggles}`);
check(report.dom.sliders >= 5, `滑块数量：${report.dom.sliders}`);
check(report.dom.telemetry >= 4, `遥测条目：${report.dom.telemetry}`);
check(report.centerPick !== null, '屏幕中心 GPU 拾取未命中任何舱段');

/* ── 交互冒烟：切换显示模式 / 爆炸视图 / 选中舱段，确认不产生 GL 错误 ── */
const interaction = await evaluate(`(async () => {
  const S = globalThis.__state, R = globalThis.__renderer();
  const gl = R.gl;
  const drain = () => { let e, n = 0; while ((e = gl.getError()) !== gl.NO_ERROR) n++; return n; };
  const wait = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const out = {};
  drain();
  for (const [k, v] of [['mode', 1], ['mode', 2], ['mode', 0]]) { S[k] = v; await wait(); }
  out.modeErrors = drain();
  S.explode = 100; S.assembly = 55; await wait(); await wait();
  out.explodeErrors = drain();
  out.explodeVisible = globalThis.__station().modules.filter(m => m.visible).length;
  S.explode = 0; S.assembly = 100; S.ssaoOn = false; S.shadows = false; S.bloomOn = false; await wait();
  out.offErrors = drain();
  S.ssaoOn = true; S.shadows = true; S.bloomOn = true; S.solo = true;
  S.selected = 'ring'; await wait(); await wait();
  out.soloVisible = globalThis.__station().modules.filter(m => m.visible).length;
  out.soloErrors = drain();
  S.solo = false; S.selected = null; await wait();
  out.pixels = R.readbackStats(8).nonBlack;
  out.finalErrors = drain();

  // 纯天空测量：临时隐藏所有舱段，确认深空背景本身足够暗（避免星云/星场把天空糊亮）
  const ids = globalThis.__station().modules.map(m => m.def.id);
  for (const id of ids) S.hiddenIds.add(id);
  await wait(); await wait();
  const sky = R.readbackStats(6);
  out.sky = { mean: sky.mean, p50: sky.p50, p95: sky.p95, max: sky.max, unique: sky.unique };
  out.skyErrors = drain();

  // 分量隔离：逐项打开天空/后处理的各个组成，定位亮度贡献来源
  const RD = globalThis.__render;
  const save = { stars: RD.stars, nebula: RD.nebula, bloomOn: S.bloomOn, flareOn: S.flareOn, godraysOn: S.godraysOn, earth: S.earth };
  const measure = async (label) => { await wait(); await wait(); const s = R.readbackStats(10); return [label, s.mean, s.p50, s.p95]; };
  RD.stars = 0; RD.nebula = 0; S.bloomOn = false; S.flareOn = false; S.godraysOn = false; S.earth = false;
  out.breakdown = [];
  out.breakdown.push(await measure('仅太阳'));
  RD.nebula = save.nebula; out.breakdown.push(await measure('+星云'));
  RD.stars = save.stars;   out.breakdown.push(await measure('+星场'));
  S.earth = true;          out.breakdown.push(await measure('+地球'));
  S.bloomOn = true;        out.breakdown.push(await measure('+辉光'));
  S.godraysOn = true;      out.breakdown.push(await measure('+体积光'));
  S.flareOn = true;        out.breakdown.push(await measure('+光斑'));
  Object.assign(S, { bloomOn: save.bloomOn, flareOn: save.flareOn, godraysOn: save.godraysOn, earth: save.earth });
  RD.stars = save.stars; RD.nebula = save.nebula;
  out.breakdownErrors = drain();

  for (const id of ids) S.hiddenIds.delete(id);
  await wait();
  return out;
})()`);

console.log('\n交互冒烟：' + JSON.stringify({ ...interaction, breakdown: undefined }));
if (interaction.breakdown) {
  console.log('\n天空亮度分量隔离（mean / p50 / p95）：');
  for (const [label, mean, p50, p95] of interaction.breakdown) {
    console.log(`  ${label.padEnd(10, '　')} mean ${String(mean).padStart(7)}   p50 ${String(p50).padStart(6)}   p95 ${String(p95).padStart(6)}`);
  }
}
check(interaction.modeErrors === 0, `切换显示模式产生 ${interaction.modeErrors} 个 GL 错误`);
check(interaction.explodeErrors === 0, `爆炸/装配动画产生 ${interaction.explodeErrors} 个 GL 错误`);
check(interaction.offErrors === 0, `关闭后处理产生 ${interaction.offErrors} 个 GL 错误`);
check(interaction.soloErrors === 0, `单独显示产生 ${interaction.soloErrors} 个 GL 错误`);
check(interaction.finalErrors === 0, `收尾阶段产生 ${interaction.finalErrors} 个 GL 错误`);
check(interaction.explodeVisible < report.station.modules + 1, '装配进度 55% 时应有舱段尚未出现');
check(interaction.soloVisible >= 1 && interaction.soloVisible < report.station.modules,
  `单独显示模式下可见舱段数异常：${interaction.soloVisible}`);
check(interaction.pixels > 0.2, `交互后画面异常：非黑像素 ${interaction.pixels}`);
check(interaction.skyErrors === 0, `纯天空测量产生 ${interaction.skyErrors} 个 GL 错误`);
check(interaction.breakdownErrors === 0, `分量隔离测量产生 ${interaction.breakdownErrors} 个 GL 错误`);
check(interaction.sky.max > 90, `天空缺少亮星/太阳，最大亮度仅 ${interaction.sky.max}`);
check(interaction.sky.unique > 60, `天空色彩过于单调，唯一色桶仅 ${interaction.sky.unique}`);

/* 分量隔离断言：把「深空该有多暗、各元素该贡献多少」固化成回归基线。
   一次性把整帧亮度当作单一指标是没用的——沐浴阳光的地球本就该很亮；
   真正需要守住的是"空无一物处必须接近纯黑"，以及每个元素的贡献量级。 */
if (interaction.breakdown) {
  const bd = Object.fromEntries(interaction.breakdown.map(([k, mean, p50, p95]) => [k, { mean, p50, p95 }]));
  const sunOnly = bd['仅太阳'], neb = bd['+星云'], stars = bd['+星场'];
  const earth = bd['+地球'], bloom = bd['+辉光'], flare = bd['+光斑'];
  check(sunOnly.mean < 16, `空无一物的深空不够黑：mean ${sunOnly.mean}（应 < 16）`);
  check(sunOnly.p50 < 6, `深空中位亮度 ${sunOnly.p50} 偏高（应 < 6）`);
  check(sunOnly.p95 > 4, `太阳与其光晕没有出现在画面里：p95 ${sunOnly.p95}`);
  check(neb.p50 > 6 && neb.p50 < 46, `星云强度失衡：p50 ${neb.p50}（期望 6–46）`);
  check(neb.mean - sunOnly.mean > 4, `星云几乎不可见：仅贡献 ${(neb.mean - sunOnly.mean).toFixed(1)} 亮度`);
  check(stars.p95 > 55, `恒星亮度不足：p95 ${stars.p95}`);
  check(stars.p50 - neb.p50 < 26, `星场把整片天空糊亮了：中位亮度上升 ${(stars.p50 - neb.p50).toFixed(1)}`);
  check(earth.mean - stars.mean > 25, `地球未出现在画面中（亮度贡献仅 ${(earth.mean - stars.mean).toFixed(1)}）`);
  check(earth.p95 < 245, `地球云顶被削顶到 ${earth.p95}，丢失层次`);
  check(bloom.mean - earth.mean < 26, `泛光把画面整体抬亮了 ${(bloom.mean - earth.mean).toFixed(1)}，阈值/上限需要收紧`);
  check(flare.mean - bloom.mean < 14, `镜头光斑贡献过强：${(flare.mean - bloom.mean).toFixed(1)}`);
}

const consoleErrors = logs.filter((l) => ['error', 'exception'].includes(l.level));
check(consoleErrors.length === 0, `控制台存在 ${consoleErrors.length} 条错误`);

if (fails.length) {
  console.error(`\n✖ 无头自检失败（${fails.length} 项）：`);
  for (const f of fails) console.error(`  · ${f}`);
  dumpLogs();
  process.exit(1);
}

console.log(`\n✔ 无头自检通过
   渲染器      ${report.renderer}
   舱段        ${report.station.modules} 个 / ${report.station.voxels.toLocaleString('en-US')} 体素 / ${report.station.vramMB} MB 显存
   单帧        ${report.frame.drawCalls} 批次 · ${report.frame.triangles.toLocaleString('en-US')} 三角面 · ${report.frame.passes} 通道 · CPU ${report.frame.cpuMs} ms
   画面        非黑 ${(report.pixels.nonBlack * 100).toFixed(1)}% · 平均亮度 ${report.pixels.mean} · 色彩桶 ${report.pixels.unique} · 峰值 ${report.pixels.max.toFixed(0)}
   拾取        屏幕中心命中「${report.centerPick}」`);
process.exit(0);
