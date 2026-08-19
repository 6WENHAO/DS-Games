// Environmental survival systems: Dragonspine cold, fall damage, wind currents,
// weather-driven tinting. Content modules push heat sources / wind fields into ctx.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, damp } from '../core/utils.js';
import { height, surfaceAt, regionAt } from '../world/heightfield.js';
import { ELEMENT_COLORS } from './fx.js';

export class Environment {
  constructor(ctx) {
    this.ctx = ctx;
    ctx.heatSources = ctx.heatSources ?? [];   // [{x,y,z,radius,strength}]
    ctx.windFields = ctx.windFields ?? [];
    this.cold = 0;
    this.coldWarned = false;
    this._t = 0;
    ctx.events.on('player:land', ({ force }) => {
      if (force > 19) {
        const dmg = Math.round((force - 19) * 14);
        ctx.player.takeDamage({ amount: dmg, element: 'physical', poise: 0 });
        ctx.ui?.subtitle?.('落地冲击！', 900);
      }
    });
  }

  /** Register a campfire / brazier that keeps the player warm. */
  addHeatSource(x, y, z, radius = 8, strength = 1) {
    const h = { x, y, z, radius, strength, active: true };
    this.ctx.heatSources.push(h);
    return h;
  }
  addWindField(x, z, radius = 4, strength = 14, top = 260) {
    const w = { x, z, radius, strength, top };
    this.ctx.windFields.push(w);
    return w;
  }

  /** Bridge content-module objects (wind columns, lit braziers, campfires) into the
   *  gameplay-side registries the player controller reads. */
  _syncExternal() {
    const ctx = this.ctx;
    try {
      const wo = ctx.worldObjects?.windFields;
      if (wo && wo.length !== this._woLen) {
        this._woLen = wo.length;
        ctx.windFields.length = 0;
        for (const w of wo) ctx.windFields.push({
          x: w.x, z: w.z, radius: (w.radius ?? 4) * 1.1,
          strength: 13.5, top: (w.baseY ?? 0) + (w.heightH ?? 45),
        });
      }
      const list = ctx.puzzles?.puzzles;
      if (list) for (const pz of list) {
        const torches = pz.torches ?? pz.braziers;
        if (!torches) continue;
        for (const t of torches) {
          const lit = !!(t.userData?.lit ?? t.lit);
          if (lit && !t.userData._heat) {
            const wp = new THREE.Vector3(); t.getWorldPosition?.(wp) ?? wp.copy(t.position ?? new THREE.Vector3());
            t.userData._heat = this.addHeatSource(wp.x, wp.y, wp.z, 11, 1.2);
          } else if (!lit && t.userData?._heat) { t.userData._heat.active = false; t.userData._heat = null; }
        }
      }
      const camps = ctx.worldObjects?.camps;
      if (camps && camps.length !== this._campLen) {
        this._campLen = camps.length;
        for (const c of camps) if (!c.userData._heat) {
          const wp = new THREE.Vector3(); c.getWorldPosition(wp);
          c.userData._heat = this.addHeatSource(wp.x, wp.y, wp.z, 9, 1);
        }
      }
    } catch (e) { if (!this._syncWarn) { this._syncWarn = 1; console.warn('[environment.sync]', e); } }
  }

  update(dt) {
    const ctx = this.ctx, p = ctx.player?.position;
    if (!p) return;
    this._t += dt;
    this._syncSlow = (this._syncSlow ?? 0) + dt;
    if (this._syncSlow > 0.5) { this._syncSlow = 0; this._syncExternal(); }

    // ---- sheer cold on Dragonspine ----
    const reg = regionAt(p.x, p.z);
    const inSnow = (reg?.id === 'dragonspine') || (p.y > 150 && surfaceAt(p.x, p.z) === 'snow');
    let warm = 0;
    for (const h of ctx.heatSources) {
      if (h.active === false) continue;
      const d = Math.hypot(p.x - h.x, p.z - h.z, (p.y - h.y) * 0.6);
      if (d < h.radius) warm = Math.max(warm, (1 - d / h.radius) * (h.strength ?? 1));
    }
    const target = inSnow ? 1 : 0;
    const rate = warm > 0.15 ? -0.55 * (1 + warm) : target ? 0.075 : -0.4;
    this.cold = clamp(this.cold + rate * dt, 0, 1);

    if (inSnow && !this.coldWarned) {
      this.coldWarned = true;
      ctx.ui?.subtitle?.('严寒正在侵蚀你的体温 —— 靠近火源可以取暖', 4200);
    }
    if (this.cold > 0.02) {
      const u = ctx.fx?.uElement;
      if (u) {
        const c = new THREE.Color(ELEMENT_COLORS.cryo);
        u.value.x = Math.max(u.value.x, c.r * this.cold * 0.22);
        u.value.y = Math.max(u.value.y, c.g * this.cold * 0.22);
        u.value.z = Math.max(u.value.z, c.b * this.cold * 0.3);
      }
      ctx.fx.uSat.value = lerp(1.02, 0.72, this.cold);
    } else if (ctx.fx) ctx.fx.uSat.value = lerp(ctx.fx.uSat.value, 1.02, dt * 2);

    if (this.cold >= 0.999 && this._t > 1) {
      this._t = 0;
      ctx.player.takeDamage({ amount: 42, element: 'cryo', poise: 0 });
      ctx.ui?.subtitle?.('你被严寒冻伤了！', 1400);
    }
    ctx.ui?.hud?.setCold?.(this.cold);
    ctx.coldLevel = this.cold;

    // ---- sunset / night grading ----
    const day = ctx.sky.dayFactor;
    const warmth = smoothstep(0.55, 0.06, day);
    if (ctx.fx) {
      ctx.fx.uGain.value.set(lerp(1.03, 1.12, warmth), 1.0, lerp(0.97, 0.86, warmth));
      ctx.fx.uVignette.value = lerp(0.30, 0.42, warmth);
      // brighten as the sun sets so night is stylised-readable rather than black
      ctx.fx.uExposure.value = damp(ctx.fx.uExposure.value, lerp(1.12, 0.76, smoothstep(0.02, 0.5, day)), 1.6, dt);
      ctx.fx.uLift.value.set(lerp(0.008, 0.016, 1 - day), lerp(0.010, 0.020, 1 - day), lerp(0.018, 0.042, 1 - day));
    }
  }
}
