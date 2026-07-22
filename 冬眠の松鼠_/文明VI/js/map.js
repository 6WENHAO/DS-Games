/* map.js — procedural map generation */
(function (global) {
  "use strict";
  const D = global.DATA;

  const SIZES = {
    tiny:     { cols: 44, rows: 26 },
    small:    { cols: 56, rows: 36 },
    standard: { cols: 74, rows: 46 }
  };

  // simple seeded RNG (mulberry32)
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // value noise
  function makeNoise(cols, rows, rand, scale) {
    const gw = Math.ceil(cols / scale) + 2, gh = Math.ceil(rows / scale) + 2;
    const g = [];
    for (let i = 0; i < gw * gh; i++) g.push(rand());
    const at = (x, y) => g[Math.max(0, Math.min(gh - 1, y)) * gw + Math.max(0, Math.min(gw - 1, x))];
    const lerp = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
    return function (col, row) {
      const fx = col / scale, fy = row / scale;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const top = lerp(at(x0, y0), at(x0 + 1, y0), tx);
      const bot = lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), tx);
      return lerp(top, bot, ty);
    };
  }

  function generate(sizeKey, seed) {
    const size = SIZES[sizeKey] || SIZES.small;
    const cols = size.cols, rows = size.rows;
    const rand = rng(seed || Math.floor(Math.random() * 1e9));

    const elevN = makeNoise(cols, rows, rand, 7);
    const elevN2 = makeNoise(cols, rows, rand, 3);
    const moistN = makeNoise(cols, rows, rand, 9);
    const mountN = makeNoise(cols, rows, rand, 4);

    const tiles = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // continent shaping: fade to ocean near edges
        const edgeX = Math.min(c, cols - 1 - c) / (cols * 0.5);
        const edgeY = Math.min(r, rows - 1 - r) / (rows * 0.5);
        const edge = Math.min(edgeX, edgeY);
        const edgeFade = Math.min(1, edge * 2.4);

        let e = elevN(c, r) * 0.65 + elevN2(c, r) * 0.35;
        e = e * (0.35 + 0.65 * edgeFade);

        const tile = { col: c, row: r, elevation: "flat", feature: null, resource: null,
          improvement: null, river: false, owner: null, cityId: null, workedBy: null,
          appeal: 0, unitId: null, explored: {}, visible: {} };

        // latitude for climate (0 = equator center)
        const lat = Math.abs(r - rows / 2) / (rows / 2); // 0..1

        if (e < 0.32) {
          tile.terrain = "ocean";
        } else if (e < 0.38) {
          tile.terrain = "coast";
        } else {
          // land
          const moist = moistN(c, r);
          if (lat > 0.82) tile.terrain = "snow";
          else if (lat > 0.66) tile.terrain = "tundra";
          else if (lat < 0.28 && moist < 0.42) tile.terrain = "desert";
          else if (moist < 0.4) tile.terrain = "plains";
          else tile.terrain = "grassland";

          // elevation: hills / mountains
          const m = mountN(c, r);
          if (m > 0.74 && e > 0.5) tile.elevation = "mountain";
          else if (e > 0.6 || elevN2(c, r) > 0.66) tile.elevation = "hills";
        }
        tiles.push(tile);
      }
    }

    const map = {
      cols, rows, tiles, seed,
      idx: (c, r) => (r >= 0 && r < rows && c >= 0 && c < cols) ? r * cols + c : -1,
      get(c, r) { const i = this.idx(c, r); return i < 0 ? null : this.tiles[i]; }
    };

    addCoasts(map);
    addFeatures(map, rand);
    addRivers(map, rand);
    addResources(map, rand);
    computeAppeal(map);
    return map;
  }

  // convert deep ocean adjacent to land into coast
  function addCoasts(map) {
    for (const t of map.tiles) {
      if (t.terrain !== "ocean") continue;
      const nb = Hex.neighbors(t.col, t.row);
      if (nb.some(n => { const o = map.get(n.col, n.row); return o && !isWater(o); }))
        t.terrain = "coast";
    }
  }
  function isWater(t) { return t.terrain === "ocean" || t.terrain === "coast"; }

  function addFeatures(map, rand) {
    for (const t of map.tiles) {
      if (isWater(t)) {
        if (t.terrain === "coast" && rand() < 0.06) t.feature = "reef";
        continue;
      }
      if (t.elevation === "mountain") continue;
      const terr = t.terrain;
      const r = rand();
      if (terr === "grassland" || terr === "plains") {
        if (r < 0.30) t.feature = "woods";
        else if (r < 0.40 && terr === "grassland") t.feature = "rainforest";
        else if (r < 0.44 && terr === "grassland" && t.elevation === "flat") t.feature = "marsh";
      } else if (terr === "tundra") {
        if (r < 0.35) t.feature = "woods";
      } else if (terr === "desert") {
        if (r < 0.05 && t.elevation === "flat") t.feature = "oasis";
      }
    }
  }

  function addRivers(map, rand) {
    // draw a handful of rivers descending from mountains/hills to sea
    let count = Math.floor(map.cols * map.rows / 350);
    let guard = 0;
    while (count > 0 && guard++ < 500) {
      const c = Math.floor(rand() * map.cols), r = Math.floor(rand() * map.rows);
      const start = map.get(c, r);
      if (!start || isWater(start) || start.elevation === "flat") continue;
      let cur = start, steps = 0;
      while (cur && !isWater(cur) && steps++ < 40) {
        cur.river = true;
        const nb = Hex.neighbors(cur.col, cur.row).map(n => map.get(n.col, n.row)).filter(Boolean);
        nb.sort((a, b) => elevVal(a) - elevVal(b));
        const next = nb[0];
        if (!next || next === cur) break;
        cur = next;
      }
      count--;
    }
  }
  function elevVal(t) {
    if (isWater(t)) return -1;
    if (t.elevation === "mountain") return 3;
    if (t.elevation === "hills") return 2;
    return 1;
  }

  function addResources(map, rand) {
    for (const t of map.tiles) {
      if (t.resource) continue;
      if (rand() > 0.16) continue;
      const candidates = [];
      for (const key in D.RES) {
        const res = D.RES[key];
        if (matchRes(t, res)) candidates.push(key);
      }
      if (candidates.length) t.resource = candidates[Math.floor(rand() * candidates.length)];
    }
  }
  function matchRes(t, res) {
    for (const cond of res.on) {
      if (cond === t.terrain) return true;
      if (cond === t.elevation) return true;
      if (cond === t.feature) return true;
      if (cond === "floodplains" && t.feature === "floodplains") return true;
      if (cond === "hills" && t.elevation === "hills") return true;
    }
    return false;
  }

  function computeAppeal(map) {
    for (const t of map.tiles) {
      if (isWater(t)) continue;
      let a = 0;
      const nb = Hex.ring(t.col, t.row, 2);
      for (const n of nb) {
        const o = map.get(n.col, n.row);
        if (!o) continue;
        if (o.elevation === "mountain") a += 1;
        if (o.feature === "woods" || o.feature === "reef" || o.feature === "oasis") a += 1;
        if (o.feature === "rainforest" || o.feature === "marsh") a -= 1;
      }
      t.appeal = a;
    }
  }

  global.MapGen = { generate, SIZES, isWater };
})(window);
