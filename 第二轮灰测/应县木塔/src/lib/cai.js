// ---------------------------------------------------------------------------
// 材分制度（《营造法式》卷四·大木作制度）
//
// 应县木塔（辽·清宁二年 1056）用材：材广 25.5 cm、材厚 17 cm，
// 即《法式》二等材。一切构件尺寸都由「分°」推出，本文件即全塔的度量基准。
//
//   材广 = 15 分°      材厚 = 10 分°
//   栔   =  6 分°      足材 = 21 分°（材 + 栔）
//   每跳 = 30 分°（第四跳减为 26 分°）
// ---------------------------------------------------------------------------

export const CAI = 0.255; // 材广 (m)
export const FEN = CAI / 15; // 1 分° = 1.7 cm
export const CAI_T = 10 * FEN; // 材厚（= 斗口宽）
export const QI = 6 * FEN; // 栔
export const ZUCAI = 21 * FEN; // 足材
export const DANCAI = 15 * FEN; // 单材

/** 分° → 米 */
export const f = (n) => n * FEN;

/* ------------------------------- 斗 ------------------------------------- */
// 高度构成：耳 + 平 + 欹（欹向下收进，故用棱台）
export const DOU = {
  lu: { size: f(32), bot: f(22), h: f(20), er: f(8), ping: f(4), yi: f(8) }, // 栌斗
  jiaohu: { size: f(18), bot: f(13), h: f(10), er: f(4), ping: f(2), yi: f(4) }, // 交互斗
  qixin: { size: f(16), bot: f(11.5), h: f(10), er: f(4), ping: f(2), yi: f(4) }, // 齐心斗
  san: { size: f(16), bot: f(11.5), h: f(10), er: f(4), ping: f(2), yi: f(4) }, // 散斗
  ping: { size: f(16), bot: f(13), h: f(6), er: 0, ping: f(2), yi: f(4) }, // 平盘斗（转角用）
};
/** 斗上层「耳」以下的净升高（= 栔），拱底即落在此高度 */
export const douRise = (k) => DOU[k].ping + DOU[k].yi;

/* ------------------------------- 拱 ------------------------------------- */
export const GONG = {
  hua: f(72), // 华拱（出跳）
  nidao: f(62), // 泥道拱
  guazi: f(62), // 瓜子拱
  ling: f(72), // 令拱
  man: f(92), // 慢拱
};
export const JUMP = [f(30), f(30), f(30), f(26)]; // 各跳长

/* ========================================================================== */
/*                              构件侧样轮廓                                  */
/* ========================================================================== */

/**
 * 拱：两端「四瓣卷杀」——《法式》"栱头上留六分,下杀九分,分四瓣"
 * @param {number} L 拱长
 * @param {number} H 拱高（单材 15 分° / 足材 21 分°）
 * @param {Object} o notchTop / notchBot: [{x, w, d}] 卯口（十字搭交用）
 */
export function gongProfile(L, H, o = {}) {
  const juan = o.juan ?? f(16); // 卷杀水平长
  const tip = o.tip ?? f(6); // 拱头留高
  const n = o.ban ?? 4; // 瓣数
  const cut = Math.max(H - tip, f(2)); // 下杀高
  const hl = L / 2;
  const pts = [];
  // 底面：左卷杀根 → 右卷杀根（中间可留卯口）
  pts.push([-hl + juan, 0]);
  const nb = (o.notchBot || []).slice().sort((a, b) => a.x - b.x);
  for (const nn of nb) {
    pts.push([nn.x - nn.w / 2, 0]);
    pts.push([nn.x - nn.w / 2, nn.d]);
    pts.push([nn.x + nn.w / 2, nn.d]);
    pts.push([nn.x + nn.w / 2, 0]);
  }
  pts.push([hl - juan, 0]);
  // 右端卷杀（下 → 上）
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    pts.push([hl - juan + juan * t, cut * (1 - Math.sqrt(1 - t * t))]);
  }
  pts.push([hl, H]);
  // 顶面：右 → 左（可留卯口）
  const nt = (o.notchTop || []).slice().sort((a, b) => b.x - a.x);
  for (const nn of nt) {
    pts.push([nn.x + nn.w / 2, H]);
    pts.push([nn.x + nn.w / 2, H - nn.d]);
    pts.push([nn.x - nn.w / 2, H - nn.d]);
    pts.push([nn.x - nn.w / 2, H]);
  }
  pts.push([-hl, H]);
  // 左端卷杀（上 → 下）
  for (let i = n; i >= 1; i--) {
    const t = i / n;
    pts.push([-hl + juan - juan * t, cut * (1 - Math.sqrt(1 - t * t))]);
  }
  return pts;
}

/**
 * 下昂（批竹昂）：内端（昂尾）高、外端（昂尖）低，昂嘴斜杀
 * 轮廓坐标：x = 出跳方向，y = 竖直；原点在「昂底与斗口相交处」
 * @param {number} out  自原点向外的水平长度（到昂尖）
 * @param {number} tail 自原点向内的水平长度（昂尾）
 * @param {number} H    昂厚（足材 21 分°）
 * @param {number} slope 昂身斜率（下昂向外下斜，取 1:3）
 */
export function angProfile(out, tail, H, slope = 1 / 3, o = {}) {
  const beak = o.beak ?? H * 1.5; // 昂嘴斜杀水平长
  const tipH = o.tipH ?? f(4); // 昂尖留高
  const yb = (x) => -slope * x; // 昂底线
  const pts = [];
  // 昂底：内 → 外
  pts.push([-tail, yb(-tail)]);
  pts.push([out, yb(out)]);
  // 昂尖（批竹斜杀）
  pts.push([out, yb(out) + tipH]);
  pts.push([out - beak, yb(out - beak) + H]);
  // 昂面：外 → 内
  pts.push([-tail, yb(-tail) + H]);
  return pts;
}

/** 华头子：托在下昂之下的小拱头（一端卷杀） */
export function huatouziProfile(len, H) {
  const juan = f(10);
  const pts = [[0, 0], [len - juan, 0]];
  for (let i = 1; i <= 4; i++) {
    const t = i / 4;
    pts.push([len - juan + juan * t, (H - f(4)) * (1 - Math.sqrt(1 - t * t))]);
  }
  pts.push([len, H]);
  pts.push([0, H]);
  return pts;
}

/** 耍头（蚂蚱头）：最上一跳的梁头 */
export function shuatouProfile(out, tail, H) {
  const n = f(6);
  return [
    [-tail, 0],
    [out - n * 2, 0],
    [out - n, n * 0.5],
    [out, n * 0.5],
    [out, H - n * 0.6],
    [out - n * 1.2, H - n * 0.2],
    [out - n * 2.4, H],
    [-tail, H],
  ];
}

/** 替木（拱上承槫的短木，两端卷杀） */
export function timuProfile(L, H) {
  const juan = f(8);
  const hl = L / 2;
  const pts = [[-hl + juan, 0], [hl - juan, 0]];
  for (let i = 1; i <= 3; i++) {
    const t = i / 3;
    pts.push([hl - juan + juan * t, (H - f(3)) * (1 - Math.sqrt(1 - t * t))]);
  }
  pts.push([hl, H], [-hl, H]);
  for (let i = 3; i >= 1; i--) {
    const t = i / 3;
    pts.push([-hl + juan - juan * t, (H - f(3)) * (1 - Math.sqrt(1 - t * t))]);
  }
  return pts;
}

/** 燕尾榫（大头在外）平面轮廓：用于阑额入柱头 */
export function dovetailProfile(len, w0, w1, thick) {
  // x = 沿额枋方向，y = 宽度方向（水平），挤出方向 = 竖直厚度
  return [
    [0, -w0 / 2],
    [len, -w1 / 2],
    [len, w1 / 2],
    [0, w0 / 2],
  ];
}

/** 梁头（丁头栿）侧样：外端做出斜杀 */
export function liangProfile(L, H) {
  const n = f(8);
  return [
    [0, 0],
    [L - n, 0],
    [L, n],
    [L, H - n * 0.5],
    [L - n * 1.4, H],
    [0, H],
  ];
}
