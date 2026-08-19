// Photo mode (P): free-fly camera, hidden HUD, framing guides, filters.
// Side quests use ctx.events 'photo:taken'.
import * as THREE from 'three';
import { clamp, damp } from '../core/utils.js';
import { height, regionAt } from '../world/heightfield.js';

export class PhotoMode {
  constructor(ctx) {
    this.ctx = ctx;
    this.active = false;
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.filter = 0;
    this.filters = [
      { name: '原色', sat: 1.10, lift: [0.008, 0.010, 0.018], gain: [1.03, 1.0, 0.97], vig: 0.34 },
      { name: '暖阳', sat: 1.22, lift: [0.02, 0.012, 0.0], gain: [1.12, 1.02, 0.88], vig: 0.40 },
      { name: '幽蓝', sat: 0.95, lift: [0.0, 0.008, 0.03], gain: [0.92, 0.98, 1.14], vig: 0.44 },
      { name: '古画', sat: 0.55, lift: [0.03, 0.024, 0.008], gain: [1.08, 1.0, 0.82], vig: 0.52 },
      { name: '黑白', sat: 0.02, lift: [0.014, 0.014, 0.014], gain: [1.05, 1.05, 1.05], vig: 0.48 },
    ];
    this._ui = null;
  }

  _buildUI() {
    const el = document.createElement('div');
    el.id = 'photo-ui';
    el.style.cssText = 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .35s';
    el.innerHTML = `
      <div style="position:absolute;inset:0;border:2.5vh solid rgba(0,0,0,.0);box-shadow:inset 0 0 0 2px rgba(255,255,255,.25)"></div>
      <div style="position:absolute;left:33.33%;top:0;bottom:0;width:1px;background:rgba(255,255,255,.14)"></div>
      <div style="position:absolute;left:66.66%;top:0;bottom:0;width:1px;background:rgba(255,255,255,.14)"></div>
      <div style="position:absolute;top:33.33%;left:0;right:0;height:1px;background:rgba(255,255,255,.14)"></div>
      <div style="position:absolute;top:66.66%;left:0;right:0;height:1px;background:rgba(255,255,255,.14)"></div>
      <div id="photo-info" style="position:absolute;left:50%;bottom:26px;transform:translateX(-50%);
        font:13px/1.7 var(--ui-font);color:#f4ecdc;text-align:center;letter-spacing:.1em;
        background:rgba(10,14,22,.5);padding:8px 18px;border-radius:8px;border:1px solid rgba(232,213,168,.3)"></div>
      <div id="photo-flash" style="position:absolute;inset:0;background:#fff;opacity:0;transition:opacity .12s"></div>`;
    (document.getElementById('ui-root') || document.body).appendChild(el);
    this._ui = el;
    this._info = el.querySelector('#photo-info');
    this._flash = el.querySelector('#photo-flash');
  }

  toggle() { this.active ? this.exit() : this.enter(); }

  enter() {
    const ctx = this.ctx;
    if (!this._ui) this._buildUI();
    this.active = true;
    this.pos.copy(ctx.camera.position);
    this.yaw = ctx.camera3.yaw; this.pitch = ctx.camera3.pitch;
    ctx.camera3.mode = 'free';
    ctx.player.setControlEnabled(false);
    ctx.ui?.hud?.hide?.();
    ctx.ui?.cinematic?.(false);
    this._ui.style.opacity = '1';
    this._updateInfo();
    ctx.audio?.sfx?.('ui_confirm');
  }

  exit() {
    const ctx = this.ctx;
    this.active = false;
    ctx.camera3.mode = 'follow';
    ctx.player.setControlEnabled(true);
    ctx.ui?.hud?.show?.();
    if (this._ui) this._ui.style.opacity = '0';
    const f = this.filters[0];
    ctx.fx.uSat.value = f.sat;
    ctx.fx.uLift.value.set(...f.lift); ctx.fx.uGain.value.set(...f.gain); ctx.fx.uVignette.value = f.vig;
    ctx.audio?.sfx?.('ui_cancel');
  }

  _updateInfo() {
    const r = regionAt(this.pos.x, this.pos.z);
    if (this._info) this._info.innerHTML =
      `拍照模式 · <b>${this.filters[this.filter].name}</b> · ${r ? r.name : '提瓦特'}<br>
       <span style="opacity:.75;font-size:11px">WASD 移动 · 空格/Ctrl 升降 · 鼠标转向 · Q/E 切换滤镜 · 左键拍照 · P 退出</span>`;
  }

  shoot() {
    const ctx = this.ctx;
    if (this._flash) { this._flash.style.opacity = '0.85'; setTimeout(() => { this._flash.style.opacity = '0'; }, 130); }
    ctx.audio?.sfx?.('ui_confirm', { rate: 1.4 });
    const r = regionAt(this.pos.x, this.pos.z);
    ctx.events.emit('photo:taken', { pos: this.pos.clone(), region: r?.id ?? null, filter: this.filters[this.filter].name });
    ctx.ui?.toast?.('拍摄成功' + (r ? ' · ' + r.name : ''), { icon: 'camera' });
  }

  update(dt) {
    const ctx = this.ctx, input = ctx.input;
    if (input.justPressed('photo') && !ctx.dialogueOpen && !ctx.paused) this.toggle();
    if (!this.active) return;
    if (input.justPressed('pause')) { this.exit(); return; }

    if (input.locked) {
      this.yaw -= input.mouse.dx * 0.0026;
      this.pitch = clamp(this.pitch - input.mouse.dy * 0.0024, -1.4, 1.4);
    }
    const ax = input.moveAxis();
    const speed = input.isDown('sprint') ? 26 : 9;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const fwd = new THREE.Vector3(-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp);
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x).normalize();
    this.pos.addScaledVector(fwd, ax.y * speed * dt).addScaledVector(right, ax.x * speed * dt);
    if (input.isDown('jump')) this.pos.y += speed * dt;
    if (input.isDown('walk')) this.pos.y -= speed * dt;
    this.pos.y = Math.max(this.pos.y, height(this.pos.x, this.pos.z) + 0.4);
    // clamp inside the world
    const d = Math.hypot(this.pos.x, this.pos.z);
    if (d > 1950) { this.pos.x *= 1950 / d; this.pos.z *= 1950 / d; }

    ctx.camera.position.copy(this.pos);
    ctx.camera.rotation.set(0, 0, 0);
    ctx.camera.rotateY(Math.PI - this.yaw);
    ctx.camera.rotateX(this.pitch);

    if (input.justPressed('burst') || input.justPressed('skill')) {
      this.filter = (this.filter + (input.justPressed('skill') ? 1 : this.filters.length - 1)) % this.filters.length;
      const f = this.filters[this.filter];
      ctx.fx.uSat.value = f.sat;
      ctx.fx.uLift.value.set(...f.lift); ctx.fx.uGain.value.set(...f.gain); ctx.fx.uVignette.value = f.vig;
      this._updateInfo();
      ctx.audio?.sfx?.('ui_hover');
    }
    if (input.mouse.leftPressed) this.shoot();
    if (this._t === undefined || (this._t += dt) > 0.4) { this._t = 0; this._updateInfo(); }
  }
}
