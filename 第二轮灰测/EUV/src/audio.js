/**
 * audio.js — 程序化原创音频（配乐 / 音效 / 分轨导出）
 * ==================================================================
 * 规格书 §1.3「全程无侵权：音乐、音效均须原创」。
 * 因此本项目不使用任何第三方音乐或音效素材：所有声音都由 WebAudio
 * 的振荡器、噪声整形与程序化生成的卷积脉冲实时合成。
 *
 * 规格书 §2 音频交付要求「音乐、音效、配音干轨及混音母带分轨」：
 * renderStems() 用 OfflineAudioContext 分别离线渲染 music / sfx / mix
 * 三条轨道并导出 48 kHz 24-bit WAV，同时给出近似响度测量。
 * 权威响度以 ffmpeg loudnorm 复核（见 delivery/scripts）。
 *
 * 音画同步：所有提示点来自 script.allAudioCues()，与画面同一真源。
 */

import { allAudioCues, TIMELINE } from './script.js';
import { FILM } from './config.js';

const SR = 48000;

// ═══════════════════════════════════════════════════════════════════
// 程序化卷积脉冲（替代第三方 IR 采样）
// ═══════════════════════════════════════════════════════════════════
function makeImpulse(ctx, { seconds = 2.6, decay = 3.2, preDelay = 0.012 } = {}) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  const pd = Math.floor(ctx.sampleRate * preDelay);
  // 确定性伪随机，保证每次渲染的混响完全一致
  let s = 0x9e3779b9;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      if (i < pd) { d[i] = 0; continue; }
      const t = (i - pd) / (len - pd);
      // 早期反射簇 + 指数衰减扩散场
      const env = Math.pow(1 - t, decay);
      const early = (i - pd) < ctx.sampleRate * 0.06 ? (Math.abs(rnd()) > 0.86 ? 0.9 : 0.06) : 1;
      d[i] = rnd() * env * early * 0.55;
    }
  }
  return buf;
}

function makeNoiseBuffer(ctx, seconds = 3, seed = 12345) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < len; i++) {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    d[i] = ((s >>> 0) / 4294967296) * 2 - 1;
  }
  return buf;
}

// ═══════════════════════════════════════════════════════════════════
// 音频图：master → limiter → comp → [music bus, sfx bus]
// ═══════════════════════════════════════════════════════════════════
function buildGraph(ctx, { music = true, sfx = true } = {}) {
  const master = ctx.createGain();
  master.gain.value = 0.9;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.knee.value = 8;
  comp.ratio.value = 3.2;
  comp.attack.value = 0.006;
  comp.release.value = 0.22;

  // 简易峰值限制（第二级强压缩，逼近 true peak ≤ -1 dBTP）
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -1.6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.0008;
  limiter.release.value = 0.06;

  master.connect(comp); comp.connect(limiter); limiter.connect(ctx.destination);

  const musicBus = ctx.createGain(); musicBus.gain.value = music ? 0.62 : 0;
  const sfxBus = ctx.createGain(); sfxBus.gain.value = sfx ? 0.85 : 0;

  const verb = ctx.createConvolver();
  verb.buffer = makeImpulse(ctx);
  const verbSend = ctx.createGain(); verbSend.gain.value = 0.34;
  verbSend.connect(verb); verb.connect(master);

  musicBus.connect(master); musicBus.connect(verbSend);
  sfxBus.connect(master); sfxBus.connect(verbSend);

  return { master, comp, limiter, musicBus, sfxBus, verb, verbSend };
}

// ═══════════════════════════════════════════════════════════════════
// 乐器 / 音效合成器
// ═══════════════════════════════════════════════════════════════════
const NOTE = (semi) => 55 * Math.pow(2, semi / 12);   // A1 = 55 Hz 基准

function padVoice(ctx, bus, { t0, dur, freq, gain = 0.1, detune = 7, cutoff = 900, q = 0.8 }) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(2.4, dur * 0.3));
  g.gain.setValueAtTime(gain, t0 + dur * 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = cutoff; lp.Q.value = q;
  g.connect(lp); lp.connect(bus);
  for (const [d, w] of [[-detune, 0.5], [0, 0.6], [detune, 0.5], [detune * 2.4, 0.22]]) {
    const o = ctx.createOscillator();
    o.type = w > 0.55 ? 'triangle' : 'sawtooth';
    o.frequency.value = freq;
    o.detune.value = d;
    const vg = ctx.createGain(); vg.gain.value = w;
    o.connect(vg); vg.connect(g);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  // 缓慢的滤波器摆动，避免长音呆板
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = ctx.createGain(); lfoG.gain.value = cutoff * 0.28;
  lfo.connect(lfoG); lfoG.connect(lp.frequency);
  lfo.start(t0); lfo.stop(t0 + dur + 0.05);
}

function subDrone(ctx, bus, { t0, dur, freq = NOTE(-12), gain = 0.16 }) {
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.005;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 3.0);
  g.gain.setValueAtTime(gain, t0 + dur * 0.82);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const g2 = ctx.createGain(); g2.gain.value = 0.28;
  o.connect(g); o2.connect(g2); g2.connect(g); g.connect(bus);
  o.start(t0); o.stop(t0 + dur + 0.05);
  o2.start(t0); o2.stop(t0 + dur + 0.05);
}

function pulseSeq(ctx, bus, { t0, dur, period = 0.5, freq = NOTE(24), gain = 0.055 }) {
  const n = Math.floor(dur / period);
  for (let i = 0; i < n; i++) {
    const t = t0 + i * period;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.value = freq * (i % 4 === 0 ? 1 : i % 4 === 2 ? 1.5 : 1.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + period * 0.85);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320;
    o.connect(g); g.connect(hp); hp.connect(bus);
    o.start(t); o.stop(t + period);
  }
}

function noiseHiss(ctx, bus, noiseBuf, { t0, dur, gain = 0.03, lo = 400, hi = 5200 }) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = Math.sqrt(lo * hi); bp.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 1.2);
  g.gain.setValueAtTime(gain, t0 + dur * 0.85);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp); bp.connect(g); g.connect(bus);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

/** 冲击：噪声爆发 + 下扫正弦 + 亚低频 */
function impact(ctx, bus, noiseBuf, { t0, gain = 0.7, sweepFrom = 220, sweepTo = 34, len = 1.5 }) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 1.0;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.7;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(gain * 0.8, t0);
  ng.gain.exponentialRampToValueAtTime(0.0001, t0 + len * 0.55);
  src.connect(bp); bp.connect(ng); ng.connect(bus);
  src.start(t0); src.stop(t0 + len);

  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(sweepFrom, t0);
  o.frequency.exponentialRampToValueAtTime(sweepTo, t0 + len * 0.8);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  o.connect(g); g.connect(bus);
  o.start(t0); o.stop(t0 + len + 0.02);
}

/** 短促金属 ping（FM 铃声） */
function ping(ctx, bus, { t0, freq = 1320, gain = 0.22, len = 1.1, ratio = 3.01 }) {
  const car = ctx.createOscillator(); car.type = 'sine'; car.frequency.value = freq;
  const mod = ctx.createOscillator(); mod.type = 'sine'; mod.frequency.value = freq * ratio;
  const modG = ctx.createGain(); modG.gain.setValueAtTime(freq * 1.4, t0);
  modG.gain.exponentialRampToValueAtTime(1, t0 + len * 0.4);
  mod.connect(modG); modG.connect(car.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  car.connect(g); g.connect(bus);
  car.start(t0); car.stop(t0 + len + 0.02);
  mod.start(t0); mod.stop(t0 + len + 0.02);
}

/** 上升张力（riser） */
function riser(ctx, bus, noiseBuf, { t0, len = 3.0, gain = 0.28 }) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3.2;
  bp.frequency.setValueAtTime(240, t0);
  bp.frequency.exponentialRampToValueAtTime(5200, t0 + len);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + len * 0.86);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len + 0.35);
  src.connect(bp); bp.connect(g); g.connect(bus);
  src.start(t0); src.stop(t0 + len + 0.4);
}

/** 空气流动 / 气帘 */
function airflow(ctx, bus, noiseBuf, { t0, len = 6, gain = 0.09 }) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.9);
  g.gain.setValueAtTime(gain, t0 + len * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, t0 + len);
  // 缓慢摆动
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.34;
  const lg = ctx.createGain(); lg.gain.value = 900;
  lfo.connect(lg); lg.connect(bp.frequency);
  lfo.start(t0); lfo.stop(t0 + len);
  src.connect(bp); bp.connect(g); g.connect(bus);
  src.start(t0); src.stop(t0 + len + 0.05);
}

/** 等离子体嗡鸣（不谐和泛音） */
function plasmaHum(ctx, bus, { t0, len = 8, gain = 0.14, base = NOTE(12) }) {
  for (const [mult, w] of [[1, 1], [2.02, 0.5], [3.07, 0.3], [4.71, 0.16]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = base * mult;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain * w, t0 + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    const trem = ctx.createOscillator(); trem.frequency.value = 6.2 + mult;
    const tg = ctx.createGain(); tg.gain.value = gain * w * 0.34;
    trem.connect(tg); tg.connect(g.gain);
    trem.start(t0); trem.stop(t0 + len);
    o.connect(g); g.connect(bus);
    o.start(t0); o.stop(t0 + len + 0.05);
  }
}

/** 锡滴序列（高频规律点击，对应 50,000 滴/秒的听觉隐喻） */
function dropletTicks(ctx, bus, { t0, len = 8, gain = 0.035, rate = 17 }) {
  const n = Math.floor(len * rate);
  for (let i = 0; i < n; i++) {
    const t = t0 + i / rate;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(2600 + (i % 5) * 120, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.02);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.05);
  }
}

// ═══════════════════════════════════════════════════════════════════
// 编排：把 script.js 的提示点铺成完整配乐与音效
// ═══════════════════════════════════════════════════════════════════
/** 和声进行（小调，冷峻） */
const CHORDS = [
  { at: 0,   semis: [0, 7, 12, 15], dur: 22 },   // Am 域
  { at: 22,  semis: [-2, 5, 10, 14], dur: 25 },
  { at: 47,  semis: [0, 7, 12, 19], dur: 21 },
  { at: 68,  semis: [3, 10, 15, 22], dur: 22 },
  { at: 90,  semis: [-2, 5, 12, 17], dur: 20 },
  { at: 110, semis: [0, 7, 14, 19], dur: 24 },
  { at: 134, semis: [5, 12, 17, 24], dur: 22 },
  { at: 156, semis: [0, 7, 12, 19], dur: 12 },
  { at: 168, semis: [3, 10, 15, 22], dur: 12 },
];

function scheduleMusic(ctx, g, noiseBuf, offset, t0) {
  const D = TIMELINE.duration;
  // 低频持续
  subDrone(ctx, g.musicBus, { t0: t0, dur: D - offset, freq: NOTE(-9), gain: 0.15 });
  // 和声铺底
  for (const c of CHORDS) {
    if (c.at + c.dur < offset) continue;
    const start = t0 + Math.max(0, c.at - offset);
    const dur = c.dur - Math.max(0, offset - c.at);
    if (dur <= 0.2) continue;
    c.semis.forEach((s, i) => padVoice(ctx, g.musicBus, {
      t0: start, dur, freq: NOTE(s + 24), gain: 0.075 / (1 + i * 0.3),
      detune: 6 + i * 3, cutoff: 620 + i * 380,
    }));
  }
  // 节奏脉冲：从锡滴段开始，到收束段
  const seqs = [
    { at: 30, dur: 17, period: 0.5 },
    { at: 58, dur: 20, period: 0.4 },
    { at: 110, dur: 24, period: 0.5 },
    { at: 134, dur: 22, period: 0.375 },
    { at: 166, dur: 10, period: 0.5 },
  ];
  for (const s of seqs) {
    if (s.at + s.dur < offset) continue;
    pulseSeq(ctx, g.musicBus, {
      t0: t0 + Math.max(0, s.at - offset),
      dur: s.dur - Math.max(0, offset - s.at),
      period: s.period, freq: NOTE(36), gain: 0.05,
    });
  }
  // 真空环境底噪
  if (D > offset) noiseHiss(ctx, g.musicBus, noiseBuf, { t0, dur: D - offset, gain: 0.022, lo: 300, hi: 3600 });
}

function scheduleSFX(ctx, g, noiseBuf, offset, t0) {
  for (const c of allAudioCues()) {
    if (c.time < offset - 0.05) continue;
    const t = t0 + (c.time - offset);
    switch (c.cue) {
      case 'intro':        ping(ctx, g.sfxBus, { t0: t, freq: 660, gain: 0.14, len: 3.4, ratio: 2.0 }); break;
      case 'sub_drop':     impact(ctx, g.sfxBus, noiseBuf, { t0: t, gain: 0.42, sweepFrom: 140, sweepTo: 28, len: 2.6 }); break;
      case 'riser':        riser(ctx, g.sfxBus, noiseBuf, { t0: t, len: 3.6, gain: 0.22 }); break;
      case 'whoosh':       riser(ctx, g.sfxBus, noiseBuf, { t0: t, len: 1.6, gain: 0.26 }); break;
      case 'vacuum':       noiseHiss(ctx, g.sfxBus, noiseBuf, { t0: t, dur: 5.0, gain: 0.05, lo: 120, hi: 900 }); break;
      case 'chapter':      ping(ctx, g.sfxBus, { t0: t, freq: 1180, gain: 0.16, len: 1.6, ratio: 4.02 }); break;
      case 'droplet_loop': dropletTicks(ctx, g.sfxBus, { t0: t, len: 8.5, gain: 0.028, rate: 16 }); break;
      case 'tension':      riser(ctx, g.sfxBus, noiseBuf, { t0: t, len: 3.2, gain: 0.16 }); break;
      case 'prepulse_hit': impact(ctx, g.sfxBus, noiseBuf, { t0: t, gain: 0.44, sweepFrom: 420, sweepTo: 90, len: 0.9 });
                           ping(ctx, g.sfxBus, { t0: t, freq: 2100, gain: 0.16, len: 0.6, ratio: 5.1 }); break;
      case 'main_impact':  impact(ctx, g.sfxBus, noiseBuf, { t0: t, gain: 0.95, sweepFrom: 260, sweepTo: 26, len: 2.8 });
                           ping(ctx, g.sfxBus, { t0: t, freq: 3200, gain: 0.2, len: 1.2, ratio: 7.1 }); break;
      case 'plasma_hum':   plasmaHum(ctx, g.sfxBus, { t0: t, len: 14, gain: 0.11 }); break;
      case 'euv_shimmer':  ping(ctx, g.sfxBus, { t0: t, freq: 2640, gain: 0.09, len: 3.2, ratio: 1.5 });
                           ping(ctx, g.sfxBus, { t0: t + 0.24, freq: 3960, gain: 0.06, len: 2.6, ratio: 1.5 }); break;
      case 'reveal':       riser(ctx, g.sfxBus, noiseBuf, { t0: t, len: 2.4, gain: 0.14 });
                           ping(ctx, g.sfxBus, { t0: t + 2.2, freq: 880, gain: 0.13, len: 2.4, ratio: 2.01 }); break;
      case 'converge':     riser(ctx, g.sfxBus, noiseBuf, { t0: t, len: 2.8, gain: 0.18 }); break;
      case 'ping':         ping(ctx, g.sfxBus, { t0: t, freq: 1760, gain: 0.2, len: 2.2, ratio: 3.01 }); break;
      case 'gas_flow':     airflow(ctx, g.sfxBus, noiseBuf, { t0: t, len: 8.0, gain: 0.085 }); break;
      case 'fold':         ping(ctx, g.sfxBus, { t0: t, freq: 990, gain: 0.11, len: 1.8, ratio: 2.5 });
                           ping(ctx, g.sfxBus, { t0: t + 0.32, freq: 1320, gain: 0.09, len: 1.6, ratio: 2.5 }); break;
      case 'mask_reveal':  impact(ctx, g.sfxBus, noiseBuf, { t0: t, gain: 0.3, sweepFrom: 180, sweepTo: 44, len: 1.8 });
                           ping(ctx, g.sfxBus, { t0: t + 0.1, freq: 1480, gain: 0.13, len: 2.0, ratio: 3.5 }); break;
      case 'scan':         airflow(ctx, g.sfxBus, noiseBuf, { t0: t, len: 6.2, gain: 0.055 });
                           dropletTicks(ctx, g.sfxBus, { t0: t, len: 6.0, gain: 0.02, rate: 8 }); break;
      case 'expose':       noiseHiss(ctx, g.sfxBus, noiseBuf, { t0: t, dur: 6.5, gain: 0.04, lo: 1600, hi: 7200 }); break;
      case 'develop':      airflow(ctx, g.sfxBus, noiseBuf, { t0: t, len: 4.2, gain: 0.07 }); break;
      case 'resolve':      ping(ctx, g.sfxBus, { t0: t, freq: 1320, gain: 0.2, len: 3.6, ratio: 2.0 });
                           ping(ctx, g.sfxBus, { t0: t + 0.18, freq: 1980, gain: 0.13, len: 3.0, ratio: 2.0 }); break;
      case 'finale':       impact(ctx, g.sfxBus, noiseBuf, { t0: t, gain: 0.5, sweepFrom: 200, sweepTo: 30, len: 3.4 });
                           ping(ctx, g.sfxBus, { t0: t + 0.06, freq: 880, gain: 0.18, len: 4.2, ratio: 2.01 }); break;
      case 'outro':        ping(ctx, g.sfxBus, { t0: t, freq: 660, gain: 0.15, len: 4.6, ratio: 2.0 }); break;
      default: break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// 实时播放控制器
// ═══════════════════════════════════════════════════════════════════
export function createAudio() {
  let ctx = null, graph = null, noiseBuf = null, started = false, startedAt = 0, startOffset = 0;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ sampleRate: SR, latencyHint: 'playback' });
    graph = buildGraph(ctx);
    noiseBuf = makeNoiseBuffer(ctx, 4, 0x51ed270b);
    return ctx;
  }

  /** 从 offset 秒开始播放；重复调用会先停止再重排 */
  function play(offset = 0) {
    if (!ensure()) return false;
    stop();
    ctx.resume?.();
    const t0 = ctx.currentTime + 0.08;
    startedAt = t0; startOffset = offset;
    graph = buildGraph(ctx);
    graph.master.gain.value = muted ? 0 : 0.9;
    scheduleMusic(ctx, graph, noiseBuf, offset, t0);
    scheduleSFX(ctx, graph, noiseBuf, offset, t0);
    started = true;
    return true;
  }

  function stop() {
    if (!ctx || !graph) return;
    try { graph.master.disconnect(); } catch { /* noop */ }
    started = false;
  }

  function setMuted(m) {
    muted = m;
    if (graph) graph.master.gain.value = m ? 0 : 0.9;
  }

  function currentTime() {
    if (!ctx || !started) return null;
    return startOffset + (ctx.currentTime - startedAt);
  }

  return { play, stop, setMuted, currentTime, get context() { return ctx; }, get isPlaying() { return started; } };
}

// ═══════════════════════════════════════════════════════════════════
// 离线分轨渲染 + 响度测量 + WAV 导出（§2 音频交付）
// ═══════════════════════════════════════════════════════════════════

/** @param kind 'music' | 'sfx' | 'mix' */
export async function renderStem(kind, { duration = TIMELINE.duration, sampleRate = SR } = {}) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) throw new Error('当前环境不支持 OfflineAudioContext，无法导出音频分轨');
  const ctx = new OAC(2, Math.ceil(duration * sampleRate), sampleRate);
  const g = buildGraph(ctx, { music: kind !== 'sfx', sfx: kind !== 'music' });
  const noiseBuf = makeNoiseBuffer(ctx, 4, 0x51ed270b);
  if (kind !== 'sfx') scheduleMusic(ctx, g, noiseBuf, 0, 0);
  if (kind !== 'music') scheduleSFX(ctx, g, noiseBuf, 0, 0);
  const buffer = await ctx.startRendering();
  return buffer;
}

/**
 * 近似积分响度（LUFS）与真峰值（dBTP）。
 * 采用 K 加权的简化实现：高通 + 高频架，门限 -70 LUFS 绝对门 + 相对门。
 * 权威复核仍以 ffmpeg loudnorm 为准（见 delivery/scripts/measure_loudness）。
 */
export function measureLoudness(buffer) {
  const sr = buffer.sampleRate;
  const chs = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) chs.push(buffer.getChannelData(c));

  // —— K 加权（双二阶级联，ITU-R BS.1770 系数，48 kHz）——
  const stage1 = { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [1, -1.69065929318241, 0.73248077421585] };
  const stage2 = { b: [1.0, -2.0, 1.0], a: [1, -1.99004745483398, 0.99007225036621] };
  const biquad = (x, f) => {
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const xn = x[i];
      const yn = f.b[0] * xn + f.b[1] * x1 + f.b[2] * x2 - f.a[1] * y1 - f.a[2] * y2;
      x2 = x1; x1 = xn; y2 = y1; y1 = yn;
      y[i] = yn;
    }
    return y;
  };
  const weighted = chs.map((c) => biquad(biquad(c, stage1), stage2));

  // —— 400 ms 块、75% 重叠的均方 ——
  const blockLen = Math.floor(sr * 0.4);
  const hop = Math.floor(blockLen / 4);
  const blocks = [];
  for (let s = 0; s + blockLen <= weighted[0].length; s += hop) {
    let sum = 0;
    for (const w of weighted) {
      let acc = 0;
      for (let i = s; i < s + blockLen; i++) acc += w[i] * w[i];
      sum += acc / blockLen;    // 声道等权（立体声 G=1.0）
    }
    blocks.push(sum);
  }
  const toLufs = (ms) => -0.691 + 10 * Math.log10(Math.max(ms, 1e-12));
  // 绝对门 -70 LUFS
  let gated = blocks.filter((b) => toLufs(b) > -70);
  if (gated.length) {
    const mean = gated.reduce((a, b) => a + b, 0) / gated.length;
    const rel = toLufs(mean) - 10;
    gated = gated.filter((b) => toLufs(b) > rel);
  }
  const integrated = gated.length
    ? toLufs(gated.reduce((a, b) => a + b, 0) / gated.length)
    : -Infinity;

  // —— 真峰值（4× 线性过采样近似）——
  let peak = 0;
  for (const c of chs) {
    for (let i = 0; i < c.length - 1; i++) {
      const a = c[i], b = c[i + 1];
      peak = Math.max(peak, Math.abs(a));
      for (let k = 1; k < 4; k++) peak = Math.max(peak, Math.abs(a + (b - a) * (k / 4)));
    }
  }
  const truePeak = 20 * Math.log10(Math.max(peak, 1e-12));

  return {
    integratedLUFS: integrated,
    truePeakDbTP: truePeak,
    targetLUFS: FILM.loudness.targetLUFS,
    targetPeak: FILM.loudness.truePeakDbTP,
    pass: integrated >= FILM.loudness.targetLUFS - 1.5
      && integrated <= FILM.loudness.targetLUFS + 1.5
      && truePeak <= FILM.loudness.truePeakDbTP + 0.05,
  };
}

/** AudioBuffer → 24-bit PCM WAV Blob */
export function encodeWav24(buffer) {
  const ch = buffer.numberOfChannels, sr = buffer.sampleRate, n = buffer.length;
  const bytesPerSample = 3;
  const blockAlign = ch * bytesPerSample;
  const dataSize = n * blockAlign;
  const ab = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(ab);
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, 'RIFF'); dv.setUint32(4, 36 + dataSize, true); wstr(8, 'WAVE');
  wstr(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * blockAlign, true);
  dv.setUint16(32, blockAlign, true); dv.setUint16(34, 24, true);
  wstr(36, 'data'); dv.setUint32(40, dataSize, true);
  const data = [];
  for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      let v = Math.max(-1, Math.min(1, data[c][i]));
      const s = Math.round(v * 8388607);
      dv.setUint8(o++, s & 0xff);
      dv.setUint8(o++, (s >> 8) & 0xff);
      dv.setUint8(o++, (s >> 16) & 0xff);
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

/**
 * 两趟响度归一化 + 真峰值限制（就地修改 AudioBuffer）
 * ==================================================================
 * 第一趟测量积分响度与真峰值，第二趟施加增益；若增益会导致真峰值超限，
 * 则叠加一个前视软限制器（look-ahead soft limiter），
 * 使响度达标的同时真峰值不超过 targetPeakDb。
 *
 * 这样交付的分轨才真正满足规格书 §2「≈ −14 LUFS，峰值 ≤ −1 dBTP」，
 * 而不是"渲染出来是多少就是多少"。
 */
export function normalizeBuffer(buffer, {
  targetLUFS = FILM.loudness.targetLUFS,
  targetPeakDb = FILM.loudness.truePeakDbTP,
  lookaheadMs = 4,
  releaseMs = 90,
} = {}) {
  const before = measureLoudness(buffer);
  if (!Number.isFinite(before.integratedLUFS)) return { before, after: before, gainDb: 0, limited: false };

  const gainDb = targetLUFS - before.integratedLUFS;
  const gain = Math.pow(10, gainDb / 20);
  const sr = buffer.sampleRate;
  const chs = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) chs.push(buffer.getChannelData(c));

  // 施加增益
  for (const d of chs) for (let i = 0; i < d.length; i++) d[i] *= gain;

  // 前视软限制：把超过 ceiling 的部分压回来，避免削波与失真
  const ceiling = Math.pow(10, targetPeakDb / 20) * 0.995;
  const la = Math.max(1, Math.round(sr * lookaheadMs / 1000));
  const rel = Math.max(1, Math.round(sr * releaseMs / 1000));
  const n = buffer.length;

  // 逐样本取声道间最大绝对值（联动限制，保持立体声像不漂移）
  const peak = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (const d of chs) { const a = Math.abs(d[i]); if (a > m) m = a; }
    peak[i] = m;
  }
  // 前视包络：取未来 la 个样本内的最大值
  const env = new Float32Array(n);
  {
    // 单调队列求滑动窗口最大值 O(n)
    const q = new Int32Array(n);
    let head = 0, tail = 0;
    for (let i = 0; i < n; i++) {
      const wEnd = Math.min(n - 1, i + la);
      while (tail > head && q[tail - 1] <= wEnd && peak[q[tail - 1]] <= peak[wEnd]) tail--;
      if (i === 0) {
        for (let k = 0; k <= wEnd; k++) {
          while (tail > head && peak[q[tail - 1]] <= peak[k]) tail--;
          q[tail++] = k;
        }
      } else {
        while (tail > head && peak[q[tail - 1]] <= peak[wEnd]) tail--;
        q[tail++] = wEnd;
        while (tail > head && q[head] < i) head++;
      }
      env[i] = peak[q[head]];
    }
  }
  // 增益缩减包络（带释放平滑）
  let limited = false;
  const gr = new Float32Array(n);
  let cur = 1;
  const relCoef = Math.exp(-1 / rel);
  for (let i = 0; i < n; i++) {
    const need = env[i] > ceiling ? ceiling / env[i] : 1;
    if (need < 1) limited = true;
    cur = need < cur ? need : need + (cur - need) * relCoef;   // 瞬时压下、缓慢放开
    gr[i] = cur;
  }
  for (const d of chs) for (let i = 0; i < n; i++) d[i] *= gr[i];

  // 最后一道硬安全阀（理论上不应触发）
  for (const d of chs) {
    for (let i = 0; i < n; i++) {
      if (d[i] > ceiling) d[i] = ceiling;
      else if (d[i] < -ceiling) d[i] = -ceiling;
    }
  }

  const after = measureLoudness(buffer);
  return { before, after, gainDb: +gainDb.toFixed(2), limited };
}

/** 一键导出三条分轨 + 响度报告（含两趟归一化） */
export async function exportAudioDeliverables(onProgress = () => {}) {
  const out = [];
  const kinds = ['music', 'sfx', 'mix'];
  const names = { music: '音乐', sfx: '音效', mix: '混音母带' };
  // 分轨与母带的响度目标不同：分轨留出混音余量，母带对齐流媒体标准
  const targets = { music: -18, sfx: -18, mix: FILM.loudness.targetLUFS };
  for (const k of kinds) {
    onProgress(`离线渲染 ${names[k]} 轨…`);
    const buf = await renderStem(k);
    onProgress(`  归一化 ${names[k]}（目标 ${targets[k]} LUFS / 峰值 ≤ ${FILM.loudness.truePeakDbTP} dBTP）…`);
    const norm = normalizeBuffer(buf, { targetLUFS: targets[k] });
    const blob = encodeWav24(buf);
    const pass = Math.abs(norm.after.integratedLUFS - targets[k]) <= 1.0
      && norm.after.truePeakDbTP <= FILM.loudness.truePeakDbTP + 0.05;
    out.push({
      kind: k, name: names[k], blob, seconds: buf.duration,
      target: targets[k], loudness: { ...norm.after, pass, targetLUFS: targets[k], targetPeak: FILM.loudness.truePeakDbTP },
      norm,
    });
    onProgress(`${names[k]}：${norm.before.integratedLUFS.toFixed(2)} → ${norm.after.integratedLUFS.toFixed(2)} LUFS`
      + `（增益 ${norm.gainDb >= 0 ? '+' : ''}${norm.gainDb} dB${norm.limited ? '，已限峰' : ''}）`
      + ` / 真峰值 ${norm.after.truePeakDbTP.toFixed(2)} dBTP · ${pass ? '达标' : '需复核'}`);
  }
  return out;
}
