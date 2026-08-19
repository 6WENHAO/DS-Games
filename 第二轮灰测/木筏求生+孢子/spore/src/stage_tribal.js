/* ==========================================================================
 * 孢子 Spore · 部落阶段（Tribal）模块
 * 结构：基础工具 → 材质库 → 地形 → 资源 → 实体工厂 → 建筑 → 工具 →
 *       敌部落 → 选择/命令 → 表演小游戏 → AI → 昼夜/特效 → 相机输入 →
 *       UI → 更新循环 → 存档 → 进出阶段
 * 宿主假设：SP.U/SP.Tex/SP.Audio/SP.Genome/game.ui/game.input 均存在；
 *   SP.Tex 返回 RepeatWrapping 纹理；mouse.x/y 为 -1..1 NDC、dx/dy 为帧位移；
 *   keys 为 {KeyW:true,...} 实时表；Genome.build 返回底部在原点附近的 Group；
 *   game.advance('civ', payload) 进入文明阶段。
 * ========================================================================== */
SP.StageTribal = function (game) {
  'use strict'; var S = this; var TAU = SP.U.TAU, clamp = SP.U.clamp, lerp = SP.U.lerp, damp = SP.U.damp, smooth = SP.U.smooth, rand = SP.U.rand, randi = SP.U.randi,
      choice = SP.U.choice, chance = SP.U.chance, Rng = SP.U.Rng;
  function V3(x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); } var tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3();

  /* ============ 基础工具 ============ */
  function sfx(n, g) { try { SP.Audio.play(n, g === undefined ? 1 : g); } catch (e) { } }
  function ctex(w, h, draw) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new THREE.CanvasTexture(c); t.userData.mine = true;
    return t;
  }
  function dtex(t) { if (t && t.userData.mine) { t.dispose(); t.userData.mine = false; } } var floats = [];
  function floatText(pos, text, color, big) {
    var t = ctex(128, 48, function (x, w, h) {
      x.font = 'bold ' + (big ? 34 : 26) + 'px "Microsoft YaHei",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 5; x.strokeStyle = 'rgba(0,0,0,0.9)'; x.strokeText(text, w / 2, h / 2); x.fillStyle = color || '#fff'; x.fillText(text, w / 2, h / 2);
    }); var m = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }); var sp = new THREE.Sprite(m); sp.position.copy(pos); sp.position.y += 2.6; sp.scale.set(4, 1.5, 1); root.add(sp); floats.push({ sp: sp, mat: m, tex: t, life: 1.3, vy: 2.2 });
  }
  function txtSprite(text, size, color) {
    var t = ctex(256, 64, function (x, w, h) {
      x.font = 'bold ' + size + 'px "Microsoft YaHei",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,0.85)'; x.strokeText(text, w / 2, h / 2); x.fillStyle = color || '#fff'; x.fillText(text, w / 2, h / 2);
    }); var m = new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }); var sp = new THREE.Sprite(m); sp.scale.set(8, 2, 1);
    return { sprite: sp, tex: t, mat: m };
  } var parts = [];
  function burst(pos, color, n, up, size) {
    for (var i = 0; i < n; i++) {
      var m = new THREE.Mesh(geo('box', 1, 1, 1), new THREE.MeshBasicMaterial({ color: color })); disposables.mat.push(m.material); m.scale.setScalar(rand(0.25, size || 0.8)); m.position.copy(pos); m.position.y += rand(0.2, 1.2); var a = rand(0, TAU); m.userData.vel = V3(Math.cos(a) * rand(1.5, 6), rand(up || 2, 6), Math.sin(a) * rand(1.5, 6)); m.userData.rot = V3(rand(0, 10), rand(0, 10), rand(0, 10)); m.userData.life = rand(0.6, 1.4); root.add(m); parts.push(m);
    }
  }
  // 单行网格/灯光放置助手
  function P(parent, k, a, b, c, d, mk, x, y, z) {
    var m = new THREE.Mesh(geo(k, a, b, c, d), mat(mk)); m.position.set(x, y, z); parent.add(m);
    return m;
  }
  function L(parent, color, i, dist, dec, x, y, z) {
    var l = new THREE.PointLight(color, i, dist, dec); l.position.set(x, y, z); parent.add(l);
    return l;
  }

  /* ============ 几何与材质库 ============ */
  var geoCache = {}, disposables = { geo: [], mat: [], tex: [] };
  function geo(key, a, b, c, d) {
    if (!geoCache[key]) {
      var g; if (key === 'box') g = new THREE.BoxGeometry(a, b, c);
      else if (key === 'cyl') g = new THREE.CylinderGeometry(a, b, c, d || 8);
      else if (key === 'cone') g = new THREE.ConeGeometry(a, b, c || 8);
      else if (key === 'sph') g = new THREE.SphereGeometry(a, b || 10, c || 8);
      else if (key === 'tor') g = new THREE.TorusGeometry(a, b, 6, 14);
      else if (key === 'ring') g = new THREE.TorusGeometry((a + b) / 2, (b - a) / 2, 4, 24);
      else g = new THREE.DodecahedronGeometry(a, 0);
      disposables.geo.push(g); geoCache[key] = g;
    }
    return geoCache[key];
  } var mats = {}, ringMats = {};
  function mat(key, opts) {
    if (!mats[key]) {
      mats[key] = new THREE.MeshStandardMaterial(opts || {}); disposables.mat.push(mats[key]);
    }
    return mats[key];
  }
  function rmat(color) {
    if (!ringMats[color]) {
      ringMats[color] = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }); disposables.mat.push(ringMats[color]);
    }
    return ringMats[color];
  }
  function totemTex(color) {
    return ctex(128, 128, function (x, w, h) {
      x.fillStyle = '#5a3a22'; x.fillRect(0, 0, w, h); x.strokeStyle = color; x.lineWidth = 10; x.strokeRect(8, 8, w - 16, h - 16); x.lineWidth = 6; x.beginPath(); x.moveTo(64, 20); x.lineTo(30, 108); x.lineTo(98, 108); x.closePath(); x.stroke(); x.fillStyle = color; x.beginPath(); x.arc(64, 52, 16, 0, TAU); x.fill(); x.fillStyle = '#241a10'; x.beginPath(); x.arc(58, 48, 4, 0, TAU); x.arc(70, 48, 4, 0, TAU); x.fill(); x.beginPath(); x.moveTo(52, 66); x.lineTo(76, 66); x.lineTo(64, 80); x.closePath(); x.fill();
    });
  }
  function noiseTex(base, cols, n, s) {
    return ctex(128, 128, function (x, w, h) {
      x.fillStyle = base; x.fillRect(0, 0, w, h); for (var i = 0; i < n; i++) {
        x.fillStyle = choice(cols); x.globalAlpha = rand(0.4, 1); x.fillRect(rand(0, w), rand(0, h), rand(s, s + 4), rand(s, s + 4));
      } x.globalAlpha = 1;
    });
  }
  function initMats() {
    var leaf = noiseTex('#3c7a2a', ['#2e6320', '#4a9434', '#5fae45', '#274f1c'], 900, 2); var leaf2 = noiseTex('#2f6b3a', ['#25552c', '#3d8a48', '#57ab5e'], 700, 2); var roof = noiseTex('#8a5a2a', ['#7a4e24', '#9a6a34', '#6a4420'], 500, 4); var flame = ctex(64, 64, function (x, w, h) {
      var g = x.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.4, 'rgba(255,160,40,0.9)'); g.addColorStop(1, 'rgba(255,80,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    }); var M = mat; M('ground', { vertexColors: true, roughness: 1 }); M('water', { map: SP.Tex.water(4, 4), transparent: true, opacity: 0.85, roughness: 0.15, metalness: 0.1, color: 0x3f8fd0 }); M('wood', { map: SP.Tex.wood(1, 2), roughness: 0.9 }); M('bark', { map: SP.Tex.bark(1, 3), roughness: 1 }); M('rock', { map: SP.Tex.rock(1, 1), roughness: 1 }); M('leaf', { map: leaf, roughness: 1 }); M('leaf2', { map: leaf2, roughness: 1 }); M('fruit', { color: 0xff8c2e, roughness: 0.4 }); M('berry', { color: 0xe33b3b, roughness: 0.5 }); M('egg', { color: 0xf5f2e4, roughness: 0.4 }); M('hutWall', { map: SP.Tex.wood(2, 3), roughness: 0.95 }); M('hutRoof', { map: roof, roughness: 1 }); M('rune', { color: 0x2fae6a, emissive: 0x2fae6a, emissiveIntensity: 1.6 }); M('dark', { color: 0x241a10, roughness: 0.9 });
    M('red', { color: 0xd33a3a }); M('blue', { color: 0x3a6ad3 }); M('totemP', { map: totemTex('#3ddc68') }); var c = ['#e05b4a', '#4a9be0', '#e0c23a', '#6a9b3a', '#b06ae0']; for (var i = 0; i < 5; i++) M('totem' + i, { map: totemTex(c[i]) });
    mats.flame = new THREE.MeshBasicMaterial({ map: flame, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }); disposables.mat.push(mats.flame); disposables.tex.push(leaf, leaf2, roof, flame);
  }

  /* ============ 地形 ============ */
  var MAP = 240, SEG = 90, WATER_Y = 1.1; var noise = SP.U.makeNoise2D(20240813); var groundMesh = null, waterMesh = null;
  function terrainH(x, z) {
    var r = Math.sqrt(x * x + z * z) / (MAP * 0.5); var n = SP.U.fbm(noise, x * 0.016, z * 0.016, 4, 2.0, 0.5);
    return (5.5 + n * 4.2) * smooth(clamp((1 - r) / 0.4, 0, 1)) - 1.6 * Math.exp(-(x * x + z * z) / (52 * 52));
  }
  function buildTerrain() {
    var g = new THREE.PlaneGeometry(MAP, MAP, SEG, SEG); g.rotateX(-Math.PI / 2); var pos = g.attributes.position; var col = new Float32Array(pos.count * 3); var cS = new THREE.Color(0.86, 0.78, 0.60), cG = new THREE.Color(0.34, 0.52, 0.26), cR = new THREE.Color(0.52, 0.50, 0.46); var cA = new THREE.Color(), cB = new THREE.Color(); for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i), h = terrainH(x, z); pos.setY(i, h); cA.copy(cS).lerp(cG, smooth(clamp((h - 1.2) / 1.6, 0, 1))); cB.copy(cA).lerp(cR, smooth(clamp((h - 6.5) / 2.5, 0, 1))); var j = SP.U.fbm(noise, x * 0.5 + 99, z * 0.5 + 99, 2, 2, 0.5) * 0.06; cB.offsetHSL(0, j, j * 0.6); col[i * 3] = cB.r; col[i * 3 + 1] = cB.g; col[i * 3 + 2] = cB.b;
    } g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); disposables.geo.push(g); groundMesh = new THREE.Mesh(g, mat('ground')); root.add(groundMesh); var wg = new THREE.PlaneGeometry(MAP * 1.9, MAP * 1.9, 1, 1); wg.rotateX(-Math.PI / 2); disposables.geo.push(wg); waterMesh = new THREE.Mesh(wg, mat('water')); waterMesh.position.y = WATER_Y; root.add(waterMesh);
  }
  function deco(rng, kind, n) {            // 装饰树/灌木/岩石
    for (var i = 0; i < n; i++) {
      var a = rng.range(0, TAU), r = rng.range(kind === 'rock' ? 8 : 20, MAP * 0.42); var x = Math.cos(a) * r, z = Math.sin(a) * r, h = terrainH(x, z); if (h < WATER_Y + (kind === 'rock' ? 0.3 : 0.8) || h > 8) continue;
      var g = new THREE.Group(), s = rng.range(0.8, 1.6), j; if (kind === 'tree') {
        P(g, 'cyl', 0.22, 0.3, 2.2 * s, 6, 'bark', 0, 1.1 * s, 0); P(g, 'cone', 1.3 * s, 2.6 * s, 7, 0, 'leaf', 0, 2.8 * s, 0); P(g, 'cone', 0.95 * s, 2.0 * s, 7, 0, 'leaf', 0, 3.9 * s, 0);
      } else if (kind === 'bush') {
        for (j = 0; j < 3; j++) P(g, 'sph', 0.55 * s, 7, 6, 0, 'leaf2', rand(-0.4, 0.4) * s, (0.45 + rand(-0.1, 0.15)) * s, rand(-0.4, 0.4) * s);
      } else {
        var m = P(g, 'dod', s, 0, 0, 0, 'rock', 0, s * 0.25, 0); m.rotation.set(rng.range(0, TAU), rng.range(0, TAU), rng.range(0, TAU)); m.scale.y = rng.range(0.5, 1.1);
      } g.position.set(x, h, z); g.rotation.y = rng.range(0, TAU); root.add(g);
    }
  }

  /* ============ 资源 ============ */
  var rayMeshes = []; var members = [], enemies = [], animals = [], pickups = [], totems = [], resources = [], buildings = [], slots = []; var st = null, root = null, perf = null, hovered = null, selDrag = null; var camState = { yaw: 0.6, pitch: 0.95, dist: 72, target: V3(0, 0, 0) };
  function regM(group, ent) {
    group.traverse(function (o) { if (o.isMesh) { o.userData.ent = ent; rayMeshes.push(o); } });
  }
  function unregM(group, ent) {
    for (var i = rayMeshes.length - 1; i >= 0; i--) if (rayMeshes[i].userData.ent === ent) rayMeshes.splice(i, 1);
  }
  function addRes(type, pos) {
    var r = { type: type, pos: pos.clone(), count: 0, max: 0, timer: 0, alive: true, group: null }; var g = new THREE.Group(), i; if (type === 'fruit' || type === 'berry' || type === 'tree') {
      r.count = r.max = type === 'berry' ? 4 : 3; P(g, 'cyl', 0.25, 0.34, 2.4, 6, 'bark', 0, 1.2, 0); if (type === 'berry') {
        for (i = 0; i < 3; i++) P(g, 'sph', 0.5, 7, 6, 0, 'leaf2', rand(-0.35, 0.35), 0.4, rand(-0.35, 0.35));
        r.berryMeshes = []; for (i = 0; i < r.max; i++) {
          var bm = P(g, 'sph', 0.13, 5, 4, 0, 'berry', rand(-0.5, 0.5), 0.55, rand(-0.5, 0.5)); r.berryMeshes.push(bm);
        }
      } else {
        P(g, 'sph', type === 'tree' ? 1.1 : 1.6, 9, 7, 0, type === 'tree' ? 'leaf' : 'leaf2', 0, type === 'tree' ? 4.2 : 3.3, 0); if (type === 'tree') {
          P(g, 'cyl', 0.3, 0.42, 3.2, 7, 'bark', 0, 1.6, 0); P(g, 'cone', 1.05, 2.4, 7, 0, 'leaf', 0, 5.6, 0);
        } else {
          r.fruitMeshes = []; for (i = 0; i < r.max; i++) {
            var fm = P(g, 'sph', 0.22, 6, 5, 0, 'fruit', rand(-1.1, 1.1), 3.2, rand(-1.1, 1.1)); r.fruitMeshes.push(fm);
          }
        }
      }
    } else if (type === 'fish') {
      r.active = true; r.timer = rand(20, 50); r.fishMeshes = []; for (i = 0; i < 3; i++) {
        var fish = new THREE.Group(); var body = P(fish, 'cone', 0.22, 0.7, 5, 0, 'blue', 0, 0, -0.25); body.rotation.x = -Math.PI / 2; var tail = P(fish, 'cone', 0.16, 0.35, 4, 0, 'blue', 0, 0, 0.25); tail.rotation.z = -Math.PI / 2; fish.position.set(rand(-1.6, 1.6), 0, rand(-1.6, 1.6)); g.add(fish); r.fishMeshes.push(fish);
      }
    } g.position.copy(pos); root.add(g); r.group = g; resources.push(r); regM(g, { kind: 'resource', ref: r });
    return r;
  }
  function rmRes(res) {
    res.alive = false; if (res.group) {
      unregM(res.group, { kind: 'resource', ref: res }); root.remove(res.group);
    } var i = resources.indexOf(res); if (i >= 0) resources.splice(i, 1);
  }
  function placeResources() {
    var rg = new Rng(77), spots = []; for (var i = 0; i < 30; i++) {
      var a = rg.range(0, TAU), r = rg.range(14, 60); var x = Math.cos(a) * r, z = Math.sin(a) * r, h = terrainH(x, z); if (h < WATER_Y + 0.8 || h > 7) continue;
      spots.push(V3(x, h, z));
    } var nF = 0, nB = 0, nT = 0; for (var s = 0; s < spots.length && (nF < 6 || nB < 7 || nT < 5); s++) {
      var p = spots[s]; if (nF < 6 && rg.chance(0.3)) { addRes('fruit', p); nF++; }
      else if (nB < 7 && rg.chance(0.35)) { addRes('berry', p); nB++; } else if (nT < 5) { addRes('tree', p); nT++; }
    } for (var f = 0; f < 9; f++) {
      var fa = rg.range(0, TAU); for (var tr = 0; tr < 24; tr++) {
        var fr = MAP * 0.42 + rg.range(0, MAP * 0.14); var fx = Math.cos(fa) * fr, fz = Math.sin(fa) * fr, fh = terrainH(fx, fz); if (fh > WATER_Y - 0.3 && fh < WATER_Y + 0.6) { addRes('fish', V3(fx, fh, fz)); break; }
      }
    }
  }

  /* ============ 实体工厂 ============ */
  function mkBar(color) {
    var tex = ctex(64, 10, function (x, w, h) {
      x.fillStyle = 'rgba(0,0,0,0.7)'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,0.6)'; x.strokeRect(0.5, 0.5, w - 1, h - 1);
    }); var fillTex = ctex(60, 6, function (x, w, h) { x.fillStyle = color; x.fillRect(0, 0, w, h); }); var g = new THREE.Group(); g.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))); var fill = new THREE.Sprite(new THREE.SpriteMaterial({ map: fillTex, transparent: true, depthTest: false })); g.add(fill); var bar = { group: g, fill: fill, fillTex: fillTex, last: -1 }; bar.set = function (hp, max) {
      var pct = clamp(hp / max, 0, 1), key = Math.round(pct * 20); if (key === bar.last) return;
      bar.last = key; fill.scale.x = 2.25 * pct; var c = fillTex.image, x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.fillStyle = pct > 0.5 ? '#5ee26f' : (pct > 0.25 ? '#ffd166' : '#ff5d5d'); x.fillRect(0, 0, c.width * pct, c.height); fillTex.needsUpdate = true;
    };
    return bar;
  }
  function mkEnt(genome, o) {
    var model = SP.Genome.build(genome, { scale: o.scale || 1, simple: !!o.simple }); if (o.tint) { try { SP.Genome.tint(model, o.tint); } catch (e) { } }
    var box = new THREE.Box3().setFromObject(model); var hgt = Math.max(0.3, (box.max.y - box.min.y) || 1), off = -box.min.y; var g = new THREE.Group(); g.add(model); var ring = new THREE.Mesh(geo('ring', 0.8, 1.05), rmat('#ffffff')); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.visible = false; g.add(ring); var ent = { kind: o.kind, model: model, group: g, ring: ring,
      pos: V3(), hp: o.hp, maxHp: o.hp, speed: o.speed, height: hgt, groundOff: off,
      team: o.team, alive: true, moveAmt: 0, action: null, facing: 0,
      task: null, atkCd: 0, timer: 0, animT: rand(0, 10), name: o.name || '',
      tool: null, home: V3(), baby: false, age: 0, grain: rand(0, TAU),
      hpBar: mkBar(o.barColor || '#5ee26f')
    }; ent.hpBar.group.position.y = hgt + 0.7; g.add(ent.hpBar.group); ent.hpBar.group.visible = false; root.add(g); regM(g, ent);
    return ent;
  }
  function setPos(e, x, z) {
    var h = terrainH(x, z); e.pos.set(x, h + e.groundOff, z); e.group.position.copy(e.pos);
  }
  function rmEnt(e) {
    unregM(e.group, e); if (e.model) e.model.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
    root.remove(e.group); e.alive = false;
  }
  function spawnMember(name, baby, pos) {
    var e = mkEnt(game.genome, { kind: 'member', team: 'player', hp: 60, speed: 5.4, name: name }); e.baby = !!baby; e.isChief = members.length === 0; if (e.isChief) {
      var crown = P(e.group, 'cone', 0.32, 0.7, 6, 0, 'red', 0, e.height + 0.55, 0); e.crown = crown;
    } setPos(e, pos ? pos.x : rand(-3, 3), pos ? pos.z : rand(-3, 3)); if (e.baby) e.group.scale.setScalar(0.5);
    members.push(e);
    return e;
  }
  function spawnEnemy(tribe) {
    var e = mkEnt(tribe.genome, { kind: 'enemy', team: 'enemy', hp: 45, speed: 4.7, name: tribe.name, barColor: tribe.css, tint: tribe.tint }); setPos(e, tribe.pos.x + rand(-5, 5), tribe.pos.z + rand(-5, 5)); e.home.copy(tribe.pos); e.tribe = tribe; P(e.group, 'cyl', 0.06, 0.09, 1.5, 5, 'wood', 0.5, e.height * 0.6, 0.35); enemies.push(e);
    return e;
  }
  function spawnAnimal(t) {
    var e = mkEnt(SP.Genome.random('creature'), {
      kind: 'animal', team: 'animal', hp: t.hp, speed: t.speed, scale: t.scale,
      simple: true, name: t.name, barColor: '#ffb054', tint: t.tint
    }); var a = rand(0, TAU), r = rand(30, MAP * 0.42); setPos(e, Math.cos(a) * r, Math.sin(a) * r); e.home.copy(e.pos); e.typeId = t.id; e.meat = t.meat; e.aggroNight = t.aggro; e.tamed = false; animals.push(e);
    return e;
  }
  function makeTotem(pos, tribe, isPlayer) {
    var g = new THREE.Group(); var mk = isPlayer ? 'totemP' : 'totem' + tribe.index, i; P(g, 'cyl', 0.9, 1.1, 0.7, 8, 'stone', 0, 0.35, 0); for (i = 0; i < 3; i++) P(g, 'cyl', 0.75 - i * 0.15, 0.9 - i * 0.12, 1.2, 8, mk, 0, 1.3 + i * 1.2, 0);
    P(g, 'sph', 0.62, 10, 8, 0, mk, 0, 5.1, 0); var ring = new THREE.Mesh(geo('ring', 1.5, 1.8), rmat(isPlayer ? '#3ddc68' : '#ff5d5d')); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.visible = false; g.add(ring); var h = terrainH(pos.x, pos.z); g.position.set(pos.x, h, pos.z); root.add(g); var totem = { isPlayer: isPlayer, tribe: tribe, group: g, ring: ring,
      pos: V3(pos.x, h, pos.z), hp: isPlayer ? 99999 : 150, maxHp: isPlayer ? 99999 : 150, alive: true
    }; if (!isPlayer) {
      totem.hpBar = mkBar('#ff5d5d'); totem.hpBar.group.position.y = 5.4; g.add(totem.hpBar.group); var label = txtSprite(tribe.name, 34, tribe.css); label.sprite.position.y = 6.6; g.add(label.sprite); disposables.tex.push(label.tex); disposables.mat.push(label.mat);
    } totems.push(totem); regM(g, { kind: 'totem', ref: totem });
    return totem;
  }
  function makeCarcass(animal) {
    unregM(animal.group, animal); animal.group.rotation.x = Math.PI / 2; animal.group.position.y -= animal.groundOff * 0.6; var c = { type: 'carcass', group: animal.group, pos: animal.pos.clone(), meat: animal.meat, alive: true }; regM(animal.group, { kind: 'resource', ref: c }); resources.push(c); animal.respawnT = rand(45, 70);
    return c;
  }
  function spawnEgg(pen) {
    var g = new THREE.Group(); P(g, 'sph', 0.32, 8, 6, 0, 'egg', 0, 0.3, 0); var x = pen.pos.x + rand(-2.5, 2.5), z = pen.pos.z + rand(-2.5, 2.5); g.position.set(x, terrainH(x, z), z); root.add(g); var e = { type: 'egg', group: g, pos: g.position.clone(), alive: true, timer: 25 }; regM(g, { kind: 'resource', ref: e }); pickups.push(e);
    return e;
  }

  /* ============ 建筑 ============ */
  var BDEF = {
    hut: { name: '棚屋', cost: 40, desc: '成员上限 +3，食物上限 +20' },
    fire: { name: '篝火', cost: 25, desc: '附近成员缓慢回血，夜间照明' },
    rackh: { name: '鱼叉架', cost: 30, desc: '免费给一名成员装备鱼叉' },
    racki: { name: '乐器架', cost: 35, desc: '免费给一名成员装备随机乐器' },
    stone: { name: '治疗石', cost: 30, desc: '大范围快速回血' },
    pen: { name: '围栏', cost: 45, desc: '把野生动物赶进去驯养产蛋' }
  };
  function initSlots() {
    for (var i = 0; i < 8; i++) {
      var a = i * TAU / 8 + TAU / 16; var slot = { idx: i, pos: V3(Math.cos(a) * 14, 0, Math.sin(a) * 14), taken: false, type: null, bld: null }; var g = new THREE.Group(); var ring = new THREE.Mesh(geo('ring', 1.5, 1.9), rmat('#ffffff')); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring); P(g, 'cyl', 0.08, 0.12, 1.2, 5, 'wood', 0, 0.6, 0); g.position.set(slot.pos.x, terrainH(slot.pos.x, slot.pos.z), slot.pos.z); root.add(g); slot.ghost = g; regM(g, { kind: 'slot', ref: slot }); slots.push(slot);
    }
  }
  function buildBuilding(type, slot) {
    var def = BDEF[type]; if (st.food < def.cost) { game.ui.toast('食物不足！需要 ' + def.cost, 'bad'); sfx('deny'); return; }
    st.food -= def.cost; var pos = V3(slot.pos.x, terrainH(slot.pos.x, slot.pos.z), slot.pos.z); var g = new THREE.Group(), bld = { type: type, pos: pos, group: g, slot: slot, data: {} }, i; if (type === 'hut') {
      P(g, 'cyl', 2.1, 2.3, 2.4, 10, 'hutWall', 0, 1.2, 0); P(g, 'cone', 2.7, 1.8, 10, 0, 'hutRoof', 0, 3.3, 0); P(g, 'box', 1.0, 1.5, 0.1, 0, 'dark', 0, 0.75, 2.16);
    } else if (type === 'fire') {
      for (i = 0; i < 4; i++) {
        var log = P(g, 'cyl', 0.14, 0.16, 1.6, 6, 'bark', 0, 0.22, 0); log.rotation.z = Math.PI / 2; log.rotation.y = i * (Math.PI / 2) + 0.6;
      } P(g, 'tor', 1.1, 0.22, 8, 0, 'stone', 0, 0.12, 0); bld.data.flame = P(g, 'cone', 0.5, 1.5, 8, 0, 'flame', 0, 0.9, 0); bld.data.light = L(g, 0xff9a3c, 1, 26, 1.6, 0, 2.2, 0);
    } else if (type === 'rackh' || type === 'racki') {
      P(g, 'cyl', 0.12, 0.16, 2.0, 6, 'wood', -1.1, 1.0, 0); P(g, 'cyl', 0.12, 0.16, 2.0, 6, 'wood', 1.1, 1.0, 0); P(g, 'cyl', 0.1, 0.1, 2.6, 6, 'wood', 0, 1.95, 0); for (i = 0; i < 3; i++) {
        var sp = P(g, 'cyl', 0.05, 0.06, 2.2, 5, 'wood', -0.7 + i * 0.7, 1.0, 0.3); sp.rotation.x = -0.5; if (type === 'racki') {
          var inst = i === 0 ? P(g, 'sph', 0.18, 6, 5, 0, 'red', -0.7, 1.0, 0.4) :
            (i === 1 ? P(g, 'cone', 0.24, 0.5, 6, 0, 'blue', 0, 1.0, 0.4) :
              P(g, 'cyl', 0.1, 0.16, 1.4, 5, 'wood', 0.7, 1.0, 0.4)); if (i === 1) inst.rotation.x = Math.PI / 2;
        }
      }
    } else if (type === 'stone') {
      P(g, 'dod', 1.3, 0, 0, 0, 'stone', 0, 1.0, 0); P(g, 'box', 0.7, 0.7, 0.06, 0, 'rune', 0, 1.3, 0); bld.data.light = L(g, 0x3ae88a, 1, 16, 1.6, 0, 2.4, 0);
    } else if (type === 'pen') {
      bld.data.radius = 5; for (i = 0; i < 8; i++) {
        var pa = (i / 8) * TAU; P(g, 'cyl', 0.14, 0.18, 1.5, 6, 'wood', Math.cos(pa) * 5, 0.75, Math.sin(pa) * 5); if (i < 7) {
          var rail = P(g, 'cyl', 0.06, 0.06, 2.1, 5, 'wood', Math.cos(pa + TAU / 16) * 4.4, 1.2, Math.sin(pa + TAU / 16) * 4.4); rail.lookAt(V3(Math.cos(pa + TAU / 8) * 5, 1.2, Math.sin(pa + TAU / 8) * 5));
        }
      }
    } g.position.copy(pos); root.add(g); slot.taken = true; slot.type = type; slot.bld = bld; if (slot.ghost) { root.remove(slot.ghost); slot.ghost = null; }
    buildings.push(bld); regM(g, { kind: 'building', ref: bld }); sfx('build'); game.ui.toast('建造完成：' + def.name, 'good'); applyBld(); refreshUI(true);
    return bld;
  }
  function applyBld() {
    var huts = 0, pens = 0; for (var i = 0; i < buildings.length; i++) {
      if (buildings[i].type === 'hut') huts++;
      if (buildings[i].type === 'pen') pens++;
    } st.hutCount = huts; st.penCount = pens; st.foodCap = Math.min(200, 60 + huts * 20); st.memberCap = Math.min(12, 6 + huts * 3);
  }
  function baseFire() {
    var pos = V3(5, terrainH(5, 5), 5); var g = new THREE.Group(), i; for (i = 0; i < 4; i++) {
      var log = P(g, 'cyl', 0.14, 0.16, 1.6, 6, 'bark', 0, 0.22, 0); log.rotation.z = Math.PI / 2; log.rotation.y = i * (Math.PI / 2) + 0.6;
    } P(g, 'tor', 1.1, 0.22, 8, 0, 'stone', 0, 0.12, 0); var fl = P(g, 'cone', 0.5, 1.5, 8, 0, 'flame', 0, 0.9, 0); var li = L(g, 0xff9a3c, 1, 26, 1.6, 0, 2.2, 0); g.position.copy(pos); root.add(g); st.baseFire = { light: li, flame: fl, pos: pos };
  }

  /* ============ 工具 ============ */
  var TDEF = {
    axe: { name: '石斧', cost: 20, icon: '🪓', desc: '伐木 +4伤害' },
    spear: { name: '长矛', cost: 25, icon: '🔱', desc: '远程投掷 +7伤害' },
    harpoon: { name: '鱼叉', cost: 20, icon: '🎣', desc: '捕鱼 +3伤害' },
    torch: { name: '火把', cost: 15, icon: '🔥', desc: '驱赶动物，夜间照明' },
    basket: { name: '采集篮', cost: 15, icon: '🧺', desc: '采集速度翻倍' },
    maracas: { name: '沙锤', cost: 18, icon: '🎵', desc: '表演乐器' },
    horn: { name: '号角', cost: 20, icon: '📯', desc: '表演乐器' },
    didgeridoo: { name: '迪吉里杜管', cost: 22, icon: '🪈', desc: '表演乐器' }
  }; var INST = ['maracas', 'horn', 'didgeridoo']; var toolGeo = {};
  function toolMesh(t) {
    if (!toolGeo[t]) {
      var g = new THREE.Group(), i; if (t === 'axe') {
        P(g, 'cyl', 0.05, 0.06, 1.1, 5, 'wood', 0, -0.1, 0); var hd = P(g, 'box', 0.34, 0.26, 0.12, 0, 'stone', 0.12, 0.5, 0); hd.rotation.z = -0.5;
      } else if (t === 'spear') {
        P(g, 'cyl', 0.04, 0.05, 2.0, 5, 'wood', 0, 0, 0); P(g, 'cone', 0.09, 0.35, 5, 0, 'stone', 0, 1.15, 0);
      } else if (t === 'harpoon') {
        P(g, 'cyl', 0.04, 0.05, 1.9, 5, 'wood', 0, 0, 0); for (i = 0; i < 3; i++) P(g, 'cone', 0.05, 0.3, 4, 0, 'stone', -0.1 + i * 0.1, 1.1, 0);
      } else if (t === 'torch') {
        P(g, 'cyl', 0.05, 0.07, 1.2, 5, 'torch', 0, -0.1, 0); P(g, 'sph', 0.16, 6, 5, 0, 'flame', 0, 0.72, 0);
      } else if (t === 'basket') {
        P(g, 'sph', 0.34, 8, 6, 0, 'leaf', 0, 0.1, 0); P(g, 'tor', 0.3, 0.05, 8, 0, 'wood', 0, 0.42, 0);
      } else if (t === 'maracas') {
        for (i = 0; i < 2; i++) {
          P(g, 'cyl', 0.04, 0.04, 0.5, 5, 'wood', -0.12 + i * 0.24, 0, 0); P(g, 'sph', 0.14, 6, 5, 0, i ? 'blue' : 'red', -0.12 + i * 0.24, 0.4, 0);
        }
      } else if (t === 'horn') {
        P(g, 'cone', 0.05, 0.12, 0.8, 6, 'blue', 0, 0.1, 0); P(g, 'cone', 0.16, 0.08, 0.3, 6, 'blue', 0, 0.62, 0);
      } else if (t === 'didgeridoo') {
        P(g, 'cyl', 0.045, 0.09, 1.6, 6, 'wood', 0, 0, 0); P(g, 'cyl', 0.09, 0.12, 0.2, 6, 'red', 0, 0.85, 0);
      } toolGeo[t] = g;
    }
    return toolGeo[t];
  }
  function equipTool(m, t) {
    m.tool = t; var tm = toolMesh(t).clone(); tm.position.set(0.55, m.height * 0.62, 0.4); tm.rotation.set(0.3, 0.6, -0.25); m.group.add(tm); m.toolMesh = tm; sfx('craft'); if (t === 'torch') {
      var tl = new THREE.PointLight(0xff9a3c, 0.8, 9, 1.6); tl.position.y = 1.2; m.group.add(tl); m.torchLight = tl;
    }
  }
  function buyTool(t) {
    var def = TDEF[t]; if (st.food < def.cost) { game.ui.toast('食物不足！需要 ' + def.cost, 'bad'); sfx('deny'); return; }
    var target = null, i; for (i = 0; i < st.selected.length; i++) if (!st.selected[i].tool && !st.selected[i].baby) { target = st.selected[i]; break; }
    if (!target) for (i = 0; i < members.length; i++) if (!members[i].tool && !members[i].baby) { target = members[i]; break; } if (!target) { game.ui.toast('所有成年成员都已携带工具', 'warn'); return; }
    st.food -= def.cost; equipTool(target, t); game.ui.toast(target.name + ' 获得 ' + def.name, 'good'); refreshUI(true);
  }
  function dps(m) {
    return 3 + (m.tool === 'axe' ? 4 : 0) + (m.tool === 'spear' ? 7 : 0) + (m.tool === 'harpoon' ? 3 : 0) + (m.tool === 'torch' ? 1 : 0);
  }
  function isInst(t) { return t && INST.indexOf(t) >= 0; }

  /* ============ 敌部落 ============ */
  var TRIBE_NAMES = ['赤羽部落', '蓝鳍部落', '金鬃部落', '绿鳞部落', '紫角部落']; var TRIBE_CSS = ['#e05b4a', '#4a9be0', '#e0c23a', '#6a9b3a', '#b06ae0']; var TRIBE_TINT = [[0.01, 0.75, 0.5], [0.58, 0.7, 0.5], [0.12, 0.8, 0.5], [0.34, 0.6, 0.42], [0.78, 0.65, 0.5]];
  function initTribes() {
    var rg = new Rng(4242), list = []; for (var i = 0; i < 5; i++) {
      var a = i * TAU / 5 + rg.range(-0.15, 0.15), r = rg.range(88, 102); var x = Math.cos(a) * r, z = Math.sin(a) * r, h = terrainH(x, z), g2 = 0; while ((h < WATER_Y + 1.2 || h > 8.5) && g2 < 30) {
        a += rg.range(-0.2, 0.2); r = rg.range(70, 108); x = Math.cos(a) * r; z = Math.sin(a) * r; h = terrainH(x, z); g2++;
      } list.push({
        index: i, name: TRIBE_NAMES[i], css: TRIBE_CSS[i], tint: TRIBE_TINT[i],
        pos: V3(x, h, z), rel: randi(-10, 10), allied: false, conquered: false,
        raidT: rand(60, 110), genome: SP.Genome.random('creature'), memberCount: 3
      });
    }
    return list;
  }
  function spawnTribe(tribe) {
    tribe.totem = makeTotem(tribe.pos, tribe, false); for (var i = 0; i < tribe.memberCount; i++) spawnEnemy(tribe);
  }
  function relLevel(t) {
    if (t.conquered) return '征服';
    if (t.allied) return '结盟';
    if (t.rel >= 60) return '友好';
    if (t.rel > -40) return '中立';
    return '敌对';
  }
  function resolvedCount() {
    var n = 0; for (var i = 0; i < st.tribes.length; i++) if (st.tribes[i].allied || st.tribes[i].conquered) n++;
    return n;
  }

  /* ============ 选择与命令 ============ */
  var raycaster = new THREE.Raycaster();
  function pick(px, py) {
    raycaster.setFromCamera(V3(px, py, 0), game.camera); var hits = raycaster.intersectObjects(rayMeshes, false); for (var i = 0; i < hits.length; i++) if (hits[i].object.userData.ent) return hits[i].object.userData.ent;
    return null;
  }
  function pickGround(px, py) {
    raycaster.setFromCamera(V3(px, py, 0), game.camera); var hit = raycaster.intersectObject(groundMesh, false);
    return hit.length ? hit[0].point : null;
  }
  function selectMember(m, add) {
    if (!add) clearSelection();
    if (m && m.alive && !m.baby && st.selected.indexOf(m) < 0) {
      m.ring.material = rmat('#3ddc68'); m.ring.visible = true; st.selected.push(m);
    } sfx('ui_click');
  }
  function clearSelection() {
    for (var i = 0; i < st.selected.length; i++) st.selected[i].ring.visible = false;
    st.selected = [];
  }
  function boxSelect(x0, y0, x1, y1) {
    clearSelection(); var ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1); for (var i = 0; i < members.length; i++) {
      var m = members[i]; if (!m.alive || m.baby) continue;
      var v = tA.copy(m.pos).project(game.camera); if (v.x >= ax && v.x <= bx && v.y >= ay && v.y <= by) {
        m.ring.material = rmat('#3ddc68'); m.ring.visible = true; st.selected.push(m);
      }
    } if (st.selected.length) sfx('ui_click');
  }
  function markGround(pos) {
    for (var i = 0; i < 2; i++) {
      var m = new THREE.Mesh(geo('ring', 0.4, 0.7), rmat('#7ee8ff')); m.rotation.x = -Math.PI / 2; m.position.set(pos.x, terrainH(pos.x, pos.z) + 0.08, pos.z); m.userData.t = 0; m.userData.delay = i * 0.18; root.add(m); st.marks.push(m);
    }
  }
  function updateMarks(dt) {
    for (var i = st.marks.length - 1; i >= 0; i--) {
      var m = st.marks[i]; m.userData.t += dt; var t = Math.max(0, m.userData.t - m.userData.delay); m.scale.setScalar(1 + t * 4); m.material.opacity = 0.9 * (1 - t / 0.8); if (t > 0.8) { root.remove(m); st.marks.splice(i, 1); }
    }
  }
  function cmdMove(list, pos) {
    for (var i = 0; i < list.length; i++) { list[i].task = { kind: 'move', pos: pos.clone() }; list[i].action = null; } markGround(pos);
  }
  function cmdGather(list, res) {
    for (var i = 0; i < list.length; i++) list[i].task = { kind: 'gather', res: res };
    markGround(res.pos);
  }
  function cmdAttack(list, target) {
    for (var i = 0; i < list.length; i++) list[i].task = { kind: 'attack', target: target };
  }
  function cmdFish(list, res) {
    var ok = false; for (var i = 0; i < list.length; i++) if (list[i].tool === 'harpoon') { list[i].task = { kind: 'fish', res: res }; ok = true; }
    return ok;
  }
  function onRightClick(px, py) {
    if (perf) return;
    var hit = pick(px, py); if (!hit) {
      var gpt = pickGround(px, py); if (!gpt) return;
      if (!st.selected.length) { game.ui.toast('请先点选你的成员', 'warn'); return; } cmdMove(st.selected, gpt);
      return;
    } var sel = st.selected.filter(function (m) { return m !== hit; }); if (hit.kind === 'member') { selectMember(hit, true); return; }
    if (!sel.length) { game.ui.toast('请先点选你的成员', 'warn'); return; } if (hit.kind === 'animal') {
      if (sel.some(function (m) { return m.tool === 'torch'; })) {
        for (var i = 0; i < sel.length; i++) if (sel[i].tool === 'torch') sel[i].task = { kind: 'drive', target: hit };
        game.ui.toast('驱赶 ' + hit.name + ' 前往围栏', '');
      } else {
        cmdAttack(sel, hit);
      }
    } else if (hit.kind === 'enemy') {
      if (hit.tribe.allied) { game.ui.toast('不要攻击盟友！', 'warn'); sfx('deny'); return; } cmdAttack(sel, hit); changeRel(hit.tribe, -2);
    } else if (hit.kind === 'resource') {
      var res = hit.ref; if (res.type === 'fruit' || res.type === 'berry' || res.type === 'carcass') cmdGather(sel, res);
      else if (res.type === 'tree') {
        if (!sel.some(function (m) { return m.tool === 'axe'; })) game.ui.toast('伐木需要石斧', 'warn');
        cmdGather(sel, res);
      } else if (res.type === 'fish') {
        if (!cmdFish(sel, res)) game.ui.toast('捕鱼需要鱼叉', 'warn');
      }
    } else if (hit.kind === 'building') {
      var b = hit.ref; if (b.type === 'rackh' && st.selected[0]) { equipTool(st.selected[0], 'harpoon'); game.ui.toast(st.selected[0].name + ' 取得鱼叉', 'good'); }
      else if (b.type === 'racki' && st.selected[0]) { equipTool(st.selected[0], choice(INST)); game.ui.toast(st.selected[0].name + ' 取得乐器', 'good'); } else game.ui.toast(BDEF[b.type].name + '：' + BDEF[b.type].desc, '');
    } else if (hit.kind === 'totem') {
      var t = hit.ref; if (t.isPlayer) openCenterMenu();
      else if (!t.tribe.conquered) openTribeMenu(t.tribe);
    } else if (hit.kind === 'slot') {
      openBuildMenu(hit.ref);
    }
  }
  function onLeftClick(px, py) {
    var hit = pick(px, py); if (!hit) { clearSelection(); return; }
    if (hit.kind === 'member') selectMember(hit, false);
    else if (hit.kind === 'totem') { if (!hit.ref.isPlayer && !hit.ref.tribe.conquered) openTribeMenu(hit.ref.tribe); } else if (hit.kind === 'slot') openBuildMenu(hit.ref);
    else if (hit.kind === 'building') game.ui.toast(BDEF[hit.ref.type].name + '：' + BDEF[hit.ref.type].desc, '');
    else clearSelection();
  }
  function changeRel(tribe, d) {
    if (tribe.conquered) return;
    if (tribe.allied && d < 0) {
      tribe.allied = false; tribe.rel = clamp(tribe.rel + d - 20, -100, 100); game.ui.toast('背弃盟约！与 ' + tribe.name + ' 关系破裂', 'bad'); sfx('social_fail'); refreshUI(true);
      return;
    } tribe.rel = clamp(tribe.rel + d, -100, 100);
  }
  function dlg(title, body, buttons) {
    game.ui.dialog({ title: title, body: body, buttons: buttons });
  }
  function defMenu(title, body, defs, onPick, closeLabel, closeFn) {
    var buttons = [], keys = Object.keys(defs); for (var i = 0; i < keys.length; i++) {
      (function (k) {
        buttons.push({
          label: defs[k].icon ? defs[k].icon + ' ' + defs[k].name + '（' + defs[k].cost + ' 食物）' : defs[k].name + '（' + defs[k].cost + ' 食物）',
          cb: function () {
            if (st.food < defs[k].cost) { game.ui.toast('食物不足', 'bad'); sfx('deny'); return; } game.ui.closeDialog(); onPick(k);
          }
        });
      })(keys[i]);
    } buttons.push({ label: closeLabel || '关闭', cb: function () { game.ui.closeDialog(); if (closeFn) closeFn(); } }); dlg(title, body, buttons);
  }
  function openBuildMenu(slot) {
    if (slot.taken) return;
    defMenu('建造 —— 建筑槽位', '选择一个建筑：', BDEF, function (k) { buildBuilding(k, slot); });
  }
  function openTribeMenu(tribe) {
    if (tribe.allied) { dlg(tribe.name, '关系：结盟 ✓', [{ label: '关闭', cb: function () { game.ui.closeDialog(); } }]); return; } dlg(tribe.name,
      '关系：' + relLevel(tribe) + '（' + tribe.rel + '）<br>图腾生命：' + Math.max(0, Math.round(tribe.totem.hp)) + '/' + tribe.totem.maxHp,
      [
        { label: '🎵 结盟表演', cb: function () { game.ui.closeDialog(); orderPerform(st.selected, tribe); } }, { label: '🍖 赠送食物（20）', cb: function () { game.ui.closeDialog(); giftFood(tribe); } },
        { label: '⚔️ 攻击图腾', cb: function () {
          game.ui.closeDialog(); if (!st.selected.length) { game.ui.toast('请先点选你的成员', 'warn'); return; }
          cmdAttack(st.selected, tribe.totem); changeRel(tribe, -8);
        } },
        { label: '取消', cb: function () { game.ui.closeDialog(); } }
      ]);
  }
  function openCenterMenu() {
    dlg('部落中心',
      '🍖 食物：' + Math.floor(st.food) + ' / ' + st.foodCap +
      '<br>👥 成员：' + members.length + ' / ' + st.memberCap +
      '<br>🏡 棚屋：' + st.hutCount + ' · ⛺ 围栏：' + st.penCount +
      '<br>🤝 已解决部落：' + resolvedCount() + ' / 5',
      [
        { label: '👶 繁殖（25 食物）', cb: function () {
          game.ui.closeDialog(); if (st.food < 25) { game.ui.toast('需要 25 食物', 'bad'); sfx('deny'); return; }
          if (members.length >= st.memberCap) { game.ui.toast('人口已满，先建造棚屋', 'warn'); sfx('deny'); return; } st.food -= 25; spawnMember('小兽 ' + (members.length + 1), true); sfx('dna'); game.ui.toast('新成员诞生，45 秒后长大成年', 'good'); refreshUI(true);
        } },
        { label: '🛠 购买工具', cb: function () { game.ui.closeDialog(); openToolMenu(); } }, { label: '🎨 定制成员外观', cb: function () {
          game.ui.closeDialog(); game.ui.openEditor('tribe', function (genome) { for (var i = 0; i < members.length; i++) {
              try { SP.Genome.tint(members[i].model, genome.tint || null); } catch (e) { }
            } game.ui.toast('成员外观已更新', 'good');
          });
        } },
        { label: '关闭', cb: function () { game.ui.closeDialog(); } }
      ]);
  }
  function openToolMenu() {
    defMenu('购买工具（装备给选中成员，或第一名空闲成员）',
      '石斧可伐木，长矛适合战斗，鱼叉用于捕鱼，火把可驱赶动物，采集篮加速采集，乐器用于表演结盟。',
      TDEF, function (k) { buyTool(k); openToolMenu(); }, '返回', function () { openCenterMenu(); });
  }

  /* ============ 表演小游戏 ============ */
  var NOTES = { 1: ['沙锤', 'maracas'], 2: ['号角', 'horn'], 3: ['迪吉里杜管', 'didgeridoo'], 4: ['舞蹈', 'dance'] };
  function orderPerform(list, tribe) {
    if (tribe.allied || tribe.conquered) { game.ui.toast('该部落已完成', 'warn'); return; }
    var holder = null, chief = null, i; for (i = 0; i < list.length; i++) if (isInst(list[i].tool)) holder = list[i];
    for (i = 0; i < members.length; i++) if (members[i].alive && !members[i].baby && members[i].isChief) chief = members[i];
    if (!holder) { game.ui.toast('需要选中一名携带乐器的成员', 'warn'); sfx('deny'); return; } if (!chief) { game.ui.toast('部落没有酋长！', 'warn'); sfx('deny'); return; }
    if (holder.pos.distanceTo(tribe.totem.pos) > 30 || chief.pos.distanceTo(tribe.totem.pos) > 30) {
      game.ui.toast('酋长和乐手需要靠近对方图腾', 'warn'); sfx('deny'); return;
    } holder.task = { kind: 'move', pos: tribe.totem.pos.clone() }; chief.task = { kind: 'move', pos: tribe.totem.pos.clone() }; st.performPending = { tribe: tribe, holder: holder, chief: chief }; game.ui.toast('队伍前往 ' + tribe.name + ' 表演', '');
  }
  function nextRound() {
    perf.round++; perf.seq = [randi(1, 4), randi(1, 4), randi(1, 4), randi(1, 4)]; perf.idx = 0; perf.noteT = 0; perf.state = 'show'; for (var i = 0; i < 4; i++) {
      (function (n, d) { setTimeout(function () { if (perf) sfx(NOTES[n][1], 0.6); }, 450 * d); })(perf.seq[i], i + 1);
    } sfx('drum');
  }
  function startPerform(tribe) {
    perf = { tribe: tribe, round: 0, seq: [], idx: 0, noteT: 0, roundT: 0, state: 'show' }; st.perform = perf; perf.holder.task = null; perf.chief.task = null; sfx('ui_open'); nextRound();
  }
  function performKey(n) {
    if (!perf || perf.state !== 'play') return;
    sfx(NOTES[n][1], 1); if (n === perf.seq[perf.idx]) {
      perf.idx++; perf.noteT = 0; if (perf.idx >= 4) {
        perf.state = 'roundEnd'; perf.roundT = 0; changeRel(perf.tribe, 22); floatText(perf.tribe.totem.pos, '完美！+22 关系', '#7ee87e'); sfx('social_ok');
      }
    } else {
      perf.idx = 0; perf.noteT = 0; changeRel(perf.tribe, -3); floatText(perf.tribe.totem.pos, '出错 -3 关系', '#ff5d5d'); sfx('social_fail'); game.ui.toast('按错了！重新开始本段乐谱', 'warn');
    } refreshPerformHud();
  }
  function cancelPerform() {
    if (!perf) return;
    perf = null; st.perform = null; st.performPending = null; game.ui.setHud(''); game.ui.toast('表演取消', ''); refreshUI(true);
  }
  function updatePerform(dt) {
    if (!perf) return;
    var tribe = perf.tribe; if (tribe.allied || tribe.conquered) { perf = null; st.perform = null; return; }
    var dH = perf.holder.alive ? perf.holder.pos.distanceTo(tribe.totem.pos) : 999; var dC = perf.chief.alive ? perf.chief.pos.distanceTo(tribe.totem.pos) : 999; if (dH > 8 || dC > 12) {
      if (perf.holder.alive && dH > 8) perf.holder.task = { kind: 'move', pos: tribe.totem.pos.clone() };
      if (perf.chief.alive && dC > 12) perf.chief.task = { kind: 'move', pos: tribe.totem.pos.clone() };
    } else {
      if (perf.holder.task && perf.holder.task.kind === 'move') perf.holder.task = null;
      if (perf.chief.task && perf.chief.task.kind === 'move') perf.chief.task = null;
      if (perf.state === 'show') {
        perf.roundT += dt; if (perf.roundT > 1.9) { perf.state = 'play'; perf.noteT = 0; refreshPerformHud(); }
      } else if (perf.state === 'play') {
        perf.noteT += dt; if (perf.noteT > 4) {
          perf.idx = 0; perf.noteT = 0; changeRel(tribe, -3); floatText(tribe.totem.pos, '超时 -3 关系', '#ff5d5d'); sfx('social_fail');
        } if (perf.holder.alive) perf.holder.action = 'social';
        if (perf.chief.alive) perf.chief.action = 'social';
      } else if (perf.state === 'roundEnd') {
        perf.roundT += dt; if (perf.roundT > 1.2) {
          if (perf.round >= 3) {
            allyTribe(tribe); perf = null; st.perform = null; game.ui.setHud(''); refreshUI(true);
            return;
          } nextRound();
        }
      }
    }
  }
  function refreshPerformHud() {
    if (!perf) return;
    var t = perf.tribe; var h = '<div style="position:fixed;top:16%;left:50%;transform:translateX(-50%);text-align:center;background:rgba(0,0,0,0.75);padding:14px 22px;border-radius:14px;color:#fff;font-size:15px;border:2px solid ' + t.css + ';z-index:50;min-width:340px;">' + '<div style="font-weight:bold;color:' + t.css + '">' + t.name + ' 的乐谱 · 第 ' + perf.round + ' 轮 / 共 3 轮</div>' +
      '<div style="margin:8px 0;font-size:13px;color:#ddd">按数字键 1-4 复现（1 沙锤 · 2 号角 · 3 迪吉里杜管 · 4 舞蹈）</div>' + '<div style="display:flex;justify-content:center;gap:10px;font-size:22px">';
    for (var i = 0; i < 4; i++) {
      var active = perf.state === 'play' && i === perf.idx; var done = (perf.state === 'play' && i < perf.idx) || perf.state === 'roundEnd'; h += '<span style="width:44px;height:44px;line-height:44px;border-radius:10px;border:2px solid #666;background:' + (done ? t.css : (active ? '#fff3' : 'rgba(255,255,255,0.08)')) + ';">' + (done ? '✓' : NOTES[perf.seq[i]][0].charAt(0)) + '</span>';
    } h += '</div><div style="margin-top:6px;font-size:12px;color:#aaa">按 Esc 取消表演</div></div>'; game.ui.setHud(h);
  }
  function giftFood(tribe) {
    if (tribe.allied || tribe.conquered) { game.ui.toast('该部落已完成', 'warn'); return; } if (st.food < 20) { game.ui.toast('需要 20 食物作为赠礼', 'bad'); sfx('deny'); return; }
    st.food -= 20; tribe.rel = clamp(tribe.rel + 25, -100, 100); floatText(tribe.totem.pos, '+25 关系', '#7ee87e'); sfx('mission_ok'); game.ui.toast('向 ' + tribe.name + ' 赠送食物，关系提升', 'good'); if (tribe.rel >= 100) allyTribe(tribe);
    refreshUI(true);
  }
  function allyTribe(tribe) {
    tribe.rel = 100; tribe.allied = true; burst(tribe.totem.pos, 0x7ee87e, 30, 4); floatText(tribe.totem.pos, '结盟成功！', '#7ee87e', true); sfx('ally'); game.ui.toast('与 ' + tribe.name + ' 结盟！', 'good'); refreshUI(true); checkVictory();
  }
  function conquerTribe(tribe) {
    tribe.rel = -100; tribe.conquered = true; burst(tribe.totem.pos, 0xff5d5d, 40, 6); floatText(tribe.totem.pos, '部落被征服！', '#ff5d5d', true); sfx('epic_roar'); game.ui.toast('征服了 ' + tribe.name + '！', 'good'); for (var i = 0; i < enemies.length; i++) {
      if (enemies[i].tribe === tribe) {
        enemies[i].task = { kind: 'flee', pos: V3(tribe.pos.x + rand(-40, 40), 0, tribe.pos.z + rand(-40, 40)) };
      }
    } refreshUI(true); checkVictory();
  }
  function checkVictory() {
    if (resolvedCount() >= 5 && !st.won) {
      st.won = true; st.winT = 2.6; game.ui.toast('🎉 部落时代完成！正在进入文明阶段…', 'good'); sfx('stage_up'); burst(V3(0, 2, 0), 0xffd166, 60, 8);
    }
  }

  /* ============ AI ============ */
  function nearestPlayer(pos, maxD) {
    var best = null, bd = maxD; for (var i = 0; i < members.length; i++) {
      if (!members[i].alive) continue;
      var d = members[i].pos.distanceTo(pos); if (d < bd) { bd = d; best = members[i]; }
    }
    return best;
  }
  function stepTo(e, dest, dt) {
    var dx = dest.x - e.pos.x, dz = dest.z - e.pos.z; var dist = Math.sqrt(dx * dx + dz * dz); if (dist < 0.4) return true;
    var sp = e.speed * dt, step = Math.min(sp, dist); e.pos.x += dx / dist * step; e.pos.z += dz / dist * step; e.facing = Math.atan2(dx, dz); e.moveAmt = clamp(step / sp, 0, 1);
    return false;
  }
  function tickEnt(e, dt) {
    var h = terrainH(e.pos.x, e.pos.z); e.pos.y = h + e.groundOff; e.group.position.copy(e.pos); var diff = e.facing - e.group.rotation.y; while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    e.group.rotation.y += diff * Math.min(1, dt * 8); e.moveAmt = damp(e.moveAmt, 0, 4, dt); e.animT += dt * (e.moveAmt > 0.2 ? 2 : 1);
    try { SP.Genome.animate(e.model, e.animT, { move: e.moveAmt, action: e.action || null, speed: e.speed }); } catch (err) { } e.action = null;
    if (e.hpBar) {
      e.hpBar.group.visible = e.hp < e.maxHp; if (e.hpBar.group.visible) e.hpBar.set(e.hp, e.maxHp);
    } if (e.torchLight) e.torchLight.intensity = (0.7 + Math.sin(st.time * 12 + e.grain) * 0.25) * (st.night ? 1.4 : 0.7);
  }
  function damageTarget(target, dmg) {
    var tpos = target.pos || target.group.position; if (target.kind === 'totem') {
      target.hp -= dmg; floatText(tpos, '-' + dmg, '#ff8c5a'); burst(tpos, 0xffa05a, 4, 2, 0.4); if (target.hp <= 0) {
        target.alive = false; target.group.rotation.x = Math.PI / 2; target.group.position.y -= 2; sfx('boom'); conquerTribe(target.tribe);
      }
      return;
    } target.hp -= dmg; if (target.hurtT !== undefined) target.hurtT = 0.4;
    floatText(tpos, '-' + dmg, '#ff8c5a'); burst(tpos, 0xff5d5d, 3, 2, 0.3); sfx('hurt', 0.8); if (target.hp <= 0) {
      target.hp = 0; onDeath(target);
    }
  }
  function onDeath(target) {
    if (target.kind === 'member') {
      target.alive = false; floatText(target.pos, '成员阵亡', '#ff5d5d', true); sfx('die'); burst(target.pos, 0xff5d5d, 14, 3); rmEnt(target); members.splice(members.indexOf(target), 1); if (target.isChief) {
        for (var i = 0; i < members.length; i++) {
          if (!members[i].baby) {
            members[i].isChief = true; P(members[i].group, 'cone', 0.32, 0.7, 6, 0, 'red', 0, members[i].height + 0.55, 0);
            break;
          }
        }
      } if (members.length === 0) {
        game.ui.toast('部落覆灭……一名幸存者重建了部落', 'bad'); setTimeout(function () { if (st) spawnMember('幸存者', false); }, 1200);
      }
    } else if (target.kind === 'enemy') {
      target.alive = false; floatText(target.pos, '敌成员倒下', '#ff8c5a'); sfx('die'); burst(target.pos, 0xff5d5d, 10, 3); rmEnt(target); enemies.splice(enemies.indexOf(target), 1); changeRel(target.tribe, -6); target.tribe.respawnT = rand(30, 50);
    } else if (target.kind === 'animal') {
      target.alive = false; sfx('die'); burst(target.pos, 0xffa05a, 10, 3); makeCarcass(target);
    }
  }
  function throwSpear(from, target, dmg) {
    var sp = P(root, 'cyl', 0.04, 0.05, 1.6, 5, 'wood', from.x, from.y, from.z); P(sp, 'cone', 0.08, 0.3, 5, 0, 'stone', 0, 0.95, 0); st.projectiles.push({ mesh: sp, target: target, dmg: dmg,
      dir: tC.copy(target.pos || target.group.position).sub(from).normalize(),
      t: 0, speed: 22
    });
  }
  function updateProjectiles(dt) {
    for (var i = st.projectiles.length - 1; i >= 0; i--) {
      var p = st.projectiles[i]; p.t += dt; var tgt = p.target, dead = !tgt || tgt.alive === false || tgt.hp <= 0; var tpos = dead ? null : (tgt.pos || tgt.group.position); if (tpos) p.dir.copy(tpos).sub(p.mesh.position).normalize();
      p.mesh.position.addScaledVector(p.dir, p.speed * dt); p.mesh.rotation.z = Math.PI / 2; if (p.t > 1.6 || (tpos && p.mesh.position.distanceTo(tpos) < 1.1)) {
        root.remove(p.mesh); st.projectiles.splice(i, 1); if (!dead) damageTarget(tgt, p.dmg);
      }
    }
  }
  function updateMember(m, dt) {
    if (!m.alive) return;
    if (m.baby) {
      m.age += dt; var t = clamp(m.age / 45, 0, 1); m.group.scale.setScalar(lerp(0.5, 1, smooth(t))); if (t >= 1) {
        m.baby = false; game.ui.toast(m.name + ' 长大成年了！', 'good'); sfx('levelup');
      } if (m.task && m.task.kind === 'move') { if (stepTo(m, m.task.pos, dt)) m.task = null; }
      else if (chance(dt * 0.1)) m.task = { kind: 'move', pos: V3(rand(-8, 8), 0, rand(-8, 8)) };
      tickEnt(m, dt);
      return;
    } var task = m.task, done = false; if (!task) {
      if (chance(dt * 0.25)) m.task = { kind: 'move', pos: V3(rand(-10, 10), 0, rand(-10, 10)) };
      if (m.hp < 15) m.task = { kind: 'move', pos: V3(0, 0, 0) };
      tickEnt(m, dt);
      return;
    } if (task.kind === 'move') {
      done = stepTo(m, task.pos, dt);
    } else if (task.kind === 'gather') {
      var res = task.res; if (!res.alive) done = true;
      else if (stepTo(m, res.pos, dt)) {
        m.gatherT = (m.gatherT || 0) - dt; if (m.gatherT <= 0) {
          m.gatherT = (res.type === 'berry' ? 1.2 : 1.8) * (m.tool === 'basket' ? 0.5 : 1); m.action = 'eat'; res.count--; var gain = res.type === 'fruit' ? 2 : (res.type === 'berry' ? 1 : 2); st.food = Math.min(st.foodCap, st.food + gain); floatText(res.pos, '+' + gain, '#ffd166'); sfx(res.type === 'tree' ? 'chop' : 'gather', 0.7); if (res.type === 'fruit' && res.fruitMeshes[res.count]) res.fruitMeshes[res.count].visible = false;
          if (res.type === 'berry' && res.berryMeshes[res.count]) res.berryMeshes[res.count].visible = false;
          if (res.type === 'carcass') res.meat--;
          if (res.count <= 0) {
            done = true; if (res.type === 'tree' || res.type === 'carcass') rmRes(res);
            else res.timer = rand(25, 40);
          }
        }
      }
    } else if (task.kind === 'attack') {
      var target = task.target; if (!target || target.alive === false || target.hp <= 0) done = true;
      else {
        var tpos = target.pos || target.group.position; var isSpear = m.tool === 'spear'; var range = isSpear ? 16 : 2.4; var dist = m.pos.distanceTo(tpos); if (dist > range) {
          if (stepTo(m, tpos, dt)) done = true;
        } else {
          m.facing = Math.atan2(tpos.x - m.pos.x, tpos.z - m.pos.z); m.atkCd -= dt; if (m.atkCd <= 0) {
            m.atkCd = 1.0; m.action = 'attack'; if (isSpear) {
              sfx('spear_throw'); throwSpear(V3(m.pos.x, m.pos.y + 1.2, m.pos.z), target, dps(m));
            } else {
              sfx(m.tool === 'torch' ? 'fire' : 'bite'); damageTarget(target, dps(m));
            }
          }
        }
      }
    } else if (task.kind === 'drive') {
      var animal = task.target; if (!animal.alive || animal.tamed) done = true;
      else {
        var dirA = tA.copy(animal.pos).sub(m.pos); dirA.y = 0; if (dirA.length() < 0.1) dirA.set(1, 0, 0);
        dirA.normalize(); var behind = tB.copy(animal.pos).add(dirA.multiplyScalar(-2.5)); if (stepTo(m, behind, dt)) animal.scared = true;
        for (var i = 0; i < buildings.length; i++) {
          var b = buildings[i]; if (b.type === 'pen' && animal.pos.distanceTo(b.pos) < b.data.radius) {
            tameAnimal(animal, b); done = true;
            break;
          }
        }
      }
    } else if (task.kind === 'fish') {
      var spot = task.res; if (!spot.alive) done = true;
      else if (stepTo(m, spot.pos, dt)) {
        m.gatherT = (m.gatherT || 0) - dt; if (m.gatherT <= 0) {
          m.gatherT = 1.8; m.action = 'attack'; sfx('spear_throw'); spot.active = false; spot.timer = rand(35, 55); st.food = Math.min(st.foodCap, st.food + 3); floatText(spot.pos, '+3 鱼', '#7ee8ff'); done = true;
        }
      }
    } else if (task.kind === 'flee') {
      done = stepTo(m, task.pos, dt);
    } if (done) m.task = null;
    tickEnt(m, dt);
  }
  function updateAnimal(a, dt) {
    if (!a.alive) return;
    if (a.tamed) {
      a.timer -= dt; if (a.timer <= 0 && a.pen) {
        a.timer = 22; if ((a.pen.eggCd || 0) <= 0) { a.pen.eggCd = 8; spawnEgg(a.pen); }
      } if (chance(dt * 0.5)) {
        a.task = { kind: 'move', pos: V3(clamp(a.pen.pos.x + rand(-3, 3), a.pen.pos.x - 4, a.pen.pos.x + 4), 0, clamp(a.pen.pos.z + rand(-3, 3), a.pen.pos.z - 4, a.pen.pos.z + 4)) };
      } if (a.task && a.task.kind === 'move' && stepTo(a, a.task.pos, dt)) a.task = null;
      tickEnt(a, dt);
      return;
    } if (a.scared) {
      a.scaredT = (a.scaredT || 0) - dt; if (a.scaredT <= 0) { a.scared = false; a.task = null; }
      if (a.task && a.task.kind === 'move' && stepTo(a, a.task.pos, dt)) a.task = null;
      tickEnt(a, dt);
      return;
    } if (a.hurtT > 0) {
      a.hurtT -= dt; var away = nearestPlayer(a.pos, 30); if (away) {
        var d = tA.copy(a.pos).sub(away.pos).normalize(); a.task = { kind: 'move', pos: tB.copy(a.pos).add(d.multiplyScalar(14)) };
      } if (a.task && a.task.kind === 'move' && stepTo(a, a.task.pos, dt)) a.task = null;
      tickEnt(a, dt);
      return;
    } var threat = nearestPlayer(a.pos, 9); if (threat) {
      var d2 = tA.copy(a.pos).sub(threat.pos).normalize(); a.task = { kind: 'move', pos: tB.copy(a.pos).add(d2.multiplyScalar(16)), flee: true };
    } if (a.aggroNight && st.night) {
      var prey = nearestPlayer(a.pos, 18); if (prey) {
        a.task = { kind: 'move', pos: prey.pos.clone() }; if (stepTo(a, a.task.pos, dt) || a.pos.distanceTo(prey.pos) < 1.6) {
          damageTarget(prey, 5); a.atkCd = 1.4;
        }
      }
    } else if (a.task && a.task.kind === 'move' && a.task.flee) {
      if (stepTo(a, a.task.pos, dt)) a.task = null;
    } if (!a.task) {
      a.wanderT = (a.wanderT || 0) - dt; if (a.wanderT <= 0) {
        a.wanderT = rand(2, 6); var tgt = V3(a.home.x + rand(-12, 12), 0, a.home.z + rand(-12, 12)); if (terrainH(tgt.x, tgt.z) > WATER_Y + 0.2) a.task = { kind: 'move', pos: tgt };
      }
    } tickEnt(a, dt);
  }
  function tameAnimal(animal, pen) {
    var count = 0; for (var i = 0; i < animals.length; i++) if (animals[i].tamed && animals[i].pen === pen) count++;
    if (count >= 4) { game.ui.toast('围栏已满（4 只）', 'warn'); return; } animal.tamed = true; animal.pen = pen; animal.task = null; animal.timer = 12; floatText(animal.pos, '驯养成功！', '#7ee87e', true); sfx('levelup'); game.ui.toast('驯养了 ' + animal.name + '，它会定期产蛋', 'good');
  }
  function updateEnemy(e, dt) {
    if (!e.alive) return;
    var tribe = e.tribe; if (tribe.conquered) {
      if (e.task && e.task.kind === 'flee') {
        if (stepTo(e, e.task.pos, dt)) {
          rmEnt(e); enemies.splice(enemies.indexOf(e), 1);
        }
      } else {
        e.task = { kind: 'flee', pos: V3(tribe.pos.x + rand(-50, 50), 0, tribe.pos.z + rand(-50, 50)) };
      } tickEnt(e, dt);
      return;
    } if (tribe.allied) {
      if (nearestPlayer(e.pos, 14)) e.action = 'social';
      if (e.task && e.task.kind === 'move') { if (stepTo(e, e.task.pos, dt)) e.task = null; } else if (chance(dt * 0.2)) e.task = { kind: 'move', pos: V3(tribe.pos.x + rand(-8, 8), 0, tribe.pos.z + rand(-8, 8)) };
      tickEnt(e, dt);
      return;
    } if (!e.task && chance(dt * 0.3)) {
      e.task = { kind: 'move', pos: V3(tribe.pos.x + rand(-9, 9), 0, tribe.pos.z + rand(-9, 9)) };
    } if (tribe.rel < 0) {
      var intruder = nearestPlayer(tribe.totem.pos, 16); if (intruder) {
        e.task = { kind: 'move', pos: intruder.pos.clone() }; if (e.pos.distanceTo(intruder.pos) < 2) {
          e.atkCd -= dt; if (e.atkCd <= 0) {
            e.atkCd = 1.2; e.action = 'attack'; damageTarget(intruder, 5);
          }
        }
      }
    } if (e.task && e.task.kind === 'move') {
      if (e.task.raid && stepTo(e, e.task.pos, dt)) {
        if (st.food > 0 && e.task.steal) {
          var steal = Math.min(5, Math.floor(st.food)); st.food -= steal; floatText(V3(0, 3, 0), '-' + steal + ' 食物被偷', '#ff5d5d', true); sfx('roar'); game.ui.toast(tribe.name + ' 偷走了 ' + steal + ' 食物！', 'bad');
        } e.task = { kind: 'move', pos: e.home.clone() };
      } else if (!e.task.raid && stepTo(e, e.task.pos, dt)) {
        e.task = null;
      }
    } tickEnt(e, dt);
  }
  function updateTribeAI(dt) {
    for (var i = 0; i < st.tribes.length; i++) {
      var t = st.tribes[i]; if (t.conquered || t.allied) continue;
      t.raidT -= dt; if (t.rel < -40 && t.raidT <= 0) {
        t.raidT = rand(45, 80); var idle = []; for (var j = 0; j < enemies.length; j++) if (enemies[j].tribe === t && !enemies[j].task) idle.push(enemies[j]);
        if (idle.length) {
          var n = Math.min(idle.length, 2); for (var k = 0; k < n; k++) {
            idle[k].task = { kind: 'move', pos: V3(rand(-3, 3), 0, rand(-3, 3)), raid: true, steal: k === 0 };
          } game.ui.toast(t.name + ' 派出掠夺者！', 'warn'); sfx('roar');
        }
      } if (t.respawnT) {
        t.respawnT -= dt; if (t.respawnT <= 0) { t.respawnT = 0; spawnEnemy(t); }
      }
    }
  }

  /* ============ 昼夜与特效 ============ */
  var DAY_LEN = 300, sunLight = null, hemiLight = null, skyColor = null, fogObj = null;
  function initSky() {
    sunLight = new THREE.DirectionalLight(0xfff2d0, 1.0); sunLight.position.set(60, 120, 40); root.add(sunLight); hemiLight = new THREE.HemisphereLight(0xbfd8ff, 0x55703a, 0.6); root.add(hemiLight); skyColor = new THREE.Color(0x87b8e8); fogObj = new THREE.Fog(0x87b8e8, 80, 420); game.scene.fog = fogObj; game.scene.background = skyColor;
  }
  function updateSky(dt) {
    st.time += dt; var dayFrac = (st.time % DAY_LEN) / DAY_LEN; var sunH = Math.sin(TAU * dayFrac); var light = clamp(0.12 + 0.88 * smooth(clamp((sunH + 0.12) / 1.12, 0, 1)), 0.05, 1); st.night = light < 0.35; var dayC = new THREE.Color(0x9ecbff), nightC = new THREE.Color(0x0d1430); skyColor.copy(dayC).lerp(nightC, 1 - light); game.scene.background = skyColor; fogObj.color.copy(skyColor); fogObj.near = lerp(60, 120, light); fogObj.far = lerp(300, 460, light); sunLight.intensity = light * 1.2; sunLight.color.setHSL(0.09, 0.5, clamp(0.5 + light * 0.4, 0.2, 0.9)); sunLight.position.set(Math.sin(dayFrac * TAU) * 120, 60 + Math.max(0, sunH) * 140, Math.cos(dayFrac * TAU) * 120); hemiLight.intensity = 0.25 + light * 0.5; hemiLight.color.copy(dayC).lerp(nightC, 1 - light);
    if (waterMesh && waterMesh.material.map) {
      waterMesh.material.map.offset.x += dt * 0.008; waterMesh.material.map.offset.y += dt * 0.005;
    } var fires = st.baseFire ? [st.baseFire] : [], i; for (i = 0; i < buildings.length; i++) {
      var b = buildings[i]; if (b.type === 'fire') fires.push({ light: b.data.light, flame: b.data.flame });
      if (b.type === 'stone') b.data.light.intensity = 1 + Math.sin(st.time * 2 + i) * 0.2;
    } for (i = 0; i < fires.length; i++) {
      var fl = 0.55 + Math.sin(st.time * 13 + i * 2.7) * 0.25; fires[i].light.intensity = (st.night ? 2.0 : 0.55) * fl; if (fires[i].flame) fires[i].flame.scale.y = 1 + Math.sin(st.time * 17 + i) * 0.3;
    } for (i = 0; i < members.length; i++) {
      var m = members[i]; if (!m.alive) continue;
      var heal = st.baseFire && m.pos.distanceTo(st.baseFire.pos) < 6; if (!heal) {
        for (var j = 0; j < buildings.length; j++) {
          var bb = buildings[j]; if ((bb.type === 'fire' || bb.type === 'stone') && m.pos.distanceTo(bb.pos) < (bb.type === 'stone' ? 5 : 6)) { heal = true; break; }
        }
      } if (heal) m.hp = Math.min(m.maxHp, m.hp + 2.5 * dt);
      if (m.pos.length() < 7) m.hp = Math.min(m.maxHp, m.hp + 1.5 * dt);
    }
  }
  function updateEffects(dt) {
    var i, j; for (i = floats.length - 1; i >= 0; i--) {
      var f = floats[i]; f.life -= dt; f.sp.position.y += f.vy * dt; f.mat.opacity = clamp(f.life, 0, 1); if (f.life <= 0) {
        root.remove(f.sp); f.mat.dispose(); dtex(f.tex); floats.splice(i, 1);
      }
    } for (j = parts.length - 1; j >= 0; j--) {
      var p = parts[j]; p.userData.life -= dt; p.position.addScaledVector(p.userData.vel, dt); p.userData.vel.y -= 9.8 * dt; p.rotation.x += p.userData.rot.x * dt; p.rotation.y += p.userData.rot.y * dt; p.position.y = Math.max(p.position.y, terrainH(p.position.x, p.position.z) + 0.2); if (p.userData.life <= 0) {
        root.remove(p); p.material.dispose(); parts.splice(j, 1);
      }
    } for (i = pickups.length - 1; i >= 0; i--) {
      var egg = pickups[i], got = false; if (egg.alive) {
        for (j = 0; j < members.length; j++) {
          if (members[j].alive && members[j].pos.distanceTo(egg.pos) < 2) {
            st.food = Math.min(st.foodCap, st.food + 1); floatText(egg.pos, '+1 蛋', '#fff2c8'); sfx('eat'); got = true;
            break;
          }
        } if (!got) {
          egg.timer -= dt; if (egg.timer <= 0) got = true;
        }
      } if (got || !egg.alive) {
        unregM(egg.group, { kind: 'resource', ref: egg }); root.remove(egg.group); egg.alive = false; pickups.splice(i, 1);
      }
    } for (i = 0; i < resources.length; i++) {
      var res = resources[i]; if (!res.alive) continue;
      if ((res.type === 'fruit' || res.type === 'berry') && res.count < res.max) {
        res.timer -= dt; if (res.timer <= 0) {
          res.timer = 0; res.count = res.max; if (res.fruitMeshes) for (j = 0; j < res.fruitMeshes.length; j++) res.fruitMeshes[j].visible = true;
          if (res.berryMeshes) for (j = 0; j < res.berryMeshes.length; j++) res.berryMeshes[j].visible = true;
        }
      } if (res.type === 'fish') {
        if (!res.active) {
          res.timer -= dt; if (res.timer <= 0) res.active = true;
        } if (res.group) res.group.visible = res.active;
        if (res.active && res.fishMeshes) {
          var ft = st.time * 3 + i; for (j = 0; j < res.fishMeshes.length; j++) {
            var fish = res.fishMeshes[j]; var jump = Math.max(0, Math.sin(ft + j * 1.7)); fish.position.y = jump * 0.7; fish.rotation.z = jump * 0.8;
          }
        }
      }
    } for (i = animals.length - 1; i >= 0; i--) {
      var animal = animals[i]; if (!animal.alive && animal.respawnT) {
        animal.respawnT -= dt; if (animal.respawnT <= 0) {
          animals.splice(i, 1); spawnAnimal(animal.typeDef);
        }
      }
    }
  }

  /* ============ 相机与输入 ============ */
  function updateCamera(dt) {
    var m = game.input.mouse; if (m.down2) {
      camState.target.x -= m.dx * camState.dist * 1.1; camState.target.z -= m.dy * camState.dist * 1.1;
    } if (m.wheel) camState.dist = clamp(camState.dist * (1 - m.wheel * 0.12), 18, 150);
    var keys = game.input.keys; if (keys) {
      if (keys.KeyQ) camState.yaw -= dt * 1.4;
      if (keys.KeyE) camState.yaw += dt * 1.4;
    } camState.dist = clamp(camState.dist, 18, 150); var tx = clamp(camState.target.x, -MAP * 0.45, MAP * 0.45); var tz = clamp(camState.target.z, -MAP * 0.45, MAP * 0.45); camState.target.set(tx, terrainH(tx, tz) + 2, tz); var cp = tA.set( camState.target.x + Math.sin(camState.yaw) * Math.cos(camState.pitch) * camState.dist,
      camState.target.y + Math.sin(camState.pitch) * camState.dist,
      camState.target.z + Math.cos(camState.yaw) * Math.cos(camState.pitch) * camState.dist
    ); if (cp.y < terrainH(cp.x, cp.z) + 3) cp.y = terrainH(cp.x, cp.z) + 3;
    game.camera.position.copy(cp); game.camera.lookAt(camState.target);
  }
  function handleInput() {
    var m = game.input.mouse; if (m.down0 && !selDrag) selDrag = { x0: m.x, y0: m.y, moved: false };
    if (selDrag && m.down0) {
      if (Math.abs(m.x - selDrag.x0) > 0.03 || Math.abs(m.y - selDrag.y0) > 0.03) selDrag.moved = true;
    } if (selDrag && !m.down0) {
      if (selDrag.moved) {
        boxSelect(Math.min(selDrag.x0, m.x), Math.min(selDrag.y0, m.y), Math.max(selDrag.x0, m.x), Math.max(selDrag.y0, m.y));
      } else {
        onLeftClick(m.x, m.y);
      } selDrag = null;
    } if (m.down2 && !st.rDown) st.rDown = true;
    if (!m.down2 && st.rDown) {
      st.rDown = false; onRightClick(m.x, m.y);
    } if (!m.down0 && !m.down2) {
      var hit = pick(m.x, m.y); if (hit !== hovered) {
        if (hovered && hovered.ring) hovered.ring.visible = false;
        hovered = hit; if (hovered && hovered.ring) {
          hovered.ring.material = rmat(hovered.team === 'enemy' ? '#ff5d5d' : '#ffffff'); hovered.ring.visible = true;
        }
      }
    } else if (hovered && hovered.ring) {
      hovered.ring.visible = false; hovered = null;
    } var k = game.input.keys; if (k && perf) {
      for (var n = 1; n <= 4; n++) {
        if (k['Digit' + n] && !st.keysPrev['Digit' + n]) performKey(n);
      } if (k.Escape && !st.keysPrev.Escape) cancelPerform();
    } if (k) {
      for (var key in k) {
        if (k[key]) st.keysPrev[key] = true;
        else delete st.keysPrev[key];
      }
    }
  }

  /* ============ UI ============ */
  var uiTimer = 0;
  function refreshUI(force) {
    if (!force) {
      uiTimer -= 1 / 60; if (uiTimer > 0) return;
    } uiTimer = 0.25;
    try {
      game.ui.setBars([
        { label: '🍖 食物', v: Math.floor(st.food), max: st.foodCap, color: '#ffd166' },
        { label: '👥 成员', v: members.length, max: st.memberCap, color: '#6fdc8c' }
      ]); var n = resolvedCount(); game.ui.setProgress(n / 5, '部落阶段 ' + n + '/5'); game.ui.setObjective('部落阶段：把 5 个部落全部「结盟或征服」（' + n + '/5）。' + '点选成员后右键地面移动 / 资源采集 / 敌人攻击；右键敌图腾可表演结盟或赠送食物。');
      if (!perf) {
        var sel = st.selected.length ? st.selected[0] : null; var selHtml = sel ? '　·　' + sel.name + ' ' + (sel.tool ? TDEF[sel.tool].icon + TDEF[sel.tool].name : '徒手') + ' HP ' + Math.round(sel.hp) + '/' + sel.maxHp : ''; game.ui.setHud(
          '<div style="position:fixed;top:10px;left:50%;transform:translateX(-50%);text-align:center;color:#fff;' + 'text-shadow:0 2px 4px #000;font-size:16px;background:rgba(0,0,0,0.45);padding:6px 18px;' +
          'border-radius:20px;pointer-events:none;z-index:40">' + (st.night ? '🌙' : '☀️') + ' 第 ' + (Math.floor(st.time / DAY_LEN) + 1) + ' 天 · 🍖 ' +
          Math.floor(st.food) + '/' + st.foodCap + selHtml + '</div>'
        );
      }
    } catch (e) { }
  }

  /* ============ 更新循环 ============ */
  this.update = function (dt) {
    if (!st || !root) return;
    if (dt > 0.1) dt = 0.1;
    updateSky(dt); updateMarks(dt); var i; for (i = 0; i < members.length; i++) updateMember(members[i], dt);
    for (i = 0; i < animals.length; i++) updateAnimal(animals[i], dt);
    for (i = 0; i < enemies.length; i++) updateEnemy(enemies[i], dt);
    updateTribeAI(dt); updateProjectiles(dt); updateEffects(dt); if (st.performPending && !perf) {
      var pp = st.performPending; if (pp.holder.alive && pp.chief.alive) {
        if (pp.holder.pos.distanceTo(pp.tribe.totem.pos) < 8 && pp.chief.pos.distanceTo(pp.tribe.totem.pos) < 12) {
          st.performPending = null; startPerform(pp.tribe);
        }
      } else {
        st.performPending = null;
      }
    } updatePerform(dt); updateCamera(dt); handleInput(); if (st.won) {
      st.winT -= dt; if (st.winT <= 0) {
        game.advance('civ', {
          food: st.food,
          resolved: resolvedCount(),
          relations: st.tribes.map(function (t) {
            return { name: t.name, rel: t.rel, allied: t.allied, conquered: t.conquered };
          }),
          tools: Object.keys(TDEF).filter(function (tk) {
            return members.some(function (m) { return m.tool === tk; });
          })
        });
        return;
      }
    } refreshUI(false);
  };

  /* ============ 存档 ============ */
  this.serialize = function () {
    return {
      v: 1,
      food: st.food, time: st.time, won: st.won, winT: st.winT || 0,
      members: members.map(function (m) {
        return { name: m.name, x: m.pos.x, z: m.pos.z, hp: m.hp, tool: m.tool, baby: m.baby, age: m.age, chief: m.isChief };
      }),
      buildings: buildings.map(function (b) { return { type: b.type, slot: b.slot.idx }; }), tribes: st.tribes.map(function (t) {
        return { index: t.index, rel: t.rel, allied: t.allied, conquered: t.conquered, totemHp: t.totem.hp };
      }),
      resources: resources.filter(function (r) {
        return r.type === 'fruit' || r.type === 'berry';
      }).map(function (r) {
        return { type: r.type, x: r.pos.x, z: r.pos.z, count: r.count, timer: r.timer };
      }),
      tamed: animals.filter(function (a) { return a.tamed; }).map(function (a) {
        return { x: a.pos.x, z: a.pos.z, typeId: a.typeId };
      })
    };
  }; this.deserialize = function (s) { S.enter(null);
    if (!s) return;
    st.food = s.food || 40; st.time = s.time || 0; st.won = !!s.won; st.winT = s.winT || 0; var i, j; if (s.buildings) {
      for (i = 0; i < s.buildings.length; i++) {
        var slot = slots[s.buildings[i].slot]; if (slot && !slot.taken) buildBuilding(s.buildings[i].type, slot);
      }
    } if (s.tribes) {
      for (i = 0; i < s.tribes.length; i++) {
        var sd = s.tribes[i], tribe = st.tribes[sd.index]; if (!tribe) continue;
        tribe.rel = sd.rel; tribe.allied = !!sd.allied; tribe.conquered = !!sd.conquered; if (sd.conquered) {
          tribe.totem.group.rotation.x = Math.PI / 2; tribe.totem.alive = false;
        } else {
          tribe.totem.hp = sd.totemHp;
        }
      }
    } if (s.resources) {
      for (i = 0; i < s.resources.length; i++) {
        var rd = s.resources[i]; for (j = 0; j < resources.length; j++) {
          var res = resources[j]; if (res.type === rd.type && Math.abs(res.pos.x - rd.x) < 1 && Math.abs(res.pos.z - rd.z) < 1) {
            res.count = rd.count; res.timer = rd.timer; if (res.fruitMeshes) for (var f = 0; f < res.fruitMeshes.length; f++) res.fruitMeshes[f].visible = f < rd.count;
            if (res.berryMeshes) for (var bm = 0; bm < res.berryMeshes.length; bm++) res.berryMeshes[bm].visible = bm < rd.count;
          }
        }
      }
    } if (s.members) {
      for (i = members.length - 1; i >= 0; i--) rmEnt(members[i]);
      members = []; st.selected = []; for (i = 0; i < s.members.length; i++) {
        var md = s.members[i]; var mem = spawnMember(md.name, !!md.baby, V3(md.x, 0, md.z)); mem.hp = md.hp; mem.age = md.age || 0; mem.isChief = !!md.chief; if (md.tool) equipTool(mem, md.tool);
        if (md.baby) mem.group.scale.setScalar(lerp(0.5, 1, clamp(mem.age / 45, 0, 1)));
      }
    } if (s.tamed) {
      var pen = null; for (i = 0; i < buildings.length; i++) if (buildings[i].type === 'pen') { pen = buildings[i]; break; }
      if (pen) {
        for (i = 0; i < s.tamed.length; i++) {
          var td = s.tamed[i]; var anim = spawnAnimal({ id: td.typeId, name: '驯养兽', hp: 25, speed: 5, scale: 0.7, meat: 3, tint: [0.1, 0.4, 0.35] }); anim.pos.set(td.x, 0, td.z); anim.tamed = true; anim.pen = pen; anim.timer = 12; tickEnt(anim, 0);
        }
      }
    } refreshUI(true);
  };

  /* ============ 进出阶段 ============ */
  var ANIMAL_DEFS = {
    rabbit: { id: 'rabbit', name: '野兔', hp: 14, speed: 7.5, scale: 0.35, meat: 2, aggro: false, tint: [0.09, 0.5, 0.55] },
    deer: { id: 'deer', name: '野鹿', hp: 26, speed: 6.5, scale: 0.7, meat: 4, aggro: false, tint: [0.1, 0.45, 0.45] },
    wolf: { id: 'wolf', name: '野狼', hp: 32, speed: 7.0, scale: 0.6, meat: 3, aggro: true, tint: [0.0, 0.4, 0.4] }
  }; this.enter = function (payload) { if (root) {
      game.scene.remove(root); disposeAll();
    } root = new THREE.Group(); game.scene.add(root); st = { food: 40, foodCap: 60, memberCap: 6, hutCount: 0, penCount: 0,
      time: 8 * 60, night: false, selected: [], rDown: false, keysPrev: {},
      projectiles: [], marks: [], perform: null, performPending: null,
      won: false, winT: 0, baseFire: null, tribes: []
    }; members = []; enemies = []; animals = []; pickups = []; totems = []; resources = []; buildings = []; slots = []; floats = []; parts = []; perf = null; hovered = null; selDrag = null; var i; initMats(); buildTerrain(); var dr = new Rng(555); deco(dr, 'tree', 46); deco(dr, 'bush', 40); deco(dr, 'rock', 22); placeResources(); initSlots(); baseFire(); initSky(); makeTotem(V3(0, 0, 0), null, true);
    spawnMember('酋长', false); spawnMember('部落成员', false); st.tribes = initTribes(); for (i = 0; i < st.tribes.length; i++) spawnTribe(st.tribes[i]);
    var ar = new Rng(999); for (i = 0; i < 11; i++) {
      var def = ANIMAL_DEFS[ar.pick(['rabbit', 'rabbit', 'deer', 'deer', 'wolf'])]; var anim = spawnAnimal(def); anim.typeDef = def;
    } camState = { yaw: 0.6, pitch: 0.95, dist: 72, target: V3(0, 0, 0) }; game.camera.fov = 55; game.camera.near = 0.5; game.camera.far = 900; game.camera.updateProjectionMatrix(); updateCamera(0); game.ui.setActions([ { key: '1', label: '部落中心', desc: '繁殖 / 购买工具 / 外观', cb: function () { openCenterMenu(); } },
      { key: '2', label: '建造', desc: '点击营地四周的槽位建造建筑', cb: function () {
        game.ui.toast('点击地图上白色圆环槽位即可建造', '');
      } },
      { key: '3', label: '结盟表演', desc: '选中带乐器成员并靠近敌图腾', cb: function () {
        if (!st.selected.length) { game.ui.toast('请先点选成员', 'warn'); return; }
        var near = null; for (var i = 0; i < st.tribes.length; i++) {
          var t = st.tribes[i]; if (t.allied || t.conquered) continue;
          if (st.selected.some(function (m) { return m.pos.distanceTo(t.totem.pos) < 30; })) { near = t; break; }
        } if (near) orderPerform(st.selected, near);
        else game.ui.toast('需要靠近某部落图腾（30 米内）', 'warn');
      } },
      { key: '4', label: '帮助', desc: '操作提示', cb: function () {
        game.ui.toast('左键选人/框选；右键移动/采集/攻击；右键图腾结盟或征服', '');
      } }
    ]); refreshUI(true); game.ui.toast('部落时代开始！采集食物，发展部落，结盟或征服 5 个部落', '');
  }; this.exit = function () { if (root) {
      game.scene.remove(root); disposeAll();
    } root = null; st = null; game.scene.fog = null; game.scene.background = null;
  };
  function disposeAll() {
    try {
      for (var i = 0; i < disposables.geo.length; i++) if (disposables.geo[i]) disposables.geo[i].dispose();
      for (var j = 0; j < disposables.mat.length; j++) if (disposables.mat[j]) disposables.mat[j].dispose();
      disposables.geo = []; disposables.mat = []; for (var t = 0; t < disposables.tex.length; t++) dtex(disposables.tex[t]);
      disposables.tex = []; for (var key in mats) dtex(mats[key].map);
      for (var c in ringMats) dtex(ringMats[c].map);
    } catch (e) { }
  }
};
