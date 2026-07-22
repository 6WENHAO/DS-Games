/* ============ A* 寻路（支持穿墙代价） ============ */
COC.Pathfind = (function () {
  'use strict';
  var CFG = COC.CFG;

  /*
   * grid: Int16Array N*N, 值含义:
   *   0   可走
   *  -1   不可走（建筑）
   *  >0   墙（值 = 穿墙额外代价）
   * 返回 {path: [{x,y}...], walls: [wallCellIdx...]} 或 null
   */
  function find(grid, N, sx, sy, goals, maxIter) {
    if (sx < 0 || sy < 0 || sx >= N || sy >= N) return null;
    maxIter = maxIter || 20000;

    var goalSet = {};
    var minGx = Infinity, minGy = Infinity, maxGx = -Infinity, maxGy = -Infinity;
    for (var g = 0; g < goals.length; g++) {
      var gi = goals[g].y * N + goals[g].x;
      goalSet[gi] = true;
      if (goals[g].x < minGx) minGx = goals[g].x;
      if (goals[g].x > maxGx) maxGx = goals[g].x;
      if (goals[g].y < minGy) minGy = goals[g].y;
      if (goals[g].y > maxGy) maxGy = goals[g].y;
    }
    function h(x, y) {
      var dx = x < minGx ? minGx - x : (x > maxGx ? x - maxGx : 0);
      var dy = y < minGy ? minGy - y : (y > maxGy ? y - maxGy : 0);
      return (dx + dy) * 1.001;
    }

    var open = new Heap();
    var gScore = {}, from = {}, closed = {};
    var startIdx = sy * N + sx;
    gScore[startIdx] = 0;
    open.push(startIdx, h(sx, sy));

    var DIRS = [1, 0, -1, 0, 0, 1, 0, -1, 1, 1, 1, -1, -1, 1, -1, -1];
    var iter = 0;

    while (open.size() > 0 && iter++ < maxIter) {
      var cur = open.pop();
      if (closed[cur]) continue;
      closed[cur] = true;
      if (goalSet[cur]) return reconstruct(from, cur, N, grid);

      var cx = cur % N, cy = (cur / N) | 0;
      var gc = gScore[cur];

      for (var d = 0; d < 8; d++) {
        var dx = DIRS[d * 2], dy = DIRS[d * 2 + 1];
        var nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        var ni = ny * N + nx;
        if (closed[ni]) continue;
        var cell = grid[ni];
        if (cell === -1) continue;
        /* 斜向不允许穿角 */
        var diag = dx !== 0 && dy !== 0;
        if (diag) {
          var c1 = grid[cy * N + nx], c2 = grid[ny * N + cx];
          if (c1 === -1 || c2 === -1 || c1 > 0 || c2 > 0) continue;
        }
        var step = diag ? 1.4142 : 1;
        var cost = gc + step + (cell > 0 ? cell : 0);
        if (gScore[ni] === undefined || cost < gScore[ni]) {
          gScore[ni] = cost;
          from[ni] = cur;
          open.push(ni, cost + h(nx, ny));
        }
      }
    }
    return null;
  }

  function reconstruct(from, cur, N, grid) {
    var path = [], walls = [];
    while (cur !== undefined) {
      var x = cur % N, y = (cur / N) | 0;
      path.push({ x: x, y: y });
      if (grid[cur] > 0) walls.push(cur);
      cur = from[cur];
    }
    path.reverse();
    walls.reverse();
    return { path: path, walls: walls };
  }

  /* 二叉堆 */
  function Heap() { this.a = []; }
  Heap.prototype.size = function () { return this.a.length; };
  Heap.prototype.push = function (v, p) {
    var a = this.a;
    a.push({ v: v, p: p });
    var i = a.length - 1;
    while (i > 0) {
      var par = (i - 1) >> 1;
      if (a[par].p <= a[i].p) break;
      var t = a[par]; a[par] = a[i]; a[i] = t;
      i = par;
    }
  };
  Heap.prototype.pop = function () {
    var a = this.a;
    var top = a[0].v;
    var last = a.pop();
    if (a.length) {
      a[0] = last;
      var i = 0, n = a.length;
      while (true) {
        var l = i * 2 + 1, r = l + 1, m = i;
        if (l < n && a[l].p < a[m].p) m = l;
        if (r < n && a[r].p < a[m].p) m = r;
        if (m === i) break;
        var t = a[m]; a[m] = a[i]; a[i] = t;
        i = m;
      }
    }
    return top;
  };

  return { find: find };
})();
