/**
 * SceneBase.js — 场景基类。三个场景共享同一套引擎、光影、龙卷风、物理与碎片系统，
 * 子类只负责：地面（地形或海面）、场景物件、以及"被破坏"的具体表现。
 */
import * as THREE from 'three';
import { P } from '../core/Params.js';

export class SceneBase {
  /**
   * @param {object} ctx
   * @param {import('../core/Engine.js').Engine} ctx.engine
   * @param {import('../core/Lighting.js').Lighting} ctx.lighting
   * @param {import('../tornado/Tornado.js').Tornado} ctx.tornado
   * @param {import('../core/MiniPhysics.js').PhysicsWorld} ctx.physics
   * @param {import('../tornado/Debris.js').DebrisPool} ctx.debris
   * @param {import('../tornado/Debris.js').DebrisSwarm} ctx.swarm
   * @param {(m:string)=>void} ctx.toast
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.engine = ctx.engine;
    this.lighting = ctx.lighting;
    this.tornado = ctx.tornado;
    this.physics = ctx.physics;
    this.debris = ctx.debris;
    this.swarm = ctx.swarm;
    this.scene = new THREE.Scene();
    this.scene.matrixWorldAutoUpdate = true;
    this.name = 'base';
    this.label = '场景';
    /** 地面颜色（用于半球光地面反弹与龙卷风尘土色） */
    this.groundAlbedo = 0x4a4034;
    this.dustColor = new THREE.Color(0.44, 0.36, 0.27);
    /** 相机初始位姿 */
    this.camStart = { pos: new THREE.Vector3(-360, 160, 420), target: new THREE.Vector3(0, 120, 0) };
    /** 场景半径（龙卷风直线穿场范围） */
    this.radius = 1800;
    this.waterMode = 0;
    this.lods = [];
    this.destructibles = [];
  }

  /** 子类实现 */
  async build() { }
  updateScene(dt) { }
  disposeScene() { }

  heightAt(x, z) { return 0; }
  /** 有水的场景返回函数，否则 null */
  get waterAt() { return null; }
  get waterVelAt() { return null; }

  /** 统一入口 */
  async init() {
    this.scene.add(this.swarm.points, this.debris.group);
    this.lighting.attach(this.scene);
    this.lighting.setGroundAlbedo(this.groundAlbedo);
    this.tornado.heightAt = (x, z) => this.heightAt(x, z);
    this.tornado.dustColor.copy(this.dustColor);
    this.tornado.waterMode = this.waterMode;
    this.tornado.sceneRadius = this.radius;
    this.physics.groundAt = (x, z) => this.heightAt(x, z);
    this.physics.waterAt = this.waterAt;
    this.physics.waterVelAt = this.waterVelAt;
    this.physics.tornado = this.tornado;
    await this.build();
    this.engine.camera.position.copy(this.camStart.pos);
    this.engine.controls.target.copy(this.camStart.target);
    this.engine.controls.update();
    return this;
  }

  update(dt) {
    for (const l of this.lods) l.update(this.engine.camera, P.get('q_lodBias'));
    this.updateScene(dt);
  }

  dispose() {
    this.lighting.detach(this.scene);
    this.scene.remove(this.swarm.points, this.debris.group);
    this.disposeScene();
    this.scene.traverse((o) => {
      if (o.geometry && !o.userData.keepGeometry) o.geometry.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of mats) if (!m.userData.keep) m.dispose?.();
    });
    this.scene.clear();
  }

  /** 供 HUD 显示的附加信息 */
  extraStats() { return ''; }
}
