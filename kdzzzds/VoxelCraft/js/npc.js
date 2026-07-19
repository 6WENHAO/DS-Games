/* npc.js - 自主巡逻 NPC 系统
 * 优化（借鉴 Lithium 实体/碰撞思路）：
 *  ① 方块查询减半：热循环内 World.getBlock 只调一次（原先同格重复两次）
 *  ② 配置缓存：Characters.getConfig 结果建 NPC 时缓存，避免每帧查表
 *  ③ 距离分级更新：>48m 隔帧、>96m 每 4 帧积累 dt 再步进；>64m 跳过动画驱动 */
const NPC = (function () {
  'use strict';

  const npcs = [];
  const SPEED = 1.8;
  const DIR_CHANGE_TIME = 3.0;    // 平均转向间隔（秒）
  const WALL_CHECK_DIST = 0.6;
  let frameNo = 0;

  /** 单个 NPC 状态 */
  function createNPC(wx, wy, wz, scene) {
    const types = Characters.TYPES;
    const type = types[Math.floor(Math.random() * types.length)];
    const mesh = Characters.createMesh(type);
    if (mesh) scene.add(mesh);

    return {
      type: type,
      cfg: Characters.getConfig(type),   // ② 缓存配置
      mesh: mesh,
      pos: new THREE.Vector3(wx, wy, wz),
      vel: new THREE.Vector3(),
      dirX: Math.random() * 2 - 1,
      dirZ: Math.random() * 2 - 1,
      timer: Math.random() * DIR_CHANGE_TIME,
      moving: false,
      acc: 0,                            // ③ 距离分级累积 dt
    };
  }

  function normalizeDir(npc) {
    const len = Math.hypot(npc.dirX, npc.dirZ) || 1;
    npc.dirX /= len;
    npc.dirZ /= len;
  }

  /* ① 单次查询判定 AABB 是否碰撞实心方块（y<0 视为墙） */
  function boxBlocked(x0, x1, y0, y1, z0, z1) {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++) {
        if (y < 0) return true;
        for (let z = z0; z <= z1; z++) {
          const id = World.getBlock(x, y, z);
          if (id !== 0 && id !== 11) return true;
        }
      }
    return false;
  }

  function wallAhead(npc, dist) {
    const cfg = npc.cfg;
    const hw = cfg.halfWidth;
    const px = npc.pos.x + npc.dirX * dist;
    const pz = npc.pos.z + npc.dirZ * dist;
    const py = npc.pos.y;
    return boxBlocked(
      Math.floor(px - hw), Math.floor(px + hw),
      Math.floor(py), Math.floor(py + cfg.height - 0.1),
      Math.floor(pz - hw), Math.floor(pz + hw));
  }

  function stepNPC(n, dt, playerPos) {
    n.timer -= dt;
    if (n.timer <= 0) {
      // 随机新方向
      n.dirX = Math.random() * 2 - 1;
      n.dirZ = Math.random() * 2 - 1;
      normalizeDir(n);
      n.timer = 1.5 + Math.random() * DIR_CHANGE_TIME;
    }

    // 前方有墙则转向
    if (wallAhead(n, WALL_CHECK_DIST)) {
      n.dirX = -n.dirX + (Math.random() - 0.5) * 0.6;
      n.dirZ = -n.dirZ + (Math.random() - 0.5) * 0.6;
      normalizeDir(n);
      n.timer = 0.8 + Math.random() * 2;
    }

    // 移动
    const cfg = n.cfg;
    const spd = SPEED * cfg.speedMul;
    const nx = n.pos.x + n.dirX * spd * dt;
    const nz = n.pos.z + n.dirZ * spd * dt;

    n.moving = Math.abs(n.dirX) > 0.05 || Math.abs(n.dirZ) > 0.05;

    // 碰撞测试（分轴）
    const hw = cfg.halfWidth;
    const hh = cfg.height;
    const y0 = Math.floor(n.pos.y), y1 = Math.floor(n.pos.y + hh - 0.1);

    // X 轴
    if (!boxBlocked(Math.floor(nx - hw), Math.floor(nx + hw), y0, y1,
      Math.floor(n.pos.z - hw), Math.floor(n.pos.z + hw))) n.pos.x = nx;
    else { n.dirX = -n.dirX; n.timer = 0.5; }

    // Z 轴
    if (!boxBlocked(Math.floor(n.pos.x - hw), Math.floor(n.pos.x + hw), y0, y1,
      Math.floor(nz - hw), Math.floor(nz + hw))) n.pos.z = nz;
    else { n.dirZ = -n.dirZ; n.timer = 0.5; }

    // 重力
    const floorY = Math.floor(n.pos.y);
    let onGround = false;
    {
      const gx0 = Math.floor(n.pos.x - hw), gx1 = Math.floor(n.pos.x + hw);
      const gz0 = Math.floor(n.pos.z - hw), gz1 = Math.floor(n.pos.z + hw);
      for (let x = gx0; x <= gx1 && !onGround; x++)
        for (let z = gz0; z <= gz1 && !onGround; z++) {
          const id = World.getBlock(x, floorY - 1, z);
          if (id !== 0 && id !== 11) onGround = true;
        }
    }

    if (!onGround) n.pos.y -= 9.8 * dt;
    else n.pos.y = floorY;

    // 掉出世界则重置（世界底 -1000 之下）
    if (n.pos.y < -1030) {
      n.pos.set(playerPos.x, playerPos.y, playerPos.z);
      n.timer = 1;
    }

    // 更新网格
    n.mesh.position.copy(n.pos);
    const angle = Math.atan2(n.dirX, n.dirZ);
    n.mesh.rotation.set(0, angle, 0);
  }

  function updateAll(dt, playerPos) {
    dt = Math.min(dt, 0.05);
    frameNo++;
    const now = performance.now() * 0.001;
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (!n.mesh) continue;

      /* ③ 距离分级：远处 NPC 降频步进（积累 dt 保证速度一致） */
      const dx = n.pos.x - playerPos.x, dz = n.pos.z - playerPos.z;
      const d2 = dx * dx + dz * dz;
      n.acc += dt;
      if (d2 > 9216) {          // >96m：每 4 帧
        if ((frameNo + i) & 3) continue;
      } else if (d2 > 2304) {   // >48m：每 2 帧
        if ((frameNo + i) & 1) continue;
      }
      const step = Math.min(n.acc, 0.1);
      n.acc = 0;
      stepNPC(n, step, playerPos);
      if (d2 < 4096) Characters.animate(n.type, n.mesh, now, n.moving);
    }
  }

  function spawn(wx, wy, wz, scene) {
    const n = createNPC(wx, wy, wz, scene);
    npcs.push(n);
    return npcs.length;
  }

  function spawnMultiple(count, centerX, centerY, centerZ, scene) {
    let added = 0;
    for (let i = 0; i < count; i++) {
      const ox = centerX + (Math.random() - 0.5) * 6;
      const oz = centerZ + (Math.random() - 0.5) * 6;
      spawn(ox, centerY + 1, oz, scene);
      added++;
    }
    return added;
  }

  function clear(scene) {
    for (let i = 0; i < npcs.length; i++) {
      if (npcs[i].mesh) scene.remove(npcs[i].mesh);
    }
    npcs.length = 0;
  }

  function count() { return npcs.length; }

  return {
    spawn: spawn,
    spawnMultiple: spawnMultiple,
    updateAll: updateAll,
    clear: clear,
    count: count,
  };
})();
