/* hex.js — pointy-top, odd-r offset hex grid math */
(function (global) {
  "use strict";

  const SQRT3 = Math.sqrt(3);

  // Neighbor offsets for odd-r offset coordinates (row, col).
  // Order: E, NE, NW, W, SW, SE  (clockwise-ish)
  const NEIGHBORS = {
    even: [ [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0] ],
    odd:  [ [0, 1], [-1, 1], [-1, 0],  [0, -1], [1, 0],  [1, 1] ]
  };

  const Hex = {
    SQRT3,

    // odd-r offset -> pixel center (size = hex radius)
    toPixel(col, row, size) {
      const x = size * SQRT3 * (col + 0.5 * (row & 1));
      const y = size * 1.5 * row;
      return { x, y };
    },

    // pixel -> nearest offset coords
    fromPixel(px, py, size) {
      // convert to axial cube then round
      const q = (SQRT3 / 3 * px - 1 / 3 * py) / size;
      const r = (2 / 3 * py) / size;
      const cube = Hex.cubeRound(q, -q - r, r);
      return Hex.axialToOffset(cube.x, cube.z);
    },

    cubeRound(x, y, z) {
      let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
      const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
      if (dx > dy && dx > dz) rx = -ry - rz;
      else if (dy > dz) ry = -rx - rz;
      else rz = -rx - ry;
      return { x: rx, y: ry, z: rz };
    },

    offsetToAxial(col, row) {
      const q = col - (row - (row & 1)) / 2;
      return { q, r: row };
    },

    axialToOffset(q, r) {
      const col = q + (r - (r & 1)) / 2;
      return { col, row: r };
    },

    neighbors(col, row) {
      const set = (row & 1) ? NEIGHBORS.odd : NEIGHBORS.even;
      return set.map(([dr, dc]) => ({ col: col + dc, row: row + dr }));
    },

    // hex distance between two offset coords
    distance(c1, r1, c2, r2) {
      const a = Hex.offsetToAxial(c1, r1);
      const b = Hex.offsetToAxial(c2, r2);
      const ax = a.q, az = a.r, ay = -ax - az;
      const bx = b.q, bz = b.r, by = -bx - bz;
      return (Math.abs(ax - bx) + Math.abs(ay - by) + Math.abs(az - bz)) / 2;
    },

    // corner points of a pointy-top hex
    corners(cx, cy, size) {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const ang = Math.PI / 180 * (60 * i - 90);
        pts.push({ x: cx + size * Math.cos(ang), y: cy + size * Math.sin(ang) });
      }
      return pts;
    },

    // all tiles within radius r (offset coords)
    ring(col, row, radius) {
      const out = [];
      for (let dc = -radius - 1; dc <= radius + 1; dc++) {
        for (let dr = -radius - 1; dr <= radius + 1; dr++) {
          const c = col + dc, rr = row + dr;
          if (Hex.distance(col, row, c, rr) <= radius) out.push({ col: c, row: rr });
        }
      }
      return out;
    }
  };

  global.Hex = Hex;
})(window);
