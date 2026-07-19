import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { getHeight } from '../world/heightfield.js';
import { Audio } from '../core/audio.js';

// 第一人称玩家：视角、移动物理、游泳、碰撞
export class Player {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;

    this.position = new THREE.Vector3(0, 10, 0); // 脚底位置
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.swimming = false;
    this.speedFactor = 1; // 生存状态修正

    this.stepTimer = 0;
    this._forward = new THREE.Vector3();
  }

  get eyePos() {
    const p = this.position.clone();
    p.y += CONFIG.player.height;
    return p;
  }

  get forward() {
    this.camera.getWorldDirection(this._forward);
    return this._forward;
  }

  get forwardFlat() {
    const f = this.forward.clone();
    f.y = 0;
    return f.normalize();
  }

  teleport(x, y, z) {
    this.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
  }

  updateLook() {
    const [dx, dy] = this.input.consumeMouse();
    const sens = 0.0022;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  // trees: TreeSystem, buildings: BuildingSystem, stamina 引用对象 {value}
  updateMovement(dt, trees, buildings, stamina) {
    const P = CONFIG.player;
    const input = this.input;

    let mx = 0, mz = 0;
    if (input.down('KeyW')) mz += 1;
    if (input.down('KeyS')) mz -= 1;
    if (input.down('KeyA')) mx -= 1;
    if (input.down('KeyD')) mx += 1;

    const wantRun = input.down('ShiftLeft') && mz > 0 && stamina.value > 2;
    const moving = mx !== 0 || mz !== 0;

    const groundY = getHeight(this.position.x, this.position.z);
    const waterY = CONFIG.world.waterLevel;
    this.swimming = groundY < waterY - 0.9;

    let speed = wantRun ? P.runSpeed : P.walkSpeed;
    if (this.swimming) speed = P.swimSpeed;
    speed *= this.speedFactor;

    // 移动方向（相对视角）
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const dirX = (mx * cos - mz * sin);
    const dirZ = (-mx * sin - mz * cos);
    const len = Math.hypot(dirX, dirZ) || 1;

    const accel = this.onGround || this.swimming ? 22 : 5;
    this.velocity.x += (dirX / len) * (moving ? 1 : 0) * accel * speed * dt / 4.6;
    this.velocity.z += (dirZ / len) * (moving ? 1 : 0) * accel * speed * dt / 4.6;

    // 阻尼
    const damp = this.onGround || this.swimming ? Math.exp(-9 * dt) : Math.exp(-1.2 * dt);
    this.velocity.x *= damp;
    this.velocity.z *= damp;

    // 限速
    const hSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (hSpeed > speed) {
      this.velocity.x *= speed / hSpeed;
      this.velocity.z *= speed / hSpeed;
    }

    if (this.swimming) {
      // 漂浮在水面
      this.velocity.y = 0;
      this.position.y = waterY - 1.15;
      this.onGround = false;
    } else {
      this.velocity.y -= P.gravity * dt;
      if (this.onGround && input.down('Space')) {
        this.velocity.y = P.jumpSpeed;
        this.onGround = false;
      }
    }

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    // 世界边界
    const limit = CONFIG.world.size * 0.58;
    this.position.x = Math.max(-limit, Math.min(limit, this.position.x));
    this.position.z = Math.max(-limit, Math.min(limit, this.position.z));

    // 地形碰撞
    const gy = getHeight(this.position.x, this.position.z);
    if (!this.swimming && this.position.y <= gy) {
      this.position.y = gy;
      this.velocity.y = 0;
      this.onGround = true;
    } else if (!this.swimming) {
      this.onGround = this.position.y - gy < 0.05;
    }

    // 树木碰撞（圆形推挤）
    if (trees) {
      const pr = P.radius + 0.35;
      for (const t of trees.trees) {
        if (!t.alive) continue;
        const dx = this.position.x - t.x;
        const dz = this.position.z - t.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < pr * pr && d2 > 0.0001) {
          if (Math.abs(this.position.y - t.y) < 8) {
            const d = Math.sqrt(d2);
            const push = (pr - d) / d;
            this.position.x += dx * push;
            this.position.z += dz * push;
          }
        }
      }
    }

    // 建筑碰撞
    if (buildings) buildings.collide(this.position, P.radius);

    // 体力消耗/恢复
    if (wantRun && moving) {
      stamina.value = Math.max(0, stamina.value - CONFIG.survival.staminaRun * dt);
    } else {
      stamina.value = Math.min(100, stamina.value + CONFIG.survival.staminaRegen * dt);
    }

    // 脚步声
    if (moving && (this.onGround || this.swimming)) {
      this.stepTimer -= dt * (wantRun ? 1.7 : 1);
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.42;
        const onSand = gy < CONFIG.world.beachLevel;
        if (this.swimming) {
          Audio.playRandom(['step_snow_0', 'step_snow_1'], { volume: 0.3, rate: 0.7 });
        } else if (onSand) {
          Audio.playRandom(['step_snow_0', 'step_snow_1'], { volume: 0.45 });
        } else {
          Audio.playRandom(['step_grass_0', 'step_grass_1', 'step_grass_2', 'step_grass_3'], { volume: 0.5 });
        }
      }
    }

    // 相机放置
    this.camera.position.copy(this.position);
    this.camera.position.y += this.swimming ? 1.35 : CONFIG.player.height;
    // 行走轻微晃动
    if (moving && this.onGround) {
      const bob = Math.sin(performance.now() * 0.011 * (wantRun ? 1.5 : 1)) * (wantRun ? 0.05 : 0.028);
      this.camera.position.y += bob;
    }
  }
}
