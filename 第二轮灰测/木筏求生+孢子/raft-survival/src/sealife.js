/* ==========================================================================
   RAFT SURVIVAL · sealife.js
   鱼群 / 钓鱼小游戏 / 鲨鱼「布鲁斯」AI（啃木筏·追人·被赶走·被杀）
   ========================================================================== */
RS.SeaLife = function (game) {
  const U = RS.U, T = RS.Tex, DB = RS.DB;
  const self = this;
  const group = new THREE.Group();
  game.scene.add(group);
  this.group = group;

  /* ============================================================ 鱼群 */
  const fishes = [];
  this.fishes = fishes;
  const FISHMAT = [
    new THREE.MeshStandardMaterial({ color: 0x8fb8c8, roughness: .45, metalness: .25 }),
    new THREE.MeshStandardMaterial({ color: 0xc8a45a, roughness: .5 }),
    new THREE.MeshStandardMaterial({ color: 0xd8d8e0, roughness: .4, metalness: .3 }),
    new THREE.MeshStandardMaterial({ color: 0xe08a5a, roughness: .5 }),
    new THREE.MeshStandardMaterial({ color: 0x6a7a58, roughness: .6 })
  ];
  function buildFish(kind, scale) {
    const g = new THREE.Group();
    const mat = FISHMAT[kind % FISHMAT.length];
    const body = new THREE.Mesh(new THREE.SphereGeometry(.22, 10, 8), mat);
    body.scale.set(1.9, .8, .62); g.add(body);
    const tailPivot = new THREE.Group(); tailPivot.position.x = -.4; g.add(tailPivot);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(.16, .3, 4), mat);
    tail.rotation.z = Math.PI / 2; tail.scale.z = .25; tail.position.x = -.12;
    tailPivot.add(tail);
    const dors = new THREE.Mesh(new THREE.ConeGeometry(.09, .18, 4), mat);
    dors.position.set(0, .16, 0); dors.scale.z = .3; g.add(dors);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 5), new THREE.MeshBasicMaterial({ color: 0x101018 }));
    eye.position.set(.3, .06, .1); g.add(eye);
    const eye2 = eye.clone(); eye2.position.z = -.1; g.add(eye2);
    g.scale.setScalar(scale);
    g.userData = { type: 'fish' };
    return { g, tailPivot };
  }
  function spawnFish() {
    const kind = U.randi(0, DB.FISH.length - 1);
    const sc = U.rand(.7, 1.35) * (1 + kind * .12);
    const b = buildFish(kind, sc);
    const a = U.rand(0, U.TAU), r = U.rand(8, 34);
    const p = game.raft.pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    p.y = U.rand(-4.5, -.9);
    b.g.position.copy(p);
    group.add(b.g);
    const f = {
      mesh: b.g, tail: b.tailPivot, kind, scale: sc,
      pos: p, dir: U.rand(0, U.TAU), speed: U.rand(.9, 2.1), depth: p.y,
      wander: U.rand(0, 9), flee: 0, alive: true
    };
    b.g.userData.fish = f;
    fishes.push(f);
    return f;
  }
  function removeFish(f) {
    const i = fishes.indexOf(f); if (i >= 0) fishes.splice(i, 1);
    group.remove(f.mesh);
    f.mesh.traverse(n => { if (n.geometry) n.geometry.dispose(); });
  }
  this.spearFish = function (f) {
    if (!f) return;
    const d = f.pos.distanceTo(game.player.eye());
    if (d > 4.5) { game.ui.toast('太远了', 'bad'); return; }
    game.debris.spawnBlood(f.pos, 5);
    RS.Audio.play('spear');
    game.inv.add('raw_' + DB.FISH[f.kind][0], 1);
    game.player.stats.caught++;
    removeFish(f);
  };

  /* ============================================================ 钓鱼 */
  const bobber = new THREE.Group();
  {
    const b = new THREE.Mesh(new THREE.SphereGeometry(.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe04030, roughness: .4 }));
    bobber.add(b);
    const w = new THREE.Mesh(new THREE.SphereGeometry(.101, 10, 5, 0, 6.3, 0, 1.6), new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: .4 }));
    w.rotation.x = Math.PI; bobber.add(w);
    bobber.add(new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .18, 5), new THREE.MeshStandardMaterial({ color: 0xdddddd })).translateY(.14));
    bobber.visible = false;
  }
  group.add(bobber);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 10), 3));
  const fishLine = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xf0f0f0, transparent: true, opacity: .55 }));
  fishLine.frustumCulled = false; fishLine.visible = false;
  group.add(fishLine);

  const rod = { state: 'idle', t: 0, pos: new THREE.Vector3(), prog: 0, tension: 0, reeling: false, fishKind: 0, strength: 1, surge: 0, biteT: 0 };
  this.rod = rod;

  function pickFishKind() {
    let tot = 0; DB.FISH.forEach(f => tot += f[5]);
    let r = Math.random() * tot;
    for (let i = 0; i < DB.FISH.length; i++) { r -= DB.FISH[i][5]; if (r <= 0) return i; }
    return 0;
  }
  this.rodPress = function () {
    if (rod.state === 'idle') {
      const aim = game.player.aimWater(42);
      if (!aim) { game.ui.toast('把准心对着海面再抛竿', 'bad'); return; }
      rod.state = 'cast'; rod.t = 0;
      rod.pos.copy(game.player.eye());
      rod.castTo = aim.clone();
      bobber.visible = true; fishLine.visible = true;
      RS.Audio.play('cast');
      game.player.swing(1);
    } else if (rod.state === 'wait' || rod.state === 'cast') {
      endRod(false);
      RS.Audio.play('reel');
    } else if (rod.state === 'bite') {
      rod.state = 'fight'; rod.prog = .12; rod.tension = .18; rod.reeling = true;
      rod.safe = .5; rod.safeTarget = U.rand(.2, .8); rod.surge = 0; rod.hold = 0;
      rod.strength = .7 + rod.fishKind * .22 + U.rand(0, .25);
      RS.Audio.play('reel');
    } else if (rod.state === 'fight') {
      rod.reeling = true;
    }
  };
  this.rodRelease = function () { if (rod.state === 'fight') rod.reeling = false; };
  function endRod(silent) {
    rod.state = 'idle'; rod.prog = 0; rod.tension = 0; rod.reeling = false;
    bobber.visible = false; fishLine.visible = false;
    game.ui.updateFishing(null);
    if (!silent) { }
  }
  this.endRod = endRod;

  function updateRod(dt) {
    if (rod.state === 'idle') return;
    if (game.inv.heldId() !== 'rod') { endRod(true); return; }
    rod.t += dt;
    if (rod.state === 'cast') {
      const k = U.clamp(rod.t / .5, 0, 1);
      rod.pos.lerpVectors(game.player.eye(), rod.castTo, k);
      if (k >= 1) {
        rod.state = 'wait'; rod.t = 0;
        rod.waitFor = U.rand(2.5, 9);
        RS.Audio.play('plop');
        game.debris.spawnSplash(rod.castTo.clone(), .5);
      }
    } else if (rod.state === 'wait') {
      // 附近有鱼群 → 更快咬钩
      let near = 0;
      fishes.forEach(f => { if (f.pos.distanceTo(rod.pos) < 9) near++; });
      rod.t += dt * (near > 2 ? 1.6 : near > 0 ? 1.2 : .8);
      if (rod.t >= rod.waitFor) {
        rod.state = 'bite'; rod.biteT = 0; rod.fishKind = pickFishKind();
        RS.Audio.play('bite');
        game.ui.toast('🐟 有东西咬钩了！点击左键收线', 'good');
      }
    } else if (rod.state === 'bite') {
      rod.biteT += dt;
      if (rod.biteT > 2.6) { endRod(true); game.ui.toast('鱼跑了…', 'bad'); RS.Audio.play('fish_lost'); }
    } else if (rod.state === 'fight') {
      /* 张力指针 = rod.tension（玩家按住左键上升，松手下降）
         绿色安全区 = rod.safe（鱼在挣扎，安全区随机漂移）
         指针停在安全区内才收线（rod.prog 上升） */
      rod.surge -= dt;
      if (rod.surge <= 0) {
        rod.surge = U.rand(.7, 1.9);
        rod.safeTarget = U.rand(.16, .84);
        rod.surgeAmt = U.chance(.4) ? U.rand(1.35, 1.9) : 1;
      }
      rod.safe = U.damp(rod.safe, rod.safeTarget, 2.2, dt);
      const s = rod.surgeAmt || 1;
      if (rod.reeling) rod.tension += dt * .46 * rod.strength * s;
      else rod.tension -= dt * .62;
      rod.tension = U.clamp(rod.tension, 0, 1.02);
      const inSafe = Math.abs(rod.tension - rod.safe) < .13;
      if (inSafe) { rod.prog += dt * .27; rod.hold = (rod.hold || 0) + dt; }
      else { rod.prog -= dt * .10; rod.hold = 0; }
      rod.prog = U.clamp(rod.prog, 0, 1);
      if (rod.reeling) { rod.reelSnd = (rod.reelSnd || 0) + dt; if (rod.reelSnd > .28) { rod.reelSnd = 0; RS.Audio.play('reel', .45); } }
      if (rod.tension >= 1) {
        game.ui.toast('💥 线断了！', 'bad'); RS.Audio.play('fish_lost'); endRod(true);
        game.inv.remove('rod', 0);
      } else if (rod.prog >= 1) {
        const fid = DB.FISH[rod.fishKind][0];
        game.inv.add('raw_' + fid, 1);
        game.player.stats.caught++;
        RS.Audio.play('fish_caught');
        game.ui.toast('🎣 钓到了 ' + DB.FISH[rod.fishKind][1] + '！', 'good');
        game.debris.spawnSplash(rod.pos.clone(), .8);
        endRod(true);
      }
    }
    // 浮标位置
    if (rod.state !== 'idle') {
      const wy = game.world.waterY(rod.pos.x, rod.pos.z);
      let y = wy + .06;
      if (rod.state === 'bite') y = wy - .12 + Math.sin(rod.biteT * 22) * .12;
      if (rod.state === 'fight') {
        y = wy - .06 + Math.sin(game.time * 14) * .1;
        const to = game.player.eye();
        rod.pos.lerp(new THREE.Vector3(to.x, rod.pos.y, to.z), rod.prog * dt * 1.5);
      }
      bobber.position.set(rod.pos.x, y, rod.pos.z);
      const a = game.camera.localToWorld(new THREE.Vector3(.28, -.1, -.9));
      const p = lineGeo.attributes.position;
      const sag = rod.state === 'fight' ? .1 : .5;
      for (let k = 0; k < 10; k++) {
        const t = k / 9;
        p.setXYZ(k, U.lerp(a.x, rod.pos.x, t), U.lerp(a.y, y, t) - Math.sin(t * Math.PI) * sag, U.lerp(a.z, rod.pos.z, t));
      }
      p.needsUpdate = true;
      game.ui.updateFishing(rod);
    }
  }

  /* ============================================================ 鲨鱼 */
  const SHARK_MAX = 100;
  const shark = {
    hp: SHARK_MAX, pos: new THREE.Vector3(30, -2.5, 0), dir: 0, speed: 3.4,
    state: 'patrol', t: 0, target: null, biteCD: U.rand(25, 45), fleeT: 0,
    baitPos: null, baitT: 0, alive: true, respawnT: 0, lunge: 0, targetCell: null
  };
  this.shark = shark;

  const sharkGroup = new THREE.Group();
  const SM = {
    body: new THREE.MeshStandardMaterial({ color: 0x6d8496, roughness: .55 }),
    belly: new THREE.MeshStandardMaterial({ color: 0xdfe6e8, roughness: .6 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2a333c, roughness: .5 }),
    teeth: new THREE.MeshStandardMaterial({ color: 0xf7f2e2, roughness: .35 }),
    eye: new THREE.MeshBasicMaterial({ color: 0x0a0a10 })
  };
  let sharkTail, sharkJaw;
  {
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), SM.body);
    body.scale.set(3.1, 1.0, 1.25);
    body.castShadow = true;
    sharkGroup.add(body);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(.97, 16, 10, 0, 6.3, 1.7, 1.5), SM.belly);
    belly.scale.set(3.05, 1.0, 1.2);
    sharkGroup.add(belly);
    // 头部锥
    const snout = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.9, 14), SM.body);
    snout.rotation.z = -Math.PI / 2; snout.position.x = 3.6; snout.scale.set(1, 1, .85);
    sharkGroup.add(snout);
    // 嘴
    sharkJaw = new THREE.Group();
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(1.1, .1, 1.3), SM.dark);
    mouth.position.set(3.0, -.42, 0); sharkJaw.add(mouth);
    for (let k = 0; k < 12; k++) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(.055, .17, 4), SM.teeth);
      t.position.set(2.6 + (k % 6) * .18, -.36, (k < 6 ? -1 : 1) * (.2 + (k % 6) * .06));
      sharkJaw.add(t);
      const t2 = t.clone(); t2.position.y = -.5; t2.rotation.x = Math.PI; sharkJaw.add(t2);
    }
    sharkGroup.add(sharkJaw);
    // 背鳍
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(.62, 1.5, 4), SM.body);
    dorsal.position.set(-.1, 1.0, 0); dorsal.scale.z = .22; dorsal.rotation.y = Math.PI / 4;
    dorsal.castShadow = true;
    sharkGroup.add(dorsal);
    const d2 = new THREE.Mesh(new THREE.ConeGeometry(.26, .5, 4), SM.body);
    d2.position.set(-2.2, .7, 0); d2.scale.z = .2; d2.rotation.y = Math.PI / 4; sharkGroup.add(d2);
    // 胸鳍
    [-1, 1].forEach(s => {
      const f = new THREE.Mesh(new THREE.ConeGeometry(.5, 1.5, 4), SM.body);
      f.position.set(1.5, -.35, s * 1.0);
      f.rotation.set(0, 0, s * .5);
      f.rotation.x = s * 1.35;
      f.scale.z = .18;
      sharkGroup.add(f);
    });
    // 尾
    sharkTail = new THREE.Group();
    sharkTail.position.x = -2.9;
    const tb = new THREE.Mesh(new THREE.ConeGeometry(.55, 1.4, 8), SM.body);
    tb.rotation.z = Math.PI / 2; tb.position.x = -.6; tb.scale.set(1, 1, .7);
    sharkTail.add(tb);
    const tf1 = new THREE.Mesh(new THREE.ConeGeometry(.5, 1.9, 4), SM.body);
    tf1.position.set(-1.35, .75, 0); tf1.rotation.z = -.35; tf1.scale.z = .16;
    sharkTail.add(tf1);
    const tf2 = new THREE.Mesh(new THREE.ConeGeometry(.36, 1.1, 4), SM.body);
    tf2.position.set(-1.3, -.5, 0); tf2.rotation.z = 3.5; tf2.scale.z = .16;
    sharkTail.add(tf2);
    sharkGroup.add(sharkTail);
    // 眼 + 鳃
    [-1, 1].forEach(s => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(.11, 8, 6), SM.eye);
      e.position.set(2.75, .25, s * .62); sharkGroup.add(e);
      for (let k = 0; k < 5; k++) {
        const gl = new THREE.Mesh(new THREE.BoxGeometry(.04, .38, .02), SM.dark);
        gl.position.set(1.55 - k * .19, -.1, s * .78);
        gl.rotation.z = .2; sharkGroup.add(gl);
      }
    });
    sharkGroup.userData = { type: 'shark' };
    sharkGroup.scale.setScalar(.62);
  }
  group.add(sharkGroup);
  this.sharkGroup = sharkGroup;

  /* 诱饵 */
  const baitMesh = new THREE.Mesh(new THREE.SphereGeometry(.2, 8, 6), new THREE.MeshStandardMaterial({ color: 0xa02030, roughness: .6 }));
  baitMesh.visible = false; group.add(baitMesh);
  this.throwBait = function () {
    const aim = game.player.aimWater(26);
    const p = aim || game.player.eye().add(new THREE.Vector3(U.rand(-6, 6), 0, U.rand(-6, 6)));
    shark.baitPos = p.clone(); shark.baitT = 42;
    baitMesh.position.copy(p); baitMesh.visible = true;
    game.debris.spawnBlood(p, 8);
    game.ui.toast('🩸 诱饵入水，布鲁斯被吸引走了', 'good');
    RS.Audio.play('plop');
  };

  this.hitShark = function (dmg, point) {
    if (!shark.alive) return;
    const d = shark.pos.distanceTo(game.player.eye());
    if (d > 6.5) { RS.Audio.play('spear'); return; }
    shark.hp -= dmg;
    game.debris.spawnBlood(point || shark.pos, 8);
    RS.Audio.play('shark_hurt');
    game.ui.shakeCam(.35);
    if (shark.hp <= 0) {
      shark.alive = false; shark.respawnT = U.rand(150, 260);
      sharkGroup.visible = false;
      game.inv.add('shark_head', 1);
      game.inv.add('raw_shark', U.randi(2, 4));
      game.player.stats.sharkRepel++;
      game.bus.emit('shark_repel');
      game.ui.toast('🦈 布鲁斯被杀死了！它会在一段时间后回来。', 'good');
      RS.Audio.play('unlock');
      return;
    }
    if (shark.hp < SHARK_MAX * .45 && shark.state !== 'flee') {
      shark.state = 'flee'; shark.fleeT = U.rand(45, 75);
      shark.targetCell = null;
      game.player.stats.sharkRepel++;
      game.bus.emit('shark_repel');
      game.ui.toast('🦈 布鲁斯被赶走了！', 'good');
      RS.Audio.play('shark_growl');
    }
  };
  this.scareShark = function () {
    if (!shark.alive) return;
    if (shark.pos.distanceTo(game.player.eye()) < 5) {
      shark.state = 'flee'; shark.fleeT = U.rand(12, 20);
      game.ui.toast('🔥 火把把它逼退了一点', '');
    }
  };

  function pickBiteCell() {
    const cands = [];
    game.raft.forEachCell(c => {
      if (!c.base) return;
      let edge = false;
      for (let d = 0; d < 4; d++) {
        const n = game.raft.get(c.i + [0, 1, 0, -1][d], c.j + [-1, 0, 1, 0][d]);
        if (!n || !n.base) edge = true;
      }
      if (edge) cands.push(c);
    });
    if (!cands.length) return null;
    return U.choice(cands);
  }

  let growlT = 20;
  function updateShark(dt) {
    if (!shark.alive) {
      shark.respawnT -= dt;
      if (shark.respawnT <= 0) {
        shark.alive = true; shark.hp = SHARK_MAX; shark.state = 'patrol';
        sharkGroup.visible = true;
        const a = U.rand(0, U.TAU);
        shark.pos.set(game.raft.pos.x + Math.cos(a) * 40, -3, game.raft.pos.z + Math.sin(a) * 40);
        game.ui.toast('🦈 水面下又出现了熟悉的鳍影…', 'warn');
        RS.Audio.play('shark_growl');
      }
      return;
    }
    shark.t += dt;
    if (shark.baitT > 0) { shark.baitT -= dt; if (shark.baitT <= 0) { shark.baitPos = null; baitMesh.visible = false; } }
    if (shark.baitPos) {
      const wy = game.world.waterY(shark.baitPos.x, shark.baitPos.z);
      baitMesh.position.set(shark.baitPos.x, wy, shark.baitPos.z);
    }

    const player = game.player;
    const pe = player.eye();
    const distP = shark.pos.distanceTo(pe);
    let goal = null, speed = shark.speed;

    /* 状态机 */
    if (shark.state === 'flee') {
      shark.fleeT -= dt;
      const away = shark.pos.clone().sub(game.raft.pos).setY(0);
      if (away.lengthSq() < .01) away.set(1, 0, 0);
      goal = game.raft.pos.clone().addScaledVector(away.normalize(), 75);
      goal.y = -8;
      speed = shark.speed * 1.5;
      if (shark.fleeT <= 0) { shark.state = 'patrol'; shark.hp = Math.max(shark.hp, SHARK_MAX * .55); shark.biteCD = U.rand(20, 40); }
    } else if (shark.baitPos) {
      goal = shark.baitPos.clone().setY(-1.4);
      if (shark.pos.distanceTo(goal) < 3) { shark.pos.y = U.damp(shark.pos.y, -.8, 2, dt); }
    } else if (player.inWater && distP < 42 && !player.dead) {
      /* 玩家在水里 → 优先追人 */
      if (shark.state !== 'chase' && shark.state !== 'lunge') { shark.state = 'chase'; RS.Audio.play('shark_growl'); }
      if (shark.state === 'chase') {
        // 绕圈接近
        const toP = pe.clone().sub(shark.pos).setY(0);
        const dist = toP.length();
        if (dist > 9) goal = pe.clone().setY(Math.min(pe.y - .6, -.7));
        else {
          const side = new THREE.Vector3(-toP.z, 0, toP.x).normalize();
          goal = pe.clone().addScaledVector(side, 7).setY(pe.y - 1.2);
          if (shark.t > 2.2) { shark.state = 'lunge'; shark.lunge = 1.4; shark.t = 0; RS.Audio.play('shark_growl'); }
        }
        speed = shark.speed * 1.25;
      } else {
        shark.lunge -= dt;
        goal = pe.clone();
        speed = shark.speed * 3.0;
        if (distP < 2.6) {
          player.hurt(24, '鲨鱼撕咬');
          player.effects.bleed = 12;
          RS.Audio.play('shark_bite');
          game.ui.shakeCam(.9);
          game.debris.spawnBlood(pe, 12);
          shark.state = 'chase'; shark.t = -1.5;
        }
        if (shark.lunge <= 0) { shark.state = 'chase'; shark.t = 0; }
      }
    } else {
      /* 巡游 / 啃木筏 */
      if (shark.state === 'chase' || shark.state === 'lunge') shark.state = 'patrol';
      shark.biteCD -= dt;
      if (shark.state === 'patrol') {
        if (shark.biteCD <= 0 && game.raft.countFoundations() > 0) {
          shark.targetCell = pickBiteCell();
          if (shark.targetCell) { shark.state = 'attack_raft'; shark.t = 0; RS.Audio.play('shark_growl'); game.ui.toast('🦈 布鲁斯来啃木筏了！', 'warn'); }
        }
        const a = shark.t * .18;
        goal = game.raft.pos.clone().add(new THREE.Vector3(Math.cos(a) * 22, -2.6 + Math.sin(shark.t * .3) * 1.4, Math.sin(a) * 22));
      } else if (shark.state === 'attack_raft') {
        const c = shark.targetCell;
        if (!c || !c.base) { shark.state = 'patrol'; shark.biteCD = U.rand(20, 40); }
        else {
          const cw = game.raft.cellWorld(c);
          goal = cw.clone().setY(-1.1);
          speed = shark.speed * 1.5;
          if (shark.pos.distanceTo(goal) < 2.6) {
            if (shark.t > .9) {
              shark.t = 0;
              const broke = game.raft.damageCell(c, 34);
              RS.Audio.play('shark_bite');
              game.ui.shakeCam(.6);
              game.debris.spawnChips(cw, 0xa9773d);
              game.debris.spawnSplash(cw.clone().setY(game.world.waterY(cw.x, cw.z)), 1);
              if (broke || U.chance(.4)) { shark.state = 'patrol'; shark.biteCD = U.rand(30, 60); shark.targetCell = null; }
            }
          }
        }
      }
    }

    if (goal) {
      const to = goal.clone().sub(shark.pos);
      const wantDir = Math.atan2(to.x, to.z);
      let diff = ((wantDir - shark.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      shark.dir += U.clamp(diff, -1.8 * dt, 1.8 * dt);
      const fw = new THREE.Vector3(Math.sin(shark.dir), 0, Math.cos(shark.dir));
      shark.pos.addScaledVector(fw, speed * dt);
      shark.pos.y = U.damp(shark.pos.y, U.clamp(goal.y, -14, -.55), 1.6, dt);
    }
    const wy = game.world.waterY(shark.pos.x, shark.pos.z);
    shark.pos.y = Math.min(shark.pos.y, wy - .35);

    sharkGroup.position.copy(shark.pos);
    sharkGroup.rotation.y = shark.dir - Math.PI / 2;
    const swim = Math.sin(shark.t * (shark.state === 'lunge' ? 13 : 5.5));
    sharkTail.rotation.y = swim * .45;
    sharkGroup.rotation.z = swim * .06;
    sharkJaw.position.y = shark.state === 'lunge' || shark.state === 'attack_raft' ? Math.abs(swim) * .28 : 0;
    sharkJaw.rotation.z = shark.state === 'lunge' ? -Math.abs(swim) * .12 : 0;

    growlT -= dt;
    if (growlT <= 0) { growlT = U.rand(22, 55); if (shark.pos.distanceTo(pe) < 45) RS.Audio.play('shark_growl', .5); }

    game.ui.setSharkWarn(shark.alive && shark.pos.distanceTo(pe) < 22 ? (shark.state === 'lunge' ? 2 : 1) : 0);
  }

  /* ============================================================ 更新 */
  let fishSpawnT = 0;
  this.update = function (dt) {
    /* 鱼群维护 */
    fishSpawnT -= dt;
    if (fishSpawnT <= 0) {
      fishSpawnT = 1.2;
      const want = 22;
      if (fishes.length < want) for (let k = 0; k < 3 && fishes.length < want; k++) spawnFish();
    }
    const rp = game.raft.pos;
    for (let i = fishes.length - 1; i >= 0; i--) {
      const f = fishes[i];
      f.wander += dt;
      // 躲鲨鱼与玩家
      let flee = null;
      if (shark.alive && f.pos.distanceTo(shark.pos) < 8) flee = shark.pos;
      else if (f.pos.distanceTo(game.player.eye()) < 3.5 && game.player.underwater) flee = game.player.eye();
      if (flee) {
        const away = f.pos.clone().sub(flee).setY(0);
        f.dir = Math.atan2(away.x, away.z);
        f.flee = .9;
      } else {
        f.dir += Math.sin(f.wander * .7) * dt * 1.1;
        if (f.pos.distanceTo(rp) > 46) {
          const to = rp.clone().sub(f.pos);
          f.dir = Math.atan2(to.x, to.z);
        }
        if (f.flee > 0) f.flee -= dt;
      }
      const sp = f.speed * (f.flee > 0 ? 2.6 : 1);
      f.pos.x += Math.sin(f.dir) * sp * dt;
      f.pos.z += Math.cos(f.dir) * sp * dt;
      const wyf = game.world.waterY(f.pos.x, f.pos.z);
      f.depth += Math.sin(f.wander * .5) * dt * .5;
      f.depth = U.clamp(f.depth, -6, -.75);
      f.pos.y = U.damp(f.pos.y, Math.min(f.depth, wyf - .6), 2, dt);
      f.mesh.position.copy(f.pos);
      f.mesh.rotation.y = f.dir - Math.PI / 2;
      f.tail.rotation.y = Math.sin(game.time * (8 + f.speed * 3) + f.wander) * .55;
      if (f.pos.distanceTo(rp) > 70) removeFish(f);
    }

    updateRod(dt);
    updateShark(dt);
  };

  this.serialize = function () {
    return { hp: shark.hp, alive: shark.alive, respawnT: shark.respawnT, pos: shark.pos.toArray() };
  };
  this.deserialize = function (s) {
    shark.hp = s.hp; shark.alive = s.alive; shark.respawnT = s.respawnT || 0;
    shark.pos.fromArray(s.pos); sharkGroup.visible = shark.alive;
  };
};
