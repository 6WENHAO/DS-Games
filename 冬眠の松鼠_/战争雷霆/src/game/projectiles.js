import * as THREE from 'three';

const GRAVITY = 9.8;
const _v = new THREE.Vector3();
const _end = new THREE.Vector3();
const _camDir = new THREE.Vector3();

/**
 * 炮弹管理：弹道积分、分段命中检测（地形/建筑/坦克）、曳光渲染
 */
export class Projectiles {
  constructor(ctx) {
    this.ctx = ctx;
    this.shells = [];
    this.pool = [];
    this._tracerMat = new THREE.MeshBasicMaterial({
      map: ctx.assets.particles['trace_06'],
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      color: 0xffd9a0,
    });
    this._tracerGeo = new THREE.PlaneGeometry(0.5, 6);
  }

  spawn(opts) {
    let tracer = this.pool.pop();
    if (!tracer) {
      tracer = new THREE.Mesh(this._tracerGeo, this._tracerMat);
      tracer.frustumCulled = false;
      tracer.renderOrder = 13;
    }
    tracer.visible = true;
    this.ctx.scene.add(tracer);
    const shell = {
      ...opts,
      age: 0,
      dist: 0,
      alive: true,
      tracer,
    };
    this.shells.push(shell);
    return shell;
  }

  update(dt) {
    const { world, effects, audio, battle } = this.ctx;
    const camera = this.ctx.engine.camera;
    camera.getWorldDirection(_camDir);

    for (const s of this.shells) {
      if (!s.alive) continue;
      s.age += dt;
      if (s.age > 9) { this._kill(s); continue; }

      const steps = 2;
      const sub = dt / steps;
      for (let i = 0; i < steps && s.alive; i++) {
        s.vel.y -= GRAVITY * sub;
        _end.copy(s.pos).addScaledVector(s.vel, sub);
        const segLen = s.pos.distanceTo(_end);

        // --- 坦克命中（最优先，取最近） ---
        let bestTankHit = null;
        for (const tank of battle.tanks) {
          if (tank === s.shooter || !tank.alive) continue;
          const roughDist = tank.pos.distanceTo(s.pos);
          if (roughDist > segLen + tank.boundRadius + 2) continue;
          const hit = tank.hitTest(s.pos, _end);
          if (hit && (!bestTankHit || hit.t < bestTankHit.t)) bestTankHit = hit;
        }

        // --- 世界命中 ---
        let worldHit = null;
        const dir = _v.copy(s.vel).normalize();
        const wh = world.raycast(s.pos, dir, segLen);
        if (wh) worldHit = wh;

        if (bestTankHit && (!worldHit || bestTankHit.t * segLen <= worldHit.dist)) {
          this._resolveTankHit(s, bestTankHit);
          break;
        } else if (worldHit) {
          this._resolveWorldHit(s, worldHit);
          break;
        }
        s.pos.copy(_end);
        s.dist += segLen;
      }

      // --- 曳光更新 ---
      if (s.alive && s.tracer) {
        const t = s.tracer;
        t.position.copy(s.pos);
        // 朝向速度方向的长条，并绕长轴面向相机
        const vdir = _v.copy(s.vel).normalize();
        const up = new THREE.Vector3().crossVectors(vdir, _camDir).normalize();
        if (up.lengthSq() < 0.01) up.set(0, 1, 0);
        const m = new THREE.Matrix4();
        const zAxis = new THREE.Vector3().crossVectors(up, vdir);
        m.makeBasis(up, vdir, zAxis);
        t.quaternion.setFromRotationMatrix(m);
        const len = Math.min(9, 2 + s.dist * 0.1);
        t.scale.set(1, len / 6, 1);
        t.material.opacity = s.age < 0.05 ? s.age / 0.05 : 1;
      }
    }
    this.shells = this.shells.filter((s) => s.alive);
  }

  _resolveTankHit(s, hit) {
    const { effects, audio, battle } = this.ctx;
    // 友军：物理阻挡但不造成伤害（防误伤机制）
    if (s.shooter && hit.tank.team === s.shooter.team) {
      effects.ricochet(hit.point, _v.copy(s.vel).normalize().reflect(hit.normal));
      audio.play3D('clang', hit.point, { volume: 0.6 });
      if (s.shooter.isPlayer) battle.cb.hitFeedback?.('ally');
      this._kill(s);
      return;
    }
    const result = hit.tank.applyHit(hit, s, s.dist);
    const penetrated = result.result === 'pen';
    effects.armorHit(hit.point, hit.normal, penetrated);
    if (result.result === 'ricochet') {
      effects.ricochet(hit.point, _v.copy(s.vel).normalize().reflect(hit.normal));
      audio.play3D('ricochet', hit.point, { volume: 0.8, rate: 0.9 + Math.random() * 0.25 });
    } else if (penetrated) {
      audio.play3D(Math.random() < 0.5 ? 'metal_heavy0' : 'metal_heavy1', hit.point, { volume: 1 });
      if (s.type === 'HE' || result.detonation) effects.explosion(hit.point, { big: false, ground: false });
    } else {
      audio.play3D(Math.random() < 0.5 ? 'metal_med0' : 'clang', hit.point, { volume: 0.85 });
    }
    battle.onShellHit(s, hit, result);
    this._kill(s);
  }

  _resolveWorldHit(s, hit) {
    const { effects, audio, battle } = this.ctx;
    if (s.type === 'HE' || s.splash > 0 && s.type === 'HE') {
      effects.explosion(hit.point, { big: false });
      audio.play3D('explosion', hit.point, { volume: 0.85, refDist: 26 });
      // 溅射伤害
      this._splashDamage(s, hit.point);
    } else {
      if (hit.type === 'terrain') {
        effects.groundHit(hit.point);
        audio.play3D('thud', hit.point, { volume: 0.7, rate: 0.8 + Math.random() * 0.3 });
      } else {
        effects.ricochet(hit.point, _v.copy(s.vel).multiplyScalar(-1).normalize());
        audio.play3D('thud', hit.point, { volume: 0.75 });
      }
    }
    battle.onShellHit(s, hit, { result: 'world', tank: null });
    this._kill(s);
  }

  _splashDamage(s, point) {
    const radius = (s.splash || 6) * 1.6;
    for (const tank of this.ctx.battle.tanks) {
      if (!tank.alive || tank === s.shooter) continue;
      if (s.shooter && tank.team === s.shooter.team) continue; // 友军免疫溅射
      const d = tank.pos.distanceTo(point);
      if (d < radius + tank.boundRadius) {
        const factor = 1 - Math.min(1, d / (radius + tank.boundRadius));
        const dmg = (s.dmg[0] + Math.random() * (s.dmg[1] - s.dmg[0])) * 0.5 * factor;
        tank._applyDamage(dmg, s.shooter, 'he_splash');
        if (factor > 0.4) tank.trackBrokenTimer = Math.max(tank.trackBrokenTimer, 4.5);
        tank._notifyDamaged(s.shooter, { tank, module: 'hull', result: 'splash', dmg, detonation: false });
      }
    }
  }

  _kill(s) {
    s.alive = false;
    if (s.tracer) {
      this.ctx.scene.remove(s.tracer);
      s.tracer.visible = false;
      this.pool.push(s.tracer);
      s.tracer = null;
    }
  }

  clear() {
    for (const s of this.shells) this._kill(s);
    this.shells.length = 0;
  }
}
