// ---------------------------------------------------------------------------
// 大木构架：台基 / 柱网 / 阑额普拍枋 / 暗层斜撑 / 平坐 / 勾栏 / 门窗
//
// 木塔为「双层套筒式」：每层内槽 8 柱、外槽 24 柱，两圈之间以乳栿相连；
// 明层之上必设暗层，暗层内密布斜撑，形成八边形刚性桁架箍 —— 这是木塔
// 历千年地震不倒的关键。柱有侧脚（向内倾）、生起（角柱略高）、收分（上细下粗）。
// ---------------------------------------------------------------------------
import { MAT } from '../lib/materials.js';
import {
  OCT_N,
  octFaceAngle,
  octCornerPos,
  octCorner,
  octRing,
} from '../lib/geom.js';
import { f, CAI_T, DANCAI, ZUCAI, dovetailProfile, liangProfile } from '../lib/cai.js';

const TAU = Math.PI * 2;

/** 一圈的开间：返回每个开间的中点、弦长、所在面的朝外角 */
export function ringBays(apo, perFace = 2) {
  const bays = [];
  for (let fc = 0; fc < OCT_N; fc++) {
    const c0 = octCornerPos(apo, fc - 1);
    const c1 = octCornerPos(apo, fc);
    const n = perFace + 1;
    for (let k = 0; k < n; k++) {
      const t0 = k / n;
      const t1 = (k + 1) / n;
      const x0 = c0.x + (c1.x - c0.x) * t0;
      const z0 = c0.z + (c1.z - c0.z) * t0;
      const x1 = c0.x + (c1.x - c0.x) * t1;
      const z1 = c0.z + (c1.z - c0.z) * t1;
      bays.push({
        x: (x0 + x1) / 2,
        z: (z0 + z1) / 2,
        len: Math.hypot(x1 - x0, z1 - z0),
        a: octFaceAngle(fc),
        face: fc,
        bay: k,
        edge: [x0, z0, x1, z1],
      });
    }
  }
  return bays;
}

/* ========================================================================== */
/*                                   台基                                     */
/* ========================================================================== */
/** 下层方台 + 上层八角台（月台、踏道从略，只做塔基本体） */
export function platform(s, o = {}) {
  const apo = o.apo ?? 15.6; // 八角台边心距
  const h1 = o.h1 ?? 1.7; // 下层方台高
  const h2 = o.h2 ?? 2.3; // 上层八角台高
  const sq = o.sq ?? 20.4; // 方台半边长
  // 下层方台（压阑石 + 台身）
  s.box(MAT.stoneDark, sq * 2, 0.34, sq * 2, 0, -h1 - h2, 0, 0, 1.4);
  s.box(MAT.stone, sq * 2 - 0.5, h1 - 0.34, sq * 2 - 0.5, 0, -h1 - h2 + 0.34, 0, 0, 1.4);
  s.box(MAT.stoneDark, sq * 2 - 0.2, 0.3, sq * 2 - 0.2, 0, -h2 - 0.3, 0, 0, 1.4);
  // 上层八角台
  const rc = octCorner(apo);
  s.cyl(MAT.stone, rc * 0.995, rc, h2 - 0.34, 0, -h2, 0, OCT_N, Math.PI / OCT_N, 1.6);
  s.cyl(MAT.stoneDark, rc + 0.18, rc + 0.18, 0.34, 0, -0.34, 0, OCT_N, Math.PI / OCT_N, 1.2);
  // 台面
  s.cyl(MAT.stone, rc - 0.1, rc - 0.1, 0.1, 0, -0.1, 0, OCT_N, Math.PI / OCT_N, 2);
  return { top: 0 };
}

/* ========================================================================== */
/*                                   柱                                       */
/* ========================================================================== */
/**
 * 一圈柱：侧脚（向内倾 1%）、生起（角柱加高）、收分（上端略细）
 * @returns 柱头信息 [{x,z,a,corner,yTop}]
 */
export function columnRing(s, o = {}) {
  const apo = o.apo;
  const perFace = o.perFace ?? 2;
  const h = o.h;
  const r = o.r ?? 0.28;
  const y0 = o.y ?? 0;
  const mat = o.mat ?? MAT.zhu;
  const lean = o.lean ?? 0.01; // 侧脚
  const rise = o.rise ?? 0.06; // 角柱生起
  const cols = octRing(apo, perFace);
  const heads = [];
  for (const c of cols) {
    const hh = h + (c.corner ? rise : 0);
    s.push(c.x, y0, c.z, c.a, 1, -lean, 0);
    if (o.base !== false) {
      // 柱础（覆盆式）
      s.cyl(MAT.base, r * 2.0, r * 2.25, 0.14, 0, -0.14, 0, 14, 0, 0.8);
      s.frustum(MAT.base, r * 3.4, r * 3.4, r * 2.6, r * 2.6, 0.22, 0, -0.36, 0, 0, 0.8);
    }
    s.cyl(mat, r * 0.93, r, hh, 0, 0, 0, 14, 0, 0.9);
    // 柱头馒头榫（插入栌斗底卯口）
    s.cyl(MAT.tenon, r * 0.34, r * 0.36, f(6), 0, hh, 0, 10, 0, 0.4);
    s.pop();
    heads.push({ ...c, yTop: y0 + hh, r });
  }
  return heads;
}

/* ========================================================================== */
/*                          阑额 · 普拍枋 · 由额 · 地栿                        */
/* ========================================================================== */
export function lintelRing(s, o = {}) {
  const apo = o.apo;
  const perFace = o.perFace ?? 2;
  const yHead = o.yHead; // 柱头标高（阑额上皮 = 柱头）
  const bays = ringBays(apo, perFace);
  const lanH = o.lanH ?? DANCAI * 2.2; // 阑额广（两材）
  const lanT = o.lanT ?? CAI_T * 1.5;
  const puH = o.puH ?? f(10); // 普拍枋厚
  const puW = o.puW ?? f(24); // 普拍枋宽
  for (const b of bays) {
    s.push(b.x, 0, b.z, b.a);
    // 阑额（上皮与柱头齐）
    s.box(o.mat ?? MAT.fang, b.len - 0.42, lanH, lanT, 0, yHead - lanH, 0, 0, 0.7);
    // 燕尾榫（入柱头）—— 两端各出一榫
    for (const sd of [-1, 1]) {
      const pts = dovetailProfile(0.16, f(6), f(9));
      s.profileR(
        MAT.tenon,
        pts,
        lanH * 0.55,
        (sd * (b.len - 0.42)) / 2,
        yHead - lanH * 0.78,
        0,
        -Math.PI / 2,
        sd > 0 ? 0 : Math.PI,
        0,
        0.3
      );
    }
    // 普拍枋（压于阑额与柱头之上，补间铺作坐其上）
    if (o.pu !== false) s.box(MAT.fang, b.len + 0.1, puH, puW, 0, yHead, 0, 0, 0.7);
    // 由额（下层小额）
    if (o.you) s.box(MAT.fang, b.len - 0.42, DANCAI, CAI_T * 1.2, 0, yHead - lanH - o.you, 0, 0, 0.6);
    // 地栿
    if (o.difu) s.box(MAT.fang, b.len - 0.4, f(12), f(14), 0, o.difuY ?? 0.1, 0, 0, 0.6);
    s.pop();
  }
  return bays;
}

/* ========================================================================== */
/*                            暗层：斜撑桁架箍                                 */
/* ========================================================================== */
/**
 * 暗层：外槽柱间施「叉手」式斜撑（X 形），内外槽间加径向斜撑，
 * 上下各设圈梁（承重枋），构成整层刚性箍。
 */
export function darkLayer(s, o = {}) {
  const apoOut = o.apoOut;
  const apoIn = o.apoIn;
  const y0 = o.y;
  const h = o.h;
  const perFace = o.perFace ?? 2;
  const bays = ringBays(apoOut, perFace);
  const braceT = o.braceT ?? f(11);
  const braceW = o.braceW ?? f(16);

  // 上下圈梁（外槽）
  for (const b of bays) {
    s.push(b.x, 0, b.z, b.a);
    s.box(MAT.fang, b.len + 0.06, f(14), f(18), 0, y0, 0, 0, 0.7);
    s.box(MAT.fang, b.len + 0.06, f(14), f(18), 0, y0 + h - f(14), 0, 0, 0.7);
    // X 形斜撑（两根对角，中部相交处互刻半榫）
    const len = Math.hypot(b.len, h) * 0.99;
    const ang = Math.atan2(b.len, h);
    for (const sd of [-1, 1]) {
      s.boxC(MAT.xie, braceW, len, braceT, 0, y0 + h / 2, 0, 0, 0, sd * ang, 0.6);
    }
    // 短柱（暗层柱，续接明层柱）
    s.box(MAT.zhu, f(20), h, f(20), -b.len / 2, y0, 0, 0, 0.6);
    s.pop();
  }
  // 径向斜撑：内槽 ↔ 外槽
  const inner = octRing(apoIn, 0);
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    const co = octCornerPos(apoOut, i - 1 + 1);
    const dx = co.x - c.x;
    const dz = co.z - c.z;
    const dist = Math.hypot(dx, dz);
    const a = Math.atan2(dx, dz);
    s.push(c.x, 0, c.z, a);
    // 径向承重枋
    s.box(MAT.liang, f(16), f(20), dist, 0, y0 + h - f(20), dist / 2, 0, 0.7);
    s.box(MAT.liang, f(16), f(18), dist, 0, y0, dist / 2, 0, 0.7);
    // 斜撑
    const len = Math.hypot(dist, h) * 0.98;
    const ang = Math.atan2(dist, h);
    s.boxC(MAT.xie, f(14), len, f(10), 0, y0 + h / 2, dist / 2, ang, 0, 0, 0.6);
    s.boxC(MAT.xie, f(14), len, f(10), 0, y0 + h / 2, dist / 2, -ang, 0, 0, 0.6);
    s.pop();
  }
  // 内槽圈梁
  const ibays = ringBays(apoIn, 0);
  for (const b of ibays) {
    s.push(b.x, 0, b.z, b.a);
    s.box(MAT.fang, b.len + 0.05, f(16), f(18), 0, y0, 0, 0, 0.7);
    s.box(MAT.fang, b.len + 0.05, f(16), f(18), 0, y0 + h - f(16), 0, 0, 0.7);
    s.box(MAT.zhuIn, f(22), h, f(22), 0, y0, 0, 0, 0.6);
    const len = Math.hypot(b.len, h) * 0.99;
    const ang = Math.atan2(b.len, h);
    for (const sd of [-1, 1]) s.boxC(MAT.xie, f(14), len, f(10), 0, y0 + h / 2, 0, 0, 0, sd * ang, 0.6);
    s.pop();
  }
}

/* ========================================================================== */
/*                          平坐：铺板枋 · 楼板 · 勾栏                          */
/* ========================================================================== */
export function deckRing(s, o = {}) {
  const apo = o.apo;
  const y = o.y;
  const out = o.out ?? 1.5; // 平坐挑出
  const perFace = o.perFace ?? 2;
  const bays = ringBays(apo, perFace);
  // 铺板枋
  for (const b of bays) {
    s.push(b.x, 0, b.z, b.a);
    s.box(MAT.fang, b.len + 0.4, f(14), f(16), 0, y, out, 0, 0.7);
    s.pop();
  }
  // 楼板（八边形环带）
  const rc = octCorner(apo) + out / Math.cos(Math.PI / OCT_N);
  s.cyl(MAT.ban, rc, rc, f(6), 0, y + f(14), 0, OCT_N, Math.PI / OCT_N, 1.6);
  return { deckY: y + f(14) + f(6), rc };
}

/** 单勾栏（望柱 · 寻杖 · 盆唇 · 蜀柱 · 地霞） */
export function railing(s, o = {}) {
  const apo = o.apo;
  const y = o.y;
  const h = o.h ?? 0.92;
  const perFace = o.perFace ?? 2;
  const bays = ringBays(apo, perFace);
  const postR = f(9);
  for (const b of bays) {
    s.push(b.x, 0, b.z, b.a);
    const L = b.len;
    // 望柱（每开间两端各一，取半以免重复）
    for (const sd of [-1, 1]) {
      s.box(MAT.lan, postR * 2, h + f(10), postR * 2, (sd * L) / 2, y, 0, 0, 0.5);
      s.cone(MAT.lan, postR * 1.5, f(9), (sd * L) / 2, y + h + f(10), 0, 8, 0, 0.4);
    }
    // 地栿
    s.box(MAT.lan, L, f(8), f(12), 0, y, 0, 0, 0.6);
    // 盆唇（中栏）
    s.box(MAT.lan, L, f(9), f(13), 0, y + h * 0.52, 0, 0, 0.6);
    // 寻杖（扶手）
    s.box(MAT.lan, L, f(10), f(12), 0, y + h, 0, 0, 0.6);
    // 蜀柱 + 地霞（下段花板）
    const n = Math.max(2, Math.round(L / 0.62));
    for (let i = 1; i < n; i++) {
      const x = -L / 2 + (L / n) * i;
      s.box(MAT.lan, f(7), h * 0.52 - f(8), f(10), x, y + f(8), 0, 0, 0.4);
      s.box(MAT.lan, f(6), h * 0.48 - f(9), f(9), x, y + h * 0.52 + f(9), 0, 0, 0.4);
    }
    // 地霞（盆唇下的镂空板，用薄板表示）
    s.box(MAT.lan, L - f(20), h * 0.34, f(5), 0, y + f(12), 0, 0, 0.6);
    s.pop();
  }
}

/* ========================================================================== */
/*                        乳栿：内外槽径向连系梁                                */
/* ========================================================================== */
export function radialBeams(s, o = {}) {
  const apoOut = o.apoOut;
  const apoIn = o.apoIn;
  const y = o.y;
  const inner = octRing(apoIn, 0);
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    const co = octCornerPos(apoOut, i);
    const dx = co.x - c.x;
    const dz = co.z - c.z;
    const dist = Math.hypot(dx, dz);
    const a = Math.atan2(dx, dz);
    s.push(c.x, y, c.z, a);
    // 乳栿（内端插柱、外端搭于铺作里跳）
    const pts = liangProfile(dist, ZUCAI * 1.6);
    s.profileR(MAT.liang, pts, CAI_T * 1.4, 0, 0, 0, 0, -Math.PI / 2, 0, 0.7);
    // 外端透榫
    s.box(MAT.tenon, f(8), f(12), f(16), 0, ZUCAI * 0.6, dist + f(6), 0, 0.4);
    s.pop();
  }
  // 内槽井口枋（八边形圈梁）
  const ib = ringBays(apoIn, 0);
  for (const b of ib) {
    s.push(b.x, 0, b.z, b.a);
    s.box(MAT.liang, b.len + 0.05, ZUCAI, CAI_T * 1.3, 0, y, 0, 0, 0.7);
    s.pop();
  }
}

/* ========================================================================== */
/*                            墙体 · 板门 · 直棂窗                             */
/* ========================================================================== */
/**
 * 外槽围护：正面四方开板门，余处作直棂窗 / 板壁
 * @param o.doors [面序号…] 开门的面
 */
export function wallRing(s, o = {}) {
  const apo = o.apo;
  const y = o.y;
  const h = o.h;
  const perFace = o.perFace ?? 2;
  const doors = o.doors ?? [0, 2, 4, 6];
  const bays = ringBays(apo, perFace);
  const t = f(8);
  for (const b of bays) {
    const isDoorBay = doors.includes(b.face) && b.bay === Math.floor((perFace + 1) / 2);
    s.push(b.x, 0, b.z, b.a);
    if (isDoorBay && o.door !== false) {
      // 板门：门额、立颊、地栿、门扇（双开）
      const dw = Math.min(b.len - f(24), 2.6);
      const dh = Math.min(h - f(20), 3.4);
      s.box(MAT.fang, b.len - f(10), f(14), f(16), 0, y + dh, 0, 0, 0.6); // 门额
      for (const sd of [-1, 1]) {
        s.box(MAT.fang, f(14), dh, f(16), (sd * dw) / 2, y, 0, 0, 0.5); // 立颊
        s.box(MAT.door, dw / 2 - f(8), dh - f(4), t, (sd * dw) / 4, y + f(2), 0, 0, 0.7);
        // 门钉
        for (let i = 0; i < 3; i++)
          for (let j = 0; j < 2; j++)
            s.ball(MAT.iron, f(3), (sd * dw) / 4 + (j - 0.5) * dw * 0.16, y + dh * (0.3 + i * 0.22), t / 2 + f(1), 6);
      }
      s.box(MAT.fang, dw + f(20), f(10), f(18), 0, y, 0, 0, 0.6); // 门砧
      // 门上壁
      if (h - dh > f(24)) s.box(MAT.wall, b.len - f(12), h - dh - f(14), t * 0.7, 0, y + dh + f(14), 0, 0, 1);
    } else if (o.window !== false) {
      // 直棂窗
      const ww = b.len - f(28);
      const wh = Math.min(h * 0.42, 1.5);
      const wy = y + h * 0.42;
      s.box(MAT.wall, b.len - f(12), wy - y, t * 0.7, 0, y, 0, 0, 1); // 下段墙
      s.box(MAT.fang, ww + f(16), f(12), f(14), 0, wy + wh, 0, 0, 0.5); // 窗额
      s.box(MAT.fang, ww + f(16), f(12), f(14), 0, wy - f(12), 0, 0, 0.5); // 窗台
      for (const sd of [-1, 1]) s.box(MAT.fang, f(12), wh, f(14), (sd * ww) / 2, wy, 0, 0, 0.5);
      const n = Math.max(4, Math.round(ww / f(14)));
      for (let i = 1; i < n; i++) {
        s.box(MAT.fang, f(5), wh, f(10), -ww / 2 + (ww / n) * i, wy, 0, 0, 0.4); // 直棂
      }
      if (y + h > wy + wh) s.box(MAT.wall, b.len - f(12), y + h - wy - wh, t * 0.7, 0, wy + wh, 0, 0, 1);
    } else {
      s.box(MAT.wallIn, b.len - f(12), h, t * 0.7, 0, y, 0, 0, 1);
    }
    s.pop();
  }
}

/** 楼板（明层地面，八边形板） */
export function floorPanel(s, apo, y) {
  const rc = octCorner(apo);
  s.cyl(MAT.ban, rc, rc, f(5), 0, y, 0, OCT_N, Math.PI / OCT_N, 1.6);
}
