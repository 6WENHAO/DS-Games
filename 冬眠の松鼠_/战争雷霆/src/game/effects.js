import * as THREE from 'three';

/**
 * 粒子特效系统：单图集 + 两个 InstancedMesh（加法混合 / 普通混合）
 * 支持公告板、速度拉伸、贴地三种朝向模式
 */

const ATLAS_SLOTS = [
  'smoke_02', 'smoke_03', 'smoke_04', 'smoke_05',
  'smoke_07', 'fire_01', 'flame_03', 'muzzle_01',
  'dirt_01', 'dirt_02', 'dirt_03', 'spark_04',
  'flare_01', 'light_01', 'circle_05', 'scorch_01',
];

const MAX_PARTICLES = 420;

function buildAtlas(particleTextures) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  ATLAS_SLOTS.forEach((name, i) => {
    const tex = particleTextures[name];
    if (!tex || !tex.image) return;
    const col = i % 4, row = Math.floor(i / 4);
    ctx.drawImage(tex.image, col * 512, row * 512, 512, 512);
  });
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  atlas.generateMipmaps = true;
  atlas.minFilter = THREE.LinearMipmapLinearFilter;
  return atlas;
}

function makeParticleMaterial(atlas, additive) {
  return new THREE.ShaderMaterial({
    uniforms: { uTex: { value: atlas } },
    vertexShader: `
      attribute float aIdx;
      attribute vec4 aColor;
      varying vec2 vUv;
      varying vec4 vColor;
      void main() {
        vColor = aColor;
        float col = mod(aIdx, 4.0);
        float row = floor(aIdx / 4.0);
        vUv = (uv + vec2(col, 3.0 - row)) / 4.0;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uTex;
      varying vec2 vUv;
      varying vec4 vColor;
      void main() {
        vec4 c = texture2D(uTex, vUv);
        gl_FragColor = vec4(c.rgb * vColor.rgb, c.a * vColor.a);
        if (gl_FragColor.a < 0.004) discard;
      }`,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

class ParticlePool {
  constructor(scene, atlas, additive) {
    const geo = new THREE.PlaneGeometry(1, 1).toNonIndexed();
    this.mesh = new THREE.InstancedMesh(geo, makeParticleMaterial(atlas, additive), MAX_PARTICLES);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 12 : 11;
    this.aIdx = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES), 1);
    this.aColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PARTICLES * 4), 4);
    this.aIdx.setUsage(THREE.DynamicDrawUsage);
    this.aColor.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aIdx', this.aIdx);
    geo.setAttribute('aColor', this.aColor);
    scene.add(this.mesh);
    this.particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        alive: false, age: 0, life: 1,
        pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        grav: 0, drag: 0,
        size0: 1, size1: 1, rot: 0, rotVel: 0,
        r: 1, g: 1, b: 1, a0: 1, a1: 0, fadeIn: 0,
        idx: 0, mode: 0, stretch: 1, // mode: 0公告板 1速度拉伸 2贴地
      });
    }
    this.cursor = 0;
  }

  spawn() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
      if (!this.particles[this.cursor].alive) break;
    }
    const p = this.particles[this.cursor];
    p.alive = true; p.age = 0;
    p.grav = 0; p.drag = 0; p.rot = 0; p.rotVel = 0;
    p.fadeIn = 0; p.mode = 0; p.stretch = 1;
    p.r = 1; p.g = 1; p.b = 1; p.a0 = 1; p.a1 = 0;
    return p;
  }

  update(dt, camera) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qz = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const zUnit = new THREE.Vector3(0, 0, 1);
    const s = new THREE.Vector3();
    const camQ = camera.quaternion;
    const zAxis = new THREE.Vector3();
    const xAxis = new THREE.Vector3();
    const yAxis = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    let n = 0;
    for (const p of this.particles) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age >= p.life) { p.alive = false; continue; }
      p.vel.y -= p.grav * dt;
      if (p.drag) {
        const f = Math.max(0, 1 - p.drag * dt);
        p.vel.multiplyScalar(f);
      }
      p.pos.addScaledVector(p.vel, dt);
      p.rot += p.rotVel * dt;

      const t = p.age / p.life;
      const size = p.size0 + (p.size1 - p.size0) * t;
      let alpha = p.a0 + (p.a1 - p.a0) * t;
      if (p.fadeIn > 0 && p.age < p.fadeIn) alpha *= p.age / p.fadeIn;

      if (p.mode === 1) {
        // 沿速度拉伸（曳光/火舌）
        zAxis.copy(p.vel).normalize();
        xAxis.crossVectors(zAxis, camDir).normalize();
        if (xAxis.lengthSq() < 0.01) xAxis.set(1, 0, 0);
        yAxis.crossVectors(xAxis, zAxis);
        m.makeBasis(xAxis, zAxis, yAxis);
        m.setPosition(p.pos);
        s.set(size * 0.35, size * p.stretch, 1);
        m.scale(s);
      } else if (p.mode === 2) {
        // 贴地
        q.setFromEuler(eul.set(-Math.PI / 2, 0, p.rot));
        m.compose(p.pos, q, s.set(size, size, size));
      } else {
        q.copy(camQ).multiply(qz.setFromAxisAngle(zUnit, p.rot));
        m.compose(p.pos, q, s.set(size, size, size));
      }
      this.mesh.setMatrixAt(n, m);
      this.aIdx.setX(n, p.idx);
      this.aColor.setXYZW(n, p.r, p.g, p.b, alpha);
      n++;
    }
    this.mesh.count = n;
    if (n > 0) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.aIdx.needsUpdate = true;
      this.aColor.needsUpdate = true;
    }
  }
}

export class Effects {
  constructor(engine, assets, terrain) {
    this.engine = engine;
    this.terrain = terrain;
    const atlas = buildAtlas(assets.particles);
    this.alphaPool = new ParticlePool(engine.scene, atlas, false);
    this.addPool = new ParticlePool(engine.scene, atlas, true);
    this.idx = {};
    ATLAS_SLOTS.forEach((nm, i) => (this.idx[nm] = i));
    this.burning = new Set(); // {pos, until, offsetY}
    this._burnAcc = 0;

    // 弹痕贴花池
    this.decals = [];
    const decalGeo = new THREE.PlaneGeometry(1, 1);
    const decalMat = new THREE.MeshBasicMaterial({
      map: assets.particles['scorch_02'] || assets.particles['scorch_01'],
      transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4,
      color: 0x1a1a1a,
    });
    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(decalGeo, decalMat.clone());
      mesh.visible = false;
      mesh.renderOrder = 2;
      engine.scene.add(mesh);
      this.decals.push({ mesh, age: 0, life: 30, active: false });
    }
    this._decalCursor = 0;
  }

  update(dt) {
    const camera = this.engine.camera;
    this.alphaPool.update(dt, camera);
    this.addPool.update(dt, camera);
    // 持续燃烧烟柱
    this._burnAcc += dt;
    const emitInterval = 0.06;
    while (this._burnAcc > emitInterval) {
      this._burnAcc -= emitInterval;
      const now = performance.now() / 1000;
      for (const b of [...this.burning]) {
        if (now > b.until) { this.burning.delete(b); continue; }
        this._emitBurn(b);
      }
    }
    for (const d of this.decals) {
      if (!d.active) continue;
      d.age += dt;
      if (d.age > d.life) { d.active = false; d.mesh.visible = false; continue; }
      const t = d.age / d.life;
      d.mesh.material.opacity = 0.85 * (1 - t * t);
    }
  }

  /* ---------- 基础发射 ---------- */
  _p(pool, name, pos) {
    const p = pool.spawn();
    p.idx = this.idx[name];
    p.pos.copy(pos);
    p.vel.set(0, 0, 0);
    return p;
  }

  /** 清理战场残留（回到机库时调用） */
  reset() {
    this.burning.clear();
    for (const d of this.decals) { d.active = false; d.mesh.visible = false; }
    for (const pool of [this.alphaPool, this.addPool]) {
      for (const p of pool.particles) p.alive = false;
      pool.mesh.count = 0;
    }
  }

  /* ---------- 具体效果 ---------- */

  muzzleFlash(pos, dir) {
    // 主闪光
    for (let i = 0; i < 2; i++) {
      const p = this._p(this.addPool, 'muzzle_01', pos);
      p.vel.copy(dir).multiplyScalar(2);
      p.life = 0.09 + i * 0.03;
      p.size0 = 2.4; p.size1 = 4.6;
      p.mode = 1; p.stretch = 1.6;
      p.vel.copy(dir).multiplyScalar(14);
      p.r = 1; p.g = 0.82; p.b = 0.5; p.a0 = 1; p.a1 = 0;
    }
    const glow = this._p(this.addPool, 'light_01', pos);
    glow.life = 0.1; glow.size0 = 7; glow.size1 = 9;
    glow.r = 1; glow.g = 0.75; glow.b = 0.4; glow.a0 = 0.9;
    // 炮口烟
    for (let i = 0; i < 6; i++) {
      const p = this._p(this.alphaPool, 'smoke_0' + (2 + (i % 3)), pos);
      p.vel.copy(dir).multiplyScalar(9 + Math.random() * 8);
      p.vel.x += (Math.random() - 0.5) * 2.5;
      p.vel.y += Math.random() * 1.6 + 0.6;
      p.vel.z += (Math.random() - 0.5) * 2.5;
      p.drag = 2.2;
      p.life = 1.1 + Math.random() * 0.9;
      p.size0 = 1.6 + Math.random(); p.size1 = 5.5 + Math.random() * 2.5;
      p.rot = Math.random() * 6.28; p.rotVel = (Math.random() - 0.5) * 1.5;
      const g = 0.72 + Math.random() * 0.15;
      p.r = g; p.g = g * 0.98; p.b = g * 0.92;
      p.a0 = 0.55; p.a1 = 0; p.fadeIn = 0.02;
    }
    // 地面扬尘
    const groundY = this.terrain ? this.terrain.heightAt(pos.x, pos.z) : 0;
    if (pos.y - groundY < 4) {
      for (let i = 0; i < 4; i++) {
        const p = this._p(this.alphaPool, 'dirt_01', new THREE.Vector3(pos.x, groundY + 0.4, pos.z));
        const a = Math.atan2(dir.x, dir.z) + (Math.random() - 0.5) * 1.6;
        p.vel.set(Math.sin(a) * 7, 1.2, Math.cos(a) * 7);
        p.drag = 1.8; p.life = 1.4; p.size0 = 2.4; p.size1 = 6;
        p.r = 0.62; p.g = 0.55; p.b = 0.44;
        p.a0 = 0.4; p.a1 = 0;
      }
    }
  }

  explosion(pos, { big = false, ground = true } = {}) {
    const scale = big ? 1.7 : 1;
    const flash = this._p(this.addPool, 'flare_01', pos);
    flash.life = 0.14; flash.size0 = 8 * scale; flash.size1 = 13 * scale;
    flash.r = 1; flash.g = 0.85; flash.b = 0.55;
    for (let i = 0; i < 7; i++) {
      const p = this._p(this.addPool, i % 2 ? 'fire_01' : 'flame_03', pos);
      p.vel.set((Math.random() - 0.5) * 11, Math.random() * 9 + 2, (Math.random() - 0.5) * 11);
      p.life = 0.35 + Math.random() * 0.3;
      p.size0 = 3.2 * scale; p.size1 = (5.5 + Math.random() * 2) * scale;
      p.rot = Math.random() * 6.28;
      p.r = 1; p.g = 0.72; p.b = 0.42; p.a0 = 0.95; p.a1 = 0;
    }
    const expSmoke = ['smoke_04', 'smoke_05', 'smoke_07'];
    for (let i = 0; i < 10; i++) {
      const p = this._p(this.alphaPool, expSmoke[i % 3], pos);
      p.vel.set((Math.random() - 0.5) * 9, Math.random() * 8 + 2.5, (Math.random() - 0.5) * 9);
      p.drag = 1.6; p.grav = -1.2;
      p.life = 1.8 + Math.random() * 1.6;
      p.size0 = 2.8 * scale; p.size1 = (9 + Math.random() * 4) * scale;
      p.rot = Math.random() * 6.28; p.rotVel = (Math.random() - 0.5);
      const g = 0.16 + Math.random() * 0.1;
      p.r = g; p.g = g; p.b = g;
      p.a0 = 0.78; p.a1 = 0; p.fadeIn = 0.03;
    }
    // 迸射火星
    for (let i = 0; i < 12; i++) {
      const p = this._p(this.addPool, 'spark_04', pos);
      const a = Math.random() * 6.28, e = Math.random() * 1.2;
      const sp = 16 + Math.random() * 22;
      p.vel.set(Math.sin(a) * Math.cos(e) * sp, Math.sin(e) * sp + 6, Math.cos(a) * Math.cos(e) * sp);
      p.grav = 28; p.life = 0.5 + Math.random() * 0.5;
      p.mode = 1; p.stretch = 2.4; p.size0 = 0.7; p.size1 = 0.25;
      p.r = 1; p.g = 0.8; p.b = 0.45;
    }
    if (ground) {
      // 溅土
      for (let i = 0; i < 8; i++) {
        const p = this._p(this.alphaPool, i % 2 ? 'dirt_02' : 'dirt_01', pos);
        const a = Math.random() * 6.28;
        const sp = 7 + Math.random() * 9;
        p.vel.set(Math.sin(a) * sp, 9 + Math.random() * 8, Math.cos(a) * sp);
        p.grav = 16; p.life = 0.9 + Math.random() * 0.7;
        p.size0 = 2.2 * scale; p.size1 = 5 * scale;
        p.r = 0.5; p.g = 0.42; p.b = 0.33; p.a0 = 0.85; p.a1 = 0.1;
      }
      this.scorch(pos, 4.5 * scale);
      // 冲击波环
      const ring = this._p(this.addPool, 'circle_05', pos.clone().setY(pos.y + 0.3));
      ring.mode = 2; ring.life = 0.5; ring.size0 = 2; ring.size1 = 16 * scale;
      ring.r = 1; ring.g = 0.9; ring.b = 0.7; ring.a0 = 0.5; ring.a1 = 0;
    }
  }

  scorch(pos, size = 4) {
    const d = this.decals[this._decalCursor];
    this._decalCursor = (this._decalCursor + 1) % this.decals.length;
    d.active = true; d.age = 0;
    d.mesh.visible = true;
    const y = this.terrain ? this.terrain.heightAt(pos.x, pos.z) : pos.y;
    d.mesh.position.set(pos.x, y + 0.12, pos.z);
    const n = this.terrain ? this.terrain.normalAt(pos.x, pos.z) : new THREE.Vector3(0, 1, 0);
    d.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    d.mesh.rotateZ(Math.random() * 6.28);
    d.mesh.scale.setScalar(size);
    d.mesh.material.opacity = 0.85;
  }

  armorHit(pos, normal, penetrated) {
    const base = pos.clone().addScaledVector(normal, 0.15);
    const nSparks = penetrated ? 14 : 8;
    for (let i = 0; i < nSparks; i++) {
      const p = this._p(this.addPool, 'spark_04', base);
      const dir = normal.clone();
      dir.x += (Math.random() - 0.5) * 1.6;
      dir.y += Math.random() * 0.9;
      dir.z += (Math.random() - 0.5) * 1.6;
      dir.normalize();
      const sp = 9 + Math.random() * 16;
      p.vel.copy(dir).multiplyScalar(sp);
      p.grav = 22; p.life = 0.35 + Math.random() * 0.4;
      p.mode = 1; p.stretch = 2.2; p.size0 = 0.5; p.size1 = 0.2;
      p.r = 1; p.g = 0.85; p.b = 0.5;
    }
    const flash = this._p(this.addPool, 'flare_01', base);
    flash.life = 0.09; flash.size0 = penetrated ? 3.4 : 1.8; flash.size1 = penetrated ? 5 : 2.6;
    flash.r = 1; flash.g = 0.8; flash.b = 0.5;
    if (penetrated) {
      for (let i = 0; i < 4; i++) {
        const p = this._p(this.alphaPool, 'smoke_05', base);
        p.vel.copy(normal).multiplyScalar(3 + Math.random() * 3);
        p.vel.y += 1.5;
        p.life = 1.1; p.size0 = 1.2; p.size1 = 3.6;
        const g = 0.22; p.r = g; p.g = g; p.b = g;
        p.a0 = 0.7; p.a1 = 0;
      }
    }
  }

  ricochet(pos, dir) {
    for (let i = 0; i < 6; i++) {
      const p = this._p(this.addPool, 'spark_04', pos);
      const d = dir.clone();
      d.x += (Math.random() - 0.5) * 0.8;
      d.y += Math.random() * 0.8;
      d.z += (Math.random() - 0.5) * 0.8;
      p.vel.copy(d.normalize()).multiplyScalar(24 + Math.random() * 18);
      p.grav = 18; p.life = 0.3 + Math.random() * 0.3;
      p.mode = 1; p.stretch = 3; p.size0 = 0.45; p.size1 = 0.15;
      p.r = 1; p.g = 0.9; p.b = 0.6;
    }
  }

  groundHit(pos) {
    for (let i = 0; i < 6; i++) {
      const p = this._p(this.alphaPool, i % 2 ? 'dirt_01' : 'dirt_02', pos);
      const a = Math.random() * 6.28;
      p.vel.set(Math.sin(a) * 4, 6 + Math.random() * 6, Math.cos(a) * 4);
      p.grav = 15; p.life = 0.8 + Math.random() * 0.5;
      p.size0 = 1.6; p.size1 = 4;
      p.r = 0.55; p.g = 0.47; p.b = 0.36; p.a0 = 0.8; p.a1 = 0;
    }
    const puff = this._p(this.alphaPool, 'smoke_03', pos);
    puff.vel.set(0, 2.5, 0); puff.life = 1.2;
    puff.size0 = 2; puff.size1 = 5.5;
    puff.r = 0.5; puff.g = 0.44; puff.b = 0.36; puff.a0 = 0.5; puff.a1 = 0;
    this.scorch(pos, 2.2);
  }

  dust(pos, vel, strength = 1) {
    const p = this._p(this.alphaPool, 'dirt_0' + (1 + ((Math.random() * 3) | 0)), pos);
    p.vel.copy(vel).multiplyScalar(0.25);
    p.vel.y += 0.8 + Math.random() * 0.8;
    p.drag = 1.4;
    p.life = 1.5 + Math.random();
    p.size0 = 1.6; p.size1 = 4.5 + 2 * strength;
    p.rot = Math.random() * 6.28; p.rotVel = (Math.random() - 0.5) * 0.8;
    p.r = 0.58; p.g = 0.52; p.b = 0.42;
    p.a0 = 0.26 * strength; p.a1 = 0; p.fadeIn = 0.08;
  }

  exhaust(pos) {
    const p = this._p(this.alphaPool, 'smoke_02', pos);
    p.vel.set((Math.random() - 0.5) * 0.6, 1.6 + Math.random(), (Math.random() - 0.5) * 0.6);
    p.life = 0.9; p.size0 = 0.5; p.size1 = 1.8;
    const g = 0.25; p.r = g; p.g = g; p.b = g;
    p.a0 = 0.4; p.a1 = 0;
  }

  crushDebris(pos, kind) {
    const isGreen = kind === 'bush';
    for (let i = 0; i < 8; i++) {
      const p = this._p(this.alphaPool, 'dirt_01', pos);
      const a = Math.random() * 6.28;
      p.vel.set(Math.sin(a) * 4, 3 + Math.random() * 4, Math.cos(a) * 4);
      p.grav = 12; p.life = 0.9;
      p.size0 = 1; p.size1 = 2.6;
      if (isGreen) { p.r = 0.3; p.g = 0.42; p.b = 0.2; }
      else { p.r = 0.5; p.g = 0.4; p.b = 0.28; }
      p.a0 = 0.85; p.a1 = 0;
    }
  }

  /** 注册持续燃烧点（坦克残骸等） */
  addBurning(pos, duration = 25, offsetY = 1.6) {
    this.burning.add({ pos: pos.clone ? pos.clone() : pos, until: performance.now() / 1000 + duration, offsetY });
  }

  _emitBurn(b) {
    const pos = new THREE.Vector3(b.pos.x, b.pos.y + b.offsetY, b.pos.z);
    if (Math.random() < 0.7) {
      const f = this._p(this.addPool, Math.random() < 0.5 ? 'fire_01' : 'flame_03', pos);
      f.pos.x += (Math.random() - 0.5) * 1.6;
      f.pos.z += (Math.random() - 0.5) * 1.6;
      f.vel.set(0, 2.2 + Math.random() * 1.5, 0);
      f.life = 0.5 + Math.random() * 0.3;
      f.size0 = 1.8; f.size1 = 3.4;
      f.rot = Math.random() * 6.28;
      f.r = 1; f.g = 0.7; f.b = 0.4; f.a0 = 0.85; f.a1 = 0;
    }
    const s = this._p(this.alphaPool, Math.random() < 0.5 ? 'smoke_05' : 'smoke_07', pos);
    s.pos.y += 1;
    s.vel.set((Math.random() - 0.5) * 1.2, 4.5 + Math.random() * 2, (Math.random() - 0.5) * 1.2);
    s.life = 2.6 + Math.random() * 1.4;
    s.size0 = 2.2; s.size1 = 8;
    s.rot = Math.random() * 6.28; s.rotVel = (Math.random() - 0.5) * 0.6;
    const g = 0.1 + Math.random() * 0.06;
    s.r = g; s.g = g; s.b = g;
    s.a0 = 0.6; s.a1 = 0; s.fadeIn = 0.1;
  }

  /** 击杀特写火球（殉爆） */
  ammoDetonation(pos) {
    this.explosion(pos, { big: true });
    for (let i = 0; i < 8; i++) {
      const p = this._p(this.addPool, 'flame_03', pos);
      const a = Math.random() * 6.28;
      p.vel.set(Math.sin(a) * 8, 14 + Math.random() * 14, Math.cos(a) * 8);
      p.grav = 12; p.life = 0.8 + Math.random() * 0.5;
      p.size0 = 2.6; p.size1 = 1.2;
      p.r = 1; p.g = 0.65; p.b = 0.35;
    }
  }
}
