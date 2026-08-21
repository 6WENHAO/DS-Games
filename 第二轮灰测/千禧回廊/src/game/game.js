// ============================================================================
//  game.js —— 主循环：移动 / 碰撞 / 交互 / 字幕 / 转场 / 结局
//  script.js 通过这里暴露的一套小 API 来写梦核事件（say / flag / every / goto …）
// ============================================================================

import { Renderer } from '../gfx/raycast.js';
import { animateProps } from '../gfx/props.js';
import { compile, collides, setCell } from '../world/compile.js';
import { ZONE_DEFS } from '../world/zones.js';
import * as A from './audio.js';
import { HANDLERS, genericInteract, surfaceOf, MEMORY_IDS, MEMORY_NEEDED, LINES, ENDING } from './script.js';

const WALK = 1.5;
const RUN = 2.45;
const TURN = 1.9;
const MOUSE_SENS = 0.0032;   // 弧度／鼠标计数（左右上下共用，保证 1:1 手感）
const ARROW_PITCH = 1.25;    // 方向键抬头速度（弧度／秒）
const PITCH_MAX = 0.62;      // 上下视角上限 ≈ 35°，够看清天花板和地面
// 上下视角方向：-1 = 鼠标往下推、视线就往下（常规）；+1 = 反过来（飞行摇杆式）
const PITCH_SIGN = -1;

export class Game {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.ctx2d = canvas.getContext('2d', { alpha: false });
    this.hud = hud;
    this.renderer = new Renderer(384, 216);
    this.img = null;

    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;

    this.time = 0;
    this.timers = new Map();
    this.onceTimers = new Map();
    this.flags = new Set();
    this.vars = new Map();
    this.items = new Set();
    this.memories = new Set();

    this.subQueue = [];
    this.subText = '';
    this.subLeft = 0;

    this.fade = 1;          // 1 = 全黑
    this.fadeDir = -1;      // -1 淡入
    this.pending = null;
    this.ended = false;
    this.paused = true;

    this.bob = 0;
    this.lookPitch = 0;
    this.stepAcc = 0;
    this.prompt = null;

    this.zoneId = null;
    this.world = null;
    this.cam = { x: 0, y: 0, a: 0, fov: 1.16, ez: 1.62, pitch: 0 };

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const iw = 384;
    const ih = Math.max(176, Math.min(300, Math.round((iw * h) / w)));
    this.renderer.resize(iw, ih);
    this.canvas.width = iw;
    this.canvas.height = ih;
    this.img = this.ctx2d.createImageData(iw, ih);
  }

  // ------------------------------------------------------------------ 场景
  loadZone(id) {
    const def = ZONE_DEFS[id];
    this.zoneId = id;
    this.world = compile(def);
    this.cam.x = def.spawn.x; this.cam.y = def.spawn.y; this.cam.a = def.spawn.a;
    this.timers.clear(); this.onceTimers.clear();
    this.lookPitch = 0; this.bob = 0;
    A.clearEmitters();
    A.setZone(id, { stair: 2.4, home: 1.1, lobby: 4.2, tower: 3.2, roof: 1.6 }[id] || 2);
    this.hud.setZoneName(def.name);
    HANDLERS[id]?.enter?.(this);
  }

  goto(id, delay = 1.5) {
    if (this.pending) return;
    this.pending = { id, t: delay };
  }

  finish() {
    this.ended = true;
    this.pending = { id: '__end__', t: 2.6 };
    A.musicBox();
  }

  // ------------------------------------------------------- 给脚本用的小 API
  say(...lines) {
    for (const l of lines) {
      if (l === undefined || l === null) continue;
      this.subQueue.push(String(l));
    }
  }

  flag(k) { return this.flags.has(k); }
  raise(k) { this.flags.add(k); }
  set(k, v) { this.vars.set(k, v); }
  get(k, d) { return this.vars.has(k) ? this.vars.get(k) : d; }
  take(i) { this.items.add(i); this.hud.flashItem(i); }
  has(i) { return this.items.has(i); }
  zoneIs(id) { return this.zoneId === id; }

  sprite(id) { return this.world.sprites.find((s) => s.id === id); }
  light(id) { return this.world.lights.find((l) => l.id === id); }

  memory(id) {
    if (this.memories.has(id)) return;
    this.memories.add(id);
    this.hud.setMemories([...this.memories], MEMORY_NEEDED);
    this.hud.flashMemory();
  }
  memoryCount() { return this.memories.size; }

  every(key, interval, fn) {
    const next = this.timers.get(key);
    if (next === undefined) {
      this.timers.set(key, this.time + interval * (0.35 + Math.random() * 0.6));
      return;
    }
    if (this.time >= next) { this.timers.set(key, this.time + interval); fn(); }
  }

  after(key, delay, fn) {
    const at = this.onceTimers.get(key);
    if (at === undefined) { this.onceTimers.set(key, this.time + delay); return; }
    if (at !== Infinity && this.time >= at) { this.onceTimers.set(key, Infinity); fn(); }
  }

  // ---------------------------------------------------------------- 主循环
  update(dt) {
    this.time += dt;
    if (this.paused) return;

    // —— 转场 ——
    if (this.pending) {
      this.pending.t -= dt;
      this.fadeDir = 1;
      if (this.pending.t <= 0 && this.fade >= 1) {
        const id = this.pending.id;
        this.pending = null;
        if (id === '__end__') { this.hud.showEnding(ENDING); this.paused = true; return; }
        this.subQueue.length = 0; this.subText = ''; this.subLeft = 0;
        this.loadZone(id);
        this.fadeDir = -1;
      }
    }
    this.fade = Math.max(0, Math.min(1, this.fade + this.fadeDir * dt * 0.85));
    this.hud.setFade(this.fade);

    // —— 字幕队列 ——
    if (this.subLeft > 0) {
      this.subLeft -= dt;
      if (this.subLeft <= 0) { this.subText = ''; this.hud.setSubtitle(''); }
    } else if (this.subQueue.length) {
      this.subText = this.subQueue.shift();
      this.subLeft = this.subText === '' ? 0.5 : 1.5 + this.subText.length * 0.115;
      this.hud.setSubtitle(this.subText);
    }

    if (this.fade > 0.92) return;   // 黑屏期间不动

    // —— 转头 ——
    if (this.keys.has('ArrowLeft')) this.cam.a -= TURN * dt;
    if (this.keys.has('ArrowRight')) this.cam.a += TURN * dt;
    this.cam.a += this.mouseDX * MOUSE_SENS;

    // —— 上下视角 ——
    // cam.pitch 是"地平线的屏幕偏移"（>0 = 抬头，地平线下移）。
    // 用 focal 换算，所以灵敏度与左右一致、且不随内部分辨率变化。
    // 视角会一直保持，不再自动回正 —— 想看斗拱、采光顶、水磨石地面就得抬得起头。
    const focal = (this.renderer.w / 2) / Math.tan(this.cam.fov / 2);
    this.lookPitch += this.mouseDY * MOUSE_SENS * focal * PITCH_SIGN;
    if (this.keys.has('ArrowUp')) this.lookPitch += ARROW_PITCH * focal * dt;
    if (this.keys.has('ArrowDown')) this.lookPitch -= ARROW_PITCH * focal * dt;
    if (this.keys.has('KeyC')) this.lookPitch *= 1 - 9 * dt;     // 按 C 视角归正
    const limit = focal * Math.tan(PITCH_MAX);
    this.lookPitch = Math.max(-limit, Math.min(limit, this.lookPitch));
    this.mouseDX = 0; this.mouseDY = 0;

    // —— 移动 ——
    let fw = 0, sd = 0;
    if (this.keys.has('KeyW')) fw += 1;
    if (this.keys.has('KeyS')) fw -= 1;
    if (this.keys.has('KeyA')) sd -= 1;
    if (this.keys.has('KeyD')) sd += 1;
    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const spd = (running ? RUN : WALK) * dt;
    const dirX = Math.cos(this.cam.a), dirY = Math.sin(this.cam.a);
    let vx = dirX * fw + -dirY * sd;
    let vy = dirY * fw + dirX * sd;
    const len = Math.hypot(vx, vy);
    if (len > 0) {
      vx = (vx / len) * spd; vy = (vy / len) * spd;
      // 分轴解算，贴着墙也能滑
      if (!collides(this.world, this.cam.x + vx, this.cam.y, 0.27)) this.cam.x += vx;
      if (!collides(this.world, this.cam.x, this.cam.y + vy, 0.27)) this.cam.y += vy;
      // 头部摩擦 + 脚步
      this.bob += (running ? 8.4 : 6.0) * dt;
      this.stepAcc += (running ? RUN : WALK) * dt;
      if (this.stepAcc > 0.78) {
        this.stepAcc = 0;
        A.footstep(surfaceOf(this.world, this.cam.x, this.cam.y), running ? 1.15 : 0.9);
        HANDLERS[this.zoneId]?.step?.(this);
      }
    } else {
      this.bob += 1.1 * dt;
    }
    const bobAmt = len > 0 ? (running ? 3.1 : 2.0) : 0.55;
    this.cam.pitch = this.lookPitch + Math.sin(this.bob) * bobAmt;
    this.cam.ez = 1.62 + Math.sin(this.bob * 2) * 0.012;

    // —— 传送门（上不完的楼梯）——
    const def = ZONE_DEFS[this.zoneId];
    for (const tp of def.teleports || []) {
      if (Math.floor(this.cam.x) === tp.from[0] && Math.floor(this.cam.y) === tp.from[1]) {
        this.cam.x = tp.to.x; this.cam.y = tp.to.y; this.cam.a = tp.to.a;
        this.hud.blink();
        HANDLERS[this.zoneId]?.teleport?.(this, tp);
        break;
      }
    }

    // —— 可交互物：找最近、且大致在视线正前方的（门/出口有优先权）——
    this.prompt = null;
    let best = null, bestScore = -1;
    for (const it of this.world.interactables) {
      const dx = it.x - this.cam.x, dy = it.y - this.cam.y;
      const d = Math.hypot(dx, dy);
      if (d > (it.r || 1.3)) continue;
      const ang = Math.atan2(dy, dx) - this.cam.a;
      const c = Math.cos(ang);
      if (c < 0.28) continue;                 // 必须大致朝着它
      const score = (c * c * c) / (0.45 + d) * (it.prio || 1);
      if (score > bestScore) { bestScore = score; best = it; }
    }
    if (best) { this.prompt = best; this.hud.setPrompt(best.label); }
    else this.hud.setPrompt('');

    // —— 场景逻辑 ——
    HANDLERS[this.zoneId]?.tick?.(this, dt);
    A.updateListener(this.cam.x, this.cam.y, this.cam.a);
  }

  interact() {
    if (this.paused || !this.prompt || this.fade > 0.2) return;
    const id = this.prompt.id;
    const h = HANDLERS[this.zoneId];
    if (h?.interact?.(this, id)) return;
    if (genericInteract(this, id)) return;
    this.say('没什么可看的。');
  }

  render() {
    animateProps(this.time);
    const fx = {
      time: this.time,
      grain: 6.5,
      scanlines: 0.05,
      warm: 1.3,
      sat: 1.06,
      darkness: 1,
      bloom: 0.45,
      bloomThreshold: 192,
      flicker: 1 + Math.sin(this.time * 13.3) * 0.012 + Math.sin(this.time * 41.7) * 0.008,
    };
    const data = this.renderer.render(this.world, this.cam, fx);
    this.img.data.set(data);
    this.ctx2d.putImageData(this.img, 0, 0);
  }
}
