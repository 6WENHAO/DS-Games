// pixel.js — 像素风滤镜包（像素化 / 调色板量化 / 抖动 / ASCII / 像素描边）
// 这是「把视频变成像素风」的核心：pixelate 负责建立像素网格并把 uGrid 传给下游，
// palette / posterize / dither1bit 会自动按同一网格对齐抖动图案，避免出现「亚像素噪点」。
(function (D) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 1. 像素化
   * ------------------------------------------------------------------ */
  D.registerFilter({
    id: 'pixelate',
    label: '像素化 Pixelate',
    category: 'pixel',
    doc: '把画面重采样成方块/圆点/菱形网格；下游滤镜会自动沿用这个网格尺寸。',
    gridParam: 'cell',
    params: [
      { key: 'cell', label: '像素块', type: 'float', min: 1, max: 96, step: 1, def: 8, unit: 'px' },
      { key: 'aspect', label: '纵横比', type: 'float', min: 0.25, max: 4, step: 0.05, def: 1 },
      { key: 'shape', label: '形状', type: 'enum', def: 0, options: [{ v: 0, label: '方块' }, { v: 1, label: '圆点' }, { v: 2, label: '菱形' }] },
      { key: 'sample', label: '取样', type: 'enum', def: 1, options: [{ v: 0, label: '中心点（硬）' }, { v: 1, label: '区块平均（干净）' }] },
      { key: 'gap', label: '网格缝隙', type: 'float', min: 0, max: 0.6, step: 0.01, def: 0 },
      { key: 'bg', label: '缝隙颜色', type: 'color', def: '#000000' },
      { key: 'mix', label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [{
      filter: 'nearest',
      fs: [
        'void main(){',
        '  vec3 src = texture2D(uTex, vUv).rgb;',
        '  float cw = max(u_cell, 1.0);',
        '  float ch = max(u_cell * u_aspect, 1.0);',
        '  vec2 cellsz = vec2(cw, ch);',
        '  vec2 px = vUv * uSize;',
        '  vec2 cellMin = floor(px / cellsz) * cellsz;',
        '  vec2 local = (px - cellMin) / cellsz;',
        '  vec3 c;',
        '  if (u_sample > 0.5) {',
        '    vec3 acc = vec3(0.0);',
        '    for (int y = 0; y < 4; y++) {',
        '      for (int x = 0; x < 4; x++) {',
        '        vec2 o = (vec2(float(x), float(y)) + 0.5) / 4.0;',
        '        vec2 uv = (cellMin + o * cellsz) / uSize;',
        '        acc += texture2D(uTex, clamp(uv, vec2(0.0), vec2(1.0))).rgb;',
        '      }',
        '    }',
        '    c = acc / 16.0;',
        '  } else {',
        '    vec2 uvc = (cellMin + cellsz * 0.5) / uSize;',
        '    c = texture2D(uTex, clamp(uvc, vec2(0.0), vec2(1.0))).rgb;',
        '  }',
        '  float mask = 1.0;',
        '  vec2 d = local - 0.5;',
        '  if (u_shape > 1.5) {',
        '    mask = 1.0 - step(0.5, abs(d.x) + abs(d.y));',
        '  } else if (u_shape > 0.5) {',
        '    mask = 1.0 - step(0.5, length(d));',
        '  }',
        '  float gap = clamp(u_gap, 0.0, 0.9) * 0.5;',
        '  if (gap > 0.0) {',
        '    vec2 g = step(vec2(gap), local) * step(vec2(gap), 1.0 - local);',
        '    mask *= g.x * g.y;',
        '  }',
        '  vec3 outc = mix(u_bg, c, mask);',
        '  gl_FragColor = vec4(mix(src, outc, u_mix), 1.0);',
        '}'
      ].join('\n')
    }]
  });

  /* ------------------------------------------------------------------ *
   * 2. 调色板量化（复古机型配色 + 抖动）
   * ------------------------------------------------------------------ */
  D.registerFilter({
    id: 'palette',
    label: '调色板量化 Palette',
    category: 'pixel',
    doc: '把颜色映射到 Game Boy / PICO-8 / C64 等调色板，可选有序抖动，抖动图案自动对齐像素网格。',
    usesPalette: true,
    params: [
      { key: 'dither', label: '抖动', type: 'enum', def: 1, options: [{ v: 0, label: '关' }, { v: 1, label: 'Bayer 8×8' }, { v: 2, label: '棋盘' }, { v: 3, label: '随机噪点' }] },
      { key: 'amount', label: '抖动强度', type: 'float', min: 0, max: 1.5, step: 0.01, def: 0.5 },
      { key: 'scale', label: '图案尺寸', type: 'float', min: 0, max: 32, step: 1, def: 0, unit: '0=跟随网格' },
      { key: 'gamma', label: '匹配 Gamma', type: 'float', min: 0.4, max: 2.4, step: 0.05, def: 1 },
      { key: 'mix', label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [{
      filter: 'nearest',
      fs: [
        'void main(){',
        '  vec3 src = texture2D(uTex, vUv).rgb;',
        '  vec2 px = vUv * uSize;',
        '  float scale = u_scale <= 0.0 ? max(uGrid, 1.0) : max(u_scale, 1.0);',
        '  vec2 cellpx = floor(px / scale);',
        '  float thr = 0.5;',
        '  if (u_dither > 2.5) {',
        '    thr = hash12(cellpx + vec2(13.37, 7.77));',
        '  } else if (u_dither > 1.5) {',
        '    thr = mod(cellpx.x + cellpx.y, 2.0) * 0.5 + 0.25;',
        '  } else if (u_dither > 0.5) {',
        '    thr = bayer8(px / scale);',
        '  }',
        '  float g = max(u_gamma, 0.05);',
        '  vec3 lin = pow(max(src, vec3(0.0)), vec3(g));',
        '  if (u_dither > 0.5) lin = sat3(lin + (thr - 0.5) * u_amount);',
        '  vec3 q = palettize(lin);',
        '  q = pow(max(q, vec3(0.0)), vec3(1.0 / g));',
        '  gl_FragColor = vec4(mix(src, q, u_mix), 1.0);',
        '}'
      ].join('\n')
    }]
  });

  /* ------------------------------------------------------------------ *
   * 3. 色阶压缩（Posterize / 位深裁剪）
   * ------------------------------------------------------------------ */
  D.registerFilter({
    id: 'posterize',
    label: '色阶压缩 Posterize',
    category: 'pixel',
    doc: '按通道压缩色阶（等价于降低位深），可配抖动来抵消色带。',
    params: [
      { key: 'levels', label: '每通道色阶', type: 'float', min: 2, max: 32, step: 1, def: 5 },
      { key: 'dither', label: '抖动', type: 'enum', def: 1, options: [{ v: 0, label: '关' }, { v: 1, label: 'Bayer 8×8' }, { v: 2, label: '噪点' }] },
      { key: 'amount', label: '抖动强度', type: 'float', min: 0, max: 1.5, step: 0.01, def: 0.6 },
      { key: 'scale', label: '图案尺寸', type: 'float', min: 0, max: 32, step: 1, def: 0, unit: '0=跟随网格' },
      { key: 'gamma', label: 'Gamma', type: 'float', min: 0.4, max: 2.4, step: 0.05, def: 1 },
      { key: 'mix', label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [{
      filter: 'nearest',
      fs: [
        'void main(){',
        '  vec3 src = texture2D(uTex, vUv).rgb;',
        '  vec2 px = vUv * uSize;',
        '  float scale = u_scale <= 0.0 ? max(uGrid, 1.0) : max(u_scale, 1.0);',
        '  float lv = max(2.0, floor(u_levels));',
        '  float thr = 0.5;',
        '  if (u_dither > 1.5) thr = hash12(floor(px / scale) + vec2(3.1, 9.4));',
        '  else if (u_dither > 0.5) thr = bayer8(px / scale);',
        '  float g = max(u_gamma, 0.05);',
        '  vec3 c = pow(max(src, vec3(0.0)), vec3(g));',
        '  if (u_dither > 0.5) c += (thr - 0.5) * (u_amount / (lv - 1.0));',
        '  c = floor(sat3(c) * (lv - 1.0) + 0.5) / (lv - 1.0);',
        '  c = pow(max(c, vec3(0.0)), vec3(1.0 / g));',
        '  gl_FragColor = vec4(mix(src, c, u_mix), 1.0);',
        '}'
      ].join('\n')
    }]
  });

  /* ------------------------------------------------------------------ *
   * 4. 单色抖动（1-bit）
   * ------------------------------------------------------------------ */
  D.registerFilter({
    id: 'dither1bit',
    label: '单色抖动 1-bit',
    category: 'pixel',
    doc: '只保留两种颜色，用有序/随机/线条图案表现灰阶，典型「Mac Plus / 电子墨水」质感。',
    params: [
      { key: 'pattern', label: '图案', type: 'enum', def: 0, options: [{ v: 0, label: 'Bayer 8×8' }, { v: 1, label: '随机噪点' }, { v: 2, label: '横线' }, { v: 3, label: '斜线' }, { v: 4, label: '棋盘' }] },
      { key: 'scale', label: '图案尺寸', type: 'float', min: 0, max: 32, step: 1, def: 0, unit: '0=跟随网格' },
      { key: 'bias', label: '明暗偏移', type: 'float', min: -0.5, max: 0.5, step: 0.01, def: 0 },
      { key: 'contrast', label: '对比度', type: 'float', min: 0.2, max: 4, step: 0.05, def: 1.15 },
      { key: 'dark', label: '暗色', type: 'color', def: '#12131a' },
      { key: 'light', label: '亮色', type: 'color', def: '#eef2f7' },
      { key: 'mix', label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [{
      filter: 'nearest',
      fs: [
        'void main(){',
        '  vec3 src = texture2D(uTex, vUv).rgb;',
        '  vec2 px = vUv * uSize;',
        '  float scale = u_scale <= 0.0 ? max(uGrid, 1.0) : max(u_scale, 1.0);',
        '  vec2 cp = floor(px / scale);',
        '  float thr = 0.5;',
        '  if (u_pattern < 0.5) {',
        '    thr = bayer8(px / scale);',
        '  } else if (u_pattern < 1.5) {',
        '    thr = hash12(cp + vec2(5.2, 1.3));',
        '  } else if (u_pattern < 2.5) {',
        '    thr = 0.5 + 0.42 * sin(cp.y * 3.14159);',
        '  } else if (u_pattern < 3.5) {',
        '    thr = fract((cp.x + cp.y) / 4.0) * 0.85 + 0.08;',
        '  } else {',
        '    thr = mod(cp.x + cp.y, 2.0) * 0.6 + 0.2;',
        '  }',
        '  float l = luma(src);',
        '  l = sat((l - 0.5) * u_contrast + 0.5 + u_bias);',
        '  float v = step(thr, l);',
        '  vec3 outc = mix(u_dark, u_light, v);',
        '  gl_FragColor = vec4(mix(src, outc, u_mix), 1.0);',
        '}'
      ].join('\n')
    }]
  });

  /* ------------------------------------------------------------------ *
   * 5. ASCII / 字符画
   * ------------------------------------------------------------------ */
  D.registerFilter({
    id: 'ascii',
    label: '字符画 ASCII',
    category: 'pixel',
    doc: '按单元平均亮度挑选字形（字符集可在右侧「资源」里切换），支持保留原色。',
    usesGlyph: true,
    params: [
      { key: 'cell', label: '字符格', type: 'float', min: 4, max: 48, step: 1, def: 12, unit: 'px' },
      { key: 'contrast', label: '对比度', type: 'float', min: 0.3, max: 3, step: 0.05, def: 1.25 },
      { key: 'color', label: '取色', type: 'enum', def: 0, options: [{ v: 0, label: '单色墨水' }, { v: 1, label: '保留原色' }, { v: 2, label: '原色描边' }] },
      { key: 'invert', label: '反相', type: 'bool', def: false },
      { key: 'ink', label: '墨色', type: 'color', def: '#8affc1' },
      { key: 'bg', label: '底色', type: 'color', def: '#080a10' },
      { key: 'mix', label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [{
      filter: 'nearest',
      fs: [
        'void main(){',
        '  vec3 src = texture2D(uTex, vUv).rgb;',
        '  float cell = max(u_cell, 3.0);',
        '  vec2 px = vUv * uSize;',
        '  vec2 cellMin = floor(px / cell) * cell;',
        '  vec2 local = (px - cellMin) / cell;',
        '  vec3 acc = vec3(0.0);',
        '  for (int y = 0; y < 3; y++) {',
        '    for (int x = 0; x < 3; x++) {',
        '      vec2 o = (vec2(float(x), float(y)) + 0.5) / 3.0;',
        '      vec2 uv = (cellMin + o * cell) / uSize;',
        '      acc += texture2D(uTex, clamp(uv, vec2(0.0), vec2(1.0))).rgb;',
        '    }',
        '  }',
        '  vec3 avg = acc / 9.0;',
        '  float l = sat((luma(avg) - 0.5) * u_contrast + 0.5);',
        '  if (u_invert > 0.5) l = 1.0 - l;',
        '  float gi = floor(l * (uGlyphCount - 0.001));',
        '  vec2 guv = vec2((gi + clamp(local.x, 0.01, 0.99)) / uGlyphCount, clamp(local.y, 0.01, 0.99));',
        '  float ink = texture2D(uGlyph, guv).r;',
        '  vec3 fg = u_ink;',
        '  vec3 bg = u_bg;',
        '  if (u_color > 1.5) { fg = u_ink; bg = avg * 0.35; }',
        '  else if (u_color > 0.5) { fg = avg; }',
        '  vec3 outc = mix(bg, fg, ink);',
        '  gl_FragColor = vec4(mix(src, outc, u_mix), 1.0);',
        '}'
      ].join('\n')
    }]
  });

  /* ------------------------------------------------------------------ *
   * 6. 像素描边（沿像素网格勾线，像素风的灵魂）
   * ------------------------------------------------------------------ */
  D.registerFilter({
    id: 'pixeloutline',
    label: '像素描边 Pixel Outline',
    category: 'pixel',
    doc: '在像素网格上做色差检测并勾一格粗的轮廓线，配合像素化使用效果最好。',
    params: [
      { key: 'cell', label: '网格', type: 'float', min: 0, max: 48, step: 1, def: 0, unit: '0=跟随网格' },
      { key: 'threshold', label: '阈值', type: 'float', min: 0.01, max: 1, step: 0.01, def: 0.18 },
      { key: 'mode', label: '模式', type: 'enum', def: 0, options: [{ v: 0, label: '描边叠加' }, { v: 1, label: '仅线条' }, { v: 2, label: '内暗外亮' }] },
      { key: 'line', label: '线色', type: 'color', def: '#0a0a12' },
      { key: 'mix', label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [{
      filter: 'nearest',
      fs: [
        'vec3 cellColor(vec2 px, float cell){',
        '  vec2 uv = (floor(px / cell) * cell + cell * 0.5) / uSize;',
        '  return texture2D(uTex, clamp(uv, vec2(0.0), vec2(1.0))).rgb;',
        '}',
        'void main(){',
        '  vec3 src = texture2D(uTex, vUv).rgb;',
        '  float cell = u_cell <= 0.0 ? max(uGrid, 1.0) : max(u_cell, 1.0);',
        '  vec2 px = vUv * uSize;',
        '  vec3 c0 = cellColor(px, cell);',
        '  float diff = 0.0;',
        '  float bright = 0.0;',
        '  for (int i = 0; i < 4; i++) {',
        '    vec2 o = vec2(0.0);',
        '    if (i == 0) o = vec2(1.0, 0.0);',
        '    else if (i == 1) o = vec2(-1.0, 0.0);',
        '    else if (i == 2) o = vec2(0.0, 1.0);',
        '    else o = vec2(0.0, -1.0);',
        '    vec3 cn = cellColor(px + o * cell, cell);',
        '    vec3 dd = cn - c0;',
        '    diff = max(diff, sqrt(dot(dd, dd)) * 0.577);',
        '    bright += luma(cn) - luma(c0);',
        '  }',
        '  float edge = step(u_threshold, diff);',
        '  vec3 outc = c0;',
        '  if (u_mode > 1.5) {',
        '    vec3 tone = bright > 0.0 ? min(c0 * 1.45 + 0.06, vec3(1.0)) : u_line;',
        '    outc = mix(c0, tone, edge);',
        '  } else if (u_mode > 0.5) {',
        '    outc = mix(vec3(1.0), u_line, edge);',
        '  } else {',
        '    outc = mix(c0, u_line, edge);',
        '  }',
        '  gl_FragColor = vec4(mix(src, outc, u_mix), 1.0);',
        '}'
      ].join('\n')
    }]
  });

})(window.DSV4P);
