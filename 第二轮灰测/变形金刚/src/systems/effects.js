/**
 * effects.js —— 排气烟 / 离子炮弹 / 变形能量环 / 火花
 * 全部用对象池 + 单个 Points，几乎零 GC。
 */
import * as THREE from 'three';

/* ------------------------------------------------------------------ *
 * 粒子池：位置/速度/寿命/基色 全部预分配，逐帧只写 typed array
 * ------------------------------------------------------------------ */
class ParticlePool {
  constructor(scene, mat, n) {
    this.n = n;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.base = new Float32Array(n * 3);   // 出生颜色（逐帧按寿命衰减到黑=透明）
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.size = new Float32Array(n);
    for (let i = 0; i < n; i++) { this.pos[i * 3 + 1] = -9999; this.max[i] = 1; }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    this.geo = g;
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.cursor = 0;
  }

  spawn(x, y, z, vx, vy, vz, life, size, r, g, b) {
    const i = (this.cursor = (this.cursor + 1) % this.n);
    const i3 = i * 3;
    this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.base[i3] = r; this.base[i3 + 1] = g; this.base[i3 + 2] = b;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.life[i] = this.max[i] = life;
    this.size[i] = size;
  }

  update(dt, drag, gravity, grow) {
    const { pos, vel, life, max, col, base, size, n } = this;
    for (let i = 0; i < n; i++) {
      if (life[i] <= 0) continue;
      const i3 = i * 3;
      life[i] -= dt;
      if (life[i] <= 0) { pos[i3 + 1] = -9999; size[i] = 0; continue; }
      const d = Math.max(0, 1 - drag * dt);
      vel[i3] *= d; vel[i3 + 2] *= d;
      vel[i3 + 1] += gravity * dt;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
      size[i] = Math.max(0.02, size[i] + grow * dt);
      const f = (life[i] / max[i]) ** 2;      // 淡出（加色混合下 → 黑即透明）
      col[i3] = base[i3] * f;
      col[i3 + 1] = base[i3 + 1] * f;
      col[i3 + 2] = base[i3 + 2] * f;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.psize.needsUpdate = true;
  }
}

/* ------------------------------------------------------------------ */
function pointsMaterial(map, size) {
  const m = new THREE.PointsMaterial({
    map, size, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  /* 让每颗粒子有自己的尺寸 */
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'attribute float psize;\n' + sh.vertexShader
      .replace('gl_PointSize = size;', 'gl_PointSize = size * psize;');
  };
  return m;
}

export class Effects {
  constructor(scene, rig, M, tf) {
    this.scene = scene;
    this.rig = rig;
    this.M = M;
    this.tf = tf;
    this.enableSmoke = true;
    this.enableSparks = true;

    this.smoke = new ParticlePool(scene, pointsMaterial(M.dot, 0.55), 220);
    this.sparks = new ParticlePool(scene, pointsMaterial(M.dot, 0.20), 260);

    /* 变形能量：地面冲击环 + 竖向扫掠环 */
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.78, 64), M.energy.clone());
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.02;
    this.ring.visible = false;
    scene.add(this.ring);

    this.sweep = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.035, 6, 60), M.energy.clone());
    this.sweep.rotation.x = Math.PI / 2;
    this.sweep.visible = false;
    rig.root.add(this.sweep);

    /* 离子炮弹对象池 */
    this.bolts = [];
    const bg = new THREE.CapsuleGeometry(0.075, 0.5, 6, 8);
    const gg = new THREE.SphereGeometry(0.22, 10, 8);
    for (let i = 0; i < 14; i++) {
      const g = new THREE.Group();
      const core = new THREE.Mesh(bg, M.boltCore);
      core.rotation.x = Math.PI / 2;
      const glow = new THREE.Mesh(gg, M.boltGlow);
      glow.scale.set(1, 1, 2.4);
      g.add(core, glow);
      g.visible = false;
      g.userData = { life: 0, vel: new THREE.Vector3() };
      scene.add(g);
      this.bolts.push(g);
    }
    this._bi = 0;
    this._smokeAcc = 0;
    this._prevMorph = 0;
    this._flashT = 0;
    this._w = new THREE.Vector3();
    this._q = new THREE.Quaternion();
  }

  /* ---------- 开火 ---------- */
  fire() {
    const bl = this.rig.blaster;
    if (!bl || !bl.root.visible) return false;
    const b = this.bolts[this._bi = (this._bi + 1) % this.bolts.length];
    bl.muzzle.getWorldPosition(this._w);
    bl.muzzle.getWorldQuaternion(this._q);
    const dir = new THREE.Vector3(0, 1, 0).applyQuaternion(this._q).normalize();
    b.position.copy(this._w);
    b.quaternion.copy(this._q);
    b.rotateX(Math.PI / 2);
    b.userData.vel.copy(dir).multiplyScalar(46);
    b.userData.life = 1.8;
    b.visible = true;
    this._flashT = 0.07;
    bl.flash.visible = true;
    /* 炮口火花 */
    for (let i = 0; i < 14; i++) {
      this.sparks.spawn(
        this._w.x, this._w.y, this._w.z,
        dir.x * 9 + (Math.random() - 0.5) * 5, dir.y * 9 + (Math.random() - 0.5) * 5, dir.z * 9 + (Math.random() - 0.5) * 5,
        0.25 + Math.random() * 0.2, 0.5 + Math.random(), 0.75, 1.0, 1.0);
    }
    return true;
  }

  /* ---------- 变形烟雾脉冲 ---------- */
  burst(strength = 1) {
    for (const tip of this.rig.stackTips) {
      tip.getWorldPosition(this._w);
      for (let i = 0; i < 12 * strength; i++) {
        this.smoke.spawn(
          this._w.x + (Math.random() - 0.5) * 0.12, this._w.y, this._w.z + (Math.random() - 0.5) * 0.12,
          (Math.random() - 0.5) * 1.6, 1.4 + Math.random() * 2.2, (Math.random() - 0.5) * 1.6,
          1.0 + Math.random() * 0.9, 1.1 + Math.random() * 1.4, 0.42, 0.44, 0.5);
      }
    }
  }

  sparkBurst(x, y, z, n = 24, spread = 7) {
    for (let i = 0; i < n; i++) {
      this.sparks.spawn(x, y, z,
        (Math.random() - 0.5) * spread, Math.random() * spread * 0.8, (Math.random() - 0.5) * spread,
        0.3 + Math.random() * 0.4, 0.4 + Math.random() * 0.9, 0.8, 0.95, 1.0);
    }
  }

  update(dt, ctx) {
    const p = this.tf.progress;
    const morph = this.tf.mode === 'morph';

    /* ---- 排气 ---- */
    if (this.enableSmoke) {
      const rate = morph ? 26 : (this.tf.vehicleW > 0.7 ? 6 + Math.abs(ctx.speed) * 3.5 : 0.7 * this.tf.robotW);
      this._smokeAcc += rate * dt;
      while (this._smokeAcc >= 1) {
        this._smokeAcc -= 1;
        const tip = this.rig.stackTips[Math.random() < 0.5 ? 0 : 1];
        if (!tip) break;
        tip.getWorldPosition(this._w);
        const up = 1.1 + Math.random() * 1.3 + Math.abs(ctx.speed) * 0.06;
        this.smoke.spawn(
          this._w.x + (Math.random() - 0.5) * 0.1, this._w.y + 0.05, this._w.z + (Math.random() - 0.5) * 0.1,
          (Math.random() - 0.5) * 0.5 - Math.sin(this.rig.root.rotation.y) * ctx.speed * 0.28,
          up,
          (Math.random() - 0.5) * 0.5 - Math.cos(this.rig.root.rotation.y) * ctx.speed * 0.28,
          1.1 + Math.random() * 1.1, 0.85 + Math.random() * 1.1,
          0.30, 0.32, 0.38);
      }
    }
    this.smoke.update(dt, 0.7, 0.55, 0.9);
    this.sparks.update(dt, 2.2, -9.5, -0.2);

    /* ---- 变形特效 ---- */
    const m = Math.sin(Math.PI * Math.min(1, Math.max(0, p)));
    if (morph) {
      this.sweep.visible = true;
      this.sweep.position.y = 0.3 + p * 4.6;
      const s = 0.75 + Math.sin(p * Math.PI) * 0.55;
      this.sweep.scale.set(s, s, 1);
      this.sweep.material.opacity = 0.55 * m;
      this.sweep.rotation.z += dt * 3;
      if (this.enableSparks && Math.random() < dt * 55) {
        const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random() * 0.9;
        const o = this.rig.root.position;
        this.sparkBurst(o.x + Math.cos(a) * r, 0.4 + Math.random() * 3.4, o.z + Math.sin(a) * r, 3, 4);
      }
      if (this._prevMorph === 0) {
        this.ring.visible = true;
        this.ring.userData.t = 0;
        this.burst(1);
      }
      this._prevMorph = 1;
    } else {
      this.sweep.visible = false;
      if (this._prevMorph === 1) this.burst(1.4);
      this._prevMorph = 0;
    }

    /* ---- 地面冲击环 ---- */
    if (this.ring.visible) {
      const t = (this.ring.userData.t = (this.ring.userData.t || 0) + dt * 1.15);
      const s = 1 + t * 7;
      this.ring.scale.set(s, s, 1);
      this.ring.position.set(this.rig.root.position.x, 0.02, this.rig.root.position.z);
      this.ring.material.opacity = Math.max(0, 0.6 * (1 - t));
      if (t >= 1) this.ring.visible = false;
    }

    /* ---- 炮弹 ---- */
    for (const b of this.bolts) {
      if (!b.visible) continue;
      b.userData.life -= dt;
      b.position.addScaledVector(b.userData.vel, dt);
      b.userData.vel.y -= 2.2 * dt;
      if (b.userData.life <= 0 || b.position.y < 0.12) {
        b.visible = false;
        if (b.position.y < 0.6) this.sparkBurst(b.position.x, Math.max(0.1, b.position.y), b.position.z, 22, 8);
      }
    }
    if (this._flashT > 0) {
      this._flashT -= dt;
      if (this._flashT <= 0 && this.rig.blaster) this.rig.blaster.flash.visible = false;
    }
  }
}
