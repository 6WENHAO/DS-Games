// Elemental Sight (hold V): desaturates the world and reveals interactables,
// enemies and quest targets as glowing markers through geometry.
import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/utils.js';
import { makeGlowTexture } from '../core/textures.js';
import { ELEMENT_COLORS } from './fx.js';

const MAX_MARKS = 40;

export class ElementalSight {
  constructor(ctx) {
    this.ctx = ctx;
    this.active = false;
    this.blend = 0;
    this.group = new THREE.Group();
    this.group.name = 'sight';
    ctx.scene.add(this.group);
    const tex = makeGlowTexture(64, 2.2);
    this.marks = [];
    for (let i = 0; i < MAX_MARKS; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: 0x9fe4d0, transparent: true, opacity: 0, depthTest: false,
        depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      }));
      m.renderOrder = 900;
      m.visible = false;
      this.group.add(m);
      this.marks.push(m);
    }
    // scanning ripple on the ground
    this.ripple = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 64),
      new THREE.MeshBasicMaterial({ color: 0x8ff0d8, transparent: true, opacity: 0, depthWrite: false,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.ripple.rotation.x = -Math.PI / 2;
    this.ripple.renderOrder = 890;
    this.group.add(this.ripple);
    this._rippleT = 0;
    this._v = new THREE.Vector3();
    this._savedSat = null;
  }

  update(dt) {
    const ctx = this.ctx;
    const want = !ctx.paused && !ctx.dialogueOpen && !ctx.photo?.active && ctx.input.isDown('sight');
    if (want !== this.active) {
      this.active = want;
      if (want) { this._savedSat = ctx.fx.uSat.value; ctx.audio?.sfx?.('skill_anemo', { vol: 0.35, rate: 1.5 }); this._rippleT = 0; }
      else ctx.audio?.sfx?.('ui_cancel', { vol: 0.3 });
      ctx.events.emit('sight:toggle', { active: want });
    }
    this.blend = damp(this.blend, this.active ? 1 : 0, 9, dt);
    if (this.blend < 0.002) {
      if (this._marksOn) { for (const m of this.marks) m.visible = false; this.ripple.material.opacity = 0; this._marksOn = false; }
      return;
    }
    this._marksOn = true;

    // world grade: cool, desaturated, slightly darker
    ctx.fx.uSat.value = lerp(this._savedSat ?? 1.045, 0.16, this.blend);
    ctx.fx.uElement.value.x = Math.max(ctx.fx.uElement.value.x, 0.02 * this.blend);
    ctx.fx.uElement.value.y = Math.max(ctx.fx.uElement.value.y, 0.10 * this.blend);
    ctx.fx.uElement.value.z = Math.max(ctx.fx.uElement.value.z, 0.09 * this.blend);
    ctx.fx.uVignette.value = lerp(ctx.fx.uVignette.value, 0.55, this.blend * 0.6);

    const p = ctx.player.position;
    this._rippleT += dt;
    const rr = (this._rippleT % 1.6) / 1.6;
    this.ripple.position.set(p.x, p.y + 0.12, p.z);
    this.ripple.scale.setScalar(1 + rr * 34);
    this.ripple.material.opacity = (1 - rr) * 0.5 * this.blend;

    // collect targets: enemies (red), interactables (element colour), quest targets (gold)
    let n = 0;
    const push = (pos, color, scale) => {
      if (n >= MAX_MARKS) return;
      const m = this.marks[n++];
      m.visible = true;
      m.position.copy(pos);
      m.material.color.set(color);
      const pulse = 0.85 + 0.25 * Math.sin(ctx.time.elapsed * 4 + n);
      m.scale.setScalar(scale * pulse);
      m.material.opacity = this.blend * 0.9;
    };
    for (const e of (ctx.enemies?.enemies ?? [])) {
      if (e.alive === false) continue;
      const d = e.root.position.distanceTo(p);
      if (d > 60) continue;
      const c = e.center ? e.center(this._v) : this._v.copy(e.root.position);
      push(c, e.isBoss ? 0xff4d4d : 0xff7a55, e.isBoss ? 6 : 1.5 + (e.hitHeight ?? 1.6) * 0.35);
    }
    for (const h of (ctx.interact?.list ?? [])) {
      if (h.once && h.used) continue;
      const d = h.pos.distanceTo(p);
      if (d > 44) continue;
      const col = h.icon === 'chest' ? 0xffd166 : h.icon === 'waypoint' ? 0x8fd9ff
        : h.icon === 'talk' ? 0xbfe9ff : h.icon === 'puzzle' ? 0xc88bfa : ELEMENT_COLORS.dendro;
      push(this._v.copy(h.pos).add(new THREE.Vector3(0, 0.7, 0)), col, 1.0);
    }
    for (let i = n; i < MAX_MARKS; i++) this.marks[i].visible = false;

    if (!this.active && this.blend < 0.02 && this._savedSat != null) {
      ctx.fx.uSat.value = this._savedSat;
      this._savedSat = null;
    }
  }
}
