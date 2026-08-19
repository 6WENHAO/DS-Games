// ---------------------------------------------------------------------------
// 平面图编译器：把"房间/走廊矩形"列表编译成完整的 brush 几何
//
// 为什么这么做：手摆每一堵墙极易漏缝、卡人、堵门。这里改成声明式：
//   作者只描述"哪里可以走"（rooms），编译器自动
//     1) 为每个房间生成实心地板（从地图底部填到房间地面高度，天然形成台阶侧面）
//     2) 把所有"紧邻可行走格但本身不可行走"的格子变成墙（0.5m 厚外壳）
//     3) 需要门/窗时用 holes 在墙上开洞
//     4) 室内房间自动加天花板
//   由此保证：地图必然封闭、房间之间只在真正相邻处连通。
// 两个房间要"有墙有门"就别让它们直接相邻，中间留 ≥1 格空隙，
// 再用一条窄的"门房间"横跨这段空隙。
// ---------------------------------------------------------------------------

const CS = 0.5;   // 编译网格（米）

function snap(v) { return Math.round(v / CS) * CS; }

/**
 * @param {object} spec 见 dust2.js 的用法
 * @returns 标准地图数据对象（brushes/props/spawns/...）
 */
export function buildFloorplan(spec) {
  const b = spec.bounds;
  const baseY = b.min[1];
  const ox = snap(b.min[0]), oz = snap(b.min[2]);
  const nx = Math.ceil((b.max[0] - ox) / CS) + 2;
  const nz = Math.ceil((b.max[2] - oz) / CS) + 2;
  const key = (ix, iz) => iz * nx + ix;
  const ixOf = (x) => Math.round((x - ox) / CS);
  const izOf = (z) => Math.round((z - oz) / CS);

  const open = new Map();   // cellKey -> { floorMin, floorMax, top, room }
  const rooms = spec.rooms || [];

  for (const r of rooms) {
    const x0 = snap(Math.min(r.x0, r.x1)), x1 = snap(Math.max(r.x0, r.x1));
    const z0 = snap(Math.min(r.z0, r.z1)), z1 = snap(Math.max(r.z0, r.z1));
    const y = r.y === undefined ? 0 : r.y;
    const h = r.h === undefined ? 4 : r.h;
    r._x0 = x0; r._x1 = x1; r._z0 = z0; r._z1 = z1; r._y = y; r._h = h;
    for (let iz = izOf(z0); iz < izOf(z1); iz++) {
      for (let ix = ixOf(x0); ix < ixOf(x1); ix++) {
        const k = key(ix, iz);
        const cur = open.get(k);
        if (!cur) {
          open.set(k, { floorMin: y, floorMax: y, top: y + h, room: r });
        } else {
          cur.floorMin = Math.min(cur.floorMin, y);
          cur.floorMax = Math.max(cur.floorMax, y);
          cur.top = Math.max(cur.top, y + h);
          if (y > cur.room._y) cur.room = r;
        }
      }
    }
  }

  const brushes = [];

  // ---- 1) 地板（实心，向下填到地图底部；也可指定厚度） ----
  for (const r of rooms) {
    if (r.noFloor) continue;
    const bottom = r.floorThick !== undefined ? r._y - r.floorThick : baseY;
    brushes.push({
      min: [r._x0, bottom, r._z0], max: [r._x1, r._y, r._z1],
      mat: r.floor || 'concrete', tile: r.floorTile,
      nodraw: r.floorNodraw || (r.floorThick === undefined ? ['-y'] : null),
    });
  }

  // ---- 2) 天花板 ----
  for (const r of rooms) {
    if (!r.ceil) continue;
    brushes.push({
      min: [r._x0, r._y + r._h, r._z0], max: [r._x1, r._y + r._h + 0.5, r._z1],
      mat: r.ceil === true ? (r.wall || 'concrete') : r.ceil, tile: r.ceilTile,
      nodraw: ['+y'],
    });
  }

  // ---- 3) 墙壳 ----
  const wall = new Map();   // cellKey -> { top, mat }
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [k, cell] of open) {
    const iz = Math.floor(k / nx), ix = k - iz * nx;
    for (const [dx, dz] of N4) {
      const jx = ix + dx, jz = iz + dz;
      if (jx < 0 || jz < 0 || jx >= nx || jz >= nz) continue;
      const jk = key(jx, jz);
      if (open.has(jk)) continue;
      const w = wall.get(jk);
      const mat = cell.room.wall || 'concrete';
      const top = cell.top;
      if (!w) wall.set(jk, { top, mat, tile: cell.room.wallTile });
      else if (top > w.top) { w.top = top; w.mat = mat; w.tile = cell.room.wallTile; }
    }
  }

  // 洞口（门/窗）：把墙格的竖直区间切开
  const holes = spec.holes || [];
  const segsFor = (ix, iz, top) => {
    let segs = [[baseY, top]];
    const x0 = ox + ix * CS, x1 = x0 + CS;
    const z0 = oz + iz * CS, z1 = z0 + CS;
    for (const h of holes) {
      const hx0 = Math.min(h.x0, h.x1), hx1 = Math.max(h.x0, h.x1);
      const hz0 = Math.min(h.z0, h.z1), hz1 = Math.max(h.z0, h.z1);
      if (x1 <= hx0 || x0 >= hx1 || z1 <= hz0 || z0 >= hz1) continue;
      const hb = h.bottom === undefined ? baseY : h.bottom;
      const ht = h.top === undefined ? top : h.top;
      const out = [];
      for (const [a, c] of segs) {
        if (ht <= a || hb >= c) { out.push([a, c]); continue; }
        if (hb > a) out.push([a, hb]);
        if (ht < c) out.push([ht, c]);
      }
      segs = out;
    }
    return segs;
  };

  // 收集墙格的分段信息，按 (mat, segs) 分组后做贪心矩形合并
  const wallCells = new Map();
  for (const [k, w] of wall) {
    const iz = Math.floor(k / nx), ix = k - iz * nx;
    const segs = segsFor(ix, iz, w.top);
    if (!segs.length) continue;
    const sig = w.mat + '|' + (w.tile === undefined ? '' : w.tile) + '|' +
      segs.map((s) => s[0].toFixed(2) + ':' + s[1].toFixed(2)).join(';');
    wallCells.set(k, { ix, iz, segs, mat: w.mat, tile: w.tile, sig });
  }
  const used = new Set();
  const cellAt = (ix, iz) => wallCells.get(key(ix, iz));
  for (const [k, c] of wallCells) {
    if (used.has(k)) continue;
    // 向 +x 扩
    let w = 1;
    while (true) {
      const n = cellAt(c.ix + w, c.iz);
      if (!n || used.has(key(c.ix + w, c.iz)) || n.sig !== c.sig) break;
      w++;
    }
    // 向 +z 扩（整行都要匹配）
    let d = 1;
    outer: while (true) {
      for (let i = 0; i < w; i++) {
        const n = cellAt(c.ix + i, c.iz + d);
        if (!n || used.has(key(c.ix + i, c.iz + d)) || n.sig !== c.sig) break outer;
      }
      d++;
    }
    for (let j = 0; j < d; j++) for (let i = 0; i < w; i++) used.add(key(c.ix + i, c.iz + j));
    const x0 = ox + c.ix * CS, x1 = x0 + w * CS;
    const z0 = oz + c.iz * CS, z1 = z0 + d * CS;
    for (const [a, t] of c.segs) {
      if (t - a < 0.01) continue;
      brushes.push({ min: [x0, a, z0], max: [x1, t, z1], mat: c.mat, tile: c.tile });
    }
  }

  // ---- 4) 楼梯 ----
  for (const s of spec.stairs || []) {
    const steps = s.steps || Math.max(1, Math.round(Math.abs(s.to - s.from) / 0.35));
    const x0 = Math.min(s.x0, s.x1), x1 = Math.max(s.x0, s.x1);
    const z0 = Math.min(s.z0, s.z1), z1 = Math.max(s.z0, s.z1);
    const along = s.dir === '+x' || s.dir === '-x' ? 'x' : 'z';
    const len = along === 'x' ? x1 - x0 : z1 - z0;
    const stepLen = len / steps;
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      const y = s.from + (s.to - s.from) * t;
      let a0, a1;
      if (s.dir === '+x') { a0 = x0 + i * stepLen; a1 = x1; }
      else if (s.dir === '-x') { a0 = x0; a1 = x1 - i * stepLen; }
      else if (s.dir === '+z') { a0 = z0 + i * stepLen; a1 = z1; }
      else { a0 = z0; a1 = z1 - i * stepLen; }
      const min = along === 'x' ? [a0, Math.min(s.from, y) - 1.2, z0] : [x0, Math.min(s.from, y) - 1.2, a0];
      const max = along === 'x' ? [a1, y, z1] : [x1, y, a1];
      brushes.push({ min, max, mat: s.mat || 'concrete', tile: s.tile });
    }
  }

  // ---- 5) 作者手写的额外 brush ----
  for (const e of spec.extra || []) brushes.push(e);

  // ---- 6) 报点区域：同名房间合并成一个 bbox ----
  const areaMap = new Map();
  for (const r of rooms) {
    if (!r.name) continue;
    const a = areaMap.get(r.name);
    const min = [r._x0, r._y - 0.5, r._z0];
    const max = [r._x1, r._y + Math.min(r._h, 6), r._z1];
    if (!a) areaMap.set(r.name, { name: r.name, min, max });
    else {
      for (let i = 0; i < 3; i++) {
        a.min[i] = Math.min(a.min[i], min[i]);
        a.max[i] = Math.max(a.max[i], max[i]);
      }
    }
  }
  const areas = spec.areas ? spec.areas.slice() : [];
  for (const a of areaMap.values()) areas.push(a);

  return {
    id: spec.id, name: spec.name, nameCN: spec.nameCN, mode: spec.mode || 'bomb',
    sky: spec.sky, bounds: spec.bounds,
    brushes, props: spec.props || [], lights: spec.lights || [],
    spawns: spec.spawns, bombsites: spec.bombsites || [], buyzones: spec.buyzones,
    areas,
    _rooms: rooms.map((r) => ({ name: r.name, x0: r._x0, x1: r._x1, z0: r._z0, z1: r._z1, y: r._y, h: r._h })),
  };
}

/** 便捷：生成一排掩体箱子 */
export function crateRow(x, y, z, n, size = 1.0, dir = '+x', mat = 'crate', gap = 0) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const off = i * (size + gap);
    out.push({
      type: 'crate', mat,
      pos: dir === '+x' ? [x + off, y, z] : [x, y, z + off],
      size: [size, size, size],
    });
  }
  return out;
}
