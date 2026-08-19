// ---------------------------------------------------------------------------
// 玩家实体（真人与 Bot 共用）：状态、移动、脚步、受伤、复活
// ---------------------------------------------------------------------------

import { MOVE, moveEntity, eyePos, unstick } from './movement.js';
import {
  emptyInventory, initWeaponState, updateWeapons, applyPunch, maxSpeedOf,
  activeId, activeDef, refillAmmo,
} from './weapons.js';
import { updateCharacterAnim } from '../render/models.js';
import { v3, clamp, lerp, damp, DEG, angleDelta, rnd, rndRange, vdist } from '../core/math.js';
import { surfaceInfo } from './world.js';

let nextId = 1;

export const TEAM_COLORS = {
  t: { cloth: [0.42, 0.32, 0.18, 1], cloth2: [0.26, 0.20, 0.12, 1], accent: '#e0a83c' },
  ct: { cloth: [0.20, 0.28, 0.42, 1], cloth2: [0.13, 0.18, 0.28, 1], accent: '#6ba8e8' },
};

export class Player {
  constructor(opts = {}) {
    this.id = opts.id || nextId++;
    this.name = opts.name || 'Player';
    this.team = opts.team || 't';
    this.isBot = !!opts.isBot;
    this.isLocal = !!opts.isLocal;
    this.skill = opts.skill === undefined ? 0.6 : opts.skill;

    this.pos = v3(0, 0, 0);
    this.vel = v3(0, 0, 0);
    this.yaw = 0; this.pitch = 0;
    this.viewYaw = 0; this.viewPitch = 0;
    this.renderYaw = 0;
    this.height = MOVE.standHeight;
    this.eyeHeight = MOVE.eyeStand;
    this.duckFrac = 0;
    this.ducking = false;
    this.onGround = false;
    this.jumpTimer = 0;
    this.maxSpeed = MOVE.maxSpeedDefault;
    this.groundMat = 'concrete';

    this.alive = false;
    this.health = 100;
    this.armor = 0;
    this.helmet = false;
    this.money = 800;
    this.kills = 0; this.deaths = 0; this.assists = 0;
    this.score = 0; this.mvps = 0; this.damageDealt = 0;
    this.roundKills = 0;

    this.inv = emptyInventory(this.team);
    initWeaponState(this);
    this.lastSlot = 'melee';

    this.flash = 0;            // 0..1 致盲强度
    this.flashTime = 0;
    this.deafen = 0;
    this.stepDist = 0;
    this.anim = { cycle: 0, speedNorm: 0, deathT: 0, deathDir: 1 };
    this.lastAttacker = null;
    this.lastDamageTime = -99;
    this.spawnTime = 0;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.burning = 0;
    this.speedPenalty = 1;
    this.viewOffset = v3(0, 0, 0);
    this.bobPhase = 0;
    this.landDip = 0;
    this.deathPos = v3();
  }

  get colors() { return TEAM_COLORS[this.team]; }

  setTeam(team) {
    this.team = team;
    this.inv = emptyInventory(team);
    initWeaponState(this);
  }

  /** 回合开始：重置到出生点 */
  spawn(spawnPoint, now) {
    this.pos[0] = spawnPoint.pos[0];
    this.pos[1] = spawnPoint.pos[1] + 0.02;
    this.pos[2] = spawnPoint.pos[2];
    this.vel[0] = this.vel[1] = this.vel[2] = 0;
    this.viewYaw = (spawnPoint.yaw || 0) * DEG;
    this.viewPitch = 0;
    this.yaw = this.viewYaw;
    this.pitch = 0;
    this.renderYaw = this.yaw;
    this.alive = true;
    this.health = 100;
    this.duckFrac = 0;
    this.height = MOVE.standHeight;
    this.eyeHeight = MOVE.eyeStand;
    this.onGround = false;
    this.flash = 0; this.deafen = 0; this.burning = 0;
    this.anim.deathT = 0;
    this.anim.cycle = 0;
    this.spawnTime = now || 0;
    this.roundKills = 0;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.speedPenalty = 1;
    this.wpn.punch[0] = 0; this.wpn.punch[1] = 0;
    this.wpn.punchTarget[0] = 0; this.wpn.punchTarget[1] = 0;
    this.wpn.recoilIdx = 0;
    this.wpn.reloading = false;
    this.wpn.zoom = 0;
    this.wpn.nextFire = 0;
    this.wpn.drawEnd = 0;
    refillAmmo(this);
    // 优先手持主武器
    this.active = this.inv.primary ? 'primary' : (this.inv.secondary ? 'secondary' : 'melee');
  }

  /** 眼睛位置（含着地下沉/呼吸） */
  eye(out) {
    out = out || v3();
    out[0] = this.pos[0] + this.viewOffset[0];
    out[1] = this.pos[1] + this.eyeHeight + this.viewOffset[1] - this.landDip;
    out[2] = this.pos[2] + this.viewOffset[2];
    return out;
  }

  /**
   * 每帧更新。cmd: { forward, side, jump, duck, walk }
   */
  update(game, dt, cmd) {
    const now = game.time;
    if (!this.alive) {
      updateCharacterAnim(this, dt, 0);
      this.landDip = damp(this.landDip, 0, 8, dt);
      return;
    }
    applyPunch(this);
    this.maxSpeed = maxSpeedOf(this);
    this.speedPenalty = this.burning > 0 ? 0.92 : 1;

    const res = moveEntity(game.world, this, {
      forward: cmd.forward, side: cmd.side, jump: cmd.jump, duck: cmd.duck,
      walk: cmd.walk, wishYaw: this.yaw,
    }, dt);

    // 脚步声
    const speed = res.speed;
    if (this.onGround && speed > 1.1) {
      const interval = cmd.walk ? 2.35 : lerp(2.3, 1.85, clamp(speed / 5, 0, 1));
      this.stepDist += speed * dt;
      if (this.stepDist >= interval) {
        this.stepDist = 0;
        const info = surfaceInfo(this.groundMat);
        game.audio.play(info.step, {
          pos: this.isLocal ? undefined : this.pos.slice(),
          volume: (cmd.walk ? 0.28 : 0.85) * (this.isLocal ? 0.55 : 1),
          rate: rndRange(0.92, 1.09),
        });
      }
    } else if (!this.onGround) {
      this.stepDist = Math.max(this.stepDist, 1.0);
    }

    if (res.jumped) {
      game.audio.play('jump', { pos: this.isLocal ? undefined : this.pos.slice(), volume: 0.5 });
    }
    if (res.landed && res.landSpeed > 2.2) {
      const hard = res.landSpeed > MOVE.landHardSpeed;
      game.audio.play(hard ? 'land_hard' : 'land_soft', {
        pos: this.isLocal ? undefined : this.pos.slice(),
        volume: clamp(res.landSpeed / 10, 0.25, 1),
      });
      this.landDip = Math.min(0.16, res.landSpeed * 0.014);
      if (res.landSpeed > MOVE.fallDamageSpeed) {
        const dmg = Math.pow(res.landSpeed - MOVE.fallDamageSpeed, 1.65) * 4.5;
        game.applyDamage(this, null, dmg, 'leg', { name: '坠落', class: 'fall', armorPen: 1 }, this.pos.slice(), 'fall');
      }
    }
    this.landDip = damp(this.landDip, 0, 9, dt);

    // 呼吸/走动的轻微视角摆动
    this.bobPhase += dt * (2 + speed * 1.6);
    const bobAmt = clamp(speed / 5, 0, 1) * 0.012;
    this.viewOffset[1] = Math.sin(this.bobPhase * 2) * bobAmt;
    this.viewOffset[0] = Math.cos(this.bobPhase) * bobAmt * 0.6;

    // 出生点被卡住时推出
    if (res.stuck) unstick(game.world, this);

    updateWeapons(this, dt, now);

    // 致盲衰减
    if (this.flash > 0) {
      this.flashTime += dt;
      const fade = this.flashDuration > 0 ? this.flashDuration : 1;
      this.flash = clamp(1 - Math.pow(this.flashTime / fade, 1.6), 0, 1);
      if (this.flashTime >= fade) { this.flash = 0; this.flashTime = 0; }
    }
    this.deafen = Math.max(0, this.deafen - dt * 0.35);

    // 身体朝向平滑跟随视角
    const d = angleDelta(this.renderYaw, this.yaw);
    this.renderYaw += d * (1 - Math.exp(-14 * dt));
    updateCharacterAnim(this, dt, speed);
  }

  blind(duration, intensity = 1) {
    if (duration <= 0) return;
    if (duration > (this.flashDuration || 0) * (1 - this.flashTime / Math.max(0.001, this.flashDuration || 1)) || this.flash <= 0) {
      this.flashDuration = duration;
      this.flashTime = 0;
      this.flash = clamp(intensity, 0, 1);
      this.deafen = Math.max(this.deafen, clamp(intensity, 0, 1));
    }
  }

  addMoney(v, cap = 16000) {
    this.money = clamp(Math.round(this.money + v), 0, cap);
  }
}
