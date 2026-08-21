import * as THREE from 'three';
import { clamp } from '../core/rng';
import type { Threat } from '../world/traffic';
import { CITY_HALF } from '../world/layout';
import { swayUniforms } from '../world/voxels';
import type { DisasterCtx } from './instant';
import { strikeAt } from './instant';
import type { Disaster, DisasterId } from './types';

abstract class Sustained implements Disaster {
  readonly sustained = true;
  protected on = false;
  constructor(
    readonly id: DisasterId,
    protected readonly ctx: DisasterCtx,
  ) {}
  get running(): boolean {
    return this.on;
  }
  abstract trigger(x: number, z: number, power: number): void;
  abstract stop(): void;
  abstract update(dt: number, simDt: number): void;
  steer(_v: THREE.Vector2, _dt: number): void {
    /* overridden by steerable disasters */
  }
  reset(): void {
    if (this.on) this.stop();
  }
  runningHint(): string {
    return '';
  }
}

// ------------------------------------------------------------------- tornado
export class TornadoDisaster extends Sustained {
  private funnel: THREE.Mesh;
  private uniforms = { uTime: { value: 0 } };
  private x = 0;
  private z = 0;
  private power = 1;
  private radius = 16;
  private height = 78;
  private heading = 0;
  private wander = 0;
  private carve = 0;
  private emit = 0;
  private fade = 0;
  private threat: Threat | null = null;

  constructor(ctx: DisasterCtx) {
    super('tornado', ctx);
    const geo = new THREE.CylinderGeometry(1, 0.26, 1, 34, 18, true);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float sw = vUv.x * 6.2831 * 2.0 + vUv.y * 9.0 - uTime * 7.0;
          float bands = sin( sw ) * 0.5 + 0.5;
          float bands2 = sin( sw * 2.3 + 1.7 ) * 0.5 + 0.5;
          float a = 0.16 + 0.42 * bands * ( 0.4 + 0.6 * bands2 );
          a *= smoothstep( 0.0, 0.10, vUv.y );
          a *= 1.0 - smoothstep( 0.78, 1.0, vUv.y ) * 0.65;
          vec3 c = mix( vec3( 0.42, 0.42, 0.46 ), vec3( 0.86, 0.88, 0.92 ), bands );
          gl_FragColor = vec4( c, a );
        }`,
    });
    this.funnel = new THREE.Mesh(geo, mat);
    this.funnel.visible = false;
    this.funnel.frustumCulled = false;
    this.funnel.renderOrder = 3;
    ctx.sandbox.engine.scene.add(this.funnel);
  }

  override trigger(x: number, z: number, power: number): void {
    const s = this.ctx.sandbox;
    this.on = true;
    this.fade = 1;
    this.x = x;
    this.z = z;
    this.power = power;
    this.radius = 16 * power;
    this.height = 62 + 26 * power;
    this.heading = Math.random() * Math.PI * 2;
    this.funnel.visible = true;
    const v = s.fields.vortices[0];
    v.active = true;
    v.x = x;
    v.z = z;
    v.radius = this.radius * 1.5;
    v.strength = 12 * power;
    v.top = this.height * 0.8;
    if (!this.threat) this.threat = s.addThreat(x, z, this.radius, power);
    s.audio.windLevel(1);
    this.ctx.message('龙卷风登陆！WASD / 方向键控制移动');
  }

  override stop(): void {
    const s = this.ctx.sandbox;
    this.on = false;
    s.fields.vortices[0].active = false;
    if (this.threat) {
      s.removeThreat(this.threat);
      this.threat = null;
    }
    s.audio.windLevel(0);
  }

  override steer(v: THREE.Vector2, dt: number): void {
    if (!this.on || (v.x === 0 && v.y === 0)) return;
    const sp = 22 * dt;
    this.x += v.x * sp;
    this.z += v.y * sp;
    this.heading = Math.atan2(v.y, v.x);
  }

  override update(_dt: number, simDt: number): void {
    const s = this.ctx.sandbox;
    if (!this.on) {
      if (this.fade > 0) {
        this.fade = Math.max(0, this.fade - simDt * 1.2);
        this.applyTransform();
        if (this.fade === 0) this.funnel.visible = false;
      }
      return;
    }
    this.uniforms.uTime.value += simDt;
    // gentle自主 wander so it never stands still
    this.wander += simDt;
    this.heading += Math.sin(this.wander * 0.6) * simDt * 0.9;
    const drift = 8 * simDt;
    this.x += Math.cos(this.heading) * drift;
    this.z += Math.sin(this.heading) * drift;
    const lim = CITY_HALF + 26;
    if (Math.abs(this.x) > lim) {
      this.x = clamp(this.x, -lim, lim);
      this.heading = Math.PI - this.heading;
    }
    if (Math.abs(this.z) > lim) {
      this.z = clamp(this.z, -lim, lim);
      this.heading = -this.heading;
    }
    this.applyTransform();

    const v = s.fields.vortices[0];
    v.x = this.x;
    v.z = this.z;
    if (this.threat) {
      this.threat.x = this.x;
      this.threat.z = this.z;
    }

    // ---- rip voxels loose near the funnel core
    this.carve -= simDt;
    if (this.carve <= 0) {
      this.carve = 0.06;
      const r = this.radius * 0.5;
      const cap = Math.round(18 + this.power * 14);
      let taken = 0;
      const picked: number[] = [];
      s.field.queryCylinder(this.x, this.z, r, 0, this.height * 0.7, (id) => {
        if (taken >= cap) return;
        if (Math.random() < 0.35) {
          picked.push(id);
          taken++;
        }
      });
      for (const id of picked) {
        const dx = s.field.posX[id] - this.x;
        const dz = s.field.posZ[id] - this.z;
        const d = Math.max(0.8, Math.hypot(dx, dz));
        s.city.pushDirection(id, dx / d, dz / d);
        s.debris.spawnFromVoxel(
          s.field,
          id,
          (-dz / d) * 20 - (dx / d) * 5,
          10 + Math.random() * 12,
          (dx / d) * 20 - (dz / d) * 5,
        );
        s.killVoxel(id);
      }
    }

    // ---- swirl particles
    this.emit -= simDt;
    if (this.emit <= 0) {
      this.emit = 0.02;
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2;
        const hy = Math.random() * this.height * 0.85;
        const rr = this.radius * (0.25 + 0.75 * (hy / this.height)) * (0.7 + Math.random() * 0.5);
        const g = 0.5 + Math.random() * 0.35;
        s.smoke.spawn(
          this.x + Math.cos(a) * rr,
          hy + 0.4,
          this.z + Math.sin(a) * rr,
          -Math.sin(a) * 22,
          6 + Math.random() * 8,
          Math.cos(a) * 22,
          1.1 + Math.random() * 0.9,
          2.4,
          5.5,
          g,
          g * 0.97,
          g * 0.93,
          0.5,
          0.4,
          0.5,
          1,
        );
      }
      s.dust(this.x, 0.6, this.z, 3, this.radius * 0.8, 1.1);
    }
    s.crowd.panic(this.x, this.z, this.radius * 2.2);
  }

  private applyTransform(): void {
    const h = this.height * this.fade;
    const r = this.radius * this.fade;
    this.funnel.scale.set(r, h, r);
    this.funnel.position.set(this.x, h / 2, this.z);
    this.funnel.rotation.y += 0.06;
  }

  override runningHint(): string {
    return 'WASD / 方向键移动龙卷风 · 再次点击按钮结束';
  }
}

// ----------------------------------------------------------------- black hole
export class BlackHoleDisaster extends Sustained {
  private group = new THREE.Group();
  private core: THREE.Mesh;
  private halo: THREE.Mesh;
  private disc: THREE.Mesh;
  private discUniforms = { uTime: { value: 0 } };
  private x = 0;
  private z = 0;
  private y = 15;
  private power = 1;
  private radius = 26;
  private life = 0;
  private eat = 0;
  private threat: Threat | null = null;

  constructor(ctx: DisasterCtx) {
    super('blackhole', ctx);
    this.core = new THREE.Mesh(
      new THREE.SphereGeometry(1, 26, 18),
      new THREE.MeshBasicMaterial({ color: 0x08040e }),
    );
    this.halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.42, 26, 18),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        uniforms: {},
        vertexShader: `
          varying vec3 vN; varying vec3 vP;
          void main() {
            vN = normalize( normalMatrix * normal );
            vec4 mv = modelViewMatrix * vec4( position, 1.0 );
            vP = mv.xyz;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          varying vec3 vN; varying vec3 vP;
          void main() {
            float rim = pow( 1.0 - abs( dot( normalize( vN ), normalize( -vP ) ) ), 3.0 );
            vec3 c = mix( vec3( 0.42, 0.12, 0.72 ), vec3( 0.95, 0.72, 1.0 ), rim );
            gl_FragColor = vec4( c * rim * 2.2, 1.0 );
          }`,
      }),
    );
    this.disc = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.36, 12, 96),
      new THREE.ShaderMaterial({
        uniforms: this.discUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          }`,
        fragmentShader: `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            float streak = sin( vUv.x * 62.0 - uTime * 22.0 ) * 0.5 + 0.5;
            float glow = 0.35 + 0.65 * streak;
            vec3 c = mix( vec3( 0.72, 0.24, 1.0 ), vec3( 1.0, 0.86, 0.72 ), streak * 0.75 );
            gl_FragColor = vec4( c * glow * 1.7, glow * 0.9 );
          }`,
      }),
    );
    this.disc.rotation.x = Math.PI / 2.35;
    this.group.add(this.core, this.halo, this.disc);
    this.group.visible = false;
    ctx.sandbox.engine.scene.add(this.group);
  }

  override trigger(x: number, z: number, power: number): void {
    const s = this.ctx.sandbox;
    this.on = true;
    this.x = x;
    this.z = z;
    this.y = 14 + 4 * power;
    this.power = power;
    this.radius = 26 * power;
    this.life = 10;
    this.eat = 2.4;
    this.group.visible = true;
    const w = s.fields.wells[0];
    w.active = true;
    w.x = x;
    w.y = this.y;
    w.z = z;
    w.radius = this.radius * 1.35;
    w.strength = 4.3 * power;
    w.eat = this.eat;
    if (!this.threat) this.threat = s.addThreat(x, z, this.radius * 0.6, power);
    s.audio.singularity(1);
    s.screen.flash(0x9a5cff, 0.32, 5);
    this.ctx.message('微型黑洞成形！WASD / 方向键控制移动');
  }

  override stop(): void {
    if (!this.on) return;
    this.collapse();
  }

  override steer(v: THREE.Vector2, dt: number): void {
    if (!this.on || (v.x === 0 && v.y === 0)) return;
    const sp = 19 * dt;
    this.x += v.x * sp;
    this.z += v.y * sp;
  }

  override update(_dt: number, simDt: number): void {
    const s = this.ctx.sandbox;
    if (!this.on) return;
    this.discUniforms.uTime.value += simDt;
    this.life -= simDt;
    const lim = CITY_HALF + 24;
    this.x = clamp(this.x, -lim, lim);
    this.z = clamp(this.z, -lim, lim);
    const pulse = 1 + Math.sin(this.life * 9) * 0.045;
    const rc = (2.6 + this.power * 1.5) * pulse;
    this.core.scale.setScalar(rc);
    this.halo.scale.setScalar(rc);
    this.disc.scale.set(rc * 3.1, rc * 3.1, rc * 3.1);
    this.disc.rotation.z += simDt * 2.4;
    this.group.position.set(this.x, this.y, this.z);

    const w = s.fields.wells[0];
    w.x = this.x;
    w.y = this.y;
    w.z = this.z;
    this.eat = 2.4 + (10 - this.life) * 0.24;
    w.eat = this.eat;
    if (this.threat) {
      this.threat.x = this.x;
      this.threat.z = this.z;
    }

    // devour structure inside the horizon
    let taken = 0;
    const picked: number[] = [];
    s.field.querySphere(this.x, this.y, this.z, this.radius * 0.62, (id, t) => {
      if (taken >= 34) return;
      if (Math.random() < 0.5 - t * 0.35) {
        picked.push(id);
        taken++;
      }
    });
    for (const id of picked) {
      const dx = s.field.posX[id] - this.x;
      const dz = s.field.posZ[id] - this.z;
      const d = Math.max(0.8, Math.hypot(dx, dz));
      s.city.pushDirection(id, -dx / d, -dz / d);
      s.debris.spawnFromVoxel(s.field, id, (-dz / d) * 9, 4 + Math.random() * 6, (dx / d) * 9);
      s.killVoxel(id);
    }
    // accretion sparkle
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = rc * (3 + Math.random() * 1.4);
      s.sparks.spawn(
        this.x + Math.cos(a) * rr,
        this.y + (Math.random() - 0.5) * 2,
        this.z + Math.sin(a) * rr,
        -Math.sin(a) * 12,
        0,
        Math.cos(a) * 12,
        0.5,
        0.5,
        0.1,
        0.85,
        0.55,
        1,
        1,
        0,
        0.5,
        1,
      );
    }
    s.crowd.panic(this.x, this.z, this.radius * 0.8);
    if (this.life <= 0) this.collapse();
  }

  private collapse(): void {
    const s = this.ctx.sandbox;
    this.on = false;
    this.group.visible = false;
    s.fields.wells[0].active = false;
    if (this.threat) {
      s.removeThreat(this.threat);
      this.threat = null;
    }
    s.audio.singularity(0);
    s.audio.implosion();
    s.screen.flash(0xd8b0ff, 1.5, 2.4);
    s.screen.shake(0.85);
    s.screen.kickExposure(1.5);
    const R = this.radius * 0.55;
    s.shock.sphere(this.x, this.y, this.z, R * 0.1, R * 1.7, 0.85, 0xc79cff, 2.4, 1, 1);
    s.shock.sphere(this.x, this.y, this.z, R * 0.4, R * 2.6, 1.3, 0xffffff, 1.2, 0, 1);
    s.shock.ring(this.x, 0.34, this.z, R * 0.2, R * 3.4, 1.1, 0xd0a8ff, 1.2);
    s.sparkBurst(this.x, this.y, this.z, 90, 46, 0xe0c0ff);
    s.damageSphere(this.x, Math.min(this.y, 8), this.z, R, {
      radius: R,
      force: 38 * this.power,
      debris: 999,
      scorch: 0.5,
      up: 0.8,
      jagged: 0.5,
    });
    s.blastEntities(this.x, this.z, R * 1.2, this.power * 1.2);
    s.decals.scorch(this.x, this.z, R * 0.9, 0.7);
    this.ctx.message('黑洞坍缩！');
  }

  override runningHint(): string {
    return `WASD / 方向键移动黑洞 · ${Math.max(0, this.life).toFixed(0)}s 后坍缩`;
  }
}

// ------------------------------------------------------------------ earthquake
export class QuakeDisaster extends Sustained {
  private ramp = 0;
  private power = 1;
  private tick = 0;
  private crackTimer = 0;

  constructor(ctx: DisasterCtx) {
    super('quake', ctx);
  }

  override trigger(_x: number, _z: number, power: number): void {
    this.on = true;
    this.power = power;
    this.ctx.sandbox.audio.quakeLevel(1);
    this.ctx.message('大地震开始！再次点击按钮停止');
  }

  override stop(): void {
    this.on = false;
    this.ctx.sandbox.audio.quakeLevel(0);
  }

  override update(_dt: number, simDt: number): void {
    const s = this.ctx.sandbox;
    const target = this.on ? 1 : 0;
    this.ramp += (target - this.ramp) * Math.min(1, simDt * (this.on ? 0.55 : 1.4));
    if (this.ramp < 0.002 && !this.on) {
      this.ramp = 0;
      swayUniforms.uQuake.value = 0;
      s.screen.setRumble(0);
      s.stress = 0;
      return;
    }
    swayUniforms.uQuake.value = 0.85 * this.power * this.ramp;
    s.screen.setRumble(0.34 * this.power * this.ramp);
    s.stress = this.ramp * this.power;

    if (!this.on) return;
    this.tick -= simDt;
    if (this.tick <= 0) {
      this.tick = 0.3 - 0.16 * this.ramp;
      const rounds = 1 + Math.floor(this.ramp * 3.4);
      for (let k = 0; k < rounds; k++) {
        const states = s.city.states;
        const bid = (Math.random() * states.length) | 0;
        const st = states[bid];
        if (st.gone) continue;
        const maxLevel = Math.random() < 0.62 ? 3 : 2 + ((Math.random() * st.levels) | 0);
        const n = 2 + ((Math.random() * (2 + this.ramp * 5)) | 0);
        for (let i = 0; i < n; i++) {
          const id = s.city.randomAliveVoxel(bid, maxLevel);
          if (id < 0) break;
          if (Math.random() < 0.55)
            s.debris.spawnFromVoxel(
              s.field,
              id,
              (Math.random() - 0.5) * 7,
              1 + Math.random() * 4,
              (Math.random() - 0.5) * 7,
            );
          s.city.pushDirection(id, Math.random() - 0.5, Math.random() - 0.5);
          s.killVoxel(id);
        }
        if (Math.random() < 0.4) s.dust(st.cx, 1, st.cz, 4, 4, 1.2);
        s.crowd.panic(st.cx, st.cz, 22 + this.ramp * 14);
      }
      if (Math.random() < 0.25 * this.ramp) s.audio.crumble();
    }
    this.crackTimer -= simDt;
    if (this.crackTimer <= 0 && this.ramp > 0.4) {
      this.crackTimer = 1.4;
      const p = s.randomCityPoint(SCRATCH_V2);
      s.decals.add(p.x, p.y, 3 + Math.random() * 5, 0x2b2118, 0.36);
      s.dust(p.x, 0.6, p.y, 5, 3, 1.4);
    }
  }

  override runningHint(): string {
    return '大地震进行中 · 再次点击按钮停止';
  }
}

const SCRATCH_V2 = new THREE.Vector2();

// ---------------------------------------------------------------------- flood
export class FloodDisaster extends Sustained {
  private power = 1;
  private splash = 0;
  private erode = 0;

  constructor(ctx: DisasterCtx) {
    super('flood', ctx);
  }

  override trigger(_x: number, _z: number, power: number): void {
    const s = this.ctx.sandbox;
    this.on = true;
    this.power = power;
    s.water.target = clamp(3.5 + 5.4 * power, 3, 14);
    s.fields.waterCurrent = 2.4 * power;
    s.audio.waterLevel(1);
    s.crowd.panic(0, 0, 999);
    this.ctx.message('洪水上涨！再次点击按钮退水');
  }

  override stop(): void {
    const s = this.ctx.sandbox;
    this.on = false;
    s.water.target = 0;
    s.fields.waterCurrent = 0;
    s.audio.waterLevel(0.0);
    this.ctx.message('洪水开始退去…');
  }

  override update(_dt: number, simDt: number): void {
    const s = this.ctx.sandbox;
    const lvl = s.water.level;
    if (lvl < 0.05 && !this.on) return;
    this.splash -= simDt;
    if (this.splash <= 0) {
      this.splash = 0.09;
      for (let i = 0; i < 2; i++) {
        const p = s.randomCityPoint(SCRATCH_V2);
        const surf = s.field.surfaceAt(p.x, p.y);
        if (Math.abs(surf - lvl) > 2.4) continue;
        s.smoke.spawn(
          p.x,
          lvl + 0.4,
          p.y,
          (Math.random() - 0.5) * 3,
          2 + Math.random() * 3,
          (Math.random() - 0.5) * 3,
          0.9,
          1.4,
          4,
          0.85,
          0.95,
          1,
          0.55,
          -1,
          1.1,
          0.2,
        );
      }
    }
    if (!this.on) return;
    // people on dry ground near the advancing shoreline run for it
    if (lvl > 0.2 && Math.random() < simDt * 3) {
      const p = s.randomCityPoint(SCRATCH_V2);
      s.crowd.panic(p.x, p.y, 26);
    }
    // slow erosion at the waterline so the flood leaves a mark
    this.erode -= simDt;
    if (this.erode <= 0 && lvl > 1) {
      this.erode = 0.34;
      const p = s.randomCityPoint(SCRATCH_V2);
      const cap = Math.round(2 + this.power * 2.5);
      let hits = 0;
      const picked: number[] = [];
      s.field.queryCylinder(p.x, p.y, 7, Math.max(0, lvl - 1), lvl + 0.2, (id) => {
        if (hits >= cap) return;
        if (Math.random() < 0.3) {
          picked.push(id);
          hits++;
        }
      });
      for (const id of picked) {
        s.debris.spawnFromVoxel(s.field, id, (Math.random() - 0.5) * 4, 1, (Math.random() - 0.5) * 4);
        s.killVoxel(id);
      }
    }
  }

  override runningHint(): string {
    return `洪水水位 ${this.ctx.sandbox.water.level.toFixed(1)} · 再次点击按钮退水`;
  }
}

// ---------------------------------------------------------------------- storm
export class StormDisaster extends Sustained {
  private x = 0;
  private z = 0;
  private power = 1;
  private radius = 30;
  private next = 0;
  private threat: Threat | null = null;

  constructor(ctx: DisasterCtx) {
    super('storm', ctx);
  }

  override trigger(x: number, z: number, power: number): void {
    const s = this.ctx.sandbox;
    this.on = true;
    this.x = x;
    this.z = z;
    this.power = power;
    this.radius = 30 * power;
    this.next = 0.35;
    s.sky.setStorm(1);
    s.audio.windLevel(0.7);
    s.audio.thunder(0.8);
    if (!this.threat) this.threat = s.addThreat(x, z, this.radius * 0.35, power);
    this.ctx.message('雷暴来临！WASD / 方向键移动雷暴中心');
  }

  override stop(): void {
    const s = this.ctx.sandbox;
    this.on = false;
    s.sky.setStorm(0);
    s.audio.windLevel(0);
    if (this.threat) {
      s.removeThreat(this.threat);
      this.threat = null;
    }
    this.ctx.message('雷暴散去，天空恢复晴朗');
  }

  override steer(v: THREE.Vector2, dt: number): void {
    if (!this.on || (v.x === 0 && v.y === 0)) return;
    const sp = 30 * dt;
    this.x = clamp(this.x + v.x * sp, -CITY_HALF - 30, CITY_HALF + 30);
    this.z = clamp(this.z + v.y * sp, -CITY_HALF - 30, CITY_HALF + 30);
  }

  override update(_dt: number, simDt: number): void {
    const s = this.ctx.sandbox;
    if (!this.on) return;
    if (this.threat) {
      this.threat.x = this.x;
      this.threat.z = this.z;
    }
    this.next -= simDt;
    if (this.next <= 0) {
      this.next = 0.42 + Math.random() * (1.15 - 0.45 * this.power);
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * this.radius;
      strikeAt(s, this.x + Math.cos(a) * r, this.z + Math.sin(a) * r, this.power * 0.55, false);
    }
    if (Math.random() < simDt * 0.7) s.sky.pulseSun(0.12);
  }

  override runningHint(): string {
    return 'WASD / 方向键移动雷暴中心 · 再次点击按钮结束';
  }
}
