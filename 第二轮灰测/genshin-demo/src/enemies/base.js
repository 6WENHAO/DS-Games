// Enemy base class: hit contract (CONTRACT 2.3), state machine, poise/stagger,
// knockback, hitstop, telegraphed attacks, death dissolve, HP-bar anchor.
import * as THREE from 'three';
import { clamp, lerp, damp, wrapAngle, smoothstep, makeRNG, TAU, DEG } from '../core/utils.js';
import { height as worldHeight, normalAt } from '../world/heightfield.js';
import {
  ELEMENT_HEX, elementHex, buildRig, sectorGeometry, makeTelegraphMaterial,
  markTexture, quadGeo,
} from './rigid.js';

const UP = new THREE.Vector3(0, 1, 0);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3(), _v5 = new THREE.Vector3();
const _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

// shared HP-bar resources (module level, per CONTRACT 6)
let _hpGeo = null, _hpFillGeo = null, _hpMatBg = null, _hpMatFill = null, _markMat = null;
function hpResources() {
  if (!_hpGeo) {
    _hpGeo = new THREE.PlaneGeometry(1, 0.11);
    _hpFillGeo = new THREE.PlaneGeometry(1, 0.075);
    _hpFillGeo.translate(0.5, 0, 0);
    _hpMatBg = new THREE.MeshBasicMaterial({ color: 0x140d09, transparent: true, opacity: 0.62, depthTest: false, depthWrite: false });
    _hpMatFill = new THREE.MeshBasicMaterial({ color: 0xff6a4d, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
  }
  return { bg: _hpGeo, fill: _hpFillGeo, matBg: _hpMatBg, matFill: _hpMatFill };
}
function markMaterial() {
  if (!_markMat) _markMat = new THREE.SpriteMaterial({ map: markTexture('!'), transparent: true, depthTest: false, depthWrite: false });
  return _markMat;
}

let _uid = 0;

/**
 * Base monster. Subclasses build a rig in their constructor and declare
 * this.attacks = { key: { anim, dur, cooldown, range, telegraph, hits:[{t,fn}], move } }.
 */
export class Enemy {
  constructor(ctx, opts = {}) {
    this.ctx = ctx;
    this.uid = ++_uid;
    this.type = opts.type ?? 'enemy';
    this.displayName = opts.name ?? this.type;
    this.level = opts.level ?? 20;
    this.elementType = opts.element ?? 'physical';
    this.team = 'enemy';
    this.alive = true;
    this.removed = false;
    this.isBoss = !!opts.isBoss;
    this.armored = !!opts.armored;

    this.maxHp = opts.hp ?? 240;
    this.hp = this.maxHp;
    this.maxPoise = opts.poise ?? 40;
    this.poise = this.maxPoise;
    this.hitRadius = opts.hitRadius ?? 0.6;
    this.hitHeight = opts.hitHeight ?? 1.7;
    /** Metres from root origin (= foot level) to the top of the head. UI/markers use this. */
    this.headOffset = opts.headOffset ?? (this.hitHeight + 0.05);
    this.damage = opts.damage ?? 16;

    this.rng = makeRNG(opts.seed ?? (0x9e3779b9 ^ (this.uid * 2654435761)) >>> 0);

    this.root = new THREE.Group();
    this.root.name = 'enemy_' + this.type + '_' + this.uid;
    this.pos = this.root.position;
    this.home = new THREE.Vector3();
    this.wp = new THREE.Vector3();

    this.mv = new THREE.Vector3();     // steering velocity (xz)
    this.kb = new THREE.Vector3();     // knockback velocity (xz)
    this.wish = new THREE.Vector3();   // desired velocity, written by the AI
    this.tPos = new THREE.Vector3();
    this.dirToTarget = new THREE.Vector3(0, 0, 1);

    this.yaw = opts.yaw ?? 0;
    this.yawTarget = this.yaw;
    this.yawVel = 0;
    this.yOffset = 0;                  // hop / jump height above ground
    this.vy = 0;
    this.airborne = false;
    this.flying = false;
    this.altitude = 0;

    this.state = 'idle';
    this.stateT = 0;
    this.age = 0;
    this.aggro = false;      // derived from state (manager reads this)
    this.engaged = false;    // true once the monster has actually acquired a target
    this.asleep = false;
    this.distToTarget = Infinity;
    this.target = null;

    this.attacks = {};
    this.atkCd = 0.8 + this.rng() * 1.4;
    this.curAttack = null;
    this.atkKey = null;
    this.atkT = 0;
    this.atkHitIdx = 0;
    this.hasToken = false;
    this.comboCount = 0;

    this._hitstop = 0;
    this._staggerT = 0;
    this._deathT = 0;
    this._dissolving = false;
    this._idleTime = 1.5 + this.rng() * 3;
    this._hpBarT = 0;
    this._markT = 0;
    this._lodT = 0;
    this._ownMats = [];

    this.cfg = {
      walkSpeed: 1.5, chaseSpeed: 3.2, strafeSpeed: 1.3, accel: 9,
      turnRate: 3.4, aggroRange: 15, loseRange: 36, alertTime: 0.7,
      attackRange: 2.2, keepDist: 2.2, patrolRadius: 9,
      groundAlign: 0.35, kbDamp: 6.5, mass: 1, sleepRange: 120,
      outlineRange: 45, hpBarRange: 46, poiseRegen: 0.22,
      strafeDir: this.rng() < 0.5 ? 1 : -1,
      canPatrol: true,
      ...(opts.cfg ?? {}),
    };

    if (opts.pos) this.setPosition(opts.pos.x, opts.pos.z, opts.pos.y);
    ctx.scene?.add(this.root);
  }

  // ------------------------------------------------------------ setup
  setPosition(x, z, y) {
    this.pos.set(x, y ?? (this.groundY(x, z) + (this.cfg.groundOffset ?? 0)), z);
    this.home.copy(this.pos);
    this.wp.copy(this.pos);
    return this;
  }

  /** Attach a rig definition (see rigid.js#defineRig). */
  setupRig(def, opts = {}) {
    const inst = buildRig(def, opts);
    this.rigInst = inst;
    this.rigRoot = inst.root;
    this.bones = inst.bones;
    this.meshes = inst.meshes;
    this.outlines = inst.outlines;
    this.rig = inst.rig;
    this.root.add(inst.root);
    this.hpAnchor = new THREE.Object3D();
    this.hpAnchor.position.set(0, this.headOffset + 0.3, 0);
    this.root.add(this.hpAnchor);
    if (this.rig.has('idle')) this.rig.play('idle', { fade: 0 });
    return inst;
  }

  bone(name) { return this.bones?.get(name); }

  /** Update the head marker height (metres above the feet) after rescaling a rig. */
  setHeadOffset(v) {
    this.headOffset = v;
    if (this.hpAnchor) this.hpAnchor.position.y = v + 0.3;
    return this;
  }

  // ------------------------------------------------------------ CONTRACT 2.3
  center(out = _v1) {
    return out.set(this.pos.x, this.pos.y + this.hitHeight * 0.5, this.pos.z);
  }

  /** World position of the floating HP bar / status anchor. */
  hudAnchor(out = _v1) {
    if (this.hpAnchor) return this.hpAnchor.getWorldPosition(out);
    return out.set(this.pos.x, this.pos.y + this.hitHeight + 0.3, this.pos.z);
  }

  takeDamage(info = {}) {
    if (!this.alive || this.removed) return 0;
    let amount = info.amount ?? info.damage ?? 0;
    let blocked = false, weak = false;

    if (this.onIncomingDamage) {
      const r = this.onIncomingDamage(info, amount);
      if (r) {
        if (r.amount != null) amount = r.amount;
        blocked = !!r.blocked;
      }
    }
    if (this.weakPoint && (info.weak === true || this._hitNearWeak(info))) {
      weak = true;
      amount *= this.weakPoint.mult ?? 2;
    }
    amount = Math.max(1, Math.round(amount));
    this.hp = Math.max(0, this.hp - amount);
    this._hpBarT = 4.0;

    const c = this.center(_v2);
    const hex = weak ? 0xffe066 : elementHex(info.element);
    this.ctx.fx3d?.hitSpark?.(c, hex, weak ? 1.6 : (blocked ? 0.7 : 1));
    this.ctx.fx3d?.damageNumber?.(c, amount, { crit: !!info.crit || weak, element: info.element });
    this.ctx.audio?.sfx?.(this.armored ? 'hit_metal' : 'hit_flesh', { pos: this.pos, vol: blocked ? 0.6 : 1 });
    if (weak) this.ctx.audio?.sfx?.('crit', { pos: this.pos });

    // hitstop freezes this monster for a beat: the core of the "3A" impact feel
    this._hitstop = Math.max(this._hitstop, blocked ? 0.03 : (info.hitstop ?? 0.055));

    if (!blocked) {
      const kb = (info.knockback ?? 2) / Math.max(0.4, this.cfg.mass);
      if (info.dir && kb > 0.01) {
        _v3.set(info.dir.x, 0, info.dir.z);
        if (_v3.lengthSq() > 1e-6) this.kb.addScaledVector(_v3.normalize(), kb * 2.4);
      }
      this.poise -= (info.poise ?? 12) * (weak ? 2.5 : 1);
      // a clean weak-point hit always breaks the stance (ruin guard topples)
      if (weak && this.weakPoint?.topple !== false) this.poise = 0;
    }

    if (this.state === 'idle' || this.state === 'patrol' || this.state === 'return' || this.state === 'hidden') {
      this.target = this._resolveTarget();
      this._alertFast = true;
      this.setState('alert');
    }

    if (this.hp <= 0) { this.die(info); return amount; }

    if (this.poise <= 0 && this.state !== 'stagger') {
      this.poise = this.maxPoise;
      this.stagger(weak ? (this.cfg.toppleTime ?? 2.6) : (info.staggerTime ?? 0.6), weak);
    }
    this.ctx.events?.emit?.('enemy:hurt', { enemy: this, amount, element: info.element, weak });
    return amount;
  }

  _hitNearWeak(info) {
    const wp = this.weakPoint;
    if (!wp?.obj) return false;
    const p = info.hitPos ?? info.point ?? info.origin;
    if (!p) return false;
    wp.obj.getWorldPosition(_v4);
    return _v4.distanceTo(p) <= (wp.radius ?? 0.6) + 0.35;
  }

  // ------------------------------------------------------------ states
  setState(s) {
    if (this.state === s) return;
    this.onExitState?.(this.state, s);
    this.prevState = this.state;
    this.state = s;
    this.stateT = 0;
    this.aggro = s === 'alert' || s === 'chase' || s === 'combat' || s === 'attack'
      || (s === 'stagger' && this.prevState !== 'hidden');
    this.onEnterState?.(s, this.prevState);
    this._onEnter(s);
  }

  _onEnter(s) {
    switch (s) {
      case 'idle':
        this._idleTime = 1.4 + this.rng() * 3.4;
        this.rig?.play(this.engaged ? (this.rig.has('idle_combat') ? 'idle_combat' : 'idle') : 'idle', { fade: 0.2 });
        break;
      case 'alert': {
        this.engaged = true;
        this.showMark();
        this.ctx.audio?.sfx?.('enemy_alert', { pos: this.pos });
        this.ctx.events?.emit?.('enemy:aggro', { enemy: this });
        this.rig?.play(this.rig.has('alert') ? 'alert' : (this.rig.has('idle_combat') ? 'idle_combat' : 'idle'), { fade: 0.1 });
        break;
      }
      case 'stagger':
        this.hideTelegraph();
        this.releaseToken();
        break;
      case 'dead':
        this.hideTelegraph();
        this.releaseToken();
        break;
    }
  }

  stagger(time = 0.6, topple = false) {
    if (!this.alive) return;
    this.curAttack = null;
    this._staggerT = time;
    this.mv.multiplyScalar(0.25);
    this.setState('stagger');
    const clip = topple && this.rig?.has('topple') ? 'topple' : 'hit';
    this.rig?.play(clip, { fade: 0.05, loop: false, restart: true });
  }

  die(info = {}) {
    if (!this.alive) return;
    this.alive = false;
    this.hp = 0;
    this.aggro = false;
    this.curAttack = null;
    this.setState('dead');
    this._deathT = 0;
    this.deathAnimTime = this.deathAnimTime ?? 1.15;
    this.dissolveTime = this.dissolveTime ?? 1.0;
    this.rig?.play('death', { fade: 0.06, loop: false, restart: true });
    if (this._mark) this._mark.visible = false;
    if (this._hpBar) this._hpBar.visible = false;
    const c = this.center(_v2).clone();
    this.ctx.fx3d?.dust?.(this.pos, 10, 0x8a7a5a);
    this.ctx.audio?.sfx?.(this.deathSfx ?? 'death', { pos: this.pos });
    this.onDie?.(info);
    this.ctx.events?.emit?.('enemy:died', { enemy: this, type: this.type, pos: c });
  }

  // ------------------------------------------------------------ attack driver
  requestToken() {
    if (this.hasToken) return true;
    const m = this.manager;
    if (!m) { this.hasToken = true; return true; }
    if (m.requestAttackToken(this)) { this.hasToken = true; return true; }
    return false;
  }
  releaseToken() {
    if (!this.hasToken) return;
    this.hasToken = false;
    this.manager?.releaseAttackToken(this);
  }

  pickAttack() {
    const keys = Object.keys(this.attacks);
    if (!keys.length) return null;
    let total = 0;
    const usable = [];
    for (const k of keys) {
      const a = this.attacks[k];
      if (a.disabled?.(this)) continue;
      const min = a.minRange ?? 0;
      const max = a.range ?? this.cfg.attackRange;
      if (this.distToTarget < min || this.distToTarget > max) continue;
      const w = a.weight ?? 1;
      usable.push([k, w]);
      total += w;
    }
    if (!usable.length) return null;
    let r = this.rng() * total;
    for (const [k, w] of usable) { r -= w; if (r <= 0) return k; }
    return usable[0][0];
  }

  startAttack(key) {
    const a = this.attacks[key];
    if (!a) return false;
    this.curAttack = a;
    this.atkKey = key;
    this.atkT = 0;
    this.atkHitIdx = 0;
    this.setState('attack');
    this.rig?.play(a.anim ?? 'attack1', { fade: a.fade ?? 0.08, speed: a.animSpeed ?? 1, loop: false, restart: true });
    if (a.telegraph) this.showTelegraph(a.telegraph);
    if (a.sfx) this.ctx.audio?.sfx?.(a.sfx, { pos: this.pos });
    a.onStart?.(this);
    return true;
  }

  _stAttack(dt) {
    const a = this.curAttack;
    if (!a) { this.setState('combat'); return; }
    const prev = this.atkT;
    this.atkT += dt;
    const t = this.atkT;

    if (t < (a.faceLock ?? 0.3) && this.target) this.faceTarget(dt, this.cfg.turnRate * 1.6);
    else if (a.faceWhile) this.faceTarget(dt, this.cfg.turnRate * 0.4);

    this.wish.set(0, 0, 0);
    a.move?.(this, t, dt, prev);

    if (a.telegraph) {
      const tw = a.telegraph.time ?? (a.hits?.[0]?.t ?? 0.5);
      if (t <= tw + 0.12) this.updateTelegraph(clamp(t / Math.max(0.01, tw), 0, 1));
      else this.hideTelegraph();
    }
    if (a.hits) {
      while (this.atkHitIdx < a.hits.length && t >= a.hits[this.atkHitIdx].t) {
        const h = a.hits[this.atkHitIdx++];
        try { h.fn(this); } catch (e) { console.error('[enemy attack]', e); }
      }
    }
    if (t >= (a.dur ?? 1)) {
      this.hideTelegraph();
      const chain = a.next && this.comboCount < (a.maxCombo ?? 1)
        && this.target && this.distToTarget < (a.chainRange ?? this.cfg.attackRange + 0.8)
        && this.rng() < (a.chainChance ?? 0.55);
      if (chain) {
        this.comboCount++;
        this.startAttack(a.next);
        return;
      }
      this.comboCount = 0;
      this.releaseToken();
      this.atkCd = (a.cooldown ?? 2.2) * (0.85 + this.rng() * 0.4);
      this.setState(this.engaged ? 'combat' : 'idle');
    }
  }

  /** CONTRACT 2.3 - deal damage to the player through ctx.combat (with a dev fallback). */
  strike(o = {}) {
    const dir = o.dir ? _v3.copy(o.dir) : this.forward(_v3);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    dir.normalize();
    const origin = _v4.copy(o.origin ?? this.pos);
    if (!o.origin) {
      origin.addScaledVector(dir, o.offset ?? 1.1);
      origin.y = this.pos.y + (o.y ?? this.hitHeight * 0.5);
    }
    const info = {
      origin: origin.clone(), dir: dir.clone(),
      shape: o.shape ?? 'sphere', radius: o.radius ?? 1.8,
      angle: o.angle ?? 100, halfExtents: o.halfExtents,
      team: 'enemy', damage: Math.round(o.damage ?? this.damage),
      element: o.element ?? 'physical', poise: o.poise ?? 18,
      knockback: o.knockback ?? 3.0, hitstop: o.hitstop ?? 0.06,
      crit: !!o.crit, source: this, once: o.once !== false,
      onHit: o.onHit,
    };
    if (this.ctx.combat?.strike) { this.ctx.combat.strike(info); return; }
    this._fallbackStrike(info);
  }

  _fallbackStrike(info) {
    const t = this.target;
    if (!t || t.alive === false || !t.takeDamage) return;
    if (t.center) t.center(_v5); else _v5.copy(t.position ?? t.root?.position ?? _v5.set(0, 0, 0));
    const reach = info.radius + (t.hitRadius ?? 0.5);
    if (_v5.distanceTo(info.origin) > reach) return;
    if (info.shape === 'cone') {
      _v2.copy(_v5).sub(info.origin).setY(0);
      if (_v2.lengthSq() > 1e-6 && _v2.normalize().dot(info.dir) < Math.cos(info.angle * 0.5 * DEG)) return;
    }
    t.takeDamage({
      amount: info.damage, element: info.element, crit: info.crit,
      dir: info.dir, source: this, knockback: info.knockback,
      poise: info.poise, hitstop: info.hitstop,
    });
    this.ctx.fx3d?.hitSpark?.(_v5, elementHex(info.element), 1);
    this.ctx.events?.emit?.('combat:hit', { target: t, info });
  }

  // ------------------------------------------------------------ telegraph
  showTelegraph(t) {
    const isCircle = t.kind === 'circle';
    const angle = isCircle ? 360 : (t.angle ?? 90);
    if (!this._tele) {
      this._tele = new THREE.Mesh(sectorGeometry(angle), makeTelegraphMaterial(t.color ?? 0xff4a3a));
      this._tele.frustumCulled = false;
      this._tele.renderOrder = 4;
      this.ctx.scene?.add(this._tele);
    } else {
      this._tele.geometry = sectorGeometry(angle);
    }
    const u = this._tele.material.uniforms;
    u.uColor.value.set(t.color ?? (t.element ? elementHex(t.element) : 0xff4a3a));
    u.uSide.value = isCircle ? 0 : 1;
    u.uFill.value = 0;
    u.uAlpha.value = t.alpha ?? 1;
    this._teleRadius = t.radius ?? 3;
    this._teleAt = t.at ? new THREE.Vector3().copy(t.at) : null;
    this._teleFollow = t.follow !== false && !t.at;
    this._tele.scale.setScalar(this._teleRadius);
    this._tele.visible = true;
    this.updateTelegraph(0);
  }

  updateTelegraph(fill) {
    const m = this._tele;
    if (!m || !m.visible) return;
    m.material.uniforms.uFill.value = fill;
    m.material.uniforms.uTime.value = this.ctx.time?.elapsed ?? this.age;
    const p = this._teleAt ?? this.pos;
    m.position.set(p.x, this.groundY(p.x, p.z) + 0.07, p.z);
    if (this._teleFollow) m.rotation.y = this.yaw;
  }

  hideTelegraph() { if (this._tele) this._tele.visible = false; }

  // ------------------------------------------------------------ marks / hp bar
  showMark(time = 1.1) {
    if (!this._mark) {
      this._mark = new THREE.Sprite(markMaterial());
      this._mark.renderOrder = 998;
      this.ctx.scene?.add(this._mark);
    }
    this._markT = time;
    this._mark.visible = true;
  }

  _updateOverlays(dt) {
    const cam = this.ctx.camera;
    if (this._markT > 0) {
      this._markT -= dt;
      const m = this._mark;
      const k = clamp((1.1 - this._markT) * 7, 0, 1);
      const s = (0.34 + 0.12 * Math.sin(this.age * 12)) * (0.4 + 0.6 * smoothstep(0, 1, k));
      m.scale.set(s, s * 1.35, s);
      this.hudAnchor(_v1);
      m.position.set(_v1.x, _v1.y + 0.42, _v1.z);
      if (this._markT <= 0) m.visible = false;
    }
    if (this._hpBarT > 0) this._hpBarT -= dt;
    const wantBar = this.alive && (this.manager?.showHpBars !== false)
      && (this._hpBarT > 0 || (this.aggro && this.hp < this.maxHp))
      && this.distToCamera < this.cfg.hpBarRange;
    if (wantBar) {
      if (!this._hpBar) {
        const R = hpResources();
        const g = new THREE.Group();
        const w = clamp(this.hitRadius * 2.0, 0.7, 2.6);
        const bg = new THREE.Mesh(R.bg, R.matBg);
        bg.scale.set(w, 1, 1);
        const fill = new THREE.Mesh(R.fill, R.matFill);
        fill.position.x = -w * 0.5;
        fill.scale.set(w, 1, 1);
        g.add(bg, fill);
        g.renderOrder = 997;
        bg.renderOrder = 997; fill.renderOrder = 998;
        this._hpBar = g; this._hpFill = fill; this._hpW = w;
        this.ctx.scene?.add(g);
      }
      this._hpBar.visible = true;
      this.hudAnchor(_v1);
      this._hpBar.position.set(_v1.x, _v1.y, _v1.z);
      if (cam) this._hpBar.quaternion.copy(cam.quaternion);
      this._hpFill.scale.x = this._hpW * clamp(this.hp / this.maxHp, 0, 1);
    } else if (this._hpBar) this._hpBar.visible = false;
  }

  // ------------------------------------------------------------ helpers
  groundY(x, z) {
    const t = this.ctx.terrain;
    if (t && typeof t.heightAt === 'function') return t.heightAt(x, z);
    return worldHeight(x, z);
  }

  forward(out = _v1) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  faceTarget(dt, rate) {
    if (!this.target) return;
    this.yawTarget = Math.atan2(this.dirToTarget.x, this.dirToTarget.z);
  }
  faceMove() {
    if (this.wish.lengthSq() > 0.04) this.yawTarget = Math.atan2(this.wish.x, this.wish.z);
  }

  /** Steering toward a world point; writes this.wish. */
  steerTo(p, speed) {
    _v1.set(p.x - this.pos.x, 0, p.z - this.pos.z);
    const d = _v1.length();
    if (d < 1e-4) { this.wish.set(0, 0, 0); return 0; }
    _v1.multiplyScalar(1 / d);
    this.wish.copy(_v1).multiplyScalar(speed);
    return d;
  }

  _resolveTarget() {
    const p = this.ctx.player;
    if (p && p.alive !== false) return p;
    const h = this.ctx.hero;
    if (h) return { root: h, position: h.position, team: 'player', hitRadius: 0.4, hitHeight: 1.8 };
    return null;
  }

  _canAggro() {
    if (!this.target) return false;
    return this.distToTarget < this.cfg.aggroRange;
  }

  _pickPatrol() {
    if (!this.cfg.canPatrol) { this._idleTime = 2 + this.rng() * 3; this.stateT = 0; return; }
    const a = this.rng() * TAU, r = 2 + this.rng() * this.cfg.patrolRadius;
    this.wp.set(this.home.x + Math.cos(a) * r, 0, this.home.z + Math.sin(a) * r);
    this.wp.y = this.groundY(this.wp.x, this.wp.z);
    this.setState('patrol');
  }

  // ------------------------------------------------------------ main update
  update(dt) {
    if (this.removed) return;
    this.age += dt;
    this.distToCamera = this.ctx.camera ? this.ctx.camera.position.distanceTo(this.pos) : 0;

    if (this.state === 'dead') { this._updateDeath(dt); return; }

    this._sense(dt);

    if (this._hitstop > 0) {
      this._hitstop -= dt;
      this._updateOverlays(dt);
      this.onFrozen?.(dt);
      return;
    }

    this.stateT += dt;
    if (this.poise < this.maxPoise && this.state !== 'stagger') {
      this.poise = Math.min(this.maxPoise, this.poise + this.maxPoise * this.cfg.poiseRegen * dt);
    }
    this._ai(dt);
    this._move(dt);
    this.rig?.update(dt * (this.animScale ?? 1));
    this.onUpdate?.(dt);
    this._updateOverlays(dt);
    if (this._tele?.visible) this.updateTelegraph(this._tele.material.uniforms.uFill.value);

    this._lodT -= dt;
    if (this._lodT <= 0) {
      this._lodT = 0.35;
      const showOutline = this.distToCamera < this.cfg.outlineRange;
      if (this._outlineOn !== showOutline) {
        this._outlineOn = showOutline;
        this.rigInst?.setOutline?.(showOutline);
      }
    }
  }

  _sense() {
    this.target = this._resolveTarget();
    const t = this.target;
    if (!t) { this.distToTarget = Infinity; return; }
    const tp = t.position ?? t.root?.position;
    if (!tp) { this.distToTarget = Infinity; return; }
    this.tPos.copy(tp);
    const dx = tp.x - this.pos.x, dz = tp.z - this.pos.z;
    this.distToTarget = Math.hypot(dx, dz);
    if (this.distToTarget > 1e-4) this.dirToTarget.set(dx / this.distToTarget, 0, dz / this.distToTarget);
  }

  _ai(dt) {
    if (this.onState?.(this.state, dt)) return;
    const cfg = this.cfg;
    switch (this.state) {
      case 'idle': {
        this.wish.set(0, 0, 0);
        this.rig?.play(this.engaged && this.rig.has('idle_combat') ? 'idle_combat' : 'idle', { fade: 0.25 });
        if (this._canAggro()) { this.setState('alert'); break; }
        if (this.stateT > this._idleTime) this._pickPatrol();
        break;
      }
      case 'patrol': {
        if (this._canAggro()) { this.setState('alert'); break; }
        const d = this.steerTo(this.wp, cfg.walkSpeed);
        this.faceMove();
        this.rig?.play('walk', { fade: 0.22, speed: 1 });
        if (d < 1.1 || this.stateT > 14) this.setState('idle');
        break;
      }
      case 'alert': {
        this.wish.set(0, 0, 0);
        this.faceTarget(dt);
        if (this.stateT > (this._alertFast ? 0.18 : cfg.alertTime)) {
          this._alertFast = false;
          this.setState('chase');
        }
        break;
      }
      case 'chase': {
        if (!this.target || this.distToTarget > cfg.loseRange) { this.setState('return'); break; }
        this.steerTo(this.tPos, cfg.chaseSpeed);
        this.faceTarget(dt);
        this.rig?.play(this.rig.has('run') ? 'run' : 'walk', { fade: 0.2 });
        if (this.distToTarget < cfg.keepDist + 0.5) this.setState('combat');
        break;
      }
      case 'combat': this._stCombat(dt); break;
      case 'attack': this._stAttack(dt); break;
      case 'stagger': {
        this.wish.set(0, 0, 0);
        this._staggerT -= dt;
        if (this._staggerT <= 0) {
          if (this.rig?.has('getup') && this.rig.isPlaying('topple')) {
            this._staggerT = 0.9;
            this.rig.play('getup', { fade: 0.1, loop: false });
            break;
          }
          this.setState(this.engaged ? 'combat' : 'idle');
        }
        break;
      }
      case 'return': {
        this.aggro = false;
        this.engaged = false;
        if (this._canAggro() && this.distToTarget < cfg.aggroRange * 0.85) { this._alertFast = true; this.setState('alert'); break; }
        const d = this.steerTo(this.home, cfg.walkSpeed * 1.2);
        this.faceMove();
        this.rig?.play('walk', { fade: 0.2 });
        if (d < 1.2) this.setState('idle');
        break;
      }
      default: this.wish.set(0, 0, 0); break;
    }
  }

  _stCombat(dt) {
    const cfg = this.cfg;
    if (!this.target || this.distToTarget > cfg.loseRange) { this.setState('return'); return; }
    if (this.distToTarget > cfg.keepDist * 2.0 + 1.2) { this.setState('chase'); return; }
    this.faceTarget(dt);
    this.atkCd -= dt;

    const err = this.distToTarget - cfg.keepDist;
    const fwd = this.dirToTarget;
    _v2.set(-fwd.z, 0, fwd.x).multiplyScalar(cfg.strafeDir * cfg.strafeSpeed);
    this.wish.copy(_v2).addScaledVector(fwd, clamp(err, -1, 1) * cfg.walkSpeed);
    if (this.rng() < dt * 0.4) cfg.strafeDir *= -1;

    const moving = this.wish.lengthSq() > 0.25;
    this.rig?.play(moving ? (this.rig.has('strafe') ? 'strafe' : 'walk') : (this.rig.has('idle_combat') ? 'idle_combat' : 'idle'), { fade: 0.22 });

    if (this.atkCd <= 0) {
      const key = this.pickAttack();
      if (key) {
        if (this.requestToken()) this.startAttack(key);
        else this.atkCd = 0.3 + this.rng() * 0.3;
      } else this.atkCd = 0.35;
    }
  }

  _move(dt) {
    const cfg = this.cfg;
    const a = cfg.accel * (this.state === 'attack' ? 1.8 : 1);
    this.mv.x = damp(this.mv.x, this.wish.x, a, dt);
    this.mv.z = damp(this.mv.z, this.wish.z, a, dt);

    const p = this.pos;
    p.x += (this.mv.x + this.kb.x) * dt;
    p.z += (this.mv.z + this.kb.z) * dt;
    const kbd = Math.exp(-cfg.kbDamp * dt);
    this.kb.x *= kbd; this.kb.z *= kbd;

    if (this.flying) {
      const g = this.groundY(p.x, p.z);
      p.y = damp(p.y, g + this.altitude, cfg.climbRate ?? 2.4, dt);
    } else {
      if (this.airborne) {
        this.vy -= (cfg.gravity ?? 22) * dt;
        this.yOffset += this.vy * dt;
        if (this.yOffset <= 0) { this.yOffset = 0; this.vy = 0; this.airborne = false; this.onLand?.(); }
      }
      p.y = this.groundY(p.x, p.z) + this.yOffset + (this.cfg.groundOffset ?? 0);
    }

    this._separate(dt);
    if (this.ctx.collision?.resolve) {
      try {
        const y0 = p.y;
        this.ctx.collision.resolve(p, this.hitRadius, this.hitHeight);
        if (!this.flying) p.y = Math.max(p.y, this.groundY(p.x, p.z) + this.yOffset + (this.cfg.groundOffset ?? 0));
        else p.y = y0;
      } catch (e) { /* collision is optional */ }
    }

    // turning with angular acceleration (no instant snapping)
    const diff = wrapAngle(this.yawTarget - this.yaw);
    const maxRate = cfg.turnRate * (this.state === 'attack' ? 0.5 : 1);
    this.yawVel = damp(this.yawVel, clamp(diff * 4.2, -maxRate, maxRate), 10, dt);
    this.yaw += this.yawVel * dt;
    this._applyOrientation(dt);
  }

  _applyOrientation(dt) {
    if (this.flying || this.cfg.groundAlign <= 0) {
      this.root.rotation.set(this.pitch ?? 0, this.yaw, this.roll ?? 0);
      return;
    }
    const n = normalAt(this.pos.x, this.pos.z, 1.4);
    _v1.set(n.x, n.y, n.z).lerp(UP, 1 - this.cfg.groundAlign).normalize();
    _q1.setFromUnitVectors(UP, _v1);
    _q2.setFromAxisAngle(UP, this.yaw);
    _q1.multiply(_q2);
    this.root.quaternion.slerp(_q1, 1 - Math.exp(-9 * dt));
  }

  _separate(dt) {
    const es = this.manager?.enemies;
    if (!es) return;
    for (let i = 0; i < es.length; i++) {
      const o = es[i];
      if (o === this || !o.alive || o.asleep) continue;
      const dx = this.pos.x - o.pos.x, dz = this.pos.z - o.pos.z;
      const rr = (this.hitRadius + o.hitRadius) * 0.98;
      const d2 = dx * dx + dz * dz;
      if (d2 > rr * rr || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const share = o.cfg.mass / (o.cfg.mass + this.cfg.mass);
      const push = (rr - d) * share * 7 * dt;
      this.pos.x += dx / d * push;
      this.pos.z += dz / d * push;
    }
  }

  _updateDeath(dt) {
    this._deathT += dt;
    this.rig?.update(dt);
    this.kb.multiplyScalar(Math.exp(-4 * dt));
    this.pos.x += this.kb.x * dt;
    this.pos.z += this.kb.z * dt;
    if (!this.flying) this.pos.y = this.groundY(this.pos.x, this.pos.z) + this.yOffset + (this.cfg.groundOffset ?? 0);
    else {
      this.vy -= 14 * dt;
      this.pos.y = Math.max(this.groundY(this.pos.x, this.pos.z), this.pos.y + this.vy * dt);
    }
    this.onDeathUpdate?.(dt);
    if (this._deathT > this.deathAnimTime) {
      if (!this._dissolving) { this._dissolving = true; this._prepareDissolve(); }
      const k = clamp((this._deathT - this.deathAnimTime) / this.dissolveTime, 0, 1);
      for (const m of this._ownMats) m.opacity = (m.userData.baseOpacity ?? 1) * (1 - k);
      this.rigRoot.position.y = k * 0.45;
      const s = 1 - k * 0.12;
      this.rigRoot.scale.setScalar(s);
      if (k >= 1) this.removed = true;
    }
  }

  _prepareDissolve() {
    const seen = new Map();
    const swap = (mesh) => {
      let m = seen.get(mesh.material);
      if (!m) {
        m = mesh.material.clone();
        m.transparent = true;
        m.depthWrite = false;
        m.userData.baseOpacity = mesh.material.opacity ?? 1;
        seen.set(mesh.material, m);
        this._ownMats.push(m);
      }
      mesh.material = m;
    };
    for (const mesh of this.meshes ?? []) swap(mesh);
    for (const o of this.outlines ?? []) swap(o);
    for (const extra of this._extraMeshes ?? []) swap(extra);
    this.ctx.fx3d?.burst?.(this.center(_v1), this.elementType, 0.9);
  }

  dispose() {
    this.root.parent?.remove(this.root);
    if (this._tele) { this._tele.parent?.remove(this._tele); this._tele.material.dispose(); this._tele = null; }
    if (this._mark) { this._mark.parent?.remove(this._mark); this._mark = null; }
    if (this._hpBar) { this._hpBar.parent?.remove(this._hpBar); this._hpBar = null; }
    for (const m of this._ownMats) m.dispose();
    this._ownMats.length = 0;
    this.onDispose?.();
    this.removed = true;
  }
}
