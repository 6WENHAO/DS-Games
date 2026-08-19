/* ==========================================================================
   RAFT SURVIVAL · player.js
   背包 / 第一人称控制 / 生存数值 / 游泳与潜水 / 射线交互 / 手持工具模型
   ========================================================================== */

/* -------------------------------------------------------------- 背包 */
RS.Inventory = function (game, hotbarN, packN) {
  const DB = RS.DB, U = RS.U;
  const self = this;
  this.hotbarN = hotbarN;
  this.slots = new Array(hotbarN + packN).fill(null);  // {id,n}
  this.sel = 0;

  function stackMax(id) { const it = DB.item(id); return it ? (it.stack || 1) : 1; }

  this.add = function (id, n, silent) {
    if (!DB.item(id)) return 0;
    n = n | 0; if (n <= 0) return 0;
    const max = stackMax(id);
    let left = n;
    for (let i = 0; i < self.slots.length && left > 0; i++) {
      const s = self.slots[i];
      if (s && s.id === id && s.n < max) { const put = Math.min(max - s.n, left); s.n += put; left -= put; }
    }
    for (let i = 0; i < self.slots.length && left > 0; i++) {
      if (!self.slots[i]) { const put = Math.min(max, left); self.slots[i] = { id, n: put }; left -= put; }
    }
    const got = n - left;
    if (got > 0) {
      game.bus.emit('inv');
      if (!silent) {
        game.bus.emit('collect', id, got);
        game.ui.pickupFeed(id, got);
      }
    }
    return got;
  };
  this.count = function (id) { let c = 0; self.slots.forEach(s => { if (s && s.id === id) c += s.n; }); return c; };
  this.remove = function (id, n) {
    let left = n;
    for (let i = self.slots.length - 1; i >= 0 && left > 0; i--) {
      const s = self.slots[i];
      if (s && s.id === id) { const t = Math.min(s.n, left); s.n -= t; left -= t; if (s.n <= 0) self.slots[i] = null; }
    }
    game.bus.emit('inv');
    return n - left;
  };
  this.canAfford = function (cost) { for (const k in cost) if (self.count(k) < cost[k]) return false; return true; };
  this.pay = function (cost) { for (const k in cost) self.remove(k, cost[k]); };
  this.held = function () { return self.slots[self.sel]; };
  this.heldId = function () { const s = self.slots[self.sel]; return s ? s.id : null; };
  this.consumeHeld = function (n) {
    const s = self.slots[self.sel]; if (!s) return;
    s.n -= (n || 1); if (s.n <= 0) self.slots[self.sel] = null;
    game.bus.emit('inv');
  };
  this.swap = function (a, b) {
    const t = self.slots[a]; self.slots[a] = self.slots[b]; self.slots[b] = t;
    game.bus.emit('inv');
  };
  this.dropSlot = function (i) {
    const s = self.slots[i]; if (!s) return;
    self.slots[i] = null; game.bus.emit('inv');
    game.debris.dropItem(s.id, s.n, game.player.eye());
  };
  this.freeSpace = function () { return self.slots.filter(s => !s).length; };
  this.serialize = function () { return { slots: self.slots, sel: self.sel }; };
  this.deserialize = function (s) { self.slots = s.slots; self.sel = s.sel || 0; game.bus.emit('inv'); };
};

/* -------------------------------------------------------------- 玩家 */
RS.Player = function (game) {
  const U = RS.U, T = RS.Tex, DB = RS.DB;
  const self = this;
  const cam = game.camera;

  const EYE = 1.62, RADIUS = .36, G = 19;
  const SPEED = 4.3, SPRINT = 6.6, SWIM = 3.3, JUMP = 5.6;

  this.pos = new THREE.Vector3(0, 2, 0);   // 脚底
  this.vel = new THREE.Vector3();
  this.yaw = 0; this.pitch = 0;
  this.onGround = false;
  this.inWater = false;
  this.underwater = false;
  this.onRaft = false;
  this.onIsland = false;
  this.active = false;
  this.dead = false;
  this.sleeping = false;

  this.v = { hp: 100, hunger: 100, thirst: 100, oxy: 100 };
  this.maxV = { hp: 100, hunger: 100, thirst: 100, oxy: 100 };
  this.effects = { poison: 0, bleed: 0, wet: 0 };
  this.stats = { days: 0, walked: 0, caught: 0, sharkRepel: 0 };

  const keys = {};
  this.keys = keys;
  let mouseDX = 0, mouseDY = 0;
  this.lmb = false; this.rmb = false;
  let chargeT = 0, swingT = 0, useT = 0;
  this.chargeT = 0;

  /* --------------------------------------------------------- 手持模型 */
  const hand = new THREE.Group();
  cam.add(hand);
  hand.position.set(0, 0, 0);
  this.hand = hand;
  const handPivot = new THREE.Group();
  hand.add(handPivot);
  let handMesh = null, handId = '__none';
  let torchLight = null;

  const HM = {
    wood: new THREE.MeshStandardMaterial({ map: T.plank(1, 1), roughness: .8 }),
    woodD: new THREE.MeshStandardMaterial({ map: T.plankDark(1, 1), roughness: .85 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x7a7a80, roughness: .95 }),
    metal: new THREE.MeshStandardMaterial({ map: T.metal(1, 1), roughness: .4, metalness: .85 }),
    rope: new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 1 }),
    flame: new THREE.MeshBasicMaterial({ color: 0xffa13a }),
    glass: new THREE.MeshStandardMaterial({ color: 0xcfeef7, roughness: .1, transparent: true, opacity: .5 })
  };
  function hm(geo, mat, x, y, z, rx, ry, rz) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    if (rx) m.rotation.x = rx; if (ry) m.rotation.y = ry; if (rz) m.rotation.z = rz;
    return m;
  }
  const bx = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cy = (a, b, h, s) => new THREE.CylinderGeometry(a, b, h, s || 8);

  function buildHand(id) {
    if (handId === id) return;
    handId = id;
    if (handMesh) { handPivot.remove(handMesh); }
    if (torchLight) { cam.remove(torchLight); torchLight = null; }
    handMesh = new THREE.Group();
    const it = id ? DB.item(id) : null;
    const tool = it && it.tool;
    if (id === 'hammer') {
      handMesh.add(hm(cy(.026, .03, .5), HM.woodD, 0, 0, 0));
      handMesh.add(hm(bx(.075, .1, .2), HM.metal, 0, .26, .02));
      handMesh.add(hm(cy(.02, .02, .12, 6), HM.metal, 0, .26, -.11, Math.PI / 2));
    } else if (id === 'hook') {
      handMesh.add(hm(cy(.024, .026, .34), HM.woodD, 0, 0, 0));
      const h = new THREE.Mesh(new THREE.TorusGeometry(.09, .017, 6, 12, Math.PI * 1.35), HM.metal);
      h.position.set(0, .26, 0); h.rotation.set(Math.PI / 2, 0, .4); handMesh.add(h);
      handMesh.add(hm(cy(.005, .005, .5), HM.rope, .05, .05, .03, 0, 0, .3));
    } else if (id === 'axe') {
      handMesh.add(hm(cy(.024, .028, .56), HM.woodD));
      const bl = hm(bx(.05, .2, .13), HM.stone, 0, .3, .04);
      bl.rotation.x = .1; handMesh.add(bl);
      handMesh.add(hm(cy(.008, .008, .16), HM.rope, 0, .27, 0, Math.PI / 2));
    } else if (id === 'spear' || id === 'stone_spear') {
      handMesh.add(hm(cy(.022, .024, 1.5), HM.woodD, 0, .2, 0));
      handMesh.add(hm(cy(.001, .038, .22, 6), id === 'stone_spear' ? HM.stone : HM.woodD, 0, 1.02, 0));
      handMesh.add(hm(cy(.006, .006, .1), HM.rope, 0, .88, 0, Math.PI / 2));
    } else if (id === 'rod') {
      handMesh.add(hm(cy(.018, .012, 1.5), HM.woodD, 0, .35, 0, -.12));
      handMesh.add(hm(cy(.05, .05, .05, 10), HM.metal, .02, .05, .04, Math.PI / 2));
      handMesh.add(hm(cy(.02, .02, .1), HM.woodD, .07, .05, .04, Math.PI / 2));
    } else if (id === 'cup') {
      handMesh.add(hm(cy(.075, .06, .14, 12), HM.wood, 0, 0, 0));
      const w = hm(cy(.062, .062, .01, 12), HM.glass, 0, .05, 0);
      handMesh.add(w); handMesh.userData.water = w; w.visible = false;
    } else if (id === 'bucket') {
      handMesh.add(hm(cy(.13, .1, .22, 12), HM.wood));
      handMesh.add(hm(new THREE.TorusGeometry(.13, .012, 6, 14), HM.metal, 0, .07, 0, Math.PI / 2));
      handMesh.add(hm(new THREE.TorusGeometry(.13, .012, 6, 14), HM.metal, 0, -.06, 0, Math.PI / 2));
    } else if (id === 'torch') {
      handMesh.add(hm(cy(.022, .026, .5), HM.woodD));
      const f = hm(cy(.001, .05, .2, 6), HM.flame, 0, .32, 0);
      handMesh.add(f); handMesh.userData.flame = f;
      torchLight = new THREE.PointLight(0xffa050, 4.5, 16, 1.6);
      torchLight.position.set(.35, -.15, -.5);
      cam.add(torchLight);
    } else if (id) {
      // 通用手持：小方块 + emoji 贴图
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#c9a15c'; x.fillRect(0, 0, 128, 128);
      x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(0, 96, 128, 32);
      x.font = '76px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(DB.ico(id), 64, 68);
      const tx = new THREE.CanvasTexture(c);
      handMesh.add(hm(bx(.2, .2, .2), new THREE.MeshStandardMaterial({ map: tx, roughness: .8 })));
    }
    handMesh.traverse(m => { if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; m.renderOrder = 999; if (m.material) m.material.depthTest = true; } });
    handPivot.add(handMesh);
    // 摆位
    handPivot.position.set(.34, -.34, -.52);
    handPivot.rotation.set(-.2, -.35, .18);
    if (id === 'rod') { handPivot.position.set(.3, -.4, -.5); handPivot.rotation.set(.25, -.2, .1); }
    if (id === 'spear' || id === 'stone_spear') { handPivot.position.set(.32, -.36, -.72); handPivot.rotation.set(.12, -.28, .1); }
    if (!id) handPivot.position.set(.4, -.5, -.6);
  }

  /* --------------------------------------------------------- 输入 */
  const canvas = game.renderer.domElement;
  function onKey(e, down) {
    const k = e.code;
    keys[k] = down;
    if (!down) return;
    if (!self.active) return;
    if (k >= 'Digit1' && k <= 'Digit9') {
      const n = parseInt(k.slice(5)) - 1;
      if (n < game.inv.hotbarN) { game.inv.sel = n; game.bus.emit('inv'); RS.Audio.play('ui_hover'); }
    }
    if (k === 'KeyE') tryInteract();
    if (k === 'KeyQ') game.inv.dropSlot(game.inv.sel);
    if (k === 'KeyF' && game.raft) toggleNearest();
  }
  window.addEventListener('keydown', e => {
    if (['Tab', 'Space', 'KeyB', 'KeyC', 'KeyI'].indexOf(e.code) >= 0) e.preventDefault();
    onKey(e, true);
  });
  window.addEventListener('keyup', e => onKey(e, false));
  document.addEventListener('mousemove', e => {
    if (!self.active) return;
    mouseDX += e.movementX || 0; mouseDY += e.movementY || 0;
  });
  canvas.addEventListener('mousedown', e => {
    if (!self.active) return;
    if (e.button === 0) { self.lmb = true; onPrimaryDown(); }
    if (e.button === 2) { self.rmb = true; onSecondary(); }
  });
  window.addEventListener('mouseup', e => {
    if (e.button === 0) { if (self.lmb) onPrimaryUp(); self.lmb = false; }
    if (e.button === 2) self.rmb = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('wheel', e => {
    if (!self.active) return;
    if (game.ui && game.ui.buildMode) return;   // 建造模式下滚轮换建筑
    game.inv.sel = (game.inv.sel + (e.deltaY > 0 ? 1 : -1) + game.inv.hotbarN) % game.inv.hotbarN;
    game.bus.emit('inv');
  }, { passive: true });

  /* 供 UI 详情面板调用：使用当前选中格的消耗品 */
  this.useHeldConsumable = function () {
    const id = game.inv.heldId(); if (!id) return;
    const it = DB.item(id);
    if (it && (it.food || it.water || it.heal || it.badWater)) consume(id, it);
    else game.ui.toast('这个物品不能直接使用', 'bad');
  };

  this.setActive = function (on) {
    self.active = on;
    if (on) { if (canvas.requestPointerLock) canvas.requestPointerLock(); }
    else if (document.exitPointerLock) document.exitPointerLock();
  };
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    if (!locked && self.active && !game.paused) game.pause(true);
  });

  /* --------------------------------------------------------- 交互射线 */
  const ray = new THREE.Raycaster();
  ray.far = 6;
  this.target = null;

  function collectTargets() {
    const list = [];
    if (game.raft) list.push(game.raft.root);
    if (game.debris) list.push(game.debris.group);
    if (game.islands) list.push(game.islands.group);
    if (game.sealife) list.push(game.sealife.group);
    return list;
  }
  function resolve(obj) {
    let o = obj;
    while (o) {
      if (o.userData && o.userData.type) return o.userData;
      o = o.parent;
    }
    return null;
  }
  function castTarget() {
    ray.setFromCamera({ x: 0, y: 0 }, cam);
    ray.far = 6;
    const hits = ray.intersectObjects(collectTargets(), true);
    for (let i = 0; i < hits.length; i++) {
      const h = hits[i];
      if (!h.object.visible) continue;
      const ud = resolve(h.object);
      if (ud) return { ud, point: h.point, dist: h.distance, object: h.object };
    }
    return null;
  }

  /* -------------------------------------------------- 主要动作（左键） */
  function onPrimaryDown() {
    const id = game.inv.heldId();
    const it = id ? DB.item(id) : null;
    if (it && it.tool === 'hook') { chargeT = 0; return; }
    doPrimary();
  }
  function onPrimaryUp() {
    const id = game.inv.heldId();
    const it = id ? DB.item(id) : null;
    if (it && it.tool === 'hook') {
      game.debris.throwHook(U.clamp(self.chargeT / 1.0, .22, 1));
      self.chargeT = 0; chargeT = 0;
      swing(.5);
    }
    if (it && it.tool === 'rod') game.sealife.rodRelease();
  }
  function swing(s) { swingT = s || 1; }
  this.swing = swing;

  function doPrimary() {
    if (useT > 0) return;
    const id = game.inv.heldId();
    const it = id ? DB.item(id) : null;
    const tgt = castTarget();
    self.target = tgt;

    /* 食物 / 饮料 */
    if (it && (it.food || it.water || it.heal || it.badWater)) {
      consume(id, it); useT = .55; swing(.6); return;
    }
    /* 工具 */
    if (it && it.tool) {
      switch (it.tool) {
        case 'hammer': {
          swing(1); useT = .34; RS.Audio.play('hammer');
          if (game.ui.buildMode) { game.ui.tryBuildPlace(); return; }
          if (tgt && (tgt.ud.type === 'base')) {
            if (game.raft.repairCell(tgt.ud.cell, 26)) game.ui.toast('🔨 修复了地基', 'good');
          }
          return;
        }
        case 'axe': {
          swing(1); useT = .42;
          if (tgt && tgt.ud.type === 'node') { game.islands.hitNode(tgt.ud.node, id, it.dmg); return; }
          if (tgt && tgt.ud.type === 'shark') { game.sealife.hitShark(it.dmg * .6, tgt.point); return; }
          RS.Audio.play('chop', .5);
          return;
        }
        case 'spear': {
          swing(1.1); useT = .5;
          if (tgt && tgt.ud.type === 'shark') { game.sealife.hitShark(it.dmg, tgt.point); return; }
          if (tgt && tgt.ud.type === 'fish') { game.sealife.spearFish(tgt.ud.fish); return; }
          if (tgt && tgt.ud.type === 'node') { game.islands.hitNode(tgt.ud.node, id, it.dmg * .4); return; }
          RS.Audio.play('spear');
          return;
        }
        case 'cup': case 'bucket': {
          useT = .5; swing(.7);
          // 舀水：对着海面
          const aim = aimWater();
          if (aim) {
            const n = it.tool === 'bucket' ? 3 : 1;
            const got = game.inv.add('salt_water', n);
            if (got) { RS.Audio.play('splash_out', .5); game.ui.toast('🌊 舀了' + got + '杯咸水（需净化）', ''); }
            else game.ui.toast('背包满了', 'bad');
          } else game.ui.toast('对着海面使用', 'bad');
          return;
        }
        case 'rod': {
          game.sealife.rodPress();
          return;
        }
        case 'torch': {
          swing(.8); useT = .3;
          if (tgt && tgt.ud.type === 'shark') game.sealife.scareShark();
          return;
        }
      }
    }
    /* 诱饵 */
    if (id === 'bait') {
      game.sealife.throwBait(); game.inv.consumeHeld(1); useT = .5; swing(.8); return;
    }
    /* 空手：采集软资源 / 拾取 */
    swing(.8); useT = .35;
    if (tgt && tgt.ud.type === 'node') { game.islands.hitNode(tgt.ud.node, null, 4); return; }
    if (tgt && tgt.ud.type === 'pickup') { game.debris.pickup(tgt.ud.item); return; }
  }

  function aimWater(max) {
    ray.setFromCamera({ x: 0, y: 0 }, cam);
    const o = ray.ray.origin, d = ray.ray.direction;
    if (d.y >= -0.02) return null;
    const t = (game.world.waterY(o.x, o.z) - o.y) / d.y;
    if (t < 0 || t > (max || 5)) return null;
    return o.clone().addScaledVector(d, t);
  }
  this.aimWater = aimWater;

  function onSecondary() {
    const id = game.inv.heldId();
    const it = id ? DB.item(id) : null;
    if (game.ui.buildMode) { game.ui.rotateBuild(); return; }
    if (it && it.tool === 'hammer') {
      const tgt = castTarget();
      if (tgt) {
        const ud = tgt.ud;
        if (ud.type === 'object') { game.raft.removeAt(ud.cell, 'object'); return; }
        if (ud.type === 'edge') { game.raft.removeAt(ud.cell, 'edge', ud.dir); return; }
        if (ud.type === 'roof') { game.raft.removeAt(ud.cell, 'roof'); return; }
        if (ud.type === 'upper') { game.raft.removeAt(ud.cell, 'upper'); return; }
        if (ud.type === 'base') {
          if (game.raft.countFoundations() <= 1) { game.ui.toast('不能拆掉最后一块地基', 'bad'); return; }
          game.raft.removeAt(ud.cell, 'base'); return;
        }
      }
    }
  }

  function consume(id, it) {
    if (it.badWater) {
      self.v.thirst = U.clamp(self.v.thirst - 6, 0, 100);
      self.hurt(4, '喝了咸水');
      game.ui.toast('🤢 咸水让你更渴了', 'bad');
      RS.Audio.play('drink');
      game.inv.consumeHeld(1);
      return;
    }
    if (it.water) { self.v.thirst = U.clamp(self.v.thirst + it.water, 0, 100); RS.Audio.play('drink'); if (id === 'fresh_water' || id === 'bottle_water') game.bus.emit('drink_fresh'); }
    if (it.food) {
      self.v.hunger = U.clamp(self.v.hunger + it.food, 0, 100);
      RS.Audio.play('eat');
      if (id.indexOf('cooked_') === 0) game.bus.emit('eat_cooked');
      if (id.indexOf('raw_') === 0 && U.chance(.32)) { self.effects.poison = 14; game.ui.toast('🤮 生食让你有点难受', 'bad'); }
    }
    if (it.heal) { self.heal(it.heal); self.effects.bleed = 0; RS.Audio.play('heal'); }
    game.inv.consumeHeld(1);
    game.ui.flashVitals();
  }

  /* -------------------------------------------------- E 交互 */
  function tryInteract() {
    const tgt = castTarget();
    self.target = tgt;
    if (!tgt) return;
    const ud = tgt.ud;
    if (ud.type === 'object' && ud.cell.obj) {
      const o = ud.cell.obj;
      if (o.station === 'sail') { o.data.up = !o.data.up; RS.Audio.play(o.data.up ? 'ui_open' : 'ui_close'); game.ui.toast(o.data.up ? '⛵ 升起船帆' : '⛵ 收起船帆', ''); if (o.data.up) game.bus.emit('sail_up'); return; }
      if (o.station === 'anchor') { o.data.down = !o.data.down; RS.Audio.play('place'); game.ui.toast(o.data.down ? '⚓ 抛锚，木筏停下' : '⚓ 收锚', ''); return; }
      if (o.station === 'lamp') { o.data.on = !o.data.on; RS.Audio.play('ui_click'); return; }
      if (o.station === 'wheel') { game.steering = !game.steering; game.ui.toast(game.steering ? '🎡 掌舵中（A/D 转向，再按 E 松手）' : '松开了舵轮', ''); return; }
      if (o.station === 'bed') { game.ui.openBed(o); return; }
      if (o.station === 'net') { game.debris.collectNet(o); return; }
      if (o.station === 'trophy') { game.ui.toast('🦈 布鲁斯的头颅。它再也咬不动你的木筏了。', 'good'); return; }
      if (o.station) { game.ui.openStation(o); return; }
      return;
    }
    if (ud.type === 'pickup') { game.debris.pickup(ud.item); return; }
    if (ud.type === 'node') { game.islands.hitNode(ud.node, game.inv.heldId(), 4); return; }
    if (ud.type === 'debris') { game.debris.grabDebris(ud.d); return; }
  }
  /* F：一键开关最近的帆/锚 */
  function toggleNearest() {
    let best = null, bd = 9;
    game.raft.stations.forEach(o => {
      if (o.station !== 'sail' && o.station !== 'anchor') return;
      const d = o.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(self.eye());
      if (d < bd) { bd = d; best = o; }
    });
    if (!best) return;
    if (best.station === 'sail') { best.data.up = !best.data.up; game.ui.toast(best.data.up ? '⛵ 升起船帆' : '⛵ 收起船帆', ''); if (best.data.up) game.bus.emit('sail_up'); }
    else { best.data.down = !best.data.down; game.ui.toast(best.data.down ? '⚓ 抛锚' : '⚓ 收锚', ''); }
    RS.Audio.play('ui_click');
  }

  /* -------------------------------------------------- 伤害 / 治疗 / 死亡 */
  this.hurt = function (n, why) {
    if (self.dead) return;
    self.v.hp = U.clamp(self.v.hp - n, 0, 100);
    game.ui.damageFlash(n);
    RS.Audio.play('hurt');
    if (why) game.ui.setCause(why);
    if (self.v.hp <= 0) self.die(why);
  };
  this.heal = function (n) { self.v.hp = U.clamp(self.v.hp + n, 0, 100); };
  this.die = function (why) {
    if (self.dead) return;
    self.dead = true;
    self.setActive(false);
    RS.Audio.play('die');
    game.ui.showDeath(why || '力竭而亡');
  };
  this.respawn = function () {
    self.dead = false;
    self.v.hp = 60; self.v.hunger = Math.max(45, self.v.hunger); self.v.thirst = Math.max(45, self.v.thirst); self.v.oxy = 100;
    self.effects.poison = 0; self.effects.bleed = 0;
    const p = game.spawnBed ? game.raft.cellWorld(game.spawnBed.cell).add(new THREE.Vector3(0, 1.2, 0)) : game.raft.spawnPoint();
    self.pos.copy(p); self.pos.y += .1;
    self.vel.set(0, 0, 0);
    self.setActive(true);
  };

  this.eye = function () { return new THREE.Vector3(self.pos.x, self.pos.y + EYE, self.pos.z); };

  /* -------------------------------------------------------------- 更新 */
  let stepT = 0, bobPhase = 0, lastRaftMat = new THREE.Matrix4(), hadRaftMat = false;
  let breathT = 0, waterSplashArmed = false;

  this.update = function (dt) {
    /* 视角 */
    if (self.active) {
      self.yaw -= mouseDX * 0.0022 * game.settings.sens;
      self.pitch -= mouseDY * 0.0022 * game.settings.sens;
      self.pitch = U.clamp(self.pitch, -1.5, 1.5);
    }
    mouseDX = 0; mouseDY = 0;

    const W = game.world;
    const waterY = W.waterY(self.pos.x, self.pos.z);

    /* 跟随木筏运动（把玩家钉在甲板上） */
    const surf = game.raft ? game.raft.surfaceAt(new THREE.Vector3(self.pos.x, self.pos.y + .1, self.pos.z)) : null;
    if (hadRaftMat && self.onRaft) {
      const inv = new THREE.Matrix4().copy(lastRaftMat).invert();
      const local = self.pos.clone().applyMatrix4(inv);
      const now = local.applyMatrix4(game.raft.root.matrixWorld);
      // 只取水平位移，避免上下抖动叠加
      self.pos.x = now.x; self.pos.z = now.z;
    }

    /* 移动输入 */
    const fwd = new THREE.Vector3(-Math.sin(self.yaw), 0, -Math.cos(self.yaw));
    const right = new THREE.Vector3(Math.cos(self.yaw), 0, -Math.sin(self.yaw));
    let ix = 0, iz = 0;
    if (self.active && !self.sleeping) {
      if (keys.KeyW) iz += 1; if (keys.KeyS) iz -= 1;
      if (keys.KeyD) ix += 1; if (keys.KeyA) ix -= 1;
    }
    /* 掌舵时 A/D 改航向 */
    if (game.steering && game.raft) {
      if (game.raft.desiredYaw == null) game.raft.desiredYaw = game.raft.yaw;
      if (keys.KeyA) game.raft.desiredYaw += dt * .55;
      if (keys.KeyD) game.raft.desiredYaw -= dt * .55;
      ix = 0; iz = 0;
    }

    const wet = self.pos.y + .55 < waterY;
    const deep = self.pos.y + EYE < waterY;
    self.inWater = wet;
    if (deep !== self.underwater) {
      self.underwater = deep;
      W.setUnderwater(deep);
      game.ui.setUnderwater(deep);
      if (deep) RS.Audio.play('dive'); else RS.Audio.play('gasp');
    }

    const sprint = keys.ShiftLeft || keys.ShiftRight;
    if (wet) {
      /* --- 游泳 --- */
      self.onGround = false; self.onRaft = false; self.onIsland = false;
      const dir = new THREE.Vector3();
      if (self.underwater) {
        const look = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(self.pitch, self.yaw, 0));
        dir.addScaledVector(look, iz);
        dir.addScaledVector(right, ix);
      } else {
        dir.addScaledVector(fwd, iz); dir.addScaledVector(right, ix);
      }
      if (keys.Space) dir.y += 1;
      if (keys.ControlLeft || keys.KeyC) dir.y -= 1;
      if (dir.lengthSq() > 0) dir.normalize();
      const sp = SWIM * (sprint ? 1.4 : 1);
      self.vel.lerp(dir.multiplyScalar(sp), 1 - Math.exp(-4 * dt));
      // 浮力
      if (!self.underwater) {
        const target = waterY - .45;
        self.vel.y += (target - self.pos.y) * 6 * dt;
        self.vel.y *= .92;
      }
      self.pos.addScaledVector(self.vel, dt);
      // 氧气
      if (self.underwater) {
        self.v.oxy = U.clamp(self.v.oxy - dt * 3.4, 0, 100);
        breathT -= dt;
        if (breathT <= 0) { breathT = U.rand(1.6, 3.4); RS.Audio.play('bubble', .5); game.debris.spawnBubble(self.eye()); }
        if (self.v.oxy <= 0) self.hurt(dt * 9, '溺水');
      } else {
        if (self.v.oxy < 100) { self.v.oxy = U.clamp(self.v.oxy + dt * 26, 0, 100); }
      }
      stepT -= dt;
      if (stepT <= 0 && dir.lengthSq() > 0.1) { stepT = .62; RS.Audio.play('swim', .7); }
      self.effects.wet = 6;
      if (!waterSplashArmed) { waterSplashArmed = true; RS.Audio.play('splash_in'); game.debris.spawnSplash(self.pos.clone().setY(waterY), 1.2); }
    } else {
      waterSplashArmed = false;
      /* --- 陆地 / 甲板 --- */
      const islandY = game.islands ? game.islands.heightAt(self.pos.x, self.pos.z) : null;
      let groundY = null, kind = null;
      if (surf) { groundY = surf.y; kind = 'raft'; }
      if (islandY != null && (groundY == null || islandY > groundY)) { groundY = islandY; kind = 'island'; }

      const dir = new THREE.Vector3().addScaledVector(fwd, iz).addScaledVector(right, ix);
      if (dir.lengthSq() > 0) dir.normalize();
      const sp = (sprint && self.v.hunger > 8 ? SPRINT : SPEED) * (self.onGround ? 1 : .82);
      const hv = dir.multiplyScalar(sp);
      self.vel.x = U.damp(self.vel.x, hv.x, 12, dt);
      self.vel.z = U.damp(self.vel.z, hv.z, 12, dt);
      self.vel.y -= G * dt;
      if (self.onGround && keys.Space && self.active) { self.vel.y = JUMP; self.onGround = false; RS.Audio.play('jump'); }

      const prev = self.pos.clone();
      self.pos.addScaledVector(self.vel, dt);

      /* 墙体 / 障碍碰撞 */
      if (game.raft) {
        const b = game.raft.blocked(new THREE.Vector3(self.pos.x, self.pos.y + .9, self.pos.z), RADIUS);
        if (b) { self.pos.x = prev.x; self.pos.z = prev.z; }
      }
      if (game.islands) {
        const b2 = game.islands.blocked(self.pos, RADIUS);
        if (b2) { self.pos.x = prev.x; self.pos.z = prev.z; }
      }

      /* 落地 */
      self.onRaft = false; self.onIsland = false;
      if (groundY != null && self.pos.y <= groundY + .02) {
        if (self.vel.y < -8) { self.hurt(U.clamp((-self.vel.y - 8) * 2.2, 0, 40), '摔伤'); RS.Audio.play('land'); }
        else if (!self.onGround && self.vel.y < -2) RS.Audio.play('land', .5);
        self.pos.y = groundY; self.vel.y = 0; self.onGround = true;
        if (kind === 'raft') self.onRaft = true; else self.onIsland = true;
      } else self.onGround = false;

      /* 掉进水里 */
      if (self.pos.y + .55 < waterY) { /* 下一帧转入游泳 */ }

      stepT -= dt;
      const moving = Math.hypot(self.vel.x, self.vel.z) > 1.2;
      if (self.onGround && moving && stepT <= 0) {
        stepT = sprint ? .32 : .46;
        RS.Audio.play(self.onIsland ? 'step_sand' : 'step_wood', .8);
        self.stats.walked += 1;
      }
      if (self.effects.wet > 0) self.effects.wet -= dt;
    }

    if (game.raft) { lastRaftMat.copy(game.raft.root.matrixWorld); hadRaftMat = true; }

    /* 生存数值 */
    if (!self.dead) {
      const sprintF = (Math.hypot(self.vel.x, self.vel.z) > 5 ? 1.7 : 1);
      const rate = self.sleeping ? .35 : 1;
      self.v.hunger = U.clamp(self.v.hunger - dt * .148 * sprintF * rate, 0, 100);
      self.v.thirst = U.clamp(self.v.thirst - dt * .196 * sprintF * rate * (game.world.timeOfDay > 10 && game.world.timeOfDay < 16 ? 1.25 : 1), 0, 100);
      if (self.v.hunger <= 0) self.hurtSoft(dt * .9, '饥饿');
      if (self.v.thirst <= 0) self.hurtSoft(dt * 1.35, '脱水');
      if (self.effects.poison > 0) { self.effects.poison -= dt; self.hurtSoft(dt * 1.6, '食物中毒'); }
      if (self.effects.bleed > 0) { self.effects.bleed -= dt; self.hurtSoft(dt * 2.2, '流血'); }
      if (self.v.hunger > 45 && self.v.thirst > 45 && self.effects.poison <= 0 && self.effects.bleed <= 0)
        self.v.hp = U.clamp(self.v.hp + dt * .55, 0, 100);
    }

    /* 相机 */
    const eye = self.eye();
    cam.position.copy(eye);
    bobPhase += dt * (Math.hypot(self.vel.x, self.vel.z) * 1.7);
    const bob = self.onGround ? Math.sin(bobPhase) * .035 : 0;
    const sideBob = self.onGround ? Math.cos(bobPhase * .5) * .022 : 0;
    cam.position.y += bob;
    cam.rotation.set(0, 0, 0);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = self.yaw;
    cam.rotation.x = self.pitch;
    cam.rotation.z = sideBob + (self.inWater ? Math.sin(game.time * 1.3) * .02 : 0);

    /* 手持 */
    const heldId = game.inv.heldId();
    buildHand(heldId);
    if (self.lmb) {
      const it = heldId ? DB.item(heldId) : null;
      if (it && it.tool === 'hook') { self.chargeT = Math.min(1.2, self.chargeT + dt); }
      else if (it && (it.tool === 'axe' || it.tool === 'hammer' || it.tool === 'spear')) { if (useT <= 0) doPrimary(); }
    }
    if (useT > 0) useT -= dt;
    if (swingT > 0) swingT = Math.max(0, swingT - dt * 4.2);
    const sw = Math.sin((1 - swingT) * Math.PI) * swingT;
    handPivot.rotation.x = (handId === 'rod' ? .25 : -.2) - sw * 1.25;
    handPivot.position.z = (handId === 'spear' || handId === 'stone_spear' ? -.72 : -.52) - sw * .35;
    handPivot.position.y = (handId ? -.34 : -.5) + Math.sin(bobPhase) * .012 - sw * .05;
    if (self.chargeT > 0 && handId === 'hook') {
      handPivot.rotation.x = -.2 - self.chargeT * .9;
      handPivot.position.z = -.52 + self.chargeT * .18;
    }
    if (handMesh && handMesh.userData.flame) {
      const f = handMesh.userData.flame;
      f.scale.set(.8 + Math.sin(game.time * 14) * .2, .85 + Math.sin(game.time * 11) * .25, 1);
      f.material.color.setHSL(.07 + Math.sin(game.time * 7) * .015, 1, .55);
    }
    if (handMesh && handMesh.userData.water) handMesh.userData.water.visible = false;
    if (torchLight) torchLight.intensity = 4.2 + Math.sin(game.time * 13) * .8;

    /* 交互提示 */
    if (self.active) {
      const t = castTarget();
      self.target = t;
      game.ui.updatePrompt(t);
    }
  };

  /* 缓慢伤害（不触发闪红） */
  this.hurtSoft = function (n, why) {
    if (self.dead) return;
    self.v.hp = U.clamp(self.v.hp - n, 0, 100);
    if (self.v.hp <= 0) self.die(why);
  };

  this.serialize = function () {
    return { pos: self.pos.toArray(), yaw: self.yaw, pitch: self.pitch, v: self.v, effects: self.effects, stats: self.stats };
  };
  this.deserialize = function (s) {
    self.pos.fromArray(s.pos); self.yaw = s.yaw; self.pitch = s.pitch;
    Object.assign(self.v, s.v); Object.assign(self.effects, s.effects); Object.assign(self.stats, s.stats || {});
  };
};
