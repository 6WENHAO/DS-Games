/**
 * 模型导出
 *
 *  GLB   —— 二进制 glTF，贴图（程序化 Canvas 生成的迷彩/法线/粗糙度）内嵌为 PNG，
 *            可直接拖进 Blender / Unity / Unreal / 三维看图工具，涂装原样保留。
 *  glTF  —— JSON 文本版（贴图 base64 内嵌），便于人工检查节点树。
 *  OBJ   —— 通用几何交换格式（含 mtl 材质名，无贴图）。
 *  STL   —— 3D 打印用（纯三角网格，无材质）。
 *  PNG   —— 当前视角截图，支持 1×/2×/4× 超采样。
 *  JSON  —— 组件目录与参数表（结构说明数据，便于二次开发）。
 *
 * 注意：导出前必须清除高亮/半透明材质覆盖，否则红色高亮会被一起导出。
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

export function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function download(data, filename, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return blob.size;
}

function humanSize(n) {
  if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
  if (n > 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

/**
 * 导出前的场景净化：把带 noExport 标记的对象临时"摘下来"（而不是隐藏 —— 因为
 * onlyVisible:false 会把隐藏对象也导出去），返回恢复函数。
 */
function isolate(root) {
  const detached = [];
  const collect = [];
  root.traverse((o) => {
    if (o !== root && o.userData && o.userData.noExport) collect.push(o);
  });
  for (const o of collect) {
    if (o.parent) {
      detached.push([o, o.parent]);
      o.parent.remove(o);
    }
  }
  return () => detached.forEach(([o, p]) => p.add(o));
}

export async function exportGLTF(root, { binary = true, scheme = 'model', onlyVisible = false } = {}) {
  const restore = isolate(root);
  const exporter = new GLTFExporter();
  try {
    const result = await new Promise((resolve, reject) => {
      exporter.parse(
        root,
        resolve,
        reject,
        {
          binary,
          onlyVisible,
          truncateDrawRange: false,
          maxTextureSize: 2048,
          includeCustomExtensions: false,
        },
      );
    });
    const name = `ZTZ-99A_${scheme}_${timestamp()}.${binary ? 'glb' : 'gltf'}`;
    const size = binary
      ? download(result, name, 'model/gltf-binary')
      : download(JSON.stringify(result, null, 1), name, 'model/gltf+json');
    return { name, size: humanSize(size) };
  } finally {
    restore();
  }
}

export function exportOBJ(root, { scheme = 'model' } = {}) {
  const restore = isolate(root);
  try {
    const text = new OBJExporter().parse(root);
    const name = `ZTZ-99A_${scheme}_${timestamp()}.obj`;
    const size = download(text, name, 'text/plain');
    return { name, size: humanSize(size) };
  } finally {
    restore();
  }
}

export function exportSTL(root, { binary = true, scheme = 'model' } = {}) {
  const restore = isolate(root);
  try {
    const data = new STLExporter().parse(root, { binary });
    const name = `ZTZ-99A_${scheme}_${timestamp()}.stl`;
    const size = download(data instanceof DataView ? new Blob([data]) : data, name, 'model/stl');
    return { name, size: humanSize(size) };
  } finally {
    restore();
  }
}

/**
 * 截图：临时把渲染尺寸放大 scale 倍做超采样，渲染一帧后立即读取像素。
 * 必须在同一个任务内 toDataURL —— 否则绘制缓冲区已被清空。
 */
export function captureScreenshot({ renderer, env, camera, scale = 2, scheme = 'model', transparent = false }) {
  const size = renderer.getSize(new THREE.Vector2());
  const dpr = renderer.getPixelRatio();
  // 超采样尺寸受最大纹理尺寸限制（4× 在高分屏上很容易超过 GPU 上限）
  const maxDim = Math.min(renderer.capabilities.maxTextureSize || 4096, 8192);
  let w = Math.round(size.x * scale);
  let h = Math.round(size.y * scale);
  if (w > maxDim || h > maxDim) {
    const k = Math.min(maxDim / w, maxDim / h);
    w = Math.floor(w * k);
    h = Math.floor(h * k);
  }
  const oldClear = renderer.getClearAlpha();
  const oldBg = env.scene.background;
  const oldFilmOffset = camera.filmOffset;
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    env.setPixelRatio(1); // composer 自己缓存 pixelRatio，必须同步
    env.setSize(w, h);
    camera.aspect = w / h;
    camera.filmOffset = 0; // 出图要正中构图，不带面板避让偏移
    camera.updateProjectionMatrix();
    if (transparent) {
      env.scene.background = null;
      renderer.setClearAlpha(0);
    }
    env.render();
    const url = renderer.domElement.toDataURL('image/png');
    const name = `ZTZ-99A_${scheme}_${timestamp()}_${scale}x.png`;
    const bin = atob(url.split(',')[1]);
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    const bytes = download(new Blob([buf], { type: 'image/png' }), name);
    return { name, size: humanSize(bytes), pixels: `${w}×${h}` };
  } finally {
    if (transparent) {
      env.scene.background = oldBg;
      renderer.setClearAlpha(oldClear);
    }
    renderer.setPixelRatio(dpr);
    renderer.setSize(size.x, size.y, false);
    env.setPixelRatio(dpr);
    env.setSize(size.x, size.y);
    camera.aspect = size.x / size.y;
    camera.filmOffset = oldFilmOffset;
    camera.updateProjectionMatrix();
  }
}

/** 导出结构说明数据（组件目录 + 统计） */
export function exportSpec({ categories, general, disclaimer, stats, scheme }) {
  const spec = {
    model: 'ZTZ-99A 主战坦克结构演示模型',
    generatedAt: new Date().toISOString(),
    scheme,
    disclaimer,
    generalSpecs: Object.fromEntries(general),
    statistics: stats,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: c.items.map((it) => ({
        id: it.id,
        name: it.name,
        pids: it.pids || null,
        prefix: it.prefix || null,
        desc: it.desc,
        specs: it.specs ? Object.fromEntries(it.specs) : null,
        internal: !!it.internal,
      })),
    })),
  };
  const name = `ZTZ-99A_components_${timestamp()}.json`;
  const size = download(JSON.stringify(spec, null, 2), name, 'application/json');
  return { name, size: humanSize(size) };
}
