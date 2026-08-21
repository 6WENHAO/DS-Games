/**
 * fetch-imagery.mjs — 抓取全部装备的真实照片并本地化
 *   来源: 360 图片搜索 (image.so.com) —— 返回结构化 JSON，含尺寸与标题
 *   产出: assets/photo/<id>_<n>.jpg   +   js/imagery.js (映射表 + 出处标注)
 *
 * 用法: node tools/fetch-imagery.mjs [--only=J-20A,DDG-055] [--per=3] [--force]
 */
import fs from 'node:fs';
import path from 'node:path';
import { QUERIES } from './img-queries.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTDIR = path.join(ROOT, 'assets', 'photo');
const OUTJS = path.join(ROOT, 'js', 'imagery.js');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

const args = process.argv.slice(2);
const only = (args.find(a => a.startsWith('--only=')) || '').replace('--only=', '').split(',').filter(Boolean);
const PER = Number((args.find(a => a.startsWith('--per=')) || '--per=3').split('=')[1]);
const FORCE = args.includes('--force');
const MAXBYTES = 340 * 1024;

fs.mkdirSync(OUTDIR, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function jget(url, ref) {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': '*/*', 'Accept-Language': 'zh-CN,zh;q=0.9', ...(ref ? { Referer: ref } : {}) },
    redirect: 'follow', signal: AbortSignal.timeout(20000)
  });
  return r;
}

/* --- 360 图片搜索 --- */
async function search(q) {
  const u = 'https://image.so.com/j?q=' + encodeURIComponent(q) + '&src=srp&sn=0&pn=28';
  try {
    const r = await jget(u, 'https://image.so.com/i?q=' + encodeURIComponent(q));
    const j = JSON.parse(await r.text());
    return (j.list || []).map(o => ({
      full: o.img || o.https || o.http,
      thumb: o.thumb || o._thumb,
      w: Number(o.width) || 0, h: Number(o.height) || 0,
      title: (o.title || o.litetitle || '').replace(/<[^>]+>/g, '').slice(0, 90),
      site: o.site || o.dspurl || '', link: o.link || ''
    })).filter(o => o.full);
  } catch (e) { return []; }
}

/* --- 候选筛选: 偏好横向照片、中等分辨率(体积可控)、排除表情包/logo/异常比例 --- */
function score(c) {
  if (!c.w || !c.h) return -1;
  const ar = c.w / c.h;
  if (ar < 1.05 || ar > 3.1) return -1;              // 排除竖图与超宽横幅
  if (c.w < 560) return -1;                           // 分辨率过低
  let s = 20;
  if (c.w >= 700 && c.w <= 1500) s += 18;             // 甜点区: 清晰且文件不大
  else if (c.w > 1500 && c.w <= 2200) s += 6;
  else if (c.w > 2200) s -= 6;
  if (ar > 1.3 && ar < 2.1) s += 12;                  // 常见照片比例加权
  if (/表情|头像|简笔|涂色|logo|手机壁纸|模型玩具|拼装|乐高|游戏截图|漫画|插画|示意图|对比图/.test(c.title)) s -= 45;
  if (/(军事|海军|空军|陆军|战机|战舰|舰艇|导弹|飞弹|试射|服役|首飞|演习|下水|交付|部署|军演|实弹)/.test(c.title)) s += 10;
  return s;
}

function extOf(ct, url) {
  if (/png/i.test(ct)) return '.png';
  if (/webp/i.test(ct)) return '.webp';
  if (/gif/i.test(ct)) return '.gif';
  if (/\.png(\?|$)/i.test(url)) return '.png';
  return '.jpg';
}
function looksImage(buf, ct) {
  if (buf.length < 6000) return false;
  if (/^image\//i.test(ct || '')) return true;
  const b = buf;
  if (b[0] === 0xFF && b[1] === 0xD8) return true;                    // jpeg
  if (b[0] === 0x89 && b[1] === 0x50) return true;                    // png
  if (b.slice(0, 4).toString('ascii') === 'RIFF') return true;        // webp
  return false;
}

async function download(url, dest) {
  const r = await jget(url, 'https://image.so.com/');
  if (!r.ok) throw new Error('http ' + r.status);
  const ct = r.headers.get('content-type') || '';
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAXBYTES) throw new Error('too big ' + buf.length);
  if (!looksImage(buf, ct)) throw new Error('not image (' + ct + ',' + buf.length + ')');
  const file = dest + extOf(ct, url);
  fs.writeFileSync(file, buf);
  return { file: path.basename(file), bytes: buf.length };
}

/* ---------------- 主流程 ---------------- */
const ids = Object.keys(QUERIES).filter(id => !only.length || only.includes(id));
const manifest = {};
let okN = 0, failN = 0, totalBytes = 0;

// 载入已有 manifest 以支持增量
let prev = {};
if (fs.existsSync(OUTJS) && !FORCE) {
  try {
    const src = fs.readFileSync(OUTJS, 'utf8');
    const m = src.match(/TWG\.IMAGERY\s*=\s*(\{[\s\S]*?\});/);
    if (m) prev = JSON.parse(m[1]);
  } catch (e) { }
}

for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  const [q1, q2] = QUERIES[id];
  const existing = prev[id];
  if (existing && existing.photos && existing.photos.length >= PER && !FORCE &&
    existing.photos.every(p => fs.existsSync(path.join(OUTDIR, p.f)))) {
    manifest[id] = existing; okN++;
    process.stdout.write(`[${i + 1}/${ids.length}] ${id} 已有 ${existing.photos.length} 张，跳过\n`);
    continue;
  }
  let cands = await search(q1);
  if (cands.length < 6 && q2) { await sleep(250); cands = cands.concat(await search(q2)); }
  cands = cands.map(c => ({ ...c, s: score(c) })).filter(c => c.s > 0).sort((a, b) => b.s - a.s);
  const photos = [];
  const seen = new Set();
  for (const c of cands) {
    if (photos.length >= PER) break;
    if (seen.has(c.full)) continue;
    seen.add(c.full);
    try {
      const dest = path.join(OUTDIR, id.replace(/[^\w-]/g, '_') + '_' + (photos.length + 1));
      const r = await download(c.full, dest);
      photos.push({ f: r.file, w: c.w, h: c.h, t: c.title, src: c.site || '网络公开图片', link: c.link });
      totalBytes += r.bytes;
    } catch (e) {
      // 全图失败则退回缩略图
      if (c.thumb) {
        try {
          const dest2 = path.join(OUTDIR, id.replace(/[^\w-]/g, '_') + '_' + (photos.length + 1));
          const r2 = await download(c.thumb, dest2);
          photos.push({ f: r2.file, w: c.w, h: c.h, t: c.title, src: c.site || '网络公开图片', link: c.link });
          totalBytes += r2.bytes;
        } catch (e2) { }
      }
    }
    await sleep(120);
  }
  if (photos.length) { manifest[id] = { q: q1, photos }; okN++; }
  else { failN++; }
  process.stdout.write(`[${i + 1}/${ids.length}] ${id}  ${photos.length ? '✓ ' + photos.length + ' 张' : '✗ 未获取'}  «${q1}»\n`);
  await sleep(220);
}

const body = `/* 自动生成 by tools/fetch-imagery.mjs — 装备真实照片索引
 * 图片来源: 公开网络检索（360 图片），仅用于学术性兵棋推演的装备识别参考。
 * 版权归原作者/原出处所有；如需商用请自行替换为授权素材。
 * 字段: q=检索词  photos[].f=文件名  w/h=原始尺寸  t=图片标题  src=来源站点  link=原页面
 */
(function (root) {
  'use strict';
  var TWG = root.TWG = root.TWG || {};
  TWG.IMAGERY_DIR = 'assets/photo/';
  TWG.IMAGERY = ${JSON.stringify(manifest, null, 1)};
  TWG.photosOf = function (cls) {
    var e = TWG.IMAGERY[cls];
    if (!e || !e.photos) return [];
    return e.photos.map(function (p) {
      return { url: TWG.IMAGERY_DIR + p.f, title: p.t, src: p.src, link: p.link, w: p.w, h: p.h };
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(OUTJS, body, 'utf8');
console.log('-'.repeat(70));
console.log(`完成: ${okN} 型有图 / ${failN} 型无图，共 ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
console.log('写入', OUTJS);
