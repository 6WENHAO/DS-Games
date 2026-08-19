// ---------------------------------------------------------------------------
// 投掷物：物理弹跳 + 引爆效果（高爆 / 闪光 / 烟雾 / 燃烧 / 诱饵）
// ---------------------------------------------------------------------------

import { GRENADES } from './weapondata.js';
import {
  v3, vadd, vsub, vscale, vnorm, vdot, vdist, vlen, clamp, lerp, rnd, rndRange,
  anglesToDir, rightFromYaw, vaddScaled, vreflect,
} from '../core/math.js';
import { MOVE } from './movement.js';
import { hexToLinear } from '../render/models.js';
import { m4compose, m4mul } from '../core/math.js';

const RADIUS = 0.075;
const GRAV = MOVE.gravity;

export class GrenadeSystem {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.nextId = 1;
  }

  clear() { this.list.length = 0; }

  /**
   * 投出一枚手雷
   * @param {number} power 0..1，1 = 全力扔，0.35 = 轻抛
   */
  throwGrenade(player, type, power = 1) {
    const def = GRENADES[type];
    if (!def) return null;
    const have = player.inv.grenades[type] || 0;
    if (have <= 0) return null;
    player.inv.grenades[type] = have - 1;

    const eye = player.eye(v3());
    const dir = anglesToDir(v3(), player.yaw, player.pitch);
    const right = rightFromYaw(v3(), player.yaw);
    const pos = [
      eye[0] + dir[0] * 0.45 + right[0] * 0.12,
      eye[1] + dir[1] * 0.45 - 0.05,
      eye[2] + dir[2] * 0.45 + right[2] * 0.12,
    ];
    const speed = (def.throwSpeed || 14) * (0.32 + 0.68 * clamp(power, 0, 1));
    const vel = [
      dir[0] * speed + player.vel[0] * 0.7,
      dir[1] * speed + speed * 0.14 + player.vel[1] * 0.5,
      dir[2] * speed + player.vel[2] * 0.7,
    ];
    const g = {
      id: this.nextId++, type, def, pos, vel, owner: player,
      team: player.team, fuse: def.fuse || 1.6, t: 0, bounces: 0,
      resting: false, restTime: 0, detonated: false, spin: rnd() * 6.283,
      spinAxis: [rndRange(-1, 1), rndRange(-1, 1), rndRange(-1, 1)],
    };
    this.list.push(g);
    this.game.audio.play('grenade_throw', player.isLocal ? {} : { pos: player.pos.slice() });
    if (type === 'he' || type === 'flash') {
      this.game.radio(player, 'radio_fireinthehole', 0.35);
    }
    return g;
  }

  update(dt) {
    const world = this.game.world;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i];
      g.t += dt;
      if (!g.resting) {
        g.vel[1] -= GRAV * dt;
        let remain = dt;
        let guard = 0;
        while (remain > 1e-5 && guard++ < 5) {
          const sp = vlen(g.vel);
          if (sp < 1e-4) break;
          const dir = vscale(v3(), g.vel, 1 / sp);
          const dist = sp * remain;
          const hit = world.traceRay(g.pos, dir, dist + RADIUS);
          if (hit && hit.t <= dist + RADIUS) {
            const travel = Math.max(0, hit.t - RADIUS);
            vaddScaled(g.pos, g.pos, dir, travel);
            const bounce = g.def.bounce === undefined ? 0.42 : g.def.bounce;
            // 燃烧瓶碰到地面直接碎
            if ((g.type === 'molotov' || g.type === 'incgrenade') && (hit.normal[1] > 0.5 || g.bounces >= 1)) {
              this.detonate(g, hit.point);
              break;
            }
            vreflect(g.vel, g.vel, hit.normal);
            vscale(g.vel, g.vel, bounce);
            // 切向摩擦
            const n = hit.normal;
            const vn = vdot(g.vel, n);
            const tang = vsub(v3(), g.vel, vscale(v3(), n, vn));
            vscale(tang, tang, 0.72);
            g.vel[0] = tang[0] + n[0] * vn;
            g.vel[1] = tang[1] + n[1] * vn;
            g.vel[2] = tang[2] + n[2] * vn;
            g.bounces++;
            if (vlen(g.vel) > 1.2) {
              this.game.audio.play('grenade_bounce', { pos: g.pos.slice(), volume: clamp(vlen(g.vel) / 8, 0.2, 0.9) });
            }
            remain -= travel / Math.max(sp, 1e-4);
            if (vlen(g.vel) < 0.7 && hit.normal[1] > 0.6) {
              g.resting = true;
              g.vel[0] = g.vel[1] = g.vel[2] = 0;
              break;
            }
          } else {
            vaddScaled(g.pos, g.pos, dir, dist);
            remain = 0;
          }
        }
        g.spin += dt * 6;
      }
      if (g.detonated) { this.list.splice(i, 1); continue; }
      if (g.t >= g.fuse) {
        this.detonate(g, g.pos.slice());
        this.list.splice(i, 1);
      }
    }
  }

  detonate(g, at) {
    if (g.detonated) return;
    g.detonated = true;
    const game = this.game;
    const pos = at || g.pos;
    switch (g.type) {
      case 'he': this._he(g, pos); break;
      case 'flash': this._flash(g, pos); break;
      case 'smoke': this._smoke(g, pos); break;
      case 'molotov':
      case 'incgrenade': this._fire(g, pos); break;
      case 'decoy': this._decoy(g, pos); break;
      default: break;
    }
  }

  _he(g, pos) {
    const game = this.game;
    const def = g.def;
    game.effects.explosion(pos, def.radius, 1);
    game.audio.play('he_explode', { pos: pos.slice(), volume: 1 });
    game.shake(pos, 1.0, def.radius * 2.4);
    for (const p of game.players) {
      if (!p.alive) continue;
      const target = [p.pos[0], p.pos[1] + p.height * 0.55, p.pos[2]];
      const dist = vdist(pos, target);
      if (dist > def.radius) continue;
      let vis = 1;
      if (!game.world.visible(pos, target)) {
        // 墙后削弱：再试脚部与头部
        const alt = game.world.visible(pos, [p.pos[0], p.pos[1] + 0.15, p.pos[2]]);
        vis = alt ? 0.55 : 0;
      }
      if (vis <= 0) continue;
      const falloff = Math.pow(1 - clamp(dist / def.radius, 0, 1), 1.45);
      const dmg = def.damage * falloff * vis;
      if (dmg < 1) continue;
      game.applyDamage(p, g.owner, dmg, 'chest', { name: '高爆手雷', nameCN: '高爆手雷', class: 'grenade', armorPen: def.armorPen, killAward: def.killAward }, target, 'he');
    }
    // 引爆范围内的燃烧被吹灭一部分
  }

  _flash(g, pos) {
    const game = this.game;
    const def = g.def;
    game.effects.flashbang(pos);
    game.audio.play('flash_explode', { pos: pos.slice(), volume: 1 });
    for (const p of game.players) {
      if (!p.alive) continue;
      const eye = p.eye(v3());
      const dist = vdist(pos, eye);
      if (dist > def.radius * 2.2) continue;
      if (!game.world.visible(pos, eye)) continue;
      const occ = game.effects.smokeOcclusion(pos, eye);
      const to = vnorm(v3(), vsub(v3(), pos, eye));
      const view = anglesToDir(v3(), p.yaw, p.pitch);
      const dot = vdot(view, to);
      let f = clamp((dot + 0.25) / 1.25, 0, 1);
      f = Math.pow(f, 1.35);
      const distF = clamp(1 - dist / (def.radius * 2.0), 0, 1);
      let dur = def.blindMax * f * (0.28 + 0.72 * distF) * (1 - occ * 0.85);
      if (dur < 0.25) continue;
      p.blind(dur, clamp(0.55 + f * 0.45, 0, 1));
      if (p.isLocal) game.audio.play('flash_ring', { volume: clamp(dur / def.blindMax, 0.2, 1) });
      if (p.isBot && p.bot) p.bot.onFlashed(dur);
    }
  }

  _smoke(g, pos) {
    const game = this.game;
    game.effects.smokeCloud(pos, g.def.radius, g.def.duration);
    game.audio.play('smoke_deploy', { pos: pos.slice(), volume: 0.9 });
    const h = game.audio.play('smoke_hiss', { pos: pos.slice(), loop: true, volume: 0.35 });
    if (h) setTimeout(() => { try { h.stop(); } catch (e) {} }, 4200);
    // 灭火
    for (const f of game.effects.fires) {
      if (vdist(f.pos, pos) < g.def.radius + f.radius) f.duration = Math.min(f.duration, f.t + 0.4);
    }
  }

  _fire(g, pos) {
    const game = this.game;
    game.effects.fireArea(pos, g.def.radius, g.def.duration);
    game.audio.play('molotov_ignite', { pos: pos.slice(), volume: 1 });
    const h = game.audio.play('fire_burn', { pos: pos.slice(), loop: true, volume: 0.5 });
    if (h) {
      const dur = g.def.duration * 1000;
      setTimeout(() => { try { h.stop(); } catch (e) {} }, dur);
    }
    game.fireOwners.push({ pos: pos.slice(), radius: g.def.radius, dps: g.def.dps, owner: g.owner, until: game.time + g.def.duration });
  }

  _decoy(g, pos) {
    const game = this.game;
    game.effects.explosion(pos, g.def.radius, 0.4);
    game.audio.play('he_explode', { pos: pos.slice(), volume: 0.4 });
  }

  render(renderer, lib) {
    for (const g of this.list) {
      const m = lib.pool.get();
      const vm = g.def.viewmodel;
      m4compose(m, g.pos, [g.spin * 0.7, g.spin, 0], null);
      if (vm && vm.parts) {
        for (const part of vm.parts) {
          const pm = lib.pool.get();
          const tmp = lib.pool.get();
          m4compose(tmp, part.pos, part.rot || [0, 0, 0], part.size);
          m4mul(pm, m, tmp);
          renderer.drawModel(lib.unitBox, pm, { color: hexToLinear(part.color), spec: 0.3, gloss: 22 });
        }
      } else {
        renderer.drawModel(lib.unitSphere, m, { color: [0.2, 0.25, 0.15, 1] });
      }
      // 高爆/闪光的红点提示
      if (g.type === 'he' || g.type === 'flash') {
        const blink = (Math.sin(g.t * 26) * 0.5 + 0.5);
        renderer.drawSprite('glow', [g.pos[0], g.pos[1] + 0.08, g.pos[2]], 0.16,
          [1.8 * blink, 0.3 * blink, 0.2 * blink, 0.9], { additive: true });
      }
    }
  }
}
