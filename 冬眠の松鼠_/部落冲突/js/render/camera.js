/* ============ 相机（等距投影 & 缩放平移） ============ */
COC.Camera = (function () {
  'use strict';
  var U = COC.U, CFG = COC.CFG;

  var z = 1, ox = 0, oy = 0;
  var vw = 800, vh = 600;
  var HW = CFG.TILE_W / 2, HH = CFG.TILE_H / 2;

  function resize(w, h) { vw = w; vh = h; clampCam(); }

  /* 网格(浮点) -> 等距世界像素 */
  function isoX(gx, gy) { return (gx - gy) * HW; }
  function isoY(gx, gy) { return (gx + gy) * HH; }

  /* 网格 -> 屏幕 */
  function toScreen(gx, gy) {
    return { x: isoX(gx, gy) * z + ox, y: isoY(gx, gy) * z + oy };
  }

  /* 屏幕 -> 网格(浮点) */
  function toGrid(sx, sy) {
    var ix = (sx - ox) / z, iy = (sy - oy) / z;
    return {
      x: (ix / HW + iy / HH) / 2,
      y: (iy / HH - ix / HW) / 2
    };
  }

  function pan(dx, dy) { ox += dx; oy += dy; clampCam(); }

  function zoomAt(sx, sy, factor) {
    var before = toGrid(sx, sy);
    z = U.clamp(z * factor, CFG.ZOOM_MIN, CFG.ZOOM_MAX);
    var after = toScreen(before.x, before.y);
    ox += sx - after.x;
    oy += sy - after.y;
    clampCam();
  }

  function centerOn(gx, gy) {
    var ixp = isoX(gx, gy) * z, iyp = isoY(gx, gy) * z;
    ox = vw / 2 - ixp;
    oy = vh / 2 - iyp;
    clampCam();
  }

  function clampCam() {
    var N = CFG.MAP;
    /* 地图等距包围盒 */
    var left = isoX(0, N) * z + ox, right = isoX(N, 0) * z + ox;
    var top = isoY(0, 0) * z + oy, bottom = isoY(N, N) * z + oy;
    var mW = right - left, mH = bottom - top;
    var marginX = vw * 0.35, marginY = vh * 0.35;
    if (mW < vw - marginX * 2) {
      ox += (vw / 2 - (left + right) / 2);
    } else {
      if (left > vw - marginX) ox -= left - (vw - marginX);
      if (right < marginX) ox += marginX - right;
    }
    if (mH < vh - marginY * 2) {
      oy += (vh / 2 - (top + bottom) / 2);
    } else {
      if (top > vh - marginY) oy -= top - (vh - marginY);
      if (bottom < marginY) oy += marginY - bottom;
    }
  }

  return {
    resize: resize, pan: pan, zoomAt: zoomAt, centerOn: centerOn,
    toScreen: toScreen, toGrid: toGrid, isoX: isoX, isoY: isoY,
    zoom: function () { return z; },
    offset: function () { return { x: ox, y: oy }; }
  };
})();
