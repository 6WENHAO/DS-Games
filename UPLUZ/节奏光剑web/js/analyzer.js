/* ============================================================
 * analyzer.js — 本地音乐分析与自动谱面生成
 *   1. OfflineAudioContext 分频渲染（低频=鼓点 / 高频=明亮度）
 *   2. 能量包络 + 频谱通量 → 起始点(onset)强度
 *   3. 鼓点峰值间隔直方图 → BPM，网格相位对齐
 *   4. 按小节强度分配密度，生成方块/炸弹/光墙
 *   5. BPM + 明亮度 → 自动匹配场景意境(霓虹/水墨/星空)
 * ============================================================ */
"use strict";

function _mixdown(buffer) {
  const n = buffer.length, ch = buffer.numberOfChannels;
  const out = new Float32Array(n);
  for (let c = 0; c < ch; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < n; i++) out[i] += d[i] / ch;
  }
  return out;
}

async function _renderFiltered(buffer, type, freq) {
  const off = new OfflineAudioContext(1, buffer.length, buffer.sampleRate);
  const src = off.createBufferSource();
  src.buffer = buffer;
  const f = off.createBiquadFilter();
  f.type = type; f.frequency.value = freq;
  src.connect(f); f.connect(off.destination);
  src.start(0);
  const res = await off.startRendering();
  return res.getChannelData(0);
}

function _envelope(data, hop) {
  const n = Math.floor(data.length / hop);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const o = i * hop;
    for (let j = 0; j < hop; j += 4) { const v = data[o + j]; s += v * v; }
    env[i] = Math.sqrt(s / (hop / 4));
  }
  return env;
}

function _pickPeaks(env, dtHop, minDist) {
  const peaks = [];
  const w = Math.round(0.6 / dtHop);
  const minGap = Math.round(minDist / dtHop);
  let last = -minGap;
  for (let i = 2; i < env.length - 2; i++) {
    if (env[i] <= env[i - 1] || env[i] < env[i + 1]) continue;
    const a = Math.max(0, i - w), b = Math.min(env.length, i + w);
    let m = 0;
    for (let j = a; j < b; j++) m += env[j];
    m /= (b - a);
    if (env[i] > m * 1.5 && i - last >= minGap) {
      peaks.push({ t: i * dtHop, v: env[i] });
      last = i;
    }
  }
  return peaks;
}

function _detectBPM(peaks) {
  const cand = {};
  for (let i = 0; i < peaks.length; i++) {
    for (let j = i + 1; j < Math.min(i + 9, peaks.length); j++) {
      const iv = peaks[j].t - peaks[i].t;
      if (iv < 0.2 || iv > 4) continue;
      let bpm = 60 / iv;
      while (bpm < 75) bpm *= 2;
      while (bpm > 150) bpm /= 2;
      const key = Math.round(bpm);
      cand[key] = (cand[key] || 0) + 1 + peaks[i].v * peaks[j].v;
    }
  }
  let best = 120, bs = -1;
  for (const k in cand) {
    const kk = +k;
    const sc = (cand[kk - 1] || 0) + cand[kk] * 1.2 + (cand[kk + 1] || 0);
    if (sc > bs) { bs = sc; best = kk; }
  }
  return best;
}

/* 精细 BPM：在粗值 ±1.5 内以 0.02 步进，用圆均值求各候选的
 * 峰值对齐度(向量模长)与相位，取对齐度最高者 —— 消除整数取整漂移 */
function _refineBPM(peaks, bpmCoarse) {
  let best = { bpm: bpmCoarse, phase: 0, score: -1 };
  for (let bpm = bpmCoarse - 1.5; bpm <= bpmCoarse + 1.5; bpm += 0.02) {
    const spb = 60 / bpm;
    let sx = 0, sy = 0, w = 0;
    for (const p of peaks) {
      const a = (p.t % spb) / spb * 2 * Math.PI;
      sx += Math.cos(a) * p.v;
      sy += Math.sin(a) * p.v;
      w += p.v;
    }
    const mag = Math.hypot(sx, sy) / (w || 1);
    if (mag > best.score) {
      let ph = Math.atan2(sy, sx) / (2 * Math.PI) * spb;
      if (ph < 0) ph += spb;
      best = { bpm, phase: ph, score: mag };
    }
  }
  return best;
}

/* 逐拍跟踪：每拍在预测位置 ±15% 拍长内寻找通量峰值并缓慢校正，
 * 适应真实歌曲的轻微速度漂移，返回逐拍时间数组 */
function _trackBeats(flux, dtHop, spb, phase, duration) {
  let mean = 0;
  for (let i = 0; i < flux.length; i++) mean += flux[i];
  mean /= (flux.length || 1);
  const beats = [];
  let t = phase % spb;
  const win = Math.max(1, Math.round(0.15 * spb / dtHop));
  while (t < duration) {
    const c = Math.round(t / dtHop);
    let bi = c, bv = -1;
    for (let j = Math.max(1, c - win); j <= Math.min(flux.length - 1, c + win); j++) {
      if (flux[j] > bv) { bv = flux[j]; bi = j; }
    }
    if (bv > mean) t += (bi * dtHop - t) * 0.35; // 只在有明显鼓点时校正
    beats.push(t);
    t += spb;
  }
  return beats;
}

/* ------------------------------------------------------------
 * 谱面生成：8分音符网格 + 小节强度分级密度
 * ---------------------------------------------------------- */
function generateBeatmap(a) {
  const { spb, beats, flux, dtHop, duration } = a;
  // 8分音符槽位：逐拍跟踪的拍点 + 相邻拍中点（始终落在真实节拍网格上）
  const slots = [];
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    if (b < 1.2 || b > duration - 1.6) continue;
    const next = i + 1 < beats.length ? beats[i + 1] : b + spb;
    slots.push(b, (b + next) / 2);
  }
  if (slots.length <= 16) return { notes: [], walls: [] };

  // 槽位强度
  const gs = [];
  const win = Math.max(1, Math.round(0.045 / dtHop));
  for (let k = 0; k < slots.length; k++) {
    const c = Math.round(slots[k] / dtHop);
    let m = 0;
    for (let j = c - win; j <= c + win; j++) if ((flux[j] || 0) > m) m = flux[j];
    gs.push({ t: slots[k], k, s: m });
  }
  // 小节强度
  const nBars = Math.ceil(gs.length / 8);
  const barInt = new Float32Array(nBars);
  for (let b = 0; b < nBars; b++) {
    let s = 0;
    for (let j = b * 8; j < Math.min((b + 1) * 8, gs.length); j++) s += gs[j].s;
    barInt[b] = s;
  }
  const srt = Array.from(barInt).sort((x, y) => x - y);
  const pct = p => srt[Math.min(srt.length - 1, (p * srt.length) | 0)];
  const p20 = pct(0.2), p45 = pct(0.45), p75 = pct(0.75), p92 = pct(0.92);
  // 动态范围过小（响度平坦的曲子）→ 统一中等密度
  const flat = (p92 - p20) / (p92 + 1e-9) < 0.15;

  // 光墙：连续安静小节（间隔至少8小节）
  const walls = [];
  let lastWallBar = -99;
  for (let b = 3; b < nBars - 3; b++) {
    if (barInt[b] <= p20 && barInt[b + 1] <= p20 && b - lastWallBar >= 8 && gs[b * 8]) {
      walls.push({ t: gs[b * 8].t, dur: spb * 6, side: walls.length % 2 === 0 ? -1 : 1 });
      lastWallBar = b;
    }
  }
  const wallSide = t => {
    for (const w of walls)
      if (t > w.t - spb * 0.5 && t < w.t + w.dur + spb * 0.5) return w.side;
    return 0;
  };

  // 方块（复用镜像双剑规则：红剑竖直向 / 蓝剑方向自由）
  const rng = mulberry32((Math.floor(duration * 1000) ^ 0x9e3779) >>> 0);
  const notes = [];
  const lastDir = [1, 1];
  let hand = 0;
  function pickDir(h) {
    const prev = lastDir[h];
    let d = prev === 1 ? 0 : 1;
    const r = rng();
    if (r < 0.13) d = 8;
    else if (h === 1 && r > 0.82) d = [2, 3, 5, 7][(rng() * 4) | 0];
    if (d === 0 || d === 1) lastDir[h] = d;
    return d;
  }
  function pickPos(h, d) {
    const x = h === 0 ? (rng() < 0.62 ? 1 : 0) : (rng() < 0.62 ? 2 : 3);
    let y;
    if (d === 0) y = rng() < 0.6 ? 0 : 1;
    else if (d === 1) y = rng() < 0.55 ? 1 : (rng() < 0.5 ? 0 : 2);
    else y = rng() < 0.7 ? 1 : 0;
    return { x, y };
  }
  function add(t, x, y, type, dir) {
    for (const n of notes)
      if (Math.abs(n.t - t) < spb * 0.4 && n.x === x && n.y === y) return;
    notes.push({ t, x, y, type, dir });
  }
  function single(t) {
    const ws = wallSide(t);
    let h = hand; hand = 1 - hand;
    if (ws === -1) h = 1;
    else if (ws === 1) h = 0;
    const d = pickDir(h);
    const p = pickPos(h, d);
    add(t, p.x, p.y, h, d);
  }
  function dbl(t) {
    if (wallSide(t) !== 0) { single(t); return; }
    const r = rng();
    let dl, dr;
    if (r < 0.5) { dl = 1; dr = 1; }
    else if (r < 0.75) { dl = 0; dr = 0; }
    else { dl = 6; dr = 7; }
    const y = dl === 0 ? 0 : 1;
    add(t, 1, y, 0, dl);
    add(t, 2, y, 1, dr);
    lastDir[0] = lastDir[1] = (dl === 0 ? 0 : 1);
  }

  const maxPerBar = spb < 0.43 ? 4 : spb < 0.5 ? 6 : 8;
  for (let b = 0; b < nBars; b++) {
    const I = barInt[b];
    const level = flat ? 4 : (I <= p20 ? 1 : I <= p45 ? 2 : I <= p75 ? 4 : I <= p92 ? 6 : 8);
    const want = Math.min(maxPerBar, level);
    const cands = [];
    for (let j = b * 8; j < Math.min((b + 1) * 8, gs.length); j++) cands.push(gs[j]);
    cands.sort((x, y) => y.s - x.s);
    const chosen = cands.slice(0, want).filter(c => c.s > 0);
    chosen.sort((x, y) => x.k - y.k);
    const isPeak = I > p92;
    for (const c of chosen) {
      if (isPeak && c.k % 8 === 0) dbl(c.t);
      else single(c.t);
    }
    // 炸弹：安静小节中点
    if (I <= p20 && chosen.length <= 1 && rng() < 0.4 && gs[b * 8 + 4]) {
      const bt = gs[b * 8 + 4].t;
      if (!notes.some(n => Math.abs(n.t - bt) < spb)) {
        add(bt, 1, 2, 3, 8);
        add(bt, 2, 2, 3, 8);
      }
    }
  }
  notes.sort((x, y) => x.t - y.t);
  return { notes, walls };
}

/* ------------------------------------------------------------
 * 总入口
 * ---------------------------------------------------------- */
async function analyzeAudioBuffer(buffer, progress) {
  const sr = buffer.sampleRate, hop = 1024, dtHop = hop / sr;
  if (progress) progress("分离频段…");
  const mono = _mixdown(buffer);
  const low = await _renderFiltered(buffer, "lowpass", 150);
  const high = await _renderFiltered(buffer, "highpass", 6000);
  if (progress) progress("分析节拍…");
  await new Promise(r => setTimeout(r, 20));
  const envM = _envelope(mono, hop);
  const envL = _envelope(low, hop);
  const envH = _envelope(high, hop);
  const flux = new Float32Array(envM.length);
  for (let i = 1; i < envM.length; i++) {
    flux[i] = Math.max(0, envM[i] - envM[i - 1])
            + 0.8 * Math.max(0, envL[i] - envL[i - 1])
            + 0.5 * Math.max(0, envH[i] - envH[i - 1]);
  }
  let peaks = _pickPeaks(envL, dtHop, 0.24);
  if (peaks.length < 20) peaks = _pickPeaks(flux, dtHop, 0.18);
  const bpmCoarse = _detectBPM(peaks);
  const fine = _refineBPM(peaks, bpmCoarse);
  const spb = 60 / fine.bpm;
  const beats = _trackBeats(flux, dtHop, spb, fine.phase, buffer.duration);
  if (progress) progress("生成谱面…");
  await new Promise(r => setTimeout(r, 20));
  const map = generateBeatmap({ spb, beats, flux, dtHop, duration: buffer.duration });
  const mean = arr => { let s = 0; for (const v of arr) s += v; return s / (arr.length || 1); };
  const bright = mean(envH) / (mean(envM) + 1e-9);
  const bpm = Math.round(fine.bpm * 10) / 10;
  const mood = (bpm >= 116 && bright > 0.10) ? "neon" : (bpm <= 96 ? "ink" : "space");
  return {
    bpm, spb, phase: beats.length ? beats[0] % spb : 0, mood, bright,
    notes: map.notes, walls: map.walls, duration: buffer.duration
  };
}
