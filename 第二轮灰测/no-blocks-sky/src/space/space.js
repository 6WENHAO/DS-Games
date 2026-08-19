// Space: voxel planets, star, space station, asteroid fields, pulse travel, docking.
import * as THREE from 'three';
import { Noise } from '../core/noise.js';
import { makeRng, strSeed } from '../core/rng.js';
import { Sky } from '../render/sky.js';
import { shared } from '../render/materials.js';
import { clamp, lerp } from '../core/noise.js';
import { generateSystem } from '../data/planets.js';

const PLANET_CUBE = 3.8;

function buildVoxelPlanet(planet) {
  const rng = makeRng(planet.seed);
  const noise = new Noise(planet.seed);
  const R = planet.radius;
  const S = PLANET_CUBE * (R > 70 ? 1.35 : 1);
  const P = planet.palette;
  const col = (arr, f = 1) => new THREE.Color(arr[0] / 255 * f, arr[1] / 255 * f, arr[2] / 255 * f);
  const cWater = col(P.water, 0.9), cGrass = col(P.grass), cSand = col(P.sand), cRock = col(P.rock), cSnow = new THREE.Color(0.92, 0.96, 1), cGlow = col(P.glow, 1.6);

  const positions = [];
  const colors = [];
  const n = Math.ceil(R / S) + 1;
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      for (let k = -n; k <= n; k++) {
        const x = i * S, y = j * S, z = k * S;
        const d = Math.hypot(x, y, z);
        if (d > R + S || d < R - S * 1.5) continue;
        const nx = x / d, ny = y / d, nz = z / d;
        // surface displacement
        const cont = noise.fbm3(nx * 2.2, ny * 2.2, nz * 2.2, 4);
        const detail = noise.noise3(nx * 8, ny * 8, nz * 8);
        const rad = R + cont * S * 1.6 + detail * S * 0.5;
        if (d > rad || d < rad - S * 1.4) continue;
        const lat = Math.abs(ny);
        let c;
        const sea = planet.terrain.water ? 0.02 : -1;
        if (cont < sea - 0.06) c = cWater;
        else if (cont < sea + 0.02) c = cSand;
        else if (lat > 0.86 && planet.biome !== 'volcanic') c = cSnow;
        else if (cont > 0.34) c = cRock;
        else c = cGrass;
        const shade = 0.86 + rng.next() * 0.28;
        positions.push(x, y, z);
        colors.push(c.r * shade, c.g * shade, c.b * shade);
      }
    }
  }
  // settlement lights
  const count = positions.length / 3;
  const geo = new THREE.BoxGeometry(S, S, S);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: false });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const colAttr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    m.makeTranslation(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    mesh.setMatrixAt(i, m);
    colAttr[i * 3] = colors[i * 3];
    colAttr[i * 3 + 1] = colors[i * 3 + 1];
    colAttr[i * 3 + 2] = colors[i * 3 + 2];
  }
  mesh.instanceColor = new THREE.InstancedBufferAttribute(colAttr, 3);
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = true;

  const group = new THREE.Group();
  group.add(mesh);

  // thin atmosphere shell
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.06, 28, 20),
    new THREE.MeshBasicMaterial({
      color: col(P.spaceTint), transparent: true, opacity: 0.16, side: THREE.BackSide, depthWrite: false,
    })
  );
  group.add(atmo);
  const atmo2 = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.13, 24, 16),
    new THREE.MeshBasicMaterial({ color: col(P.spaceTint), transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false })
  );
  group.add(atmo2);

  // ring of cubes
  if (planet.ringed) {
    const ringCount = 900;
    const rgeo = new THREE.BoxGeometry(S * 0.7, S * 0.35, S * 0.7);
    const rmat = new THREE.MeshLambertMaterial({ color: col(P.rock, 1.1) });
    const rmesh = new THREE.InstancedMesh(rgeo, rmat, ringCount);
    const rm = new THREE.Matrix4();
    for (let i = 0; i < ringCount; i++) {
      const a = rng.range(0, Math.PI * 2);
      const rr = R * rng.range(1.45, 2.25);
      rm.makeTranslation(Math.cos(a) * rr, rng.range(-S * 0.4, S * 0.4), Math.sin(a) * rr);
      rmesh.setMatrixAt(i, rm);
    }
    rmesh.rotation.x = planet.axialTilt + 0.35;
    group.add(rmesh);
  }
  group.userData.radius = R;
  return group;
}

function buildStation(name) {
  const g = new THREE.Group();
  const mk = (w, h, d, color, x, y, z, emissive = 0) => {
    const mat = new THREE.MeshLambertMaterial({ color });
    if (emissive) { mat.emissive = new THREE.Color(color); mat.emissiveIntensity = emissive; }
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  // core
  mk(26, 26, 26, 0xdfe4ea, 0, 0, 0);
  mk(30, 8, 30, 0x9aa4af, 0, 0, 0);
  mk(10, 34, 10, 0xb6bdc6, 0, 0, 0);
  // landing bay (glowing orange mouth)
  mk(14, 10, 3, 0x1a1f26, 0, 0, -13.5);
  const bay = mk(12.5, 8.5, 1.2, 0xff9a2e, 0, 0, -14.6, 1.6);
  bay.material = new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false });
  bay.material.color.multiplyScalar(2.4);
  // arms
  for (const s of [-1, 1]) {
    mk(6, 6, 30, 0xc8cfd8, s * 17, 0, 0);
    mk(4, 4, 8, 0x8e9aa8, s * 17, 0, -18);
    mk(1.6, 1.6, 1.6, s > 0 ? 0x2ecfff : 0xff4d4d, s * 17, 3.6, -20, 2.4);
  }
  // rotating ring
  const ring = new THREE.Group();
  const rgeo = new THREE.BoxGeometry(4, 2.4, 6);
  const rmat = new THREE.MeshLambertMaterial({ color: 0xaeb7c2 });
  const rmesh = new THREE.InstancedMesh(rgeo, rmat, 48);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    e.set(0, -a, 0);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(Math.cos(a) * 40, 0, Math.sin(a) * 40), q, new THREE.Vector3(1, 1, 1));
    rmesh.setMatrixAt(i, m4);
  }
  ring.add(rmesh);
  g.add(ring);
  g.userData.ring = ring;
  g.userData.bay = bay;
  // blinking beacons
  const beacons = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const b = mk(1.2, 1.2, 1.2, 0xffd050, Math.cos(a) * 15, Math.sin(a) * 15, -12, 2);
    b.material = new THREE.MeshBasicMaterial({ color: 0xffd050, toneMapped: false });
    beacons.push(b);
  }
  g.userData.beacons = beacons;
  return g;
}

export class SpaceScene {
  constructor(game) {
    this.game = game;
    this.scene = game.sceneSpace;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.planetNodes = [];
    this.asteroids = [];
    this.sky = null;
    this.station = null;
    this.built = false;
    this.docked = false;
    this.approach = null;
    this._tmp = new THREE.Vector3();
    this.tritiumHint = false;
  }

  async enter(currentPlanet, opts = {}) {
    const g = this.game;
    if (!this.built) this._build();
    this._layout();
    // move the ship into the space scene
    this.scene.add(g.ship.object);
    const node = this.planetNodes.find((p) => p.planet === currentPlanet) || this.planetNodes[0];
    if (node) {
      // park the ship well clear of the planet, heading along the tangent (never into it)
      const up = new THREE.Vector3(0.25, 0.72, 1).normalize();
      g.ship.object.position.copy(node.group.position).addScaledVector(up, node.planet.radius * 3.0);
      // heading 46 degrees off the planet: it stays in frame while we drift safely past it
      const toPlanet = up.clone().multiplyScalar(-1);
      g.ship.euler.set(-0.22, Math.atan2(-toPlanet.x, -toPlanet.z) + 0.8, 0);
      g.ship.object.rotation.set(g.ship.euler.x, g.ship.euler.y, g.ship.euler.z, 'YXZ');
      g.ship.speed = 22;
      g.ship.throttle = 0.2;
      g.ship.vel.set(0, 0, 0);
    }
    g.ship.state = 'flying';
    g.ship.gearOut = 0;
    g.ship.applyGear();
    if (!g.ship.engineHandle) g.ship.engineHandle = g.audio.startShipEngine();
    this.docked = false;
    await new Promise((r) => setTimeout(r, 30));
  }

  _build() {
    const g = this.game;
    // space sky
    this.sky = new Sky(this.scene, { cloudSeed: 3 });
    this.sky.uniforms.uSpace.value = 1;
    this.sky.uniforms.uStars.value = 1.45;
    this.sky.clouds.visible = false;
    this.sky.moon.visible = false;
    this.sky.uniforms.uZenith.value.setHex(0x01020a);
    this.sky.uniforms.uHorizon.value.setHex(0x050a18);

    // lights
    this.sun = new THREE.DirectionalLight(0xffffff, 2.6);
    this.sun.position.set(1, 0.35, 0.6).normalize();
    this.scene.add(this.sun);
    this.ambient = new THREE.AmbientLight(0x3a4a66, 0.55);
    this.scene.add(this.ambient);

    // star (the system's sun) as a glowing blocky orb
    this.starMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(120, 1),
      new THREE.MeshBasicMaterial({ color: 0xfff0c0, toneMapped: false })
    );
    this.starMesh.material.color.multiplyScalar(2.4);
    this.group.add(this.starMesh);
    const glowTex = makeGlowTexture();
    this.starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd08a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.starGlow.scale.setScalar(1400);
    this.group.add(this.starGlow);

    this.built = true;
  }

  _layout() {
    const g = this.game;
    // clear previous planets/station
    for (const n of this.planetNodes) { this.group.remove(n.group); disposeTree(n.group); }
    this.planetNodes = [];
    if (this.station) { this.group.remove(this.station); disposeTree(this.station); this.station = null; }
    for (const a of this.asteroids) { this.group.remove(a.mesh); disposeTree(a.mesh); }
    this.asteroids = [];

    const sys = g.system;
    const starColor = new THREE.Color(sys.starColor);
    this.starMesh.material.color.copy(starColor).multiplyScalar(2.2);
    this.starGlow.material.color.copy(starColor);
    this.sky.uniforms.uNebula.value.setHSL(((sys.seed % 360) / 360), 0.55, 0.22);
    this.sun.color.copy(starColor);

    const scale = 9; // world units per orbit unit
    sys.planets.forEach((planet, i) => {
      const grp = buildVoxelPlanet(planet);
      const a = planet.orbitPhase;
      const r = planet.orbit * scale * 0.5;
      grp.position.set(Math.cos(a) * r, Math.sin(a * 0.6) * r * 0.12, Math.sin(a) * r);
      grp.rotation.z = planet.axialTilt;
      this.group.add(grp);
      this.planetNodes.push({ planet, group: grp, spin: 0.02 + (i % 3) * 0.01 });
    });

    // station orbits the first planet
    this.station = buildStation(sys.station.name);
    const host = this.planetNodes[0];
    this.stationOrbit = { host, angle: sys.station.phase, radius: host.planet.radius * 3.4 };
    this.group.add(this.station);

    // asteroid clusters scattered between orbits
    const rng = makeRng(sys.seed + 999);
    for (let c = 0; c < 14; c++) {
      const count = 26 + Math.floor(rng.next() * 40);
      const geo = new THREE.BoxGeometry(4, 4, 4);
      const mat = new THREE.MeshLambertMaterial({ color: 0x8a8f96 });
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      const cx = rng.range(-2600, 2600), cy = rng.range(-500, 500), cz = rng.range(-2600, 2600);
      for (let i = 0; i < count; i++) {
        e.set(rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28));
        q.setFromEuler(e);
        const s = rng.range(0.5, 2.4);
        m.compose(new THREE.Vector3(rng.range(-60, 60), rng.range(-60, 60), rng.range(-60, 60)), q, new THREE.Vector3(s, s, s));
        mesh.setMatrixAt(i, m);
      }
      mesh.position.set(cx, cy, cz);
      this.group.add(mesh);
      this.asteroids.push({ mesh, hp: 100, pos: new THREE.Vector3(cx, cy, cz), radius: 70 });
    }
  }

  leave() {
    // move the ship back to the surface scene
    this.game.sceneSurface.add(this.game.ship.object);
  }

  /* ---------------- interactions ---------------- */
  nearestPlanet() {
    const p = this.game.ship.object.position;
    let best = null, bd = 1e9;
    for (const n of this.planetNodes) {
      const d = p.distanceTo(n.group.position) - n.planet.radius;
      if (d < bd) { bd = d; best = n; }
    }
    return { node: best, dist: bd };
  }

  stationDist() {
    if (!this.station) return 1e9;
    return this.game.ship.object.position.distanceTo(this.station.position);
  }

  tryDock() {
    const d = this.stationDist();
    if (d < 130) this.dock();
    else { this.game.ui.toast({ kind: 'warn', name: '未在空间站停靠范围内', amt: Math.round(d) + 'u' }); this.game.audio.uiError(); }
  }

  dock() {
    const g = this.game;
    this.docked = true;
    g.mode = 'station';
    g.flags.dockedStation = true;
    g.audio.teleport();
    g.audio.stopShipEngine();
    g.ship.engineHandle = null;
    g.audio.stopPulseDrive();
    g.ship.pulseActive = false;
    g.ui.warp(false);
    g.music.setMode('station');
    g.ui.cinematic({ main: g.system.station.name, sub: '已停靠 · 按 T 交易 · 按 F 离开', dur: 5000 });
    g.ui.shipPrompt('<span class="kbd">T</span> 交易终端 · <span class="kbd">M</span> 星系地图 · <span class="kbd">F</span> 离开空间站');
    // park the ship inside the bay
    const bayPos = this.station.position.clone().add(new THREE.Vector3(0, 0, -8));
    g.ship.object.position.copy(bayPos);
    g.ship.euler.set(0, Math.PI, 0);
    g.ship.object.rotation.set(0, Math.PI, 0);
    g.ship.speed = 0;
    g.ship.throttle = 0;
    g.ship.gearOut = 1;
    g.ship.applyGear();
    // refuel courtesy of the station
    g.ship.pulseFuel = Math.min(1, g.ship.pulseFuel + 0.35);
    g.ship.shield = g.ship.maxShield;
    g.player.life = g.player.maxLife;
    g.player.hazard = g.player.maxHazard;
    g.player.health = g.player.maxHealth;
    g.ui.toast({ kind: 'info', name: '空间站已为你补充生命维持与燃料', amt: '', dur: 4200 });
  }

  leaveStation() {
    const g = this.game;
    this.docked = false;
    g.mode = 'space';
    g.ship.engineHandle = g.audio.startShipEngine();
    g.music.setMode('space');
    g.ui.shipPrompt(null);
    const out = this.station.position.clone().add(new THREE.Vector3(0, 0, -220));
    g.ship.object.position.copy(out);
    g.ship.euler.set(0, Math.PI, 0);
    g.ship.throttle = 0.35;
    g.audio.cockpitEnter();
  }

  onInteract() {
    const d = this.stationDist();
    if (d < 200) this.dock();
    else this.game.audio.uiError();
  }

  shoot() {
    const g = this.game;
    const ship = g.ship;
    const origin = ship.object.position.clone();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.object.quaternion);
    g.audio.laserShot();
    // tracers from wingtips
    for (const side of [-1, 1]) {
      const start = ship.object.localToWorld(new THREE.Vector3(side * 4.5, 0, -1));
      for (let i = 0; i < 12; i++) {
        const p = start.clone().addScaledVector(fwd, i * 14);
        g.particles.trail(p.x, p.y, p.z, side > 0 ? '#ffd08a' : '#ffb347', { life: 0.22, size: 1.2, spread: 0.02, glow: true, grav: 0 });
      }
    }
    // hit test asteroids
    for (const a of this.asteroids) {
      const oc = a.pos.clone().sub(origin);
      const t = oc.dot(fwd);
      if (t < 0 || t > 900) continue;
      const perp = oc.clone().addScaledVector(fwd, -t).length();
      if (perp > a.radius) continue;
      a.hp -= 34;
      const hit = origin.clone().addScaledVector(fwd, t);
      g.particles.burst(hit.x, hit.y, hit.z, '#ffd6a0', 14, { size: 1.1, life: 0.7, spread: 8, glow: true, grav: 0 });
      if (a.hp <= 0) {
        a.hp = 100;
        const amount = 40 + Math.floor(Math.random() * 60);
        g.inventory.add('TRITIUM', amount);
        g.audio.explosion(0.5);
        g.ui.toast({ kind: 'get', key: 'TRITIUM', amt: '+' + amount });
        g.particles.burst(a.pos.x, a.pos.y, a.pos.z, '#7fffd6', 30, { size: 1.6, life: 1.2, spread: 22, glow: true, grav: 0 });
      }
      break;
    }
  }

  refuelPulse() {
    const g = this.game;
    if (!g.inventory.has('TRITIUM', 50)) {
      g.ui.toast({ kind: 'warn', name: '需要 50 氚 (击碎小行星获得)', amt: '' });
      g.audio.uiError();
      return false;
    }
    g.inventory.remove('TRITIUM', 50);
    g.ship.pulseFuel = Math.min(1, g.ship.pulseFuel + 0.4);
    g.audio.confirm();
    g.ui.toast({ kind: 'info', name: '脉冲引擎已加注', amt: '+40%' });
    return true;
  }

  /* ---------------- per-frame ---------------- */
  update(dt) {
    const g = this.game;
    const t = g.time;

    // planets spin & orbit slowly
    for (const n of this.planetNodes) {
      n.group.rotation.y += n.spin * dt * 0.2;
    }
    if (this.station && this.stationOrbit) {
      this.stationOrbit.angle += dt * 0.02;
      const h = this.stationOrbit.host;
      const r = this.stationOrbit.radius;
      this.station.position.set(
        h.group.position.x + Math.cos(this.stationOrbit.angle) * r,
        h.group.position.y + h.planet.radius * 0.4,
        h.group.position.z + Math.sin(this.stationOrbit.angle) * r
      );
      this.station.userData.ring.rotation.y += dt * 0.35;
      const blink = (Math.sin(t * 4) > 0);
      for (const b of this.station.userData.beacons) b.visible = blink;
      this.station.lookAt(h.group.position);
    }
    this.starGlow.position.copy(this.starMesh.position);
    if (this.sky) {
      this.sky.mesh.position.copy(g.camera.position);
      this.sky.mesh.scale.setScalar(26000);
      this.sky.uniforms.uTime.value = t;
      this.sky.sun.visible = false;
    }

    if (this.docked) {
      // parked in the bay: slow orbit camera
      const cam = g.camera;
      const center = g.ship.object.position;
      const a = t * 0.12;
      cam.position.set(center.x + Math.cos(a) * 22, center.y + 8, center.z + Math.sin(a) * 22);
      cam.up.set(0, 1, 0);
      cam.lookAt(center);
      cam.fov += (58 - cam.fov) * Math.min(1, dt * 3);
      cam.updateProjectionMatrix();
      g.particles.update(dt, null);
      return;
    }

    // ship flight
    g.ship.update(dt);
    this.keepShipOutOfSolids();
    g.particles.update(dt, null);

    // sun direction for shaders (space uses its own lights)
    this.sun.position.copy(this.starMesh.position).sub(g.ship.object.position).normalize().multiplyScalar(-1);

    // pulse drive star streaks
    if (g.ship.pulseActive) {
      const cam = g.camera;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      for (let i = 0; i < 5; i++) {
        const p = cam.position.clone().addScaledVector(fwd, 60 + Math.random() * 300);
        p.x += (Math.random() - 0.5) * 220; p.y += (Math.random() - 0.5) * 160; p.z += (Math.random() - 0.5) * 220;
        g.particles.trail(p.x, p.y, p.z, Math.random() < 0.5 ? '#ffffff' : '#a8d8ff', { life: 0.4, size: 1.4, spread: 0.05, glow: true, grav: 0 });
      }
    }

    // fire cannons
    if (g.input.mousePressed.left && !g.uiBlocking) this.shoot();

    // approach prompts
    const { node, dist } = this.nearestPlanet();
    const sd = this.stationDist();
    let prompt = null;
    if (sd < 200) {
      prompt = '<span class="kbd">空格</span> 长按停靠空间站  ·  <span class="cy">' + g.system.station.name + '</span>';
      const need = g.creative ? 0.3 : 1.1;
      if (g.input.down('Space')) {
        this._dockCharge = (this._dockCharge || 0) + dt;
        prompt = '停靠中… <b>' + Math.round(Math.min(1, this._dockCharge / need) * 100) + '%</b>';
        if (this._dockCharge > need) { this._dockCharge = 0; this.dock(); }
      } else this._dockCharge = 0;
      g.ui.shipTarget(g.system.station.name, Math.round(sd) + 'u');
    } else if (node && dist < node.planet.radius * 1.6) {
      const p = node.planet;
      prompt = '<span class="kbd">空格</span> 长按进入 <span class="hi">' + p.name + '</span> 大气层';
      const needE = g.creative ? 0.3 : 1.0;
      if (g.input.down('Space')) {
        this._entryCharge = (this._entryCharge || 0) + dt;
        prompt = '进入大气层… <b>' + Math.round(Math.min(1, this._entryCharge / needE) * 100) + '%</b>';
        if (this._entryCharge > needE) {
          this._entryCharge = 0;
          this.approachNode = node;
          g.transition.enterAtmosphere(p);
        }
      } else this._entryCharge = 0;
      g.ui.shipTarget(p.name + ' · ' + p.biomeCn, Math.round(dist) + 'u');
    } else {
      this._entryCharge = 0;
      this._dockCharge = 0;
      if (node) g.ui.shipTarget(node.planet.name + ' · ' + node.planet.biomeCn, Math.round(dist) + 'u');
      if (g.ship.pulseFuel < 0.05) prompt = '<span class="warn">脉冲引擎无燃料</span> — 击碎小行星获取氚 (左键开火)';
    }
    g.ui.shipPrompt(prompt);

    // vitals still tick in space (ship life support)
    g.ui.updateVitals(g.player);
  }

  /** hard safety: never let the ship end up inside a planet or the station */
  keepShipOutOfSolids() {
    const g = this.game;
    const ship = g.ship.object;
    for (const n of this.planetNodes) {
      const r = n.planet.radius * 1.18;
      const d = ship.position.distanceTo(n.group.position);
      if (d < r) {
        const out = ship.position.clone().sub(n.group.position);
        if (out.lengthSq() < 1e-6) out.set(0, 1, 0);
        out.normalize();
        ship.position.copy(n.group.position).addScaledVector(out, r + 8);
        g.ship.euler.set(0.05, Math.atan2(-out.x, -out.z), 0);
        ship.rotation.set(g.ship.euler.x, g.ship.euler.y, g.ship.euler.z, 'YXZ');
        g.ship.speed = Math.min(g.ship.speed, 30);
        g.ship.throttle = Math.min(g.ship.throttle, 0.25);
        if (!this._pushToast || g.time - this._pushToast > 4) {
          this._pushToast = g.time;
          g.ui.toast({ kind: 'warn', name: '过于接近行星，自动拉起', amt: n.planet.name });
        }
        break;
      }
    }
    if (this.station && !this.docked) {
      const d = ship.position.distanceTo(this.station.position);
      if (d < 46) {
        const out = ship.position.clone().sub(this.station.position).normalize();
        ship.position.copy(this.station.position).addScaledVector(out, 48);
        g.ship.speed = Math.min(g.ship.speed, 25);
      }
    }
  }

  /** during the atmosphere-entry cinematic: dive toward the planet */
  updateDive(dt, k) {
    const g = this.game;
    const node = this.approachNode || this.nearestPlanet().node;
    if (!node) return;
    const ship = g.ship.object;
    const toPlanet = node.group.position.clone().sub(ship.position).normalize();
    const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), toPlanet);
    ship.quaternion.slerp(targetQuat, Math.min(1, dt * 2.2));
    const speed = 260 + k * 900;
    ship.position.addScaledVector(toPlanet, speed * dt);
    g.ship.speed = speed;
    g.ship.updateCamera(dt);
    // planets keep spinning
    for (const n of this.planetNodes) n.group.rotation.y += n.spin * dt * 0.2;
    if (this.sky) { this.sky.mesh.position.copy(g.camera.position); this.sky.mesh.scale.setScalar(26000); this.sky.uniforms.uTime.value = g.time; }
  }

  updateWarpCharge(dt, k) {
    const g = this.game;
    const ship = g.ship.object;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.quaternion);
    ship.position.addScaledVector(fwd, (120 + k * 1800) * dt);
    g.ship.speed = 120 + k * 1800;
    g.ship.updateCamera(dt);
    if (g.particles) {
      const cam = g.camera;
      for (let i = 0; i < 8; i++) {
        const p = cam.position.clone().addScaledVector(fwd, 80 + Math.random() * 400);
        p.x += (Math.random() - 0.5) * 300; p.y += (Math.random() - 0.5) * 220; p.z += (Math.random() - 0.5) * 300;
        g.particles.trail(p.x, p.y, p.z, ['#ffffff', '#a8d8ff', '#ffd08a'][Math.floor(Math.random() * 3)], { life: 0.35, size: 2.2, spread: 0.02, glow: true, grav: 0 });
      }
      g.particles.update(dt, null);
    }
    if (this.sky) { this.sky.mesh.position.copy(g.camera.position); this.sky.mesh.scale.setScalar(26000); this.sky.uniforms.uTime.value = g.time; }
  }

  /** nearby star systems for the galaxy map */
  getNearbySystems(count = 8) {
    const g = this.game;
    const base = strSeed(String(g.seedStr));
    const rng = makeRng(base + 31337);
    const list = [];
    for (let i = 0; i < count; i++) {
      const seed = (base + (i + 1) * 7919) >>> 0;
      const sys = generateSystem(seed);
      list.push({
        seed, name: sys.name, planets: sys.planets.length, economy: sys.economy,
        race: sys.race, conflict: sys.conflict, starClass: sys.starClass,
        dist: Math.round(rng.range(84, 620)),
        x: rng.range(0.08, 0.92), y: rng.range(0.12, 0.88),
      });
    }
    return list;
  }

  dispose() {
    for (const n of this.planetNodes) { this.group.remove(n.group); disposeTree(n.group); }
    this.planetNodes = [];
  }
}

function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.15, 'rgba(255,230,180,0.75)');
  grad.addColorStop(0.4, 'rgba(255,180,90,0.22)');
  grad.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
