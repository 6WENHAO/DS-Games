/* =========================================================
   player.js — 第一人称：物理 / 挖掘 / 放置 / 喷气背包 / 氧气
   ========================================================= */
const Player = (() => {

  const P = {
    x: 0, y: 40, z: 0,
    vx: 0, vy: 0, vz: 0,
    yaw: 0, pitch: 0,
    onGround: false, inWater: false,
    w: 0.6, h: 1.8, eye: 1.62,
    hp: 10, maxHp: 10,
    oxygen: 100, fuel: 100,
    hasSuit: false, hasScope: false, hasTranslator: false, hasCodes: false,
    creative: false, flying: false,
    speed: 4.4, runMult: 1.6,
    dead: false,
  };

  const keys = {};
  let world = null;
  let digTarget = null, digProgress = 0, digTotal = 0;
  let lastSpace = 0;
  let mouseDown = [false, false];

  function setWorld(w) { world = w; digTarget = null; digProgress = 0; }
  function teleport(x, y, z) { P.x = x; P.y = y; P.z = z; P.vx = P.vy = P.vz = 0; }

  /* ---------- 输入 ---------- */
  function onKey(e, down) {
    keys[e.code] = down;
    if (down && e.code === 'Space') {
      const t = performance.now();
      if (P.creative && t - lastSpace < 280) P.flying = !P.flying;
      lastSpace = t;
    }
  }
  function onMouseMove(dx, dy) {
    P.yaw -= dx * 0.0024;
    P.pitch -= dy * 0.0024;
    P.pitch = Math.max(-1.55, Math.min(1.55, P.pitch));
  }
  function lookDir() {
    const cp = Math.cos(P.pitch);
    return [Math.sin(P.yaw) * cp * -1, Math.sin(P.pitch), Math.cos(P.yaw) * cp * -1];
  }

  /* ---------- 碰撞 ---------- */
  function collides(x, y, z) {
    const hw = P.w / 2;
    const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw);
    const y0 = Math.floor(y), y1 = Math.floor(y + P.h);
    const z0 = Math.floor(z - hw), z1 = Math.floor(z + hw);
    for (let yy = y0; yy <= y1; yy++) for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) {
      const b = World.BLOCKS[world.get(xx, yy, zz)];
      if (b && b.solid) return true;
    }
    return false;
  }
  function headInWater() {
    return World.BLOCKS[world.get(P.x, P.y + P.eye, P.z)] && World.BLOCKS[world.get(P.x, P.y + P.eye, P.z)].liquid;
  }
  function bodyInWater() {
    const b = World.BLOCKS[world.get(P.x, P.y + 0.5, P.z)];
    return b && b.liquid;
  }

  /* ---------- 更新 ---------- */
  function update(dt, game) {
    if (!world || P.dead) return;
    const grav = P.flying ? 0 : world.def.gravity;
    P.inWater = bodyInWater();

    // 移动输入
    let fw = 0, st = 0;
    if (keys.KeyW) fw += 1; if (keys.KeyS) fw -= 1;
    if (keys.KeyA) st -= 1; if (keys.KeyD) st += 1;
    const run = keys.ShiftLeft || keys.ShiftRight;
    let sp = P.speed * (run ? P.runMult : 1) * (P.creative && P.flying ? 2.2 : 1);
    if (P.inWater) sp *= 0.55;
    const sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    let mx = (-sy * fw + cy * st) * sp;
    let mz = (-cy * fw - sy * st) * sp;

    const accel = P.onGround || P.flying ? 18 : 5;
    P.vx += (mx - P.vx) * Math.min(1, accel * dt);
    P.vz += (mz - P.vz) * Math.min(1, accel * dt);

    let jetActive = false;
    if (P.flying) {
      let vy = 0;
      if (keys.Space) vy += sp;
      if (keys.ControlLeft || keys.KeyC) vy -= sp;
      P.vy += (vy - P.vy) * Math.min(1, 12 * dt);
    } else {
      P.vy -= grav * dt;
      if (P.inWater) {
        P.vy = Math.max(P.vy, -3.5);
        if (keys.Space) P.vy = Math.min(P.vy + 24 * dt, 3.2);
      } else if (keys.Space) {
        if (P.onGround) {
          P.vy = 8.2;
          P.onGround = false;
          Audio2.SFX.jump();
        } else if ((P.hasSuit || P.creative) && P.fuel > 0) {
          P.vy += 42 * dt;
          P.vy = Math.min(P.vy, 7);
          if (!P.creative) P.fuel = Math.max(0, P.fuel - 22 * dt);
          jetActive = true;
        }
      }
      P.vy = Math.max(P.vy, -42);
    }
    Audio2.jet(jetActive, jetActive ? 1 : 0);
    if (P.onGround && !P.creative) P.fuel = Math.min(100, P.fuel + 30 * dt);

    // 逐轴移动
    const wasGround = P.onGround;
    const fallSpeed = P.vy;
    moveAxis(P.vx * dt, 0, 0);
    moveAxis(0, 0, P.vz * dt);
    P.onGround = false;
    if (!moveAxis(0, P.vy * dt, 0)) {
      if (P.vy < 0) {
        P.onGround = true;
        if (!wasGround && fallSpeed < -14 && !P.creative) {
          const dmg = Math.floor((-fallSpeed - 12) / 4);
          if (dmg > 0) { P.hp -= dmg; Audio2.SFX.hurt(); game.onHurt(); }
        }
        if (!wasGround) Audio2.SFX.land();
      }
      P.vy = 0;
    }
    P.x = world.wrap(P.x); P.z = world.wrap(P.z);

    // 脚步声
    if (P.onGround && (Math.abs(P.vx) > 1 || Math.abs(P.vz) > 1)) {
      const below = World.BLOCKS[world.get(P.x, P.y - 0.4, P.z)];
      if (below && below.mat) Audio2.SFX.step(below.mat);
    }

    // 氧气
    const needO2 = !world.def.oxygen && !P.creative;
    if (needO2) {
      if (headInWater()) P.oxygen -= 8 * dt;
      else P.oxygen -= 100 / 360 * dt; // 6 分钟
      if (P.oxygen <= 0) { P.oxygen = 0; P.hp -= 2 * dt; game.onHurt(); }
    } else if (headInWater() && !P.creative) {
      P.oxygen -= 10 * dt;
      if (P.oxygen <= 0) { P.oxygen = 0; P.hp -= 2 * dt; game.onHurt(); }
    } else {
      P.oxygen = Math.min(100, P.oxygen + 25 * dt);
    }

    if (P.hp <= 0 && !P.creative) game.onDeath('你失去了意识……');

    // 掉出世界
    if (P.y < -8) teleport(P.x, world.H + 2, P.z);
    if (P.y > world.H + 40) P.y = world.H + 40;

    // 挖掘
    updateDig(dt, game);
  }

  function moveAxis(dx, dy, dz) {
    const nx = P.x + dx, ny = P.y + dy, nz = P.z + dz;
    if (!collides(nx, ny, nz)) { P.x = nx; P.y = ny; P.z = nz; return true; }
    // 台阶尝试（水平移动时自动跨半格不做，保持 MC 跳跃感）
    if (dy === 0) {
      if (dx !== 0) P.vx = 0;
      if (dz !== 0) P.vz = 0;
    }
    return false;
  }

  /* ---------- 挖掘与放置 ---------- */
  function getRayHit() {
    const [dx, dy, dz] = lookDir();
    return world.raycast(P.x, P.y + P.eye, P.z, dx, dy, dz, 5.5);
  }
  function hardnessFor(block, game) {
    if (P.creative) return 0.05;
    let h = block.hard;
    if (h === Infinity) return Infinity;
    if (block.tool === 'pickaxe') {
      const item = game.selectedItem();
      if (item === 'pickaxe_stone') h *= 0.25;
      else if (item === 'pickaxe_wood') h *= 0.45;
    }
    return h;
  }
  function updateDig(dt, game) {
    if (!mouseDown[0] || game.uiOpen()) { digTarget = null; digProgress = 0; game.setCrack(null, 0); return; }
    const hit = getRayHit();
    if (!hit) { digTarget = null; digProgress = 0; game.setCrack(null, 0); return; }
    const key = hit.x + ',' + hit.y + ',' + hit.z;
    if (!digTarget || digTarget.key !== key) {
      digTarget = { key, hit };
      digProgress = 0;
      digTotal = hardnessFor(World.BLOCKS[hit.id], game);
    }
    if (digTotal === Infinity) { game.setCrack(hit, 0); return; }
    digProgress += dt;
    const block = World.BLOCKS[hit.id];
    if (Math.floor(digProgress * 5) !== Math.floor((digProgress - dt) * 5)) Audio2.SFX.dig(block.mat, digProgress / digTotal);
    game.setCrack(hit, Math.min(0.999, digProgress / digTotal));
    if (digProgress >= digTotal) {
      world.set(hit.x, hit.y, hit.z, 0, true);
      Audio2.SFX.breakBlock(block.mat);
      if (!P.creative) {
        if (block.drop) game.giveItem(block.drop, 1);
        if (block.dropChance) for (const [it, p] of Object.entries(block.dropChance)) if (Math.random() < p) game.giveItem(it, 1);
      }
      game.onBlockMined(block.id);
      digTarget = null; digProgress = 0;
      game.setCrack(null, 0);
    }
  }
  function tryPlace(game) {
    const hit = getRayHit();
    if (!hit || !hit.face) return;
    const item = game.selectedItem();
    if (!item || World.BID[item] === undefined) return;
    const px = hit.x + hit.face[0], py = hit.y + hit.face[1], pz = hit.z + hit.face[2];
    if (py < 1 || py >= world.H) return;
    // 不与玩家重叠
    const hw = P.w / 2;
    const wx = world.wrap(px);
    const dx = world.wrapD(wx + 0.5 - P.x);
    const dz2 = world.wrapD(world.wrap(pz) + 0.5 - P.z);
    if (Math.abs(dx) < hw + 0.5 && Math.abs(dz2) < hw + 0.5 && py + 1 > P.y && py < P.y + P.h) return;
    if (world.get(px, py, pz) !== 0 && !World.BLOCKS[world.get(px, py, pz)].liquid) return;
    world.set(px, py, pz, World.BID[item], true);
    Audio2.SFX.place(World.BLOCKS[World.BID[item]].mat);
    if (!P.creative) game.takeItem(item, 1);
    game.onBlockPlaced(item, px, py, pz);
  }

  function setMouse(btn, down, game) {
    mouseDown[btn] = down;
    if (btn === 2 && down) tryPlace(game);
  }

  return { P, keys, setWorld, teleport, update, onKey, onMouseMove, lookDir, getRayHit, setMouse };
})();
