/**
 * tools/probe.mjs —— 无头浏览器 WebGL2 能力探测
 *
 * 依次尝试若干命令行开关组合，找出当前机器上能取得 WebGL2 软件渲染的配置。
 * 用途：为 tools/headless.mjs 选择正确的开关，并在排查兼容性时快速定位。
 *
 * 用法：node tools/probe.mjs [--url http://127.0.0.1:8181/tools/glprobe.html]
 */

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const argv = process.argv.slice(2);
const url = argv.includes('--url') ? argv[argv.indexOf('--url') + 1] : 'http://127.0.0.1:8181/tools/glprobe.html';

export const BROWSER_CANDIDATES = [
  path.join(process.env['ProgramFiles'] || '', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['LOCALAPPDATA'] || '', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env['ProgramFiles'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft/Edge/Application/msedge.exe'),
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

export const findBrowser = () => BROWSER_CANDIDATES.find((p) => p && existsSync(p));

/** 候选开关组合，按"越靠前越优"排列 */
export const FLAG_SETS = [
  ['--enable-unsafe-swiftshader'],
  ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
  ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
  ['--enable-unsafe-swiftshader', '--disable-gpu'],
  ['--enable-unsafe-swiftshader', '--use-angle=swiftshader-webgl'],
  ['--use-gl=swiftshader-webgl', '--enable-unsafe-swiftshader'],
  ['--enable-unsafe-swiftshader', '--disable-software-rasterizer'],
  [],
];

/**
 * 用指定开关加载 URL 并抓取 DOM。
 * @returns {Promise<{dom:string, err:string, code:number}>}
 */
export async function dumpDom(browser, flags, target, { extra = [], timeoutMs = 90000 } = {}) {
  const profile = mkdtempSync(path.join(tmpdir(), 'vss-probe-'));
  const args = [
    '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--no-first-run',
    '--disable-extensions', '--mute-audio', '--hide-scrollbars',
    `--user-data-dir=${profile}`, '--dump-dom',
    ...flags, ...extra, target,
  ];
  const child = spawn(browser, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let dom = '', err = '';
  child.stdout.on('data', (d) => { dom += d; });
  child.stderr.on('data', (d) => { err += d; });
  const killer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
  const code = await new Promise((res) => child.on('close', res));
  clearTimeout(killer);
  rmSync(profile, { recursive: true, force: true });
  return { dom, err, code };
}

export const extractPre = (dom, id) => {
  const m = dom.match(new RegExp(`<pre id="${id}"[^>]*>([\\s\\S]*?)</pre>`));
  if (!m) return null;
  return m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
};

/* ── 直接运行时：遍历所有组合 ── */
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` ||
    process.argv[1].endsWith('probe.mjs')) {
  const browser = findBrowser();
  if (!browser) { console.error('未找到 Chrome / Edge'); process.exit(2); }
  console.log(`浏览器：${browser}`);
  console.log(`探针：  ${url}\n`);
  let best = null;
  for (const flags of FLAG_SETS) {
    const label = flags.length ? flags.join(' ') : '(无额外开关)';
    const { dom } = await dumpDom(browser, flags, url, { timeoutMs: 60000 });
    const raw = extractPre(dom, 'probe');
    if (!raw) { console.log(`✖ ${label}\n    未取得探针结果`); continue; }
    const r = JSON.parse(raw);
    const ok = r.webgl2 && r.glsl300 && r.colorBufferFloat;
    console.log(`${ok ? '✔' : '·'} ${label}`);
    console.log(`    ${JSON.stringify(r)}`);
    if (ok && !best) best = { flags, r };
  }
  if (best) {
    console.log(`\n✔ 推荐开关：${best.flags.join(' ') || '(无)'}`);
    console.log(`  渲染器：${best.r.renderer}`);
  } else {
    console.log('\n✖ 未找到可用的软件 WebGL2 配置');
    process.exit(1);
  }
}
