/* =============================================================================
 * world.js — 废弃公寓（アパート四〇二号室）
 *
 * 坐标约定（全文件统一）：
 *   走廊沿 -Z 延伸：玩家从 z≈+2 出发走向 z≈-46
 *   走廊宽度在 X：内墙面 x = ±HALF（HALF=1.6）
 *   左侧房间向 -X 延伸，右侧房间向 +X 延伸
 *   房间纵深远大于建筑外观应有的体积 → 异常空间
 * ===========================================================================*/
(function () {
  'use strict';
  var HZ = window.HZ;

  /* 尺寸常量 */
  var C = {
    LEN: 46,      // 走廊总长（-z 方向）
    HALF: 1.6,    // 走廊半宽
    H: 3.3,       // 净高
    WALL: 0.25,   // 墙厚
    SPAN: 8.2     // 荧光灯间距
  };

  /* 门洞：z 为负（走廊深处），side=-1 左墙 / +1 右墙 */
  var DOORWAYS = [
    { z: -8.5, side: -1, room: 'washitsu', w: 1.7 },
    { z: -15.0, side: 1, room: 'bath', w: 1.5 },
    { z: -23.5, side: -1, room: 'storage', w: 1.7 },
    { z: -31.0, side: 1, room: 'kitchen', w: 1.7 }
  ];

  /* 房间尺寸：depth = 垂直走廊方向的纵深（异常地深），w = 沿走廊方向的宽 */
  var ROOMS = {
    washitsu: { depth: 5.0, w: 4.4 },
    bath: { depth: 3.4, w: 3.0 },
    storage: { depth: 9.5, w: 3.4 },
    kitchen: { depth: 4.6, w: 4.2 }
  };

  var MAT = {};
  var geoCache = {};

  function geo(key, fn) {
    if (!geoCache[key]) geoCache[key] = fn();
    return geoCache[key];
  }
  function boxGeo(w, h, d) {
    return geo('b' + w + '_' + h + '_' + d, function () {
      return new THREE.BoxGeometry(w, h, d);
    });
  }
  function planeGeo(w, h) {
    return geo('p' + w + '_' + h, function () {
      return new THREE.PlaneGeometry(w, h);
    });
  }
  function lam(o) { return new THREE.MeshLambertMaterial(o); }
  function std(o) { return new THREE.MeshStandardMaterial(o); }

  /* ================================ World ================================ */

  function World(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'world';
    scene.add(this.group);

    this.colliders = [];
    this.doors = [];
    this.lights = [];
    this.corridorLights = [];
    this.interactives = [];   // 供射线检测的对象列表
    this.dust = [];
    this.rooms = {};
    this.triggerZones = [];
    this.loopCount = 0;
    this.corridorPower = true;
    this.tv = null;
    this.shrine = null;
    this.chair = null;
    this.mannequins = [];
    this.figuresGroup = new THREE.Group();
    this.group.add(this.figuresGroup);

    this._materials();
    this._corridor();
    this._doorways();
    this._rooms();
    this._props();
    this._lights();
    this._dust();
    this.triggerZones = [
      { z: -6, id: 'firstStep', fired: false },
      { z: -14, id: 'midway', fired: false },
      { z: -24, id: 'deep', fired: false },
      { z: -34, id: 'nearEnd', fired: false },
      { z: -43, id: 'atEnd', fired: false }
    ];
    this.applyLoop(0);
  }

  /* ------------------------------ 材质 ------------------------------ */
  World.prototype._materials = function () {
    var T = HZ.Tex;
    MAT.wallpaper = lam({ map: T.get('wallpaper', 2, 1) });
    MAT.plaster = lam({ map: T.get('plaster', 2, 1) });
    MAT.concrete = lam({ map: T.get('concrete', 6, 6) });
    MAT.floor = std({
      map: T.get('woodFloor', 2, 16),
      roughnessMap: T.get('roughness', 2, 16),
      roughness: 0.92, metalness: 0.04
    });
    MAT.wet = std({
      map: T.get('woodFloor', 1, 1),
      roughnessMap: T.get('roughness', 1, 1),
      roughness: 0.16, metalness: 0.22, color: 0x8a9a96
    });
    MAT.tile = std({
      map: T.get('tile', 3, 3),
      roughnessMap: T.get('roughness', 3, 3),
      roughness: 0.42, metalness: 0.08
    });
    MAT.tatami = lam({ map: T.get('tatami', 3, 3) });
    MAT.wood = lam({ map: T.get('woodDoor', 1, 1) });
    MAT.woodPlain = lam({ color: 0x4a3b2c });
    MAT.rust = std({
      map: T.get('rust', 2, 2),
      roughnessMap: T.get('roughness', 2, 2),
      roughness: 0.62, metalness: 0.55
    });
    MAT.skin = lam({ map: T.get('skin', 1, 1) });
    MAT.note = lam({ map: T.get('note', 1, 1), side: THREE.DoubleSide });
    MAT.news = lam({ map: T.get('newspaper', 1, 1), side: THREE.DoubleSide });
    MAT.ofuda = lam({ map: T.get('ofuda', 1, 1), transparent: true, alphaTest: 0.45, side: THREE.DoubleSide });
    MAT.drawing = lam({ map: T.get('drawing', 1, 1), side: THREE.DoubleSide });
    MAT.photo = lam({ map: T.get('photo', 1, 1), side: THREE.DoubleSide });
    MAT.mold = lam({
      map: T.getDecal('decalMold', 0), transparent: true,
      depthWrite: false, side: THREE.DoubleSide
    });
    MAT.dark = lam({ color: 0x0b0d10 });
    MAT.metal = std({ color: 0x8a8578, roughness: 0.35, metalness: 0.7 });
  };

  /* ------------------------------ 基础构件 ------------------------------ */
  World.prototype._box = function (w, h, d, m, x, y, z, o) {
    o = o || {};
    var mesh = new THREE.Mesh(boxGeo(w, h, d), m);
    mesh.position.set(x, y, z);
    if (o.rx) mesh.rotation.x = o.rx;
    if (o.ry) mesh.rotation.y = o.ry;
    if (o.rz) mesh.rotation.z = o.rz;
    mesh.castShadow = o.cast !== false;
    mesh.receiveShadow = o.receive !== false;
    (o.parent || this.group).add(mesh);
    if (o.collide) this.addCollider(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 'wall');
    return mesh;
  };

  World.prototype._plane = function (w, h, m, x, y, z, rot, parent) {
    var mesh = new THREE.Mesh(planeGeo(w, h), m);
    mesh.position.set(x, y, z);
    if (rot) {
      mesh.rotation.set(rot.x || 0, rot.y || 0, rot.z || 0);
    }
    mesh.receiveShadow = true;
    (parent || this.group).add(mesh);
    return mesh;
  };

  World.prototype.addCollider = function (x1, z1, x2, z2, type) {
    var c = {
      minX: Math.min(x1, x2), maxX: Math.max(x1, x2),
      minZ: Math.min(z1, z2), maxZ: Math.max(z1, z2),
      type: type || 'wall', active: true
    };
    this.colliders.push(c);
    return c;
  };

  World.prototype._interactive = function (obj, data) {
    for (var k in data) obj.userData[k] = data[k];
    this.interactives.push(obj);
    return obj;
  };

  /* ------------------------------ 走廊 ------------------------------ */
  World.prototype._corridor = function () {
    var HALF = C.HALF, LEN = C.LEN, rnd = HZ.rng(9901);
    var zMin = -LEN, zMax = 4.5;   // 前方尽头 -46，后方玄关墙 +4.5（出生点 z=2.6 前后留空）
    var zLen = zMax - zMin;
    var zMid = (zMax + zMin) / 2;

    /* 地板 / 天花板 */
    this._box(HALF * 2, 0.24, zLen, MAT.floor, 0, -0.12, zMid, { cast: false });
    this._box(HALF * 2 + C.WALL * 2, 0.16, zLen, MAT.concrete, 0, C.H + 0.08, zMid, { cast: false });

    /* 两侧长墙 */
    this._box(C.WALL, C.H + 0.3, zLen, MAT.wallpaper, -HALF - C.WALL / 2, C.H / 2, zMid, {});
    this._box(C.WALL, C.H + 0.3, zLen, MAT.wallpaper, HALF + C.WALL / 2, C.H / 2, zMid, {});
    // 长墙碰撞体（整条）
    this.addCollider(-HALF - C.WALL, zMin, -HALF, zMax, 'wall');
    this.addCollider(HALF, zMin, HALF + C.WALL, zMax, 'wall');

    /* 尽头墙 + 尽头门（loop 传送门） */
    this._box(HALF * 2 + C.WALL * 2, C.H + 0.3, C.WALL, MAT.plaster, 0, C.H / 2, zMin - C.WALL / 2, {});
    this.addCollider(-HALF - C.WALL, zMin - C.WALL, HALF + C.WALL, zMin, 'wall');

    var portalGrp = new THREE.Group();
    portalGrp.position.set(0, 0, zMin + 0.05);
    var portalDoor = new THREE.Mesh(boxGeo(1.75, 2.3, 0.09), MAT.wood);
    portalDoor.position.y = 1.15;
    portalDoor.castShadow = true;
    portalGrp.add(portalDoor);
    // 门上的朱红符纸
    var seal = new THREE.Mesh(planeGeo(0.16, 0.5), MAT.ofuda);
    seal.position.set(0.35, 1.62, 0.06);
    portalGrp.add(seal);
    var seal2 = new THREE.Mesh(planeGeo(0.16, 0.5), MAT.ofuda);
    seal2.position.set(-0.3, 1.5, 0.06);
    seal2.rotation.z = 0.2;
    portalGrp.add(seal2);
    // 门牌
    var plate = new THREE.Mesh(planeGeo(0.3, 0.42), MAT.note);
    plate.position.set(0, 2.05, 0.06);
    portalGrp.add(plate);
    this.group.add(portalGrp);
    this.endPortal = { group: portalGrp, door: portalDoor, z: zMin };
    var self = this;
    portalGrp.traverse(function (o) {
      if (o.isMesh) self._interactive(o, { portal: self.endPortal });
    });

    /* 玄关侧（背后）：锁死的玄关门（把墙外移，给玩家出生点留出空间） */
    this._box(HALF * 2 + C.WALL * 2, C.H + 0.3, C.WALL, MAT.plaster, 0, C.H / 2, zMax + C.WALL / 2, {});
    this.addCollider(-HALF - C.WALL, zMax, HALF + C.WALL, zMax + C.WALL, 'wall');
    var genkan = this._box(1.8, 2.2, 0.08, MAT.wood, 0, 1.1, zMax - 0.06, {});
    this._interactive(genkan, { entrance: true });
    // 玄关地面（水泥）+ 鞋
    this._box(HALF * 2, 0.02, 1.4, MAT.concrete, 0, 0.01, zMax - 0.75, { cast: false });
    this._box(0.26, 0.08, 0.12, MAT.dark, -0.7, 0.05, zMax - 0.9, { ry: 0.4 });
    this._box(0.26, 0.08, 0.12, MAT.dark, -0.45, 0.05, zMax - 1.15, { ry: -0.7 });
    // 鞋柜（离出生点远一点，避免一出生就卡住）
    this._box(0.45, 1.1, 1.0, MAT.wood, HALF - 0.25, 0.55, zMax - 1.6, { collide: true });

    /* 踢脚线 + 墙根霉斑 */
    for (var s = -1; s <= 1; s += 2) {
      this._box(0.05, 0.2, zLen, MAT.dark, s * (HALF - 0.02), 0.1, zMid, { cast: false });
    }
    for (var i = 0; i < 22; i++) {
      var side = rnd() < 0.5 ? -1 : 1;
      var mz = zMin + 1 + rnd() * (zLen - 2);
      var mm = this._plane(HZ.range(rnd, 1.0, 2.4), HZ.range(rnd, 0.7, 1.9), MAT.mold,
        side * (HALF - 0.01), HZ.range(rnd, 0.5, 2.0), mz,
        { y: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
      mm.renderOrder = 2;
      mm.receiveShadow = false;
    }

    /* 潮湿水洼（PBR 低粗糙度 → 湿滑反光） */
    for (var p = 0; p < 6; p++) {
      var px = HZ.range(rnd, -HALF + 0.4, HALF - 0.4);
      var pz = zMin + 2 + rnd() * (zLen - 4);
      var pw = HZ.range(rnd, 0.6, 1.5);
      this._plane(pw, pw * HZ.range(rnd, 0.7, 1.4), MAT.wet, px, 0.008, pz,
        { x: -Math.PI / 2, z: rnd() * Math.PI });
    }

    /* 走廊尽头前的电灯开关 */
    var swPlate = this._box(0.02, 0.14, 0.09, lam({ color: 0xd8d4c4 }),
      HALF - 0.02, 1.25, -2.2, {});
    this._interactive(swPlate, { lightSwitch: true });

    /* 天花板检修口 + 垂线 */
    this._box(0.8, 0.06, 0.8, lam({ color: 0x8e8e86 }), 0.4, C.H - 0.02, -11.5, { rz: 0.1, ry: 0.2 });
    var cord = new THREE.Mesh(geo('cord', function () {
      return new THREE.CylinderGeometry(0.008, 0.008, 1.5, 5);
    }), MAT.dark);
    cord.position.set(0.4, C.H - 0.78, -11.5);
    this.group.add(cord);
  };

  /* ------------------------------ 门洞与门 ------------------------------ */
  World.prototype._doorways = function () {
    var HALF = C.HALF;
    for (var i = 0; i < DOORWAYS.length; i++) {
      var d = DOORWAYS[i];
      var wx = d.side * (HALF + C.WALL / 2);

      // 门洞：在长墙碰撞体上"开洞" → 用两段短碰撞体替代该区域
      // （长墙整体碰撞已加，这里把门洞范围登记为可通行）
      var gapZ0 = d.z - d.w / 2, gapZ1 = d.z + d.w / 2;
      this._punchWall(d.side, gapZ0, gapZ1);

      // 门框
      this._box(C.WALL + 0.1, 2.45, 0.14, MAT.wood, wx, 1.22, gapZ0 - 0.07, {});
      this._box(C.WALL + 0.1, 2.45, 0.14, MAT.wood, wx, 1.22, gapZ1 + 0.07, {});
      this._box(C.WALL + 0.1, 0.22, d.w + 0.28, MAT.wood, wx, 2.45, d.z, {});

      this._makeDoor(d, wx, gapZ0, gapZ1);
    }
  };

  /* 把长墙上的门洞位置从碰撞中"挖掉"：重建该侧碰撞体为分段 */
  World.prototype._punchWall = function (side, z0, z1) {
    var HALF = C.HALF;
    var targetMinX = side < 0 ? -HALF - C.WALL : HALF;
    for (var i = 0; i < this.colliders.length; i++) {
      var c = this.colliders[i];
      if (Math.abs(c.minX - targetMinX) < 0.001 && c.type === 'wall' && (c.maxZ - c.minZ) > 5) {
        // 拆成两段
        var upper = { minX: c.minX, maxX: c.maxX, minZ: c.minZ, maxZ: z0, type: 'wall', active: true };
        var lower = { minX: c.minX, maxX: c.maxX, minZ: z1, maxZ: c.maxZ, type: 'wall', active: true };
        this.colliders.splice(i, 1, upper, lower);
        return;
      }
    }
  };

  World.prototype._makeDoor = function (spec, wx, gapZ0, gapZ1) {
    var doorW = spec.w - 0.05;
    var grp = new THREE.Group();
    // 铰链在 gapZ0 一侧
    grp.position.set(wx, 0, gapZ0);
    var mesh = new THREE.Mesh(boxGeo(0.08, 2.25, doorW), MAT.wood);
    mesh.position.set(0, 1.125, doorW / 2);
    mesh.castShadow = true;
    grp.add(mesh);
    var knob = new THREE.Mesh(geo('knob', function () {
      return new THREE.SphereGeometry(0.045, 6, 5);
    }), MAT.metal);
    knob.position.set(-spec.side * 0.07, 1.02, doorW - 0.12);
    grp.add(knob);
    var talisman = new THREE.Mesh(planeGeo(0.13, 0.42), MAT.ofuda);
    talisman.position.set(-spec.side * 0.05, 1.55, doorW * 0.5);
    talisman.rotation.y = spec.side > 0 ? Math.PI : 0;
    grp.add(talisman);
    this.group.add(grp);

    var door = {
      spec: spec, group: grp, mesh: mesh,
      open: false, angle: 0, target: 0,
      locked: true, state: 'closed', rattleT: 0
    };
    // 关门时的碰撞体
    door.collider = this.addCollider(wx - 0.25, gapZ0, wx + 0.25, gapZ1, 'door');
    door.collider.door = door;

    var self = this;
    grp.traverse(function (o) { if (o.isMesh) self._interactive(o, { door: door }); });
    this.doors.push(door);
    return door;
  };

  /* ------------------------------ 房间 ------------------------------ */
  World.prototype._rooms = function () {
    for (var i = 0; i < DOORWAYS.length; i++) {
      var d = DOORWAYS[i];
      var r = ROOMS[d.room];
      var HALF = C.HALF;
      // 房间中心：从走廊内墙向外 depth/2
      var cx = d.side * (HALF + C.WALL + r.depth / 2);
      var g = {
        name: d.room, side: d.side, depth: r.depth, w: r.w,
        cx: cx, cz: d.z,
        xNear: d.side * (HALF + C.WALL),          // 靠走廊那面
        xFar: d.side * (HALF + C.WALL + r.depth), // 房间最深处
        z0: d.z - r.w / 2, z1: d.z + r.w / 2
      };
      this.rooms[d.room] = g;
      this._roomShell(g);
      this._roomContent(g);
    }
  };

  World.prototype._roomShell = function (g) {
    var floorMat = g.name === 'bath' ? MAT.tile :
      (g.name === 'washitsu' ? MAT.tatami : MAT.floor);
    var wallMat = g.name === 'bath' ? MAT.tile : MAT.plaster;

    // 地板 / 天花板
    this._box(g.depth, 0.2, g.w, floorMat, g.cx, -0.1, g.cz, { cast: false });
    this._box(g.depth + 0.4, 0.16, g.w + 0.4, MAT.concrete, g.cx, C.H + 0.08, g.cz, { cast: false });

    // 三面墙（最深处 + 两侧）
    var xFarWall = g.xFar + g.side * C.WALL / 2;
    this._box(C.WALL, C.H + 0.3, g.w + C.WALL * 2, wallMat, xFarWall, C.H / 2, g.cz, {});
    this.addCollider(Math.min(xFarWall - C.WALL / 2, xFarWall + C.WALL / 2), g.z0 - C.WALL,
      Math.max(xFarWall - C.WALL / 2, xFarWall + C.WALL / 2), g.z1 + C.WALL, 'wall');

    this._box(g.depth, C.H + 0.3, C.WALL, wallMat, g.cx, C.H / 2, g.z0 - C.WALL / 2, {});
    this.addCollider(Math.min(g.xNear, g.xFar), g.z0 - C.WALL, Math.max(g.xNear, g.xFar), g.z0, 'wall');
    this._box(g.depth, C.H + 0.3, C.WALL, wallMat, g.cx, C.H / 2, g.z1 + C.WALL / 2, {});
    this.addCollider(Math.min(g.xNear, g.xFar), g.z1, Math.max(g.xNear, g.xFar), g.z1 + C.WALL, 'wall');
  };

  World.prototype._roomContent = function (g) {
    var rnd = HZ.rng(g.name.length * 977 + 13);
    var s = g.side;

    /* ---------------- 和室：神龛 / 遗照 / 被褥 ---------------- */
    if (g.name === 'washitsu') {
      // 壁龛（床の間）
      this._box(0.5, 0.55, 1.3, MAT.wood, g.xFar - s * 0.3, 1.0, g.cz, { collide: true });
      var photo = this._plane(0.46, 0.56, MAT.photo,
        g.xFar - s * 0.06, 1.62, g.cz, { y: s > 0 ? -Math.PI / 2 : Math.PI / 2 });
      this._interactive(photo, { pickup: { kind: 'look', id: 'shrinePhoto', label: '全家福（脸被刮掉了）' } });
      // 供饭
      var bowl = new THREE.Mesh(geo('bowlA', function () {
        return new THREE.CylinderGeometry(0.085, 0.05, 0.07, 7);
      }), lam({ color: 0xd6d0be }));
      bowl.position.set(g.xFar - s * 0.35, 1.32, g.cz);
      this.group.add(bowl);
      // 线香 + 微红点光
      var incense = new THREE.PointLight(0xff4a22, 0.55, 3.4, 2);
      incense.position.set(g.xFar - s * 0.42, 1.5, g.cz + 0.35);
      this.group.add(incense);
      this.lights.push({ light: incense, flicker: 5, base: 0.55 });
      this.shrine = { photo: photo, light: incense };
      // 蜡烛（两侧闪烁）
      for (var k = -1; k <= 1; k += 2) {
        var cl = new THREE.PointLight(0xffa04a, 0.5, 4.5, 2);
        cl.position.set(g.xFar - s * 0.4, 1.45, g.cz + k * 0.55);
        this.group.add(cl);
        this.lights.push({ light: cl, flicker: 7, base: 0.5 });
      }
      // 卷起的被褥
      var futon = new THREE.Mesh(geo('futon', function () {
        return new THREE.CylinderGeometry(0.28, 0.28, 1.7, 8);
      }), lam({ color: 0x59634e }));
      futon.rotation.x = Math.PI / 2;
      futon.position.set(g.cx + s * 0.5, 0.28, g.z1 - 0.7);
      futon.castShadow = true;
      this.group.add(futon);
      // 矮桌 + 围棋盘
      this._box(0.85, 0.05, 0.62, MAT.wood, g.cx - s * 0.6, 0.33, g.z0 + 1.0, { collide: true });
      for (var l = 0; l < 4; l++) {
        this._box(0.05, 0.3, 0.05, MAT.wood,
          g.cx - s * 0.6 + (l < 2 ? -0.35 : 0.35), 0.15,
          g.z0 + 1.0 + (l % 2 ? -0.22 : 0.22), {});
      }
      var noteA = this._plane(0.26, 0.34, MAT.note, g.cx - s * 0.6, 0.37, g.z0 + 1.0,
        { x: -Math.PI / 2, z: 0.3 });
      this._interactive(noteA, { pickup: { kind: 'note', id: 'familyNote', label: '发黄的信纸' } });
      // 儿童蜡笔画贴墙
      var draw = this._plane(0.5, 0.5, MAT.drawing, g.xFar - s * 0.05, 1.15, g.z1 - 0.7,
        { y: s > 0 ? -Math.PI / 2 : Math.PI / 2 });
      this._interactive(draw, { pickup: { kind: 'look', id: 'drawing1', label: '蜡笔画' } });
      // 电池
      var bat = this._makePickup('battery', 'batA', g.cx + s * 0.9, 0.06, g.z0 + 0.5);
      this._interactive(bat, { pickup: { kind: 'battery', id: 'batA', label: '电池' } });
    }

    /* ---------------- 浴室：浴缸 / 镜子 / 浴帘 ---------------- */
    if (g.name === 'bath') {
      var tubMat = std({ map: HZ.Tex.get('tile', 2, 2), roughness: 0.28, metalness: 0.06, color: 0xcdd4cd });
      this._box(1.4, 0.6, 1.35, tubMat, g.xFar - s * 0.8, 0.3, g.cz, { collide: true });
      // 浴缸里的黑水
      this._plane(1.26, 1.2, lam({ color: 0x04070a }), g.xFar - s * 0.8, 0.605, g.cz, { x: -Math.PI / 2 });
      // 镜子（雾面，映出模糊人影）
      var mirror = this._plane(0.8, 1.0, lam({
        map: HZ.Tex.get('photo', 1, 1), color: 0x59635f, side: THREE.DoubleSide
      }), g.xNear + s * 0.04, 1.7, g.z0 + 0.7, { y: s > 0 ? -Math.PI / 2 : Math.PI / 2 });
      this._interactive(mirror, { pickup: { kind: 'look', id: 'mirror', label: '模糊的镜子' } });
      this.mirror = mirror;
      // 洗手台
      this._box(0.5, 0.14, 0.85, MAT.tile, g.xNear + s * 0.28, 0.88, g.z0 + 0.7, { collide: true });
      // 浴帘
      var curtain = lam({
        color: 0xa8b2ac, transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, depthWrite: false
      });
      this._box(0.03, 2.0, 1.4, curtain, g.xFar - s * 1.65, 1.05, g.cz, { cast: false });
      // 锈蚀水管
      var pipe = new THREE.Mesh(geo('pipeA', function () {
        return new THREE.CylinderGeometry(0.028, 0.028, 1.8, 6);
      }), MAT.rust);
      pipe.position.set(g.xFar - s * 0.25, 2.1, g.z1 - 0.35);
      pipe.rotation.z = Math.PI / 2;
      pipe.rotation.y = Math.PI / 2;
      this.group.add(pipe);
      var noteB = this._plane(0.24, 0.3, MAT.note, g.xNear + s * 0.3, 0.96, g.z0 + 0.7,
        { x: -Math.PI / 2, z: -0.4 });
      this._interactive(noteB, { pickup: { kind: 'note', id: 'bathNote', label: '湿透的纸条' } });
    }

    /* ---------------- 储物间：纸箱 / 三轮车 / 黑洞 ---------------- */
    if (g.name === 'storage') {
      for (var i = 0; i < 7; i++) {
        var bw = HZ.range(rnd, 0.4, 0.68), bh = HZ.range(rnd, 0.35, 0.62);
        var bx = g.xNear + s * (0.7 + rnd() * (g.depth - 1.5));
        var bz = g.z0 + 0.5 + rnd() * (g.w - 1.0);
        this._box(bw, bh, bw, lam({ map: HZ.Tex.get('newspaper', 1, 1) }), bx, bh / 2, bz,
          { ry: rnd() * 0.6, collide: true });
      }
      // 坏三轮车
      var tri = new THREE.Group();
      tri.position.set(g.xFar - s * 0.9, 0, g.z1 - 0.7);
      var frame = new THREE.Mesh(geo('triF', function () {
        return new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6);
      }), MAT.rust);
      frame.rotation.z = Math.PI / 2.6;
      frame.position.y = 0.32;
      tri.add(frame);
      for (var w2 = 0; w2 < 3; w2++) {
        var wheel = new THREE.Mesh(geo('triW', function () {
          return new THREE.CylinderGeometry(0.15, 0.15, 0.04, 8);
        }), MAT.dark);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(w2 === 0 ? 0.42 : -0.28, 0.15, w2 === 1 ? 0.24 : (w2 === 2 ? -0.24 : 0));
        tri.add(wheel);
      }
      this.group.add(tri);
      // 布娃娃（缺一条腿）
      var rag = new THREE.Group();
      rag.position.set(g.cx, 0.02, g.cz - 0.8);
      var rb = new THREE.Mesh(boxGeo(0.15, 0.24, 0.1), MAT.skin);
      rb.position.y = 0.12; rag.add(rb);
      var rh = new THREE.Mesh(geo('ragH', function () {
        return new THREE.SphereGeometry(0.075, 7, 6);
      }), MAT.skin);
      rh.position.y = 0.3; rag.add(rh);
      var rl = new THREE.Mesh(boxGeo(0.05, 0.18, 0.05), MAT.skin);
      rl.position.set(-0.04, -0.06, 0); rag.add(rl);
      rag.rotation.z = 0.5;
      this.group.add(rag);
      this.ragdoll = rag;
      this._interactive(rh, { pickup: { kind: 'look', id: 'ragdoll', label: '布娃娃' } });

      // 地面黑洞（掉下去 → 回到走廊起点）
      this._plane(1.0, 1.0, lam({ color: 0x000000 }), g.cx + s * 1.6, 0.004, g.cz + 0.4,
        { x: -Math.PI / 2 });
      var hole = this.addCollider(g.cx + s * 1.6 - 0.5, g.cz - 0.1, g.cx + s * 1.6 + 0.5, g.cz + 0.9, 'void');

      // 深处墙上的涂抹
      this._plane(1.5, 1.0, lam({ color: 0x2e0a0a }), g.xFar - s * 0.05, 1.6, g.cz,
        { y: s > 0 ? -Math.PI / 2 : Math.PI / 2 });
      var noteC = this._plane(0.26, 0.34, MAT.note, g.cx - s * 0.5, 0.01, g.cz + 1.0,
        { x: -Math.PI / 2, z: 0.8 });
      this._interactive(noteC, { pickup: { kind: 'note', id: 'storageNote', label: '揉皱的纸' } });
      var bat2 = this._makePickup('battery', 'batB', g.cx + s * 2.6, 0.06, g.cz - 0.5);
      this._interactive(bat2, { pickup: { kind: 'battery', id: 'batB', label: '电池' } });
    }

    /* ---------------- 厨房：料理台 / 冰箱 / 电视 ---------------- */
    if (g.name === 'kitchen') {
      // 料理台 + 水槽
      this._box(0.62, 0.9, 2.0, MAT.rust, g.xFar - s * 0.35, 0.45, g.cz - 0.4, { collide: true });
      this._box(0.4, 0.7, 1.6, MAT.wood, g.xFar - s * 0.25, 2.05, g.cz - 0.4, {});
      // 冰箱（门虚掩，里面有东西）
      var fridge = new THREE.Group();
      fridge.position.set(g.cx + s * 0.6, 0, g.z1 - 0.55);
      var fb = new THREE.Mesh(boxGeo(0.68, 1.65, 0.66), std({ color: 0xa8a89c, roughness: 0.45, metalness: 0.35 }));
      fb.position.y = 0.83; fb.castShadow = true; fridge.add(fb);
      var fd = new THREE.Mesh(boxGeo(0.07, 1.45, 0.6), std({ color: 0x94948a, roughness: 0.45, metalness: 0.35 }));
      fd.position.set(-s * 0.34, 0.8, 0.2); fd.rotation.y = -s * 0.55; fridge.add(fd);
      var innerDoll = new THREE.Mesh(boxGeo(0.14, 0.28, 0.08), MAT.skin);
      innerDoll.position.set(-s * 0.1, 0.5, 0);
      fridge.add(innerDoll);
      this.group.add(fridge);
      this.addCollider(g.cx + s * 0.6 - 0.35, g.z1 - 0.9, g.cx + s * 0.6 + 0.35, g.z1 - 0.2, 'prop');
      this._interactive(innerDoll, { pickup: { kind: 'look', id: 'fridgeDoll', label: '冰箱里的人形玩具' } });

      // 餐桌 + 饭碗
      this._box(1.1, 0.05, 0.85, MAT.wood, g.cx - s * 0.9, 0.74, g.cz + 0.3, { collide: true });
      for (var t = 0; t < 4; t++) {
        this._box(0.06, 0.72, 0.06, MAT.wood,
          g.cx - s * 0.9 + (t < 2 ? -0.45 : 0.45), 0.36,
          g.cz + 0.3 + (t % 2 ? -0.3 : 0.3), {});
      }
      for (var b2 = 0; b2 < 3; b2++) {
        var bw2 = new THREE.Mesh(geo('bowlB', function () {
          return new THREE.CylinderGeometry(0.075, 0.045, 0.055, 7);
        }), lam({ color: 0xc7c0ac }));
        bw2.position.set(g.cx - s * 0.9 + HZ.range(rnd, -0.3, 0.3), 0.79,
          g.cz + 0.3 + HZ.range(rnd, -0.25, 0.25));
        bw2.rotation.z = HZ.range(rnd, -1, 1);
        this.group.add(bw2);
      }

      // 电视（可开关，雪花屏）
      var tvGrp = new THREE.Group();
      tvGrp.position.set(g.xFar - s * 0.9, 0.62, g.z1 - 0.7);
      var tvBody = new THREE.Mesh(boxGeo(0.5, 0.5, 0.62), lam({ color: 0x27251f }));
      tvBody.position.y = 0.25; tvBody.castShadow = true; tvGrp.add(tvBody);
      var screenMat = lam({ color: 0x14161a, emissive: 0x000000 });
      var screen = new THREE.Mesh(planeGeo(0.5, 0.4), screenMat);
      screen.position.set(-s * 0.26, 0.27, 0);
      screen.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
      tvGrp.add(screen);
      // 电视柜
      this._box(0.55, 0.6, 0.75, MAT.wood, g.xFar - s * 0.9, 0.3, g.z1 - 0.7, { collide: true });
      this.group.add(tvGrp);
      var tvLight = new THREE.PointLight(0xaad4ff, 0, 4.5, 2);
      tvLight.position.set(g.xFar - s * 1.3, 0.95, g.z1 - 0.7);
      this.group.add(tvLight);
      this.tv = { group: tvGrp, screen: screen, mat: screenMat, light: tvLight, on: false, static: null };
      var self2 = this;
      tvGrp.traverse(function (o) { if (o.isMesh) self2._interactive(o, { tv: self2.tv }); });
    }
  };

  /* ------------------------------ 走廊道具 ------------------------------ */
  World.prototype._makePickup = function (kind, id, x, y, z) {
    var mesh;
    if (kind === 'battery') {
      mesh = new THREE.Mesh(geo('batG', function () {
        return new THREE.CylinderGeometry(0.028, 0.028, 0.11, 8);
      }), std({ color: 0x2c2f33, roughness: 0.4, metalness: 0.6 }));
      mesh.rotation.z = Math.PI / 2;
    } else {
      mesh = new THREE.Mesh(planeGeo(0.26, 0.34), MAT.note);
    }
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    this.group.add(mesh);
    return mesh;
  };

  World.prototype._props = function () {
    var rnd = HZ.rng(4242), HALF = C.HALF;

    /* 散落旧报纸 */
    for (var i = 0; i < 11; i++) {
      var z = -3 - rnd() * (C.LEN - 6);
      var x = HZ.range(rnd, -HALF + 0.3, HALF - 0.3);
      var paper = this._plane(0.5, 0.68, MAT.news, x, 0.006, z,
        { x: -Math.PI / 2, z: rnd() * Math.PI });
      this._interactive(paper, {
        pickup: { kind: 'note', id: i === 0 ? 'news0' : 'news' + i, label: '旧报纸' }
      });
    }

    /* 面朝墙壁的椅子（好像有人坐过） */
    var chair = new THREE.Group();
    chair.position.set(-0.55, 0, -18.5);
    var seat = new THREE.Mesh(boxGeo(0.46, 0.06, 0.46), MAT.wood);
    seat.position.y = 0.44; seat.castShadow = true; chair.add(seat);
    for (var l = 0; l < 4; l++) {
      var leg = new THREE.Mesh(boxGeo(0.05, 0.44, 0.05), MAT.wood);
      leg.position.set(l < 2 ? -0.19 : 0.19, 0.22, l % 2 ? -0.19 : 0.19);
      chair.add(leg);
    }
    var back = new THREE.Mesh(boxGeo(0.46, 0.5, 0.05), MAT.wood);
    back.position.set(0, 0.7, -0.2); chair.add(back);
    chair.rotation.y = Math.PI / 2 + 0.15;   // 面朝左墙
    this.group.add(chair);
    this.addCollider(-0.85, -18.8, -0.25, -18.2, 'prop');
    this.chair = chair;

    /* 翻倒的柜子 */
    this._box(0.9, 0.4, 0.5, MAT.wood, HALF - 0.55, 0.2, -27, { ry: 0.3, collide: true });
    /* 散落玩具积木 */
    for (var b = 0; b < 9; b++) {
      var cols = [0xa03c34, 0x2f5f7a, 0xb0a24a, 0x4a7a52];
      this._box(0.09, 0.09, 0.09, lam({ color: cols[b % 4] }),
        HZ.range(rnd, -HALF + 0.3, HALF - 0.3), 0.045, -20 - rnd() * 6,
        { ry: rnd() * 1.5 });
    }
    /* 小皮球 */
    var ball = new THREE.Mesh(geo('ball', function () {
      return new THREE.SphereGeometry(0.11, 8, 6);
    }), lam({ color: 0x9c3c3c }));
    ball.position.set(0.5, 0.11, -13.2);
    ball.castShadow = true;
    this.group.add(ball);
    this.ball = ball;

    /* 碎玻璃（灯罩） */
    for (var g2 = 0; g2 < 10; g2++) {
      this._box(0.06, 0.006, 0.09,
        std({ color: 0xb8ccc4, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.5 }),
        HZ.range(rnd, -HALF + 0.2, HALF - 0.2), 0.004, -9 - rnd() * 3, { ry: rnd() * Math.PI });
    }

    /* 墙上的旧海报 / 报纸糊窗 */
    this._plane(0.7, 0.95, MAT.news, -HALF + 0.02, 1.7, -21.5, { y: Math.PI / 2 });
    this._plane(0.6, 0.85, MAT.news, HALF - 0.02, 1.6, -35.5, { y: -Math.PI / 2 });

    /* 尽头门前的地藏小像（低模） */
    var jizo = new THREE.Group();
    jizo.position.set(HALF - 0.4, 0, -C.LEN + 1.2);
    var jb = new THREE.Mesh(geo('jizoB', function () {
      return new THREE.CylinderGeometry(0.12, 0.16, 0.42, 7);
    }), lam({ color: 0x8a8a80 }));
    jb.position.y = 0.21; jizo.add(jb);
    var jh = new THREE.Mesh(geo('jizoH', function () {
      return new THREE.SphereGeometry(0.11, 7, 6);
    }), lam({ color: 0x8a8a80 }));
    jh.position.y = 0.52; jizo.add(jh);
    // 红色围兜
    var bib = new THREE.Mesh(planeGeo(0.2, 0.22), lam({ color: 0x7e1c1c, side: THREE.DoubleSide }));
    bib.position.set(0, 0.32, -0.14); jizo.add(bib);
    this.group.add(jizo);
    this._interactive(jh, { pickup: { kind: 'look', id: 'jizo', label: '地藏像' } });
  };

  /* ------------------------------ 灯光 ------------------------------ */
  World.prototype._lights = function () {
    // 冷蓝绿环境光
    this.ambient = new THREE.AmbientLight(0x1e2c38, 0.34);
    this.group.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0x203040, 0x0a0c0e, 0.2);
    this.group.add(this.hemi);

    // 走廊荧光灯
    for (var z = -3.5; z > -C.LEN + 1; z -= C.SPAN) {
      this._fluorescent(z);
    }

    // 房间灯
    var self = this;
    var roomLights = {
      bath: { c: 0x9fc4bc, i: 0.6, f: 3 },
      kitchen: { c: 0xc4ccb8, i: 0.7, f: 1.5 },
      storage: { c: 0x7888a0, i: 0.4, f: 0.6 },
      washitsu: { c: 0xb0a078, i: 0.3, f: 0.4 }
    };
    Object.keys(roomLights).forEach(function (name) {
      var g = self.rooms[name];
      if (!g) return;
      var cfg = roomLights[name];
      var pl = new THREE.PointLight(cfg.c, cfg.i, Math.max(8, g.depth + 4), 2);
      pl.position.set(g.cx, C.H - 0.35, g.cz);
      self.group.add(pl);
      self.lights.push({ light: pl, flicker: cfg.f, base: cfg.i, room: name });
    });
  };

  World.prototype._fluorescent = function (z) {
    var grp = new THREE.Group();
    grp.position.set(0, C.H - 0.14, z);
    var base = new THREE.Mesh(boxGeo(0.3, 0.08, 1.5), lam({ color: 0x93938c }));
    grp.add(base);
    var tubeMat = lam({ color: 0xcfe4d8, emissive: 0x9fe0c8 });
    var tube = new THREE.Mesh(boxGeo(0.1, 0.05, 1.25), tubeMat);
    tube.position.y = -0.07;
    grp.add(tube);
    var light = new THREE.PointLight(0x9fdcc8, 0.9, C.SPAN + 4, 1.7);
    light.position.y = -0.4;
    grp.add(light);
    this.group.add(grp);
    var entry = {
      light: light, tube: tube, tubeMat: tubeMat, group: grp,
      flicker: HZ.range(HZ.rng(Math.abs(Math.floor(z * 17))), 0.4, 5),
      base: 0.45, dead: false, corridor: true
    };
    this.lights.push(entry);
    this.corridorLights.push(entry);
    return entry;
  };

  /* ------------------------------ 空气灰尘 ------------------------------ */
  World.prototype._dust = function () {
    var rnd = HZ.rng(5150);
    var mat = lam({
      map: HZ.Tex.get('dust', 1, 1), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xa8c4bc, opacity: 0.42
    });
    var g = planeGeo(1, 1);
    for (var i = 0; i < 140; i++) {
      var m = new THREE.Mesh(g, mat);
      m.position.set(
        HZ.range(rnd, -C.HALF + 0.2, C.HALF - 0.2),
        HZ.range(rnd, 0.15, C.H - 0.25),
        HZ.range(rnd, -C.LEN + 1, 2));
      m.userData.dust = {
        phase: rnd() * 6.283,
        spd: HZ.range(rnd, 0.12, 0.5),
        amp: HZ.range(rnd, 0.05, 0.22),
        size: HZ.range(rnd, 0.012, 0.055),
        drift: HZ.range(rnd, -0.03, 0.03)
      };
      m.castShadow = false; m.receiveShadow = false;
      m.visible = HZ.settings.dust;
      this.group.add(m);
      this.dust.push(m);
    }
  };

  /* ------------------------------ 每帧 ------------------------------ */
  World.prototype.update = function (dt, time, camPos, camQuat) {
    /* 灯光闪烁 */
    for (var i = 0; i < this.lights.length; i++) {
      var l = this.lights[i];
      if (l.dead || (l.corridor && !this.corridorPower)) {
        l.light.intensity = 0;
        if (l.tubeMat) l.tubeMat.emissive.setRGB(0.02, 0.03, 0.03);
        continue;
      }
      var v = l.base;
      if (l.flicker > 0) {
        var n = Math.sin(time * (2.7 + l.flicker * 1.9) + i * 7.7) +
          Math.sin(time * (11 + l.flicker * 7) + i * 3.1) * 0.5;
        var burst = Math.pow(Math.max(0, Math.sin(time * 0.63 + i * 1.7)), 9);
        v *= HZ.clamp(0.84 + n * 0.09 + burst * 0.45, 0.15, 1.35);
        if (burst > 0.7 && Math.sin(time * 43 + i * 13) > 0.96) v *= 0.06;
      }
      l.light.intensity = v;
      if (l.tubeMat) {
        var e = HZ.clamp(v / Math.max(0.001, l.base), 0, 1.4);
        l.tubeMat.emissive.setRGB(0.55 * e, 0.85 * e, 0.74 * e);
      }
    }

    /* 灰尘 */
    if (HZ.settings.dust) {
      for (var d = 0; d < this.dust.length; d++) {
        var m = this.dust[d], u = m.userData.dust;
        m.position.y += Math.sin(time * u.spd + u.phase) * u.amp * dt;
        m.position.x += u.drift * dt;
        m.scale.setScalar(u.size);
        if (camQuat) m.quaternion.copy(camQuat);   // billboard
      }
    }

    /* 电视雪花 */
    if (this.tv && this.tv.on) {
      if (this.tv.static) {
        this.tv.static.update();
        this.tv.light.intensity = 0.45 + Math.random() * 0.35;
      }
    }

    /* 门动画 */
    for (var k = 0; k < this.doors.length; k++) {
      var door = this.doors[k];
      if (door.state === 'opening') {
        door.angle = HZ.damp(door.angle, door.target, 3.4, dt);
        door.group.rotation.y = door.angle;
        if (Math.abs(door.angle - door.target) < 0.015) {
          door.angle = door.target;
          door.group.rotation.y = door.angle;
          door.state = door.open ? 'open' : 'closed';
        }
      } else if (door.state === 'rattling') {
        door.rattleT += dt;
        door.group.rotation.y = door.angle + Math.sin(door.rattleT * 34) * 0.05;
        if (door.rattleT > 0.7) {
          door.group.rotation.y = door.angle;
          door.state = door.open ? 'open' : 'closed';
        }
      }
    }

    /* 触发区（沿 -z 前进） */
    if (camPos) {
      for (var t = 0; t < this.triggerZones.length; t++) {
        var zone = this.triggerZones[t];
        if (!zone.fired && camPos.z < zone.z) {
          zone.fired = true;
          HZ.bus.emit('trigger', zone.id);
        }
      }
    }
  };

  /* ------------------------------ 交互 ------------------------------ */
  World.prototype.interact = function (obj, game) {
    var ud = obj.userData || {};
    if (ud.door) return this.useDoor(ud.door, game);
    if (ud.pickup) return this.usePickup(obj, game);
    if (ud.lightSwitch) return this.useSwitch(game);
    if (ud.tv) return this.toggleTV(game);
    if (ud.portal) { game.loopWorld(); return true; }
    if (ud.entrance) {
      game.audio.play('rattle');
      HZ.bus.emit('subtitle', '玄関の扉は開かない。（玄关的门打不开。）');
      return true;
    }
    return false;
  };

  World.prototype.usePickup = function (obj, game) {
    var p = obj.userData.pickup;
    if (p.kind === 'battery') {
      game.player.battery = Math.min(1, game.player.battery + 0.45);
      game.audio.play('pickup');
      HZ.bus.emit('toast', '拾取了电池（手电筒电量恢复）');
      if (obj.parent) obj.parent.remove(obj);
      var idx = this.interactives.indexOf(obj);
      if (idx >= 0) this.interactives.splice(idx, 1);
      return true;
    }
    game.audio.play('paper');
    game.readNote(p.id);
    return true;
  };

  World.prototype.useDoor = function (door, game) {
    if (door.locked) {
      door.state = 'rattling';
      door.rattleT = 0;
      game.audio.play('rattle');
      HZ.bus.emit('subtitle', '鍵がかかっている。（锁着。）');
      return true;
    }
    if (door.open) {
      door.target = 0; door.open = false; door.state = 'opening';
      door.collider.active = true;
      game.audio.play('doorClose');
    } else {
      door.target = -door.spec.side * (Math.PI / 2 - 0.15);
      door.open = true; door.state = 'opening';
      door.collider.active = false;
      game.audio.play('doorOpen');
    }
    return true;
  };

  World.prototype.useSwitch = function (game) {
    if (this.loopCount >= 4) {
      // 第四圈起：开关失灵
      game.audio.play('switch');
      HZ.bus.emit('subtitle', '开关咔哒作响，但没有反应。');
      return true;
    }
    this.corridorPower = !this.corridorPower;
    game.audio.play('switch');
    if (!this.corridorPower) game.audio.play('lightsOut');
    HZ.bus.emit('toast', this.corridorPower ? '走廊的灯亮了' : '走廊陷入黑暗');
    return true;
  };

  World.prototype.toggleTV = function (game) {
    var tv = this.tv;
    if (!tv) return false;
    tv.on = !tv.on;
    if (tv.on) {
      if (!tv.static) tv.static = HZ.Tex.makeStatic();
      tv.mat.map = tv.static.texture;
      tv.mat.emissive.setRGB(0.9, 0.95, 1.0);
      tv.mat.needsUpdate = true;
      tv.light.intensity = 0.5;
      game.audio.play('tvOn');
      HZ.bus.emit('subtitle', '只有雪花。……以及很小声的、像人声的东西。');
    } else {
      tv.mat.map = null;
      tv.mat.emissive.setRGB(0, 0, 0);
      tv.mat.needsUpdate = true;
      tv.light.intensity = 0;
      game.audio.play('tvOff');
    }
    return true;
  };

  /* ------------------------------ 循环演化 ------------------------------ */
  World.prototype.applyLoop = function (n) {
    this.loopCount = n;
    for (var i = 0; i < this.triggerZones.length; i++) this.triggerZones[i].fired = false;

    var unlockAt = { washitsu: 1, kitchen: 2, bath: 3, storage: 4 };
    for (var d = 0; d < this.doors.length; d++) {
      var door = this.doors[d];
      var room = door.spec.room;
      door.locked = n < (unlockAt[room] || 99);

      // 第 3 圈起：未锁的门自己虚掩着开一条缝
      var shouldAjar = n >= 3 && !door.locked;
      if (shouldAjar && !door.open) {
        door.open = true;
        door.target = -door.spec.side * 0.28;
        door.state = 'opening';
        door.collider.active = false;
      } else if (!shouldAjar && door.open && n < 3) {
        door.open = false;
        door.target = 0;
        door.state = 'opening';
        door.collider.active = true;
      }
    }

    // 灯光腐化：每圈杀掉一盏走廊灯，第 4 圈起全灭
    for (var c = 0; c < this.corridorLights.length; c++) {
      this.corridorLights[c].dead = (c < Math.max(0, n - 1));
      if (n >= 4) this.corridorLights[c].dead = true;
    }
    this.corridorPower = n < 4;

    // 环境光随循环变冷变暗
    this.ambient.intensity = Math.max(0.16, 0.75 - n * 0.1);
    this.ambient.color.setHex(n >= 4 ? 0x121c26 : 0x1e2c38);
    if (this.scene && this.scene.fog) {
      this.scene.fog.density = 0.055 + n * 0.012;
    }

    // 神龛遗照：第 3 圈起变成全黑
    if (n >= 3 && this.shrine && this.shrine.photo) {
      this.shrine.photo.material = lam({ color: 0x050505, side: THREE.DoubleSide });
    }

    // 椅子：每圈转向玩家
    if (this.chair) {
      this.chair.rotation.y = Math.PI / 2 + 0.15 - Math.min(n, 4) * 0.42;
    }

    // 皮球：每圈移动位置（看起来有人玩过）
    if (this.ball) {
      this.ball.position.set(
        (n % 2 ? 0.6 : -0.7), 0.11, -13.2 - n * 2.4);
    }
  };

  /** 第 6 圈：和室出现跪坐的"一家人" */
  World.prototype.spawnFamily = function () {
    if (this.mannequins.length || !this.rooms.washitsu) return;
    var g = this.rooms.washitsu;
    for (var i = 0; i < 3; i++) {
      var pos = new THREE.Vector3(
        g.cx + g.side * (i - 1) * 0.02 + (i - 1) * 0.15,
        0, g.cz + (i - 1) * 0.85);
      var m = new HZ.Mannequin(this.figuresGroup, pos, {
        ry: g.side > 0 ? -Math.PI / 2 : Math.PI / 2,
        scale: i === 2 ? 0.66 : 0.82   // 第三个更小（孩子）
      });
      this.mannequins.push(m);
    }
    return this.mannequins;
  };

  World.prototype.C = C;
  HZ.World = World;
  HZ.WORLD_CONST = C;
})();
