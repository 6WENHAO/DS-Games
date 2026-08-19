/* =====================================================================
 * Particles — 粒子系统（方块碎屑、爆炸、水花、雨雪）
 *  · 对象池，无 GC 抖动
 *  · 每帧生成面向相机的 billboard 顶点数据
 * ===================================================================== */
import { GRAVITY } from '../core/Constants.js';
import { BLOCKS } from '../data/blocks.js';
import { hexToRgb } from '../math/MathUtils.js';
import settings from '../core/Settings.js';

const MAX_PARTICLES = 2400;
const FLOATS_PER_VERTEX = 10;   // pos3 + uv3 + color4

class Particle {
  constructor() {
    this.active = false;
    this.x = 0; this.y = 0; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.life = 0; this.maxLife = 1;
    this.size = 0.1;
    this.layer = 0;
    this.u0 = 0; this.v0 = 0; this.uw = 0.25; this.vh = 0.25;
    this.r = 1; this.g = 1; this.b = 1; this.a = 1;
    this.gravity = 1;
    this.drag = 0.92;
    this.bounce = 0.3;
    this.collide = true;
    this.stretch = 1;      // 竖向拉伸（雨滴）
    this.fade = true;
  }
}

export class ParticleSystem {
  constructor(world, atlas) {
    this.world = world;
    this.atlas = atlas;
    this.pool = new Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) this.pool[i] = new Particle();
    this.count = 0;
    this.vertices = new Float32Array(MAX_PARTICLES * 4 * FLOATS_PER_VERTEX);
    this.quadCount = 0;
    this.genericLayer = atlas ? atlas.layer('particle_generic') : 0;
    this.rainTimer = 0;
  }

  _spawn() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) { p.active = true; this.count++; return p; }
    }
    return null;
  }

  clear() {
    for (const p of this.pool) p.active = false;
    this.count = 0;
  }

  /* ---------------- 各类效果 ---------------- */

  /** 方块被破坏：迸出材质碎块 */
  blockBreak(x, y, z, blockId, amount = 14) {
    if (!settings.get('particles')) return;
    const def = BLOCKS[blockId];
    if (!def) return;
    const layer = def.layers[2];
    for (let i = 0; i < amount; i++) {
      const p = this._spawn();
      if (!p) return;
      p.x = x + Math.random(); p.y = y + Math.random() * 0.8 + 0.1; p.z = z + Math.random();
      p.vx = (Math.random() - 0.5) * 3.2;
      p.vy = Math.random() * 3.6 + 0.6;
      p.vz = (Math.random() - 0.5) * 3.2;
      p.life = 0; p.maxLife = 0.6 + Math.random() * 0.7;
      p.size = 0.09 + Math.random() * 0.05;
      p.layer = layer;
      const q = 0.25;
      p.u0 = Math.floor(Math.random() * 4) * q;
      p.v0 = Math.floor(Math.random() * 4) * q;
      p.uw = q; p.vh = q;
      p.r = p.g = p.b = 1; p.a = 1;
      p.gravity = 1; p.drag = 0.86; p.collide = true; p.stretch = 1; p.fade = false;
    }
  }

  /** 挖掘中：少量碎屑 */
  digging(x, y, z, blockId, face) {
    if (!settings.get('particles')) return;
    const def = BLOCKS[blockId];
    if (!def) return;
    const p = this._spawn();
    if (!p) return;
    const layer = def.layers[Math.max(0, face)] ?? def.layers[2];
    p.x = x + 0.5 + (Math.random() - 0.5) * 0.9;
    p.y = y + 0.5 + (Math.random() - 0.5) * 0.9;
    p.z = z + 0.5 + (Math.random() - 0.5) * 0.9;
    p.vx = (Math.random() - 0.5) * 1.2;
    p.vy = Math.random() * 1.5;
    p.vz = (Math.random() - 0.5) * 1.2;
    p.life = 0; p.maxLife = 0.45;
    p.size = 0.07;
    p.layer = layer;
    p.u0 = Math.floor(Math.random() * 4) * 0.25;
    p.v0 = Math.floor(Math.random() * 4) * 0.25;
    p.uw = 0.25; p.vh = 0.25;
    p.r = p.g = p.b = 1; p.a = 1;
    p.gravity = 1; p.drag = 0.9; p.collide = false; p.stretch = 1; p.fade = false;
  }

  /** 纯色爆散（生物死亡） */
  burstColor(x, y, z, color, amount = 10) {
    if (!settings.get('particles')) return;
    const [r, g, b] = hexToRgb(color);
    for (let i = 0; i < amount; i++) {
      const p = this._spawn();
      if (!p) return;
      p.x = x + (Math.random() - 0.5) * 0.7;
      p.y = y + (Math.random() - 0.5) * 0.7;
      p.z = z + (Math.random() - 0.5) * 0.7;
      p.vx = (Math.random() - 0.5) * 2.6;
      p.vy = Math.random() * 2.6;
      p.vz = (Math.random() - 0.5) * 2.6;
      p.life = 0; p.maxLife = 0.5 + Math.random() * 0.5;
      p.size = 0.11;
      p.layer = this.genericLayer;
      p.u0 = 0; p.v0 = 0; p.uw = 1; p.vh = 1;
      p.r = r; p.g = g; p.b = b; p.a = 1;
      p.gravity = 0.7; p.drag = 0.9; p.collide = false; p.stretch = 1; p.fade = true;
    }
  }

  explosion(x, y, z) {
    if (!settings.get('particles')) return;
    for (let i = 0; i < 60; i++) {
      const p = this._spawn();
      if (!p) return;
      const a = Math.random() * Math.PI * 2;
      const el = (Math.random() - 0.3) * Math.PI;
      const sp = 2 + Math.random() * 9;
      p.x = x; p.y = y; p.z = z;
      p.vx = Math.cos(a) * Math.cos(el) * sp;
      p.vy = Math.sin(el) * sp + 2;
      p.vz = Math.sin(a) * Math.cos(el) * sp;
      p.life = 0; p.maxLife = 0.7 + Math.random() * 1.1;
      p.size = 0.3 + Math.random() * 0.5;
      p.layer = this.genericLayer;
      p.u0 = 0; p.v0 = 0; p.uw = 1; p.vh = 1;
      const g = 0.25 + Math.random() * 0.35;
      p.r = g + 0.15; p.g = g; p.b = g * 0.95; p.a = 1;
      p.gravity = 0.15; p.drag = 0.82; p.collide = false; p.stretch = 1; p.fade = true;
    }
  }

  /** 落水/出水的水花 */
  splash(x, y, z, amount = 14) {
    if (!settings.get('particles')) return;
    for (let i = 0; i < amount; i++) {
      const p = this._spawn();
      if (!p) return;
      p.x = x + (Math.random() - 0.5) * 0.7;
      p.y = y + 0.1;
      p.z = z + (Math.random() - 0.5) * 0.7;
      p.vx = (Math.random() - 0.5) * 2.5;
      p.vy = 2 + Math.random() * 3;
      p.vz = (Math.random() - 0.5) * 2.5;
      p.life = 0; p.maxLife = 0.5 + Math.random() * 0.4;
      p.size = 0.07;
      p.layer = this.genericLayer;
      p.u0 = 0; p.v0 = 0; p.uw = 1; p.vh = 1;
      p.r = 0.55; p.g = 0.72; p.b = 1; p.a = 0.9;
      p.gravity = 1; p.drag = 0.94; p.collide = false; p.stretch = 1; p.fade = true;
    }
  }

  /** 天气：在玩家周围生成雨/雪 */
  weather(player, kind, dt) {
    if (!settings.get('weather') || !settings.get('particles')) return;
    this.rainTimer += dt;
    const rate = kind === 'thunder' ? 0.012 : 0.02;
    while (this.rainTimer > rate) {
      this.rainTimer -= rate;
      const p = this._spawn();
      if (!p) return;
      const R = 14;
      const px = player.position[0] + (Math.random() - 0.5) * R * 2;
      const pz = player.position[2] + (Math.random() - 0.5) * R * 2;
      const top = player.position[1] + 9;
      p.x = px; p.y = top; p.z = pz;
      p.vx = 0.6; p.vy = -18; p.vz = 0.2;
      p.life = 0; p.maxLife = 1.4;
      p.size = 0.055;
      p.layer = this.genericLayer;
      p.u0 = 0; p.v0 = 0; p.uw = 1; p.vh = 1;
      p.r = 0.55; p.g = 0.68; p.b = 0.95; p.a = 0.65;
      p.gravity = 0; p.drag = 1; p.collide = true; p.stretch = 5.5; p.fade = false;
    }
  }

  /* ---------------- 更新与顶点生成 ---------------- */

  update(dt) {
    const world = this.world;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) { p.active = false; this.count--; continue; }

      p.vy -= GRAVITY * 0.42 * p.gravity * dt;
      const k = Math.pow(p.drag, dt * 60);
      p.vx *= k; p.vz *= k;

      let nx = p.x + p.vx * dt;
      let ny = p.y + p.vy * dt;
      let nz = p.z + p.vz * dt;

      if (p.collide) {
        // 简易碰撞：只测中心点
        if (world.isSolid(Math.floor(nx), Math.floor(p.y), Math.floor(p.z))) { nx = p.x; p.vx *= -p.bounce; }
        if (world.isSolid(Math.floor(p.x), Math.floor(p.y), Math.floor(nz))) { nz = p.z; p.vz *= -p.bounce; }
        if (world.isSolid(Math.floor(nx), Math.floor(ny), Math.floor(nz))) {
          ny = p.y;
          if (p.stretch > 1) { p.active = false; this.count--; continue; }   // 雨滴落地消失
          p.vy *= -p.bounce;
          p.vx *= 0.7; p.vz *= 0.7;
        }
      }
      p.x = nx; p.y = ny; p.z = nz;
    }
  }

  /**
   * 生成面向相机的四边形
   * @returns 四边形数量
   */
  buildVertices(camera, world) {
    const right = camera.right, up = camera.up;
    const v = this.vertices;
    let o = 0, quads = 0;
    const daylight = world.daylight;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      const t = p.life / p.maxLife;
      const alpha = p.fade ? p.a * (1 - t * t) : p.a;
      if (alpha <= 0.01) continue;

      const s = p.size * (p.fade ? (1 - t * 0.35) : 1);
      const sh = s * p.stretch;
      const rx = right[0] * s, ry = right[1] * s, rz = right[2] * s;
      const ux = up[0] * sh, uy = up[1] * sh, uz = up[2] * sh;

      // 光照
      const light = Math.max(0.18, world.lightAt(
        Math.floor(p.x), Math.floor(p.y), Math.floor(p.z), daylight));
      const r = p.r * light, g = p.g * light, b = p.b * light;

      const u0 = p.u0, v0 = p.v0, u1 = p.u0 + p.uw, v1 = p.v0 + p.vh;
      const L = p.layer;

      // 左下
      v[o] = p.x - rx - ux; v[o + 1] = p.y - ry - uy; v[o + 2] = p.z - rz - uz;
      v[o + 3] = u0; v[o + 4] = v1; v[o + 5] = L;
      v[o + 6] = r; v[o + 7] = g; v[o + 8] = b; v[o + 9] = alpha; o += 10;
      // 右下
      v[o] = p.x + rx - ux; v[o + 1] = p.y + ry - uy; v[o + 2] = p.z + rz - uz;
      v[o + 3] = u1; v[o + 4] = v1; v[o + 5] = L;
      v[o + 6] = r; v[o + 7] = g; v[o + 8] = b; v[o + 9] = alpha; o += 10;
      // 右上
      v[o] = p.x + rx + ux; v[o + 1] = p.y + ry + uy; v[o + 2] = p.z + rz + uz;
      v[o + 3] = u1; v[o + 4] = v0; v[o + 5] = L;
      v[o + 6] = r; v[o + 7] = g; v[o + 8] = b; v[o + 9] = alpha; o += 10;
      // 左上
      v[o] = p.x - rx + ux; v[o + 1] = p.y - ry + uy; v[o + 2] = p.z - rz + uz;
      v[o + 3] = u0; v[o + 4] = v0; v[o + 5] = L;
      v[o + 6] = r; v[o + 7] = g; v[o + 8] = b; v[o + 9] = alpha; o += 10;

      quads++;
    }
    this.quadCount = quads;
    return quads;
  }

  get activeCount() { return this.count; }
}

export const PARTICLE_FLOATS_PER_VERTEX = FLOATS_PER_VERTEX;
