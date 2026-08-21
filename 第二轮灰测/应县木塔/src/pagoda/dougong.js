// ---------------------------------------------------------------------------
// 铺作（斗拱）
//
// 局部坐标：原点 = 栌斗底面中心（即柱头 / 普拍枋上皮）
//           +Z = 出跳方向（朝外）   +X = 顺身方向（沿檐）   +Y = 上
//
// 结构要点（皆按《营造法式》）：
//   · 斗口由「斗耳」围出，是真正的卯口；拱落在斗口里，两侧被斗耳夹住
//   · 十字相交的拱各刻去一半（华拱刻下半、泥道拱刻上半），是真正的搭交榫
//   · 每层升高 = 材(15分) + 栔(6分) = 21分，栔正好被斗的「平 + 欹」占满
//   · 下昂斜下出跳，昂尾向内上挑，被上层枋压住；昂下托华头子
//   · 计心造放瓜子拱 / 慢拱，偷心造则跳上不设横拱（辽构常用）
// ---------------------------------------------------------------------------
import { MAT } from '../lib/materials.js';
import {
  f,
  CAI_T,
  DANCAI,
  ZUCAI,
  DOU,
  douRise,
  GONG,
  gongProfile,
  angProfile,
  huatouziProfile,
  shuatouProfile,
  timuProfile,
} from '../lib/cai.js';

/* -------------------------------------------------------------------------- */
/*                                   斗                                       */
/* -------------------------------------------------------------------------- */
/**
 * 斗：斗欹 + 斗平（棱台）+ 斗耳（分块围出斗口）
 * @param slot 'cross' 十字口 | 'x' 顺身口 | 'z' 出跳口 | 'none' 平盘
 * @returns {number} 斗总高
 */
export function douBlock(s, kind, x, y, z, ry = 0, o = {}) {
  const d = DOU[kind];
  const k = o.scale ?? 1;
  const size = d.size * k;
  const bot = d.bot * k;
  const hBase = (d.yi + d.ping) * k; // 欹 + 平（= 栔，被上层拱底占据前的净高）
  const hEr = d.er * k;
  const slotW = (o.slotW ?? CAI_T) * k;
  const mat = o.mat ?? MAT.dou;
  s.push(x, y, z, ry);
  s.frustum(mat, bot, bot, size, size, hBase, 0, 0, 0, 0, 0.32);
  const slot = o.slot ?? 'cross';
  if (hEr > 1e-4 && slot !== 'none') {
    const side = (size - slotW) / 2;
    if (slot === 'cross') {
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          s.box(mat, side, hEr, side, (sx * (size - side)) / 2, hBase, (sz * (size - side)) / 2, 0, 0.3);
    } else if (slot === 'x') {
      for (const sz of [-1, 1]) s.box(mat, size, hEr, side, 0, hBase, (sz * (size - side)) / 2, 0, 0.3);
    } else {
      for (const sx of [-1, 1]) s.box(mat, side, hEr, size, (sx * (size - side)) / 2, hBase, 0, 0, 0.3);
    }
  } else if (hEr > 1e-4) {
    s.box(mat, size, hEr, size, 0, hBase, 0, 0, 0.3);
  }
  s.pop();
  return hBase + hEr;
}

/* -------------------------------------------------------------------------- */
/*                                  拱                                        */
/* -------------------------------------------------------------------------- */
/** 顺身拱（泥道拱 / 瓜子拱 / 慢拱 / 令拱）：沿 X 方向 */
function gongX(s, len, y, z, o = {}) {
  const k = o.scale ?? 1;
  const H = (o.zucai ? ZUCAI : DANCAI) * k;
  const th = CAI_T * k;
  const pts = gongProfile(len * k, H, {
    juan: f(16) * k,
    tip: f(6) * k,
    ban: o.ban ?? 4,
    notchTop: o.notchTop,
    notchBot: o.notchBot,
  });
  s.profile(o.mat ?? MAT.gong, pts, th, 0, y, z, 0, 0.34);
  return H;
}

/** 出跳华拱：沿 Z 方向（ry = -90°，令轮廓 x 轴指向 +Z） */
function gongZ(s, len, y, z, o = {}) {
  const k = o.scale ?? 1;
  const H = (o.zucai ? ZUCAI : DANCAI) * k;
  const th = CAI_T * k;
  const pts = gongProfile(len * k, H, {
    juan: f(16) * k,
    tip: f(6) * k,
    notchTop: o.notchTop,
    notchBot: o.notchBot,
  });
  s.profile(o.mat ?? MAT.gong, pts, th, 0, y, z, -Math.PI / 2, 0.34);
  return H;
}

/* -------------------------------------------------------------------------- */
/*                                 铺作                                       */
/* -------------------------------------------------------------------------- */
/**
 * @param {Object} o
 *   jumps   ['hua','hua','ang','ang'] —— 出跳序列（抄 / 昂）
 *   jixin   [false,true,false,true]   —— 各跳是否计心（放横拱）
 *   inner   里跳数（华拱）
 *   scale   材等缩放
 *   corner  转角铺作（附加 ±22.5° 两缝）
 *   shuatou 是否出耍头
 *   lingGong 最外跳令拱 + 撩檐枋
 * @returns 铺作总高与各层标高（供枋、椽定位）
 */
export function puzuo(s, o = {}) {
  const k = o.scale ?? 1;
  const F = (n) => f(n) * k;
  const gH = DANCAI * k;
  const zH = ZUCAI * k;
  const th = CAI_T * k;
  const jumps = o.jumps ?? ['hua', 'hua', 'ang', 'ang'];
  const jixin = o.jixin ?? jumps.map((_, i) => i % 2 === 1);
  const jumpLen = o.jumpLen ?? jumps.map((_, i) => (i === jumps.length - 1 ? F(26) : F(30)));
  const slope = o.angSlope ?? 1 / 3;

  const meta = { tiers: [], fangY: [], jumpZ: [], height: 0, reach: 0 };
  const bare = o.bare ?? false; // 转角铺作的两侧列拱：只出跳，不重复栌斗与心上横拱

  /* ---------------- 栌斗 ---------------- */
  let y0;
  if (bare) {
    y0 = (DOU.lu.ping + DOU.lu.yi) * k;
  } else {
    douBlock(s, 'lu', 0, 0, 0, 0, { scale: k, slot: 'cross' });
    y0 = (DOU.lu.ping + DOU.lu.yi) * k;

    /* ---------------- 心上：泥道拱（刻上半）---------------- */
    gongX(s, GONG.nidao, y0, 0, {
      scale: k,
      notchTop: [{ x: 0, w: th, d: gH / 2 }],
    });
    // 泥道拱两端散斗
    const nd2 = (GONG.nidao * k) / 2;
    douBlock(s, 'san', nd2 - DOU.san.size * k * 0.5, y0 + gH, 0, 0, { scale: k, slot: 'x' });
    douBlock(s, 'san', -(nd2 - DOU.san.size * k * 0.5), y0 + gH, 0, 0, { scale: k, slot: 'x' });
    meta.tiers.push({ y: y0, z: 0, kind: 'nidao' });

    // 慢拱（第二层顺身拱）+ 齐心斗、散斗
    const manY = y0 + gH + douRise('san') * k;
    gongX(s, GONG.man, manY, 0, { scale: k });
    const mn2 = (GONG.man * k) / 2;
    douBlock(s, 'qixin', 0, manY + gH, 0, 0, { scale: k, slot: 'x' });
    douBlock(s, 'san', mn2 - DOU.san.size * k * 0.5, manY + gH, 0, 0, { scale: k, slot: 'x' });
    douBlock(s, 'san', -(mn2 - DOU.san.size * k * 0.5), manY + gH, 0, 0, { scale: k, slot: 'x' });
    meta.tiers.push({ y: manY, z: 0, kind: 'man' });
    // 柱头枋标高（由 structure.js 沿面阔通铺）
    let fy = manY + gH + douRise('qixin') * k;
    for (let i = 0; i < (o.fangCount ?? 3); i++) {
      meta.fangY.push(fy);
      fy += gH + QI_K(k);
    }
  }

  /* ---------------- 逐跳出挑 ---------------- */
  let y = y0; // 当前出跳构件底
  let zc = 0; // 当前构件中心（跳心）
  let topAtNext = 0;
  for (let i = 0; i < jumps.length; i++) {
    const kind = jumps[i];
    const nz = zc + jumpLen[i];
    meta.jumpZ.push(nz);
    const last = i === jumps.length - 1;

    if (kind === 'hua') {
      // 华拱：长 72 分，刻下半与顺身拱搭交
      gongZ(s, GONG.hua, y, zc, {
        scale: k,
        notchBot: i === 0 ? [{ x: 0, w: th, d: gH / 2 }] : null,
      });
      topAtNext = y + gH;
    } else {
      // 下昂：底线过 (zc, y)，向外下斜；昂尾向内上挑
      const tail = o.angTail ?? F(60);
      const out = jumpLen[i] + (last ? F(14) : F(2));
      const pts = angProfile(out, tail, zH, slope, { beak: zH * 1.6, tipH: F(4) });
      s.profile(MAT.ang, pts, th, 0, y, zc, -Math.PI / 2, 0.34);
      // 华头子：托在昂底、与下层拱十字相交
      const ht = huatouziProfile(F(26), gH * 0.72);
      s.profile(MAT.gong, ht, th, 0, y - gH * 0.72, zc, -Math.PI / 2, 0.32);
      topAtNext = y + zH - slope * jumpLen[i];
    }

    /* 计心：跳上放瓜子拱（最外跳放令拱）*/
    if (last && (o.lingGong ?? true)) {
      // 交互斗承令拱
      douBlock(s, 'jiaohu', 0, topAtNext, nz, 0, { scale: k, slot: 'cross' });
      const ly = topAtNext + douRise('jiaohu') * k;
      gongX(s, GONG.ling, ly, nz, { scale: k });
      const l2 = (GONG.ling * k) / 2;
      douBlock(s, 'qixin', 0, ly + gH, nz, 0, { scale: k, slot: 'x' });
      douBlock(s, 'san', l2 - DOU.san.size * k * 0.5, ly + gH, nz, 0, { scale: k, slot: 'x' });
      douBlock(s, 'san', -(l2 - DOU.san.size * k * 0.5), ly + gH, nz, 0, { scale: k, slot: 'x' });
      meta.lingY = ly;
      meta.liaoyanY = ly + gH + douRise('qixin') * k; // 撩檐枋底
      meta.liaoyanZ = nz;
      meta.height = meta.liaoyanY + ZUCAI * k;
      // 耍头（在令拱之上、与撩檐枋同层出头）
      if (o.shuatou ?? true) {
        const st = shuatouProfile(F(34), F(30), zH);
        s.profile(MAT.ang, st, th, 0, meta.liaoyanY, nz, -Math.PI / 2, 0.34);
      }
    } else if (jixin[i]) {
      douBlock(s, 'jiaohu', 0, topAtNext, nz, 0, { scale: k, slot: 'cross' });
      const gy = topAtNext + douRise('jiaohu') * k;
      gongX(s, GONG.guazi, gy, nz, { scale: k });
      const g2 = (GONG.guazi * k) / 2;
      douBlock(s, 'san', g2 - DOU.san.size * k * 0.5, gy + gH, nz, 0, { scale: k, slot: 'x' });
      douBlock(s, 'san', -(g2 - DOU.san.size * k * 0.5), gy + gH, nz, 0, { scale: k, slot: 'x' });
      // 慢拱压于瓜子拱之上
      const my = gy + gH + douRise('san') * k;
      gongX(s, GONG.man, my, nz, { scale: k });
      const m2 = (GONG.man * k) / 2;
      douBlock(s, 'qixin', 0, my + gH, nz, 0, { scale: k, slot: 'x' });
      douBlock(s, 'san', m2 - DOU.san.size * k * 0.5, my + gH, nz, 0, { scale: k, slot: 'x' });
      douBlock(s, 'san', -(m2 - DOU.san.size * k * 0.5), my + gH, nz, 0, { scale: k, slot: 'x' });
      meta.tiers.push({ y: my, z: nz, kind: 'man-out' });
      y = topAtNext + douRise('jiaohu') * k;
      zc = nz;
      continue;
    } else {
      // 偷心：跳头只置交互斗，直接承上一跳
      douBlock(s, 'jiaohu', 0, topAtNext, nz, 0, { scale: k, slot: 'cross' });
    }
    y = topAtNext + douRise('jiaohu') * k;
    zc = nz;
  }
  meta.reach = zc;

  /* ---------------- 里跳 ---------------- */
  const inner = bare ? 0 : o.inner ?? 2;
  let iy = y0;
  let iz = 0;
  for (let i = 0; i < inner; i++) {
    const nz = iz - F(30);
    gongZ(s, GONG.hua, iy, iz, { scale: k });
    const t = iy + gH;
    douBlock(s, 'jiaohu', 0, t, nz, 0, { scale: k, slot: 'cross' });
    iy = t + douRise('jiaohu') * k;
    iz = nz;
    if (i === inner - 1) {
      // 里跳令拱 + 替木，承内槽罗汉枋
      gongX(s, GONG.ling, iy, nz, { scale: k });
      douBlock(s, 'qixin', 0, iy + gH, nz, 0, { scale: k, slot: 'x' });
      const tm = timuProfile(F(60) * k, gH * 0.6);
      s.profile(MAT.gong, tm, th, 0, iy + gH + douRise('qixin') * k, nz, 0, 0.3);
      meta.innerTopY = iy + gH + douRise('qixin') * k + gH * 0.6;
      meta.innerZ = nz;
    }
  }

  if (!meta.height) meta.height = y + gH;
  return meta;
}

const QI_K = (k) => f(6) * k;

/* -------------------------------------------------------------------------- */
/*                              转角铺作                                      */
/* -------------------------------------------------------------------------- */
/**
 * 转角铺作：正出（角缝，沿 45° 分角线）+ 两侧列拱（各偏 22.5°）
 * 八边形转角内角 135°，故两相邻檐面法线相差 45°
 */
export function puzuoCorner(s, o = {}) {
  const k = o.scale ?? 1;
  const half = Math.PI / 8; // 22.5°
  // 角缝：出跳加长 1/cos22.5°
  const meta = puzuo(s, {
    ...o,
    jumpLen: (o.jumps ?? ['hua', 'hua', 'ang', 'ang']).map((_, i, a) =>
      ((i === a.length - 1 ? f(26) : f(30)) * k) / Math.cos(half)
    ),
    inner: 1,
    corner: true,
  });
  // 两侧列拱（只出跳、不再重复心上横拱）
  for (const sd of [-1, 1]) {
    s.push(0, 0, 0, sd * half * 2);
    puzuo(s, {
      ...o,
      scale: k,
      bare: true,
      lingGong: true,
      shuatou: false,
      jixin: (o.jumps ?? ['hua', 'hua', 'ang', 'ang']).map(() => false),
      fangCount: 0,
    });
    s.pop();
  }
  return meta;
}

/* -------------------------------------------------------------------------- */
/*                          平坐铺作（卷头造，无昂）                            */
/* -------------------------------------------------------------------------- */
export function puzuoPingzuo(s, o = {}) {
  return puzuo(s, {
    jumps: ['hua', 'hua'],
    jixin: [false, true],
    inner: 1,
    shuatou: false,
    fangCount: 2,
    scale: o.scale ?? 1,
    ...o,
  });
}

/* -------------------------------------------------------------------------- */
/*                        内槽铺作（朝内出跳，承内额）                          */
/* -------------------------------------------------------------------------- */
export function puzuoInner(s, o = {}) {
  return puzuo(s, {
    jumps: ['hua', 'hua'],
    jixin: [false, true],
    inner: 1,
    shuatou: false,
    lingGong: true,
    fangCount: 2,
    scale: o.scale ?? 1,
    ...o,
  });
}
