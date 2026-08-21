/**
 * tools/lint-shaders.js — 离线着色器 / 滤镜定义静态检查（零依赖，Node 下运行）
 *
 * 本机没有浏览器，无法真正编译 GLSL，所以用一套针对 GLSL ES 1.00 的静态规则
 * 把最常见的坑挡在前面：
 *   · 禁用 WebGL1 不支持的语法（位运算、%、texture()、dFdx、in/out、#version…）
 *   · 括号/花括号配对、main() 存在、gl_FragColor 恰好赋值一次
 *   · 引用了未声明的 uniform（最常见 bug：参数名写错）
 *   · 对只接受 float 的内建函数传了整数字面量（如 mod(x, 2)）
 *   · uniform 与 float 变量和裸整数比较（如 u_mode > 1）
 *   · 重复定义公共辅助函数
 *   · 滤镜元数据规范（label/doc/参数范围/默认值/mix 参数/id 唯一）
 *
 * 用法： node tools/lint-shaders.js            # 全量检查
 *        node tools/lint-shaders.js --json     # 机器可读输出
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = global;
global.document = undefined;

require(path.join(ROOT, 'src/core/ns.js'));
const ShaderLib = require(path.join(ROOT, 'src/gl/shaderlib.js'));

const FILTER_DIR = path.join(ROOT, 'src/gl/filters');
const files = fs.readdirSync(FILTER_DIR).filter((f) => f.endsWith('.js')).sort();
for (const f of files) require(path.join(FILTER_DIR, f));

const D = global.DSV4P;

/* ------------------------------------------------------------------ */
/* 规则表                                                              */
/* ------------------------------------------------------------------ */

const FORBIDDEN = [
  [/(?<![&])&(?![&])/, '按位与 & 在 GLSL ES 1.00 不可用'],
  [/(?<![|])\|(?![|])/, '按位或 | 在 GLSL ES 1.00 不可用'],
  [/\^/, '按位异或 ^ 在 GLSL ES 1.00 不可用'],
  [/<</, '左移 << 在 GLSL ES 1.00 不可用'],
  [/>>/, '右移 >> 在 GLSL ES 1.00 不可用'],
  [/~/, '按位取反 ~ 在 GLSL ES 1.00 不可用'],
  [/[^\/*\s]\s*%\s*[^\/*=]/, '取模运算符 % 不可用，请改用 mod()'],
  [/\btexture\s*\(/, 'texture() 是 ES 3.00 语法，请用 texture2D()'],
  [/\btextureLod\s*\(/, 'textureLod() 不可用'],
  [/\b(dFdx|dFdy|fwidth)\s*\(/, '导数函数需要扩展，禁止使用'],
  [/#version/, '不要写 #version'],
  [/\blayout\s*\(/, 'layout 限定符是 ES 3.00 语法'],
  [/^\s*(in|out|flat|centroid)\s+\w/m, 'in/out/flat 限定符是 ES 3.00 语法'],
  [/^\s*precision\s+/m, '不要自己声明 precision（引擎已注入）'],
  [/^\s*uniform\s+/m, '不要自己声明 uniform（引擎按 params 自动生成）'],
  [/^\s*varying\s+/m, '不要自己声明 varying（引擎已注入 vUv）'],
  [/^\s*attribute\s+/m, '片段着色器里不能有 attribute'],
  [/\bgl_FragData\b/, '请用 gl_FragColor'],
  [/\bdiscard\b/, 'discard 会破坏全屏 pass 的语义，禁止使用']
];

// 只接受 float/vec 参数的内建函数（传整数字面量会编译失败）
const FLOAT_FUNCS = ['mix', 'smoothstep', 'step', 'clamp', 'pow', 'min', 'max', 'floor', 'ceil',
  'mod', 'fract', 'abs', 'sign', 'sqrt', 'inversesqrt', 'exp', 'log', 'exp2', 'log2',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'length', 'distance', 'dot', 'cross',
  'normalize', 'reflect', 'refract'];

const GLSL_KEYWORDS = new Set(['void', 'float', 'int', 'bool', 'vec2', 'vec3', 'vec4', 'ivec2', 'ivec3',
  'ivec4', 'bvec2', 'bvec3', 'bvec4', 'mat2', 'mat3', 'mat4', 'sampler2D', 'samplerCube',
  'if', 'else', 'for', 'while', 'do', 'break', 'continue', 'return', 'struct', 'const',
  'true', 'false', 'in', 'out', 'inout', 'lowp', 'mediump', 'highp', 'precision', 'uniform',
  'varying', 'attribute', 'main', 'discard']);

const GLSL_BUILTINS = new Set(['radians', 'degrees', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
  'pow', 'exp', 'log', 'exp2', 'log2', 'sqrt', 'inversesqrt', 'abs', 'sign', 'floor', 'ceil',
  'fract', 'mod', 'min', 'max', 'clamp', 'mix', 'step', 'smoothstep', 'length', 'distance',
  'dot', 'cross', 'normalize', 'faceforward', 'reflect', 'refract', 'matrixCompMult',
  'lessThan', 'lessThanEqual', 'greaterThan', 'greaterThanEqual', 'equal', 'notEqual',
  'any', 'all', 'not', 'texture2D', 'texture2DProj', 'textureCube',
  'gl_FragColor', 'gl_FragCoord', 'gl_PointCoord', 'gl_FrontFacing', 'gl_Position']);

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, '');
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

/** 找出源码里声明的所有标识符（局部变量、函数、结构体、参数） */
function collectDeclared(code) {
  const set = new Set();
  const typeRe = /\b(?:float|int|bool|vec2|vec3|vec4|ivec2|ivec3|ivec4|bvec2|bvec3|bvec4|mat2|mat3|mat4)\s+([A-Za-z_]\w*)/g;
  let m;
  while ((m = typeRe.exec(code))) set.add(m[1]);
  // 函数定义/声明： type name(
  const fnRe = /\b(?:void|float|int|bool|vec2|vec3|vec4|mat2|mat3|mat4|[A-Z]\w*)\s+([A-Za-z_]\w*)\s*\(/g;
  while ((m = fnRe.exec(code))) set.add(m[1]);
  // struct 名与成员
  const stRe = /\bstruct\s+([A-Za-z_]\w*)\s*\{([^}]*)\}/g;
  const structNames = [];
  while ((m = stRe.exec(code))) {
    set.add(m[1]);
    structNames.push(m[1]);
    const body = m[2];
    let mm;
    const memRe = /\b(?:float|int|bool|vec2|vec3|vec4|mat2|mat3|mat4)\s+([A-Za-z_]\w*)/g;
    while ((mm = memRe.exec(body))) set.add(mm[1]);
  }
  // 结构体类型的变量声明： Q q1 = ...
  for (const sn of structNames) {
    const varRe = new RegExp(`\\b${sn}\\s+([A-Za-z_]\\w*)`, 'g');
    while ((m = varRe.exec(code))) set.add(m[1]);
  }
  return set;
}

/** 括号配对检查 */
function checkBalance(code) {
  const stack = [];
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const closing = { ')': '(', '}': '{', ']': '[' };
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (pairs[c]) stack.push({ c, i });
    else if (closing[c]) {
      const top = stack.pop();
      if (!top || top.c !== closing[c]) return { ok: false, at: i, msg: `第 ${lineOf(code, i)} 行出现不匹配的 "${c}"` };
    }
  }
  if (stack.length) {
    const top = stack[stack.length - 1];
    return { ok: false, at: top.i, msg: `第 ${lineOf(code, top.i)} 行的 "${top.c}" 没有闭合` };
  }
  return { ok: true };
}

/** 取出某次函数调用的顶层参数字符串 */
function callArgs(code, openParenIdx) {
  let depth = 0;
  const args = [];
  let cur = '';
  for (let i = openParenIdx; i < code.length; i++) {
    const c = code[i];
    if (c === '(') { depth++; if (depth === 1) continue; }
    if (c === ')') { depth--; if (depth === 0) { args.push(cur); return { args, end: i }; } }
    if (c === ',' && depth === 1) { args.push(cur); cur = ''; continue; }
    cur += c;
  }
  return { args, end: code.length };
}

/* ------------------------------------------------------------------ */
/* 检查一个滤镜                                                        */
/* ------------------------------------------------------------------ */

function lintFilter(def) {
  const errors = [];
  const warnings = [];
  const paramKeys = new Set();

  // --- 元数据 ---
  if (!def.label || !/[\u4e00-\u9fa5]/.test(def.label)) warnings.push('label 建议带中文');
  if (!def.doc) warnings.push('缺少 doc 说明');
  if (!def.passes.length) errors.push('没有 passes');
  let hasMix = false;
  for (const p of def.params) {
    if (!p.key || !/^[a-z][a-z0-9]*$/i.test(p.key)) errors.push(`参数 key 不合法: ${JSON.stringify(p.key)}`);
    if (paramKeys.has(p.key)) errors.push(`参数 key 重复: ${p.key}`);
    paramKeys.add(p.key);
    if (p.key === 'mix') hasMix = true;
    if (!['float', 'enum', 'bool', 'color'].includes(p.type)) errors.push(`参数 ${p.key} 类型非法: ${p.type}`);
    if (p.type === 'float') {
      if (!(typeof p.min === 'number' && typeof p.max === 'number' && typeof p.step === 'number')) {
        errors.push(`参数 ${p.key} 缺少 min/max/step`);
      } else {
        if (p.min >= p.max) errors.push(`参数 ${p.key} 的 min >= max`);
        if (typeof p.def !== 'number' || p.def < p.min || p.def > p.max) errors.push(`参数 ${p.key} 默认值 ${p.def} 超出 [${p.min},${p.max}]`);
        if (p.step <= 0) errors.push(`参数 ${p.key} step 必须 > 0`);
      }
    }
    if (p.type === 'enum') {
      if (!Array.isArray(p.options) || !p.options.length) errors.push(`参数 ${p.key} 缺少 options`);
      else {
        const vs = p.options.map((o) => o.v);
        if (vs.some((v) => typeof v !== 'number')) errors.push(`参数 ${p.key} 的 options.v 必须是数字`);
        if (!vs.includes(p.def)) errors.push(`参数 ${p.key} 默认值 ${p.def} 不在 options 里`);
        if (p.options.some((o) => !o.label)) errors.push(`参数 ${p.key} 的 options 缺少 label`);
      }
    }
    if (p.type === 'color' && !/^#[0-9a-fA-F]{6}$/.test(String(p.def))) errors.push(`参数 ${p.key} 颜色默认值应为 #rrggbb`);
  }
  if (!hasMix) warnings.push('建议提供 mix 参数以便整体淡入淡出');

  // --- 每个 pass 的 GLSL ---
  def.passes.forEach((pass, pi) => {
    const tag = `pass${pi}`;
    const raw = String(pass.fs || '');
    if (!raw.trim()) { errors.push(`${tag}: 空的片段源码`); return; }
    const code = stripComments(raw);

    for (const [re, msg] of FORBIDDEN) {
      const m = re.exec(code);
      if (m) errors.push(`${tag}: ${msg}（第 ${lineOf(code, m.index)} 行）`);
    }

    const bal = checkBalance(code);
    if (!bal.ok) errors.push(`${tag}: ${bal.msg}`);

    if (!/\bvoid\s+main\s*\(\s*(void)?\s*\)/.test(code)) errors.push(`${tag}: 缺少 void main()`);
    const fragAssign = code.match(/gl_FragColor\s*=/g);
    if (!fragAssign) errors.push(`${tag}: 没有给 gl_FragColor 赋值`);
    else if (fragAssign.length > 1) warnings.push(`${tag}: gl_FragColor 被赋值 ${fragAssign.length} 次（建议只在末尾赋值一次）`);
    if (/gl_FragColor\s*=\s*vec4\([^;]*,\s*(0\.\d+|0)\s*\)\s*;/.test(code)) warnings.push(`${tag}: alpha 不是 1.0，画布不使用 alpha，可能不是本意`);

    // 公共辅助函数不得重定义
    for (const h of ShaderLib.HELPER_NAMES) {
      const re = new RegExp(`\\b(?:float|vec2|vec3|vec4|mat2|mat3|mat4|void)\\s+${h}\\s*\\(`);
      if (re.test(code)) errors.push(`${tag}: 重复定义了公共函数 ${h}()`);
    }

    // uniform 引用检查
    const declared = collectDeclared(code);
    const idRe = /\b([A-Za-z_]\w*)\b(?!\s*\()/g;
    let m;
    const seen = new Set();
    while ((m = idRe.exec(code))) {
      const id = m[1];
      // 跳过 swizzle / 结构体成员访问（前一个非空字符是 "."）
      let k = m.index - 1;
      while (k >= 0 && /\s/.test(code[k])) k--;
      if (k >= 0 && code[k] === '.') continue;
      if (seen.has(id)) continue;
      seen.add(id);
      if (GLSL_KEYWORDS.has(id) || GLSL_BUILTINS.has(id) || declared.has(id)) continue;
      if (ShaderLib.HELPER_NAMES.includes(id)) continue;
      if (ShaderLib.COMMON_UNIFORMS[id]) continue;
      if (id === 'vUv') continue;
      if (/^u_/.test(id)) {
        if (!paramKeys.has(id.slice(2))) {
          errors.push(`${tag}: 使用了未声明的参数 ${id}（params 里没有 key "${id.slice(2)}"）`);
        }
        continue;
      }
      if (/^u[A-Z]/.test(id)) {
        errors.push(`${tag}: 使用了不存在的公共 uniform ${id}`);
        continue;
      }
      // 其他未知标识符：可能是拼写错误的局部变量
      warnings.push(`${tag}: 未识别的标识符 "${id}"（第 ${lineOf(code, m.index)} 行），确认不是拼写错误`);
    }

    // 参数是否真的被用到
    for (const key of paramKeys) {
      if (def.passes.every((p2) => !new RegExp(`\\bu_${key}\\b`).test(String(p2.fs || '')))) {
        warnings.push(`参数 ${key} 从未在任何 pass 中使用`);
      }
    }

    // float 函数的整数字面量
    for (const fn of FLOAT_FUNCS) {
      const callRe = new RegExp(`\\b${fn}\\s*\\(`, 'g');
      let c;
      while ((c = callRe.exec(code))) {
        const open = code.indexOf('(', c.index);
        const { args } = callArgs(code, open);
        args.forEach((a) => {
          const t = a.trim();
          if (/^[-+]?\d+$/.test(t)) {
            errors.push(`${tag}: ${fn}() 的参数 "${t}" 是整数字面量，GLSL ES 1.00 会报类型错误，请写成 ${t}.0（第 ${lineOf(code, c.index)} 行）`);
          }
        });
      }
    }

    // uniform / 浮点量与裸整数比较
    const cmpRe = /\b(u_[A-Za-z]\w*|u[A-Z]\w*)\s*(<=|>=|<|>|==|!=)\s*([-+]?\d+)(?![.\dxXeE])/g;
    while ((m = cmpRe.exec(code))) {
      errors.push(`${tag}: "${m[1]} ${m[2]} ${m[3]}" 是 float 与 int 比较，请写成 ${m[3]}.0（第 ${lineOf(code, m.index)} 行）`);
    }
    const declFloatRe = /\b(?:float|vec2|vec3|vec4)\s+\w+\s*=\s*([-+]?\d+)\s*[;,]/g;
    while ((m = declFloatRe.exec(code))) {
      errors.push(`${tag}: 浮点变量用整数字面量 "${m[1]}" 初始化，请写成 ${m[1]}.0（第 ${lineOf(code, m.index)} 行）`);
    }

    // 循环边界必须是常量
    const forRe = /for\s*\(([^)]*)\)/g;
    while ((m = forRe.exec(code))) {
      const head = m[1];
      const cond = head.split(';')[1] || '';
      if (/u_|u[A-Z]/.test(cond)) {
        errors.push(`${tag}: for 循环条件里出现 uniform（"${cond.trim()}"），GLSL ES 1.00 要求常量边界，请改成常量上限 + if 守卫（第 ${lineOf(code, m.index)} 行）`);
      }
    }

    // uPalette 只能用循环变量索引
    const palRe = /uPalette\s*\[([^\]]+)\]/g;
    while ((m = palRe.exec(code))) {
      const idx = m[1].trim();
      if (!/^[a-zA-Z_]\w*$/.test(idx) && !/^\d+$/.test(idx)) {
        errors.push(`${tag}: uPalette 只能用循环变量或常量索引，当前是 "${idx}"（第 ${lineOf(code, m.index)} 行）`);
      }
    }

    // pass 选项
    if (pass.scale != null && !(pass.scale > 0 && pass.scale <= 1)) errors.push(`${tag}: scale 必须在 (0,1]`);
    if (pass.filter != null && !['nearest', 'linear'].includes(pass.filter)) errors.push(`${tag}: filter 只能是 nearest/linear`);
  });

  return { errors, warnings: [...new Set(warnings)] };
}

/* ------------------------------------------------------------------ */

const results = [];
for (const def of D.filters) {
  const r = lintFilter(def);
  results.push({ id: def.id, category: def.category, params: def.params.length, passes: def.passes.length, ...r });
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
} else {
  let ne = 0, nw = 0;
  console.log(`检查 ${results.length} 个滤镜（来自 ${files.join(', ')}）\n`);
  for (const r of results) {
    const status = r.errors.length ? '✗' : (r.warnings.length ? '!' : '✓');
    console.log(`${status} ${r.id.padEnd(14)} [${r.category}] ${r.params} 参数 / ${r.passes} pass`);
    r.errors.forEach((e) => { console.log('    ✗ ' + e); ne++; });
    r.warnings.forEach((w) => { console.log('    · ' + w); nw++; });
  }
  console.log(`\n合计：${results.length} 个滤镜，${ne} 个错误，${nw} 条提醒`);
  process.exit(ne ? 1 : 0);
}
