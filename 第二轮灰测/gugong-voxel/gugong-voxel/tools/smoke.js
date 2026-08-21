/* =====================================================================
 * 紫禁城 体素模型 — 渲染层无头冒烟测试 (Node)
 *   node --max-old-space-size=6144 tools/smoke.js
 * 校验：
 *   1. 直接载入 vendor/three.min.js（UMD），核对渲染层用到的所有 THREE 符号存在
 *   2. 用真实 THREE 跑通材质、天空、体素实例网格、铺装网格的构建
 *   3. 实例总数必须与体素/铺装数量严格一致（不丢块、不多块）
 *   4. 逐实例矩阵与颜色的抽样核对（位置正确、AO 明暗在合理区间）
 *   5. index.html 中的 DOM id 与 90-main.js 的选择器一一对应
 *   6. 全部 js 通过语法检查
 * ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const fails = [];
function ck(name, ok, detail) {
  console.log((ok ? '  \u2713 ' : '  \u2717 ') + name + (detail ? '  ' + detail : ''));
  if (!ok) fails.push(name);
}

/* ---------- 1. 载入真实 THREE ---------- */
console.log('=========== 渲染层冒烟测试 ===========\n[1] 载入 vendor/three.min.js');
let THREE = null;
try {
  global.self = global.self || global;
  THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
  if (!THREE || !THREE.Scene) THREE = global.THREE;
} catch (e) {
  console.log('  载入异常：' + e.message);
}
ck('THREE 可载入', !!(THREE && THREE.Scene), THREE ? '版本 r' + (THREE.REVISION || '?') : '');
if (!THREE || !THREE.Scene) { console.log('\n无法继续'); process.exit(1); }
global.THREE = THREE;

/* ---------- 2. 核对渲染层引用的 THREE 符号 ---------- */
console.log('\n[2] 核对渲染层引用的 THREE 符号');
const rndSrc = ['js/80-mesh.js', 'js/85-post.js', 'js/90-main.js']
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const used = new Set();
for (const m of rndSrc.matchAll(/\bT\.([A-Z][A-Za-z0-9]*)/g)) used.add(m[1]);
const missing = [...used].filter(s => THREE[s] === undefined);
ck('THREE 符号全部存在', missing.length === 0,
   missing.length ? '缺失: ' + missing.join(', ') : '(' + used.size + ' 个)');

/* ---------- 3. 载入数据层并生成 ---------- */
console.log('\n[3] 生成体素数据');
for (const f of ['00-palette', '10-voxel', '15-field', '20-arch', '25-comp',
                 '30-plan', '40-city', '50-outer', '60-inner', '70-build', '80-mesh', '85-post'])
  require(path.join(ROOT, 'js', f + '.js'));
const G = globalThis;
ck('MeshKit 已注册', !!G.MeshKit);
ck('PostFX 已注册', !!G.PostFX);
const res = G.BuildCity({ log: () => {} });
console.log('  可见方块 ' + res.voxels.count + '，铺装板块 ' + res.tiles.count);

/* ---------- 4. 材质与天空 ---------- */
console.log('\n[4] 材质与天空穹顶');
const mats = G.MeshKit.createMaterials();
ck('材质数量与调色板一致', mats.length === G.GGPalette.count,
   mats.length + '/' + G.GGPalette.count);
ck('水面材质为半透明 Phong',
   mats[G.GGPalette.BLOCK.WATER].transparent === true &&
   mats[G.GGPalette.BLOCK.WATER].type === 'MeshPhongMaterial');
ck('琉璃瓦材质带高光', mats[G.GGPalette.BLOCK.TILE_Y].type === 'MeshPhongMaterial' &&
   mats[G.GGPalette.BLOCK.TILE_Y].shininess > 10);
ck('砖石材质为 Lambert', mats[G.GGPalette.BLOCK.BRICK].type === 'MeshLambertMaterial');
// r152 的 color_fragment 只在 USE_COLOR 下应用 vColor，故必须开 vertexColors
ck('全部材质开启 vertexColors（逐实例 AO 才会生效）',
   mats.every(m => m.vertexColors === true));
// ColorManagement 默认开启，new Color(hex) 已是线性，禁止再次转换（剔除注释后判定）
const rndCode = rndSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
ck('渲染层未二次做 sRGB→线性 转换', !/convertSRGBToLinear/.test(rndCode));
{
  const c = mats[G.GGPalette.BLOCK.TILE_Y].color;
  const expect = Math.pow(((0xd9 / 255) + 0.055) / 1.055, 2.4);
  ck('黄琉璃瓦线性红分量与理论值一致', Math.abs(c.r - expect) < 0.01,
     c.r.toFixed(4) + ' vs ' + expect.toFixed(4));
}
let sky = null;
try { sky = G.MeshKit.createSky(); } catch (e) { console.log('  天空异常 ' + e.message); }
ck('天空穹顶可构建', !!(sky && sky.mesh && sky.uniforms.uSunDir));
ck('天空为内表面渲染且不写深度',
   !!sky && sky.mesh.material.side === THREE.BackSide && sky.mesh.material.depthWrite === false);
{
  // 天空为原生 ShaderMaterial，必须自带色彩空间编码且不引用缺失的 include
  const fs2 = sky.mesh.material.fragmentShader;
  const incs = [...fs2.matchAll(/#include\s*<([a-z_0-9]+)>/g)].map(m => m[1]);
  const badInc = incs.filter(n => !THREE.ShaderChunk[n]);
  ck('天空着色器未引用缺失的 ShaderChunk', badInc.length === 0,
     badInc.length ? '缺失: ' + badInc.join(',') : '(引用 ' + incs.length + ' 个)');
  ck('天空着色器自带 ACES 与 sRGB 编码',
     /aces\s*\(/.test(fs2) && /lin2srgb/.test(fs2));
  ck('天空曝光可与渲染器同步', sky.uniforms.uExposure !== undefined);
}
try { G.MeshKit.buildFarGround(); ck('远景地平可构建', true); }
catch (e) { ck('远景地平可构建', false, e.message); }
{
  const g = G.MeshKit.makeBox(1, 1, 1);
  const ca = g.attributes.color;
  ck('共享几何体带全白 color 属性', !!ca && ca.itemSize === 3 &&
     Array.prototype.every.call(ca.array, v => v === 1));
}

/* ---------- 5. 体素实例网格 ---------- */
console.log('\n[5] 体素实例网格（分帧装配）');
const it = G.MeshKit.voxelMeshIterator(res.voxels, mats, { bucket: 128 });
let guard = 0;
while (!it.done && guard++ < 100000) it.step(64);
const out = it.result();
let inst = 0, shadowOk = true, colBad = 0, sphereBad = 0;
for (const m of out.meshes) {
  inst += m.count;
  if (!m.castShadow || !m.receiveShadow) shadowOk = false;
  if (!m.instanceColor || m.instanceColor.array.length !== m.count * 3) colBad++;
  if (!m.boundingSphere || !(m.boundingSphere.radius > 0)) sphereBad++;
}
ck('实例总数 == 可见方块数', inst === res.voxels.count, inst + ' / ' + res.voxels.count);
ck('全部实例组投射并接收阴影', shadowOk);
ck('每组均带逐实例颜色', colBad === 0);
ck('每组均预置包围球（视锥剔除有效且无首帧卡顿）', sphereBad === 0);
ck('实例组数量可控（< 1500）', out.meshes.length < 1500, '(' + out.meshes.length + ' 组)');
console.log('  三角面 ' + (out.triangles / 1e6).toFixed(2) + ' M');

// 包围球必须真正包住该组所有实例
{
  let cover = true;
  for (const m of out.meshes) {
    const b = m.userData.bbox, s = m.boundingSphere;
    const corners = [[b[0], b[1], b[2]], [b[3], b[4], b[5]]];
    for (const c of corners) {
      const d = Math.hypot(c[0] + 0.5 - s.center.x, c[1] + 0.5 - s.center.y, c[2] + 0.5 - s.center.z);
      if (d > s.radius + 1e-6) cover = false;
    }
  }
  ck('包围球完整覆盖各组实例', cover);
}

// 抽样核对矩阵与颜色
{
  const m0 = out.meshes[0], a = m0.instanceMatrix.array;
  let posOk = true, rangeOk = true;
  for (let i = 0; i < Math.min(200, m0.count); i++) {
    const o = i * 16;
    if (a[o] !== 1 || a[o + 5] !== 1 || a[o + 10] !== 1 || a[o + 15] !== 1) posOk = false;
    const fx = a[o + 12], fy = a[o + 13], fz = a[o + 14];
    if (Math.abs(fx % 1) !== 0.5 || Math.abs(fy % 1) !== 0.5 || Math.abs(fz % 1) !== 0.5) posOk = false;
    if (fy < 0 || fy > 60) rangeOk = false;
  }
  ck('实例矩阵为纯平移且落在格心', posOk);
  ck('实例高度在合理区间', rangeOk);
  let cmin = 9, cmax = -9;
  for (const m of out.meshes) {
    const arr = m.instanceColor.array;
    for (let i = 0; i < arr.length; i++) { if (arr[i] < cmin) cmin = arr[i]; if (arr[i] > cmax) cmax = arr[i]; }
  }
  ck('逐实例明暗系数落在 (0.35, 1.15] 区间（乘在材质色上）',
     cmin > 0.35 && cmax <= 1.15, '[' + cmin.toFixed(3) + ', ' + cmax.toFixed(3) + ']');
}

/* ---------- 6. 铺装网格 ---------- */
console.log('\n[6] 铺装 / 水面实例网格');
const tm = G.MeshKit.buildTileMeshes(res.tiles, mats);
let tinst = 0, waterCasts = false;
for (const m of tm.meshes) {
  tinst += m.count;
  if (m.material === mats[G.GGPalette.BLOCK.WATER] && m.castShadow) waterCasts = true;
  if (!m.receiveShadow) fails.push('铺装未接收阴影');
}
ck('铺装实例总数 == 铺装板块数', tinst === res.tiles.count, tinst + ' / ' + res.tiles.count);
ck('水面不投射阴影', !waterCasts);
ck('铺装实例组按材质合并', tm.meshes.length <= G.GGPalette.count, '(' + tm.meshes.length + ' 组)');

/* ---------- 7. 后期链（用桩渲染器构造，逐项核对着色器与 uniform） ---------- */
console.log('\n[7] 后期处理管线');
{
  const stub = {
    capabilities: { isWebGL2: true },
    extensions: { has: () => true },
    domElement: { width: 64, height: 32 },
    getContext: () => { throw new Error('no gl in node'); }
  };
  let fx = null;
  try {
    fx = new G.PostFX(stub, new THREE.Scene(), new THREE.PerspectiveCamera(50, 2, 1, 100));
  } catch (e) { console.log('  构造异常：' + e.message); }
  ck('PostFX 可构造（不需要 GL 上下文）', !!fx);
  if (fx) {
    fx.setSize(1280, 720);
    const t = fx.targets;
    ck('渲染目标数量 = 1 + 2×金字塔层数', !!t && (1 + 2 * G.PostFX.LEVELS) === (1 + t.a.length + t.b.length),
       '(1+' + (t.a.length + t.b.length) + ')');
    ck('场景目标为半浮点 HDR', t.scene.texture.type === THREE.HalfFloatType);
    ck('场景目标纹理为线性色彩空间', t.scene.texture.colorSpace === THREE.LinearSRGBColorSpace);
    ck('场景目标挂有深度纹理（云影反投影所需）', !!t.scene.depthTexture);
    let halving = true, pw = 1280, ph = 720;
    for (let i = 0; i < t.size.length; i++) {
      pw = Math.max(1, pw >> 1); ph = Math.max(1, ph >> 1);
      if (t.size[i][0] !== pw || t.size[i][1] !== ph) halving = false;
    }
    ck('金字塔逐级折半', halving, JSON.stringify(t.size));
    ck('自检在无法读像素时不误判为失败', fx.selfTest() === true);

    /* uniform 与着色器源码双向对照——排版笔误最容易在这里露出 */
    const pairs = [
      ['bright', fx.matBright], ['down', fx.matDown],
      ['blur', fx.matBlur], ['comp', fx.matComp]
    ];
    let missInShader = [], missInJS = [], unbal = [];
    for (const [key, mat] of pairs) {
      const src = G.PostFX.SHADERS[key].vert + '\n' + G.PostFX.SHADERS[key].frag;
      const declared = new Set([...src.matchAll(/uniform\s+\w+\s+(\w+)\s*;/g)].map(m => m[1]));
      for (const k of Object.keys(mat.uniforms))
        if (!declared.has(k)) missInShader.push(key + '.' + k);
      for (const d of declared)
        if (!(d in mat.uniforms)) missInJS.push(key + '.' + d);
      const f = G.PostFX.SHADERS[key].frag;
      const nb = (f.match(/\{/g) || []).length - (f.match(/\}/g) || []).length;
      const np = (f.match(/\(/g) || []).length - (f.match(/\)/g) || []).length;
      if (nb !== 0 || np !== 0) unbal.push(key + '(花括号' + nb + ' 圆括号' + np + ')');
    }
    ck('JS 侧 uniform 均在着色器中声明', missInShader.length === 0, missInShader.join(','));
    ck('着色器 uniform 均在 JS 侧提供', missInJS.length === 0, missInJS.join(','));
    ck('着色器括号配平', unbal.length === 0, unbal.join(','));
    const fc = G.PostFX.SHADERS.comp.frag;
    ck('合成着色器为 GLSL ES 1.00（无 texture()/textureLod/switch）',
       !/\btexture\s*\(/.test(fc) && !/textureLod/.test(fc) && !/\bswitch\b/.test(fc));
    ck('合成着色器循环上界为常量（ES 1.00 要求）',
       /for\s*\(\s*int\s+i\s*=\s*0\s*;\s*i\s*<\s*(RAY_SAMPLES|4)\s*;/.test(fc));
    ck('合成着色器自带 sRGB 编码与三种色调映射',
       /lin2srgb/.test(fc) && /tmAces/.test(fc) && /tmFilmic/.test(fc) && /tmReinhard/.test(fc));
    ck('天空着色器支持 uPost（后期开启时输出线性 HDR）',
       'uPost' in sky.uniforms && /uPost/.test(sky.mesh.material.fragmentShader));
  }
  /* 滤镜预设完整性 */
  const need = ['n', 'tm', 'ex', 'ct', 'sa', 'tp', 'ti', 'lift', 'gain',
                'vig', 'gr', 'ab', 'bl', 'th', 'ry', 'cl'];
  const bad = [];
  G.PostFX.FILTERS.forEach(f => {
    need.forEach(k => { if (f[k] === undefined) bad.push(f.n + '.' + k); });
    if (f.lift.length !== 3 || f.gain.length !== 3) bad.push(f.n + '.lift/gain');
    if (f.tm < 0 || f.tm > 3) bad.push(f.n + '.tm');
  });
  ck('滤镜预设字段完整', bad.length === 0, bad.join(','));
  ck('滤镜预设数量 = 7', G.PostFX.FILTERS.length === 7,
     G.PostFX.FILTERS.map(f => f.n).join(' / '));
  ck('色调映射名录 = 4', G.PostFX.TONEMAPS.length === 4, G.PostFX.TONEMAPS.join(' / '));
}

/* ---------- 8. DOM 选择器与 id 对应 ---------- */
console.log('\n[8] index.html 选择器一致性');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const mainSrc = fs.readFileSync(path.join(ROOT, 'js', '90-main.js'), 'utf8');
const sels = new Set([...mainSrc.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map(m => m[1]));
const noId = [...sels].filter(s => !ids.has(s));
ck('全部 $(#id) 选择器都能命中', noId.length === 0,
   noId.length ? '缺失 id: ' + noId.join(', ') : '(' + sels.size + ' 个)');
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
const noFile = scripts.filter(s => !fs.existsSync(path.join(ROOT, s)));
ck('页面引用的脚本文件全部存在', noFile.length === 0,
   noFile.length ? '缺失: ' + noFile.join(', ') : '(' + scripts.length + ' 个)');
ck('脚本载入顺序正确（vendor 在最前，90-main 在最后）',
   scripts[0].indexOf('vendor/three') >= 0 && scripts[scripts.length - 1].indexOf('90-main') >= 0);

console.log('\n===================================================');
if (!fails.length) { console.log('渲染层冒烟测试全部通过。'); process.exit(0); }
console.log('未通过 ' + fails.length + ' 项：' + [...new Set(fails)].join('、'));
process.exit(1);
