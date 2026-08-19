import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * BatchedRigidMesh — draws N independently simulated fracture chunks with ONE
 * draw call, at full PBR quality, casting real shadows.
 *
 * THE PROBLEM
 * -----------
 * Every chunk has unique geometry, so InstancedMesh (one geometry, many
 * transforms) does not apply. The naive solution is one Mesh per chunk: 900
 * meshes = 900 draw calls, 900 matrix updates and 900 more in the shadow pass.
 * That is where a browser destruction scene actually dies — not in Rapier.
 *
 * THE SOLUTION (GPU rigid-body skinning)
 * --------------------------------------
 * 1. Merge every chunk into a single BufferGeometry. Each vertex carries an
 *    `aChunkId` attribute and is stored RELATIVE to its own chunk centroid.
 * 2. Per-chunk rigid transforms live in a floating-point DataTexture:
 *       texel 0 → position.xyz
 *       texel 1 → rotation quaternion xyzw
 *       texel 2 → (visible, heat, seed, -)
 * 3. A tiny vertex-shader patch fetches that row and applies
 *       p' = q ⊗ p + t
 *    to position and normal. It is skinning where the "bone" is a rigid body.
 *
 * Cost per frame: one texture upload of 16·N floats. No matrix hierarchy, no
 * per-object frustum test, no per-object uniform block. Updating 900 bodies is
 * a ~57 KB buffer write.
 *
 * Because a merged batch has one bounding volume, per-chunk frustum culling is
 * lost — so the bridge is split into several spatial batches (see createBatches)
 * to keep coarse culling while holding draw calls in the single digits.
 */

const XF_TEXELS = 4;   // power-of-two row stride; 3 used, 1 reserved

const TRANSFORM_DECL = /* glsl */`
  attribute float aChunkId;
  uniform sampler2D uXform;
  uniform float uXformRows;
  varying float vHeat;

  vec3 dshQRot(vec4 q, vec3 v) {
    return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v);
  }
`;

const TRANSFORM_FETCH = /* glsl */`
  float _xfRow = (aChunkId + 0.5) / uXformRows;
  vec4 _xfP = texture2D(uXform, vec2(0.125, _xfRow));
  vec4 _xfQ = texture2D(uXform, vec2(0.375, _xfRow));
  vec4 _xfX = texture2D(uXform, vec2(0.625, _xfRow));
  float _xfVis = _xfX.x;
  vHeat = _xfX.y;
`;

export class BatchedRigidMesh {
  /**
   * @param {Array<{geometry:THREE.BufferGeometry}>} chunks
   * @param {object} [opts]
   * @param {number} [opts.roughness]
   * @param {number} [opts.metalness]
   * @param {boolean} [opts.castShadow]
   * @param {number} [opts.boundsPadding] extra bounding radius for flying debris
   */
  constructor(chunks, opts = {}) {
    this.count = chunks.length;
    if (this.count === 0) throw new Error('BatchedRigidMesh: no chunks');

    // ---- 1. merge, tagging every vertex with its chunk id ----
    const geoms = [];
    for (let i = 0; i < chunks.length; i++) {
      const g = chunks[i].geometry;
      const ids = new Float32Array(g.attributes.position.count).fill(i);
      g.setAttribute('aChunkId', new THREE.BufferAttribute(ids, 1));
      geoms.push(g);
    }
    this.geometry = BufferGeometryUtils.mergeGeometries(geoms, false);
    if (!this.geometry) throw new Error('BatchedRigidMesh: merge failed (attribute mismatch)');
    for (const g of geoms) g.dispose();

    // ---- 2. transform texture ----
    this._data = new Float32Array(this.count * XF_TEXELS * 4);
    for (let i = 0; i < this.count; i++) {
      const o = i * XF_TEXELS * 4;
      this._data[o + 7] = 1;        // identity quaternion w
      this._data[o + 8] = 1;        // visible
    }
    this.texture = new THREE.DataTexture(
      this._data, XF_TEXELS, this.count, THREE.RGBAFormat, THREE.FloatType,
    );
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;

    this._uniforms = {
      uXform: { value: this.texture },
      uXformRows: { value: this.count },
    };

    // ---- 3. material + shader patch ----
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: opts.roughness ?? 0.86,
      metalness: opts.metalness ?? 0.06,
      emissive: new THREE.Color(0xff5a12),
      emissiveIntensity: 1,
    });
    this._patchMaterial(this.material, true);

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = opts.castShadow ?? true;
    this.mesh.receiveShadow = true;
    this.mesh.matrixAutoUpdate = false;

    // Shadows need the same vertex displacement, or debris casts shadows from
    // its pristine pre-collapse position.
    const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    this._patchMaterial(depthMat, false);
    this.mesh.customDepthMaterial = depthMat;
    this._depthMaterial = depthMat;

    // Merged bounds + generous padding so flying debris is not culled early,
    // while the batch is still coarsely cullable.
    this.geometry.computeBoundingSphere();
    this._basePad = opts.boundsPadding ?? 60;
    this.geometry.boundingSphere.radius += this._basePad;
    this.geometry.computeBoundingBox();
  }

  _patchMaterial(mat, withHeat) {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uXform = this._uniforms.uXform;
      shader.uniforms.uXformRows = this._uniforms.uXformRows;

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${TRANSFORM_DECL}`)
        .replace('void main() {', `void main() {\n${TRANSFORM_FETCH}`)
        .replace(
          '#include <beginnormal_vertex>',
          'vec3 objectNormal = dshQRot(_xfQ, normal);',
        )
        .replace(
          '#include <begin_vertex>',
          'vec3 transformed = dshQRot(_xfQ, position) * _xfVis + _xfP.xyz;',
        );

      if (withHeat) {
        // Debris thrown by an explosion glows; the value decays on the CPU side
        // and feeds selective bloom for free.
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vHeat;')
          .replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
             totalEmissiveRadiance *= vHeat;
             totalEmissiveRadiance += vec3(1.0, 0.34, 0.06) * vHeat * 2.4;`,
          );
      } else {
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vHeat;');
      }
    };
    mat.needsUpdate = true;
  }

  /** Write one chunk's rigid transform. Cheap: 9 float stores. */
  setTransform(i, position, quaternion, visible = 1) {
    const o = i * XF_TEXELS * 4;
    const d = this._data;
    d[o + 0] = position.x; d[o + 1] = position.y; d[o + 2] = position.z;
    d[o + 4] = quaternion.x; d[o + 5] = quaternion.y;
    d[o + 6] = quaternion.z; d[o + 7] = quaternion.w;
    d[o + 8] = visible;
    this._dirty = true;
  }

  /** Per-chunk incandescence, 0..1. */
  setHeat(i, heat) {
    this._data[i * XF_TEXELS * 4 + 9] = heat;
    this._dirty = true;
  }

  decayHeat(dt, rate = 0.42) {
    let any = false;
    for (let i = 0; i < this.count; i++) {
      const idx = i * XF_TEXELS * 4 + 9;
      if (this._data[idx] > 0.001) {
        this._data[idx] = Math.max(0, this._data[idx] - rate * dt);
        any = true;
      }
    }
    if (any) this._dirty = true;
  }

  /** Single upload per frame, only when something actually moved. */
  flush() {
    if (!this._dirty) return;
    this.texture.needsUpdate = true;
    this._dirty = false;
  }

  /** Grow the cull volume once debris starts travelling. */
  expandBounds(extra) {
    this.geometry.boundingSphere.radius = this._basePad + extra;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this._depthMaterial.dispose();
    this.texture.dispose();
  }
}

/**
 * Split chunks into spatially coherent batches. Keeps draw calls tiny while
 * preserving coarse frustum culling: at 3000 m you draw everything anyway, but
 * at 40 m — inspecting one snapped cable — most of the bridge is off-screen and
 * whole batches are rejected on the CPU for free.
 *
 * @param {Array<{geometry:THREE.BufferGeometry, sortKey:number}>} chunks
 * @param {number} maxPerBatch
 * @param {object} matOpts
 * @returns {{batches:BatchedRigidMesh[], assign:Array<{batch:BatchedRigidMesh,index:number}>}}
 */
export function createBatches(chunks, maxPerBatch, matOpts = {}) {
  const order = chunks.map((c, i) => i).sort(
    (a, b) => (chunks[a].sortKey ?? 0) - (chunks[b].sortKey ?? 0),
  );

  const batches = [];
  const assign = new Array(chunks.length);
  for (let start = 0; start < order.length; start += maxPerBatch) {
    const slice = order.slice(start, start + maxPerBatch);
    const batch = new BatchedRigidMesh(slice.map((i) => chunks[i]), matOpts);
    slice.forEach((chunkIdx, localIdx) => {
      assign[chunkIdx] = { batch, index: localIdx };
    });
    batches.push(batch);
  }
  return { batches, assign };
}
