import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { geometryVS, geometryFS } from '../src/gfx/shaders/geometry.js';
import { skyVS, skyFS } from '../src/gfx/shaders/sky.js';
import {
  fullscreenVS, ssaoFS, ssaoBlurFS, brightFS, downsampleFS, upsampleFS,
  godraysFS, compositeFS, fxaaFS, blitFS,
} from '../src/gfx/shaders/post.js';
import { ATTRIB, VERTEX_BYTES, FACE_NORMALS } from '../src/voxel/mesher.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

/** 所有着色器源：名称 → 源码 */
const SHADERS = {
  'geometry.vert': geometryVS, 'geometry.frag': geometryFS,
  'sky.vert': skyVS, 'sky.frag': skyFS,
  'fullscreen.vert': fullscreenVS,
  'ssao.frag': ssaoFS, 'ssaoBlur.frag': ssaoBlurFS,
  'bright.frag': brightFS, 'downsample.frag': downsampleFS, 'upsample.frag': upsampleFS,
  'godrays.frag': godraysFS, 'composite.frag': compositeFS,
  'fxaa.frag': fxaaFS, 'blit.frag': blitFS,
};

/** 去掉注释与字符串，便于做词法级检查 */
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

/* ═══════════════ 基础卫生检查 ═══════════════ */

test('着色器：不得自带 #version（由 Program 统一注入）', () => {
  for (const [name, src] of Object.entries(SHADERS)) {
    assert.ok(!src.includes('#version'), `${name} 不应包含 #version`);
  }
});

test('着色器：不得使用 WebGL1 遗留语法', () => {
  const banned = ['texture2D(', 'textureCube(', 'gl_FragColor', 'gl_FragData', 'varying ', 'attribute '];
  for (const [name, src] of Object.entries(SHADERS)) {
    const s = strip(src);
    for (const b of banned) {
      assert.ok(!s.includes(b), `${name} 使用了 WebGL1 遗留语法：${b}`);
    }
  }
});

test('着色器：括号配平', () => {
  for (const [name, src] of Object.entries(SHADERS)) {
    const s = strip(src);
    for (const [open, close] of [['{', '}'], ['(', ')'], ['[', ']']]) {
      const a = s.split(open).length - 1, b = s.split(close).length - 1;
      assert.equal(a, b, `${name} 的 ${open}${close} 不配平（${a} vs ${b}）`);
    }
  }
});

test('着色器：每个片元着色器都声明了输出且指定了 location', () => {
  for (const [name, src] of Object.entries(SHADERS)) {
    if (!name.endsWith('.frag')) continue;
    const s = strip(src);
    const outs = [...s.matchAll(/layout\s*\(\s*location\s*=\s*(\d+)\s*\)\s*out\s+(\w+)\s+(\w+)/g)];
    assert.ok(outs.length > 0, `${name} 没有带 location 的输出`);
  }
});

test('着色器：smoothstep 的字面量边界必须递增（否则行为未定义）', () => {
  for (const [name, src] of Object.entries(SHADERS)) {
    const s = strip(src);
    for (const m of s.matchAll(/smoothstep\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,/g)) {
      const a = parseFloat(m[1]), b = parseFloat(m[2]);
      assert.ok(a < b, `${name} 中 smoothstep(${a}, ${b}, …) 的边界未递增`);
    }
  }
});

test('着色器：不存在把类型名当函数用的写法（如 void(x)）', () => {
  for (const [name, src] of Object.entries(SHADERS)) {
    const s = strip(src);
    assert.ok(!/\bvoid\s*\(/.test(s.replace(/void\s+main\s*\(/g, 'main(')), `${name} 存在非法的 void(...) 调用`);
  }
});

test('着色器：函数必须先声明后使用（GLSL 无提升）', () => {
  const KEYWORDS = new Set([
    'if', 'for', 'while', 'switch', 'return', 'else', 'do', 'main', 'discard',
    'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3', 'ivec4', 'uvec2', 'uvec3', 'uvec4',
    'mat2', 'mat3', 'mat4', 'float', 'int', 'uint', 'bool', 'void',
    // GLSL ES 3.00 内建函数
    'abs', 'acos', 'all', 'any', 'asin', 'atan', 'ceil', 'clamp', 'cos', 'cosh', 'cross',
    'degrees', 'determinant', 'dFdx', 'dFdy', 'distance', 'dot', 'equal', 'exp', 'exp2',
    'faceforward', 'floatBitsToInt', 'floor', 'fract', 'fwidth', 'greaterThan',
    'greaterThanEqual', 'inverse', 'inversesqrt', 'isinf', 'isnan', 'length', 'lessThan',
    'lessThanEqual', 'log', 'log2', 'matrixCompMult', 'max', 'min', 'mix', 'mod', 'modf',
    'normalize', 'not', 'notEqual', 'outerProduct', 'pow', 'radians', 'reflect', 'refract',
    'round', 'roundEven', 'sign', 'sin', 'sinh', 'smoothstep', 'sqrt', 'step', 'tan', 'tanh',
    'texelFetch', 'texture', 'textureGrad', 'textureLod', 'textureProj', 'textureSize',
    'transpose', 'trunc', 'packSnorm2x16', 'unpackSnorm2x16', 'intBitsToFloat',
  ]);
  for (const [name, src] of Object.entries(SHADERS)) {
    const s = strip(src);
    // 收集自定义函数的定义位置
    const defs = new Map();
    for (const m of s.matchAll(/^\s*(?:highp\s+|mediump\s+|lowp\s+)?\w+(?:\s*\[\s*\d+\s*\])?\s+(\w+)\s*\([^)]*\)\s*\{/gm)) {
      if (!defs.has(m[1])) defs.set(m[1], m.index);
    }
    // 检查每处调用
    for (const m of s.matchAll(/(\w+)\s*\(/g)) {
      const fn = m[1];
      if (KEYWORDS.has(fn) || !defs.has(fn)) continue;
      const defAt = defs.get(fn);
      // 调用点若早于定义点，且不在该函数自身的定义行内 → 违规
      if (m.index < defAt && !/\{\s*$/.test(s.slice(m.index, m.index + 200).split('\n')[0])) {
        const line = s.slice(0, m.index).split('\n').length;
        assert.fail(`${name} 第 ${line} 行调用了尚未声明的函数 ${fn}（GLSL 不做函数提升）`);
      }
    }
  }
});

test('着色器：out 参数与返回值使用自洽（out 参数必须被赋值）', () => {
  for (const [name, src] of Object.entries(SHADERS)) {
    const s = strip(src);
    for (const m of s.matchAll(/\b\w+\s+(\w+)\s*\(([^)]*\bout\s+\w+\s+\w+[^)]*)\)\s*\{/g)) {
      const body = s.slice(m.index + m[0].length, m.index + m[0].length + 4000);
      for (const p of m[2].split(',')) {
        const om = p.trim().match(/^out\s+\w+\s+(\w+)$/);
        if (!om) continue;
        assert.ok(new RegExp(`\\b${om[1]}\\s*=`).test(body),
          `${name} 中函数 ${m[1]} 的 out 参数 ${om[1]} 未被赋值`);
      }
    }
  }
});
test('着色器：main 函数唯一存在', () => {
  for (const [name, src] of Object.entries(SHADERS)) {
    const n = [...strip(src).matchAll(/\bvoid\s+main\s*\(\s*\)/g)].length;
    assert.equal(n, 1, `${name} 的 main 函数数量为 ${n}`);
  }
});

/* ═══════════════ 顶点属性与网格布局一致性 ═══════════════ */

test('几何顶点着色器的属性槽位与 mesher 顶点布局完全一致', () => {
  const s = strip(geometryVS);
  const decls = [...s.matchAll(/layout\s*\(\s*location\s*=\s*(\d+)\s*\)\s*in\s+(\w+)\s+(\w+)\s*;/g)]
    .map((m) => ({ loc: +m[1], type: m[2], name: m[3] }));
  assert.equal(decls.length, Object.keys(ATTRIB).length,
    `属性数量不匹配：GLSL ${decls.length} 个，mesher ${Object.keys(ATTRIB).length} 个`);

  const expectType = { 1: 'float', 2: 'vec2', 3: 'vec3', 4: 'vec4' };
  for (const [key, a] of Object.entries(ATTRIB)) {
    const d = decls.find((x) => x.loc === a.loc);
    assert.ok(d, `location ${a.loc}（${key}）在 GLSL 中缺失`);
    assert.equal(d.type, expectType[a.size],
      `location ${a.loc}（${key}）类型应为 ${expectType[a.size]}，实际 ${d.type}`);
  }
  // 步长与偏移互不重叠
  const spans = Object.values(ATTRIB).map((a) => [a.offset, a.offset + a.size * (a.type === 'u16' ? 2 : 1)]);
  spans.sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < spans.length; i++) {
    assert.ok(spans[i][0] >= spans[i - 1][1], `属性 ${i} 与前一个重叠`);
  }
  assert.ok(spans[spans.length - 1][1] <= VERTEX_BYTES);
});

/* ═══════════════ 顶点 → 片元 varying 匹配 ═══════════════ */

function varyings(src, kind) {
  const s = strip(src);
  const re = new RegExp(`(flat\\s+)?${kind}\\s+(\\w+)\\s+(\\w+)\\s*;`, 'g');
  const out = new Map();
  for (const m of s.matchAll(re)) {
    if (/^(uniform|layout)$/.test(m[2])) continue;
    out.set(m[3], `${m[1] ? 'flat ' : ''}${m[2]}`);
  }
  return out;
}

const PAIRS = [
  ['geometry', geometryVS, geometryFS],
  ['sky', skyVS, skyFS],
  ['post/ssao', fullscreenVS, ssaoFS],
  ['post/ssaoBlur', fullscreenVS, ssaoBlurFS],
  ['post/bright', fullscreenVS, brightFS],
  ['post/downsample', fullscreenVS, downsampleFS],
  ['post/upsample', fullscreenVS, upsampleFS],
  ['post/godrays', fullscreenVS, godraysFS],
  ['post/composite', fullscreenVS, compositeFS],
  ['post/fxaa', fullscreenVS, fxaaFS],
  ['post/blit', fullscreenVS, blitFS],
];

test('每个片元着色器的输入都由对应顶点着色器提供（类型与 flat 限定一致）', () => {
  for (const [name, vs, fs] of PAIRS) {
    const outs = varyings(vs, 'out');
    const ins = varyings(fs, 'in');
    for (const [k, t] of ins) {
      assert.ok(outs.has(k), `${name}: 片元输入 ${k} 在顶点着色器中没有对应输出`);
      assert.equal(outs.get(k), t, `${name}: varying ${k} 的类型/限定不匹配（vs=${outs.get(k)} fs=${t}）`);
    }
  }
});

test('整数 varying 必须带 flat 限定', () => {
  for (const [name, vs] of PAIRS) {
    for (const [k, t] of varyings(vs, 'out')) {
      if (/\b(int|ivec[234]|uint|uvec[234])\b/.test(t)) {
        assert.ok(t.startsWith('flat'), `${name}: 整数 varying ${k} 缺少 flat 限定`);
      }
    }
  }
});

/* ═══════════════ JS 侧 uniform 名称与 GLSL 声明一致 ═══════════════ */

function declaredUniforms(src) {
  const set = new Set();
  for (const m of strip(src).matchAll(/\buniform\s+(?:highp\s+|mediump\s+|lowp\s+)?(\w+)\s+(\w+)\s*(\[[^\]]*\])?\s*;/g)) {
    set.add(m[2]);
  }
  return set;
}

test('renderer.js 设置的每个 uniform 都在某个着色器中声明', () => {
  const rendererSrc = read('src/gfx/renderer.js');
  const all = new Set();
  for (const src of Object.values(SHADERS)) for (const u of declaredUniforms(src)) all.add(u);

  const used = new Set();
  const re = /\.(?:int|float|vec2|vec3|vec4|mat3|mat4|floats|vec2s|vec3s|texture)\(\s*'([A-Za-z_]\w*)'/g;
  for (const m of rendererSrc.matchAll(re)) used.add(m[1]);

  assert.ok(used.size > 25, `提取到的 uniform 过少（${used.size}），检查正则是否失效`);
  const missing = [...used].filter((u) => !all.has(u));
  assert.deepEqual(missing, [], `这些 uniform 在 GLSL 中未声明：${missing.join(', ')}`);
});

test('关键 uniform 在对应通道中确实存在', () => {
  const geo = declaredUniforms(geometryFS);
  for (const u of ['uSunDir', 'uSunColor', 'uShadowMap', 'uAOTex', 'uShadowVP', 'uMode', 'uOpacity',
    'uHighlight', 'uHighlightColor', 'uDim', 'uPickColor', 'uEmissiveBoost', 'uDetail', 'uInvRes']) {
    assert.ok(geo.has(u), `geometry.frag 缺少 uniform ${u}`);
  }
  const geoV = declaredUniforms(geometryVS);
  for (const u of ['uModel', 'uViewProj', 'uView', 'uOrigin', 'uNormalBias']) {
    assert.ok(geoV.has(u), `geometry.vert 缺少 uniform ${u}`);
  }
  const sky = declaredUniforms(skyFS);
  for (const u of ['uCamPos', 'uSunDir', 'uEarthCenter', 'uEarthRadius', 'uStarBoost', 'uEarthOn', 'uGalaxyAxis']) {
    assert.ok(sky.has(u), `sky.frag 缺少 uniform ${u}`);
  }
  assert.ok(declaredUniforms(ssaoFS).has('uKernel'), 'ssao.frag 缺少 uKernel');
});

test('#define 宏在 GLSL 中被使用时，renderer 必须注入', () => {
  const rendererSrc = read('src/gfx/renderer.js');
  const macros = ['SHADOW_SIZE', 'KERNEL_SIZE'];
  for (const m of macros) {
    const usedInGlsl = Object.values(SHADERS).some((s) => new RegExp(`\\b${m}\\b`).test(strip(s)));
    if (!usedInGlsl) continue;
    assert.ok(rendererSrc.includes(m), `GLSL 使用了宏 ${m}，但 renderer.js 未注入`);
  }
  // PASS_* 变体必须四种齐备
  for (const p of ['PASS_MAIN', 'PASS_PREPASS', 'PASS_SHADOW', 'PASS_PICK']) {
    assert.ok(strip(geometryFS).includes(p), `geometry.frag 缺少通道分支 ${p}`);
    assert.ok(rendererSrc.includes(p), `renderer.js 未创建 ${p} 变体`);
  }
});

test('几何着色器四个通道各自恰好一个输出（避免 drawBuffers 错位）', () => {
  const s = strip(geometryFS);
  // 输出声明必须都在 location = 0
  const outs = [...s.matchAll(/layout\s*\(\s*location\s*=\s*(\d+)\s*\)\s*out\s+/g)].map((m) => +m[1]);
  assert.ok(outs.length >= 3, '通道输出声明过少');
  assert.deepEqual([...new Set(outs)], [0], '几何通道的片元输出必须统一使用 location = 0');
});

/* ═══════════════ 常量共享一致性 ═══════════════ */

test('自发光编码上限在 JS 与 GLSL 中一致', async () => {
  const { EMISSIVE_SCALE } = await import('../src/voxel/palette.js');
  const m = strip(geometryFS).match(/#define\s+EMISSIVE_SCALE\s+([\d.]+)/);
  assert.ok(m, 'geometry.frag 未定义 EMISSIVE_SCALE');
  assert.equal(parseFloat(m[1]), EMISSIVE_SCALE);
});

test('DETAIL / FLAG 常量在 JS 与 GLSL 中一致', async () => {
  const { DETAIL, FLAG } = await import('../src/voxel/palette.js');
  const s = strip(geometryFS);
  const glslConst = (name) => {
    const m = s.match(new RegExp(`#define\\s+${name}\\s+(-?\\d+)`));
    return m ? parseInt(m[1], 10) : null;
  };
  const map = {
    D_PLAIN: DETAIL.PLAIN, D_HULL: DETAIL.HULL, D_FOIL: DETAIL.FOIL, D_SOLAR: DETAIL.SOLAR,
    D_TRUSS: DETAIL.TRUSS, D_WINDOW: DETAIL.WINDOW, D_RADIATOR: DETAIL.RADIATOR,
    D_HAZARD: DETAIL.HAZARD, D_NOZZLE: DETAIL.NOZZLE, D_GRATE: DETAIL.GRATE, D_LED: DETAIL.LED,
    F_BLINK: FLAG.BLINK, F_PULSE: FLAG.PULSE, F_SWEEP: FLAG.SWEEP, F_FLICKER: FLAG.FLICKER,
  };
  for (const [k, v] of Object.entries(map)) {
    assert.equal(glslConst(k), v, `${k} 在 GLSL 中为 ${glslConst(k)}，JS 中为 ${v}`);
  }
});

test('FACE_NORMALS 表在 JS 与 GLSL 中一致', () => {
  const m = strip(geometryVS).match(/const\s+vec3\s+FACE_N\s*\[\s*6\s*\]\s*=\s*vec3\s*\[\s*6\s*\]\s*\(([\s\S]*?)\)\s*;/);
  assert.ok(m, 'geometry.vert 未找到 FACE_N 表');
  const nums = [...m[1].matchAll(/vec3\s*\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g)]
    .map((x) => [+x[1], +x[2], +x[3]]);
  assert.deepEqual(nums, FACE_NORMALS);
});

/* ═══════════════ 渲染目标与格式 ═══════════════ */

test('renderer 使用的 FMT 键都在 target.js 中定义', () => {
  const targetSrc = read('src/gfx/target.js');
  const defined = new Set([...targetSrc.matchAll(/^\s{2}(\w+):\s*\{\s*internal:/gm)].map((m) => m[1]));
  const used = new Set([...read('src/gfx/renderer.js').matchAll(/FMT\.(\w+)/g)].map((m) => m[1]));
  for (const u of used) assert.ok(defined.has(u), `FMT.${u} 未在 target.js 中定义`);
  assert.ok(used.size >= 3);
});
