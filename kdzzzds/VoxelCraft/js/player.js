/* player.js - 第一人称控制、物理、放置/破坏 + 角色模型 */
const Player = (function () {
  'use strict';
  let G, camera, dom, scene;
  const pos = new THREE.Vector3(0, 100, 0);
  const vel = new THREE.Vector3();
  let yaw = 0, pitch = 0;
  let fly = true;
  let onGround = false;
  const keys = {};
  let lastSpace = 0;
  let HALF = 0.3, HEIGHT = 1.8, EYE = 1.62;
  let target = null;
  let hiBox = null;
  let noclip = false;
  let shotMode = false;
  let speedMult = 1;

  // Phase 3: 角色模型
  let charType = 'human';
  let charMesh = null;
  let charMoving = false;

  function solidAt(x, y, z) {
    return G.isSolid(World.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)));
  }
  function waterAt(x, y, z) {
    return World.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === 11;
  }
  function boxCollides(px, py, pz) {
    const x0 = Math.floor(px - HALF), x1 = Math.floor(px + HALF);
    const y0 = Math.floor(py), y1 = Math.floor(py + HEIGHT);
    const z0 = Math.floor(pz - HALF), z1 = Math.floor(pz + HALF);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++)
      if (G.isSolid(World.getBlock(x, y, z))) return true;
    return false;
  }

  function moveAxis(dt) {
    const dx = vel.x * dt, dy = vel.y * dt, dz = vel.z * dt;
    if (noclip) { pos.x += dx; pos.y += dy; pos.z += dz; return; }
    // X
    let nx = pos.x + dx;
    if (!boxCollides(nx, pos.y, pos.z)) pos.x = nx; else vel.x = 0;
    // Z
    let nz = pos.z + dz;
    if (!boxCollides(pos.x, pos.y, nz)) pos.z = nz; else vel.z = 0;
    // Y
    let ny = pos.y + dy;
    onGround = false;
    if (!boxCollides(pos.x, ny, pos.z)) pos.y = ny;
    else {
      if (dy < 0) onGround = true;
      vel.y = 0;
    }
  }

  const RAY_DIR = new THREE.Vector3();
  const RAY_EULER = new THREE.Euler(0, 0, 0, 'YXZ');
  function raycast() {
    RAY_EULER.set(pitch, yaw, 0);
    const dir = RAY_DIR.set(0, 0, -1).applyEuler(RAY_EULER);
    let x = pos.x, y = pos.y + EYE, z = pos.z;
    let ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    const tdx = Math.abs(1 / (dir.x || 1e-9)), tdy = Math.abs(1 / (dir.y || 1e-9)), tdz = Math.abs(1 / (dir.z || 1e-9));
    let tx = (stepX > 0 ? (ix + 1 - x) : (x - ix)) * tdx;
    let ty = (stepY > 0 ? (iy + 1 - y) : (y - iy)) * tdy;
    let tz = (stepZ > 0 ? (iz + 1 - z) : (z - iz)) * tdz;
    let px = ix, py = iy, pz = iz;
    for (let i = 0; i < 120; i++) {
      const id = World.getBlock(ix, iy, iz);
      if (id !== 0 && id !== 11) return { x: ix, y: iy, z: iz, px: px, py: py, pz: pz, id: id };
      px = ix; py = iy; pz = iz;
      if (tx < ty && tx < tz) { ix += stepX; if (tx > 6) break; tx += tdx; }
      else if (ty < tz) { iy += stepY; if (ty > 6) break; ty += tdy; }
      else { iz += stepZ; if (tz > 6) break; tz += tdz; }
    }
    return null;
  }

  function doBreak() {
    if (!target) return;
    const id = target.id;
    if (id === 12) return; // 基岩
    if (id === 53) { World.explode(target.x, target.y, target.z, 4); return; }
    World.setBlock(target.x, target.y, target.z, 0);
  }
  function doPlace() {
    if (!target) return;
    const item = UI.selectedItem();
    if (!item || !item.block) return;
    const bid = item.block;
    const tx = target.px, ty = target.py, tz = target.pz;
    const cur = World.getBlock(tx, ty, tz);
    if (cur !== 0 && cur !== 11 && !(G.BLOCKS[cur] && G.BLOCKS[cur].kind === 1)) return;
    // 与玩家碰撞检查（十字植物、水不算）
    if (G.isSolid(bid)) {
      const x0 = Math.floor(pos.x - HALF), x1 = Math.floor(pos.x + HALF);
      const y0 = Math.floor(pos.y), y1 = Math.floor(pos.y + HEIGHT);
      const z0 = Math.floor(pos.z - HALF), z1 = Math.floor(pos.z + HALF);
      if (tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1 && tz >= z0 && tz <= z1) return;
    }
    World.setBlock(tx, ty, tz, bid);
  }

  /* Phase 3: 角色模型辅助 */
  function applyCharConfig() {
    const cfg = Characters.getConfig(charType);
    HALF = cfg.halfWidth;
    HEIGHT = cfg.height;
    EYE = cfg.eyeHeight;
    speedMult = cfg.speedMul;
  }
  function rebuildCharMesh() {
    if (charMesh && scene) scene.remove(charMesh);
    charMesh = Characters.createMesh(charType);
    if (charMesh && scene) scene.add(charMesh);
  }
  function cycleCharacter() {
    const idx = Characters.TYPES.indexOf(charType);
    const next = Characters.TYPES[(idx + 1) % Characters.TYPES.length];
    Player.setCharacter(next);
  }

  return {
    pos: pos,
    init: function (opts) {
      G = opts.G; camera = opts.camera; dom = opts.dom; scene = opts.scene;
      shotMode = !!opts.shot;
      pos.copy(opts.spawn);
      yaw = opts.yaw || 0;
      pitch = opts.pitch || 0;
      fly = true;

      // Phase 3: 初始角色模型
      charType = opts.charType || 'human';
      applyCharConfig();

      const geo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
      const edges = new THREE.EdgesGeometry(geo);
      hiBox = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7 }));
      hiBox.visible = false;
      opts.scene.add(hiBox);

      // 主相机排除角色模型层
      camera.layers.disable(Characters.CHAR_LAYER);
      // 构建角色网格
      rebuildCharMesh();

      if (shotMode) return;

      document.addEventListener('keydown', function (e) {
        keys[e.code] = true;
        if (e.code === 'Space') {
          // 修复：按住空格系统自动重复触发 keydown，若不过滤 e.repeat 会被误判为
          // 双击 → 飞行模式每帧开关（上升卡住 + 反复弹跳）。仅真实按键参与双击判定。
          if (!e.repeat) {
            const now = performance.now();
            if (now - lastSpace < 260) { fly = !fly; vel.y = 0; }
            lastSpace = now;
          }
          e.preventDefault();
        }
        if (e.repeat) return;
        if (e.code === 'KeyF') { fly = !fly; vel.y = 0; }
        if (e.code === 'KeyV') noclip = !noclip;
        // 角色切换：C 键循环
        if (e.code === 'KeyC') cycleCharacter();
      });
      document.addEventListener('keyup', function (e) { keys[e.code] = false; });
      dom.addEventListener('mousemove', function (e) {
        if (document.pointerLockElement !== dom) return;
        yaw -= e.movementX * 0.0024;
        pitch -= e.movementY * 0.0024;
        pitch = Math.max(-1.55, Math.min(1.55, pitch));
      });
      dom.addEventListener('mousedown', function (e) {
        if (document.pointerLockElement !== dom) return;
        if (e.button === 0) doBreak();
        else if (e.button === 2) doPlace();
      });
      dom.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    },
    setView: function (y, p) { yaw = y; pitch = p; },
    setSpeedMult: function (m) { speedMult = Math.max(0.5, Math.min(10, m)); },
    getSpeedMult: function () { return speedMult; },
    isFly: function () { return fly; },
    getCharType: function () { return charType; },

    /** 切换到指定角色类型 */
    setCharacter: function (type) {
      if (!Characters.CONFIG[type]) return;
      charType = type;
      applyCharConfig();
      rebuildCharMesh();
    },
    update: function (dt) {
      dt = Math.min(dt, 0.05);
      const inWater = waterAt(pos.x, pos.y + 0.4, pos.z);
      const headWater = waterAt(pos.x, pos.y + EYE, pos.z);
      const sprint = keys.ControlLeft || keys.ControlRight;
      let speed = (fly ? (sprint ? 64 : 18) : (sprint ? 7.2 : 4.4)) * speedMult;
      if (inWater && !fly) speed *= 0.55;

      let fx = 0, fz = 0;
      const s = Math.sin(yaw), c = Math.cos(yaw);
      if (keys.KeyW) { fx -= s; fz -= c; }
      if (keys.KeyS) { fx += s; fz += c; }
      if (keys.KeyA) { fx -= c; fz += s; }
      if (keys.KeyD) { fx += c; fz -= s; }
      const len = Math.hypot(fx, fz) || 1;
      const ax = fx / len * speed, az = fz / len * speed;
      const acc = fly ? 10 : (onGround ? 14 : 4);
      vel.x += (ax - vel.x) * Math.min(1, acc * dt);
      vel.z += (az - vel.z) * Math.min(1, acc * dt);

      const chunkReady = World.hasChunkAt(pos.x, pos.z);
      if (fly) {
        let vy = 0;
        if (keys.Space) vy += speed;
        if (keys.ShiftLeft || keys.ShiftRight) vy -= speed;
        vel.y += (vy - vel.y) * Math.min(1, 10 * dt);
      } else if (chunkReady) {
        if (inWater) {
          vel.y += (keys.Space ? 3.5 : -1.8 - vel.y) * Math.min(1, 6 * dt) * 3;
          vel.y = Math.max(-3.5, Math.min(3.2, vel.y));
        } else {
          vel.y -= 26 * dt;
          if (keys.Space && onGround) vel.y = 8.6;
        }
      } else {
        vel.y = 0;
      }
      moveAxis(dt);
      if (pos.y < (G.Y0 || 0) - 40) { pos.y = 120; vel.set(0, 0, 0); }   // 虚空底线（世界底 -1000 之下）

      camera.position.set(pos.x, pos.y + EYE, pos.z);
      camera.rotation.set(pitch, yaw, 0, 'YXZ');

      // Phase 3: 更新角色模型位置与动画
      if (charMesh) {
        charMesh.position.set(pos.x, pos.y, pos.z);
        charMesh.rotation.set(0, yaw, 0);
        charMoving = len > 0.1 || Math.abs(vel.y) > 1;
        Characters.animate(charType, charMesh, performance.now() * 0.001, charMoving);
      }

      target = raycast();
      if (target) {
        hiBox.visible = true;
        hiBox.position.set(target.x + 0.5, target.y + 0.5, target.z + 0.5);
      } else hiBox.visible = false;

      return { headWater: headWater };
    },
    getState: function () { return { yaw: yaw, pitch: pitch, fly: fly }; }
  };
})();
