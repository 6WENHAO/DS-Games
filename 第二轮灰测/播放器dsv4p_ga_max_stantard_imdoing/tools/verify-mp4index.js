/**
 * tools/verify-mp4index.js — 用 ffprobe 的逐帧时间戳校验自研 MP4 索引器
 *
 * 这是开发期的「地面真值」测试：播放器运行时完全不需要 ffmpeg/ffprobe。
 * 用法： node tools/verify-mp4index.js tests/fixtures/*.mp4 media/*.mp4
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

require(path.join(__dirname, '..', 'src', 'core', 'ns.js'));
const Mp4Index = require(path.join(__dirname, '..', 'src', 'core', 'mp4index.js'));

function ffprobeFrames(file) {
  // 注意：ffprobe 的 csv 输出字段顺序不按 -show_entries 的书写顺序，必须用 json 按名取值
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'frame=best_effort_timestamp_time,key_frame',
    '-of', 'json', file
  ], { maxBuffer: 1 << 28 }).toString();
  const frames = (JSON.parse(out).frames || []).map((f) => ({
    t: parseFloat(f.best_effort_timestamp_time),
    key: Number(f.key_frame) === 1
  })).filter((f) => isFinite(f.t));
  frames.sort((a, b) => a.t - b.t); // 显示顺序
  return { times: frames.map((f) => f.t), keys: frames.map((f, i) => (f.key ? i : -1)).filter((i) => i >= 0) };
}

function ffprobeStream(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=avg_frame_rate,r_frame_rate,nb_frames,width,height,codec_name,duration',
    '-of', 'default=nw=1', file
  ]).toString();
  const o = {};
  out.split('\n').forEach((l) => {
    const i = l.indexOf('=');
    if (i > 0) o[l.slice(0, i)] = l.slice(i + 1).trim();
  });
  return o;
}

function ratio(s) {
  if (!s) return NaN;
  const [a, b] = s.split('/').map(Number);
  return b ? a / b : a;
}

(async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('用法: node tools/verify-mp4index.js <file.mp4> [...]');
    process.exit(2);
  }
  let failures = 0;
  for (const file of files) {
    if (!fs.existsSync(file)) { console.log(`SKIP  ${file} (不存在)`); continue; }
    const buf = fs.readFileSync(file);
    const idx = await Mp4Index.fromArrayBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const truth = ffprobeFrames(file);
    const st = ffprobeStream(file);
    const probeFps = ratio(st.r_frame_rate);

    console.log('\n=== ' + path.basename(file) + ' ===');
    if (!idx) {
      console.log('  ✗ 解析返回 null');
      failures++;
      continue;
    }
    const problems = [];
    if (idx.frameCount !== truth.times.length) {
      problems.push(`帧数 ${idx.frameCount} != ffprobe ${truth.times.length}`);
    }
    let maxErr = 0, maxAt = -1;
    const n = Math.min(idx.frameCount, truth.times.length);
    for (let i = 0; i < n; i++) {
      const e = Math.abs(idx.times[i] - truth.times[i]);
      if (e > maxErr) { maxErr = e; maxAt = i; }
    }
    const tol = 1e-6;
    if (maxErr > tol) problems.push(`时间戳最大误差 ${maxErr.toExponential(3)}s @frame ${maxAt} (容差 ${tol})`);

    const keyOk = idx.keyframes.length === truth.keys.length &&
      Array.from(idx.keyframes).every((v, i) => v === truth.keys[i]);
    if (!keyOk) problems.push(`关键帧不一致: 本地 ${idx.keyframes.length} 个 [${Array.from(idx.keyframes).slice(0, 8)}] vs ffprobe ${truth.keys.length} 个 [${truth.keys.slice(0, 8)}]`);

    if (!idx.vfr && isFinite(probeFps) && Math.abs(idx.fps - probeFps) / probeFps > 1e-6) {
      problems.push(`帧率 ${idx.fps} != ffprobe r_frame_rate ${probeFps}`);
    }
    console.log(`  结构=${idx.structure} 编解码=${idx.codec} ${idx.width}x${idx.height} 时间基=${idx.timescale}`);
    console.log(`  帧数=${idx.frameCount} 帧率=${idx.fps}${idx.vfr ? ' (VFR)' : ''} 时长=${idx.duration.toFixed(6)}s 关键帧=${idx.keyframes.length} 码率≈${(idx.avgBitrate / 1000).toFixed(0)}kbps`);
    console.log(`  时间戳最大误差=${maxErr.toExponential(3)}s  编辑列表偏移=${idx.editOffsetSec.toFixed(6)}s`);
    if (problems.length) { problems.forEach((p) => console.log('  ✗ ' + p)); failures++; }
    else console.log('  ✓ 与 ffprobe 逐帧一致');
  }
  console.log('\n' + (failures ? `✗ ${failures} 个文件不一致` : '✓ 全部文件通过'));
  process.exit(failures ? 1 : 0);
})();
