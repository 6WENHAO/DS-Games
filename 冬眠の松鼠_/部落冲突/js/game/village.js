/* ============ 村庄网格 & 放置逻辑 ============ */
COC.Village = (function () {
  'use strict';
  var U = COC.U, CFG = COC.CFG;

  /* 占用网格：0=空 1=建筑 2=障碍 */
  var grid = null;

  function rebuild() {
    var S = COC.State.get();
    var N = CFG.MAP;
    grid = new Uint8Array(N * N);
    var i;
    for (i = 0; i < S.buildings.length; i++) stamp(S.buildings[i], 1);
    for (i = 0; i < S.obstacles.length; i++) stampObstacle(S.obstacles[i], 2);
  }

  function stamp(b, v) {
    var size = COC.BuildingDefs.get(b.type).size;
    fill(b.x, b.y, size, v);
  }
  function stampObstacle(o, v) {
    var size = COC.BuildingDefs.OBSTACLES[o.kind].size;
    fill(o.x, o.y, size, v);
  }
  function fill(x, y, size, v) {
    var N = CFG.MAP;
    for (var dy = 0; dy < size; dy++) for (var dx = 0; dx < size; dx++) {
      var gx = x + dx, gy = y + dy;
      if (gx >= 0 && gy >= 0 && gx < N && gy < N) grid[gy * N + gx] = v;
    }
  }

  function inBuildArea(x, y, size) {
    var B = CFG.BORDER;
    return x >= B && y >= B && x + size <= CFG.MAP - B && y + size <= CFG.MAP - B;
  }

  function canPlace(x, y, size, ignoreId) {
    if (!inBuildArea(x, y, size)) return false;
    var S = COC.State.get(), N = CFG.MAP;
    /* 用实时对象判断（支持忽略正在移动的建筑自身） */
    for (var dy = 0; dy < size; dy++) for (var dx = 0; dx < size; dx++) {
      var gx = x + dx, gy = y + dy;
      if (occupiedBy(gx, gy, ignoreId)) return false;
    }
    return true;
  }

  function occupiedBy(gx, gy, ignoreId) {
    var S = COC.State.get(), i;
    for (i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      if (ignoreId && b.id === ignoreId) continue;
      var size = COC.BuildingDefs.get(b.type).size;
      if (gx >= b.x && gx < b.x + size && gy >= b.y && gy < b.y + size) return b;
    }
    for (i = 0; i < S.obstacles.length; i++) {
      var o = S.obstacles[i];
      var os = COC.BuildingDefs.OBSTACLES[o.kind].size;
      if (gx >= o.x && gx < o.x + os && gy >= o.y && gy < o.y + os) return o;
    }
    return null;
  }

  function buildingAt(gx, gy) {
    var S = COC.State.get();
    for (var i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      var size = COC.BuildingDefs.get(b.type).size;
      if (gx >= b.x && gx < b.x + size && gy >= b.y && gy < b.y + size) return b;
    }
    return null;
  }

  function obstacleAt(gx, gy) {
    var S = COC.State.get();
    for (var i = 0; i < S.obstacles.length; i++) {
      var o = S.obstacles[i];
      var os = COC.BuildingDefs.OBSTACLES[o.kind].size;
      if (gx >= o.x && gx < o.x + os && gy >= o.y && gy < o.y + os) return o;
    }
    return null;
  }

  /* 随机找一个可放置的位置 */
  function findFreeSpot(size, tries) {
    var B = CFG.BORDER;
    tries = tries || 400;
    for (var i = 0; i < tries; i++) {
      var x = U.randInt(B, CFG.MAP - B - size);
      var y = U.randInt(B, CFG.MAP - B - size);
      if (canPlace(x, y, size)) return { x: x, y: y };
    }
    return null;
  }

  /* 生成障碍物（树木岩石等） */
  function spawnObstacles(n) {
    var S = COC.State.get();
    var kinds = Object.keys(COC.BuildingDefs.OBSTACLES);
    for (var i = 0; i < n; i++) {
      var kind = U.pick(kinds);
      if (kind === 'goldnugget' && Math.random() < 0.7) kind = U.pick(['tree1', 'tree2', 'tree3', 'rock2', 'bush1']);
      var size = COC.BuildingDefs.OBSTACLES[kind].size;
      var spot = findFreeSpot(size, 200);
      if (spot) {
        S.obstacles.push({ id: S.nextId++, kind: kind, x: spot.x, y: spot.y, clearing: null });
      }
    }
    rebuild();
  }

  /* 偶尔长出新障碍 */
  function maybeGrowObstacle() {
    var S = COC.State.get();
    if (S.obstacles.length < 24 && Math.random() < 0.5) {
      spawnObstacles(1);
      return true;
    }
    return false;
  }

  return {
    rebuild: rebuild, canPlace: canPlace, inBuildArea: inBuildArea,
    buildingAt: buildingAt, obstacleAt: obstacleAt, occupiedBy: occupiedBy,
    findFreeSpot: findFreeSpot, spawnObstacles: spawnObstacles, maybeGrowObstacle: maybeGrowObstacle,
    grid: function () { return grid; }
  };
})();
