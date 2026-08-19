/**
 * PropField.js — 场景道具的摆放、LOD 与动画。
 *
 *  · 按距离显隐（带回差，避免临界闪烁），远处直接不进渲染队列
 *  · 支持 props 约定的 userData：{spin:{node,axis,speed}}、{rock:{node,axis,amplitude,speed}}、windSway
 *  · 可被摧毁的道具（breakWind）在动压超阈值时消失并抛出碎片
 *  · 支持多级 LOD 变体（近处精模 / 远处剪影）
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P } from '../core/Params.js';
import { clamp } from '../core/Random.js';

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class PropField {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../core/Lighting.js').Lighting} lighting
   * @param {import('../tornado/Debris.js').DebrisPool} debris
   */
  constructor(scene, lighting, debris) {
    this.scene = scene;
    this.lighting = lighting;
    this.debris = debris;
    this.items = [];
    this.group = new THREE.Group();
    this.group.name = 'props';
    scene.add(this.group);
    this._t = 0;
    this._lodT = 0;
    this.blownCount = 0;
  }

  /**
   * @param {object} spec  PropSpec: {obj, radius, height, label, mass?, breakWind?, size?}
   * @param {object} at    {x, y, z, rotY, scale, maxDist}
   */
  add(spec, { x = 0, y = 0, z = 0, rotY = 0, scale = 1, maxDist = 0 } = {}) {
    const obj = spec.obj;
    obj.position.set(x, y, z);
    obj.rotation.y = rotY;
    obj.scale.setScalar(scale);
    obj.updateMatrix();
    this.lighting.register(obj, 0.9);
    this.group.add(obj);
    const it = {
      spec, obj,
      pos: new THREE.Vector3(x, y, z),
      home: new THREE.Vector3(x, y, z),
      rotY, scale,
      radius: (spec.radius || 2) * scale,
      height: (spec.height || 2) * scale,
      maxDist: maxDist || clamp((spec.height || 2) * scale * 95, 240, 6000),
      spin: obj.userData?.spin || null,
      rock: obj.userData?.rock || null,
      sway: obj.userData?.windSway || 0,
      breakWind: spec.breakWind || 0,
      mass: spec.mass || 0,
      size: spec.size || null,
      alive: true,
      visible: true,
      phase: Math.random() * 6.28,
    };
    this.items.push(it);
    return it;
  }

  /** 找一个适合被"打击"的目标（最近的可摧毁道具/建筑） */
  pick(from) {
    let best = null, bd = 1e9;
    for (const it of this.items) {
      if (!it.alive || !it.breakWind) continue;
      const d = it.pos.distanceTo(from);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  /**
   * 静态合批：把没有动画、不会被吹走的道具按「空间网格 × 材质」合并成大网格。
   * 这一步能把上千个 draw call 压到几十个，同时保留按网格单元的距离剔除（LOD）。
   * 必须在所有 add() 完成后调用一次。
   */
  /**
   * 合批材质：把"随风摆动"搬进顶点着色器。
   * 合并后每个顶点带 aBase（该道具根部世界坐标）与 aSway（摆动强度），
   * 于是整片树林/仙人掌可以只用一个 draw call，却依然会随风摆、并朝涡心倒伏。
   *
   * 为了把 draw call 压到最低，道具材质的颜色被烘进顶点色，只按"粗糙/金属"两类
   * 各建一个共享材质 —— 于是每个空间网格最多只有 2 个批次。
   */
  _bucketMaterial(bucket) {
    if (!this._bucketMats) this._bucketMats = new Map();
    const hit = this._bucketMats.get(bucket);
    if (hit) return hit;
    const m = new THREE.MeshStandardMaterial(bucket === 'metal'
      ? { color: 0xffffff, roughness: 0.46, metalness: 0.78, vertexColors: true, flatShading: true }
      : { color: 0xffffff, roughness: 0.88, metalness: 0.0, vertexColors: true, flatShading: true });
    const U = this.swayUniforms;
    this.lighting.patchFog(m);
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer, ...rest) => {
      if (typeof prev === 'function') prev.call(m, shader, renderer, ...rest);
      Object.assign(shader.uniforms, U);
      shader.vertexShader = 'attribute vec3 aBase;\nattribute float aSway;\n' + shader.vertexShader
        .replace('#include <common>', `#include <common>
          uniform float uSwayTime, uSwayWindSpeed, uSwayWindDir, uSwayTorOn, uSwayTorRc, uSwayTorVmax;
          uniform vec3 uSwayTorPos;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          {
            float hh = max(transformed.y - aBase.y, 0.0);
            float k = aSway * hh * hh * 0.055;
            if(k > 0.0001){
              vec2 wd = vec2(cos(uSwayWindDir), sin(uSwayWindDir));
              float ph = aBase.x*0.09 + aBase.z*0.07;
              vec2 bend = wd * (uSwayWindSpeed*0.009 + 0.004*sin(uSwayTime*1.6 + ph));
              bend += vec2(-wd.y, wd.x) * 0.004 * sin(uSwayTime*2.3 + ph*1.7);
              if(uSwayTorOn > 0.5){
                vec2 rel = aBase.xz - uSwayTorPos.xz;
                float r = max(length(rel), 0.5);
                float rc = max(uSwayTorRc, 1.2);
                float vt = r <= rc ? uSwayTorVmax*(r/rc) : uSwayTorVmax*pow(rc/r, 0.72);
                float att = exp(-r/(rc*10.0));
                vec2 tang = vec2(rel.y, -rel.x)/r;
                bend += (tang*vt - rel/r*vt*0.5) * att * 0.0055;
              }
              transformed.xz += bend * k;
              transformed.y -= length(bend) * k * 0.45;
            }
          }`);
    };
    m.needsUpdate = true;
    this._bucketMats.set(bucket, m);
    return m;
  }

  finalize(cellSize = 600) {
    this.swayUniforms = {
      uSwayTime: { value: 0 },
      uSwayWindSpeed: { value: 10 },
      uSwayWindDir: { value: 0.6 },
      uSwayTorOn: { value: 0 },
      uSwayTorRc: { value: 20 },
      uSwayTorVmax: { value: 0 },
      uSwayTorPos: { value: new THREE.Vector3() },
    };
    /** @type {Map<string, {bucket:string, geos: THREE.BufferGeometry[], cell: string}>} */
    const groups = new Map();
    const cellFar = new Map();
    const keep = [];
    const tmpCol = new THREE.Color();
    for (const it of this.items) {
      /* 只有带自转/往复部件的道具不能合批（子节点要独立变换） */
      const batchable = !it.spin && !it.rock && it.alive;
      if (!batchable) { keep.push(it); continue; }
      const cx = Math.round(it.pos.x / cellSize), cz = Math.round(it.pos.z / cellSize);
      const cellKey = cx + '_' + cz;
      cellFar.set(cellKey, Math.max(cellFar.get(cellKey) || 0, it.maxDist));
      it.obj.updateMatrixWorld(true);
      let any = false;
      let hasInstanced = false;
      it.obj.traverse((o) => { if (o.isInstancedMesh) hasInstanced = true; });
      if (hasInstanced) { keep.push(it); continue; }    // 带 InstancedMesh 的道具保持原样
      it.obj.traverse((o) => {
        if (!o.isMesh || !o.geometry || o.isInstancedMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const m0 = mats[0];
        if (!m0 || m0.transparent) return;         // 透明件保持独立
        let g;
        try {
          g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        } catch { return; }
        for (const name of Object.keys(g.attributes)) {
          if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
        }
        if (!g.attributes.normal) g.computeVertexNormals();
        g.morphAttributes = {};
        g.applyMatrix4(o.matrixWorld);
        const n = g.attributes.position.count;
        /* 材质颜色 → 顶点色（含少量随机明暗，避免同色一片死板） */
        tmpCol.copy(m0.color || { r: 1, g: 1, b: 1 });
        const shade = 0.88 + 0.24 * ((it.phase * 37) % 1);
        const col = new Float32Array(n * 3);
        const base = new Float32Array(n * 3);
        const sway = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          col[i * 3] = tmpCol.r * shade; col[i * 3 + 1] = tmpCol.g * shade; col[i * 3 + 2] = tmpCol.b * shade;
          base[i * 3] = it.pos.x; base[i * 3 + 1] = it.pos.y; base[i * 3 + 2] = it.pos.z;
          sway[i] = it.sway || 0;
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
        g.setAttribute('aSway', new THREE.BufferAttribute(sway, 1));
        const bucket = (m0.metalness ?? 0) > 0.35 ? 'metal' : 'matte';
        const key = cellKey + '|' + bucket;
        if (!groups.has(key)) groups.set(key, { bucket, geos: [], cell: cellKey, owners: [] });
        const grp = groups.get(key);
        grp.owners.push({ it, count: n });
        grp.geos.push(g);
        any = true;
      });
      if (any) {
        it.batched = true;
        it.ranges = [];
        this.group.remove(it.obj);
      } else {
        keep.push(it);
      }
    }

    this.batches = [];
    for (const [, v] of groups) {
      if (!v.geos.length) continue;
      let merged = null;
      try { merged = mergeGeometries(v.geos, false); } catch (e) { merged = null; }
      for (const g of v.geos) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, this._bucketMaterial(v.bucket));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      mesh.matrixAutoUpdate = false;
      mesh.name = 'propBatch/' + v.cell + '/' + v.bucket;
      this.group.add(mesh);
      /* 记录每个道具在合并几何里的顶点区间：被吹走时把这段顶点归零即可"消失" */
      let off = 0;
      for (const o of v.owners) {
        o.it.ranges.push({ mesh, start: off, count: o.count });
        off += o.count;
      }
      const bs = merged.boundingSphere;
      this.batches.push({
        mesh, center: bs.center.clone(), radius: bs.radius,
        maxDist: (cellFar.get(v.cell) || 800) + bs.radius,
      });
    }
    this.dynamic = keep;
    this.movable = this.items.filter((it) => it.breakWind > 0);
    /* 未合批的道具（带自转/往复部件）做"自身合并"：静态部分合成 1~2 个网格，
       转动部件单独合成一个枢轴子节点，于是采油塔从 58 个 draw call 变成 3 个。 */
    let localMerged = 0;
    for (const it of keep) {
      if (!it.alive) continue;
      if (this._mergeLocal(it)) localMerged++;
    }
    return {
      batches: this.batches.length, dynamic: keep.length,
      batched: this.items.length - keep.length, localMerged,
    };
  }

  /** 把若干几何按 matte/metal 分桶合并，返回 [Mesh...] */
  _mergeBucketed(entries) {
    const buckets = new Map();
    const tmpCol = new THREE.Color();
    for (const { geometry, material, matrix } of entries) {
      const m0 = material;
      if (!m0 || m0.transparent) continue;
      let g;
      try {
        g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      } catch { continue; }
      for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
      }
      if (!g.attributes.normal) g.computeVertexNormals();
      g.morphAttributes = {};
      if (matrix) g.applyMatrix4(matrix);
      const n = g.attributes.position.count;
      tmpCol.copy(m0.color || { r: 1, g: 1, b: 1 });
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        col[i * 3] = tmpCol.r; col[i * 3 + 1] = tmpCol.g; col[i * 3 + 2] = tmpCol.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const bucket = (m0.metalness ?? 0) > 0.35 ? 'metal' : 'matte';
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket).push(g);
    }
    const out = [];
    for (const [bucket, geos] of buckets) {
      let merged = null;
      try { merged = mergeGeometries(geos, false); } catch { merged = null; }
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, this._bucketMaterial(bucket));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      out.push(mesh);
    }
    return out;
  }

  /** 合并一个道具自身的网格（保留整体变换与转动部件） */
  _mergeLocal(it) {
    const obj = it.obj;
    obj.updateMatrixWorld(true);
    const animNode = it.spin?.node || it.rock?.node || null;
    const skip = new Set();
    if (animNode) animNode.traverse((o) => skip.add(o));

    const staticEntries = [];
    const animEntries = [];
    const objInv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
    let animInv = null;
    if (animNode) animInv = new THREE.Matrix4().copy(animNode.matrixWorld).invert();
    let count = 0;
    obj.traverse((o) => {
      if (!o.isMesh || !o.geometry || o.isInstancedMesh) return;
      count++;
      const mat = Array.isArray(o.material) ? o.material[0] : o.material;
      if (skip.has(o)) {
        animEntries.push({
          geometry: o.geometry, material: mat,
          matrix: new THREE.Matrix4().multiplyMatrices(animInv, o.matrixWorld),
        });
      } else {
        staticEntries.push({
          geometry: o.geometry, material: mat,
          matrix: new THREE.Matrix4().multiplyMatrices(objInv, o.matrixWorld),
        });
      }
    });
    if (count < 3) return false;

    const statics = this._mergeBucketed(staticEntries);
    const anims = animEntries.length ? this._mergeBucketed(animEntries) : [];
    if (!statics.length && !anims.length) return false;

    const fresh = new THREE.Group();
    fresh.name = (obj.name || 'prop') + '/merged';
    for (const m of statics) fresh.add(m);
    if (anims.length) {
      const pivot = new THREE.Group();
      pivot.name = 'spinPivot';
      /* 枢轴保持它相对道具根的位姿，转动语义不变 */
      const rel = new THREE.Matrix4().multiplyMatrices(objInv, animNode.matrixWorld);
      rel.decompose(pivot.position, pivot.quaternion, pivot.scale);
      for (const m of anims) pivot.add(m);
      fresh.add(pivot);
      if (it.spin) it.spin.node = pivot;
      if (it.rock) it.rock.node = pivot;
    }
    fresh.position.copy(obj.position);
    fresh.rotation.copy(obj.rotation);
    fresh.scale.copy(obj.scale);
    fresh.userData = obj.userData;
    fresh.visible = obj.visible;
    this.group.remove(obj);
    this.group.add(fresh);
    obj.traverse((o) => { if (o.isMesh) o.geometry?.dispose?.(); });
    it.obj = fresh;
    return true;
  }

  /** 让一个道具被吹走 */
  blow(it, tornado) {
    if (!it.alive) return;
    it.alive = false;
    if (it.ranges && it.ranges.length) {
      /* 合批道具：把它占用的顶点区间归零（退化三角形 → 不可见），并留档以便重建 */
      it.saved = it.saved || [];
      for (let i = 0; i < it.ranges.length; i++) {
        const r = it.ranges[i];
        const attr = r.mesh.geometry.getAttribute('position');
        const a = attr.array;
        const from = r.start * 3, len = r.count * 3;
        if (!it.saved[i]) it.saved[i] = a.slice(from, from + len);
        a.fill(0, from, from + len);
        attr.needsUpdate = true;
      }
    } else {
      it.obj.visible = false;
    }
    this.blownCount++;
    if (!this.debris) return;
    const n = it.height > 6 ? 8 : 4;
    const sz = it.size || new THREE.Vector3(0.28, 0.22, 0.85);
    for (let i = 0; i < n; i++) {
      const p = new THREE.Vector3(
        it.pos.x + (Math.random() - 0.5) * it.radius * 1.4,
        it.pos.y + Math.random() * it.height,
        it.pos.z + (Math.random() - 0.5) * it.radius * 1.4);
      const w = tornado ? tornado.windAt(p, _v) : _v.set(0, 0, 0);
      this.debris.spawn(p, new THREE.Vector3(
        sz.x * (0.6 + Math.random()), sz.y * (0.6 + Math.random()), sz.z * (0.6 + Math.random())), {
        vel: new THREE.Vector3(w.x * 0.4, Math.abs(w.y) * 0.3 + 3, w.z * 0.4),
        density: 480, cd: 1.4, life: 120,
        color: new THREE.Color().setHSL(0.09 + Math.random() * 0.05, 0.3, 0.3 + Math.random() * 0.3),
      });
    }
  }

  restore() {
    for (const it of this.items) {
      if (!it.alive) {
        it.alive = true;
        if (it.ranges && it.ranges.length && it.saved) {
          for (let i = 0; i < it.ranges.length; i++) {
            const r = it.ranges[i];
            const attr = r.mesh.geometry.getAttribute('position');
            if (it.saved[i]) attr.array.set(it.saved[i], r.start * 3);
            attr.needsUpdate = true;
          }
        } else {
          it.obj.visible = it.visible;
        }
      }
      if (!it.batched) {
        it.obj.position.copy(it.home);
        it.obj.rotation.set(0, it.rotY, 0);
      }
    }
    this.blownCount = 0;
  }

  update(dt, camera, tornado) {
    this._t += dt;
    const windSpeed = P.get('w_windSpeed');
    const windDir = P.get('w_windDir') * Math.PI / 180;
    const wx = Math.cos(windDir), wz = Math.sin(windDir);
    const spinK = clamp(windSpeed / 10, 0.15, 3.2);

    /* --- LOD 显隐（限流） --- */
    this._lodT -= dt;
    const doLod = this._lodT <= 0;
    if (doLod) this._lodT = 0.3;
    const bias = P.get('q_lodBias');
    const cam = camera.position;

    /* --- 合批网格的整体距离剔除 --- */
    if (doLod && this.batches) {
      for (const b of this.batches) {
        b.mesh.visible = b.center.distanceTo(cam) < b.maxDist * bias;
      }
    }
    /* --- 合批植被的风摆动 uniform --- */
    if (this.swayUniforms) {
      const su = this.swayUniforms;
      su.uSwayTime.value = this._t;
      su.uSwayWindSpeed.value = windSpeed;
      su.uSwayWindDir.value = windDir;
      if (tornado) {
        su.uSwayTorOn.value = tornado.strength > 0.02 ? 1 : 0;
        su.uSwayTorRc.value = tornado.rc;
        su.uSwayTorVmax.value = tornado.vmax;
        su.uSwayTorPos.value.copy(tornado.position);
      }
    }

    for (const it of (this.dynamic || this.items)) {
      if (doLod) {
        const d = it.pos.distanceTo(cam);
        const vis = d < it.maxDist * bias;
        if (vis !== it.visible) {
          it.visible = vis;
          it.obj.visible = vis && it.alive;
        }
        it.dist = d;
      }
      if (!it.visible || !it.alive) continue;

      /* --- 旋转部件（风车/风轮） --- */
      if (it.spin?.node) {
        const s = it.spin;
        const ax = s.axis || 'z';
        it.spin.node.rotation[ax] += (s.speed || 1) * spinK * dt;
      }
      /* --- 往复部件（抽油机） --- */
      if (it.rock?.node) {
        const r = it.rock;
        const ax = r.axis || 'x';
        it.rock.node.rotation[ax] = Math.sin(this._t * (r.speed || 1) + it.phase) * (r.amplitude || 0.2);
      }
      /* --- 植被摆动 + 龙卷风倒伏 --- */
      if (it.sway > 0) {
        let bx = wx * windSpeed * 0.0045, bz = wz * windSpeed * 0.0045;
        bx += Math.sin(this._t * 1.7 + it.phase) * 0.012;
        bz += Math.cos(this._t * 1.31 + it.phase) * 0.012;
        if (tornado && tornado.strength > 0.02) {
          tornado.windAt(it.pos, _v);
          const s = Math.min(_v.length() * 0.0026, 0.55);
          bx += _v.x * 0.0016; bz += _v.z * 0.0016;
          it.obj.scale.setScalar(it.scale * (1 - s * 0.12));
        }
        const k = it.sway;
        it.obj.rotation.z = clamp(-bx * k * 8, -0.7, 0.7);
        it.obj.rotation.x = clamp(bz * k * 8, -0.7, 0.7);
      }
      /* --- 被吹走（合批与非合批道具都要判定） --- */
    }

    /* 可被吹走的道具（含已合批的）统一判定 */
    if (tornado && tornado.strength > 0.02 && P.get('t_autoDamage')) {
      const list = this.movable || [];
      const thr = P.get('t_damage');
      const reach = (tornado.rc * 12 + 160) ** 2;
      for (const it of list) {
        if (!it.alive) continue;
        const d2 = (it.pos.x - tornado.position.x) ** 2 + (it.pos.z - tornado.position.z) ** 2;
        if (d2 > reach) continue;
        if (tornado.pressureAt(it.pos) > it.breakWind * thr) this.blow(it, tornado);
      }
    }
  }

  stats() {
    let vis = 0;
    for (const it of (this.dynamic || this.items)) if (it.visible && it.alive) vis++;
    let bvis = 0;
    if (this.batches) for (const b of this.batches) if (b.mesh.visible) bvis++;
    return {
      total: this.items.length, visible: vis, blown: this.blownCount,
      batches: this.batches ? this.batches.length : 0, batchVisible: bvis,
    };
  }

  dispose() {
    for (const it of this.items) {
      it.obj.traverse?.((o) => {
        o.geometry?.dispose?.();
      });
    }
    this.items.length = 0;
  }
}
