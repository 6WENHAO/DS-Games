import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { makeRng, randRange } from '../core/rng.js';
import { getHeight, getSlope } from '../world/heightfield.js';
import { Audio } from '../core/audio.js';

// 兔子：程序化毛皮纹理 + 跳跃移动 + 逃跑 AI，可猎杀获得生肉
let furMat = null;

function makeFurTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#8a7360';
  ctx.fillRect(0, 0, 128, 128);
  // 噪点毛发
  for (let i = 0; i < 4200; i++) {
    const v = 90 + Math.random() * 80;
    ctx.fillStyle = `rgba(${v},${v * 0.85},${v * 0.7},0.5)`;
    const x = Math.random() * 128, y = Math.random() * 128;
    ctx.fillRect(x, y, 1, 2 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function ensureMat() {
  if (furMat) return;
  furMat = new THREE.MeshStandardMaterial({ map: makeFurTexture(), roughness: 1 });
}

class Rabbit {
  constructor(scene, x, z) {
    ensureMat();
    this.scene = scene;
    this.group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 9, 7), furMat);
    body.scale.set(1, 0.85, 1.45);
    body.position.y = 0.16;
    body.castShadow = true;
    this.group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), furMat);
    head.position.set(0, 0.28, 0.2);
    head.castShadow = true;
    this.group.add(head);

    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.18, 5), furMat);
      ear.position.set(s * 0.045, 0.42, 0.16);
      ear.rotation.x = -0.25;
      this.group.add(ear);
    }
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), furMat);
    tail.position.set(0, 0.2, -0.24);
    this.group.add(tail);

    this.group.position.set(x, getHeight(x, z), z);
    scene.add(this.group);

    this.dead = false;
    this.hopPhase = Math.random() * 10;
    this.dir = Math.random() * Math.PI * 2;
    this.moveTimer = 0;
    this.fleeing = false;
  }

  get position() { return this.group.position; }

  update(dt, playerPos) {
    if (this.dead) return;
    const dx = this.position.x - playerPos.x;
    const dz = this.position.z - playerPos.z;
    const distSq = dx * dx + dz * dz;

    this.fleeing = distSq < 64;
    let speed = 0;

    if (this.fleeing) {
      this.dir = Math.atan2(dx, dz) + Math.sin(this.hopPhase * 2) * 0.4;
      speed = 4.2;
    } else {
      this.moveTimer -= dt;
      if (this.moveTimer <= 0) {
        this.moveTimer = 1.5 + Math.random() * 3.5;
        this.dir = Math.random() * Math.PI * 2;
        this.grazing = Math.random() < 0.5;
      }
      speed = this.grazing ? 0 : 1.1;
    }

    this.hopPhase += dt * (this.fleeing ? 11 : 5);
    const hop = Math.abs(Math.sin(this.hopPhase));

    if (speed > 0) {
      this.position.x += Math.sin(this.dir) * speed * dt;
      this.position.z += Math.cos(this.dir) * speed * dt;
      this.group.rotation.y = this.dir;
    }
    const gy = getHeight(this.position.x, this.position.z);
    this.position.y = gy + hop * (this.fleeing ? 0.3 : 0.12) * (speed > 0 ? 1 : 0);
  }

  kill() {
    this.dead = true;
    Audio.playAt('impact_soft', this.position, { volume: 0.8, maxDist: 20 });
    // 倒下
    this.group.rotation.z = Math.PI / 2;
    setTimeout(() => this.scene.remove(this.group), 30000);
  }
}

export class AnimalManager {
  constructor(scene) {
    this.scene = scene;
    this.rabbits = [];
    const rng = makeRng(CONFIG.seed + 505);
    const half = CONFIG.world.size / 2 - 30;
    let placed = 0, guard = 0;
    while (placed < CONFIG.animals.rabbits && guard++ < 800) {
      const x = randRange(rng, -half, half);
      const z = randRange(rng, -half, half);
      if (getHeight(x, z) < CONFIG.world.beachLevel || getSlope(x, z) > 0.35) continue;
      this.rabbits.push(new Rabbit(scene, x, z));
      placed++;
    }
  }

  update(dt, playerPos) {
    for (const r of this.rabbits) {
      // 远处的不更新（性能）
      const dx = r.position.x - playerPos.x, dz = r.position.z - playerPos.z;
      if (dx * dx + dz * dz > 120 * 120) continue;
      r.update(dt, playerPos);
    }
  }

  // 猎杀检测（锥形近战）
  tryHit(playerPos, forward, range) {
    for (const r of this.rabbits) {
      if (r.dead) continue;
      const dx = r.position.x - playerPos.x;
      const dy = r.position.y - playerPos.y + 1.4;
      const dz = r.position.z - playerPos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > range) continue;
      const dot = (dx / d) * forward.x + (dz / d) * forward.z;
      if (dot > 0.75) {
        r.kill();
        return true;
      }
    }
    return false;
  }
}
