// ============================================================================
//  compile.js —— 把字符网格关卡编译成渲染器吃的世界结构
//  · 一个字符 = 一格：要么是墙（可四面不同贴图），要么是可走地面（地+顶）
//  · 支持运行时改格（开门 / 长出走廊 / 换天花板）—— 梦核事件全靠它
// ============================================================================

import { prop } from '../gfx/props.js';

/** 全局图例：所有关卡共用 */
export const LEGEND = {
  // ——— 墙 ———
  '#': { wall: 'stair_wall' },
  A: { wall: 'stair_wall_ad' },
  K: { wall: 'stair_wall_chalk' },
  W: { wall: 'stair_window' },
  M: { wall: 'meter_box' },
  D: { wall: 'door_security' },
  d: { wall: 'door_security_open' },
  X: { wall: 'mosaic_ext' },
  c: { wall: 'concrete' },
  h: { wall: 'home_wall' },
  l: { wall: 'home_wall_calendar' },
  p: { wall: 'home_wall_picture' },
  Y: { wall: 'cabinet_yellow' },
  G: { wall: 'cabinet_glass' },
  n: { wall: 'wood_panel' },
  t: { wall: 'kitchen_tile' },
  f: { wall: 'door_glass_frost' },
  w: { wall: 'door_wood' },
  R: { wall: 'mirror_wall' },
  q: { wall: 'glass_curtain' },
  Q: { wall: 'glass_curtain_lit' },
  m: { wall: 'marble_wall' },
  B: { wall: 'banner_wall' },
  g: { wall: 'dougong' },
  E: { wall: 'elevator' },
  T: { wall: 'tower_wall' },
  V: { wall: 'tv_static_wall' },
  P: { wall: 'roof_parapet', h: 1.15 },     // 女儿墙只有一米一，能看到天际线
  // 双面墙：厨房一侧贴砖，卧室一侧刷漆
  j: { wall: { n: 'home_wall', s: 'kitchen_tile', e: 'home_wall', w: 'kitchen_tile' } },
  // 双面墙：楼道一侧是小广告，屋里一侧是暖白
  J: { wall: { n: 'home_wall', s: 'stair_wall_ad', e: 'stair_wall_ad', w: 'stair_wall_ad' } },

  // ——— 可走地面（地 + 顶）———
  //  带灯的天花另给一个字符：灯只出现在指定那一格，而不是每平米一盏
  '.': { floor: 'f_terrazzo', ceil: 'c_stair' },
  '!': { floor: 'f_terrazzo', ceil: 'c_stair_lamp' },
  ',': { floor: 'f_terrazzo', ceil: 'c_plain' },
  ';': { floor: 'f_mosaic', ceil: 'c_plain' },
  ':': { floor: 'f_mosaic', ceil: 'c_stair_lamp' },
  o: { floor: 'f_wood', ceil: 'c_home' },
  O: { floor: 'f_wood', ceil: 'c_home_lamp' },
  k: { floor: 'f_tile', ceil: 'c_home' },
  1: { floor: 'f_tile', ceil: 'c_home_lamp' },
  b: { floor: 'f_tile', ceil: 'c_glass' },
  _: { floor: 'f_marble', ceil: 'c_grid' },
  2: { floor: 'f_marble', ceil: 'c_grid_lamp' },
  '-': { floor: 'f_marble', ceil: 'c_glass' },
  '=': { floor: 'f_carpet', ceil: 'c_glass' },
  3: { floor: 'f_carpet', ceil: 'c_grid_lamp' },
  '~': { floor: 'f_marble', ceil: 'c_grid_dark' },
  '^': { floor: 'f_tile', ceil: 'c_home' },
  4: { floor: 'f_tile', ceil: 'c_home_lamp' },
  '*': { floor: 'f_roof', ceil: null },   // 露天
  '`': { floor: 'f_roof', ceil: 'c_plain' },
  5: { floor: 'f_roof', ceil: 'c_stair_lamp' },
};

function faces(def, h) {
  const base = typeof def === 'string' ? { all: def } : { ...def };
  base.all = base.all || base.n || base.s || base.e || base.w;
  if (h !== undefined) base.h = h;
  return base;
}

/** 空白字符网格 */
export function grid(w, h, fill = '#') {
  const g = [];
  for (let y = 0; y < h; y++) g.push(new Array(w).fill(fill));
  return g;
}

/** 矩形填充（含端点） */
export function box(g, x0, y0, x1, y1, ch) {
  for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
    if (!g[y]) continue;
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
      if (x >= 0 && x < g[y].length) g[y][x] = ch;
    }
  }
  return g;
}

/** 只画矩形的边（画墙用） */
export function outline(g, x0, y0, x1, y1, ch) {
  box(g, x0, y0, x1, y0, ch);
  box(g, x0, y1, x1, y1, ch);
  box(g, x0, y0, x0, y1, ch);
  box(g, x1, y0, x1, y1, ch);
  return g;
}

export function put(g, x, y, ch) { if (g[y] && x >= 0 && x < g[y].length) g[y][x] = ch; }

// ---------------------------------------------------------------------------

export function compile(def) {
  // 关卡以字符串行给出，这里转成可变的字符数组（运行时要改格）
  const chars = def.build().map((r) => (Array.isArray(r) ? r.slice() : [...r]));
  const h = chars.length, w = chars[0].length;
  const world = {
    id: def.id,
    name: def.name,
    w, h,
    chars,
    wallH: def.wallH ?? 2.6,        // 层高（格 = 1 米）
    walls: [], floors: [], ceils: [],
    amb: { ...def.amb },
    lights: (def.lights || []).map((l) => ({ ...l })),
    sprites: [],
    spawn: def.spawn,
    interactables: (def.interactables || []).map((i) => ({ ...i })),
    def,
  };
  for (let y = 0; y < h; y++) {
    world.walls.push(new Array(w).fill(null));
    world.floors.push(new Array(w).fill(null));
    world.ceils.push(new Array(w).fill(null));
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) setCell(world, x, y, chars[y][x]);
  }
  for (const s of def.sprites || []) world.sprites.push(makeSprite(s));
  return world;
}

export function makeSprite(s) {
  const t = prop(s.p);
  return {
    ...s,
    tex: t,
    hgt: s.hgt ?? t.h / 27,          // 27px ≈ 1 米（图里 46px 的人 ≈ 1.70m）
    base: s.base ?? 0,
    phase: s.phase ?? Math.random() * 6.283,
  };
}

/** 改一格（开门、把墙变通道、换天花） */
export function setCell(world, x, y, ch) {
  if (x < 0 || y < 0 || x >= world.w || y >= world.h) return;
  const L = LEGEND[ch];
  world.chars[y][x] = ch;
  if (!L) { world.walls[y][x] = null; return; }
  if (L.wall) {
    world.walls[y][x] = faces(L.wall, L.h);
    world.floors[y][x] = null;
    world.ceils[y][x] = null;
  } else {
    world.walls[y][x] = null;
    world.floors[y][x] = L.floor || null;
    world.ceils[y][x] = 'ceil' in L ? L.ceil : null;
  }
}

export function isSolid(world, x, y) {
  if (x < 0 || y < 0 || x >= world.w || y >= world.h) return true;
  return !!world.walls[y][x];
}

/** 圆形碰撞：墙 + 有 solid 半径的精灵 */
export function collides(world, px, py, r = 0.26) {
  const minX = Math.floor(px - r), maxX = Math.floor(px + r);
  const minY = Math.floor(py - r), maxY = Math.floor(py + r);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!isSolid(world, x, y)) continue;
      const cx = Math.max(x, Math.min(px, x + 1));
      const cy = Math.max(y, Math.min(py, y + 1));
      const dx = px - cx, dy = py - cy;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  for (const s of world.sprites) {
    if (!s.solid || s.hidden) continue;
    const dx = px - s.x, dy = py - s.y;
    const rr = s.solid + r;
    if (dx * dx + dy * dy < rr * rr) return true;
  }
  return false;
}
