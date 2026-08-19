// Procedural blocky fauna + No Man's Sky sentinels.
import * as THREE from 'three';
import { makeRng, strSeed } from '../core/rng.js';

const MAX_FAUNA = 14;

function boxMesh(w, h, d, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color }));
}

export class CreatureManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.group = new THREE.Group();
    game.sceneSurface.add(this.group);
    this.species = this._makeSpecies(game.planet);
    this.sentinelTimer = 0;
    this.sentinelCount = 0;
    this._tmp = new THREE.Vector3();
    this._callTimer = 4;
  }

  _makeSpecies(planet) {
    const rng = makeRng(planet.seed + 4242);
    const n = planet.faunaCount || 3;
    const list = [];
    const P = planet.palette;
    const genusNames = ['Procavya', 'Felidae', 'Anastomus', 'Rhopalocera', 'Bos', 'Tetraceris', 'Ictaloris', 'Prionalis', 'Mogara', 'Theroma'];
    for (let i = 0; i < n; i++) {
      const bodyHue = rng.range(0, 360);
      const hostile = rng.chance(0.22);
      list.push({
        id: 'sp' + i,
        name: this._speciesName(rng),
        genus: rng.pick(genusNames),
        hostile,
        legs: rng.pick([2, 4, 4, 6]),
        scale: rng.range(0.55, hostile ? 1.5 : 1.15),
        neck: rng.range(0.2, 1.1),
        tail: rng.chance(0.6),
        horn: rng.chance(0.35),
        colorA: new THREE.Color().setHSL(bodyHue / 360, rng.range(0.35, 0.85), rng.range(0.35, 0.62)),
        colorB: new THREE.Color().setHSL(((bodyHue + rng.range(20, 120)) % 360) / 360, rng.range(0.4, 0.9), rng.range(0.4, 0.7)),
        eye: new THREE.Color(P.glow[0] / 255, P.glow[1] / 255, P.glow[2] / 255),
        speed: rng.range(1.6, hostile ? 5.4 : 3.6),
        timid: rng.chance(0.55),
        callSeed: rng.next(),
      });
    }
    return list;
  }

  _speciesName(rng) {
    const A = ['Kra', 'Vor', 'Tel', 'Mun', 'Zep', 'Hol', 'Bur', 'Ish', 'Ny', 'Ova', 'Gru', 'Sil', 'Aur'];
    const B = ['bak', 'tium', 'ossa', 'ex', 'orn', 'ada', 'ish', 'urn', 'aki', 'ela'];
    const C = ['', ' Minor', ' Prime', ' F9', ' XV'];
    return rng.pick(A) + rng.pick(B) + rng.pick(C);
  }

  _buildFauna(sp, rng) {
    const g = new THREE.Group();
    const s = sp.scale;
    const bodyW = 0.7 * s, bodyH = 0.55 * s, bodyD = 1.1 * s;
    const body = boxMesh(bodyW, bodyH, bodyD, sp.colorA);
    body.position.y = 0.55 * s + 0.2;
    g.add(body);
    // back plates / stripes
    const plate = boxMesh(bodyW * 0.5, bodyH * 0.35, bodyD * 0.8, sp.colorB);
    plate.position.set(0, 0.55 * s + 0.2 + bodyH * 0.5, 0);
    g.add(plate);
    // neck + head
    const neck = boxMesh(0.28 * s, 0.28 * s, 0.3 * s + sp.neck * 0.4 * s, sp.colorA);
    neck.position.set(0, 0.62 * s + 0.2 + sp.neck * 0.22 * s, -bodyD * 0.45 - 0.1 * s);
    g.add(neck);
    const head = boxMesh(0.42 * s, 0.38 * s, 0.44 * s, sp.colorB);
    head.position.set(0, 0.72 * s + 0.2 + sp.neck * 0.42 * s, -bodyD * 0.5 - 0.28 * s);
    g.add(head);
    const eyeL = boxMesh(0.09 * s, 0.09 * s, 0.05 * s, sp.eye);
    eyeL.material = new THREE.MeshBasicMaterial({ color: sp.eye, toneMapped: false });
    eyeL.material.color.multiplyScalar(2.2);
    eyeL.position.set(-0.13 * s, head.position.y + 0.06 * s, head.position.z - 0.22 * s);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.13 * s;
    g.add(eyeL); g.add(eyeR);
    if (sp.horn) {
      const horn = boxMesh(0.07 * s, 0.34 * s, 0.07 * s, sp.colorB);
      horn.position.set(0, head.position.y + 0.3 * s, head.position.z);
      g.add(horn);
    }
    // legs
    const legs = [];
    const legCount = sp.legs;
    const legH = 0.5 * s;
    for (let i = 0; i < legCount; i++) {
      const row = Math.floor(i / 2);
      const side = i % 2 === 0 ? -1 : 1;
      const leg = boxMesh(0.16 * s, legH, 0.16 * s, sp.colorA);
      leg.geometry.translate(0, -legH / 2, 0);
      leg.position.set(side * bodyW * 0.42, 0.55 * s + 0.2 - bodyH * 0.4, bodyD * (0.32 - row * (0.64 / Math.max(1, legCount / 2 - 1 || 1))));
      g.add(leg);
      legs.push(leg);
    }
    if (sp.tail) {
      const tail = boxMesh(0.14 * s, 0.14 * s, 0.6 * s, sp.colorB);
      tail.geometry.translate(0, 0, 0.3 * s);
      tail.position.set(0, 0.6 * s + 0.2, bodyD * 0.5);
      g.add(tail);
      g.userData.tail = tail;
    }
    g.userData.legs = legs;
    g.userData.body = body;
    g.userData.head = head;
    return g;
  }

  _buildSentinel() {
    const g = new THREE.Group();
    const core = boxMesh(0.62, 0.62, 0.62, 0xd8dde4);
    g.add(core);
    const panel = boxMesh(0.7, 0.18, 0.7, 0x39424d);
    g.add(panel);
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.08), new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false }));
    eye.material.color.multiplyScalar(3);
    eye.position.set(0, 0, -0.34);
    g.add(eye);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.045, 4, 16), new THREE.MeshBasicMaterial({ color: 0x8e9aa8 }));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.03, 4, 16), new THREE.MeshBasicMaterial({ color: 0x5b6673 }));
    ring2.rotation.z = Math.PI / 3;
    g.add(ring2);
    for (let i = 0; i < 4; i++) {
      const fin = boxMesh(0.1, 0.34, 0.1, 0xb0b6bc);
      const a = (i / 4) * Math.PI * 2;
      fin.position.set(Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42);
      g.add(fin);
    }
    g.userData.eye = eye;
    g.userData.ring = ring;
    g.userData.ring2 = ring2;
    return g;
  }

  spawnFauna(pos, seed) {
    if (this.list.filter((c) => c.kind === 'fauna').length >= MAX_FAUNA) return null;
    if (!this.species.length) return null;
    const rng = makeRng(seed);
    const sp = this.species[Math.floor(rng.next() * this.species.length) % this.species.length];
    const obj = this._buildFauna(sp, rng);
    obj.position.set(pos.x, pos.y, pos.z);
    obj.rotation.y = rng.range(0, Math.PI * 2);
    this.group.add(obj);
    const c = {
      kind: 'fauna', object: obj, sp, speciesId: sp.id, speciesName: sp.name, genus: sp.genus,
      hostile: sp.hostile, hp: 24 * sp.scale, maxHp: 24 * sp.scale,
      vel: new THREE.Vector3(), state: 'wander', timer: rng.range(1, 4),
      target: new THREE.Vector3(pos.x, pos.y, pos.z), known: this.game.discoveries.some((d) => d.id === 'fauna:' + sp.id),
      revealedUntil: 0, walkPhase: rng.range(0, 6), scale: sp.scale, fed: false,
    };
    this.list.push(c);
    return c;
  }

  spawnSentinel(pos) {
    const obj = this._buildSentinel();
    obj.position.copy(pos);
    this.group.add(obj);
    const c = {
      kind: 'sentinel', object: obj, hp: 60, maxHp: 60, vel: new THREE.Vector3(),
      state: 'search', timer: 0, alert: 0, shootTimer: 1.5, known: true,
      speciesName: '哨兵无人机', genus: 'Sentinel', hostile: true, revealedUntil: 1e9,
      bob: Math.random() * 6,
    };
    this.list.push(c);
    this.sentinelCount++;
    this.game.audio.sentinelAlert();
    this.game.ui.toast({ kind: 'warn', name: '哨兵已被激活!', amt: '停止破坏或战斗', dur: 4200 });
    this.game.music.setMode('danger');
    return c;
  }

  onDisturbance(hit, wanted) {
    if (wanted > 8 && this.sentinelCount < 2 && Math.random() < 0.5) {
      const p = this.game.player.pos;
      const a = Math.random() * Math.PI * 2;
      const d = 18 + Math.random() * 10;
      const pos = new THREE.Vector3(p.x + Math.cos(a) * d, this.game.world.surfaceY(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d) + 6, p.z + Math.sin(a) * d);
      this.spawnSentinel(pos);
      this.game.player.wanted = 0;
    }
  }

  update(dt) {
    const g = this.game;
    const world = g.world;
    const player = g.player;

    // spawn from world queue
    if (world && world.spawnQueue.length) {
      const spawns = world.spawnQueue.splice(0, 3);
      for (const s of spawns) {
        if (s.kind !== 'fauna') continue;
        const d = Math.hypot(s.x - player.pos.x, s.z - player.pos.z);
        if (d > 110 || d < 12) continue;
        this.spawnFauna({ x: s.x, y: world.surfaceY(s.x, s.z) + 1.2, z: s.z }, s.seed);
      }
      if (world.spawnQueue.length > 60) world.spawnQueue.length = 0;
    }

    // ambient calls
    this._callTimer -= dt;
    if (this._callTimer <= 0) {
      this._callTimer = 6 + Math.random() * 10;
      const near = this.list.filter((c) => c.kind === 'fauna' && c.object.position.distanceTo(player.pos) < 45);
      if (near.length) {
        const c = near[Math.floor(Math.random() * near.length)];
        g.audio.creatureCall(c.sp.callSeed, c.hostile);
      }
    }

    // beam damage on entities
    if (player.mining.firing) this._beamDamage(dt);

    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      const dist = c.object.position.distanceTo(player.pos);
      if (dist > 170 || (c.kind === 'sentinel' && dist > 120)) {
        this.group.remove(c.object);
        this._disposeObj(c.object);
        this.list.splice(i, 1);
        if (c.kind === 'sentinel') this.sentinelCount = Math.max(0, this.sentinelCount - 1);
        continue;
      }
      if (c.kind === 'fauna') this._updateFauna(c, dt, dist);
      else this._updateSentinel(c, dt, dist);
    }

    if (this.sentinelCount === 0 && g.music && g.mode === 'surface' && this._wasDanger) {
      this._wasDanger = false;
      g.music.setMode('surface');
    }
    if (this.sentinelCount > 0) this._wasDanger = true;
  }

  _updateFauna(c, dt, distToPlayer) {
    const g = this.game;
    const world = g.world;
    const obj = c.object;
    c.timer -= dt;

    // flee / approach behaviour
    if (c.hostile && distToPlayer < 22) c.state = 'chase';
    else if (c.sp.timid && distToPlayer < 9) c.state = 'flee';
    else if (c.state === 'chase' && distToPlayer > 34) c.state = 'wander';
    else if (c.state === 'flee' && distToPlayer > 22) c.state = 'wander';

    if (c.timer <= 0) {
      c.timer = 2 + Math.random() * 4;
      if (c.state === 'wander') {
        const a = Math.random() * Math.PI * 2;
        const d = 4 + Math.random() * 14;
        c.target.set(obj.position.x + Math.cos(a) * d, 0, obj.position.z + Math.sin(a) * d);
        if (Math.random() < 0.35) c.state = 'graze';
      } else if (c.state === 'graze') {
        c.state = 'wander';
      }
    }

    let speed = 0;
    const dir = this._tmp;
    if (c.state === 'wander') {
      dir.set(c.target.x - obj.position.x, 0, c.target.z - obj.position.z);
      speed = c.sp.speed * 0.42;
    } else if (c.state === 'flee') {
      dir.set(obj.position.x - g.player.pos.x, 0, obj.position.z - g.player.pos.z);
      speed = c.sp.speed;
    } else if (c.state === 'chase') {
      dir.set(g.player.pos.x - obj.position.x, 0, g.player.pos.z - obj.position.z);
      speed = c.sp.speed * 0.92;
      if (distToPlayer < 2.6) {
        c.attackTimer = (c.attackTimer || 0) - dt;
        if (c.attackTimer <= 0) {
          c.attackTimer = 1.4;
          g.player.damage(6 + 6 * c.scale, 'creature');
          g.audio.creatureCall(c.sp.callSeed, true);
        }
        speed = 0;
      }
    } else {
      speed = 0;
    }
    if (dir.lengthSq() > 0.001 && speed > 0) {
      dir.normalize();
      obj.position.x += dir.x * speed * dt;
      obj.position.z += dir.z * speed * dt;
      const targetYaw = Math.atan2(dir.x, dir.z);
      let d = targetYaw - obj.rotation.y;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      obj.rotation.y += d * Math.min(1, dt * 5);
      c.walkPhase += dt * speed * 3.2;
    }
    // ground follow
    const gy = world.surfaceY(obj.position.x, obj.position.z) + 1;
    obj.position.y += (gy - obj.position.y) * Math.min(1, dt * 8);

    // animate legs / body
    const legs = obj.userData.legs || [];
    const moving = speed > 0.1;
    legs.forEach((leg, i) => {
      const ph = c.walkPhase + i * Math.PI * 0.5;
      leg.rotation.x = moving ? Math.sin(ph) * 0.7 : Math.sin(c.walkPhase * 0.4 + i) * 0.05;
    });
    if (obj.userData.body) obj.userData.body.position.y = 0.55 * c.scale + 0.2 + (moving ? Math.abs(Math.sin(c.walkPhase * 2)) * 0.04 : Math.sin(this.game.time * 1.4 + c.walkPhase) * 0.015);
    if (obj.userData.head) obj.userData.head.rotation.x = c.state === 'graze' ? 0.7 : Math.sin(this.game.time * 0.8 + c.walkPhase) * 0.08;
    if (obj.userData.tail) obj.userData.tail.rotation.y = Math.sin(this.game.time * 2.2 + c.walkPhase) * 0.3;
  }

  _updateSentinel(c, dt, distToPlayer) {
    const g = this.game;
    const obj = c.object;
    c.bob += dt;
    obj.userData.ring.rotation.z += dt * 2.4;
    obj.userData.ring2.rotation.y += dt * 1.7;
    const eyeMat = obj.userData.eye.material;
    eyeMat.color.setRGB(3 + Math.sin(this.game.time * 8) * 0.6, 0.3, 0.25);

    const target = g.player.pos.clone().add(new THREE.Vector3(0, 3.2, 0));
    const dir = target.clone().sub(obj.position);
    const d = dir.length();
    dir.normalize();
    const speed = c.state === 'attack' ? 7.5 : 5;
    if (d > 8) {
      obj.position.addScaledVector(dir, speed * dt);
    } else if (d < 6) {
      obj.position.addScaledVector(dir, -speed * 0.5 * dt);
    }
    obj.position.y += Math.sin(c.bob * 2.2) * 0.01;
    obj.lookAt(g.player.eye);

    c.shootTimer -= dt;
    if (distToPlayer < 30 && c.shootTimer <= 0) {
      c.shootTimer = 1.1 + Math.random() * 0.6;
      c.state = 'attack';
      g.audio.laserShot(0);
      g.player.damage(7, 'sentinel');
      // tracer
      const from = obj.position.clone();
      const to = g.player.eye.clone();
      const steps = 10;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const p = from.clone().lerp(to, t);
        g.particles.trail(p.x, p.y, p.z, '#ff4d4d', { life: 0.18, size: 0.09, spread: 0.05, glow: true, grav: 0 });
      }
    }
  }

  _beamDamage(dt) {
    const g = this.game;
    const eye = g.player.eye;
    const dir = g.player.lookDir();
    const c = this.raycast(eye, dir, 14);
    if (!c) return;
    const blockDist = g.player.aimHit ? g.player.aimHit.dist : 999;
    const cd = eye.distanceTo(c.object.position);
    if (cd > blockDist) return;
    c.hp -= dt * 26;
    g.particles.trail(c.object.position.x, c.object.position.y + 0.6, c.object.position.z, '#ff9a4a', { life: 0.3, size: 0.08, spread: 0.8, glow: true });
    if (c.hp <= 0) this._kill(c);
  }

  _kill(c) {
    const g = this.game;
    const pos = c.object.position;
    g.audio.explosion(c.kind === 'sentinel' ? 0.9 : 0.5);
    g.particles.burst(pos.x, pos.y + 0.6, pos.z, c.kind === 'sentinel' ? '#ff6a4a' : '#c04a4a', 26, { size: 0.13, life: 1.2, spread: 4 });
    if (c.kind === 'sentinel') {
      g.inventory.add('PURE_FERRITE', 12 + Math.floor(Math.random() * 20));
      g.addNanites(15);
      g.ui.toast({ kind: 'get', key: 'PURE_FERRITE', amt: '+残骸' });
      this.sentinelCount = Math.max(0, this.sentinelCount - 1);
    } else {
      g.inventory.add('CARBON', 20 + Math.floor(Math.random() * 30));
      g.ui.toast({ kind: 'get', key: 'CARBON', amt: '+采集' });
    }
    const i = this.list.indexOf(c);
    if (i >= 0) this.list.splice(i, 1);
    this.group.remove(c.object);
    this._disposeObj(c.object);
  }

  feed(c) {
    const g = this.game;
    if (c.kind !== 'fauna') { g.audio.uiError(); return; }
    if (c.fed) { g.ui.toast({ kind: 'info', name: '这只生物已经吃饱了', amt: '' }); return; }
    if (!g.inventory.has('CARBON', 10)) {
      g.ui.toast({ kind: 'warn', name: '需要 10 碳来喂食', amt: '' });
      g.audio.uiError();
      return;
    }
    g.inventory.remove('CARBON', 10);
    c.fed = true;
    c.sp.timid = false;
    c.hostile = false;
    c.state = 'graze';
    g.audio.confirm();
    g.audio.creatureCall(c.sp.callSeed, false);
    g.addNanites(8);
    g.ui.toast({ kind: 'quest', name: '生物已被驯服', amt: '+8 ✦' });
    g.particles.burst(c.object.position.x, c.object.position.y + 1, c.object.position.z, '#7fe8a0', 14, { size: 0.08, life: 0.9, grav: -0.2, glow: true });
  }

  raycast(origin, dir, maxDist) {
    let best = null, bestT = maxDist;
    const oc = new THREE.Vector3();
    for (const c of this.list) {
      const center = c.object.position.clone();
      center.y += 0.7 * (c.scale || 1);
      oc.copy(center).sub(origin);
      const t = oc.dot(dir);
      if (t < 0 || t > bestT) continue;
      const perp = oc.clone().addScaledVector(dir, -t).length();
      const radius = c.kind === 'sentinel' ? 0.9 : 0.75 * (c.scale || 1);
      if (perp < radius) { best = c; bestT = t; }
    }
    return best;
  }

  nearest(pos, radius) {
    let best = null, bd = radius;
    for (const c of this.list) {
      if (c.kind !== 'fauna') continue;
      const d = c.object.position.distanceTo(pos);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  revealAll(dur) {
    const until = this.game.time + dur;
    for (const c of this.list) c.revealedUntil = until;
  }
  revealedList() {
    return this.list.filter((c) => c.revealedUntil > this.game.time || c.kind === 'sentinel');
  }

  _disposeObj(obj) {
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  dispose() {
    for (const c of this.list) { this.group.remove(c.object); this._disposeObj(c.object); }
    this.list.length = 0;
    this.game.sceneSurface.remove(this.group);
  }
}
