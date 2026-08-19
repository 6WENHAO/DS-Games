// Opening guidance: a short, gated tutorial chain that teaches one verb at a time and
// only advances when the player actually performs it.
import * as THREE from 'three';
import { clamp } from '../core/utils.js';
import { height, findFlatSpot } from '../world/heightfield.js';

const CSS = `
#tut{position:absolute;left:50%;top:11%;transform:translateX(-50%) translateY(-14px);opacity:0;
  transition:opacity .4s ease,transform .4s cubic-bezier(.2,.8,.2,1);pointer-events:none;min-width:270px;max-width:60vw}
#tut.on{opacity:1;transform:translateX(-50%) translateY(0)}
#tut .tut-card{display:flex;align-items:center;gap:13px;padding:11px 18px 11px 14px;
  background:linear-gradient(180deg,rgba(12,17,29,.86),rgba(12,17,29,.7));
  border:1px solid rgba(232,213,168,.5);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
#tut .tut-keys{display:flex;gap:5px;flex:none}
#tut .kc{min-width:26px;height:26px;padding:0 7px;display:flex;align-items:center;justify-content:center;
  font:600 12px/1 ui-monospace,Consolas,monospace;color:#3b3226;
  background:linear-gradient(180deg,#f6ecd6,#dcc9a2);border-radius:6px;
  box-shadow:0 2px 0 rgba(90,72,40,.75),inset 0 1px 0 rgba(255,255,255,.8)}
#tut .tut-text{font:14px/1.5 var(--ui-font);color:#f4ecdc;letter-spacing:.04em;text-shadow:0 1px 3px rgba(0,0,0,.7)}
#tut .tut-sub{display:block;font-size:11px;color:#a9bcd8;margin-top:2px;letter-spacing:.06em}
#tut.done .tut-card{border-color:rgba(150,235,160,.85)}
#tut .tut-tick{width:20px;height:20px;flex:none;opacity:0;transform:scale(.4);transition:all .3s cubic-bezier(.2,1.4,.3,1)}
#tut.done .tut-tick{opacity:1;transform:scale(1)}
`;

export class Tutorial {
  constructor(ctx) {
    this.ctx = ctx;
    this.steps = this._buildSteps();
    this.i = -1;
    this.running = false;
    this.t = 0;
    this._el = null;
    this._probe = { moved: 0, sprintT: 0, glideT: 0, jumped: false, hit: false, skill: false, burst: false, interacted: false, switched: false };
    ctx.events.on('combat:hit', ({ info }) => { if (info?.source === ctx.player) this._probe.hit = true; });
    ctx.events.on('player:skill', () => { this._probe.skill = true; });
    ctx.events.on('player:burst', () => { this._probe.burst = true; });
    ctx.events.on('interact:used', () => { this._probe.interacted = true; });
    ctx.events.on('player:switch', () => { this._probe.switched = true; });
  }

  _buildSteps() {
    return [
      { keys: ['W', 'A', 'S', 'D'], text: '移动', sub: '用 WASD 在提瓦特上迈出第一步',
        reset: ['moved'], done: (c, pr) => pr.moved > 4 },
      { keys: ['Shift'], text: '冲刺', sub: '按住 Shift 加速奔跑，会消耗体力',
        reset: ['sprintT'], done: (c, pr) => pr.sprintT > 0.7 },
      { keys: ['Space'], text: '跳跃', sub: '空格起跳；在空中再按一次可以展开风之翼',
        reset: ['jumped'], done: (c, pr) => pr.jumped },
      { keys: ['鼠标左键'], text: '攻击', sub: '连续点击可以打出连段',
        setup: (c) => this._spawnTarget(c), reset: ['hit'], done: (c, pr) => pr.hit },
      { keys: ['E'], text: '元素战技', sub: '元素力是解谜与战斗的核心',
        reset: ['skill'], done: (c, pr) => pr.skill },
      { keys: ['1', '2', '3', '4'], text: '切换角色', sub: '不同角色拥有不同元素',
        reset: ['switched'], done: (c, pr) => pr.switched },
      { keys: ['F'], text: '交互', sub: '拾取、开箱、对话、启动机关都用 F',
        setup: (c) => this._spawnPickup(c), reset: ['interacted'], done: (c, pr) => pr.interacted },
      { keys: ['V'], text: '元素视野', sub: '按住 V 可以看见附近的宝箱、敌人与机关',
        done: (c) => c.sight?.blend > 0.5 },
      { keys: ['M'], text: '打开地图', sub: '在七天神像解锁传送点后可以快速旅行',
        done: (c) => !!c.ui?.map?.isOpen },
    ];
  }

  _ensureDom() {
    if (this._el) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    const el = document.createElement('div');
    el.id = 'tut';
    el.innerHTML = `<div class="tut-card">
      <div class="tut-keys"></div>
      <div class="tut-text"><span class="tut-main"></span><span class="tut-sub"></span></div>
      <svg class="tut-tick" viewBox="0 0 24 24" fill="none" stroke="#8ce89a" stroke-width="3"
        stroke-linecap="round" stroke-linejoin="round"><path d="M4 13l5 5L20 6"/></svg>
    </div>`;
    (document.getElementById('ui-root') || document.body).appendChild(el);
    this._el = el;
    this._keys = el.querySelector('.tut-keys');
    this._main = el.querySelector('.tut-main');
    this._sub = el.querySelector('.tut-sub');
  }

  _show(step) {
    this._ensureDom();
    const el = this._el;
    el.classList.remove('done');
    this._keys.innerHTML = step.keys.map(k => `<span class="kc">${k}</span>`).join('');
    this._main.textContent = step.text;
    this._sub.textContent = step.sub ?? '';
    el.classList.add('on');
    this.ctx.audio?.sfx?.('ui_hover', { vol: 0.5 });
  }

  _complete() {
    if (!this._el) return;
    this._el.classList.add('done');
    this.ctx.audio?.sfx?.('ui_confirm', { vol: 0.6 });
    setTimeout(() => this._el?.classList.remove('on'), 700);
  }

  _spawnTarget(ctx) {
    if (!ctx.enemies?.spawn) return;
    const p = ctx.player.position;
    const f = new THREE.Vector3(Math.sin(ctx.player.facing), 0, Math.cos(ctx.player.facing));
    for (let i = 0; i < 2; i++) {
      const q = p.clone().addScaledVector(f, 5 + i * 2.2);
      q.x += (i - 0.5) * 2.0;
      q.y = height(q.x, q.z);
      try { ctx.enemies.spawn('slime_water', q); } catch {}
    }
    ctx.ui?.subtitle?.('史莱姆出现了！', 2400);
  }

  _spawnPickup(ctx) {
    const p = ctx.player.position;
    const spot = findFlatSpot(p.x + 3, p.z + 3, ctx.rng, 4);
    const g = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 0),
      new THREE.MeshStandardMaterial({ color: 0xbfe9ff, emissive: 0x4fc3f7, emissiveIntensity: 1.1, roughness: .3 }));
    gem.position.y = 0.45; g.add(gem);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 1.6, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x8fd9ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.y = 0.8; g.add(halo);
    g.position.set(spot.x, spot.y, spot.z);
    ctx.scene.add(g);
    this._pickup = g;
    this._pickupSpin = gem;
    this._handle = ctx.interact.register({
      pos: new THREE.Vector3(spot.x, spot.y + 0.4, spot.z), radius: 2.6, label: '拾取 · 冒险家的信物', icon: 'pickup', once: true,
      onInteract: (c) => {
        c.inventory?.add?.('primogem', 5);
        c.fx3d?.burst?.(g.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 'hydro', 0.8);
        c.scene.remove(g);
        this._pickup = null;
      },
    });
  }

  start(delay = 1.2) {
    if (this.ctx.shotMode || this.done) return;
    this.running = true;
    this.t = -delay;
    this.i = -1;
  }

  skip() {
    this.running = false; this.done = true;
    if (this._el) this._el.classList.remove('on');
    if (this._pickup) { this.ctx.scene.remove(this._pickup); this._pickup = null; }
    this._handle?.remove?.();
  }

  update(dt) {
    const ctx = this.ctx;
    if (this._pickupSpin && this._pickup) {
      this._pickupSpin.rotation.y += dt * 1.8;
      this._pickupSpin.position.y = 0.45 + Math.sin(ctx.time.elapsed * 2) * 0.06;
    }
    if (!this.running || ctx.paused || ctx.dialogueOpen) return;

    // sample what the player is doing
    const pr = this._probe;
    const pl = ctx.player;
    if (this._lastPos) pr.moved += this._lastPos.distanceTo(pl.position);
    else this._lastPos = pl.position.clone();
    this._lastPos.copy(pl.position);
    if (pl.state === 'sprint') pr.sprintT += dt; 
    if (pl.state === 'glide') pr.glideT += dt;
    if (pl.state === 'jump' || (!pl.grounded && pl.velocity.y > 1)) pr.jumped = true;

    this.t += dt;
    if (this.i < 0) {
      if (this.t < 0) return;
      this._advanceTo(0);
      return;
    }
    const step = this.steps[this.i];
    if (!step) { this._finish(); return; }

    if (this._settle > 0) {              // short beat after a tick so the player sees it
      this._settle -= dt;
      if (this._settle <= 0) this._advanceTo(this.i + 1);
      return;
    }
    let ok = false;
    try { ok = !!step.done(ctx, pr); } catch { ok = false; }
    if (!ok && this.t > (step.timeout ?? 40)) ok = true;   // never hard-block the player
    if (ok) { this._complete(); this._settle = 0.9; }
  }

  _advanceTo(i) {
    this.i = i; this.t = 0; this._settle = 0;
    const s = this.steps[i];
    if (!s) { this._finish(); return; }
    for (const k of (s.reset ?? [])) this._probe[k] = typeof this._probe[k] === 'number' ? 0 : false;
    try { s.setup?.(this.ctx); } catch (e) { console.warn('[tutorial setup]', e); }
    this._show(s);
  }

  _finish() {
    this.skip();
    this.ctx.ui?.toast?.('新手引导完成 · 祝你旅途愉快', { icon: 'quest' });
    this.ctx.events.emit('tutorial:done');
  }
}
