// Player: locomotion (walk/run/sprint/jump/glide/climb/swim), 5-hit combos,
// charged attacks, plunge, dash i-frames, elemental skill + burst, party switching,
// stamina, lock-on, Paimon companion.
import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp, smoothstep, wrapAngle, ease } from '../core/utils.js';
import { height, normalAt, slopeAt, surfaceAt, WORLD } from '../world/heightfield.js';
import { ELEMENT_COLORS } from './fx.js';

/** Soft multiply-blended contact shadow: guarantees the hero reads as grounded even when
 *  the sun's shadow map is too coarse or the sun is near the zenith. */
function makeBlobShadowTexture(size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.00, 'rgb(126,132,120)');
  g.addColorStop(0.42, 'rgb(178,184,170)');
  g.addColorStop(0.76, 'rgb(232,236,226)');
  g.addColorStop(1.00, 'rgb(255,255,255)');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export const PARTY_DEFS = [
  { id: 'lumine', name: '荧', element: 'anemo', weapon: 'sword', maxHp: 1180, atk: 128, fallback: 'lumine',
    skill: { name: '风压剑', cd: 6.0, type: 'cone', radius: 5.6, angle: 130, dmg: 2.4, knock: 7.5, clip: 'skill' },
    burst: { name: '风息激流', cost: 80, type: 'field', radius: 5.6, dmg: 0.55, life: 3.4, tick: 0.28, clip: 'burst' } },
  { id: 'amber', name: '安柏', element: 'pyro', weapon: 'bow', maxHp: 980, atk: 116, fallback: 'amber',
    skill: { name: '爆弹玩偶', cd: 8.0, type: 'projectile', dmg: 2.8, aoe: 4.2, clip: 'skill' },
    burst: { name: '箭雨', cost: 80, type: 'rain', radius: 7.2, dmg: 0.42, life: 3.0, tick: 0.22, clip: 'burst' } },
  { id: 'kaeya', name: '凯亚', element: 'cryo', weapon: 'sword', maxHp: 1090, atk: 122, fallback: 'kaeya',
    skill: { name: '霜袭', cd: 6.5, type: 'cone', radius: 6.4, angle: 95, dmg: 2.6, knock: 3.0, clip: 'skill' },
    burst: { name: '凛冽轮舞', cost: 80, type: 'nova', radius: 7.0, dmg: 3.4, clip: 'burst' } },
  { id: 'lisa', name: '丽莎', element: 'electro', weapon: 'catalyst', maxHp: 940, atk: 134, fallback: 'jean',
    skill: { name: '指尖雷暴', cd: 5.5, type: 'aoe', radius: 4.6, dmg: 2.2, clip: 'skill' },
    burst: { name: '蔷薇的雷光', cost: 80, type: 'strikes', radius: 8.0, dmg: 0.9, life: 3.2, tick: 0.42, clip: 'burst' } },
];

const COMBOS = {
  sword: [
    { clip: 'attack1', dur: 0.44, chain: 0.17, cancel: 0.26, lunge: 3.2, dmg: 0.80, shape: 'cone', radius: 2.6, angle: 130, hitAt: 0.15, hitstop: 0.05, sfx: 'swing1' },
    { clip: 'attack2', dur: 0.40, chain: 0.15, cancel: 0.24, lunge: 2.6, dmg: 0.76, shape: 'cone', radius: 2.5, angle: 130, hitAt: 0.13, hitstop: 0.05, sfx: 'swing2' },
    { clip: 'attack3', dur: 0.56, chain: 0.24, cancel: 0.32, lunge: 4.0, dmg: 1.10, shape: 'cone', radius: 2.9, angle: 170, hitAt: 0.20, hitstop: 0.07, sfx: 'swing3', shake: 0.25 },
    { clip: 'attack4', dur: 0.38, chain: 0.14, cancel: 0.22, lunge: 2.2, dmg: 0.72, shape: 'cone', radius: 2.4, angle: 120, hitAt: 0.12, hitstop: 0.05, sfx: 'swing1' },
    { clip: 'attack5', dur: 0.72, chain: 0.40, cancel: 0.46, lunge: 4.6, dmg: 1.85, shape: 'sphere', radius: 3.3, angle: 360, hitAt: 0.24, hitstop: 0.10, sfx: 'swing3', knock: 5.5, shake: 0.7 },
  ],
  catalyst: [
    { clip: 'attack1', dur: 0.36, chain: 0.14, cancel: 0.22, lunge: 0.4, dmg: 0.62, ranged: true, element: true, sfx: 'swing1' },
    { clip: 'attack2', dur: 0.34, chain: 0.13, cancel: 0.20, lunge: 0.4, dmg: 0.60, ranged: true, element: true, sfx: 'swing2' },
    { clip: 'attack3', dur: 0.38, chain: 0.15, cancel: 0.22, lunge: 0.4, dmg: 0.66, ranged: true, element: true, sfx: 'swing1' },
    { clip: 'attack4', dur: 0.54, chain: 0.26, cancel: 0.32, lunge: 0.6, dmg: 1.15, ranged: true, element: true, sfx: 'swing3', shake: 0.2 },
  ],
  bow: [
    { clip: 'attack1', dur: 0.42, chain: 0.20, cancel: 0.24, lunge: 0.0, dmg: 0.55, ranged: true, sfx: 'bow_shot' },
    { clip: 'attack2', dur: 0.42, chain: 0.20, cancel: 0.24, lunge: 0.0, dmg: 0.55, ranged: true, sfx: 'bow_shot' },
  ],
};

const MOVE = {
  walk: 2.15, run: 4.9, sprint: 6.8, swim: 2.7, swimSprint: 4.7, climb: 2.15,
  gravity: 26, jump: 8.5, glideFall: 3.0, glideFwd: 10.5, glideAccel: 6,
  accel: 15, airAccel: 5.5, friction: 12,
};
// Reference ground speed each locomotion clip was authored for (stride length / clip duration).
// Playback is retimed to the real speed so the feet stop sliding.
const CLIP_REF = { walk: 1.62, run: 2.97, sprint: 3.38, swim: 1.6 };   // measured from the rig

const STAM = { max: 240, sprint: 15, climb: 8.5, glide: 5.0, swim: 13, dash: 20, regen: 26, regenDelay: 0.55 };

function placeholderCharacter(ctx, def) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xf0e6d8, roughness: 0.6 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xffdcc0, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.66, 6, 12), mat); body.position.y = 0.96; body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.235, 18, 14), skin); head.position.y = 1.56; head.castShadow = true;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({ color: 0xf3e6c8, roughness: .7 })); hair.position.y = 1.60;
  g.add(body, head, hair);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.44, 4, 8), skin);
    arm.position.set(0.29 * s, 1.02, 0); arm.castShadow = true; g.add(arm);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: 0x3a3f52, roughness: .8 }));
    leg.position.set(0.12 * s, 0.34, 0); leg.castShadow = true; g.add(leg);
  }
  const weaponBone = new THREE.Object3D(); weaponBone.position.set(0.34, 1.0, 0.05); g.add(weaponBone);
  return {
    root: g, height: 1.62, bones: {}, weaponBone, placeholder: true,
    anim: { play() {}, isPlaying: () => false, setSpeed() {}, time: 0 },
    setLook() {}, setBlink() {}, setExpression() {}, showWeapon() {}, setOutline() {},
    update(dt) {}, dispose() { g.removeFromParent(); },
  };
}

export class Player {
  constructor(ctx) {
    this.ctx = ctx;
    this.isPlayer = true;
    this.team = 'player';
    this.alive = true;
    this.root = new THREE.Group(); this.root.name = 'player';
    ctx.scene.add(this.root);
    this.position = this.root.position;
    this.velocity = new THREE.Vector3();
    this.facing = Math.PI;
    this.state = 'idle';
    this.prevState = 'idle';
    this.stateT = 0;
    this.grounded = true;
    this.stamina = STAM.max;
    this.staminaLock = 0;
    this.hitRadius = 0.42; this.hitHeight = 1.7; this.poise = 60;
    this.iframe = 0; this.hurtCd = 0;
    this.controlEnabled = true;
    this.buffer = { attack: 0, dash: 0, jump: 0, skill: 0, burst: 0 };
    this.action = null;
    this.comboIdx = 0; this.comboTimer = 0;
    this.charge = 0; this.charging = false;
    this.fields = [];
    this.lockOn = null;
    this.lastSafe = new THREE.Vector3();
    this.footT = 0;
    this.respawnPoint = new THREE.Vector3();
    this._v = new THREE.Vector3(); this._v2 = new THREE.Vector3(); this._q = new THREE.Quaternion();

    this.party = PARTY_DEFS.map(d => ({
      id: d.id, name: d.name, element: d.element, weapon: d.weapon, def: d,
      hp: d.maxHp, maxHp: d.maxHp, energy: 0, energyMax: d.burst.cost, skillCd: 0, character: null,
    }));
    this.activeIdx = 0;
    this._buildCharacters();
    this._buildBlob();
    this._buildGlider();
    this._buildPaimon();
    this.hasGlider = true;
  }

  // ---------------------------------------------------------------- setup
  _buildCharacters() {
    const ctx = this.ctx;
    for (const m of this.party) {
      let ch = null;
      if (ctx.characters?.createCharacter) {
        try { ch = ctx.characters.createCharacter(ctx, m.id, {}); }
        catch (e) {
          console.warn('[player] character', m.id, 'failed, trying fallback', e?.message);
          try { ch = ctx.characters.createCharacter(ctx, m.def.fallback, {}); } catch { ch = null; }
        }
      }
      if (!ch) ch = placeholderCharacter(ctx, m.def);
      // ground the hero: cast shadows from body meshes, skip inverted-hull outlines
      ch.root.traverse(o => {
        if (!o.isMesh && !o.isSkinnedMesh) return;
        const mat = Array.isArray(o.material) ? o.material[0] : o.material;
        const isOutline = mat && mat.side === THREE.BackSide;
        o.castShadow = !isOutline;
        o.receiveShadow = !isOutline;
      });
      m.character = ch;
      ch.root.visible = false;
      this.root.add(ch.root);
      if (m.weapon === 'sword' && ctx.characters?.makeSword && ch.weaponBone) {
        try { const sw = ctx.characters.makeSword(m.element); ch.weaponBone.add(sw); ch.sword = sw; } catch {}
      }
    }
    this.member = this.party[0];
    this.character = this.member.character;
    this.character.root.visible = true;
    this.maxHp = this.member.maxHp;
  }

  get hp() { return this.member.hp; }
  set hp(v) { this.member.hp = v; }

  _buildBlob() {
    const mat = new THREE.MeshBasicMaterial({
      map: makeBlobShadowTexture(), transparent: true, opacity: 0.85,
      blending: THREE.MultiplyBlending, depthWrite: false, fog: false, toneMapped: false,
    });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), mat);
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 2;
    this.blob.frustumCulled = false;
    this.ctx.scene.add(this.blob);
  }

  _updateBlob(dt) {
    const b = this.blob; if (!b) return;
    const gy = this.ctx.collision?.rayDown(this.position.x, this.position.z, this.position.y + 0.4)?.y ?? height(this.position.x, this.position.z);
    const air = clamp(this.position.y - gy, 0, 6);
    b.position.set(this.position.x, gy + 0.045, this.position.z);
    const n = normalAt(this.position.x, this.position.z, 1.0);
    b.rotation.set(-Math.PI / 2 + Math.atan2(n.z, n.y) * 0.9, 0, -Math.atan2(n.x, n.y) * 0.9);
    const k = 1 - smoothstep(0.2, 4.5, air);
    b.scale.setScalar((0.78 + air * 0.14) * (this.state === 'glide' ? 1.5 : 1));
    b.material.opacity = 0.40 * k;
    b.visible = k > 0.02 && this.state !== 'swim' && this.state !== 'swim_idle';
  }

  _buildGlider() {
    // Wind glider: two swept wings + a light frame, hidden until gliding.
    const g = new THREE.Group();
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0); wingShape.quadraticCurveTo(0.7, 0.36, 1.55, 0.12);
    wingShape.quadraticCurveTo(1.2, -0.16, 0.62, -0.30); wingShape.quadraticCurveTo(0.3, -0.2, 0, 0);
    const wg = new THREE.ShapeGeometry(wingShape, 12);
    const wm = new THREE.MeshStandardMaterial({ color: 0x9fe4d0, roughness: .5, metalness: .05,
      transparent: true, opacity: 0.92, side: THREE.DoubleSide, emissive: 0x2a6b5a, emissiveIntensity: .35 });
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(wg, wm);
      w.scale.set(s * 1.25, 1.25, 1); w.rotation.x = -0.24; w.position.set(0, 0, 0);
      w.castShadow = true; g.add(w);
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 1.85, 5),
        new THREE.MeshStandardMaterial({ color: 0x6b5138, roughness: .7 }));
      rib.rotation.z = Math.PI / 2 * s; rib.rotation.x = -0.24; rib.position.set(0.9 * s, 0.16, 0.02); g.add(rib);
    }
    g.position.set(0, 1.42, -0.16);
    g.visible = false;
    this.glider = g;
    this.root.add(g);
  }

  _buildPaimon() {
    const ctx = this.ctx;
    let p = null;
    if (ctx.characters?.createCharacter) {
      try { p = ctx.characters.createCharacter(ctx, 'paimon', { scale: 1 }); } catch { p = null; }
    }
    if (!p) return;
    p.root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!(m && m.side === THREE.BackSide)) o.castShadow = true; } });
    this.paimon = p;
    ctx.scene.add(p.root);
    p.root.position.copy(this.position);
    this.paimonPos = new THREE.Vector3();
    try { p.anim.play('idle', { loop: true }); } catch {}
  }

  // ---------------------------------------------------------------- helpers
  center(out = new THREE.Vector3()) { return out.set(this.position.x, this.position.y + 0.95, this.position.z); }
  get forward() { return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)); }

  _clip(name, opts) {
    const speed = opts?.speed ?? 1;
    if (this._curClip === name && opts?.force !== true) {
      // same clip: never re-trigger play() (that restarts the cross-fade and looks like a twitch);
      // just retime it so the cycle matches ground speed instead of sliding.
      if (Math.abs((this._curSpeed ?? 1) - speed) > 0.02) {
        this._curSpeed = speed;
        try { this.character.anim.setSpeed(speed); } catch {}
      }
      return;
    }
    this._curClip = name;
    this._curSpeed = speed;
    try { this.character.anim.setSpeed(speed); } catch {}
    try { this.character.anim.play(name, { fade: 0.16, loop: true, ...opts, speed }); } catch (e) {}
  }

  setControlEnabled(v) { this.controlEnabled = v; }
  faceTo(v3) { this.facing = Math.atan2(v3.x - this.position.x, v3.z - this.position.z); }
  teleport(x, z) {
    this.position.set(x, height(x, z) + 0.05, z);
    this.velocity.set(0, 0, 0);
    this.ctx.terrain?.preload(x, z, 2);
    this._setState('idle');
  }
  gainEnergy(a) {
    for (const m of this.party) m.energy = Math.min(m.energyMax, m.energy + (m === this.member ? a : a * 0.35));
  }

  switchMember(i) {
    if (i === this.activeIdx || i < 0 || i >= this.party.length) return;
    if (this.action && this.action.locked) return;
    const old = this.member;
    old.character.root.visible = false;
    this.activeIdx = i;
    this.member = this.party[i];
    this.character = this.member.character;
    this.character.root.visible = true;
    this.character.root.rotation.y = 0;
    this.maxHp = this.member.maxHp;
    this._curClip = null;
    this.comboIdx = 0;
    const c = this.center(this._v);
    this.ctx.fx3d?.burst(c, this.member.element, 0.6);
    this.ctx.fx3d?.ring(this.position, ELEMENT_COLORS[this.member.element], 2.6, 0.4);
    this.ctx.audio?.sfx?.('ui_confirm');
    this.ctx.events.emit('player:switch', { member: this.member, index: i });
    this.ctx.ui?.hud?.setActive?.(i);
  }

  // ---------------------------------------------------------------- damage
  takeDamage(info) {
    if (!this.alive || this.iframe > 0 || this.hurtCd > 0) return;
    const amt = Math.max(1, Math.round(info.amount ?? 10));
    this.member.hp = Math.max(0, this.member.hp - amt);
    this.hurtCd = 0.34;
    this.ctx.fx.uHit.value = 1;
    this.ctx.fx3d?.shake(0.85, 0.24);
    this.ctx.audio?.sfx?.('hit_flesh');
    this.ctx.events.emit('player:damaged', { amount: amt });
    if (info.dir) this.velocity.addScaledVector(info.dir, (info.knockback ?? 2) * 0.9);
    if (this.member.hp <= 0) this._die();
    else if ((info.poise ?? 20) > 34 && this.grounded) this._setState('hit');
  }
  heal(a) { this.member.hp = Math.min(this.member.maxHp, this.member.hp + a); }

  _die() {
    this.alive = false;
    this._setState('dead');
    this._clip('death', { loop: false });
    this.ctx.events.emit('player:died');
    this.ctx.ui?.subtitle?.('你被击败了…', 2600);
    this.ctx.audio?.sfx?.('death');
    setTimeout(() => this._respawn(), 3200);
  }
  _respawn() {
    this.alive = true;
    for (const m of this.party) m.hp = Math.max(m.maxHp * 0.5, m.hp);
    const p = this.respawnPoint.lengthSq() > 1 ? this.respawnPoint : this.lastSafe;
    this.position.copy(p); this.position.y = height(p.x, p.z) + 0.1;
    this.velocity.set(0, 0, 0);
    this.stamina = STAM.max;
    this._setState('idle');
    this.ctx.ui?.fade?.(0, 700);
  }

  _setState(s) {
    if (this.state === s) return;
    this.prevState = this.state;
    this.state = s;
    this.stateT = 0;
  }

  // ---------------------------------------------------------------- actions
  _startAction(a) {
    this.action = { t: 0, ...a };
    this._setState(a.state ?? 'attack');
    this._clip(a.clip, { loop: false, fade: a.fade ?? 0.08, speed: a.speed ?? 1, force: true });
    if (a.sfx) this.ctx.audio?.sfx?.(a.sfx, { rate: 0.94 + Math.random() * 0.12 });
  }

  _attack() {
    const w = this.member.weapon;
    const combo = COMBOS[w] ?? COMBOS.sword;
    const idx = this.comboTimer > 0 ? (this.comboIdx % combo.length) : 0;
    const step = combo[idx];
    this.comboIdx = idx + 1;
    this.comboTimer = 0;
    this._startAction({
      kind: 'attack', step, clip: step.clip, dur: step.dur, locked: true,
      lunge: step.lunge, hitDone: false, sfx: step.sfx, state: 'attack',
    });
    if (this.character.sword) this._swordTrail(step.dur);
    this.ctx.camera3?.kick?.(1.6);
  }

  _swordTrail(dur) {
    if (!this.character.sword) return;
    const t = this.ctx.fx3d?.trail(this.character.sword, { color: ELEMENT_COLORS[this.member.element], width: 0.3, segments: 12 });
    if (t) setTimeout(() => t.stop(), dur * 900);
  }

  _chargedAttack() {
    const w = this.member.weapon;
    if (w === 'bow') {
      const full = this.charge > 1.05;
      const dir = this._aimDir(this._v2);
      const origin = this.center(this._v).addScaledVector(dir, 0.6);
      this.ctx.combat.spawnProjectile({
        origin: origin.clone(), dir, speed: full ? 78 : 52, damage: this.member.def.atk * (full ? 2.4 : 1.1),
        element: full ? this.member.element : 'physical', team: 'player', source: this, radius: 0.5,
        aoe: full ? 1.8 : 0, life: 2.6, trail: true, trailWidth: full ? 0.14 : 0.08,
      });
      this._startAction({ kind: 'charge_release', clip: 'charge_release', dur: 0.42, locked: true, state: 'attack', sfx: 'bow_shot' });
      this.ctx.camera3?.kick?.(full ? 4 : 2);
      if (full) this.ctx.fx3d?.shake(0.35, 0.14);
    } else if (w === 'catalyst') {
      const dir = this._aimDir(this._v2);
      this.ctx.combat.spawnProjectile({
        origin: this.center(this._v).addScaledVector(dir, 0.7).clone(), dir, speed: 34,
        damage: this.member.def.atk * 1.9, element: this.member.element, team: 'player', source: this,
        radius: 0.7, aoe: 3.4, life: 2.4, gravity: 3,
      });
      this._startAction({ kind: 'charge_release', clip: 'charge_release', dur: 0.5, locked: true, state: 'attack' });
    } else {
      // sword: spinning slash, two hits
      this._startAction({
        kind: 'charge_spin', clip: 'charge_release', dur: 0.66, locked: true, state: 'attack', lunge: 3.4,
        step: { dmg: 1.5, shape: 'sphere', radius: 3.0, hitAt: 0.16, hitstop: 0.07, knock: 3.4, shake: 0.4, sfx: 'swing3' },
        hitDone: false, secondAt: 0.42, secondDone: false,
      });
      this._swordTrail(0.7);
    }
    this.charge = 0; this.charging = false;
  }

  _aimDir(out) {
    const cam = this.ctx.camera;
    cam.getWorldDirection(out);
    if (this.lockOn && this.lockOn.alive !== false) {
      const c = this.lockOn.center ? this.lockOn.center(new THREE.Vector3()) : this.lockOn.root.position;
      out.copy(c).sub(this.center(new THREE.Vector3())).normalize();
    }
    return out.normalize();
  }

  _plunge() {
    this._startAction({ kind: 'plunge', clip: 'plunge', dur: 4, locked: true, state: 'plunge' });
    this.velocity.set(this.velocity.x * 0.35, -24, this.velocity.z * 0.35);
  }

  _dash() {
    if (this.stamina < STAM.dash) { this.ctx.ui?.hud?.flashStamina?.(); return; }
    this.stamina -= STAM.dash; this.staminaLock = STAM.regenDelay;
    const ax = this.ctx.input.moveAxis();
    let dir;
    if (ax.len > 0.1) dir = this._camRelative(ax, this._v2).normalize();
    else dir = this._v2.set(Math.sin(this.facing), 0, Math.cos(this.facing));
    this.facing = Math.atan2(dir.x, dir.z);
    this.velocity.x = dir.x * 15.5; this.velocity.z = dir.z * 15.5;
    this.iframe = 0.28;
    this._startAction({ kind: 'dash', clip: 'dash', dur: 0.36, locked: true, state: 'dash', sfx: 'jump' });
    this.ctx.fx.uRadial.value = 1.0;
    this.ctx.fx3d?.dust(this.position, 8);
    this.ctx.audio?.sfx?.('glide_open', { vol: 0.4, rate: 1.5 });
  }

  _skill() {
    const m = this.member;
    if (m.skillCd > 0) return;
    const sk = m.def.skill;
    m.skillCd = sk.cd;
    const dir = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    const origin = this.center(new THREE.Vector3());
    this._startAction({ kind: 'skill', clip: sk.clip, dur: 0.62, locked: true, state: 'skill' });
    this.ctx.audio?.sfx?.(m.element === 'anemo' ? 'skill_anemo' : m.element === 'pyro' ? 'skill_pyro' : 'skill_anemo');
    const dmg = m.def.atk * sk.dmg;
    const el = m.element;
    setTimeout(() => {
      if (sk.type === 'cone') {
        this.ctx.combat.strike({ origin, dir, shape: 'cone', radius: sk.radius, angle: sk.angle, team: 'player',
          damage: dmg, element: el, knockback: sk.knock ?? 3, hitstop: 0.08, shake: 0.5, source: this, poise: 45 });
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.facing, 0));
        this.ctx.fx3d?.slash(origin.clone().addScaledVector(dir, 1.2), q, { radius: sk.radius * 0.75, color: ELEMENT_COLORS[el], life: 0.34 });
        for (let i = 0; i < 3; i++) this.ctx.fx3d?.elementTrail(origin.clone().addScaledVector(dir, 1 + i), el, 6);
      } else if (sk.type === 'aoe') {
        this.ctx.combat.strike({ origin, dir, shape: 'sphere', radius: sk.radius, team: 'player', damage: dmg,
          element: el, knockback: 2, hitstop: 0.08, shake: 0.55, source: this, poise: 40 });
        this.ctx.fx3d?.burst(this.position.clone(), el, 1.3);
      } else if (sk.type === 'projectile') {
        const d = this._aimDir(new THREE.Vector3());
        this.ctx.combat.spawnProjectile({ origin: this.center(new THREE.Vector3()).addScaledVector(d, 0.6),
          dir: d, speed: 22, damage: dmg, element: el, team: 'player', source: this, radius: 0.55,
          aoe: sk.aoe ?? 3.5, life: 3.5, gravity: 9 });
      }
      this.ctx.fx3d?.ring(this.position.clone(), ELEMENT_COLORS[el], sk.radius ?? 4, 0.5);
    }, 170);
    this.ctx.events.emit('player:skill', { element: el, member: m });
  }

  _burst() {
    const m = this.member;
    if (m.energy < m.energyMax) return;
    m.energy = 0;
    const b = m.def.burst;
    const el = m.element;
    this._startAction({ kind: 'burst', clip: b.clip, dur: 1.15, locked: true, state: 'burst', invuln: 0.9 });
    this.iframe = Math.max(this.iframe, 0.95);
    this.ctx.audio?.sfx?.('burst');
    this.ctx.fx.uRadial.value = 1.4;
    this.ctx.fx3d?.shake(1.1, 0.4);
    const center = this.position.clone();
    setTimeout(() => {
      this.ctx.fx3d?.burst(this.center(new THREE.Vector3()), el, 2.4);
      this.ctx.fx3d?.ring(center, ELEMENT_COLORS[el], b.radius ?? 6, 0.75);
      if (b.type === 'nova') {
        this.ctx.combat.strike({ origin: this.center(new THREE.Vector3()), shape: 'sphere', radius: b.radius,
          team: 'player', damage: m.def.atk * b.dmg, element: el, knockback: 6, hitstop: 0.14, shake: 1.0, source: this, poise: 90 });
      } else {
        this.fields.push({ pos: center.clone(), radius: b.radius, element: el, dmg: m.def.atk * b.dmg,
          life: b.life, tick: b.tick, t: 0, type: b.type, follow: b.type === 'field' });
      }
    }, 420);
    this.ctx.events.emit('player:burst', { element: el, member: m });
  }

  _camRelative(ax, out) {
    const yaw = this.ctx.camera3?.yaw ?? 0;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    return out.set(fx * ax.y + fz * ax.x, 0, fz * ax.y - fx * ax.x);
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const ctx = this.ctx, input = ctx.input;
    this.stateT += dt;
    this.hurtCd = Math.max(0, this.hurtCd - dt);
    this.iframe = Math.max(0, this.iframe - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    for (const m of this.party) m.skillCd = Math.max(0, m.skillCd - dt);
    ctx.fx.uHit.value = Math.max(0, ctx.fx.uHit.value - dt * 3.2);
    ctx.fx.uRadial.value = Math.max(0, ctx.fx.uRadial.value - dt * 3.6);
    for (const k in this.buffer) this.buffer[k] = Math.max(0, this.buffer[k] - dt);

    if (!this.alive) { this._updateVisuals(dt); return; }

    const ctrl = this.controlEnabled && !ctx.paused && !ctx.dialogueOpen;
    // ------- read input into buffers -------
    if (ctrl) {
      if (input.mouse.leftPressed) this.buffer.attack = 0.28;
      if (input.justPressed('jump')) this.buffer.jump = 0.22;
      if (input.justPressed('skill')) this.buffer.skill = 0.3;
      if (input.justPressed('burst')) this.buffer.burst = 0.3;
      if (input.mouse.rightPressed) this.buffer.dash = 0.25;
      for (let i = 0; i < 4; i++) if (input.justPressed('party' + (i + 1))) this.switchMember(i);
      if (input.justPressed('lockon')) this._toggleLock();
    }

    const wet = ctx.water ? ctx.water.depthAt(this.position.x, this.position.z) : -1;
    const gy = ctx.collision?.rayDown(this.position.x, this.position.z, this.position.y + 0.6)?.y ?? height(this.position.x, this.position.z);
    const deepWater = wet > 1.25;

    // ------- state transitions -------
    this._actionJustEnded = false;
    if (this.action) {
      this._updateAction(dt, ctrl);
      // resume locomotion immediately on the frame the action releases control
      if (this._actionJustEnded && !this.action) {
        const wet2 = ctx.water ? ctx.water.depthAt(this.position.x, this.position.z) : -1;
        this._updateGround(dt, ctrl, gy, wet2 > 1.25);
      }
    }
    else if (this.state === 'hit') { if (this.stateT > 0.34) this._setState('idle'); }
    else if (this.state === 'climb') this._updateClimb(dt, ctrl, gy);
    else if (deepWater && this.state !== 'glide') this._updateSwim(dt, ctrl, wet);
    else this._updateGround(dt, ctrl, gy, deepWater);

    // ------- integrate -------
    this._integrate(dt, gy, deepWater);
    this._updateFields(dt);
    this._updateVisuals(dt);
    this._updateStamina(dt);

    if (this.grounded && !deepWater) this.lastSafe.copy(this.position);
    if (this.position.y < -60) { this.position.copy(this.lastSafe); this.velocity.set(0, 0, 0); }
  }

  _toggleLock() {
    if (this.lockOn) { this.lockOn = null; this.ctx.camera3?.setLockTarget(null); this.ctx.ui?.hud?.setLockOn?.(0, 0, false); return; }
    const list = this.ctx.enemies?.enemies ?? [];
    let best = null, bestScore = Infinity;
    const fwd = this.ctx.camera.getWorldDirection(this._v2);
    for (const e of list) {
      if (e.alive === false) continue;
      const c = e.center ? e.center(this._v) : this._v.copy(e.root.position);
      const to = c.clone().sub(this.position);
      const d = to.length();
      if (d > 28) continue;
      const dot = to.normalize().dot(fwd);
      if (dot < 0.15) continue;
      const score = d * (1.4 - dot);
      if (score < bestScore) { bestScore = score; best = e; }
    }
    this.lockOn = best;
    this.ctx.camera3?.setLockTarget(best);
    if (best) this.ctx.audio?.sfx?.('ui_hover');
  }

  _updateAction(dt, ctrl) {
    const a = this.action;
    a.t += dt;
    const step = a.step;

    if (a.kind === 'attack' || a.kind === 'charge_spin') {
      const k = a.t / a.dur;
      if (a.lunge) {
        const push = a.lunge * Math.exp(-a.t * 9);
        this.velocity.x = Math.sin(this.facing) * push * 2.2;
        this.velocity.z = Math.cos(this.facing) * push * 2.2;
      }
      if (step && !a.hitDone && a.t >= (step.hitAt ?? 0.15)) {
        a.hitDone = true;
        this._doMeleeHit(step);
      }
      if (a.kind === 'charge_spin' && !a.secondDone && a.t >= a.secondAt) {
        a.secondDone = true; this._doMeleeHit({ ...step, dmg: step.dmg * 0.8 });
      }
      if (step?.ranged && !a.shotDone && a.t >= 0.12) {
        a.shotDone = true;
        const dir = this._aimDir(this._v2);
        this.ctx.combat.spawnProjectile({
          origin: this.center(this._v).addScaledVector(dir, 0.6).clone(), dir,
          speed: this.member.weapon === 'bow' ? 62 : 30,
          damage: this.member.def.atk * step.dmg,
          element: step.element ? this.member.element : 'physical',
          team: 'player', source: this, radius: 0.45, life: 2.4,
        });
        this.ctx.audio?.sfx?.(this.member.weapon === 'bow' ? 'bow_shot' : 'swing1');
      }
      // chain into the next combo step
      if (ctrl && this.buffer.attack > 0 && a.t > a.dur - (step?.chain ?? 0.16)) {
        this.buffer.attack = 0; this.comboTimer = 0.5;
        this.action = null; this._attack(); return;
      }
      if (ctrl && this.buffer.dash > 0 && a.t > (step?.cancel ?? 0.24)) { this.buffer.dash = 0; this.action = null; this._dash(); return; }
      if (ctrl && this.buffer.skill > 0 && a.t > (step?.cancel ?? 0.24)) { this.buffer.skill = 0; this.action = null; this._skill(); return; }
    } else if (a.kind === 'plunge') {
      this.velocity.y = -26;
      const gy = height(this.position.x, this.position.z);
      if (this.position.y <= gy + 0.12) {
        this.action = null;
        this._setState('idle');
        this._clip('plunge_land', { loop: false, force: true });
        this.ctx.combat.strike({ origin: this.position.clone(), shape: 'sphere', radius: 4.0, team: 'player',
          damage: this.member.def.atk * 1.6, element: 'physical', knockback: 5.5, hitstop: 0.12, shake: 1.0, source: this, poise: 70 });
        this.ctx.fx3d?.ring(this.position.clone(), 0xffe6b0, 5.2, 0.55);
        this.ctx.fx3d?.dust(this.position, 22);
        this.ctx.audio?.sfx?.('land', { vol: 1.2 });
        return;
      }
    }

    if (a.t >= a.dur) {
      this.action = null;
      if (a.kind === 'attack' || a.kind === 'charge_spin') this.comboTimer = 0.55;
      this._actionJustEnded = true;
    }
  }

  _doMeleeHit(step) {
    const dir = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
    const origin = this.center(new THREE.Vector3()).addScaledVector(dir, 0.7);
    const hits = this.ctx.combat.strike({
      origin, dir, shape: step.shape ?? 'cone', radius: step.radius ?? 2.5, angle: step.angle ?? 130,
      team: 'player', damage: this.member.def.atk * (step.dmg ?? 1), element: 'physical',
      knockback: step.knock ?? 1.8, hitstop: step.hitstop ?? 0.05, shake: step.shake ?? 0.15,
      source: this, poise: 26,
    });
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5 + Math.random(), this.facing, 0));
    this.ctx.fx3d?.slash(origin, q, { radius: (step.radius ?? 2.5) * 0.8, color: 0xf6faff, life: 0.2 });
    if (!hits.length) this.ctx.audio?.sfx?.(step.sfx ?? 'swing1', { rate: 1 + Math.random() * 0.1 });
  }

  _updateGround(dt, ctrl, gy, deepWater) {
    const ctx = this.ctx, input = ctx.input;
    const dist = this.position.y - gy;
    this.grounded = dist <= 0.14 && this.velocity.y <= 0.1;

    if (ctrl) {
      if (this.buffer.burst > 0) { this.buffer.burst = 0; this._burst(); return; }
      if (this.buffer.skill > 0) { this.buffer.skill = 0; this._skill(); return; }
      if (this.buffer.dash > 0 && this.grounded) { this.buffer.dash = 0; this._dash(); return; }

      // charged attack: hold the button
      if (input.mouse.left && this.grounded && !this.charging && input.mouse.leftHeldTime > 0.26) {
        this.charging = true; this.charge = 0;
        this._clip('charge_loop', { loop: true, force: true });
        if (this.member.weapon === 'bow') { ctx.camera3.mode = 'aim'; ctx.audio?.sfx?.('bow_charge'); }
      }
      if (this.charging) {
        this.charge += dt;
        this.stamina -= (this.member.weapon === 'bow' ? 0 : 8) * dt;
        if (!input.mouse.left) { ctx.camera3.mode = 'follow'; this._chargedAttack(); return; }
        this.buffer.attack = 0;
      } else if (this.buffer.attack > 0) {
        this.buffer.attack = 0;
        if (!this.grounded && dist > 1.6) { this._plunge(); return; }
        this._attack(); return;
      }

      if (this.buffer.jump > 0) {
        if (this.grounded) {
          this.buffer.jump = 0;
          this.velocity.y = MOVE.jump;
          this.grounded = false;
          this._setState('jump');
          this._clip('jump', { loop: false, force: true });
          ctx.audio?.sfx?.('jump');
          ctx.fx3d?.dust(this.position, 5);
        } else if (this.hasGlider && (dist > 1.0 || this.velocity.y < -1.0) && this.velocity.y < 2.0 && this.stamina > 6) {
          this.buffer.jump = 0;
          this._setState('glide');
          ctx.audio?.sfx?.('glide_open');
        }
      }
    }

    if (this.state === 'glide') { this._updateGlide(dt, ctrl, gy); return; }

    // climbing: press into a steep wall
    const ax = ctrl ? input.moveAxis() : { x: 0, y: 0, len: 0 };
    const wish = this._camRelative(ax, this._v2);
    if (ctrl && ax.len > 0.4 && this.stamina > 12) {
      const wall = ctx.collision?.wallAhead(this.position, wish.clone().normalize(), 0.45);
      if (wall && (this.grounded || this.state === 'fall')) {
        this._setState('climb');
        this.climbNormal = wall.normal.clone();
        this.velocity.set(0, 0, 0);
        this._clip('climb_idle', { loop: true, force: true });
        return;
      }
    }

    // horizontal movement
    let speed = 0;
    if (ax.len > 0.05) {
      const onFoot = this.grounded || (this._coyote ?? 0) > 0;
      const sprinting = ctrl && input.isDown('sprint') && this.stamina > 1 && onFoot;
      speed = input.isDown('walk') ? MOVE.walk : sprinting ? MOVE.sprint : MOVE.run * clamp(ax.len * 1.35, 0, 1);
      if (sprinting) { this.stamina -= STAM.sprint * dt; this.staminaLock = STAM.regenDelay; }
      const dir = wish.normalize();
      const targetYaw = Math.atan2(dir.x, dir.z);
      this.facing = dampAngle(this.facing, targetYaw, this.grounded ? 14 : 7, dt);
      const acc = this.grounded ? MOVE.accel : MOVE.airAccel;
      this.velocity.x = damp(this.velocity.x, dir.x * speed, acc, dt);
      this.velocity.z = damp(this.velocity.z, dir.z * speed, acc, dt);
      // drive the locomotion state from input intent (stable) rather than measured velocity (noisy)
      if (onFoot) this._setState(sprinting ? 'sprint' : input.isDown('walk') ? 'walk' : 'run');
    } else if (this.grounded) {
      this.velocity.x = damp(this.velocity.x, 0, MOVE.friction, dt);
      this.velocity.z = damp(this.velocity.z, 0, MOVE.friction, dt);
      this._setState('idle');
    }
    // only treat it as falling after real airtime; bumps in the terrain must not flicker the clip
    if (this.grounded) this._airT = 0;
    else this._airT = (this._airT ?? 0) + dt;
    const reallyAirborne = (this._airT ?? 0) > 0.18 || this.velocity.y < -7;
    if (reallyAirborne && this.state !== 'jump' && this.state !== 'glide') this._setState('fall');
    else if (!reallyAirborne && this.state === 'fall' && (this.grounded || (this._coyote ?? 0) > 0)) this._setState(ax.len > 0.05 ? 'run' : 'idle');
    if (this.lockOn && this.lockOn.alive !== false && this.grounded && ax.len < 0.05) {
      const c = this.lockOn.center ? this.lockOn.center(this._v) : this._v.copy(this.lockOn.root.position);
      this.facing = dampAngle(this.facing, Math.atan2(c.x - this.position.x, c.z - this.position.z), 8, dt);
    }
  }

  _updateGlide(dt, ctrl, gy) {
    const input = this.ctx.input;
    this.stamina -= STAM.glide * dt; this.staminaLock = STAM.regenDelay;
    const ax = ctrl ? input.moveAxis() : { x: 0, y: 0, len: 0 };
    const wish = this._camRelative(ax, this._v2);
    let fall = MOVE.glideFall;
    // wind currents (registered by puzzles)
    for (const w of (this.ctx.windFields ?? [])) {
      const d = Math.hypot(this.position.x - w.x, this.position.z - w.z);
      if (d < w.radius && this.position.y < (w.top ?? 999)) { this.velocity.y = Math.max(this.velocity.y, w.strength ?? 12); fall = 0; }
    }
    this.velocity.y = damp(this.velocity.y, -fall, 3.4, dt);
    const fwd = this._v.set(Math.sin(this.facing), 0, Math.cos(this.facing));
    let target = MOVE.glideFwd * 0.55;
    if (ax.len > 0.1) {
      const dir = wish.normalize();
      this.facing = dampAngle(this.facing, Math.atan2(dir.x, dir.z), 3.4, dt);
      target = MOVE.glideFwd * (ax.y > 0 ? 1 : 0.7);
    }
    this.velocity.x = damp(this.velocity.x, fwd.x * target, MOVE.glideAccel, dt);
    this.velocity.z = damp(this.velocity.z, fwd.z * target, MOVE.glideAccel, dt);
    if (this.stamina <= 0 || this.position.y - gy < 0.3 || (this.ctx.water && this.ctx.water.depthAt(this.position.x, this.position.z) > 0.5 && this.position.y < 0.6)) {
      this._setState(this.position.y - gy < 0.35 ? 'idle' : 'fall');
      this.ctx.fx3d?.dust(this.position, 6);
    }
  }

  _updateClimb(dt, ctrl, gy) {
    const input = this.ctx.input;
    const ax = ctrl ? input.moveAxis() : { x: 0, y: 0, len: 0 };
    this.stamina -= (ax.len > 0.1 ? STAM.climb : STAM.climb * 0.25) * dt;
    this.staminaLock = STAM.regenDelay;
    const n = this.climbNormal ?? new THREE.Vector3(0, 0, 1);
    const right = this._v.set(-n.z, 0, n.x).normalize();
    this.velocity.set(0, 0, 0);
    if (ax.len > 0.05) {
      const up = ax.y * MOVE.climb, side = ax.x * MOVE.climb * 0.75;
      this.position.y += up * dt;
      this.position.addScaledVector(right, side * dt);
      this.position.addScaledVector(n, -0.25 * dt);
      this._clip('climb', { loop: true });
    } else this._clip('climb_idle', { loop: true });
    this.facing = Math.atan2(-n.x, -n.z);
    // reached the top?
    const ahead = this._v2.set(this.position.x - n.x * 0.6, 0, this.position.z - n.z * 0.6);
    const topY = height(ahead.x, ahead.z);
    if (topY < this.position.y + 0.35) {
      this.position.x = ahead.x; this.position.z = ahead.z;
      this.position.y = Math.max(this.position.y, topY) + 0.05;
      this._setState('idle');
      return;
    }
    if (this.stamina <= 0 || (ctrl && input.justPressed('jump'))) {
      this._setState('fall');
      this.velocity.addScaledVector(n, 3.2); this.velocity.y = 3.0;
    }
    const gh = height(this.position.x, this.position.z);
    if (this.position.y <= gh + 0.1) { this.position.y = gh; this._setState('idle'); }
  }

  _updateSwim(dt, ctrl, depth) {
    const input = this.ctx.input;
    const level = WORLD.waterLevel;
    this.position.y = damp(this.position.y, level - 0.42, 9, dt);
    this.velocity.y = 0;
    const ax = ctrl ? input.moveAxis() : { x: 0, y: 0, len: 0 };
    const sprint = ctrl && input.isDown('sprint') && this.stamina > 1;
    if (ax.len > 0.05) {
      const dir = this._camRelative(ax, this._v2).normalize();
      this.facing = dampAngle(this.facing, Math.atan2(dir.x, dir.z), 7, dt);
      const s = sprint ? MOVE.swimSprint : MOVE.swim;
      if (sprint) { this.stamina -= STAM.swim * dt; this.staminaLock = STAM.regenDelay; }
      this.velocity.x = damp(this.velocity.x, dir.x * s, 6, dt);
      this.velocity.z = damp(this.velocity.z, dir.z * s, 6, dt);
      this._setState('swim');
    } else {
      this.velocity.x = damp(this.velocity.x, 0, 4, dt);
      this.velocity.z = damp(this.velocity.z, 0, 4, dt);
      this._setState('swim_idle');
    }
    this.grounded = false;
    if (this.stamina <= 0) { this.member.hp -= 24 * dt; this.ctx.fx.uHit.value = 0.5; }
  }

  _integrate(dt, gy, deepWater) {
    this._coyote = Math.max(0, (this._coyote ?? 0));
    const p = this.position;
    if (this.state !== 'climb' && !deepWater) {
      const airborne = !this.grounded;
      if (airborne || this.state === 'glide') {
        if (this.state !== 'glide') this.velocity.y -= MOVE.gravity * dt;
      }
    }
    p.x += this.velocity.x * dt;
    p.z += this.velocity.z * dt;
    if (this.state !== 'climb' && !deepWater) p.y += this.velocity.y * dt;

    // world bounds
    const r = Math.hypot(p.x, p.z);
    if (r > WORLD.half - 20) { const s = (WORLD.half - 20) / r; p.x *= s; p.z *= s; }

    this.ctx.collision?.resolve(p, 0.4, 1.75);

    const ground = this.ctx.collision?.rayDown(p.x, p.z, p.y + 0.5)?.y ?? height(p.x, p.z);
    if (!deepWater && this.state !== 'climb') {
      if (p.y <= ground) {
        const impact = -this.velocity.y;
        p.y = ground;
        if (!this.grounded && impact > 2) {
          this.ctx.events.emit('player:land', { pos: p.clone(), force: impact });
          if (impact > 9) { this.ctx.fx3d?.dust(p, 12); this.ctx.fx3d?.shake(clamp(impact / 30, 0, 0.5), 0.14); }
          this.ctx.audio?.sfx?.('land', { vol: clamp(impact / 14, 0.2, 1) });
          if (this.state === 'fall' || this.state === 'jump') { this._setState('idle'); this._clip('land', { loop: false, force: true }); }
        }
        this.velocity.y = 0;
        this.grounded = true;
      } else if (p.y > ground + 0.16) {
        // snap back down on gentle descents instead of going airborne every bump
        if (this.velocity.y <= 0.5 && p.y - ground < 0.55) { p.y = ground; this.velocity.y = 0; this.grounded = true; this._coyote = 0.12; }
        else if ((this._coyote = (this._coyote ?? 0) - dt) > 0) this.grounded = true;
        else this.grounded = false;
      } else this._coyote = 0.12;
    }
  }

  _updateFields(dt) {
    for (let i = this.fields.length - 1; i >= 0; i--) {
      const f = this.fields[i];
      f.life -= dt; f.t -= dt;
      if (f.follow) f.pos.lerp(this.position, 0.06);
      if (f.t <= 0) {
        f.t = f.tick;
        if (f.type === 'strikes') {
          const a = Math.random() * Math.PI * 2, r = Math.random() * f.radius;
          const pos = f.pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
          pos.y = height(pos.x, pos.z);
          this.ctx.fx3d?.beam(pos.clone().add(new THREE.Vector3(0, 14, 0)), pos, ELEMENT_COLORS[f.element], 0.16, 0.24);
          this.ctx.fx3d?.hitSpark(pos, ELEMENT_COLORS[f.element], 1.1);
          this.ctx.combat.strike({ origin: pos, shape: 'sphere', radius: 2.4, team: 'player', damage: f.dmg,
            element: f.element, hitstop: 0.03, source: this, knockback: 1.2 });
        } else if (f.type === 'rain') {
          for (let k = 0; k < 3; k++) {
            const a = Math.random() * Math.PI * 2, r = Math.random() * f.radius;
            const pos = f.pos.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
            pos.y = height(pos.x, pos.z);
            this.ctx.combat.spawnProjectile({ origin: pos.clone().add(new THREE.Vector3(0, 12, 0)),
              dir: new THREE.Vector3(0, -1, 0), speed: 34, damage: f.dmg, element: f.element, team: 'player',
              source: this, radius: 0.6, aoe: 1.6, life: 1.2, trail: false });
          }
        } else {
          this.ctx.combat.strike({ origin: f.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), shape: 'sphere',
            radius: f.radius, team: 'player', damage: f.dmg, element: f.element, hitstop: 0.02,
            knockback: f.element === 'anemo' ? -1.6 : 0.6, source: this });
          this.ctx.fx3d?.elementTrail(f.pos.clone().add(new THREE.Vector3((Math.random() - .5) * f.radius, 0.5, (Math.random() - .5) * f.radius)), f.element, 4);
        }
      }
      if (f.life <= 0) this.fields.splice(i, 1);
    }
  }

  _updateStamina(dt) {
    this.staminaLock = Math.max(0, this.staminaLock - dt);
    if (this.staminaLock <= 0 && this.state !== 'glide' && this.state !== 'climb')
      this.stamina = Math.min(STAM.max, this.stamina + STAM.regen * dt);
    this.stamina = clamp(this.stamina, 0, STAM.max);
    this.staminaMax = STAM.max;
  }

  _updateVisuals(dt) {
    const ch = this.character;
    this.root.rotation.y = dampAngle(this.root.rotation.y, this.facing, 18, dt);
    // clip selection for locomotion states (actions set their own clip)
    if (!this.action && this.alive) {
      const spd = Math.hypot(this.velocity.x, this.velocity.z);
      switch (this.state) {
        case 'idle': {
          if ((this.ctx.enemies?.aggroCount ?? 0) > 0) this._combatIdleT = 3.5;
          else this._combatIdleT = Math.max(0, (this._combatIdleT ?? 0) - dt);
          this._clip(this._combatIdleT > 0 ? 'idle_combat' : 'idle');
          break;
        }
        case 'walk': this._clip('walk', { speed: clamp(spd / CLIP_REF.walk, 0.55, 2.0) }); break;
        case 'run': this._clip('run', { speed: clamp(spd / CLIP_REF.run, 0.60, 2.1) }); break;
        case 'sprint': this._clip('sprint', { speed: clamp(spd / CLIP_REF.sprint, 0.75, 2.35) }); break;
        case 'jump': this._clip('jump', { loop: false }); break;
        case 'fall': this._clip('fall'); break;
        case 'glide': this._clip('glide'); break;
        case 'swim': this._clip('swim', { speed: clamp(spd / CLIP_REF.swim, 0.6, 1.8) }); break;
        case 'swim_idle': this._clip('swim_idle'); break;
        case 'hit': this._clip('hit', { loop: false }); break;
      }
    }
    this._updateBlob(dt);
    this.glider.visible = this.state === 'glide';
    if (this.glider.visible) {
      this.glider.rotation.z = Math.sin(this.ctx.time.elapsed * 2.2) * 0.05;
      this.glider.position.y = 1.42 + Math.sin(this.ctx.time.elapsed * 3) * 0.03;
    }
    if (!ch._outlineSet) { ch._outlineSet = true; ch.setOutline?.(true); }
    try { ch.update(dt); } catch (e) { if (!this._chWarn) { console.warn('[character.update]', e); this._chWarn = 1; } }

    // footsteps
    const moving = (this.state === 'walk' || this.state === 'run' || this.state === 'sprint') && this.grounded;
    if (moving) {
      const spd = Math.hypot(this.velocity.x, this.velocity.z);
      this.footT -= dt * spd * 0.42;
      if (this.footT <= 0) {
        this.footT = 1;
        const s = surfaceAt(this.position.x, this.position.z);
        const name = s === 'rock' || s === 'snow' ? 'footstep_stone' : s === 'water' || s === 'sand' ? 'footstep_water' : 'footstep_grass';
        this.ctx.audio?.sfx?.(name, { vol: 0.5, rate: 0.9 + Math.random() * 0.2 });
        if (spd > 6) this.ctx.fx3d?.dust(this.position, 2);
      }
    }

    // Paimon follows
    if (this.paimon) {
      const t = this.ctx.time.elapsed;
      const side = this._v.set(Math.cos(this.root.rotation.y), 0, -Math.sin(this.root.rotation.y));
      const want = this._v2.copy(this.position).addScaledVector(side, 0.95)
        .add(this._v.set(0, 1.35 + Math.sin(t * 1.6) * 0.09, 0))
        .addScaledVector(this.forward, -0.35);
      this.paimon.root.position.lerp(want, 1 - Math.exp(-4.5 * dt));
      this.paimon.root.rotation.y = dampAngle(this.paimon.root.rotation.y, this.root.rotation.y + 0.25, 5, dt);
      try { this.paimon.update(dt); } catch {}
    }
  }
}
