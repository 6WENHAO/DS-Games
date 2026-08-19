/* ==========================================================================
   RAFT SURVIVAL · debris.js
   海面漂流物 / 打捞钩投掷与收线 / 收集网 / 掉落物 / 水花气泡粒子
   ========================================================================== */
RS.Debris = function (game) {
  const U = RS.U, T = RS.Tex, DB = RS.DB;
  const self = this;
  const group = new THREE.Group();
  game.scene.add(group);
  this.group = group;

  const debris = [];
  const pickups = [];
  const particles = [];
  this.debris = debris;
  this.pickups = pickups;

  const M = {
    plank: new THREE.MeshStandardMaterial({ map: T.plank(1, 1), roughness: .85 }),
    plankD: new THREE.MeshStandardMaterial({ map: T.plankDark(1, 1), roughness: .9 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x4f9d3a, roughness: .9, side: THREE.DoubleSide }),
    barrel: new THREE.MeshStandardMaterial({ map: T.barrel(1, 1), roughness: .5 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0xdfe9ee, roughness: .35, transparent: true, opacity: .85 }),
    scrap: new THREE.MeshStandardMaterial({ map: T.metal(1, 1), roughness: .5, metalness: .8 }),
    rope: new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 1 }),
    seaweed: new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: .9, side: THREE.DoubleSide })
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  /* --------------------------------------------------------- 漂流物模型 */
  function buildDebrisMesh(kind) {
    const g = new THREE.Group();
    if (kind === 'planks') {
      for (let k = 0; k < U.randi(3, 5); k++) {
        const m = new THREE.Mesh(box(U.rand(1.1, 1.7), .12, U.rand(.22, .3)), k % 2 ? M.plankD : M.plank);
        m.position.set(U.rand(-.2, .2), k * .1, U.rand(-.3, .3));
        m.rotation.y = U.rand(-.5, .5); m.castShadow = true; g.add(m);
      }
      g.add(new THREE.Mesh(box(.06, .06, .8), M.rope));
    } else if (kind === 'leaves') {
      for (let k = 0; k < 4; k++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, .5), M.leaf);
        m.position.set(U.rand(-.3, .3), .04 + k * .03, U.rand(-.3, .3));
        m.rotation.set(-Math.PI / 2 + U.rand(-.2, .2), U.rand(0, 3), 0);
        g.add(m);
      }
    } else if (kind === 'barrel') {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, 1.0, 14), M.barrel);
      b.rotation.z = Math.PI / 2; b.castShadow = true; g.add(b);
      g.add(new THREE.Mesh(new THREE.TorusGeometry(.35, .03, 6, 14), M.scrap).rotateY(Math.PI / 2));
    } else if (kind === 'plastic') {
      for (let k = 0; k < 5; k++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(U.rand(.14, .26), 7, 5), M.plastic);
        m.position.set(U.rand(-.4, .4), U.rand(0, .12), U.rand(-.4, .4));
        m.scale.y = .6; g.add(m);
      }
    } else if (kind === 'crate') {
      const b = new THREE.Mesh(box(.9, .7, .9), M.plank); b.castShadow = true; g.add(b);
      [[0, .36, 0], [0, -.36, 0]].forEach(p => g.add(new THREE.Mesh(box(.95, .06, .95), M.plankD, ).translateY(p[1])));
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        g.add(new THREE.Mesh(box(.08, .74, .08), M.plankD).translateX(Math.cos(a) * .44).translateZ(Math.sin(a) * .44));
      }
    } else if (kind === 'scrap') {
      for (let k = 0; k < 5; k++) {
        const m = new THREE.Mesh(box(U.rand(.2, .7), U.rand(.05, .12), U.rand(.2, .5)), M.scrap);
        m.position.set(U.rand(-.3, .3), k * .07, U.rand(-.3, .3));
        m.rotation.set(U.rand(-.3, .3), U.rand(0, 3), U.rand(-.3, .3));
        m.castShadow = true; g.add(m);
      }
    }
    return g;
  }

  /* ---------------------------------------------------------- 生成漂流物 */
  let spawnT = 2;
  const MAXD = 26;
  function pickType() {
    let tot = 0; DB.DEBRIS.forEach(d => tot += d.w);
    let r = Math.random() * tot;
    for (const d of DB.DEBRIS) { r -= d.w; if (r <= 0) return d; }
    return DB.DEBRIS[0];
  }
  function currentVec() {
    const w = game.world.windVec();
    return new THREE.Vector3(-w.x, 0, -w.z).multiplyScalar(.55 + game.world.windSpeed * .35);
  }
  function spawnDebris() {
    if (debris.length >= MAXD) return;
    const def = pickType();
    const cur = currentVec();
    const up = cur.clone().negate().normalize();
    const side = new THREE.Vector3(-up.z, 0, up.x);
    const base = game.raft.pos.clone()
      .addScaledVector(up, U.rand(45, 85))
      .addScaledVector(side, U.rand(-32, 32));
    const m = buildDebrisMesh(def.mesh);
    m.position.copy(base);
    m.userData = { type: 'debris' };
    group.add(m);
    const d = {
      def, mesh: m, pos: base, vel: cur.clone().multiplyScalar(U.rand(.85, 1.15)),
      rot: U.rand(0, 6.3), spin: U.rand(-.3, .3), pulled: false, life: 0, netted: false
    };
    m.userData.d = d;
    debris.push(d);
  }

  function rollLoot(def) {
    const out = {};
    for (const k in def.loot) {
      const r = def.loot[k];
      const n = U.randi(r[0], r[1]);
      if (n > 0) out[k] = n;
    }
    if (Object.keys(out).length === 0) {
      const k = Object.keys(def.loot)[0];
      out[k] = 1;
    }
    return out;
  }
  function giveLoot(def) {
    const loot = rollLoot(def);
    for (const k in loot) game.inv.add(k, loot[k]);
    RS.Audio.play('pickup');
  }

  /* ------------------------------------------------------------ 打捞钩 */
  const hookMesh = new THREE.Group();
  {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .28, 6), M.scrap);
    hookMesh.add(shaft);
    const c = new THREE.Mesh(new THREE.TorusGeometry(.12, .025, 6, 12, Math.PI * 1.4), M.scrap);
    c.position.y = -.18; c.rotation.set(Math.PI / 2, 0, .5);
    hookMesh.add(c);
    hookMesh.visible = false;
    hookMesh.castShadow = true;
  }
  group.add(hookMesh);
  const ropeGeo = new THREE.BufferGeometry();
  ropeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 12), 3));
  const rope = new THREE.Line(ropeGeo, new THREE.LineBasicMaterial({ color: 0xe8d7a8 }));
  rope.frustumCulled = false; rope.visible = false;
  group.add(rope);

  const hook = { active: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), state: 'idle', target: null, t: 0 };
  this.hook = hook;

  this.throwHook = function (power) {
    if (hook.active) return;
    const cam = game.camera;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.getWorldQuaternion(new THREE.Quaternion()));
    hook.active = true; hook.state = 'fly'; hook.t = 0; hook.target = null;
    hook.pos.copy(game.player.eye()).addScaledVector(dir, .5);
    hook.vel.copy(dir).multiplyScalar(16 + power * 22).add(new THREE.Vector3(0, 3.5 * power, 0));
    hookMesh.visible = true; rope.visible = true;
    RS.Audio.play('hook_throw');
  };

  function updateHook(dt) {
    if (!hook.active) { rope.visible = false; hookMesh.visible = false; return; }
    hook.t += dt;
    if (hook.state === 'fly') {
      hook.vel.y -= 16 * dt;
      hook.pos.addScaledVector(hook.vel, dt);
      // 命中漂流物？
      for (const d of debris) {
        if (d.pulled || d.netted) continue;
        if (hook.pos.distanceTo(d.pos) < 1.5) {
          hook.state = 'reel'; hook.target = d; d.pulled = true;
          RS.Audio.play('hook_hit');
          break;
        }
      }
      const wy = game.world.waterY(hook.pos.x, hook.pos.z);
      if (hook.pos.y < wy - .3) {
        hook.state = 'reel';
        spawnSplash(new THREE.Vector3(hook.pos.x, wy, hook.pos.z), .7);
        RS.Audio.play('plop');
      }
      if (hook.t > 4) hook.state = 'reel';
    } else if (hook.state === 'reel') {
      const to = game.player.eye();
      const dir = to.clone().sub(hook.pos);
      const dist = dir.length();
      dir.normalize();
      const sp = 16;
      hook.pos.addScaledVector(dir, Math.min(dist, sp * dt));
      if (hook.target) {
        const d = hook.target;
        d.pos.lerp(hook.pos, 1 - Math.exp(-9 * dt));
        d.spin += dt * 2;
      }
      if (dist < 1.4) {
        if (hook.target) { giveLoot(hook.target.def); removeDebris(hook.target); }
        hook.active = false; hook.state = 'idle'; hook.target = null;
        hookMesh.visible = false; rope.visible = false;
        return;
      }
    }
    hookMesh.position.copy(hook.pos);
    hookMesh.lookAt(game.player.eye());
    hookMesh.rotateX(Math.PI / 2);
    // 绳索抛物线
    const a = game.camera.localToWorld(new THREE.Vector3(.3, -.28, -.5));
    const p = ropeGeo.attributes.position;
    const sag = Math.min(1.4, hook.pos.distanceTo(a) * .06);
    for (let k = 0; k < 12; k++) {
      const t = k / 11;
      const x = U.lerp(a.x, hook.pos.x, t), z = U.lerp(a.z, hook.pos.z, t);
      const y = U.lerp(a.y, hook.pos.y, t) - Math.sin(t * Math.PI) * sag;
      p.setXYZ(k, x, y, z);
    }
    p.needsUpdate = true;
  }

  function removeDebris(d) {
    const i = debris.indexOf(d);
    if (i >= 0) debris.splice(i, 1);
    group.remove(d.mesh);
    d.mesh.traverse(n => { if (n.geometry) n.geometry.dispose(); });
  }
  this.removeDebris = removeDebris;

  /* 手动抓取（贴近时按 E） */
  this.grabDebris = function (d) {
    if (!d) return;
    const dist = d.pos.distanceTo(game.player.eye());
    if (dist > 4) { game.ui.toast('太远了，用打捞钩', 'bad'); return; }
    giveLoot(d.def); removeDebris(d);
  };

  /* -------------------------------------------------------------- 收集网 */
  function netTick(dt) {
    game.raft.stations.forEach(o => {
      if (o.station !== 'net') return;
      const wp = o.mesh.getWorldPosition(new THREE.Vector3());
      for (let i = debris.length - 1; i >= 0; i--) {
        const d = debris[i];
        if (d.pulled) continue;
        if (d.pos.distanceTo(wp) < 3.2) {
          const loot = rollLoot(d.def);
          for (const k in loot) o.data.items[k] = (o.data.items[k] || 0) + loot[k];
          o.data.count += 1;
          removeDebris(d);
          RS.Audio.play('ui_hover', .6);
        }
      }
    });
  }
  this.collectNet = function (o) {
    let n = 0;
    for (const k in o.data.items) {
      const got = game.inv.add(k, o.data.items[k]);
      if (got < o.data.items[k]) { o.data.items[k] -= got; game.ui.toast('背包满了', 'bad'); }
      else { n += got; delete o.data.items[k]; }
    }
    o.data.count = 0;
    if (n > 0) { RS.Audio.play('pickup'); game.ui.toast('🕸 从收集网取出 ' + n + ' 件物资', 'good'); }
    else game.ui.toast('收集网是空的', '');
  };

  /* -------------------------------------------------------------- 掉落物 */
  function pickupMesh(id) {
    const g = new THREE.Group();
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.font = '48px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(DB.ico(id), 32, 36);
    const tx = new THREE.CanvasTexture(c);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true }));
    sp.scale.setScalar(.5);
    g.add(sp);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glow(), color: 0xffe6a0, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(1.1); g.add(halo);
    return g;
  }
  this.dropItem = function (id, n, pos) {
    const m = pickupMesh(id);
    m.position.copy(pos);
    m.userData = { type: 'pickup' };
    group.add(m);
    const it = { id, n, mesh: m, pos: m.position, vel: new THREE.Vector3(U.rand(-1, 1), 1.5, U.rand(-1, 1)), life: 300, float: false };
    m.userData.item = it;
    pickups.push(it);
    return it;
  };
  this.pickup = function (it) {
    if (!it) return;
    const got = game.inv.add(it.id, it.n);
    if (got >= it.n) removePickup(it);
    else { it.n -= got; game.ui.toast('背包满了', 'bad'); }
  };
  function removePickup(it) {
    const i = pickups.indexOf(it); if (i >= 0) pickups.splice(i, 1);
    group.remove(it.mesh);
    it.mesh.traverse(n => { if (n.material && n.material.map) n.material.map.dispose(); });
  }
  this.spawnWreck = function (pos) {
    for (let k = 0; k < U.randi(2, 4); k++) self.dropItem('plank', 1, pos.clone().add(new THREE.Vector3(U.rand(-1, 1), .5, U.rand(-1, 1))));
    if (U.chance(.5)) self.dropItem('rope', 1, pos.clone());
  };

  /* -------------------------------------------------------------- 粒子 */
  const splashMat = new THREE.SpriteMaterial({ map: T.foam(), transparent: true, depthWrite: false, opacity: .9 });
  const bubbleMat = new THREE.SpriteMaterial({ map: T.bubble(), transparent: true, depthWrite: false, opacity: .8 });
  const bloodMat = new THREE.SpriteMaterial({ map: T.blood(), transparent: true, depthWrite: false, opacity: .8 });

  function spawnParticle(mat, pos, scale, vel, life, grow) {
    const s = new THREE.Sprite(mat.clone());
    s.position.copy(pos); s.scale.setScalar(scale);
    group.add(s);
    particles.push({ s, vel: vel || new THREE.Vector3(), life, max: life, grow: grow || 0 });
  }
  function spawnSplash(pos, scale) {
    for (let k = 0; k < 6; k++) {
      spawnParticle(splashMat, pos.clone().add(new THREE.Vector3(U.rand(-.4, .4), U.rand(0, .3), U.rand(-.4, .4))),
        scale * U.rand(.4, .9), new THREE.Vector3(U.rand(-1.4, 1.4), U.rand(1.2, 3.4), U.rand(-1.4, 1.4)), U.rand(.5, .9), 1.6);
    }
  }
  this.spawnSplash = spawnSplash;
  this.spawnBubble = function (pos) {
    spawnParticle(bubbleMat, pos.clone().add(new THREE.Vector3(U.rand(-.2, .2), 0, U.rand(-.2, .2))), U.rand(.06, .14),
      new THREE.Vector3(U.rand(-.2, .2), U.rand(.8, 1.6), U.rand(-.2, .2)), U.rand(1.4, 2.4), .3);
  };
  this.spawnBlood = function (pos, n) {
    for (let k = 0; k < (n || 6); k++)
      spawnParticle(bloodMat, pos.clone().add(new THREE.Vector3(U.rand(-.3, .3), U.rand(-.3, .3), U.rand(-.3, .3))),
        U.rand(.3, .7), new THREE.Vector3(U.rand(-.6, .6), U.rand(-.2, .5), U.rand(-.6, .6)), U.rand(.8, 1.6), 1.2);
  };
  this.spawnChips = function (pos, color) {
    const mat = new THREE.MeshBasicMaterial({ color: color || 0xb98a4a });
    for (let k = 0; k < 8; k++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(.07, .07, .07), mat);
      m.position.copy(pos);
      group.add(m);
      particles.push({ s: m, vel: new THREE.Vector3(U.rand(-2, 2), U.rand(1.5, 4), U.rand(-2, 2)), life: .9, max: .9, grav: 9 });
    }
  };

  /* -------------------------------------------------------------- 更新 */
  this.update = function (dt) {
    const W = game.world;
    const cur = currentVec();

    /* 生成 */
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = U.rand(1.4, 3.2) / (1 + W.windSpeed * .18);
      spawnDebris();
    }

    /* 漂流物运动 */
    const rp = game.raft.pos;
    for (let i = debris.length - 1; i >= 0; i--) {
      const d = debris[i];
      d.life += dt;
      if (!d.pulled) {
        d.vel.lerp(cur, 1 - Math.exp(-.7 * dt));
        d.pos.addScaledVector(d.vel, dt);
      }
      const wy = W.waterY(d.pos.x, d.pos.z);
      d.mesh.position.set(d.pos.x, wy + .06, d.pos.z);
      d.rot += d.spin * dt;
      d.mesh.rotation.y = d.rot;
      const n = W.waterNormal(d.pos.x, d.pos.z);
      d.mesh.rotation.x = Math.atan2(-n.z, n.y) * .8;
      d.mesh.rotation.z = Math.atan2(n.x, n.y) * .8;
      if (!d.pulled && d.pos.distanceTo(rp) > 130) removeDebris(d);
      else if (d.life > 400) removeDebris(d);
    }

    netTick(dt);
    updateHook(dt);

    /* 掉落物 */
    for (let i = pickups.length - 1; i >= 0; i--) {
      const it = pickups[i];
      it.life -= dt;
      const wy = W.waterY(it.pos.x, it.pos.z);
      if (!it.float) {
        it.vel.y -= 12 * dt;
        it.pos.addScaledVector(it.vel, dt);
        const surf = game.raft.surfaceAt(it.pos);
        if (surf && it.pos.y < surf.y + .3) { it.pos.y = surf.y + .3; it.float = 'raft'; it.vel.set(0, 0, 0); }
        else if (it.pos.y < wy + .2) { it.pos.y = wy + .2; it.float = 'water'; it.vel.set(0, 0, 0); }
        const iy = game.islands ? game.islands.heightAt(it.pos.x, it.pos.z) : null;
        if (iy != null && it.pos.y < iy + .3) { it.pos.y = iy + .3; it.float = 'land'; it.vel.set(0, 0, 0); }
      } else if (it.float === 'water') {
        it.pos.y = wy + .22;
        it.pos.addScaledVector(cur, dt * .4);
      } else if (it.float === 'raft') {
        const surf = game.raft.surfaceAt(it.pos);
        if (surf) it.pos.y = surf.y + .3; else it.float = false;
      }
      it.mesh.position.copy(it.pos);
      it.mesh.position.y += Math.sin(game.time * 2.4 + i) * .06;
      it.mesh.children[1].material.opacity = .35 + Math.sin(game.time * 3 + i) * .15;
      // 自动拾取
      if (it.pos.distanceTo(game.player.eye()) < 1.7) self.pickup(it);
      else if (it.life <= 0) removePickup(it);
    }

    /* 粒子 */
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.grav) p.vel.y -= p.grav * dt;
      p.s.position.addScaledVector(p.vel, dt);
      const k = U.clamp(p.life / p.max, 0, 1);
      if (p.s.material.opacity !== undefined && p.s.isSprite) p.s.material.opacity = k * .9;
      if (p.grow) p.s.scale.setScalar(p.s.scale.x + p.grow * dt);
      if (p.life <= 0) {
        group.remove(p.s);
        if (p.s.geometry) p.s.geometry.dispose();
        particles.splice(i, 1);
      }
    }
  };

  this.serialize = function () {
    return { pickups: pickups.map(p => ({ id: p.id, n: p.n, pos: p.pos.toArray() })) };
  };
  this.deserialize = function (s) {
    pickups.slice().forEach(removePickup);
    (s.pickups || []).forEach(p => {
      const it = self.dropItem(p.id, p.n, new THREE.Vector3().fromArray(p.pos));
      it.vel.set(0, 0, 0);
    });
  };
};
