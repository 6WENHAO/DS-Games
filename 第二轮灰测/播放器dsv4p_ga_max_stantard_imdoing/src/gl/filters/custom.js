// custom.js — 用户自定义 GLSL 滤镜（在界面里直接改代码，即时编译）
// 这是「可配置滤镜」的最终形态：内置滤镜不够用时，直接写 shader。
(function (D) {
  'use strict';

  var DEFAULT_CODE = [
    '// 可用变量（无需声明）：',
    '//   vUv 0..1 | uTex 本级输入 | uSrc 原始帧 | uStageIn 本滤镜输入',
    '//   uSize/uTexel/uSrcSize | uTime 秒 | uFrame 帧号 | uRandom | uGrid 像素网格',
    '//   uBayer/uNoise/uGlyph | uPalette[32]/uPaletteCount',
    '// 可用函数：luma sat sat3 bayer8 noise4 hash11 hash12 rgb2hsv hsv2rgb palettize rot2 softLight',
    '// 参数滑块：u_p1 u_p2 u_p3 u_p4，颜色：u_c1 u_c2，混合：u_mix',
    '',
    'void main(){',
    '  vec2 px = vUv * uSize;',
    '  // 波纹扫描 + 色差偏移示例',
    '  float wave = sin(px.y * 0.08 + uTime * 3.0) * u_p1 * 8.0;',
    '  vec2 off = vec2(wave * uTexel.x, 0.0);',
    '  vec3 c;',
    '  c.r = texture2D(uTex, clamp(vUv + off * (1.0 + u_p2), vec2(0.0), vec2(1.0))).r;',
    '  c.g = texture2D(uTex, clamp(vUv + off, vec2(0.0), vec2(1.0))).g;',
    '  c.b = texture2D(uTex, clamp(vUv - off * (1.0 + u_p2), vec2(0.0), vec2(1.0))).b;',
    '  // 扫描亮带',
    '  float band = smoothstep(0.0, 1.0, sin((vUv.y + uTime * 0.15) * 6.2831 * max(u_p3, 0.01)) * 0.5 + 0.5);',
    '  c = mix(c, mix(c, u_c1, 0.55), band * u_p4);',
    '  vec3 src = texture2D(uTex, vUv).rgb;',
    '  gl_FragColor = vec4(mix(src, c, u_mix), 1.0);',
    '}'
  ].join('\n');

  D.registerFilter({
    id: 'custom',
    label: '自定义着色器 Custom GLSL',
    category: 'custom',
    doc: '在面板里直接编写 GLSL（ES 1.00）并即时编译，编译错误会显示带行号的报错。',
    dynamic: true,          // 片段源码取自实例的 code 字段
    defaultCode: DEFAULT_CODE,
    params: [
      { key: 'p1', label: '参数 1', type: 'float', min: 0, max: 2, step: 0.01, def: 0.5 },
      { key: 'p2', label: '参数 2', type: 'float', min: 0, max: 2, step: 0.01, def: 0.4 },
      { key: 'p3', label: '参数 3', type: 'float', min: 0, max: 8, step: 0.05, def: 2 },
      { key: 'p4', label: '参数 4', type: 'float', min: 0, max: 1, step: 0.01, def: 0.35 },
      { key: 'c1', label: '颜色 1', type: 'color', def: '#5cc8ff' },
      { key: 'c2', label: '颜色 2', type: 'color', def: '#ff77a8' },
      { key: 'mix', label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [{ fs: DEFAULT_CODE }]
  });
})(window.DSV4P);
