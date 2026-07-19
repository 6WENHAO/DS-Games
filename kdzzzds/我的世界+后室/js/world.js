/* ============================================================
 * BLOCKROOMS - world.js
 * 区块体素引擎：存储 / 网格化 / 顶点光照 / 射线
 * ============================================================ */
(function () {
  'use strict';
  const W = {};
  window.BRWorld = W;
  const B = window.BRBlocks;
  const CS = 16;      // 区块尺寸
  W.CS = CS;

  let scene = null;
  let level = null;
  let H = 8;
  const chunks = new Map();   // key -> chunk
  const dirty = new Set();
  const spawnedDrops = new Set(); // 已生成过掉落物的区块（防止反复刷新）
  W.chunks = chunks;

  const key = (cx, cz) => cx + ',' + cz;

  W.init = function (threeScene) { scene = threeScene; };

  W.setLevel = function (lv) {
    // 清理旧区块
    for (const c of chunks.values()) disposeChunk(c);
    chunks.clear(); dirty.clear(); spawnedDrops.clear();
    level = lv; H = lv.H;
    W.level = lv;
  };

  /* ---------------- 区块数据 ---------------- */
  function genChunk(cx, cz) {
    const data = new Uint8Array(CS * CS * H);
    const col = new Uint8Array(H);
    const k = key(cx, cz);
    const wantDrops = !spawnedDrops.has(k);
    const drops = [];
    for (let lx = 0; lx < CS; lx++) {
      for (let lz = 0; lz < CS; lz++) {
        const wx = cx * CS + lx, wz = cz * CS + lz;
        level.fillColumn(wx, wz, col);
        for (let y = 0; y < H; y++) data[(y * CS + lz) * CS + lx] = col[y];
        if (wantDrops) {
          const ex = level.extras(wx, wz);
          for (const e of ex) drops.push(e);
        }
      }
    }
    if (wantDrops) spawnedDrops.add(k);
    const c = {
      cx, cz, data,
      mesh: null, glitchMesh: null,
      lights: [],
      pendingDrops: wantDrops ? drops : null
    };
    scanLights(c);
    return c;
  }
  function scanLights(c) {
    c.lights.length = 0;
    for (let y = 0; y < H; y++)
      for (let lz = 0; lz < CS; lz++)
        for (let lx = 0; lx < CS; lx++) {
          const id = c.data[(y * CS + lz) * CS + lx];
          const def = B.defs[id];
          if (def && def.light) {
            c.lights.push({
              x: c.cx * CS + lx + 0.5, y: y + (id === B.LIGHT ? -0.4 : 0.5), z: c.cz * CS + lz + 0.5,
              p: def.light
            });
          }
        }
  }

  W.ensureChunk = function (cx, cz) {
    const k = key(cx, cz);
    let c = chunks.get(k);
    if (!c) {
      c = genChunk(cx, cz);
      chunks.set(k, c);
      dirty.add(k);
      // 新区块带来的光源会影响已建好的邻居
      if (c.lights.length) {
        for (let dx = -1; dx <= 1; dx++)
          for (let dz = -1; dz <= 1; dz++) {
            const nk = key(cx + dx, cz + dz);
            const nc = chunks.get(nk);
            if (nc && nc.mesh) dirty.add(nk);
          }
      }
    }
    return c;
  };
  W.getChunk = function (cx, cz) { return chunks.get(key(cx, cz)); };

  W.getBlock = function (x, y, z) {
    if (y < 0 || y >= H) return B.AIR;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = W.ensureChunk(cx, cz);
    return c.data[(y * CS + (z - cz * CS)) * CS + (x - cx * CS)];
  };
  W.setBlock = function (x, y, z, id) {
    if (y < 0 || y >= H) return;
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = W.ensureChunk(cx, cz);
    c.data[(y * CS + (z - cz * CS)) * CS + (x - cx * CS)] = id;
    scanLights(c);
    markDirtyAround(x, z, cx, cz);
  };
  function markDirtyAround(x, z, cx, cz) {
    dirty.add(key(cx, cz));
    // 光照半径影响邻近区块
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const k = key(cx + dx, cz + dz);
        if (chunks.has(k)) dirty.add(k);
      }
  }
  W.isSolid = function (x, y, z) {
    const def = B.defs[W.getBlock(x, y, z)];
    return def ? !!def.solid : false;
  };

  /* ---------------- 光照 ---------------- */
  function gatherLights(cx, cz) {
    const arr = [];
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const c = chunks.get(key(cx + dx, cz + dz));
        if (c) for (const l of c.lights) arr.push(l);
      }
    return arr;
  }
  W.lightAt = function (x, y, z) {
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const lights = gatherLights(cx, cz);
    return computeLight(x, y, z, lights);
  };
  function computeLight(x, y, z, lights) {
    let v = level.ambient;
    const range = level.lightRange;
    for (let i = 0; i < lights.length; i++) {
      const l = lights[i];
      const dx = x - l.x, dy = y - l.y, dz = z - l.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < range) {
        const t = 1 - d / range;
        v += t * t * (2 - t) * l.p * level.lightPower;
      }
    }
    return Math.min(1.25, v);
  }

  /* ---------------- 网格化 ---------------- */
  // 标准体素面表（顶点逆时针，UV 已配对）
  const FACES = [
    {
      dir: [-1, 0, 0], shade: 0.80, corners: [
        { p: [0, 1, 0], u: [0, 1] }, { p: [0, 0, 0], u: [0, 0] }, { p: [0, 1, 1], u: [1, 1] }, { p: [0, 0, 1], u: [1, 0] }]
    },
    {
      dir: [1, 0, 0], shade: 0.80, corners: [
        { p: [1, 1, 1], u: [0, 1] }, { p: [1, 0, 1], u: [0, 0] }, { p: [1, 1, 0], u: [1, 1] }, { p: [1, 0, 0], u: [1, 0] }]
    },
    {
      dir: [0, -1, 0], shade: 0.55, corners: [
        { p: [1, 0, 1], u: [1, 0] }, { p: [0, 0, 1], u: [0, 0] }, { p: [1, 0, 0], u: [1, 1] }, { p: [0, 0, 0], u: [0, 1] }]
    },
    {
      dir: [0, 1, 0], shade: 1.0, corners: [
        { p: [0, 1, 1], u: [1, 1] }, { p: [1, 1, 1], u: [0, 1] }, { p: [0, 1, 0], u: [1, 0] }, { p: [1, 1, 0], u: [0, 0] }]
    },
    {
      dir: [0, 0, -1], shade: 0.68, corners: [
        { p: [1, 0, 0], u: [0, 0] }, { p: [0, 0, 0], u: [1, 0] }, { p: [1, 1, 0], u: [0, 1] }, { p: [0, 1, 0], u: [1, 1] }]
    },
    {
      dir: [0, 0, 1], shade: 0.68, corners: [
        { p: [0, 0, 1], u: [0, 0] }, { p: [1, 0, 1], u: [1, 0] }, { p: [0, 1, 1], u: [0, 1] }, { p: [1, 1, 1], u: [1, 1] }]
    }
  ];

  let material = null, glitchMaterial = null;
  function ensureMaterials() {
    if (!material) {
      material = new THREE.MeshLambertMaterial({
        map: BRAssets.atlasTexture, vertexColors: true
      });
      glitchMaterial = new THREE.MeshLambertMaterial({
        map: BRAssets.glitchTexture, vertexColors: true,
        emissive: new THREE.Color(0x223322), emissiveIntensity: 0.6
      });
    }
  }
  W.materials = () => { ensureMaterials(); return { material, glitchMaterial }; };

  function tileFor(def, x, y, z, face) {
    let tiles = def.tiles;
    if (typeof tiles === 'function') tiles = tiles(x, y, z);
    if (face === 3) return tiles.top;
    if (face === 2) return tiles.bottom;
    return tiles.side;
  }

  function blockAtLocal(c, lx, y, lz) {
    if (y < 0 || y >= H) return B.AIR;
    if (lx >= 0 && lx < CS && lz >= 0 && lz < CS)
      return c.data[(y * CS + lz) * CS + lx];
    return W.getBlock(c.cx * CS + lx, y, c.cz * CS + lz);
  }

  function buildChunkMesh(c) {
    ensureMaterials();
    const lights = gatherLights(c.cx, c.cz);
    const pos = [], uv = [], col = [], idx = [];
    const gpos = [], guv = [], gcol = [], gidx = [];

    for (let y = 0; y < H; y++) {
      for (let lz = 0; lz < CS; lz++) {
        for (let lx = 0; lx < CS; lx++) {
          const id = c.data[(y * CS + lz) * CS + lx];
          if (id === B.AIR) continue;
          const def = B.defs[id];
          const wx = c.cx * CS + lx, wz = c.cz * CS + lz;
          const isGlitch = !!def.glitch;
          const P = isGlitch ? gpos : pos, U = isGlitch ? guv : uv,
            C = isGlitch ? gcol : col, I = isGlitch ? gidx : idx;

          for (let f = 0; f < FACES.length; f++) {
            const face = FACES[f];
            const nx = lx + face.dir[0], ny = y + face.dir[1], nz = lz + face.dir[2];
            if (ny < 0 || ny >= H) continue; // 世界上下边界永不可见
            const nid = blockAtLocal(c, nx, ny, nz);
            const ndef = B.defs[nid];
            if (ndef && ndef.solid && !ndef.glitch) continue; // 被遮挡
            if (isGlitch && ndef && ndef.glitch) continue;

            const tileName = tileFor(def, wx, y, wz, f);
            const tuv = BRAssets.tileUV[tileName] || BRAssets.tileUV.wallpaper0;
            const vi = P.length / 3;
            for (let v = 0; v < 4; v++) {
              const cr = face.corners[v].p;
              const cu = face.corners[v].u;
              const vx = wx + cr[0], vy = y + cr[1], vz = wz + cr[2];
              P.push(vx, vy, vz);
              // 光照采样：顶点位置向法线外偏移
              let br;
              if (def.fullbright || isGlitch) br = 1.05;
              else {
                const l = computeLight(
                  vx + face.dir[0] * 0.5 - (cr[0] - 0.5) * 0.28,
                  vy + face.dir[1] * 0.5 - (cr[1] - 0.5) * 0.28,
                  vz + face.dir[2] * 0.5 - (cr[2] - 0.5) * 0.28, lights);
                br = face.shade * l;
              }
              C.push(br, br, br);
              if (isGlitch) {
                U.push(cu[0], cu[1]);
              } else {
                const [u0, v0, u1, v1] = tuv;
                U.push(u0 + (u1 - u0) * cu[0], v0 + (v1 - v0) * cu[1]);
              }
            }
            I.push(vi, vi + 1, vi + 2, vi + 2, vi + 1, vi + 3);
          }
        }
      }
    }

    if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
    if (c.glitchMesh) { scene.remove(c.glitchMesh); c.glitchMesh.geometry.dispose(); c.glitchMesh = null; }

    if (idx.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, material);
      m.frustumCulled = true;
      m.matrixAutoUpdate = false;
      scene.add(m);
      c.mesh = m;
    }
    if (gidx.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(guv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(gcol, 3));
      g.setIndex(gidx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, glitchMaterial);
      m.matrixAutoUpdate = false;
      scene.add(m);
      c.glitchMesh = m;
    }
  }

  function disposeChunk(c) {
    if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); }
    if (c.glitchMesh) { scene.remove(c.glitchMesh); c.glitchMesh.geometry.dispose(); }
    c.mesh = null; c.glitchMesh = null;
  }

  /* ---------------- 每帧更新 ---------------- */
  W.viewDist = 3;
  W.update = function (px, pz, onDrops) {
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);
    // 加载范围内区块
    for (let dx = -W.viewDist; dx <= W.viewDist; dx++)
      for (let dz = -W.viewDist; dz <= W.viewDist; dz++) {
        const c = W.ensureChunk(pcx + dx, pcz + dz);
        if (c.pendingDrops && c.pendingDrops.length && onDrops) {
          onDrops(c.pendingDrops);
          c.pendingDrops = null;
        }
      }
    // 卸载远区块
    for (const [k, c] of chunks) {
      const d = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
      if (d > W.viewDist + 2) {
        disposeChunk(c);
        chunks.delete(k);
        dirty.delete(k);
      }
    }
    // 重建脏区块（每帧限量）
    let budget = 2;
    for (const k of dirty) {
      const c = chunks.get(k);
      dirty.delete(k);
      if (!c) continue;
      const d = Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz));
      if (d > W.viewDist) continue;
      buildChunkMesh(c);
      if (--budget <= 0) break;
    }
  };
  W.pendingDirty = () => dirty.size;

  /* ---------------- 射线（DDA） ---------------- */
  W.raycast = function (ox, oy, oz, dx, dy, dz, maxDist) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / (dx || 1e-10)), tDeltaY = Math.abs(1 / (dy || 1e-10)), tDeltaZ = Math.abs(1 / (dz || 1e-10));
    let tMaxX = tDeltaX * (dx > 0 ? (x + 1 - ox) : (ox - x));
    let tMaxY = tDeltaY * (dy > 0 ? (y + 1 - oy) : (oy - y));
    let tMaxZ = tDeltaZ * (dz > 0 ? (z + 1 - oz) : (oz - z));
    let face = [0, 0, 0];
    let t = 0;
    for (let i = 0; i < 128; i++) {
      if (t > maxDist) return null;
      const id = W.getBlock(x, y, z);
      const def = B.defs[id];
      if (def && def.solid) {
        return { x, y, z, id, face: face.slice(), dist: t };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0];
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0];
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ];
      }
    }
    return null;
  };

  // 视线检测（实体 AI 用）
  W.lineOfSight = function (x0, y0, z0, x1, y1, z1) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 0.001) return true;
    const hit = W.raycast(x0, y0, z0, dx / d, dy / d, dz / d, d);
    return !hit;
  };
})();
