/**
 * OceanScene.js — 大海（水龙卷）。
 *
 * 船只不是"播放翻船动画"：每条船是 FloatingBody，多点浮力提供复原力矩，
 * 龙卷风的切向风 + 上升气流作用在水线以上的受风形心产生倾覆力矩，
 * 当复原力矩不足时船自己翻过去、进水、下沉，并抛出碎片。
 */
import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { Ocean } from '../water/Ocean.js';
import { FloatingBody } from '../core/MiniPhysics.js';
import { Rng } from '../core/Random.js';
import { P } from '../core/Params.js';
import { clamp } from '../core/Random.js';
import { bucketMaterials, collapseObject } from '../world/MeshMerge.js';

const SEABED = -26;

export class OceanScene extends SceneBase {
  constructor(ctx) {
    super(ctx);
    this.name = 'ocean';
    this.label = '大海';
    this.groundAlbedo = 0x14212b;
    this.dustColor = new THREE.Color(0.72, 0.76, 0.80);   // 海上是水雾而不是尘土
    this.waterMode = 1;
    this.camStart = {
      pos: new THREE.Vector3(-330, 62, 400),
      target: new THREE.Vector3(90, 150, -80),
    };
    this.radius = 2000;
    this.boats = [];
    this._sunkCount = 0;
    this._capsizeCount = 0;
    this._wakeT = 0;
  }

  async build() {
    const rng = new Rng(4242);
    this.rng = rng;
    this.ctx.boot?.(0.35, '构建频谱海面（FFT + 波动方程）…');

    this.ocean = new Ocean({
      renderer: this.engine.renderer,
      lighting: this.lighting,
      seaLevel: 0,
      fftSize: P.get('q_fft') | 0,
      rMax: 16000,
    });
    this.scene.add(this.ocean.mesh);

    /* 物理：水面用海面高度，"地面"是海底（沉没物落到那儿就看不见了） */
    this.physics.groundAt = () => SEABED;
    this.physics.waterAt = (x, z) => this.ocean.heightAt(x, z);
    this.physics.waterVelAt = (x, z, out) => this.ocean.velAt(x, z, out);

    this.ctx.boot?.(0.6, '布置船只与航标…');
    await this._buildBoats(rng);
    this._buildLandmarks(rng);
  }

  async _buildBoats(rng) {
    this._boatMats = bucketMaterials(this.lighting, { matteRough: 0.62, metalRough: 0.42 });
    let Ships = null;
    try {
      Ships = await import('./props/Ships.js');
    } catch (e) {
      window.__diag?.('Ships.js 未就绪，使用简易船体：' + e.message);
    }
    const kinds = ['sailboat', 'sailboat', 'fishing', 'cargo', 'tug', 'yacht', 'rowboat', 'fishing', 'sailboat', 'rowboat'];
    const n = Math.round(clamp(kinds.length * P.get('q_density'), 3, kinds.length));
    for (let i = 0; i < n; i++) {
      const kind = kinds[i % kinds.length];
      const ang = (i / n) * Math.PI * 2 + rng.range(-0.25, 0.25);
      const dist = rng.range(140, 760);
      const pos = new THREE.Vector3(Math.cos(ang) * dist, 0, Math.sin(ang) * dist);
      let spec = null;
      if (Ships?.buildBoat) {
        try { spec = Ships.buildBoat(rng, kind, { sailsUp: true }); } catch (e) {
          window.__diag?.('buildBoat(' + kind + ') 失败: ' + e.message);
        }
      }
      if (!spec) spec = this._fallbackBoat(rng, kind);

      const heading = ang + Math.PI * 0.5 + rng.range(-0.4, 0.4);
      const body = new FloatingBody(Object.assign({}, spec.body, {
        pos, heading,
        quat: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading),
        selfDrive: spec.body.selfDrive ?? rng.range(1.5, 5),
      }));
      this.physics.addFloater(body);

      const grp = spec.group;
      grp.position.copy(pos);
      /* 每条船压成 1~2 个网格：draw call 从 20 多降到 2 */
      let vis = grp;
      try {
        const merged = collapseObject(grp, this._boatMats);
        if (merged) vis = merged;
      } catch (e) { window.__diag?.('boat merge failed: ' + e.message); }
      vis.position.copy(pos);
      this.lighting.register(vis, 0.85);
      this.scene.add(vis);
      this.boats.push({
        body, grp: vis, spec, label: spec.label || '船',
        broken: false, notified: false, debrisT: 0,
      });
    }
  }

  /** Ships.js 不可用时的极简替代（保证场景永远能跑起来） */
  _fallbackBoat(rng, kind) {
    const big = kind === 'cargo';
    const L = big ? 42 : 7, W = big ? 8 : 2.2, H = big ? 6 : 1.8;
    const g = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(W * 2, H, L * 2),
      new THREE.MeshStandardMaterial({ color: big ? 0x6b3b34 : 0xdfe3e6, roughness: 0.6, metalness: 0.2 }));
    hull.position.y = H * 0.1;
    hull.castShadow = hull.receiveShadow = true;
    g.add(hull);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(W * 1.2, H * 1.1, L * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.55 }));
    cab.position.set(0, H * 0.9, -L * 0.3);
    cab.castShadow = true;
    g.add(cab);
    const pts = [];
    for (let i = -2; i <= 2; i++) {
      for (const sx of [-1, 1]) pts.push(new THREE.Vector3(sx * W * 0.7, -H * 0.4, i * L * 0.42));
    }
    return {
      group: g, label: big ? '货轮' : '小船',
      debrisPoints: [new THREE.Vector3(0, 0, 0)],
      lodDistance: 900,
      body: {
        size: new THREE.Vector3(W, H, L), mass: big ? 900000 : 3200,
        points: pts, pointRadius: H * 0.5,
        sailArea: big ? 620 : 26, sailCenter: new THREE.Vector3(0, H * 1.3, 0),
        selfDrive: 2.5,
      },
    };
  }

  _buildLandmarks(rng) {
    /* 远处礁岩 + 灯塔，给海面一个尺度参照，也验证 LOD 与阴影 */
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4640, roughness: 0.95, flatShading: true });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.7 });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xa8342a, roughness: 0.7 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xffe9a8, roughness: 0.25, emissive: 0xffcc66, emissiveIntensity: 2.2,
    });
    this.lighthouseLamp = glassMat;

    const group = new THREE.Group();
    group.name = 'landmarks';

    const mkRock = (x, z, r, h, seed) => {
      const g = new THREE.IcosahedronGeometry(1, 2);
      const pos = g.attributes.position;
      const rr = new Rng(seed);
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
        const k = 1 + rr.range(-0.28, 0.28);
        pos.setXYZ(i, px * k, Math.max(py * k, -0.15), pz * k);
      }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, rockMat);
      m.scale.set(r, h, r * rr.range(0.8, 1.25));
      m.position.set(x, -h * 0.28, z);
      m.castShadow = m.receiveShadow = true;
      return m;
    };

    /* 灯塔岛 */
    const lx = 1180, lz = -880;
    group.add(mkRock(lx, lz, 78, 46, 11));
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 7.4, 34, 18, 1), wallMat);
    tower.position.set(lx, 34 * 0.5 + 14, lz);
    tower.castShadow = tower.receiveShadow = true;
    group.add(tower);
    for (let i = 0; i < 3; i++) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(6.1 - i * 0.55, 6.6 - i * 0.55, 3.4, 18, 1), redMat);
      band.position.set(lx, 18 + i * 11, lz);
      band.castShadow = true;
      group.add(band);
    }
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 5.2, 14, 1), glassMat);
    lamp.position.set(lx, 34 + 14 + 1.6, lz);
    group.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(5.0, 4.4, 14), redMat);
    cap.position.set(lx, 34 + 14 + 6.2, lz);
    cap.castShadow = true;
    group.add(cap);

    /* 散落礁石 */
    for (let i = 0; i < 9; i++) {
      const a = rng.range(0, Math.PI * 2), d = rng.range(900, 3400);
      group.add(mkRock(Math.cos(a) * d, Math.sin(a) * d, rng.range(14, 64), rng.range(9, 38), 300 + i));
    }
    this.lighting.register(group, 0.9);
    this.scene.add(group);
    this.landmarks = group;
  }

  heightAt() { return 0; }             // 龙卷风底部与相机地板都按海平面
  get waterAt() { return this.ocean ? ((x, z) => this.ocean.heightAt(x, z)) : null; }
  get waterVelAt() { return this.ocean ? ((x, z, out) => this.ocean.velAt(x, z, out)) : null; }

  pickStrikeTarget() {
    /* 扑向最近的、还没翻的船 */
    let best = null, bd = 1e9;
    for (const b of this.boats) {
      if (b.body.capsized || b.body.sunk > 0.6) continue;
      const d = b.body.pos.distanceTo(this.tornado.position);
      if (d < bd) { bd = d; best = b; }
    }
    return best ? { x: best.body.pos.x, z: best.body.pos.z } : null;
  }

  updateScene(dt) {
    this.ocean.update(dt, this.engine.camera, this.tornado);
    if ((P.get('q_fft') | 0) !== this.ocean.fft.size) this.ocean.setFFTSize(P.get('q_fft') | 0);

    /* 灯塔灯光随风暴闪烁 */
    if (this.lighthouseLamp) {
      this.lighthouseLamp.emissiveIntensity = 1.6 + 1.4 * Math.abs(Math.sin(this.engine.time * 0.9));
    }

    /* 船只：同步姿态、尾迹、翻覆与解体 */
    this._wakeT += dt;
    const doWake = this._wakeT > 0.12;
    if (doWake) this._wakeT = 0;
    for (const b of this.boats) {
      const f = b.body;
      b.grp.position.copy(f.pos);
      b.grp.quaternion.copy(f.quat);
      if (f.sunk > 0.99) b.grp.visible = false;

      if (doWake) {
        const spd = Math.hypot(f.vel.x, f.vel.z);
        if (spd > 0.4 || f.capsized) {
          this.ocean.splash(f.pos.x, f.pos.z, Math.max(f.size.z * 0.7, 4), (f.capsized ? 0.7 : 0.16) * Math.min(spd, 9) * 0.05);
        }
      }

      if (f.capsized && !b.notified) {
        b.notified = true;
        this._capsizeCount++;
        this.ctx.toast?.(`${b.label} 被掀翻！`);
        this.ocean.splash(f.pos.x, f.pos.z, f.size.z * 1.4, 1.4);
        /* 解体碎片 */
        const pts = b.spec.debrisPoints || [new THREE.Vector3()];
        const nd = Math.round(clamp(10 * P.get('t_debris'), 4, 26));
        for (let i = 0; i < nd; i++) {
          const lp = pts[i % pts.length];
          const wp = lp.clone().applyQuaternion(f.quat).add(f.pos);
          const sz = new THREE.Vector3(
            this.rng.range(0.18, 0.7), this.rng.range(0.08, 0.3), this.rng.range(0.6, 2.4));
          this.debris.spawn(wp, sz, {
            vel: new THREE.Vector3(this.rng.gauss() * 6, this.rng.range(2, 14), this.rng.gauss() * 6),
            density: 300, cd: 1.5, buoyant: true,
            color: new THREE.Color().setHSL(0.09, 0.28, this.rng.range(0.34, 0.66)),
            life: 90,
          });
        }
      }
      if (f.sunk > 0.5 && !b.sunkNotified) {
        b.sunkNotified = true;
        this._sunkCount++;
      }
    }
  }

  rebuild() {
    /* 复位所有船 */
    for (const b of this.boats) {
      const f = b.body;
      const ang = Math.atan2(f.pos.z, f.pos.x);
      const d = clamp(Math.hypot(f.pos.x, f.pos.z), 160, 780);
      f.pos.set(Math.cos(ang) * d, 0, Math.sin(ang) * d);
      f.vel.set(0, 0, 0);
      f.omega.set(0, 0, 0);
      f.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang + Math.PI * 0.5);
      f.capsized = false; f.capsizeT = 0; f.sunk = 0;
      f.selfDrive = 2.6;
      b.notified = false; b.sunkNotified = false;
      b.grp.visible = true;
    }
    this._capsizeCount = 0; this._sunkCount = 0;
    this.ocean.ripple.reset();
  }

  extraStats() {
    const o = this.ocean;
    return `有效波高 ${(o ? o.swell.hs : 0).toFixed(1)}m  翻船 ${this._capsizeCount}/${this.boats.length}` +
      `  涟漪 ${o ? o.ripple.maxAmp.toFixed(2) : 0}m  FFT ${o ? o.fft.size : 0}`;
  }

  disposeScene() {
    this.ocean?.dispose();
  }

  selftest() {
    const o = this.ocean;
    const h0 = o.heightAt(0, 0), h1 = o.heightAt(120, -80);
    const v = o.velAt(50, 50, new THREE.Vector3());
    return [
      [Number.isFinite(h0) && Number.isFinite(h1), 'ocean height finite'],
      [Math.abs(h0) < 40, 'ocean height in range'],
      [o.swell.hs > 0.3 && o.swell.hs < 12, 'significant wave height plausible (' + o.swell.hs.toFixed(2) + 'm)'],
      [Number.isFinite(v.length()), 'ocean velocity finite'],
      [this.boats.length >= 3, 'boats spawned (' + this.boats.length + ')'],
      [this.physics.floaters.length === this.boats.length, 'floaters registered'],
      [o.fft.size >= 64, 'fft size ' + o.fft.size],
      [Number.isFinite(o.ripple.maxAmp), 'ripple sim stable'],
      [o.ripple.maxAmp < 60, 'ripple sim not exploding (' + o.ripple.maxAmp.toFixed(2) + ')'],
    ];
  }
}
