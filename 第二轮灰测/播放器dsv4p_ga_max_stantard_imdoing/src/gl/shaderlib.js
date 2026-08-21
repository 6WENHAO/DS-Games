/*!
 * src/gl/shaderlib.js — 着色器组装：统一头部（uniform + 公共函数）+ 滤镜片段
 *
 * 滤镜作者只写 main()（以及自己的局部函数），所有 uniform 由引擎自动生成：
 *   · 公共 uniform（uTex/uSize/uTime/...）在 HEADER 里
 *   · 参数 uniform 由 params 自动推导为 u_<key>（float/vec3）
 * 好处：参数名不可能与 GLSL 声明不一致，也无法漏声明。
 *
 * 本文件同时被 tools/lint-shaders.js 在 Node 下 require，用于离线静态检查。
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var S = {};

  /** 共用顶点着色器：全屏三角形对，vUv 为 0..1（y 向上） */
  S.VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main(){',
    '  vUv = aPos * 0.5 + 0.5;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  /** 引擎提供的公共 uniform（名字 -> GLSL 类型） */
  S.COMMON_UNIFORMS = {
    uTex: 'sampler2D', uStageIn: 'sampler2D', uSrc: 'sampler2D',
    uBayer: 'sampler2D', uNoise: 'sampler2D', uGlyph: 'sampler2D',
    uSize: 'vec2', uTexel: 'vec2', uSrcSize: 'vec2',
    uTime: 'float', uFrame: 'float', uRandom: 'float', uGrid: 'float',
    uGlyphCount: 'float', uPaletteCount: 'float', uPalette: 'vec3[32]'
  };

  S.HEADER = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTex;',
    'uniform sampler2D uStageIn;',
    'uniform sampler2D uSrc;',
    'uniform sampler2D uBayer;',
    'uniform sampler2D uNoise;',
    'uniform sampler2D uGlyph;',
    'uniform vec2  uSize;',
    'uniform vec2  uTexel;',
    'uniform vec2  uSrcSize;',
    'uniform float uTime;',
    'uniform float uFrame;',
    'uniform float uRandom;',
    'uniform float uGrid;',
    'uniform float uGlyphCount;',
    'uniform float uPaletteCount;',
    'uniform vec3  uPalette[32];'
  ].join('\n');

  /** 公共辅助函数（滤镜不得重复定义） */
  S.HELPERS = [
    'float sat(float x){ return clamp(x, 0.0, 1.0); }',
    'vec3 sat3(vec3 c){ return clamp(c, 0.0, 1.0); }',
    'float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }',
    'float bayer8(vec2 px){ return texture2D(uBayer, (floor(px) + 0.5) / 8.0).r; }',
    'vec4 noise4(vec2 px){ return texture2D(uNoise, (floor(px) + 0.5) / 64.0); }',
    'float hash12(vec2 p){',
    '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    'float hash11(float x){',
    '  float p = fract(x * 0.1031);',
    '  p *= p + 33.33;',
    '  p *= p + p;',
    '  return fract(p);',
    '}',
    'vec3 rgb2hsv(vec3 c){',
    '  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);',
    '  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));',
    '  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));',
    '  float d = q.x - min(q.w, q.y);',
    '  float e = 1.0e-10;',
    '  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);',
    '}',
    'vec3 hsv2rgb(vec3 c){',
    '  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);',
    '  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);',
    '  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);',
    '}',
    'vec3 palettize(vec3 c){',
    '  vec3 best = uPalette[0];',
    '  float bd = 1.0e9;',
    '  for (int i = 0; i < 32; i++) {',
    '    if (float(i) < uPaletteCount) {',
    '      vec3 p = uPalette[i];',
    '      vec3 d = c - p;',
    '      float dd = dot(d * vec3(1.05, 1.25, 0.85), d);',
    '      if (dd < bd) { bd = dd; best = p; }',
    '    }',
    '  }',
    '  return best;',
    '}',
    'mat2 rot2(float a){ float s = sin(a); float c = cos(a); return mat2(c, -s, s, c); }',
    'vec3 softLight(vec3 a, vec3 b){',
    '  vec3 lo = 2.0 * a * b + a * a * (1.0 - 2.0 * b);',
    '  vec3 hi = sqrt(max(a, vec3(0.0))) * (2.0 * b - 1.0) + 2.0 * a * (1.0 - b);',
    '  return mix(lo, hi, step(vec3(0.5), b));',
    '}'
  ].join('\n');

  /** 公共辅助函数名（lint 用） */
  S.HELPER_NAMES = ['sat', 'sat3', 'luma', 'bayer8', 'noise4', 'hash12', 'hash11',
    'rgb2hsv', 'hsv2rgb', 'palettize', 'rot2', 'softLight'];

  /** 参数 -> uniform 声明 */
  S.paramUniforms = function (params) {
    var out = [];
    for (var i = 0; i < (params || []).length; i++) {
      var p = params[i];
      out.push('uniform ' + (p.type === 'color' ? 'vec3 ' : 'float') + ' u_' + p.key + ';');
    }
    return out.join('\n');
  };

  /**
   * 组装某个 pass 的完整片段着色器
   * @param {object} def 滤镜定义
   * @param {number} passIndex
   */
  S.buildFragment = function (def, passIndex) {
    var pass = def.passes[passIndex];
    return S.prefix(def) + '\n' + pass.fs;
  };

  /** 自动注入的前缀（不含滤镜源码） */
  S.prefix = function (def) {
    return [
      '// ==== dsv4p filter: ' + def.id + ' ====',
      S.HEADER,
      S.paramUniforms(def.params),
      S.HELPERS,
      '// ---- filter source ----'
    ].join('\n');
  };

  /** 头部占用的行数（用于把编译错误行号映射回滤镜源码） */
  S.headerLineCount = function (def) {
    return S.prefix(def).split('\n').length;
  };

  D.ShaderLib = S;
  if (typeof module !== 'undefined' && module.exports) module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
