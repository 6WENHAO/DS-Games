/* ===================================================================
   mapgen.js — 3D 随机地牢生成
   · 房间 + 2 格宽走廊，带高低差平台、不同层高、拱柱、火盆
   · 逐格烘焙点光 → 顶点色，营造 Doom 式明暗对比
   · 输出静态几何（MeshB）、敌人/道具刷新点、传送门、目标类型
   格子 (i,j) 覆盖世界 x∈[i,i+1], z∈[j,j+1]
   =================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U, MeshB = G.MeshB;

  /* --------------------------- 主题 --------------------------- */
  const THEMES = [
    {
      key: 'crypt', name: '腐尸回廊', depthFrom: 1,
      desc: '被遗弃的地下墓道。墙缝里塞着还在抽动的肉块，脚下的血迹永远不干。',
      wall: ['stone', 'stone', 'stoneBlood', 'stoneMoss'], floor: ['floor', 'floorDirt'],
      ceil: 'ceil', accent: 'bone', fog: 0.105, ambient: 0.66,
      lightCol: [1.0, 0.62, 0.26], fogCol: [0.012, 0.010, 0.014],
      enemies: ['ghoul', 'ghoul', 'hound', 'cultist'],
    },
    {
      key: 'ossuary', name: '祭骨大厅', depthFrom: 4,
      desc: '数千具尸骸被砌成墙。它们的头骨朝着同一个方向 —— 祭坛。',
      wall: ['bone', 'stone', 'bone', 'stoneBlood'], floor: ['floor', 'floorBlood'],
      ceil: 'ceil', accent: 'metal', fog: 0.10, ambient: 0.70,
      lightCol: [0.95, 0.72, 0.4], fogCol: [0.016, 0.014, 0.012],
      enemies: ['ghoul', 'hound', 'brute', 'cultist', 'wraith'],
    },
    {
      key: 'gut', name: '蚀之肉窖', depthFrom: 5,
      desc: '这里不是建筑，是某个东西的内部。墙壁随着呼吸起伏，你踩到的每一步都在下陷。',
      wall: ['flesh', 'flesh', 'stoneBlood', 'flesh'], floor: ['floorBlood', 'floorDirt'],
      ceil: 'flesh', accent: 'gore', fog: 0.125, ambient: 0.60,
      lightCol: [1.0, 0.34, 0.22], fogCol: [0.030, 0.006, 0.008],
      enemies: ['ghoul', 'brute', 'wraith', 'hound', 'cultist'],
    },
    {
      key: 'keep', name: '王城废墟', depthFrom: 9,
      desc: '曾经的骑士团总部。铁栅栏后堆着盔甲，里面的人早就成了别的东西。',
      wall: ['brick', 'metal', 'stone', 'grate'], floor: ['floor', 'floor'],
      ceil: 'ceil', accent: 'wood', fog: 0.095, ambient: 0.72,
      lightCol: [0.9, 0.78, 0.52], fogCol: [0.012, 0.012, 0.018],
      enemies: ['brute', 'cultist', 'wraith', 'ghoul', 'hound'],
    },
    {
      key: 'altar', name: '蚀 之 祭 坛', depthFrom: 12,
      desc: '日蚀之下，无数手臂从地面伸出。你终于站到了那个东西的面前。',
      wall: ['flesh', 'bone', 'rune', 'stoneBlood'], floor: ['floorBlood', 'floorBlood'],
      ceil: 'flesh', accent: 'rune', fog: 0.12, ambient: 0.58,
      lightCol: [1.0, 0.2, 0.14], fogCol: [0.045, 0.004, 0.006],
      enemies: ['brute', 'wraith', 'cultist', 'ghoul'],
    },
  ];

  const BOSS_DEPTHS = { 4: 'apostle', 8: 'bishop', 12: 'lord' };
  const MAX_DEPTH = 12;

  function themeFor(depth) {
    if (depth >= 12) return THEMES[4];
    if (depth >= 9) return THEMES[3];
    if (depth >= 5) return THEMES[2];
    if (depth >= 4) return THEMES[1];
    return THEMES[0];
  }

  /* --------------------------- Map 类 --------------------------- */
  class GameMap {
    constructor(w, h) {
      this.w = w; this.h = h;
      this.solid = new Uint8Array(w * h).fill(1);      // 1 = 实心
      this.wallTex = new Uint8Array(w * h);
      this.floorTex = new Uint8Array(w * h);
      this.floorH = new Float32Array(w * h);
      this.ceilH = new Float32Array(w * h).fill(3.0);
      this.light = new Float32Array(w * h);
      this.roomId = new Int16Array(w * h).fill(-1);
      this.rooms = [];
      this.props = [];
      this.lights = [];
      this.enemySpawns = [];
      this.itemSpawns = [];
      this.shrines = [];
      this.spawn = { x: 1.5, z: 1.5, yaw: 0 };
      this.exit = { x: 2.5, z: 2.5, open: false };
      this.theme = THEMES[0];
      this.depth = 1;
      this.objective = { type: 'brand' };
    }
    idx(i, j) { return j * this.w + i; }
    inBounds(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h; }
    isSolidTile(i, j) { return !this.inBounds(i, j) || this.solid[j * this.w + i] !== 0; }
    isSolidAt(x, z) { return this.isSolidTile(Math.floor(x), Math.floor(z)); }
    floorAt(x, z) {
      const i = Math.floor(x), j = Math.floor(z);
      if (!this.inBounds(i, j)) return 0;
      return this.floorH[j * this.w + i];
    }
    ceilAt(x, z) {
      const i = Math.floor(x), j = Math.floor(z);
      if (!this.inBounds(i, j)) return 3;
      return this.ceilH[j * this.w + i];
    }
    lightAt(x, z) {
      const i = Math.floor(x), j = Math.floor(z);
      if (!this.inBounds(i, j)) return 0.2;
      return this.light[j * this.w + i];
    }
    // 视线：DDA 栅格步进
    los(x0, z0, x1, z1) {
      let dx = x1 - x0, dz = z1 - z0;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 0.0001) return true;
      dx /= dist; dz /= dist;
      let i = Math.floor(x0), j = Math.floor(z0);
      const stepI = dx > 0 ? 1 : -1, stepJ = dz > 0 ? 1 : -1;
      const tDX = Math.abs(1 / (dx || 1e-9)), tDZ = Math.abs(1 / (dz || 1e-9));
      let tMaxX = ((dx > 0 ? (i + 1 - x0) : (x0 - i)) || 1e-9) * tDX;
      let tMaxZ = ((dz > 0 ? (j + 1 - z0) : (z0 - j)) || 1e-9) * tDZ;
      let t = 0, guard = 0;
      while (t < dist && guard++ < 512) {
        if (tMaxX < tMaxZ) { t = tMaxX; tMaxX += tDX; i += stepI; }
        else { t = tMaxZ; tMaxZ += tDZ; j += stepJ; }
        if (t >= dist) break;
        if (this.isSolidTile(i, j)) return false;
      }
      return true;
    }
    // 随机开阔位置
    randomOpen(rng, minDistFrom, mx, mz) {
      for (let k = 0; k < 400; k++) {
        const r = rng.pick(this.rooms);
        const x = r.x + 0.8 + rng.next() * (r.w - 1.6);
        const z = r.z + 0.8 + rng.next() * (r.h - 1.6);
        if (this.isSolidAt(x, z)) continue;
        if (minDistFrom && U.dist(x, z, mx, mz) < minDistFrom) continue;
        return { x: x, z: z, room: r };
      }
      return { x: this.spawn.x, z: this.spawn.z, room: this.rooms[0] };
    }
  }

  /* --------------------------- 生成 --------------------------- */
  const Mapgen = {
    MAX_DEPTH: MAX_DEPTH,
    BOSS_DEPTHS: BOSS_DEPTHS,
    themeFor: themeFor,
    THEMES: THEMES,

    generate(depth, seed) {
      const rng = new U.Rng((seed === undefined ? (Math.random() * 1e9) : seed) ^ (depth * 7919));
      const theme = themeFor(depth);
      const isBoss = !!BOSS_DEPTHS[depth];

      const size = isBoss ? 40 : U.clamp(38 + depth * 2, 38, 62);
      const map = new GameMap(size, size);
      map.depth = depth; map.theme = theme;
      map.isBoss = isBoss;
      map.objective = { type: isBoss ? 'boss' : (depth % 3 === 0 ? 'clear' : 'brand'), done: false };

      /* ---- 1. 房间 ---- */
      const rooms = [];
      const tries = isBoss ? 60 : 260;
      const wantRooms = isBoss ? 5 : U.clamp(7 + (depth >> 1), 7, 13);
      if (isBoss) {
        // Boss 层：一个巨大竞技场 + 入口长廊 + 两侧翼
        const cw = 24, ch = 24;
        const cx = ((size - cw) / 2) | 0, cz = ((size - ch) / 2) | 0;
        rooms.push({ x: cx, z: cz, w: cw, h: ch, kind: 'arena', big: true });
        rooms.push({ x: cx + ((cw / 2 - 4) | 0), z: 3, w: 8, h: cz - 4, kind: 'hall' });
        rooms.push({ x: 4, z: ((size / 2 - 4) | 0), w: cx - 5, h: 8, kind: 'side' });
        rooms.push({ x: cx + cw + 1, z: ((size / 2 - 4) | 0), w: size - (cx + cw) - 5, h: 8, kind: 'side' });
      } else {
        for (let t = 0; t < tries && rooms.length < wantRooms; t++) {
          const rw = rng.intRange(6, 13), rh = rng.intRange(6, 13);
          const rx = rng.intRange(2, size - rw - 3), rz = rng.intRange(2, size - rh - 3);
          let ok = true;
          for (const r of rooms) {
            if (rx < r.x + r.w + 2 && rx + rw + 2 > r.x && rz < r.z + r.h + 2 && rz + rh + 2 > r.z) { ok = false; break; }
          }
          if (!ok) continue;
          rooms.push({ x: rx, z: rz, w: rw, h: rh, kind: 'room' });
        }
      }
      // 房间元数据
      rooms.forEach((r, i) => {
        r.id = i;
        r.cx = r.x + r.w / 2; r.cz = r.z + r.h / 2;
        r.area = r.w * r.h;
        r.tall = rng.chance(0.3) || r.big;
        r.ceilH = r.big ? 7.5 : (r.tall ? 4.6 : 3.1 + rng.next() * 0.5);
        r.raised = !r.big && r.area > 70 && rng.chance(0.35);
        r.pool = rng.chance(0.25);
        r.wallTex = rng.int(theme.wall.length);
        r.floorTex = rng.int(theme.floor.length);
      });
      map.rooms = rooms;

      const carveRect = (x0, z0, x1, z1, roomId) => {
        for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) {
          if (i <= 0 || j <= 0 || i >= size - 1 || j >= size - 1) continue;
          const k = j * size + i;
          map.solid[k] = 0;
          if (roomId !== undefined) map.roomId[k] = roomId;
        }
      };

      /* ---- 2. 挖房间 ---- */
      rooms.forEach(r => carveRect(r.x, r.z, r.x + r.w - 1, r.z + r.h - 1, r.id));

      /* ---- 3. 走廊（最小生成树 + 少量回路） ---- */
      const connected = [0], pending = rooms.map((_, i) => i).slice(1);
      const dig = (a, b) => {
        // L 形，2 格宽
        const ax = Math.round(a.cx), az = Math.round(a.cz);
        const bx = Math.round(b.cx), bz = Math.round(b.cz);
        const wide = 1;   // 额外宽度 → 2 格
        if (rng.chance(0.5)) {
          carveRect(Math.min(ax, bx), az, Math.max(ax, bx), az + wide);
          carveRect(bx, Math.min(az, bz), bx + wide, Math.max(az, bz));
        } else {
          carveRect(ax, Math.min(az, bz), ax + wide, Math.max(az, bz));
          carveRect(Math.min(ax, bx), bz, Math.max(ax, bx), bz + wide);
        }
      };
      while (pending.length) {
        let best = null, bd = 1e9, bi = 0;
        for (let p = 0; p < pending.length; p++) {
          for (const c of connected) {
            const d = U.dist2(rooms[pending[p]].cx, rooms[pending[p]].cz, rooms[c].cx, rooms[c].cz);
            if (d < bd) { bd = d; best = [rooms[c], rooms[pending[p]]]; bi = p; }
          }
        }
        dig(best[0], best[1]);
        connected.push(pending[bi]); pending.splice(bi, 1);
      }
      // 额外回路，让地图不是纯树状
      const extra = isBoss ? 1 : 2 + rng.int(2);
      for (let e = 0; e < extra; e++) {
        const a = rng.pick(rooms), b = rng.pick(rooms);
        if (a !== b) dig(a, b);
      }

      /* ---- 4. 地面/天花板高度、纹理 ---- */
      for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
        const k = j * size + i;
        if (map.solid[k]) continue;
        const rid = map.roomId[k];
        const r = rid >= 0 ? rooms[rid] : null;
        map.ceilH[k] = r ? r.ceilH : 2.55;                      // 走廊更低 → 压迫感
        map.floorTex[k] = r ? r.floorTex : 0;
        if (r && r.pool) map.floorTex[k] = theme.floor.length - 1;
      }
      // 抬高平台（房间中央高台 + 一圈台阶）
      rooms.forEach(r => {
        if (!r.raised) return;
        const pw = Math.max(3, (r.w * 0.45) | 0), ph = Math.max(3, (r.h * 0.45) | 0);
        const px0 = (r.cx - pw / 2) | 0, pz0 = (r.cz - ph / 2) | 0;
        r.platform = { x: px0, z: pz0, w: pw, h: ph, y: 0.55 };
        for (let j = pz0; j < pz0 + ph; j++) for (let i = px0; i < px0 + pw; i++) {
          if (!map.inBounds(i, j) || map.solid[j * size + i]) continue;
          map.floorH[j * size + i] = 0.55;
        }
        for (let j = pz0 - 1; j <= pz0 + ph; j++) for (let i = px0 - 1; i <= px0 + pw; i++) {
          if (!map.inBounds(i, j) || map.solid[j * size + i]) continue;
          const inner = (i >= px0 && i < px0 + pw && j >= pz0 && j < pz0 + ph);
          if (!inner) map.floorH[j * size + i] = Math.max(map.floorH[j * size + i], 0.27);
        }
      });

      /* ---- 5. 出生点 / 传送门 ---- */
      const startRoom = rooms.reduce((a, b) => (a.area < b.area || a.big ? a : b), rooms[0]);
      map.spawn.x = startRoom.cx; map.spawn.z = startRoom.cz;
      map.spawn.yaw = rng.next() * U.TAU;
      map.startRoomId = startRoom.id;

      // 出口选最远房间
      let exitRoom = rooms[0], far = -1;
      rooms.forEach(r => {
        const d = U.dist2(r.cx, r.cz, startRoom.cx, startRoom.cz);
        if (d > far && r !== startRoom) { far = d; exitRoom = r; }
      });
      map.exit.x = exitRoom.cx; map.exit.z = exitRoom.cz;
      map.exit.open = false;
      map.exitRoomId = exitRoom.id;

      /* ---- 6. 装饰物 ---- */
      const props = map.props;
      const addProp = (kind, x, z, o) => {
        const p = Object.assign({ kind: kind, x: x, z: z, y: map.floorAt(x, z), r: 0.3 }, o || {});
        props.push(p); return p;
      };
      rooms.forEach(r => {
        // 火盆（同时是动态光源）
        const nBraz = r.big ? 6 : (r.area > 80 ? 3 : 2);
        for (let b = 0; b < nBraz; b++) {
          for (let t = 0; t < 24; t++) {
            const x = r.x + 1.2 + rng.next() * (r.w - 2.4);
            const z = r.z + 1.2 + rng.next() * (r.h - 2.4);
            if (map.isSolidAt(x, z)) continue;
            let tooClose = false;
            for (const p of props) if (p.kind === 'brazier' && U.dist2(p.x, p.z, x, z) < 25) { tooClose = true; break; }
            if (tooClose) continue;
            const p = addProp('brazier', x, z, { r: 0.34, height: 1.05 });
            map.lights.push({
              x: x, y: p.y + 1.25, z: z,
              r: theme.lightCol[0], g: theme.lightCol[1], b: theme.lightCol[2],
              i: 0.95, flicker: rng.next() * 10,
            });
            break;
          }
        }
        // 柱子
        if (r.area > 64 && !r.big) {
          const n = 2 + rng.int(3);
          for (let b = 0; b < n; b++) {
            const x = r.x + 1.5 + rng.next() * (r.w - 3);
            const z = r.z + 1.5 + rng.next() * (r.h - 3);
            if (!map.isSolidAt(x, z)) addProp('pillar', Math.floor(x) + 0.5, Math.floor(z) + 0.5, { r: 0.42, height: r.ceilH });
          }
        }
        if (r.big) {  // 竞技场四角巨柱
          [[0.18, 0.18], [0.82, 0.18], [0.18, 0.82], [0.82, 0.82]].forEach(function (f) {
            addProp('pillar', Math.floor(r.x + r.w * f[0]) + 0.5, Math.floor(r.z + r.h * f[1]) + 0.5,
              { r: 0.55, height: r.ceilH, big: true });
          });
        }
        // 尸骸 / 骨堆 / 尖桩 / 吊笼 / 战旗
        const decor = ['bones', 'skulls', 'stake', 'cage', 'banner', 'corpse'];
        const nd = 2 + rng.int(4);
        for (let b = 0; b < nd; b++) {
          const x = r.x + 0.8 + rng.next() * (r.w - 1.6);
          const z = r.z + 0.8 + rng.next() * (r.h - 1.6);
          if (map.isSolidAt(x, z)) continue;
          const kind = rng.pick(decor);
          if (kind === 'cage' && !r.tall) continue;
          addProp(kind, x, z, { r: kind === 'stake' ? 0.2 : 0.34, ang: rng.next() * U.TAU });
        }
      });

      // 血祭坛：非 Boss 层 60% 出现
      if (!isBoss && rng.chance(0.6)) {
        const cand = rooms.filter(r => r.id !== startRoom.id && r.id !== exitRoom.id);
        if (cand.length) {
          const r = rng.pick(cand);
          const s = addProp('shrine', Math.floor(r.cx) + 0.5, Math.floor(r.cz) + 0.5, { r: 0.5, height: 1.4 });
          s.used = false;
          s.shrineType = rng.pick(['heal', 'relicForHp', 'souls']);
          map.shrines.push(s);
          map.lights.push({ x: s.x, y: s.y + 1.4, z: s.z, r: 0.7, g: 0.15, b: 0.5, i: 0.65, flicker: rng.next() * 10 });
        }
      }

      // 传送门本体
      map.props.push({ kind: 'portal', x: map.exit.x, z: map.exit.z, y: map.floorAt(map.exit.x, map.exit.z), r: 0.7 });

      /* ---- 7. 敌人 / 道具刷点 ---- */
      const budget = isBoss ? 10 : Math.round(11 + depth * 2.6);
      const pool = theme.enemies;
      const spawnRooms = rooms.filter(r => r.id !== startRoom.id);
      let placed = 0, guard = 0;
      while (placed < budget && guard++ < 900) {
        const r = rng.pick(spawnRooms.length ? spawnRooms : rooms);
        const x = r.x + 1 + rng.next() * (r.w - 2);
        const z = r.z + 1 + rng.next() * (r.h - 2);
        if (map.isSolidAt(x, z)) continue;
        if (U.dist(x, z, map.spawn.x, map.spawn.z) < 9) continue;
        let type = rng.pick(pool);
        if (depth < 3 && type === 'brute') type = 'ghoul';
        if (depth < 2 && type === 'wraith') type = 'hound';
        map.enemySpawns.push({ x: x, z: z, type: type, roomId: r.id });
        placed++;
      }
      if (isBoss) {
        const arena = rooms[0];
        map.bossSpawn = { x: arena.cx, z: arena.cz - 4, type: BOSS_DEPTHS[depth] };
      }

      // 目标物（猩红烙印）：由随机精英携带
      if (map.objective.type === 'brand' && map.enemySpawns.length) {
        const cands = map.enemySpawns.filter(s => s.roomId !== startRoom.id);
        const pick = rng.pick(cands.length ? cands : map.enemySpawns);
        pick.elite = true; pick.carriesBrand = true;
      }

      // 心脏 / 魂 掉落点
      const nHeart = 2 + rng.int(2);
      for (let i = 0; i < nHeart; i++) {
        const p = map.randomOpen(rng, 8, map.spawn.x, map.spawn.z);
        map.itemSpawns.push({ kind: 'heart', x: p.x, z: p.z });
      }
      for (let i = 0; i < 5 + depth; i++) {
        const p = map.randomOpen(rng, 5, map.spawn.x, map.spawn.z);
        map.itemSpawns.push({ kind: 'soul', x: p.x, z: p.z, value: 3 + rng.int(4) });
      }

      /* ---- 8. 烘焙光照 ---- */
      bakeLight(map);

      /* ---- 9. 构建静态几何 ---- */
      map.meshB = buildGeometry(map, rng);

      return map;
    },
  };

  /* --------------------------- 烘焙光 --------------------------- */
  function bakeLight(map) {
    const w = map.w, h = map.h;
    const base = 0.08;
    map.light.fill(0);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i;
      if (map.solid[k]) { map.light[k] = 0.05; continue; }
      let lum = base;
      const cx = i + 0.5, cz = j + 0.5;
      for (const L of map.lights) {
        const d2 = U.dist2(cx, cz, L.x, L.z);
        if (d2 > 190) continue;
        const d = Math.sqrt(d2);
        if (d > 2.2 && !map.los(cx, cz, L.x, L.z)) continue;
        lum += (L.i * 2.4) / (1 + d2 * 0.34);
      }
      map.light[k] = U.clamp(lum, 0.05, 1.5);
    }
    // 3x3 模糊两遍，去掉硬边
    const tmp = new Float32Array(map.light.length);
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        let s = 0, n = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const ii = i + di, jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
          const kk = jj * w + ii;
          const wt = (di === 0 && dj === 0) ? 3 : 1;
          s += map.light[kk] * wt; n += wt;
        }
        tmp[j * w + i] = s / n;
      }
      map.light.set(tmp);
    }
    // 角点光（供顶点色使用，得到平滑明暗过渡）
    const cw = w + 1;
    map.cLight = new Float32Array(cw * (h + 1));
    for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) {
      let s = 0, n = 0;
      for (let dj = -1; dj <= 0; dj++) for (let di = -1; di <= 0; di++) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= w || jj >= h) continue;
        if (map.solid[jj * w + ii]) { s += map.light[jj * w + ii] * 0.6; n += 1; continue; }
        s += map.light[jj * w + ii]; n++;
      }
      map.cLight[j * cw + i] = n ? s / n : 0.1;
    }
    map.cw = cw;
  }

  /* --------------------------- 几何构建 --------------------------- */
  function buildGeometry(map, rng) {
    const T = G.Art.T, theme = map.theme;
    const mb = new MeshB(60000);
    const w = map.w, h = map.h, cw = map.cw;
    const CL = (i, j) => map.cLight[U.clamp(j, 0, h) * cw + U.clamp(i, 0, w)];

    const wallTiles = theme.wall.map(n => T[n] || T.stone);
    const floorTiles = theme.floor.map(n => T[n] || T.floor);
    const ceilTile = T[theme.ceil] || T.ceil;
    const accentTile = T[theme.accent] || T.bone;
    const gray = [1, 1, 1];

    /* --- 地板 & 天花板 --- */
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (map.solid[k]) continue;
        const y = map.floorH[k], cy = map.ceilH[k];
        const ft = floorTiles[map.floorTex[k] % floorTiles.length];
        const l00 = CL(i, j), l10 = CL(i + 1, j), l11 = CL(i + 1, j + 1), l01 = CL(i, j + 1);
        // 地板（法线 +Y）
        pushQuadL(mb, ft, gray,
          i, y, j + 1, l01,
          i + 1, y, j + 1, l11,
          i + 1, y, j, l10,
          i, y, j, l00, 0);
        // 天花板（法线 -Y）
        const cl = 0.5;
        pushQuadL(mb, ceilTile, gray,
          i, cy, j, l00 * cl,
          i + 1, cy, j, l10 * cl,
          i + 1, cy, j + 1, l11 * cl,
          i, cy, j + 1, l01 * cl, 0);
      }
    }

    /* --- 墙面：每个开放格朝实心邻居生成面，按 1 单位纵向切片 --- */
    const dirs = [
      { di: 1, dj: 0 },
      { di: -1, dj: 0 },
      { di: 0, dj: 1 },
      { di: 0, dj: -1 },
    ];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        if (map.solid[k]) continue;
        const y0 = map.floorH[k], y1 = map.ceilH[k];
        for (const d of dirs) {
          const ni = i + d.di, nj = j + d.dj;
          const solidN = map.isSolidTile(ni, nj);
          let top = y1, bot = y0;
          if (!solidN) {
            // 邻居开放：只有高低差需要补面（台阶立面 / 层高落差）
            const nk = nj * w + ni;
            const nf = map.floorH[nk], nc = map.ceilH[nk];
            if (nf > y0 + 0.02) { bot = y0; top = nf; }
            else if (nc < y1 - 0.02) { bot = nc; top = y1; }
            else continue;
          }
          const rid = map.roomId[k];
          const r = rid >= 0 ? map.rooms[rid] : null;
          let tile = wallTiles[(r ? r.wallTex : ((i * 7 + j * 13) % wallTiles.length)) % wallTiles.length];
          if (!solidN) tile = accentTile;
          emitWall(mb, i, j, d, bot, top, tile, CL);
        }
      }
    }

    /* --- 装饰物几何 --- */
    for (const p of map.props) emitProp(mb, map, p, T, rng);

    return mb;
  }

  // 带顶点光的四边形
  function pushQuadL(mb, t, c, ax, ay, az, la, bx, by, bz, lb, cx, cy, cz, lc, dx, dy, dz, ld, emis) {
    if (!mb.ensure(6)) return;
    const u0 = t[0], v0 = t[1], u1 = t[2], v1 = t[3];
    const r = c[0], g = c[1], b = c[2], e = emis || 0;
    mb.v(ax, ay, az, u0, v1, r, g, b, la, e);
    mb.v(bx, by, bz, u1, v1, r, g, b, lb, e);
    mb.v(cx, cy, cz, u1, v0, r, g, b, lc, e);
    mb.v(ax, ay, az, u0, v1, r, g, b, la, e);
    mb.v(cx, cy, cz, u1, v0, r, g, b, lc, e);
    mb.v(dx, dy, dz, u0, v0, r, g, b, ld, e);
  }

  function emitWall(mb, i, j, d, bot, top, tile, CL) {
    const shade = (d.di !== 0) ? 0.92 : 0.70;   // 四面墙明暗不同，立体感更强
    const col = [shade, shade, shade];
    const steps = Math.max(1, Math.ceil((top - bot) / 1.0));
    const segH = (top - bot) / steps;
    /* 底边必须按「使法线指向开放格」的方向排列：
       法线 ∝ (-ez, 0, ex)，其中 e = b - a */
    let ax, az, bx, bz, la, lb;
    if (d.di === 1) {         // 墙在 +X 侧，法线需 -X → e = +Z
      ax = i + 1; az = j; bx = i + 1; bz = j + 1;
      la = CL(i + 1, j); lb = CL(i + 1, j + 1);
    } else if (d.di === -1) { // 墙在 -X 侧，法线需 +X → e = -Z
      ax = i; az = j + 1; bx = i; bz = j;
      la = CL(i, j + 1); lb = CL(i, j);
    } else if (d.dj === 1) {  // 墙在 +Z 侧，法线需 -Z → e = -X
      ax = i + 1; az = j + 1; bx = i; bz = j + 1;
      la = CL(i + 1, j + 1); lb = CL(i, j + 1);
    } else {                  // 墙在 -Z 侧，法线需 +Z → e = +X
      ax = i; az = j; bx = i + 1; bz = j;
      la = CL(i, j); lb = CL(i + 1, j);
    }
    for (let s = 0; s < steps; s++) {
      const y0 = bot + s * segH, y1 = y0 + segH;
      const fT = U.clamp(1 - (y1 - bot) * 0.07, 0.45, 1);   // 越高越暗
      pushQuadL(mb, tile, col,
        ax, y0, az, la * fT,
        bx, y0, bz, lb * fT,
        bx, y1, bz, lb * fT * 0.88,
        ax, y1, az, la * fT * 0.88, 0);
    }
  }

  /* --------------------------- 装饰几何 --------------------------- */
  function emitProp(mb, map, p, T, rng) {
    const l = U.clamp(map.lightAt(p.x, p.z), 0.1, 1.4);
    const y = p.y;
    const W = T.white, metal = T.metal, wood = T.wood, bone = T.bone, stone = T.stone;
    const cGray = U.hex('#4a4a50'), cBone = U.hex('#b3ab94');
    const cWood = U.hex('#4a3320'), cBlood = U.hex('#5c0c10');

    switch (p.kind) {
      case 'brazier': {
        // 三脚架 + 铁盆（火焰是动态公告板，在 render 里画）
        for (let a = 0; a < 3; a++) {
          const ang = a / 3 * U.TAU + 0.4;
          mb.box(p.x + Math.cos(ang) * 0.16, y + 0.42, p.z + Math.sin(ang) * 0.16,
            0.035, 0.42, 0.035, metal, cGray, l, 0);
        }
        mb.box(p.x, y + 0.9, p.z, 0.26, 0.08, 0.26, metal, cGray, l, 0);
        mb.box(p.x, y + 1.0, p.z, 0.2, 0.06, 0.2, W, U.hex('#3a1206'), l, 0.15);
        mb.box(p.x, y + 1.06, p.z, 0.13, 0.03, 0.13, W, U.hex('#ff5a12'), 1, 0.9);
        break;
      }
      case 'pillar': {
        const ph = p.height || 3;
        const hh = ph * 0.5;
        const r = p.big ? 0.45 : 0.32;
        mb.box(p.x, y + hh, p.z, r, hh, r, stone, cGray, l * 0.9, 0);
        mb.box(p.x, y + 0.12, p.z, r * 1.3, 0.12, r * 1.3, stone, U.mulc(cGray, 0.9), l, 0);
        mb.box(p.x, y + ph - 0.14, p.z, r * 1.3, 0.14, r * 1.3, stone, U.mulc(cGray, 0.95), l * 0.8, 0);
        if (p.big) {
          for (let a = 0; a < 4; a++) {
            const ang = a / 4 * U.TAU;
            mb.box(p.x + Math.cos(ang) * r * 1.1, y + hh * 1.3, p.z + Math.sin(ang) * r * 1.1,
              0.07, hh * 0.5, 0.07, bone, cBone, l * 0.85, 0);
          }
        }
        break;
      }
      case 'bones': {
        for (let i = 0; i < 7; i++) {
          const a = rng.next() * U.TAU, d = rng.next() * 0.4;
          mb.box(p.x + Math.cos(a) * d, y + 0.05, p.z + Math.sin(a) * d,
            0.03 + rng.next() * 0.09, 0.035, 0.03, bone, cBone, l, 0);
        }
        break;
      }
      case 'skulls': {
        for (let i = 0; i < 5; i++) {
          const a = rng.next() * U.TAU, d = rng.next() * 0.32;
          const bx = p.x + Math.cos(a) * d, bz = p.z + Math.sin(a) * d;
          const by = y + 0.09 + (i % 2) * 0.14;
          mb.box(bx, by, bz, 0.085, 0.08, 0.08, bone, cBone, l, 0);
          mb.box(bx - 0.032, by + 0.01, bz - 0.075, 0.022, 0.018, 0.012, W, U.hex('#0d0a0a'), l * 0.4, 0);
          mb.box(bx + 0.032, by + 0.01, bz - 0.075, 0.022, 0.018, 0.012, W, U.hex('#0d0a0a'), l * 0.4, 0);
        }
        break;
      }
      case 'stake': {   // 尖桩上的尸体
        const hh = 1.1 + rng.next() * 0.5;
        mb.box(p.x, y + hh * 0.5, p.z, 0.05, hh * 0.5, 0.05, wood, cWood, l, 0);
        mb.box(p.x, y + hh, p.z, 0.16, 0.22, 0.12, T.gore, U.hex('#6a1a18'), l, 0);
        mb.box(p.x, y + hh + 0.26, p.z, 0.1, 0.09, 0.09, bone, U.hex('#9a9280'), l, 0);
        mb.box(p.x - 0.2, y + hh + 0.02, p.z, 0.1, 0.035, 0.035, T.gore, U.hex('#5a1412'), l, 0);
        mb.box(p.x + 0.2, y + hh - 0.05, p.z, 0.1, 0.035, 0.035, T.gore, U.hex('#5a1412'), l, 0);
        break;
      }
      case 'cage': {   // 天花板吊笼
        const top = map.ceilAt(p.x, p.z);
        const cy = top - 1.5;
        mb.box(p.x, cy + (top - cy) * 0.5 + 0.75, p.z, 0.012, (top - cy) * 0.5, 0.012, metal, cGray, l * 0.7, 0);
        for (let a = 0; a < 4; a++) {
          const ang = a / 4 * U.TAU + 0.785;
          mb.box(p.x + Math.cos(ang) * 0.26, cy, p.z + Math.sin(ang) * 0.26, 0.02, 0.34, 0.02, metal, cGray, l * 0.8, 0);
        }
        mb.box(p.x, cy - 0.34, p.z, 0.28, 0.03, 0.28, metal, cGray, l * 0.8, 0);
        mb.box(p.x, cy - 0.14, p.z, 0.17, 0.19, 0.14, T.gore, U.hex('#4a1210'), l * 0.9, 0);
        mb.box(p.x, cy + 0.14, p.z, 0.09, 0.09, 0.08, bone, U.hex('#8e8672'), l, 0);
        break;
      }
      case 'banner': {
        const hh = 1.5;
        mb.box(p.x, y + 2.1, p.z, 0.36, 0.02, 0.02, wood, cWood, l * 0.8, 0);
        mb.box(p.x, y + 2.1 - hh * 0.5, p.z, 0.33, hh * 0.5, 0.012, W, cBlood, l * 0.85, 0);
        mb.box(p.x, y + 2.1 - hh * 0.35, p.z - 0.014, 0.1, 0.2, 0.006, T.brand, U.hex('#ff5030'), 1, 0.7);
        break;
      }
      case 'corpse': {
        mb.box(p.x, y + 0.09, p.z, 0.2, 0.09, 0.34, T.gore, U.hex('#4a1414'), l, 0);
        mb.box(p.x + 0.16, y + 0.07, p.z + 0.3, 0.1, 0.07, 0.1, bone, U.hex('#a09880'), l, 0);
        for (let i = 0; i < 3; i++)
          mb.box(p.x - 0.2 + i * 0.2, y + 0.03, p.z - 0.3, 0.06, 0.03, 0.16, T.gore, U.hex('#3e1010'), l, 0);
        break;
      }
      case 'shrine': {
        // 血祭坛：石台 + 悬浮的心
        mb.box(p.x, y + 0.3, p.z, 0.46, 0.3, 0.46, stone, U.mulc(cGray, 0.9), l, 0);
        mb.box(p.x, y + 0.66, p.z, 0.34, 0.08, 0.34, stone, cGray, l, 0);
        mb.box(p.x, y + 0.78, p.z, 0.2, 0.06, 0.2, T.gore, U.hex('#7a1418'), l, 0.2);
        for (let a = 0; a < 4; a++) {
          const ang = a / 4 * U.TAU + 0.785;
          mb.box(p.x + Math.cos(ang) * 0.42, y + 0.78, p.z + Math.sin(ang) * 0.42, 0.05, 0.5, 0.05, bone, cBone, l, 0);
        }
        break;
      }
      case 'portal': {
        // 传送门框（旋涡在 render 里动态绘制）
        for (let a = 0; a < 14; a++) {
          const ang = a / 14 * U.TAU;
          mb.box(p.x + Math.cos(ang) * 1.05, y + 1.3 + Math.sin(ang) * 1.05, p.z,
            0.1, 0.1, 0.1, stone, U.mulc(cGray, 0.8), l * 0.9, 0);
        }
        mb.box(p.x, y + 0.06, p.z, 1.15, 0.06, 1.15, stone, U.mulc(cGray, 0.7), l, 0);
        for (let a = 0; a < 5; a++) {
          const ang = a / 5 * U.TAU - Math.PI / 2;
          mb.box(p.x + Math.cos(ang) * 0.85, y + 0.13, p.z + Math.sin(ang) * 0.85,
            0.09, 0.02, 0.09, W, U.hex('#7a1010'), 1, 0.5);
        }
        break;
      }
    }
  }

  G.Mapgen = Mapgen;
  G.GameMap = GameMap;
})();
