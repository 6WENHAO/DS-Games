/**
 * 开火特效：火光 / 烟雾 / 制退 / 车体后坐反应 / 自动装弹机循环 / 合成炮声
 *
 * 物理依据：
 *  - 制退：后坐极快（约 45 ms 走完 0.30 m 行程），复进由复进机推回、慢得多（约 0.42 s），
 *    因此位移曲线前急后缓 —— 这里如实分段建模。
 *  - 车体反应：后坐冲量经耳轴传到车体，车体绕悬挂产生一次抬头再衰减的俯仰振荡。
 *  - 炮口焰：主焰 + 侧向膨胀波，持续约 80 ms；随后是被膛内余压推出的火药烟。
 *  - 抽气装置：开闩瞬间会从抽气装置附近漏出一小股烟。
 *  - 装填：实车装填循环约 7～8 s/发，本演示默认 5 s（可调），顺序为
 *    开闩 → 转盘选弹 → 提弹 → 推弹丸 → 推药筒 → 闭锁。
 */
import * as THREE from 'three';
import { flashTexture, smokeTexture } from '../tank/materials.js';

const PARTICLE_VS = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute float aRot;
attribute vec3 aColor;
varying float vAlpha;
varying float vRot;
varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vRot = aRot;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.001, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const PARTICLE_FS = /* glsl */ `
uniform sampler2D uMap;
varying float vAlpha;
varying float vRot;
varying vec3 vColor;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  uv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y) + 0.5;
  vec4 t = texture2D(uMap, uv);
  if (t.a * vAlpha < 0.004) discard;
  gl_FragColor = vec4(vColor, t.a * vAlpha);
}`;

class ParticleSystem {
  constructor(capacity, texture, blending) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.rot = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.rotVel = new Float32Array(capacity);
    this.buoy = new Float32Array(capacity);
    this.head = 0;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);
    this.geometry = g;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: texture }, uScale: { value: 620 } },
      vertexShader: PARTICLE_VS,
      fragmentShader: PARTICLE_FS,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.userData.noExport = true;
    this.points.renderOrder = 10;
  }

  spawn(o) {
    const i = this.head;
    this.head = (this.head + 1) % this.capacity;
    const i3 = i * 3;
    this.pos[i3] = o.x;
    this.pos[i3 + 1] = o.y;
    this.pos[i3 + 2] = o.z;
    this.vel[i3] = o.vx;
    this.vel[i3 + 1] = o.vy;
    this.vel[i3 + 2] = o.vz;
    this.col[i3] = o.r;
    this.col[i3 + 1] = o.g;
    this.col[i3 + 2] = o.b;
    this.size[i] = o.size;
    this.alpha[i] = o.alpha;
    this.rot[i] = Math.random() * Math.PI * 2;
    this.rotVel[i] = (Math.random() - 0.5) * o.spin;
    this.life[i] = 0;
    this.maxLife[i] = o.life;
    this.grow[i] = o.grow;
    this.drag[i] = o.drag;
    this.buoy[i] = o.buoy || 0;
  }

  update(dt) {
    let live = 0;
    for (let i = 0; i < this.capacity; i++) {
      if (this.maxLife[i] <= 0) continue;
      const t = (this.life[i] += dt);
      const k = t / this.maxLife[i];
      if (k >= 1) {
        this.maxLife[i] = 0;
        this.alpha[i] = 0;
        continue;
      }
      live++;
      const i3 = i * 3;
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i3] *= d;
      this.vel[i3 + 1] = this.vel[i3 + 1] * d + this.buoy[i] * dt;
      this.vel[i3 + 2] *= d;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      this.size[i] += this.grow[i] * dt;
      this.rot[i] += this.rotVel[i] * dt;
      // 前 12% 快速起亮，之后按 (1-k)^1.6 衰减
      const fade = k < 0.12 ? k / 0.12 : Math.pow(1 - (k - 0.12) / 0.88, 1.6);
      this.alpha[i] = fade * (this.alphaScale || 1) * this.a0(i);
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
    this.geometry.attributes.aAlpha.needsUpdate = true;
    this.geometry.attributes.aRot.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.live = live;
    return live;
  }

  a0(i) {
    return this._a0 ? this._a0[i] : 1;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/* a0：每个粒子的初始亮度上限 —— 单独存一份，避免被 update 覆盖 */
function patchA0(ps) {
  ps._a0 = new Float32Array(ps.capacity).fill(1);
  const orig = ps.spawn.bind(ps);
  ps.spawn = (o) => {
    const i = ps.head;
    ps._a0[i] = o.alpha;
    orig(o);
  };
}

export class FiringFX {
  constructor(scene, refs, opts = {}) {
    this.scene = scene;
    this.refs = refs;
    this.smokeTex = smokeTexture(128);
    this.flashTex = flashTexture(256);

    this.smoke = new ParticleSystem(320, this.smokeTex, THREE.NormalBlending);
    this.spark = new ParticleSystem(160, this.flashTex, THREE.AdditiveBlending);
    patchA0(this.smoke);
    patchA0(this.spark);
    scene.add(this.smoke.points, this.spark.points);

    /* ---- 炮口焰几何（主焰锥 + 侧向膨胀盘）---- */
    this.flashGroup = new THREE.Group();
    this.flashGroup.visible = false;
    this.flashGroup.userData.noExport = true;
    scene.add(this.flashGroup);
    const flashMat = new THREE.MeshBasicMaterial({
      map: this.flashTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      color: 0xffd9a0,
    });
    this.flashMat = flashMat;
    const cone = new THREE.ConeGeometry(0.62, 2.1, 20, 1, true);
    cone.rotateX(Math.PI / 2);
    cone.translate(0, 0, 1.05);
    this.flashCone = new THREE.Mesh(cone, flashMat);
    this.flashGroup.add(this.flashCone);
    const disc = new THREE.PlaneGeometry(2.6, 2.6);
    this.flashDisc = new THREE.Mesh(disc, flashMat);
    this.flashDisc.position.z = 0.35;
    this.flashGroup.add(this.flashDisc);
    const disc2 = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), flashMat);
    disc2.position.z = 0.9;
    disc2.rotation.z = 0.8;
    this.flashGroup.add(disc2);
    this.flashDisc2 = disc2;

    /* ---- 炮口闪光灯 ---- */
    this.flashLight = new THREE.PointLight(0xffc078, 0, 40, 2);
    this.flashLight.userData.noExport = true;
    scene.add(this.flashLight);
    this.bounceLight = new THREE.PointLight(0xff9d50, 0, 26, 2);
    this.bounceLight.userData.noExport = true;
    scene.add(this.bounceLight);

    /* ---- 状态 ---- */
    this.t = -1; // 射击计时（-1 = 空闲）
    this.reloadTime = opts.reloadTime ?? 5.0;
    this.smokeAmount = opts.smokeAmount ?? 1;
    this.soundOn = opts.sound ?? true;
    this.animateLoader = true;
    this.rock = { v: 0, x: 0 };
    this.bob = { v: 0, x: 0 };
    this.carouselTarget = 0;
    this.audio = null;
    this._muzzleWorld = new THREE.Vector3();
    this._dir = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this.onStateChange = null;
  }

  get busy() {
    return this.t >= 0;
  }

  /* ---------------- 声音（WebAudio 合成，无需音频文件） ---------------- */
  #ensureAudio() {
    if (this.audio) return this.audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    const ctx = new AC();
    // 预生成噪声缓冲
    const len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.audio = { ctx, noise: buf };
    return this.audio;
  }

  #boom() {
    if (!this.soundOn) return;
    const a = this.#ensureAudio();
    if (!a) return;
    const { ctx, noise } = a;
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);

    // 低频冲击：90 → 26 Hz 扫频
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(95, t0);
    osc.frequency.exponentialRampToValueAtTime(26, t0 + 0.5);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, t0);
    og.gain.exponentialRampToValueAtTime(1.0, t0 + 0.012);
    og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.85);
    osc.connect(og).connect(master);
    osc.start(t0);
    osc.stop(t0 + 0.9);

    // 爆音噪声：低通 + 快速衰减
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, t0);
    lp.frequency.exponentialRampToValueAtTime(320, t0 + 0.55);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t0);
    ng.gain.exponentialRampToValueAtTime(0.85, t0 + 0.008);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
    src.connect(lp).connect(ng).connect(master);
    src.start(t0);
    src.stop(t0 + 0.8);

    // 远处回声
    const echo = ctx.createBufferSource();
    echo.buffer = noise;
    const el = ctx.createBiquadFilter();
    el.type = 'bandpass';
    el.frequency.value = 260;
    el.Q.value = 0.7;
    const eg = ctx.createGain();
    eg.gain.setValueAtTime(0.0001, t0 + 0.28);
    eg.gain.exponentialRampToValueAtTime(0.16, t0 + 0.34);
    eg.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
    echo.connect(el).connect(eg).connect(master);
    echo.start(t0 + 0.28);
    echo.stop(t0 + 1.6);
  }

  #clank(delay = 0, gain = 0.25, freq = 1800) {
    if (!this.soundOn) return;
    const a = this.#ensureAudio();
    if (!a) return;
    const { ctx, noise } = a;
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + 0.2);
  }

  /* ---------------- 触发 ---------------- */
  fire() {
    if (this.busy) return false;
    this.t = 0;
    this.#emitMuzzle();
    this.#boom();
    // 后坐冲量 → 车体抬头 + 下沉
    this.rock.v = -1.55;
    this.bob.v = 0.9;
    this.carouselStart = this.refs.loaderParts?.carousel?.rotation.y || 0;
    this.carouselTarget = this.carouselStart - (Math.PI * 2) / 22;
    if (this.onStateChange) this.onStateChange('fire');
    return true;
  }

  #muzzleFrame() {
    const mz = this.refs.gunParts?.muzzle;
    if (!mz) return false;
    mz.updateWorldMatrix(true, false);
    mz.getWorldPosition(this._muzzleWorld);
    mz.getWorldQuaternion(this._q);
    this._dir.set(0, 0, 1).applyQuaternion(this._q);
    this._up.set(0, 1, 0).applyQuaternion(this._q);
    this._right.set(1, 0, 0).applyQuaternion(this._q);
    return true;
  }

  #emitMuzzle() {
    if (!this.#muzzleFrame()) return;
    const P = this._muzzleWorld;
    const F = this._dir;
    const U = this._up;
    const R = this._right;
    const n = Math.round(46 * this.smokeAmount);

    // 主炮口烟（前冲 + 径向扩散）
    for (let i = 0; i < n; i++) {
      const s = Math.random();
      const fw = 2.5 + Math.random() * 15 * (1 - s * 0.6);
      const rad = (Math.random() - 0.5) * 5.5;
      const rad2 = (Math.random() - 0.5) * 5.5;
      const bright = 0.52 + Math.random() * 0.34;
      this.smoke.spawn({
        x: P.x + F.x * (0.1 + s * 1.6),
        y: P.y + F.y * (0.1 + s * 1.6),
        z: P.z + F.z * (0.1 + s * 1.6),
        vx: F.x * fw + R.x * rad + U.x * rad2,
        vy: F.y * fw + R.y * rad + U.y * rad2 + 0.4,
        vz: F.z * fw + R.z * rad + U.z * rad2,
        r: bright,
        g: bright * 0.97,
        b: bright * 0.92,
        size: 0.5 + Math.random() * 0.7,
        alpha: 0.5 + Math.random() * 0.3,
        life: 1.6 + Math.random() * 2.4,
        grow: 0.9 + Math.random() * 1.5,
        drag: 2.4 + Math.random() * 1.6,
        buoy: 0.35 + Math.random() * 0.5,
        spin: 1.4,
      });
    }
    // 火星/炽热颗粒
    for (let i = 0; i < 26; i++) {
      const fw = 6 + Math.random() * 26;
      this.spark.spawn({
        x: P.x + F.x * 0.2,
        y: P.y + F.y * 0.2,
        z: P.z + F.z * 0.2,
        vx: F.x * fw + (Math.random() - 0.5) * 7,
        vy: F.y * fw + (Math.random() - 0.5) * 7,
        vz: F.z * fw + (Math.random() - 0.5) * 7,
        r: 1,
        g: 0.62 + Math.random() * 0.3,
        b: 0.24,
        size: 0.06 + Math.random() * 0.12,
        alpha: 0.9,
        life: 0.22 + Math.random() * 0.5,
        grow: -0.02,
        drag: 3.2,
        buoy: 0.2,
        spin: 3,
      });
    }
    // 地面扬尘（炮口冲击波吹起）—— 只在炮口高度不太高时明显
    const gx = P.x + F.x * 1.2;
    const gz = P.z + F.z * 1.2;
    for (let i = 0; i < Math.round(30 * this.smokeAmount); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 7;
      this.smoke.spawn({
        x: gx + (Math.random() - 0.5) * 2.4,
        y: 0.03 + Math.random() * 0.25,
        z: gz + (Math.random() - 0.5) * 2.4,
        vx: Math.cos(a) * sp + F.x * 3,
        vy: 0.6 + Math.random() * 1.6,
        vz: Math.sin(a) * sp + F.z * 3,
        r: 0.62,
        g: 0.56,
        b: 0.45,
        size: 0.6 + Math.random() * 0.9,
        alpha: 0.32 + Math.random() * 0.25,
        life: 1.8 + Math.random() * 2.2,
        grow: 1.2 + Math.random() * 1.4,
        drag: 2.0,
        buoy: 0.25,
        spin: 1.1,
      });
    }
  }

  /** 抽气装置漏烟（开闩瞬间） */
  #emitFume() {
    const rec = this.refs.gunParts?.recoil;
    if (!rec) return;
    const p = new THREE.Vector3(0, 0.12, 2.35).applyMatrix4(rec.matrixWorld);
    const F = this._dir;
    for (let i = 0; i < Math.round(14 * this.smokeAmount); i++) {
      this.smoke.spawn({
        x: p.x + (Math.random() - 0.5) * 0.2,
        y: p.y,
        z: p.z + (Math.random() - 0.5) * 0.2,
        vx: (Math.random() - 0.5) * 0.9 + F.x * 1.6,
        vy: 0.5 + Math.random() * 0.8,
        vz: (Math.random() - 0.5) * 0.9 + F.z * 1.6,
        r: 0.72,
        g: 0.71,
        b: 0.68,
        size: 0.2 + Math.random() * 0.24,
        alpha: 0.3,
        life: 1.4 + Math.random() * 1.2,
        grow: 0.55,
        drag: 1.6,
        buoy: 0.55,
        spin: 1,
      });
    }
  }

  /** 抛壳（药筒底托） */
  #emitEject() {
    const t = this.refs.turretYaw;
    if (!t) return;
    const p = new THREE.Vector3(0, 1.05, -1.35).applyMatrix4(t.matrixWorld);
    for (let i = 0; i < 8; i++) {
      this.spark.spawn({
        x: p.x,
        y: p.y,
        z: p.z,
        vx: (Math.random() - 0.5) * 1.5,
        vy: 1.5 + Math.random(),
        vz: -2 - Math.random() * 2,
        r: 0.85,
        g: 0.65,
        b: 0.3,
        size: 0.1,
        alpha: 0.55,
        life: 0.7,
        grow: 0,
        drag: 0.6,
        buoy: -3.2,
        spin: 5,
      });
    }
    this.#clank(0, 0.2, 1200);
  }

  /* ---------------- 每帧更新 ---------------- */
  update(dt, camera) {
    dt = Math.min(dt, 0.05);
    const R = this.refs;
    const rec = R.gunParts?.recoil;
    const wedge = R.gunParts?.breechWedge;
    const car = R.loaderParts?.carousel;
    const lift = R.loaderParts?.lifter;
    const ram = R.loaderParts?.ramArm;

    if (this.t >= 0) {
      const t = (this.t += dt);
      const T = this.reloadTime;
      const seq = (a, b) => THREE.MathUtils.clamp((t - a * T) / ((b - a) * T), 0, 1);

      /* --- 后坐/复进 --- */
      if (rec) {
        const stroke = 0.3;
        let z = 0;
        if (t < 0.045) z = -stroke * Math.pow(t / 0.045, 0.62);
        else if (t < 0.47) {
          const k = (t - 0.045) / 0.425;
          z = -stroke * (1 - k) * (1 - k) * (1 + 0.35 * Math.sin(k * Math.PI * 2));
        } else z = 0;
        rec.position.z = z;
      }

      /* --- 炮口焰 --- */
      const fl = t < 0.11 ? 1 - t / 0.11 : 0;
      if (fl > 0) {
        this.#muzzleFrame();
        this.flashGroup.visible = true;
        this.flashGroup.position.copy(this._muzzleWorld);
        this.flashGroup.quaternion.copy(this._q);
        const s = 0.55 + (1 - fl) * 1.5;
        this.flashCone.scale.setScalar(s * (0.6 + fl * 0.7));
        this.flashDisc.scale.setScalar(0.5 + (1 - fl) * 1.9);
        this.flashDisc2.scale.setScalar(0.7 + (1 - fl) * 1.2);
        this.flashDisc2.rotation.z += dt * 6;
        if (camera) {
          // 两片膨胀盘做公告板：局部四元数 = 炮口世界朝向的逆 × 相机朝向
          this._bill = this._bill || new THREE.Quaternion();
          this._bill.copy(this._q).invert().multiply(camera.quaternion);
          this.flashDisc.quaternion.copy(this._bill);
          this.flashDisc2.quaternion.copy(this._bill);
          this.flashDisc2.rotateZ(0.7);
        }
        this.flashMat.opacity = Math.pow(fl, 0.55);
        this.flashLight.position.copy(this._muzzleWorld).addScaledVector(this._dir, 0.5);
        this.flashLight.intensity = 2600 * fl * fl;
        this.bounceLight.position.copy(this._muzzleWorld).addScaledVector(this._dir, 1.6);
        this.bounceLight.position.y = 0.4;
        this.bounceLight.intensity = 900 * fl;
      } else {
        this.flashGroup.visible = false;
        this.flashLight.intensity = 0;
        this.bounceLight.intensity = 0;
      }

      /* --- 抽气装置漏烟 --- */
      if (!this._fumed && t > 0.34) {
        this._fumed = true;
        this.#emitFume();
      }

      /* --- 装填循环 --- */
      if (this.animateLoader) {
        // 开闩
        if (wedge) {
          const open = seq(0.1, 0.2) - seq(0.86, 0.95);
          wedge.position.y = -0.34 * THREE.MathUtils.clamp(open, 0, 1);
        }
        if (!this._openClank && t > 0.1 * T) {
          this._openClank = true;
          this.#clank(0, 0.22, 2200);
          this.#emitEject();
        }
        // 转盘选弹
        if (car) {
          const k = seq(0.16, 0.42);
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          car.rotation.y = this.carouselStart + (this.carouselTarget - this.carouselStart) * e;
        }
        // 提弹（转盘平面 −0.45 → 炮膛轴线 0.60，行程 1.05 m）
        if (lift) {
          const up = seq(0.44, 0.56) - seq(0.8, 0.92);
          lift.position.y = -0.45 + 1.05 * THREE.MathUtils.clamp(up, 0, 1);
        }
        // 推弹（两次：弹丸、药筒），行程 1.2 m
        if (ram) {
          const p1 = seq(0.57, 0.63) - seq(0.63, 0.69);
          const p2 = seq(0.7, 0.76) - seq(0.76, 0.82);
          ram.position.z = 1.2 * THREE.MathUtils.clamp(Math.max(p1, p2), 0, 1);
        }
        if (!this._ramClank && t > 0.63 * T) {
          this._ramClank = true;
          this.#clank(0, 0.18, 900);
        }
        if (!this._closeClank && t > 0.9 * T) {
          this._closeClank = true;
          this.#clank(0, 0.3, 2600);
        }
      }

      if (t > T) {
        this.t = -1;
        this._fumed = false;
        this._openClank = false;
        this._ramClank = false;
        this._closeClank = false;
        if (rec) rec.position.z = 0;
        if (wedge) wedge.position.y = 0;
        if (lift) lift.position.y = -0.45;
        if (ram) ram.position.z = 0;
        if (this.onStateChange) this.onStateChange('ready');
      }
    }

    /* --- 车体后坐反应（阻尼振荡）--- */
    // 幅值标定：58 t 车体在 125 mm 火炮后坐冲量下的抬头量约 0.5°、悬挂行程约 1 cm
    const k1 = 46;
    const c1 = 6.2;
    this.rock.v += (-k1 * this.rock.x - c1 * this.rock.v) * dt;
    this.rock.x += this.rock.v * dt;
    this.bob.v += (-38 * this.bob.x - 5.4 * this.bob.v) * dt;
    this.bob.x += this.bob.v * dt;
    if (R.root) {
      R.root.rotation.x = this.rock.x * 0.058;
      R.root.position.y = -Math.abs(this.bob.x) * 0.09;
    }

    /* --- 粒子 --- */
    this.smoke.update(dt);
    this.spark.update(dt);
    if (camera) {
      const h = this.scene.userData.viewportHeight || 800;
      this.smoke.material.uniforms.uScale.value = h * 0.9;
      this.spark.material.uniforms.uScale.value = h * 0.9;
    }
  }

  setSmokeAmount(v) {
    this.smokeAmount = v;
  }

  setSound(on) {
    this.soundOn = on;
  }

  setReloadTime(v) {
    this.reloadTime = v;
  }

  dispose() {
    this.smoke.dispose();
    this.spark.dispose();
    this.smokeTex.dispose();
    this.flashTex.dispose();
    this.flashMat.dispose();
    this.flashCone.geometry.dispose();
    this.flashDisc.geometry.dispose();
    this.flashDisc2.geometry.dispose();
  }
}
