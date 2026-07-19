/* ===== 玩家：移动 / 射击 / 武器 / 受伤 ===== */
"use strict";

const Player = {
  pos: null, vel: null, yaw: 0, pitch: 0,
  height: 1.62, crouchHeight: 1.1, radius: 0.42,
  onGround: true, crouching: false, running: false, moving: false,
  hp: 100, maxHp: 100, dead: false,
  operator: null,
  armor: null, helmet: null,   // {defId, dur}
  weapons: [null, null],       // 槽位 0 主武器 1 副武器
  cur: 0,
  reserve: {},                 // 弹药类型 -> 发数
  reloading: 0, reloadTotal: 0,
  fireTimer: 0, triggerHeld: false,
  ads: 0, adsTarget: 0,
  spreadHeat: 0, recoilKick: 0,
  usingMed: null, medTimer: 0,
  abilityCd: 0, abilityActive: 0,
  healOverTime: 0, speedBoost: 0,
  stepTimer: 0, heartbeatTimer: 0,
  kills: 0,
  viewmodel: null, muzzleRef: null,
  baseFov: 75,

  init(snapshot, spawn) {
    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = Math.atan2(this.pos.x, this.pos.z);
    this.pitch = 0;
    this.hp = this.maxHp; this.dead = false;
    this.kills = 0;
    this.crouching = false; this.running = false;
    this.reloading = 0; this.fireTimer = 0; this.ads = 0; this.adsTarget = 0;
    this.spreadHeat = 0; this.recoilKick = 0;
    this.usingMed = null; this.medTimer = 0;
    this.abilityCd = 0; this.abilityActive = 0;
    this.healOverTime = 0; this.speedBoost = 0;
    this.operator = OPERATORS.find(o => o.id === snapshot.operator) || OPERATORS[0];

    this.armor = snapshot.armor ? { defId: snapshot.armor, dur: DEF(snapshot.armor).durability } : null;
    this.helmet = snapshot.helmet ? { defId: snapshot.helmet, dur: DEF(snapshot.helmet).durability } : null;

    this.weapons = [null, null];
    if (snapshot.primary) this.weapons[0] = this.makeWeapon(snapshot.primary);
    if (snapshot.secondary) this.weapons[1] = this.makeWeapon(snapshot.secondary);
    this.cur = this.weapons[0] ? 0 : 1;
    let usedFallback = false;
    if (!this.weapons[0] && !this.weapons[1]) {
      this.weapons[1] = this.makeWeapon("g17");   // 空手出击保底手枪
      usedFallback = true;
    }

    this.reserve = {};
    Inventory.initRaid(snapshot);
    if (usedFallback) this.addReserve("9x19", 51);
    for (const w of this.weapons) {
      if (w) w.mag = DEF(w.defId).mag;   // 出击时满弹匣
    }
    this.buildViewmodel();
    this.applyFov();
  },

  makeWeapon(defId) {
    return { defId, mag: 0 };
  },

  curWeapon() { return this.weapons[this.cur]; },
  curDef() { const w = this.curWeapon(); return w ? DEF(w.defId) : null; },

  /* 从库存扣备弹 */
  takeReserve(ammoType, want) {
    let have = this.reserve[ammoType] || 0;
    if (have >= want) { this.reserve[ammoType] = have - want; return want; }
    this.reserve[ammoType] = 0;
    return have;
  },
  addReserve(ammoType, n) {
    this.reserve[ammoType] = (this.reserve[ammoType] || 0) + n;
  },

  eyeY() {
    const h = this.crouching ? this.crouchHeight : this.height;
    return this.pos.y + h;
  },

  applyFov() {
    this.baseFov = App.settings.fov;
  },

  /* ---- 视角模型 ---- */
  buildViewmodel() {
    if (this.viewmodel) World.camera.remove(this.viewmodel);
    const g = new THREE.Group();
    const def = this.curDef();
    if (def) {
      const cls = def.vClass;
      const mkBox = (w, h, d, color, tex, scale) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        World.scaleBoxUV(geo, w, h, d, scale || 9);
        return new THREE.Mesh(geo, World.mat(color, tex));
      };
      const GLOVE = 0x7c6248;
      const len = { pistol: 0.3, smg: 0.52, rifle: 0.74, lmg: 0.82, shotgun: 0.78, sniper: 0.98 }[cls] || 0.6;
      const modelName = def.vModel ||
        { pistol: "pistol", smg: "smg", rifle: "rifle", lmg: "rifle", shotgun: "shotgun", sniper: "sniper" }[cls];
      const wrapper = ModelLib.gunWrapper(modelName, len);
      if (wrapper) {
        /* 使用 CC0 GLB 枪模（不再附加手部方块） */
        wrapper.position.set(0, -0.03, -len / 2 + 0.16);
        g.add(wrapper);
        const muzzle = new THREE.Object3D();
        muzzle.position.set(0, 0, wrapper.position.z - len / 2);
        g.add(muzzle);
        this.muzzleRef = muzzle;
      } else {
        this.buildViewmodelFallback(g, def, cls, len, mkBox, GLOVE);
      }
    }
    g.position.set(0.22, -0.2, -0.42);
    World.camera.add(g);
    this.viewmodel = g;
  },

  /* 几何体后备枪模（模型加载失败时） */
  buildViewmodelFallback(g, def, cls, len, mkBox, GLOVE) {
    const METAL = 0x8f979e, DARK = 0x596066, WOOD = 0xb98d5e;
    const barrel = mkBox(0.055, 0.07, len, cls === "shotgun" ? WOOD : METAL, cls === "shotgun" ? "wood" : "plates");
    barrel.position.set(0, 0, -len / 2);
    g.add(barrel);
    const receiver = mkBox(0.075, 0.1, 0.24, METAL, "plates");
    receiver.position.set(0, -0.01, 0.06);
    g.add(receiver);
    const gripM = mkBox(0.05, 0.14, 0.06, DARK, "plates");
    gripM.position.set(0, -0.11, 0.1);
    gripM.rotation.x = 0.3;
    g.add(gripM);
    if (cls !== "pistol") {
      const magM = mkBox(0.05, 0.14, 0.08, DARK, "plates");
      magM.position.set(0, -0.11, -0.05);
      magM.rotation.x = -0.15;
      g.add(magM);
      const stock = mkBox(0.06, 0.09, 0.2, cls === "shotgun" ? WOOD : DARK, cls === "shotgun" ? "wood" : "plates");
      stock.position.set(0, -0.02, 0.25);
      g.add(stock);
    }
    if (cls === "sniper") {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 8), World.mat(DARK, "plates"));
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.07, -0.05);
      g.add(scope);
    }
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, -len);
    g.add(muzzle);
    this.muzzleRef = muzzle;
    const hand = mkBox(0.07, 0.07, 0.1, GLOVE, "bark", 7);
    hand.position.set(0, -0.1, 0.12);
    g.add(hand);
    if (cls !== "pistol") {
      const hand2 = mkBox(0.07, 0.07, 0.1, GLOVE, "bark", 7);
      hand2.position.set(0, -0.05, -len * 0.55);
      g.add(hand2);
    }
  },
  switchWeapon(idx) {
    if (idx === this.cur || !this.weapons[idx] || this.reloading > 0 || this.usingMed) return;
    this.cur = idx;
    this.adsTarget = 0;
    this.buildViewmodel();
    AudioSys.click(600, 0.05, 0.15);
    UI.updateWeaponHud();
  },

  startReload() {
    const w = this.curWeapon(), def = this.curDef();
    if (!w || this.reloading > 0 || this.usingMed) return;
    if (w.mag >= def.mag) return;
    if ((this.reserve[def.ammo] || 0) <= 0) { UI.toast("没有备用弹药"); return; }
    this.reloading = def.reload;
    this.reloadTotal = def.reload;
    this.adsTarget = 0;
    AudioSys.reload();
  },

  finishReload() {
    const w = this.curWeapon(), def = this.curDef();
    if (!w) return;
    const need = def.mag - w.mag;
    w.mag += this.takeReserve(def.ammo, need);
    UI.updateWeaponHud();
  },

  currentSpread() {
    const def = this.curDef();
    if (!def) return 0;
    let s = def.spread;
    if (this.adsTarget > 0.5) s *= 0.22;
    if (this.crouching) s *= 0.75;
    if (this.moving) s *= 1.25;
    if (this.running) s *= 1.8;
    s += this.spreadHeat;
    return s;
  },

  /* 立即把相机对齐到最新视角（射击取向前先调用，消除一帧延迟偏移） */
  syncCameraRotation() {
    const cam = World.camera;
    cam.rotation.order = "YXZ";
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch + this.recoilKick;
    cam.position.set(this.pos.x, this.eyeY(), this.pos.z);
    cam.updateMatrixWorld();
  },

  tryFire(dt) {
    const w = this.curWeapon(), def = this.curDef();
    if (!w || this.reloading > 0 || this.usingMed || this.dead) return;
    if (this.fireTimer > 0) return;
    if (w.mag <= 0) {
      AudioSys.dryfire();
      this.fireTimer = 0.3;
      this.startReload();
      return;
    }
    this.fireTimer = 60 / def.rpm;
    w.mag--;
    this.syncCameraRotation();
    const pellets = def.pellets || 1;
    const origin = new THREE.Vector3(this.pos.x, this.eyeY(), this.pos.z);
    for (let i = 0; i < pellets; i++) {
      const spreadRad = THREE.MathUtils.degToRad(this.currentSpread());
      const dir = this.getAimDir(spreadRad);
      this.fireRay(origin, dir, def);
    }
    /* 后坐 */
    this.recoilKick += def.recoil * 0.011;
    this.pitch += def.recoil * 0.005 * (0.7 + Math.random() * 0.6);
    this.yaw += (Math.random() - 0.5) * def.recoil * 0.002;
    this.spreadHeat = Math.min(this.spreadHeat + def.recoil * 0.12, 1.2);
    AudioSys.gunshot(def.vClass);
    if (this.muzzleRef) {
      const mpos = new THREE.Vector3();
      this.muzzleRef.getWorldPosition(mpos);
      World.addFlash(mpos, 0xffc36b, 6, 0.05);
    }
    AI.notifyGunshot(this.pos, 85);
    UI.updateWeaponHud();
    UI.crosshairPulse();
  },

  getAimDir(spreadRad) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(World.camera.quaternion);
    if (spreadRad > 0) {
      const u = new THREE.Vector3(1, 0, 0).applyQuaternion(World.camera.quaternion);
      const v = new THREE.Vector3(0, 1, 0).applyQuaternion(World.camera.quaternion);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spreadRad;
      dir.add(u.multiplyScalar(Math.cos(a) * r)).add(v.multiplyScalar(Math.sin(a) * r)).normalize();
    }
    return dir;
  },

  fireRay(origin, dir, def) {
    const enemyMeshes = AI.enemies.filter(e => !e.dead).map(e => e.mesh);
    const hit = World.raycast(origin, dir, 300, enemyMeshes);
    let end;
    if (hit) {
      end = hit.point;
      const enemy = AI.findByObject(hit.object);
      if (enemy) {
        const isHead = hit.object.name === "head";
        let dmg = def.dmg;
        const dist = hit.distance;
        if (dist > def.range) dmg *= Math.max(0.35, 1 - (dist - def.range) / 90);
        if (isHead) dmg *= 2.0;
        enemy.takeDamage(dmg, isHead, this.pos);
        UI.showHitmarker(enemy.dead);
        UI.spawnDamageNumber(hit.point, Math.round(dmg), isHead);
        AudioSys.hitmark(enemy.dead);
      } else {
        World.addImpact(hit.point);
      }
    } else {
      end = origin.clone().add(dir.clone().multiplyScalar(300));
    }
    const from = origin.clone().add(dir.clone().multiplyScalar(1.2)).add(new THREE.Vector3(0, -0.12, 0));
    World.addTracer(from, end);
  },

  /* ---- 医疗 ---- */
  useMed() {
    if (this.usingMed || this.dead || this.hp >= this.maxHp) {
      if (this.hp >= this.maxHp) UI.toast("生命值已满");
      return;
    }
    const med = Inventory.findBestMed();
    if (!med) { UI.toast("没有医疗物品"); return; }
    const def = DEF(med.id);
    const mul = this.operator.medMul || 1;
    this.usingMed = med;
    this.medTimer = def.useTime * mul;
    this.medTotal = this.medTimer;
    this.adsTarget = 0;
  },

  /* ---- 干员技能 ---- */
  useAbility() {
    if (this.abilityCd > 0 || this.dead) return;
    const op = this.operator;
    this.abilityCd = op.ability.cd;
    AudioSys.beep(true);
    if (op.id === "dwolf") {
      this.speedBoost = op.ability.dur;
      UI.toast("动力外骨骼启动！");
    } else if (op.id === "stinger") {
      this.healOverTime = op.ability.dur;
      UI.toast("蜂巢急救激素注射");
      AudioSys.heal();
    } else if (op.id === "luna") {
      AI.revealAll(op.ability.dur);
      UI.toast("侦察箭已部署，敌人被标记");
    } else if (op.id === "uluru") {
      this.throwIncendiary();
      UI.toast("燃烧榴弹！");
    }
    UI.updateAbilityHud();
  },

  throwIncendiary() {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(World.camera.quaternion);
    const origin = new THREE.Vector3(this.pos.x, this.eyeY(), this.pos.z);
    const hit = World.raycast(origin, dir, 26);
    const target = hit ? hit.point : origin.clone().add(dir.multiplyScalar(26));
    setTimeout(() => {
      World.addBurnZone(target.x, target.z, 4.5, 6, 22);
      AudioSys.explosion();
      AI.notifyGunshot(new THREE.Vector3(target.x, 0, target.z), 60);
      AI.damageInRadius(target.x, target.z, 4.8, 45);
    }, 500);
  },

  /* ---- 受伤 ---- */
  takeDamage(dmg, isHead) {
    if (this.dead || App.state !== "raid") return;
    let final = dmg;
    if (isHead) {
      final *= 1.6;
      if (this.helmet && this.helmet.dur > 0) {
        const hd = DEF(this.helmet.defId);
        final *= (1 - hd.reduce);
        this.helmet.dur = Math.max(0, this.helmet.dur - dmg * 0.8);
      }
    } else if (this.armor && this.armor.dur > 0) {
      const ad = DEF(this.armor.defId);
      final *= (1 - ad.reduce);
      this.armor.dur = Math.max(0, this.armor.dur - dmg * 0.85);
    }
    this.hp -= final;
    AudioSys.hurt();
    UI.damageFlash();
    UI.updateHealthHud();
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true;
      App.onPlayerDeath();
    }
  },
  /* ---- 主更新 ---- */
  update(dt, input) {
    if (this.dead) return;
    const op = this.operator;

    /* 冷却与状态计时 */
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.abilityCd > 0) { this.abilityCd -= dt; if (this.abilityCd < 0) this.abilityCd = 0; }
    if (this.speedBoost > 0) this.speedBoost -= dt;
    if (this.healOverTime > 0) {
      this.healOverTime -= dt;
      this.hp = Math.min(this.maxHp, this.hp + 12 * dt);
      UI.updateHealthHud();
    }
    this.spreadHeat = Math.max(0, this.spreadHeat - dt * 4.0);
    this.recoilKick = Math.max(0, this.recoilKick - dt * 0.35);

    /* 换弹 */
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.reloading = 0; this.finishReload(); }
    }

    /* 医疗 */
    if (this.usingMed) {
      this.medTimer -= dt;
      UI.showProgress("使用 " + DEF(this.usingMed.id).name, 1 - this.medTimer / this.medTotal);
      if (this.medTimer <= 0) {
        const def = DEF(this.usingMed.id);
        this.hp = Math.min(this.maxHp, this.hp + def.heal);
        Inventory.consumeItem(this.usingMed.uid);
        this.usingMed = null;
        UI.hideProgress();
        AudioSys.heal();
        UI.updateHealthHud();
      }
    }

    /* 移动 */
    const wishDir = new THREE.Vector3();
    if (input.fwd) wishDir.z -= 1;
    if (input.back) wishDir.z += 1;
    if (input.left) wishDir.x -= 1;
    if (input.right) wishDir.x += 1;
    this.moving = wishDir.lengthSq() > 0;
    this.crouching = input.crouch;
    this.running = input.run && input.fwd && !this.crouching && this.adsTarget < 0.5;

    let speed = 5.2;
    if (this.running) speed = 8.2 * (op.speedMul || 1);
    if (this.crouching) speed = 2.6;
    if (this.adsTarget > 0.5) speed *= 0.55;
    if (this.speedBoost > 0) speed *= 1.4;
    if (this.usingMed) speed *= 0.45;

    if (this.moving) {
      wishDir.normalize();
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const wx = wishDir.x * cos + wishDir.z * sin;
      const wz = -wishDir.x * sin + wishDir.z * cos;
      this.vel.x = THREE.MathUtils.lerp(this.vel.x, wx * speed, Math.min(1, dt * 10));
      this.vel.z = THREE.MathUtils.lerp(this.vel.z, wz * speed, Math.min(1, dt * 10));
    } else {
      this.vel.x = THREE.MathUtils.lerp(this.vel.x, 0, Math.min(1, dt * 12));
      this.vel.z = THREE.MathUtils.lerp(this.vel.z, 0, Math.min(1, dt * 12));
    }

    /* 重力与跳跃 */
    const groundY = World.groundHeightAt(this.pos.x, this.pos.z, this.pos.y);
    this.onGround = this.pos.y <= groundY + 0.02;
    if (this.onGround) {
      this.vel.y = 0;
      this.pos.y = THREE.MathUtils.lerp(this.pos.y, groundY, Math.min(1, dt * 20));
      if (input.jump && !this.crouching && !this.usingMed) {
        this.vel.y = 5.4;
        this.pos.y += 0.05;
      }
    } else {
      this.vel.y -= 14 * dt;
    }

    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;
    if (this.pos.y < groundY) this.pos.y = groundY;
    World.resolveCollision(this.pos, this.radius, this.pos.y, this.pos.y + (this.crouching ? this.crouchHeight : this.height));

    /* 脚步声 */
    if (this.moving && this.onGround) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.running ? 0.3 : (this.crouching ? 0.65 : 0.44);
        AudioSys.footstep(this.running);
        if (!this.crouching) {
          const noise = (this.running ? 26 : 13) * (op.noiseMul || 1);
          AI.notifyNoise(this.pos, noise);
        }
      }
    }

    /* 开火 */
    const def = this.curDef();
    if (input.fire && def) {
      if (def.auto || !this.triggerHeld) this.tryFire(dt);
      this.triggerHeld = true;
    } else this.triggerHeld = false;

    /* ADS */
    this.adsTarget = input.ads && !this.reloading && !this.usingMed ? 1 : 0;
    this.ads = THREE.MathUtils.lerp(this.ads, this.adsTarget, Math.min(1, dt * 12));

    /* 灼烧区伤害 */
    for (const b of World.burnZones) {
      const dx = this.pos.x - b.x, dz = this.pos.z - b.z;
      if (dx * dx + dz * dz < b.r * b.r && this.pos.y < 2) {
        this.hp -= b.dps * dt * (op.burnResist || 1);
        UI.damageFlash();
        UI.updateHealthHud();
        if (this.hp <= 0) { this.hp = 0; this.dead = true; App.onPlayerDeath(); }
      }
    }

    /* 低血量心跳 */
    if (this.hp < 30) {
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        this.heartbeatTimer = 0.55 + this.hp / 60;
        AudioSys.heartbeat();
      }
    }

    this.updateCamera(dt);
  },

  updateCamera(dt) {
    const cam = World.camera;
    cam.position.set(this.pos.x, this.eyeY(), this.pos.z);
    cam.rotation.order = "YXZ";
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch + this.recoilKick;

    /* FOV / 视角模型位置 */
    const def = this.curDef();
    const zoom = def && def.zoom ? def.zoom : 1.35;
    const targetFov = this.baseFov / (1 + (zoom - 1) * this.ads);
    if (Math.abs(cam.fov - targetFov) > 0.1) {
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, Math.min(1, dt * 12));
      cam.updateProjectionMatrix();
    }
    if (this.viewmodel) {
      const t = performance.now() / 1000;
      const bob = this.moving && this.onGround ? Math.sin(t * (this.running ? 14 : 9)) * 0.008 : 0;
      const hipX = 0.22, adsX = 0.0;
      const hipY = -0.2, adsY = def && def.vClass === "sniper" ? -0.108 : -0.148;
      this.viewmodel.position.x = THREE.MathUtils.lerp(hipX, adsX, this.ads);
      this.viewmodel.position.y = THREE.MathUtils.lerp(hipY, adsY, this.ads) + bob;
      this.viewmodel.position.z = -0.42 + this.recoilKick * 0.55;
      this.viewmodel.rotation.x = this.recoilKick * 1.4;
      this.viewmodel.visible = !(def && def.vClass === "sniper" && this.ads > 0.85);
    }
  }
  /*__PLAYER_END__*/
};
