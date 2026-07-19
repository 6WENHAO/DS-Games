/* ============================================================
   STARFORGE - modellib.js
   外部 GLB 模型库：base64 解码 → GLTFLoader 解析 → 模板克隆
   （模型缺失/解析失败时调用方回退到程序化体素模型）
   ============================================================ */
'use strict';

const ModelLib = (() => {
  const ready = {};    // name -> { group(扁平化模板), box(Box3), maxDim }
  let inited = false;

  function b64ToArr(b64){
    const s = atob(b64);
    const a = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
    return a.buffer;
  }

  function init(){
    if (inited) return;
    inited = true;
    if (typeof THREE === 'undefined' || typeof THREE.GLTFLoader !== 'function') return;
    if (typeof MODELS_B64 === 'undefined') return;
    const loader = new THREE.GLTFLoader();
    for (const name in MODELS_B64){
      try {
        loader.parse(b64ToArr(MODELS_B64[name]), '', gltf => {
          const g = new THREE.Group();
          gltf.scene.updateMatrixWorld(true);
          // 蒙皮网格一并转为静态网格（绑定姿态渲染，克隆安全、无需动画系统）
          gltf.scene.traverse(o => {
            if (o.isMesh || o.isSkinnedMesh){
              const m = new THREE.Mesh(o.geometry, o.material);
              o.getWorldPosition(m.position);
              o.getWorldQuaternion(m.quaternion);
              o.getWorldScale(m.scale);
              g.add(m);
            }
          });
          const box = new THREE.Box3().setFromObject(g);
          const size = new THREE.Vector3();
          box.getSize(size);
          ready[name] = { group: g, box, maxDim: Math.max(size.x, size.y, size.z) || 1 };
        }, e => { console.warn('[ModelLib]', name, e); });
      } catch(e){ console.warn('[ModelLib]', name, e); }
    }
  }

  function has(name){ init(); return !!ready[name]; }

  // 取模型克隆：
  //   size — 归一化最长边（世界单位）
  //   opts.tint — 整体向该颜色混合（生物按生态染色）
  //   opts.yaw  — 模型自带朝向修正（弧度），使“前方”=-Z
  //   opts.ground — true 时最低点落在 y=0（默认）；false 时几何中心在原点
  function get(name, size, opts){
    init();
    const t = ready[name];
    if (!t) return null;
    opts = opts || {};
    const inner = t.group.clone();
    // GLTF 的 StandardMaterial 统一转 Lambert（与全游戏光照风格一致，且修正线性色偏暗）
    const matCache = new Map();
    inner.traverse(o => {
      if (o.isMesh && o.material){
        if (!matCache.has(o.material)){
          const src = o.material;
          const m = new THREE.MeshLambertMaterial({
            color: src.color ? src.color.clone().convertLinearToSRGB() : new THREE.Color(0xaaaaaa),
            transparent: !!src.transparent,
            opacity: src.opacity !== undefined ? src.opacity : 1,
          });
          if (src.map){
            m.map = src.map;
            m.map.encoding = THREE.LinearEncoding;   // 避免 sRGB 双重解码变暗
          }
          if (src.vertexColors) m.vertexColors = true;
          if (opts.tint !== undefined) m.color.lerp(new THREE.Color(opts.tint), 0.55);
          matCache.set(o.material, m);
        }
        o.material = matCache.get(o.material);
      }
    });
    const s = size / t.maxDim;
    const wrap = new THREE.Group();
    const pivot = new THREE.Group();
    pivot.add(inner);
    pivot.rotation.y = opts.yaw || 0;
    // 先居中（x/z 及可选 y），再缩放
    const c = new THREE.Vector3();
    t.box.getCenter(c);
    inner.position.set(-c.x, opts.ground === false ? -c.y : -t.box.min.y, -c.z);
    pivot.scale.setScalar(s);
    wrap.add(pivot);
    return wrap;
  }

  return { init, has, get };
})();
window.ModelLib = ModelLib;
ModelLib.init();   // 页面加载即解析（进入游戏前就绪；失败时调用方自动回退体素模型）
