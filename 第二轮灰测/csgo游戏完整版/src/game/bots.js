// ---------------------------------------------------------------------------
// Bot AI：感知（视线/烟雾/闪光）、战术状态机、导航跟随、拟人化瞄准、购买
// ---------------------------------------------------------------------------

import {
  v3, vsub, vadd, vscale, vnorm, vdot, vdist, vdistXZ, clamp, lerp, rnd, rndRange, rndPick,
  anglesToDir, dirToAngles, angleDelta, TAU, DEG, vaddScaled, gauss,
} from '../core/math.js';
import { WEAPONS, GRENADES } from './weapondata.js';
import {
  activeId, activeDef, tryFire, requestReload, selectSlot, giveWeapon,
  currentSpread, shootOrigin, totalGrenades,
} from './weapons.js';
import { MOVE } from './movement.js';

export const DIFFICULTY = {
  easy: { skill: 0.22, name: '简单' },
  normal: { skill: 0.48, name: '普通' },
  hard: { skill: 0.72, name: '困难' },
  expert: { skill: 0.92, name: '专家' },
};

const BOT_NAMES = [
  'Cyber-Alpha', 'Cyber-Bravo', 'Cyber-Cyrus', 'Cyber-Delta', 'Cyber-Echo',
  'Nova', 'Vector', 'Quartz', 'Onyx', 'Pyro', 'Zenith', 'Halo', 'Rogue',
  'Sable', 'Talon', 'Umbra', 'Vertex', 'Wraith', 'Xenon', 'Yield', 'Zulu',
  'Blaze', 'Crimson', 'Drift', 'Ember', 'Flux', 'Ghost', 'Havoc',
];
let nameIdx = 0;
export function botName() {
  const n = BOT_NAMES[nameIdx % BOT_NAMES.length];
  nameIdx++;
  return nameIdx > BOT_NAMES.length ? n + ' ' + Math.floor(nameIdx / BOT_NAMES.length) : n;
}

export class BotBrain {
  constructor(player, game, skill = 0.5) {
    this.p = player;
    this.game = game;
    this.skill = clamp(skill, 0, 1);
    this.state = 'idle';
    this.path = null;
    this.pathIdx = 0;
    this.pathTime = -99;
    this.goal = null;
    this.goalKind = 'none';
    this.target = null;
    this.targetSeenAt = -99;
    this.targetLastPos = v3();
    this.reactionUntil = 0;
    this.nextThink = 0;
    this.nextPerceive = 0;
    this.aimJitter = v3();
    this.jitterPhase = rnd() * TAU;
    this.stuckTime = 0;
    this.jumpUntil = 0;
    this.strafeDir = rnd() < 0.5 ? -1 : 1;
    this.strafeUntil = 0;
    this.holdSpot = null;
    this.site = null;
    this.role = 'default';
    this.burstLeft = 0;
    this.burstPause = 0;
    this.lastEnemyDir = null;
    this.wanderTarget = null;
    this.nextGrenade = rndRange(6, 20);
    this.boredom = 0;
    this.crouchUntil = 0;
    this.blindUntil = 0;
    this.desiredYaw = player.yaw;
    this.desiredPitch = 0;

    // 技能派生参数
    const s = this.skill;
    this.reactionTime = lerp(0.50, 0.11, s);
    this.aimSpeed = lerp(2.6, 13.5, s);
    this.aimError = lerp(0.075, 0.006, s);
    this.fov = lerp(100, 155, s) * DEG;
    this.spreadMul = lerp(1.45, 0.85, s);
    this.headshotBias = lerp(0.05, 0.55, s);
    this.strafeSkill = lerp(0.15, 0.9, s);
    this.grenadeSkill = lerp(0.05, 0.75, s);
    // 感知距离刻意小于地图最长通视：否则 Bot 会在出生点就发现 60m 外的敌人并原地对枪
    this.viewRange = lerp(32, 55, s);
    player.spreadMul = this.spreadMul;
  }

  get world() { return this.game.world; }
  get nav() { return this.game.nav; }

  onFlashed(dur) {
    this.blindUntil = this.game.time + dur * 0.8;
    this.target = null;
  }

  onHurt(attacker) {
    if (!attacker || attacker.team === this.p.team) return;
    if (!this.target && attacker.alive) {
      this.targetLastPos = attacker.pos.slice();
      this.targetSeenAt = this.game.time - 0.2;
      this.state = 'hunt';
      // 转身面对来源
      const d = vsub(v3(), attacker.pos, this.p.pos);
      const a = dirToAngles(vnorm(d, d));
      this.desiredYaw = a.yaw;
      this.reactionUntil = this.game.time + this.reactionTime * 1.4;
    }
  }

  // ------------------------- 感知 ------------------------------------------

  canSee(enemy) {
    const p = this.p;
    const eye = p.eye(v3());
    const targets = [
      [enemy.pos[0], enemy.pos[1] + enemy.height * 0.62, enemy.pos[2]],
      [enemy.pos[0], enemy.pos[1] + enemy.height * 0.95, enemy.pos[2]],
      [enemy.pos[0], enemy.pos[1] + 0.25, enemy.pos[2]],
    ];
    const dist = vdist(eye, targets[0]);
    if (dist > this.viewRange) return false;
    const to = vnorm(v3(), vsub(v3(), targets[0], eye));
    const view = anglesToDir(v3(), p.yaw, p.pitch);
    const fovDot = Math.cos(this.fov * 0.5);
    if (vdot(view, to) < fovDot && dist > 3) return false;
    for (const t of targets) {
      if (!this.world.visible(eye, t)) continue;
      const occ = this.game.effects.smokeOcclusion(eye, t);
      if (occ > 0.55) continue;
      return true;
    }
    return false;
  }

  perceive(now) {
    const p = this.p;
    if (now < this.blindUntil) { this.target = null; return; }
    let best = null, bestScore = -1;
    for (const e of this.game.players) {
      if (!e.alive || e.team === p.team) continue;
      if (!this.canSee(e)) continue;
      const d = vdist(p.pos, e.pos);
      // 越近、越在准心附近优先
      const to = vnorm(v3(), vsub(v3(), e.pos, p.pos));
      const view = anglesToDir(v3(), p.yaw, p.pitch);
      const score = (1 - clamp(d / this.viewRange, 0, 1)) * 0.6 + (vdot(view, to) * 0.5 + 0.5) * 0.4;
      if (score > bestScore) { bestScore = score; best = e; }
    }
    if (best) {
      if (this.target !== best) {
        this.reactionUntil = now + this.reactionTime * rndRange(0.7, 1.3);
        this.burstLeft = 0;
      }
      this.target = best;
      this.targetSeenAt = now;
      this.targetLastPos = best.pos.slice();
    } else if (this.target) {
      if (now - this.targetSeenAt > 1.2) this.target = null;
    }
  }

  // ------------------------- 目标决策 --------------------------------------

  chooseObjective() {
    const g = this.game;
    const p = this.p;
    const m = g.match;
    if (g.mode === 'dm') {
      // 死斗：找最近的敌人或随机游走
      let near = null, nd = 1e9;
      for (const e of g.players) {
        if (!e.alive || e.team === p.team) continue;
        const d = vdist(p.pos, e.pos);
        if (d < nd) { nd = d; near = e; }
      }
      if (near) { this.setGoal(near.pos, 'enemy'); return; }
      this.wander();
      return;
    }
    if (p.team === 't') {
      if (m.bombPlanted) {
        // 守包
        const spot = this.holdSpot || this.pickHoldSpot(m.bombPos, 9);
        this.holdSpot = spot;
        this.setGoal(spot, 'hold');
        return;
      }
      if (p.inv.c4) {
        const site = this.site || g.tSiteTarget || (g.world.bombsites[0] && g.world.bombsites[0].name);
        const s = g.world.bombsites.find((x) => x.name === site) || g.world.bombsites[0];
        if (s) { this.setGoal(s.center, 'plant'); return; }
      }
      // 没包：跟随包点推进
      const carrier = g.players.find((x) => x.alive && x.inv.c4 && x.team === 't');
      const site = this.site || g.tSiteTarget;
      const s = g.world.bombsites.find((x) => x.name === site) || g.world.bombsites[0];
      if (s) {
        // 已在包点附近就守角
        if (vdistXZ(p.pos, s.center) < 8) {
          const spot = this.holdSpot || this.pickHoldSpot(s.center, 8);
          this.holdSpot = spot;
          this.setGoal(spot, 'hold');
        } else {
          this.setGoal(s.center, 'push');
        }
        return;
      }
      this.wander();
    } else {
      // CT
      if (m.bombPlanted && m.bombPos) {
        this.setGoal(m.bombPos, 'defuse');
        return;
      }
      const site = this.site || (g.world.bombsites[0] && g.world.bombsites[0].name);
      const s = g.world.bombsites.find((x) => x.name === site) || g.world.bombsites[0];
      if (s) {
        if (vdistXZ(p.pos, s.center) < 10) {
          const spot = this.holdSpot || this.pickHoldSpot(s.center, 11);
          this.holdSpot = spot;
          this.setGoal(spot, 'hold');
        } else {
          this.setGoal(s.center, 'defend');
        }
        return;
      }
      this.wander();
    }
  }

  /** 在目标附近找一个能看到目标的驻守点 */
  pickHoldSpot(center, radius) {
    const nav = this.nav;
    for (let i = 0; i < 26; i++) {
      const ang = rnd() * TAU;
      const r = rndRange(radius * 0.35, radius);
      const pt = [center[0] + Math.cos(ang) * r, center[1] + 1, center[2] + Math.sin(ang) * r];
      const idx = nav.nearest(pt, 4);
      if (idx < 0) continue;
      const n = nav.nodes[idx];
      const eye = [n.x, n.y + MOVE.eyeStand, n.z];
      if (!this.world.visible(eye, [center[0], center[1] + 1.0, center[2]])) continue;
      if (vdistXZ([n.x, n.y, n.z], center) < 1.5) continue;
      return [n.x, n.y, n.z];
    }
    const idx = nav.nearest(center, 6);
    return idx >= 0 ? [nav.nodes[idx].x, nav.nodes[idx].y, nav.nodes[idx].z] : center.slice();
  }

  wander() {
    if (!this.wanderTarget || vdistXZ(this.p.pos, this.wanderTarget) < 2.5) {
      const nodes = this.nav.nodes;
      if (!nodes.length) return;
      const n = nodes[Math.floor(rnd() * nodes.length)];
      this.wanderTarget = [n.x, n.y, n.z];
    }
    this.setGoal(this.wanderTarget, 'wander');
  }

  setGoal(pos, kind) {
    const changed = !this.goal || vdistXZ(this.goal, pos) > 2.0 || kind !== this.goalKind;
    if (changed) {
      this.goal = pos.slice();
      this.goalKind = kind;
      this.repath();
    }
  }

  repath() {
    const now = this.game.time;
    if (now - this.pathTime < 0.35) return;
    this.pathTime = now;
    if (!this.goal) return;
    const path = this.nav.findPath(this.p.pos, this.goal);
    if (path && path.length) {
      this.path = path;
      this.pathIdx = 0;
      // 跳过起点附近的点
      while (this.pathIdx < path.length - 1 && vdistXZ(this.p.pos, path[this.pathIdx]) < 0.6) this.pathIdx++;
    } else {
      this.path = null;
    }
  }

  // ------------------------- 主更新 ----------------------------------------

  update(dt) {
    const p = this.p;
    const g = this.game;
    const now = g.time;
    const cmd = { forward: 0, side: 0, jump: false, duck: false, walk: false };
    if (!p.alive) return cmd;

    if (now >= this.nextPerceive) {
      this.nextPerceive = now + 0.08 + rnd() * 0.05;
      this.perceive(now);
    }

    const frozen = g.match.phase === 'freeze';
    if (frozen) {
      this.buyPhase();
      // 冻结时间只转头看看
      this.desiredYaw = p.viewYaw + Math.sin(now * 0.6 + this.jitterPhase) * 0.5;
      this.desiredPitch = 0;
      this.applyAim(dt, false);
      return cmd;
    }

    if (now >= this.nextThink) {
      this.nextThink = now + 0.25 + rnd() * 0.2;
      if (!this.target || now - this.targetSeenAt > 1.5) this.chooseObjective();
      // 偶尔换驻守点
      this.boredom += 1;
      if (this.boredom > rndRange(22, 45)) { this.boredom = 0; this.holdSpot = null; }
    }

    const engaging = this.target && this.target.alive && now - this.targetSeenAt < 0.9;

    if (now < this.blindUntil) {
      // 被闪：原地或后退，偶尔乱扫
      cmd.forward = -0.4;
      cmd.walk = true;
      this.desiredPitch = 0;
      if (this.skill > 0.5 && this.lastEnemyDir && rnd() < 0.02) {
        this.fireIfReady(now, true);
      }
      this.applyAim(dt, false);
      return cmd;
    }

    if (engaging) {
      this.combat(dt, cmd, now);
    } else {
      this.navigate(dt, cmd, now);
      // 搜索最后已知位置
      if (this.target && now - this.targetSeenAt < 3.5) {
        const to = vsub(v3(), this.targetLastPos, p.eye(v3()));
        const a = dirToAngles(vnorm(to, to));
        this.desiredYaw = a.yaw;
        this.desiredPitch = a.pitch * 0.6;
      }
      this.reloadIfIdle(now);
    }

    // 目标行为（下包/拆包）
    this.objectiveAction(cmd, now);
    this.applyAim(dt, engaging);
    return cmd;
  }

  // ------------------------- 战斗 ------------------------------------------

  combat(dt, cmd, now) {
    const p = this.p;
    const t = this.target;
    const eye = p.eye(v3());
    const dist = vdist(p.pos, t.pos);
    const def = activeDef(p);
    const w = WEAPONS[activeId(p)];

    // 瞄点：按技能偏向头部
    const aimHead = rnd() < this.headshotBias;
    const aimY = t.pos[1] + t.height * (aimHead ? 0.90 : 0.62);
    const lead = 0.06 * (1 - this.skill) + 0.04;
    const aimPoint = [
      t.pos[0] + t.vel[0] * lead,
      aimY,
      t.pos[2] + t.vel[2] * lead,
    ];
    const to = vsub(v3(), aimPoint, eye);
    const a = dirToAngles(vnorm(to, to));
    this.desiredYaw = a.yaw;
    this.desiredPitch = a.pitch;
    this.lastEnemyDir = [Math.cos(a.yaw), 0, Math.sin(a.yaw)];

    // 近战自动换枪
    if (!w || w.class === 'knife') {
      if (p.inv.primary) selectSlot(p, 'primary', now);
      else if (p.inv.secondary) selectSlot(p, 'secondary', now);
    }
    // 弹药空了换枪/换弹
    const ammo = p.ammo[activeId(p)];
    if (ammo && ammo.mag <= 0) {
      if (ammo.reserve > 0) requestReload(p, now);
      else if (p.inv.secondary && p.active !== 'secondary' && (p.ammo[p.inv.secondary] || {}).mag > 0) selectSlot(p, 'secondary', now);
      else if (dist < 2.5) selectSlot(p, 'melee', now);
    }

    // 开镜狙击
    if (w && w.zoom && dist > 14 && p.wpn.zoom === 0 && this.skill > 0.4) {
      tryFire(this.game, p, now, 'secondary');
    } else if (w && w.zoom && dist < 8 && p.wpn.zoom > 0) {
      tryFire(this.game, p, now, 'secondary');
    }

    // 移动：中距离站定输出，远距离边走边打，近距离左右拉扯
    const isSniper = w && w.class === 'sniper';
    const tooFar = dist > 26 && !isSniper;
    if (tooFar) {
      // 远距离不要站着当靶子：继续朝目标点推进
      this.navigate(dt, cmd, now);
    } else if ((dist > 8 || isSniper) && this.skill > 0.35) {
      cmd.forward = 0; cmd.side = 0;
      if (rnd() < 0.01) this.strafeUntil = now + rndRange(0.15, 0.35);
    } else {
      if (now > this.strafeUntil) {
        this.strafeUntil = now + rndRange(0.4, 1.1);
        this.strafeDir = rnd() < 0.5 ? -1 : 1;
      }
      cmd.side = this.strafeDir * (0.55 + this.strafeSkill * 0.45);
      const ideal = isSniper ? 20 : (w && w.class === 'shotgun' ? 4 : 9);
      cmd.forward = clamp((dist - ideal) * 0.35, -1, 1);
      if (this.isBlocked(cmd, 0.9)) { this.strafeDir *= -1; cmd.side *= -1; }
    }
    if (dist < 1.8 && (!w || w.class === 'knife')) cmd.forward = 1;

    // 蹲射
    if (this.skill > 0.55 && dist > 12 && dist < 26 && rnd() < 0.012) this.crouchUntil = now + rndRange(0.6, 1.6);
    if (now < this.crouchUntil) cmd.duck = true;

    // 队友挡枪不开火；超远距离用步枪也别浪费子弹
    const clear = this.friendlyFireClear(eye, aimPoint);
    const aligned = this.aimAligned(aimPoint, eye, dist);
    const inWeaponRange = isSniper || dist < 34 || this.skill > 0.8;
    if (now >= this.reactionUntil && clear && aligned && inWeaponRange) {
      this.fireIfReady(now, false);
    }
    // 投掷物
    this.maybeGrenade(now, dist);
  }

  aimAligned(aimPoint, eye, dist) {
    const p = this.p;
    const view = anglesToDir(v3(), p.yaw, p.pitch);
    const to = vnorm(v3(), vsub(v3(), aimPoint, eye));
    const dot = vdot(view, to);
    // 允许的角度误差随距离缩小
    const tol = Math.cos(clamp(0.055 + 1.2 / Math.max(dist, 1) * 0.06 + this.aimError * 1.5, 0.008, 0.4));
    return dot > tol;
  }

  friendlyFireClear(eye, aimPoint) {
    const dir = vnorm(v3(), vsub(v3(), aimPoint, eye));
    const dist = vdist(eye, aimPoint);
    for (const m of this.game.players) {
      if (m === this.p || !m.alive || m.team !== this.p.team) continue;
      const rel = vsub(v3(), [m.pos[0], m.pos[1] + m.height * 0.6, m.pos[2]], eye);
      const proj = vdot(rel, dir);
      if (proj < 0.4 || proj > dist) continue;
      const perp = Math.sqrt(Math.max(0, vdot(rel, rel) - proj * proj));
      if (perp < 0.6) return false;
    }
    return true;
  }

  fireIfReady(now, blindFire) {
    const p = this.p;
    const w = WEAPONS[activeId(p)];
    if (!w) return;
    if (w.class === 'knife') { tryFire(this.game, p, now, 'primary'); return; }
    if (w.auto) {
      // 点射纪律：高技能打短点射
      if (this.burstPause > now) return;
      if (this.burstLeft <= 0) {
        const dist = this.target ? vdist(p.pos, this.target.pos) : 10;
        const long = dist > 16;
        const maxBurst = long ? (this.skill > 0.6 ? 2 : 4) : (this.skill > 0.6 ? 7 : 12);
        this.burstLeft = Math.max(1, Math.round(maxBurst * rndRange(0.7, 1.3)));
      }
      const r = tryFire(this.game, p, now, 'primary');
      if (r.fired) {
        this.burstLeft--;
        if (this.burstLeft <= 0) this.burstPause = now + rndRange(0.10, 0.32) * (1.6 - this.skill);
      }
    } else {
      // 半自动：按射速节奏点
      const r = tryFire(this.game, p, now, 'primary');
      if (r.fired) this.burstPause = now + rndRange(0.02, 0.14) * (1.6 - this.skill);
    }
  }

  maybeGrenade(now, dist) {
    const p = this.p;
    if (this.grenadeSkill < 0.2 || totalGrenades(p) === 0) return;
    if (now < this.nextGrenade) return;
    if (dist < 6 || dist > 26) return;
    if (rnd() > this.grenadeSkill * 0.35) { this.nextGrenade = now + rndRange(4, 9); return; }
    const have = Object.keys(p.inv.grenades).filter((k) => p.inv.grenades[k] > 0);
    if (!have.length) return;
    const pick = have.includes('he') ? 'he' : rndPick(have);
    // 直接朝目标方向抛
    if (this.target) {
      const to = vsub(v3(), this.targetLastPos, p.eye(v3()));
      const a = dirToAngles(vnorm(to, to));
      p.viewYaw = a.yaw;
      p.viewPitch = clamp(a.pitch + 0.13 + dist * 0.004, -0.5, 0.6);
      p.yaw = p.viewYaw; p.pitch = p.viewPitch;
      this.game.grenades.throwGrenade(p, pick, clamp(dist / 22, 0.4, 1));
      this.nextGrenade = now + rndRange(10, 25);
    }
  }

  reloadIfIdle(now) {
    const p = this.p;
    const id = activeId(p);
    const w = WEAPONS[id];
    const a = p.ammo[id];
    if (!w || !a) return;
    if (w.magSize && a.mag < w.magSize * 0.45 && a.reserve > 0) requestReload(p, now);
    if (!p.inv.primary && p.inv.secondary && p.active === 'melee') selectSlot(p, 'secondary', now);
    if (p.inv.primary && p.active !== 'primary' && !p.inv.c4Planting) {
      const pa = p.ammo[p.inv.primary];
      if (pa && pa.mag > 0) selectSlot(p, 'primary', now);
    }
  }

  // ------------------------- 导航 ------------------------------------------

  isBlocked(cmd, dist) {
    const p = this.p;
    const yaw = p.yaw;
    const wx = Math.cos(yaw) * cmd.forward - Math.sin(yaw) * cmd.side;
    const wz = Math.sin(yaw) * cmd.forward + Math.cos(yaw) * cmd.side;
    const l = Math.hypot(wx, wz);
    if (l < 0.01) return false;
    const o = [p.pos[0], p.pos[1] + 0.55, p.pos[2]];
    const h = this.world.traceRay(o, [wx / l, 0, wz / l], dist);
    return !!h;
  }

  navigate(dt, cmd, now) {
    const p = this.p;
    if (!this.path || this.pathIdx >= this.path.length) {
      if (this.goal) {
        if (vdistXZ(p.pos, this.goal) > 1.5 && now - this.pathTime > 0.8) this.repath();
        else { cmd.forward = 0; return; }
      }
      if (!this.path) return;
    }
    let wp = this.path[this.pathIdx];
    // 到达当前路点
    while (wp && vdistXZ(p.pos, wp) < 0.75 && Math.abs(wp[1] - p.pos[1]) < 1.3) {
      this.pathIdx++;
      wp = this.path[this.pathIdx];
    }
    if (!wp) {
      cmd.forward = 0;
      // 到达目的地
      if (this.goalKind === 'hold') this.lookAround(now);
      return;
    }
    const dx = wp[0] - p.pos[0], dz = wp[2] - p.pos[2];
    const l = Math.hypot(dx, dz);
    if (l > 0.001) {
      const wx = dx / l, wz = dz / l;
      const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
      cmd.forward = wx * cy + wz * sy;
      cmd.side = -wx * sy + wz * cy;
      const m = Math.hypot(cmd.forward, cmd.side);
      if (m > 1) { cmd.forward /= m; cmd.side /= m; }
    }
    // 前进时朝路径方向看（没有敌人时）
    if (!this.target) {
      const look = this.path[Math.min(this.path.length - 1, this.pathIdx + 1)] || wp;
      const ang = Math.atan2(look[2] - p.pos[2], look[0] - p.pos[0]);
      this.desiredYaw = ang;
      this.desiredPitch = lerp(this.desiredPitch, 0, 0.1);
    }
    // 需要往上走 -> 跳
    if (wp[1] - p.pos[1] > 0.5 && p.onGround) cmd.jump = true;

    // 卡住检测
    const speed = Math.hypot(p.vel[0], p.vel[2]);
    if (speed < 0.55 && (Math.abs(cmd.forward) + Math.abs(cmd.side)) > 0.2) {
      this.stuckTime += dt;
      if (this.stuckTime > 0.35) {
        cmd.jump = true;
        cmd.side += this.strafeDir * 0.8;
        if (this.stuckTime > 0.9) {
          this.strafeDir *= -1;
          this.stuckTime = 0;
          this.pathTime = -99;
          this.repath();
        }
      }
    } else {
      this.stuckTime = Math.max(0, this.stuckTime - dt * 2);
    }
    // 静步靠近包点
    if (this.goalKind === 'hold' && vdistXZ(p.pos, this.goal || p.pos) < 6) cmd.walk = true;
  }

  lookAround(now) {
    // 驻守时缓慢扫视要道
    const t = now * 0.35 + this.jitterPhase;
    const base = this.holdLookYaw !== undefined ? this.holdLookYaw : this.computeHoldLook();
    this.desiredYaw = base + Math.sin(t) * 0.55;
    this.desiredPitch = Math.sin(t * 0.7) * 0.06;
  }

  computeHoldLook() {
    const g = this.game;
    const p = this.p;
    let look = p.yaw;
    const m = g.match;
    if (p.team === 'ct') {
      // 面朝 T 出生点方向
      const sp = g.map.spawns.t[0];
      look = Math.atan2(sp.pos[2] - p.pos[2], sp.pos[0] - p.pos[0]);
    } else if (m.bombPlanted && m.bombPos) {
      const sp = g.map.spawns.ct[0];
      look = Math.atan2(sp.pos[2] - p.pos[2], sp.pos[0] - p.pos[0]);
    } else {
      const sp = g.map.spawns.ct[0];
      look = Math.atan2(sp.pos[2] - p.pos[2], sp.pos[0] - p.pos[0]);
    }
    this.holdLookYaw = look;
    return look;
  }

  // ------------------------- 下包 / 拆包 -----------------------------------

  objectiveAction(cmd, now) {
    const p = this.p;
    const g = this.game;
    const m = g.match;
    if (g.mode !== 'bomb') return;
    if (p.team === 't' && p.inv.c4 && !m.bombPlanted) {
      const site = g.world.bombsiteAt(p.pos);
      if (site && p.onGround) {
        cmd.forward = 0; cmd.side = 0;
        m.tryPlant(p, true);
        return;
      }
    }
    if (p.team === 'ct' && m.bombPlanted && m.bombPos) {
      const d = vdistXZ(p.pos, m.bombPos);
      if (d < 1.5) {
        cmd.forward = 0; cmd.side = 0;
        cmd.duck = true;
        // 看向炸弹
        const to = vsub(v3(), m.bombPos, p.eye(v3()));
        const a = dirToAngles(vnorm(to, to));
        this.desiredYaw = a.yaw;
        this.desiredPitch = a.pitch;
        m.tryDefuse(p, true);
      }
    }
  }

  // ------------------------- 瞄准平滑 --------------------------------------

  applyAim(dt, engaging) {
    const p = this.p;
    // 拟人抖动
    this.jitterPhase += dt * (1.2 + this.skill);
    const wob = this.aimError * (engaging ? 1 : 0.35);
    const jx = Math.sin(this.jitterPhase * 1.7) * wob + gauss() * wob * 0.6;
    const jy = Math.cos(this.jitterPhase * 1.3) * wob * 0.7 + gauss() * wob * 0.4;

    const dy = angleDelta(p.viewYaw, this.desiredYaw + jx);
    const dp = (this.desiredPitch + jy) - p.viewPitch;
    const speed = this.aimSpeed * (engaging ? 1 : 0.55);
    const k = 1 - Math.exp(-speed * dt);
    p.viewYaw += dy * k;
    p.viewPitch = clamp(p.viewPitch + dp * k, -85 * DEG, 85 * DEG);
  }

  // ------------------------- 购买 ------------------------------------------

  buyPhase() {
    const p = this.p;
    if (this.bought) return;
    const g = this.game;
    if (!g.world.inBuyzone(p.pos, p.team)) return;
    this.bought = true;
    const money = p.money;
    const t = p.team === 't';
    const buy = (id) => g.buy(p, id, true);

    // 主武器
    if (!p.inv.primary) {
      if (money >= 5200 && rnd() < 0.18 + this.skill * 0.12) buy('awp');
      else if (money >= 3700) buy(t ? 'ak47' : (rnd() < 0.5 ? 'm4a4' : 'm4a1s'));
      else if (money >= 2900) buy(t ? 'ak47' : 'm4a4');
      else if (money >= 2100) buy(t ? 'galil' : 'famas');
      else if (money >= 1500) buy(rnd() < 0.5 ? 'mac10' : (t ? 'mac10' : 'mp9'));
      else if (money >= 1100) buy(t ? 'tec9' : 'fiveseven');
      else if (money >= 700 && rnd() < 0.5) buy('p250');
    }
    // 护甲
    if (p.armor <= 0) {
      if (p.money >= 1000 && (p.inv.primary || p.money > 2200)) buy('kevlarhelm');
      else if (p.money >= 650) buy('kevlar');
    }
    // 拆弹器
    if (!t && !p.inv.kit && p.money >= 400 && rnd() < 0.55) buy('defusekit');
    // 投掷物
    if (p.money >= 300 && rnd() < 0.75) buy('flash');
    if (p.money >= 300 && rnd() < 0.6) buy('he');
    if (p.money >= 300 && rnd() < 0.35) buy('smoke');
    if (p.money >= 200 && rnd() < 0.35) buy('flash');
    if (p.money >= 600 && rnd() < 0.2) buy(t ? 'molotov' : 'incgrenade');
  }

  resetForRound() {
    this.bought = false;
    this.state = 'idle';
    this.path = null;
    this.goal = null;
    this.goalKind = 'none';
    this.target = null;
    this.holdSpot = null;
    this.holdLookYaw = undefined;
    this.blindUntil = 0;
    this.boredom = 0;
    this.nextGrenade = this.game.time + rndRange(5, 18);
    this.wanderTarget = null;
  }
}
