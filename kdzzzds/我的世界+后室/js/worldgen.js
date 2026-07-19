/* ============================================================
 * BLOCKROOMS - worldgen.js
 * Level 0（黄色房间）/ Level 1（停车库）程序化生成
 * ============================================================ */
(function () {
  'use strict';
  const G = {};
  window.BRGen = G;
  const B = window.BRBlocks;

  function h2(x, z, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(s | 0, 144269504)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function vnoise(x, z, s) { // 平滑值噪声（非平铺）
    const x0 = Math.floor(x), z0 = Math.floor(z);
    const fx = x - x0, fz = z - z0;
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
    return lerp(
      lerp(h2(x0, z0, s), h2(x0 + 1, z0, s), sx),
      lerp(h2(x0, z0 + 1, s), h2(x0 + 1, z0 + 1, s), sx), sz);
  }
  const mod = (n, m) => ((n % m) + m) % m;

  const H = 8;
  G.H = H;

  /* ==================== LEVEL 0 ==================== */
  function createLevel0(seed) {
    const S = seed | 0;
    const CEIL_Y = 4;

    function isLightPos(x, z) { return mod(x, 7) === 3 && mod(z, 7) === 3; }
    function lightWorking(lx, lz) {
      if (Math.abs(lx) <= 10 && Math.abs(lz) <= 10) return true; // 出生区必亮
      const dist = Math.sqrt(lx * lx + lz * lz);
      const broken = Math.min(0.5, 0.10 + dist / 800);
      return h2(lx, lz, S + 7) > broken;
    }
    function nearestLight(x, z) {
      const lx = Math.round((x - 3) / 7) * 7 + 3;
      const lz = Math.round((z - 3) / 7) * 7 + 3;
      return { lx, lz, on: lightWorking(lx, lz) };
    }

    /* ---- 故障墙（noclip 出口）：每 48x48 区域最多一个 ---- */
    function glitchInRegion(rx, rz) {
      if (h2(rx, rz, S + 37) > 0.62) return null;
      const gx = rx * 48 + 8 + Math.floor(h2(rx, rz, S + 39) * 30);
      const gz = rz * 48 + 8 + Math.floor(h2(rx, rz, S + 41) * 30);
      if (Math.abs(gx) < 26 && Math.abs(gz) < 26) return null; // 远离出生点
      const horiz = h2(rx, rz, S + 43) < 0.5;
      return { x: gx, z: gz, horiz };
    }
    function glitchAt(x, z) {
      const rx = Math.floor(x / 48), rz = Math.floor(z / 48);
      const gl = glitchInRegion(rx, rz);
      if (!gl) return false;
      if (gl.horiz) return z === gl.z && x >= gl.x && x <= gl.x + 2;
      return x === gl.x && z >= gl.z && z <= gl.z + 2;
    }
    function nearestGlitch(x, z) {
      let best = null, bd = Infinity;
      const rx0 = Math.floor(x / 48), rz0 = Math.floor(z / 48);
      for (let rx = rx0 - 2; rx <= rx0 + 2; rx++)
        for (let rz = rz0 - 2; rz <= rz0 + 2; rz++) {
          const gl = glitchInRegion(rx, rz);
          if (!gl) continue;
          const d = Math.hypot(gl.x + 1 - x, gl.z + 1 - z);
          if (d < bd) { bd = d; best = gl; }
        }
      return best ? { x: best.x + 1, z: best.z + 1, dist: bd } : null;
    }

    /* ---- 墙体布局 ---- */
    function isWall(x, z) {
      if (Math.abs(x) <= 4 && Math.abs(z) <= 4) return false;  // 出生大厅
      if (glitchAt(x, z)) return false;
      // 主墙网格（x 向 & z 向，带门洞）
      if (mod(x, 9) === 4 && h2(x, Math.floor(z / 4), S + 11) > 0.34) return true;
      if (mod(z, 9) === 4 && h2(Math.floor(x / 4), z, S + 13) > 0.34) return true;
      // 随机短墙
      const cx = Math.floor(x / 4), cz = Math.floor(z / 4);
      const r = h2(cx, cz, S + 17);
      if (r < 0.13) {
        const lx = mod(x, 4), lz = mod(z, 4);
        if (r < 0.065) { if (lz === 1 && lx <= 2) return true; }
        else { if (lx === 1 && lz <= 2) return true; }
      }
      return false;
    }

    function wallType(x, z) {
      const nl = nearestLight(x, z);
      if (!nl.on && h2(x, z, S + 29) < 0.22) return B.MOLD;
      if (h2(x, z, S + 23) < 0.085) return B.STUD;
      return B.WALL;
    }

    function floorType(x, z) {
      const nl = nearestLight(x, z);
      const wet = vnoise(x / 11, z / 11, S + 31) > 0.63 || (!nl.on && h2(x, z, S + 33) < 0.3);
      return wet ? B.WETCARPET : B.CARPET;
    }

    function fillColumn(x, z, out) {
      out.fill(B.AIR);
      out[0] = floorType(x, z);
      out[CEIL_Y] = B.CEIL;
      if (glitchAt(x, z)) {
        out[1] = B.GLITCH; out[2] = B.GLITCH; out[3] = B.GLITCH;
        return;
      }
      if (isWall(x, z)) {
        const t = wallType(x, z);
        out[1] = t; out[2] = t; out[3] = (t === B.MOLD ? B.WALL : t);
        return;
      }
      if (isLightPos(x, z) && lightWorking(x, z)) out[CEIL_Y] = B.LIGHT;
    }

    function extras(x, z) {
      const list = [];
      if (isWall(x, z) || glitchAt(x, z)) return list;
      const r = h2(x, z, S + 61);
      if (r < 0.004) list.push({ id: 'almond', n: 1, x: x + 0.5, y: 1.35, z: z + 0.5 });
      else if (r < 0.0055) list.push({ id: 'old_wood', n: 1, x: x + 0.5, y: 1.35, z: z + 0.5 });
      return list;
    }

    return {
      id: 0, H, name: 'Level 0', sub: '「大厅」 The Lobby',
      fillColumn, extras, nearestGlitch,
      isGlitch: glitchAt,
      spawn: { x: 0.5, y: 1.02, z: 0.5 },
      ambient: 0.32,
      skyColor: 0x0e0c05,
      fogColor: 0xb7a65e, fogDensity: 0.032,
      lightRange: 12.5, lightPower: 1.0,
      mobs: { hound: 2, smiler: 1, faceling: 2 },
      sanityDrainBase: 0.25
    };
  }

  /* ==================== LEVEL 1 ==================== */
  function createLevel1(seed) {
    const S = (seed | 0) + 9001;
    const CEIL_Y = 5;
    // 出口位置
    const ang = h2(1, 2, S + 3) * Math.PI * 2;
    const dist = 78 + h2(3, 4, S + 5) * 36;
    const ex = Math.round(Math.cos(ang) * dist);
    const ez = Math.round(Math.sin(ang) * dist);

    function inExitRoom(x, z) { return Math.abs(x - ex) <= 4 && Math.abs(z - ez) <= 4; }
    // 出口门朝向出生点方向开门
    const doorSide = Math.abs(ex) > Math.abs(ez)
      ? (ex > 0 ? 'w' : 'e')      // 门开在朝向原点的一侧
      : (ez > 0 ? 'n' : 's');

    function exitRoomBlock(x, z, y) {
      const dx = x - ex, dz = z - ez;
      const onPerim = Math.abs(dx) === 4 || Math.abs(dz) === 4;
      if (!onPerim) {
        if (y === CEIL_Y) return B.LIGHT;
        return y === 0 ? B.STRIPE : B.AIR;
      }
      // 门洞（朝出生点）
      let isDoor = false;
      if (doorSide === 'w' && dx === -4 && Math.abs(dz) <= 1 && y >= 1 && y <= 2) isDoor = true;
      if (doorSide === 'e' && dx === 4 && Math.abs(dz) <= 1 && y >= 1 && y <= 2) isDoor = true;
      if (doorSide === 'n' && dz === -4 && Math.abs(dx) <= 1 && y >= 1 && y <= 2) isDoor = true;
      if (doorSide === 's' && dz === 4 && Math.abs(dx) <= 1 && y >= 1 && y <= 2) isDoor = true;
      if (isDoor) return B.AIR;
      // EXIT 大门（背向出生点一侧的中心）
      let isExit = false;
      if (doorSide === 'w' && dx === 4 && dz === 0) isExit = true;
      if (doorSide === 'e' && dx === -4 && dz === 0) isExit = true;
      if (doorSide === 'n' && dz === 4 && dx === 0) isExit = true;
      if (doorSide === 's' && dz === -4 && dx === 0) isExit = true;
      if (isExit) {
        if (y === 1) return B.EXIT_B;
        if (y === 2) return B.EXIT_T;
      }
      if (y === 0) return B.FLOOR1;
      return B.CONCRETE;
    }

    function isPillar(x, z) { return mod(x, 8) === 4 && mod(z, 8) === 4; }
    function isLightPos(x, z) { return mod(x, 11) === 5 && mod(z, 11) === 5; }
    function lightWorking(lx, lz) { return h2(lx, lz, S + 7) < 0.30; }

    /* ---- 房间（24x24 单元） ---- */
    function roomOf(cx, cz) {
      if (h2(cx, cz, S + 21) > 0.42) return null;
      const x0 = cx * 24 + 3 + Math.floor(h2(cx, cz, S + 23) * 6);
      const z0 = cz * 24 + 3 + Math.floor(h2(cx, cz, S + 25) * 6);
      const w = 8 + Math.floor(h2(cx, cz, S + 27) * 5);
      const d = 8 + Math.floor(h2(cx, cz, S + 29) * 5);
      const doorDir = Math.floor(h2(cx, cz, S + 31) * 4);
      return { x0, z0, w, d, doorDir };
    }
    function roomBlock(x, z, y) {
      const cx = Math.floor(x / 24), cz = Math.floor(z / 24);
      const r = roomOf(cx, cz);
      if (!r) return null;
      const dx = x - r.x0, dz = z - r.z0;
      if (dx < 0 || dz < 0 || dx >= r.w || dz >= r.d) return null;
      const onPerim = dx === 0 || dz === 0 || dx === r.w - 1 || dz === r.d - 1;
      if (onPerim) {
        // 门
        const midX = Math.floor(r.w / 2), midZ = Math.floor(r.d / 2);
        let isDoor = false;
        if (r.doorDir === 0 && dz === 0 && Math.abs(dx - midX) <= 1) isDoor = true;
        if (r.doorDir === 1 && dx === r.w - 1 && Math.abs(dz - midZ) <= 1) isDoor = true;
        if (r.doorDir === 2 && dz === r.d - 1 && Math.abs(dx - midX) <= 1) isDoor = true;
        if (r.doorDir === 3 && dx === 0 && Math.abs(dz - midZ) <= 1) isDoor = true;
        if (isDoor && y >= 1 && y <= 2) return B.AIR;
        if (y >= 1 && y <= 4) {
          if (y === 3 && h2(x, z, S + 35) < 0.55) return B.PIPE;
          return B.CONCRETE;
        }
        return null;
      }
      // 房间内板条箱
      if (y === 1 && h2(x, z, S + 37) < 0.14) return B.CRATE;
      if (y === 2 && h2(x, z, S + 37) < 0.045) return B.CRATE;
      return null;
    }

    function fillColumn(x, z, out) {
      out.fill(B.AIR);
      if (inExitRoom(x, z)) {
        for (let y = 0; y <= CEIL_Y; y++) {
          const b = exitRoomBlock(x, z, y);
          out[y] = (b === null || b === undefined) ? B.AIR : b;
        }
        if (out[CEIL_Y] === B.AIR) out[CEIL_Y] = B.CEIL1;
        return;
      }
      // 地面（停车线）
      const laneZ = mod(z, 16);
      out[0] = (laneZ >= 6 && laneZ <= 9 && mod(x, 2) === 0) ? B.STRIPE : B.FLOOR1;
      out[CEIL_Y] = B.CEIL1;
      if (isLightPos(x, z) && lightWorking(x, z)) out[CEIL_Y] = B.LIGHT;
      const nearSpawn = Math.abs(x) <= 3 && Math.abs(z) <= 3;
      if (!nearSpawn) {
        if (isPillar(x, z)) {
          for (let y = 1; y <= 4; y++) out[y] = B.PILLAR;
          // 出口指示牌
          if (h2(x, z, S + 71) < 0.6) {
            const dx = ex - x, dz = ez - z;
            let sign;
            if (Math.abs(dx) > Math.abs(dz)) sign = dx > 0 ? B.SIGN_E : B.SIGN_W;
            else sign = dz > 0 ? B.SIGN_S : B.SIGN_N;
            out[2] = sign;
          }
          return;
        }
        const rb1 = roomBlock(x, z, 1);
        if (rb1 !== null) {
          for (let y = 1; y <= 4; y++) {
            const b = roomBlock(x, z, y);
            if (b !== null && b !== undefined) out[y] = b;
          }
          return;
        }
        // 柱边散落板条箱
        const nearPillar = (mod(x, 8) === 3 || mod(x, 8) === 5) && (mod(z, 8) === 3 || mod(z, 8) === 5);
        if (nearPillar && h2(x, z, S + 41) < 0.16) {
          out[1] = B.CRATE;
          if (h2(x, z, S + 43) < 0.3) out[2] = B.CRATE;
        }
      }
    }

    function extras(x, z) {
      const list = [];
      const r = h2(x, z, S + 61);
      if (r < 0.0022) list.push({ id: 'battery', n: 1, x: x + 0.5, y: 1.35, z: z + 0.5 });
      else if (r < 0.0032) list.push({ id: 'almond', n: 1, x: x + 0.5, y: 1.35, z: z + 0.5 });
      return list;
    }

    return {
      id: 1, H, name: 'Level 1', sub: '「安居地」 Habitable Zone',
      fillColumn, extras,
      exitPos: { x: ex, z: ez },
      spawn: { x: 0.5, y: 1.02, z: 0.5 },
      ambient: 0.10,
      skyColor: 0x020204,
      fogColor: 0x07070a, fogDensity: 0.055,
      lightRange: 11, lightPower: 0.95,
      mobs: { hound: 4, smiler: 3, faceling: 0 },
      sanityDrainBase: 0.65
    };
  }

  G.create = function (levelId, seed) {
    return levelId === 0 ? createLevel0(seed) : createLevel1(seed);
  };
})();
