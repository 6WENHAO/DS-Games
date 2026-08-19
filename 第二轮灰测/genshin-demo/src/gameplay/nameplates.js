// World-space enemy nameplates: name + level + segmented HP bar + element aura icon.
import * as THREE from 'three';
import { clamp, damp } from '../core/utils.js';
import { ELEMENT_COLORS } from './fx.js';

const MAX = 14;
const NAMES = {
  slime_water: '水史莱姆', slime_fire: '火史莱姆', slime_electro: '雷史莱姆', slime: '史莱姆',
  hilichurl: '丘丘人', hilichurl_archer: '丘丘射手', hilichurl_shield: '木盾丘丘人',
  mitachurl: '丘丘暴徒', ruinguard: '遗迹守卫', whopperflower: '骗骗花',
  boss_dvalin: '风魔龙 · 特瓦林',
};

export class Nameplates {
  constructor(ctx) {
    this.ctx = ctx;
    this.layer = document.createElement('div');
    this.layer.id = 'nameplates';
    this.layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden';
    (document.getElementById('ui-root') || document.body).appendChild(this.layer);
    this.pool = [];
    for (let i = 0; i < MAX; i++) {
      const el = document.createElement('div');
      el.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-50%,-100%);opacity:0;' +
        'will-change:transform,opacity;transition:opacity .18s linear;text-align:center;white-space:nowrap';
      el.innerHTML =
        '<div class="np-name" style="font:600 11px/1.3 var(--ui-font);color:#f3ecdd;' +
        'text-shadow:0 1px 3px rgba(0,0,0,.9);letter-spacing:.05em;margin-bottom:2px"></div>' +
        '<div class="np-bar" style="width:64px;height:4px;background:rgba(8,10,16,.72);' +
        'border:1px solid rgba(255,255,255,.22);border-radius:2px;overflow:hidden;margin:0 auto">' +
        '<i class="np-fill" style="display:block;height:100%;width:100%;' +
        'background:linear-gradient(90deg,#ffe9b8,#ffb45a);transition:width .12s linear"></i></div>';
      this.layer.appendChild(el);
      this.pool.push({ el, name: el.querySelector('.np-name'), fill: el.querySelector('.np-fill'),
        bar: el.querySelector('.np-bar'), target: null, shown: 0, lastHp: 1 });
    }
    this._v = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this.hurtSeen = new WeakMap();
    ctx.events.on('combat:hit', ({ target }) => { if (target && target !== ctx.player) this.hurtSeen.set(target, ctx.time.elapsed); });
  }

  update(dt) {
    const ctx = this.ctx;
    const list = ctx.enemies?.enemies;
    const cam = ctx.camera;
    if (!list || !list.length || ctx.photo?.active) { for (const s of this.pool) if (s.shown) { s.el.style.opacity = '0'; s.shown = 0; s.target = null; } return; }
    cam.getWorldDirection(this._fwd);

    // rank candidates: aggroed or recently hit, in front of the camera, close
    const cands = [];
    for (const e of list) {
      if (e.alive === false || e.isBoss || String(e.type ?? '').startsWith('boss')) continue;
      const c = e.center ? e.center(this._v) : this._v.copy(e.root.position);
      const to = this._v.copy(c).sub(cam.position);
      const d = to.length();
      if (d > 46) continue;
      if (to.normalize().dot(this._fwd) < 0.32) continue;
      const hurt = (ctx.time.elapsed - (this.hurtSeen.get(e) ?? -99)) < 5.5;
      const aggro = e.state === 'chase' || e.state === 'combat' || e.state === 'attack' || e.aggro;
      const locked = ctx.player?.lockOn === e;
      if (!hurt && !aggro && !locked) continue;
      cands.push({ e, d, locked });
    }
    cands.sort((a, b) => (b.locked ? 1 : 0) - (a.locked ? 1 : 0) || a.d - b.d);
    const take = cands.slice(0, MAX);

    // assign to slots
    const used = new Set();
    for (const s of this.pool) {
      if (s.target && take.some(t => t.e === s.target)) { used.add(s.target); continue; }
      s.target = null;
    }
    for (const t of take) {
      if (used.has(t.e)) continue;
      const slot = this.pool.find(s => !s.target);
      if (!slot) break;
      slot.target = t.e; used.add(t.e);
      slot.name.textContent = (NAMES[t.e.type] ?? t.e.name ?? '魔物') + (t.e.level ? '  Lv.' + t.e.level : '');
      const col = ELEMENT_COLORS[t.e.elementType ?? 'physical'] ?? 0xffffff;
      const hex = '#' + new THREE.Color(col).getHexString();
      slot.fill.style.background = `linear-gradient(90deg,${hex},#ffb45a)`;
    }

    for (const s of this.pool) {
      const e = s.target;
      if (!e || e.alive === false) { if (s.shown) { s.el.style.opacity = '0'; s.shown = 0; } s.target = null; continue; }
      const head = (e.hitHeight ?? 1.8) + (e.headOffset ?? 0.32);
      const p = this._v.copy(e.root.position); p.y += head;
      p.project(cam);
      if (p.z > 1) { s.el.style.opacity = '0'; s.shown = 0; continue; }
      const x = (p.x * 0.5 + 0.5) * innerWidth, y = (-p.y * 0.5 + 0.5) * innerHeight;
      const locked = ctx.player?.lockOn === e;
      const sc = locked ? 1.1 : 0.92;
      s.el.style.transform = `translate(-50%,-100%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${sc})`;
      const ratio = clamp((e.hp ?? 1) / (e.maxHp ?? 1), 0, 1);
      s.fill.style.width = (ratio * 100).toFixed(1) + '%';
      s.bar.style.boxShadow = locked ? '0 0 8px rgba(255,220,150,.75)' : 'none';
      if (!s.shown) { s.el.style.opacity = '1'; s.shown = 1; }
    }
  }
}
