// The starship: a blocky No Man's Sky style fighter, flight physics, take-off and landing.
import * as THREE from 'three';
import { makeRng } from '../core/rng.js';
import { shared } from '../render/materials.js';
import { clamp, lerp } from '../core/noise.js';

const LIVERY = {
  hull: 0xe8ecf2, hullDark: 0x39424d, accent: 0xff8a2b, accent2: 0x2ecfff,
  glass: 0x1b2a38, metal: 0x8e9aa8, engine: 0x2a323b,
};

function box(w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
  const mat = new THREE.MeshBasicMaterial({ color, toneMapped: opts.emissive ? false : true });
  if (opts.emissive) mat.color.multiplyScalar(1 + opts.emissive);
  if (opts.transparent) { mat.transparent = true; mat.opacity = opts.opacity ?? 0.6; }
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function buildShipModel(seed = 1) {
  const rng = makeRng(seed);
  const g = new THREE.Group();
  const L = LIVERY;

  // ---- fuselage: stacked blocks tapering to the nose
  const body = new THREE.Group();
  body.add(box(1.5, 1.0, 4.2, L.hull, 0, 0, 0));
  body.add(box(1.15, 0.75, 1.5, L.hull, 0, 0.02, -2.6));
  body.add(box(0.8, 0.5, 1.1, L.hull, 0, 0.02, -3.6));
  body.add(box(0.42, 0.3, 0.7, L.accent, 0, 0.02, -4.25, { emissive: 0.25 }));
  // spine + panels
  body.add(box(0.7, 0.28, 3.0, L.hullDark, 0, 0.55, 0.2));
  body.add(box(1.62, 0.16, 1.4, L.accent, 0, -0.1, -1.1, { emissive: 0.1 }));
  body.add(box(1.56, 0.2, 0.6, L.hullDark, 0, 0.1, 1.6));
  // belly
  body.add(box(1.2, 0.3, 2.6, L.hullDark, 0, -0.6, 0.1));
  g.add(body);

  // ---- cockpit canopy
  const canopy = new THREE.Group();
  canopy.add(box(1.05, 0.62, 1.6, L.glass, 0, 0.62, -1.5, { transparent: true, opacity: 0.55 }));
  canopy.add(box(1.12, 0.1, 1.7, L.metal, 0, 0.33, -1.5));
  canopy.add(box(0.14, 0.6, 1.62, L.hull, 0.55, 0.62, -1.5));
  canopy.add(box(0.14, 0.6, 1.62, L.hull, -0.55, 0.62, -1.5));
  canopy.add(box(1.0, 0.12, 0.16, L.accent2, 0, 0.9, -2.25, { emissive: 1.2 }));
  g.add(canopy);

  // ---- wings (swept, blocky, with tip pods)
  const wing = (side) => {
    const w = new THREE.Group();
    w.add(box(3.2, 0.22, 1.5, L.hull, side * 2.2, -0.05, 0.35));
    w.add(box(2.0, 0.2, 0.9, L.hull, side * 3.6, -0.05, 1.0));
    w.add(box(0.9, 0.3, 1.9, L.hullDark, side * 1.3, -0.02, 0.2));
    // orange stripe
    w.add(box(2.6, 0.06, 0.34, L.accent, side * 2.4, 0.1, -0.05, { emissive: 0.15 }));
    // wingtip pod + light
    w.add(box(0.5, 0.42, 1.5, L.hull, side * 4.5, 0.02, 0.55));
    w.add(box(0.22, 0.22, 0.22, side > 0 ? 0x2ecfff : 0xff4d4d, side * 4.5, 0.02, -0.28, { emissive: 2.2 }));
    // pylon
    w.add(box(0.3, 0.5, 0.8, L.metal, side * 1.0, -0.35, 0.4));
    w.rotation.z = -side * 0.06;
    w.rotation.y = side * 0.05;
    return w;
  };
  g.add(wing(1));
  g.add(wing(-1));

  // ---- twin engines with glowing exhaust
  const engines = [];
  for (const side of [-1, 1]) {
    const e = new THREE.Group();
    e.add(box(0.72, 0.72, 1.9, L.engine, side * 0.95, -0.1, 1.9));
    e.add(box(0.82, 0.24, 1.5, L.metal, side * 0.95, 0.2, 1.9));
    const nozzle = box(0.6, 0.6, 0.28, 0x11161c, side * 0.95, -0.1, 2.9);
    e.add(nozzle);
    const glow = box(0.5, 0.5, 0.16, 0x59c8ff, side * 0.95, -0.1, 3.02, { emissive: 2.6 });
    e.add(glow);
    const flame = box(0.36, 0.36, 1.2, 0x8ae8ff, side * 0.95, -0.1, 3.7, { emissive: 3, transparent: true, opacity: 0.75 });
    flame.visible = false;
    e.add(flame);
    engines.push({ group: e, glow, flame, nozzle });
    g.add(e);
  }

  // ---- tail fins
  g.add(box(0.16, 1.1, 1.0, L.hull, 0.75, 0.6, 2.2));
  g.add(box(0.16, 1.1, 1.0, L.hull, -0.75, 0.6, 2.2));
  g.add(box(0.16, 0.3, 0.36, L.accent, 0.75, 1.15, 2.0, { emissive: 0.6 }));
  g.add(box(0.16, 0.3, 0.36, L.accent, -0.75, 1.15, 2.0, { emissive: 0.6 }));

  // ---- landing gear (retractable)
  const gear = [];
  const mkGear = (x, z) => {
    const grp = new THREE.Group();
    grp.add(box(0.16, 1.0, 0.16, L.metal, 0, -0.5, 0));
    grp.add(box(0.5, 0.16, 0.6, L.hullDark, 0, -1.0, 0));
    grp.position.set(x, -0.5, z);
    g.add(grp);
    gear.push(grp);
    return grp;
  };
  mkGear(0, -1.9);
  mkGear(1.1, 1.4);
  mkGear(-1.1, 1.4);

  g.userData = { engines, gear, canopy, body };
  return g;
}

export class Ship {
  constructor(game) {
    this.game = game;
    this.object = buildShipModel(7);
    this.object.scale.setScalar(1.0);
    game.sceneSurface.add(this.object);
    this.reset();
    this.camDist = 12;
    this.camHeight = 3.4;
    this.camMode = 0; // 0 chase, 1 cockpit
    this.quat = new THREE.Quaternion();
    this.vel = new THREE.Vector3();
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._tmp = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._camLook = new THREE.Vector3();
    this.engineHandle = null;
    this.pulseHandle = null;
  }

  reset() {
    this.systems = { launch: false, pulse: false, hyper: false };
    this.launchFuel = 0;
    this.pulseFuel = 0.35;
    this.hull = 100; this.maxHull = 100;
    this.shield = 100; this.maxShield = 100;
    this.state = 'landed'; // landed | takeoff | flying | space | landing
    this.throttle = 0.25;
    this.speed = 0;
    this.gearOut = 1;
    this.pulseActive = false;
    this.chargeT = 0;
    this.landingT = 0;
    this.inside = false;
  }

  placeOnSurface(nearPos, crashSite = false) {
    const g = this.game;
    const w = g.world;
    // find a flat-ish spot
    let best = null;
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 * 3;
      const r = 10 + i * 0.7;
      const x = nearPos.x + Math.cos(a) * r;
      const z = nearPos.z + Math.sin(a) * r;
      const y = w.surfaceY(x, z);
      let flat = true;
      for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, -2]]) {
        if (Math.abs(w.surfaceY(x + dx, z + dz) - y) > 2) { flat = false; break; }
      }
      if (flat && y > (g.planet.terrain.water ? g.planet.terrain.sea + 1 : 2)) { best = { x, y, z }; break; }
    }
    if (!best) best = { x: nearPos.x + 12, y: w.surfaceY(nearPos.x + 12, nearPos.z), z: nearPos.z };
    this.object.position.set(best.x, best.y + 1.45, best.z);
    this.object.rotation.set(0, Math.random() * Math.PI * 2, 0);
    this.euler.set(0, this.object.rotation.y, 0);
    this.state = 'landed';
    this.gearOut = 1;
    this.applyGear();
    if (crashSite) {
      // crash-site dressing: scorched ground, gouged furrow, scattered debris, smoke
      this.object.rotation.z = 0.12;
      this.object.rotation.x = -0.06;
      this.crashSmoke = true;
      this.hull = 42;
      this._dressCrashSite();
    }
  }

  /** carve a crash furrow and scatter scorched debris around the wreck */
  _dressCrashSite() {
    const g = this.game;
    const w = g.world;
    if (!w) return;
    const B = { BASALT: 28, COBBLE: 11, METAL_PANEL: 23, GRAVEL: 6 };
    const px = Math.floor(this.object.position.x);
    const pz = Math.floor(this.object.position.z);
    const dirX = Math.cos(this.object.rotation.y + Math.PI / 2);
    const dirZ = Math.sin(this.object.rotation.y + Math.PI / 2);
    // furrow behind the ship: dig a shallow trench and scorch its edges
    for (let t = 1; t < 26; t++) {
      const fx = Math.round(px + dirX * t);
      const fz = Math.round(pz + dirZ * t);
      const depth = Math.max(0, 3 - Math.floor(t / 7));
      const width = Math.max(1, 3 - Math.floor(t / 9));
      for (let dx = -width; dx <= width; dx++) {
        for (let dz = -width; dz <= width; dz++) {
          const sx = fx + dx, sz = fz + dz;
          const sy = w.surfaceY(sx, sz);
          if (Math.hypot(dx, dz) > width + 0.4) continue;
          for (let d = 0; d < depth; d++) w.setBlock(sx, sy - d, sz, 0, true);
          const floorY = w.surfaceY(sx, sz);
          if (Math.random() < 0.6) w.setBlock(sx, floorY, sz, Math.random() < 0.6 ? B.BASALT : B.GRAVEL, true);
        }
      }
    }
    // debris chunks torn off the hull
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 16;
      const dx = Math.round(px + Math.cos(a) * r);
      const dz = Math.round(pz + Math.sin(a) * r);
      const dy = w.surfaceY(dx, dz) + 1;
      w.setBlock(dx, dy, dz, B.METAL_PANEL, true);
      if (Math.random() < 0.4) w.setBlock(dx, dy + 1, dz, B.METAL_PANEL, true);
    }
    w.flushDirty(12);
  }

  applyGear() {
    const gears = this.object.userData.gear;
    gears.forEach((grp, i) => {
      grp.visible = this.gearOut > 0.02;
      grp.scale.y = Math.max(0.05, this.gearOut);
      grp.position.y = -0.5 - (1 - this.gearOut) * 0.35;
    });
  }

  repair(system) {
    this.systems[system] = true;
  }

  refuelLaunch(amount) {
    this.launchFuel = clamp(this.launchFuel + amount, 0, 1);
  }

  enter() {
    this.inside = true;
    this.euler.set(0, this.object.rotation.y, 0);
    this.throttle = 0.2;
    this.engineHandle = this.game.audio.startShipEngine();
    this.game.ui.shipPrompt('<span class="kbd">空格</span> 长按起飞');
  }

  exit() {
    this.inside = false;
    if (this.engineHandle) { this.game.audio.stopShipEngine(); this.engineHandle = null; }
    this.game.ui.shipPrompt(null);
    // put the player next to the ship
    const p = this.game.player;
    const pos = this.object.position;
    const sy = this.game.world.surfaceY(pos.x + 3, pos.z + 2);
    p.pos.set(pos.x + 3, sy + 1.6, pos.z + 2);
    p.vel.set(0, 0, 0);
    p.lastGroundY = p.pos.y;
  }

  onKeyF() {
    const g = this.game;
    if (this.state === 'landed') { g.exitShip(); return; }
    if (g.mode === 'fly') {
      // try to land
      const alt = this.altitude();
      const maxAlt = g.creative ? 90 : 14, maxSpd = g.creative ? 140 : 40;
      if (alt !== null && alt < maxAlt && this.speed < maxSpd) this.beginLanding();
      else { g.ui.toast({ kind: 'warn', name: '降落失败: 高度或速度过高', amt: Math.round(alt) + 'm' }); g.audio.uiError(); }
      return;
    }
    if (g.mode === 'space') {
      g.space.tryDock();
    }
  }

  toggleCam() {
    this.camMode = this.camMode === 0 ? 1 : 0;
    this.game.audio.uiClick();
  }

  altitude() {
    const g = this.game;
    if (g.mode !== 'fly' || !g.world) return null;
    const sy = g.world.surfaceY(this.object.position.x, this.object.position.z);
    return this.object.position.y - sy;
  }

  beginLanding() {
    const g = this.game;
    this.state = 'landing';
    this.landingT = 0;
    this.gearOut = 0;
    g.audio.shipLandingGear();
    g.ui.shipPrompt(null);
    g.ui.cinematic({ main: '', sub: '降落程序启动', dur: 1600 });
  }

  update(dt) {
    const g = this.game;
    const input = g.input;
    const obj = this.object;
    const isSpace = g.mode !== 'fly';   // space / station / cinematic transitions all fly like space

    if (this.state === 'landed') {
      this.updateLanded(dt);
    } else if (this.state === 'takeoff') {
      this.updateTakeoff(dt);
    } else if (this.state === 'landing') {
      this.updateLanding(dt);
    } else {
      this.updateFlying(dt, isSpace);
    }

    // engine visuals
    const eng = obj.userData.engines;
    const power = this.state === 'landed' ? 0.06 : clamp(this.throttle, 0.08, 1) * (this.pulseActive ? 2.2 : 1);
    for (const e of eng) {
      e.flame.visible = power > 0.15;
      const l = 0.6 + power * 2.6 + Math.random() * 0.25;
      e.flame.scale.set(0.7 + power * 0.5, 0.7 + power * 0.5, l);
      e.flame.position.z = 3.2 + l * 0.45;
      e.glow.material.color.setRGB(0.35 + power * 1.6, 1.2 + power * 1.2, 2.6 + power);
    }
    // exhaust particles
    if (g.particles && power > 0.2 && this.state !== 'landed') {
      for (const e of eng) {
        const wp = e.flame.getWorldPosition(this._tmp).clone();
        if (Math.random() < 0.85) {
          g.particles.trail(wp.x, wp.y, wp.z, this.pulseActive ? '#c4a2ff' : '#8ae8ff', { life: 0.35, size: 0.16 + power * 0.1, spread: 0.5, glow: true, grav: 0 });
        }
      }
    }
    if (this.crashSmoke && this.state === 'landed' && g.particles && Math.random() < 0.4) {
      const p = obj.position;
      g.particles.trail(p.x + (Math.random() - 0.5) * 2, p.y + 1, p.z + (Math.random() - 0.5) * 2, '#4a4a4a', { life: 1.6, size: 0.28, spread: 0.35, up: 1.1, grav: -0.08, glow: false });
    }

    if (this.engineHandle) this.engineHandle.setThrottle(this.state === 'landed' ? 0.05 : this.throttle, this.speed);

    // atmospheric airflow layer (silent in space)
    const inAtmo = g.mode === 'fly' || g.mode === 'transition';
    if (inAtmo && this.state !== 'landed') {
      if (!this.windHandle) this.windHandle = g.audio.startWind();
      if (this.windHandle) this.windHandle.setLevel(Math.min(1, this.speed / 150));
    } else if (this.windHandle) {
      g.audio.stopWind();
      this.windHandle = null;
    }

    // camera
    this.updateCamera(dt);

    // hud
    g.ui.updateShipHud({
      throttle: this.throttle, shield: this.shield / this.maxShield, hull: this.hull / this.maxHull,
      vel: this.speed, alt: this.altitude(), pulse: this.pulseFuel, launch: this.launchFuel,
    });
  }

  updateLanded(dt) {
    const g = this.game;
    const input = g.input;
    this.speed = 0;
    this.throttle = lerp(this.throttle, 0.06, Math.min(1, dt * 3));
    if (!this.inside) return;
    if (!this.systems.launch) {
      g.ui.shipPrompt('<span class="warn">起飞推进器已损坏</span> — 按 <span class="kbd">E</span> 维修');
      if (g.input.hit('KeyE')) { g.panels.openShipRepair(); g.uiBlocking = true; g.input.releaseLock(); }
      return;
    }
    if (this.launchFuel < 0.24) {
      g.ui.shipPrompt('<span class="warn">起飞燃料不足</span> — 按 <span class="kbd">E</span> 加注二氢凝胶');
      if (g.input.hit('KeyE')) { g.panels.openShipRepair(); g.uiBlocking = true; g.input.releaseLock(); }
      return;
    }
    const chargeNeed = g.creative ? 0.35 : 1.2;
    if (input.down('Space')) {
      this.chargeT += dt;
      g.ui.shipPrompt('起飞推进器充能 <b>' + Math.round(Math.min(1, this.chargeT / chargeNeed) * 100) + '%</b>');
      if (!this._chargeSfx) this._chargeSfx = g.audio.startCharge();
      if (this.chargeT >= chargeNeed) {
        if (this._chargeSfx) { this._chargeSfx.stop(true); this._chargeSfx = null; }
        this.launch();
      }
    } else {
      this.chargeT = Math.max(0, this.chargeT - dt * 2);
      if (this._chargeSfx) { this._chargeSfx.stop(false); this._chargeSfx = null; }
      g.ui.shipPrompt('<span class="kbd">空格</span> 长按起飞 · <span class="kbd">F</span> 下船');
    }
  }

  launch() {
    const g = this.game;
    this.state = 'takeoff';
    this.takeoffT = 0;
    this.launchFuel = Math.max(0, this.launchFuel - 0.24);
    this.gearOut = 1;
    g.audio.shipTakeoff();
    g.ui.shipPrompt(null);
    g.ui.shake(0.7);
    g.flags.tookOff = true;
    // dust blast
    const p = this.object.position;
    if (g.particles) {
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 4;
        g.particles.spawn({
          x: p.x + Math.cos(a) * r, y: p.y - 1.2, z: p.z + Math.sin(a) * r,
          vx: Math.cos(a) * (3 + Math.random() * 4), vy: 1 + Math.random() * 3, vz: Math.sin(a) * (3 + Math.random() * 4),
          life: 1.6 + Math.random(), size: 0.3 + Math.random() * 0.3, color: g.palette.blockColor(g.world.getBlock(Math.floor(p.x), Math.floor(p.y - 2), Math.floor(p.z)) || 2), grav: 0.35, drag: 0.9,
        });
      }
    }
    this.euler.x = -0.18;
  }

  updateTakeoff(dt) {
    const g = this.game;
    this.takeoffT += dt;
    const t = this.takeoffT;
    this.throttle = clamp(t / 2.4, 0.2, 1);
    const lift = t < 1.6 ? 16 * (1 - t / 3) : 9;
    this.object.position.y += lift * dt;
    this.gearOut = clamp(1 - t / 1.2, 0, 1);
    this.applyGear();
    this.object.rotation.z = lerp(this.object.rotation.z, 0, Math.min(1, dt * 3));
    this.object.rotation.x = lerp(this.object.rotation.x, -0.1, Math.min(1, dt * 3));
    this.speed = lift * 2;
    g.ui.shake(Math.max(0, 0.35 - t * 0.1));
    if (t > 2.6) {
      this.state = 'flying';
      this.euler.set(-0.08, this.object.rotation.y, 0);
      this.vel.set(0, 4, 0);
      this.crashSmoke = false;
      g.ui.shipPrompt('<span class="kbd">W/S</span> 推力 · <span class="kbd">鼠标</span> 转向 · <span class="kbd">F</span> 降落');
      setTimeout(() => g.ui.shipPrompt(null), 4200);
    }
  }

  updateLanding(dt) {
    const g = this.game;
    this.landingT += dt;
    this.gearOut = clamp(this.landingT / 0.9, 0, 1);
    this.applyGear();
    const sy = g.world.surfaceY(this.object.position.x, this.object.position.z);
    const targetY = sy + 1.45;
    this.object.position.y = lerp(this.object.position.y, targetY, Math.min(1, dt * 2.4));
    this.euler.x = lerp(this.euler.x, 0, Math.min(1, dt * 3));
    this.euler.z = lerp(this.euler.z, 0, Math.min(1, dt * 3));
    this.object.rotation.set(this.euler.x, this.euler.y, this.euler.z);
    this.throttle = lerp(this.throttle, 0.05, Math.min(1, dt * 2));
    this.speed = lerp(this.speed, 0, Math.min(1, dt * 3));
    if (Math.abs(this.object.position.y - targetY) < 0.25 && this.landingT > 1.4) {
      this.object.position.y = targetY;
      this.state = 'landed';
      g.audio.shipLandThud();
      g.ui.shake(0.4);
      if (g.particles) {
        const p = this.object.position;
        const col = g.palette.blockColor(g.world.getBlock(Math.floor(p.x), Math.floor(sy), Math.floor(p.z)) || 2);
        g.particles.burst(p.x, sy + 1, p.z, col, 40, { size: 0.24, life: 1.4, spread: 5, upBias: 0.3, grav: 0.5 });
      }
      g.ui.shipPrompt('<span class="kbd">F</span> 下船 · <span class="kbd">空格</span> 长按起飞');
    }
  }

  updateFlying(dt, isSpace) {
    const g = this.game;
    const input = g.input;
    const obj = this.object;
    const uiBlocked = g.uiBlocking || !input.locked;

    // --- attitude
    const sens = input.sensitivity * 0.85;
    if (!uiBlocked) {
      this.euler.x = clamp(this.euler.x - input.mouse.dy * sens, -1.35, 1.35);
      this.euler.y -= input.mouse.dx * sens;
      let roll = 0;
      if (input.down('KeyA')) roll += 1;
      if (input.down('KeyD')) roll -= 1;
      this.euler.z = lerp(this.euler.z, roll * 0.55 - input.mouse.dx * sens * 6, Math.min(1, dt * 5));
    }
    if (!isSpace) {
      // gentle auto-level in atmosphere
      this.euler.z = lerp(this.euler.z, 0, Math.min(1, dt * 0.8));
    }
    obj.rotation.set(this.euler.x, this.euler.y, this.euler.z, 'YXZ');

    // --- throttle
    if (!uiBlocked) {
      if (input.down('KeyW')) this.throttle = clamp(this.throttle + dt * 0.75, 0, 1);
      if (input.down('KeyS')) this.throttle = clamp(this.throttle - dt * 0.9, 0, 1);
    }
    const boosting = !uiBlocked && input.down('ShiftLeft');

    // --- pulse drive (space only)
    const wantPulse = !uiBlocked && isSpace && input.down('Tab') && this.systems.pulse && this.pulseFuel > 0;
    if (wantPulse && !this.pulseActive) {
      this.pulseActive = true;
      this.pulseHandle = g.audio.startPulseDrive();
      g.ui.warp(true);
      g.music.setIntensity(0.9);
    } else if (!wantPulse && this.pulseActive) {
      this.pulseActive = false;
      g.audio.stopPulseDrive();
      this.pulseHandle = null;
      g.ui.warp(false);
      g.music.setIntensity(0.55);
    }
    if (this.pulseActive) {
      if (!g.creative) this.pulseFuel = Math.max(0, this.pulseFuel - dt * 0.035);
      if (this.pulseFuel <= 0) {
        g.ui.toast({ kind: 'warn', name: '脉冲引擎燃料耗尽', amt: '需要氚' });
      }
    }

    // --- velocity
    const maxSpeed = isSpace ? (this.pulseActive ? 780 : boosting ? 220 : 130) : (boosting ? 155 : 95);
    const target = this.throttle * maxSpeed;
    this.speed = lerp(this.speed, target, Math.min(1, dt * (this.pulseActive ? 1.6 : 2.4)));
    const fwd = new THREE.Vector3(0, 0, -1).applyEuler(obj.rotation);
    this.vel.copy(fwd).multiplyScalar(this.speed);
    if (!isSpace) {
      // a touch of gravity when slow, so hovering feels physical
      const gravity = clamp(1 - this.speed / 45, 0, 1) * 9;
      this.vel.y -= gravity;
    }
    obj.position.addScaledVector(this.vel, dt);

    // --- terrain interaction (atmosphere)
    if (!isSpace && g.world) {
      const alt = this.altitude();
      if (alt === null) return;          // no terrain to interact with
      const sy = g.world.surfaceY(obj.position.x, obj.position.z);
      if (alt < 3.2) {
        // collision / crash
        const impact = Math.max(0, this.speed - 30) * 0.35 + Math.max(0, -this.vel.y - 8) * 1.2;
        if (impact > 6) {
          this.hull = Math.max(0, this.hull - impact * 0.4);
          g.audio.explosion(0.6);
          g.ui.shake(0.9);
          g.ui.damageFlash();
          g.particles.burst(obj.position.x, obj.position.y, obj.position.z, '#ff8a3a', 22, { size: 0.2, life: 1.1, spread: 4, glow: true });
          if (this.hull <= 0) { this.hull = 25; g.ui.toast({ kind: 'warn', name: '船体严重受损! 紧急降落', amt: '' }); }
        }
        obj.position.y = sy + 3.2;
        this.euler.x = Math.max(this.euler.x, 0.02);
        if (this.speed < 30) this.beginLanding();
      }
      // ceiling: leaving the atmosphere
      if (obj.position.y > 235 && this.euler.x > 0.06) {
        g.ui.shipPrompt('<span class="kbd">空格</span> 长按脱离大气层 · <span class="hi">' + Math.round(obj.position.y) + 'm</span>');
        if (input.down('Space')) {
          this.chargeT += dt;
          if (this.chargeT > 0.8) { this.chargeT = 0; g.transition.exitAtmosphere(); }
        } else this.chargeT = 0;
      } else if (obj.position.y > 200) {
        g.ui.shipPrompt('拉高机头以脱离大气层 <span class="hi">' + Math.round(obj.position.y) + 'm</span>');
      } else if (this._promptClear !== true) {
        // leave other prompts alone
      }
      if (obj.position.y < 200 && this.chargeT > 0) this.chargeT = 0;
    }

    // shield recharge
    this.shield = Math.min(this.maxShield, this.shield + dt * 3);
  }

  updateCamera(dt) {
    const g = this.game;
    const obj = this.object;
    const cam = g.camera;
    if (this.camMode === 1) {
      // cockpit
      const p = obj.localToWorld(new THREE.Vector3(0, 0.62, -1.5));
      cam.position.lerp(p, Math.min(1, dt * 18));
      cam.quaternion.slerp(obj.quaternion, Math.min(1, dt * 14));
    } else {
      const back = 9.5 + this.speed * 0.02 + (this.pulseActive ? 6 : 0);
      const up = 3.0 + this.speed * 0.004;
      const desired = obj.localToWorld(new THREE.Vector3(0, up, back));
      this._camPos.lerp(desired, Math.min(1, dt * 6.5));
      if (this._camPos.lengthSq() < 1) this._camPos.copy(desired);
      cam.position.copy(this._camPos);
      const look = obj.localToWorld(new THREE.Vector3(0, 0.6, -14));
      this._camLook.lerp(look, Math.min(1, dt * 8));
      cam.up.set(0, 1, 0).applyQuaternion(obj.quaternion);
      cam.lookAt(this._camLook);
    }
    const targetFov = g.settings.fov + (this.pulseActive ? 22 : 0) + this.speed * 0.03;
    cam.fov += (targetFov - cam.fov) * Math.min(1, dt * 4);
    cam.updateProjectionMatrix();
    shared.uLampPos.value.copy(cam.position);
  }

  serialize() {
    return {
      systems: this.systems, launchFuel: this.launchFuel, pulseFuel: this.pulseFuel,
      hull: this.hull, shield: this.shield,
      pos: [this.object.position.x, this.object.position.y, this.object.position.z],
    };
  }
  load(d) {
    if (!d) return;
    Object.assign(this.systems, d.systems || {});
    this.launchFuel = d.launchFuel ?? 0;
    this.pulseFuel = d.pulseFuel ?? 0.35;
    this.hull = d.hull ?? 100;
    this.shield = d.shield ?? 100;
  }
}
