"use strict";
// ============================================================
//  方块星野 BlockWilds - 远景LOD星球 / 恒星 / 星空 / 大气
//  站在星球上能看到其他星球实时运转（无缝宇宙的远景层）
// ============================================================
window.G = window.G || {};

(function() {
  var U = G.U;
  var _scene = null;
  var _buildQueue = [];
  var _built = 0, _total = 0;
  var _tileAvg = {};
  var _sun = null, _sunGlow = null, _corona = null;
  var _stars = null;
  var _sandPillar = null;
  var _bhDisk = null;
  var _tornadoes = [];

  // ---------- 瓦片平均色 ----------
  function avgColor(name) {
    if (_tileAvg[name]) return _tileAvg[name];
    var cv = G.Textures.tileCanvas(name);
    if (!cv) return _tileAvg[name] = [0.5, 0.5, 0.5];
    var d = cv.getContext('2d').getImageData(0, 0, 16, 16).data;
    var r = 0, g = 0, b = 0, n = 0;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 100) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    n = n || 1;
    return _tileAvg[name] = [r / n / 255, g / n / 255, b / n / 255];
  }

  function blockColor(id) {
    var def = G.BLOCKS[id];
    if (!def || !def.tiles) return [0.4, 0.4, 0.4];
    var t = def.tiles;
    var name = typeof t === 'string' ? t : t[0];
    return avgColor(name);
  }

  // ---------- 远景方块球（立方体-球投影网格，半径量化出台阶感） ----------
  var CUBE_FACES = [
    { u: [1, 0, 0], v: [0, 1, 0], w: [0, 0, 1] },
    { u: [-1, 0, 0], v: [0, 1, 0], w: [0, 0, -1] },
    { u: [0, 0, 1], v: [1, 0, 0], w: [0, 1, 0] },
    { u: [0, 0, -1], v: [1, 0, 0], w: [0, -1, 0] },
    { u: [0, 1, 0], v: [0, 0, 1], w: [1, 0, 0] },
    { u: [0, -1, 0], v: [0, 0, 1], w: [-1, 0, 0] }
  ];

  function buildFarMesh(p) {
    var RES = p.small ? 24 : 44;
    var pos = [], col = [], idx = [];
    var dir = new THREE.Vector3();
    var f, i, j;
    for (f = 0; f < 6; f++) {
      var F = CUBE_FACES[f];
      var base = pos.length / 3;
      for (j = 0; j <= RES; j++) {
        for (i = 0; i <= RES; i++) {
          var a = (i / RES) * 2 - 1, b = (j / RES) * 2 - 1;
          dir.set(
            F.u[0] * a + F.v[0] * b + F.w[0],
            F.u[1] * a + F.v[1] * b + F.w[1],
            F.u[2] * a + F.v[2] * b + F.w[2]
          ).normalize();
          var sr = p.farR ? p.farR(dir) : G.Solar.surfaceR(p, dir);
          var q = Math.round(sr) - 1.2; // 略缩，让近景体素盖住
          // 颜色：取地表方块
          var sx = Math.round(dir.x * sr), sy = Math.round(dir.y * sr), sz = Math.round(dir.z * sr);
          var rr = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
          var id = p.sample(sx, sy, sz, rr, U.tmpV[4].set(sx / rr, sy / rr, sz / rr));
          if (!id) q = p.radius - (p.blackHole ? 56 : (p.foggy ? 22 : 4)); // 破洞处下陷
          pos.push(dir.x * q, dir.y * q, dir.z * q);
          var c;
          if (!id) c = p.blackHole ? [0.02, 0.02, 0.04] : [0.1, 0.1, 0.12];
          else c = blockColor(id);
          // 高度微调明暗，增强台阶层次
          var shade = 0.86 + ((Math.round(sr) % 3) * 0.07);
          col.push(c[0] * shade, c[1] * shade, c[2] * shade);
        }
      }
      for (j = 0; j < RES; j++) {
        for (i = 0; i < RES; i++) {
          var v0 = base + j * (RES + 1) + i;
          var v1 = v0 + 1, v2 = v0 + RES + 1, v3 = v2 + 1;
          idx.push(v0, v2, v1, v1, v2, v3);
        }
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    var mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4
    });
    var mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = true;
    return mesh;
  }

  // ---------- 大气壳 ----------
  function buildAtmo(p) {
    if (!p.atmosphere) return null;
    var geo = new THREE.SphereGeometry(p.radius + p.atmosphere.h, 32, 24);
    var mat = new THREE.MeshBasicMaterial({
      color: p.atmosphere.color,
      transparent: true,
      opacity: p.atmosphere.fogDense ? 0.42 : 0.16,
      side: THREE.BackSide,
      depthWrite: false
    });
    var m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2;
    return m;
  }

  window.__FarInternal = {
    buildFarMesh: buildFarMesh, buildAtmo: buildAtmo, blockColor: blockColor,
    get scene() { return _scene; }, set scene(v) { _scene = v; },
    refs: {
      get sun() { return _sun; }, set sun(v) { _sun = v; },
      get sunGlow() { return _sunGlow; }, set sunGlow(v) { _sunGlow = v; },
      get corona() { return _corona; }, set corona(v) { _corona = v; },
      get stars() { return _stars; }, set stars(v) { _stars = v; },
      get sandPillar() { return _sandPillar; }, set sandPillar(v) { _sandPillar = v; },
      get bhDisk() { return _bhDisk; }, set bhDisk(v) { _bhDisk = v; },
      tornadoes: _tornadoes
    },
    queue: _buildQueue,
    prog: function() { return { built: _built, total: _total }; },
    incBuilt: function() { _built++; },
    setTotal: function(n) { _total = n; }
  };
})();

// ============================================================
//  恒星 / 星空 / 特效体 / 构建调度 / 公开API
// ============================================================
(function() {
  var U = G.U;
  var IN = window.__FarInternal;

  function makeSun(scene) {
    var S = G.Solar.SUN;
    var geo = new THREE.SphereGeometry(S.radius, 48, 32);
    var mat = new THREE.MeshBasicMaterial({ color: 0xffd268 });
    var sun = new THREE.Mesh(geo, mat);
    sun.position.copy(S.pos);
    scene.add(sun);
    IN.refs.sun = sun;

    // 辉光精灵（程序化径向渐变）
    var cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    var x = cv.getContext('2d');
    var gr = x.createRadialGradient(64, 64, 8, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,230,160,0.9)');
    gr.addColorStop(0.35, 'rgba(255,190,90,0.35)');
    gr.addColorStop(1, 'rgba(255,150,40,0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    var tex = new THREE.CanvasTexture(cv);
    var sm = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    var glow = new THREE.Sprite(sm);
    glow.scale.set(S.radius * 6, S.radius * 6, 1);
    glow.position.copy(S.pos);
    scene.add(glow);
    IN.refs.sunGlow = glow;

    // 太阳点光源（照亮全系）
    var light = new THREE.PointLight(0xfff0d8, 2.1, 0, 1.45);
    light.position.copy(S.pos);
    scene.add(light);
    S.light = light;
  }

  function makeStars(scene) {
    var n = 2600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    var rng = U.mulberry(20260717);
    for (var i = 0; i < n; i++) {
      var t = rng() * Math.PI * 2, ph = Math.acos(rng() * 2 - 1);
      var r = 42000;
      pos[i * 3] = Math.sin(ph) * Math.cos(t) * r;
      pos[i * 3 + 1] = Math.cos(ph) * r;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(t) * r;
      var b = 0.4 + rng() * 0.6;
      var warm = rng();
      col[i * 3] = b; col[i * 3 + 1] = b * (0.85 + warm * 0.15); col[i * 3 + 2] = b * (warm > 0.8 ? 0.75 : 1);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var m = new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, depthWrite: false, transparent: true, opacity: 0.95 });
    var stars = new THREE.Points(g, m);
    stars.frustumCulled = false;
    scene.add(stars);
    IN.refs.stars = stars;
  }

  // 灰烬双星之间的沙柱
  function makeSandPillar(scene) {
    var geo = new THREE.CylinderGeometry(5, 9, 1, 8, 6, true);
    var mat = new THREE.MeshBasicMaterial({ color: 0xd8b070, transparent: true, opacity: 0.55, depthWrite: false });
    var m = new THREE.Mesh(geo, mat);
    scene.add(m);
    IN.refs.sandPillar = m;
  }

  // 黑洞吸积盘（像素粒子环）
  function makeBHDisk(planet) {
    var n = 700, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    var rng = U.mulberry(998);
    for (var i = 0; i < n; i++) {
      var a = rng() * Math.PI * 2;
      var r = 66 + rng() * 46;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (rng() - 0.5) * 6;
      pos[i * 3 + 2] = Math.sin(a) * r;
      var heat = 1 - (r - 66) / 46;
      col[i * 3] = 0.6 + heat * 0.4; col[i * 3 + 1] = 0.4 + heat * 0.35; col[i * 3 + 2] = 0.9;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var m = new THREE.PointsMaterial({ size: 2.4, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
    var pts = new THREE.Points(g, m);
    // 黑洞本体
    var hole = new THREE.Mesh(
      new THREE.SphereGeometry(planet.blackHole * 0.8, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    planet.group.add(hole);
    planet.group.add(pts);
    IN.refs.bhDisk = pts;
  }

  // 深巨星龙卷风柱
  function makeTornadoes(planet) {
    var rng = U.mulberry(31415);
    for (var i = 0; i < 4; i++) {
      var geo = new THREE.CylinderGeometry(6, 16, 90, 8, 4, true);
      var mat = new THREE.MeshBasicMaterial({ color: 0xbfe8de, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
      var m = new THREE.Mesh(geo, mat);
      var dir = new THREE.Vector3(rng() * 2 - 1, (rng() - 0.5) * 1.2, rng() * 2 - 1).normalize();
      m.userData.dir = dir;
      m.userData.spin = 1.5 + rng();
      planet.group.add(m);
      IN.refs.tornadoes.push({ mesh: m, planet: planet });
    }
  }

  G.FarLOD = {
    init: function(scene) {
      IN.scene = scene;
      makeSun(scene);
      makeStars(scene);
      makeSandPillar(scene);
      var P = G.Solar.PLANETS;
      IN.setTotal(P.length);
      for (var i = 0; i < P.length; i++) IN.queue.push(P[i]);
    },

    // 每帧调用：分帧构建远景网格
    buildStep: function() {
      if (IN.queue.length === 0) return true;
      var p = IN.queue.shift();
      if (!p.group) { p.group = new THREE.Group(); IN.scene.add(p.group); }
      p.farMesh = IN.buildFarMesh(p);
      p.group.add(p.farMesh);
      var atmo = IN.buildAtmo(p);
      if (atmo) { p.atmoMesh = atmo; p.group.add(atmo); }
      if (p.seaLevel) {
        var sea = new THREE.Mesh(
          new THREE.SphereGeometry(p.seaLevel - 0.35, 48, 32),
          new THREE.MeshLambertMaterial({ color: 0x2a6a8a, transparent: true, opacity: 0.82, depthWrite: true })
        );
        p.seaMesh = sea;
        p.group.add(sea);
        makeTornadoes(p);
      }
      if (p.blackHole) makeBHDisk(p);
      IN.incBuilt();
      return IN.queue.length === 0;
    },

    progress: function() { var pr = IN.prog(); return pr.total ? pr.built / pr.total : 0; },

    // 每帧更新：星球组姿态 / 特效体
    update: function(t, dt) {
      var P = G.Solar.PLANETS, S = G.Solar.SUN;
      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        if (p.group) {
          p.group.position.copy(p.pos);
          p.group.quaternion.copy(p.quat);
        }
      }
      var r = IN.refs;
      if (r.sun) {
        r.sun.position.copy(S.pos);
        r.sun.scale.setScalar(S.radiusNow / S.radius);
        if (r.sunGlow) {
          r.sunGlow.position.copy(S.pos);
          var gs = S.radiusNow * 6;
          r.sunGlow.scale.set(gs, gs, 1);
        }
      }
      // 双星沙柱
      var e = G.Solar.byKey.ember, a2 = G.Solar.byKey.ashen;
      if (r.sandPillar && e && a2) {
        var mid = U.tmpV[3].copy(e.pos).add(a2.pos).multiplyScalar(0.5);
        r.sandPillar.position.copy(mid);
        var d = U.tmpV[2].copy(e.pos).sub(a2.pos);
        var len = d.length() - e.radius - a2.radius + 120;
        r.sandPillar.scale.set(1, Math.max(1, len), 1);
        r.sandPillar.quaternion.setFromUnitVectors(U.tmpV[1].set(0, 1, 0), d.normalize());
        r.sandPillar.rotation.y += dt * 2;
      }
      if (r.bhDisk) r.bhDisk.rotation.y += dt * 0.4;
      for (var j = 0; j < r.tornadoes.length; j++) {
        var td = r.tornadoes[j];
        var pl = td.planet;
        var ang = t * 0.08 * td.mesh.userData.spin + j * 2.1;
        var dir2 = td.mesh.userData.dir;
        var rot = U.tmpV[0].copy(dir2).applyAxisAngle(U.tmpV[1].set(0, 1, 0), ang).normalize();
        td.mesh.position.copy(rot).multiplyScalar(pl.seaLevel + 30);
        td.mesh.quaternion.setFromUnitVectors(U.tmpV[1].set(0, 1, 0), rot);
        td.mesh.rotation.y += dt * td.mesh.userData.spin * 3;
      }
    }
  };
})();
