/* main.js - 组装与主循环 */
(function () {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const seed = qs.has('seed') ? (+qs.get('seed') | 0) : 20260718;
  const shot = qs.has('shot');
  const vd = qs.has('vd') ? +qs.get('vd') : 2048;
  const near = qs.has('near') ? +qs.get('near') : 8;

  const G = {};
  window.G = G;
  GEN_MODULE(G);
  MESHER_MODULE(G);
  LOD_MODULE(G);
  G.setSeed(seed);
  TEXGEN.init(G);
  ITEMS.init(G);

  const canvas = document.getElementById('game');
  let renderer, camera, scene;
  let frames = 0, fpsFrames = 0, fpsTime = 0, fps = 0, msAvg = 0;
  let lastT = performance.now();
  let readyFlag = false;

  TEXGEN.buildAtlas(G).then(function (atlas) {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(World.FOG_COLOR);
    scene = new THREE.Scene();
    window.__scene = scene;
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 40000);

    World.init({ G: G, scene: scene, atlas: atlas, seed: seed, viewDist: vd, nearRadius: near });

    let spawn, roomOrigin, roomGroundY;
    if (qs.has('x')) {
      spawn = new THREE.Vector3(+qs.get('x'), qs.has('y') ? +qs.get('y') : 0, +qs.get('z'));
      if (!qs.has('y')) spawn.y = G.column(Math.floor(spawn.x), Math.floor(spawn.z)).h + G.Y0 + 3;
      // 房间原点
      const RC = RoomBuilder.ROOM_CONFIG;
      roomGroundY = Math.floor(spawn.y - 3);
      roomOrigin = { x: Math.floor(spawn.x) - Math.floor(RC.sizeX / 2), y: roomGroundY, z: Math.floor(spawn.z) - RC.sizeZ - 2 };
    } else {
      const s = World.findSpawn();
      // 房间放置位置：在出生点附近找平坦地形
      const rx = Math.round(s.x) + 20;
      const rz = Math.round(s.z);
      const rh = G.column(rx, rz).h + G.Y0;
      const RC = RoomBuilder.ROOM_CONFIG;
      roomGroundY = rh;
      roomOrigin = { x: rx - Math.floor(RC.sizeX / 2), y: roomGroundY, z: rz - Math.floor(RC.sizeZ / 2) };
      // 玩家出生在房间北侧门外
      spawn = new THREE.Vector3(
        roomOrigin.x + Math.floor(RC.sizeX / 2) + 0.5,
        roomGroundY + 2,
        roomOrigin.z - 3
      );
      // 门外整地铺路
      const pathBlocks = [];
      for (let px = roomOrigin.x + 1; px <= roomOrigin.x + RC.sizeX; px++)
        for (let pz = roomOrigin.z - 3; pz < roomOrigin.z; pz++)
          for (let py = roomGroundY + 1; py <= roomGroundY + 10; py++)
            pathBlocks.push({ x: px, y: py, z: pz, id: 0 });
      // pathBlocks 稍后和房间一起 stamp（等 chunk 就绪后）
      window.__pathBlocks = pathBlocks;
    }
    window.__roomOrigin = roomOrigin;

    // 玩家面朝南（yaw=π），即面向北墙出入口
    Player.init({
      G: G, camera: camera, dom: canvas, scene: scene, spawn: spawn,
      yaw: qs.has('yaw') ? +qs.get('yaw') * Math.PI / 180 : Math.PI,
      pitch: qs.has('pitch') ? +qs.get('pitch') * Math.PI / 180 : 0,
      shot: shot
    });
    UI.init({ G: G, canvas: canvas, shot: shot });
    UI.onFov = function (v) { camera.fov = v; camera.updateProjectionMatrix(); };
    UI.onPixelRatio = function (v) {
      renderer.setPixelRatio(v);
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', function () {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    });

    // Phase 4: N 键召唤 NPC
    document.addEventListener('keydown', function (e) {
      if (e.code === 'KeyN' && roomOrigin && !e.repeat) {
        const n = NPC.spawnMultiple(3, roomOrigin.x + 7, roomOrigin.y, roomOrigin.z + 5, scene);
        console.log('[Phase4] 召唤', n, '个 NPC，总数:', NPC.count());
        e.preventDefault();
      }
    });

    World.update(spawn.x, spawn.z);

    let lastWorldUpd = 0, lastStats = 0;
    let roomBuilt = false;
    let roomBuildTries = 0;

    function tryBuildRoom() {
      if (roomBuilt) return true;
      if (!roomOrigin) return false;
      roomBuildTries++;
      const RC = RoomBuilder.ROOM_CONFIG;
      const cx0 = Math.floor(roomOrigin.x / 16);
      const cz0 = Math.floor(roomOrigin.z / 16);
      const cx1 = Math.floor((roomOrigin.x + RC.sizeX) / 16);
      const cz1 = Math.floor((roomOrigin.z + RC.sizeZ) / 16);
      for (let cx = cx0; cx <= cx1; cx++)
        for (let cz = cz0; cz <= cz1; cz++)
          if (!World.hasChunkAt(cx * 16 + 8, cz * 16 + 8)) return false;

      try {
        // 先清空门外通道
        if (window.__pathBlocks) {
          World.stampBlocks(window.__pathBlocks);
          window.__pathBlocks = null;
        }
        RoomBuilder.buildRoom(World, roomOrigin.x, roomOrigin.y, roomOrigin.z);
        roomBuilt = true;
        // Phase 2: 初始化镜面反射系统
        const mw = 15, mh = 6;
        window.__mirror = MirrorReflector.create({
          width: mw, height: mh,
          position: new THREE.Vector3(
            roomOrigin.x + mw / 2,
            roomOrigin.y + 1 + mh / 2,
            roomOrigin.z + RC.sizeZ
          ),
          normal: new THREE.Vector3(0, 0, -1),  // 朝室内（北）
          scene: scene,
          renderer: renderer,
          resolution: 512,
        });
        console.log('[Phase2] 镜面反射已初始化 @', roomOrigin.z + RC.sizeZ);
        return true;
      } catch (e) {
        console.error('[Phase1] 构建失败:', e);
        return false;
      }
    }

    function loop(t) {
      requestAnimationFrame(loop);
      const dt = (t - lastT) / 1000;
      lastT = t;
      const st = Player.update(dt);
      UI.setWaterFx(st.headWater);
      const p = Player.pos;
      if (t - lastWorldUpd > 200) {
        lastWorldUpd = t;
        World.update(p.x, p.z);
      }
      if (!roomBuilt && frames > 30) {
        tryBuildRoom();
      }
      World.frame(p.x, p.z, dt, Player.getState().yaw);
      if (window.__mirror) window.__mirror.update(camera);
      NPC.updateAll(dt, p);
      renderer.render(scene, camera);
      frames++;
      fpsFrames++;
      fpsTime += dt;
      if (fpsTime >= 0.5) {
        fps = Math.round(fpsFrames / fpsTime);
        msAvg = fpsTime / fpsFrames * 1000;
        fpsFrames = 0; fpsTime = 0;
      }
      if (t - lastStats > 300) {
        lastStats = t;
        const ws = World.stats();
        const col = G.column(Math.floor(p.x), Math.floor(p.z));
        window.__fps = fps;
        window.__stats = { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, chunks: ws.chunks, tiles: ws.tiles, tileCache: ws.tileCache, tileQueue: ws.tileQueue };
        UI.updateStats({
          fps: fps, ms: msAvg,
          calls: renderer.info.render.calls,
          tris: renderer.info.render.triangles,
          chunks: ws.chunks, chunkQueue: ws.chunkQueue,
          tiles: ws.tiles, tileQueue: ws.tileQueue, tileCache: ws.tileCache, maxLevel: ws.maxLevel,
          vd: World.getViewDist(),
          mem: performance.memory ? performance.memory.usedJSHeapSize : 0,
          x: p.x.toFixed(1), y: p.y.toFixed(1), z: p.z.toFixed(1),
          biome: G.BIOME_NAMES[col.biome],
          fly: Player.getState().fly,
          npc: NPC.count(),
        });
        if (shot && !readyFlag && frames > 40 && roomBuilt && World.queuesEmpty() && World.nearComplete(Math.min(4, near))) {
          readyFlag = true;
          setTimeout(function () {
            window.__ready = true;
            document.title = 'READY';
          }, 600);
        }
      }
    }
    requestAnimationFrame(loop);
  }).catch(function (e) {
    console.error(e);
    document.title = 'ATLAS_FAIL';
  });

  window.__errors = function () { return UI.errors(); };
})();
