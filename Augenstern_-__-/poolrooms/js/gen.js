// ============ 有限世界生成 (手工设计地图 · 宫殿版) ============
// 地图 8x6 区域 (192m x 144m)。南侧低矮走廊 (3.4m) → 门厅 (阶梯升高)
// → 120m x 96m 宫殿大厅 (26m 挑高, 柱廊 / 环廊 / 旋转楼梯 / 大台阶 / 穹顶天窗)。
// 小空间与超宏大空间无缝连接, 两翼为泳池房间群。
const Gen = (() => {
  const AREA = 24;
  const WALL_H = 10;
  const MAP_W = 8, MAP_D = 6;
  const PAL_X0 = 2, PAL_X1 = 6;   // 宫殿 ax 2..6 (x 48..168, 宽 120m)
  const PAL_Z0 = 0, PAL_Z1 = 3;   // 宫殿 az 0..3 (z 0..96, 深 96m)
  const PAL_H = 26;               // 宫殿层高
  const GAL_Y = 10;               // 二层环廊地面高度
  const SPAWN = { x: 108, z: 138, yaw: 0 }; // 南入口走廊, 面向北 (-z)
  let seed = 20260716;

  function setSeed(s) { seed = s >>> 0; }
  function hash(a, b, k = 0) {
    let h = (a | 0) * 374761393 + (b | 0) * 668265263 + (k | 0) * 2246822519 + seed * 40503;
    h = (h ^ (h >>> 13)) >>> 0;
    h = (h * 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function inBounds(ax, az) { return ax >= 0 && ax < MAP_W && az >= 0 && az < MAP_D; }
  function inPalace(ax, az) { return ax >= PAL_X0 && ax <= PAL_X1 && az >= PAL_Z0 && az <= PAL_Z1; }

  function areaType(ax, az) {
    if (!inBounds(ax, az)) return 'void';
    if (inPalace(ax, az)) return 'palace';
    if (az === 4) {
      if (ax === 4) return 'gatehall';
      return hash(ax, az, 1) < 0.5 ? 'pillars' : 'shallow';
    }
    if (az === 5) return ax === 4 ? 'entry' : 'corridor';
    const h = hash(ax, az, 1);
    if (h < 0.30) return 'bigpool';
    if (h < 0.55) return 'shallow';
    if (h < 0.78) return 'deeppool';
    return 'pillars';
  }

  // ============ 宫殿整体几何 (宫殿局部坐标 0..120 x 0..96, 北=z0) ============
  let palaceCache = null;
  function palaceBoxes() {
    if (palaceCache) return palaceCache;
    const B = [];
    const bx = (x0, y0, z0, x1, y1, z1, mat = 'marble') => B.push({ x0, y0, z0, x1, y1, z1, mat });
    const W = 120, D = 96, T = 0.6, H = PAL_H;

    // ---- 地面 (环绕中央大池) ----
    bx(0, -0.5, 0, W, 0, 36, 'tile');
    bx(0, -0.5, 64, W, 0, D, 'tile');
    bx(0, -0.5, 36, 36, 0, 64, 'tile');
    bx(84, -0.5, 36, W, 0, 64, 'tile');

    // ---- 中央大池 (48m x 28m, 深 2.2m) ----
    bx(36, -2.7, 36, 84, -2.2, 64, 'pool');            // 池底
    bx(36, -2.2, 36, 84, 0, 36.3, 'pool');             // 北壁
    bx(36, -2.2, 63.7, 84, 0, 64, 'pool');             // 南壁
    bx(36, -2.2, 36, 36.3, 0, 64, 'pool');             // 西壁
    bx(83.7, -2.2, 36, 84, 0, 64, 'pool');             // 东壁
    // 中岛 + 南北双桥
    bx(56, -2.2, 46, 64, 0.02, 54, 'marble');
    bx(58, -0.3, 36.3, 62, 0, 46, 'marble');
    bx(58, -0.3, 54, 62, 0, 63.7, 'marble');
    // 西侧入水台阶
    for (let i = 0; i < 4; i++) {
      bx(36.3, -0.44 * (i + 1), 36.3 + i * 0.5, 39.5, -0.44 * i, 36.3 + (i + 1) * 0.5 + 2.2, 'pool');
    }
    // 大理石池沿 (桥处留口)
    bx(35.5, 0, 35.5, 58, 0.12, 36); bx(62, 0, 35.5, 84.5, 0.12, 36);
    bx(35.5, 0, 64, 58, 0.12, 64.5); bx(62, 0, 64, 84.5, 0.12, 64.5);
    bx(35.5, 0, 36, 36, 0.12, 64); bx(84, 0, 36, 84.5, 0.12, 64);

    // ---- 外墙 (26m 高) ----
    bx(0, 0, 0, W, H, T, 'tile');                       // 北墙
    // 西墙: 两个 6m 门洞 (z 33..39 / 57..63, 高 4.6) 通向西翼房间群
    bx(0, 0, 0, T, H, 33, 'tile'); bx(0, 0, 39, T, H, 57, 'tile'); bx(0, 0, 63, T, H, D, 'tile');
    bx(0, 4.6, 33, T, H, 39, 'tile'); bx(0, 4.6, 57, T, H, 63, 'tile');
    // 东墙 (镜像)
    bx(W - T, 0, 0, W, H, 33, 'tile'); bx(W - T, 0, 39, W, H, 57, 'tile'); bx(W - T, 0, 63, W, H, D, 'tile');
    bx(W - T, 4.6, 33, W, H, 39, 'tile'); bx(W - T, 4.6, 57, W, H, 63, 'tile');
    // 南墙: 中央 12m 宽 12m 高大门 (x 54..66)
    bx(0, 0, D - T, 54, H, D, 'tile'); bx(66, 0, D - T, W, H, D, 'tile');
    bx(54, 12, D - T, 66, H, D, 'tile');
    // 大门大理石门套
    bx(52.8, 0, D - 1.4, 54, 12.4, D, 'marble');
    bx(66, 0, D - 1.4, 67.2, 12.4, D, 'marble');
    bx(52.8, 12, D - 1.4, 67.2, 13.4, D, 'marble');

    // ---- 二层环廊 (y 9.6..10, 宽 4.5m) ----
    bx(T, GAL_Y - 0.4, T, 5.1, GAL_Y, D - T);            // 西
    bx(W - 5.1, GAL_Y - 0.4, T, W - T, GAL_Y, D - T);    // 东
    bx(5.1, GAL_Y - 0.4, T, W - 5.1, GAL_Y, 5.1);        // 北
    bx(5.1, GAL_Y - 0.4, D - 5.1, 52, GAL_Y, D - T);     // 南西段 (大门上方留空)
    bx(68, GAL_Y - 0.4, D - 5.1, W - 5.1, GAL_Y, D - T); // 南东段
    // 环廊栏杆 (1m 高)
    bx(5.1, GAL_Y, 5.1, 5.35, GAL_Y + 1, D - 5.1);
    bx(W - 5.35, GAL_Y, 5.1, W - 5.1, GAL_Y + 1, D - 5.1);
    bx(5.1, GAL_Y, 5.1, W - 5.1, GAL_Y + 1, 5.35);
    bx(5.1, GAL_Y, D - 5.35, 52, GAL_Y + 1, D - 5.1);
    bx(68, GAL_Y, D - 5.35, W - 5.1, GAL_Y + 1, D - 5.1);
    bx(52, GAL_Y, D - 5.35, 52.25, GAL_Y + 1, D - T);
    bx(67.75, GAL_Y, D - 5.35, 68, GAL_Y + 1, D - T);

    // ---- 中殿巨柱 (两列 9 根, 22.5m 高, 带柱础柱头) ----
    const col = (cx, cz, s, y0, y1) => {
      bx(cx - s - 0.3, y0, cz - s - 0.3, cx + s + 0.3, y0 + 0.7, cz + s + 0.3);
      bx(cx - s, y0 + 0.7, cz - s, cx + s, y1 - 1.4, cz + s);
      bx(cx - s - 0.3, y1 - 1.4, cz - s - 0.3, cx + s + 0.3, y1, cz + s + 0.3);
    };
    for (const cz of [12, 21.5, 31, 40.5, 50, 59.5, 69, 78.5, 88]) {
      col(30, cz, 0.9, 0, 24);
      col(90, cz, 0.9, 0, 24);
    }
    // 二层环廊小柱列
    for (const cz of [10, 22, 34, 46, 58, 70, 82]) {
      col(2.85, cz, 0.45, GAL_Y, H - 1);
      col(W - 2.85, cz, 0.45, GAL_Y, H - 1);
    }

    // ---- 北端大台阶 + 高台 + 凉亭 ----
    bx(24, 0, 4, 96, 3.2, 24);                           // 高台
    for (let i = 0; i < 10; i++) {                       // 10 级大台阶 (下行向南)
      bx(30, 0, 24 + i * 0.8, 90, 3.2 - i * 0.32, 24 + (i + 1) * 0.8);
    }
    for (const cx of [38, 49, 60, 71, 82]) {             // 凉亭双列柱
      col(cx, 8, 0.6, 3.2, 13);
      col(cx, 20, 0.6, 3.2, 13);
    }
    bx(34, 13, 5, 86, 14.2, 23);                         // 凉亭顶板
    bx(36, 14.2, 7, 84, 15, 21, 'conc');                 // 顶部收头

    // ---- 旋转楼梯 x2 (南侧两角, 登上环廊) ----
    const spiral = (cx, cz, endA) => {
      bx(cx - 0.75, 0, cz - 0.75, cx + 0.75, GAL_Y + 0.6, cz + 0.75); // 中柱
      const rise = 0.26, da = 0.42, R = 2.0;
      for (let i = 0; i < 40; i++) {
        const top = GAL_Y - i * rise;
        if (top < 0.35) break;
        const a = endA - i * da;
        const sx = cx + Math.cos(a) * R, sz = cz + Math.sin(a) * R;
        bx(sx - 0.85, top - 0.3, sz - 0.85, sx + 0.85, top, sz + 0.85);
      }
    };
    spiral(9, 85, Math.PI);                              // 西南塔 (终点朝西接环廊)
    bx(4.6, GAL_Y - 0.4, 82.5, 9, GAL_Y, 87.5);          // 西平台
    spiral(111, 85, 0);                                  // 东南塔
    bx(111, GAL_Y - 0.4, 82.5, 115.4, GAL_Y, 87.5);      // 东平台

    // ---- 檐口线脚 ----
    bx(T, 23.5, T, 2.0, 24.3, D - T);
    bx(W - 2.0, 23.5, T, W - T, 24.3, D - T);
    bx(T, 23.5, T, W - T, 24.3, 2.0);
    bx(T, 23.5, D - 2.0, W - T, 24.3, D - T);

    // ---- 顶板 + 中央天窗 (池上方开口, 光井梁架) ----
    bx(0, H, 0, W, H + 0.8, 32, 'conc');
    bx(0, H, 68, W, H + 0.8, D, 'conc');
    bx(0, H, 32, 32, H + 0.8, 68, 'conc');
    bx(88, H, 32, W, H + 0.8, 68, 'conc');
    for (const bz of [40, 48, 56]) bx(32, H, bz - 0.3, 88, H + 1, bz + 0.3, 'conc');
    for (const bxx of [46, 60, 74]) bx(bxx - 0.3, H, 32, bxx + 0.3, H + 1, 68, 'conc');

    palaceCache = B;
    return B;
  }

  // 宫殿按区域裁剪 (碰撞与分区渲染都以 24m 区域为单位)
  function describePalaceCell(ax, az) {
    const lx0 = (ax - PAL_X0) * AREA, lz0 = (az - PAL_Z0) * AREA;
    const boxes = [];
    for (const b of palaceBoxes()) {
      const x0 = Math.max(b.x0, lx0), x1 = Math.min(b.x1, lx0 + AREA);
      const z0 = Math.max(b.z0, lz0), z1 = Math.min(b.z1, lz0 + AREA);
      if (x1 - x0 <= 0.001 || z1 - z0 <= 0.001) continue;
      boxes.push({ x0: x0 - lx0, y0: b.y0, z0: z0 - lz0, x1: x1 - lx0, y1: b.y1, z1: z1 - lz0, mat: b.mat });
    }
    let water = null;
    // 大池水体挂在 (4,2) 区域, 坐标可越界 (World 支持跨区查询)
    if (ax === 4 && az === 2) {
      water = { level: -0.25, x0: 84.3 - 96, z0: 36.3 - 48, x1: 131.7 - 96, z1: 63.7 - 48, depth: 1.95 };
    }
    return { type: 'palace', boxes, water };
  }

  return { setSeed, hash, areaType, describe, inBounds, inPalace,
           AREA, WALL_H, MAP_W, MAP_D, PAL_H, SPAWN };

  // describe 在下方补充定义 (函数声明提升)
  function describe(ax, az) {
    const type = areaType(ax, az);
    if (type === 'void') return { type, boxes: [], water: null };
    if (type === 'palace') return describePalaceCell(ax, az);

    const r = k => hash(ax, az, 100 + k);
    const boxes = [];
    let water = null;
    const F = 0.5;

    const addFloor = () => boxes.push({ x0: 0, y0: -F, z0: 0, x1: AREA, y1: 0, z1: AREA, mat: 'tile' });
    const addWalls = (doorH = 4.6) => {
      const dw = 6, d0 = (AREA - dw) / 2, d1 = (AREA + dw) / 2;
      const t = 0.4;
      [[-t, 0], [AREA, AREA + t]].forEach(([za, zb]) => {
        boxes.push({ x0: 0, y0: 0, z0: za, x1: d0, y1: WALL_H, z1: zb, mat: 'tile' });
        boxes.push({ x0: d1, y0: 0, z0: za, x1: AREA, y1: WALL_H, z1: zb, mat: 'tile' });
        boxes.push({ x0: d0, y0: doorH, z0: za, x1: d1, y1: WALL_H, z1: zb, mat: 'tile' });
      });
      [[-t, 0], [AREA, AREA + t]].forEach(([xa, xb]) => {
        boxes.push({ x0: xa, y0: 0, z0: 0, x1: xb, y1: WALL_H, z1: d0, mat: 'tile' });
        boxes.push({ x0: xa, y0: 0, z0: d1, x1: xb, y1: WALL_H, z1: AREA, mat: 'tile' });
        boxes.push({ x0: xa, y0: doorH, z0: d0, x1: xb, y1: WALL_H, z1: d1, mat: 'tile' });
      });
    };
    const addCeiling = (style = 'square') => {
      const t = 0.45;
      if (style === 'square') {
        const s = 10 + r(3) * 6, a0 = (AREA - s) / 2, a1 = (AREA + s) / 2;
        boxes.push({ x0: 0, y0: WALL_H, z0: 0, x1: AREA, y1: WALL_H + t, z1: a0, mat: 'conc' });
        boxes.push({ x0: 0, y0: WALL_H, z0: a1, x1: AREA, y1: WALL_H + t, z1: AREA, mat: 'conc' });
        boxes.push({ x0: 0, y0: WALL_H, z0: a0, x1: a0, y1: WALL_H + t, z1: a1, mat: 'conc' });
        boxes.push({ x0: a1, y0: WALL_H, z0: a0, x1: AREA, y1: WALL_H + t, z1: a1, mat: 'conc' });
      } else {
        const n = 4, gap = 2.2;
        const bw = (AREA - gap * (n - 1)) / n;
        for (let i = 0; i < n; i++) {
          const z0 = i * (bw + gap);
          boxes.push({ x0: 0, y0: WALL_H, z0, x1: AREA, y1: WALL_H + t, z1: z0 + bw, mat: 'conc' });
        }
      }
    };
    const column = (cx, cz, s = 0.55, h = WALL_H, y0 = 0) =>
      boxes.push({ x0: cx - s, y0, z0: cz - s, x1: cx + s, y1: h, z1: cz + s, mat: 'tile' });

    if (type === 'gatehall') buildGatehall(boxes, w => water = w);
    else if (type === 'entry') buildEntry(boxes);
    else if (type === 'corridor') {
      addFloor();
      const cw = 4.5, c0 = (AREA - cw) / 2, c1 = (AREA + cw) / 2;
      const lowH = 3.4;
      [[0, 0, c0, c0], [c1, 0, AREA, c0], [0, c1, c0, AREA], [c1, c1, AREA, AREA]].forEach(([x0, z0, x1, z1]) => {
        boxes.push({ x0, y0: 0, z0, x1, y1: lowH, z1, mat: 'tile' });
      });
      boxes.push({ x0: 0, y0: lowH, z0: 0, x1: AREA, y1: lowH + 0.4, z1: AREA, mat: 'conc' });
      if (r(9) < 0.5) {
        const depth = 0.18;
        boxes.push({ x0: c0, y0: -depth - F, z0: c0, x1: c1, y1: -depth, z1: c1, mat: 'pool' });
        water = { level: -0.06, x0: c0, z0: c0, x1: c1, z1: c1, depth };
        boxes.push({ x0: c0, y0: -F, z0: 0, x1: c1, y1: 0, z1: c0, mat: 'tile' });
        boxes.push({ x0: c0, y0: -F, z0: c1, x1: c1, y1: 0, z1: AREA, mat: 'tile' });
        boxes.push({ x0: 0, y0: -F, z0: c0, x1: c0, y1: 0, z1: c1, mat: 'tile' });
        boxes.push({ x0: c1, y0: -F, z0: c0, x1: AREA, y1: 0, z1: c1, mat: 'tile' });
      }
    }
    else if (type === 'bigpool') {
      const p = 4;
      addWalls(); addCeiling('square');
      boxes.push({ x0: 0, y0: -F, z0: 0, x1: AREA, y1: 0, z1: p, mat: 'tile' });
      boxes.push({ x0: 0, y0: -F, z0: AREA - p, x1: AREA, y1: 0, z1: AREA, mat: 'tile' });
      boxes.push({ x0: 0, y0: -F, z0: p, x1: p, y1: 0, z1: AREA - p, mat: 'tile' });
      boxes.push({ x0: AREA - p, y0: -F, z0: p, x1: AREA, y1: 0, z1: AREA - p, mat: 'tile' });
      const depth = 2.0;
      boxes.push({ x0: p, y0: -depth - F, z0: p, x1: AREA - p, y1: -depth, z1: AREA - p, mat: 'pool' });
      boxes.push({ x0: p, y0: -depth, z0: p, x1: AREA - p, y1: 0, z1: p + 0.3, mat: 'pool' });
      boxes.push({ x0: p, y0: -depth, z0: AREA - p - 0.3, x1: AREA - p, y1: 0, z1: AREA - p, mat: 'pool' });
      boxes.push({ x0: p, y0: -depth, z0: p, x1: p + 0.3, y1: 0, z1: AREA - p, mat: 'pool' });
      boxes.push({ x0: AREA - p - 0.3, y0: -depth, z0: p, x1: AREA - p, y1: 0, z1: AREA - p, mat: 'pool' });
      for (let i = 0; i < 4; i++) {
        boxes.push({ x0: p, y0: -0.4 * (i + 1), z0: p + i * 0.45, x1: p + 3, y1: -0.4 * i, z1: p + (i + 1) * 0.45, mat: 'pool' });
      }
      water = { level: -0.25, x0: p + 0.28, z0: p + 0.28, x1: AREA - p - 0.28, z1: AREA - p - 0.28, depth };
    }
    else if (type === 'deeppool') {
      const p = 2.5;
      addWalls(); addCeiling('square');
      boxes.push({ x0: 0, y0: -F, z0: 0, x1: AREA, y1: 0, z1: p, mat: 'tile' });
      boxes.push({ x0: 0, y0: -F, z0: AREA - p, x1: AREA, y1: 0, z1: AREA, mat: 'tile' });
      boxes.push({ x0: 0, y0: -F, z0: p, x1: p, y1: 0, z1: AREA - p, mat: 'tile' });
      boxes.push({ x0: AREA - p, y0: -F, z0: p, x1: AREA, y1: 0, z1: AREA - p, mat: 'tile' });
      const depth = 3.6;
      boxes.push({ x0: p, y0: -depth - F, z0: p, x1: AREA - p, y1: -depth, z1: AREA - p, mat: 'pool' });
      boxes.push({ x0: p, y0: -depth, z0: p, x1: AREA - p, y1: 0, z1: p + 0.3, mat: 'pool' });
      boxes.push({ x0: p, y0: -depth, z0: AREA - p - 0.3, x1: AREA - p, y1: 0, z1: AREA - p, mat: 'pool' });
      boxes.push({ x0: p, y0: -depth, z0: p, x1: p + 0.3, y1: 0, z1: AREA - p, mat: 'pool' });
      boxes.push({ x0: AREA - p - 0.3, y0: -depth, z0: p, x1: AREA - p, y1: 0, z1: AREA - p, mat: 'pool' });
      if (r(5) < 0.75) {
        const cx = AREA / 2 + (r(6) - 0.5) * 6, cz = AREA / 2 + (r(7) - 0.5) * 6;
        boxes.push({ x0: cx - 1.6, y0: -depth, z0: cz - 1.6, x1: cx + 1.6, y1: 0.02, z1: cz + 1.6, mat: 'tile' });
      }
      water = { level: -0.2, x0: p + 0.28, z0: p + 0.28, x1: AREA - p - 0.28, z1: AREA - p - 0.28, depth };
    }
    else if (type === 'shallow') {
      addWalls(); addCeiling('strips');
      const depth = 0.42;
      boxes.push({ x0: 0, y0: -depth - F, z0: 0, x1: AREA, y1: -depth, z1: AREA, mat: 'pool' });
      const dw = 7, d0 = (AREA - dw) / 2, d1 = (AREA + dw) / 2;
      [[d0, 0, d1, 3.5], [d0, AREA - 3.5, d1, AREA], [0, d0, 3.5, d1], [AREA - 3.5, d0, AREA, d1]].forEach(([x0, z0, x1, z1]) => {
        boxes.push({ x0, y0: -depth, z0, x1, y1: 0, z1, mat: 'tile' });
      });
      const n = 3 + (r(8) * 4) | 0;
      for (let i = 0; i < n; i++) {
        const w = 3 + r(10 + i) * 4.5, d = 3 + r(20 + i) * 4.5;
        const x = 3 + r(30 + i) * (AREA - 6 - w), z = 3 + r(40 + i) * (AREA - 6 - d);
        boxes.push({ x0: x, y0: -depth, z0: z, x1: x + w, y1: 0.02, z1: z + d, mat: 'tile' });
        if (r(60 + i) < 0.6) column(x + w / 2, z + d / 2, 0.55);
      }
      water = { level: -0.12, x0: 0.3, z0: 0.3, x1: AREA - 0.3, z1: AREA - 0.3, depth };
    }
    else { // pillars
      addFloor();
      addWalls();
      addCeiling(r(11) < 0.5 ? 'square' : 'strips');
      const n = 4;
      const gap = AREA / (n + 1);
      for (let i = 1; i <= n; i++) for (let j = 1; j <= n; j++) {
        if (r(50 + i * 7 + j) < 0.18) continue;
        column(i * gap, j * gap, 0.7);
      }
    }

    addBoundary(ax, az, boxes);
    return { type, boxes, water };
  }

  // ---------- 门厅 (小→大过渡: 天花 4.5m → 6.5m → 8.6m, 两侧水槽) ----------
  function buildGatehall(boxes, setWater) {
    const bx = (x0, y0, z0, x1, y1, z1, mat = 'tile') => boxes.push({ x0, y0, z0, x1, y1, z1, mat });
    // 中央走道地面 + 两侧端头
    bx(4, -0.5, 0, 20, 0, 24);
    bx(0.4, -0.5, 0, 4, 0, 2); bx(0.4, -0.5, 22, 4, 0, 24);
    bx(20, -0.5, 0, 23.6, 0, 2); bx(20, -0.5, 22, 23.6, 0, 24);
    // 两侧浅水槽 (深 0.35)
    bx(0.4, -0.85, 2, 4, -0.35, 22, 'pool');
    bx(3.7, -0.35, 2, 4, 0, 22, 'pool');
    bx(0.4, -0.35, 2, 4, 0, 2.3, 'pool'); bx(0.4, -0.35, 21.7, 4, 0, 22, 'pool');
    bx(20, -0.85, 2, 23.6, -0.35, 22, 'pool');
    bx(20, -0.35, 2, 20.3, 0, 22, 'pool');
    bx(20, -0.35, 2, 23.6, 0, 2.3, 'pool'); bx(20, -0.35, 21.7, 23.6, 0, 22, 'pool');
    // 侧墙 (下探封住水槽外缘)
    bx(0, -1, 0, 0.4, 9.2, 24); bx(23.6, -1, 0, 24, 9.2, 24);
    // 南墙 (6m 门洞, 3.2m 高, 通往入口走廊)
    bx(0, 0, 23.6, 9, 5.1, 24); bx(15, 0, 23.6, 24, 5.1, 24); bx(9, 3.2, 23.6, 15, 5.1, 24);
    // 阶梯抬升的天花 (由南向北 4.5 → 6.5 → 8.6)
    bx(0, 4.5, 16, 24, 5.1, 24, 'conc');
    bx(0, 6.5, 8, 24, 7.1, 16, 'conc');
    bx(0, 8.6, 0, 24, 9.2, 8, 'conc');
    // 天花过渡竖板
    bx(0, 5.1, 15.6, 24, 6.5, 16, 'conc');
    bx(0, 7.1, 7.6, 24, 8.6, 8, 'conc');
    // 走道列柱 (大理石)
    for (const cz of [5, 11, 17]) {
      bx(4.7, 0, cz - 0.5, 5.7, 4.4, cz + 0.5, 'marble');
      bx(18.3, 0, cz - 0.5, 19.3, 4.4, cz + 0.5, 'marble');
    }
    setWater({ level: -0.12, x0: 0.4, z0: 2, x1: 23.6, z1: 22, depth: 0.23 });
  }

  // ---------- 入口走廊 (3.4m 低矮, 6m 宽, 出生点所在) ----------
  function buildEntry(boxes) {
    const bx = (x0, y0, z0, x1, y1, z1, mat = 'tile') => boxes.push({ x0, y0, z0, x1, y1, z1, mat });
    bx(0, -0.5, 0, 24, 0, 24);
    bx(0, 0, 0, 9, 3.4, 24); bx(15, 0, 0, 24, 3.4, 24);
    bx(0, 3.4, 0, 24, 3.9, 24, 'conc');
    // 壁龛节奏 (走廊两侧凹龛)
    for (const nz of [4, 10, 16]) {
      bx(8.7, 0.9, nz, 9, 2.6, nz + 2, 'conc');
      bx(15, 0.9, nz, 15.3, 2.6, nz + 2, 'conc');
    }
  }

  // ---------- 地图边界墙 ----------
  function addBoundary(ax, az, boxes) {
    const t = 0.5, H = WALL_H;
    if (ax === 0) boxes.push({ x0: -t, y0: -1, z0: -t, x1: 0, y1: H, z1: AREA + t, mat: 'tile' });
    if (ax === MAP_W - 1) boxes.push({ x0: AREA, y0: -1, z0: -t, x1: AREA + t, y1: H, z1: AREA + t, mat: 'tile' });
    if (az === 0) boxes.push({ x0: -t, y0: -1, z0: -t, x1: AREA + t, y1: H, z1: 0, mat: 'tile' });
    if (az === MAP_D - 1) boxes.push({ x0: -t, y0: -1, z0: AREA, x1: AREA + t, y1: H, z1: AREA + t, mat: 'tile' });
  }
})();
