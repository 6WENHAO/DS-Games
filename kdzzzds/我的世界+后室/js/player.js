/* ============================================================
 * BLOCKROOMS - player.js
 * 第一人称控制 / AABB 物理 / 挖掘放置 / 手臂视图模型
 * ============================================================ */
(function () {
  'use strict';
  const P = {};
  window.BRPlayer = P;
  const W = () => window.BRWorld;
  const B = () => window.BRBlocks;

  const HALF = 0.3, HEIGHT = 1.8, EYE = 1.62;
  P.pos = { x: 0.5, y: 1.1, z: 0.5 };
  P.vel = { x: 0, y: 0, z: 0 };
  P.yaw = 0; P.pitch = 0;
  P.onGround = false;
  P.keys = {};
  P.mouse = { left: false, right: false };
  P.sensitivity = 1.0;
  P.bobPhase = 0; P.bobAmp = 0;
  P.flashlightOn = false;
  P.frozen = false;

  let camera = null, scene = null;
  let outlineMesh = null, crackMesh = null, crackMats = null;
  let handScene = null, handCamera = null, handGroup = null, armMesh = null, heldMesh = null;
  let heldKey = null;
  let swingT = 1;       // 挥动进度 >=1 空闲
  let mineTarget = null, mineProgress = 0;
  let stepAcc = 0;
  let fallStart = null;
  let lastAttack = 0;
  P.currentHit = null;

  /* ---------------- 初始化 ---------------- */
  P.init = async function (mainScene, cam, renderer) {
    scene = mainScene; camera = cam;
    // 方块黑色描边
    const og = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002));
    outlineMesh = new THREE.LineSegments(og, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 }));
    outlineMesh.visible = false;
    scene.add(outlineMesh);
    // 裂纹
    crackMats = [];
    for (let i = 0; i < 4; i++) {
      const img = await BRAssets.svgToImage(BRAssets.tileSVG['crack' + i]);
      const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
      cv.getContext('2d').drawImage(img, 0, 0);
      const tex = new THREE.CanvasTexture(cv);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      crackMats.push(new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      }));
    }
    crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), crackMats[0]);
    crackMesh.visible = false;
    scene.add(crackMesh);
    // 手臂场景
    handScene = new THREE.Scene();
    handCamera = new THREE.PerspectiveCamera(55, 1, 0.01, 10);
    handScene.add(new THREE.AmbientLight(0xffffff, 1.0));
    handGroup = new THREE.Group();
    handScene.add(handGroup);
    const armTex = BRAssets.entityTex.arm;
    armMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.62),
      new THREE.MeshLambertMaterial({ map: armTex })
    );
    armMesh.rotation.x = Math.PI / 2; // 让纹理手部朝前
    const armWrap = new THREE.Group();
    armWrap.add(armMesh);
    armWrap.position.set(0.42, -0.42, -0.55);
    armWrap.rotation.set(0.15, -0.3, 0.1);
    handGroup.add(armWrap);
    P._armWrap = armWrap;
    P.handScene = handScene; P.handCamera = handCamera;
  };

  /* ---------------- 视图模型：手持物 ---------------- */
  function makeBlockMesh(blockId, size) {
    const def = B().defs[blockId];
    let tiles = def.tiles;
    if (typeof tiles === 'function') tiles = tiles(0, 0, 0);
    const geo = new THREE.BoxGeometry(size, size, size);
    const uvAttr = geo.getAttribute('uv');
    // BoxGeometry 面顺序: +x,-x,+y,-y,+z,-z
    const faceTiles = [tiles.side, tiles.side, tiles.top, tiles.bottom, tiles.side, tiles.side];
    for (let f = 0; f < 6; f++) {
      const tuv = BRAssets.tileUV[faceTiles[f]] || BRAssets.tileUV.wallpaper0;
      const [u0, v0, u1, v1] = tuv;
      const o = f * 4;
      uvAttr.setXY(o + 0, u0, v1); uvAttr.setXY(o + 1, u1, v1);
      uvAttr.setXY(o + 2, u0, v0); uvAttr.setXY(o + 3, u1, v0);
    }
    uvAttr.needsUpdate = true;
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: BRAssets.atlasTexture }));
    return mesh;
  }
  const texLoader = new THREE.TextureLoader();
  function makeItemSprite(itemId) {
    const url = BRAssets.iconURL[itemId];
    if (!url) return null;
    const tex = texLoader.load(url);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.42),
      new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide })
    );
    return mesh;
  }
  P.setHeld = function (itemId) {
    if (heldKey === itemId) return;
    heldKey = itemId;
    if (heldMesh) { P._armWrap.remove(heldMesh); heldMesh = null; }
    if (!itemId) return;
    const it = B().items[itemId];
    if (!it) return;
    if (it.block !== undefined) {
      heldMesh = makeBlockMesh(it.block, 0.3);
      heldMesh.position.set(-0.05, 0.18, -0.3);
      heldMesh.rotation.set(0.1, Math.PI / 4 + 0.2, 0);
    } else {
      heldMesh = makeItemSprite(itemId);
      if (heldMesh) {
        heldMesh.position.set(-0.02, 0.25, -0.28);
        heldMesh.rotation.set(0, -0.4, 0.25);
      }
    }
    if (heldMesh) P._armWrap.add(heldMesh);
    if (window.BRAudio) BRAudio.equip();
  };

  /* ---------------- 输入 ---------------- */
  P.onMouseMove = function (dx, dy) {
    if (P.frozen) return;
    const s = 0.0023 * P.sensitivity;
    P.yaw -= dx * s;
    P.pitch -= dy * s;
    const lim = Math.PI / 2 - 0.01;
    P.pitch = Math.max(-lim, Math.min(lim, P.pitch));
  };
  P.getDir = function () {
    const cp = Math.cos(P.pitch);
    return {
      x: -Math.sin(P.yaw) * cp,
      y: Math.sin(P.pitch),
      z: -Math.cos(P.yaw) * cp
    };
  };

  /* ---------------- 物理 ---------------- */
  function collide(axis, amt) {
    const p = P.pos;
    const min = { x: p.x - HALF, y: p.y, z: p.z - HALF };
    const max = { x: p.x + HALF, y: p.y + HEIGHT, z: p.z + HALF };
    min[axis] += amt; max[axis] += amt;
    if (axis === 'y') { min.y = p.y + amt; max.y = p.y + HEIGHT + amt; }
    const x0 = Math.floor(min.x), x1 = Math.floor(max.x - 1e-6);
    const y0 = Math.floor(min.y), y1 = Math.floor(max.y - 1e-6);
    const z0 = Math.floor(min.z), z1 = Math.floor(max.z - 1e-6);
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++)
          if (W().isSolid(x, y, z)) return true;
    return false;
  }
  function moveAxis(axis, amt) {
    if (amt === 0) return 0;
    const step = 0.05 * Math.sign(amt);
    let moved = 0, remain = amt;
    while (Math.abs(remain) > 1e-6) {
      const d = Math.abs(remain) > 0.05 ? step : remain;
      if (collide(axis, d)) {
        if (axis === 'x') P.vel.x = 0;
        if (axis === 'y') P.vel.y = 0;
        if (axis === 'z') P.vel.z = 0;
        break;
      }
      P.pos[axis] += d; moved += d; remain -= d;
    }
    return moved;
  }

  P.teleport = function (x, y, z) {
    P.pos.x = x; P.pos.y = y; P.pos.z = z;
    P.vel.x = P.vel.y = P.vel.z = 0;
  };

  /* ---------------- 每帧更新 ---------------- */
  P.update = function (dt, game) {
    if (P.frozen) { updateCamera(dt, 0); updateHand(dt); return; }
    const k = P.keys;
    let fw = 0, st = 0;
    if (k['KeyW'] || k['ArrowUp']) fw += 1;
    if (k['KeyS'] || k['ArrowDown']) fw -= 1;
    if (k['KeyA'] || k['ArrowLeft']) st -= 1;
    if (k['KeyD'] || k['ArrowRight']) st += 1;
    const running = (k['ShiftLeft'] || k['ShiftRight']) && fw > 0;
    const speed = running ? 5.6 : 4.2;
    const sin = Math.sin(P.yaw), cos = Math.cos(P.yaw);
    let mx = (-sin * fw + cos * st), mz = (-cos * fw - sin * st);
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; }
    // 加速度
    const accel = P.onGround ? 40 : 12;
    P.vel.x += (mx * speed - P.vel.x) * Math.min(1, accel * dt / speed * 2);
    P.vel.z += (mz * speed - P.vel.z) * Math.min(1, accel * dt / speed * 2);
    if (ml === 0 && P.onGround) { P.vel.x *= Math.max(0, 1 - 14 * dt); P.vel.z *= Math.max(0, 1 - 14 * dt); }
    // 跳跃
    if ((k['Space']) && P.onGround) {
      P.vel.y = 7.6;
      P.onGround = false;
      if (window.BRAudio) BRAudio.jump();
    }
    P.vel.y -= 23 * dt;
    if (P.vel.y < -30) P.vel.y = -30;

    const wasGround = P.onGround;
    moveAxis('x', P.vel.x * dt);
    moveAxis('z', P.vel.z * dt);
    const preY = P.vel.y;
    moveAxis('y', P.vel.y * dt);
    P.onGround = preY <= 0 && P.vel.y === 0;

    // 落地
    if (!wasGround && P.onGround) {
      const fell = fallStart !== null ? fallStart - P.pos.y : 0;
      if (window.BRAudio) BRAudio.land(fell > 3);
      if (fell > 4 && game) game.damage(Math.floor((fell - 3) * 1.5), 'fall');
      fallStart = null;
    }
    if (!P.onGround) {
      if (fallStart === null || P.pos.y > fallStart) fallStart = P.pos.y;
    }

    // 脚步声
    const hv = Math.hypot(P.vel.x, P.vel.z);
    if (P.onGround && hv > 0.5) {
      stepAcc += hv * dt;
      const stride = running ? 2.6 : 2.1;
      if (stepAcc > stride) {
        stepAcc = 0;
        const below = W().getBlock(Math.floor(P.pos.x), Math.floor(P.pos.y - 0.5), Math.floor(P.pos.z));
        const def = B().defs[below];
        const mat = def && def.mat === 'cloth' ? 'carpet' : (def && def.mat === 'wood' ? 'wood' : 'stone');
        if (window.BRAudio) BRAudio.footstep(mat, running);
        P.bobAmp = Math.min(1, P.bobAmp + 0.5);
      }
      P.bobPhase += dt * (running ? 11 : 8.5);
      P.bobAmp = Math.min(1, P.bobAmp + dt * 4);
    } else {
      P.bobAmp = Math.max(0, P.bobAmp - dt * 5);
    }

    /* ---- 射线目标 ---- */
    const dir = P.getDir();
    const eye = { x: P.pos.x, y: P.pos.y + EYE, z: P.pos.z };
    const hit = W().raycast(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, 4.5);
    P.currentHit = hit;
    if (hit && !B().defs[hit.id].unbreakable) {
      outlineMesh.visible = true;
      outlineMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else outlineMesh.visible = false;

    /* ---- 挖掘 ---- */
    if (P.mouse.left && hit && game) {
      if (!mineTarget || mineTarget.x !== hit.x || mineTarget.y !== hit.y || mineTarget.z !== hit.z) {
        mineTarget = { x: hit.x, y: hit.y, z: hit.z, id: hit.id };
        mineProgress = 0;
      }
      const bt = game.getBreakTime(hit.id);
      if (bt !== Infinity) {
        mineProgress += dt;
        if (swingT >= 0.5) { swingT = 0; }
        // 敲击音
        if (!P._digAcc) P._digAcc = 0;
        P._digAcc += dt;
        if (P._digAcc > 0.25) {
          P._digAcc = 0;
          const def = B().defs[hit.id];
          if (window.BRAudio) BRAudio.dig(def.mat || 'stone');
          game.spawnBlockParticles(hit, 2);
        }
        const frac = mineProgress / bt;
        crackMesh.visible = frac > 0.02;
        crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        crackMesh.material = crackMats[Math.min(3, Math.floor(frac * 4))];
        if (mineProgress >= bt) {
          game.breakBlock(mineTarget);
          mineTarget = null; mineProgress = 0;
          crackMesh.visible = false;
        }
      } else {
        crackMesh.visible = false;
      }
    } else {
      mineTarget = null; mineProgress = 0;
      crackMesh.visible = false;
    }

    updateCamera(dt, hv);
    updateHand(dt);
  };

  /* ---- 攻击 / 使用 ---- */
  P.tryAttack = function (game) {
    const now = performance.now();
    if (now - lastAttack < 320) return false;
    const dir = P.getDir();
    const eye = { x: P.pos.x, y: P.pos.y + EYE, z: P.pos.z };
    if (window.BREntities) {
      const ent = BREntities.raycastEntity(eye, dir, 3.4);
      if (ent) {
        lastAttack = now;
        swingT = 0;
        game.attackEntity(ent);
        return true;
      }
    }
    swingT = 0;
    if (window.BRAudio) BRAudio.swing();
    return false;
  };
  P.swing = function () { swingT = 0; };

  /* ---------------- 摄像机 ---------------- */
  let wobble = 0;
  P.sanityWobble = 0; // 由主逻辑设置 0~1
  function updateCamera(dt, hv) {
    wobble += dt;
    const bobX = Math.sin(P.bobPhase) * 0.032 * P.bobAmp;
    const bobY = Math.abs(Math.cos(P.bobPhase)) * 0.045 * P.bobAmp;
    const sw = P.sanityWobble;
    const wx = Math.sin(wobble * 0.9) * 0.02 * sw + Math.sin(wobble * 2.3) * 0.012 * sw;
    const wy = Math.cos(wobble * 1.3) * 0.018 * sw;
    camera.position.set(P.pos.x + bobX * Math.cos(P.yaw), P.pos.y + EYE + bobY + wy, P.pos.z + bobX * -Math.sin(P.yaw));
    camera.rotation.order = 'YXZ';
    camera.rotation.y = P.yaw + wx * 0.5;
    camera.rotation.x = P.pitch + wy * 0.6;
    camera.rotation.z = Math.sin(P.bobPhase) * 0.0035 * P.bobAmp + wx * 0.3;
  }

  /* ---------------- 手臂动画 ---------------- */
  function updateHand(dt) {
    swingT = Math.min(1, swingT + dt * 3.4);
    const aw = P._armWrap;
    if (!aw) return;
    const t = swingT;
    // 挥动曲线
    const sw = t < 1 ? Math.sin(t * Math.PI) : 0;
    aw.rotation.set(
      0.15 - sw * 1.4,
      -0.3 + sw * 0.55,
      0.1 - sw * 0.3
    );
    aw.position.set(
      0.42 - sw * 0.18,
      -0.42 + Math.abs(Math.cos(P.bobPhase)) * 0.02 * P.bobAmp - sw * 0.05,
      -0.55 - sw * 0.1
    );
  }

  P.resize = function (aspect) {
    if (handCamera) { handCamera.aspect = aspect; handCamera.updateProjectionMatrix(); }
  };
})();
