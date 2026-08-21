/* ============ 世界：地形生成 / 植被 / 查询 ============ */
(function (D) {
  "use strict";
  var U = D.util;

  var T = { DEEP: 0, WATER: 1, SAND: 2, GRASS: 3, FOREST: 4, ROCK: 5 };
  var TILE = 64;

  var INFO = [
    { speed: 0.0, solid: true, wet: true },
    { speed: 0.58, solid: false, wet: true },
    { speed: 0.94, solid: false, wet: false },
    { speed: 1.0, solid: false, wet: false },
    { speed: 0.84, solid: false, wet: false },
    { speed: 0.0, solid: true, wet: false }
  ];

  // 每种地形的两种色调，用噪声混合
  var PAL = [
    [[14, 46, 78], [22, 66, 104]],
    [[42, 122, 158], [62, 152, 186]],
    [[212, 194, 142], [230, 214, 166]],
    [[84, 138, 60], [108, 164, 78]],
    [[46, 100, 52], [62, 122, 64]],
    [[112, 110, 118], [142, 140, 150]]
  ];

  function World(seed) {
    this.seed = seed | 0;
    this.tile = TILE;
    this.cols = 90;
    this.rows = 90;
    this.w = this.cols * TILE;
    this.h = this.rows * TILE;
    var n = this.cols * this.rows;
    this.map = new Uint8Array(n);
    this.flags = new Uint8Array(n);
    this.color = new Array(n);
    this.dark = new Array(n);
    this.buckets = new Array(n);
    this.props = [];
    this.plants = [];
    this.villages = [];
    this.crystals = [];
    this.runes = [];
    this.lights = [];
    this.pcell = {};
    this.pcellSize = TILE * 4;
    this.regrowT = 0;
    this.mini = null;
    this.generate();
  }

  World.prototype.idx = function (cx, cy) { return cy * this.cols + cx; };

  World.prototype.generate = function () {
    var s = this.seed, cols = this.cols, rows = this.rows, n = cols * rows;
    var ev = new Float32Array(n), mv = new Float32Array(n), rv = new Float32Array(n);
    var i, x, y;
    for (y = 0; y < rows; y++) {
      for (x = 0; x < cols; x++) {
        i = y * cols + x;
        var nx = x / cols, ny = y / rows;
        var e = U.fbm(nx * 3.4, ny * 3.4, s, 5, 2, 0.5);
        var dx = (nx - 0.5) * 2, dy = (ny - 0.5) * 2;
        var dd = Math.sqrt(dx * dx + dy * dy);
        ev[i] = e + 0.05 - Math.max(0, dd - 0.84) * 1.7;             // 边缘沉入海洋
        mv[i] = U.fbm(nx * 5.4 + 13, ny * 5.4 + 7, s + 9901, 4, 2, 0.55); // 湿度：小片森林
        rv[i] = Math.abs(U.fbm(nx * 2.1 + 3, ny * 2.1 + 11, s + 4441, 3, 2, 0.5) - 0.5);
      }
    }
    // 按数值分布取阈值：任何种子都能得到稳定的地形配比
    var sortedE = Float32Array.prototype.slice.call(ev).sort();
    var q = function (arr, p) {
      return arr[Math.min(arr.length - 1, Math.max(0, Math.floor(arr.length * p)))];
    };
    var deepT = q(sortedE, 0.12), waterT = q(sortedE, 0.19), sandT = q(sortedE, 0.26), rockT = q(sortedE, 0.955);
    var landM = [];
    for (i = 0; i < n; i++) if (ev[i] >= sandT) landM.push(mv[i]);
    landM.sort(function (a, b) { return a - b; });
    var forestT = landM.length ? landM[Math.floor(landM.length * 0.48)] : 0.5;

    for (y = 0; y < rows; y++) {
      for (x = 0; x < cols; x++) {
        i = y * cols + x;
        var e2 = ev[i], t;
        if (e2 < deepT) t = T.DEEP;
        else if (e2 < waterT) t = T.WATER;
        else if (e2 < sandT) t = T.SAND;
        else if (e2 > rockT) t = T.ROCK;
        else t = mv[i] > forestT ? T.FOREST : T.GRASS;
        if ((t === T.GRASS || t === T.FOREST || t === T.SAND) && rv[i] < 0.019) t = T.WATER;
        this.map[i] = t;
        var tn = U.noise2(x * 0.63, y * 0.63, s + 77);
        var c = U.mixc(PAL[t][0], PAL[t][1], tn);
        this.color[i] = U.rgb(c);
        this.dark[i] = U.rgb([c[0] * 0.78, c[1] * 0.78, c[2] * 0.78]);
      }
    }
    this.buildFlags();
    this.buildVillages();
    this.buildProps();
    this.buildVillageProps();
    this.buildMagicSites();
    this.buildMini();
  };

  // 部落营地：选一片开阔平地，营地范围内不长树
  World.prototype.buildVillages = function () {
    var rng = U.mulberry32(this.seed ^ 0x7a11e5);
    var tries = 0;
    while (this.villages.length < 3 && tries++ < 700) {
      var x = 340 + rng() * (this.w - 680), y = 340 + rng() * (this.h - 680);
      var t = this.typeAt(x, y);
      if (t !== T.GRASS && t !== T.SAND) continue;
      if (!this.canWalk(x, y, 44)) continue;
      var far = true;
      for (var i = 0; i < this.villages.length; i++) {
        if (U.dist2(x, y, this.villages[i].x, this.villages[i].y) < 1500 * 1500) { far = false; break; }
      }
      if (!far) continue;
      var free = 0;
      for (var a = 0; a < 8; a++) {
        var ang = a / 8 * U.TAU;
        if (this.canWalk(x + Math.cos(ang) * 130, y + Math.sin(ang) * 130, 30)) free++;
      }
      if (free < 6) continue;
      this.villages.push({
        x: x, y: y, r: 155, ruined: false, totem: null, totemDown: false,
        totemHp: 0, spawnT: 1 + rng() * 3
      });
    }
  };

  World.prototype.inVillage = function (x, y, pad) {
    pad = pad || 0;
    for (var i = 0; i < this.villages.length; i++) {
      var v = this.villages[i], rr = v.r + pad;
      if (U.dist2(x, y, v.x, v.y) < rr * rr) return v;
    }
    return null;
  };

  World.prototype.buildVillageProps = function () {
    var rng = U.mulberry32(this.seed ^ 0x51a9e3);
    for (var i = 0; i < this.villages.length; i++) {
      var v = this.villages[i];
      var fx = v.x + 52, fy = v.y + 34;
      this.addProp({ kind: "campfire", x: fx, y: fy, r: 17, seed: rng() * 100 });
      this.lights.push({ x: fx, y: fy, r: 170, kind: "fire" });
      var n = 3 + Math.floor(rng() * 3);
      for (var k = 0; k < n; k++) {
        var a = rng() * U.TAU, d = 72 + rng() * 66;
        var px = v.x + Math.cos(a) * d, py = v.y + Math.sin(a) * d;
        if (!this.canWalk(px, py, 18)) continue;
        this.addProp({ kind: "tent", x: px, y: py, r: 26 + rng() * 9, seed: rng() * 100 });
      }
      for (var s = 0; s < 14; s++) {
        var aa = (s / 14) * U.TAU + rng() * 0.22;
        var sx = v.x + Math.cos(aa) * v.r * 0.96, sy = v.y + Math.sin(aa) * v.r * 0.74;
        if (!this.canWalk(sx, sy, 8)) continue;
        this.addProp({ kind: "stake", x: sx, y: sy, r: 15 + rng() * 7, seed: rng() * 100 });
      }
      for (var b = 0; b < 3; b++) {
        this.addProp({ kind: "bones", x: v.x + (rng() - 0.5) * 170, y: v.y + (rng() - 0.5) * 110, r: 13, seed: rng() * 100 });
      }
    }
  };

  World.prototype.buildMagicSites = function () {
    var rng = U.mulberry32(this.seed ^ 0x3c9a17);
    var tries = 0, i;
    while (this.crystals.length < 12 && tries++ < 400) {
      var s = this.randomSpawn(rng, 24);
      if (this.inVillage(s.x, s.y, 220)) continue;
      var ok = true;
      for (i = 0; i < this.crystals.length; i++) {
        if (U.dist2(s.x, s.y, this.crystals[i].x, this.crystals[i].y) < 680 * 680) { ok = false; break; }
      }
      if (!ok) continue;
      var c = { kind: "crystal", x: s.x, y: s.y, r: 20 + rng() * 9, seed: rng() * 100 };
      this.crystals.push(c);
      this.addProp(c);
      this.lights.push({ x: c.x, y: c.y, r: 130, kind: "mana" });
    }
    tries = 0;
    while (this.runes.length < 5 && tries++ < 400) {
      var s2 = this.randomSpawn(rng, 36);
      if (this.inVillage(s2.x, s2.y, 240)) continue;
      var ok2 = true;
      for (i = 0; i < this.runes.length; i++) {
        if (U.dist2(s2.x, s2.y, this.runes[i].x, this.runes[i].y) < 900 * 900) { ok2 = false; break; }
      }
      if (!ok2) continue;
      var rn = { kind: "rune", x: s2.x, y: s2.y, r: 76, cd: 0, seed: rng() * 100 };
      this.runes.push(rn);
      this.addProp(rn);
      this.lights.push({ x: rn.x, y: rn.y, r: 140, kind: "rune" });
    }
  };

  World.prototype.buildFlags = function () {
    var cols = this.cols, rows = this.rows, map = this.map;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var i = y * cols + x, t = map[i], f = 0;
        var wet = false, land = false;
        for (var k = 0; k < 4; k++) {
          var ax = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
          var ay = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
          var nt = (ax < 0 || ay < 0 || ax >= cols || ay >= rows) ? T.DEEP : map[ay * cols + ax];
          if (nt <= T.WATER) wet = true; else land = true;
        }
        if (t > T.WATER && wet) f |= 1;
        if (t <= T.WATER && land) f |= 2;
        if (t === T.ROCK) {
          var up = y > 0 ? map[i - cols] : T.ROCK;
          if (up !== T.ROCK) f |= 4;
        }
        this.flags[i] = f;
      }
    }
  };

  World.prototype.pkey = function (x, y) {
    return Math.floor(x / this.pcellSize) + ":" + Math.floor(y / this.pcellSize);
  };

  World.prototype.addProp = function (p) {
    var cx = Math.floor(p.x / TILE), cy = Math.floor(p.y / TILE);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return;
    var i = cy * this.cols + cx;
    if (!this.buckets[i]) this.buckets[i] = [];
    this.buckets[i].push(p);
    this.props.push(p);
    if (p.kind === "fern" || p.kind === "bush") {
      this.plants.push(p);
      var k = this.pkey(p.x, p.y);
      if (!this.pcell[k]) this.pcell[k] = [];
      this.pcell[k].push(p);
    }
  };

  World.prototype.buildProps = function () {
    var rng = U.mulberry32(this.seed ^ 0x51ed37);
    for (var y = 0; y < this.rows; y++) {
      for (var x = 0; x < this.cols; x++) {
        var i = y * this.cols + x, t = this.map[i];
        var bx = x * TILE, by = y * TILE;
        if (this.inVillage(bx + TILE * 0.5, by + TILE * 0.5, 10)) continue;   // 营地是清空的
        var jitter = function () { return rng() * TILE; };
        if (t === T.FOREST) {
          var nt = 1 + (rng() < 0.55 ? 1 : 0);
          for (var a = 0; a < nt; a++) {
            this.addProp({ kind: "tree", x: bx + jitter(), y: by + jitter(), r: 20 + rng() * 16, seed: rng() * 100, kindOf: rng() < 0.35 ? "conifer" : "broad" });
          }
          if (rng() < 0.5) this.addProp({ kind: "fern", x: bx + jitter(), y: by + jitter(), r: 12 + rng() * 5, seed: rng() * 100, food: 100, max: 100 });
        } else if (t === T.GRASS) {
          if (rng() < 0.05) this.addProp({ kind: "tree", x: bx + jitter(), y: by + jitter(), r: 18 + rng() * 14, seed: rng() * 100, kindOf: rng() < 0.3 ? "conifer" : "broad" });
          if (rng() < 0.2) this.addProp({ kind: "fern", x: bx + jitter(), y: by + jitter(), r: 11 + rng() * 5, seed: rng() * 100, food: 100, max: 100 });
          if (rng() < 0.1) this.addProp({ kind: "bush", x: bx + jitter(), y: by + jitter(), r: 15 + rng() * 7, seed: rng() * 100, food: 140, max: 140 });
          if (rng() < 0.32) this.addProp({ kind: "tuft", x: bx + jitter(), y: by + jitter(), r: 6 + rng() * 5, seed: rng() * 100 });
          if (rng() < 0.03) this.addProp({ kind: "rock", x: bx + jitter(), y: by + jitter(), r: 8 + rng() * 8, seed: rng() * 100 });
        } else if (t === T.SAND) {
          if (rng() < 0.06) this.addProp({ kind: "wood", x: bx + jitter(), y: by + jitter(), r: 12 + rng() * 8, seed: rng() * 100 });
          if (rng() < 0.05) this.addProp({ kind: "rock", x: bx + jitter(), y: by + jitter(), r: 6 + rng() * 6, seed: rng() * 100 });
        } else if (t === T.ROCK && (this.flags[i] & 4)) {
          if (rng() < 0.3) this.addProp({ kind: "rock", x: bx + jitter(), y: by + jitter(), r: 12 + rng() * 12, seed: rng() * 100 });
        }
      }
    }
  };

  World.prototype.buildMini = function () {
    try {
      if (typeof document === "undefined" || !document.createElement) return;
      var cv = document.createElement("canvas");
      cv.width = this.cols; cv.height = this.rows;
      var c = cv.getContext("2d");
      if (!c) return;
      for (var y = 0; y < this.rows; y++) {
        for (var x = 0; x < this.cols; x++) {
          var i = y * this.cols + x;
          c.fillStyle = this.color[i];
          c.fillRect(x, y, 1, 1);
        }
      }
      this.mini = cv;
    } catch (e) { this.mini = null; }
  };

  World.prototype.typeAt = function (x, y) {
    var cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return T.DEEP;
    return this.map[cy * this.cols + cx];
  };

  World.prototype.solidAt = function (x, y) { return INFO[this.typeAt(x, y)].solid; };
  World.prototype.isWater = function (x, y) { return this.typeAt(x, y) <= T.WATER; };
  World.prototype.speedAt = function (x, y) {
    var t = this.typeAt(x, y);
    return INFO[t].solid ? 0.4 : INFO[t].speed;
  };

  World.prototype.canWalk = function (x, y, r) {
    if (x < r || y < r || x > this.w - r || y > this.h - r) return false;
    if (this.solidAt(x, y)) return false;
    var d = r * 0.72;
    if (this.solidAt(x + d, y) || this.solidAt(x - d, y)) return false;
    if (this.solidAt(x, y + d) || this.solidAt(x, y - d)) return false;
    return true;
  };

  // 找最近的可饮水点（岸边浅水）
  World.prototype.findWater = function (x, y, maxR) {
    var cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
    var maxRing = Math.ceil(maxR / TILE);
    for (var ring = 0; ring <= maxRing; ring++) {
      var best = null, bestD = 1e9;
      for (var oy = -ring; oy <= ring; oy++) {
        for (var ox = -ring; ox <= ring; ox++) {
          if (Math.max(Math.abs(ox), Math.abs(oy)) !== ring) continue;
          var tx = cx + ox, ty = cy + oy;
          if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) continue;
          var i = ty * this.cols + tx;
          if (this.map[i] > T.WATER) continue;
          if (!(this.flags[i] & 2)) continue;
          var wx = tx * TILE + TILE / 2, wy = ty * TILE + TILE / 2;
          var dd = U.dist2(x, y, wx, wy);
          if (dd < bestD) { bestD = dd; best = { x: wx, y: wy, d: Math.sqrt(dd) }; }
        }
      }
      if (best) return best;
    }
    return null;
  };

  World.prototype.findPlant = function (x, y, maxR, minFood) {
    minFood = minFood || 12;
    var cs = this.pcellSize;
    var c0 = Math.floor((x - maxR) / cs), c1 = Math.floor((x + maxR) / cs);
    var r0 = Math.floor((y - maxR) / cs), r1 = Math.floor((y + maxR) / cs);
    var best = null, bestD = maxR * maxR;
    for (var cy = r0; cy <= r1; cy++) {
      for (var cx = c0; cx <= c1; cx++) {
        var arr = this.pcell[cx + ":" + cy];
        if (!arr) continue;
        for (var i = 0; i < arr.length; i++) {
          var p = arr[i];
          if (p.food < minFood) continue;
          var dd = U.dist2(x, y, p.x, p.y);
          if (dd < bestD) { bestD = dd; best = p; }
        }
      }
    }
    return best;
  };

  World.prototype.plantsNear = function (x, y, r) {
    var out = [];
    var cs = this.pcellSize;
    var c0 = Math.floor((x - r) / cs), c1 = Math.floor((x + r) / cs);
    var r0 = Math.floor((y - r) / cs), r1 = Math.floor((y + r) / cs);
    for (var cy = r0; cy <= r1; cy++) {
      for (var cx = c0; cx <= c1; cx++) {
        var arr = this.pcell[cx + ":" + cy];
        if (!arr) continue;
        for (var i = 0; i < arr.length; i++) {
          if (U.dist2(x, y, arr[i].x, arr[i].y) < r * r) out.push(arr[i]);
        }
      }
    }
    return out;
  };

  World.prototype.propsNear = function (x, y, r) {
    var out = [];
    var c0 = Math.floor((x - r) / TILE), c1 = Math.floor((x + r) / TILE);
    var r0 = Math.floor((y - r) / TILE), r1 = Math.floor((y + r) / TILE);
    for (var cy = r0; cy <= r1; cy++) {
      if (cy < 0 || cy >= this.rows) continue;
      for (var cx = c0; cx <= c1; cx++) {
        if (cx < 0 || cx >= this.cols) continue;
        var b = this.buckets[cy * this.cols + cx];
        if (b) for (var i = 0; i < b.length; i++) out.push(b[i]);
      }
    }
    return out;
  };

  // 螺旋搜索一个可行走点
  World.prototype.findLand = function (x, y, r) {
    r = r || 24;
    if (this.canWalk(x, y, r)) return { x: x, y: y };
    for (var ring = 1; ring < 40; ring++) {
      for (var k = 0; k < ring * 8; k++) {
        var a = (k / (ring * 8)) * U.TAU;
        var px = x + Math.cos(a) * ring * TILE * 0.8;
        var py = y + Math.sin(a) * ring * TILE * 0.8;
        if (this.canWalk(px, py, r)) return { x: px, y: py };
      }
    }
    return { x: this.w / 2, y: this.h / 2 };
  };

  World.prototype.randomSpawn = function (rng, r) {
    for (var i = 0; i < 400; i++) {
      var x = rng() * this.w, y = rng() * this.h;
      if (this.canWalk(x, y, r || 24)) return { x: x, y: y };
    }
    return this.findLand(this.w / 2, this.h / 2, r || 24);
  };

  // 环形取点：用于在玩家视野外刷怪
  World.prototype.spawnRing = function (rng, x, y, rMin, rMax, r) {
    for (var i = 0; i < 90; i++) {
      var a = rng() * U.TAU;
      var d = rMin + rng() * (rMax - rMin);
      var px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      if (px < 80 || py < 80 || px > this.w - 80 || py > this.h - 80) continue;
      if (this.canWalk(px, py, r || 24)) return { x: px, y: py };
    }
    return null;
  };

  World.prototype.update = function (dt, rainy) {
    this.regrowT -= dt;
    if (this.regrowT > 0) return;
    var step = 0.5 + this.regrowT;
    this.regrowT = 0.5;
    var rate = (rainy ? 3.4 : 1.5) * step;
    for (var i = 0; i < this.plants.length; i++) {
      var p = this.plants[i];
      if (p.food < p.max) p.food = Math.min(p.max, p.food + rate);
    }
  };

  D.T = T;
  D.TILE = TILE;
  D.TERRAIN = INFO;
  D.World = World;
})(window.DINO);
