import * as THREE from 'three';
import type { Sandbox } from '../sandbox';
import type { Disaster, DisasterId } from './types';

export interface DisasterCtx {
  sandbox: Sandbox;
  message: (text: string) => void;
}

/** Shared no-op scaffolding for one-shot disasters. */
abstract class Instant implements Disaster {
  readonly sustained = false;
  constructor(
    readonly id: DisasterId,
    protected readonly ctx: DisasterCtx,
  ) {}
  get running(): boolean {
    return false;
  }
  abstract trigger(x: number, z: number, power: number): void;
  stop(): void {
    /* instant disasters cannot be stopped */
  }
  steer(_v: THREE.Vector2, _dt: number): void {
    /* not steerable */
  }
  update(_dt: number, _simDt: number): void {
    /* stateless by default */
  }
  reset(): void {
    /* nothing persistent */
  }
  runningHint(): string {
    return '';
  }
}

// --------------------------------------------------------------------- blast
export class BlastDisaster extends Instant {
  constructor(ctx: DisasterCtx) {
    super('blast', ctx);
  }

  override trigger(x: number, z: number, power: number): void {
    const s = this.ctx.sandbox;
    const R = 9 * power;
    const y = R * 0.2;
    s.audio.explosion(power);
    s.screen.shake(0.3 + power * 0.22);
    s.screen.flash(0xffcf8a, 0.34 * power, 6.5);
    s.damageSphere(x, y, z, R, {
      radius: R,
      force: 25 * power,
      debris: 999,
      scorch: 0.75,
      up: 0.55,
      jagged: 0.55,
    });
    s.explosionFx(x, y, z, R, 0xffb457);
    s.shock.sphere(x, y, z, R * 0.2, R * 0.8, 0.26, 0xfff3d0, 2.2, 1, 1);
    s.decals.scorch(x, z, R * 1.15, 1);
    s.blastEntities(x, z, R, power);
    s.addFire(x, 1.2, z, R * 0.45, 2.6, 1);
    s.smokeColumn(x, 2, z, 12, R * 0.3, 2.2);
  }
}

// -------------------------------------------------------------------- meteor
interface Rock {
  mesh: THREE.Mesh;
  glow: THREE.Mesh;
  active: boolean;
  t: number;
  dur: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  power: number;
}

export class MeteorDisaster extends Instant {
  private rocks: Rock[] = [];

  constructor(ctx: DisasterCtx) {
    super('meteor', ctx);
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const glowGeo = new THREE.IcosahedronGeometry(1.5, 1);
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshLambertMaterial({ color: 0x3a2a20, emissive: 0x501c00, emissiveIntensity: 1 }),
      );
      const glow = new THREE.Mesh(
        glowGeo,
        new THREE.MeshBasicMaterial({
          color: 0xff7a2a,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      mesh.add(glow);
      mesh.visible = false;
      mesh.frustumCulled = false;
      ctx.sandbox.engine.scene.add(mesh);
      this.rocks.push({
        mesh,
        glow,
        active: false,
        t: 0,
        dur: 1,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        power: 1,
      });
    }
  }

  override trigger(x: number, z: number, power: number): void {
    const s = this.ctx.sandbox;
    let r = this.rocks.find((k) => !k.active);
    if (!r) r = this.rocks[0];
    r.active = true;
    r.t = 0;
    r.dur = 1.25;
    r.power = power;
    const a = Math.random() * Math.PI * 2;
    r.from.set(x + Math.cos(a) * 90, 210, z + Math.sin(a) * 90);
    r.to.set(x, 1.5, z);
    const sc = 1.4 + power * 1.5;
    r.mesh.scale.setScalar(sc);
    r.mesh.position.copy(r.from);
    r.mesh.visible = true;
    s.audio.meteorWhoosh(r.dur);
    s.crowd.panic(x, z, 22 * power);
    this.ctx.message('陨石接近中…');
  }

  override update(_dt: number, simDt: number): void {
    const s = this.ctx.sandbox;
    for (const r of this.rocks) {
      if (!r.active) continue;
      r.t += simDt;
      const p = Math.min(1, r.t / r.dur);
      const e = p * p;
      r.mesh.position.lerpVectors(r.from, r.to, e);
      r.mesh.rotation.x += simDt * 6;
      r.mesh.rotation.y += simDt * 4.5;
      (r.glow.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.random() * 0.35;
      // burning trail
      const px = r.mesh.position.x;
      const py = r.mesh.position.y;
      const pz = r.mesh.position.z;
      s.fire(px, py, pz, 5, 1.6 + r.power, 0.85);
      s.smokeColumn(px, py, pz, 2, 1.4, 1.6);
      s.sparkBurst(px, py, pz, 3, 6, 0xffb066);
      if (p >= 1) {
        r.active = false;
        r.mesh.visible = false;
        this.impact(r.to.x, r.to.z, r.power);
      }
    }
  }

  private impact(x: number, z: number, power: number): void {
    const s = this.ctx.sandbox;
    const R = 15 * power;
    s.audio.explosion(power * 1.8);
    s.screen.shake(0.55 + power * 0.4);
    s.screen.flash(0xffb070, 0.55 * power, 4.4);
    s.screen.kickExposure(1.25);
    s.damageSphere(x, R * 0.16, z, R, {
      radius: R,
      force: 33 * power,
      debris: 999,
      scorch: 0.9,
      up: 0.75,
      jagged: 0.6,
    });
    s.explosionFx(x, R * 0.2, z, R * 1.1, 0xff8a3a);
    s.shock.sphere(x, R * 0.15, z, R * 0.25, R * 1.5, 0.5, 0xffd9a0, 2, 1, 0.85);
    s.shock.ring(x, 0.32, z, R * 0.4, R * 3, 0.9, 0xffe2b0, 1.2);
    s.shock.ring(x, 0.34, z, R * 0.2, R * 2.1, 0.55, 0xff9a4a, 1);
    s.decals.crater(x, z, R * 0.55);
    s.blastEntities(x, z, R, power * 1.4);
    s.addFire(x, 1.4, z, R * 0.5, 6, 1.4);
    s.smokeColumn(x, 3, z, 34, R * 0.35, 3.4);
    s.crowd.panic(x, z, R * 4);
    // rim ejecta
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = R * (0.4 + Math.random() * 0.5);
      s.debris.spawn(
        x + Math.cos(a) * rr,
        1,
        z + Math.sin(a) * rr,
        Math.cos(a) * 12,
        12 + Math.random() * 16,
        Math.sin(a) * 12,
        0.9,
        0.9,
        0.9,
        0.19,
        0.14,
        0.1,
      );
    }
  }

  override reset(): void {
    for (const r of this.rocks) {
      r.active = false;
      r.mesh.visible = false;
    }
  }
}

// ----------------------------------------------------------------- lightning
export class LightningDisaster extends Instant {
  constructor(ctx: DisasterCtx) {
    super('lightning', ctx);
  }

  override trigger(x: number, z: number, power: number): void {
    strikeAt(this.ctx.sandbox, x, z, power, true);
  }
}

/** Shared by the single bolt tool and the storm. */
export function strikeAt(s: Sandbox, x: number, z: number, power: number, strong: boolean): void {
  const R = 4.2 * power;
  s.bolts.strike(x, z, 165, strong ? 0xffffff : 0xeaf6ff);
  s.screen.flash(0xeaf4ff, strong ? 0.5 : 0.32, 9);
  s.screen.shake(strong ? 0.22 : 0.12);
  s.sky.pulseSun(strong ? 0.3 : 0.18);
  s.audio.zap();
  s.audio.thunder(strong ? 0.1 : 0.45);
  s.damageSphere(x, R * 0.35, z, R, {
    radius: R,
    force: 20 * power,
    debris: 60,
    scorch: 1,
    up: 0.9,
    jagged: 0.7,
  });
  s.sparkBurst(x, 1.2, z, 34, 20, 0xdff0ff);
  s.sparkBurst(x, 1.2, z, 16, 9, 0xfff3c0);
  s.shock.ring(x, 0.3, z, 1, R * 3.4, 0.42, 0xdff0ff, 1.1);
  s.decals.scorch(x, z, R * 1.2, 1);
  s.addFire(x, 1, z, R * 0.5, 2.2, 0.8);
  s.blastEntities(x, z, R * 0.9, power * 0.7);
  s.crowd.panic(x, z, R * 6);
}

// ---------------------------------------------------------------------- nuke
type NukeStage = { t: number; r: number; force: number };

export class NukeDisaster extends Instant {
  private phase: 'idle' | 'drop' | 'blast' = 'idle';
  private timer = 0;
  private x = 0;
  private z = 0;
  private power = 1;
  private radius = 36;
  private stages: NukeStage[] = [];
  private stageIdx = 0;
  private mush = 0;
  private beep = 0;
  private bomb: THREE.Group;

  constructor(ctx: DisasterCtx) {
    super('nuke', ctx);
    this.bomb = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.9, 3, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0xe8e4d8 }),
    );
    body.rotation.x = Math.PI / 2;
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 1.6, 10),
      new THREE.MeshLambertMaterial({ color: 0xd84a3a }),
    );
    nose.position.y = -2.6;
    nose.rotation.x = Math.PI;
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.2, 0.16),
      new THREE.MeshLambertMaterial({ color: 0xd84a3a }),
    );
    fin.position.y = 2;
    const fin2 = fin.clone();
    fin2.rotation.y = Math.PI / 2;
    this.bomb.add(body, nose, fin, fin2);
    this.bomb.visible = false;
    ctx.sandbox.engine.scene.add(this.bomb);
  }

  override get running(): boolean {
    return this.phase !== 'idle';
  }

  override trigger(x: number, z: number, power: number): void {
    if (this.phase !== 'idle') return;
    this.x = x;
    this.z = z;
    this.power = power;
    this.radius = 36 * power;
    this.phase = 'drop';
    this.timer = 0;
    this.beep = 0;
    this.bomb.position.set(x, 185, z);
    this.bomb.visible = true;
    this.ctx.sandbox.audio.meteorWhoosh(1.9);
    this.ctx.message('核弹投放中… 3');
    this.ctx.sandbox.crowd.panic(x, z, 999);
  }

  override update(_dt: number, simDt: number): void {
    const s = this.ctx.sandbox;
    if (this.phase === 'drop') {
      this.timer += simDt;
      const p = Math.min(1, this.timer / 1.9);
      this.bomb.position.y = 185 - 183 * p * p;
      this.bomb.rotation.z = Math.sin(this.timer * 3) * 0.12;
      s.smokeColumn(this.bomb.position.x, this.bomb.position.y, this.bomb.position.z, 1, 0.8, 1.4);
      this.beep -= simDt;
      if (this.beep <= 0) {
        this.beep = 0.45;
        s.audio.uiClick();
        const left = Math.max(1, Math.ceil((1.9 - this.timer) / 0.63));
        this.ctx.message(`核弹投放中… ${left}`);
      }
      if (p >= 1) {
        this.bomb.visible = false;
        this.detonate();
      }
      return;
    }
    if (this.phase !== 'blast') return;

    this.timer += simDt;
    // staged destruction wave
    while (this.stageIdx < this.stages.length && this.timer >= this.stages[this.stageIdx].t) {
      const st = this.stages[this.stageIdx++];
      s.damageSphere(this.x, this.radius * 0.1, this.z, st.r, {
        radius: st.r,
        force: st.force,
        debris: 999,
        scorch: 1,
        up: 0.6,
        jagged: 0.42,
      });
      s.blastEntities(this.x, this.z, st.r, this.power * 1.6);
      s.shock.ring(this.x, 0.34, this.z, st.r * 0.5, st.r * 2.4, 1.1, 0xfff0c8, 1.1);
    }

    // mushroom cloud emission
    this.mush += simDt;
    if (this.mush < 9) {
      const stemH = Math.min(58, 8 + this.mush * 16);
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * this.radius * 0.16;
        s.smoke.spawn(
          this.x + Math.cos(a) * rr,
          2 + Math.random() * stemH,
          this.z + Math.sin(a) * rr,
          Math.cos(a) * 2,
          16 + Math.random() * 14,
          Math.sin(a) * 2,
          3.4 + Math.random() * 2,
          6,
          16,
          0.34,
          0.3,
          0.28,
          0.62,
          1.4,
          0.5,
          0.3,
        );
      }
      if (this.mush > 0.9) {
        for (let i = 0; i < 4; i++) {
          const a = Math.random() * Math.PI * 2;
          const rr = this.radius * (0.18 + Math.random() * 0.5);
          const cap = 46 + Math.min(26, this.mush * 5);
          s.smoke.spawn(
            this.x + Math.cos(a) * rr * 0.4,
            cap + Math.random() * 12,
            this.z + Math.sin(a) * rr * 0.4,
            Math.cos(a) * (7 + Math.random() * 9),
            3 + Math.random() * 5,
            Math.sin(a) * (7 + Math.random() * 9),
            4.5 + Math.random() * 3,
            9,
            26,
            0.46,
            0.42,
            0.4,
            0.5,
            0.7,
            0.55,
            0.2,
          );
        }
      }
      if (this.mush < 3.4 && Math.random() < simDt * 26) {
        const a = Math.random() * Math.PI * 2;
        const rr = Math.random() * this.radius * 0.55;
        s.fire(this.x + Math.cos(a) * rr, 2 + Math.random() * 26, this.z + Math.sin(a) * rr, 4, 4, 1.6);
      }
    }
    if (this.timer > 10) this.phase = 'idle';
  }

  private detonate(): void {
    const s = this.ctx.sandbox;
    const R = this.radius;
    this.phase = 'blast';
    this.timer = 0;
    this.mush = 0;
    this.stageIdx = 0;
    this.stages = [
      { t: 0, r: R * 0.34, force: 62 * this.power },
      { t: 0.13, r: R * 0.6, force: 46 * this.power },
      { t: 0.3, r: R * 0.82, force: 34 * this.power },
      { t: 0.52, r: R, force: 24 * this.power },
    ];
    this.ctx.message('核爆！');

    s.audio.nuke();
    s.screen.flash(0xffffff, 2.6, 1.05);
    s.screen.kickExposure(2.1);
    s.screen.shake(1.25);
    s.sky.pulseSun(1.5);
    // fireball + multi-layer shock
    s.shock.sphere(this.x, R * 0.2, this.z, R * 0.1, R * 0.72, 1.5, 0xfff6d8, 2.6, 1, 0.95);
    s.shock.sphere(this.x, R * 0.22, this.z, R * 0.2, R * 1.15, 1.05, 0xffc061, 1.8, 0.4, 0.8);
    s.shock.sphere(this.x, R * 0.25, this.z, R * 0.3, R * 1.7, 1.8, 0xffe9b0, 1.1, 0, 0.55);
    s.shock.ring(this.x, 0.35, this.z, R * 0.2, R * 4.2, 1.9, 0xfff4d0, 1.3);
    s.sparkBurst(this.x, 4, this.z, 140, R * 2.2, 0xffe6a8);
    s.decals.crater(this.x, this.z, R * 0.45);
    s.decals.scorch(this.x, this.z, R * 0.95, 0.85);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.random();
      const rr = R * (0.25 + Math.random() * 0.6);
      s.addFire(this.x + Math.cos(a) * rr, 1.2, this.z + Math.sin(a) * rr, R * 0.14, 14 + Math.random() * 8, 1.2);
    }
    s.crowd.panic(this.x, this.z, 999);
  }

  override reset(): void {
    this.phase = 'idle';
    this.bomb.visible = false;
    this.stages.length = 0;
    this.stageIdx = 0;
  }

  override runningHint(): string {
    return this.phase === 'drop' ? '核弹投放中…' : '';
  }
}
