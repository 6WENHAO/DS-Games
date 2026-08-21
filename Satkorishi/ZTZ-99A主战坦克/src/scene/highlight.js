/**
 * 选中高亮 + 遮挡半透明（Ghosting）
 *
 * 需求映射：
 *   "被指到的部分标红"     → 目标网格换成红色高亮材质 + OutlinePass 红色描边
 *   "阻挡的部分半透明化"   → 真正做几何遮挡判定：以相机为顶点、目标包围球为底的
 *                            视锥体内的零件才变半透明，而不是简单地把整车变透明。
 *
 * 材质替换采用"惰性克隆 + 缓存"：每个原材质最多派生一个红色版本和一个幽灵版本，
 * 恢复时把 mesh.material 指回原对象，不会污染其他零件。
 */
import * as THREE from 'three';

export class Highlighter {
  constructor(meshes) {
    this.meshes = meshes;
    this.redCache = new Map();
    this.ghostCache = new Map();
    this.overrides = new Map(); // mesh -> 原材质
    this.selection = [];
    this.ghostEnabled = true;
    this.ghostOpacity = 0.11;
    this.xray = false;
    this._sphere = new THREE.Sphere();
    this._v = new THREE.Vector3();
    this._axis = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
  }

  /* ---------- 材质派生 ---------- */
  redFor(mat) {
    let m = this.redCache.get(mat);
    if (m) return m;
    m = mat.clone();
    m.name = (mat.name || 'mat') + '_HL';
    if (m.color) m.color.setHex(0xd93a2b);
    if ('emissive' in m) {
      m.emissive = new THREE.Color(0x5e0f08);
      m.emissiveIntensity = 0.85;
      m.emissiveMap = null;
    }
    m.map = null; // 去掉迷彩，避免红色被涂装压掉
    if ('roughness' in m) m.roughness = 0.45;
    if ('metalness' in m) m.metalness = 0.35;
    m.transparent = false;
    m.opacity = 1;
    m.depthWrite = true;
    this.redCache.set(mat, m);
    return m;
  }

  ghostFor(mat) {
    let m = this.ghostCache.get(mat);
    if (m) return m;
    m = new THREE.MeshBasicMaterial({
      name: (mat.name || 'mat') + '_GHOST',
      color: 0x8fb4c8,
      transparent: true,
      opacity: this.ghostOpacity,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
    });
    this.ghostCache.set(mat, m);
    return m;
  }

  /* ---------- 覆盖/恢复 ---------- */
  #override(mesh, mat) {
    if (!this.overrides.has(mesh)) this.overrides.set(mesh, mesh.material);
    mesh.material = mat;
  }

  restoreAll() {
    for (const [mesh, mat] of this.overrides) mesh.material = mat;
    this.overrides.clear();
  }

  /** 设置选中集合（红色高亮）；highlight=false 时只做视角切换不上色 */
  select(meshes, highlight = true) {
    this.restoreAll();
    this.selection = highlight ? meshes.slice() : [];
    if (!highlight) return;
    const set = new Set(meshes);
    for (const m of set) this.#override(m, this.redFor(this.overrides.get(m) || m.material));
  }

  /**
   * 更新遮挡半透明。
   * 判定：目标并集包围球 (Ct,Rt)，相机点 P。零件包围球 (Cm,Rm) 若与
   * "P → 目标球" 的视锥相交，且位于目标之前，则视为遮挡件。
   */
  updateGhost(camera) {
    if (!this.selection.length || !this.ghostEnabled) {
      // 清掉遮挡覆盖（保留选中红色）
      for (const [mesh, mat] of [...this.overrides]) {
        if (!this.selection.includes(mesh)) {
          mesh.material = mat;
          this.overrides.delete(mesh);
        }
      }
      return;
    }
    // 目标并集包围球
    const box = new THREE.Box3();
    for (const m of this.selection) {
      m.updateWorldMatrix(true, false);
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
      box.union(b);
    }
    const Ct = box.getCenter(new THREE.Vector3());
    const Rt = Math.max(0.08, box.getSize(this._tmp).length() * 0.5);
    const P = camera.position;
    const axis = this._axis.copy(Ct).sub(P);
    const L = axis.length();
    if (L < 1e-4) return;
    axis.multiplyScalar(1 / L);

    const sel = new Set(this.selection);
    const wanted = new Set();
    for (const mesh of this.meshes) {
      if (sel.has(mesh) || !mesh.visible) continue;
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      const s = this._sphere.copy(mesh.geometry.boundingSphere).applyMatrix4(mesh.matrixWorld);
      const rel = this._v.copy(s.center).sub(P);
      const t = rel.dot(axis);
      if (t <= s.radius * 0.5 || t > L + Rt) continue; // 在相机后 / 在目标之后
      const perp = Math.sqrt(Math.max(0, rel.lengthSq() - t * t));
      const coneR = (Rt * t) / L + s.radius;
      if (perp < coneR) wanted.add(mesh);
    }
    // 差量更新
    for (const [mesh, mat] of [...this.overrides]) {
      if (!sel.has(mesh) && !wanted.has(mesh)) {
        mesh.material = mat;
        this.overrides.delete(mesh);
      }
    }
    for (const mesh of wanted) {
      const cur = this.overrides.get(mesh) || mesh.material;
      if (this.overrides.has(mesh) && mesh.material.name.endsWith('_GHOST')) continue;
      this.#override(mesh, this.ghostFor(cur));
    }
  }

  setGhostEnabled(on) {
    this.ghostEnabled = on;
  }

  setGhostOpacity(v) {
    this.ghostOpacity = v;
    for (const m of this.ghostCache.values()) m.opacity = v;
  }

  clear() {
    this.selection = [];
    this.restoreAll();
  }

  dispose() {
    this.restoreAll();
    for (const m of this.redCache.values()) m.dispose();
    for (const m of this.ghostCache.values()) m.dispose();
    this.redCache.clear();
    this.ghostCache.clear();
  }
}
