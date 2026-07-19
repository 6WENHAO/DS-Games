import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { Assets } from '../core/assets.js';
import { getHeight } from '../world/heightfield.js';
import { Audio } from '../core/audio.js';

// 食人族：程序化人形（泥肤纹理）+ 关节程序动画 + 状态机 AI
let skinMat = null, clothMat = null, eyeMat = null;

function ensureMats() {
  if (skinMat) return;
  skinMat = new THREE.MeshStandardMaterial({
    map: Assets.tex('dirt_col'),
    color: new THREE.Color(0.82, 0.66, 0.54), // 泥污的苍白皮肤
    roughness: 0.95,
  });
  clothMat = new THREE.MeshStandardMaterial({
    map: Assets.tex('bark_col'),
    color: new THREE.Color(0.5, 0.42, 0.35),
    roughness: 1,
  });
  eyeMat = new THREE.MeshStandardMaterial({
    map: Assets.tex('dirt_col'),
    color: new THREE.Color(2.2, 2.0, 1.6), // 惨白发亮的眼
    roughness: 0.4,
  });
}

function limb(rx, ry, len, mat) {
  // 关节组 + 圆柱肢体（原点在关节处，向下延伸）
  const joint = new THREE.Group();
  const geo = new THREE.CylinderGeometry(rx, ry, len, 6);
  geo.translate(0, -len / 2, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  joint.add(mesh);
  return joint;
}

export class Cannibal {
  constructor(scene, x, z) {
    ensureMats();
    this.scene = scene;
    this.hp = CONFIG.enemies.hp;
    this.state = 'stalk'; // wander | stalk | attack | dead
    this.attackTimer = 0;
    this.hitFlash = 0;
    this.dead = false;
    this.deathTimer = 0;
    this._animT = Math.random() * 10;

    // ---- 骨架 ----
    this.root = new THREE.Group(); // 位于地面
    this.pelvis = new THREE.Group();
    this.pelvis.position.y = 0.96;
    this.root.add(this.pelvis);

    const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.22, 7), clothMat);
    hips.castShadow = true;
    this.pelvis.add(hips);

    this.torso = new THREE.Group();
    this.torso.position.y = 0.12;
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.52, 7), skinMat);
    chest.position.y = 0.34;
    chest.castShadow = true;
    this.torso.add(chest);
    this.pelvis.add(this.torso);

    this.head = new THREE.Group();
    this.head.position.y = 0.68;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skinMat);
    skull.position.y = 0.1;
    skull.scale.set(1, 1.15, 1.05);
    skull.castShadow = true;
    this.head.add(skull);
    // 双眼
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), eyeMat);
      eye.position.set(sx * 0.05, 0.12, 0.115);
      this.head.add(eye);
    }
    this.torso.add(this.head);

    // 手臂
    this.armL = limb(0.05, 0.04, 0.34, skinMat);
    this.armL.position.set(-0.24, 0.58, 0);
    this.foreL = limb(0.04, 0.03, 0.3, skinMat);
    this.foreL.position.y = -0.34;
    this.armL.add(this.foreL);
    this.torso.add(this.armL);

    this.armR = limb(0.05, 0.04, 0.34, skinMat);
    this.armR.position.set(0.24, 0.58, 0);
    this.foreR = limb(0.04, 0.03, 0.3, skinMat);
    this.foreR.position.y = -0.34;
    this.armR.add(this.foreR);
    this.torso.add(this.armR);

    // 腿
    this.legL = limb(0.07, 0.05, 0.46, skinMat);
    this.legL.position.set(-0.11, -0.1, 0);
    this.shinL = limb(0.05, 0.04, 0.44, skinMat);
    this.shinL.position.y = -0.46;
    this.legL.add(this.shinL);
    this.pelvis.add(this.legL);

    this.legR = limb(0.07, 0.05, 0.46, skinMat);
    this.legR.position.set(0.11, -0.1, 0);
    this.shinR = limb(0.05, 0.04, 0.44, skinMat);
    this.shinR.position.y = -0.46;
    this.legR.add(this.shinR);
    this.pelvis.add(this.legR);

    this.root.position.set(x, getHeight(x, z), z);
    scene.add(this.root);

    this.wanderAngle = Math.random() * Math.PI * 2;
    this.wanderTimer = 0;
  }

  get position() { return this.root.position; }

  takeDamage(dmg, fromDir) {
    if (this.dead) return;
    this.hp -= dmg;
    this.hitFlash = 0.25;
    Audio.playAt('impact_punch', this.position, { volume: 0.9, maxDist: 30 });
    // 击退
    this.root.position.x += fromDir.x * 0.6;
    this.root.position.z += fromDir.z * 0.6;
    if (this.hp <= 0) {
      this.dead = true;
      this.state = 'dead';
      this.deathTimer = 0;
      Audio.playAt('impact_soft_2', this.position, { volume: 1, maxDist: 30 });
    }
  }

  // 返回 'attack_hit' 表示本帧命中玩家
  update(dt, playerPos, isNight, buildings) {
    const E = CONFIG.enemies;
    this._animT += dt;

    if (this.dead) {
      this.deathTimer += dt;
      // 倒地 + 沉没消失
      this.root.rotation.x = Math.min(Math.PI / 2, this.deathTimer * 2.2);
      if (this.deathTimer > 4) {
        this.root.position.y -= dt * 0.4;
      }
      return this.deathTimer > 7 ? 'remove' : null;
    }

    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      skinMat.emissive.setRGB(0.4, 0.05, 0.02);
    } else {
      skinMat.emissive.setRGB(0, 0, 0);
    }

    const dx = playerPos.x - this.root.position.x;
    const dz = playerPos.z - this.root.position.z;
    const distSq = dx * dx + dz * dz;
    const dist = Math.sqrt(distSq);
    const aggroRange = isNight ? E.nightAggroRange : E.aggroRange;

    let result = null;
    let moveSpeed = 0;
    let targetAngle = this.wanderAngle;

    switch (this.state) {
      case 'wander': {
        this.wanderTimer -= dt;
        if (this.wanderTimer <= 0) {
          this.wanderTimer = 2 + Math.random() * 4;
          this.wanderAngle = Math.random() * Math.PI * 2;
        }
        moveSpeed = E.speed * 0.45;
        if (dist < aggroRange) this.state = 'stalk';
        break;
      }
      case 'stalk': {
        targetAngle = Math.atan2(dx, dz);
        // 蛇形接近
        targetAngle += Math.sin(this._animT * 1.3) * (dist > 14 ? 0.55 : 0.12);
        moveSpeed = dist > 22 ? E.runSpeed : E.speed;
        if (dist < E.attackRange) {
          this.state = 'attack';
          this.attackTimer = 0;
        }
        if (dist > aggroRange * 1.4) this.state = 'wander';
        break;
      }
      case 'attack': {
        targetAngle = Math.atan2(dx, dz);
        this.attackTimer += dt;
        if (this.attackTimer > 0.85) {
          this.attackTimer = 0;
          if (dist < E.attackRange + 0.4) {
            result = 'attack_hit';
          }
        }
        if (dist > E.attackRange + 0.9) this.state = 'stalk';
        break;
      }
    }

    // 移动
    if (moveSpeed > 0) {
      const nx = this.root.position.x + Math.sin(targetAngle) * moveSpeed * dt;
      const nz = this.root.position.z + Math.cos(targetAngle) * moveSpeed * dt;
      this.root.position.x = nx;
      this.root.position.z = nz;
    }
    if (buildings) buildings.collide(this.root.position, 0.4);
    this.root.position.y = getHeight(this.root.position.x, this.root.position.z);

    // 朝向
    const facing = Math.atan2(dx, dz);
    if (this.state !== 'wander') {
      this.root.rotation.y = facing;
    } else {
      this.root.rotation.y = this.wanderAngle;
    }

    // ---- 程序动画 ----
    const speedFactor = moveSpeed / E.runSpeed;
    const gait = this._animT * (6 + speedFactor * 8);
    const swing = Math.sin(gait) * (0.35 + speedFactor * 0.5);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.shinL.rotation.x = Math.max(0, -Math.sin(gait)) * 0.8;
    this.shinR.rotation.x = Math.max(0, Math.sin(gait)) * 0.8;

    if (this.state === 'attack') {
      const p = this.attackTimer / 0.85;
      // 抬手挥砍
      this.armR.rotation.x = p < 0.5 ? -2.4 * (p * 2) : -2.4 + 3.4 * ((p - 0.5) * 2);
      this.armL.rotation.x = -0.4;
      this.torso.rotation.x = 0.28;
    } else {
      this.armL.rotation.x = -swing * 0.8 + 0.25;
      this.armR.rotation.x = swing * 0.8 + 0.25;
      this.foreL.rotation.x = -0.5;
      this.foreR.rotation.x = -0.5;
      // 潜行低伏
      this.torso.rotation.x = this.state === 'stalk' ? 0.35 : 0.12;
      this.head.rotation.x = this.state === 'stalk' ? -0.3 : 0;
    }
    // 上下起伏
    this.pelvis.position.y = 0.96 + Math.abs(Math.sin(gait)) * 0.05 * (speedFactor + 0.3);

    return result;
  }

  dispose() {
    this.scene.remove(this.root);
  }
}

// 敌人管理器：昼夜刷怪
export class CannibalManager {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.spawnTimer = 8;
  }

  update(dt, playerPos, isNight, buildings, onPlayerHit) {
    const E = CONFIG.enemies;
    const cap = isNight ? E.maxNight : E.maxDay;

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = isNight ? 14 : 45;
      if (this.list.length < cap) {
        const a = Math.random() * Math.PI * 2;
        const r = 55 + Math.random() * 25;
        const x = playerPos.x + Math.cos(a) * r;
        const z = playerPos.z + Math.sin(a) * r;
        const half = CONFIG.world.size / 2 - 10;
        if (Math.abs(x) < half && Math.abs(z) < half && getHeight(x, z) > 0.8) {
          this.list.push(new Cannibal(this.scene, x, z));
        }
      }
    }

    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      const r = c.update(dt, playerPos, isNight, buildings);
      if (r === 'attack_hit') onPlayerHit(E.damage);
      if (r === 'remove') {
        c.dispose();
        this.list.splice(i, 1);
      }
    }

    // 白天削减超编敌人（远处的消失）
    if (!isNight && this.list.length > cap) {
      for (let i = this.list.length - 1; i >= 0 && this.list.length > cap; i--) {
        const c = this.list[i];
        if (!c.dead && c.position.distanceTo(playerPos) > 70) {
          c.dispose();
          this.list.splice(i, 1);
        }
      }
    }
  }

  // 玩家攻击命中检测（锥形）
  tryHit(playerPos, forward, range, damage) {
    let hit = false;
    for (const c of this.list) {
      if (c.dead) continue;
      const dx = c.position.x - playerPos.x;
      const dy = (c.position.y + 1) - playerPos.y;
      const dz = c.position.z - playerPos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > range + 0.5) continue;
      const dot = (dx / d) * forward.x + (dz / d) * forward.z;
      if (dot > 0.65) {
        c.takeDamage(damage, { x: dx / d, z: dz / d });
        hit = true;
      }
    }
    return hit;
  }
}
