import { CONFIG } from '../core/config.js';

// 生存状态：生命/体力/饥饿/口渴/精力
export class Survival {
  constructor() {
    this.health = 100;
    this.stamina = { value: 100 }; // 引用对象，供 Player 修改
    this.hunger = 100;
    this.thirst = 100;
    this.energy = 100;
    this.dead = false;
    this.deathCause = '';
  }

  // gameHoursDelta: 本帧经过的游戏小时数
  update(dt, gameHoursDelta, isNight) {
    if (this.dead) return;
    const S = CONFIG.survival;

    this.hunger = Math.max(0, this.hunger - S.hungerPerHour * gameHoursDelta);
    this.thirst = Math.max(0, this.thirst - S.thirstPerHour * gameHoursDelta);
    this.energy = Math.max(0, this.energy - S.energyPerHour * gameHoursDelta * (isNight ? 1.4 : 1));

    // 饥渴惩罚
    if (this.hunger <= 0) this.damage(S.starveDps * dt, '饿死了');
    if (this.thirst <= 0) this.damage(S.starveDps * 1.4 * dt, '渴死了');

    // 状态良好时回血
    if (this.hunger > 55 && this.thirst > 55 && this.health > 0) {
      this.health = Math.min(100, this.health + S.healthRegen * dt);
    }

    // 精力耗尽减速（由 game 读取）
    this.speedFactor = this.energy < 15 ? 0.72 : 1;
  }

  damage(amount, cause) {
    if (this.dead) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.deathCause = cause || '死亡';
    }
  }

  eat(def) {
    if (def.food) this.hunger = Math.min(100, this.hunger + def.food);
    if (def.water) this.thirst = Math.min(100, this.thirst + def.water);
    if (def.health) {
      if (def.health > 0) this.health = Math.min(100, this.health + def.health);
      else this.damage(-def.health, '食物中毒');
    }
  }

  drink(amount = 100) {
    this.thirst = Math.min(100, this.thirst + amount);
  }

  sleep() {
    this.energy = 100;
    this.health = Math.min(100, this.health + 15);
  }

  serialize() {
    return {
      health: this.health, stamina: this.stamina.value,
      hunger: this.hunger, thirst: this.thirst, energy: this.energy,
    };
  }

  deserialize(d) {
    this.health = d.health ?? 100;
    this.stamina.value = d.stamina ?? 100;
    this.hunger = d.hunger ?? 100;
    this.thirst = d.thirst ?? 100;
    this.energy = d.energy ?? 100;
    this.dead = false;
  }
}
