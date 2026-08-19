/*!
 * stage_civ.js — 《孢子》第四阶段：文明
 * 结构：工具/材质库 → 行星地形 → 香料喷口与钻井 → 城市与建筑 → 载具 → 选择与命令
 *      → 战斗 → AI 与外交 → 超级武器 → 城市面板 → 相机/主循环 → 存档。
 * 依赖：THREE r149 UMD、SP.U/Tex/Audio/Genome 与 game.* UI 接口；经典脚本无模块语法。
 */
SP.StageCiv = function (game) {
  'use strict';
  var self = this;
  var TAU = Math.PI * 2;
  var clamp = SP.U.clamp, rand = SP.U.rand, choice = SP.U.choice, chance = SP.U.chance;
  var smooth = SP.U.smooth || function (t, a, b) { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var MAP = 240, SEA = 0, PLAYER = 0, CITY_NUM = 10, GEYSER_NUM = 12;
  var RIG_COST = 300, RIG_RATE = 6, RIG_HP = 90, BUY_COST = 400, FAITH_RATE = 2.6;
  // 载具属性：分支 land/sea/air × 变体 m军事 e经济 r宗教
  var UNIT = {
    land: { m: { hp: 70, dmg: 14, rate: 1.1, rng: 24, spd: 15, cost: 80, prod: 50, label: '陆行战车' }, e: { hp: 50, dmg: 4, rate: 0.8, rng: 16, spd: 20, cost: 60, prod: 35, label: '贸易商车' }, r: { hp: 55, dmg: 6, rate: 0.9, rng: 18, spd: 17, cost: 85, prod: 45, label: '布道吉普' } },
    sea: { m: { hp: 95, dmg: 18, rate: 1.3, rng: 30, spd: 13, cost: 110, prod: 60, label: '钢铁炮舰' }, e: { hp: 70, dmg: 5, rate: 0.8, rng: 18, spd: 16, cost: 85, prod: 45, label: '远洋商船' }, r: { hp: 75, dmg: 7, rate: 0.9, rng: 20, spd: 15, cost: 115, prod: 55, label: '传教圣船' } },
    air: { m: { hp: 50, dmg: 10, rate: 0.8, rng: 20, spd: 28, cost: 150, prod: 70, label: '苍穹轰炸机' }, e: { hp: 40, dmg: 3, rate: 0.7, rng: 14, spd: 32, cost: 115, prod: 50, label: '货运飞艇' }, r: { hp: 45, dmg: 5, rate: 0.8, rng: 16, spd: 30, cost: 155, prod: 60, label: '福音飞艇' } }
  };
  var BRANCH = { land: '陆行', sea: '舰船', air: '飞行' };
  var VARNAME = { m: '军事', e: '经济', r: '宗教' };
  var ARCHN = { military: '军事', economic: '经济', religious: '宗教' };
  var ARCH_COLOR = { military: 0xe2543f, economic: 0xf0b23a, religious: 0x9a6fe0 };
  var AI_COLOR = { 1: 0xd24a4a, 2: 0xe8a62e, 3: 0x7f5fd0, 4: 0x4a8fe0 };
  var CITY_NAMES = ['黎明城', '铁崖城', '翡翠港', '白霜堡', '赤沙城', '星落镇', '银湾市', '磐石城', '花溪城', '风谷城', '暮光城', '琉璃港', '荒原哨', '青丘城', '雷鸣堡', '玉泉城', '青杉城', '石镜城'];
  var NATION_NAME = ['你的文明', '钢铁军团', '黄金商会', '晨光圣殿', '苍蓝联邦'];
  var SLOT_LABEL = ['住宅(人口)', '工厂(生产)', '娱乐(幸福)'];
  var SLOT_ANCHOR = [[-5.6, 6.4], [6.4, 4.8], [4.8, -6.6]];

  var root = null, terrainMesh = null, oceanMesh = null, noiseLow = null, noiseHigh = null, noiseGrass = null;
  var nations = [], cities = [], geysers = [], vehicles = [], pickMeshes = [];
  var particles = [], floats = [], projectiles = [], markers = [];
  var selected = [], hovered = null, playerDesign = null, armedWeapon = null, rDownPos = null;
  var superUnlocked = false, winDone = false, ship = null, prevDown0 = false, prevDown2 = false, boxDrag = null;
  var aiTimer = 0, diploTimer = 0, hudTimer = 0, diploIdx = 0, savedEnv = null, lastWheel = 0;
  var cam = { theta: 0.6, phi: 1.12, dist: 100, tx: 0, tz: 0, shake: 0 };
  var createdMats = [], createdTexs = [], createdGeos = [], keyEdges = {};
  var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2(), _v1 = new THREE.Vector3();

  function tM(m) { createdMats.push(m); return m; }
  function tT(t) { createdTexs.push(t); return t; }
  function tG(g) { createdGeos.push(g); return g; }

  /* ===== 二、材质库 ===== */
  var COL = { deep: new THREE.Color(0x0a2f5e), shallow: new THREE.Color(0x1a6fb5), sand: new THREE.Color(0xd8c278), grass: new THREE.Color(0x5a9e3f), rock: new THREE.Color(0x7a7268), snow: new THREE.Color(0xf2f5f7) };
  function matS(color, o) { o = o || {}; return tM(new THREE.MeshStandardMaterial({ color: color, roughness: o.r != null ? o.r : 0.85, metalness: o.met || 0, emissive: o.em || 0x000000, emissiveIntensity: o.ei != null ? o.ei : 1, flatShading: o.flat != null ? o.flat : true })); }
  function matB(color, o) { o = o || {}; return tM(new THREE.MeshBasicMaterial({ color: color, transparent: o.t, opacity: o.op != null ? o.op : 1, depthWrite: o.dw != null ? o.dw : true })); }
  function canvasTex(w, h, draw) { var cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); return tT(new THREE.CanvasTexture(cv)); }
  function hexC(c) { return '#' + c.getHexString(); }
  function textSprite(text, size, color, px) {
    var t = canvasTex(256, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h); g.font = 'bold ' + (px || 42) + 'px "Microsoft YaHei",sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(10,10,20,0.85)';
      g.strokeText(text, w / 2, h / 2); g.fillStyle = color || '#fff'; g.fillText(text, w / 2, h / 2);
    });
    var s = new THREE.Sprite(tM(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })));
    s.scale.set(size, size / 2, 1); return s;
  }
  function glowSprite(size, color, opacity) {
    var s = new THREE.Sprite(tM(new THREE.SpriteMaterial({ map: SP.Tex.glow(), color: color, transparent: true, opacity: opacity, depthWrite: false, blending: THREE.AdditiveBlending })));
    s.scale.set(size, size, 1); return s;
  }
  function flagMesh(color) {
    var t = canvasTex(64, 48, function (g, w, h) {
      g.fillStyle = hexC(color); g.beginPath(); g.moveTo(0, 4); g.lineTo(w - 2, h / 2); g.lineTo(0, h - 4); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(w - 12, h / 2, 5, 0, TAU); g.fill();
    });
    var f = new THREE.Mesh(tG(new THREE.PlaneGeometry(1.7, 1.3)), tM(new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, transparent: true })));
    return f;
  }
  function hpBarMesh(frac, color) {
    var g = new THREE.Group();
    var bg = new THREE.Mesh(tG(new THREE.PlaneGeometry(2.2, 0.26)), matB(0x0a0f18, { t: true, op: 0.75 }));
    bg.geometry.translate(1.1, 0, 0); bg.rotation.x = -Math.PI / 2; g.add(bg);
    var fill = new THREE.Mesh(tG(new THREE.PlaneGeometry(2.0, 0.16)), matB(color, { t: true, op: 0.95 }));
    fill.geometry.translate(1.0, 0, 0.01); fill.rotation.x = -Math.PI / 2; fill.scale.x = clamp(frac, 0, 1);
    g.add(fill); g.userData.fill = fill; return g;
  }
  function setFill(bar, frac) { bar.userData.fill.scale.x = clamp(frac, 0, 1); }
  // 便捷添加网格：put(组, 几何, 材质, x, y, z, rx, ry, rz, s)
  function put(grp, geo, mat, x, y, z, rx, ry, rz, s) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    if (s) m.scale.setScalar(s);
    grp.add(m);
    return m;
  }

  /* ===== 三、行星地形 ===== */
  function terrainHeight(x, z) {
    var n1 = SP.U.fbm(noiseLow, x * 0.016, z * 0.016, 5, 0.5, 2.2);
    var n2 = SP.U.fbm(noiseHigh, x * 0.11, z * 0.11, 3, 0.5, 2.0);
    return (n1 - 0.5) * 32 + (n2 - 0.5) * 6;
  }
  function terrainColorAt(h, x, z) {
    var c = new THREE.Color();
    if (h < 0) c.lerpColors(COL.deep, COL.shallow, smooth(h, -8, -0.5));
    else if (h < 0.9) c.lerpColors(COL.sand, COL.grass, smooth(h, 0.1, 0.9));
    else if (h < 8) { var n = SP.U.fbm(noiseGrass, x * 0.25, z * 0.25, 2, 0.5, 2.0); c.copy(COL.grass).offsetHSL(0, 0, (n - 0.5) * 0.08); }
    else if (h < 12.5) c.lerpColors(COL.grass, COL.rock, smooth(h, 8, 12.5));
    else c.lerpColors(COL.rock, COL.snow, smooth(h, 12.5, 15));
    return c;
  }
  function buildTerrain() {
    var geo = tG(new THREE.PlaneGeometry(MAP, MAP, 200, 200));
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i), h = terrainHeight(x, z), c = terrainColorAt(h, x, z);
      pos.setY(i, h); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    var m = matS(0xffffff, { flat: false, r: 1 }); m.vertexColors = true;
    terrainMesh = new THREE.Mesh(geo, m); terrainMesh.receiveShadow = true; root.add(terrainMesh);
    var wg = tG(new THREE.PlaneGeometry(MAP + 60, MAP + 60, 1, 1));
    wg.rotateX(-Math.PI / 2);
    var wm = matS(0x2a6fc0, { r: 0.25, met: 0.15, t: true, op: 0.85 });
    wm.map = SP.Tex.water(8, 8).clone(); tT(wm.map); // 克隆以避免污染宿主共享纹理（滚动偏移）
    oceanMesh = new THREE.Mesh(wg, wm); oceanMesh.position.y = SEA; root.add(oceanMesh);
  }

  /* ===== 四、香料喷口与钻井 ===== */
  function buildGeyserVisual(g) {
    var grp = new THREE.Group();
    var tip = put(grp, tG(new THREE.SphereGeometry(0.75, 10, 8)), matS(0x9bff9b, { em: 0x39ff7a, ei: 1.6, r: 0.3 }), 0, 7.4, 0);
    put(grp, tG(new THREE.CylinderGeometry(0.55, 0.95, 7, 10)), matS(0x3fae52, { em: 0x1c6b2c, ei: 0.9, r: 0.4 }), 0, 3.5, 0);
    tip.userData.pick = { kind: 'geyser', ref: g }; pickMeshes.push(tip); g.tip = tip;
    var glow = glowSprite(5, 0x59ff8b, 0.55); glow.position.y = 8.2; grp.add(glow);
    grp.userData.glow = glow;
    grp.position.set(g.x, terrainHeight(g.x, g.z) - 0.4, g.z);
    g.model = grp; root.add(grp);
  }
  function buildRig(g) {
    var grp = new THREE.Group();
    put(grp, tG(new THREE.CylinderGeometry(1.8, 2.2, 1, 8)), matS(0x6b7280), 0, 0.5, 0);
    put(grp, tG(new THREE.CylinderGeometry(0.35, 0.6, 6, 8)), matS(0x8a93a0, { met: 0.4 }), 0, 3.8, 0);
    put(grp, tG(new THREE.OctahedronGeometry(0.85)), matS(g.nation.color, { em: g.nation.color, ei: 0.9 }), 0, 7.2, 0);
    var glow = glowSprite(4, 0x8dffb0, 0.5); glow.position.y = 7.8; grp.add(glow);
    var flag = flagMesh(g.nation.color); flag.position.set(0, 4.6, 0); grp.add(flag);
    var hp = hpBarMesh(1, 0x57ff7a); hp.position.y = 9.6; hp.visible = false; grp.add(hp);
    grp.userData.glow = glow; grp.userData.hp = hp;
    var pk = put(grp, tG(new THREE.CylinderGeometry(1.9, 1.9, 3, 6)), matB(0xffffff, { t: true, op: 0 }), 0, 1.5, 0);
    pk.userData.pick = { kind: 'rig', ref: g }; pickMeshes.push(pk);
    grp.position.set(g.x, terrainHeight(g.x, g.z) - 0.4, g.z);
    g.model = grp; g.hp = RIG_HP; g.tip && (g.tip.visible = false);
    root.add(grp);
  }
  function buildRigFor(g, nid) {
    if (g.rig) return false;
    g.owner = nid; g.nation = getNation(nid); g.rig = true;
    buildRig(g);
    return true;
  }

  /* ===== 五、城市与建筑 ===== */
  function getNation(id) { for (var i = 0; i < nations.length; i++) if (nations[i].id === id) return nations[i]; return null; }
  function isAlly(a, b) { if (a === b) return true; var n = getNation(a); return n && n.allies.indexOf(b) >= 0; }
  function atWar(a, b) { var n = getNation(a); return n && n.wars.indexOf(b) >= 0; }
  function nationName(id) { return NATION_NAME[id] || '未知'; }
  function cityHappiness(c) { return clamp(62 - c.slots[0] * 4 + c.slots[2] * 13, 5, 100); }
  function cityIncome(c) { return 2 + c.slots[0] * 1.5; }
  function nationIncome(n) {
    var inc = 0, i;
    for (i = 0; i < n.cities.length; i++) inc += cityIncome(n.cities[i]);
    for (i = 0; i < n.rigs.length; i++) inc += RIG_RATE;
    for (i = 0; i < n.trade.length; i++) { var m = getNation(n.trade[i]); if (m) inc += m.cities.length * (n.arch === 'economic' ? 4 : 2); }
    return inc;
  }
  function spendMoney(nid, amt) {
    if (nid === PLAYER) { if (game.money >= amt) { game.addMoney(-amt); return true; } return false; }
    var n = getNation(nid); if (n && n.money >= amt) { n.money -= amt; return true; } return false;
  }
  function redrawCityLabel(city) {
    var m = getNation(city.nation);
    city.label.material.map = canvasTex(256, 128, function (g, w, h) {
      g.clearRect(0, 0, w, h); g.font = 'bold 30px "Microsoft YaHei",sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 8; g.strokeStyle = 'rgba(10,10,20,0.85)';
      var txt = city.name + '  ' + nationName(city.nation);
      g.strokeText(txt, w / 2, h / 2); g.fillStyle = m ? hexC(m.color) : '#fff'; g.fillText(txt, w / 2, h / 2);
    });
  }
  function slotVisual(type, level, nation) {
    var grp = new THREE.Group(), s = 0.7 + level * 0.3;
    if (type === 'house') {
      put(grp, tG(new THREE.BoxGeometry(2.6, 1.9, 2.6)), matS(nation.color), 0, 1, 0);
      put(grp, tG(new THREE.ConeGeometry(1.95, 1.1, 4)), matS(0xb3533a), 0, 2.45, 0, 0, Math.PI / 4);
      put(grp, tG(new THREE.BoxGeometry(1.4, 0.7, 0.12)), matS(0xffe9a0, { em: 0xffc85a, ei: 0.8, flat: false }), 0, 1, 1.31);
    } else if (type === 'factory') {
      put(grp, tG(new THREE.BoxGeometry(3.0, 1.8, 2.4)), matS(0x7a8694, { met: 0.3 }), 0, 1, 0);
      put(grp, tG(new THREE.CylinderGeometry(0.35, 0.45, 2.6, 8)), matS(0x555e68, { met: 0.5 }), 0.9, 2.8, 0);
      put(grp, tG(new THREE.SphereGeometry(0.32, 8, 6)), matS(0xdfe6ee, { em: 0x77808c, ei: 0.5, flat: false }), 0.9, 4.2, 0);
    } else {
      put(grp, tG(new THREE.SphereGeometry(1.6, 12, 8, 0, TAU, 0, Math.PI / 2)), matS(0x66c8e0, { em: 0x2e8fae, ei: 0.5, flat: false }), 0, 1.2, 0);
      put(grp, tG(new THREE.SphereGeometry(0.5, 8, 6)), matS(nation.color, { em: 0xffffff, ei: 0.35 }), 0.8, 0.9, 0.7);
    }
    grp.scale.set(s, s, s); return grp;
  }
  function rebuildSlots(city) {
    if (city.slotGroup) city.model.remove(city.slotGroup);
    var sg = new THREE.Group(), types = ['house', 'factory', 'fun'];
    for (var i = 0; i < 3; i++) if (city.slots[i] > 0) {
      var v = slotVisual(types[i], city.slots[i], getNation(city.nation));
      v.position.set(SLOT_ANCHOR[i][0], 0.1, SLOT_ANCHOR[i][1]); sg.add(v);
    }
    city.slotGroup = sg; city.model.add(sg);
  }
  function buildCity(city) {
    var grp = new THREE.Group(), n = getNation(city.nation);
    put(grp, tG(new THREE.CylinderGeometry(7.5, 8.5, 1.3, 8)), matS(0x8f969d), 0, 0.65, 0);
    var hall = put(grp, tG(new THREE.CylinderGeometry(2.7, 3.5, 5, 8)), matS(n.color), 0, 4.2, 0);
    put(grp, tG(new THREE.ConeGeometry(3.5, 2.4, 8)), matS(0x3a4350), 0, 6.9, 0);
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * TAU;
      put(grp, tG(new THREE.BoxGeometry(2.4, 2.6, 1.0)), matS(0xaab0b6), Math.cos(a) * 10.2, 1.5, Math.sin(a) * 10.2, 0, -a);
      put(grp, tG(new THREE.BoxGeometry(2.1, 0.4, 0.55)), matS(0x6d747c), Math.cos(a) * 10.2, 2.9, Math.sin(a) * 10.2, 0, -a);
    }
    put(grp, tG(new THREE.CylinderGeometry(0.09, 0.09, 5, 6)), matS(0x3d444d, { met: 0.4 }), 0, 5.4, 0);
    var flag = flagMesh(n.color); flag.position.set(0, 6.6, 0); grp.add(flag);
    put(grp, tG(new THREE.CylinderGeometry(0.5, 0.7, 2.6, 8)), matS(0x5b646e, { met: 0.4 }), 7.5, 2.2, -7.5);
    put(grp, tG(new THREE.SphereGeometry(0.55, 8, 6)), matS(0xffd35a, { em: 0xffa020, ei: 0.8 }), 7.5, 3.7, -7.5);
    hall.userData.pick = { kind: 'city', ref: city }; pickMeshes.push(hall);
    var h = terrainHeight(city.x, city.z);
    grp.position.set(city.x, h, city.z);
    city.model = grp; city.turretPos = new THREE.Vector3(city.x + 7.5, h + 3.7, city.z - 7.5);
    root.add(grp); rebuildSlots(city);
    city.label = textSprite('', 30, '#fff', 30); city.label.position.y = 17; grp.add(city.label);
    redrawCityLabel(city);
    city.hpBar = hpBarMesh(city.hp / city.maxHp, 0x4dff6e); city.hpBar.position.y = 13.6; grp.add(city.hpBar);
    city.capBar = hpBarMesh(0, 0xffb23a); city.capBar.position.y = 13.0; city.capBar.visible = false; grp.add(city.capBar);
    city.turretCd = 0; city.warnAt = 0; city.prod = 0; city.queue = null;
    city.houses = city.slots[0]; city.factories = city.slots[1]; city.funs = city.slots[2];
  }
  function captureCity(city, nid, kind) {
    var oldN = city.nation;
    city.nation = nid; city.buyProg = 0; city.buyBy = null; city.faithProg = 0; city.faithBy = null;
    city.capBar.visible = false;
    if (kind === '军事') { city.hp = city.maxHp * 0.5; city.slots = city.slots.map(function (v) { return Math.max(0, v - 1); }); }
    else city.hp = Math.max(city.hp, city.maxHp * 0.6);
    city.happiness = kind === '军事' ? 50 : (kind === '收购' ? 80 : 85);
    rebuildSlots(city);
    var n = getNation(oldN), m = getNation(nid);
    if (n) n.cities = n.cities.filter(function (c) { return c !== city; });
    if (m) m.cities.push(city);
    redrawCityLabel(city);
    if (nid === PLAYER) {
      game.ui.toast('🎉 城市「' + city.name + '」已并入你的版图！', 'good');
      SP.Audio.play('colonize', 1);
      confetti(city.x, terrainHeight(city.x, city.z) + 8, city.z, m ? m.color : 0xffffff);
    } else if (oldN === PLAYER) {
      game.ui.toast('⚠ 城市「' + city.name + '」被 ' + nationName(nid) + ' 占领了！', 'bad');
      SP.Audio.play('hurt', 1);
    }
    updateProgress();
  }
  function cityUnderAttack(city) {
    if (city.nation === PLAYER && game.time - city.warnAt > 4) {
      city.warnAt = game.time;
      game.ui.toast('⚠ 城市「' + city.name + '」正遭受攻击！', 'warn');
      SP.Audio.play('shock', 0.8);
    }
  }

  /* ===== 六、载具 ===== */
  function nationColor(nid) { var n = getNation(nid); return n ? n.color : new THREE.Color(ARCH_COLOR.military); }
  function normalizeDesign(d) {
    if (!d) return { color: '#7fb8ff', parts: 2 };
    var color;
    if (typeof d.color === 'string') color = d.color;
    else if (d.colorHex) color = d.colorHex;
    else if (typeof d.h === 'number') {
      // 兼容宿主编辑器返回的 {h,s,l,style,bulk,wings,guns} 格式
      color = 'hsl(' + Math.round(d.h) + ',' + Math.round(d.s == null ? 70 : d.s) + '%,' + Math.round(d.l == null ? 55 : d.l) + '%)';
    } else color = '#7fb8ff';
    var parts = typeof d.parts === 'number' ? d.parts
      : typeof d.count === 'number' ? d.count
        : typeof d.wings === 'number' ? d.wings + 1 : 2;
    return { color: color, parts: clamp(Math.round(parts), 1, 4) };
  }
  function buildVehicle(type, variant, nid, design) {
    var grp = new THREE.Group(), i;
    var body = matS(design.color, { met: 0.15, r: 0.6 });
    var dark = matS(0x333a44, { met: 0.3 });
    var accent = matS(variant === 'm' ? 0xc8403a : variant === 'e' ? 0xf0b23a : 0x9a6fe0, { met: 0.5, em: variant === 'm' ? 0x602018 : variant === 'e' ? 0x805c10 : 0x4a3080, ei: 0.4 });
    if (type === 'land') {
      for (i = 0; i < design.parts * 2; i++) put(grp, tG(new THREE.CylinderGeometry(0.42, 0.42, 0.28, 10)), dark, (i % 2 === 0 ? -1 : 1) * 0.72, 0.42, [0.55, -0.55, 0.55, -0.55, 0.55, -0.55, 0.55, -0.55][i], 0, 0, Math.PI / 2);
      put(grp, tG(new THREE.BoxGeometry(2.7, 0.9, 1.5)), body, 0, 1.0, 0);
      if (variant === 'm') {
        put(grp, tG(new THREE.CylinderGeometry(0.5, 0.62, 0.7, 8)), accent, 0, 1.75, 0);
        put(grp, tG(new THREE.BoxGeometry(0.18, 0.18, 1.7)), dark, 0, 1.9, 0.95);
      } else if (variant === 'e') {
        put(grp, tG(new THREE.BoxGeometry(1.9, 1.1, 1.6)), accent, 0, 2.0, 0);
      } else {
        put(grp, tG(new THREE.SphereGeometry(0.55, 10, 8)), accent, 0, 2.2, 0);
        var g0 = glowSprite(1.8, 0xb79bff, 0.6); g0.position.y = 2.2; grp.add(g0);
      }
    } else if (type === 'sea') {
      put(grp, tG(new THREE.BoxGeometry(3.6, 1.2, 1.4)), body, 0, 0.6, 0);
      put(grp, tG(new THREE.ConeGeometry(0.6, 1.4, 4)), body, 0, 0.6, 2.3, -Math.PI / 2, Math.PI / 4);
      put(grp, tG(new THREE.BoxGeometry(1.4, 1.0, 1.0)), accent, 0, 1.7, -0.3);
      for (i = 0; i < design.parts; i++) put(grp, tG(new THREE.CylinderGeometry(0.14, 0.18, 1.2, 8)), dark, -0.8 + i * 0.8, 1.6, 0.8);
    } else {
      put(grp, tG(new THREE.BoxGeometry(1.3, 0.9, 3.2)), body, 0, 0, 0);
      put(grp, tG(new THREE.ConeGeometry(0.55, 1.3, 6)), body, 0, 0, 2.1, Math.PI / 2);
      put(grp, tG(new THREE.BoxGeometry(4.6, 0.14, 1.3)), accent, 0, -0.1, 0);
      put(grp, tG(new THREE.BoxGeometry(1.9, 0.1, 0.5)), dark, 0, 0.55, -1.5);
      for (i = 0; i < design.parts; i++) put(grp, tG(new THREE.SphereGeometry(0.3, 8, 6)), accent, -1.8 + i * 1.2, -0.45, 0.2);
    }
    var hp = hpBarMesh(1, 0x57ff7a);
    hp.position.y = type === 'air' ? 2.6 : 3.2; hp.visible = false; grp.add(hp);
    grp.userData.hp = hp;
    var ring = put(grp, tG(new THREE.TorusGeometry(1.7, 0.09, 6, 26)), matB(0x7dffa0, { t: true, op: 0.9, dw: false }), 0, 0.25, 0, Math.PI / 2);
    ring.visible = false; grp.userData.ring = ring;
    var pickM = put(grp, tG(new THREE.BoxGeometry(3, 2, 3)), matB(0xffffff, { t: true, op: 0 }), 0, 1, 0);
    pickM.userData.pick = { kind: 'unit', ref: null };
    return grp;
  }
  function vehicleBaseY(v) {
    if (v.type === 'air') return 14;
    if (v.type === 'sea') return 0.55;
    return Math.max(terrainHeight(v.x, v.z), SEA) + 0.95;
  }
  function placeVehicle(v) { v.model.position.set(v.x, vehicleBaseY(v), v.z); v.model.rotation.y = v.heading; }
  function spawnVehicle(nid, type, variant, x, z, design, hp) {
    var st = UNIT[type][variant];
    design = normalizeDesign(design);   // 统一涂装数据，兼容缺省与编辑器格式
    var v = {
      id: ++spawnVehicle.uid, nation: nid, type: type, variant: variant,
      hp: hp != null ? hp : st.hp, maxHp: st.hp,
      dmg: st.dmg * (getNation(nid).arch === 'military' ? 1.25 : 1),
      rate: st.rate, rng: st.rng, spd: st.spd * (variant === 'e' ? 1.15 : 1),
      cd: 0, design: design, x: x, z: z, heading: rand(0, TAU), command: null, target: null
    };
    v.model = buildVehicle(type, variant, nid, design);
    v.model.userData.vehicle = v;
    placeVehicle(v); root.add(v.model); vehicles.push(v);
    getNation(nid).vehicles.push(v);
    v.model.traverse(function (o) { if (o.userData.pick && o.userData.pick.kind === 'unit') { o.userData.pick.ref = v; pickMeshes.push(o); } });
    return v;
  }
  spawnVehicle.uid = 1;
  function destroyVehicle(v) {
    vehicles = vehicles.filter(function (o) { return o !== v; });
    var n = getNation(v.nation); if (n) n.vehicles = n.vehicles.filter(function (o) { return o !== v; });
    root.remove(v.model);
    explode(v.x, v.model.position.y, v.z, 2.2, nationColor(v.nation));
    v.model.traverse(function (o) { if (o.userData.pick && o.userData.pick.ref === v) pickMeshes = pickMeshes.filter(function (p) { return p !== o; }); });
    selected = selected.filter(function (o) { return o !== v; });
    SP.Audio.play('boom', 0.7);
  }

  /* ===== 七、选择与命令 ===== */
  function updateSelectionRings() { for (var i = 0; i < vehicles.length; i++) vehicles[i].model.userData.ring.visible = selected.indexOf(vehicles[i]) >= 0; }
  function selectOnly(v) { selected = v ? [v] : []; updateSelectionRings(); if (v) SP.Audio.play('ui_click', 0.8); }
  function pickAt(pt) {
    raycaster.setFromCamera(pt, game.camera);
    var hits = raycaster.intersectObjects(pickMeshes, false);
    for (var i = 0; i < hits.length; i++) { var p = hits[i].object.userData.pick; if (p && p.ref) return hits[i].object; }
    return null;
  }
  function groundPointAt(pt) {
    raycaster.setFromCamera(pt, game.camera);
    var hits = raycaster.intersectObject(terrainMesh, false);
    return hits.length ? { x: hits[0].point.x, z: hits[0].point.z } : null;
  }
  function refreshHover() {
    var hit = pickAt(ndc);
    var target = hit ? hit.userData.pick.ref : null;
    if (target === hovered) return;
    if (hovered && hovered.model) hovered.model.traverse(function (o) { if (o.isMesh && o.material && o.material.emissive) o.material.emissiveIntensity = 0; });
    hovered = target;
    if (hovered && hovered.model) {
      hovered.model.traverse(function (o) { if (o.isMesh && o.material && o.material.emissive) o.material.emissiveIntensity = 0.5; });
      SP.Audio.play('ui_hover', 0.5);
    }
  }
  function issueMove(list, x, z) {
    for (var i = 0; i < list.length; i++) list[i].command = { kind: 'move', x: x, z: z };
    SP.Audio.play('step', 0.6);
    spawnMarker(x, z);
  }
  function issueAttackUnit(list, t) { for (var i = 0; i < list.length; i++) { list[i].command = { kind: 'attackUnit', target: t }; list[i].target = t; } SP.Audio.play('spear_throw', 0.6); }
  function issueAttackCity(list, c) { for (var i = 0; i < list.length; i++) list[i].command = { kind: 'attackCity', target: c }; SP.Audio.play('spear_throw', 0.6); }
  function spawnMarker(x, z) {
    var m = new THREE.Mesh(tG(new THREE.OctahedronGeometry(0.6)), matB(0x7dffa0, { t: true, op: 0.9 }));
    m.position.set(x, Math.max(terrainHeight(x, z), SEA) + 0.8, z);
    root.add(m); markers.push({ mesh: m, t: 0, life: 0.7 });
  }
  function ensureWar(a, b) {
    if (atWar(a, b) || isAlly(a, b)) return;
    var na = getNation(a), nb = getNation(b);
    na.wars.push(b); nb.wars.push(a);
    na.relations[b] = Math.max(-100, (na.relations[b] || 0) - 50);
    nb.relations[a] = Math.max(-100, (nb.relations[a] || 0) - 50);
    if (a === PLAYER || b === PLAYER) { game.ui.toast('⚔ 战争爆发：' + nationName(a) + ' × ' + nationName(b), 'warn'); SP.Audio.play('shock', 1); }
  }
  function onLeftClick() {
    var hit = pickAt(ndc);
    if (!hit) { selectOnly(null); return; }
    var p = hit.userData.pick, ref = p.ref;
    if (p.kind === 'unit') {
      if (ref.nation === PLAYER) {
        if (selected.length === 1 && selected[0] === ref) selectOnly(null);
        else selectOnly(ref);
      } else {
        game.ui.toast('敌方载具：' + BRANCH[ref.type] + '·' + VARNAME[ref.variant], 'warn');
      }
    } else if (p.kind === 'city') {
      if (ref.nation === PLAYER) openCityPanel(ref);
      else game.ui.toast('敌方城市「' + ref.name + '」（' + nationName(ref.nation) + '）', 'warn');
    } else if (p.kind === 'geyser') {
      if (ref.rig) {
        game.ui.toast(ref.owner === PLAYER ? '你的香料钻井：+' + RIG_RATE + ' 香料/秒' : '敌方香料钻井（' + nationName(ref.owner) + '）', ref.owner === PLAYER ? 'good' : 'warn');
      } else if (ref.owner == null) {
        SP.Audio.play('ui_open', 0.6);
        game.ui.dialog({
          title: '香料喷口', body: '在此建造香料钻井？花费 ' + RIG_COST + ' 香料币，持续产出香料。<br>（香料是唯一货币）',
          buttons: [
            { label: '建造', cb: function () { game.ui.closeDialog(); if (spendMoney(PLAYER, RIG_COST)) { buildRigFor(ref, PLAYER); getNation(PLAYER).rigs.push(ref); SP.Audio.play('build', 1); game.ui.toast('香料钻井建造完成！', 'good'); } else { SP.Audio.play('deny', 1); game.ui.toast('香料不足！', 'bad'); } } },
            { label: '取消', cb: function () { game.ui.closeDialog(); SP.Audio.play('ui_close', 0.6); } }
          ]
        });
      }
    } else if (p.kind === 'rig' && ref.owner === PLAYER) {
      game.ui.toast('香料钻井：+' + RIG_RATE + ' 香料/秒', 'good');
    }
  }
  function onRightClick() {
    if (selected.length === 0) return;
    var hit = pickAt(ndc);
    if (hit) {
      var p = hit.userData.pick, ref = p.ref;
      if (p.kind === 'unit' && ref.nation !== PLAYER && !isAlly(PLAYER, ref.nation)) { ensureWar(PLAYER, ref.nation); issueAttackUnit(selected, ref); return; }
      if (p.kind === 'city' && ref.nation !== PLAYER && !isAlly(PLAYER, ref.nation)) { ensureWar(PLAYER, ref.nation); issueAttackCity(selected, ref); return; }
      if (p.kind === 'rig' && ref.owner != null && ref.owner !== PLAYER && !isAlly(PLAYER, ref.owner)) { ensureWar(PLAYER, ref.owner); issueAttackUnit(selected, ref); return; }
    }
    var g = groundPointAt(ndc);
    if (g) issueMove(selected, g.x, g.z);
  }

  /* ===== 八、战斗 ===== */
  function addFloat(x, y, z, text, color) {
    var s = textSprite(text, 3.4, color || '#fff', 36);
    s.position.set(x, y, z); root.add(s);
    floats.push({ sprite: s, t: 0, life: 0.9 });
    if (floats.length > 40) { var old = floats.shift(); root.remove(old.sprite); old.sprite.material.map.dispose(); }
  }
  function damageUnit(v, dmg, attacker) {
    if (v.hp <= 0) return; // 已销毁（防空投弹重复命中）
    v.hp -= dmg;
    addFloat(v.x, v.model.position.y + 2.6, v.z, String(Math.round(dmg)), '#ffd75a');
    v.model.userData.hp.visible = true;
    setFill(v.model.userData.hp, v.hp / v.maxHp);
    if (v.hp <= 0) destroyVehicle(v);
  }
  function damageCity(c, dmg, nid) {
    c.hp -= dmg;
    setFill(c.hpBar, c.hp / c.maxHp);
    addFloat(c.x, terrainHeight(c.x, c.z) + 12, c.z, '-' + String(Math.round(dmg)), '#ff7a5a');
    cityUnderAttack(c);
    if (c.hp <= 0) { c.hp = 0; captureCity(c, nid, '军事'); }
  }
  function fireProjectile(v, target, dmg, color) {
    var p = { x: v.x, y: v.model.position.y + 1.4, z: v.z, target: target, dmg: dmg, spd: 48, color: color, life: 3, attacker: v.nation };
    p.mesh = new THREE.Mesh(tG(new THREE.OctahedronGeometry(0.22)), matB(color, { t: true }));
    root.add(p.mesh); projectiles.push(p);
  }
  function updateProjectiles(dt) {
    for (var i = projectiles.length - 1; i >= 0; i--) {
      var p = projectiles[i];
      p.life -= dt;
      if (p.life <= 0 || !p.target) { root.remove(p.mesh); projectiles.splice(i, 1); continue; }
      var t = p.target;
      var tx, ty, tz;
      if (t.kind === 'city') { tx = t.x; ty = terrainHeight(t.x, t.z) + 4; tz = t.z; }
      else if (t.kind === 'rig') { tx = t.x; ty = terrainHeight(t.x, t.z) + 4; tz = t.z; }
      else { tx = t.x; ty = t.model.position.y + 1; tz = t.z; }
      var dx = tx - p.x, dy = ty - p.y, dz = tz - p.z;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      var step = p.spd * dt;
      if (d <= step || d < 1.4) {
        if (t.kind === 'city') damageCity(t, p.dmg, p.attacker);
        else if (t.kind === 'rig') {
          t.hp -= p.dmg;
          t.model.userData.hp.visible = true;
          setFill(t.model.userData.hp, t.hp / RIG_HP);
          if (t.hp <= 0) {
            var own = t.owner;
            root.remove(t.model);
            t.rig = null; t.owner = null; t.nation = null;
            if (own != null) { var on = getNation(own); if (on) on.rigs = on.rigs.filter(function (r) { return r !== t; }); }
            t.tip && (t.tip.visible = true);
            explode(t.x, terrainHeight(t.x, t.z) + 3, t.z, 2, 0xffb23a);
            game.ui.toast('敌方香料钻井被摧毁！', 'good');
          }
        } else damageUnit(t, p.dmg, p.attacker);
        smallBurst(tx, ty, tz, p.color);
        root.remove(p.mesh); projectiles.splice(i, 1);
      } else {
        p.x += dx / d * step; p.y += dy / d * step; p.z += dz / d * step;
        p.mesh.position.set(p.x, p.y, p.z);
      }
    }
  }
  function smallBurst(x, y, z, color) {
    for (var i = 0; i < 4; i++) {
      var m = new THREE.Mesh(tG(new THREE.OctahedronGeometry(0.16)), matB(color, { t: true, op: 1 }));
      m.position.set(x, y, z); root.add(m);
      particles.push({ mesh: m, vel: new THREE.Vector3(rand(-2.5, 2.5), rand(1, 4), rand(-2.5, 2.5)), life: 0.35, max: 0.35, spin: rand(-6, 6) });
    }
  }
  function explode(x, y, z, scale, color) {
    var flash = glowSprite(scale * 8, 0xffcc66, 0.9);
    flash.position.set(x, y, z); root.add(flash);
    particles.push({ mesh: flash, vel: new THREE.Vector3(0, 0, 0), life: 0.3, max: 0.3, spin: 0, fadeSprite: true });
    var ring = new THREE.Mesh(tG(new THREE.TorusGeometry(1, 0.35, 8, 30)), matB(0xffb23a, { t: true, op: 0.85 }));
    ring.rotation.x = Math.PI / 2; ring.position.set(x, y, z); root.add(ring);
    particles.push({ mesh: ring, vel: new THREE.Vector3(0, 0, 0), life: 0.5, max: 0.5, spin: 0, grow: scale * 14 });
    for (var i = 0; i < 12; i++) {
      var m = new THREE.Mesh(tG(new THREE.OctahedronGeometry(0.22 * scale)), matB(color || 0xff8833, { t: true, op: 1 }));
      m.position.set(x, y, z); root.add(m);
      particles.push({ mesh: m, vel: new THREE.Vector3(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).normalize().multiplyScalar(rand(4, 10) * scale), life: 0.7, max: 0.7, spin: rand(-10, 10) });
    }
    SP.Audio.play('boom', clamp(0.5 + scale * 0.12, 0.5, 1.2));
  }
  function confetti(x, y, z, color) {
    for (var i = 0; i < 16; i++) {
      var m = new THREE.Mesh(tG(new THREE.OctahedronGeometry(0.3)), matB(color || 0xffffff, { t: true, op: 1 }));
      m.position.set(x + rand(-2, 2), y + rand(0, 3), z + rand(-2, 2)); root.add(m);
      particles.push({ mesh: m, vel: new THREE.Vector3(rand(-6, 6), rand(4, 9), rand(-6, 6)), life: 1.2, max: 1.2, spin: rand(-12, 12) });
    }
    SP.Audio.play('levelup', 1);
  }
  function updateFx(dt) {
    var i, p;
    for (i = markers.length - 1; i >= 0; i--) {
      var mk = markers[i];
      mk.t += dt; mk.mesh.position.y += dt * 1.6;
      mk.mesh.material.opacity = 1 - mk.t / mk.life;
      if (mk.t >= mk.life) { root.remove(mk.mesh); markers.splice(i, 1); }
    }
    for (i = floats.length - 1; i >= 0; i--) {
      var f = floats[i];
      f.t += dt; f.sprite.position.y += dt * 3.2;
      f.sprite.material.opacity = 1 - f.t / f.life;
      if (f.t >= f.life) { root.remove(f.sprite); f.sprite.material.map.dispose(); floats.splice(i, 1); }
    }
    for (i = particles.length - 1; i >= 0; i--) {
      p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { root.remove(p.mesh); particles.splice(i, 1); continue; }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 9 * dt;
      p.mesh.rotation.x += p.spin * dt; p.mesh.rotation.z += p.spin * dt * 0.7;
      var k = p.life / p.max;
      if (p.grow) { var s = (1 - k) * p.grow + 1; p.mesh.scale.set(s, s, s); p.mesh.material.opacity = k * 0.85; }
      else if (p.fadeSprite || !p.mesh.material.transparent) { p.mesh.material.opacity = k * 0.9; }
      else p.mesh.material.opacity = k;
    }
  }
  function moveToward(v, tx, tz, dt) {
    var dx = tx - v.x, dz = tz - v.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.01) return;
    var step = Math.min(v.spd * dt, d);
    v.x += dx / d * step; v.z += dz / d * step;
    var h = Math.atan2(dx, dz), dh = h - v.heading;
    while (dh > Math.PI) dh -= TAU;
    while (dh < -Math.PI) dh += TAU;
    v.heading += dh * 0.15;
    placeVehicle(v);
  }
  function faceToward(v, dx, dz) {
    var h = Math.atan2(dx, dz), dh = h - v.heading;
    while (dh > Math.PI) dh -= TAU;
    while (dh < -Math.PI) dh += TAU;
    v.heading += dh * 0.15;
    v.model.rotation.y = v.heading;
  }
  function captorsNear(c, variant, field) {
    var n = 0;
    for (var i = 0; i < vehicles.length; i++) {
      var v = vehicles[i];
      if (v.nation === c[field] && v.variant === variant && v.command && v.command.kind === 'attackCity' && v.command.target === c) n++;
    }
    return n;
  }
  function findEnemyNear(nid, x, z, r) {
    var best = null, bd = r * r;
    for (var i = 0; i < vehicles.length; i++) {
      var v = vehicles[i];
      if (v.nation === nid || isAlly(nid, v.nation)) continue;
      var dx = v.x - x, dz = v.z - z, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }
  function updateCombat(dt) {
    for (var i = 0; i < vehicles.length; i++) {
      var v = vehicles[i];
      v.cd -= dt;
      var cmd = v.command;
      if (!cmd) { /* 无命令：AI 防守在 aiThink 处理 */ }
      else if (cmd.kind === 'move') {
        var mdx = cmd.x - v.x, mdz = cmd.z - v.z;
        if (Math.sqrt(mdx * mdx + mdz * mdz) < 1.6) v.command = null;
        else moveToward(v, cmd.x, cmd.z, dt);
      } else if (cmd.kind === 'attackUnit' && cmd.target) {
        var t = cmd.target;
        if (t.hp <= 0 || t.nation === v.nation || isAlly(v.nation, t.nation)) { v.command = null; continue; }
        var dx = t.x - v.x, dz = t.z - v.z, d = Math.sqrt(dx * dx + dz * dz);
        if (d > v.rng + 1) moveToward(v, t.x, t.z, dt);
        else {
          faceToward(v, dx, dz);
          if (v.cd <= 0) { v.cd = v.rate; fireProjectile(v, t, v.dmg, v.variant === 'm' ? 0xff9d4d : v.variant === 'e' ? 0x7fd0ff : 0xc9a8ff); SP.Audio.play(v.type === 'air' ? 'warp' : 'spear_throw', 0.3); }
        }
      } else if (cmd.kind === 'attackCity' && cmd.target) {
        var c = cmd.target;
        if (c.nation === v.nation || isAlly(v.nation, c.nation)) { v.command = null; continue; }
        var dxc = c.x - v.x, dzc = c.z - v.z, dc = Math.sqrt(dxc * dxc + dzc * dzc);
        var n = getNation(v.nation);
        if (dc > 26) moveToward(v, c.x, c.z, dt);
        else {
          faceToward(v, dxc, dzc);
          if (v.variant === 'm' || (n && n.arch === 'military')) {
            if (v.cd <= 0) { v.cd = v.rate; fireProjectile(v, c, v.dmg, 0xff9d4d); SP.Audio.play('laser', 0.3); }
          } else if (v.variant === 'e' && n && n.arch === 'economic') {
            c.buyBy = v.nation;
            c.buyProg = (c.buyProg || 0) + 3.2 * dt * (1 + captorsNear(c, 'e', 'buyBy') * 0.5);
            c.capBar.visible = true; c.capBar.userData.fill.material.color.set(0xffb23a); setFill(c.capBar, c.buyProg / 100);
            if (c.buyProg >= 100) {
              c.buyProg = 0;
              if (spendMoney(v.nation, BUY_COST)) { captureCity(c, v.nation, '收购'); SP.Audio.play('spice', 1); }
              else { c.capBar.visible = false; if (v.nation === PLAYER) game.ui.toast('香料不足，无法收购「' + c.name + '」', 'warn'); }
            }
          } else if (v.variant === 'r' && n && n.arch === 'religious') {
            c.faithBy = v.nation;
            var happy = cityHappiness(c);
            c.faithProg = (c.faithProg || 0) + FAITH_RATE * dt * (1 + (100 - happy) / 100) * (1 + captorsNear(c, 'r', 'faithBy') * 0.5);
            c.capBar.visible = true; c.capBar.userData.fill.material.color.set(0xb79bff); setFill(c.capBar, c.faithProg / 100);
            if (chance(0.02)) SP.Audio.play('sing', 0.4);
            if (c.faithProg >= 100) { c.faithProg = 0; captureCity(c, v.nation, '转化'); SP.Audio.play('dna', 1); }
          }
        }
      }
    }
  }
  function updateTurrets(dt) {
    for (var i = 0; i < cities.length; i++) {
      var c = cities[i];
      c.turretCd -= dt;
      if (c.turretCd > 0) continue;
      var best = null, bd = 45 * 45;
      for (var j = 0; j < vehicles.length; j++) { var v = vehicles[j]; if (v.nation === c.nation || isAlly(c.nation, v.nation)) continue; var dx = v.x - c.x, dz = v.z - c.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = v; } }
      if (best) {
        c.turretCd = 1.6;
        var p = { x: c.turretPos.x, y: c.turretPos.y, z: c.turretPos.z, target: best, dmg: 9, spd: 40, color: 0xffe9a0, attacker: c.nation, life: 3 };
        p.mesh = new THREE.Mesh(tG(new THREE.SphereGeometry(0.18, 6, 5)), matB(0xffe9a0, { t: true }));
        root.add(p.mesh); projectiles.push(p);
      }
    }
  }

  /* ===== 九、AI 与外交 ===== */
  function aiSpawn(n) {
    var pool = n.arch === 'military' ? [['land', 'm'], ['sea', 'm'], ['air', 'm']] : n.arch === 'economic' ? [['land', 'e'], ['sea', 'e'], ['air', 'e'], ['land', 'm']] : [['land', 'r'], ['sea', 'r'], ['air', 'r'], ['land', 'm']];
    var sel = choice(pool), st = UNIT[sel[0]][sel[1]];
    var cost = st.cost * (n.arch === 'economic' ? 0.8 : 1);
    if (n.money < cost || !n.cities.length) return;
    n.money -= cost;
    var city = choice(n.cities), a = rand(0, TAU);
    var v = spawnVehicle(n.id, sel[0], sel[1], city.x + Math.cos(a) * 8, city.z + Math.sin(a) * 8);
    v.squad = false;
  }
  function nearestGeyser(n) {
    var best = null, bd = 90 * 90;
    for (var i = 0; i < geysers.length; i++) {
      var g = geysers[i];
      if (g.rig) continue;
      for (var j = 0; j < n.cities.length; j++) {
        var c = n.cities[j], dx = g.x - c.x, dz = g.z - c.z, d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = g; }
      }
    }
    return best;
  }
  function pickWarTarget(n) {
    var best = null, bd = 1e9, home = n.cities.length ? n.cities[0] : null;
    for (var i = 0; i < cities.length; i++) {
      var c = cities[i];
      if (c.nation === n.id || isAlly(n.id, c.nation)) continue;
      var dx = home ? c.x - home.x : 0, dz = home ? c.z - home.z : 0, d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  function proposeAlliance(n) {
    SP.Audio.play('mission_ok', 0.7);
    game.ui.dialog({
      title: '🤝 外交提议', body: n.name + ' 提议与你结为盟友，共同进退。是否接受？',
      buttons: [
        { label: '接受结盟', cb: function () { game.ui.closeDialog(); getNation(PLAYER).allies.push(n.id); n.allies.push(PLAYER); n.relations[PLAYER] = 80; getNation(PLAYER).relations[n.id] = 80; SP.Audio.play('social_ok', 1); game.ui.toast('🤝 与 ' + n.name + ' 结盟成功！', 'good'); } },
        { label: '婉拒', cb: function () { game.ui.closeDialog(); n.relations[PLAYER] = Math.max(-30, (n.relations[PLAYER] || 0) - 10); SP.Audio.play('social_fail', 0.8); } }
      ]
    });
  }
  function aiThink(dt) {
    aiTimer -= dt;
    if (aiTimer > 0) return;
    aiTimer = 0.55;
    diploTimer -= 0.55;
    var i, n, j, k, q;
    for (i = 1; i < nations.length; i++) {
      n = nations[i];
      // 建钻井
      if (n.money > RIG_COST + 100 && n.rigs.length < 4 && chance(0.25)) {
        var g = nearestGeyser(n);
        if (g) { n.money -= RIG_COST; buildRigFor(g, n.id); n.rigs.push(g); SP.Audio.play('build', 0.5); }
      }
      // 生产
      if (n.vehicles.length < 14 && chance(0.5)) aiSpawn(n);
      // 战争目标与进攻波次
      if (n.wars.length) {
        var target = n.warTarget;
        if (!target || target.nation === n.id || isAlly(n.id, target.nation) || target.hp <= 0) { target = pickWarTarget(n); n.warTarget = target; }
        if (target) {
          var sent = 0;
          for (j = 0; j < n.vehicles.length && sent < 6; j++) { var v = n.vehicles[j]; if (!v.command) { v.squad = true; v.command = { kind: 'attackCity', target: target }; sent++; } }
          if (sent >= 6) n.warTarget = null;
        }
      }
      // 防守
      for (k = 0; k < n.vehicles.length; k++) {
        var dv = n.vehicles[k];
        if (dv.command) continue;
        var near = false;
        for (q = 0; q < n.cities.length; q++) { var cc = n.cities[q]; if ((cc.x - dv.x) * (cc.x - dv.x) + (cc.z - dv.z) * (cc.z - dv.z) < 42 * 42) { near = true; break; } }
        if (near) { var e = findEnemyNear(n.id, dv.x, dv.z, 30); if (e) { dv.command = { kind: 'attackUnit', target: e }; dv.target = e; } }
      }
    }
    // 外交事件
    if (diploTimer <= 0) {
      diploTimer = 9;
      for (i = 1; i < nations.length; i++) {
        n = nations[i];
        var r = n.relations[PLAYER] || 0;
        n.relations[PLAYER] = clamp(r + rand(-6, 6), -100, 100);
        if (r < -30 && !atWar(n.id, PLAYER) && !isAlly(n.id, PLAYER) && chance(0.4)) ensureWar(n.id, PLAYER);
        if (r > 50 && !atWar(n.id, PLAYER) && !isAlly(n.id, PLAYER) && chance(0.5)) proposeAlliance(n);
        if (n.arch === 'economic' && r > 10 && n.trade.indexOf(PLAYER) < 0 && !atWar(n.id, PLAYER) && chance(0.6)) {
          n.trade.push(PLAYER);
          if (chance(0.3)) game.ui.toast('💼 ' + n.name + ' 提出与你建立贸易路线', 'good');
        }
      }
    }
  }
  function openDiplomacy() {
    if (nations.length < 2) return;
    var n = nations[diploIdx % nations.length];
    if (n.id === PLAYER) { diploIdx = (diploIdx + 1) % nations.length; n = nations[diploIdx % nations.length]; }
    var r = n.relations[PLAYER] || 0;
    var state = atWar(n.id, PLAYER) ? '<span style="color:#ff6a5a">⚔ 交战中</span>' : isAlly(n.id, PLAYER) ? '<span style="color:#7dffa0">🤝 盟友</span>' : '和平';
    var body = '<b>' + n.name + '</b>（' + ARCHN[n.arch] + '原型）<br>关系值：' + Math.round(r) + '　状态：' + state +
      '<br>城市 ' + n.cities.length + ' 座 · 载具 ' + n.vehicles.length + ' 辆' +
      (n.trade.indexOf(PLAYER) >= 0 ? '<br><span style="color:#f0b23a">💼 贸易路线已建立</span>' : '');
    SP.Audio.play('ui_open', 0.6);
    game.ui.dialog({
      title: '🌐 外交面板', body: body,
      buttons: [
        { label: '切换国家', cb: function () { game.ui.closeDialog(); diploIdx++; openDiplomacy(); } },
        { label: '🤝 结盟', cb: function () {
          game.ui.closeDialog();
          if (isAlly(PLAYER, n.id)) game.ui.toast('已是盟友', 'warn');
          else if (atWar(PLAYER, n.id)) game.ui.toast('交战中无法结盟，请先停战', 'warn');
          else if (r < 30) { game.ui.toast('关系不足（需 30）', 'warn'); SP.Audio.play('deny', 1); }
          else { getNation(PLAYER).allies.push(n.id); n.allies.push(PLAYER); n.relations[PLAYER] = 80; getNation(PLAYER).relations[n.id] = 80; SP.Audio.play('mission_ok', 1); game.ui.toast('🤝 与 ' + n.name + ' 结盟！', 'good'); }
          openDiplomacy();
        } },
        { label: '💼 贸易', cb: function () {
          game.ui.closeDialog();
          if (atWar(PLAYER, n.id)) game.ui.toast('交战中无法贸易', 'warn');
          else if (n.trade.indexOf(PLAYER) >= 0) game.ui.toast('贸易路线已存在', 'warn');
          else { n.trade.push(PLAYER); getNation(PLAYER).trade.push(n.id); SP.Audio.play('spice', 1); game.ui.toast('💼 贸易路线建立，双方收入增加！', 'good'); }
          openDiplomacy();
        } },
        { label: '⚔ 宣战', cb: function () { game.ui.closeDialog(); ensureWar(PLAYER, n.id); openDiplomacy(); } },
        { label: '☮ 停战', cb: function () {
          game.ui.closeDialog();
          if (atWar(PLAYER, n.id)) {
            getNation(PLAYER).wars = getNation(PLAYER).wars.filter(function (x) { return x !== n.id; });
            n.wars = n.wars.filter(function (x) { return x !== PLAYER; });
            getNation(PLAYER).relations[n.id] = clamp((getNation(PLAYER).relations[n.id] || 0) + 30, -100, 100);
            n.relations[PLAYER] = clamp((n.relations[PLAYER] || 0) + 30, -100, 100);
            SP.Audio.play('social_ok', 1); game.ui.toast('☮ 与 ' + n.name + ' 停战', 'good');
          } else game.ui.toast('当前并非交战状态', 'warn');
          openDiplomacy();
        } },
        { label: '关闭', cb: function () { game.ui.closeDialog(); SP.Audio.play('ui_close', 0.6); } }
      ]
    });
  }

  /* ===== 十、超级武器 ===== */
  function armSuperWeapon() {
    var arch = getNation(PLAYER).arch;
    var weapons = {
      military: { name: '💣 毁灭炸弹', cost: 400, desc: '重创目标区域敌军与城市' },
      economic: { name: '💸 贪婪射线', cost: 300, desc: '直接收购目标敌方城市（60% 价格）' },
      religious: { name: '☁ 快乐之云', cost: 450, desc: '转化云下敌方城市并治疗友军' }
    };
    var w = weapons[arch];
    if (!superUnlocked) { game.ui.toast('超级武器未解锁：需控制 6 座城市', 'warn'); SP.Audio.play('deny', 1); return; }
    if (armedWeapon) { armedWeapon = null; game.ui.toast('已取消超级武器', 'warn'); return; }
    if (!spendMoney(PLAYER, w.cost)) { game.ui.toast('香料不足（需要 ' + w.cost + '）', 'bad'); SP.Audio.play('deny', 1); return; }
    armedWeapon = { arch: arch, name: w.name };
    game.ui.toast('🔫 ' + w.name + ' 已激活！点击地图释放', 'good');
    SP.Audio.play('epic_roar', 1);
  }
  function beamFromSky(x, y, z, color) {
    var h = 70 - y;
    var beam = new THREE.Mesh(tG(new THREE.CylinderGeometry(1.4, 2.4, h, 10)), matB(color, { t: true, op: 0.8, dw: false }));
    beam.position.set(x, y + h / 2, z); root.add(beam);
    particles.push({ mesh: beam, vel: new THREE.Vector3(0, 0, 0), life: 0.9, max: 0.9, spin: 0, fadeSprite: true });
  }
  function fireSuperWeapon(gx, gz) {
    if (!armedWeapon) return;
    var aw = armedWeapon, i;
    armedWeapon = null;
    if (aw.arch === 'military') {
      explode(gx, terrainHeight(gx, gz) + 2, gz, 4, 0xff6633);
      cam.shake = 0.6;
      for (i = vehicles.length - 1; i >= 0; i--) { var v = vehicles[i]; if (!isAlly(PLAYER, v.nation) && (v.x - gx) * (v.x - gx) + (v.z - gz) * (v.z - gz) < 30 * 30) damageUnit(v, 260, PLAYER); }
      for (i = 0; i < cities.length; i++) { var c = cities[i]; if (c.nation !== PLAYER && !isAlly(PLAYER, c.nation) && (c.x - gx) * (c.x - gx) + (c.z - gz) * (c.z - gz) < 30 * 30) damageCity(c, 190, PLAYER); }
      game.ui.toast('💣 毁灭炸弹！', 'good');
    } else if (aw.arch === 'economic') {
      var target = null;
      for (i = 0; i < cities.length; i++) {
        var cc = cities[i];
        if (cc.nation !== PLAYER && !isAlly(PLAYER, cc.nation) && (cc.x - gx) * (cc.x - gx) + (cc.z - gz) * (cc.z - gz) < 22 * 22) { target = cc; break; }
      }
      if (!target) { game.ui.toast('贪婪射线需要瞄准敌方城市！', 'warn'); return; }
      beamFromSky(target.x, terrainHeight(target.x, target.z) + 4, target.z, 0xffd75a);
      if (spendMoney(PLAYER, Math.round(BUY_COST * 0.6))) { captureCity(target, PLAYER, '收购'); game.ui.toast('💸 贪婪射线收购了「' + target.name + '」！', 'good'); }
      else game.ui.toast('香料不足，收购失败', 'bad');
    } else {
      var cloud = new THREE.Sprite(tM(new THREE.SpriteMaterial({ map: SP.Tex.cloud(), transparent: true, opacity: 0.85, depthWrite: false })));
      cloud.scale.set(34, 22, 1); cloud.position.set(gx, 20, gz); root.add(cloud);
      particles.push({ mesh: cloud, vel: new THREE.Vector3(0, 0, 0), life: 6, max: 6, spin: 0, fadeSprite: true });
      for (i = 0; i < cities.length; i++) {
        var c2 = cities[i];
        if ((c2.x - gx) * (c2.x - gx) + (c2.z - gz) * (c2.z - gz) < 45 * 45 && c2.nation !== PLAYER && !isAlly(PLAYER, c2.nation)) {
          c2.faithBy = PLAYER;
          c2.faithProg = Math.min(100, (c2.faithProg || 0) + 30);
        }
      }
      for (i = 0; i < vehicles.length; i++) {
        var hv = vehicles[i];
        if (isAlly(PLAYER, hv.nation) && (hv.x - gx) * (hv.x - gx) + (hv.z - gz) * (hv.z - gz) < 45 * 45) {
          hv.hp = Math.min(hv.maxHp, hv.hp + 50);
          setFill(hv.model.userData.hp, hv.hp / hv.maxHp);
        }
      }
      game.ui.toast('☁ 快乐之云降临！', 'good');
    }
    SP.Audio.play('terraform', 1);
    updateHud();
  }

  /* ===== 城市面板与生产 ===== */
  function slotCost(type, lv) { var base = type === 'house' ? 100 : type === 'factory' ? 130 : 110; return Math.round(base * (1 + lv * 0.7)); }
  function openCityPanel(city) {
    if (city.nation !== PLAYER) return;
    SP.Audio.play('ui_open', 0.6);
    var happy = cityHappiness(city);
    var body = '<b>城市「' + city.name + '」</b><br>生命 ' + Math.round(city.hp) + '/' + city.maxHp + '　幸福 ' + happy + '　人口 ' + (1 + city.slots[0]) +
      '<br>收入 +' + cityIncome(city) + '/秒　产能 ' + (1 + city.slots[1]) + '/秒' +
      (city.queue ? '　队列：' + BRANCH[city.queue.type] + VARNAME[city.queue.variant] + ' ' + Math.round(city.prod) + '/' + city.queue.prod : '') +
      '<br><span style="color:#8a93a0">住宅↑收入 · 工厂↑产能 · 娱乐↑幸福</span>';
    game.ui.dialog({
      title: '🏙 城市管理', body: body,
      buttons: [
        { label: '🏠 住宅 Lv' + city.slots[0] + (city.slots[0] < 3 ? '（' + slotCost('house', city.slots[0]) + '）' : ' 已满'), cb: buildSlotCb(city, 'house') },
        { label: '🏭 工厂 Lv' + city.slots[1] + (city.slots[1] < 3 ? '（' + slotCost('factory', city.slots[1]) + '）' : ' 已满'), cb: buildSlotCb(city, 'factory') },
        { label: '🎪 娱乐 Lv' + city.slots[2] + (city.slots[2] < 3 ? '（' + slotCost('fun', city.slots[2]) + '）' : ' 已满'), cb: buildSlotCb(city, 'fun') },
        { label: '🚚 生产载具', cb: function () { game.ui.closeDialog(); openProducePanel(city); } },
        { label: '🔧 外观编辑器', cb: function () { game.ui.closeDialog(); game.ui.openEditor('city', function (design) { playerDesign = normalizeDesign(design); SP.Audio.play('craft', 1); game.ui.toast('载具设计已保存！', 'good'); openCityPanel(city); }); } },
        { label: '关闭', cb: function () { game.ui.closeDialog(); SP.Audio.play('ui_close', 0.6); } }
      ]
    });
  }
  function buildSlotCb(city, type) {
    return function () {
      var idx = type === 'house' ? 0 : type === 'factory' ? 1 : 2;
      var lv = city.slots[idx];
      if (lv >= 3) { game.ui.toast('该建筑已满级', 'warn'); return; }
      var cost = slotCost(type, lv);
      game.ui.closeDialog();
      if (spendMoney(PLAYER, cost)) {
        city.slots[idx]++; city.houses = city.slots[0]; city.factories = city.slots[1]; city.funs = city.slots[2];
        rebuildSlots(city); SP.Audio.play('build', 1);
        game.ui.toast(SLOT_LABEL[idx] + '升级至 Lv' + city.slots[idx], 'good');
      } else { SP.Audio.play('deny', 1); game.ui.toast('香料不足！', 'bad'); }
      openCityPanel(city);
    };
  }
  function openProducePanel(city) {
    var btns = [], branches = ['land', 'sea', 'air'], variants = ['m', 'e', 'r'];
    for (var i = 0; i < branches.length; i++) for (var j = 0; j < variants.length; j++) (function (b, va) {
      var st = UNIT[b][va];
      var cost = Math.round(st.cost * (getNation(PLAYER).arch === 'economic' ? 0.8 : 1));
      btns.push({
        label: BRANCH[b] + '·' + VARNAME[va] + ' ' + st.label + '（' + cost + '）',
        cb: function () {
          game.ui.closeDialog();
          if (city.queue) { game.ui.toast('该城市已有生产队列', 'warn'); openProducePanel(city); return; }
          if (!spendMoney(PLAYER, cost)) { game.ui.toast('香料不足！', 'bad'); SP.Audio.play('deny', 1); return; }
          var queueIt = function () { city.queue = { type: b, variant: va, cost: cost, prod: st.prod, design: playerDesign }; SP.Audio.play('craft', 1); game.ui.toast('已开始生产 ' + BRANCH[b] + VARNAME[va] + st.label, 'good'); };
          if (!playerDesign) game.ui.openEditor('city', function (d) { playerDesign = normalizeDesign(d); queueIt(); }); else queueIt();
        }
      });
    })(branches[i], variants[j]);
    btns.push({ label: '关闭', cb: function () { game.ui.closeDialog(); SP.Audio.play('ui_close', 0.6); } });
    game.ui.dialog({ title: '🏭 生产载具（' + city.name + '）', body: '选择要生产的载具。工厂等级越高生产越快。<br>首次生产会打开外观编辑器。', buttons: btns });
  }
  function updateCityProduction(dt) {
    for (var i = 0; i < cities.length; i++) {
      var c = cities[i];
      if (!c.queue) continue;
      c.prod += (1 + c.slots[1]) * (0.6 + 0.4 * cityHappiness(c) / 100) * dt;
      if (c.prod >= c.queue.prod) {
        var q = c.queue;
        c.queue = null; c.prod = 0;
        var a = rand(0, TAU);
        spawnVehicle(c.nation, q.type, q.variant, c.x + Math.cos(a) * 9, c.z + Math.sin(a) * 9, q.design);
        if (c.nation === PLAYER) { SP.Audio.play('craft', 1); game.ui.toast('🚚 ' + BRANCH[q.type] + VARNAME[q.variant] + ' ' + UNIT[q.type][q.variant].label + ' 出厂！', 'good'); }
      }
    }
  }

  /* ===== 相机 / HUD / 主循环 ===== */
  function keyHeld(code) {
    var k = game.input.keys;
    if (!k) return false;
    if (typeof k.isDown === 'function') return k.isDown(code);
    if (typeof k.down === 'function') return k.down(code);
    if (k[code]) return k[code];
    var lc = code.length > 4 ? code.slice(3).toLowerCase() : code;
    return !!k[lc];
  }
  function keyJust(code) { var held = keyHeld(code), prev = keyEdges[code] || false; keyEdges[code] = held; return held && !prev; }
  function updateCamera(dt) {
    var m = game.input.mouse;
    if (m.down2) { cam.tx -= m.dx * cam.dist * 0.9; cam.tz -= m.dy * cam.dist * 0.9; }
    if (typeof m.wheel === 'number' && m.wheel !== lastWheel) { cam.dist = clamp(cam.dist * (1 + (m.wheel - lastWheel) * 0.14), 28, 150); lastWheel = m.wheel; }
    if (keyHeld('NumpadAdd') || keyHeld('Equal')) cam.dist = clamp(cam.dist * 0.94, 28, 150);
    if (keyHeld('NumpadSubtract') || keyHeld('Minus')) cam.dist = clamp(cam.dist * 1.06, 28, 150);
    if (keyHeld('KeyQ')) cam.theta -= 0.9 * dt;
    if (keyHeld('KeyE')) cam.theta += 0.9 * dt;
    cam.tx = clamp(cam.tx, -MAP * 0.55, MAP * 0.55);
    cam.tz = clamp(cam.tz, -MAP * 0.55, MAP * 0.55);
    var sh = 0;
    if (cam.shake > 0) { cam.shake -= dt; sh = rand(-0.5, 0.5); }
    game.camera.position.set(cam.tx + cam.dist * Math.sin(cam.phi) * Math.sin(cam.theta) + sh, 30 + cam.dist * Math.cos(cam.phi) + sh, cam.tz + cam.dist * Math.sin(cam.phi) * Math.cos(cam.theta));
    _v1.set(cam.tx, 0, cam.tz);
    game.camera.lookAt(_v1);
  }
  function updateHud() {
    var n = getNation(PLAYER);
    if (!n) return;
    var happySum = 0;
    for (var i = 0; i < n.cities.length; i++) happySum += cityHappiness(n.cities[i]);
    var avgHappy = n.cities.length ? Math.round(happySum / n.cities.length) : 0;
    var weapon = armedWeapon ? '🔫 已激活（点击地图释放）' : superUnlocked ? '按 2 激活' : '控制 6 城解锁';
    game.ui.setHud(
      '<div style="font-size:15px;line-height:1.7">' +
      '<b style="color:#ffd75a">香料币：' + Math.round(game.money) + '</b>　收入 +' + Math.round(nationIncome(n)) + '/秒<br>' +
      '🏙 城市 ' + n.cities.length + '/10　🏭 钻井 ' + n.rigs.length + '　😊 幸福 ' + avgHappy + '<br>' +
      '🚚 载具 ' + n.vehicles.length + (selected.length ? '　选中 ' + selected.length + ' 辆' : '') +
      '<br>💣 超级武器：' + weapon + '</div>');
  }
  function updateProgress() {
    var n = getNation(PLAYER);
    var c = n ? n.cities.length : 0;
    game.ui.setProgress(c / 10, '城市控制 ' + c + ' / 10');
    game.ui.setObjective('文明阶段：统治整颗星球——控制全部 <b>10</b> 座城市，解锁星际飞船！');
    return c;
  }
  function checkWin() {
    var c = updateProgress();
    if (c >= 10 && !winDone) {
      winDone = true;
      var cap = getNation(PLAYER).cities[0];
      ship = new THREE.Group();
      put(ship, tG(new THREE.ConeGeometry(1.6, 4, 10)), matS(0xcfd6de, { met: 0.6, r: 0.3 }), 0, 0, 2.2, Math.PI / 2);
      put(ship, tG(new THREE.CylinderGeometry(1.5, 1.9, 5, 10)), matS(0x8f9aa5, { met: 0.5 }), 0, 0, 0, Math.PI / 2);
      put(ship, tG(new THREE.BoxGeometry(7, 0.2, 2.2)), matS(getNation(PLAYER).color), 0, 0, -0.4);
      var glow = glowSprite(5, 0x6fd8ff, 0.9); glow.position.set(0, 0, -3.6); ship.add(glow);
      ship.position.set(cap.x, terrainHeight(cap.x, cap.z) + 6, cap.z);
      root.add(ship);
      SP.Audio.play('stage_up', 1);
      game.ui.toast('🚀 你统治了整个星球！星际飞船建造完成！', 'good');
      game.ui.dialog({
        title: '🚀 星际飞船', body: '你已控制全部 10 座城市，文明统一了整个星球。<br>星际飞船已就绪——是时候飞向群星了！',
        buttons: [{ label: '启程前往太空！', cb: function () {
          game.ui.closeDialog();
          game.advance('space', {
            archetype: getNation(PLAYER).arch, money: Math.round(game.money), cities: 10,
            cityNames: getNation(PLAYER).cities.map(function (cc) { return cc.name; })
          });
        } }]
      });
    }
  }
  function showHelp() {
    game.ui.dialog({
      title: '📖 操作说明',
      body: '🖱 左键：点选载具 / 拖拽框选 / 点击城市管理<br>🖱 右键：移动 / 攻击敌方载具或城市<br>' +
        '⌨ Q/E 旋转　滚轮 / +/- 缩放　右键拖动平移<br>1 外交 · 2 超级武器 · 3 帮助<br>' +
        '🏙 点击城市建造建筑、生产载具　💰 建钻井赚钱<br>🏆 目标：控制全部 10 座城市',
      buttons: [{ label: '知道了', cb: function () { game.ui.closeDialog(); SP.Audio.play('ui_close', 0.6); } }]
    });
    SP.Audio.play('ui_open', 0.5);
  }

  /* ===== 存档 ===== */
  this.serialize = function () {
    return JSON.stringify({
      v: 1, money: Math.round(game.money), archetype: getNation(PLAYER).arch, design: playerDesign,
      cam: cam, superUnlocked: superUnlocked, armedWeapon: armedWeapon, winDone: winDone,
      nations: nations.map(function (n) { return { id: n.id, arch: n.arch, money: Math.round(n.money), relations: n.relations, wars: n.wars, allies: n.allies, trade: n.trade }; }),
      cities: cities.map(function (c) { return { id: c.id, nation: c.nation, pos: [c.x, c.z], hp: c.hp, slots: c.slots, buyProg: c.buyProg || 0, buyBy: c.buyBy, faithProg: c.faithProg || 0, faithBy: c.faithBy }; }),
      geysers: geysers.map(function (g) { return { id: g.id, owner: g.owner, rig: !!g.rig, hp: g.rig ? g.hp : 0 }; }),
      vehicles: vehicles.map(function (v) {
        var cmd = v.command ? (v.command.kind === 'attackCity' ? { kind: 'attackCity', id: v.command.target.id } : v.command.kind === 'move' ? { kind: 'move', x: v.command.x, z: v.command.z } : null) : null;
        return { type: v.type, variant: v.variant, nation: v.nation, pos: [v.x, v.z], hp: v.hp, design: v.design, command: cmd };
      })
    });
  };
  this.deserialize = function (s) { try { self.saveState = JSON.parse(s); } catch (e) { self.saveState = null; } };
  function cityById(id) { for (var i = 0; i < cities.length; i++) if (cities[i].id === id) return cities[i]; return null; }
  function geyserById(id) { for (var i = 0; i < geysers.length; i++) if (geysers[i].id === id) return geysers[i]; return null; }
  function applySave(s) {
    var i;
    getNation(PLAYER).arch = s.archetype || 'military';
    getNation(PLAYER).color = new THREE.Color(ARCH_COLOR[getNation(PLAYER).arch]);
    playerDesign = s.design ? normalizeDesign(s.design) : null;
    cam = s.cam || cam;
    superUnlocked = !!s.superUnlocked; armedWeapon = s.armedWeapon || null; winDone = !!s.winDone;
    game.addMoney(s.money - game.money);
    for (i = 0; i < s.nations.length; i++) {
      var sn = s.nations[i], n = getNation(sn.id);
      if (!n) continue;
      n.arch = sn.arch; n.money = sn.money; n.relations = sn.relations || {}; n.wars = sn.wars || []; n.allies = sn.allies || []; n.trade = sn.trade || [];
    }
    for (i = 0; i < s.cities.length; i++) {
      var sc = s.cities[i], c = cityById(sc.id);
      if (!c) continue;
      c.nation = sc.nation; c.hp = sc.hp; c.slots = sc.slots.slice();
      c.houses = c.slots[0]; c.factories = c.slots[1]; c.funs = c.slots[2];
      c.buyProg = sc.buyProg || 0; c.buyBy = sc.buyBy; c.faithProg = sc.faithProg || 0; c.faithBy = sc.faithBy;
      var owned = getNation(c.nation);
      if (owned) { owned.cities = owned.cities.filter(function (o) { return o !== c; }); owned.cities.push(c); }
      rebuildSlots(c);
      setFill(c.hpBar, c.hp / c.maxHp);
      c.capBar.visible = !!(c.buyProg || c.faithProg); setFill(c.capBar, (c.buyProg || c.faithProg) / 100);
      redrawCityLabel(c);
    }
    for (i = 0; i < s.geysers.length; i++) {
      var sg = s.geysers[i], g = geyserById(sg.id);
      if (!g) continue;
      if (sg.rig) {
        g.owner = sg.owner; g.nation = getNation(g.owner); g.rig = true; g.hp = sg.hp;
        buildRig(g);
        var n2 = getNation(g.owner); if (n2) n2.rigs.push(g);
      } else { g.owner = null; g.nation = null; g.rig = null; if (g.tip) g.tip.visible = true; }
    }
    // 载具恢复：先清掉世界初建的单位，避免与存档重复
    for (i = vehicles.length - 1; i >= 0; i--) root.remove(vehicles[i].model);
    vehicles = [];
    for (i = 0; i < nations.length; i++) nations[i].vehicles = [];
    for (i = 0; i < s.vehicles.length; i++) {
      var sv = s.vehicles[i];
      var v = spawnVehicle(sv.nation, sv.type, sv.variant, sv.pos[0], sv.pos[1], normalizeDesign(sv.design), sv.hp);
      if (sv.command && sv.command.kind === 'attackCity') { var tc = cityById(sv.command.id); if (tc) v.command = { kind: 'attackCity', target: tc }; }
      else if (sv.command && sv.command.kind === 'move') v.command = { kind: 'move', x: sv.command.x, z: sv.command.z };
    }
    updateProgress();
  }

  /* ===== 世界构建 ===== */
  function clearScene() {
    if (root) {
      game.scene.remove(root);
      root.traverse(function (o) {
        if ((o.isMesh || o.isSprite) && o.material) {
          if (o.material.map && createdTexs.indexOf(o.material.map) >= 0) o.material.map.dispose();
          o.material.dispose();
        }
      });
      for (var i = 0; i < createdGeos.length; i++) createdGeos[i].dispose();
    }
    createdMats = []; createdTexs = []; createdGeos = [];
  }
  /* 灯光：必须在每次重建 root 之后重新挂上，否则整颗行星会是无光的黑色 */
  function addLights() {
    if (!root) return;
    var hemi = new THREE.HemisphereLight(0xcfe8ff, 0x4a5a3a, 0.85);
    root.add(hemi);
    var sun = new THREE.DirectionalLight(0xfff2d8, 1.05);
    sun.position.set(90, 130, 60);
    root.add(sun);
    root.add(sun.target);
    if (game.renderer && game.renderer.shadowMap) {
      game.renderer.shadowMap.enabled = true;
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
      sun.shadow.camera.top = 160; sun.shadow.camera.bottom = -160;
      sun.shadow.camera.far = 400;
    }
    var amb = new THREE.AmbientLight(0xffffff, 0.22);
    root.add(amb);
  }
  function disposeWorld() {
    clearScene();
    nations = []; cities = []; geysers = []; vehicles = []; pickMeshes = [];
    particles = []; floats = []; projectiles = []; markers = []; selected = [];
    hovered = null; ship = null;
    root = new THREE.Group();
    game.scene.add(root);
    addLights();
  }
  function buildWorld() {
    disposeWorld();
    noiseLow = SP.U.makeNoise2D(20240817);
    noiseHigh = SP.U.makeNoise2D(20240818);
    noiseGrass = SP.U.makeNoise2D(20240819);
    buildTerrain();
    nations = [
      { id: 0, name: NATION_NAME[0], color: new THREE.Color(ARCH_COLOR.military), arch: 'military', cities: [], rigs: [], vehicles: [], money: 0, relations: {}, wars: [], allies: [], trade: [] },
      { id: 1, name: NATION_NAME[1], color: new THREE.Color(AI_COLOR[1]), arch: 'military', cities: [], rigs: [], vehicles: [], money: 120, relations: {}, wars: [], allies: [], trade: [] },
      { id: 2, name: NATION_NAME[2], color: new THREE.Color(AI_COLOR[2]), arch: 'economic', cities: [], rigs: [], vehicles: [], money: 140, relations: {}, wars: [], allies: [], trade: [] },
      { id: 3, name: NATION_NAME[3], color: new THREE.Color(AI_COLOR[3]), arch: 'religious', cities: [], rigs: [], vehicles: [], money: 120, relations: {}, wars: [], allies: [], trade: [] },
      { id: 4, name: NATION_NAME[4], color: new THREE.Color(AI_COLOR[4]), arch: 'military', cities: [], rigs: [], vehicles: [], money: 100, relations: {}, wars: [], allies: [], trade: [] }
    ];
    var i, j;
    for (i = 1; i < nations.length; i++) for (j = 0; j < nations.length; j++) if (i !== j) { nations[i].relations[j] = rand(-25, 35); if (j > 0) nations[j].relations[i] = rand(-25, 35); }
    var rng = SP.U.Rng(88001);
    var spots = [], tries = 0, ok, s, s2;
    while (spots.length < CITY_NUM && tries < 3000) {
      tries++;
      var x = rng.range(-MAP * 0.42, MAP * 0.42), z = rng.range(-MAP * 0.42, MAP * 0.42), h = terrainHeight(x, z);
      if (h < 0.7 || h > 12) continue;
      ok = true;
      for (s = 0; s < spots.length; s++) { var dx = spots[s][0] - x, dz = spots[s][1] - z; if (dx * dx + dz * dz < 34 * 34) { ok = false; break; } }
      if (ok) spots.push([x, z]);
    }
    while (spots.length < CITY_NUM) spots.push([rng.range(-60, 60), rng.range(-60, 60)]);
    var gs = []; tries = 0;
    while (gs.length < GEYSER_NUM && tries < 2000) {
      tries++;
      var gx = rng.range(-MAP * 0.42, MAP * 0.42), gz = rng.range(-MAP * 0.42, MAP * 0.42), gh = terrainHeight(gx, gz);
      if (gh < 0.4 || gh > 10) continue;
      ok = true;
      for (s2 = 0; s2 < gs.length; s2++) { var ddx = gs[s2][0] - gx, ddz = gs[s2][1] - gz; if (ddx * ddx + ddz * ddz < 20 * 20) { ok = false; break; } }
      if (ok) gs.push([gx, gz]);
    }
    while (gs.length < GEYSER_NUM) gs.push([rng.range(-70, 70), rng.range(-70, 70)]);
    // AI 城市（9 座分属 4 国），玩家首都最后放置
    var sizes = [3, 2, 2, 2], idx = 1;
    for (var ni = 1; ni < nations.length; ni++) for (var k = 0; k < sizes[ni - 1]; k++) {
      var sp = spots[idx++];
      var city = { id: cities.length, nation: ni, name: CITY_NAMES[Math.floor(rng.range(0, CITY_NAMES.length))], x: sp[0], z: sp[1], hp: 1000, maxHp: 1000, slots: [1, 1, 1], buyProg: 0, buyBy: null, faithProg: 0, faithBy: null };
      cities.push(city); buildCity(city); nations[ni].cities.push(city);
    }
    var ps = spots[0];
    var pc = { id: cities.length, nation: PLAYER, name: '晨曦之城', x: ps[0], z: ps[1], hp: 1000, maxHp: 1000, slots: [1, 1, 1], buyProg: 0, buyBy: null, faithProg: 0, faithBy: null };
    cities.push(pc); buildCity(pc); nations[PLAYER].cities.push(pc);
    for (var gi = 0; gi < gs.length; gi++) geysers.push({ id: gi, x: gs[gi][0], z: gs[gi][1], owner: null, nation: null, rig: null, hp: 0, tip: null });
    for (var gi2 = 0; gi2 < geysers.length; gi2++) buildGeyserVisual(geysers[gi2]);
    // 初始单位：1 军事 + 1 本国原型
    var stArch = 'military';
    spawnVehicle(PLAYER, 'land', 'm', pc.x + 10, pc.z + 6);
    spawnVehicle(PLAYER, 'land', stArch === 'military' ? 'm' : stArch === 'economic' ? 'e' : 'r', pc.x - 10, pc.z - 4);
    // 首都市民（程序化生物点缀）
    try {
      for (var ci = 0; ci < 2; ci++) {
        var bio = SP.Genome.build(SP.Genome.random('creature'), { scale: 0.6 });
        bio.position.set(pc.x + rand(-14, 14), terrainHeight(pc.x, pc.z), pc.z + rand(-14, 14));
        SP.Genome.tint(bio, [rand(0.05, 0.6), 0.7, 0.55]);
        bio.userData.citizen = true;
        root.add(bio);
      }
    } catch (e) { /* 生物模型失败不影响阶段 */ }
    for (i = 1; i < nations.length; i++) { nations[i].relations[PLAYER] = rand(-10, 30); nations[PLAYER].relations[i] = rand(-10, 30); }
  }
  function chooseArchetype(payload) {
    var arch = payload && payload.culture ? payload.culture : null;
    if (arch === 'military' || arch === 'economic' || arch === 'religious') {
      getNation(PLAYER).arch = arch;
      getNation(PLAYER).color = new THREE.Color(ARCH_COLOR[arch]);
      return;
    }
    SP.Audio.play('ui_open', 0.8);
    game.ui.dialog({
      title: '🧬 选择文明原型', body: '你的文明将以何种方式征服世界？<br>' +
        '<span style="color:#e2543f">⚔ 军事</span>：攻击 +25%，武力占领，解锁「毁灭炸弹」<br>' +
        '<span style="color:#f0b23a">💰 经济</span>：载具便宜，贸易翻倍，可收购，解锁「贪婪射线」<br>' +
        '<span style="color:#9a6fe0">🕊 宗教</span>：传教转化城市，解锁「快乐之云」',
      buttons: [
        { label: '⚔ 军事', cb: function () { game.ui.closeDialog(); getNation(PLAYER).arch = 'military'; getNation(PLAYER).color = new THREE.Color(ARCH_COLOR.military); SP.Audio.play('stage_up', 1); game.ui.toast('已选择军事原型！', 'good'); } },
        { label: '💰 经济', cb: function () { game.ui.closeDialog(); getNation(PLAYER).arch = 'economic'; getNation(PLAYER).color = new THREE.Color(ARCH_COLOR.economic); SP.Audio.play('stage_up', 1); game.ui.toast('已选择经济原型！', 'good'); } },
        { label: '🕊 宗教', cb: function () { game.ui.closeDialog(); getNation(PLAYER).arch = 'religious'; getNation(PLAYER).color = new THREE.Color(ARCH_COLOR.religious); SP.Audio.play('stage_up', 1); game.ui.toast('已选择宗教原型！', 'good'); } }
      ]
    });
  }

  /* ===== 模块接口 ===== */
  this.enter = function (payload) {
    savedEnv = { bg: game.scene.background, fog: game.scene.fog };
    game.scene.background = new THREE.Color(0x87b7e6);
    game.scene.fog = new THREE.Fog(0x87b7e6, 160, 520);
    root = new THREE.Group();
    game.scene.add(root);
    addLights();
    if (game.camera.far < 800) game.camera.far = 900;
    cam = { theta: 0.6, phi: 1.12, dist: 100, tx: 0, tz: 0, shake: 0 };
    playerDesign = null; superUnlocked = false; winDone = false; armedWeapon = null; lastWheel = 0;
    game.addMoney(300 - (game.money || 0));
    buildWorld();
    // 镜头对准玩家首都（否则默认落在原点的大洋上，什么都看不见）
    var cap0 = getNation(PLAYER).cities[0];
    if (cap0) { cam.tx = cap0.x; cam.tz = cap0.z; }
    chooseArchetype(payload);
    if (self.saveState) { applySave(self.saveState); self.saveState = null; }
    game.ui.setActions([
      { key: '1', label: '🌐 外交', desc: '打开外交面板', cb: openDiplomacy },
      { key: '2', label: '💣 超级武器', desc: '激活超级武器', cb: armSuperWeapon },
      { key: '3', label: '📖 帮助', desc: '操作说明', cb: showHelp }
    ]);
    updateProgress();
    updateHud();
    SP.Audio.play('evolve', 1);
  };
  this.exit = function () {
    clearScene();
    if (savedEnv) { game.scene.background = savedEnv.bg; game.scene.fog = savedEnv.fog; savedEnv = null; }
    game.ui.setHud('');
    game.ui.setActions([]);
    game.ui.setObjective('');
    game.ui.setProgress(0, '');
    game.ui.closeDialog();
  };
  this.update = function (dt) {
    if (!root) return;
    dt = clamp(dt, 0, 0.05);
    var m = game.input.mouse, i;
    ndc.set(m.x, m.y);
    updateCamera(dt);
    if (m.dx !== 0 || m.dy !== 0 || m.down0 || m.down2) refreshHover();
    if (m.down0 && !prevDown0) boxDrag = { x0: m.x, y0: m.y, x1: m.x, y1: m.y };
    else if (m.down0 && boxDrag) { boxDrag.x1 = m.x; boxDrag.y1 = m.y; }
    else if (!m.down0 && boxDrag) {
      var bx = boxDrag;
      boxDrag = null;
      if (Math.abs(bx.x1 - bx.x0) < 0.03 && Math.abs(bx.y1 - bx.y0) < 0.03) onLeftClick();
      else {
        var minX = Math.min(bx.x0, bx.x1), maxX = Math.max(bx.x0, bx.x1);
        var minY = Math.min(bx.y0, bx.y1), maxY = Math.max(bx.y0, bx.y1);
        selected = [];
        for (i = 0; i < vehicles.length; i++) {
          var v = vehicles[i];
          if (v.nation !== PLAYER) continue;
          _v1.set(v.x, v.model.position.y, v.z).project(game.camera);
          if (_v1.x >= minX && _v1.x <= maxX && _v1.y >= minY && _v1.y <= maxY) selected.push(v);
        }
        updateSelectionRings();
        if (selected.length) SP.Audio.play('ui_click', 0.7);
      }
    }
    prevDown0 = m.down0;
    if (m.down2 && !prevDown2) rDownPos = { x: m.x, y: m.y };
    if (!m.down2 && prevDown2 && rDownPos) {
      if (Math.abs(m.x - rDownPos.x) + Math.abs(m.y - rDownPos.y) < 0.04) onRightClick();
      rDownPos = null;
    }
    prevDown2 = m.down2;
    if (keyJust('Digit1') || keyJust('Numpad1')) openDiplomacy();
    if (keyJust('Digit2') || keyJust('Numpad2')) armSuperWeapon();
    if (keyJust('Digit3') || keyJust('Numpad3')) showHelp();
    if (armedWeapon && m.down0 && !prevDown0) { var g = groundPointAt(ndc); if (g) fireSuperWeapon(g.x, g.z); }
    updateCombat(dt);
    updateTurrets(dt);
    updateProjectiles(dt);
    updateFx(dt);
    updateCityProduction(dt);
    game.addMoney(nationIncome(getNation(PLAYER)) * dt);
    for (i = 1; i < nations.length; i++) nations[i].money += nationIncome(nations[i]) * dt;
    // 城市生命恢复
    for (i = 0; i < cities.length; i++) { var c = cities[i]; if (c.hp < c.maxHp) { c.hp = Math.min(c.maxHp, c.hp + 1.2 * dt); setFill(c.hpBar, c.hp / c.maxHp); } }
    // 喷口光晕动画
    for (i = 0; i < geysers.length; i++) {
      var gg = geysers[i], gs2;
      if (gg.model && gg.model.userData.glow) {
        gs2 = (gg.rig ? 1 + Math.sin(game.time * 3 + i) * 0.15 : 1 + Math.sin(game.time * 5 + i * 1.7) * 0.3) * 4;
        gg.model.userData.glow.scale.set(gs2, gs2, 1);
      }
    }
    if (oceanMesh && oceanMesh.material.map) { oceanMesh.material.map.offset.x += dt * 0.008; oceanMesh.material.map.offset.y += dt * 0.005; }
    // 市民动画
    root.traverse(function (o) {
      if (o.userData && o.userData.citizen) { o.position.y = terrainHeight(o.position.x, o.position.z); o.rotation.y += dt * 0.6; SP.Genome.animate(o, game.time, {}); }
    });
    var pn = getNation(PLAYER);
    if (!superUnlocked && pn.cities.length >= 6) {
      superUnlocked = true;
      game.ui.toast('💣 超级武器已解锁！按 2 激活', 'good');
      SP.Audio.play('levelup', 1);
    }
    aiThink(dt);
    hudTimer -= dt;
    if (hudTimer <= 0) { hudTimer = 0.3; updateHud(); }
    checkWin();
  };
};
