/* ===== CC0 GLB 模型库（Quaternius / poly.pizza） ===== */
"use strict";

const ModelLib = {
  items: {},
  ready: false,

  init() {
    if (typeof MODEL_DATA === "undefined" || typeof THREE.GLTFLoader === "undefined") {
      console.warn("模型数据或 GLTFLoader 缺失，使用几何体后备模型");
      return;
    }
    const loader = new THREE.GLTFLoader();
    let pending = 0;
    for (const [name, b64] of Object.entries(MODEL_DATA)) {
      pending++;
      try {
        const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
        loader.parse(bin, "", (gltf) => {
          this.items[name] = gltf;
          if (--pending === 0) this.ready = true;
        }, (e) => {
          console.warn("模型解析失败", name, e);
          if (--pending === 0) this.ready = true;
        });
      } catch (e) {
        console.warn("模型解码失败", name, e);
        if (--pending === 0) this.ready = true;
      }
    }
  },

  get(name) { return this.items[name] || null; },

  /* 静态模型克隆（枪械） */
  clone(name) {
    const g = this.get(name);
    return g ? g.scene.clone(true) : null;
  },

  /* 骨骼模型克隆（角色），返回 {scene, animations} */
  cloneSkinned(name) {
    const g = this.get(name);
    if (!g) return null;
    const scene = (THREE.SkeletonUtils && THREE.SkeletonUtils.clone)
      ? THREE.SkeletonUtils.clone(g.scene)
      : g.scene.clone(true);
    return { scene, animations: g.animations || [] };
  },

  /* 包一层 Group：自动判定枪口朝向、旋转到 -Z 朝前、按目标长度缩放、居中 */
  gunWrapper(name, targetLen) {
    const obj = this.clone(name);
    if (!obj) return null;
    /* 枪托/机匣顶点密集在后，枪管稀疏在前：用顶点均值判断朝向 */
    let sum = 0, count = 0;
    const box0 = new THREE.Box3().setFromObject(obj);
    const center0 = (box0.min.x + box0.max.x) / 2;
    obj.updateMatrixWorld(true);
    obj.traverse(o => {
      if (o.isMesh && o.geometry && o.geometry.attributes.position) {
        const pos = o.geometry.attributes.position;
        const v = new THREE.Vector3();
        const step = Math.max(1, Math.floor(pos.count / 200));
        for (let i = 0; i < pos.count; i += step) {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          sum += v.x; count++;
        }
      }
    });
    const meanX = count ? sum / count : center0;
    const barrelTowardPlusX = meanX <= center0;
    const wrapper = new THREE.Group();
    obj.rotation.y = barrelTowardPlusX ? Math.PI / 2 : -Math.PI / 2;
    wrapper.add(obj);
    const box = new THREE.Box3().setFromObject(wrapper);
    const size = box.getSize(new THREE.Vector3());
    const s = targetLen / Math.max(size.x, size.y, size.z, 1e-6);
    obj.scale.setScalar(s);
    obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(wrapper);
    const c = box2.getCenter(new THREE.Vector3());
    obj.position.sub(c);
    wrapper.traverse(o => { if (o.isMesh) { o.raycast = function () {}; o.castShadow = true; } });
    return wrapper;
  }
};
