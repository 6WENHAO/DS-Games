/* =====================================================================
 * 紫禁城 体素模型 — 渲染层 (Mesh)
 * ---------------------------------------------------------------------
 * 依赖全局 THREE（vendor 为 r152 UMD 构建）。已针对该版本做三处适配：
 *   ① ColorManagement 默认开启 → new Color(hex) 已是线性值，禁止再
 *      convertSRGBToLinear()，否则二次转换导致整体发暗。
 *   ② r152 的 color_fragment 只在 USE_COLOR 下把 vColor 乘进 diffuse，
 *      仅设 instanceColor 不会生效。故给共享几何体加一条全白 color 属性
 *      并开启 material.vertexColors，逐实例颜色只承载"明暗系数"。
 *   ③ 无 colorspace_fragment 区块，天空着色器自行做 ACES + sRGB 编码。
 *
 * 职责：材质、天空穹顶、体素 InstancedMesh 分桶装配、铺装水面实例、远景地平。
 * ===================================================================== */
(function (G) {
  'use strict';
  var T = G.THREE;
  if (!T) { console.error('THREE 未载入'); return; }

  var LIST = G.GGPalette.LIST, B = G.GGPalette.BLOCK;

  /* ---------------- 带全白顶点色的方块几何体 ---------------- */
  function makeBox(sx, sy, sz) {
    var g = new T.BoxGeometry(sx, sy, sz);
    var n = g.attributes.position.count;
    var c = new Float32Array(n * 3);
    for (var i = 0; i < c.length; i++) c[i] = 1;
    g.setAttribute('color', new T.BufferAttribute(c, 3));
    return g;
  }

  /* ---------------- 材质 ---------------- */
  function createMaterials() {
    return LIST.map(function (s) {
      var col = new T.Color(s.color);            // ColorManagement 已转线性
      if (s.key === 'WATER') {
        return new T.MeshPhongMaterial({
          color: col, vertexColors: true, shininess: 160,
          specular: new T.Color(0x9ec6d2), transparent: true, opacity: 0.85
        });
      }
      if (s.kind === 'phong') {
        var spec = 0x2a2a2a;
        if (s.key === 'FINIAL' || s.key === 'GILT' || s.key === 'BEAST' || s.key === 'RIDGE')
          spec = 0xb99048;
        else if (s.key.indexOf('TILE') === 0) spec = 0x6f5c31;
        return new T.MeshPhongMaterial({
          color: col, vertexColors: true,
          shininess: Math.round((1 - s.rough) * 110) + 10,
          specular: new T.Color(spec)
        });
      }
      return new T.MeshLambertMaterial({ color: col, vertexColors: true });
    });
  }

  /* ---------------- 天空穹顶 ---------------- */
  var SKY_VERT = [
    'varying vec3 vDir;',
    'void main(){',
    '  vDir = position;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);',
    '}'
  ].join('\n');
  var SKY_FRAG = [
    'varying vec3 vDir;',
    'uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot;',
    'uniform vec3 uSunDir; uniform vec3 uSunCol;',
    'uniform float uHaze; uniform float uExposure; uniform float uPost;',
    'vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }',
    'vec3 lin2srgb(vec3 c){',
    '  c = max(c, vec3(0.0));',
    '  return mix(c*12.92, 1.055*pow(c, vec3(0.41666))-0.055, step(vec3(0.0031308), c));',
    '}',
    'void main(){',
    '  vec3 d = normalize(vDir);',
    '  float h = clamp(d.y, -1.0, 1.0);',
    '  vec3 c = h > 0.0 ? mix(uMid, uTop, pow(h, 0.55)) : mix(uMid, uBot, pow(-h, 0.45));',
    '  float s = max(0.0, dot(d, normalize(uSunDir)));',
    '  c += uSunCol * pow(s, 1400.0) * 14.0;',           // 日轮
    '  c += uSunCol * pow(s, 10.0) * 0.34 * uHaze;',     // 日周辉光
    '  c += uSunCol * pow(s, 2.5) * 0.07 * uHaze;',      // 大气前向散射
    '  // uPost=1 时把线性 HDR 原样交给后期链，色调映射与编码统一在合成阶段做',
    '  if (uPost > 0.5) { gl_FragColor = vec4(c, 1.0); }',
    '  else { gl_FragColor = vec4(lin2srgb(aces(c * uExposure)), 1.0); }',
    '}'
  ].join('\n');

  function createSky() {
    var uni = {
      uTop: { value: new T.Color(0x2f6ec4) },
      uMid: { value: new T.Color(0xbcd6ea) },
      uBot: { value: new T.Color(0x8f8a7c) },
      uSunDir: { value: new T.Vector3(0.4, 0.6, 0.7) },
      uSunCol: { value: new T.Color(0xfff3d6) },
      uHaze: { value: 1.0 },
      uExposure: { value: 1.06 },
      uPost: { value: 0.0 }
    };
    var mat = new T.ShaderMaterial({
      uniforms: uni, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      side: T.BackSide, depthWrite: false, depthTest: false, fog: false
    });
    var mesh = new T.Mesh(new T.SphereGeometry(3600, 44, 26), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1000;
    return { mesh: mesh, uniforms: uni };
  }

  /* ---------------- 逐实例明暗（AO + 抖动） ---------------- */
  function hash01(x, y, z) {
    var h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  /**
   * 分帧装配体素实例网格。
   * opts: { bucket 区块边长, aoStrength AO 强度, jitter 明暗抖动, gap 方块缝隙 }
   */
  function voxelMeshIterator(compiled, materials, opts) {
    opts = opts || {};
    var bucket = opts.bucket || 128;
    var aoK = opts.aoStrength === undefined ? 0.52 : opts.aoStrength;
    var jit = opts.jitter === undefined ? 0.05 : opts.jitter;
    var gap = opts.gap === undefined ? 0.012 : opts.gap;
    var geo = makeBox(1 - gap, 1 - gap, 1 - gap);
    var groups = G.VoxelWorld.groupBuckets(compiled, bucket);
    var xs = compiled.xs, ys = compiled.ys, zs = compiled.zs, ao = compiled.ao;
    var meshes = [], gi = 0, tris = 0;

    return {
      total: groups.length,
      get done() { return gi >= groups.length; },
      progress: function () { return groups.length ? gi / groups.length : 1; },
      step: function (budget) {
        var n = 0;
        while (gi < groups.length && n < (budget || 24)) {
          var g = groups[gi++], idx = g.idx, cnt = idx.length;
          var m = new T.InstancedMesh(geo, materials[g.id], cnt);
          m.castShadow = true; m.receiveShadow = true;
          m.matrixAutoUpdate = false;
          var arr = m.instanceMatrix.array;
          var col = new Float32Array(cnt * 3);
          var bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9, bz0 = 1e9, bz1 = -1e9;
          for (var i = 0; i < cnt; i++) {
            var k = idx[i], o = i * 16;
            var px = xs[k], py = ys[k], pz = zs[k];
            if (px < bx0) bx0 = px; if (px > bx1) bx1 = px;
            if (py < by0) by0 = py; if (py > by1) by1 = py;
            if (pz < bz0) bz0 = pz; if (pz > bz1) bz1 = pz;
            arr[o] = 1; arr[o + 5] = 1; arr[o + 10] = 1; arr[o + 15] = 1;
            arr[o + 12] = px + 0.5; arr[o + 13] = py + 0.5; arr[o + 14] = pz + 0.5;
            // AO：26 邻域占据度经软化曲线 → 缝隙、檐下、墙角自然变暗
            var shade = 1.0 - aoK * Math.pow(ao[k] / 26, 1.5);
            var j = (hash01(px, py, pz) - 0.5) * 2.0 * jit;
            shade *= 1.0 + j;
            var c3 = i * 3;
            col[c3] = shade * (1 + j * 0.35);          // 微量冷暖偏移，避免死板
            col[c3 + 1] = shade;
            col[c3 + 2] = shade * (1 - j * 0.35);
          }
          m.instanceColor = new T.InstancedBufferAttribute(col, 3);
          m.instanceMatrix.needsUpdate = true;
          m.frustumCulled = true;
          // 直接给出包围球：省掉 three 懒计算时逐实例分解矩阵造成的首帧卡顿
          var cxb = (bx0 + bx1) / 2 + 0.5, cyb = (by0 + by1) / 2 + 0.5, czb = (bz0 + bz1) / 2 + 0.5;
          var rr = 0.5 * Math.sqrt((bx1 - bx0) * (bx1 - bx0) + (by1 - by0) * (by1 - by0) +
                                   (bz1 - bz0) * (bz1 - bz0)) + 1.2;
          m.boundingSphere = new T.Sphere(new T.Vector3(cxb, cyb, czb), rr);
          m.userData.blockName = LIST[g.id].name;
          m.userData.bbox = [bx0, by0, bz0, bx1, by1, bz1];
          meshes.push(m);
          tris += cnt * 12;
          n++;
        }
        return meshes;
      },
      result: function () { return { meshes: meshes, triangles: tris, groups: groups.length }; }
    };
  }

  /* ---------------- 铺装 / 水面（4 m 大石板，留 12 cm 灰缝） ---------------- */
  function buildTileMeshes(tiles, materials, opts) {
    opts = opts || {};
    var p = tiles.pitch, gapT = opts.gap === undefined ? 0.14 : opts.gap;
    var geo = makeBox(p - gapT, 0.8, p - gapT);
    var byMat = new Map();
    var i;
    for (i = 0; i < tiles.count; i++) {
      var id = tiles.ids[i];
      var a = byMat.get(id); if (!a) { a = []; byMat.set(id, a); }
      a.push(i);
    }
    var out = [], tris = 0;
    byMat.forEach(function (idxs, id) {
      var cnt = idxs.length;
      var m = new T.InstancedMesh(geo, materials[id], cnt);
      m.receiveShadow = true;
      m.castShadow = (id !== B.WATER);
      m.matrixAutoUpdate = false;
      var arr = m.instanceMatrix.array;
      var col = new Float32Array(cnt * 3);
      for (var j = 0; j < cnt; j++) {
        var k = idxs[j], o = j * 16;
        arr[o] = 1; arr[o + 5] = 1; arr[o + 10] = 1; arr[o + 15] = 1;
        arr[o + 12] = tiles.xs[k]; arr[o + 13] = tiles.ys[k] - 0.4; arr[o + 14] = tiles.zs[k];
        var sh = 1.0 + (hash01(tiles.xs[k] | 0, 7, tiles.zs[k] | 0) - 0.5) * 0.13;
        var c3 = j * 3;
        col[c3] = sh; col[c3 + 1] = sh; col[c3 + 2] = sh;
      }
      m.instanceColor = new T.InstancedBufferAttribute(col, 3);
      m.instanceMatrix.needsUpdate = true;
      m.frustumCulled = false;              // 铺装铺满全城，剔除无益
      m.userData.blockName = LIST[id].name;
      out.push(m);
      tris += cnt * 12;
    });
    return { meshes: out, triangles: tris };
  }

  /* ---------------- 远景地平（兜住铺装以外的视野） ---------------- */
  function buildFarGround() {
    var g = new T.PlaneGeometry(9000, 9000, 1, 1);
    var m = new T.MeshLambertMaterial({ color: new T.Color(0x585646) });
    var mesh = new T.Mesh(g, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.3;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    return mesh;
  }

  G.MeshKit = {
    createMaterials: createMaterials,
    createSky: createSky,
    voxelMeshIterator: voxelMeshIterator,
    buildTileMeshes: buildTileMeshes,
    buildFarGround: buildFarGround,
    makeBox: makeBox
  };
})(typeof window !== 'undefined' ? window : globalThis);
