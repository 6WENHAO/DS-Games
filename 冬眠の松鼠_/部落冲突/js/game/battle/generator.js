/* ============ 敌方村庄生成器 ============ */
COC.Generator = (function () {
  'use strict';
  var U = COC.U, CFG = COC.CFG;

  /* 生成敌人村庄：返回 {th, buildings:[{type,lv,x,y}], name} */
  function generate(playerTh) {
    var th = U.clamp(playerTh + U.pick([0, 0, 0, 1, -1]), 1, 5);
    var N = CFG.MAP;
    var occ = new Uint8Array(N * N);
    var buildings = [];
    var cx = 20, cy = 19;

    function mark(x, y, size) {
      for (var dy = -1; dy <= size; dy++) for (var dx = -1; dx <= size; dx++) {
        var gx = x + dx, gy = y + dy;
        if (gx >= 0 && gy >= 0 && gx < N && gy < N) occ[gy * N + gx] = 1;
      }
    }
    function free(x, y, size) {
      if (x < CFG.BORDER + 1 || y < CFG.BORDER + 1 || x + size > N - CFG.BORDER - 1 || y + size > N - CFG.BORDER - 1) return false;
      for (var dy = 0; dy < size; dy++) for (var dx = 0; dx < size; dx++) {
        if (occ[(y + dy) * N + (x + dx)]) return false;
      }
      return true;
    }
    function put(type, x, y, lv) {
      var size = COC.BuildingDefs.get(type).size;
      buildings.push({ type: type, lv: lv, x: x, y: y });
      mark(x, y, size);
    }
    function lvFor(type) {
      var maxLv = COC.BuildingDefs.maxLevel(type);
      var lv = U.clamp(th + U.pick([0, 0, -1]), 1, maxLv);
      /* 保证 thReq 合法 */
      while (lv > 1 && COC.BuildingDefs.lvl(type, lv).thReq > th) lv--;
      return lv;
    }
    /* 在 (px,py) 附近螺旋找空位 */
    function putNear(type, px, py, lv) {
      var size = COC.BuildingDefs.get(type).size;
      for (var r = 0; r < 16; r++) {
        for (var t = 0; t < 14; t++) {
          var x = px + U.randInt(-r, r), y = py + U.randInt(-r, r);
          if (free(x, y, size)) { put(type, x, y, lv); return true; }
        }
      }
      return false;
    }

    /* ---- 大本营居中 ---- */
    put('townhall', cx - 2, cy - 2, th);

    /* ---- 核心圈建筑（墙内）---- */
    var inner = [];
    function addInner(type, n) { for (var i = 0; i < n; i++) inner.push(type); }
    addInner('goldstorage', Math.min(COC.BuildingDefs.maxCount('goldstorage', th), 2));
    addInner('elixirstorage', Math.min(COC.BuildingDefs.maxCount('elixirstorage', th), 2));
    if (th >= 3) addInner('mortar', COC.BuildingDefs.maxCount('mortar', th));
    if (th >= 4) addInner('wizardtower', Math.min(1, COC.BuildingDefs.maxCount('wizardtower', th)));
    if (th >= 5) addInner('xbow', 1);

    var innerSpots = [
      [cx - 6, cy - 2], [cx + 3, cy - 2], [cx - 2, cy - 6], [cx - 2, cy + 3],
      [cx - 6, cy - 6], [cx + 3, cy - 6], [cx - 6, cy + 3], [cx + 3, cy + 3]
    ];
    var si = 0;
    for (var ii = 0; ii < inner.length; ii++) {
      var spot = innerSpots[si++ % innerSpots.length];
      putNear(inner[ii], spot[0], spot[1], lvFor(inner[ii]));
    }

    /* ---- 城墙圈 ---- */
    if (th >= 2) {
      var wallLv = U.clamp(th - U.pick([0, 0, 1]), 1, 5);
      var x0 = cx - 8, y0 = cy - 8, x1 = cx + 9, y1 = cy + 9;
      /* 收缩到实际内容边界 */
      var minX = N, minY = N, maxX = 0, maxY = 0;
      for (var b = 0; b < buildings.length; b++) {
        var bb = buildings[b], bs = COC.BuildingDefs.get(bb.type).size;
        minX = Math.min(minX, bb.x); minY = Math.min(minY, bb.y);
        maxX = Math.max(maxX, bb.x + bs); maxY = Math.max(maxY, bb.y + bs);
      }
      x0 = Math.max(CFG.BORDER, minX - 2); y0 = Math.max(CFG.BORDER, minY - 2);
      x1 = Math.min(N - CFG.BORDER - 1, maxX + 1); y1 = Math.min(N - CFG.BORDER - 1, maxY + 1);
      var wallBudget = COC.BuildingDefs.maxCount('wall', th);
      var cells = [];
      for (var wx = x0; wx <= x1; wx++) { cells.push([wx, y0]); cells.push([wx, y1]); }
      for (var wy = y0 + 1; wy < y1; wy++) { cells.push([x0, wy]); cells.push([x1, wy]); }
      for (var c = 0; c < cells.length && wallBudget > 0; c++) {
        var wcx = cells[c][0], wcy = cells[c][1];
        if (occ[wcy * N + wcx]) continue;
        buildings.push({ type: 'wall', lv: wallLv, x: wcx, y: wcy });
        occ[wcy * N + wcx] = 1;
        wallBudget--;
      }
    }

    /* ---- 外圈：防御 ---- */
    var outerDef = [];
    function addOuter(type, n) { for (var i = 0; i < n; i++) outerDef.push(type); }
    addOuter('cannon', COC.BuildingDefs.maxCount('cannon', th));
    addOuter('archertower', COC.BuildingDefs.maxCount('archertower', th));
    var defSpots = [
      [cx - 12, cy], [cx + 10, cy], [cx, cy - 12], [cx, cy + 10],
      [cx - 12, cy - 10], [cx + 10, cy - 10], [cx - 12, cy + 8], [cx + 10, cy + 8]
    ];
    U.shuffle(defSpots);
    for (var od = 0; od < outerDef.length; od++) {
      var ds = defSpots[od % defSpots.length];
      putNear(outerDef[od], ds[0], ds[1], lvFor(outerDef[od]));
    }

    /* ---- 更外圈：经济&军事 ---- */
    var outer = [];
    addO('goldmine', COC.BuildingDefs.maxCount('goldmine', th));
    addO('elixirpump', COC.BuildingDefs.maxCount('elixirpump', th));
    addO('barracks', COC.BuildingDefs.maxCount('barracks', th));
    addO('armycamp', COC.BuildingDefs.maxCount('armycamp', th));
    if (th >= 2) addO('laboratory', 1);
    if (th >= 3) addO('clancastle', 1);
    addO('builderhut', 2);
    function addO(type, n) { for (var i = 0; i < n; i++) outer.push(type); }
    for (var oo = 0; oo < outer.length; oo++) {
      var ang = Math.random() * Math.PI * 2;
      var rad = U.randF(12, 16);
      putNear(outer[oo],
        Math.round(cx + Math.cos(ang) * rad),
        Math.round(cy + Math.sin(ang) * rad * 0.8),
        lvFor(outer[oo]));
    }

    var names = ['骷髅要塞', '黑水营地', '风暴之角', '铁斧村', '幽暗谷', '猛犸部落', '灰烬堡', '狂狼寨', '巨石镇', '雷鸣岭'];
    return { th: th, buildings: buildings, name: U.pick(names) };
  }

  return { generate: generate };
})();
