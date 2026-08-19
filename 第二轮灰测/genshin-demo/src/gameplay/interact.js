// World interaction points (F key) with nearest-target selection and UI prompt.
import * as THREE from 'three';

export class InteractSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.list = [];
    this.nearest = null;
    this._t = 0;
  }
  register(def) {
    const h = {
      pos: def.pos ? def.pos.clone ? def.pos.clone() : new THREE.Vector3(def.pos.x, def.pos.y, def.pos.z) : new THREE.Vector3(),
      radius: def.radius ?? 2.6, label: def.label ?? '交互', icon: def.icon ?? 'talk',
      priority: def.priority ?? 0, once: !!def.once, used: false,
      enabled: def.enabled ?? (() => true), onInteract: def.onInteract ?? (() => {}),
      data: def.data ?? null,
      remove: () => { const i = this.list.indexOf(h); if (i >= 0) this.list.splice(i, 1); },
    };
    this.list.push(h);
    return h;
  }
  clear() { this.list.length = 0; this.nearest = null; }

  update(dt) {
    const ctx = this.ctx;
    const p = ctx.player?.position; if (!p) return;
    this._t += dt;
    if (this._t > 0.08) {
      this._t = 0;
      let best = null, bestScore = Infinity;
      for (const h of this.list) {
        if (h.once && h.used) continue;
        const dx = h.pos.x - p.x, dy = h.pos.y - p.y, dz = h.pos.z - p.z;
        const d2 = dx * dx + dy * dy * 0.5 + dz * dz;
        if (d2 > h.radius * h.radius) continue;
        let ok = true; try { ok = h.enabled(); } catch { ok = false; }
        if (!ok) continue;
        const score = d2 - h.priority * 4;
        if (score < bestScore) { bestScore = score; best = h; }
      }
      if (best !== this.nearest) {
        this.nearest = best;
        if (best) ctx.ui?.prompt?.(best.label, 'F', best.icon);
        else ctx.ui?.hidePrompt?.();
      }
    }
    if (this.nearest && ctx.input.justPressed('interact') && !ctx.dialogueOpen) {
      const h = this.nearest;
      h.used = true;
      ctx.audio?.sfx?.('ui_confirm');
      try { h.onInteract(ctx, h); } catch (e) { console.error('[interact]', e); }
      ctx.events.emit('interact:used', { handle: h });
      if (h.once) { h.remove(); this.nearest = null; ctx.ui?.hidePrompt?.(); }
    }
  }
}
