/* ===== 游荡者 AI ===== */
"use strict";

class Enemy {
  constructor(x, z, tier) {
    this.tier = tier; // 0 普通 1 精英 2 头目
    this.name = tier === 2 ? "游荡者头目" : (tier === 1 ? "精英游荡者" : "游荡者");
    this.hp = tier === 2 ? 320 : (tier === 1 ? 160 : 100);
    this.maxHp = this.hp;
    this.armorRed = tier === 2 ? 0.45 : (tier === 1 ? 0.3 : 0.1);
    this.dmg = tier === 2 ? 10 : (tier === 1 ? 7 : 5);
    this.fireInterval = tier === 2 ? 0.55 : 0.72;
    this.viewDist = tier === 2 ? 55 : 45;
    this.hearMul = 1;
    this.speed = 3.1 + Math.random() * 0.5;
    this.dead = false;
    this.state = "patrol";        // patrol / alert / combat
    this.alertPos = null;
    this.fireTimer = 1 + Math.random();
    this.burstLeft = 0;
    this.repathTimer = 0;
    this.wanderTarget = null;
    this.home = { x, z };
    this.wanderR = 16;
    this.revealed = 0;
    this.stuckTimer = 0;
    this.lastPos = new THREE.Vector3(x, 0, z);

    this.pos = new THREE.Vector3(x, 0, z);
    this.buildMesh();
  }

  buildMesh() {
    const g = new THREE.Group();
    const skinned = ModelLib.cloneSkinned("swat");
    if (skinned) {
      /* CC0 SWAT 角色模型（Quaternius） */
      const model = skinned.scene;
      const box = new THREE.Box3().setFromObject(model);
      const h = Math.max(box.max.y - box.min.y, 1e-6);
      const s = 1.75 / h;
      model.scale.setScalar(s);
      model.position.y = -box.min.y * s;
      const tint = this.tier === 2 ? new THREE.Color(0xc0392b)
        : (this.tier === 1 ? new THREE.Color(0x4a6584) : new THREE.Color(0x6c7a52));
      model.traverse(o => {
        if (o.isMesh || o.isSkinnedMesh) {
          o.castShadow = true;
          o.raycast = function () {};
          if (o.material) {
            o.material = o.material.clone();
            if ((o.material.name || "") === "Swat") o.material.color.lerp(tint, 0.7);
          }
        }
      });
      g.add(model);
      this.mixer = new THREE.AnimationMixer(model);
      this.actions = {};
      for (const clip of skinned.animations) {
        this.actions[clip.name.split("|").pop()] = this.mixer.clipAction(clip);
      }
      this.curAction = null;
      this.playAction("Idle_Gun");
      if (this.tier === 2) g.scale.setScalar(1.12);
    } else {
      this.buildBoxBody(g);
    }

    /* 放宽的隐形命中盒（提升命中手感） */
    const hbMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    const hbBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.75), hbMat);
    hbBody.position.y = 0.82;
    hbBody.name = "body";
    g.add(hbBody);
    const hbHead = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.46, 0.44), hbMat);
    hbHead.position.y = 1.64;
    hbHead.name = "head";
    g.add(hbHead);

    /* 标记轮廓（露娜技能） */
    const outline = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.95, 0.7),
      new THREE.MeshBasicMaterial({ color: 0xff4b3a, transparent: true, opacity: 0.0, depthTest: false })
    );
    outline.position.y = 0.97;
    outline.raycast = function () {};
    g.add(outline);
    this.outline = outline;

    g.position.copy(this.pos);
    World.scene.add(g);
    this.mesh = g;
  }

  playAction(name, once) {
    if (!this.actions || !this.actions[name] || this.curAction === name) return;
    const next = this.actions[name];
    next.reset();
    if (once) { next.setLoop(THREE.LoopOnce); next.clampWhenFinished = true; }
    next.play();
    if (this.curAction && this.actions[this.curAction]) {
      this.actions[this.curAction].crossFadeTo(next, 0.18, false);
    }
    this.curAction = name;
  }

  /* 几何体后备模型（GLB 加载失败时） */
  buildBoxBody(g) {
    const clothes = this.tier === 2 ? 0xa3564e : (this.tier === 1 ? 0x74839c : 0x8b9678);
    const mkPart = (w, h, d, color, tex, scale) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      World.scaleBoxUV(geo, w, h, d, scale || 2.2);
      const m = new THREE.Mesh(geo, World.mat(color, tex));
      m.name = "body";
      return m;
    };
    const torso = mkPart(0.62, 0.72, 0.34, clothes, "bark");
    torso.position.y = 1.08;
    g.add(torso);
    const hips = mkPart(0.5, 0.3, 0.3, clothes, "bark");
    hips.position.y = 0.62;
    g.add(hips);
    const legL = mkPart(0.2, 0.55, 0.22, clothes, "bark", 3);
    legL.position.set(-0.14, 0.27, 0);
    g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.14;
    g.add(legR);
    const head = mkPart(0.3, 0.3, 0.3, 0xc79b78, "concrete", 3);
    head.position.y = 1.62;
    head.name = "head";
    g.add(head);
    if (this.tier >= 1) {
      const helm = mkPart(0.34, 0.16, 0.34, this.tier === 2 ? 0xb04438 : 0x5e6f84, "plates", 4);
      helm.position.y = 1.74;
      helm.name = "head";
      g.add(helm);
    }
    const gun = mkPart(0.08, 0.1, 0.7, 0x6a7178, "plates", 5);
    gun.position.set(0.22, 1.15, 0.3);
    g.add(gun);
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  }

  eyePos() { return new THREE.Vector3(this.pos.x, this.pos.y + 1.58, this.pos.z); }

  canSeePlayer() {
    if (Player.dead) return false;
    const pp = new THREE.Vector3(Player.pos.x, Player.eyeY(), Player.pos.z);
    const dist = this.pos.distanceTo(Player.pos);
    if (dist > this.viewDist) return false;
    /* 视野角（战斗状态全向感知） */
    if (this.state !== "combat") {
      const fwd = new THREE.Vector3(Math.sin(this.mesh.rotation.y), 0, Math.cos(this.mesh.rotation.y));
      const to = new THREE.Vector3().subVectors(Player.pos, this.pos).setY(0).normalize();
      if (fwd.dot(to) < 0.15 && dist > 4) return false;
      /* 蹲伏更难被发现 */
      if (Player.crouching && dist > this.viewDist * 0.55) return false;
    }
    return World.hasLOS(this.eyePos(), pp);
  }

  takeDamage(dmg, isHead, fromPos) {
    if (this.dead) return;
    let final = dmg * (1 - (isHead ? this.armorRed * 0.5 : this.armorRed));
    this.hp -= final;
    if (this.state !== "combat") {
      this.fireTimer = Math.max(this.fireTimer, 0.6 + Math.random() * 0.5);
      this.burstLeft = 0;
    }
    this.state = "combat";
    this.alertPos = fromPos ? fromPos.clone() : Player.pos.clone();
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dead = true;
    if (this.mixer && this.actions && this.actions["Death"]) {
      /* 播放死亡动画后再移除 */
      this.playAction("Death", true);
      this.deathT = 1.5;
      if (this.outline) this.outline.material.opacity = 0;
    } else {
      World.scene.remove(this.mesh);
    }
    Player.kills++;
    UI.addKillfeed(this.name);
    /* 尸体战利品：携带武器 + 随机物 */
    const drop = [];
    if (this.tier === 2) {
      drop.push(weightedPick([["scarh", 3], ["k416", 3], ["m250", 2], ["awm", 1.4]]));
      drop.push(weightedPick([["mandel", 2.5], ["heart_afr", 2], ["cipher", 3], ["painting", 2.5], ["goldbar", 3]]));
      drop.push("armor5");
    } else if (this.tier === 1) {
      drop.push(weightedPick([["akm", 4], ["m4a1", 3], ["qbz95", 3], ["m870", 2], ["vector", 1.5]]));
      if (Math.random() < 0.4) drop.push(weightedPick([["armor3", 3], ["helm3", 3], ["intel", 2]]));
    } else {
      if (Math.random() < 0.5) drop.push(weightedPick([["g17", 4], ["smg45", 3], ["m870", 2], ["akm", 1.5]]));
    }
    World.addCorpseContainer(this.pos.x, this.pos.z, drop);
    App.checkBossKilled(this);
  }

  moveToward(target, dt, speedMul) {
    const dir = new THREE.Vector3().subVectors(target, this.pos).setY(0);
    const d = dir.length();
    if (d < 0.4) return true;
    dir.normalize();
    const step = this.speed * (speedMul || 1) * dt;
    this.pos.x += dir.x * step;
    this.pos.z += dir.z * step;
    World.resolveCollision(this.pos, 0.4, this.pos.y, this.pos.y + 1.8);
    const gy = World.groundHeightAt(this.pos.x, this.pos.z, this.pos.y);
    this.pos.y = THREE.MathUtils.lerp(this.pos.y, gy, Math.min(1, dt * 10));
    this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    return false;
  }

  update(dt) {
    if (this.dead) {
      if (this.mixer && this.deathT > 0) {
        this.deathT -= dt;
        this.mixer.update(dt);
        if (this.deathT <= 0) World.scene.remove(this.mesh);
      }
      return;
    }
    if (this.mixer) this.mixer.update(dt);
    const prevX = this.pos.x, prevZ = this.pos.z;
    this.fireTimer -= dt;
    this.repathTimer -= dt;
    if (this.revealed > 0) {
      this.revealed -= dt;
      this.outline.material.opacity = 0.5 + 0.25 * Math.sin(performance.now() / 120);
    } else this.outline.material.opacity = 0;

    const seen = this.canSeePlayer();
    const dist = this.pos.distanceTo(Player.pos);

    if (seen) {
      if (this.state !== "combat") {
        /* 发现目标后的反应延迟 */
        this.fireTimer = Math.max(this.fireTimer, 1.0 + Math.random() * 0.8);
        this.burstLeft = 0;
      }
      this.state = "combat";
      this.alertPos = Player.pos.clone();
    }

    if (this.state === "combat") {
      if (seen) {
        this.mesh.rotation.y = Math.atan2(Player.pos.x - this.pos.x, Player.pos.z - this.pos.z);
        /* 保持中距离，过远靠近，过近后撤 */
        if (dist > 30) this.moveToward(Player.pos, dt, 1);
        else if (dist < 8) {
          const away = this.pos.clone().sub(Player.pos).setY(0).normalize().multiplyScalar(10).add(this.pos);
          this.moveToward(away, dt, 0.8);
        } else if (this.repathTimer <= 0) {
          this.repathTimer = 1.2;
          const side = new THREE.Vector3(Player.pos.z - this.pos.z, 0, -(Player.pos.x - this.pos.x))
            .normalize().multiplyScalar((Math.random() < 0.5 ? 1 : -1) * 4);
          this.strafeTarget = this.pos.clone().add(side);
        }
        if (this.strafeTarget) this.moveToward(this.strafeTarget, dt, 0.7);
        this.tryShoot(dist);
      } else if (this.alertPos) {
        if (this.moveToward(this.alertPos, dt, 1.15)) {
          this.alertPos = null;
          this.state = "alert";
          this.searchTimer = 5;
        }
      } else {
        this.state = "alert";
        this.searchTimer = 5;
      }
    } else if (this.state === "alert") {
      this.searchTimer -= dt;
      if (this.repathTimer <= 0) {
        this.repathTimer = 1.6;
        this.wanderTarget = new THREE.Vector3(
          this.pos.x + (Math.random() - 0.5) * 14, 0,
          this.pos.z + (Math.random() - 0.5) * 14);
      }
      if (this.wanderTarget) this.moveToward(this.wanderTarget, dt, 0.8);
      if (this.searchTimer <= 0) this.state = "patrol";
    } else {
      /* 巡逻 */
      if (!this.wanderTarget || this.repathTimer <= 0) {
        this.repathTimer = 3 + Math.random() * 4;
        this.wanderTarget = new THREE.Vector3(
          this.home.x + (Math.random() - 0.5) * this.wanderR * 2, 0,
          this.home.z + (Math.random() - 0.5) * this.wanderR * 2);
      }
      this.moveToward(this.wanderTarget, dt, 0.45);
    }

    /* 灼烧区 */
    for (const b of World.burnZones) {
      const dx = this.pos.x - b.x, dz = this.pos.z - b.z;
      if (dx * dx + dz * dz < b.r * b.r) {
        this.hp -= b.dps * dt;
        if (this.hp <= 0 && !this.dead) this.die();
      }
    }

    this.mesh.position.copy(this.pos);

    /* 动画状态：移动播放 跑/走，静止播放持枪待机 */
    if (this.mixer) {
      const speed = Math.hypot(this.pos.x - prevX, this.pos.z - prevZ) / Math.max(dt, 1e-6);
      if (speed > 2.2) this.playAction("Run");
      else if (speed > 0.4) this.playAction("Walk");
      else this.playAction("Idle_Gun");
    }
  }

  tryShoot(dist) {
    if (this.fireTimer > 0) return;
    if (this.burstLeft <= 0) {
      this.burstLeft = 2 + Math.floor(Math.random() * 2);
      this.fireTimer = this.fireInterval * (2.8 + Math.random() * 1.5);
      return;
    }
    this.burstLeft--;
    this.fireTimer = this.fireInterval * (0.45 + Math.random() * 0.35);
    /* 命中判定（已大幅削弱） */
    let acc = 0.34 - dist * 0.008;
    if (Player.running) acc -= 0.1;
    if (Player.crouching) acc -= 0.08;
    if (Player.moving) acc -= 0.07;
    acc = Math.max(0.04, Math.min(0.4, acc));
    const muzzle = this.eyePos();
    AudioSys.distantShot(dist);
    World.addFlash(muzzle, 0xffc36b, 5, 0.05);
    const pp = new THREE.Vector3(Player.pos.x, Player.eyeY() - 0.3, Player.pos.z);
    if (Math.random() < acc) {
      World.addTracer(muzzle, pp, 0xffb08a);
      const isHead = Math.random() < 0.12;
      Player.takeDamage(this.dmg * (0.85 + Math.random() * 0.3), isHead);
    } else {
      const miss = pp.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 4, Math.random() * 2, (Math.random() - 0.5) * 4));
      World.addTracer(muzzle, miss, 0xffb08a);
    }
  }
}

const AI = {
  enemies: [],

  spawnAll() {
    this.enemies = [];
    for (const zone of World.enemySpawns) {
      for (let i = 0; i < zone.n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * zone.r;
        const x = zone.x + Math.cos(a) * r;
        const z = zone.z + Math.sin(a) * r;
        const tier = Math.random() < zone.elite ? 1 : 0;
        const e = new Enemy(x, z, tier);
        e.wanderR = zone.r;
        this.enemies.push(e);
      }
    }
    /* Boss */
    if (World.bossSpot) {
      const boss = new Enemy(World.bossSpot.x, World.bossSpot.z, 2);
      boss.wanderR = 10;
      this.enemies.push(boss);
      this.boss = boss;
    }
  },

  update(dt) {
    for (const e of this.enemies) e.update(dt);
  },

  findByObject(obj) {
    let o = obj;
    while (o) {
      const e = this.enemies.find(en => en.mesh === o);
      if (e) return e;
      o = o.parent;
    }
    return null;
  },

  notifyGunshot(pos, radius) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = e.pos.distanceTo(pos);
      if (d < radius * e.hearMul) {
        if (e.state === "patrol") e.state = "combat";
        e.alertPos = pos.clone ? pos.clone() : new THREE.Vector3(pos.x, 0, pos.z);
      }
    }
  },

  notifyNoise(pos, radius) {
    for (const e of this.enemies) {
      if (e.dead || e.state === "combat") continue;
      const d = e.pos.distanceTo(pos);
      if (d < radius) {
        e.state = "alert";
        e.searchTimer = 6;
        e.wanderTarget = new THREE.Vector3(pos.x, 0, pos.z);
      }
    }
  },

  revealAll(dur) {
    for (const e of this.enemies) {
      if (!e.dead && e.pos.distanceTo(Player.pos) < 80) e.revealed = dur;
    }
    UI.showRevealTip(dur);
  },

  damageInRadius(x, z, r, dmg) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.pos.x - x, dz = e.pos.z - z;
      if (dx * dx + dz * dz < r * r) e.takeDamage(dmg, false, Player.pos);
    }
  },

  aliveCount() { return this.enemies.filter(e => !e.dead).length; }
};
