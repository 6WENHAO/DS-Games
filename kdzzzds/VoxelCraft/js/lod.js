/* lod.js - 远景 LOD 瓦片：矮精度立体世界（地表列 + 树冠层 + 水面），Worker 端构建 */
function LOD_MODULE(E) {
  'use strict';

  // level: 1..N, 体素尺寸 s=2^level, C 每边格数
  // 返回可传输几何：solid{pos,col,idx} water{pos,col,idx}
  E.buildLodTile = function (level, tx, tz, C) {
    const s = 1 << level;
    const T = C * s;
    const ox = tx * T, oz = tz * T;
    const W = C + 2;
    const H = new Int32Array(W * W);
    const F = new Int32Array(W * W);
    const FB = new Int32Array(W * W);
    const WA = new Uint8Array(W * W);
    const WLV = new Int32Array(W * W);   // 逐格水位（海 SEA / 盆底湖 480）
    const BIO = new Uint8Array(W * W);
    const SNW = new Uint8Array(W * W);
    const IC = new Uint8Array(W * W);
    const TC = new Uint8Array(W * W * 3);
    const WC = new Uint8Array(W * W * 3);
    const QC = new Uint8Array(W * W * 3); // 水色
    const FC = new Uint8Array(W * W * 3);
    const out = E.makeLodOut();
    const clim = s >= 8 ? E.makeClimate(ox - s, oz - s, ox + T + s, oz + T + s) : null;

    let yMin = 1e9, yMax = -1e9;
    for (let j = -1; j <= C; j++) for (let i = -1; i <= C; i++) {
      const idx = (j + 1) * W + (i + 1);
      E.lodSample(ox + i * s + (s >> 1), oz + j * s + (s >> 1), s, out, clim);
      H[idx] = out.h;
      F[idx] = out.fh;
      FB[idx] = out.fb;
      WA[idx] = out.water;
      WLV[idx] = out.wlv;
      BIO[idx] = out.bio;
      SNW[idx] = out.snw;
      IC[idx] = out.ice;
      if (out.h < yMin) yMin = out.h;
      const tv_ = out.fh > out.h ? out.fh : out.h;
      if (tv_ > yMax) yMax = tv_;
      TC[idx * 3] = out.top[0]; TC[idx * 3 + 1] = out.top[1]; TC[idx * 3 + 2] = out.top[2];
      WC[idx * 3] = out.wall[0]; WC[idx * 3 + 1] = out.wall[1]; WC[idx * 3 + 2] = out.wall[2];
      FC[idx * 3] = out.fcol[0]; FC[idx * 3 + 1] = out.fcol[1]; FC[idx * 3 + 2] = out.fcol[2];
      if (out.water) { QC[idx * 3] = out.wcol[0]; QC[idx * 3 + 1] = out.wcol[1]; QC[idx * 3 + 2] = out.wcol[2]; }
    }

    /* ---------- 陡壁露岩 / 斜坡去冰 / 陡坡树址标记（与近景 genChunk 同源规则，阈值随格距 s 缩放） ---------- */
    const STEEP = new Uint8Array(W * W);
    {
      const tmp = [0, 0, 0];
      const big = s >= 16;
      for (let j = -1; j <= C; j++) for (let i = -1; i <= C; i++) {
        const a = (j + 1) * W + (i + 1);
        const bio = BIO[a];
        const mnt = bio === E.B_SNOW || bio === E.B_HIGHSNOW || bio === E.B_HIGHPEAK;
        const h0 = H[a];
        let dmax = 0, d;
        if (i > -1) { d = h0 - H[a - 1]; if (d < 0) d = -d; if (d > dmax) dmax = d; }
        if (i < C) { d = h0 - H[a + 1]; if (d < 0) d = -d; if (d > dmax) dmax = d; }
        if (j > -1) { d = h0 - H[a - W]; if (d < 0) d = -d; if (d > dmax) dmax = d; }
        if (j < C) { d = h0 - H[a + W]; if (d < 0) d = -d; if (d > dmax) dmax = d; }
        if (dmax >= (mnt ? E.SNOW_STEEP : 4) * s) STEEP[a] = 1;   // 陡坡：树不生成（近景同规则）
        if (!mnt) continue;
        if (SNW[a] && dmax >= E.SNOW_STEEP * s) {
          E.steepRockTop(bio, ox + i * s + (s >> 1), oz + j * s + (s >> 1), big, tmp);
          TC[a * 3] = tmp[0]; TC[a * 3 + 1] = tmp[1]; TC[a * 3 + 2] = tmp[2];
        } else if (IC[a] && dmax > s) {      // 斜坡"冰"回退为雪（冰面只在平地）
          const P = E.PAL;
          TC[a * 3] = E.qcol(P.snow[0], big); TC[a * 3 + 1] = E.qcol(P.snow[1], big); TC[a * 3 + 2] = E.qcol(P.snow[2], big);
        }
      }
    }

    /* ---------- L1/L2：逐方块树干扫描 + 树冠形状泼溅（中距离树叶不丢） ---------- */
    if (s <= 4) {
      const M = 5;               // 金合欢冠幅 ±5 → 边缘余量 5
      const N = C * s + 2 * M;
      const tTop = new Int16Array(N * N);
      const tBot = new Int16Array(N * N);
      const tTyp = new Uint8Array(N * N);
      for (let bz = 0; bz < N; bz++) for (let bx = 0; bx < N; bx++) {
        const wx = ox - M + bx, wz = oz - M + bz;
        let ci = Math.floor((wx - ox) / s); if (ci < -1) ci = -1; else if (ci > C) ci = C;
        let cj = Math.floor((wz - oz) / s); if (cj < -1) cj = -1; else if (cj > C) cj = C;
        const cidx = (cj + 1) * W + (ci + 1);
        if (WA[cidx] || STEEP[cidx]) continue;   // 水面/陡坡（与近景跳树规则同源）不泼溅树冠
        const ty = E.treeAt(wx, wz, BIO[cidx], H[cidx], SNW[cidx]);
        if (!ty) continue;
        const tt = E.treeTop(ty, wx, wz);
        const base = H[cidx], top = base + tt;
        if (ty === 1) {          // 杉：贴地深绿锥
          for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
            const gx = bx + dx, gz = bz + dz;
            if (gx < 0 || gz < 0 || gx >= N || gz >= N) continue;
            const d = Math.max(Math.abs(dx), Math.abs(dz));
            const ct = top - d * 3, cb = base + 2;
            const gi = gz * N + gx;
            if (ct > tTop[gi]) { tTop[gi] = ct; tBot[gi] = cb; tTyp[gi] = 1; }
          }
        } else if (ty === 2 || ty === 6) {   // 棕榈/金合欢：高位薄伞冠
          for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
            const md = Math.abs(dx) + Math.abs(dz);
            if (md > (ty === 6 ? 5 : 4)) continue;
            const gx = bx + dx, gz = bz + dz;
            if (gx < 0 || gz < 0 || gx >= N || gz >= N) continue;
            const ct = top - (md >= 3 ? 1 : 0), cb = ct - 2;
            const gi = gz * N + gx;
            if (ct > tTop[gi]) { tTop[gi] = ct; tBot[gi] = cb; tTyp[gi] = ty; }
          }
        } else if (ty === 5) {   // 白桦：细高小冠
          for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
            const d2 = dx * dx + dz * dz;
            if (d2 > 5) continue;
            const gx = bx + dx, gz = bz + dz;
            if (gx < 0 || gz < 0 || gx >= N || gz >= N) continue;
            const ct = top - ((d2 * 0.4) | 0), cb = ct - 4;
            const gi = gz * N + gx;
            if (ct > tTop[gi]) { tTop[gi] = ct; tBot[gi] = cb; tTyp[gi] = 5; }
          }
        } else if (ty === 7) {   // 丛林树：高干顶冠
          for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
            const d2 = dx * dx + dz * dz;
            if (d2 > 10.5) continue;
            const gx = bx + dx, gz = bz + dz;
            if (gx < 0 || gz < 0 || gx >= N || gz >= N) continue;
            const ct = top - ((d2 * 0.25) | 0), cb = ct - 3;
            const gi = gz * N + gx;
            if (ct > tTop[gi]) { tTop[gi] = ct; tBot[gi] = cb; tTyp[gi] = 7; }
          }
        } else {                 // 樱花/橡树/枫树：悬浮圆冠
          for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
            const d2 = dx * dx + dz * dz;
            if (d2 > 10) continue;
            const gx = bx + dx, gz = bz + dz;
            if (gx < 0 || gz < 0 || gx >= N || gz >= N) continue;
            const ct = top - ((d2 * 0.35) | 0), cb = ct - 4;
            const gi = gz * N + gx;
            if (ct > tTop[gi]) { tTop[gi] = ct; tBot[gi] = cb; tTyp[gi] = ty; }
          }
        }
      }
      // 聚合到 LOD 格；配色 E.FOL 与近景同源
      const PP = E.PAL;
      for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) {
        const a = idxOf2(i, j);
        let best = 0, bb = 0, bt = 0;
        for (let dz = 0; dz < s; dz++) {
          const rowG = (j * s + M + dz) * N + i * s + M;
          for (let dx = 0; dx < s; dx++) {
            const gi = rowG + dx;
            if (tTop[gi] > best) { best = tTop[gi]; bb = tBot[gi]; bt = tTyp[gi]; }
          }
        }
        if (!best || best <= H[a] + 1) continue;
        F[a] = best;
        if (best > yMax) yMax = best;
        FB[a] = Math.max(H[a] + 1, Math.min(bb, best - 1));
        const fc = E.FOL[bt] || PP.folFir;
        const jj = (E.h2(ox + i * s, oz + j * s, 813) - 0.5) * 20;
        FC[a * 3] = clamp8(fc[0] + jj); FC[a * 3 + 1] = clamp8(fc[1] + jj); FC[a * 3 + 2] = clamp8(fc[2] + jj);
      }
    }
    function clamp8(v) { v = v | 0; return v < 0 ? 0 : v > 255 ? 255 : v; }
    function idxOf2(i, j) { return (j + 1) * W + (i + 1); }

    const sp = [], sc = [], si = []; let svc = 0;
    const wp = [], wc = [], wi = []; let wvc = 0;

    function pushQuad(P, Cc, I, vc, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, r, g, b, r2, g2, b2) {
      P.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
      Cc.push(r, g, b, r, g, b, r2, g2, b2, r2, g2, b2);
      I.push(vc, vc + 1, vc + 2, vc, vc + 2, vc + 3);
      return vc + 4;
    }
    function idxOf(i, j) { return (j + 1) * W + (i + 1); }

    /* ---------- 2D 贪婪合并工具（顶面矩形扩张） ---------- */
    function greedyTops(present, same, emit) {
      const done = new Uint8Array(C * C);
      for (let j = 0; j < C; j++) {
        for (let i = 0; i < C; i++) {
          if (done[j * C + i] || !present(i, j)) continue;
          let w = 1;
          while (i + w < C && !done[j * C + i + w] && present(i + w, j) && same(i, j, i + w, j)) w++;
          let hh = 1;
          outer:
          while (j + hh < C) {
            for (let k = 0; k < w; k++) {
              if (done[(j + hh) * C + i + k] || !present(i + k, j + hh) || !same(i, j, i + k, j + hh)) break outer;
            }
            hh++;
          }
          for (let jj = 0; jj < hh; jj++) for (let ii = 0; ii < w; ii++) done[(j + jj) * C + i + ii] = 1;
          emit(i, j, w, hh);
          i += w - 1;
        }
      }
    }

    /* ---------- 地表顶面（2D 贪婪合并） ---------- */
    greedyTops(
      function () { return true; },
      function (i0, j0, i1, j1) {
        const a = idxOf(i0, j0), b = idxOf(i1, j1);
        return H[a] === H[b] && TC[a * 3] === TC[b * 3] && TC[a * 3 + 1] === TC[b * 3 + 1] && TC[a * 3 + 2] === TC[b * 3 + 2];
      },
      function (i, j, w, hh) {
        const a = idxOf(i, j);
        const y = H[a] + 1, r = TC[a * 3], g = TC[a * 3 + 1], b = TC[a * 3 + 2];
        svc = pushQuad(sp, sc, si, svc,
          i * s, y, j * s, i * s, y, (j + hh) * s, (i + w) * s, y, (j + hh) * s, (i + w) * s, y, j * s,
          r, g, b, r, g, b);
      });

    /* ---------- 地表侧壁（沿另一轴行程合并） ---------- */
    // X 向平面 x=k*s，比较 (k-1,j) 与 (k,j)
    for (let k = 0; k <= C; k++) {
      let j = 0;
      while (j < C) {
        const ia = idxOf(k - 1, j), ib = idxOf(k, j);
        const ha = H[ia], hb = H[ib];
        let ownerI = -1, hTop = 0, hBot = 0, face = 0;
        if (ha > hb && k - 1 >= 0 && k - 1 < C) { ownerI = ia; hTop = ha; hBot = hb; face = 1; }
        else if (hb > ha && k >= 0 && k < C) { ownerI = ib; hTop = hb; hBot = ha; face = -1; }
        if (ownerI < 0) { j++; continue; }
        const tr = TC[ownerI * 3], tg = TC[ownerI * 3 + 1], tb = TC[ownerI * 3 + 2];
        const wr = WC[ownerI * 3], wg = WC[ownerI * 3 + 1], wb = WC[ownerI * 3 + 2];
        let len = 1;
        while (j + len < C) {
          const ja = idxOf(k - 1, j + len), jb = idxOf(k, j + len);
          if (H[ja] !== ha || H[jb] !== hb) break;
          const o2 = face === 1 ? ja : jb;
          if (TC[o2 * 3] !== tr || TC[o2 * 3 + 1] !== tg || WC[o2 * 3] !== wr) break;
          len++;
        }
        const sh = 0.88;
        const x = k * s, z0 = j * s, z1 = (j + len) * s;
        const yT = hTop + 1, yB = hBot + 1;
        const cr = tr * sh | 0, cg = tg * sh | 0, cb = tb * sh | 0;
        const br = wr * sh | 0, bg = wg * sh | 0, bb = wb * sh | 0;
        if (face === 1) svc = pushQuad(sp, sc, si, svc, x, yT, z0, x, yT, z1, x, yB, z1, x, yB, z0, cr, cg, cb, br, bg, bb);
        else svc = pushQuad(sp, sc, si, svc, x, yT, z1, x, yT, z0, x, yB, z0, x, yB, z1, cr, cg, cb, br, bg, bb);
        j += len;
      }
    }
    // Z 向平面 z=k*s，比较 (i,k-1) 与 (i,k)
    for (let k = 0; k <= C; k++) {
      let i = 0;
      while (i < C) {
        const ia = idxOf(i, k - 1), ib = idxOf(i, k);
        const ha = H[ia], hb = H[ib];
        let ownerI = -1, hTop = 0, hBot = 0, face = 0;
        if (ha > hb && k - 1 >= 0 && k - 1 < C) { ownerI = ia; hTop = ha; hBot = hb; face = 1; }
        else if (hb > ha && k >= 0 && k < C) { ownerI = ib; hTop = hb; hBot = ha; face = -1; }
        if (ownerI < 0) { i++; continue; }
        const tr = TC[ownerI * 3], tg = TC[ownerI * 3 + 1], tb = TC[ownerI * 3 + 2];
        const wr = WC[ownerI * 3], wg = WC[ownerI * 3 + 1], wb = WC[ownerI * 3 + 2];
        let len = 1;
        while (i + len < C) {
          const ja = idxOf(i + len, k - 1), jb = idxOf(i + len, k);
          if (H[ja] !== ha || H[jb] !== hb) break;
          const o2 = face === 1 ? ja : jb;
          if (TC[o2 * 3] !== tr || TC[o2 * 3 + 1] !== tg || WC[o2 * 3] !== wr) break;
          len++;
        }
        const sh = 0.78;
        const z = k * s, x0 = i * s, x1 = (i + len) * s;
        const yT = hTop + 1, yB = hBot + 1;
        const cr = tr * sh | 0, cg = tg * sh | 0, cb = tb * sh | 0;
        const br = wr * sh | 0, bg = wg * sh | 0, bb = wb * sh | 0;
        if (face === 1) svc = pushQuad(sp, sc, si, svc, x1, yT, z, x0, yT, z, x0, yB, z, x1, yB, z, cr, cg, cb, br, bg, bb);
        else svc = pushQuad(sp, sc, si, svc, x0, yT, z, x1, yT, z, x1, yB, z, x0, yB, z, cr, cg, cb, br, bg, bb);
        i += len;
      }
    }

    /* ---------- 树冠层顶面（2D 贪婪合并） ---------- */
    greedyTops(
      function (i, j) { return F[idxOf(i, j)] > 0; },
      function (i0, j0, i1, j1) {
        const a = idxOf(i0, j0), b = idxOf(i1, j1);
        return F[a] === F[b] && FC[a * 3] === FC[b * 3] && FC[a * 3 + 1] === FC[b * 3 + 1] && FC[a * 3 + 2] === FC[b * 3 + 2];
      },
      function (i, j, w, hh) {
        const a = idxOf(i, j);
        const y = F[a] + 1, r = FC[a * 3], g = FC[a * 3 + 1], b = FC[a * 3 + 2];
        svc = pushQuad(sp, sc, si, svc,
          i * s, y, j * s, i * s, y, (j + hh) * s, (i + w) * s, y, (j + hh) * s, (i + w) * s, y, j * s,
          r, g, b, r, g, b);
      });
    /* ---------- 树冠层侧壁（下沿到冠底 FB，樱花/棕榈悬浮，杉树贴地锥） ---------- */
    function canopyWallsX() {
      for (let k = 0; k <= C; k++) {
        for (let j = 0; j < C; j++) {
          const ia = idxOf(k - 1, j), ib = idxOf(k, j);
          const fa = F[ia], fb = F[ib];
          let ownerI = -1, top = 0, bot = 0, face = 0;
          if (fa > 0 && fa > fb && k - 1 >= 0 && k - 1 < C) { ownerI = ia; top = fa; bot = fb > 0 ? Math.max(fb, FB[ia]) : FB[ia]; face = 1; }
          else if (fb > 0 && fb > fa && k >= 0 && k < C) { ownerI = ib; top = fb; bot = fa > 0 ? Math.max(fa, FB[ib]) : FB[ib]; face = -1; }
          if (ownerI < 0) continue;
          bot = Math.min(bot, top - 1);
          const sh = 0.80;
          const r = FC[ownerI * 3] * sh | 0, g = FC[ownerI * 3 + 1] * sh | 0, b = FC[ownerI * 3 + 2] * sh | 0;
          const r2 = r * 0.8 | 0, g2 = g * 0.8 | 0, b2 = b * 0.8 | 0;
          const x = k * s, z0 = j * s, z1 = (j + 1) * s;
          if (face === 1) svc = pushQuad(sp, sc, si, svc, x, top + 1, z0, x, top + 1, z1, x, bot + 1, z1, x, bot + 1, z0, r, g, b, r2, g2, b2);
          else svc = pushQuad(sp, sc, si, svc, x, top + 1, z1, x, top + 1, z0, x, bot + 1, z0, x, bot + 1, z1, r, g, b, r2, g2, b2);
        }
      }
    }
    function canopyWallsZ() {
      for (let k = 0; k <= C; k++) {
        for (let i = 0; i < C; i++) {
          const ia = idxOf(i, k - 1), ib = idxOf(i, k);
          const fa = F[ia], fb = F[ib];
          let ownerI = -1, top = 0, bot = 0, face = 0;
          if (fa > 0 && fa > fb && k - 1 >= 0 && k - 1 < C) { ownerI = ia; top = fa; bot = fb > 0 ? Math.max(fb, FB[ia]) : FB[ia]; face = 1; }
          else if (fb > 0 && fb > fa && k >= 0 && k < C) { ownerI = ib; top = fb; bot = fa > 0 ? Math.max(fa, FB[ib]) : FB[ib]; face = -1; }
          if (ownerI < 0) continue;
          bot = Math.min(bot, top - 1);
          const sh = 0.68;
          const r = FC[ownerI * 3] * sh | 0, g = FC[ownerI * 3 + 1] * sh | 0, b = FC[ownerI * 3 + 2] * sh | 0;
          const r2 = r * 0.8 | 0, g2 = g * 0.8 | 0, b2 = b * 0.8 | 0;
          const z = k * s, x0 = i * s, x1 = (i + 1) * s;
          if (face === 1) svc = pushQuad(sp, sc, si, svc, x1, top + 1, z, x0, top + 1, z, x0, bot + 1, z, x1, bot + 1, z, r, g, b, r2, g2, b2);
          else svc = pushQuad(sp, sc, si, svc, x0, top + 1, z, x1, top + 1, z, x1, bot + 1, z, x0, bot + 1, z, r, g, b, r2, g2, b2);
        }
      }
    }
    canopyWallsX();
    canopyWallsZ();
    /* 悬浮树冠底面（从下面看不穿帮） */
    for (let j = 0; j < C; j++) {
      let i = 0;
      while (i < C) {
        const a = idxOf(i, j);
        if (!F[a] || FB[a] <= H[a] + 1) { i++; continue; }
        const fb0 = FB[a];
        const r = FC[a * 3] * 0.55 | 0, g = FC[a * 3 + 1] * 0.55 | 0, b = FC[a * 3 + 2] * 0.55 | 0;
        let len = 1;
        while (i + len < C) {
          const n = idxOf(i + len, j);
          if (!F[n] || FB[n] !== fb0 || FC[n * 3] !== FC[a * 3]) break;
          len++;
        }
        const y = fb0 + 1;
        svc = pushQuad(sp, sc, si, svc,
          i * s, y, j * s, (i + len) * s, y, j * s, (i + len) * s, y, (j + 1) * s, i * s, y, (j + 1) * s,
          r, g, b, r, g, b);
        i += len;
      }
    }

    /* ---------- 水面（2D 贪婪合并；逐格水位：海面/盆底湖不同高度） ---------- */
    let wy0 = 1e9, wy1 = -1e9;
    greedyTops(
      function (i, j) { return WA[idxOf(i, j)] === 1; },
      function (i0, j0, i1, j1) {
        const a = idxOf(i0, j0), b = idxOf(i1, j1);
        return WLV[a] === WLV[b] && QC[a * 3] === QC[b * 3] && QC[a * 3 + 1] === QC[b * 3 + 1] && QC[a * 3 + 2] === QC[b * 3 + 2];
      },
      function (i, j, w, hh) {
        const a = idxOf(i, j);
        const wy = WLV[a] + 0.86;
        const r = QC[a * 3], g = QC[a * 3 + 1], b = QC[a * 3 + 2];
        if (WLV[a] < wy0) wy0 = WLV[a];
        if (WLV[a] + 2 > wy1) wy1 = WLV[a] + 2;
        wvc = pushQuad(wp, wc, wi, wvc,
          i * s, wy, j * s, i * s, wy, (j + hh) * s, (i + w) * s, wy, (j + hh) * s, (i + w) * s, wy, j * s,
          r, g, b, r, g, b);
      });

    return {
      solid: {
        pos: new Float32Array(sp), col: new Uint8Array(sc), idx: new Uint32Array(si),
        y0: yMin === 1e9 ? 0 : yMin - 1, y1: yMax === -1e9 ? 0 : yMax + 2
      },
      water: {
        pos: new Float32Array(wp), col: new Uint8Array(wc), idx: new Uint32Array(wi),
        y0: wy0 === 1e9 ? E.SEA : wy0, y1: wy1 === -1e9 ? E.SEA + 2 : wy1
      },
      level: level, tx: tx, tz: tz
    };
  };
}
if (typeof module !== 'undefined') module.exports = LOD_MODULE;
