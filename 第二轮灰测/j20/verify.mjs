/* 端到端验证：用无头 Edge 真正加载 j20.html
 * 1) --dump-dom 抓取页面自诊断属性（渲染是否成功 / 有无异常 / 网格与绘制统计）
 * 2) 两次截图（有机体 / 无机体）相减，精确得到机体在画面中的占比与包围盒
 * 3) 分区亮度统计，确认天空—地面—机体的明暗关系合理
 * 注：沙箱禁止用管道捕获子进程输出，因此把 stdout 直接重定向到文件描述符 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const url = (q) => 'file:///' + path.join(dir, 'j20.html').replace(/\\/g, '/') + (q ? '?' + q : '');
const profile = path.join(dir, '.edge-profile');
const errFile = path.join(dir, '.edge-stderr.txt');
const W = 1400, H = 900;

const COMMON = [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=angle', '--use-angle=swiftshader',
  '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--hide-scrollbars', '--mute-audio', '--disable-lcd-text',
  '--allow-file-access-from-files', `--user-data-dir=${profile}`, `--window-size=${W},${H}`,
];
function runEdge(extra, page, outFile) {
  const fd = outFile ? fs.openSync(outFile, 'w') : 'ignore';
  const efd = fs.openSync(errFile, 'w');
  try {
    execFileSync(EDGE, [...COMMON, ...extra, page], { stdio: ['ignore', fd, efd], timeout: 300000 });
  } finally { if (outFile) fs.closeSync(fd); fs.closeSync(efd); }
}

const problems = [];
const ok = (c, m) => { if (!c) problems.push(m); };

/* ---------------------------- 1. DOM 自诊断 ---------------------------- */
const domFile = path.join(dir, '.dom.html');
let dom = '';
try { runEdge(['--dump-dom'], url(), domFile); dom = fs.readFileSync(domFile, 'utf8'); }
catch (e) { problems.push('无头浏览器执行失败：' + (e.message || e)); }

const attr = (n) => { const m = dom.match(new RegExp(`data-${n}="([^"]*)"`)); return m ? m[1] : null; };
ok(!attr('error'), '页面报错：' + attr('error'));
ok(attr('render') === 'ok', '未能完成首帧渲染（data-render 缺失）');
const meshes = +attr('meshes'), tris = +attr('tris'), calls = +attr('calls'), progs = +attr('progs');
ok(meshes > 80, `网格数异常：${meshes}`);
ok(tris > 8000, `三角面数异常：${tris}`);
ok(calls > 40, `渲染 draw call 异常：${calls}`);
ok(progs > 5, `着色器程序数异常：${progs}（着色器可能编译失败）`);
ok(/three\.js r160/.test(dom), '未检测到 three.js r160 初始化标记');
ok(!/正在生成机体几何/.test(dom), '启动遮罩未被移除');
const btnCount = (dom.match(/class="btn"/g) || []).length;
ok(btnCount >= 13, `UI 按钮数量异常：${btnCount}`);

/* ---------------------------- 2. PNG 解码 ---------------------------- */
function decodePNG(file) {
  const buf = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, bit = 0, type = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), tag = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (tag === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bit = data[8]; type = data[9]; }
    if (tag === 'IDAT') idat.push(data);
    if (tag === 'IEND') break;
    p += 12 + len;
  }
  if (bit !== 8) throw new Error('位深不支持: ' + bit);
  const ch = type === 6 ? 4 : type === 2 ? 3 : 0;
  if (!ch) throw new Error('色彩类型不支持: ' + type);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? out[y * stride + i - ch] : 0;
      const b = y > 0 ? out[(y - 1) * stride + i] : 0;
      const c = i >= ch && y > 0 ? out[(y - 1) * stride + i - ch] : 0;
      let v = src[i];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + i] = v & 0xff;
    }
  }
  const lum = (x, y) => { const i = (y * w + x) * ch; return 0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2]; };
  return { w, h, ch, px: out, lum };
}

/* -------------------- 3. 两次截图：有机体 / 无机体 -------------------- */
const shotA = path.join(dir, '.shot.png'), shotB = path.join(dir, '.shot-noplane.png');
let A, B;
try {
  fs.rmSync(shotA, { force: true }); fs.rmSync(shotB, { force: true });
  runEdge([`--screenshot=${shotA}`], url());
  runEdge([`--screenshot=${shotB}`], url('noplane=1'));
  A = decodePNG(shotA); B = decodePNG(shotB);
} catch (e) { problems.push('截图失败：' + (e.message || e)); }

let info = [];
if (A && B) {
  ok(A.w === W && A.h >= 800, `截图尺寸异常 ${A.w}x${A.h}`);
  /* 3a. 分区亮度（避开左上标题卡、底部控制条与右下提示卡） */
  const band = (x0, x1, y0, y1) => {
    let s = 0, n = 0;
    for (let y = Math.floor(A.h * y0); y < Math.floor(A.h * y1); y += 2)
      for (let x = Math.floor(A.w * x0); x < Math.floor(A.w * x1); x += 2) { s += A.lum(x, y); n++; }
    return s / n;
  };
  const skyL = band(0.40, 0.96, 0.03, 0.14);
  const midL = band(0.20, 0.80, 0.30, 0.62);
  const gndL = band(0.01, 0.14, 0.86, 0.98);
  ok(skyL > 90, `天空过暗：平均亮度 ${skyL.toFixed(1)}（应 >90）`);
  ok(gndL > 45, `地面过暗：平均亮度 ${gndL.toFixed(1)}（应 >45）`);
  ok(gndL < 210, `地面过曝：平均亮度 ${gndL.toFixed(1)}`);
  ok(skyL > gndL + 10, `天空应亮于地面（天空 ${skyL.toFixed(1)} vs 地面 ${gndL.toFixed(1)}）`);
  info.push(`分区亮度：天空 ${skyL.toFixed(1)} / 中部 ${midL.toFixed(1)} / 地面 ${gndL.toFixed(1)}`);

  /* 3b. 差分求机体轮廓（贴图已用固定种子，两次渲染完全可比） */
  let diff = 0, shadow = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, total = 0;
  for (let y = 0; y < A.h; y++) for (let x = 0; x < A.w; x++) {
    total++;
    const i = (y * A.w + x) * A.ch, j = (y * B.w + x) * B.ch;
    const d = Math.abs(A.px[i] - B.px[j]) + Math.abs(A.px[i + 1] - B.px[j + 1]) + Math.abs(A.px[i + 2] - B.px[j + 2]);
    if (d > 24) {
      diff++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (A.lum(x, y) < B.lum(x, y) - 18) shadow++;      // 变暗的像素 = 机体自身或投影
    }
  }
  const cover = diff / total;
  ok(cover > 0.04 && cover < 0.40, `机体+阴影占屏比例异常：${(cover * 100).toFixed(1)}%`);
  const bw = x1 - x0, bh = y1 - y0;
  ok(bw > A.w * 0.35, `机体横向尺寸过小：${bw}px`);
  ok(bh > A.h * 0.12, `机体纵向尺寸过小：${bh}px`);
  ok(bw / bh > 1.2 && bw / bh < 4.5, `机体包围盒长宽比异常：${(bw / bh).toFixed(2)}`);
  const cx = (x0 + x1) / 2 / A.w, cy = (y0 + y1) / 2 / A.h;
  ok(cx > 0.3 && cx < 0.7 && cy > 0.25 && cy < 0.85, `机体不在画面中心区：中心 (${cx.toFixed(2)},${cy.toFixed(2)})`);
  ok(shadow / total > 0.02, `变暗像素过少（${(shadow / total * 100).toFixed(1)}%），机体或投影可能没画出来`);
  info.push(`机体差分：占屏 ${(cover * 100).toFixed(1)}%（其中变暗 ${(shadow / total * 100).toFixed(1)}%），` +
    `包围盒 ${bw}×${bh}px，长宽比 ${(bw / bh).toFixed(2)}，中心 (${cx.toFixed(2)},${cy.toFixed(2)})`);

  /* 3c. 颜色丰富度 */
  const bins = new Set();
  for (let y = 0; y < A.h; y += 2) for (let x = 0; x < A.w; x += 2) {
    const i = (y * A.w + x) * A.ch;
    bins.add((A.px[i] >> 4) << 8 | (A.px[i + 1] >> 4) << 4 | (A.px[i + 2] >> 4));
  }
  ok(bins.size > 120, `画面颜色种类过少（${bins.size}）`);
  info.push(`颜色簇 ${bins.size}`);
}

/* ------------------- 4. 交互状态分支：逐个构型真跑一遍 ------------------- */
const configs = [
  ['弹舱开启 + 挂弹', 'bay=1'],
  ['起落架收起', 'gear=0'],
  ['飞行姿态 + 加力', 'flight=1&ab=1&gear=0'],
  ['线框模式', 'wire=1'],
  ['座舱特写', 'bay=1&ab=0'],
];
const stateInfo = [];
for (const [label, qs] of configs) {
  const dm = path.join(dir, `.dom-${qs.replace(/[=&]/g, '_')}.html`);
  const sp = path.join(dir, `.shot-${qs.replace(/[=&]/g, '_')}.png`);
  try {
    runEdge(['--dump-dom'], url(qs), dm);
    const d = fs.readFileSync(dm, 'utf8');
    const e = (d.match(/data-error="([^"]*)"/) || [])[1];
    ok(!e, `构型「${label}」报错：${(e || '').slice(0, 160)}`);
    ok(/data-render="ok"/.test(d), `构型「${label}」未完成渲染`);
    fs.rmSync(sp, { force: true });
    runEdge([`--screenshot=${sp}`], url(qs));
    const C = decodePNG(sp);
    let d2 = 0;
    for (let y = 0; y < C.h; y += 2) for (let x = 0; x < C.w; x += 2) {
      const i = (y * C.w + x) * C.ch, j = (y * A.w + x) * A.ch;
      if (Math.abs(C.px[i] - A.px[j]) + Math.abs(C.px[i + 1] - A.px[j + 1]) + Math.abs(C.px[i + 2] - A.px[j + 2]) > 24) d2++;
    }
    const pct = d2 / (C.w * C.h / 4) * 100;
    ok(pct > 0.3, `构型「${label}」画面与默认状态几乎无差异（${pct.toFixed(2)}%），开关可能没生效`);
    stateInfo.push(`  ${label}：渲染正常，画面差异 ${pct.toFixed(1)}%`);
  } catch (err) { problems.push(`构型「${label}」执行失败：${err.message || err}`); }
}

/* --------- 5. 定向差分：腹视下开/关弹舱，确认舱门与挂弹真的动了 --------- */
try {
  const p0 = path.join(dir, '.belly-closed.png'), p1 = path.join(dir, '.belly-open.png');
  fs.rmSync(p0, { force: true }); fs.rmSync(p1, { force: true });
  runEdge([`--screenshot=${p0}`], url('cam=belly&bay=0'));
  runEdge([`--screenshot=${p1}`], url('cam=belly&bay=1'));
  const C0 = decodePNG(p0), C1 = decodePNG(p1);
  let d = 0, n = 0;
  for (let y = 0; y < C0.h; y += 2) for (let x = 0; x < C0.w; x += 2) {
    n++;
    const i = (y * C0.w + x) * C0.ch;
    if (Math.abs(C0.px[i] - C1.px[i]) + Math.abs(C0.px[i + 1] - C1.px[i + 1]) + Math.abs(C0.px[i + 2] - C1.px[i + 2]) > 24) d++;
  }
  const pct = d / n * 100;
  ok(pct > 1.5, `腹视下开关弹舱画面差异仅 ${pct.toFixed(2)}%，舱门可能没有真正打开`);
  stateInfo.push(`  腹视开/闭弹舱差异 ${pct.toFixed(1)}%（舱门 + 挂弹可见）`);
} catch (e) { problems.push('腹视弹舱验证失败：' + (e.message || e)); }

/* ------------------------------- 输出 ------------------------------- */
console.log(`无头渲染：网格 ${meshes} · 三角面 ${tris} · draw call ${calls} · 着色器程序 ${progs} · UI 按钮 ${btnCount}`);
console.log(`GPU 后端：${attr('gpu')}`);
info.forEach((l) => console.log(l));
if (stateInfo.length) { console.log('交互状态分支：'); stateInfo.forEach((l) => console.log(l)); }
if (problems.length) { console.log(`\n发现 ${problems.length} 个问题：`); problems.forEach((p) => console.log(' - ' + p)); process.exitCode = 1; }
else console.log('\n端到端验证通过。');
