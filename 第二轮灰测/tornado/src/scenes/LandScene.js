/**
 * LandScene.js — 陆地场景基类（沙漠 / 平原共用）。
 *
 * 负责把地形、植被、可破坏建筑、道具场、扬尘串起来；
 * 子类只需给出 terrainConfig() / grassConfig() / layout()。
 */
import * as THREE from 'three';
import { SceneBase } from './SceneBase.js';
import { Terrain } from '../world/Terrain.js';
import { DestructionSystem } from '../world/Destructible.js';
import { PropField } from '../world/PropField.js';
import { GrassField } from '../world/Vegetation.js';
import { MAT } from '../world/BuildingKit.js';
import { Rng, clamp } from '../core/Random.js';
import { P } from '../core/Params.js';

export class LandScene extends SceneBase {
  constructor(ctx) {
    super(ctx);
    this.seed = 1234;
    this.cables = [];
  }

  /** 子类：地形配置 */
  terrainConfig() { throw new Error('terrainConfig() 未实现'); }
  /** 子类：草地/植被配置（返回 null 表示无） */
  grassConfig() { return null; }
  /** 子类：摆放建筑与道具 */
  async layout(rng) { }

  async build() {
    const rng = new Rng(this.seed);
    this.rng = rng;
    this.ctx.boot?.(0.3, '生成地形高度场…');
    this.terrain = new Terrain(this.terrainConfig());
    this.scene.add(this.terrain.mesh);

    this.destruction = new DestructionSystem(this.scene, this.lighting, this.physics, MAT);
    this.destruction.onDestroy = (rec) => this.ctx.toast?.(`${rec.label} 被摧毁！`);
    this.props = new PropField(this.scene, this.lighting, this.debris);

    this.ctx.boot?.(0.5, '摆放建筑与道具…');
    await this.layout(rng);

    this.terrain.commitHeights();
    this.destruction.finalize();
    this.destruction.snapshotStrength();
    /* 静态道具合批：draw call 从上千降到几十 */
    this.propBatchInfo = this.props.finalize(600);

    const gc = this.grassConfig();
    if (gc) {
      this.ctx.boot?.(0.8, '生成植被…');
      this.grass = new GrassField(gc);
      this.scene.add(this.grass.group);
    }
  }

  /* ---------------- 摆放工具 ---------------- */

  /** 建筑：先压平地基再放，避免悬空 */
  placeBuilding(building, x, z, rotY = 0, scale = 1) {
    if (!building) return null;
    const fx = Math.max(building.footprint?.[0] || 8, building.footprint?.[1] || 8) * scale;
    const y = this.terrain.flatten(x, z, fx * 0.62, 2.1);
    const rec = this.destruction.add(building, { x, y, z, rotY, scale });
    rec.label = building.label || rec.label;
    return rec;
  }

  placeProp(spec, x, z, rotY = 0, scale = 1, maxDist = 0) {
    if (!spec) return null;
    const y = this.terrain.heightAt(x, z);
    return this.props.add(spec, { x, y, z, rotY, scale, maxDist });
  }

  /**
   * 随机散布
   * @param {(rng:Rng)=>object} make 生成 PropSpec
   * @param {object} o {count, rMin, rMax, center, slopeMax, scale, avoid}
   */
  scatter(make, { count = 40, rMin = 60, rMax = 1400, center = [0, 0], slopeMax = 0.28, scale = [0.85, 1.25], maxDist = 0, jitterRot = true } = {}) {
    const rng = this.rng;
    const n = Math.round(count * clamp(P.get('q_density'), 0.1, 2));
    let placed = 0;
    for (let i = 0; i < n * 3 && placed < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * (rMax - rMin) + rMin;
      const x = center[0] + Math.cos(a) * d;
      const z = center[1] + Math.sin(a) * d;
      if (this.terrain.slopeAt(x, z) > slopeMax) continue;
      const spec = make(rng);
      if (!spec) continue;
      this.placeProp(spec, x, z, jitterRot ? rng.range(0, Math.PI * 2) : 0, rng.range(scale[0], scale[1]), maxDist);
      placed++;
    }
    return placed;
  }

  /** 一排电线杆 + 悬垂电缆（杆被摧毁后电缆消失） */
  powerLine(x0, z0, x1, z1, spans, buildPole) {
    const poles = [];
    for (let i = 0; i <= spans; i++) {
      const t = i / spans;
      const x = x0 + (x1 - x0) * t + this.rng.range(-2, 2);
      const z = z0 + (z1 - z0) * t + this.rng.range(-2, 2);
      const ang = Math.atan2(z1 - z0, x1 - x0) + Math.PI * 0.5;
      const rec = this.placeBuilding(buildPole(this.rng), x, z, ang, 1);
      poles.push({ rec, x, z, y: this.terrain.heightAt(x, z) });
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.9, metalness: 0.1 });
    this.lighting.patchFog(mat);
    for (let i = 0; i < poles.length - 1; i++) {
      const a = poles[i], b = poles[i + 1];
      const top = 8.1;
      for (const off of [-1.05, 0, 1.05]) {
        const nx = -(b.z - a.z), nz = (b.x - a.x);
        const nl = Math.hypot(nx, nz) || 1;
        const ax = a.x + (nx / nl) * off, az = a.z + (nz / nl) * off;
        const bx = b.x + (nx / nl) * off, bz = b.z + (nz / nl) * off;
        const sag = 1.15;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(ax, a.y + top, az),
          new THREE.Vector3((ax + bx) / 2, (a.y + b.y) / 2 + top - sag, (az + bz) / 2),
          new THREE.Vector3(bx, b.y + top, bz),
        ]);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 6, 0.055, 3, false), mat);
        tube.castShadow = false;
        tube.receiveShadow = false;
        this.scene.add(tube);
        this.cables.push({ mesh: tube, a: a.rec, b: b.rec });
      }
    }
    return poles;
  }

  /**
   * 预先刷一条"上一场龙卷风"的旧刮痕：地表翻土、植被被连根拔起后留下的裸带。
   * 用的是同一张破坏图，所以和实时破坏完全一致（草地着色器也会照样剔除植被）。
   */
  oldTrack(x0, z0, x1, z1, steps = 70, width = 30) {
    const dmg = this.terrain.damage;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      /* 蛇形摆动，越往前越宽 —— 模拟涡柱边走边摆 */
      const sway = Math.sin(t * 7.2) * width * 1.15 + Math.sin(t * 2.1) * width * 0.6;
      const nx = -(z1 - z0), nz = (x1 - x0);
      const nl = Math.hypot(nx, nz) || 1;
      const x = x0 + (x1 - x0) * t + (nx / nl) * sway;
      const z = z0 + (z1 - z0) * t + (nz / nl) * sway;
      dmg.paint(x, z, width * (0.55 + 0.6 * t), 0.42 + 0.3 * t);
    }
    dmg.texture.needsUpdate = true;
  }

  /* ---------------- 每帧 ---------------- */

  heightAt(x, z) { return this.terrain ? this.terrain.heightAt(x, z) : 0; }

  pickStrikeTarget() {
    /* 优先扑向还比较完整的建筑 */
    let best = null, score = -1e9;
    const t = this.tornado.position;
    for (const rec of this.destruction.buildings) {
      const intact = 1 - rec.lost / Math.max(rec.total, 1);
      if (intact < 0.35) continue;
      const d = Math.hypot(rec.pos.x - t.x, rec.pos.z - t.z);
      const s = intact * 800 - d;
      if (s > score) { score = s; best = rec; }
    }
    return best ? { x: best.pos.x, z: best.pos.z } : null;
  }

  updateScene(dt) {
    this.terrain.update(this.engine.camera, dt, this.tornado);
    this.props.update(dt, this.engine.camera, this.tornado);
    this.destruction.update(dt, this.tornado, this.engine.camera);
    this.grass?.update(dt, this.engine.camera, this.tornado);
    /* 电缆随电线杆损毁消失 */
    if (this.cables.length) {
      for (const c of this.cables) {
        if (c.mesh.visible && ((c.a && c.a.lost > 1) || (c.b && c.b.lost > 1))) c.mesh.visible = false;
      }
    }
  }

  rebuild() {
    this.destruction.rebuild();
    this.props.restore();
    this.terrain.damage.clear();
    for (const c of this.cables) c.mesh.visible = true;
  }

  extraStats() {
    const d = this.destruction.stats();
    const p = this.props.stats();
    return `建筑 ${d.buildings} 零件 ${d.parts}(毁 ${d.lost})  道具 ${p.total}(合批 ${p.batchVisible}/${p.batches} 动态 ${p.visible} 吹走 ${p.blown})`;
  }

  disposeScene() {
    this.grass?.dispose();
    this.props?.dispose();
    this.destruction?.dispose();
    this.terrain?.dispose();
    this.cables.length = 0;
  }

  selftest() {
    const d = this.destruction.stats();
    const h = this.heightAt(0, 0);
    return [
      [Number.isFinite(h), 'terrain height finite'],
      [d.buildings >= 4, 'buildings placed (' + d.buildings + ')'],
      [d.parts > 100, 'building parts (' + d.parts + ')'],
      [d.batches > 0 && d.batches < 40, 'instanced batches ' + d.batches],
      [this.props.items.length > 20, 'props placed (' + this.props.items.length + ')'],
      [!this.grass || this.grass.meshes.length > 0, 'vegetation built'],
    ];
  }
}
