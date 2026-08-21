/* 无头浏览器探针：先用极小页面确认 WebGL2 软件后端可用，再跑真实页面 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const target = process.argv[2] || '.probe.html';
const budgetMs = Number(process.argv[3] || 240000);
const page = 'file:///' + path.join(dir, target).replace(/\\/g, '/');
const domFile = path.join(dir, '.dom.html');
const errFile = path.join(dir, '.edge-stderr.txt');

const args = [
  '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-gl=angle', '--use-angle=swiftshader',
  '--no-sandbox', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--hide-scrollbars', '--mute-audio',
  '--allow-file-access-from-files', '--disable-lcd-text',
  `--user-data-dir=${path.join(dir, '.edge-profile')}`,
  '--window-size=1400,900', '--dump-dom', page,
];

const outFd = fs.openSync(domFile, 'w');
const errFd = fs.openSync(errFile, 'w');
const t0 = Date.now();
let status = 'ok';
try {
  execFileSync(EDGE, args, { stdio: ['ignore', outFd, errFd], timeout: budgetMs });
} catch (e) { status = e.code || e.message; }
fs.closeSync(outFd); fs.closeSync(errFd);
const dt = ((Date.now() - t0) / 1000).toFixed(1);
const dom = fs.readFileSync(domFile, 'utf8');
const err = fs.readFileSync(errFile, 'utf8');

console.log(`目标 ${target}  用时 ${dt}s  状态 ${status}  DOM ${dom.length} B`);
for (const m of dom.matchAll(/data-([a-z]+)="([^"]*)"/g)) console.log(`  data-${m[1]} = ${m[2].slice(0, 160)}`);
if (!dom.length) console.log('  ⚠ DOM 为空');
const lines = err.split('\n').filter((l) => /ERROR|WARN|error|Fatal/.test(l)).slice(0, 12);
if (lines.length) { console.log('  stderr:'); lines.forEach((l) => console.log('    ' + l.trim().slice(0, 180))); }
