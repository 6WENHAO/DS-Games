/* =====================================================================
 * 紫禁城 体素模型 — 中式官式古建构件库 (Arch)
 * ---------------------------------------------------------------------
 * 纯数据模块，只调用 VoxelWorld，不依赖 THREE。
 *
 * 屋顶形制（依《清式营造则例》与故宫实物）：
 *   庑殿顶  1正脊 + 4垂脊 = 5脊，四坡无山花（太和殿、乾清宫、坤宁宫、午门正楼）
 *   歇山顶  1正脊 + 4垂脊 + 4戗脊 = 9脊，两端有山花博风（保和殿、太和门）
 *   攒尖顶  无正脊，4垂脊交于宝顶（中和殿、交泰殿、午门阙亭）
 *   盝顶    四面坡 + 平顶围脊（钦安殿，紫禁城唯一）
 *   十字脊  两正脊十字相交（四座角楼，72脊）
 *   悬山/硬山 2坡1正脊（庑房、朝房、值房）
 *   重檐    下檐另加一圈围脊(博脊)
 *
 * 屋面曲线用"举架"：檐口平缓、脊部陡峻，累计内收 C(i)=R·(i/L)^γ，γ<1。
 * ===================================================================== */
(function (G) {
  'use strict';

  var B = G.GGPalette.BLOCK;

  /* ---------- 工具 ---------- */
  function rnd(seed) {                       // mulberry32 确定性随机
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function ri(v) { return Math.round(v); }

  /** 举架曲线：返回 cum[0..layers]，cum[0]=0，cum[layers]=run，逐层增量递减 */
  function profile(run, layers, gamma) {
    run = Math.max(1, ri(run));
    layers = clamp(ri(layers), 1, run);
    gamma = gamma || 0.72;
    var cum = new Array(layers + 1), i;
    cum[0] = 0;
    for (i = 1; i < layers; i++) cum[i] = ri(run * Math.pow(i / layers, gamma));
    cum[layers] = run;
    for (i = 1; i <= layers; i++) if (cum[i] < cum[i - 1] + 1) cum[i] = cum[i - 1] + 1;
    if (cum[layers] > run) {                 // 退化为等差，保证收口
      for (i = 0; i <= layers; i++) cum[i] = ri(run * i / layers);
      for (i = 1; i <= layers; i++) if (cum[i] < cum[i - 1]) cum[i] = cum[i - 1];
    }
    return cum;
  }

  /** 瓦垄：垄沿坡面方向（垂直于所在坡的檐口），用亮/暗两色交替模拟筒瓦板瓦 */
  function tileMat(x, z, cx, cz, ridgeHalfX, pal) {
    // 位于两端歇坡（三角坡）时垄沿 X，否则垄沿 Z
    var onEnd = Math.abs(x - cx) > ridgeHalfX;
    var k = onEnd ? z : x;
    var m = ((k % 3) + 3) % 3;
    return m === 0 ? pal.tileL : (m === 1 ? pal.tile : pal.tileD);
  }

  function palOf(o) {
    var t = o.tile === undefined ? B.TILE_Y : o.tile;
    if (t === B.TILE_G) return { tile: B.TILE_G, tileD: B.TILE_G_D, tileL: B.TILE_G, ridge: B.RIDGE_G };
    if (t === B.TILE_K) return { tile: B.TILE_K, tileD: B.TILE_K, tileL: B.TILE_K, ridge: B.TILE_G };
    if (t === B.TILE_ASH) return { tile: B.TILE_ASH, tileD: B.TILE_ASH, tileL: B.TILE_ASH, ridge: B.BRICK };
    return { tile: B.TILE_Y, tileD: B.TILE_Y_D, tileL: B.TILE_Y_L, ridge: B.RIDGE };
  }

  /* ================= 檐口构造：椽飞 + 翼角起翘 ================= */
  function eaveEdge(v, x0, z0, x1, z1, y, pal) {
    // 檐口下方一圈椽飞望板，使屋檐有厚度、投影出檐影
    for (var x = x0; x <= x1; x++) {
      v.set(x, y - 1, z0, B.WOOD_D); v.set(x, y - 1, z1, B.WOOD_D);
    }
    for (var z = z0 + 1; z < z1; z++) {
      v.set(x0, y - 1, z, B.WOOD_D); v.set(x1, y - 1, z, B.WOOD_D);
    }
  }

  function wingUpturn(v, x0, z0, x1, z1, y, pal) {
    // 翼角起翘：四角向外挑出并抬高，端部收成戗脊头
    var c = [[x0, z0, 1, 1], [x1, z0, -1, 1], [x0, z1, 1, -1], [x1, z1, -1, -1]];
    for (var i = 0; i < 4; i++) {
      var cx = c[i][0], cz = c[i][1], sx = c[i][2], sz = c[i][3];
      v.set(cx - sx, y, cz, pal.tile);
      v.set(cx, y, cz - sz, pal.tile);
      v.set(cx - sx, y, cz - sz, pal.tile);
      v.set(cx, y + 1, cz, pal.ridge);
      v.set(cx + sx * 0, y + 1, cz, pal.ridge);
      v.set(cx - sx, y + 1, cz, pal.ridge);
      v.set(cx, y + 1, cz - sz, pal.ridge);
      v.set(cx, y + 2, cz, B.BEAST);            // 套兽
    }
  }

  /* ================= 垂脊 / 戗脊 描线 ================= */
  function hipRidgeStep(v, x, z, sx, sz, band, y, mat) {
    // 从角点沿 L 形走一段，形成连续垂脊
    for (var t = 0; t <= band; t++) v.set(x + sx * t, y, z, mat);
    for (var t2 = 0; t2 <= band; t2++) v.set(x + sx * band, y, z + sz * t2, mat);
  }

  /* ================= 庑殿顶 ================= */
  /**
   * o: {x0,z0,x1,z1,y, layers|slope, gamma, tile, ridgeH, beasts, noEaveEdge}
   * 返回 {top, ridgeAxis, rx0,rx1,rz0,rz1, layers}
   */
  function roofHip(v, o) {
    var pal = palOf(o);
    var x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1, y = o.y;
    var W = x1 - x0 + 1, D = z1 - z0 + 1;
    var short = Math.min(W, D);
    var run = Math.floor((short - 1) / 2);
    if (run < 1) run = 1;
    var layers = o.layers !== undefined ? o.layers : ri(run * (o.slope || 0.5));
    layers = clamp(layers, 1, run);
    var cum = profile(run, layers, o.gamma);
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    var ridgeAxis = W >= D ? 'x' : 'z';
    var i, x, z;

    if (!o.noEaveEdge) eaveEdge(v, x0, z0, x1, z1, y, pal);

    for (i = 0; i < layers; i++) {
      var ins = cum[i], nxt = cum[i + 1];
      var band = Math.max(1, nxt - ins);
      var ax0 = x0 + ins, ax1 = x1 - ins, az0 = z0 + ins, az1 = z1 - ins;
      if (ax0 > ax1 || az0 > az1) { layers = i; break; }
      var ridgeHalfX = Math.max(0, (Math.min(ax1 - ax0, az1 - az0)) / 2);
      var yy = y + i;
      var wI = ax1 - ax0 + 1, dI = az1 - az0 + 1;
      if (wI <= 2 * band || dI <= 2 * band) {
        for (x = ax0; x <= ax1; x++) for (z = az0; z <= az1; z++)
          v.set(x, yy, z, tileMat(x, z, cx, cz, ridgeHalfX, pal));
      } else {
        for (x = ax0; x <= ax1; x++) {
          var xe = (x - ax0 < band) || (ax1 - x < band);
          for (z = az0; z <= az1; z++) {
            if (xe || (z - az0 < band) || (az1 - z < band))
              v.set(x, yy, z, tileMat(x, z, cx, cz, ridgeHalfX, pal));
          }
        }
      }
      // 四条垂脊
      hipRidgeStep(v, ax0, az0, +1, +1, band, yy + 1, pal.ridge);
      hipRidgeStep(v, ax1, az0, -1, +1, band, yy + 1, pal.ridge);
      hipRidgeStep(v, ax0, az1, +1, -1, band, yy + 1, pal.ridge);
      hipRidgeStep(v, ax1, az1, -1, -1, band, yy + 1, pal.ridge);
    }

    if (!o.noEaveEdge) wingUpturn(v, x0, z0, x1, z1, y, pal);

    // 顶层残余矩形 = 正脊带
    var ins2 = cum[layers];
    var tx0 = x0 + ins2, tx1 = x1 - ins2, tz0 = z0 + ins2, tz1 = z1 - ins2;
    if (tx0 > tx1) { tx0 = tx1 = ri(cx); }
    if (tz0 > tz1) { tz0 = tz1 = ri(cz); }
    var top = y + layers;
    for (x = tx0; x <= tx1; x++) for (z = tz0; z <= tz1; z++) v.set(x, top, z, pal.tile);

    // 正脊：抬高 ridgeH，两端正吻
    var rh = o.ridgeH !== undefined ? o.ridgeH : (W > 40 ? 3 : 2);
    for (x = tx0; x <= tx1; x++) for (z = tz0; z <= tz1; z++)
      for (var h = 1; h <= rh; h++) v.set(x, top + h, z, pal.ridge);
    if (ridgeAxis === 'x') {
      addWen(v, tx0 - 1, tz0, tz1, top, rh, -1, 'x', pal);
      addWen(v, tx1 + 1, tz0, tz1, top, rh, +1, 'x', pal);
    } else {
      addWen(v, tz0 - 1, tx0, tx1, top, rh, -1, 'z', pal);
      addWen(v, tz1 + 1, tx0, tx1, top, rh, +1, 'z', pal);
    }

    // 垂脊走兽（自檐口向上等距布置）
    if (o.beasts) placeBeasts(v, x0, z0, x1, z1, y, cum, layers, o.beasts);

    return { top: top + rh, roofTop: top, layers: layers, ridgeAxis: ridgeAxis,
             rx0: tx0, rx1: tx1, rz0: tz0, rz1: tz1 };
  }

  /** 正吻（大吻）：脊端向上翻卷的龙形构件 */
  function addWen(v, pos, a0, a1, top, rh, dir, axis, pal) {
    for (var a = a0; a <= a1; a++) {
      for (var h = 1; h <= rh + 1; h++) {
        if (axis === 'x') v.set(pos, top + h, a, pal.ridge);
        else v.set(a, top + h, pos, pal.ridge);
      }
      if (axis === 'x') {
        v.set(pos + dir, top + rh + 1, a, B.GILT);
        v.set(pos, top + rh + 2, a, B.GILT);
      } else {
        v.set(a, top + rh + 1, pos + dir, B.GILT);
        v.set(a, top + rh + 2, pos, B.GILT);
      }
    }
  }

  /** 垂脊走兽：n 只，太和殿为 10 只（唯一），保和殿/乾清宫 9 只 */
  function placeBeasts(v, x0, z0, x1, z1, y, cum, layers, n) {
    var corners = [[x0, z0, 1, 1], [x1, z0, -1, 1], [x0, z1, 1, -1], [x1, z1, -1, -1]];
    var span = Math.max(1, Math.floor(layers * 0.66));
    for (var c = 0; c < 4; c++) {
      var cx = corners[c][0], cz = corners[c][1], sx = corners[c][2], sz = corners[c][3];
      for (var k = 0; k < n; k++) {
        var t = span * (k + 1) / (n + 1);
        var li = clamp(Math.floor(t), 0, layers - 1);
        var ins = cum[li];
        var frac = t - li;
        var extra = Math.round(frac * Math.max(0, cum[li + 1] - ins));
        v.set(cx + sx * (ins + extra), y + li + 2, cz + sz * ins, B.BEAST);
      }
    }
  }

  /* ================= 四角攒尖顶 ================= */
  function roofPyramid(v, o) {
    var pal = palOf(o);
    var x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1, y = o.y;
    var run = Math.floor((Math.min(x1 - x0, z1 - z0)) / 2);
    if (run < 1) run = 1;
    var layers = clamp(o.layers !== undefined ? o.layers : ri(run * (o.slope || 0.85)), 1, run);
    var cum = profile(run, layers, o.gamma || 0.8);
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    if (!o.noEaveEdge) eaveEdge(v, x0, z0, x1, z1, y, pal);
    var i, x, z;
    for (i = 0; i < layers; i++) {
      var ins = cum[i], band = Math.max(1, cum[i + 1] - ins);
      var ax0 = x0 + ins, ax1 = x1 - ins, az0 = z0 + ins, az1 = z1 - ins;
      if (ax0 > ax1 || az0 > az1) { layers = i; break; }
      var yy = y + i;
      for (x = ax0; x <= ax1; x++) {
        var xe = (x - ax0 < band) || (ax1 - x < band);
        for (z = az0; z <= az1; z++)
          if (xe || (z - az0 < band) || (az1 - z < band)) v.set(x, yy, z, tileMat(x, z, cx, cz, 0, pal));
      }
      hipRidgeStep(v, ax0, az0, +1, +1, band, yy + 1, pal.ridge);
      hipRidgeStep(v, ax1, az0, -1, +1, band, yy + 1, pal.ridge);
      hipRidgeStep(v, ax0, az1, +1, -1, band, yy + 1, pal.ridge);
      hipRidgeStep(v, ax1, az1, -1, -1, band, yy + 1, pal.ridge);
    }
    if (!o.noEaveEdge) wingUpturn(v, x0, z0, x1, z1, y, pal);
    var ins2 = cum[layers];
    var tx0 = Math.min(x0 + ins2, ri(cx)), tx1 = Math.max(x1 - ins2, ri(cx));
    var tz0 = Math.min(z0 + ins2, ri(cz)), tz1 = Math.max(z1 - ins2, ri(cz));
    var top = y + layers;
    for (x = tx0; x <= tx1; x++) for (z = tz0; z <= tz1; z++) v.set(x, top, z, pal.ridge);
    // 铜镀金宝顶
    var fh = o.finialH || 3;
    finial(v, ri(cx), ri(cz), top + 1, fh, Math.max(1, Math.min(2, tx1 - tx0)));
    // 攒尖顶四条垂脊亦布走兽
    if (o.beasts) placeBeasts(v, x0, z0, x1, z1, y, cum, layers, o.beasts);
    return { top: top + fh + 1, roofTop: top, layers: layers };
  }

  /** 宝顶：下为须弥小座，上为镀金圆珠 */
  function finial(v, cx, cz, y, h, r) {
    var i, dx, dz;
    for (dx = -r; dx <= r; dx++) for (dz = -r; dz <= r; dz++) v.set(cx + dx, y, cz + dz, B.FINIAL);
    for (i = 1; i < h; i++) {
      var rr = (i < h - 1) ? Math.max(0, r - 1) : 0;
      for (dx = -rr; dx <= rr; dx++) for (dz = -rr; dz <= rr; dz++) v.set(cx + dx, y + i, cz + dz, B.FINIAL);
    }
    v.set(cx, y + h, cz, B.GILT);
  }

  /* ================= 歇山顶 ================= */
  /** 下部四坡，上部两坡并出山花博风板；正脊+4垂脊+4戗脊 = 9脊 */
  function roofGableHip(v, o) {
    var pal = palOf(o);
    var x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1, y = o.y;
    var W = x1 - x0 + 1, D = z1 - z0 + 1;
    var alongX = W >= D;
    var shortRun = Math.floor(((alongX ? D : W) - 1) / 2);
    if (shortRun < 2) shortRun = 2;
    var layers = clamp(o.layers !== undefined ? o.layers : ri(shortRun * (o.slope || 0.55)), 2, shortRun);
    var cum = profile(shortRun, layers, o.gamma);
    // 歇山下部四坡占比小些，山花博风才有足够高度显形
    var hipN = clamp(ri(layers * (o.hipFrac || 0.34)), 1, layers - 2);
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    var i, x, z, fa0, fa1;

    if (!o.noEaveEdge) eaveEdge(v, x0, z0, x1, z1, y, pal);

    // 冻结的"正脊长向"范围（山花所在位置）
    var frozen = cum[hipN];
    if (alongX) { fa0 = x0 + frozen; fa1 = x1 - frozen; }
    else { fa0 = z0 + frozen; fa1 = z1 - frozen; }

    for (i = 0; i < layers; i++) {
      var ins = cum[i], band = Math.max(1, cum[i + 1] - ins);
      var ax0, ax1, az0, az1;
      if (i < hipN) { ax0 = x0 + ins; ax1 = x1 - ins; az0 = z0 + ins; az1 = z1 - ins; }
      else if (alongX) { ax0 = fa0; ax1 = fa1; az0 = z0 + ins; az1 = z1 - ins; }
      else { ax0 = x0 + ins; ax1 = x1 - ins; az0 = fa0; az1 = fa1; }
      if (ax0 > ax1 || az0 > az1) { layers = i; break; }
      var yy = y + i;
      var rhx = alongX ? Math.max(0, (fa1 - fa0) / 2) : 0;
      for (x = ax0; x <= ax1; x++) {
        var xe = (x - ax0 < band) || (ax1 - x < band);
        for (z = az0; z <= az1; z++) {
          var ze = (z - az0 < band) || (az1 - z < band);
          var keep = (i < hipN) ? (xe || ze) : (alongX ? ze : xe);
          if (i >= hipN && (alongX ? xe : ze) && i === hipN) keep = keep || false;
          if (keep) v.set(x, yy, z, tileMat(x, z, cx, cz, rhx, pal));
        }
      }
      if (i < hipN) {                       // 戗脊（下部四角）
        hipRidgeStep(v, ax0, az0, +1, +1, band, yy + 1, pal.ridge);
        hipRidgeStep(v, ax1, az0, -1, +1, band, yy + 1, pal.ridge);
        hipRidgeStep(v, ax0, az1, +1, -1, band, yy + 1, pal.ridge);
        hipRidgeStep(v, ax1, az1, -1, -1, band, yy + 1, pal.ridge);
      } else {                              // 垂脊（沿山花上沿）+ 山花博风
        if (alongX) {
          for (z = az0; z <= az1; z++) {
            if (z - az0 < band || az1 - z < band) {
              v.set(fa0, yy + 1, z, pal.ridge); v.set(fa1, yy + 1, z, pal.ridge);
            }
          }
          gableRow(v, fa0 - 1, az0, az1, band, yy, 'x');
          gableRow(v, fa1 + 1, az0, az1, band, yy, 'x');
        } else {
          for (x = ax0; x <= ax1; x++) {
            if (x - ax0 < band || ax1 - x < band) {
              v.set(x, yy + 1, fa0, pal.ridge); v.set(x, yy + 1, fa1, pal.ridge);
            }
          }
          gableRow(v, fa0 - 1, ax0, ax1, band, yy, 'z');
          gableRow(v, fa1 + 1, ax0, ax1, band, yy, 'z');
        }
      }
    }

    if (!o.noEaveEdge) wingUpturn(v, x0, z0, x1, z1, y, pal);

    var ins3 = cum[layers];
    var tx0, tx1, tz0, tz1;
    if (alongX) { tx0 = fa0; tx1 = fa1; tz0 = z0 + ins3; tz1 = z1 - ins3; }
    else { tx0 = x0 + ins3; tx1 = x1 - ins3; tz0 = fa0; tz1 = fa1; }
    if (tz0 > tz1) { tz0 = tz1 = ri(cz); }
    if (tx0 > tx1) { tx0 = tx1 = ri(cx); }
    var top = y + layers;
    for (x = tx0; x <= tx1; x++) for (z = tz0; z <= tz1; z++) v.set(x, top, z, pal.tile);
    var rh = o.ridgeH !== undefined ? o.ridgeH : (Math.max(W, D) > 40 ? 3 : 2);
    for (x = tx0; x <= tx1; x++) for (z = tz0; z <= tz1; z++)
      for (var h = 1; h <= rh; h++) v.set(x, top + h, z, pal.ridge);
    if (alongX) {
      addWen(v, tx0 - 1, tz0, tz1, top, rh, -1, 'x', pal);
      addWen(v, tx1 + 1, tz0, tz1, top, rh, +1, 'x', pal);
    } else {
      addWen(v, tz0 - 1, tx0, tx1, top, rh, -1, 'z', pal);
      addWen(v, tz1 + 1, tx0, tx1, top, rh, +1, 'z', pal);
    }
    if (o.beasts) placeBeasts(v, x0, z0, x1, z1, y, cum, Math.max(1, hipN), o.beasts);
    return { top: top + rh, roofTop: top, layers: layers,
             rx0: tx0, rx1: tx1, rz0: tz0, rz1: tz1 };
  }

  /** 歇山两端的竖直三角面：坡面外缘为绿博风板，内部为朱红山花板（逐层调用一行） */
  function gableRow(v, pos, a0, a1, band, yy, axis) {
    for (var a = a0; a <= a1; a++) {
      var edge = (a - a0 < band) || (a1 - a < band);
      var m = edge ? B.BEAM_G : B.WALL_R_D;
      if (axis === 'x') v.set(pos, yy, a, m); else v.set(a, yy, pos, m);
    }
  }
  /** 十字脊四臂端头的整片山花（自 yBase 到 yTop 的竖直面） */
  function gableFace(v, pos, a0, a1, yBase, yTop, axis, pal) {
    for (var a = a0; a <= a1; a++) {
      for (var yy = yBase; yy < yTop; yy++) {
        if (axis === 'x') v.set(pos, yy, a, B.WALL_R_D); else v.set(a, yy, pos, B.WALL_R_D);
      }
      if (axis === 'x') v.set(pos, yTop, a, B.BEAM_G); else v.set(a, yTop, pos, B.BEAM_G);
    }
  }

  /* ================= 盝顶（钦安殿，紫禁城唯一） ================= */
  function roofLu(v, o) {
    var pal = palOf(o);
    var x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1, y = o.y;
    var run = Math.floor((Math.min(x1 - x0, z1 - z0) - 1) / 2);
    var layers = clamp(o.layers || 3, 1, Math.max(1, run - 2));
    var cum = profile(Math.max(2, ri(run * 0.6)), layers, 0.8);
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, i, x, z;
    if (!o.noEaveEdge) eaveEdge(v, x0, z0, x1, z1, y, pal);
    for (i = 0; i < layers; i++) {
      var ins = cum[i], band = Math.max(1, cum[i + 1] - ins);
      var ax0 = x0 + ins, ax1 = x1 - ins, az0 = z0 + ins, az1 = z1 - ins;
      var yy = y + i;
      for (x = ax0; x <= ax1; x++) {
        var xe = (x - ax0 < band) || (ax1 - x < band);
        for (z = az0; z <= az1; z++)
          if (xe || (z - az0 < band) || (az1 - z < band)) v.set(x, yy, z, tileMat(x, z, cx, cz, 0, pal));
      }
      hipRidgeStep(v, ax0, az0, +1, +1, band, yy + 1, pal.ridge);
      hipRidgeStep(v, ax1, az0, -1, +1, band, yy + 1, pal.ridge);
      hipRidgeStep(v, ax0, az1, +1, -1, band, yy + 1, pal.ridge);
      hipRidgeStep(v, ax1, az1, -1, -1, band, yy + 1, pal.ridge);
    }
    if (!o.noEaveEdge) wingUpturn(v, x0, z0, x1, z1, y, pal);
    // 平顶 + 四面围脊（盝顶特征）
    var ins2 = cum[layers], top = y + layers;
    var px0 = x0 + ins2, px1 = x1 - ins2, pz0 = z0 + ins2, pz1 = z1 - ins2;
    for (x = px0; x <= px1; x++) for (z = pz0; z <= pz1; z++) v.set(x, top, z, pal.tile);
    for (x = px0; x <= px1; x++) { v.set(x, top + 1, pz0, pal.ridge); v.set(x, top + 1, pz1, pal.ridge); }
    for (z = pz0; z <= pz1; z++) { v.set(px0, top + 1, z, pal.ridge); v.set(px1, top + 1, z, pal.ridge); }
    for (x = px0; x <= px1; x++) { v.set(x, top + 2, pz0, pal.ridge); v.set(x, top + 2, pz1, pal.ridge); }
    for (z = pz0; z <= pz1; z++) { v.set(px0, top + 2, z, pal.ridge); v.set(px1, top + 2, z, pal.ridge); }
    return { top: top + 2, roofTop: top };
  }

  /* ================= 悬山 / 硬山（两坡） ================= */
  /** axis:'x' 正脊沿 X；庑房朝房用 */
  function roofGable(v, o) {
    var pal = palOf(o);
    var x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1, y = o.y;
    var axis = o.axis || ((x1 - x0) >= (z1 - z0) ? 'x' : 'z');
    var run = Math.floor(((axis === 'x' ? (z1 - z0) : (x1 - x0))) / 2);
    if (run < 1) run = 1;
    var layers = clamp(o.layers !== undefined ? o.layers : ri(run * (o.slope || 0.7)), 1, run);
    var cum = profile(run, layers, o.gamma || 0.78);
    var i, x, z;
    if (!o.noEaveEdge) eaveEdge(v, x0, z0, x1, z1, y, pal);
    for (i = 0; i < layers; i++) {
      var ins = cum[i], band = Math.max(1, cum[i + 1] - ins), yy = y + i;
      if (axis === 'x') {
        var a0 = z0 + ins, a1 = z1 - ins;
        if (a0 > a1) { layers = i; break; }
        for (x = x0; x <= x1; x++) for (z = a0; z <= a1; z++)
          if ((z - a0 < band) || (a1 - z < band) || a1 - a0 < 2 * band)
            v.set(x, yy, z, ((x % 3) === 0 ? pal.tileL : ((x % 3) === 1 ? pal.tile : pal.tileD)));
        v.set(x0, yy + 1, a0, pal.ridge); v.set(x1, yy + 1, a0, pal.ridge);
        v.set(x0, yy + 1, a1, pal.ridge); v.set(x1, yy + 1, a1, pal.ridge);
        for (z = a0; z <= a1; z++) { v.set(x0, yy, z, pal.ridge); v.set(x1, yy, z, pal.ridge); }
      } else {
        var b0 = x0 + ins, b1 = x1 - ins;
        if (b0 > b1) { layers = i; break; }
        for (z = z0; z <= z1; z++) for (x = b0; x <= b1; x++)
          if ((x - b0 < band) || (b1 - x < band) || b1 - b0 < 2 * band)
            v.set(x, yy, z, ((z % 3) === 0 ? pal.tileL : ((z % 3) === 1 ? pal.tile : pal.tileD)));
        for (x = b0; x <= b1; x++) { v.set(x, yy, z0, pal.ridge); v.set(x, yy, z1, pal.ridge); }
      }
    }
    var ins2 = cum[layers], top = y + layers;
    if (axis === 'x') {
      var c0 = z0 + ins2, c1 = z1 - ins2;
      if (c0 > c1) c0 = c1 = ri((z0 + z1) / 2);
      for (x = x0; x <= x1; x++) for (z = c0; z <= c1; z++) v.set(x, top, z, pal.tile);
      for (x = x0; x <= x1; x++) for (z = c0; z <= c1; z++) v.set(x, top + 1, z, pal.ridge);
    } else {
      var d0 = x0 + ins2, d1 = x1 - ins2;
      if (d0 > d1) d0 = d1 = ri((x0 + x1) / 2);
      for (z = z0; z <= z1; z++) for (x = d0; x <= d1; x++) v.set(x, top, z, pal.tile);
      for (z = z0; z <= z1; z++) for (x = d0; x <= d1; x++) v.set(x, top + 1, z, pal.ridge);
    }
    return { top: top + 1, roofTop: top, layers: layers };
  }

  /* ================= 十字脊（角楼顶层） ================= */
  function roofCross(v, o) {
    var x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1, y = o.y;
    var cx = ri((x0 + x1) / 2), cz = ri((z0 + z1) / 2);
    var armHalf = o.armHalf !== undefined ? o.armHalf : Math.floor(Math.min(x1 - x0, z1 - z0) / 4);
    var a = roofGable(v, { x0: x0, x1: x1, z0: cz - armHalf, z1: cz + armHalf, y: y, axis: 'x',
                           tile: o.tile, slope: o.slope || 0.9 });
    var b = roofGable(v, { x0: cx - armHalf, x1: cx + armHalf, z0: z0, z1: z1, y: y, axis: 'z',
                           tile: o.tile, slope: o.slope || 0.9 });
    var pal = palOf(o);
    var top = Math.max(a.roofTop, b.roofTop);
    finial(v, cx, cz, top + 1, 2, 1);
    // 四个山花端面
    gableFace(v, cz - armHalf - 1, x0, x1, y, top, 'z', pal);
    gableFace(v, cz + armHalf + 1, x0, x1, y, top, 'z', pal);
    gableFace(v, cx - armHalf - 1, z0, z1, y, top, 'x', pal);
    gableFace(v, cx + armHalf + 1, z0, z1, y, top, 'x', pal);
    return { top: top + 5, roofTop: top };
  }

  /* ================= 腰檐 / 下檐（重檐用的一圈裙檐） ================= */
  /** 只做外侧 n 层，中间留空让上层殿身穿出；并加一圈围脊(博脊) */
  function eaveSkirt(v, o) {
    var pal = palOf(o);
    var x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1, y = o.y;
    var layers = o.layers || 3;
    var cum = profile(o.run || (layers + 2), layers, 0.75);
    var cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, i, x, z;
    eaveEdge(v, x0, z0, x1, z1, y, pal);
    for (i = 0; i < layers; i++) {
      var ins = cum[i], band = Math.max(1, cum[i + 1] - ins), yy = y + i;
      var ax0 = x0 + ins, ax1 = x1 - ins, az0 = z0 + ins, az1 = z1 - ins;
      if (ax0 > ax1 || az0 > az1) break;
      for (x = ax0; x <= ax1; x++) {
        var xe = (x - ax0 < band) || (ax1 - x < band);
        for (z = az0; z <= az1; z++)
          if (xe || (z - az0 < band) || (az1 - z < band)) v.set(x, yy, z, tileMat(x, z, cx, cz, 1e9, pal));
      }
      hipRidgeStep(v, ax0, az0, +1, +1, band, yy + 1, pal.ridge);
      hipRidgeStep(v, ax1, az0, -1, +1, band, yy + 1, pal.ridge);
      hipRidgeStep(v, ax0, az1, +1, -1, band, yy + 1, pal.ridge);
      hipRidgeStep(v, ax1, az1, -1, -1, band, yy + 1, pal.ridge);
    }
    wingUpturn(v, x0, z0, x1, z1, y, pal);
    // 围脊（博脊）：下檐与上层殿身的交接处。
    // 下檐屋面须向内延伸成平板直抵上层墙脚，否则上层殿身会悬在腰檐之上、
    // 只在檩角处与围脊共边，形成一道体素缺口。o.inner 给出上层殿身范围，
    // 其内部不必铺（不可见），但边界一圈必须铺到，以保证与墙脚面接触。
    var ins2 = cum[layers];
    var bx0 = x0 + ins2, bx1 = x1 - ins2, bz0 = z0 + ins2, bz1 = z1 - ins2;
    var ty = y + layers;
    var inn = o.inner;
    for (x = bx0; x <= bx1; x++)
      for (z = bz0; z <= bz1; z++) {
        if (inn && x > inn.x0 && x < inn.x1 && z > inn.z0 && z < inn.z1) continue;
        v.set(x, ty, z, pal.tile);
      }
    for (x = bx0; x <= bx1; x++) { v.set(x, ty, bz0, pal.ridge); v.set(x, ty, bz1, pal.ridge); }
    for (z = bz0; z <= bz1; z++) { v.set(bx0, ty, z, pal.ridge); v.set(bx1, ty, z, pal.ridge); }
    return { top: ty, x0: bx0, x1: bx1, z0: bz0, z1: bz1 };
  }

  /* ================= 台基 / 须弥座 ================= */
  /**
   * o:{x0,z0,x1,z1,y0,h, body, cap, xushi(是否束腰), chishou(螭首间距), overhang}
   * 返回台面标高 = y0 + h
   */
  function podium(v, o) {
    var x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1, y0 = o.y0 || 0, h = o.h;
    var body = o.body === undefined ? B.MARBLE : o.body;
    var dark = o.dark === undefined ? B.MARBLE_D : o.dark;
    var cap = o.cap === undefined ? B.MARBLE : o.cap;
    var i, x, z;
    for (i = 0; i < h; i++) {
      var ins = 0;
      if (o.xushi && h >= 3) ins = (i === 0 || i >= h - 1) ? 0 : 1;   // 束腰内收
      var ax0 = x0 + ins, ax1 = x1 - ins, az0 = z0 + ins, az1 = z1 - ins;
      var mat = (o.xushi && ins === 1) ? dark : body;
      // 只写外壳，内部不可见
      var band = 2;
      for (x = ax0; x <= ax1; x++) {
        var xe = (x - ax0 < band) || (ax1 - x < band);
        for (z = az0; z <= az1; z++)
          if (xe || (z - az0 < band) || (az1 - z < band)) v.set(x, y0 + i, z, mat);
      }
    }
    // 台面
    for (x = x0; x <= x1; x++) for (z = z0; z <= z1; z++) v.set(x, y0 + h, z, cap);
    // 螭首（排水口），雨天"千龙吐水"；自中心向两侧对称布点
    if (o.chishou) {
      var p = o.chishou;
      var mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, k;
      for (k = 0; mx - 3 - k * p >= x0 + 2; k++) {
        var xa = Math.round(mx - 3 - k * p), xb = Math.round(mx + 3 + k * p);
        v.set(xa, y0 + h - 1, z0 - 1, B.MARBLE_D); v.set(xa, y0 + h - 1, z1 + 1, B.MARBLE_D);
        v.set(xb, y0 + h - 1, z0 - 1, B.MARBLE_D); v.set(xb, y0 + h - 1, z1 + 1, B.MARBLE_D);
      }
      for (k = 0; mz - 3 - k * p >= z0 + 2; k++) {
        var za = Math.round(mz - 3 - k * p), zb = Math.round(mz + 3 + k * p);
        v.set(x0 - 1, y0 + h - 1, za, B.MARBLE_D); v.set(x1 + 1, y0 + h - 1, za, B.MARBLE_D);
        v.set(x0 - 1, y0 + h - 1, zb, B.MARBLE_D); v.set(x1 + 1, y0 + h - 1, zb, B.MARBLE_D);
      }
    }
    return y0 + h;
  }

  /* ================= 汉白玉栏杆（望柱 + 栏板） ================= */
  /** gaps: [{axis:'z'|'x', at:边(z0/z1/x0/x1), from, to}] 供踏跺开口 */
  function balustrade(v, o) {
    var x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1, y = o.y;
    var pitch = o.pitch || 3, postH = o.postH || 3, panelH = o.panelH || 2;
    var mat = o.mat === undefined ? B.RAIL : o.mat;
    var gaps = o.gaps || [];
    function blocked(x, z) {
      for (var i = 0; i < gaps.length; i++) {
        var g = gaps[i];
        if (g.side === 'zmin' && z === z0 && x >= g.from && x <= g.to) return true;
        if (g.side === 'zmax' && z === z1 && x >= g.from && x <= g.to) return true;
        if (g.side === 'xmin' && x === x0 && z >= g.from && z <= g.to) return true;
        if (g.side === 'xmax' && x === x1 && z >= g.from && z <= g.to) return true;
      }
      return false;
    }
    function put(x, z, isPost) {
      if (blocked(x, z)) return;
      var hh = isPost ? postH : panelH;
      for (var k = 0; k < hh; k++) v.set(x, y + 1 + k, z, mat);
      if (isPost) v.set(x, y + 1 + postH, z, B.MARBLE_D);   // 望柱头（云龙云凤）
    }
    var x, z;
    // 望柱位置以中心为基准计数，确保 x→-x 镜像严格成立
    var cxR = (x0 + x1) / 2, czR = (z0 + z1) / 2;
    for (x = x0; x <= x1; x++) {
      var p = (Math.round(Math.abs(x - cxR)) % pitch) === 0 || x === x0 || x === x1;
      put(x, z0, p); put(x, z1, p);
    }
    for (z = z0 + 1; z <= z1 - 1; z++) {
      var q = (Math.round(Math.abs(z - czR)) % pitch) === 0 || z === z0 + 1 || z === z1 - 1;
      put(x0, z, q); put(x1, z, q);
    }
    return this;
  }

  /* ================= 踏跺（台阶）+ 御路 ================= */
  /**
   * o:{x0,x1,z,dir(+1向北/-1向南),yTop,yBot,mat,way(御路宽,0=无)}
   * 沿 X 方向排布的一组台阶，向 dir 方向逐级降低
   */
  function stepsNS(v, o) {
    var x0 = o.x0, x1 = o.x1, z = o.z, dir = o.dir, yTop = o.yTop, yBot = o.yBot;
    var mat = o.mat === undefined ? B.MARBLE : o.mat;
    var way = o.way || 0;
    var cx = ri((x0 + x1) / 2);
    var n = yTop - yBot;
    var run = o.run || Math.max(1, Math.round(n * 1.6 / Math.max(1, n)) * 2);
    var perStep = Math.max(1, Math.round((o.depth || n * 2) / Math.max(1, n)));
    var d = 0, y;
    for (y = yTop; y > yBot; y--) {
      for (var t = 0; t < perStep; t++) {
        var zz = z + dir * (d + t);
        for (var x = x0; x <= x1; x++) {
          var isWay = way > 0 && Math.abs(x - cx) <= (way >> 1);
          v.set(x, y, zz, isWay ? B.PAVE_W : mat);
        }
        // 台阶侧帮
        v.set(x0 - 1, y, zz, B.MARBLE_D); v.set(x1 + 1, y, zz, B.MARBLE_D);
      }
      d += perStep;
    }
    return { depth: d };
  }
  function stepsEW(v, o) {
    var z0 = o.z0, z1 = o.z1, x = o.x, dir = o.dir, yTop = o.yTop, yBot = o.yBot;
    var mat = o.mat === undefined ? B.MARBLE : o.mat;
    var n = yTop - yBot;
    var perStep = Math.max(1, Math.round((o.depth || n * 2) / Math.max(1, n)));
    var d = 0, y;
    for (y = yTop; y > yBot; y--) {
      for (var t = 0; t < perStep; t++) {
        var xx = x + dir * (d + t);
        for (var z = z0; z <= z1; z++) v.set(xx, y, z, mat);
        v.set(xx, y, z0 - 1, B.MARBLE_D); v.set(xx, y, z1 + 1, B.MARBLE_D);
      }
      d += perStep;
    }
    return { depth: d };
  }

  /* ================= 殿身（檐柱 / 隔扇门 / 槛墙 / 额枋 / 斗拱） ================= */
  /**
   * o:{x0,z0,x1,z1, y, h, bays, front:'s'|'n'|'both'|'all',
   *    veranda(周围廊), wall, col, door, lattice, dougong:true, bandTop:true}
   */
  function facade(v, o) {
    var x0 = o.x0, x1 = o.x1, z0 = o.z0, z1 = o.z1, y = o.y, h = o.h;
    var wall = o.wall === undefined ? B.WALL_R : o.wall;
    var col = o.col === undefined ? B.COL_R : o.col;
    var door = o.door === undefined ? B.DOOR_R : o.door;
    var lat = o.lattice === undefined ? B.LATTICE : o.lattice;
    var bays = Math.max(1, o.bays || 5);
    var W = x1 - x0, D = z1 - z0;
    var openS = (o.front === 's' || o.front === 'both' || o.front === 'all');
    var openN = (o.front === 'n' || o.front === 'both' || o.front === 'all');
    var openEW = (o.front === 'all');
    var bandH = o.dougong === false ? 2 : 3;   // 额枋 2 + 斗拱 1
    // 保证墙身至少一层：否则 h <= bandH 时墙体循环空转，重檐上层会只剩枋、拱而没有墙
    var wallTop = Math.max(y + 1, y + h - bandH);   // 墙身/门窗顶
    var x, z, k, yy;

    // 柱位（按开间等分）
    var colX = [], colZ = [];
    for (k = 0; k <= bays; k++) colX.push(x0 + Math.round(k * W / bays));
    var dbays = Math.max(1, Math.round(bays * D / Math.max(1, W)));
    for (k = 0; k <= dbays; k++) colZ.push(z0 + Math.round(k * D / dbays));

    function fillFaceX(zc, open) {            // 南/北立面（沿 X）
      for (x = x0; x <= x1; x++) {
        var isCol = colX.indexOf(x) >= 0;
        for (yy = y; yy < wallTop; yy++) {
          if (isCol) { v.set(x, yy, zc, col); continue; }
          if (!open) { v.set(x, yy, zc, wall); continue; }
          var rel = yy - y, hh = wallTop - y;
          if (rel < Math.max(1, Math.round(hh * 0.22))) v.set(x, yy, zc, door);      // 裙板
          else if (rel > hh - 2) v.set(x, yy, zc, door);                              // 走马板
          else v.set(x, yy, zc, ((x + yy) % 2 === 0) ? lat : door);                   // 菱花心
        }
      }
    }
    function fillFaceZ(xc, open) {            // 东/西立面（沿 Z）
      for (z = z0; z <= z1; z++) {
        var isCol = colZ.indexOf(z) >= 0;
        for (yy = y; yy < wallTop; yy++) {
          if (isCol) { v.set(xc, yy, z, col); continue; }
          if (!open) { v.set(xc, yy, z, wall); continue; }
          var rel = yy - y, hh = wallTop - y;
          if (rel < Math.max(1, Math.round(hh * 0.22))) v.set(xc, yy, z, door);
          else if (rel > hh - 2) v.set(xc, yy, z, door);
          else v.set(xc, yy, z, ((z + yy) % 2 === 0) ? lat : door);
        }
      }
    }

    if (o.veranda) {
      // 周围廊：外圈只立檐柱，墙身内退一格
      for (k = 0; k < colX.length; k++) {
        v.column(colX[k], z0, y, wallTop - 1, col);
        v.column(colX[k], z1, y, wallTop - 1, col);
      }
      for (k = 0; k < colZ.length; k++) {
        v.column(x0, colZ[k], y, wallTop - 1, col);
        v.column(x1, colZ[k], y, wallTop - 1, col);
      }
      var i0 = 1;
      fillFaceX(z0 + i0, openS); fillFaceX(z1 - i0, openN);
      fillFaceZ(x0 + i0, openEW); fillFaceZ(x1 - i0, openEW);
      // 廊内地面
      for (x = x0; x <= x1; x++) for (z = z0; z <= z1; z++)
        if (x === x0 || x === x1 || z === z0 || z === z1) v.set(x, y - 1, z, B.STONE);
    } else {
      fillFaceX(z0, openS); fillFaceX(z1, openN);
      fillFaceZ(x0, openEW); fillFaceZ(x1, openEW);
    }

    // 额枋（青绿彩画）+ 斗拱，向外挑出一格
    var b0 = wallTop;
    for (x = x0 - 1; x <= x1 + 1; x++) {
      v.set(x, b0, z0 - 1, B.BEAM_G); v.set(x, b0 + 1, z0 - 1, B.BEAM_B);
      v.set(x, b0, z1 + 1, B.BEAM_G); v.set(x, b0 + 1, z1 + 1, B.BEAM_B);
      v.set(x, b0, z0, B.BEAM_G); v.set(x, b0 + 1, z0, B.BEAM_B);
      v.set(x, b0, z1, B.BEAM_G); v.set(x, b0 + 1, z1, B.BEAM_B);
    }
    for (z = z0 - 1; z <= z1 + 1; z++) {
      v.set(x0 - 1, b0, z, B.BEAM_G); v.set(x0 - 1, b0 + 1, z, B.BEAM_B);
      v.set(x1 + 1, b0, z, B.BEAM_G); v.set(x1 + 1, b0 + 1, z, B.BEAM_B);
      v.set(x0, b0, z, B.BEAM_G); v.set(x0, b0 + 1, z, B.BEAM_B);
      v.set(x1, b0, z, B.BEAM_G); v.set(x1, b0 + 1, z, B.BEAM_B);
    }
    if (o.dougong !== false) {
      var dy = b0 + 2;
      for (x = x0 - 1; x <= x1 + 1; x++) {
        var m = ((x % 2) === 0) ? B.DOUGONG : B.BEAM_B;
        v.set(x, dy, z0 - 1, m); v.set(x, dy, z1 + 1, m);
        v.set(x, dy, z0, m); v.set(x, dy, z1, m);
      }
      for (z = z0 - 1; z <= z1 + 1; z++) {
        var m2 = ((z % 2) === 0) ? B.DOUGONG : B.BEAM_B;
        v.set(x0 - 1, dy, z, m2); v.set(x1 + 1, dy, z, m2);
        v.set(x0, dy, z, m2); v.set(x1, dy, z, m2);
      }
    }
    return { wallTop: wallTop, top: y + h };
  }

  /* ================= 宫墙（红墙 + 黄琉璃瓦压顶） ================= */
  /** 脊压在正中列上；厚度为偶数时压两列，保证东西镜像严格对称 */
  function palaceWallX(v, x0, x1, z, y0, h, thick, tile) {
    thick = thick || 2;
    var t = tile === undefined ? B.TILE_Y : tile;
    var pal = palOf({ tile: t });
    var m0 = z + Math.floor((thick - 1) / 2), m1 = z + Math.ceil((thick - 1) / 2);
    for (var x = x0; x <= x1; x++) {
      for (var d = 0; d < thick; d++)
        for (var y = y0; y < y0 + h; y++)
          v.set(x, y, z + d, (d === 0 || d === thick - 1) ? B.WALL_R : B.WALL_R_D);
      // 瓦顶：两坡小屋面
      for (var d2 = 0; d2 < thick; d2++) v.set(x, y0 + h, z + d2, ((x % 3) === 0 ? pal.tileL : pal.tile));
      for (var mm = m0; mm <= m1; mm++) v.set(x, y0 + h + 1, mm, pal.ridge);
    }
  }
  function palaceWallZ(v, z0, z1, x, y0, h, thick, tile) {
    thick = thick || 2;
    var t = tile === undefined ? B.TILE_Y : tile;
    var pal = palOf({ tile: t });
    var m0 = x + Math.floor((thick - 1) / 2), m1 = x + Math.ceil((thick - 1) / 2);
    for (var z = z0; z <= z1; z++) {
      for (var d = 0; d < thick; d++)
        for (var y = y0; y < y0 + h; y++)
          v.set(x + d, y, z, (d === 0 || d === thick - 1) ? B.WALL_R : B.WALL_R_D);
      for (var d2 = 0; d2 < thick; d2++) v.set(x + d2, y0 + h, z, ((z % 3) === 0 ? pal.tileL : pal.tile));
      for (var mm = m0; mm <= m1; mm++) v.set(mm, y0 + h + 1, z, pal.ridge);
    }
  }

  /* ================= 陈设小品 ================= */
  function lion(v, x, z, y, mat) {                 // 铜狮/石狮（含须弥座）
    mat = mat === undefined ? B.LION : mat;
    v.solid(x - 1, y, z - 1, x + 1, y + 1, z + 1, B.MARBLE_D);
    v.solid(x, y + 2, z, x, y + 4, z, mat);
    v.set(x, y + 5, z, mat);
    v.set(x + 1, y + 3, z, mat); v.set(x - 1, y + 3, z, mat);
  }
  function censer(v, x, z, y) {                    // 鼎式铜香炉
    v.solid(x - 1, y, z - 1, x + 1, y + 1, z + 1, B.BRONZE);
    v.solid(x - 1, y + 2, z - 1, x + 1, y + 2, z + 1, B.BRONZE);
    v.set(x, y + 3, z, B.GILT);
  }
  function craneTurtle(v, x, z, y, tall) {         // 铜龟 / 铜鹤
    v.solid(x - 1, y, z - 1, x + 1, y, z + 1, B.MARBLE_D);
    v.solid(x, y + 1, z, x, y + (tall ? 4 : 2), z, B.BRONZE);
    if (tall) v.set(x, y + 5, z, B.BRONZE);
    else { v.set(x + 1, y + 1, z, B.BRONZE); v.set(x - 1, y + 1, z, B.BRONZE); }
  }
  function sundial(v, x, z, y) {                   // 日晷 / 嘉量
    v.solid(x - 1, y, z - 1, x + 1, y + 2, z + 1, B.MARBLE);
    v.plate(x - 2, z - 2, x + 2, z + 2, y + 3, B.MARBLE_D);
    v.set(x, y + 4, z, B.STONE);
  }
  function vat(v, x, z, y) {                       // 太平缸（消防铜缸）
    v.solid(x - 1, y, z - 1, x + 1, y + 1, z + 1, B.BRONZE);
    v.plate(x - 1, z - 1, x + 1, z + 1, y + 2, B.BRONZE);
  }

  function tree(v, x, z, y, h, seed, kind) {       // 松柏（御花园、慈宁宫花园）
    var r = rnd(seed | 0);
    h = h || (6 + Math.floor(r() * 5));
    var trunkH = Math.max(2, Math.round(h * 0.4));
    for (var i = 0; i < trunkH; i++) v.set(x, y + i, z, B.TRUNK);
    var rad = kind === 'cypress' ? 2 : 3;
    for (var yy = trunkH; yy <= h; yy++) {
      var t = (yy - trunkH) / Math.max(1, h - trunkH);
      var rr = Math.max(1, Math.round(rad * (1 - t * (kind === 'cypress' ? 0.85 : 0.6))));
      for (var dx = -rr; dx <= rr; dx++) for (var dz = -rr; dz <= rr; dz++) {
        if (dx * dx + dz * dz > rr * rr + 1) continue;
        if (r() < 0.14) continue;
        var m = r() < 0.34 ? B.LEAF_D : (r() < 0.6 ? B.LEAF : B.LEAF_L);
        v.set(x + dx, y + yy, z + dz, m);
      }
    }
  }

  function rockery(v, cx, cz, y, rx, rz, h, seed) { // 太湖石叠山（堆秀山）
    var r = rnd(seed | 0);
    for (var i = 0; i < h; i++) {
      var t = i / h;
      var ax = Math.max(1, Math.round(rx * (1 - t * 0.75)));
      var az = Math.max(1, Math.round(rz * (1 - t * 0.75)));
      for (var dx = -ax; dx <= ax; dx++) for (var dz = -az; dz <= az; dz++) {
        var d = (dx * dx) / (ax * ax) + (dz * dz) / (az * az);
        if (d > 1.05) continue;
        if (r() < 0.18 && d > 0.35) continue;
        v.set(cx + dx, y + i, cz + dz, B.ROCK);
      }
    }
  }

  G.Arch = {
    rnd: rnd, clamp: clamp, profile: profile, palOf: palOf,
    roofHip: roofHip, roofPyramid: roofPyramid, roofGableHip: roofGableHip,
    roofLu: roofLu, roofGable: roofGable, roofCross: roofCross, eaveSkirt: eaveSkirt,
    podium: podium, balustrade: balustrade, stepsNS: stepsNS, stepsEW: stepsEW,
    facade: facade, palaceWallX: palaceWallX, palaceWallZ: palaceWallZ,
    finial: finial, lion: lion, censer: censer, craneTurtle: craneTurtle,
    sundial: sundial, vat: vat, tree: tree, rockery: rockery
  };
})(typeof window !== 'undefined' ? window : globalThis);
