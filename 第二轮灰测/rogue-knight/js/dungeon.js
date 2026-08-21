/* dungeon.js — 程序化地牢：房间 / 走廊 / 门锁 / 预渲染地图 / 小地图 */
(function (K) {
  'use strict';
  var M = K.M, TS = K.TS;
  var THEMES = [
    { name: '石砌地牢', floor: '#3a3f52', floor2: '#33384a', wall: '#5a6178', wallTop: '#6e7690', grout: '#2b2f3e', accent: '#ffb45c', fog: 'rgba(20,24,40,.45)' },
    { name: '潮湿洞窟', floor: '#453a32', floor2: '#3c332c', wall: '#6a5648', wallTop: '#7d6858', grout: '#2f2822', accent: '#8ad06a', fog: 'rgba(30,26,20,.45)' },
    { name: '寒霜冰窟', floor: '#33465c', floor2: '#2d3e52', wall: '#4f6b86', wallTop: '#63819e', grout: '#25344a', accent: '#9adfff', fog: 'rgba(20,34,54,.45)' },
    { name: '熔岩深渊', floor: '#4a2f2f', floor2: '#3f2828', wall: '#6d4038', wallTop: '#834c42', grout: '#301f1e', accent: '#ff7a2a', fog: 'rgba(44,18,14,.45)' },
    { name: '机械核心', floor: '#33344a', floor2: '#2c2d40', wall: '#4a4c6a', wallTop: '#5c5f80', grout: '#232434', accent: '#c06aff', fog: 'rgba(24,22,44,.45)' }
  ];
  var D = { w: 0, h: 0, tiles: null, blocked: null, rooms: [], doors: [], theme: THEMES[0], canvas: null, cctx: null, props: [] };

  function idx(tx, ty) { return ty * D.w + tx; }
  function inb(tx, ty) { return tx >= 0 && ty >= 0 && tx < D.w && ty < D.h; }
  function solid(tx, ty) {
    if (!inb(tx, ty)) return true;
    var i = idx(tx, ty);
    return D.tiles[i] !== 1 || D.blocked[i] === 1;
  }
  function isFloor(tx, ty) { return inb(tx, ty) && D.tiles[idx(tx, ty)] === 1; }
  function carveRect(x0, y0, x1, y1) {
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) if (inb(x, y)) D.tiles[idx(x, y)] = 1;
  }
  function corridor(ax, ay, bx, by, wide) {
    var w = wide || 1;
    /* L 型：先水平后垂直，宽度 2w+1 */
    carveRect(Math.min(ax, bx), ay - w, Math.max(ax, bx), ay + w);
    carveRect(bx - w, Math.min(ay, by), bx + w, Math.max(ay, by));
  }

  /* ---------------- 生成 ---------------- */
  function gen(floor, R) {
    var SC = 5, SR = 4, CW = 15, CH = 12;
    D.w = SC * CW; D.h = SR * CH;
    D.tiles = new Uint8Array(D.w * D.h);
    D.blocked = new Uint8Array(D.w * D.h);
    D.rooms = []; D.doors = []; D.props = [];
    D.theme = THEMES[(floor - 1) % THEMES.length];
    /* 1. 随机路径选格子 */
    var used = {}, path = [], sx = 0, sy = R.int(0, SR - 1), guard = 0;
    used[sx + ',' + sy] = 1; path.push([sx, sy]);
    while (sx < SC - 1 && guard++ < 60) {
      var dirs = [];
      if (sx + 1 < SC) dirs.push([1, 0], [1, 0]);
      if (sy > 0) dirs.push([0, -1]);
      if (sy < SR - 1) dirs.push([0, 1]);
      var d = R.pick(dirs), nx = sx + d[0], ny = sy + d[1];
      if (used[nx + ',' + ny]) { if (nx + 1 < SC) { nx = sx + 1; ny = sy; } else break; }
      if (used[nx + ',' + ny]) break;
      sx = nx; sy = ny; used[sx + ',' + sy] = 1; path.push([sx, sy]);
    }
    /* 2. 支线房 */
    var branches = [];
    for (var b = 0; b < 3; b++) {
      var base = R.pick(path.slice(1, Math.max(2, path.length - 1)));
      var off = R.pick([[0, -1], [0, 1], [-1, 0], [1, 0]]);
      var bx = base[0] + off[0], by = base[1] + off[1];
      if (bx < 0 || by < 0 || bx >= SC || by >= SR || used[bx + ',' + by]) continue;
      used[bx + ',' + by] = 1; branches.push({ slot: [bx, by], from: base });
    }
    /* 3. 建房间 */
    function mkRoom(slot, type) {
      var big = type === 'boss';
      var rw = big ? CW - 4 : R.int(9, 11), rh = big ? CH - 3 : R.int(7, 9);
      var ox = slot[0] * CW + Math.floor((CW - rw) / 2), oy = slot[1] * CH + Math.floor((CH - rh) / 2);
      var r = { id: D.rooms.length, slot: slot, x0: ox, y0: oy, x1: ox + rw - 1, y1: oy + rh - 1,
        type: type, state: 'idle', visited: 0, doors: [], spawns: [], cleared: 0 };
      r.cx = (r.x0 + r.x1) / 2 | 0; r.cy = (r.y0 + r.y1) / 2 | 0;
      r.wx = (r.cx + .5) * TS; r.wy = (r.cy + .5) * TS;
      carveRect(r.x0, r.y0, r.x1, r.y1);
      D.rooms.push(r);
      return r;
    }
    var types = [];
    for (var i = 0; i < path.length; i++) types.push(i === 0 ? 'start' : (i === path.length - 1 ? 'boss' : 'combat'));
    var rooms = [];
    for (i = 0; i < path.length; i++) rooms.push(mkRoom(path[i], types[i]));
    /* 支线：宝箱/商店/祭坛 */
    var bTypes = M.shuffle(['treasure', 'shop', 'shrine'], R);
    for (i = 0; i < branches.length; i++) {
      var br = mkRoom(branches[i].slot, bTypes[i % bTypes.length]);
      br.fromSlot = branches[i].from;
    }
    /* 4. 走廊 */
    for (i = 1; i < rooms.length; i++) corridor(rooms[i - 1].cx, rooms[i - 1].cy, rooms[i].cx, rooms[i].cy, 1);
    for (i = 0; i < branches.length; i++) {
      var rb = D.rooms[path.length + i];
      if (!rb) continue;
      var src = null;
      for (var j = 0; j < rooms.length; j++) if (rooms[j].slot[0] === branches[i].from[0] && rooms[j].slot[1] === branches[i].from[1]) src = rooms[j];
      if (src) corridor(src.cx, src.cy, rb.cx, rb.cy, 1);
    }
    /* 5. 墙体 */
    for (var y = 0; y < D.h; y++) for (var x = 0; x < D.w; x++) {
      if (D.tiles[idx(x, y)] === 1) continue;
      var near = 0;
      for (var dy = -1; dy <= 1 && !near; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (isFloor(x + dx, y + dy)) { near = 1; break; }
      }
      if (near) D.tiles[idx(x, y)] = 2;
    }
    /* 6. 门（房间边界外的走廊格） */
    for (i = 0; i < D.rooms.length; i++) {
      var r = D.rooms[i], cand = [];
      for (x = r.x0 - 1; x <= r.x1 + 1; x++) {
        if (isFloor(x, r.y0 - 1) && x >= r.x0 && x <= r.x1) cand.push([x, r.y0 - 1, 'n']);
        if (isFloor(x, r.y1 + 1) && x >= r.x0 && x <= r.x1) cand.push([x, r.y1 + 1, 's']);
      }
      for (y = r.y0 - 1; y <= r.y1 + 1; y++) {
        if (isFloor(r.x0 - 1, y) && y >= r.y0 && y <= r.y1) cand.push([r.x0 - 1, y, 'w']);
        if (isFloor(r.x1 + 1, y) && y >= r.y0 && y <= r.y1) cand.push([r.x1 + 1, y, 'e']);
      }
      /* 相邻格合并成一道门 */
      var groups = [];
      cand.forEach(function (c) {
        for (var g = 0; g < groups.length; g++) {
          var G = groups[g];
          if (G.dir === c[2] && G.tiles.some(function (t) { return Math.abs(t[0] - c[0]) + Math.abs(t[1] - c[1]) === 1; })) { G.tiles.push(c); return; }
        }
        groups.push({ dir: c[2], tiles: [c] });
      });
      groups.forEach(function (g) {
        var door = { room: r.id, dir: g.dir, tiles: g.tiles.map(function (t) { return [t[0], t[1]]; }), closed: 0 };
        door.wx = 0; door.wy = 0;
        g.tiles.forEach(function (t) { door.wx += (t[0] + .5) * TS; door.wy += (t[1] + .5) * TS; });
        door.wx /= g.tiles.length; door.wy /= g.tiles.length;
        D.doors.push(door); r.doors.push(D.doors.length - 1);
      });
    }
    /* 7. 敌人 / 物件 / 内容 */
    var table = K.E.tableFor(floor);
    for (i = 0; i < D.rooms.length; i++) {
      var rm = D.rooms[i];
      if (rm.type === 'combat') {
        var n = R.int(4, 6) + Math.min(4, floor);
        for (j = 0; j < n; j++) {
          var t = R.weighted(table);
          var px = R.int(rm.x0 + 1, rm.x1 - 1), py = R.int(rm.y0 + 1, rm.y1 - 1);
          rm.spawns.push({ id: t.id, x: (px + .5) * TS, y: (py + .5) * TS, elite: R.chance(.06 + floor * .025) });
        }
      } else if (rm.type === 'boss') {
        rm.spawns.push({ boss: (floor - 1) % K.E.BOSSES.length, x: rm.wx, y: rm.wy - TS });
        for (j = 0; j < 2 + Math.min(3, floor); j++) {
          var t2 = R.weighted(table);
          rm.spawns.push({ id: t2.id, x: rm.wx + R.f(-160, 160), y: rm.wy + R.f(-120, 120), elite: 0 });
        }
      }
      /* 物件 */
      var pn = rm.type === 'boss' ? 3 : R.int(2, 5);
      for (j = 0; j < pn; j++) {
        var qx = R.int(rm.x0, rm.x1), qy = R.int(rm.y0, rm.y1);
        if (Math.abs(qx - rm.cx) < 2 && Math.abs(qy - rm.cy) < 2) continue;
        var kind = R.weighted([{ k: 'barrel', w: 3 }, { k: 'crate', w: 3 }, { k: 'pot', w: 4 }], 'w').k;
        D.props.push({ kind: kind, x: (qx + .5) * TS, y: (qy + .5) * TS, r: 15, hp: kind === 'pot' ? 1 : 12, alive: 1, t: R.int(0, 60), room: rm.id });
      }
      /* 火把（贴墙） */
      for (j = 0; j < 4; j++) {
        var tx2 = R.int(rm.x0, rm.x1);
        if (!isFloor(tx2, rm.y0 - 1)) D.props.push({ kind: 'torch', x: (tx2 + .5) * TS, y: (rm.y0 - .15) * TS, r: 10, alive: 1, light: 1, t: R.int(0, 99), room: rm.id, noHit: 1 });
      }
      if (rm.type === 'treasure') {
        K.I.drop(rm.wx, rm.wy, 'chest', { pop: 0, big: 1 });
        D.props.push({ kind: 'statue', x: rm.wx - 90, y: rm.wy, r: 14, alive: 1, noHit: 1, t: 0, room: rm.id });
        D.props.push({ kind: 'statue', x: rm.wx + 90, y: rm.wy, r: 14, alive: 1, noHit: 1, t: 0, room: rm.id });
      } else if (rm.type === 'shop') {
        var prices = [40, 55, 70];
        var ws = [K.W.roll(R, floor, 2), K.W.roll(R, floor + 1, 3)];
        K.I.drop(rm.wx - 90, rm.wy - 10, 'weapon', { w: ws[0], price: 40 + ws[0].rarity * 14, pop: 0 });
        K.I.drop(rm.wx, rm.wy - 10, 'relic', { relic: K.I.rollRelic(R, []), price: 85, pop: 0 });
        K.I.drop(rm.wx + 90, rm.wy - 10, 'heal', { price: 35, pop: 0 });
        D.props.push({ kind: 'torch', x: rm.wx - 130, y: rm.wy - 40, r: 10, alive: 1, light: 1, t: 0, room: rm.id, noHit: 1 });
        D.props.push({ kind: 'torch', x: rm.wx + 130, y: rm.wy - 40, r: 10, alive: 1, light: 1, t: 30, room: rm.id, noHit: 1 });
      } else if (rm.type === 'shrine') {
        K.I.drop(rm.wx, rm.wy, 'shrine', { pop: 0 });
      }
    }
    D.start = { x: rooms[0].wx, y: rooms[0].wy };
    D.bossRoom = rooms[rooms.length - 1].id;
    render();
    return D;
  }

  /* ---------------- 预渲染 ---------------- */
  function render() {
    var W = D.w * TS, H = D.h * TS;
    var cv = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
    if (!cv) { D.canvas = null; return; }
    cv.width = W; cv.height = H;
    var c = cv.getContext('2d');
    var th = D.theme;
    c.fillStyle = '#07080c'; c.fillRect(0, 0, W, H);
    var x, y, i, px, py;
    /* 地板 */
    for (y = 0; y < D.h; y++) for (x = 0; x < D.w; x++) {
      i = idx(x, y); if (D.tiles[i] !== 1) continue;
      px = x * TS; py = y * TS;
      var h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      c.fillStyle = (h % 7 === 0) ? th.floor2 : th.floor;
      c.fillRect(px, py, TS, TS);
      c.strokeStyle = th.grout; c.lineWidth = 1.4;
      c.strokeRect(px + .7, py + .7, TS - 1.4, TS - 1.4);
      if (h % 11 === 0) { c.fillStyle = 'rgba(255,255,255,.035)'; c.fillRect(px + 6, py + 6, TS - 12, TS - 12); }
      if (h % 17 === 0) {
        c.strokeStyle = 'rgba(0,0,0,.22)'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(px + 8, py + 10); c.lineTo(px + 18, py + 22); c.lineTo(px + 30, py + 18); c.stroke();
      }
      if (h % 23 === 0) { c.fillStyle = 'rgba(0,0,0,.16)'; c.beginPath(); c.arc(px + TS * .5, py + TS * .6, 6, 0, M.TAU); c.fill(); }
    }
    /* 环境光遮蔽：靠墙变暗 */
    for (y = 0; y < D.h; y++) for (x = 0; x < D.w; x++) {
      if (D.tiles[idx(x, y)] !== 1) continue;
      px = x * TS; py = y * TS;
      var g;
      if (!isFloor(x, y - 1)) { g = c.createLinearGradient(0, py, 0, py + 16); g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(px, py, TS, 16); }
      if (!isFloor(x, y + 1)) { g = c.createLinearGradient(0, py + TS, 0, py + TS - 12); g.addColorStop(0, 'rgba(0,0,0,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(px, py + TS - 12, TS, 12); }
      if (!isFloor(x - 1, y)) { g = c.createLinearGradient(px, 0, px + 14, 0); g.addColorStop(0, 'rgba(0,0,0,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(px, py, 14, TS); }
      if (!isFloor(x + 1, y)) { g = c.createLinearGradient(px + TS, 0, px + TS - 14, 0); g.addColorStop(0, 'rgba(0,0,0,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(px + TS - 14, py, 14, TS); }
    }
    /* 房间地毯 */
    for (i = 0; i < D.rooms.length; i++) {
      var r = D.rooms[i];
      if (r.type === 'combat' || r.type === 'start') continue;
      var cxp = (r.x0 + 1) * TS, cyp = (r.y0 + 1) * TS, cw = (r.x1 - r.x0 - 1) * TS, chh = (r.y1 - r.y0 - 1) * TS;
      c.save(); c.globalAlpha = .3;
      c.fillStyle = r.type === 'boss' ? '#5a1f2a' : (r.type === 'shop' ? '#1f4a5a' : (r.type === 'shrine' ? '#4a3f1f' : '#3a2a5a'));
      c.fillRect(cxp, cyp, cw, chh);
      c.globalAlpha = .5; c.strokeStyle = D.theme.accent; c.lineWidth = 3;
      c.strokeRect(cxp, cyp, cw, chh);
      c.restore();
      if (r.type === 'boss') {
        c.save(); c.globalAlpha = .22; c.strokeStyle = '#ff5a4a'; c.lineWidth = 5;
        c.beginPath(); c.arc(r.wx, r.wy, Math.min(cw, chh) * .38, 0, M.TAU); c.stroke(); c.restore();
      }
    }
    /* 墙体 */
    for (y = 0; y < D.h; y++) for (x = 0; x < D.w; x++) {
      i = idx(x, y); if (D.tiles[i] !== 2) continue;
      px = x * TS; py = y * TS;
      var floorBelow = isFloor(x, y + 1);
      c.fillStyle = th.wallTop;
      c.fillRect(px, py, TS, TS);
      c.fillStyle = 'rgba(0,0,0,.18)';
      c.fillRect(px, py, TS, 4);
      var hh = ((x * 374761393) ^ (y * 668265263)) >>> 0;
      c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 1.6;
      c.strokeRect(px + .8, py + .8, TS - 1.6, TS - 1.6);
      if (hh % 5 === 0) { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(px + 5, py + 6, TS - 10, 8); }
      if (floorBelow) {
        var fg = c.createLinearGradient(0, py + TS * .45, 0, py + TS);
        fg.addColorStop(0, th.wall); fg.addColorStop(1, K.Art.sh(th.wall, -.4));
        c.fillStyle = fg; c.fillRect(px, py + TS * .45, TS, TS * .55);
        c.fillStyle = 'rgba(255,255,255,.10)'; c.fillRect(px, py + TS * .45, TS, 3);
        c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1.2;
        c.beginPath(); c.moveTo(px + TS * .5, py + TS * .5); c.lineTo(px + TS * .5, py + TS); c.stroke();
      }
    }
    D.canvas = cv; D.cctx = c;
    K.FX.decal = decal;
  }
  function decal(x, y, r, col) {
    if (!D.cctx) return;
    var c = D.cctx;
    c.save(); c.globalAlpha = .34; c.fillStyle = col || '#7a1020';
    c.beginPath(); c.ellipse(x, y, r * M.rnd(.8, 1.5), r * M.rnd(.5, 1), M.rnd(M.TAU), 0, M.TAU); c.fill();
    c.restore();
  }
  /* 门开关 */
  function setDoors(room, closed) {
    for (var i = 0; i < room.doors.length; i++) {
      var d = D.doors[room.doors[i]];
      d.closed = closed ? 1 : 0;
      for (var j = 0; j < d.tiles.length; j++) {
        var t = d.tiles[j];
        D.blocked[idx(t[0], t[1])] = closed ? 1 : 0;
      }
    }
  }
  function roomAt(wx, wy) {
    var tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
    for (var i = 0; i < D.rooms.length; i++) {
      var r = D.rooms[i];
      if (tx >= r.x0 && tx <= r.x1 && ty >= r.y0 && ty <= r.y1) return r;
    }
    return null;
  }

  /* ---------------- 绘制 ---------------- */
  function draw(ctx, V, W, H) {
    if (!D.canvas) return;
    var sx = V.tx(0), sy = V.ty(0), z = V.z;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(D.canvas, 0, 0, D.canvas.width, D.canvas.height,
      sx, sy, D.canvas.width * z, D.canvas.height * z);
    ctx.restore();
    /* 门 */
    for (var i = 0; i < D.doors.length; i++) {
      var d = D.doors[i]; if (!d.closed) continue;
      for (var j = 0; j < d.tiles.length; j++) {
        var t = d.tiles[j], px = V.tx(t[0] * TS), py = V.ty(t[1] * TS);
        ctx.save();
        ctx.fillStyle = '#4a3a2a'; ctx.strokeStyle = '#1a1420'; ctx.lineWidth = 2 * z;
        ctx.fillRect(px, py, TS * z, TS * z); ctx.strokeRect(px, py, TS * z, TS * z);
        ctx.strokeStyle = '#8a7a4a'; ctx.lineWidth = 3 * z;
        for (var k = 0; k < 3; k++) {
          ctx.beginPath();
          if (d.dir === 'n' || d.dir === 's') { ctx.moveTo(px + (k + .5) * TS * z / 3, py); ctx.lineTo(px + (k + .5) * TS * z / 3, py + TS * z); }
          else { ctx.moveTo(px, py + (k + .5) * TS * z / 3); ctx.lineTo(px + TS * z, py + (k + .5) * TS * z / 3); }
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
  /* 小地图 */
  function drawMinimap(ctx, x, y, w, h, curRoom, player) {
    var SC = 5, SR = 4, CW = 15, CH = 12;
    var sx = w / (SC * CW), sy = h / (SR * CH), s = Math.min(sx, sy);
    ctx.save();
    ctx.fillStyle = 'rgba(8,10,18,.72)';
    ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    ctx.strokeStyle = 'rgba(150,170,210,.4)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 6, y - 6, w + 12, h + 12);
    for (var i = 0; i < D.rooms.length; i++) {
      var r = D.rooms[i];
      if (!r.visited) continue;
      var rx = x + r.x0 * s, ry = y + r.y0 * s, rw = (r.x1 - r.x0 + 1) * s, rh = (r.y1 - r.y0 + 1) * s;
      ctx.fillStyle = r === curRoom ? 'rgba(255,209,92,.85)' :
        (r.type === 'boss' ? 'rgba(255,90,74,.6)' : r.type === 'shop' ? 'rgba(106,212,255,.55)' :
          r.type === 'treasure' ? 'rgba(192,106,255,.55)' : r.type === 'shrine' ? 'rgba(255,209,92,.45)' : 'rgba(160,175,210,.42)');
      ctx.fillRect(rx, ry, rw, rh);
      if (r.state === 'fighting') { ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 1.6; ctx.strokeRect(rx, ry, rw, rh); }
      if (r.type === 'boss') { ctx.fillStyle = '#ff5a4a'; ctx.font = 'bold ' + (s * 5).toFixed(0) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('B', rx + rw / 2, ry + rh / 2 + s * 2); }
      if (r.type === 'shop') { ctx.fillStyle = '#dff6ff'; ctx.font = 'bold ' + (s * 5).toFixed(0) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('$', rx + rw / 2, ry + rh / 2 + s * 2); }
    }
    /* 走廊（已访问房间之间） */
    ctx.strokeStyle = 'rgba(160,175,210,.3)'; ctx.lineWidth = Math.max(1, s * 1.4);
    for (i = 1; i < D.rooms.length; i++) {
      var a = D.rooms[i - 1], b2 = D.rooms[i];
      if (!a.visited || !b2.visited) continue;
      ctx.beginPath(); ctx.moveTo(x + a.cx * s, y + a.cy * s); ctx.lineTo(x + b2.cx * s, y + b2.cy * s); ctx.stroke();
    }
    if (player) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x + player.x / TS * s, y + player.y / TS * s, Math.max(2, s * 1.6), 0, M.TAU); ctx.fill();
    }
    ctx.restore();
  }
  K.D = { D: D, gen: gen, solid: solid, isFloor: isFloor, roomAt: roomAt, setDoors: setDoors,
    draw: draw, drawMinimap: drawMinimap, decal: decal, THEMES: THEMES,
    get rooms() { return D.rooms; }, get props() { return D.props; }, get theme() { return D.theme; } };
})(window.K);
