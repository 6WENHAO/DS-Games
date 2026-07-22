// ============================================================
//  weapons.js  -  weapon controller for the local player,
//  procedural view-models, spray/recoil, spread, and the
//  shared damage model (hitgroup + armor penetration).
// ============================================================
import * as THREE from "three";
import { WEAPONS, GRENADES, HITGROUP, TEAM } from "./config.js";

// ---- shared damage model (used by player & bots) ----
export function computeDamage(weapon, distance, hitgroup, targetArmor, targetHelmet) {
  let dmg = weapon.dmg;
  dmg *= HITGROUP[hitgroup] ?? 1;
  if (weapon.falloff && distance > weapon.falloff.start) {
    dmg *= Math.pow(weapon.falloff.factor, (distance - weapon.falloff.start) / 5);
  }
  let healthDmg = dmg, armorDmg = 0;
  const armored = hitgroup === "head" ? (targetHelmet && targetArmor > 0) : targetArmor > 0;
  if (armored) {
    healthDmg = dmg * weapon.armorPen;
    armorDmg = (dmg - healthDmg) * 0.5;
    if (armorDmg > targetArmor) {
      const over = armorDmg - targetArmor;
      healthDmg += over * 2;
      armorDmg = targetArmor;
    }
  }
  return { health: Math.round(healthDmg), armor: Math.ceil(armorDmg) };
}

// ---- default loadout ----
export function createInventory(team) {
  return {
    knife: { key: "knife" },
    pistol: {
      key: team === TEAM.T ? "glock" : "usp",
      clip: team === TEAM.T ? 20 : 12,
      reserve: team === TEAM.T ? 120 : 24,
    },
    primary: null,
    grenades: [],
    c4: false,
    hasDefuse: false,
    current: "pistol",
    grenadeIndex: 0,
  };
}

export function weaponMoveSpeed(inv) {
  const cur = currentWeaponData(inv);
  return cur ? cur.moveSpeed || 6.25 : 6.25;
}

export function currentWeaponData(inv) {
  switch (inv.current) {
    case "primary": return inv.primary ? WEAPONS[inv.primary.key] : WEAPONS.knife;
    case "pistol": return WEAPONS[inv.pistol.key];
    case "knife": return WEAPONS.knife;
    case "grenade": return null;
    case "c4": return null;
  }
  return WEAPONS.knife;
}

// ============================================================
//  Procedural view models
// ============================================================
export function buildViewModel(weaponKey) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const black = mat(0x1c1c20), gun = mat(0x33352f), wood = mat(0x6b4a2b),
        metal = mat(0x55575c), orange = mat(0xcc7a33);
  const box = (w, h, d, m, x, y, z) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    g.add(b); return b;
  };

  const w = WEAPONS[weaponKey];
  const cat = w ? w.cat : "melee";

  if (weaponKey === "knife") {
    box(0.03, 0.03, 0.22, metal, 0, 0, -0.18);
    box(0.05, 0.05, 0.1, black, 0, 0, 0.02);
  } else if (cat === "pistol") {
    box(0.07, 0.14, 0.09, black, 0, -0.05, 0.03);        // grip
    box(0.06, 0.07, 0.28, black, 0, 0.05, -0.12);        // slide
    box(0.02, 0.02, 0.12, metal, 0, 0.05, -0.28);        // barrel
    if (w.silenced) box(0.05, 0.05, 0.16, black, 0, 0.05, -0.34);
  } else if (cat === "sniper") {
    box(0.07, 0.12, 0.15, black, 0, -0.04, 0.14);        // stock/grip
    box(0.06, 0.08, 0.7, wood, 0, 0.02, -0.12);          // body
    box(0.03, 0.03, 0.3, metal, 0, 0.03, -0.5);          // barrel
    box(0.05, 0.05, 0.22, black, 0, 0.12, -0.05);        // scope
    box(0.09, 0.02, 0.16, black, 0, 0.16, -0.05);
  } else if (cat === "heavy") {
    box(0.09, 0.16, 0.12, black, 0, -0.05, 0.05);
    box(0.09, 0.11, 0.45, gun, 0, 0.04, -0.18);
    box(0.03, 0.03, 0.2, metal, 0, 0.05, -0.45);
    box(0.14, 0.14, 0.16, black, 0, -0.02, 0.0);         // drum
  } else if (cat === "smg") {
    box(0.06, 0.12, 0.09, black, 0, -0.05, 0.05);        // grip
    box(0.06, 0.09, 0.34, black, 0, 0.03, -0.12);        // body
    box(0.05, 0.14, 0.06, gun, 0, -0.08, -0.05);         // mag
    box(0.02, 0.02, 0.12, metal, 0, 0.03, -0.32);
  } else { // rifle
    const bodyMat = weaponKey === "ak47" || weaponKey === "galil" ? wood : black;
    box(0.07, 0.13, 0.1, black, 0, -0.06, 0.05);         // grip
    box(0.07, 0.1, 0.5, bodyMat, 0, 0.02, -0.16);        // body
    box(0.05, 0.13, 0.07, gun, 0, -0.09, -0.06);         // mag
    box(0.025, 0.025, 0.22, metal, 0, 0.03, -0.46);      // barrel
    box(0.06, 0.06, 0.14, black, 0, 0.02, 0.2);          // stock
    if (w && w.scoped) box(0.05, 0.05, 0.14, black, 0, 0.11, -0.05);
  }

  g.position.set(0.26, -0.26, -0.55);
  g.rotation.y = 0.02;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 999; o.material.depthTest = true; } });
  return g;
}

// ============================================================
//  WeaponController - local player weapon handling
// ============================================================
export class WeaponController {
  constructor(player, camera, scene, cb) {
    this.player = player;
    this.camera = camera;
    this.scene = scene;
    this.cb = cb; // { fireBullet, meleeAttack, throwGrenade, playSound, onScope }

    this.inv = createInventory(player.team);
    this.ammo = {}; // per weapon key runtime {clip,reserve}

    this.lastFire = 0;
    this.reloading = false;
    this.reloadEnd = 0;
    this.deployEnd = 0;
    this.shotIndex = 0;
    this.lastShotTime = 0;
    this.scope = 0; // sniper zoom stage
    this.vmodel = null;
    this.vmodelKey = null;

    this._recoilAnim = 0;
    this._vmBaseZ = -0.55;
    this._swayX = 0; this._swayY = 0;

    this.equip("pistol", true);
  }

  // ---------- inventory helpers ----------
  giveWeapon(key) {
    const w = WEAPONS[key];
    if (!w) return;
    const entry = { key, clip: w.mag, reserve: w.reserve };
    if (w.cat === "pistol") { this.inv.pistol = entry; this.equip("pistol"); }
    else { this.inv.primary = entry; this.equip("primary"); }
  }
  giveGrenade(key) {
    const count = this.inv.grenades.filter((g) => g === key).length;
    if (count >= (key === "flashbang" ? 2 : 1)) return false;
    if (this.inv.grenades.length >= 4) return false;
    this.inv.grenades.push(key);
    return true;
  }
  giveC4() { this.inv.c4 = true; }
  giveDefuse() { this.inv.hasDefuse = true; }

  currentEntry() {
    if (this.inv.current === "primary") return this.inv.primary;
    if (this.inv.current === "pistol") return this.inv.pistol;
    if (this.inv.current === "knife") return this.inv.knife;
    return null;
  }
  currentWeapon() { return currentWeaponData(this.inv); }

  equip(slot, instant = false) {
    if (slot === "primary" && !this.inv.primary) return;
    if (slot === "c4" && !this.inv.c4) return;
    if (slot === "grenade" && this.inv.grenades.length === 0) return;
    this.inv.current = slot;
    this.reloading = false;
    this.scope = 0;
    if (this.cb.onScope) this.cb.onScope(0, this.currentWeapon());
    this.shotIndex = 0;
    this.deployEnd = performance.now() / 1000 + (instant ? 0.15 : 0.4);
    this._buildViewModel();
  }

  cycleGrenade() {
    if (this.inv.grenades.length === 0) return;
    if (this.inv.current !== "grenade") { this.equip("grenade"); this.inv.grenadeIndex = 0; }
    else this.inv.grenadeIndex = (this.inv.grenadeIndex + 1) % this.inv.grenades.length;
    this._buildViewModel();
  }

  currentGrenade() {
    if (this.inv.current !== "grenade") return null;
    return this.inv.grenades[this.inv.grenadeIndex % this.inv.grenades.length];
  }

  _buildViewModel() {
    if (this.vmodel) { this.camera.remove(this.vmodel); this.vmodel = null; }
    let key = "knife";
    if (this.inv.current === "primary" && this.inv.primary) key = this.inv.primary.key;
    else if (this.inv.current === "pistol") key = this.inv.pistol.key;
    else if (this.inv.current === "knife") key = "knife";
    else if (this.inv.current === "grenade") key = "knife"; // small held item
    else if (this.inv.current === "c4") key = "knife";
    this.vmodelKey = key;
    this.vmodel = buildViewModel(key);
    if (this.inv.current === "grenade" || this.inv.current === "c4") {
      // show a small box as grenade/bomb
      this.vmodel = new THREE.Group();
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10),
        new THREE.MeshLambertMaterial({ color: this.inv.current === "c4" ? 0x883333 : 0x33502b }));
      m.position.set(0.24, -0.26, -0.5);
      this.vmodel.add(m);
    }
    this.camera.add(this.vmodel);
  }

  // ---------- main update ----------
  update(dt, input, now) {
    // weapon switching
    if (input.wasPressed("Digit1")) this.equip("primary");
    if (input.wasPressed("Digit2")) this.equip("pistol");
    if (input.wasPressed("Digit3")) this.equip("knife");
    if (input.wasPressed("Digit4")) this.cycleGrenade();
    if (input.wasPressed("Digit5")) this.equip("c4");
    if (input.mouse.wheel !== 0) this._scrollSwitch(input.mouse.wheel);

    const w = this.currentWeapon();
    const deploying = now < this.deployEnd;

    // reload
    if (this.reloading && now >= this.reloadEnd) this._finishReload();
    if (input.wasPressed("KeyR")) this._startReload(now);

    // scope (sniper / scoped rifle) on right click
    if (input.wasMousePressed(2)) this._toggleScope();

    // reset spray if gap
    if (now - this.lastShotTime > 0.35) this.shotIndex = 0;

    // firing
    if (!deploying && !this.reloading) {
      if (this.inv.current === "grenade") {
        if (input.wasMousePressed(0)) this._throwGrenade(now);
      } else if (this.inv.current === "c4") {
        // planting handled by game (hold E)
      } else if (w) {
        const wantFire = w.auto ? input.mouse.left : input.wasMousePressed(0);
        if (wantFire) this._tryFire(now, w);
      }
    }

    this._animateViewModel(dt);
  }

  _scrollSwitch(dir) {
    const order = [];
    if (this.inv.primary) order.push("primary");
    order.push("pistol", "knife");
    if (this.inv.grenades.length) order.push("grenade");
    if (this.inv.c4) order.push("c4");
    let idx = order.indexOf(this.inv.current);
    if (idx < 0) idx = 0;
    idx = (idx + (dir > 0 ? 1 : -1) + order.length) % order.length;
    if (order[idx] === "grenade") this.cycleGrenade();
    else this.equip(order[idx]);
  }

  _toggleScope() {
    const w = this.currentWeapon();
    if (!w) return;
    if (w.sniper && w.zoom) {
      this.scope = (this.scope + 1) % (w.zoom.length + 1);
    } else if (w.scoped) {
      this.scope = this.scope ? 0 : 1;
    } else return;
    if (this.cb.onScope) this.cb.onScope(this.scope, w);
  }

  _startReload(now) {
    if (this.inv.current !== "primary" && this.inv.current !== "pistol") return;
    const w = this.currentWeapon();
    const e = this.currentEntry();
    if (!w || !e) return;
    if (e.clip >= w.mag || e.reserve <= 0 || this.reloading) return;
    this.reloading = true;
    this.reloadEnd = now + w.reload;
    this.scope = 0;
    if (this.cb.onScope) this.cb.onScope(0, w);
    if (this.cb.playSound) this.cb.playSound("reload");
  }

  _finishReload() {
    this.reloading = false;
    const w = this.currentWeapon();
    const e = this.currentEntry();
    if (!w || !e) return;
    const need = w.mag - e.clip;
    const take = Math.min(need, e.reserve);
    e.clip += take;
    e.reserve -= take;
  }

  getInaccuracy(w) {
    let inacc = w.spread || 0.005;
    const speed = Math.hypot(this.player.vel.x, this.player.vel.z);
    const moveFrac = Math.min(1, speed / (w.moveSpeed || 6));
    inacc += (w.moveSpread || 0.05) * moveFrac;
    if (!this.player.onGround) inacc += 0.18;
    if (this.player.crouchAmt > 0.5) inacc *= 0.6;
    // scoped accuracy
    if ((w.sniper || w.scoped) && this.scope > 0 && this.player.onGround && speed < 0.6) {
      inacc = w.aimSpread != null ? w.aimSpread : inacc * 0.15;
    }
    // spray growth
    inacc += this.shotIndex * (w.spread || 0.005) * 0.15;
    return inacc;
  }

  _tryFire(now, w) {
    const e = this.currentEntry();
    if (this.inv.current === "knife") { this._melee(now); return; }
    if (!e) return;
    const interval = 60 / w.rpm;
    if (now - this.lastFire < interval) return;
    if (e.clip <= 0) {
      if (now - this.lastFire > 0.2) { if (this.cb.playSound) this.cb.playSound("empty"); this.lastFire = now; }
      this._startReload(now);
      return;
    }
    this.lastFire = now;
    this.lastShotTime = now;
    e.clip--;

    // spread & fire
    const origin = this.player.eyePosition;
    const pellets = w.pellets || 1;
    for (let p = 0; p < pellets; p++) {
      const dir = this._spreadDir(this.getInaccuracy(w));
      this.cb.fireBullet(origin, dir, w, this.player);
    }

    // recoil (view punch + spray pattern)
    this._applyRecoil(w);
    this.shotIndex++;

    // fx
    this._recoilAnim = 1;
    if (this.cb.playSound) this.cb.playSound("shoot", w);
    if (this.scope > 0 && w.sniper) { this.scope = 0; if (this.cb.onScope) this.cb.onScope(0, w); }
  }

  _spreadDir(inacc) {
    const fwd = this.player.getForward().clone();
    // build orthonormal basis
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(fwd, up).normalize();
    const realUp = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const a = Math.random() * Math.PI * 2;
    const rmag = Math.tan(inacc) * Math.sqrt(Math.random());
    const dir = fwd.clone()
      .addScaledVector(right, Math.cos(a) * rmag)
      .addScaledVector(realUp, Math.sin(a) * rmag)
      .normalize();
    return dir;
  }

  _applyRecoil(w) {
    const r = w.recoil || { up: 2, side: 1, mag: 1 };
    const i = this.shotIndex;
    const rampUp = 0.5 + 0.5 * Math.min(1, i / 5);
    const pitchKick = -0.006 * r.up * rampUp * r.mag;
    // horizontal spray pattern: drift right then left with noise
    let hpat = 0;
    if (i < 4) hpat = (Math.random() - 0.5) * 0.3;
    else if (i < 10) hpat = 0.6 + (Math.random() - 0.5) * 0.5;   // right
    else hpat = -0.5 + (Math.random() - 0.5) * 1.0;              // left/erratic
    const yawKick = -0.006 * r.side * hpat * r.mag;
    this.player.addRecoil(pitchKick, yawKick);
  }

  _melee(now) {
    if (now - this.lastFire < 0.4) return;
    this.lastFire = now;
    this._recoilAnim = 1;
    if (this.cb.meleeAttack) this.cb.meleeAttack(this.player, WEAPONS.knife);
    if (this.cb.playSound) this.cb.playSound("knife");
  }

  _throwGrenade(now) {
    if (now - this.lastFire < 0.6) return;
    this.lastFire = now;
    const key = this.currentGrenade();
    if (!key) return;
    const dir = this.player.getForward();
    if (this.cb.throwGrenade) this.cb.throwGrenade(this.player.eyePosition, dir, key, this.player);
    // remove one
    const idx = this.inv.grenades.indexOf(key);
    if (idx >= 0) this.inv.grenades.splice(idx, 1);
    if (this.inv.grenades.length === 0) this.equip("knife");
    else { this.inv.grenadeIndex = 0; this._buildViewModel(); }
    this._recoilAnim = 0.6;
  }

  _animateViewModel(dt) {
    if (!this.vmodel) return;
    // recoil kick recover
    this._recoilAnim *= Math.exp(-16 * dt);
    // sway from mouse (visual)
    const tx = -this.player.recoilYaw * 2;
    const ty = this.player.recoilPitch * 2;
    this._swayX += (tx - this._swayX) * Math.min(1, dt * 10);
    this._swayY += (ty - this._swayY) * Math.min(1, dt * 10);

    const scopeHidden = this.scope > 0;
    this.vmodel.visible = !scopeHidden;

    const kick = this._recoilAnim;
    this.vmodel.position.z = this._vmBaseZ + kick * 0.08;
    this.vmodel.position.x = 0.26 + this._swayX * 0.4;
    this.vmodel.position.y = -0.26 + this._swayY * 0.4 - kick * 0.02;
    this.vmodel.rotation.x = kick * 0.25;

    // reload spin
    if (this.reloading) {
      const w = this.currentWeapon();
      const e = this.currentEntry();
      const total = w ? w.reload : 1;
      const remaining = this.reloadEnd - performance.now() / 1000;
      const t = 1 - Math.max(0, Math.min(1, remaining / total));
      this.vmodel.rotation.z = Math.sin(t * Math.PI) * 0.6;
      this.vmodel.position.y = -0.26 - Math.sin(t * Math.PI) * 0.18;
    } else {
      this.vmodel.rotation.z = 0;
    }
  }

  // called by game to know deploy/fire state
  isBusy() { return performance.now() / 1000 < this.deployEnd || this.reloading; }
}
