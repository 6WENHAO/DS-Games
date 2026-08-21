// Node 端 ESM 解析钩子：把浏览器 importmap 里的 "three" / "three/addons/*"
// 映射到本地 vendor 目录，这样 Node 也能直接跑 src 下的模块。
const ROOT = new URL('../', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') {
    return { url: new URL('vendor/three.module.js', ROOT).href, shortCircuit: true };
  }
  if (specifier.startsWith('three/addons/')) {
    const rest = specifier.slice('three/addons/'.length);
    return { url: new URL('vendor/addons/' + rest, ROOT).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
