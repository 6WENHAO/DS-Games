// ============ 体素世界引擎 ============
const World = (() => {
  const CHUNK = 16, HEIGHT = 72, SEA = 22;
  const RENDER_DIST = 5;

  let scene = null;
  let chunks = new Map();       // key "cx,cz" -> { data, mesh, crossMesh, dirty }
  let material, crossMaterial;
  let planet = null;            // 当前星球配置
  let noiseH, noiseB, noiseD;

  // ---------- 星球配置 ----------
  const PLANET_ARCHETYPES = [
    {
      type: '翠绿星球', grass: 0x6fbf4a, leaves: 0x4a9a3a, fog: 0x9fd4ea, sky: 0x87c5ea,
      base: 1, sub: 2, rock: 3, sand: 8, trees: 0.012, plants: 0.02, crystals: 0.004,
      hazardRate: 0.6, hazardName: '气温 24.1°C · 微风', ambient: 1.0,
    },
    {
      type: '灼热荒漠星球', grass: 0xd8b04a, leaves: 0xb08a3a, fog: 0xf0c890, sky: 0xe8b070,
      base: 8, sub: 8, rock: 12, sand: 8, trees: 0.002, plants: 0.012, crystals: 0.008,
      hazardRate: 2.2, hazardName: '气温 74.8°C · 极端高温', ambient: 1.4,
    },
    {
      type: '冰封星球', grass: 0xd8ecf5, leaves: 0xa8d8e8, fog: 0xc8e4f0, sky: 0xa0c8e0,
      base: 1, sub: 3, rock: 3, sand: 8, trees: 0.008, plants: 0.014, crystals: 0.01,
      hazardRate: 2.0, hazardName: '气温 -63.2°C · 极端严寒', ambient: 0.8,
    },
    {
      type: '绯红异星', grass: 0xc85a70, leaves: 0xa84a80, fog: 0xd8909a, sky: 0xc07888,
      base: 13, sub: 12, rock: 12, sand: 13, trees: 0.009, plants: 0.018, crystals: 0.007,
      hazardRate: 1.4, hazardName: '辐射 18.4 rad · 放射性尘埃', ambient: 1.1,
    },
  ];

  const NAME_SYLLABLES = ['艾', '欧', '格', '诺', '维', '塔', '尔', '希', '克', '拉', '姆', '泽', '因', '乌', '菲'];
  function genPlanetName(rng) {
    let n = '';
    const len = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < len; i++) n += NAME_SYLLABLES[Math.floor(rng() * NAME_SYLLABLES.length)];
    return n + '-' + Math.floor(rng() * 90 + 10) + String.fromCharCode(65 + Math.floor(rng() * 26));
  }

  function makePlanet(seed, archetypeIdx = null) {
    const rng = Noise.makeRng(seed);
    rng(); rng();
    const idx = archetypeIdx !== null ? archetypeIdx : Math.floor(rng() * PLANET_ARCHETYPES.length);
    const arch = PLANET_ARCHETYPES[idx % PLANET_ARCHETYPES.length];
    return {
      seed, archIdx: idx % PLANET_ARCHETYPES.length, ...arch,
      name: genPlanetName(rng),
      hillAmp: 10 + rng() * 14,
      hillFreq: 0.012 + rng() * 0.01,
    };
  }

  // ---------- 地形生成 ----------
  function heightAt(wx, wz) {
    const h1 = noiseH.fbm(wx * planet.hillFreq, wz * planet.hillFreq, 4, 2.1, 0.5);
    const h2 = noiseB.get(wx * 0.003, wz * 0.003);
    const mountains = Math.max(0, noiseB.get(wx * 0.006 + 100, wz * 0.006)) * 26;
    return Math.floor(SEA + 2 + h1 * planet.hillAmp + h2 * 6 + mountains);
  }

  function genChunk(cx, cz) {
    const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
    const idx = (x, y, z) => (y * CHUNK + z) * CHUNK + x;
    for (let x = 0; x < CHUNK; x++) {
      for (let z = 0; z < CHUNK; z++) {
        const wx = cx * CHUNK + x, wz = cz * CHUNK + z;
        const h = heightAt(wx, wz);
        for (let y = 0; y <= Math.min(h, HEIGHT - 1); y++) {
          let b;
          if (y === h) b = planet.base;
          else if (y > h - 3) b = planet.sub;
          else {
            b = planet.rock;
            const r = Noise.hash3(wx, y, wz, planet.seed);
            if (r < 0.015 && y < h - 4) b = 4;        // 磁化矿
            else if (r < 0.028 && y < h - 4) b = 5;   // 铜矿
            else if (r < 0.036 && y < h - 6) b = 14;  // 钴
            // 洞穴
            const cave = Noise.hash3(wx >> 1, y >> 1, wz >> 1, planet.seed ^ 0x5555);
            if (cave < 0.06 && y > 4 && y < h - 3) b = 0;
          }
          data[idx(x, y, z)] = b;
        }
        // 地表植被
        const surfR = Noise.hash3(wx, 0, wz, planet.seed ^ 0xABCD);
        if (h + 1 < HEIGHT) {
          if (surfR < planet.crystals) data[idx(x, h + 1, z)] = 10;                    // 二氢晶体
          else if (surfR < planet.crystals + planet.plants * 0.5) data[idx(x, h + 1, z)] = 9;  // 钠花
          else if (surfR < planet.crystals + planet.plants) data[idx(x, h + 1, z)] = 11;       // 氧花
          else if (surfR < planet.crystals + planet.plants + planet.trees && x > 2 && x < 13 && z > 2 && z < 13) {
            // 树
            const th = 4 + Math.floor(Noise.hash3(wx, 7, wz, planet.seed) * 3);
            for (let ty = 1; ty <= th; ty++) if (h + ty < HEIGHT) data[idx(x, h + ty, z)] = 6;
            for (let lx = -2; lx <= 2; lx++) for (let lz = -2; lz <= 2; lz++) for (let ly = 0; ly <= 2; ly++) {
              const ax = x + lx, ay = h + th - 1 + ly, az = z + lz;
              if (ax < 0 || ax >= CHUNK || az < 0 || az >= CHUNK || ay >= HEIGHT) continue;
              if (Math.abs(lx) + Math.abs(lz) + ly > 3.5) continue;
              if (data[idx(ax, ay, az)] === 0) data[idx(ax, ay, az)] = 7;
            }
          }
        }
      }
    }
    return data;
  }

  // ---------- 网格构建 ----------
  const FACES = [
    { dir: [1, 0, 0], corners: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]], shade: 0.8 },
    { dir: [-1, 0, 0], corners: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]], shade: 0.8 },
    { dir: [0, 1, 0], corners: [[0, 1, 0], [0, 1, 1], [1, 1, 0], [1, 1, 1]], shade: 1.0, top: true },
    { dir: [0, -1, 0], corners: [[0, 0, 1], [0, 0, 0], [1, 0, 1], [1, 0, 0]], shade: 0.5, bottom: true },
    { dir: [0, 0, 1], corners: [[0, 1, 1], [0, 0, 1], [1, 1, 1], [1, 0, 1]], shade: 0.7 },
    { dir: [0, 0, -1], corners: [[1, 1, 0], [1, 0, 0], [0, 1, 0], [0, 0, 0]], shade: 0.7 },
  ];

  function getBlockLocal(chunkEntry, cx, cz, x, y, z) {
    if (y < 0) return 3;
    if (y >= HEIGHT) return 0;
    if (x >= 0 && x < CHUNK && z >= 0 && z < CHUNK)
      return chunkEntry.data[(y * CHUNK + z) * CHUNK + x];
    return getBlock(cx * CHUNK + x, y, cz * CHUNK + z, false);
  }

  function buildChunkMesh(cx, cz) {
    const entry = chunks.get(cx + ',' + cz);
    if (!entry) return;
    if (entry.mesh) { scene.remove(entry.mesh); entry.mesh.geometry.dispose(); }
    if (entry.crossMesh) { scene.remove(entry.crossMesh); entry.crossMesh.geometry.dispose(); }

    const pos = [], norm = [], uv = [], col = [], indices = [];
    const cpos = [], cnorm = [], cuv = [], ccol = [], cindices = [];
    const grassTint = new THREE.Color(planet.grass);
    const leafTint = new THREE.Color(planet.leaves);

    for (let y = 0; y < HEIGHT; y++) {
      for (let z = 0; z < CHUNK; z++) {
        for (let x = 0; x < CHUNK; x++) {
          const b = entry.data[(y * CHUNK + z) * CHUNK + x];
          if (b === 0) continue;
          const def = BLOCKS[b];
          const wx = cx * CHUNK + x, wz = cz * CHUNK + z;

          if (def.cross) {
            // 交叉面片植物
            const [u0, v0, u1, v1] = Textures.uvFor(def.tex[0]);
            const quads = [
              [[0.15, 0, 0.15], [0.85, 0, 0.85], [0.85, 1, 0.85], [0.15, 1, 0.15]],
              [[0.85, 0, 0.15], [0.15, 0, 0.85], [0.15, 1, 0.85], [0.85, 1, 0.15]],
            ];
            quads.forEach(q => {
              const base = cpos.length / 3;
              q.forEach(c => { cpos.push(wx + c[0], y + c[1], wz + c[2]); cnorm.push(0, 1, 0); ccol.push(1, 1, 1); });
              cuv.push(u0, v0, u1, v0, u1, v1, u0, v1);
              cindices.push(base, base + 1, base + 2, base, base + 2, base + 3);
              cindices.push(base, base + 2, base + 1, base, base + 3, base + 2);
            });
            continue;
          }

          for (const face of FACES) {
            const nx = x + face.dir[0], ny = y + face.dir[1], nz = z + face.dir[2];
            const nb = getBlockLocal(entry, cx, cz, nx, ny, nz);
            const nDef = BLOCKS[nb];
            if (nb !== 0 && !nDef.cross && !(nDef.translucent && nb !== b)) {
              if (!(nDef.translucent && !def.translucent)) continue;
            }

            const texIdx = face.top ? def.tex[0] : face.bottom ? def.tex[2] : def.tex[1];
            const [u0, v0, u1, v1] = Textures.uvFor(texIdx);
            const base = pos.length / 3;

            let tint = null;
            if (def.tintTop && face.top) tint = grassTint;
            else if (def.tint) tint = leafTint;

            face.corners.forEach(c => {
              pos.push(wx + c[0], y + c[1], wz + c[2]);
              norm.push(...face.dir);
              const s = face.shade;
              if (tint) col.push(tint.r * s, tint.g * s, tint.b * s);
              else col.push(s, s, s);
            });
            uv.push(u0, v1, u0, v0, u1, v1, u1, v0);
            indices.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
        }
      }
    }

    if (pos.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(indices);
      const mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = true;
      scene.add(mesh);
      entry.mesh = mesh;
    } else entry.mesh = null;

    if (cpos.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(cpos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(cnorm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(cuv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(ccol, 3));
      geo.setIndex(cindices);
      const mesh = new THREE.Mesh(geo, crossMaterial);
      scene.add(mesh);
      entry.crossMesh = mesh;
    } else entry.crossMesh = null;

    entry.dirty = false;
  }

  // ---------- 公共 API ----------
  function init(sceneRef) {
    scene = sceneRef;
    const atlas = Textures.atlas || Textures.buildAtlas();
    material = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5 });
    crossMaterial = new THREE.MeshLambertMaterial({ map: atlas, vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide });
  }

  function setPlanet(p) {
    planet = p;
    noiseH = new Noise.Noise2D(p.seed);
    noiseB = new Noise.Noise2D(p.seed ^ 0x1234);
    noiseD = new Noise.Noise2D(p.seed ^ 0x9876);
    clear();
  }

  function clear() {
    chunks.forEach(e => {
      if (e.mesh) { scene.remove(e.mesh); e.mesh.geometry.dispose(); }
      if (e.crossMesh) { scene.remove(e.crossMesh); e.crossMesh.geometry.dispose(); }
    });
    chunks.clear();
  }

  function ensureChunk(cx, cz) {
    const key = cx + ',' + cz;
    let e = chunks.get(key);
    if (!e) {
      e = { data: genChunk(cx, cz), mesh: null, crossMesh: null, dirty: true };
      chunks.set(key, e);
    }
    return e;
  }

  let buildQueue = [];
  function update(centerX, centerZ, budgetMs = 8) {
    const ccx = Math.floor(centerX / CHUNK), ccz = Math.floor(centerZ / CHUNK);
    // 需要的区块
    const needed = new Set();
    for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++)
      for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++) {
        if (dx * dx + dz * dz > (RENDER_DIST + 0.5) ** 2) continue;
        const cx = ccx + dx, cz = ccz + dz;
        needed.add(cx + ',' + cz);
        const e = ensureChunk(cx, cz);
        if (e.dirty && !buildQueue.includes(cx + ',' + cz)) buildQueue.push(cx + ',' + cz);
      }
    // 卸载远处区块
    chunks.forEach((e, key) => {
      if (!needed.has(key)) {
        const [cx, cz] = key.split(',').map(Number);
        if (Math.abs(cx - ccx) > RENDER_DIST + 2 || Math.abs(cz - ccz) > RENDER_DIST + 2) {
          if (e.mesh) { scene.remove(e.mesh); e.mesh.geometry.dispose(); }
          if (e.crossMesh) { scene.remove(e.crossMesh); e.crossMesh.geometry.dispose(); }
          chunks.delete(key);
        }
      }
    });
    // 按距离排序, 限时构建
    buildQueue.sort((a, b) => {
      const [ax, az] = a.split(',').map(Number), [bx, bz] = b.split(',').map(Number);
      return ((ax - ccx) ** 2 + (az - ccz) ** 2) - ((bx - ccx) ** 2 + (bz - ccz) ** 2);
    });
    const t0 = performance.now();
    while (buildQueue.length && performance.now() - t0 < budgetMs) {
      const key = buildQueue.shift();
      const e = chunks.get(key);
      if (e && e.dirty) {
        const [cx, cz] = key.split(',').map(Number);
        buildChunkMesh(cx, cz);
      }
    }
  }

  function getBlock(wx, wy, wz, gen = true) {
    if (wy < 0) return 3;
    if (wy >= HEIGHT) return 0;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const key = cx + ',' + cz;
    let e = chunks.get(key);
    if (!e) { if (!gen) return 0; e = ensureChunk(cx, cz); }
    const x = wx - cx * CHUNK, z = wz - cz * CHUNK;
    return e.data[(wy * CHUNK + z) * CHUNK + x];
  }

  function setBlock(wx, wy, wz, b) {
    if (wy < 0 || wy >= HEIGHT) return;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const e = ensureChunk(cx, cz);
    const x = wx - cx * CHUNK, z = wz - cz * CHUNK;
    e.data[(wy * CHUNK + z) * CHUNK + x] = b;
    markDirty(cx, cz);
    if (x === 0) markDirty(cx - 1, cz);
    if (x === CHUNK - 1) markDirty(cx + 1, cz);
    if (z === 0) markDirty(cx, cz - 1);
    if (z === CHUNK - 1) markDirty(cx, cz + 1);
  }

  function markDirty(cx, cz) {
    const e = chunks.get(cx + ',' + cz);
    if (e) { e.dirty = true; const k = cx + ',' + cz; if (!buildQueue.includes(k)) buildQueue.unshift(k); }
  }

  function isSolid(wx, wy, wz) {
    const b = getBlock(Math.floor(wx), Math.floor(wy), Math.floor(wz));
    return b !== 0 && !BLOCKS[b].cross;
  }

  // DDA 射线投射
  function raycast(origin, dir, maxDist) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);
    const tDeltaX = Math.abs(1 / dir.x), tDeltaY = Math.abs(1 / dir.y), tDeltaZ = Math.abs(1 / dir.z);
    let tMaxX = dir.x !== 0 ? (stepX > 0 ? (x + 1 - origin.x) : (origin.x - x)) * tDeltaX : Infinity;
    let tMaxY = dir.y !== 0 ? (stepY > 0 ? (y + 1 - origin.y) : (origin.y - y)) * tDeltaY : Infinity;
    let tMaxZ = dir.z !== 0 ? (stepZ > 0 ? (z + 1 - origin.z) : (origin.z - z)) * tDeltaZ : Infinity;
    let face = [0, 0, 0], t = 0;
    while (t <= maxDist) {
      const b = getBlock(x, y, z);
      if (b !== 0) return { x, y, z, block: b, face, dist: t };
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0]; }
      else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0]; }
      else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ]; }
    }
    return null;
  }

  function surfaceHeight(wx, wz) {
    for (let y = HEIGHT - 1; y > 0; y--) {
      const b = getBlock(Math.floor(wx), y, Math.floor(wz));
      if (b !== 0 && !BLOCKS[b].cross) return y + 1;
    }
    return SEA;
  }

  // 平整着陆区: 清除植被并夯实地面, 返回地面高度
  function flattenPad(wx, wz, radius) {
    const bx = Math.floor(wx), bz = Math.floor(wz);
    const h0 = heightAt(bx, bz);
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const x = bx + dx, z = bz + dz;
        for (let y = h0 + 1; y < Math.min(HEIGHT, h0 + 14); y++)
          if (getBlock(x, y, z) !== 0) setBlock(x, y, z, 0);
        for (let y = h0; y > h0 - 3; y--) {
          const b = getBlock(x, y, z);
          if (b === 0 || BLOCKS[b].cross) setBlock(x, y, z, planet.sub);
        }
        if (getBlock(x, h0, z) !== planet.base) setBlock(x, h0, z, planet.base);
      }
    }
    return h0 + 1;
  }

  return {
    init, setPlanet, update, clear, getBlock, setBlock, isSolid, raycast, surfaceHeight, flattenPad,
    makePlanet, heightAt: (x, z) => heightAt(x, z),
    get planet() { return planet; }, CHUNK, HEIGHT, PLANET_ARCHETYPES,
    get pendingBuilds() { return buildQueue.length; },
  };
})();
