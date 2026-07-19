/* world.js - 区块管理 + LOD 环形远景 + Worker 池 + 着色器 */
const World = (function () {
  'use strict';
  let G, scene, atlasTex;
  let seed = 1337;
  let Y0 = 0;                  // 世界 y = 存储 y + Y0（gen.js E.Y0 = -1000）
  let nearRadius = 8;          // 近景区块半径（区块数）
  let viewDist = 2048;         // 远景视距（格）
  let maxLevel = 3;            // LOD 层数
  const LOD_C = 128;           // 每瓦片格数
  const chunks = new Map();    // "cx,cz" -> chunk
  const tiles = new Map();     // "l:tx,tz" -> tile
  const pendingChunks = new Set();
  const pendingTiles = new Set();
  let jobs = [];
  let workers = [];
  let jobSeq = 1;
  let completedR = 0;
  let matOpaque, matAlpha, matWater;
  const lodMats = {};          // level -> {solid, water}
  const FOG_COLOR = new THREE.Color(0xc2d8ee);
  let pcx = 1e9, pcz = 1e9;
  let lastLodX = 1e9, lastLodZ = 1e9;
  let playerX = 0, playerZ = 0;
  let dirX = 0, dirZ = -1;     // 视线方向（⑦ 视锥优先加载）

  /* ---------------- 着色器 ---------------- */
  // 近景顶点：位置为 Int16 定点（×16），shade 为 Uint8 归一化（含 AO 预乘，Sodium 思路）
  // AO 随距离淡出（24→56m 渐隐到无 AO 的 shade2），远处观感与原版一致、近处有体积感
  const CHUNK_VERT = [
    'attribute vec2 tile;',
    'attribute float shade;',
    'attribute float shade2;',
    'varying vec2 vUv; varying vec2 vTile; varying float vShade; varying float vDist; varying float vWy;',
    '#include <common>',
    '#include <logdepthbuf_pars_vertex>',
    'void main(){',
    '  vUv = uv; vTile = tile;',
    '  vec4 wp = modelMatrix * vec4(position * 0.0625, 1.0);',
    '  vWy = wp.y;',
    '  vec4 mv = viewMatrix * wp;',
    '  vDist = length(mv.xyz);',
    '  vShade = mix(shade, shade2, smoothstep(24.0, 56.0, vDist));',
    '  gl_Position = projectionMatrix * mv;',
    '  #include <logdepthbuf_vertex>',
    '}'
  ].join('\n');
  const CHUNK_FRAG = [
    'uniform sampler2D map; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;',
    'varying vec2 vUv; varying vec2 vTile; varying float vShade; varying float vDist; varying float vWy;',
    '#include <common>',
    '#include <logdepthbuf_pars_fragment>',
    'void main(){',
    '  #include <logdepthbuf_fragment>',
    '  vec2 f = fract(vUv);',
    '  vec2 uvw = (vTile + vec2(f.x, 1.0 - f.y)) / 16.0;',
    '  vec4 c = texture2D(map, uvw);',
    '#ifdef ATEST',
    '  if (c.a < 0.5) discard;',
    '#endif',
    // 深处渐暗：世界 y 40 以下线性变暗至 -560 处 0.30（深盆地/矿井氛围）
    '  float dk = 0.30 + 0.70 * clamp((vWy + 560.0) / 600.0, 0.0, 1.0);',
    '  vec3 col = c.rgb * vShade * dk;',
    '  float fw = smoothstep(fogNear, fogFar, vDist);',
    '  gl_FragColor = vec4(mix(col, fogColor, fw), 1.0);',
    '}'
  ].join('\n');
  const WATER_FRAG = [
    'uniform vec3 waterCol; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;',
    'varying float vDist; varying float vWy;',
    '#include <common>',
    '#include <logdepthbuf_pars_fragment>',
    'void main(){',
    '  #include <logdepthbuf_fragment>',
    '  float dk = 0.30 + 0.70 * clamp((vWy + 560.0) / 600.0, 0.0, 1.0);',
    '  float fw = smoothstep(fogNear, fogFar, vDist);',
    '  gl_FragColor = vec4(mix(waterCol * dk, fogColor, fw), 0.72 * (1.0 - fw) + 0.0001);',
    '}'
  ].join('\n');
  const WATER_VERT = [
    'varying float vDist; varying float vWy;',
    '#include <common>',
    '#include <logdepthbuf_pars_vertex>',
    'void main(){',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    '  vWy = wp.y;',
    '  vec4 mv = viewMatrix * wp;',
    '  vDist = length(mv.xyz);',
    '  gl_Position = projectionMatrix * mv;',
    '  #include <logdepthbuf_vertex>',
    '}'
  ].join('\n');
  const LOD_VERT = [
    'attribute vec3 acol;',
    'uniform vec2 ply;',
    'varying vec3 vCol; varying float vDist; varying vec2 vW; varying float vWy;',
    '#include <common>',
    '#include <logdepthbuf_pars_vertex>',
    'void main(){',
    '  vCol = acol;',
    '  vec4 wp = modelMatrix * vec4(position, 1.0);',
    // 连续距离下沉（替代逐层阶梯 yOff）：沉降随距离线性增长，各层在共享边界处沉降相同 → 无台阶
    '#ifndef WATER',
    '  wp.y -= max(abs(wp.x - ply.x), abs(wp.z - ply.y)) * 0.0017578;',
    '#endif',
    '  vW = wp.xz;',
    '  vWy = wp.y;',
    '  vec4 mv = viewMatrix * wp;',
    '  vDist = length(mv.xyz);',
    '  gl_Position = projectionMatrix * mv;',
    '  #include <logdepthbuf_vertex>',
    '}'
  ].join('\n');
  const LOD_FRAG = [
    'uniform vec3 fogColor; uniform float fogNear; uniform float fogFar;',
    'uniform float holeMin; uniform float outerMax; uniform vec2 ply;',
    'uniform float bandI; uniform float bandO;',
    'varying vec3 vCol; varying float vDist; varying vec2 vW; varying float vWy;',
    '#include <common>',
    '#include <logdepthbuf_pars_fragment>',
    'void main(){',
    '  #include <logdepthbuf_fragment>',
    '#ifdef CLIP',
    '  float cheb = max(abs(vW.x - ply.x), abs(vW.y - ply.y));',
    '  if (cheb < holeMin || cheb >= outerMax) discard;',
    // 环边界互补点抖过渡（stipple crossfade）：细层外缘保 aOut≥dn，粗层内缘保 aIn≥1-dn，
    // 两侧过渡带对齐同一区间且共用同一屏幕噪声 → 每像素恰有一层，既无缝也无双重叠加
    '  float dn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));',
    '  float aOut = 1.0 - smoothstep(outerMax - bandO, outerMax, cheb);',
    '  if (aOut < dn) discard;',
    '  float aIn = mix(1.0, smoothstep(holeMin, holeMin + bandI, cheb), step(4.0, holeMin));',
    '  if (aIn < 1.0 - dn) discard;',
    '#endif',
    '  float dk = 0.30 + 0.70 * clamp((vWy + 560.0) / 600.0, 0.0, 1.0);',
    '  float fw = smoothstep(fogNear, fogFar, vDist);',
    '#ifdef WATER',
    '  gl_FragColor = vec4(mix(vCol * dk, fogColor, fw), 0.72 * (1.0 - fw) + 0.0001);',
    '#else',
    '  gl_FragColor = vec4(mix(vCol * dk, fogColor, fw), 1.0);',
    '#endif',
    '}'
  ].join('\n');

  function fogUniforms() {
    return {
      fogColor: { value: FOG_COLOR },
      fogNear: { value: viewDist * 0.55 },
      fogFar: { value: viewDist * 0.98 }
    };
  }
  const allFogMats = [];
  function makeMaterials() {
    matOpaque = new THREE.ShaderMaterial({
      uniforms: Object.assign({ map: { value: atlasTex } }, fogUniforms()),
      vertexShader: CHUNK_VERT, fragmentShader: CHUNK_FRAG
    });
    matAlpha = new THREE.ShaderMaterial({
      uniforms: Object.assign({ map: { value: atlasTex } }, fogUniforms()),
      vertexShader: CHUNK_VERT, fragmentShader: CHUNK_FRAG,
      defines: { ATEST: 1 }, side: THREE.DoubleSide
    });
    matWater = new THREE.ShaderMaterial({
      uniforms: Object.assign({ waterCol: { value: new THREE.Color(0x3a76cd) } }, fogUniforms()),
      vertexShader: WATER_VERT, fragmentShader: WATER_FRAG,
      transparent: true, depthWrite: true
    });
    allFogMats.push(matOpaque, matAlpha, matWater);
  }
  function lodMatFor(level) {
    if (lodMats[level]) return lodMats[level];
    // 每层共享一组 uniform 对象：普通材质（无 discard，保 early-Z）+ 环边界裁剪材质
    const u = Object.assign({
      holeMin: { value: 0 }, outerMax: { value: 1e9 }, ply: { value: new THREE.Vector2() },
      // 边界带宽与相邻层对齐：本层内缘带 12·2^l == 细层外缘带 24·2^(l-1)，保证互补覆盖
      bandI: { value: 12 * (1 << level) }, bandO: { value: 24 * (1 << level) }
    }, fogUniforms());
    function mk(defines, transparent) {
      return new THREE.ShaderMaterial({
        uniforms: u, vertexShader: LOD_VERT, fragmentShader: LOD_FRAG,
        defines: defines, transparent: transparent, depthWrite: !transparent
      });
    }
    const solid = mk({}, false);
    const solidClip = mk({ CLIP: 1 }, false);
    const water = mk({ WATER: 1 }, true);
    const waterClip = mk({ WATER: 1, CLIP: 1 }, true);
    // 水面开启 depthWrite：所有层水面共面，等深度测试保证任意像素只混合一层（消除重叠带双重叠加变暗）
    water.depthWrite = true;
    waterClip.depthWrite = true;
    allFogMats.push(solid, solidClip, water, waterClip);
    lodMats[level] = { u: u, solid: solid, solidClip: solidClip, water: water, waterClip: waterClip };
    return lodMats[level];
  }

  /* ---------------- Worker 池 ---------------- */
  function workerOnMessage(ev) {
    const m = ev.data;
    if (m.t === 'init') { E.setSeed(m.seed); return; }
    if (m.t === 'chunk') {
      const g = E.genChunk(m.cx, m.cz);
      const H = g.H, pad = g.pad;
      const gb = function (x, y, z) { if (y < 0) return 12; if (y >= H) return 0; return pad[((x + 1) * 18 + (z + 1)) * H + y]; };
      const mm = E.meshChunk(gb, g.hmax, pad, H, g.hmin);
      self.postMessage({ t: 'chunk', cx: m.cx, cz: m.cz, blocks: g.blocks, hmax: g.hmax, H: H, hmin: g.hmin, o: mm.opq, a: mm.alp, w: mm.wat },
        [g.blocks.buffer,
        mm.opq.pos.buffer, mm.opq.uv.buffer, mm.opq.tile.buffer, mm.opq.shade.buffer, mm.opq.shade2.buffer, mm.opq.idx.buffer,
        mm.alp.pos.buffer, mm.alp.uv.buffer, mm.alp.tile.buffer, mm.alp.shade.buffer, mm.alp.shade2.buffer, mm.alp.idx.buffer,
        mm.wat.pos.buffer, mm.wat.idx.buffer]);
      return;
    }
    if (m.t === 'lod') {
      const r = E.buildLodTile(m.level, m.tx, m.tz, m.C);
      self.postMessage({ t: 'lod', level: m.level, tx: m.tx, tz: m.tz, solid: r.solid, water: r.water },
        [r.solid.pos.buffer, r.solid.col.buffer, r.solid.idx.buffer,
        r.water.pos.buffer, r.water.col.buffer, r.water.idx.buffer]);
    }
  }
  function makeWorkers() {
    const src =
      'const E = {};\n' +
      '(' + GEN_MODULE.toString() + ')(E);\n' +
      '(' + MESHER_MODULE.toString() + ')(E);\n' +
      '(' + LOD_MODULE.toString() + ')(E);\n' +
      'self.onmessage = ' + workerOnMessage.toString() + ';\n';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const n = Math.min(4, Math.max(2, (navigator.hardwareConcurrency || 4) - 1));
    for (let i = 0; i < n; i++) {
      const w = new Worker(url);
      w.busy = false;
      w.onmessage = function (ev) { w.busy = false; onWorkerMsg(ev.data); pump(); };
      w.onerror = function (e) { console.error('worker error', e.message); };
      w.postMessage({ t: 'init', seed: seed });
      workers.push(w);
    }
  }
  function jobKey(j) {
    const dx = j.wx - playerX, dz = j.wz - playerZ;
    const d = Math.max(Math.abs(dx), Math.abs(dz));
    let eff = d;
    if (d > 40) {
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      const facing = (dx * dirX + dz * dirZ) / len;   // 1=正前方 -1=正后方
      eff = d * (1.9 - 0.9 * facing);
    }
    return j.base + eff;
  }
  /* 排序节流：仅在队列变化或 400ms 超时后重排（Lithium：去热路径冗余工作） */
  let jobsDirty = true, lastSortT = 0;
  function pump() {
    if (!jobs.length) return;
    const now = performance.now();
    if (jobsDirty || now - lastSortT > 400) {
      jobs.sort(function (a, b) { return jobKey(a) - jobKey(b); });
      jobsDirty = false;
      lastSortT = now;
    }
    for (let i = 0; i < workers.length && jobs.length; i++) {
      const w = workers[i];
      if (w.busy) continue;
      const j = jobs.shift();
      w.busy = true;
      w.postMessage(j.msg);
    }
  }
  function queueChunk(cx, cz, dist) {
    const key = cx + ',' + cz;
    if (pendingChunks.has(key)) return;
    pendingChunks.add(key);
    jobs.push({ base: 0, wx: cx * 16 + 8, wz: cz * 16 + 8, msg: { t: 'chunk', cx: cx, cz: cz } });
    jobsDirty = true;
  }
  function queueTile(level, tx, tz, blanket) {
    const key = level + ':' + tx + ',' + tz;
    if (pendingTiles.has(key)) return;
    pendingTiles.add(key);
    const T = LOD_C * (1 << level);
    jobs.push({
      // ⑧ 粗层毯式任务优先（先铺满全视距，再由近向远细化）
      base: blanket ? (maxLevel - level + 1) * 1e6 : 1e7 * level,
      wx: tx * T + T / 2, wz: tz * T + T / 2,
      msg: { t: 'lod', level: level, tx: tx, tz: tz, C: LOD_C }
    });
    jobsDirty = true;
  }

  function onWorkerMsg(m) {
    if (m.t === 'chunk') {
      const key = m.cx + ',' + m.cz;
      pendingChunks.delete(key);
      if (Math.max(Math.abs(m.cx - pcx), Math.abs(m.cz - pcz)) > nearRadius + 1) return;
      const c = { cx: m.cx, cz: m.cz, blocks: m.blocks, hmax: m.hmax || G.CHH - 1, H: m.H || G.CHH, hmin: m.hmin || 0, group: null };
      buildChunkMeshes(c, m.o, m.a, m.w, false);
      const old = chunks.get(key);
      if (old) disposeChunk(old);
      chunks.set(key, c);
    } else if (m.t === 'lod') {
      const key = m.level + ':' + m.tx + ',' + m.tz;
      pendingTiles.delete(key);
      if (m.level > maxLevel) return;
      const t = buildTileMeshes(m);
      const old = tiles.get(key);
      if (old) disposeTile(old);
      tiles.set(key, t);
    }
  }

  /* ---------------- 近景区块 ---------------- */
  const risingChunks = new Set();
  function buildChunkMeshes(c, o, a, w, instant) {
    const grp = new THREE.Group();
    grp.position.set(c.cx * 16, Y0 + (instant ? 0 : -7), c.cz * 16);
    grp.matrixAutoUpdate = false;
    grp.updateMatrix();
    // 压缩顶点（Sodium CompactChunkVertex 思路）：Int16 定点位置 + Uint8 归一化 shade
    // 包围球在 Worker 侧算好 y 范围，主线程免扫描（避免 three 惰性计算引起的首帧卡顿）
    function mkGeom(d, mat, withUv) {
      if (!d.idx.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
      if (withUv) {
        g.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
        g.setAttribute('tile', new THREE.BufferAttribute(d.tile, 2));
        g.setAttribute('shade', new THREE.BufferAttribute(d.shade, 1, true));
        g.setAttribute('shade2', new THREE.BufferAttribute(d.shade2, 1, true));
      }
      g.setIndex(new THREE.BufferAttribute(d.idx, 1));
      const cy = (d.y0 + d.y1) / 2, hy = (d.y1 - d.y0) / 2 + 1;
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(8, cy, 8), Math.sqrt(128 + hy * hy) + 1);
      const mesh = new THREE.Mesh(g, mat);
      mesh.matrixAutoUpdate = false;
      grp.add(mesh);
      return mesh;
    }
    mkGeom(o, matOpaque, true);
    mkGeom(a, matAlpha, true);
    mkGeom(w, matWater, false);
    scene.add(grp);
    c.group = grp;
    if (!instant) {
      grp.userData.born = performance.now();
      risingChunks.add(c);
    }
  }
  function disposeChunk(c) {
    if (!c.group) return;
    risingChunks.delete(c);
    scene.remove(c.group);
    c.group.children.forEach(function (mesh) { mesh.geometry.dispose(); });
    c.group = null;
  }
  function animateChunks(now) {
    risingChunks.forEach(function (c) {
      if (!c.group) { risingChunks.delete(c); return; }
      const k = Math.min(1, (now - c.group.userData.born) / 450);
      const e = 1 - (1 - k) * (1 - k);
      c.group.position.y = Y0 - 7 * (1 - e);
      c.group.updateMatrix();
      if (k >= 1) risingChunks.delete(c);
    });
  }

  function updateNear(px, pz, force) {
    const ncx = Math.floor(px / 16), ncz = Math.floor(pz / 16);
    if (!force && ncx === pcx && ncz === pcz) return;
    pcx = ncx; pcz = ncz;
    // 丢弃过远
    chunks.forEach(function (c, key) {
      if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > nearRadius + 1) {
        disposeChunk(c);
        chunks.delete(key);
      }
    });
    // 请求缺失（去掉过期任务）
    jobs = jobs.filter(function (j) {
      if (j.msg.t !== 'chunk') return true;
      const keep = Math.max(Math.abs(j.msg.cx - pcx), Math.abs(j.msg.cz - pcz)) <= nearRadius;
      if (!keep) pendingChunks.delete(j.msg.cx + ',' + j.msg.cz);
      return keep;
    });
    jobsDirty = true;
    for (let r = 0; r <= nearRadius; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cx = pcx + dx, cz = pcz + dz;
        if (!chunks.has(cx + ',' + cz)) queueChunk(cx, cz, r);
      }
    }
    pump();
  }
  function computeCompletedR() {
    let r = 0;
    outer: for (; r <= nearRadius; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (!chunks.has((pcx + dx) + ',' + (pcz + dz))) break outer;
      }
    }
    completedR = r; // 全部就绪的半径 = r-1，此处 r 为首个缺口环
    return r - 1;
  }

  /* ---------------- LOD 远景 ---------------- */
  /* ⑥ 瓦片 LRU 缓存：离环瓦片先入缓存（保留几何/GPU缓冲），回访瞬间回填 */
  const tileCache = new Map();
  let cacheBytes = 0;
  const CACHE_BUDGET = 192 * 1048576;
  function stashTile(t) {
    for (let i = 0; i < t.meshes.length; i++) scene.remove(t.meshes[i]);
    tileCache.set(t.key, t);
    cacheBytes += t.bytes || 0;
    while (cacheBytes > CACHE_BUDGET && tileCache.size) {
      const k = tileCache.keys().next().value;
      const old = tileCache.get(k);
      tileCache.delete(k);
      cacheBytes -= old.bytes || 0;
      for (let i = 0; i < old.meshes.length; i++) old.meshes[i].geometry.dispose();
    }
  }
  function reviveTile(key) {
    const t = tileCache.get(key);
    if (!t) return false;
    tileCache.delete(key);
    cacheBytes -= t.bytes || 0;
    for (let i = 0; i < t.meshes.length; i++) scene.add(t.meshes[i]);
    tiles.set(key, t);
    return true;
  }

  function buildTileMeshes(m) {
    const level = m.level, T = LOD_C * (1 << level);
    const mats = lodMatFor(level);
    const t = { key: level + ':' + m.tx + ',' + m.tz, level: level, tx: m.tx, tz: m.tz, meshes: [], bytes: 0, clip: -1 };
    const hT = T / 2;
    const maxSink = 0.45 * (1 << level);   // 顶点着色器连续下沉在本层内的最大值（包围球余量）
    function mkMesh(d, mat, isWater) {
      if (!d.idx.length) return;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
      g.setAttribute('acol', new THREE.BufferAttribute(d.col, 3, true));
      g.setIndex(new THREE.BufferAttribute(d.idx, 1));
      const y0 = d.y0 || 0, y1 = d.y1 || 0;
      const cy = (y0 + y1) / 2 - maxSink / 2, hy = (y1 - y0) / 2 + maxSink / 2 + 1;
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(hT, cy, hT), Math.sqrt(hT * hT * 2 + hy * hy) + 2);
      const mesh = new THREE.Mesh(g, mat);
      mesh.userData.water = !!isWater;
      // 地形沉降改在顶点着色器按距离连续计算（无层间台阶）；水面各层完全共面（配合等深度测试单层混合）
      mesh.position.set(m.tx * T, Y0, m.tz * T);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      scene.add(mesh);
      t.meshes.push(mesh);
      t.bytes += d.pos.byteLength + d.col.byteLength + d.idx.byteLength;
    }
    mkMesh(m.solid, mats.solidClip, false);
    mkMesh(m.water, mats.waterClip, true);
    return t;
  }
  function disposeTile(t) {
    t.meshes.forEach(function (mesh) { scene.remove(mesh); mesh.geometry.dispose(); });
    t.meshes.length = 0;
  }
  function tileRectDist(px, pz, x0, z0, x1, z1) {
    const dx = px < x0 ? x0 - px : px > x1 ? px - x1 : 0;
    const dz = pz < z0 ? z0 - pz : pz > z1 ? pz - z1 : 0;
    return Math.max(dx, dz);
  }
  function tileRectDistMax(px, pz, x0, z0, x1, z1) {
    const dx = Math.max(Math.abs(x0 - px), Math.abs(x1 - px));
    const dz = Math.max(Math.abs(z0 - pz), Math.abs(z1 - pz));
    return Math.max(dx, dz);
  }
  let ringKeys = [];        // 每层环带 key 列表（判定该层是否铺满）
  let holeCur = [0, 0, 0, 0, 0, 0];
  let lastLodT = 0;
  function ringComplete(l) {
    const keys = ringKeys[l];
    if (!keys || !keys.length) return false;
    for (let i = 0; i < keys.length; i++) if (!tiles.has(keys[i])) return false;
    return true;
  }
  // 到半径 r 为止由 0..l 层完整覆盖
  function covRadius(l) {
    let cov = Math.max(0, completedR > 0 ? (completedR - 1) * 16 : 0);
    for (let k = 1; k <= l; k++) {
      if (!ringComplete(k)) break;
      cov = Math.min(256 << k, viewDist);
    }
    return cov;
  }
  function updateLod(px, pz, force) {
    const now = performance.now();
    if (!force && Math.abs(px - lastLodX) < 48 && Math.abs(pz - lastLodZ) < 48 && now - lastLodT < 900) return;
    lastLodX = px; lastLodZ = pz; lastLodT = now;
    const needed = new Set();
    const newRingKeys = [];
    for (let l = 1; l <= maxLevel; l++) {
      const T = LOD_C * (1 << l);
      const outer = Math.min(256 << l, viewDist);
      const innerHole = l === 1 ? 0 : (256 << (l - 1)) - 14 * (1 << l);
      // ⑧ 更细层覆盖不足一半时，本层向内铺"毯"（临时全盘覆盖，细化后入缓存）
      const blanket = l >= 2 && covRadius(l - 1) < (256 << (l - 1)) * 0.55;
      const keys = [];
      const t0x = Math.floor((px - outer) / T), t1x = Math.floor((px + outer) / T);
      const t0z = Math.floor((pz - outer) / T), t1z = Math.floor((pz + outer) / T);
      for (let tx = t0x; tx <= t1x; tx++) for (let tz = t0z; tz <= t1z; tz++) {
        const x0 = tx * T, z0 = tz * T, x1 = x0 + T, z1 = z0 + T;
        const dmin = tileRectDist(px, pz, x0, z0, x1, z1);
        if (dmin > outer) continue;
        const inRing = tileRectDistMax(px, pz, x0, z0, x1, z1) >= innerHole;
        if (!inRing && !blanket) continue;
        const key = l + ':' + tx + ',' + tz;
        needed.add(key);
        if (inRing) keys.push(key);
        if (!tiles.has(key)) {
          if (!reviveTile(key)) queueTile(l, tx, tz, !inRing);
        }
      }
      newRingKeys[l] = keys;
    }
    ringKeys = newRingKeys;
    // 离环/被细化覆盖的瓦片 → 入 LRU 缓存
    tiles.forEach(function (t, key) {
      if (needed.has(key)) return;
      const T = LOD_C * (1 << t.level);
      const outer = Math.min(256 << t.level, viewDist);
      const x0 = t.tx * T, z0 = t.tz * T;
      const dmin = tileRectDist(px, pz, x0, z0, x0 + T, z0 + T);
      const dmax = tileRectDistMax(px, pz, x0, z0, x0 + T, z0 + T);
      const covered = dmax < (holeCur[t.level] || 0) - 2 * (1 << t.level);
      if (t.level > maxLevel || dmin > outer + T * 0.5 || covered) {
        stashTile(t);
        tiles.delete(key);
      }
    });
    // 移除过期 LOD 任务
    jobs = jobs.filter(function (j) {
      if (j.msg.t !== 'lod') return true;
      const key = j.msg.level + ':' + j.msg.tx + ',' + j.msg.tz;
      if (j.msg.level <= maxLevel && needed.has(key)) return true;
      pendingTiles.delete(key);
      return false;
    });
    jobsDirty = true;
    pump();
  }

  /* ---------------- 编辑 ---------------- */
  // 变高度区块：blocks 步幅为 c.H（按需分配），y ≥ c.H 视为空气；越高编辑触发 growChunk 扩容
  // 世界 y = 存储 y + Y0：对外 API 世界坐标，内部索引存储坐标
  function getBlock(wx, wy, wz) {
    const sy = wy - Y0;
    if (sy < 0) return 12;               // 世界底以下视为基岩（防坠出世界）
    if (sy >= G.CHH) return 0;
    const cx = Math.floor(wx / 16), cz = Math.floor(wz / 16);
    const c = chunks.get(cx + ',' + cz);
    if (!c || sy >= c.H) return 0;
    const lx = wx - cx * 16, lz = wz - cz * 16;
    return c.blocks[(lx * 16 + lz) * c.H + sy];
  }
  function hasChunkAt(wx, wz) {
    return chunks.has(Math.floor(wx / 16) + ',' + Math.floor(wz / 16));
  }
  function growChunk(c, needH) {
    const nH = Math.min(G.CHH, Math.max(needH, c.H + 32));
    if (nH <= c.H) return;
    const nb = new Uint8Array(16 * 16 * nH);
    for (let i = 0; i < 256; i++) nb.set(c.blocks.subarray(i * c.H, (i + 1) * c.H), i * nH);
    c.blocks = nb;
    c.H = nH;
  }
  function lowerHmin(cx2, cz2, y) {
    const n = chunks.get(cx2 + ',' + cz2);
    if (n && y - 1 < n.hmin) n.hmin = Math.max(0, y - 1);
  }
  function setBlockRaw(wx, wy, wz, id, dirty) {
    const sy = wy - Y0;
    if (sy < 0 || sy >= G.CHH) return;
    const cx = Math.floor(wx / 16), cz = Math.floor(wz / 16);
    const c = chunks.get(cx + ',' + cz);
    if (!c) return;
    if (sy + 3 > c.H) growChunk(c, sy + 16);
    const lx = wx - cx * 16, lz = wz - cz * 16;
    c.blocks[(lx * 16 + lz) * c.H + sy] = id;
    if (sy + 2 > c.hmax) c.hmax = Math.min(G.CHH - 1, sy + 2);
    if (sy - 1 < c.hmin) c.hmin = Math.max(0, sy - 1);
    dirty.add(cx + ',' + cz);
    if (lx === 0) { dirty.add((cx - 1) + ',' + cz); lowerHmin(cx - 1, cz, sy); }
    if (lx === 15) { dirty.add((cx + 1) + ',' + cz); lowerHmin(cx + 1, cz, sy); }
    if (lz === 0) { dirty.add(cx + ',' + (cz - 1)); lowerHmin(cx, cz - 1, sy); }
    if (lz === 15) { dirty.add(cx + ',' + (cz + 1)); lowerHmin(cx, cz + 1, sy); }
  }
  function remeshChunk(key) {
    const c = chunks.get(key);
    if (!c) return;
    const bx = c.cx * 16, bz = c.cz * 16;
    const gb = function (x, y, z) {
      if (y < 0) return 12;
      if (y >= c.H) return 0;
      if (x >= 0 && x < 16 && z >= 0 && z < 16) return c.blocks[(x * 16 + z) * c.H + y];
      return getBlock(bx + x, y + Y0, bz + z);
    };
    const mm = G.meshChunk(gb, c.hmax, null, 0, c.hmin || 0);
    disposeChunk(c);
    buildChunkMeshes(c, mm.opq, mm.alp, mm.wat, true);
  }
  function setBlock(wx, wy, wz, id) {
    const dirty = new Set();
    setBlockRaw(wx, wy, wz, id, dirty);
    dirty.forEach(remeshChunk);
  }
  function explode(wx, wy, wz, r) {
    const dirty = new Set();
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dy * dy + dz * dz > r * r) continue;
      const x = wx + dx, y = wy + dy, z = wz + dz;
      const id = getBlock(x, y, z);
      if (id !== 0 && id !== 12) setBlockRaw(x, y, z, 0, dirty);
    }
    dirty.forEach(remeshChunk);
  }

  /* 批量方块放置：先全部写入 chunk 数组，再一次重 mesh 各受影响区块 */
  function stampBlocks(list) {
    const dirty = new Set();
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      setBlockRaw(b.x, b.y, b.z, b.id, dirty);
    }
    dirty.forEach(remeshChunk);
  }

  /* ---------------- 对外 ---------------- */
  return {
    FOG_COLOR: FOG_COLOR,
    init: function (opts) {
      G = opts.G; scene = opts.scene; seed = opts.seed;
      Y0 = G.Y0 || 0;
      atlasTex = new THREE.CanvasTexture(opts.atlas);
      atlasTex.magFilter = THREE.NearestFilter;
      atlasTex.minFilter = THREE.NearestFilter;
      atlasTex.generateMipmaps = false;
      atlasTex.flipY = false;
      makeMaterials();
      makeWorkers();
      this.setViewDist(opts.viewDist || 2048);
      if (opts.nearRadius) nearRadius = opts.nearRadius;
    },
    setNearRadius: function (r) {
      nearRadius = Math.max(2, Math.min(16, r | 0));
      updateNear(playerX, playerZ, true);
    },
    getNearRadius: function () { return nearRadius; },
    setViewDist: function (vd) {
      viewDist = Math.max(512, Math.min(8192, vd));
      maxLevel = Math.max(1, Math.min(5, Math.round(Math.log(viewDist / 256) / Math.LN2)));
      for (let i = 0; i < allFogMats.length; i++) {
        allFogMats[i].uniforms.fogNear.value = viewDist * 0.55;
        allFogMats[i].uniforms.fogFar.value = viewDist * 0.98;
      }
      updateLod(playerX, playerZ, true);
    },
    getViewDist: function () { return viewDist; },
    update: function (px, pz) {
      playerX = px; playerZ = pz;
      updateNear(px, pz, false);
      updateLod(px, pz, false);
    },
    frame: function (px, pz, dt, yaw) {
      playerX = px; playerZ = pz;
      if (yaw !== undefined) { dirX = -Math.sin(yaw); dirZ = -Math.cos(yaw); }
      animateChunks(performance.now());
      const doneR = computeCompletedR();
      const lerpK = Math.min(1, (dt || 0.016) * 2.2);
      // ⑧ 渐进细化门控：更细层未铺满时，本层向内接管渲染；铺满后环洞平滑收回
      let covPrev = Math.max(0, doneR * 16 - 24);
      for (let l = 1; l <= maxLevel; l++) {
        if (!lodMats[l]) lodMatFor(l);
        const staticHole = l === 1 ? 1e9 : (256 << (l - 1)) - 12 * (1 << l);
        const tgt = Math.min(staticHole, Math.max(0, covPrev - 6 * (1 << l)));
        holeCur[l] += (tgt - holeCur[l]) * lerpK;
        const om = l === maxLevel ? viewDist : (256 << l);
        const u = lodMats[l].u;
        u.holeMin.value = holeCur[l];
        u.outerMax.value = om;
        u.ply.value.set(px, pz);
        covPrev = ringComplete(l) ? Math.min(256 << l, viewDist) : covPrev;
      }
      // 环内部瓦片用无 discard 材质（early-Z），仅跨边界瓦片启用裁剪；状态缓存避免每帧重挂材质
      tiles.forEach(function (t) {
        const mats = lodMats[t.level];
        if (!mats || t.level > maxLevel) return;
        const T = LOD_C * (1 << t.level);
        const x0 = t.tx * T, z0 = t.tz * T;
        const dmin = tileRectDist(px, pz, x0, z0, x0 + T, z0 + T);
        const dmax = tileRectDistMax(px, pz, x0, z0, x0 + T, z0 + T);
        const hm = holeCur[t.level] || 0;
        const om = t.level === maxLevel ? viewDist : (256 << t.level);
        const bI = 12 << t.level, bO = 24 << t.level;
        const clip = (dmin < hm + bI + 2 || dmax > om - bO - 2) ? 1 : 0;
        if (t.clip === clip) return;
        t.clip = clip;
        for (let i = 0; i < t.meshes.length; i++) {
          const mesh = t.meshes[i];
          mesh.material = mesh.userData.water
            ? (clip ? mats.waterClip : mats.water)
            : (clip ? mats.solidClip : mats.solid);
        }
      });
    },
    getBlock: getBlock,
    setBlock: setBlock,
    stampBlocks: stampBlocks,
    hasChunkAt: hasChunkAt,
    explode: explode,
    findSpawn: function () {
      for (let r = 0; r < 400; r++) {
        for (let a = 0; a < 8; a++) {
          const ang = a / 8 * Math.PI * 2 + r * 0.35;
          const x = Math.round(Math.cos(ang) * r * 24);
          const z = Math.round(Math.sin(ang) * r * 24);
          const c = G.column(x, z);
          if ((c.biome === G.B_PLAINS || c.biome === G.B_FOREST) && c.h > G.SEA + 2 && c.h < 1080)
            return { x: x + 0.5, y: c.h + Y0 + 3, z: z + 0.5 };
        }
      }
      return { x: 0.5, y: 100, z: 0.5 };
    },
    stats: function () {
      let cq = 0, tq = 0;
      for (let i = 0; i < jobs.length; i++) { if (jobs[i].msg.t === 'chunk') cq++; else tq++; }
      return {
        chunks: chunks.size, chunkQueue: pendingChunks.size,
        tiles: tiles.size, tileQueue: pendingTiles.size,
        tileCache: tileCache.size, cacheMB: (cacheBytes / 1048576) | 0,
        maxLevel: maxLevel
      };
    },
    queuesEmpty: function () { return pendingChunks.size === 0 && pendingTiles.size === 0; },
    nearComplete: function (r) { return computeCompletedR() >= Math.min(r, nearRadius); }
  };
})();
