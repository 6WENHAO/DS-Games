// ============ 场景构建: 废弃公寓 ============
const World = (() => {
  let scene = null;
  const colliders = [];      // {minX,maxX,minZ,maxZ} AABB
  const interactables = [];  // {pos, radius, label, onUse, enabled}
  const doors = [];          // {group, panel, open, angle, target, locked, ...}
  let flickerLights = [];    // 荧光灯
  let dustParticles = null;
  const CORRIDOR_W = 2.4, WALL_H = 2.7;

  // 走廊总体: 沿 -Z 方向延伸
  // 段落: 入口厅(z: 2~-4) → 长走廊(z: -4~-40) → 尽头拐角(x+ 方向) → 隐藏区
  function init(sc) {
    scene = sc;
    buildEntry();
    buildCorridor();
    buildRooms();
    buildTurnSection();
    buildHiddenArea();
    buildProps();
    buildDust();
  }

  // ---------- 工具 ----------
  function box(w, h, d, mat, x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
    return m;
  }
  function plane(w, h, mat, x, y, z, rx = 0, ry = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.x = rx; m.rotation.y = ry;
    scene.add(m);
    return m;
  }
  function addCollider(minX, maxX, minZ, maxZ) {
    colliders.push({ minX, maxX, minZ, maxZ });
  }
  function wallWithCollider(w, h, d, mat, x, y, z) {
    const m = box(w, h, d, mat, x, y, z);
    addCollider(x - w / 2 - 0.08, x + w / 2 + 0.08, z - d / 2 - 0.08, z + d / 2 + 0.08);
    return m;
  }
  function addInteract(x, y, z, radius, label, onUse) {
    const it = { pos: new THREE.Vector3(x, y, z), radius, label, onUse, enabled: true };
    interactables.push(it);
    return it;
  }

  // 材质
  const M = {};
  function mats() {
    M.wall = Tex.mat('wallpaper', {}, [2, 1.4]);
    M.wallPeel = Tex.mat('wallPeel', {}, [2, 1.4]);
    M.floor = Tex.mat('floorWood', {}, [1.2, 1.2]);
    M.ceil = Tex.mat('ceiling', {}, [1.2, 1.2]);
    M.concrete = Tex.mat('concrete', {}, [1.5, 1.5]);
    M.boards = Tex.mat('boards');
    M.tatami = Tex.mat('tatami', {}, [1.5, 1.5]);
    M.metal = Tex.mat('elevatorMetal');
    M.dark = new THREE.MeshLambertMaterial({ color: 0x0a0c0b });
  }

  // ---------- 入口厅 ----------
  function buildEntry() {
    mats();
    // 地板/天花
    plane(8, 8, M.floor, 0, 0, -1, -Math.PI / 2);
    plane(8, 8, M.ceil, 0, WALL_H, -1, Math.PI / 2);
    // 四周墙 (入口厅 x: -4~4, z: 2~-4)
    wallWithCollider(8, WALL_H, 0.3, M.wall, 0, WALL_H / 2, 2.5);        // 背墙
    wallWithCollider(0.3, WALL_H, 7, M.wallPeel, -4, WALL_H / 2, -0.9);  // 左墙
    wallWithCollider(0.3, WALL_H, 7, M.wall, 4, WALL_H / 2, -0.9);      // 右墙
    // 前墙留走廊口 (宽 2.4 居中)
    wallWithCollider(2.8, WALL_H, 0.3, M.wall, -2.6, WALL_H / 2, -4.2);
    wallWithCollider(2.8, WALL_H, 0.3, M.wall, 2.6, WALL_H / 2, -4.2);
    plane(2.4, 0.5, M.wall, 0, WALL_H - 0.25, -4.2 + 0.16); // 门楣

    // 被木板封死的入口大门 (背墙上)
    box(1.6, 2.2, 0.12, M.boards, 0, 1.1, 2.32);
    World.sealedDoorInteract = addInteract(0, 1.2, 2.3, 2, '被钉死的大门', () => {
      Events.onSealedDoor();
    });

    // 电梯 (左墙) — 永远不来
    box(1.7, 2.3, 0.14, M.metal, -3.9, 1.15, -1.8, Math.PI / 2);
    const btn = box(0.12, 0.18, 0.12, new THREE.MeshLambertMaterial({ color: 0x8a8578 }), -3.85, 1.25, -0.6);
    addInteract(-3.85, 1.25, -1.2, 1.6, '呼叫电梯', () => Events.onElevator());

    // 布告栏
    plane(1.4, 1, Tex.mat('poster', {}, undefined, 23), 3.83, 1.6, -1.5, 0, -Math.PI / 2);
  }

  // ---------- 主走廊 ----------
  function buildCorridor() {
    const L = 36; // z: -4 ~ -40
    const zc = -4 - L / 2;
    plane(CORRIDOR_W, L, M.floor, 0, 0, zc, -Math.PI / 2);
    plane(CORRIDOR_W, L, M.ceil, 0, WALL_H, zc, Math.PI / 2);
    // 左右墙分段 (留出房门位置)
    // 门位于 z = -8, -14, -20, -26, -32 (左右交错)
    const doorZs = { left: [-8, -20, -32], right: [-14, -26] };
    buildCorridorWall(-CORRIDOR_W / 2, doorZs.left, true);
    buildCorridorWall(CORRIDOR_W / 2, doorZs.right, false);
    // 尽头墙 (z=-40) 留右侧拐角口
    wallWithCollider(2.0, WALL_H, 0.3, M.wallPeel, -1.2, WALL_H / 2, -40.1);

    // 荧光灯
    for (let i = 0; i < 5; i++) {
      const z = -7 - i * 7;
      const fixture = box(0.9, 0.06, 0.22, new THREE.MeshLambertMaterial({ color: 0xcccccc, emissive: 0x99aa99, emissiveIntensity: 0.7 }), 0, WALL_H - 0.05, z);
      const light = new THREE.PointLight(0xbfd8c8, 0.78, 9, 1.5);
      light.position.set(0, WALL_H - 0.3, z);
      scene.add(light);
      flickerLights.push({ light, fixture, base: 0.78, t: Math.random() * 10, broken: i === 2 });
      if (i === 2) { light.intensity = 0; fixture.material = new THREE.MeshLambertMaterial({ color: 0x4a4a48 }); }
    }
  }

  function buildCorridorWall(x, doorZList, isLeft) {
    // 从 z=-4 到 z=-40, 在 doorZ 处留 1.0 宽门洞
    let segStart = -4;
    const zEnd = -40;
    const sorted = [...doorZList].sort((a, b) => b - a);
    sorted.forEach(dz => {
      const gapA = dz + 0.55, gapB = dz - 0.55;
      const len = segStart - gapA;
      if (len > 0.05) {
        const zc = segStart - len / 2;
        wallWithCollider(0.3, WALL_H, len, Math.random() < 0.4 ? M.wallPeel : M.wall, x, WALL_H / 2, zc);
      }
      // 门楣
      plane(1.1, 0.6, M.wall, x + (isLeft ? 0.14 : -0.14), WALL_H - 0.3, dz, 0, isLeft ? Math.PI / 2 : -Math.PI / 2);
      segStart = gapB;
    });
    const lastLen = segStart - zEnd;
    if (lastLen > 0.05) {
      wallWithCollider(0.3, WALL_H, lastLen, M.wall, x, WALL_H / 2, segStart - lastLen / 2);
    }
  }

  // ---------- 门 ----------
  function makeDoor(x, z, ry, plateText, opts = {}) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = ry;
    // 门框
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x3a2e20 });
    const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.16), frameMat);
    f1.position.set(-0.55, 1.1, 0);
    const f2 = f1.clone(); f2.position.x = 0.55;
    const f3 = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.08, 0.16), frameMat);
    f3.position.set(0, 2.24, 0);
    group.add(f1, f2, f3);
    // 门板 (铰链在 -0.5 处)
    const pivot = new THREE.Group();
    pivot.position.set(-0.5, 0, 0);
    const panel = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 2.16, 0.07),
      new THREE.MeshLambertMaterial({ map: Tex.get('doorWood', undefined, opts.seed || 301) })
    );
    panel.position.set(0.5, 1.08, 0);
    pivot.add(panel);
    // 门把手
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5),
      new THREE.MeshLambertMaterial({ color: 0x9a9484 }));
    knob.position.set(0.88, 1.02, 0.08);
    pivot.add(knob);
    group.add(pivot);
    // 门牌
    if (plateText) {
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(0.28, 0.14),
        new THREE.MeshLambertMaterial({ map: Tex.get('doorPlate', undefined, plateText) })
      );
      plate.position.set(0, 2.0, 0.1);
      group.add(plate);
    }
    scene.add(group);

    const door = {
      group, pivot, x, z, ry,
      open: false, angle: 0, targetAngle: 0,
      locked: opts.locked || false,
      lockedMsg: opts.lockedMsg || '锁住了。',
      collider: null,
      plateText,
    };
    // 关门时的碰撞
    door.collider = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    updateDoorCollider(door);
    colliders.push(door.collider);
    doors.push(door);

    const inter = addInteract(x, 1.2, z, 1.7, opts.label || (door.locked ? '开门' : '开门'), () => {
      if (door.locked) {
        Sfx.doorLocked();
        Events.onLockedDoor(door);
        return;
      }
      door.open = !door.open;
      door.targetAngle = door.open ? (opts.inward ? -1.9 : 1.9) : 0;
      Sfx.doorCreak(door.open);
      if (opts.onOpen && door.open) opts.onOpen(door);
    });
    door.interact = inter;
    return door;
  }

  function updateDoorCollider(door) {
    const c = door.collider;
    if (Math.abs(door.angle) > 0.6) {
      // 门开了, 移除碰撞 (移到远处)
      c.minX = 9999; c.maxX = 9999; c.minZ = 9999; c.maxZ = 9999;
      return;
    }
    // 依据朝向计算 AABB
    const along = Math.abs(Math.sin(door.ry)) > 0.5; // ry=±90°: 门板沿 z 轴
    if (along) {
      c.minX = door.x - 0.18; c.maxX = door.x + 0.18;
      c.minZ = door.z - 0.62; c.maxZ = door.z + 0.62;
    } else {
      c.minX = door.x - 0.62; c.maxX = door.x + 0.62;
      c.minZ = door.z - 0.18; c.maxZ = door.z + 0.18;
    }
  }

  // ---------- 房间 ----------
  function buildRooms() {
    // 201 (左 z=-8): 可进入 — 榻榻米房, 有纸条
    makeDoor(-CORRIDOR_W / 2, -8, Math.PI / 2, '201', {
      seed: 311,
      onOpen: () => Events.onRoomOpened('201'),
    });
    buildRoom201();

    // 203 (左 z=-20): 锁死
    makeDoor(-CORRIDOR_W / 2, -20, Math.PI / 2, '203', {
      locked: true, lockedMsg: '门后传来轻微的摩擦声。',
      seed: 313,
    });

    // 205 (左 z=-32): 可进入 — 佛坛房间, 关键道具
    makeDoor(-CORRIDOR_W / 2, -32, Math.PI / 2, '205', {
      seed: 315,
      onOpen: () => Events.onRoomOpened('205'),
    });
    buildRoom205();

    // 202 (右 z=-14): 锁死 → 事件后解锁 (电视房)
    makeDoor(CORRIDOR_W / 2, -14, -Math.PI / 2, '202', {
      locked: true, lockedMsg: '锁住了。里面传来电视的杂音…?',
      seed: 312,
    });
    buildRoom202();

    // 204 (右 z=-26): 门虚掩 — 儿童房
    makeDoor(CORRIDOR_W / 2, -26, -Math.PI / 2, '204', {
      seed: 314,
      onOpen: () => Events.onRoomOpened('204'),
    });
    buildRoom204();
  }

  function roomShell(cx, cz, w, d, floorMat, doorSide, doorPos) {
    // doorSide: 'e'|'w' 表示门在东/西墙 (x+ / x-)
    plane(w, d, floorMat, cx, 0.005, cz, -Math.PI / 2);
    plane(w, d, M.ceil, cx, WALL_H, cz, Math.PI / 2);
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    // 北/南墙
    wallWithCollider(w, WALL_H, 0.25, M.wall, cx, WALL_H / 2, z0);
    wallWithCollider(w, WALL_H, 0.25, M.wallPeel, cx, WALL_H / 2, z1);
    // 东/西墙 (门侧留洞)
    ['w', 'e'].forEach(side => {
      const x = side === 'w' ? x0 : x1;
      if (side === doorSide) {
        // 留 1.1 门洞于 doorPos
        const segA = doorPos - 0.55 - z0, segB = z1 - (doorPos + 0.55);
        if (segA > 0.05) wallWithCollider(0.25, WALL_H, segA, M.wall, x, WALL_H / 2, z0 + segA / 2);
        if (segB > 0.05) wallWithCollider(0.25, WALL_H, segB, M.wall, x, WALL_H / 2, doorPos + 0.55 + segB / 2);
      } else {
        wallWithCollider(0.25, WALL_H, d, M.wall, x, WALL_H / 2, cz);
      }
    });
  }

  function buildRoom201() {
    // 左侧房间: x -6.2~-1.5, z -10.3~-5.8
    roomShell(-3.85, -8.05, 4.4, 4.5, M.tatami, 'e', -8);
    // 矮桌
    box(1.1, 0.35, 0.7, new THREE.MeshLambertMaterial({ color: 0x3a2c1c }), -4.2, 0.18, -8.4);
    // 坐垫
    box(0.5, 0.08, 0.5, new THREE.MeshLambertMaterial({ color: 0x5a4a3a }), -4.2, 0.04, -7.6);
    // 倒下的衣柜
    box(0.6, 1.8, 1.7, new THREE.MeshLambertMaterial({ map: Tex.get('doorWood', undefined, 321) }), -5.6, 0.31, -9.2, 0.12);
    colliders.push({ minX: -6.1, maxX: -4.9, minZ: -10.1, maxZ: -8.3 });
    // 纸条 1
    plane(0.3, 0.35, Tex.mat('newspaper'), -4.2, 0.37, -8.3, -Math.PI / 2, 0.3);
    addInteract(-4.2, 0.5, -8.3, 1.4, '拾起纸条', () => Events.readNote(0));
    // 封死的窗
    box(1.4, 1.3, 0.1, M.boards, -6.05, 1.5, -7.6, 0, Math.PI / 2);
  }

  function buildRoom202() {
    // 右侧: x 1.5~6.2, z -16.3~-11.8, 电视房 (初始锁定)
    roomShell(3.85, -14.05, 4.4, 4.5, M.floor, 'w', -14);
    // 老电视
    const tv = box(0.8, 0.62, 0.6, new THREE.MeshLambertMaterial({ color: 0x2c2a26 }), 5.2, 0.65, -15.3, -0.5);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.42),
      new THREE.MeshBasicMaterial({ map: Tex.get('tvStatic'), color: 0x888888 }));
    screen.position.set(4.93, 0.68, -15.03);
    screen.rotation.y = -0.5 + Math.PI;
    scene.add(screen);
    World.tvScreen = screen;
    box(0.9, 0.34, 0.7, new THREE.MeshLambertMaterial({ color: 0x3a3026 }), 5.2, 0.17, -15.3, -0.5);
    colliders.push({ minX: 4.5, maxX: 5.9, minZ: -16, maxZ: -14.6 });
    addInteract(5.0, 0.8, -15.1, 1.6, '关掉电视', () => Events.onTV());
    // 一圈报纸
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      plane(0.34, 0.4, Tex.mat('newspaper'), 3.6 + Math.cos(a) * 0.9, 0.012 + i * 0.002, -13.6 + Math.sin(a) * 0.9, -Math.PI / 2, a);
    }
    // 纸条 3 (走廊事件后进入)
    plane(0.3, 0.35, Tex.mat('newspaper'), 3.6, 0.02, -13.6, -Math.PI / 2, 1.2);
    addInteract(3.6, 0.2, -13.6, 1.2, '拾起纸条', () => Events.readNote(2));
  }

  function buildRoom204() {
    // 右侧: 儿童房 z -28.3~-23.8
    roomShell(3.85, -26.05, 4.4, 4.5, M.floor, 'w', -26);
    // 小床
    box(0.9, 0.4, 1.6, new THREE.MeshLambertMaterial({ color: 0x4a4038 }), 5.5, 0.2, -27.2);
    colliders.push({ minX: 5.0, maxX: 6.0, minZ: -28.1, maxZ: -26.3 });
    // 积木
    const cols = [0x7a4a3a, 0x3a5a4a, 0x5a5a3a, 0x4a3a5a];
    for (let i = 0; i < 8; i++) {
      box(0.12, 0.12, 0.12, new THREE.MeshLambertMaterial({ color: cols[i % 4] }),
        3.2 + Math.random() * 1.4, 0.06, -25.2 - Math.random() * 1.4, Math.random() * 3);
    }
    // 独眼玩偶 (跟随视线事件的道具)
    const dollBody = box(0.22, 0.3, 0.16, new THREE.MeshLambertMaterial({ color: 0x8a7a68 }), 2.6, 0.15, -27.4, 2.6);
    const dollHead = box(0.18, 0.18, 0.16, new THREE.MeshLambertMaterial({ map: Tex.get('monsterFace') }), 2.6, 0.39, -27.4, 2.6);
    World.doll = dollHead;
    addInteract(2.6, 0.4, -27.4, 1.4, '玩偶', () => Events.onDoll());
    // 墙上蜡笔画
    plane(0.9, 0.7, Tex.mat('poster', {}, undefined, 77), 3.85, 1.5, -28.15, 0, 0);
  }

  function buildRoom205() {
    // 左侧: 佛坛房 z -34.3~-29.8
    roomShell(-3.85, -32.05, 4.4, 4.5, M.tatami, 'e', -32);
    // 佛坛柜
    box(1.2, 1.5, 0.6, new THREE.MeshLambertMaterial({ map: Tex.get('doorWood', undefined, 331) }), -5.5, 0.75, -32.05);
    colliders.push({ minX: -6.1, maxX: -4.9, minZ: -32.5, maxZ: -31.6 });
    // 烛台微光
    const candle = new THREE.PointLight(0xd8a868, 0.0, 4, 2);
    candle.position.set(-5.3, 1.7, -32.05);
    scene.add(candle);
    World.candleLight = candle;
    // 铜铃 (关键道具)
    const bell = box(0.12, 0.16, 0.12, new THREE.MeshLambertMaterial({ color: 0x8a7a48, emissive: 0x332811, emissiveIntensity: 0.4 }), -5.35, 1.62, -31.9);
    World.bellMesh = bell;
    addInteract(-5.35, 1.5, -31.9, 1.5, '古旧的铜铃', () => Events.onBell());
    // 纸条 2
    plane(0.3, 0.35, Tex.mat('newspaper'), -3.4, 0.02, -30.8, -Math.PI / 2, -0.4);
    addInteract(-3.4, 0.2, -30.8, 1.2, '拾起纸条', () => Events.readNote(1));
    // 墙面纸符
    plane(0.16, 0.4, new THREE.MeshLambertMaterial({ map: Tex.get('ofuda') }), -5.7, 1.9, -30.5, 0, Math.PI / 2);
    plane(0.16, 0.4, new THREE.MeshLambertMaterial({ map: Tex.get('ofuda') }), -5.7, 1.7, -33.4, 0, Math.PI / 2);
  }

  // ---------- 尽头拐角 ----------
  function buildTurnSection() {
    // 走廊尽头 z=-40 右转: x 0~14, z -40~-42.4 的横向走廊
    const L = 14;
    plane(L + 0.8, CORRIDOR_W, M.floor, 6.9, 0.002, -41.2, -Math.PI / 2);
    plane(L + 0.8, CORRIDOR_W, M.ceil, 6.9, WALL_H, -41.2, Math.PI / 2);
    // 南墙 (在 x 11.95~13.05 留纸符门洞, 通向隐藏回廊)
    wallWithCollider(12.45, WALL_H, 0.3, M.wallPeel, 5.725, WALL_H / 2, -42.55);
    wallWithCollider(1.45, WALL_H, 0.3, M.wallPeel, 13.775, WALL_H / 2, -42.55);
    plane(1.2, 0.5, M.wallPeel, 12.5, WALL_H - 0.25, -42.39); // 门楣 (北面)
    plane(1.2, 0.5, M.concrete, 12.5, WALL_H - 0.25, -42.71, 0, Math.PI); // 门楣 (南面)
    wallWithCollider(13.4, WALL_H, 0.3, M.wall, 7.9, WALL_H / 2, -39.95); // 北墙 (补齐拐角缺口)
    wallWithCollider(0.3, WALL_H, 2.8, M.wall, 14.2, WALL_H / 2, -41.2); // 东端墙
    wallWithCollider(0.3, WALL_H, 2.8, M.wallPeel, -0.3, WALL_H / 2, -41.2); // 西端墙 (封死漏空)

    // 尽头的纸符门 (隐藏区入口, 开在南墙) — 初始锁定
    const fuda = makeDoor(12.5, -42.55, 0, '???', {
      locked: true,
      lockedMsg: '门上贴满了纸符。似乎需要什么来解开。',
      seed: 341,
      onOpen: () => Events.onFudaDoorOpen(),
    });
    World.fudaDoor = fuda;
    // 门上的纸符装饰
    for (let i = 0; i < 5; i++) {
      const p = plane(0.16, 0.4, new THREE.MeshLambertMaterial({ map: Tex.get('ofuda') }),
        12.5 + (Math.random() - 0.5) * 0.7, 1.0 + Math.random() * 1.0, -42.46, 0, 0);
      p.rotation.z = (Math.random() - 0.5) * 0.5;
      if (!World.fudaPapers) World.fudaPapers = [];
      World.fudaPapers.push(p);
    }
    // 拐角荧光灯
    const light = new THREE.PointLight(0xbfd8c8, 0.7, 9, 1.6);
    light.position.set(7, WALL_H - 0.3, -41.2);
    scene.add(light);
    const fixture = box(0.9, 0.06, 0.22, new THREE.MeshLambertMaterial({ color: 0xcccccc, emissive: 0x99aa99, emissiveIntensity: 0.7 }), 7, WALL_H - 0.05, -41.2);
    flickerLights.push({ light, fixture, base: 0.7, t: 3 });
  }

  // ---------- 隐藏区: 无限回廊 ----------
  function buildHiddenArea() {
    // 纸符门后: 一条不可能存在的长走廊 (从拐角南墙 x=12.5 延伸至 z=-87)
    const z0 = -42.6, z1 = -87.2;
    const L = z0 - z1;
    const zc = (z0 + z1) / 2;
    const cx = 12.5;
    plane(1.8, L, M.concrete, cx, 0.001, zc, -Math.PI / 2);
    plane(1.8, L, M.concrete, cx, WALL_H - 0.4, zc, Math.PI / 2);
    wallWithCollider(0.3, WALL_H, L, M.concrete, cx - 0.9, WALL_H / 2 - 0.2, zc);
    wallWithCollider(0.3, WALL_H, L, M.concrete, cx + 0.9, WALL_H / 2 - 0.2, zc);
    wallWithCollider(2, WALL_H, 0.3, M.concrete, cx, WALL_H / 2, z1); // 尽头

    // candle 点 (回廊中途)
    for (let i = 0; i < 3; i++) {
      const z = -52 - i * 12;
      const cl = new THREE.PointLight(0xc89858, 0.5, 6, 2);
      cl.position.set(cx + (i % 2 === 0 ? 0.6 : -0.6), 0.5, z);
      scene.add(cl);
      box(0.08, 0.22, 0.08, new THREE.MeshLambertMaterial({ color: 0xd8cfa8, emissive: 0x886633, emissiveIntensity: 0.8 }),
        cx + (i % 2 === 0 ? 0.6 : -0.6), 0.11, z);
    }

    // 尽头: 祭坛 + 铜铃放置点
    const altar = box(1.2, 0.8, 0.6, new THREE.MeshLambertMaterial({ map: Tex.get('doorWood', undefined, 351) }), cx, 0.4, -85.5);
    const altarCol = { minX: cx - 0.7, maxX: cx + 0.7, minZ: -85.9, maxZ: -85.1 };
    colliders.push(altarCol);
    World.altarCollider = altarCol;
    addInteract(cx, 1.0, -85.3, 1.8, '放上铜铃', () => Events.onAltar());
    World.altarPos = new THREE.Vector3(cx, 0.9, -85.5);
    // 祭坛上方微光
    const al = new THREE.PointLight(0x8fb8d8, 0.0, 6, 2);
    al.position.set(cx, 1.8, -85);
    scene.add(al);
    World.altarLight = al;
  }

  // ---------- 杂物 ----------
  function buildProps() {
    const r = (a, b) => a + Math.random() * (b - a);
    // 走廊报纸
    for (let i = 0; i < 14; i++) {
      plane(0.32, 0.38, Tex.mat('newspaper'),
        r(-0.9, 0.9), 0.01 + i * 0.0015, r(-38, -5), -Math.PI / 2, r(0, 3));
    }
    // 纸箱堆
    [[0.8, -11.5], [-0.7, -23], [0.8, -35.5]].forEach(([x, z], i) => {
      const s = 0.45 + Math.random() * 0.2;
      box(s, s, s, new THREE.MeshLambertMaterial({ color: 0x6a5a42 }), x, s / 2, z, Math.random());
      if (i === 0) box(s * 0.7, s * 0.7, s * 0.7, new THREE.MeshLambertMaterial({ color: 0x5a4c38 }), x - 0.1, s + s * 0.35, z + 0.1, 0.6);
      colliders.push({ minX: x - s / 2 - 0.05, maxX: x + s / 2 + 0.05, minZ: z - s / 2 - 0.05, maxZ: z + s / 2 + 0.05 });
    });
    // 破损轮椅 (走廊中段的不安道具)
    const wc = new THREE.Group();
    const wcMat = new THREE.MeshLambertMaterial({ color: 0x4a4e50 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.45), wcMat);
    seat.position.y = 0.5;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.06), wcMat);
    back.position.set(0, 0.8, -0.22);
    const wheel1 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 8), wcMat);
    wheel1.rotation.z = Math.PI / 2;
    wheel1.position.set(-0.28, 0.28, -0.1);
    const wheel2 = wheel1.clone(); wheel2.position.x = 0.28;
    wc.add(seat, back, wheel1, wheel2);
    wc.position.set(-0.6, 0, -17.5);
    wc.rotation.y = 2.2;
    scene.add(wc);
    World.wheelchair = wc;
    colliders.push({ minX: -1.1, maxX: -0.1, minZ: -18, maxZ: -17 });
    // 天花板悬吊电线
    for (let i = 0; i < 4; i++) {
      const wire = box(0.02, r(0.3, 0.7), 0.02, M.dark, r(-0.8, 0.8), WALL_H - 0.3, r(-36, -8));
    }
  }

  // ---------- 灰尘粒子 ----------
  function buildDust() {
    const N = 260;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 1] = Math.random() * WALL_H;
      pos[i * 3 + 2] = -Math.random() * 46 + 2;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dustParticles = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x9aa89e, size: 0.02, transparent: true, opacity: 0.5, sizeAttenuation: true,
    }));
    scene.add(dustParticles);
  }

  // ---------- 更新 ----------
  function update(dt, t, playerPos) {
    // 门动画
    doors.forEach(d => {
      if (Math.abs(d.angle - d.targetAngle) > 0.01) {
        d.angle += (d.targetAngle - d.angle) * Math.min(1, dt * 3.2);
        d.pivot.rotation.y = d.angle;
        updateDoorCollider(d);
      }
    });
    // 荧光灯闪烁
    flickerLights.forEach(f => {
      if (f.broken) return;
      f.t += dt;
      const flick = Math.random() < 0.008;
      if (flick) {
        f.light.intensity = Math.random() < 0.5 ? 0.05 : f.base * 1.3;
        f.fixture.material.emissiveIntensity = f.light.intensity;
        if (Math.random() < 0.3) Sfx.buzzFlicker();
        setTimeout(() => {
          f.light.intensity = f.base;
          f.fixture.material.emissiveIntensity = 0.7;
        }, 60 + Math.random() * 140);
      }
    });
    // 灰尘漂浮
    if (dustParticles) {
      dustParticles.rotation.y = Math.sin(t * 0.03) * 0.02;
      dustParticles.position.y = Math.sin(t * 0.11) * 0.06;
    }
    // 电视静噪
    if (World.tvScreen && World.tvOn !== false && Math.random() < 0.3) {
      World.tvScreen.material.map = Tex.toTex(Tex.makers.tvStatic());
      World.tvScreen.material.needsUpdate = true;
    }
  }

  // ---------- 碰撞查询 ----------
  function collides(x, z, r = 0.3) {
    for (const c of colliders) {
      if (x + r > c.minX && x - r < c.maxX && z + r > c.minZ && z - r < c.maxZ) return true;
    }
    return false;
  }

  function nearestInteract(pos, dir) {
    let best = null, bestScore = Infinity;
    for (const it of interactables) {
      if (!it.enabled) continue;
      const d = it.pos.distanceTo(pos);
      if (d > it.radius) continue;
      // 需要大致朝向
      const to = it.pos.clone().sub(pos).normalize();
      const dot = to.dot(dir);
      if (dot < 0.25) continue;
      const score = d * (2 - dot);
      if (score < bestScore) { bestScore = score; best = it; }
    }
    return best;
  }

  return {
    init, update, collides, nearestInteract,
    colliders, interactables, doors,
    get flickerLights() { return flickerLights; },
    CORRIDOR_W, WALL_H,
  };
})();
