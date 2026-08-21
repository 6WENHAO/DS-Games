// ============================================================================
//  audio.js —— 全程序化合成音景（零音频素材，全靠 WebAudio 现算）
//  梦核的一半是声音：听得见的东西，一个都看不见
//    · 环境床：蝉鸣 / 日光灯嗡 / 楼下车流 / 天台的风 / 大堂的走音广播
//    · 定位音源：厨房的炒菜声、卧室的麻将声、客厅的聊天声（走近变大，进门就停）
//    · 一次性：脚步（分地面材质）、声控灯"咔"、铁门吱呀、电话铃、电梯"叮"
// ============================================================================

let ctx = null;
let master = null;
let wetBus = null;      // 混响
let dryBus = null;
let convolver = null;
let started = false;
let muted = false;

const emitters = new Map();   // id → {x,y,radius,gain,pan,stop}
const beds = new Map();       // id → {gain, stop}

export function isReady() { return started; }
export function isMuted() { return muted; }

// ---------------------------------------------------------------------------
//  基础设施
// ---------------------------------------------------------------------------
export function init() {
  if (started) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);

  dryBus = ctx.createGain();
  dryBus.gain.value = 1;
  dryBus.connect(master);

  convolver = ctx.createConvolver();
  convolver.buffer = makeImpulse(2.6, 2.4);
  wetBus = ctx.createGain();
  wetBus.gain.value = 0.34;
  wetBus.connect(convolver);
  convolver.connect(master);

  started = true;
  return true;
}

export function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.08);
  return muted;
}

/** 程序化混响冲激：噪声 × 指数衰减，带一点早期反射 */
function makeImpulse(seconds, decay) {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * seconds);
  const buf = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
    // 几个早期反射（楼道 / 大堂的"空"感）
    for (const [ms, amp] of [[17, 0.5], [31, 0.38], [53, 0.28], [79, 0.2], [113, 0.14]]) {
      const i = Math.floor((ms / 1000) * rate) + c * 37;
      if (i < len) d[i] += amp * (c ? -1 : 1);
    }
  }
  return buf;
}

/** 一段可循环的白噪声 buffer */
let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    const len = ctx.sampleRate * 3;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  return src;
}

function env(node, t0, a, peak, d, s = 0) {
  const g = node.gain;
  g.cancelScheduledValues(t0);
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + a);
  if (s > 0) {
    g.setValueAtTime(Math.max(0.0001, peak), t0 + a + s);
    g.exponentialRampToValueAtTime(0.0001, t0 + a + s + d);
  } else {
    g.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }
}

function chain(...nodes) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

function toBus(node, wet = 0.4) {
  const d = ctx.createGain(); d.gain.value = 1 - wet * 0.55;
  const w = ctx.createGain(); w.gain.value = wet;
  node.connect(d); d.connect(dryBus);
  node.connect(w); w.connect(wetBus);
}

// ---------------------------------------------------------------------------
//  一次性音效
// ---------------------------------------------------------------------------

/** 脚步：按地面材质换质感 */
export function footstep(surface = 'stone', vol = 1) {
  if (!started) return;
  const t = ctx.currentTime;
  const cfg = {
    stone: { f: 1900, q: 1.1, d: 0.09, thump: 118, tv: 0.30 },   // 水磨石 / 大理石
    wood: { f: 800, q: 1.4, d: 0.12, thump: 82, tv: 0.46 },      // 木地板
    tile: { f: 2600, q: 1.5, d: 0.07, thump: 132, tv: 0.24 },    // 瓷砖
    carpet: { f: 480, q: 0.8, d: 0.14, thump: 70, tv: 0.20 },    // 地毯
    concrete: { f: 1400, q: 0.9, d: 0.11, thump: 96, tv: 0.34 }, // 天台水泥
  }[surface] || { f: 1600, q: 1, d: 0.1, thump: 100, tv: 0.3 };

  const n = noise();
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = cfg.f * (0.86 + Math.random() * 0.28); bp.Q.value = cfg.q;
  const g = ctx.createGain();
  chain(n, bp, g);
  toBus(g, 0.3);
  env(g, t, 0.004, 0.16 * vol, cfg.d);
  n.start(t); n.stop(t + cfg.d + 0.05);

  const o = ctx.createOscillator();
  o.type = 'sine'; o.frequency.value = cfg.thump * (0.92 + Math.random() * 0.16);
  const og = ctx.createGain();
  chain(o, og); toBus(og, 0.22);
  env(og, t, 0.006, cfg.tv * vol, 0.1);
  o.start(t); o.stop(t + 0.2);
}

/** 声控灯"咔"一声 */
export function lampClick() {
  if (!started) return;
  const t = ctx.currentTime;
  const n = noise();
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
  const g = ctx.createGain();
  chain(n, hp, g); toBus(g, 0.55);
  env(g, t, 0.002, 0.3, 0.045);
  n.start(t); n.stop(t + 0.09);
  // 灯丝的一声轻响
  const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1180;
  const og = ctx.createGain(); chain(o, og); toBus(og, 0.5);
  env(og, t + 0.01, 0.003, 0.035, 0.06);
  o.start(t); o.stop(t + 0.12);
}

/** 铁门：锁舌 + 吱呀 */
export function doorOpen() {
  if (!started) return;
  const t = ctx.currentTime;
  for (const [dt, f] of [[0, 3200], [0.07, 2400]]) {
    const n = noise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 3;
    const g = ctx.createGain(); chain(n, bp, g); toBus(g, 0.5);
    env(g, t + dt, 0.003, 0.2, 0.06);
    n.start(t + dt); n.stop(t + dt + 0.12);
  }
  // 吱呀：滑动的窄带噪声
  const n2 = noise();
  const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.Q.value = 12;
  bp2.frequency.setValueAtTime(620, t + 0.13);
  bp2.frequency.exponentialRampToValueAtTime(1450, t + 0.95);
  const g2 = ctx.createGain(); chain(n2, bp2, g2); toBus(g2, 0.6);
  env(g2, t + 0.13, 0.12, 0.11, 0.5, 0.25);
  n2.start(t + 0.13); n2.stop(t + 1.3);
}

/** 电梯"叮" */
export function ding() {
  if (!started) return;
  const t = ctx.currentTime;
  [1568, 1046].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain(); chain(o, g); toBus(g, 0.65);
    env(g, t + i * 0.42, 0.006, 0.16, 1.1);
    o.start(t + i * 0.42); o.stop(t + i * 0.42 + 1.4);
  });
}

/** 老式电话铃（两声一组） */
export function phoneRing(times = 2) {
  if (!started) return;
  const t0 = ctx.currentTime;
  for (let k = 0; k < times; k++) {
    const t = t0 + k * 1.5;
    for (let b = 0; b < 2; b++) {
      const tb = t + b * 0.42;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = b ? 880 : 1046;
      const trem = ctx.createOscillator(); trem.type = 'sine'; trem.frequency.value = 22;
      const tg = ctx.createGain(); tg.gain.value = 0.5;
      const g = ctx.createGain(); g.gain.value = 0;
      trem.connect(tg); tg.connect(g.gain);
      chain(o, g); toBus(g, 0.5);
      g.gain.setValueAtTime(0.0001, tb);
      g.gain.linearRampToValueAtTime(0.09, tb + 0.02);
      g.gain.setValueAtTime(0.09, tb + 0.3);
      g.gain.linearRampToValueAtTime(0, tb + 0.36);
      o.start(tb); o.stop(tb + 0.4);
      trem.start(tb); trem.stop(tb + 0.4);
    }
  }
}

/** 自行车铃 */
export function bikeBell() {
  if (!started) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 5; i++) {
    const tb = t + i * 0.11;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.value = 2700 + (i % 2) * 340;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 4100;
    const g = ctx.createGain(); chain(o, g); o2.connect(g); toBus(g, 0.7);
    env(g, tb, 0.003, 0.05, 0.28);
    o.start(tb); o.stop(tb + 0.35); o2.start(tb); o2.stop(tb + 0.35);
  }
}

/** 麻将：一串塑料牌的碰撞 */
export function mahjongClack(n = 6, vol = 1) {
  if (!started) return;
  const t0 = ctx.currentTime;
  for (let i = 0; i < n; i++) {
    const t = t0 + Math.random() * 1.1;
    const nz = noise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 1500 + Math.random() * 2600; bp.Q.value = 5 + Math.random() * 8;
    const g = ctx.createGain(); chain(nz, bp, g); toBus(g, 0.5);
    env(g, t, 0.002, 0.075 * vol, 0.055);
    nz.start(t); nz.stop(t + 0.1);
  }
}

/** 乒乓球（楼上永远在打） */
export function pingPong() {
  if (!started) return;
  const t0 = ctx.currentTime;
  for (let i = 0; i < 4 + Math.floor(Math.random() * 5); i++) {
    const t = t0 + i * (0.26 + Math.random() * 0.1);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(1500 + Math.random() * 500, t);
    o.frequency.exponentialRampToValueAtTime(700, t + 0.05);
    const g = ctx.createGain(); chain(o, g); toBus(g, 0.75);
    env(g, t, 0.002, 0.035, 0.07);
    o.start(t); o.stop(t + 0.12);
  }
}

/** 一句听不清的话（含笑声变体）—— 梦核主音色 */
export function babble({ pitch = 1, dur = 1.6, vol = 0.09, laugh = false, wet = 0.6, muffle = 900 } = {}) {
  if (!started) return null;
  const t = ctx.currentTime;
  const n = noise();
  // 两个共振峰，模拟"人在说话但听不清内容"
  const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass';
  f1.frequency.value = 480 * pitch; f1.Q.value = 5.5;
  const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass';
  f2.frequency.value = 1250 * pitch; f2.Q.value = 7;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = muffle;
  const g = ctx.createGain(); g.gain.value = 0;
  const mixF = ctx.createGain();
  n.connect(f1); n.connect(f2);
  f1.connect(mixF); f2.connect(mixF);
  chain(mixF, lp, g);
  toBus(g, wet);

  // 音节级别的振幅包络（4~7 Hz）
  const syll = laugh ? 9 : 4.5 + Math.random() * 2.5;
  const steps = Math.max(2, Math.floor(dur * syll));
  g.gain.setValueAtTime(0.0001, t);
  for (let i = 0; i < steps; i++) {
    const tt = t + (i / steps) * dur;
    const on = laugh ? 1 : Math.random() > 0.22 ? 1 : 0.12;
    g.gain.linearRampToValueAtTime(vol * on * (0.55 + Math.random() * 0.65), tt + dur / steps * 0.45);
    g.gain.linearRampToValueAtTime(vol * 0.12, tt + dur / steps * 0.95);
  }
  g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.12);
  // 语调起伏
  f1.frequency.linearRampToValueAtTime(480 * pitch * (laugh ? 1.5 : 0.82 + Math.random() * 0.4), t + dur);
  f2.frequency.linearRampToValueAtTime(1250 * pitch * (laugh ? 1.6 : 0.85 + Math.random() * 0.4), t + dur);
  n.start(t); n.stop(t + dur + 0.3);
  return g;
}

/** 新闻播报（更平、更远，像隔着墙的电视） */
export function newscast() {
  return babble({ pitch: 0.88, dur: 3.4, vol: 0.055, wet: 0.5, muffle: 620 });
}

/** 小孩在楼下喊 */
export function childCall() {
  return babble({ pitch: 1.8, dur: 0.9, vol: 0.06, wet: 0.8, muffle: 1600 });
}

/** 炒菜：油的沙沙 + 锅铲叮当 */
export function wokBurst(vol = 1) {
  if (!started) return;
  const t = ctx.currentTime;
  const n = noise();
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3400;
  const g = ctx.createGain(); chain(n, hp, g); toBus(g, 0.35);
  env(g, t, 0.05, 0.05 * vol, 0.7, 0.3);
  n.start(t); n.stop(t + 1.4);
  for (let i = 0; i < 3; i++) {
    const tb = t + 0.2 + Math.random() * 0.9;
    const o = ctx.createOscillator(); o.type = 'triangle';
    o.frequency.value = 900 + Math.random() * 1400;
    const og = ctx.createGain(); chain(o, og); toBus(og, 0.5);
    env(og, tb, 0.002, 0.035 * vol, 0.16);
    o.start(tb); o.stop(tb + 0.24);
  }
}

/** 走音的欢庆曲（大堂广播）—— 千禧年的背景音乐 */
export function broadcastTune() {
  if (!started) return null;
  const t0 = ctx.currentTime;
  // 五声音阶 + 故意的音准漂移和爆音
  const scale = [0, 2, 4, 7, 9, 12, 14, 16];
  const root = 392; // G4
  const out = ctx.createGain(); out.gain.value = 0.055;
  const horn = ctx.createBiquadFilter();   // 喇叭：中频窄带 + 削掉低频
  horn.type = 'bandpass'; horn.frequency.value = 1100; horn.Q.value = 0.9;
  const dist = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 512) - 1;
    curve[i] = Math.tanh(x * 3.2);
  }
  dist.curve = curve;
  chain(out, dist, horn);
  toBus(horn, 0.85);

  let t = t0 + 0.2;
  for (let i = 0; i < 26; i++) {
    const deg = scale[Math.floor(Math.random() * scale.length)];
    const detune = 1 + (Math.random() - 0.5) * 0.055;   // 走音
    const f = root * Math.pow(2, deg / 12) * detune;
    const dur = [0.3, 0.3, 0.45, 0.62][Math.floor(Math.random() * 4)];
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.01;
    const g = ctx.createGain();
    o.connect(g); o2.connect(g); g.connect(out);
    env(g, t, 0.02, 0.5, dur * 0.8, dur * 0.25);
    // 偶尔卡带一下
    if (Math.random() > 0.85) o.frequency.linearRampToValueAtTime(f * 0.93, t + dur);
    o.start(t); o.stop(t + dur + 0.2);
    o2.start(t); o2.stop(t + dur + 0.2);
    t += dur * (Math.random() > 0.9 ? 1.7 : 1);
  }
  return { node: out, until: t };
}

/** 八音盒（结局）—— 略微跑调的《送别》式旋律 */
export function musicBox(onDone) {
  if (!started) return;
  const t0 = ctx.currentTime + 0.4;
  const mel = [0, 4, 7, 4, 0, -3, 0, 2, 4, 2, 0, -5, 0, 4, 7, 11, 9, 7, 4, 0];
  const root = 523.25;
  let t = t0;
  mel.forEach((d, i) => {
    const f = root * Math.pow(2, d / 12) * (1 + (Math.random() - 0.5) * 0.012);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 3.01;
    const g2 = ctx.createGain(); g2.gain.value = 0.22; o2.connect(g2);
    const g = ctx.createGain();
    o.connect(g); g2.connect(g);
    toBus(g, 0.8);
    const dur = i % 4 === 3 ? 1.15 : 0.62;
    env(g, t, 0.006, 0.075, dur);
    o.start(t); o.stop(t + dur + 0.2);
    o2.start(t); o2.stop(t + dur + 0.2);
    t += dur * 0.82;
  });
  if (onDone) setTimeout(onDone, (t - ctx.currentTime) * 1000);
}

// ---------------------------------------------------------------------------
//  环境床（按场景常驻，交叉淡入淡出）
// ---------------------------------------------------------------------------

function bedNoise({ type = 'bandpass', freq = 500, q = 1, vol = 0.05, wet = 0.4, lfoRate = 0, lfoDepth = 0 }) {
  const n = noise();
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = 0;
  chain(n, f, g); toBus(g, wet);
  if (lfoRate > 0) {
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = lfoRate;
    const lg = ctx.createGain(); lg.gain.value = lfoDepth;
    lfo.connect(lg); lg.connect(g.gain);
    lfo.start();
  }
  n.start();
  g.gain.setTargetAtTime(vol, ctx.currentTime, 1.2);
  return { gain: g, target: vol, stop: () => { g.gain.setTargetAtTime(0, ctx.currentTime, 0.6); setTimeout(() => n.stop(), 1600); } };
}

function bedTone({ freq = 100, type = 'sine', vol = 0.03, detune = 0.5, wet = 0.3 }) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const o2 = ctx.createOscillator(); o2.type = type; o2.frequency.value = freq + detune;
  const g = ctx.createGain(); g.gain.value = 0;
  o.connect(g); o2.connect(g); toBus(g, wet);
  o.start(); o2.start();
  g.gain.setTargetAtTime(vol, ctx.currentTime, 1.5);
  return { gain: g, target: vol, stop: () => { g.gain.setTargetAtTime(0, ctx.currentTime, 0.8); setTimeout(() => { o.stop(); o2.stop(); }, 2000); } };
}

const BEDS = {
  // 楼道：远处车流 + 蝉鸣 + 一点日光灯嗡
  stair: () => [
    bedNoise({ type: 'lowpass', freq: 340, q: 0.7, vol: 0.05, wet: 0.55, lfoRate: 0.07, lfoDepth: 0.02 }),
    bedNoise({ type: 'bandpass', freq: 4600, q: 1.6, vol: 0.02, wet: 0.4, lfoRate: 41, lfoDepth: 0.016 }),
    bedTone({ freq: 99.5, vol: 0.014, detune: 0.7, wet: 0.4 }),
  ],
  // 家：吊扇 / 冰箱嗡 + 窗外的蝉 + 电视雪花的底噪
  home: () => [
    bedTone({ freq: 118, type: 'sine', vol: 0.022, detune: 1.1, wet: 0.22 }),
    bedNoise({ type: 'bandpass', freq: 5200, q: 1.4, vol: 0.028, wet: 0.35, lfoRate: 38, lfoDepth: 0.02 }),
    bedNoise({ type: 'lowpass', freq: 260, q: 0.6, vol: 0.03, wet: 0.3, lfoRate: 0.11, lfoDepth: 0.014 }),
  ],
  // 大堂：巨大的空 + 中央空调的风 + 长混响
  lobby: () => [
    bedNoise({ type: 'lowpass', freq: 420, q: 0.5, vol: 0.055, wet: 0.85, lfoRate: 0.05, lfoDepth: 0.02 }),
    bedTone({ freq: 61, vol: 0.03, detune: 0.4, wet: 0.5 }),
    bedTone({ freq: 246, type: 'triangle', vol: 0.008, detune: 1.7, wet: 0.9 }),
  ],
  // 尖塔：风灌进窄窗 + 一个越来越高的嗡
  tower: () => [
    bedNoise({ type: 'bandpass', freq: 700, q: 0.8, vol: 0.06, wet: 0.8, lfoRate: 0.13, lfoDepth: 0.03 }),
    bedTone({ freq: 82, vol: 0.024, detune: 0.6, wet: 0.6 }),
  ],
  // 天台：风 + 楼下一整个小区的声音（远、混、听不清）
  roof: () => [
    bedNoise({ type: 'lowpass', freq: 900, q: 0.5, vol: 0.075, wet: 0.5, lfoRate: 0.09, lfoDepth: 0.035 }),
    bedNoise({ type: 'bandpass', freq: 4200, q: 1.3, vol: 0.03, wet: 0.4, lfoRate: 34, lfoDepth: 0.022 }),
    bedTone({ freq: 74, vol: 0.02, detune: 0.5, wet: 0.5 }),
  ],
};

export function setZone(id, reverbSeconds) {
  if (!started) return;
  for (const [, b] of beds) b.stop();
  beds.clear();
  if (reverbSeconds) convolver.buffer = makeImpulse(reverbSeconds, 2.2);
  wetBus.gain.setTargetAtTime(
    { stair: 0.42, home: 0.16, lobby: 0.62, tower: 0.5, roof: 0.26 }[id] ?? 0.3,
    ctx.currentTime, 0.5
  );
  const make = BEDS[id];
  if (make) make().forEach((b, i) => beds.set(`${id}-${i}`, b));
}

// ---------------------------------------------------------------------------
//  定位音源：有位置的循环声（走近变大、有左右声道）
// ---------------------------------------------------------------------------

export function addEmitter(id, { x, y, radius = 8, kind = 'chatter', vol = 1 }) {
  if (!started || emitters.has(id)) return;
  const g = ctx.createGain(); g.gain.value = 0;
  const pan = ctx.createStereoPanner();
  chain(g, pan);
  const d = ctx.createGain(); d.gain.value = 0.5; pan.connect(d); d.connect(dryBus);
  const w = ctx.createGain(); w.gain.value = 0.6; pan.connect(w); w.connect(wetBus);

  let stopFns = [];
  if (kind === 'fridge' || kind === 'fan') {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = kind === 'fridge' ? 122 : 165;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = kind === 'fridge' ? 244.5 : 331;
    const og = ctx.createGain(); og.gain.value = 0.25; o2.connect(og);
    o.connect(g); og.connect(g);
    const n = noise(); const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = kind === 'fan' ? 1400 : 500;
    const ng = ctx.createGain(); ng.gain.value = kind === 'fan' ? 0.5 : 0.16;
    chain(n, lp, ng); ng.connect(g);
    o.start(); o2.start(); n.start();
    stopFns = [() => { o.stop(); o2.stop(); n.stop(); }];
  } else if (kind === 'static') {
    const n = noise();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000;
    chain(n, hp, lp); lp.connect(g);
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.7;
    const lg = ctx.createGain(); lg.gain.value = 0.25; lfo.connect(lg); lg.connect(g.gain);
    n.start(); lfo.start();
    stopFns = [() => { n.stop(); lfo.stop(); }];
  }
  emitters.set(id, { x, y, radius, gain: g, pan, vol, kind, base: 0, stopFns });
}

export function removeEmitter(id) {
  const e = emitters.get(id);
  if (!e) return;
  e.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
  setTimeout(() => { e.stopFns.forEach((f) => f()); }, 900);
  emitters.delete(id);
}

export function clearEmitters() { for (const id of [...emitters.keys()]) removeEmitter(id); }
export function hasEmitter(id) { return emitters.has(id); }

export function moveEmitter(id, x, y) {
  const e = emitters.get(id);
  if (e) { e.x = x; e.y = y; }
}

export function setEmitterVolume(id, v) {
  const e = emitters.get(id);
  if (e) e.vol = v;
}

/** 每帧更新听者位置 → 定位音源的音量与声像 */
export function updateListener(px, py, angle) {
  if (!started) return;
  const t = ctx.currentTime;
  for (const [, e] of emitters) {
    const dx = e.x - px, dy = e.y - py;
    const dist = Math.hypot(dx, dy);
    const att = Math.max(0, 1 - dist / e.radius);
    e.gain.gain.setTargetAtTime(att * att * 0.34 * e.vol, t, 0.14);
    // 声源相对听者的左右
    const rel = Math.atan2(dy, dx) - angle;
    e.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, Math.sin(rel) * 0.85)), t, 0.14);
  }
}

/** 位置化的一次性声音：按距离衰减、按方位声像 */
export function playAt(fn, sx, sy, px, py, angle, radius = 14) {
  if (!started) return;
  const dist = Math.hypot(sx - px, sy - py);
  const att = Math.max(0, 1 - dist / radius);
  if (att <= 0.02) return;
  fn(att * att);
}
