"use strict";
// ============================================================
//  方块星野 BlockWilds - 体素分块管理 + 网格化
//  近景真实体素气泡（可挖掘/建造），随玩家在球面流式加载
// ============================================================
window.G = window.G || {};

(function() {
  var U = G.U;
  var CH = 16, PAD = 1, PCH = CH + PAD * 2;
  var _scene = null;
  var _matOpaque = null, _matTrans = null;
  var _active = null;          // 当前激活星球
  var _chunks = {};            // key -> {data:Uint8Array(16^3), meshO, meshT, built}
  var _genQueue = [];
  var _queued = {};
  var _floraCache = {};
  var _padArr = new Uint8Array(PCH * PCH * PCH);

  function key3(x, y, z) { return x + ',' + y + ',' + z; }

  // ---------------- 材质 ----------------
  function ensureMaterials() {
    if (_matOpaque) return;
    var atlas = new THREE.CanvasTexture(G.Textures.atlasCanvas);
    atlas.magFilter = THREE.NearestFilter;
    atlas.minFilter = THREE.NearestFilter;
    atlas.generateMipmaps = false;
    var emis = new THREE.CanvasTexture(G.Textures.emissiveCanvas);
    emis.magFilter = THREE.NearestFilter;
    emis.minFilter = THREE.NearestFilter;
    emis.generateMipmaps = false;
    _matOpaque = new THREE.MeshLambertMaterial({
      map: atlas, vertexColors: true, alphaTest: 0.5,
      emissive: new THREE.Color(0xffffff), emissiveMap: emis, emissiveIntensity: 1.0
    });
    _matTrans = new THREE.MeshLambertMaterial({
      map: atlas, vertexColors: true, transparent: true, opacity: 1.0,
      depthWrite: false, side: THREE.DoubleSide,
      emissive: new THREE.Color(0xffffff), emissiveMap: emis, emissiveIntensity: 1.0
    });
  }

  // ---------------- 植被（树/草）确定性生成 ----------------
  function floraFor(p, cx, cy, cz) {
    var fk = p.key + ':' + key3(cx, cy, cz);
    if (_floraCache[fk]) return _floraCache[fk];
    var out = [];
    _floraCache[fk] = out;
    if (!p.flora) return out;
    var seed = (U.hash3(cx, cy, cz, 7777) * 4294967296) | 0;
    var rng = U.mulberry(seed ^ (p.key.charCodeAt(0) * 131));
    var attempts = 2;
    for (var a = 0; a < attempts; a++) {
      var px = cx * CH + Math.floor(rng() * CH);
      var py = cy * CH + Math.floor(rng() * CH);
      var pz = cz * CH + Math.floor(rng() * CH);
      var rr = Math.sqrt(px * px + py * py + pz * pz);
      if (rr < p.radius - 30 || rr > p.radius + 42) continue;
      var dir = U.tmpV[7].set(px / rr, py / rr, pz / rr);
      var kind = p.flora(px, py, pz, rng());
      if (!kind) continue;
      var sR = G.Solar.surfaceR(p, dir);
      // 地表必须在本 chunk 附近
      var sx = Math.round(dir.x * sR), sy = Math.round(dir.y * sR), sz = Math.round(dir.z * sR);
      if ((sx >> 4) !== cx && (sy >> 4) !== cy && (sz >> 4) !== cz) continue;
      var groundId = G.Solar.getBlock(p, sx, sy, sz);
      var gdef = G.BLOCKS[groundId];
      if (!gdef) continue;
      var up = dir.clone();
      if (kind.type === 'grass') {
        if (gdef.key !== 'grass') continue;
        out.push([Math.round(sx + up.x), Math.round(sy + up.y), Math.round(sz + up.z), G.BLOCK_BY_KEY.tallgrass.id]);
      } else if (kind.type === 'thorn') {
        if (gdef.key !== 'bramble') continue;
        out.push([Math.round(sx + up.x), Math.round(sy + up.y), Math.round(sz + up.z), G.BLOCK_BY_KEY.bramble_thorn.id]);
      } else if (kind.type === 'tree') {
        if (gdef.key !== 'grass' && gdef.key !== 'dirt') continue;
        var hgt = 4 + Math.floor(rng() * 3);
        var ref = Math.abs(up.y) > 0.9 ? U.tmpV[6].set(1, 0, 0) : U.tmpV[6].set(0, 1, 0);
        var right = new THREE.Vector3().crossVectors(ref, up).normalize();
        var fwd = new THREE.Vector3().crossVectors(up, right).normalize();
        var logId = G.BLOCK_BY_KEY.log.id, leafId = G.BLOCK_BY_KEY.leaves.id;
        for (var i = 1; i <= hgt; i++) {
          out.push([Math.round(sx + up.x * i), Math.round(sy + up.y * i), Math.round(sz + up.z * i), logId]);
        }
        // 树冠（锥形，贴近松树）
        for (var ly = 0; ly <= 3; ly++) {
          var rad = ly === 3 ? 0 : (2 - (ly > 1 ? 1 : 0));
          for (var lx = -rad; lx <= rad; lx++) for (var lz = -rad; lz <= rad; lz++) {
            if (Math.abs(lx) === rad && Math.abs(lz) === rad && rad > 1) continue;
            if (lx === 0 && lz === 0 && ly < 2) continue;
            var v = U.tmpV[5].set(sx, sy, sz)
              .addScaledVector(up, hgt - 1 + ly)
              .addScaledVector(right, lx)
              .addScaledVector(fwd, lz);
            out.push([Math.round(v.x), Math.round(v.y), Math.round(v.z), leafId]);
          }
        }
      }
    }
    return out;
  }

  // ---------------- 生成 chunk 数据（含 padding 的采样） ----------------
  function generateChunk(p, cx, cy, cz) {
    var ox = cx * CH, oy = cy * CH, oz = cz * CH;
    var data = new Uint8Array(CH * CH * CH);
    var solidCount = 0, x, y, z;
    for (y = 0; y < CH; y++) for (z = 0; z < CH; z++) for (x = 0; x < CH; x++) {
      var id = G.Solar.getBlock(p, ox + x, oy + y, oz + z);
      data[(y * CH + z) * CH + x] = id;
      if (id) solidCount++;
    }
    // 植被覆盖（自身+邻居锚点）
    for (var nx = -1; nx <= 1; nx++) for (var ny = -1; ny <= 1; ny++) for (var nz = -1; nz <= 1; nz++) {
      var list = floraFor(p, cx + nx, cy + ny, cz + nz);
      for (var i = 0; i < list.length; i++) {
        var b = list[i];
        var lx = b[0] - ox, ly = b[1] - oy, lz = b[2] - oz;
        if (lx >= 0 && lx < CH && ly >= 0 && ly < CH && lz >= 0 && lz < CH) {
          var di = (ly * CH + lz) * CH + lx;
          if (data[di] === 0) {
            var ek = b[0] + ',' + b[1] + ',' + b[2];
            if (p.edits[ek] === undefined) { data[di] = b[3]; solidCount++; }
          }
        }
      }
    }
    return { data: data, solid: solidCount };
  }

  window.__ChunksInternal = {
    CH: CH, PAD: PAD, PCH: PCH,
    chunks: function() { return _chunks; },
    key3: key3, floraFor: floraFor, generateChunk: generateChunk,
    ensureMaterials: ensureMaterials,
    getMats: function() { return { o: _matOpaque, t: _matTrans }; },
    state: {
      get scene() { return _scene; }, set scene(v) { _scene = v; },
      get active() { return _active; }, set active(v) { _active = v; },
      get genQueue() { return _genQueue; }, set genQueue(v) { _genQueue = v; },
      queued: _queued, floraCache: _floraCache, padArr: _padArr,
      chunksRef: function() { return _chunks; }, resetChunks: function() { _chunks = {}; }
    }
  };
})();

// ============================================================
//  网格化：逐体素面剔除 + 简单AO + 图集UV
// ============================================================
(function() {
  var U = G.U;
  var IN = window.__ChunksInternal;
  var CH = IN.CH;
  var COLS = G.CONF.ATLAS_COLS;
  var ROWS = Math.ceil(G.TILE_NAMES.length / COLS);

  // 六个面：dir, 四角顶点, 面亮度
  // 顶点按 (u,v) 顺序：用于AO和UV
  var FACES = [
    { d: [0, 1, 0], c: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], b: 1.0, tile: 0 },   // top
    { d: [0, -1, 0], c: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], b: 0.68, tile: 2 }, // bottom
    { d: [1, 0, 0], c: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], b: 0.9, tile: 1 },
    { d: [-1, 0, 0], c: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], b: 0.9, tile: 1 },
    { d: [0, 0, 1], c: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], b: 0.82, tile: 1 },
    { d: [0, 0, -1], c: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], b: 0.82, tile: 1 }
  ];
  // 每面四角的UV
  var FUV = [[0,0],[1,0],[1,1],[0,1]];

  function tileUV(tileIdx, u, v) {
    var col = tileIdx % COLS, row = Math.floor(tileIdx / COLS);
    var eps = 0.02;
    var uu = (col + eps + u * (1 - eps * 2)) / COLS;
    var vv = 1 - (row + eps + (1 - v) * (1 - eps * 2)) / ROWS;
    return [uu, vv];
  }

  function tileIndexFor(def, faceSlot) {
    var t = def.tiles;
    var name;
    if (typeof t === 'string') name = t;
    else name = t[faceSlot] || t[1] || t[0];
    return G.Textures.index(name);
  }

  // 获取方块（本地缓存优先）
  function blockAt(p, x, y, z) {
    var ck = (x >> 4) + ',' + (y >> 4) + ',' + (z >> 4);
    var c = IN.chunks()[ck];
    if (c && c.data) {
      return c.data[(((y & 15) * CH) + (z & 15)) * CH + (x & 15)];
    }
    return G.Solar.getBlock(p, x, y, z);
  }

  function isOpaque(id) {
    var d = G.BLOCKS[id];
    return d && d.solid !== false && !d.alpha && d.render !== 'cross' && d.render !== 'slab';
  }
  function isSolidDef(id) {
    var d = G.BLOCKS[id];
    return d && d.solid !== false;
  }

  function meshChunk(p, cx, cy, cz, data) {
    var ox = cx * CH, oy = cy * CH, oz = cz * CH;
    var pos = [], nor = [], uv = [], col = [], idx = [];
    var posT = [], norT = [], uvT = [], colT = [], idxT = [];
    var x, y, z, f, i;

    function nb(lx, ly, lz) {
      if (lx >= 0 && lx < CH && ly >= 0 && ly < CH && lz >= 0 && lz < CH)
        return data[(ly * CH + lz) * CH + lx];
      return blockAt(p, ox + lx, oy + ly, oz + lz);
    }

    function ao(lx, ly, lz, face, corner) {
      // corner: 面上角点 -> 检查两侧+对角
      var d = face.d;
      var c = face.c[corner];
      // 角点在方块坐标的偏移(0或1) -> 采样点
      var px = lx + (c[0] ? 1 : -1), py = ly + (c[1] ? 1 : -1), pz = lz + (c[2] ? 1 : -1);
      var s1, s2, cc;
      if (d[1] !== 0) { // 上下面
        s1 = isOpaque(nb(px, ly + d[1], lz)) ? 1 : 0;
        s2 = isOpaque(nb(lx, ly + d[1], pz)) ? 1 : 0;
        cc = isOpaque(nb(px, ly + d[1], pz)) ? 1 : 0;
      } else if (d[0] !== 0) {
        s1 = isOpaque(nb(lx + d[0], py, lz)) ? 1 : 0;
        s2 = isOpaque(nb(lx + d[0], ly, pz)) ? 1 : 0;
        cc = isOpaque(nb(lx + d[0], py, pz)) ? 1 : 0;
      } else {
        s1 = isOpaque(nb(px, ly, lz + d[2])) ? 1 : 0;
        s2 = isOpaque(nb(lx, py, lz + d[2])) ? 1 : 0;
        cc = isOpaque(nb(px, py, lz + d[2])) ? 1 : 0;
      }
      var v = (s1 && s2) ? 3 : (s1 + s2 + cc);
      return 1 - v * 0.09;
    }

    function quad(P, N, UVv, C, I, verts, normal, uvs, colors) {
      var base = P.length / 3;
      for (i = 0; i < 4; i++) {
        P.push(verts[i][0], verts[i][1], verts[i][2]);
        N.push(normal[0], normal[1], normal[2]);
        UVv.push(uvs[i][0], uvs[i][1]);
        C.push(colors[i][0], colors[i][1], colors[i][2]);
      }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    for (y = 0; y < CH; y++) for (z = 0; z < CH; z++) for (x = 0; x < CH; x++) {
      var id = data[(y * CH + z) * CH + x];
      if (!id) continue;
      var def = G.BLOCKS[id];
      if (!def || !def.render && def.render !== undefined && def.render === null) continue;
      var wx = x, wy = y, wz = z;
      var isCross = def.render === 'cross';
      var isLiquid = def.render === 'liquid';
      var isSlab = def.render === 'slab';
      var trans = !!def.alpha || isLiquid;

      if (isCross) {
        var ti = tileIndexFor(def, 1);
        var em = def.emit || 0;
        var br = 0.95;
        var cA = [[br,br,br],[br,br,br],[br,br,br],[br,br,br]];
        var u00 = tileUV(ti, 0, 0), u10 = tileUV(ti, 1, 0), u11 = tileUV(ti, 1, 1), u01 = tileUV(ti, 0, 1);
        var uvq = [u00, u10, u11, u01];
        var vA = [[wx,wy,wz],[wx+1,wy,wz+1],[wx+1,wy+1,wz+1],[wx,wy+1,wz]];
        var vB = [[wx+1,wy,wz],[wx,wy,wz+1],[wx,wy+1,wz+1],[wx+1,wy+1,wz]];
        quad(pos, nor, uv, col, idx, vA, [0,1,0], uvq, cA);
        quad(pos, nor, uv, col, idx, vA.slice().reverse(), [0,1,0], uvq.slice().reverse(), cA);
        quad(pos, nor, uv, col, idx, vB, [0,1,0], uvq, cA);
        quad(pos, nor, uv, col, idx, vB.slice().reverse(), [0,1,0], uvq.slice().reverse(), cA);
        continue;
      }

      var hTop = isSlab ? (def.slabH || 0.5) : (isLiquid ? 0.87 : 1);

      for (f = 0; f < 6; f++) {
        var face = FACES[f];
        var nid = nb(x + face.d[0], y + face.d[1], z + face.d[2]);
        var ndef = G.BLOCKS[nid];
        var show;
        if (isLiquid) {
          show = !nid || (ndef && ndef.render !== 'liquid' && !isOpaque(nid));
        } else if (trans) {
          show = !nid || (nid !== id && !isOpaque(nid));
        } else {
          show = !isOpaque(nid) ;
          if (show && ndef && ndef.render === 'liquid' ) show = true;
        }
        if (isSlab && f !== 0) {
          show = show || true; // slab侧面始终显示（低矮）
        }
        if (!show) continue;

        var ti2 = tileIndexFor(def, face.tile);
        var verts = [];
        for (i = 0; i < 4; i++) {
          var c = face.c[i];
          verts.push([wx + c[0], wy + (c[1] ? hTop : 0), wz + c[2]]);
        }
        var uvs = [];
        for (i = 0; i < 4; i++) {
          var fuv = FUV[i];
          uvs.push(tileUV(ti2, fuv[0], fuv[1]));
        }
        var colors = [];
        for (i = 0; i < 4; i++) {
          var a = trans || isSlab ? 1 : ao(x, y, z, face, i);
          var b = face.b * a;
          colors.push([b, b, b]);
        }
        if (trans) quad(posT, norT, uvT, colT, idxT, verts, face.d, uvs, colors);
        else quad(pos, nor, uv, col, idx, verts, face.d, uvs, colors);
      }
    }

    function build(P, N, UVv, C, I, mat) {
      if (I.length === 0) return null;
      var g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(UVv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
      g.setIndex(I);
      var m = new THREE.Mesh(g, mat);
      m.position.set(ox, oy, oz);
      m.frustumCulled = true;
      return m;
    }
    var mats = IN.getMats();
    return {
      meshO: build(pos, nor, uv, col, idx, mats.o),
      meshT: build(posT, norT, uvT, colT, idxT, mats.t)
    };
  }

  IN.meshChunk = meshChunk;
  IN.blockAt = blockAt;
  IN.isSolidDef = isSolidDef;
})();

// ============================================================
//  流式加载 / 编辑 / 射线检测 公开API
// ============================================================
(function() {
  var U = G.U;
  var IN = window.__ChunksInternal;
  var CH = IN.CH;
  var st = IN.state;
  var NEAR = G.CONF.NEAR_RADIUS;
  var _lp = new THREE.Vector3();
  var _offsets = null;

  function buildOffsets() {
    if (_offsets) return _offsets;
    var list = [];
    var rc = Math.ceil(NEAR / CH) + 1;
    for (var x = -rc; x <= rc; x++) for (var y = -rc; y <= rc; y++) for (var z = -rc; z <= rc; z++) {
      var d = Math.sqrt(x * x + y * y + z * z) * CH;
      if (d <= NEAR + CH) list.push([x, y, z, d]);
    }
    list.sort(function(a, b) { return a[3] - b[3]; });
    _offsets = list;
    return list;
  }

  function disposeChunk(c) {
    if (c.meshO) { c.meshO.geometry.dispose(); if (c.meshO.parent) c.meshO.parent.remove(c.meshO); }
    if (c.meshT) { c.meshT.geometry.dispose(); if (c.meshT.parent) c.meshT.parent.remove(c.meshT); }
    c.meshO = c.meshT = null;
  }

  function purgeAll() {
    var chunks = IN.chunks();
    for (var k in chunks) disposeChunk(chunks[k]);
    st.resetChunks();
    st.genQueue = [];
    for (var q in st.queued) delete st.queued[q];
  }

  function ensurePlanetGroup(p) {
    if (!p.group) {
      p.group = new THREE.Group();
      st.scene.add(p.group);
    }
    return p.group;
  }

  function processChunk(p, cx, cy, cz) {
    var k = cx + ',' + cy + ',' + cz;
    var chunks = IN.chunks();
    var c = chunks[k];
    if (c && c.built) return;
    // 快速跳过：完全在地形壳之外/之内
    var ccx = (cx + 0.5) * CH, ccy = (cy + 0.5) * CH, ccz = (cz + 0.5) * CH;
    var rc = Math.sqrt(ccx * ccx + ccy * ccy + ccz * ccz);
    var halfDiag = CH * 0.87;
    var hasStruct = !!p.structures[k];
    var hasEdit = false;
    if (!hasStruct) {
      // 粗查：任意编辑落在chunk内（编辑数量少，遍历代价可接受）
      for (var ek in p.edits) {
        var pp = ek.split(',');
        if ((pp[0] >> 4) === cx && (pp[1] >> 4) === cy && (pp[2] >> 4) === cz) { hasEdit = true; break; }
      }
    }
    if (!hasStruct && !hasEdit) {
      if (rc - halfDiag > p.radius + 62) { chunks[k] = { built: true, empty: true }; return; }
      if (!p.blackHole && !p.foggy && rc + halfDiag < p.radius - 92) { chunks[k] = { built: true, empty: true }; return; }
    }
    var gen = IN.generateChunk(p, cx, cy, cz);
    if (gen.solid === 0) { chunks[k] = { built: true, empty: true, data: gen.data }; return; }
    var meshes = IN.meshChunk(p, cx, cy, cz, gen.data);
    var group = ensurePlanetGroup(p);
    if (meshes.meshO) group.add(meshes.meshO);
    if (meshes.meshT) group.add(meshes.meshT);
    chunks[k] = { built: true, data: gen.data, meshO: meshes.meshO, meshT: meshes.meshT };
  }

  function remesh(p, cx, cy, cz) {
    var k = cx + ',' + cy + ',' + cz;
    var chunks = IN.chunks();
    var c = chunks[k];
    if (c) disposeChunk(c);
    delete chunks[k];
    processChunk(p, cx, cy, cz);
  }

  G.Chunks = {
    init: function(scene) {
      st.scene = scene;
      IN.ensureMaterials();
      buildOffsets();
    },

    get active() { return st.active; },

    // 每帧：确定激活星球并流式加载
    update: function(playerWorld, budgetMs) {
      var S = G.Solar;
      var near = S.nearestPlanet(playerWorld);
      var p = near.planet;
      if (st.active && near.surfDist > 300) { purgeAll(); st.active = null; }
      if (!st.active && near.surfDist < 220) { st.active = p; }
      else if (st.active && p !== st.active) {
        var dActive = playerWorld.distanceTo(st.active.pos) - st.active.radius;
        if (dActive > 300) { purgeAll(); st.active = near.surfDist < 220 ? p : null; }
      }
      if (!st.active) return;
      p = st.active;
      S.worldToLocal(p, playerWorld, _lp);
      var pcx = Math.floor(_lp.x / CH), pcy = Math.floor(_lp.y / CH), pcz = Math.floor(_lp.z / CH);
      var offs = buildOffsets();
      var t0 = performance.now();
      var chunks = IN.chunks();
      var built = 0;
      for (var i = 0; i < offs.length; i++) {
        var o = offs[i];
        var cx = pcx + o[0], cy = pcy + o[1], cz = pcz + o[2];
        var k = cx + ',' + cy + ',' + cz;
        if (chunks[k] && chunks[k].built) continue;
        processChunk(p, cx, cy, cz);
        built++;
        if (performance.now() - t0 > (budgetMs || 6)) break;
      }
      // 卸载远处
      if (built === 0) {
        var count = 0;
        for (var k2 in chunks) { count++; }
        if (count > 2400) {
          for (var k3 in chunks) {
            var pp = k3.split(',');
            var dx = (parseInt(pp[0]) - pcx), dy = (parseInt(pp[1]) - pcy), dz = (parseInt(pp[2]) - pcz);
            if (dx * dx + dy * dy + dz * dz > 100) {
              disposeChunk(chunks[k3]);
              delete chunks[k3];
            }
          }
        }
      }
    },

    getBlock: function(p, x, y, z) { return IN.blockAt(p, x, y, z); },

    isSolid: function(p, x, y, z) {
      var id = IN.blockAt(p, x, y, z);
      return IN.isSolidDef(id);
    },

    setBlock: function(p, x, y, z, id) {
      G.Solar.setBlock(p, x, y, z, id);
      var chunks = IN.chunks();
      var cx = x >> 4, cy = y >> 4, cz = z >> 4;
      var k = cx + ',' + cy + ',' + cz;
      var c = chunks[k];
      if (c && c.data) c.data[(((y & 15) * CH) + (z & 15)) * CH + (x & 15)] = id;
      remesh(p, cx, cy, cz);
      // 边界邻居重建
      var lx = x & 15, ly = y & 15, lz = z & 15;
      if (lx === 0) remesh(p, cx - 1, cy, cz);
      if (lx === 15) remesh(p, cx + 1, cy, cz);
      if (ly === 0) remesh(p, cx, cy - 1, cz);
      if (ly === 15) remesh(p, cx, cy + 1, cz);
      if (lz === 0) remesh(p, cx, cy, cz - 1);
      if (lz === 15) remesh(p, cx, cy, cz + 1);
    },

    // DDA 射线（星球本地坐标）
    raycast: function(p, origin, dir, maxDist) {
      var x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
      var stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
      var tdx = Math.abs(1 / (dir.x || 1e-10)), tdy = Math.abs(1 / (dir.y || 1e-10)), tdz = Math.abs(1 / (dir.z || 1e-10));
      var tx = (dir.x > 0 ? (x + 1 - origin.x) : (origin.x - x)) * tdx;
      var ty = (dir.y > 0 ? (y + 1 - origin.y) : (origin.y - y)) * tdy;
      var tz = (dir.z > 0 ? (z + 1 - origin.z) : (origin.z - z)) * tdz;
      var face = [0, 0, 0];
      var t = 0;
      for (var i = 0; i < 256; i++) {
        var id = IN.blockAt(p, x, y, z);
        var def = G.BLOCKS[id];
        if (id && def && def.render !== 'liquid') {
          return { x: x, y: y, z: z, id: id, face: face.slice(), dist: t };
        }
        if (tx < ty && tx < tz) { x += stepX; t = tx; tx += tdx; face = [-stepX, 0, 0]; }
        else if (ty < tz) { y += stepY; t = ty; ty += tdy; face = [0, -stepY, 0]; }
        else { z += stepZ; t = tz; tz += tdz; face = [0, 0, -stepZ]; }
        if (t > maxDist) return null;
      }
      return null;
    },

    purgeAll: purgeAll
  };
})();
