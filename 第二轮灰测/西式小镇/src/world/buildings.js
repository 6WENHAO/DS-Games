// ---------------------------------------------------------------------------
// 建筑生成器
// 约定：调用前 Sculptor 的当前坐标系原点 = 建筑「底面中心」，正面朝 +Z。
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { MAT } from '../lib/materials.js';
import * as G from '../lib/geom.js';
import { shopSign } from './props.js';
import { Rng } from '../lib/rng.js';

/* ========================================================================== */
/*                                窗 / 门 / 细部                              */
/* ========================================================================== */

/** 窗：(x,y,z) 为窗洞左右居中、底边所在处；墙面位于 z=0，向 +Z 外露 */
export function windowUnit(s, x, y, z, ry = 0, o = {}) {
  const w = o.w ?? 1.05;
  const h = o.h ?? 1.5;
  const trim = o.trim ?? MAT.trim;
  s.push(x, y, z, ry);
  // 玻璃
  s.panel(o.glass ?? MAT.glass, w, h, 0, 0, 0.03, 0, 1.4);
  // 窗框
  s.box(trim, w + 0.26, 0.16, 0.15, 0, h, 0.06, 0, 1);
  s.box(trim, 0.13, h, 0.15, -(w / 2 + 0.065), 0, 0.06, 0, 1);
  s.box(trim, 0.13, h, 0.15, w / 2 + 0.065, 0, 0.06, 0, 1);
  // 窗棂
  s.box(trim, 0.06, h, 0.05, 0, 0, 0.08, 0, 1);
  s.box(trim, w, 0.06, 0.05, 0, h * 0.56, 0.08, 0, 1);
  // 窗台
  s.box(o.sill ?? MAT.stoneWarm, w + 0.5, 0.13, 0.34, 0, -0.13, 0.08, 0, 1.2);
  if (o.arch) {
    s.bar(trim, w / 2 + 0.13, 0.15, 0, h + 0.08, 0.06, 'z', 14, 1);
    s.bar(o.glass ?? MAT.glass, w / 2 - 0.02, 0.1, 0, h + 0.08, 0.04, 'z', 14, 1);
  }
  if (o.lintel) s.box(o.lintel, w + 0.7, 0.24, 0.26, 0, h + 0.16, 0.06, 0, 1.2);
  if (o.shutters) {
    const sm = o.shutters;
    s.box(sm, 0.3, h, 0.07, -(w / 2 + 0.26), 0, 0.1, 0, 0.6);
    s.box(sm, 0.3, h, 0.07, w / 2 + 0.26, 0, 0.1, 0, 0.6);
  }
  if (o.flowers) {
    s.box(MAT.woodPlank, w + 0.1, 0.24, 0.28, 0, -0.34, 0.19, 0, 0.6);
    const fl = [MAT.flowerRed, MAT.flowerPink, MAT.flowerYellow, MAT.flowerWhite];
    for (let i = 0; i < 4; i++) {
      s.ball(fl[(i + (o.i ?? 0)) % 4], 0.11, -w / 2 + 0.16 + i * (w / 3.4), -0.12, 0.19, 6);
    }
  }
  s.pop();
}

/** 门 */
export function doorUnit(s, x, y, z, ry = 0, o = {}) {
  const w = o.w ?? 1.3;
  const h = o.h ?? 2.4;
  const door = o.door ?? MAT.doorRed;
  s.push(x, y, z, ry);
  s.box(o.frame ?? MAT.trim, w + 0.34, h + 0.28, 0.18, 0, 0, 0.02, 0, 1.2);
  s.box(door, w, h, 0.12, 0, 0, 0.14, 0, 0.8);
  s.box(o.frame ?? MAT.trim, w * 0.94, 0.09, 0.06, 0, h * 0.55, 0.21);
  s.box(o.frame ?? MAT.trim, 0.08, h * 0.92, 0.06, 0, 0.04, 0.21);
  s.ball(MAT.gold, 0.075, w * 0.32, h * 0.46, 0.22, 8);
  if (o.arch) {
    s.bar(o.frame ?? MAT.trim, w / 2 + 0.17, 0.2, 0, h + 0.14, 0.02, 'z', 14, 1);
    s.bar(o.glass ?? MAT.glass, w / 2 - 0.05, 0.1, 0, h + 0.14, 0.15, 'z', 14, 1);
  } else if (o.transom !== false) {
    s.panel(MAT.glass, w * 0.92, 0.44, 0, h + 0.18, 0.05, 0, 1);
    s.box(o.frame ?? MAT.trim, w + 0.34, 0.14, 0.2, 0, h + 0.66, 0.02, 0, 1);
  }
  if (o.steps !== false) s.stairs(o.stepMat ?? MAT.stone, w + 0.9, 0.3, 0.85, 0, -0.3, 0.5, 0, 2, 1.4);
  if (o.canopy) {
    s.boxC(MAT.roofSlate, w + 1.3, 0.12, 1.5, 0, h + 1.15, 0.75, -0.3, 0, 0, 1.2);
    s.box(MAT.timber, 0.1, 0.1, 1.4, -(w / 2 + 0.4), h + 0.85, 0.7);
    s.box(MAT.timber, 0.1, 0.1, 1.4, w / 2 + 0.4, h + 0.85, 0.7);
  }
  s.pop();
}

/**
 * 计算某一面墙上的开洞位置。
 * face: 'front'(+Z) | 'back'(-Z) | 'right'(+X) | 'left'(-X)
 * u: 沿墙方向的位置；返回 [x, z, ry]，可直接喂给 windowUnit / doorUnit。
 */
export function facePos(face, u, w, d) {
  if (face === 'front') return [u, d / 2, 0];
  if (face === 'back') return [-u, -d / 2, Math.PI];
  if (face === 'right') return [w / 2, u, Math.PI / 2];
  return [-w / 2, -u, -Math.PI / 2];
}

/** 半木结构（Fachwerk）：给一面墙加梁柱与斜撑 */
function timberFace(s, width, h, y, zOff, ry, rng) {
  s.push(0, y, 0, ry);
  const t = 0.11;
  s.box(MAT.timber, width, 0.3, t, 0, 0, zOff, 0, 1.4); // 下槛
  s.box(MAT.timber, width, 0.34, t, 0, h - 0.34, zOff, 0, 1.4); // 上槛
  const bays = Math.max(2, Math.round(width / 1.9));
  for (let i = 0; i <= bays; i++) {
    const x = -width / 2 + (width / bays) * i;
    s.box(MAT.timber, 0.22, h, t, x, 0, zOff, 0, 1.4);
  }
  // 斜撑
  const bw = width / bays;
  for (let i = 0; i < bays; i++) {
    const cx = -width / 2 + bw * (i + 0.5);
    const dir = i % 2 === 0 ? 1 : -1;
    const len = Math.hypot(bw * 0.8, h * 0.55);
    const ang = Math.atan2(bw * 0.8 * dir, h * 0.55);
    s.boxC(MAT.timber, 0.18, len, t * 0.9, cx, y === 0 ? h * 0.42 : h * 0.42, zOff, 0, 0, ang);
    if (rng && rng.bool(0.4)) {
      s.boxC(MAT.timber, 0.16, len * 0.8, t * 0.9, cx, h * 0.72, zOff, 0, 0, -ang * 0.8);
    }
  }
  s.pop();
}

function timberFrame(s, w, d, h, y, rng) {
  timberFace(s, w, h, y, d / 2 + 0.02, 0, rng);
  timberFace(s, w, h, y, d / 2 + 0.02, Math.PI, rng);
  timberFace(s, d, h, y, w / 2 + 0.02, Math.PI / 2, rng);
  timberFace(s, d, h, y, w / 2 + 0.02, -Math.PI / 2, rng);
}

/** 烟囱 */
export function chimney(s, x, z, baseY, topY, o = {}) {
  const w = o.w ?? 0.9;
  s.push(x, 0, z, 0);
  s.box(o.mat ?? MAT.brickRed, w, topY - baseY, w * 0.85, 0, baseY, 0, 0, 1);
  s.box(MAT.stoneDark, w + 0.24, 0.2, w * 0.85 + 0.24, 0, topY, 0, 0, 1);
  s.box(MAT.black, w * 0.3, 0.28, w * 0.28, -w * 0.22, topY + 0.2, 0, 0, 0.5);
  s.box(MAT.black, w * 0.3, 0.28, w * 0.28, w * 0.22, topY + 0.2, 0, 0, 0.5);
  if (o.smoke !== false) s.anchor('smoke', x, topY + 0.6, z, { size: o.size ?? 1.1, rate: o.rate ?? 0.55 });
  s.pop();
}

/** 天窗（老虎窗） */
function dormer(s, x, y, z, ry, o = {}) {
  const w = o.w ?? 1.5;
  s.push(x, y, z, ry);
  s.box(o.wall ?? MAT.plasterWhite, w, 1.5, 1.5, 0, 0, 0, 0, 1.6);
  s.gable(o.roof ?? MAT.roofTerracotta, w + 0.3, 1.9, 0.75, 0, 1.5, 0.1, Math.PI / 2, 1, 'slopes');
  s.gable(o.wall ?? MAT.plasterWhite, w + 0.3, 1.9, 0.75, 0, 1.5, 0.1, Math.PI / 2, 1.4, 'ends');
  windowUnit(s, 0, 0.32, 0.76, 0, { w: w - 0.5, h: 0.95 });
  s.pop();
}

/** 屋顶：返回屋脊高度 */
function roofOf(s, w, d, top, o) {
  const type = o.roofType ?? 'gable';
  const mat = o.roof ?? MAT.roofTerracotta;
  const wall = o.wallTop ?? o.wall ?? MAT.plasterCream;
  const ov = o.eave ?? 0.55;
  const ridgeZ = o.ridge !== 'x'; // 默认屋脊沿 Z（山墙朝街）
  const h = o.roofH ?? Math.min(w, d) * 0.52;
  // 檐板
  s.box(MAT.timberDark, w + ov * 2 + 0.1, 0.2, d + ov * 2 + 0.1, 0, top - 0.02, 0, 0, 1.4);
  const ridgeLen = (ridgeZ ? d : w) + 0.2;
  const span = (ridgeZ ? w : d) + ov * 2;
  const ry = ridgeZ ? Math.PI / 2 : 0;
  if (type === 'flat') {
    s.box(mat, w + 0.4, 0.3, d + 0.4, 0, top, 0, 0, 1.4);
    s.box(wall, w + 0.6, 0.7, 0.4, 0, top + 0.2, (d + 0.6) / 2 - 0.2, 0, 1.4);
    s.box(wall, w + 0.6, 0.7, 0.4, 0, top + 0.2, -(d + 0.6) / 2 + 0.2, 0, 1.4);
    s.box(wall, 0.4, 0.7, d + 0.6, (w + 0.6) / 2 - 0.2, top + 0.2, 0, 0, 1.4);
    s.box(wall, 0.4, 0.7, d + 0.6, -(w + 0.6) / 2 + 0.2, top + 0.2, 0, 0, 1.4);
    return top + 0.9;
  }
  if (type === 'pyramid') {
    s.pyramid(mat, w + ov * 2, d + ov * 2, h * 1.3, 0, top, 0, 0, 1.2);
    return top + h * 1.3;
  }
  if (type === 'hip') {
    s.hip(mat, ridgeLen, span, h, 0, top, 0, ry, 0.42, 1.2);
    return top + h;
  }
  if (type === 'mansard') {
    s.hip(mat, ridgeLen, span, h * 0.72, 0, top, 0, ry, 0.34, 1.1);
    const iw = w * 0.55;
    const idd = d * 0.55;
    s.hip(mat, (ridgeZ ? idd : iw) + 0.2, (ridgeZ ? iw : idd) + 0.2, h * 0.5, 0, top + h * 0.72, 0, ry, 0.5, 1.1);
    return top + h * 1.2;
  }
  if (type === 'gambrel') {
    // 谷仓式复折屋顶
    s.gable(mat, ridgeLen, span, h * 0.5, 0, top, 0, ry, 1.2, 'slopes');
    s.gable(wall, ridgeLen, span, h * 0.5, 0, top, 0, ry, 1.4, 'ends');
    s.gable(mat, ridgeLen, span * 0.62, h * 0.55, 0, top + h * 0.5, 0, ry, 1.2, 'slopes');
    s.gable(wall, ridgeLen, span * 0.62, h * 0.55, 0, top + h * 0.5, 0, ry, 1.4, 'ends');
    return top + h * 1.05;
  }
  // gable
  s.gable(mat, ridgeLen, span, h, 0, top, 0, ry, 1.2, 'slopes');
  s.gable(o.gableWall ?? wall, ridgeLen, span, h, 0, top, 0, ry, 1.4, 'ends');
  if (o.ridgeTile !== false) s.box(MAT.roofRust, ridgeZ ? 0.34 : ridgeLen, 0.16, ridgeZ ? ridgeLen : 0.34, 0, top + h - 0.05, 0, 0, 1);
  return top + h;
}

/** 荷兰式阶梯山墙装饰（正面朝 +Z） */
function stepGable(s, w, top, roofH, z, mat) {
  const steps = 4;
  for (let i = 0; i < steps; i++) {
    const sw = w - (w / (steps + 1.2)) * i;
    const sh = roofH / steps;
    s.box(mat, sw, sh + 0.3, 0.5, 0, top + sh * i, z, 0, 1.6);
    s.box(MAT.stoneDark, sw + 0.16, 0.16, 0.62, 0, top + sh * (i + 1), z, 0, 1.2);
  }
  s.box(mat, 1.0, 1.2, 0.5, 0, top + roofH, z, 0, 1.4);
  s.ball(MAT.gold, 0.22, 0, top + roofH + 1.3, z, 10);
}

/* ========================================================================== */
/*                                  住宅 / 店铺                               */
/* ========================================================================== */

export function house(s, o = {}) {
  const w = o.w ?? 8;
  const d = o.d ?? 8;
  const floors = o.floors ?? 2;
  const fh = o.floorH ?? 3.05;
  const wall = o.wall ?? MAT.plasterCream;
  const wallUp = o.wallUp ?? wall;
  const baseH = o.baseH ?? 0.42;
  const rng = o.rng ?? new Rng(1234);
  const jet = o.jetty ? 0.3 : 0;

  // 基座
  s.box(o.baseMat ?? MAT.stoneDark, w + 0.32, baseH, d + 0.32, 0, 0, 0, 0, 1.6);

  let top = baseH;
  let curW = w;
  let curD = d;
  for (let f = 0; f < floors; f++) {
    const mat = f === 0 ? wall : wallUp;
    curW = w + jet * 2 * f;
    curD = d + jet * 2 * f;
    const y = top;
    s.box(mat, curW, fh, curD, 0, y, 0, 0, 2);
    if (jet && f > 0) {
      // 挑出层下的托木
      for (let i = -1; i <= 1; i += 2) {
        s.box(MAT.timber, 0.16, 0.4, jet * 2, i * (curW / 2 - 0.5), y - 0.4, curD / 2 - jet, 0, 0.6);
        s.box(MAT.timber, 0.16, 0.4, jet * 2, i * (curW / 2 - 0.5), y - 0.4, -(curD / 2 - jet), 0, 0.6);
      }
      s.box(MAT.timber, curW + 0.1, 0.26, curD + 0.1, 0, y - 0.26, 0, 0, 1.4);
    }
    if (o.halfTimber && (f > 0 || o.halfTimberGround)) timberFrame(s, curW, curD, fh, y, rng);

    // 开窗
    const cols = Math.max(1, Math.round((w - 1.0) / 2.5));
    const usable = curW - 1.5;
    const step = usable / cols;
    const doorCol = Math.floor(cols / 2);
    for (let i = 0; i < cols; i++) {
      const x = -usable / 2 + step * (i + 0.5);
      const isDoor = f === 0 && i === doorCol && o.door !== false;
      if (f === 0 && o.shop && Math.abs(i - doorCol) <= 1 && cols >= 3) continue;
      if (isDoor && !o.shop) {
        doorUnit(s, x, y, curD / 2, 0, {
          door: o.doorMat ?? MAT.doorRed,
          arch: o.archDoor,
          canopy: o.doorCanopy,
          steps: baseH > 0.3,
        });
      } else {
        windowUnit(s, x, y + 1.0, curD / 2, 0, {
          w: o.winW ?? 1.05,
          h: o.winH ?? 1.5,
          shutters: o.shutters,
          flowers: o.flowers && f > 0,
          arch: o.archWin,
          i,
          lintel: o.lintel,
        });
      }
      // 背面
      if (o.backWindows !== false) {
        const [bx, bz, bry] = facePos('back', x, curW, curD);
        windowUnit(s, bx, y + 1.05, bz, bry, { w: 0.9, h: 1.35 });
      }
    }
    // 侧窗
    if (o.sideWindows !== false && curD > 5) {
      const sc = Math.max(1, Math.round((curD - 2) / 3.2));
      for (let i = 0; i < sc; i++) {
        const span = curD - 2.8;
        const u = sc === 1 ? 0 : -span / 2 + (span / (sc - 1)) * i;
        for (const face of ['right', 'left']) {
          const [px, pz, pry] = facePos(face, u, curW, curD);
          windowUnit(s, px, y + 1.05, pz, pry, { w: 0.85, h: 1.3, shutters: o.shutters });
        }
      }
    }
    top += fh;
  }

  // 店面
  if (o.shop) {
    const y = baseH;
    s.box(MAT.timberDark, w * 0.72 + 0.5, 2.7, 0.3, 0, y, d / 2 + 0.02, 0, 1.4);
    s.panel(MAT.glass, w * 0.4, 2.1, -w * 0.14, y + 0.35, d / 2 + 0.2, 0, 1.6);
    s.box(MAT.trim, 0.09, 2.1, 0.1, -w * 0.14, y + 0.35, d / 2 + 0.24);
    s.box(MAT.trim, w * 0.4, 0.09, 0.1, -w * 0.14, y + 1.4, d / 2 + 0.24);
    s.box(MAT.trim, w * 0.4 + 0.2, 0.16, 0.16, -w * 0.14, y + 2.45, d / 2 + 0.22, 0, 1);
    s.box(MAT.stoneWarm, w * 0.4 + 0.3, 0.18, 0.4, -w * 0.14, y + 0.2, d / 2 + 0.2, 0, 1);
    doorUnit(s, w * 0.24, y, d / 2, 0, {
      door: o.doorMat ?? MAT.doorGreen,
      transom: true,
      steps: false,
      w: 1.15,
      h: 2.35,
    });
    // 遮阳篷
    const cloth = o.awning ?? MAT.clothRed;
    s.boxC(cloth, w * 0.62, 0.08, 1.7, -w * 0.06, y + 3.05, d / 2 + 0.85, -0.32, 0, 0, 1.2);
    s.panel(cloth, w * 0.62, 0.42, -w * 0.06, y + 2.55, d / 2 + 1.62, 0, 1, true);
    if (o.sign) {
      shopSign(s, 0, y + 3.9, d / 2 + 0.45, 0, o.sign, { w: w * 0.6, h: 0.62, bg: o.signBg, fg: o.signFg });
    }
  }

  // 屋顶
  const ridgeZ = (o.ridge ?? 'z') !== 'x';
  const roofH = o.roofH ?? Math.min(curW, curD) * 0.55;
  const ridgeY = roofOf(s, curW, curD, top, { ...o, roofH, wallTop: wallUp });

  if (o.stepGable) stepGable(s, curW * 0.98, top, roofH, curD / 2 + 0.02, wallUp);

  // 阁楼窗
  if (o.attic && ridgeZ) {
    windowUnit(s, 0, top + 0.4, curD / 2 + 0.02, 0, { w: 0.8, h: 1.0, arch: true });
    s.box(MAT.timber, 1.4, 0.14, 0.5, 0, top + 0.2, curD / 2 + 0.16, 0, 1);
  }
  // 老虎窗
  if (o.dormers) {
    const n = o.dormers;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      if (ridgeZ) {
        dormer(s, curW / 2 - 0.9, top + roofH * 0.18, t * (curD - 4), Math.PI / 2, { roof: o.roof, wall: wallUp });
        dormer(s, -(curW / 2 - 0.9), top + roofH * 0.18, t * (curD - 4), -Math.PI / 2, { roof: o.roof, wall: wallUp });
      } else {
        dormer(s, t * (curW - 4), top + roofH * 0.18, curD / 2 - 0.9, 0, { roof: o.roof, wall: wallUp });
      }
    }
  }
  // 烟囱
  const nch = o.chimneys ?? 1;
  for (let i = 0; i < nch; i++) {
    const cx = nch === 1 ? curW * 0.28 : -curW * 0.3 + i * (curW * 0.6);
    chimney(s, cx, -curD * 0.16, top - 1, ridgeY + 1.3, { size: 1.0 + (o.chimneySize ?? 0), mat: o.chimneyMat });
  }
  return ridgeY;
}

/** 沿 X 轴排布的联排房 */
export function terrace(s, o = {}) {
  const rng = o.rng ?? new Rng(77);
  const walls = o.walls ?? [MAT.plasterCream, MAT.plasterOchre, MAT.plasterRose, MAT.plasterBlue, MAT.plasterMint, MAT.brickRed, MAT.brickTan];
  const roofs = o.roofs ?? [MAT.roofTerracotta, MAT.roofRust, MAT.roofSlate, MAT.roofBrown, MAT.roofBlue];
  const shutters = [MAT.shutterGreen, MAT.shutterBlue, MAT.shutterRed];
  let x = -(o.length ?? 40) / 2;
  const end = (o.length ?? 40) / 2;
  let i = 0;
  const built = [];
  while (x < end - 4) {
    const w = rng.range(o.minW ?? 6.5, o.maxW ?? 10.5);
    if (x + w > end) break;
    const d = rng.range(o.minD ?? 7, o.maxD ?? 10.5);
    const floors = o.floors ?? rng.int(2, 3);
    const wall = rng.pick(walls);
    // 立面（+Z 面）对齐到 z = o.d0，房体朝 -Z 延伸
    s.push(x + w / 2, 0, (o.d0 ?? 0) - d / 2, 0);
    const ht = house(s, {
      w,
      d,
      floors,
      floorH: rng.range(2.85, 3.25),
      wall,
      wallUp: rng.bool(0.35) ? rng.pick(walls) : wall,
      halfTimber: o.halfTimber ?? rng.bool(0.45),
      jetty: rng.bool(0.4),
      roof: rng.pick(roofs),
      roofType: rng.bool(0.82) ? 'gable' : rng.bool(0.5) ? 'hip' : 'mansard',
      ridge: rng.bool(0.72) ? 'z' : 'x',
      shutters: rng.bool(0.6) ? rng.pick(shutters) : null,
      flowers: rng.bool(0.55),
      attic: rng.bool(0.5),
      dormers: rng.bool(0.35) ? 1 : 0,
      stepGable: o.stepGable && rng.bool(0.25),
      shop: o.shops && rng.bool(o.shopRate ?? 0.75),
      sign: o.shops && o.signs ? rng.pick(o.signs) : null,
      awning: rng.pick([MAT.clothRed, MAT.clothBlue, MAT.clothGreen, MAT.clothCream]),
      doorMat: rng.pick([MAT.doorRed, MAT.doorGreen, MAT.doorBlue]),
      rng,
      chimneys: rng.int(1, 2),
      sideWindows: false,
      i,
    });
    s.pop();
    built.push({ x: x + w / 2, w, d, h: ht });
    x += w + rng.range(0.1, 0.5);
    i++;
  }
  return built;
}

/* ========================================================================== */
/*                                    教堂                                    */
/* ========================================================================== */

export function church(s, o = {}) {
  const naveW = o.naveW ?? 15;
  const naveD = o.naveD ?? 34;
  const naveH = o.naveH ?? 13;
  const st = MAT.stone;
  const stD = MAT.stoneDark;

  // 主体中殿
  s.box(stD, naveW + 1.2, 0.9, naveD + 1.2, 0, 0, 0, 0, 2.4);
  s.box(st, naveW, naveH, naveD, 0, 0.9, 0, 0, 2.6);
  // 侧廊
  for (const sd of [-1, 1]) {
    s.box(st, 5.4, 7.2, naveD - 6, sd * (naveW / 2 + 2.6), 0.9, -1, 0, 2.6);
    s.gable(MAT.roofSlate, naveD - 6 + 0.4, 6.6, 2.0, sd * (naveW / 2 + 2.6), 8.1, -1, Math.PI / 2, 1.2, 'slopes');
    s.gable(st, naveD - 6 + 0.4, 6.6, 2.0, sd * (naveW / 2 + 2.6), 8.1, -1, Math.PI / 2, 2, 'ends');
  }
  // 扶壁
  for (const sd of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = -naveD / 2 + 5 + i * ((naveD - 10) / 4);
      s.box(stD, 1.3, 9.4, 2.2, sd * (naveW / 2 + 5.1), 0.9, z, 0, 1.8);
      s.pyramid(stD, 1.5, 2.4, 1.0, sd * (naveW / 2 + 5.1), 10.3, z, 0, 1.2);
      // 飞扶壁
      s.boxC(stD, 0.7, 5.2, 0.9, sd * (naveW / 2 + 3.3), 10.6, z, 0, 0, sd * 0.62, 1.4);
      s.cone(stD, 0.55, 1.8, sd * (naveW / 2 + 5.1), 11.2, z, 6);
    }
  }
  // 中殿高侧窗 + 侧廊窗
  for (const face of ['right', 'left']) {
    for (let i = 0; i < 5; i++) {
      const z = -naveD / 2 + 7.6 + i * ((naveD - 15) / 4);
      const [cx, cz, cry] = facePos(face, z, naveW, naveD);
      windowUnit(s, cx, 8.8, cz, cry, {
        w: 1.5,
        h: 3.2,
        arch: true,
        glass: MAT.glassStained,
        trim: st,
        sill: stD,
      });
      const [ax, az, ary] = facePos(face, z, (naveW / 2 + 5.3) * 2, naveD);
      windowUnit(s, ax, 2.6, az, ary, {
        w: 1.2,
        h: 2.6,
        arch: true,
        glass: MAT.glassStained,
        trim: st,
        sill: stD,
      });
    }
  }
  // 后殿（半圆形）
  s.cyl(st, naveW / 2 + 0.6, naveW / 2 + 0.6, naveH - 1.5, 0, 0.9, -naveD / 2 + 1, 14, 0, 2.6);
  s.cone(MAT.roofSlate, naveW / 2 + 1.4, 5.2, 0, naveH - 0.6, -naveD / 2 + 1, 14);
  for (let i = 0; i < 5; i++) {
    const a = -1.2 + i * 0.6;
    const R = naveW / 2 + 0.6;
    windowUnit(s, Math.sin(a) * R, 3.4, -naveD / 2 + 1 - Math.cos(a) * R, Math.PI - a, {
      w: 1.1,
      h: 3.0,
      arch: true,
      glass: MAT.glassStained,
      trim: st,
      sill: stD,
    });
  }
  // 中殿屋顶
  s.gable(MAT.roofSlate, naveD + 1.4, naveW + 1.6, 6.4, 0, naveH + 0.9, 0, Math.PI / 2, 1.4, 'slopes');
  s.gable(st, naveD + 1.4, naveW + 1.6, 6.4, 0, naveH + 0.9, 0, Math.PI / 2, 2.4, 'ends');
  s.box(MAT.copper, 0.4, 0.2, naveD + 1.4, 0, naveH + 7.15, 0, 0, 1);

  /* ---------------------------- 正立面 ---------------------------- */
  const fz = naveD / 2;
  s.box(st, naveW + 1.6, naveH + 3.5, 1.4, 0, 0.9, fz + 0.3, 0, 2.6);
  // 大门（尖拱）
  s.push(0, 0, 0, 0);
  s.arch(stD, 6.4, 7.6, 2.2, 3.6, 5.4, 0, 0.9, fz + 1.0, 0, 10, 2.2);
  doorUnit(s, 0, 0.9, fz + 2.15, 0, { w: 2.9, h: 4.2, door: MAT.timberDark, arch: true, frame: stD, steps: false, transom: false });
  s.stairs(stD, 8.5, 0.9, 2.6, 0, 0, fz + 3.4, 0, 3, 2);
  s.pop();
  // 玫瑰窗
  s.bar(stD, 3.3, 0.9, 0, naveH - 1.2, fz + 0.9, 'z', 20, 2);
  s.bar(MAT.glassStained, 2.9, 0.5, 0, naveH - 1.2, fz + 1.35, 'z', 20, 6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    s.boxC(stD, 0.16, 5.6, 0.3, 0, naveH - 1.2, fz + 1.5, 0, 0, a, 1);
  }
  // 山花与小尖塔
  s.gable(st, naveW + 1.8, 2.4, 4.6, 0, naveH + 4.4, fz + 0.3, Math.PI / 2, 2.4);
  for (const sd of [-1, 1]) {
    s.box(stD, 1.5, naveH + 6.5, 1.5, sd * (naveW / 2 + 0.6), 0.9, fz + 0.3, 0, 1.6);
    s.cone(stD, 1.0, 3.4, sd * (naveW / 2 + 0.6), naveH + 7.4, fz + 0.3, 8);
    s.ball(MAT.gold, 0.2, sd * (naveW / 2 + 0.6), naveH + 11, fz + 0.3, 8);
  }

  /* ------------------------------ 钟塔 ------------------------------ */
  const tw = o.towerW ?? 8.2;
  const th = o.towerH ?? 30;
  const tx = o.towerX ?? -(naveW / 2 + 6.2);
  const tz = fz - tw / 2 + 1;
  s.push(tx, 0, tz, 0);
  s.box(stD, tw + 1.4, 1.2, tw + 1.4, 0, 0, 0, 0, 2.4);
  s.box(st, tw, th, tw, 0, 1.2, 0, 0, 2.8);
  // 角柱
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) s.box(stD, 1.1, th + 0.6, 1.1, (sx * tw) / 2, 1.2, (sz * tw) / 2, 0, 2);
  // 各层窗
  for (let f = 0; f < 3; f++) {
    const y = 5 + f * 7.5;
    for (let k = 0; k < 4; k++) {
      s.push(0, 0, 0, (k * Math.PI) / 2);
      windowUnit(s, 0, y, tw / 2, 0, {
        w: 1.3,
        h: 2.8,
        arch: true,
        glass: MAT.glassStained,
        trim: st,
        sill: stD,
      });
      s.pop();
    }
  }
  // 钟楼层（镂空拱窗）
  const by = th - 5.6;
  for (let k = 0; k < 4; k++) {
    s.push(0, 0, 0, (k * Math.PI) / 2);
    s.arch(stD, tw * 0.9, 5.2, 0.7, 2.6, 4.0, 0, by, tw / 2 + 0.05, 0, 9, 2);
    s.panel(MAT.black, 2.6, 4.0, 0, by, tw / 2 - 0.1, 0, 2);
    s.pop();
  }
  // 会摆动的大钟
  s.box(MAT.timberDark, 3.6, 0.4, 0.4, 0, by + 3.4, 0);
  s.box(MAT.timberDark, 0.35, 1.6, 0.35, -1.6, by + 3.4, 0);
  s.box(MAT.timberDark, 0.35, 1.6, 0.35, 1.6, by + 3.4, 0);
  {
    const bell = new THREE.Group();
    const bs = new G.Sculptor('bell');
    bs.cyl(MAT.gold, 0.5, 1.05, 1.5, 0, -1.62, 0, 14, 0, 1);
    bs.torus(MAT.gold, 1.03, 0.1, 0, -1.6, 0, Math.PI / 2, 0, 0, 16);
    bs.ball(MAT.gold, 0.28, 0, -0.24, 0, 10);
    bs.cyl(MAT.metal, 0.06, 0.06, 1.05, 0, -1.5, 0, 6);
    bs.ball(MAT.metal, 0.15, 0, -1.56, 0, 8);
    bell.add(bs.finalize());
    s.attach(bell, 0, by + 3.3, 0, 0);
    s.onUpdate((dt, t) => {
      const swing = Math.sin(t * 1.05);
      bell.rotation.x = swing * 0.33;
    });
  }
  // 钟塔顶部与尖塔
  s.box(stD, tw + 1.2, 0.8, tw + 1.2, 0, th + 1.2, 0, 0, 2);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      s.box(stD, 1.2, 2.6, 1.2, (sx * (tw + 0.2)) / 2, th + 2, (sz * (tw + 0.2)) / 2, 0, 1.4);
      s.cone(stD, 0.85, 3.4, (sx * (tw + 0.2)) / 2, th + 4.6, (sz * (tw + 0.2)) / 2, 8);
    }
  s.pyramid(MAT.roofSlate, tw + 0.6, tw + 0.6, 15, 0, th + 2, 0, Math.PI / 4, 1.6);
  s.cyl(MAT.gold, 0.12, 0.16, 1.6, 0, th + 17, 0, 8);
  s.box(MAT.gold, 1.3, 0.16, 0.16, 0, th + 18.1, 0);
  s.box(MAT.gold, 0.16, 1.5, 0.16, 0, th + 17.6, 0);
  s.ball(MAT.gold, 0.2, 0, th + 16.9, 0, 8);
  // 塔钟表盘（带走动的指针）
  clockFace(s, 0, th - 12.5, tw / 2 + 0.15, 0, { r: 2.1 });
  clockFace(s, 0, th - 12.5, -(tw / 2 + 0.15), Math.PI, { r: 2.1 });
  s.anchor('glow', 0, by + 2, 0, { size: 5, color: 0xffd08a });
  s.pop();
  return { ridge: naveH + 7.3, towerTop: th + 19 };
}

/** 会走动的塔钟 */
export function clockFace(s, x, y, z, ry, o = {}) {
  const r = o.r ?? 1.8;
  s.push(x, y, z, ry);
  s.bar(MAT.stoneDark, r + 0.22, 0.22, 0, 0, 0, 'z', 20, 1.4);
  s.bar(MAT.white, r, 0.16, 0, 0, 0.14, 'z', 20, 3);
  s.bar(MAT.gold, r + 0.1, 0.1, 0, 0, 0.2, 'z', 20, 1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    s.boxC(MAT.black, 0.09, r * 0.22, 0.06, Math.sin(a) * r * 0.84, Math.cos(a) * r * 0.84, 0.22, 0, 0, -a, 1);
  }
  s.pop();
  // 指针（动态）
  const hands = new THREE.Group();
  const mk = (len, wid, zo) => {
    const g = new THREE.BoxGeometry(wid, len, 0.05);
    g.translate(0, len / 2 - len * 0.14, zo);
    return new THREE.Mesh(g, MAT.black);
  };
  const hour = mk(r * 0.55, 0.11, 0.26);
  const min = mk(r * 0.85, 0.07, 0.3);
  hands.add(hour, min);
  s.attach(hands, x, y, z, ry);
  s.onUpdate((dt, t) => {
    min.rotation.z = -t * 0.12;
    hour.rotation.z = -t * 0.01;
  });
}

/* ========================================================================== */
/*                                   市政厅                                   */
/* ========================================================================== */

export function townHall(s, o = {}) {
  const w = o.w ?? 32;
  const d = o.d ?? 15;
  const fh = 4.0;
  const wall = MAT.stoneWarm;
  s.box(MAT.stoneDark, w + 1.6, 0.7, d + 1.6, 0, 0, 0, 0, 2.4);
  // 一层：拱廊
  s.box(wall, w, fh, d - 2.6, 0, 0.7, -1.3, 0, 2.4);
  const bays = 7;
  const bw = w / bays;
  for (let i = 0; i < bays; i++) {
    const x = -w / 2 + bw * (i + 0.5);
    s.arch(MAT.stone, bw, fh, 2.6, bw * 0.62, fh * 0.82, x, 0.7, d / 2 - 1.3, 0, 9, 2.2);
  }
  s.box(MAT.cobbleWarm, w, 0.12, 2.6, 0, 0.7, d / 2 - 1.3, 0, 2);
  // 二三层
  s.box(wall, w, fh, d, 0, 0.7 + fh, 0, 0, 2.4);
  s.box(wall, w, fh * 0.92, d, 0, 0.7 + fh * 2, 0, 0, 2.4);
  s.box(MAT.stoneDark, w + 0.5, 0.35, d + 0.5, 0, 0.7 + fh, 0, 0, 2);
  s.box(MAT.stoneDark, w + 0.5, 0.35, d + 0.5, 0, 0.7 + fh * 2, 0, 0, 2);
  // 窗
  for (let f = 1; f <= 2; f++) {
    const y = 0.7 + fh * f + 0.9;
    for (let i = 0; i < bays; i++) {
      const x = -w / 2 + bw * (i + 0.5);
      windowUnit(s, x, y, d / 2, 0, {
        w: 1.5,
        h: f === 1 ? 2.3 : 1.9,
        arch: f === 1,
        trim: MAT.trim,
        sill: MAT.stone,
        lintel: f === 2 ? MAT.stone : null,
      });
      const [bx, bz, bry] = facePos('back', x, w, d);
      windowUnit(s, bx, y, bz, bry, { w: 1.4, h: 2.0 });
    }
    for (const face of ['right', 'left']) {
      for (let i = -1; i <= 1; i++) {
        const [px, pz, pry] = facePos(face, i * 4.2, w, d);
        windowUnit(s, px, y, pz, pry, { w: 1.3, h: 2.0, arch: f === 1 });
      }
    }
  }
  // 中央阳台
  s.box(MAT.stone, 9, 0.3, 2.4, 0, 0.7 + fh - 0.3, d / 2 + 0.6, 0, 2);
  for (let i = 0; i <= 12; i++) {
    s.cyl(MAT.stone, 0.11, 0.15, 0.85, -4.2 + i * 0.7, 0.7 + fh, d / 2 + 1.7, 6, 0, 0.6);
  }
  s.box(MAT.stone, 9, 0.2, 0.3, 0, 0.7 + fh + 0.85, d / 2 + 1.7, 0, 1.4);
  doorUnit(s, 0, 0.82, d / 2 - 2.6, 0, { w: 2.6, h: 3.4, door: MAT.timberDark, arch: true, frame: MAT.stone, steps: false, transom: false });
  // 徽章
  s.bar(MAT.gold, 1.0, 0.2, 0, 0.7 + fh * 2 + 2.6, d / 2 + 0.2, 'z', 12, 1);
  s.panel(MAT.clothRed, 1.6, 2.2, -6.5, 0.7 + fh * 2 - 0.4, d / 2 + 0.15, 0, 2, true);
  s.panel(MAT.clothBlue, 1.6, 2.2, 6.5, 0.7 + fh * 2 - 0.4, d / 2 + 0.15, 0, 2, true);

  const top = 0.7 + fh * 2 + fh * 0.92;
  const ridge = roofOf(s, w, d, top, {
    roof: MAT.roofSlate,
    roofType: 'mansard',
    roofH: 7.4,
    ridge: 'x',
    wall,
    eave: 0.7,
  });
  // 老虎窗
  for (let i = -2; i <= 2; i++) {
    dormer(s, i * 5.4, top + 1.6, d / 2 - 0.4, 0, { roof: MAT.roofSlate, wall: MAT.stoneWarm });
  }

  /* --------------------------- 钟塔 --------------------------- */
  const tw = 8;
  s.push(0, 0, -0.6, 0);
  s.box(wall, tw, top + 6, tw, 0, 0.7, 0, 0, 2.4);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) s.box(MAT.stone, 1.0, top + 6.4, 1.0, (sx * tw) / 2, 0.7, (sz * tw) / 2, 0, 2);
  const cy = top + 6.7;
  s.box(MAT.stoneDark, tw + 1.2, 0.7, tw + 1.2, 0, cy, 0, 0, 2);
  s.box(wall, tw * 0.86, 5.4, tw * 0.86, 0, cy + 0.7, 0, 0, 2);
  for (let k = 0; k < 4; k++) {
    s.push(0, 0, 0, (k * Math.PI) / 2);
    clockFace(s, 0, cy + 2.4, tw * 0.43 + 0.12, 0, { r: 1.9 });
    s.pop();
  }
  s.box(MAT.stoneDark, tw + 0.8, 0.6, tw + 0.8, 0, cy + 6.1, 0, 0, 2);
  // 巴洛克穹顶
  s.cyl(MAT.copper, tw * 0.42, tw * 0.46, 1.2, 0, cy + 6.7, 0, 16, 0, 1.6);
  s.ball(MAT.copper, tw * 0.44, 0, cy + 8.1, 0, 18, 2.4);
  s.cyl(MAT.copper, 0.7, 0.9, 1.6, 0, cy + 9.6, 0, 12, 0, 1);
  s.cone(MAT.copper, 1.0, 2.2, 0, cy + 11.2, 0, 12);
  s.cyl(MAT.gold, 0.1, 0.14, 2.0, 0, cy + 13.2, 0, 8);
  s.ball(MAT.gold, 0.3, 0, cy + 15.3, 0, 10);
  // 风向标
  const vane = new THREE.Group();
  const arrow = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.06), MAT.gold);
  arrow.position.x = 0.4;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.06), MAT.gold);
  tail.position.x = -0.75;
  vane.add(arrow, tail);
  s.attach(vane, 0, cy + 16.0, 0, 0);
  s.onUpdate((dt, t) => {
    vane.rotation.y = Math.sin(t * 0.13) * 0.9 + Math.sin(t * 0.41) * 0.2;
  });
  s.anchor('glow', 0, cy + 3, 0, { size: 4, color: 0xffd08a });
  s.pop();
  return ridge;
}

/* ========================================================================== */
/*                              风车 / 水磨 / 谷仓                            */
/* ========================================================================== */

export function windmill(s, o = {}) {
  const h = o.h ?? 14;
  const rb = o.rBottom ?? 4.6;
  const rt = o.rTop ?? 3.1;
  s.box(MAT.stoneDark, rb * 2.4, 0.6, rb * 2.4, 0, 0, 0, 0, 2);
  s.cyl(MAT.stone, rt, rb, h, 0, 0.6, 0, 18, 0, 2.6);
  // 环廊
  s.cyl(MAT.woodPlank, rb * 0.92, rb * 0.92, 0.22, 0, h * 0.42, 0, 18, 0, 1.6);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    s.box(MAT.timber, 0.1, 0.95, 0.1, Math.cos(a) * (rb * 0.85), h * 0.42 + 0.22, Math.sin(a) * (rb * 0.85));
  }
  s.cyl(MAT.timber, rb * 0.9, rb * 0.9, 0.1, 0, h * 0.42 + 1.1, 0, 18, 0, 1.6);
  // 门窗
  doorUnit(s, 0, 0.6, rb - 0.35, 0, { w: 1.2, h: 2.3, door: MAT.timberDark, arch: true, steps: false, transom: false });
  for (let i = 0; i < 3; i++) {
    const a = 1.4 + i * 1.6;
    windowUnit(s, Math.cos(a) * (rt + 0.9), 3.2 + i * 3.4, Math.sin(a) * (rt + 0.9), Math.PI / 2 - a, {
      w: 0.8,
      h: 1.1,
      shutters: MAT.shutterRed,
    });
  }
  // 帽顶
  s.cyl(MAT.timberDark, rt + 0.5, rt + 0.5, 0.5, 0, h + 0.6, 0, 18, 0, 1.6);
  s.ball(MAT.roofSlate, rt + 0.7, 0, h + 1.1, 0, 18, 2.4);
  s.box(MAT.timberDark, 1.2, 1.2, rt + 2.6, 0, h + 1.4, rt * 0.5, 0, 1.2);
  // 尾杆
  s.boxC(MAT.timber, 0.3, 9, 0.3, 0, h + 0.2, -(rt + 3.6), 1.1, 0, 0, 1);
  s.box(MAT.timber, 0.24, 2.2, 0.24, 0, h * 0.42 + 0.2, -(rt + 6.4));

  /* 会转的风叶 */
  const sails = new THREE.Group();
  const sub = new G.Sculptor('sail');
  sub.cyl(MAT.timberDark, 0.45, 0.55, 0.9, 0, -0.45, 0, 12);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    sub.push(0, 0, 0, 0);
    // 主梁
    sub.boxC(MAT.timber, 0.34, 11.5, 0.34, Math.cos(a) * 5.9, Math.sin(a) * 5.9, 0.35, 0, 0, -a + Math.PI / 2, 1.2);
    // 格栅
    for (let k = 1; k <= 9; k++) {
      const t = 1.4 + k * 1.05;
      sub.boxC(MAT.timber, 2.5, 0.14, 0.12, Math.cos(a) * t, Math.sin(a) * t, 0.5, 0, 0, -a, 0.8);
    }
    sub.boxC(MAT.clothCream, 2.3, 8.4, 0.06, Math.cos(a) * 7.0, Math.sin(a) * 7.0, 0.62, 0, 0, -a + Math.PI / 2, 2);
    sub.pop();
  }
  const sailMesh = sub.finalize();
  sails.add(sailMesh);
  s.attach(sails, 0, h + 1.9, rt + 1.9, 0);
  const spd = o.speed ?? 0.42;
  s.onUpdate((dt, t) => {
    sails.rotation.z -= dt * spd * (1 + Math.sin(t * 0.19) * 0.28);
  });
  return h + 2;
}

export function watermill(s, o = {}) {
  const w = o.w ?? 11;
  const d = o.d ?? 9;
  // 磨坊主体（半木结构）
  const ridge = house(s, {
    w,
    d,
    floors: 2,
    floorH: 3.2,
    wall: MAT.stone,
    wallUp: MAT.plasterCream,
    halfTimber: true,
    jetty: true,
    roof: MAT.roofBrown,
    roofType: 'gable',
    ridge: 'x',
    roofH: 4.6,
    shutters: MAT.shutterGreen,
    flowers: true,
    dormers: 1,
    attic: false,
    chimneys: 1,
    rng: new Rng(9182),
  });
  // 水渠与闸门
  s.box(MAT.stoneDark, 4.2, 1.6, 7, w / 2 + 2.4, 0, -1, 0, 2);
  s.box(MAT.woodPlank, 3.2, 0.3, 6.4, w / 2 + 2.4, 1.6, -1, 0, 1.2);
  s.box(MAT.waterStill, 2.6, 0.12, 6.4, w / 2 + 2.4, 1.7, -1);
  /* 会转的水车 */
  const wheel = new THREE.Group();
  const sub = new G.Sculptor('wheel');
  const R = 3.3;
  for (const zz of [-0.85, 0.85]) {
    sub.torus(MAT.timberDark, R, 0.16, 0, 0, zz, 0, 0, 0, 22, 1.4);
    sub.torus(MAT.timberDark, R * 0.55, 0.13, 0, 0, zz, 0, 0, 0, 18, 1.4);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    sub.boxC(MAT.timber, 0.16, R * 2, 0.16, 0, 0, 0.85, 0, 0, a, 1);
    sub.boxC(MAT.timber, 0.16, R * 2, 0.16, 0, 0, -0.85, 0, 0, a, 1);
    // 叶片
    sub.boxC(MAT.woodPlank, 0.16, 1.1, 1.9, Math.cos(a) * (R - 0.5), Math.sin(a) * (R - 0.5), 0, 0, 0, a + Math.PI / 2, 1);
  }
  sub.bar(MAT.timberDark, 0.3, 3.2, 0, 0, 0, 'z', 10);
  wheel.add(sub.finalize());
  s.attach(wheel, w / 2 + 1.0, 2.6, 2.2, 0);
  s.onUpdate((dt) => {
    wheel.rotation.z -= dt * 0.55;
  });
  // 支架
  s.box(MAT.timberDark, 0.4, 5.4, 0.4, w / 2 + 2.6, 0, 2.2);
  s.box(MAT.timberDark, 0.4, 3.0, 0.4, w / 2 - 0.4, 0, 2.2);
  return ridge;
}

export function barn(s, o = {}) {
  const w = o.w ?? 15; // 正面宽度（山墙面朝 +Z）
  const d = o.d ?? 21; // 进深
  const h = o.h ?? 7.2;
  s.box(MAT.stoneDark, w + 0.6, 0.4, d + 0.6, 0, 0, 0, 0, 2);
  s.box(MAT.woodRed, w, h, d, 0, 0.4, 0, 0, 1.8);
  // 白色饰边（四个转角 + 檐口）
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) s.box(MAT.white, 0.34, h, 0.34, (sx * w) / 2, 0.4, (sz * d) / 2, 0, 1);
  s.box(MAT.white, w, 0.3, 0.3, 0, h + 0.1, d / 2, 0, 1);
  s.box(MAT.white, w, 0.3, 0.3, 0, h + 0.1, -d / 2, 0, 1);
  // 大门（山墙面）
  s.box(MAT.white, 6.6, 5.6, 0.3, 0, 0.4, d / 2 + 0.05, 0, 1.4);
  s.box(MAT.woodPlankV, 6.0, 5.2, 0.22, 0, 0.5, d / 2 + 0.2, 0, 1.1);
  s.boxC(MAT.white, 0.28, 7.4, 0.1, -1.5, 3.1, d / 2 + 0.34, 0, 0, 0.62, 1);
  s.boxC(MAT.white, 0.28, 7.4, 0.1, 1.5, 3.1, d / 2 + 0.34, 0, 0, -0.62, 1);
  s.box(MAT.white, 6.0, 0.24, 0.1, 0, 3.05, d / 2 + 0.34);
  s.box(MAT.white, 0.24, 5.2, 0.1, 0, 0.5, d / 2 + 0.34);
  // 后门
  s.box(MAT.woodPlankV, 4.2, 4.4, 0.22, 0, 0.5, -(d / 2 + 0.12), 0, 1.1);
  // 草料门与吊臂
  s.box(MAT.woodPlankV, 2.4, 2.2, 0.22, 0, h + 1.0, d / 2 + 0.3, 0, 1);
  s.box(MAT.white, 2.8, 0.26, 0.3, 0, h + 3.3, d / 2 + 0.3);
  s.bar(MAT.timberDark, 0.12, 1.8, 0, h + 3.7, d / 2 + 1.0, 'z', 8);
  // 侧墙窗
  for (const face of ['right', 'left']) {
    for (const u of [-6.5, 0, 6.5]) {
      const [px, pz, pry] = facePos(face, u, w, d);
      windowUnit(s, px, 3.4, pz, pry, { w: 1.2, h: 1.4, trim: MAT.white });
    }
  }
  const ridge = roofOf(s, w, d, h + 0.4, {
    roof: MAT.roofRust,
    roofType: 'gambrel',
    roofH: 8.4,
    ridge: 'z',
    wall: MAT.woodRed,
    eave: 0.6,
  });
  // 风向标
  const vane = new THREE.Group();
  const rooster = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.06), MAT.black);
  rooster.position.y = 0.45;
  vane.add(rooster);
  s.attach(vane, 0, ridge + 0.9, d * 0.3, 0);
  s.cyl(MAT.black, 0.06, 0.06, 1.0, 0, ridge - 0.1, d * 0.3, 6);
  s.onUpdate((dt, t) => {
    vane.rotation.y = Math.sin(t * 0.21) * 1.2;
  });
  return ridge;
}

export function silo(s, o = {}) {
  const r = o.r ?? 3.1;
  const h = o.h ?? 15;
  s.cyl(MAT.stoneDark, r + 0.4, r + 0.5, 0.6, 0, 0, 0, 18, 0, 2);
  s.cyl(MAT.plasterWhite, r, r, h, 0, 0.6, 0, 18, 0, 2.4);
  for (let i = 1; i < 6; i++) s.torus(MAT.metalRust, r + 0.05, 0.07, 0, 0.6 + (h / 6) * i, 0, Math.PI / 2, 0, 0, 20);
  s.ball(MAT.metal, r + 0.15, 0, h + 0.6, 0, 18, 2.4);
  s.cyl(MAT.metal, 0.5, 0.6, 1.2, 0, h + r + 0.2, 0, 10);
  // 梯子
  for (let i = 0; i < Math.floor(h / 0.6); i++) {
    s.box(MAT.metal, 0.7, 0.07, 0.07, 0, 1.2 + i * 0.6, r + 0.12);
  }
  s.box(MAT.metal, 0.07, h, 0.07, -0.32, 0.8, r + 0.12);
  s.box(MAT.metal, 0.07, h, 0.07, 0.32, 0.8, r + 0.12);
  return h + r;
}

/* ========================================================================== */
/*                              车站 / 工厂 / 仓库                            */
/* ========================================================================== */

export function station(s, o = {}) {
  const w = o.w ?? 26;
  const d = o.d ?? 12;
  s.box(MAT.stoneDark, w + 1, 0.6, d + 1, 0, 0, 0, 0, 2);
  s.box(MAT.brickTan, w, 4.2, d, 0, 0.6, 0, 0, 2.2);
  s.box(MAT.stone, w + 0.4, 0.3, d + 0.4, 0, 4.8, 0, 0, 2);
  s.box(MAT.brickTan, w * 0.66, 3.8, d, 0, 5.1, 0, 0, 2.2);
  // 拱窗与门
  for (let i = -3; i <= 3; i++) {
    if (i === 0) {
      doorUnit(s, 0, 0.6, d / 2, 0, { w: 2.4, h: 3.2, door: MAT.timberDark, arch: true, frame: MAT.stone, steps: false, transom: false });
      doorUnit(s, 0, 0.6, -d / 2, Math.PI, { w: 2.4, h: 3.2, door: MAT.timberDark, arch: true, frame: MAT.stone, steps: false, transom: false });
    } else {
      windowUnit(s, i * 3.4, 1.4, d / 2, 0, { w: 1.3, h: 2.3, arch: true, trim: MAT.stone, sill: MAT.stone });
      windowUnit(s, -i * 3.4, 1.4, -d / 2, Math.PI, { w: 1.3, h: 2.3, arch: true, trim: MAT.stone, sill: MAT.stone });
    }
  }
  for (let i = -2; i <= 2; i++) {
    if (Math.abs(i * 3.4) < (w * 0.66) / 2 - 1)
      windowUnit(s, i * 3.4, 5.7, d / 2, 0, { w: 1.2, h: 1.8, trim: MAT.stone });
  }
  for (const face of ['right', 'left']) {
    const [px, pz, pry] = facePos(face, 0, w, d);
    windowUnit(s, px, 1.4, pz, pry, { w: 1.4, h: 2.4, arch: true, trim: MAT.stone });
    const [qx, qz, qry] = facePos(face, 0, w * 0.66, d);
    windowUnit(s, qx, 5.7, qz, qry, { w: 1.2, h: 1.7, trim: MAT.stone });
  }
  const ridge = roofOf(s, w * 0.66, d, 8.9, {
    roof: MAT.roofSlate,
    roofType: 'hip',
    roofH: 4.0,
    ridge: 'x',
    wall: MAT.brickTan,
    eave: 0.8,
  });
  roofOf(s, w, d, 4.8, {
    roof: MAT.roofSlate,
    roofType: 'flat',
    wall: MAT.brickTan,
    eave: 0.2,
  });
  clockFace(s, 0, 6.6, d / 2 + 0.2, 0, { r: 1.5 });
  chimney(s, w * 0.36, 0, 6, ridge + 1.2, { w: 1.1 });
  s.anchor('glow', 0, 3.4, d / 2 + 1.2, { size: 3, color: 0xffc46b });
  return ridge;
}

/** 站台雨棚：沿 X 方向延伸 */
export function platform(s, o = {}) {
  const len = o.len ?? 44;
  const w = o.w ?? 9;
  s.box(MAT.stone, len, 1.0, w, 0, 0, 0, 0, 2.4);
  s.box(MAT.cobbleWarm, len - 0.3, 0.12, w - 0.3, 0, 1.0, 0, 0, 1.6);
  s.box(MAT.white, len, 0.16, 0.4, 0, 0.9, w / 2 - 0.2, 0, 1);
  s.box(MAT.white, len, 0.16, 0.4, 0, 0.9, -(w / 2 - 0.2), 0, 1);
  if (o.canopy !== false) {
    const n = Math.max(2, Math.round(len / 6));
    for (let i = 0; i <= n; i++) {
      const x = -len / 2 + (len / n) * i;
      s.cyl(MAT.black, 0.14, 0.2, 4.4, x, 1.1, -1.2, 10);
      s.boxC(MAT.metal, 0.12, 2.2, 0.12, x, 4.2, 0.6, 0.7, 0, 0, 1);
      s.boxC(MAT.metal, 0.12, 2.2, 0.12, x, 4.2, -3.0, -0.7, 0, 0, 1);
      if (i < n) s.box(MAT.black, len / n, 0.12, 0.12, x + len / n / 2, 5.4, -1.2);
    }
    s.boxC(MAT.roofSlate, len + 1, 0.16, w * 0.62, 0, 5.5, 1.4, 0.12, 0, 0, 2);
    s.boxC(MAT.roofSlate, len + 1, 0.16, w * 0.42, 0, 5.5, -3.1, -0.12, 0, 0, 2);
    s.box(MAT.timberDark, len + 1, 0.3, 0.24, 0, 5.5, 2.9, 0, 1.4);
    // 花边
    for (let i = 0; i < Math.round(len / 1.2); i++) {
      s.panel(MAT.white, 1.2, 0.4, -len / 2 + i * 1.2 + 0.6, 5.1, 3.0, 0, 0.6, true);
    }
  }
  return 5.6;
}

/** 蒸汽机车 + 车厢（会沿铁轨行驶） */
export function train(s, o = {}) {
  const g = new THREE.Group();
  const sub = new G.Sculptor('loco');
  // 机车
  sub.box(MAT.black, 2.6, 0.5, 9.5, 0, 0.5, 0, 0, 1.4);
  sub.bar(MAT.black, 1.3, 6.4, 0, 1.9, 1.2, 'z', 16, 2);
  sub.cyl(MAT.metalRust, 1.32, 1.36, 0.3, 0, 1.9, 4.3, 16, 0, 1);
  sub.box(MAT.doorRed, 2.7, 2.6, 3.0, 0, 0.9, -3.0, 0, 1.4);
  sub.box(MAT.roofSlate, 3.0, 0.3, 3.2, 0, 3.5, -3.0, 0, 1.4);
  sub.panel(MAT.glass, 1.6, 1.2, 0, 2.1, -1.45, 0, 1.2);
  sub.panel(MAT.glass, 1.2, 1.2, 1.36, 2.1, -3.0, Math.PI / 2, 1.2);
  sub.panel(MAT.glass, 1.2, 1.2, -1.36, 2.1, -3.0, -Math.PI / 2, 1.2);
  // 烟囱
  sub.cyl(MAT.black, 0.42, 0.34, 1.7, 0, 2.9, 3.1, 12);
  sub.cyl(MAT.black, 0.55, 0.42, 0.4, 0, 4.5, 3.1, 12);
  sub.cyl(MAT.gold, 0.3, 0.34, 0.6, 0, 2.9, 1.5, 10);
  sub.cyl(MAT.gold, 0.24, 0.28, 0.5, 0, 2.9, 0.3, 10);
  // 前照灯
  sub.box(MAT.black, 0.6, 0.6, 0.4, 0, 2.6, 4.4, 0, 0.6);
  sub.panel(MAT.lampGlass, 0.42, 0.42, 0, 2.7, 4.62, 0, 1);
  // 排障器
  sub.boxC(MAT.doorRed, 2.4, 1.4, 0.14, 0, 0.7, 4.9, 0.5, 0, 0, 1);
  // 车轮
  for (const sd of [-1, 1]) {
    for (const [zz, rr] of [[3.2, 0.55], [1.4, 0.9], [-0.5, 0.9], [-2.4, 0.9]]) {
      sub.torus(MAT.metal, rr, 0.16, sd * 1.35, rr, zz, 0, Math.PI / 2, 0, 14, 1);
      sub.cyl(MAT.doorRed, rr * 0.8, rr * 0.8, 0.12, sd * 1.35, rr, zz, 14, 0, 1);
    }
  }
  // 煤水车
  sub.push(0, 0, -8.4, 0);
  sub.box(MAT.black, 2.6, 0.5, 6.0, 0, 0.5, 0, 0, 1.4);
  sub.box(MAT.doorRed, 2.7, 2.0, 5.8, 0, 1.0, 0, 0, 1.4);
  sub.box(MAT.coal, 2.3, 0.6, 4.2, 0, 3.0, -0.4, 0, 1);
  for (const sd of [-1, 1])
    for (const zz of [1.8, -1.8]) {
      sub.torus(MAT.metal, 0.7, 0.14, sd * 1.35, 0.7, zz, 0, Math.PI / 2, 0, 12, 1);
    }
  sub.pop();
  // 两节客车
  for (let c = 0; c < 2; c++) {
    sub.push(0, 0, -16.5 - c * 11.4, 0);
    sub.box(MAT.black, 2.7, 0.5, 10.6, 0, 0.5, 0, 0, 1.4);
    sub.box(c === 0 ? MAT.woodRed : MAT.plasterCream, 2.9, 2.7, 10.4, 0, 1.0, 0, 0, 1.6);
    sub.box(MAT.trim, 3.0, 0.2, 10.5, 0, 2.6, 0, 0, 1.2);
    sub.hip(MAT.roofSlate, 11.0, 3.4, 0.7, 0, 3.7, 0, Math.PI / 2, 0.7, 1.4);
    for (let i = -2; i <= 2; i++) {
      sub.panel(MAT.glass, 1.1, 1.2, 1.46, 1.5, i * 1.9, Math.PI / 2, 1.2);
      sub.panel(MAT.glass, 1.1, 1.2, -1.46, 1.5, i * 1.9, -Math.PI / 2, 1.2);
      sub.box(MAT.trim, 0.1, 1.4, 1.3, 1.44, 1.4, i * 1.9, 0, 0.8);
    }
    for (const sd of [-1, 1])
      for (const zz of [3.6, -3.6]) {
        sub.torus(MAT.metal, 0.62, 0.14, sd * 1.4, 0.62, zz, 0, Math.PI / 2, 0, 12, 1);
      }
    sub.pop();
  }
  g.add(sub.finalize());
  const smokeNode = new THREE.Object3D();
  smokeNode.position.set(0, 5.0, 3.1);
  g.add(smokeNode);
  s.anchors.smoke.push({ obj: smokeNode, size: 1.9, rate: 0.16, speed: 2.6, spread: 0.7 });
  return { group: g, smokeNode };
}

export function warehouse(s, o = {}) {
  const w = o.w ?? 18;
  const d = o.d ?? 11;
  const h = o.h ?? 8.4;
  s.box(MAT.stoneDark, w + 0.6, 0.5, d + 0.6, 0, 0, 0, 0, 2);
  s.box(o.wall ?? MAT.brickRed, w, h, d, 0, 0.5, 0, 0, 2.2);
  s.box(MAT.stone, w + 0.3, 0.3, d + 0.3, 0, h * 0.5, 0, 0, 1.6);
  // 装卸大门
  for (const gx of [-w * 0.26, w * 0.26]) {
    s.box(MAT.timberDark, 3.4, 4.2, 0.3, gx, 0.5, d / 2 + 0.02, 0, 1.4);
    s.box(MAT.woodPlankV, 3.0, 3.9, 0.18, gx, 0.6, d / 2 + 0.18, 0, 1.1);
    s.box(MAT.metal, 3.2, 0.14, 0.14, gx, 4.6, d / 2 + 0.2);
  }
  // 上层小门与吊臂
  s.box(MAT.woodPlankV, 2.0, 2.4, 0.2, 0, h * 0.55, d / 2 + 0.12, 0, 1);
  s.box(MAT.timberDark, 0.3, 0.3, 2.6, 0, h * 0.55 + 3.0, d / 2 + 1.0);
  s.box(MAT.black, 0.06, 2.2, 0.06, 0, h * 0.55 + 0.9, d / 2 + 2.1);
  s.torus(MAT.metal, 0.22, 0.06, 0, h * 0.55 + 0.8, d / 2 + 2.1, 0, 0, 0, 10);
  // 窗
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    windowUnit(s, i * 4.0, h * 0.62, d / 2, 0, { w: 1.2, h: 1.5, arch: true, trim: MAT.stone });
    windowUnit(s, i * 4.0, 1.6, d / 2, 0, { w: 1.2, h: 1.5, arch: true, trim: MAT.stone });
  }
  for (const face of ['right', 'left'])
    for (let i = -1; i <= 1; i++) {
      const [px, pz, pry] = facePos(face, i * 3.4, w, d);
      windowUnit(s, px, h * 0.62, pz, pry, { w: 1.1, h: 1.4, trim: MAT.stone });
    }
  return roofOf(s, w, d, h + 0.5, {
    roof: o.roof ?? MAT.roofSlate,
    roofType: 'gable',
    roofH: 4.6,
    ridge: 'x',
    wall: o.wall ?? MAT.brickRed,
    eave: 0.7,
  });
}

export function factory(s, o = {}) {
  const w = o.w ?? 24;
  const d = o.d ?? 15;
  const h = o.h ?? 9.5;
  s.box(MAT.stoneDark, w + 0.8, 0.5, d + 0.8, 0, 0, 0, 0, 2);
  s.box(MAT.brickGrey, w, h, d, 0, 0.5, 0, 0, 2.2);
  s.box(MAT.stone, w + 0.4, 0.35, d + 0.4, 0, h * 0.46, 0, 0, 1.8);
  // 锯齿形屋顶
  const bays = 4;
  const bw = w / bays;
  for (let i = 0; i < bays; i++) {
    const x = -w / 2 + bw * (i + 0.5);
    s.boxC(MAT.roofSlate, bw, 0.2, d + 0.4, x, h + 1.9, 0, 0, 0, 0.62, 2);
    s.panel(MAT.glass, bw - 0.2, 3.1, x, h + 0.5, d / 2 + 0.05, 0, 1.6);
    s.push(x, 0, 0, 0);
    s.gable(MAT.brickGrey, bw, d + 0.4, 3.0, 0, h + 0.5, 0, Math.PI / 2, 2, 'ends');
    s.pop();
  }
  // 窗
  for (let i = 0; i < 6; i++) {
    const x = -w / 2 + 2.4 + i * ((w - 4.8) / 5);
    windowUnit(s, x, 1.6, d / 2, 0, { w: 1.5, h: 3.0, arch: true, trim: MAT.stone });
    windowUnit(s, x, 5.6, d / 2, 0, { w: 1.5, h: 2.6, arch: true, trim: MAT.stone });
    windowUnit(s, -x, 1.6, -d / 2, Math.PI, { w: 1.5, h: 3.0, arch: true, trim: MAT.stone });
  }
  doorUnit(s, 0, 0.5, d / 2, 0, { w: 3.0, h: 3.6, door: MAT.timberDark, steps: false, transom: false });
  // 大烟囱
  const cx = -w / 2 - 3.4;
  s.cyl(MAT.brickGrey, 2.6, 3.4, 2.4, cx, 0, -2, 14, 0, 2.4);
  s.cyl(MAT.brickRed, 1.5, 2.1, 24, cx, 2.4, -2, 16, 0, 2.6);
  for (let i = 1; i < 5; i++) s.torus(MAT.stone, 1.6 + (4 - i) * 0.1, 0.14, cx, 2.4 + i * 5, -2, Math.PI / 2, 0, 0, 16);
  s.cyl(MAT.stoneDark, 1.75, 1.6, 1.0, cx, 26.4, -2, 16, 0, 1.4);
  s.anchor('smoke', cx, 27.8, -2, { size: 3.4, rate: 0.22, speed: 1.8, color: 0x9a9a9a });
  return h + 3;
}

/* ========================================================================== */
/*                                城门 / 小教堂                               */
/* ========================================================================== */

export function gatehouse(s, o = {}) {
  const gap = o.gap ?? 11;
  const r = 3.6;
  const th = 13;
  for (const sd of [-1, 1]) {
    const x = sd * (gap / 2 + r * 0.8);
    s.cyl(MAT.stoneDark, r + 0.5, r + 0.9, 1.2, x, 0, 0, 14, 0, 2.4);
    s.cyl(MAT.stone, r, r + 0.3, th, x, 1.2, 0, 14, 0, 2.8);
    s.cyl(MAT.stoneDark, r + 0.6, r + 0.6, 0.9, x, th + 1.2, 0, 14, 0, 1.8);
    // 城齿
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      s.box(MAT.stoneDark, 1.0, 1.1, 0.7, x + Math.cos(a) * (r + 0.35), th + 2.1, Math.sin(a) * (r + 0.35), -a, 1);
    }
    s.cone(MAT.roofSlate, r + 1.1, 6.4, x, th + 2.1, 0, 14);
    s.cyl(MAT.gold, 0.1, 0.12, 1.2, x, th + 8.4, 0, 8);
    s.ball(MAT.gold, 0.18, x, th + 9.6, 0, 8);
    for (let f = 0; f < 3; f++) {
      windowUnit(s, x, 3 + f * 3.6, r + 0.32, 0, { w: 0.7, h: 1.5, arch: true, trim: MAT.stone, sill: MAT.stoneDark });
      windowUnit(s, x, 3 + f * 3.6, -(r + 0.32), Math.PI, { w: 0.7, h: 1.5, arch: true, trim: MAT.stone, sill: MAT.stoneDark });
    }
  }
  // 中间门洞
  s.arch(MAT.stone, gap + 2.2, 11.5, 6.2, gap * 0.72, 8.4, 0, 0, 0, 0, 12, 2.6);
  s.box(MAT.stoneDark, gap + 2.6, 0.8, 6.8, 0, 11.5, 0, 0, 2.2);
  for (let i = 0; i < 7; i++) {
    s.box(MAT.stoneDark, 1.0, 1.1, 0.7, -gap / 2 - 0.6 + i * ((gap + 1.2) / 6), 12.3, 3.0, 0, 1);
    s.box(MAT.stoneDark, 1.0, 1.1, 0.7, -gap / 2 - 0.6 + i * ((gap + 1.2) / 6), 12.3, -3.0, 0, 1);
  }
  clockFace(s, 0, 8.2, 3.3, 0, { r: 1.6 });
  return th + 10;
}

export function chapel(s, o = {}) {
  const w = o.w ?? 8;
  const d = o.d ?? 13;
  const h = o.h ?? 6.4;
  s.box(MAT.stoneDark, w + 0.8, 0.6, d + 0.8, 0, 0, 0, 0, 2);
  s.box(MAT.stone, w, h, d, 0, 0.6, 0, 0, 2.4);
  for (const face of ['right', 'left']) {
    for (let i = -1; i <= 1; i++) {
      const [px, pz, pry] = facePos(face, i * 3.6, w, d);
      windowUnit(s, px, 2.2, pz, pry, {
        w: 1.0,
        h: 2.4,
        arch: true,
        glass: MAT.glassStained,
        trim: MAT.stone,
        sill: MAT.stoneDark,
      });
    }
  }
  doorUnit(s, 0, 0.6, d / 2, 0, { w: 1.6, h: 2.8, door: MAT.timberDark, arch: true, frame: MAT.stoneDark, steps: true, transom: false, stepMat: MAT.stoneDark });
  s.bar(MAT.stoneDark, 1.1, 0.4, 0, h - 0.4, d / 2 + 0.1, 'z', 16, 1.6);
  s.bar(MAT.glassStained, 0.85, 0.24, 0, h - 0.4, d / 2 + 0.3, 'z', 16, 3);
  const ridge = roofOf(s, w, d, h + 0.6, {
    roof: MAT.roofSlate,
    roofType: 'gable',
    roofH: 3.6,
    ridge: 'x',
    wall: MAT.stone,
    eave: 0.5,
  });
  // 小钟塔
  const bz = -d / 2 + 2.4;
  s.box(MAT.stone, 2.6, 4.2, 2.6, 0, ridge - 1.2, bz, 0, 1.8);
  for (let k = 0; k < 4; k++) {
    s.push(0, 0, bz, (k * Math.PI) / 2);
    s.arch(MAT.stoneDark, 2.3, 2.5, 0.35, 1.2, 1.9, 0, ridge + 0.9, 1.3, 0, 8, 1.4);
    s.pop();
  }
  s.cyl(MAT.gold, 0.34, 0.4, 0.7, 0, ridge + 1.5, bz, 10);
  s.pyramid(MAT.roofSlate, 3.2, 3.2, 3.4, 0, ridge + 3.4, bz, Math.PI / 4, 1.4);
  s.cyl(MAT.gold, 0.07, 0.09, 0.9, 0, ridge + 6.8, bz, 8);
  s.box(MAT.gold, 0.8, 0.12, 0.12, 0, ridge + 7.4, bz);
  s.box(MAT.gold, 0.12, 1.0, 0.12, 0, ridge + 7.2, bz);
  return ridge + 7;
}
