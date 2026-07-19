/* ============================================================
 * songs.js — 三首原创曲目（实时合成）+ 与音乐同步的谱面生成
 *   1.《霓虹脉冲》  电子舞曲 128BPM — 赛博霓虹之城
 *   2.《墨影山河》  国风     84BPM — 水墨夜山 · 灯河
 *   3.《星海远航》  太空合成波 110BPM — 深空星云航线
 * ============================================================ */
"use strict";

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------
 * 谱面生成器
 * 方块: {t, x:0-3, y:0-2, type:0红/1蓝/3炸弹, dir:0上1下2左3右4左上5右上6左下7右下8任意}
 * 光墙: {t, dur, side:-1左/1右}
 * 镜像双剑操作：红剑限制为竖直/圆点方向，蓝剑方向自由
 * ---------------------------------------------------------- */
function genMap(sections, spb, seed) {
  const rng = mulberry32(seed);
  const bar = spb * 4;
  const notes = [], walls = [];
  let hand = 0; // 0=左红 1=右蓝
  const lastDir = [1, 1];

  // 先布光墙，方块避开墙侧（墙在右→只出左手红方块，反之亦然）
  for (const sec of sections) {
    if (!sec.walls) continue;
    for (let b = sec.from; b < sec.to; b++) {
      if ((b - sec.from) % 4 === 2)
        walls.push({ t: b * bar, dur: bar * 1.5, side: ((b / 4) | 0) % 2 === 0 ? -1 : 1 });
    }
  }
  const wallSide = t => {
    for (const w of walls)
      if (t > w.t - spb * 0.5 && t < w.t + w.dur + spb * 0.5) return w.side;
    return 0;
  };

  function pickDir(h) {
    const prev = lastDir[h];
    let d = prev === 1 ? 0 : 1; // 上下交替流
    const r = rng();
    if (r < 0.13) d = 8;
    else if (h === 1 && r > 0.82) d = [2, 3, 5, 7][(rng() * 4) | 0];
    if (d === 0 || d === 1) lastDir[h] = d;
    return d;
  }
  function pickPos(h, d) {
    const x = h === 0 ? (rng() < 0.62 ? 1 : 0) : (rng() < 0.62 ? 2 : 3);
    let y;
    if (d === 0) y = rng() < 0.6 ? 0 : 1;        // 上切放低
    else if (d === 1) y = rng() < 0.55 ? 1 : (rng() < 0.5 ? 0 : 2); // 下切
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
    if (ws === -1) h = 1;      // 左侧有墙 → 蓝
    else if (ws === 1) h = 0;  // 右侧有墙 → 红
    const d = pickDir(h);
    const p = pickPos(h, d);
    add(t, p.x, p.y, h, d);
  }
  function double(t) {
    if (wallSide(t) !== 0) { single(t); return; }
    const r = rng();
    let dl, dr;
    if (r < 0.5) { dl = 1; dr = 1; }
    else if (r < 0.75) { dl = 0; dr = 0; }
    else { dl = 6; dr = 7; } // 对称斜切（镜像手感自然）
    const y = dl === 0 ? 0 : 1;
    add(t, 1, y, 0, dl);
    add(t, 2, y, 1, dr);
    lastDir[0] = lastDir[1] = (dl === 0 ? 0 : 1);
  }

  for (const sec of sections) {
    for (let b = sec.from; b < sec.to; b++) {
      const bt = b * bar;
      const localBar = b - sec.from;
      switch (sec.d) {
        case "one":
          single(bt);
          break;
        case "half":
          single(bt); single(bt + 2 * spb);
          break;
        case "beat":
          if (localBar % 4 === 0 && localBar > 0) { double(bt); single(bt + spb); single(bt + 2 * spb); single(bt + 3 * spb); }
          else for (let k = 0; k < 4; k++) single(bt + k * spb);
          break;
        case "eighth":
          if (localBar % 4 === 0) double(bt);
          for (let k = 0; k < 8; k++) {
            if (localBar % 4 === 0 && k === 0) continue;
            if (k % 2 === 1 && rng() < 0.22) continue; // 呼吸空隙
            single(bt + k * spb * 0.5);
          }
          break;
      }
      if (sec.bombs && localBar % 2 === 1) {
        const bt2 = bt + spb * (rng() < 0.5 ? 1 : 3);
        if (rng() < 0.85) add(bt2, 1, 2, 3, 8);
        if (rng() < 0.85) add(bt2, 2, 2, 3, 8);
      }
    }
  }
  notes.sort((a, b) => a.t - b.t);
  return { notes, walls };
}

/* ============================================================
 * 1.《霓虹脉冲 Neon Pulse》 — EDM 128BPM · A小调
 * ============================================================ */
function buildNeonPulse() {
  const bpm = 128, spb = 60 / bpm, bar = spb * 4, s16 = spb / 4;
  const E = [];
  const P = (t, i, o = {}) => E.push(Object.assign({ t, i }, o));
  // 和声: Am F C/G G
  const CH = [[57, 60, 64], [57, 60, 65], [55, 60, 64], [55, 59, 62]];
  const ROOT = [45, 41, 48, 43];
  const HOOK = [[76, 74, 72, 71], [69, 71, 72, 74], [76, 79, 76, 74], [72, 71, 69, 67]];
  const BREAK_MEL = [[69, 71, 72, 76], [74, 72, 71, 67], [72, 71, 69, 64], [64, 67, 69, 0]];
  const ARPPAT = [0, 1, 2, 3, 2, 1, 0, 2, 0, 1, 2, 3, 4, 3, 2, 1];

  const drums = (b, fill) => {
    const t = b * bar;
    for (let k = 0; k < 4; k++) P(t + k * spb, "kick", { v: 1 });
    P(t + spb, "clap", { v: 0.9 }); P(t + 3 * spb, "clap", { v: 0.9 });
    for (let k = 0; k < 8; k++) P(t + k * spb * 0.5, k % 2 ? "ohat" : "hat", { v: k % 2 ? 0.5 : 0.7 });
    if (fill) for (let k = 0; k < 4; k++) P(t + 3 * spb + k * s16, "snare", { v: 0.5 + k * 0.12 });
  };
  const bassline = (b, ci) => {
    const t = b * bar, r = ROOT[ci];
    [0, 3, 6, 8, 11, 14].forEach((st, j) => {
      P(t + st * s16, "bass", { m: j % 3 === 2 ? r + 12 : r, d: s16 * 2.2, v: 0.9 });
    });
  };
  const arps = (b, ci) => {
    const t = b * bar, c = CH[ci];
    const tones = [c[0] + 12, c[1] + 12, c[2] + 12, c[0] + 24, c[1] + 24];
    for (let k = 0; k < 16; k++) P(t + k * s16, "arp", { m: tones[ARPPAT[k]], d: s16, v: 0.55 });
  };

  // — 结构 —
  for (let b = 0; b < 8; b++) { // 前奏
    P(b * bar, "pad", { ms: CH[b % 4], d: bar, v: 1 });
    if (b >= 4) for (let k = 0; k < 8; k++) P(b * bar + k * spb * 0.5, "hat", { v: 0.4 });
    if (b >= 2) P(b * bar, "pluck", { m: CH[b % 4][2] + 12, d: spb * 2, v: 0.5 });
  }
  for (let b = 8; b < 16; b++) { // 铺垫
    const ci = b % 4, t = b * bar;
    for (let k = 0; k < 4; k++) P(t + k * spb, "kick", { v: 0.95 });
    bassline(b, ci);
    P(t, "pad", { ms: CH[ci], d: bar, v: 0.8 });
    for (let k = 0; k < 8; k++) P(t + k * spb * 0.5, k % 2 ? "ohat" : "hat", { v: 0.5 });
    if (b === 15) for (let k = 0; k < 16; k++) P(t + k * s16, "snare", { v: 0.35 + k * 0.045 });
  }
  P(12 * bar, "riser", { d: 4 * bar, v: 1 });
  P(16 * bar, "crash", { v: 1 });
  for (let b = 16; b < 32; b++) { // 主落 A
    const ci = b % 4;
    drums(b, b % 4 === 3);
    bassline(b, ci);
    arps(b, ci);
    if (b % 8 >= 4) HOOK[b % 4].forEach((m, k) => m && P(b * bar + k * spb, "lead", { m, d: spb * 0.9, v: 0.8 }));
  }
  P(32 * bar, "crash", { v: 0.8 });
  for (let b = 32; b < 40; b++) { // 间奏
    const ci = b % 4, t = b * bar;
    P(t, "pad", { ms: CH[ci], d: bar, v: 1 });
    BREAK_MEL[b % 4].forEach((m, k) => m && P(t + k * spb, "pluck", { m, d: spb, v: 0.7 }));
    if (b >= 36) for (let k = 0; k < 4; k++) P(t + k * spb, "kick", { v: 0.9 });
    for (let k = 0; k < 8; k++) P(t + k * spb * 0.5, "hat", { v: 0.35 });
  }
  P(36 * bar, "riser", { d: 4 * bar, v: 1 });
  P(40 * bar, "crash", { v: 1 });
  for (let b = 40; b < 56; b++) { // 主落 B
    const ci = b % 4;
    drums(b, b % 4 === 3);
    bassline(b, ci);
    arps(b, ci);
    HOOK[b % 4].forEach((m, k) => m && P(b * bar + k * spb, "lead", { m: m + (b % 8 >= 4 ? 12 : 0), d: spb * 0.9, v: 0.85 }));
  }
  P(56 * bar, "crash", { v: 1 });
  for (let b = 56; b < 60; b++) { // 尾声
    P(b * bar, "pad", { ms: CH[b % 4], d: bar, v: 0.9 - (b - 56) * 0.2 });
    for (let k = 0; k < 8; k++) P(b * bar + k * spb * 0.5, "hat", { v: 0.3 - (b - 56) * 0.06 });
  }
  P(60 * bar - spb, "gong", { v: 0.4 });

  const map = genMap([
    { from: 1, to: 8, d: "half" },
    { from: 8, to: 16, d: "beat" },
    { from: 16, to: 32, d: "eighth", walls: true },
    { from: 32, to: 36, d: "half", bombs: true },
    { from: 36, to: 40, d: "beat" },
    { from: 40, to: 56, d: "eighth", walls: true },
    { from: 56, to: 59, d: "one" }
  ], spb, 20260718);

  return {
    events: E, notes: map.notes, walls: map.walls,
    duration: 60 * bar + 2, bpm, spb
  };
}

/* ============================================================
 * 2.《墨影山河 Ink Shadows》 — 国风 84BPM · D宫调式
 * ============================================================ */
function buildInkShadows() {
  const bpm = 84, spb = 60 / bpm, bar = spb * 4, s16 = spb / 4;
  const E = [];
  const P = (t, i, o = {}) => E.push(Object.assign({ t, i }, o));
  const DRONE_D = [38, 50, 57, 62], DRONE_B = [35, 47, 54, 62];

  // 古筝主旋律（八小节乐段）[step16, midi, dur16]
  const MEL_A = [
    [[0, 62, 4], [4, 64, 4], [8, 66, 4], [12, 69, 4]],
    [[0, 71, 4], [4, 69, 4], [8, 66, 8]],
    [[0, 64, 4], [4, 66, 4], [8, 69, 4], [12, 71, 4]],
    [[0, 69, 4], [4, 66, 4], [8, 64, 8]],
    [[0, 74, 4], [4, 71, 4], [8, 69, 4], [12, 66, 4]],
    [[0, 71, 4], [4, 69, 4], [8, 66, 4], [12, 64, 4]],
    [[0, 66, 4], [4, 64, 4], [8, 62, 4], [12, 64, 4]],
    [[0, 62, 16]]
  ];
  // 竹笛旋律（B 段）
  const MEL_B = [
    [[0, 66, 8], [8, 69, 8]],
    [[0, 71, 16]],
    [[0, 74, 4], [4, 71, 4], [8, 69, 8]],
    [[0, 66, 16]],
    [[0, 64, 4], [4, 66, 4], [8, 69, 4], [12, 71, 4]],
    [[0, 69, 8], [8, 66, 8]],
    [[0, 64, 4], [4, 62, 4], [8, 64, 4], [12, 66, 4]],
    [[0, 64, 16]]
  ];
  const ARP_D = [50, 57, 62, 66, 69, 66, 62, 57];
  const ARP_B = [47, 54, 59, 62, 66, 62, 59, 54];

  const playMel = (startBar, mel, inst, oct = 0, vol = 0.8) => {
    mel.forEach((barNotes, bi) => {
      barNotes.forEach(([st, m, d]) => {
        P((startBar + bi) * bar + st * s16, inst, { m: m + oct, d: d * s16 * 0.95, v: vol });
      });
    });
  };
  const perc = (b, full) => {
    const t = b * bar;
    P(t, "tom", { f: 85, v: full ? 0.9 : 0.6 });
    if (full) P(t + 2 * spb, "tom", { f: 68, v: 0.5 });
    P(t + 2 * spb, "wood", { v: 0.6 });
    if (full) for (let k = 0; k < 8; k++) P(t + k * spb * 0.5, "hat", { v: 0.18 });
  };

  for (let b = 0; b < 4; b++) { // 起 — 云雾
    P(b * bar, "pad", { ms: DRONE_D, d: bar, v: 0.9 });
    if (b === 1) P(b * bar, "flute", { m: 69, d: bar * 0.9, v: 0.7 });
    if (b === 2) P(b * bar, "flute", { m: 71, d: bar * 0.6, v: 0.6 });
    if (b === 3) { P(b * bar, "flute", { m: 66, d: bar * 0.45, v: 0.6 }); P(b * bar + 2 * spb, "flute", { m: 64, d: bar * 0.45, v: 0.5 }); }
    P(b * bar, "pluck", { m: 50, d: spb * 2, v: 0.4 });
  }
  playMel(4, MEL_A, "pluck", 0, 0.85); // 承 — 古筝
  for (let b = 4; b < 12; b++) {
    P(b * bar, "pad", { ms: b % 4 < 2 ? DRONE_D : DRONE_B, d: bar, v: 0.55 });
    perc(b, b >= 8);
  }
  playMel(12, MEL_B, "flute", 0, 0.85); // 转 — 竹笛与筝瀑
  for (let b = 12; b < 20; b++) {
    const t = b * bar, arp = (b % 4 < 2) ? ARP_D : ARP_B;
    arp.forEach((m, k) => P(t + k * spb * 0.5, "pluck", { m, d: spb, v: 0.5 }));
    P(t, "pad", { ms: b % 4 < 2 ? DRONE_D : DRONE_B, d: bar, v: 0.5 });
    perc(b, true);
  }
  for (let b = 20; b < 24; b++) { // 静 — 桥段
    P(b * bar, "pad", { ms: DRONE_D, d: bar, v: 0.8 });
    if (b % 2 === 0) { P(b * bar + spb, "pluck", { m: 86, d: spb * 2, v: 0.35 }); P(b * bar + 3 * spb, "pluck", { m: 81, d: spb * 2, v: 0.3 }); }
    if (b === 23) for (let k = 0; k < 8; k++) P(b * bar + 2 * spb + k * spb * 0.25, "tom", { f: 70 + k * 6, v: 0.25 + k * 0.06 });
  }
  P(24 * bar, "gong", { v: 0.6 });
  playMel(24, MEL_A, "pluck", 0, 0.9); // 合 — 齐鸣
  playMel(24, MEL_A, "flute", 12, 0.4);
  for (let b = 24; b < 32; b++) {
    P(b * bar, "pad", { ms: b % 4 < 2 ? DRONE_D : DRONE_B, d: bar, v: 0.6 });
    perc(b, true);
  }
  for (let b = 32; b < 36; b++) { // 尾 — 归山
    P(b * bar, "pad", { ms: DRONE_D, d: bar, v: 0.8 - (b - 32) * 0.15 });
    if (b === 32) P(b * bar, "flute", { m: 74, d: bar * 1.8, v: 0.6 });
    if (b === 34) P(b * bar, "flute", { m: 69, d: bar * 1.5, v: 0.45 });
    if (b === 33) P(b * bar, "pluck", { m: 62, d: bar, v: 0.5 });
  }
  P(35 * bar + 2 * spb, "gong", { v: 0.7 });

  const map = genMap([
    { from: 1, to: 4, d: "one" },
    { from: 4, to: 12, d: "half" },
    { from: 12, to: 20, d: "beat" },
    { from: 20, to: 24, d: "half", bombs: true },
    { from: 24, to: 32, d: "beat" },
    { from: 32, to: 35, d: "one" }
  ], spb, 8848);

  return {
    events: E, notes: map.notes, walls: map.walls,
    duration: 36 * bar + 3, bpm, spb
  };
}

/* ============================================================
 * 3.《星海远航 Starbound》 — 太空合成波 110BPM · E小调
 * ============================================================ */
function buildStarbound() {
  const bpm = 110, spb = 60 / bpm, bar = spb * 4, s16 = spb / 4;
  const E = [];
  const P = (t, i, o = {}) => E.push(Object.assign({ t, i }, o));
  // Em C G D
  const ROOT = [40, 36, 43, 38];
  const PAD = [[52, 59, 64, 67], [48, 55, 60, 64], [43, 55, 59, 62], [50, 57, 62, 66]];
  const ARPT = [[64, 67, 71, 76], [60, 64, 67, 72], [59, 62, 67, 71], [62, 66, 69, 74]];
  const ARPPAT = [0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3];
  // 主歌旋律（8 小节副歌）[step16, midi, dur16]
  const CHORUS = [
    [[0, 76, 6], [6, 74, 2], [8, 71, 8]],
    [[0, 72, 4], [4, 71, 2], [6, 69, 2], [8, 67, 8]],
    [[0, 71, 4], [4, 74, 4], [8, 79, 8]],
    [[0, 78, 6], [6, 76, 2], [8, 74, 8]],
    [[0, 79, 6], [6, 78, 2], [8, 76, 8]],
    [[0, 76, 4], [4, 74, 4], [8, 72, 8]],
    [[0, 74, 4], [4, 71, 4], [8, 67, 8]],
    [[0, 69, 8], [8, 71, 8]]
  ];

  const arps = (b, v = 0.5) => {
    const t = b * bar, tones = ARPT[b % 4];
    for (let k = 0; k < 16; k++) P(t + k * s16, "arp", { m: tones[ARPPAT[k]], d: s16, v });
  };
  const drums = (b) => {
    const t = b * bar;
    P(t, "kick", { v: 1 }); P(t + 2 * spb, "kick", { v: 0.95 });
    P(t + 2.75 * spb, "kick", { v: 0.6 });
    P(t + spb, "snare", { v: 0.85 }); P(t + 3 * spb, "snare", { v: 0.85 });
    for (let k = 0; k < 16; k++) if (k % 2) P(t + k * s16, "hat", { v: 0.3 });
  };
  const bassline = (b) => {
    const t = b * bar, r = ROOT[b % 4];
    for (let k = 0; k < 8; k++) P(t + k * spb * 0.5, "bass", { m: k % 2 ? r + 12 : r, d: spb * 0.45, v: 0.8 });
  };
  const chorusMel = (startBar, oct = 0, v = 0.85) => {
    CHORUS.forEach((barNotes, bi) => {
      barNotes.forEach(([st, m, d]) => {
        P((startBar + bi) * bar + st * s16, "lead", { m: m + oct, d: d * s16 * 0.92, v });
      });
    });
  };

  for (let b = 0; b < 8; b++) { // 引擎点火
    P(b * bar, "pad", { ms: PAD[b % 4], d: bar, v: 1 });
    arps(b, 0.35 + b * 0.02);
    if (b >= 4) for (let k = 0; k < 16; k++) if (k % 2) P(b * bar + k * s16, "hat", { v: 0.2 });
    if (b === 7) for (let k = 0; k < 8; k++) P(b * bar + 2 * spb + k * spb * 0.25, "snare", { v: 0.25 + k * 0.08 });
  }
  P(8 * bar, "crash", { v: 0.9 });
  for (let b = 8; b < 20; b++) { // 巡航
    drums(b); bassline(b); arps(b, 0.45);
    P(b * bar, "pad", { ms: PAD[b % 4], d: bar, v: 0.6 });
  }
  P(16 * bar, "riser", { d: 4 * bar, v: 0.9 });
  P(20 * bar, "crash", { v: 1 });
  for (let b = 20; b < 32; b++) { // 副歌 1 — 穿越星门
    drums(b); bassline(b); arps(b, 0.4);
    P(b * bar, "pad", { ms: PAD[b % 4], d: bar, v: 0.7 });
  }
  chorusMel(20, 0, 0.85);
  chorusMel(28, 0, 0.8); // 后 4 小节重复前半乐句
  for (let b = 32; b < 38; b++) { // 桥 — 失重
    const t = b * bar;
    P(t, "pad", { ms: PAD[b % 4], d: bar, v: 1 });
    arps(b, 0.3);
    P(t, "tom", { f: 95, v: 0.5 });
    P(t + 2 * spb, "tom", { f: 75, v: 0.4 });
    if (b === 37) { P(t, "riser", { d: bar, v: 1 }); for (let k = 0; k < 16; k++) P(t + k * s16, "snare", { v: 0.2 + k * 0.05 }); }
  }
  P(38 * bar, "crash", { v: 1 });
  for (let b = 38; b < 50; b++) { // 副歌 2 — 全速
    drums(b); bassline(b); arps(b, 0.45);
    P(b * bar, "pad", { ms: PAD[b % 4], d: bar, v: 0.7 });
  }
  chorusMel(38, 12, 0.7);
  chorusMel(46, 0, 0.8);
  for (let b = 50; b < 54; b++) { // 泊入星港
    P(b * bar, "pad", { ms: PAD[b % 4], d: bar, v: 0.9 - (b - 50) * 0.18 });
    arps(b, 0.3 - (b - 50) * 0.06);
  }
  P(50 * bar, "crash", { v: 0.7 });
  P(54 * bar - spb, "gong", { v: 0.35 });

  const map = genMap([
    { from: 1, to: 8, d: "half" },
    { from: 8, to: 20, d: "beat" },
    { from: 20, to: 32, d: "eighth", walls: true },
    { from: 32, to: 38, d: "half", bombs: true },
    { from: 38, to: 50, d: "eighth", walls: true },
    { from: 50, to: 53, d: "one" }
  ], spb, 424242);

  return {
    events: E, notes: map.notes, walls: map.walls,
    duration: 54 * bar + 2, bpm, spb
  };
}

/* ============================================================
 * 曲目登记表
 * ============================================================ */
const SONGS = [
  {
    id: "neon",
    name: "霓虹脉冲",
    en: "NEON PULSE",
    style: "电子舞曲 · EDM",
    desc: "穿行赛博都市的霓虹峡谷，激光与节拍同频闪烁。",
    bpm: 128, diff: "困难", env: "neon", speed: 19,
    colorL: 0xff2bd0, colorR: 0x00e5ff,
    cardBg: "linear-gradient(160deg,#2b0a3d,#0e1445 55%,#032c3f), radial-gradient(80px 40px at 70% 30%, rgba(0,229,255,.8), transparent)",
    build: buildNeonPulse
  },
  {
    id: "ink",
    name: "墨影山河",
    en: "INK SHADOWS",
    style: "国风 · 古筝竹笛",
    desc: "月照水墨群山，灯河随古筝声缓缓升起。",
    bpm: 84, diff: "简单", env: "ink", speed: 13,
    colorL: 0xff4a3a, colorR: 0x2fe6a8,
    cardBg: "linear-gradient(160deg,#131722,#1d2433 55%,#0d1120), radial-gradient(90px 50px at 30% 25%, rgba(247,231,192,.55), transparent)",
    build: buildInkShadows
  },
  {
    id: "space",
    name: "星海远航",
    en: "STARBOUND",
    style: "太空合成波 · Synthwave",
    desc: "跃迁引擎轰鸣，星云与流光在舷窗外飞驰。",
    bpm: 110, diff: "普通", env: "space", speed: 16,
    colorL: 0xb266ff, colorR: 0x4fc3ff,
    cardBg: "linear-gradient(160deg,#0a0a2e,#1b0e3d 50%,#020214), radial-gradient(70px 70px at 75% 65%, rgba(178,102,255,.6), transparent)",
    build: buildStarbound
  }
];
