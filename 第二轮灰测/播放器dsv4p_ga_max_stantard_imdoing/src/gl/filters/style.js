// style.js — 风格化滤镜（写实/绘画/印刷/网格类）
(function (D) {
  'use strict';

  D.registerFilter({
    id: 'halftone',
    label: '半调网点 Halftone',
    category: 'print',
    doc: '模拟印刷网点，可调网点大小与角度。',
    params: [
      { key: 'cell',  label: '网点间距', type: 'float', min: 2, max: 40, step: 0.5, def: 8, unit: 'px' },
      { key: 'angle', label: '网屏角度', type: 'float', min: 0, max: 180, step: 1, def: 45, unit: '°' },
      { key: 'mode',  label: '模式', type: 'enum', def: 0, options: [ { v: 0, label: '单色' }, { v: 1, label: '彩色 CMY' } ] },
      { key: 'ink',   label: '墨色', type: 'color', def: '#101014' },
      { key: 'mix',   label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
  float dotCov(vec2 p, float ang, float ch) {
    float cell = max(u_cell, 1.0);
    vec2 r = rot2(radians(ang)) * p;
    vec2 f = fract(r / cell) - 0.5;
    float d = length(f);
    float radius = 0.5 * sqrt(max(1.0 - ch, 0.0));
    float soft = 0.07;
    float cov = 1.0 - smoothstep(max(radius - soft, 0.0), radius + soft, d);
    return cov * smoothstep(0.0, 0.12, radius);
  }

  void main() {
    vec3 c = texture2D(uTex, vUv).rgb;
    vec2 px = vUv * uSize;

    float covMono = dotCov(px, u_angle, luma(c));
    vec3 mono3 = mix(vec3(1.0), u_ink, covMono);

    float cy = dotCov(px, u_angle, c.r);
    float mg = dotCov(px, u_angle + 15.0, c.g);
    float yw = dotCov(px, u_angle + 30.0, c.b);
    vec3 cmy3 = sat3(vec3(1.0 - cy, 1.0 - mg, 1.0 - yw));

    vec3 out3 = mix(mono3, cmy3, u_mode);
    gl_FragColor = vec4(mix(c, out3, u_mix), 1.0);
  }
` } ]
  });

  D.registerFilter({
    id: 'lcdgrid',
    label: 'LCD像素格 LCD Grid',
    category: 'grid',
    doc: '叠加液晶RGB子像素条纹与扫描线网格。',
    params: [
      { key: 'cell',     label: '格子大小', type: 'float', min: 2, max: 40, step: 0.5, def: 8, unit: 'px' },
      { key: 'contrast', label: '条纹对比', type: 'float', min: 0, max: 1, step: 0.01, def: 0.7 },
      { key: 'gap',      label: '间隙暗度', type: 'float', min: 0, max: 1, step: 0.01, def: 0.6 },
      { key: 'scan',     label: '扫描线', type: 'float', min: 0, max: 1, step: 0.01, def: 0.25 },
      { key: 'mix',      label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
  void main() {
    vec3 c = texture2D(uTex, vUv).rgb;
    vec2 px = vUv * uSize;
    float cell = max(u_cell, 1.0);
    vec2 f = fract(px / cell);

    float w = 1.0 / 3.0;
    float soft = 0.5 / cell;
    vec3 mask;
    mask.r = 1.0 - smoothstep(w - soft, w + soft, f.x);
    mask.g = smoothstep(w - soft, w + soft, f.x) * (1.0 - smoothstep(2.0 * w - soft, 2.0 * w + soft, f.x));
    mask.b = smoothstep(2.0 * w - soft, 2.0 * w + soft, f.x);

    vec3 out3 = c * mix(vec3(1.0), mask, u_contrast);

    float gw = 1.0 / cell;
    float gx = smoothstep(0.0, gw, f.x) * (1.0 - smoothstep(1.0 - gw, 1.0, f.x));
    float gy = smoothstep(0.0, gw, f.y) * (1.0 - smoothstep(1.0 - gw, 1.0, f.y));
    float gridMask = gx * gy;
    out3 *= mix(vec3(1.0), vec3(gridMask), u_gap);

    float scan = 1.0 - u_scan * (1.0 - gy);
    out3 *= scan;

    gl_FragColor = vec4(mix(c, out3, u_mix), 1.0);
  }
` } ]
  });

  D.registerFilter({
    id: 'hexmosaic',
    label: '六边形马赛克 Hex Mosaic',
    category: 'grid',
    doc: '六边形晶格马赛克，用最近中心算法采样。',
    params: [
      { key: 'cell',  label: '格子大小', type: 'float', min: 2, max: 40, step: 0.5, def: 12, unit: 'px' },
      { key: 'gap',   label: '间隙', type: 'float', min: 0, max: 1, step: 0.01, def: 0.12 },
      { key: 'round', label: '圆形色块', type: 'bool', def: false },
      { key: 'mix',   label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
  float rnd(float x) { return floor(x + 0.5); }

  void main() {
    vec3 c = texture2D(uTex, vUv).rgb;
    vec2 px = vUv * uSize;
    float s = max(u_cell, 2.0) * 0.5;

    float q = (0.5773502692 * px.x - 0.3333333333 * px.y) / s;
    float r = (0.6666666667 * px.y) / s;
    float h = -q - r;

    float rq = rnd(q);
    float rr = rnd(r);
    float rh = rnd(h);
    float dq = rq - q;
    float dr = rr - r;
    float dh = rh - h;
    if (dq > dr && dq > dh) { rq = -rr - rh; }
    else if (dr > dh) { rr = -rq - rh; }
    else { rh = -rq - rr; }

    vec2 center = vec2(s * (1.7320508076 * rq + 0.8660254038 * rr), s * (1.5 * rr));
    vec3 col = texture2D(uTex, center / uSize).rgb;

    float bq = q - rq;
    float br = r - rr;
    float bh = h - rh;
    float hexd = (abs(bq) + abs(br) + abs(bh)) * 0.5;

    float gw = clamp(u_gap, 0.001, 0.8);
    float shape;
    if (u_round > 0.5) {
      float dpx = length(px - center) / (s * 0.8660254038);
      shape = 1.0 - smoothstep(1.0 - gw, 1.0 + gw, dpx);
    } else {
      shape = 1.0 - smoothstep(0.5 - gw * 0.5, 0.5 + gw * 0.5, hexd);
    }

    vec3 gapCol = col * 0.18;
    vec3 out3 = mix(gapCol, col, shape);

    gl_FragColor = vec4(mix(c, out3, u_mix), 1.0);
  }
` } ]
  });

  D.registerFilter({
    id: 'edgeink',
    label: '墨水描边 Edge Ink',
    category: 'ink',
    doc: 'Sobel边缘检测转为墨水描边线条。',
    params: [
      { key: 'strength',  label: '强度', type: 'float', min: 0, max: 1, step: 0.01, def: 1 },
      { key: 'threshold', label: '阈值', type: 'float', min: 0, max: 1, step: 0.01, def: 0.35 },
      { key: 'thickness', label: '描边粗细', type: 'float', min: 0, max: 1, step: 0.01, def: 0.3 },
      { key: 'mode',      label: '模式', type: 'enum', def: 0, options: [ { v: 0, label: '墨线叠加' }, { v: 1, label: '白纸墨线' }, { v: 2, label: '黑底白线' } ] },
      { key: 'line',      label: '线条颜色', type: 'color', def: '#101018' },
      { key: 'mix',       label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
  float sobel(vec2 uv) {
    vec2 t = uTexel;
    float tl = luma(texture2D(uTex, uv + vec2(-t.x,  t.y)).rgb);
    float tc = luma(texture2D(uTex, uv + vec2( 0.0,  t.y)).rgb);
    float tr = luma(texture2D(uTex, uv + vec2( t.x,  t.y)).rgb);
    float ml = luma(texture2D(uTex, uv + vec2(-t.x,  0.0)).rgb);
    float mr = luma(texture2D(uTex, uv + vec2( t.x,  0.0)).rgb);
    float bl = luma(texture2D(uTex, uv + vec2(-t.x, -t.y)).rgb);
    float bc = luma(texture2D(uTex, uv + vec2( 0.0, -t.y)).rgb);
    float br = luma(texture2D(uTex, uv + vec2( t.x, -t.y)).rgb);
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
    return clamp(sqrt(gx * gx + gy * gy), 0.0, 1.0);
  }

  void main() {
    vec3 c = texture2D(uTex, vUv).rgb;
    float e = sobel(vUv);
    for (int i = 0; i < 4; i++) {
      if (float(i) < u_thickness * 4.0) {
        float off = float(i + 1);
        e = max(e, sobel(vUv + vec2(off * uTexel.x, 0.0)));
        e = max(e, sobel(vUv - vec2(off * uTexel.x, 0.0)));
        e = max(e, sobel(vUv + vec2(0.0, off * uTexel.y)));
        e = max(e, sobel(vUv - vec2(0.0, off * uTexel.y)));
      }
    }
    float ink = smoothstep(u_threshold, u_threshold + 0.08, sat(e * u_strength * 2.0));

    vec3 mode0 = mix(c, u_line, ink);
    vec3 mode1 = mix(vec3(1.0), u_line, ink);
    vec3 mode2 = mix(vec3(0.0), vec3(1.0), ink);
    vec3 out3 = mode0;
    out3 = mix(out3, mode1, step(0.5, u_mode));
    out3 = mix(out3, mode2, step(1.5, u_mode));

    gl_FragColor = vec4(mix(c, out3, u_mix), 1.0);
  }
` } ]
  });

  D.registerFilter({
    id: 'sketch',
    label: '铅笔素描 Sketch',
    category: 'paint',
    doc: '铅笔素描：亮度反转叠加边缘与纸张颗粒。',
    params: [
      { key: 'detail',   label: '细节', type: 'float', min: 0, max: 1, step: 0.01, def: 0.6 },
      { key: 'darkness', label: '深浅', type: 'float', min: 0, max: 1, step: 0.01, def: 0.6 },
      { key: 'grain',    label: '颗粒', type: 'float', min: 0, max: 1, step: 0.01, def: 0.5 },
      { key: 'paper',    label: '纸色', type: 'color', def: '#f4efe6' },
      { key: 'mix',      label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
  void main() {
    vec3 c = texture2D(uTex, vUv).rgb;
    vec2 px = vUv * uSize;
    float L = luma(c);

    float rad = 1.0 + u_detail * 3.0;
    float e = 0.0;
    for (int i = 0; i < 4; i++) {
      if (float(i) < u_detail * 4.0 + 1.0) {
        float o = float(i + 1);
        float l1 = luma(texture2D(uTex, vUv + vec2( o * uTexel.x * rad, 0.0)).rgb);
        float l2 = luma(texture2D(uTex, vUv + vec2(-o * uTexel.x * rad, 0.0)).rgb);
        float l3 = luma(texture2D(uTex, vUv + vec2(0.0,  o * uTexel.y * rad)).rgb);
        float l4 = luma(texture2D(uTex, vUv + vec2(0.0, -o * uTexel.y * rad)).rgb);
        e += (abs(l1 - l2) + abs(l3 - l4)) * 0.25;
      }
    }
    e = sat(e);

    float dens = sat((1.0 - L) * (1.0 - e * u_detail * 0.8));
    dens = sat(dens * (0.7 + u_darkness * 0.6));

    float grain = 0.5 * (hash12(px) + noise4(px).r);
    dens = sat(dens + (grain - 0.5) * u_grain * 0.4);

    vec3 paperCol = u_paper * (0.9 + 0.2 * grain);
    vec3 out3 = mix(paperCol, vec3(0.05, 0.05, 0.06), dens);

    gl_FragColor = vec4(mix(c, out3, u_mix), 1.0);
  }
` } ]
  });

  D.registerFilter({
    id: 'oilkuwahara',
    label: '油画桑原 Oil / Kuwahara',
    category: 'paint',
    doc: '桑原油画笔触，四象限方差加权取色。',
    params: [
      { key: 'radius', label: '半径缩放', type: 'float', min: 0, max: 1, step: 0.01, def: 0.4 },
      { key: 'sharp',  label: '锐度/强度', type: 'float', min: 0, max: 1, step: 0.01, def: 0.6 },
      { key: 'sat',    label: '饱和度', type: 'float', min: 0, max: 1, step: 0.01, def: 0.3 },
      { key: 'mix',    label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
  struct Q { vec3 m; float v; };

  Q qsample(vec2 s, float rad) {
    Q res;
    res.m = vec3(0.0);
    res.v = 0.0;
    float sumL = 0.0;
    float sumL2 = 0.0;
    float n = 0.0;
    for (int a = 0; a < 5; a++) {
      for (int b = 0; b < 5; b++) {
        float ox = float(a) * rad;
        float oy = float(b) * rad;
        vec3 col = texture2D(uTex, vUv + vec2(ox * s.x * uTexel.x, oy * s.y * uTexel.y)).rgb;
        float L = luma(col);
        res.m += col;
        sumL += L;
        sumL2 += L * L;
        n += 1.0;
      }
    }
    res.m = res.m / n;
    float meanL = sumL / n;
    res.v = max(sumL2 / n - meanL * meanL, 0.0);
    return res;
  }

  void main() {
    vec3 c = texture2D(uTex, vUv).rgb;
    float rad = 1.0 + u_radius * 4.0;

    Q q1 = qsample(vec2( 1.0, -1.0), rad);
    Q q2 = qsample(vec2(-1.0, -1.0), rad);
    Q q3 = qsample(vec2( 1.0,  1.0), rad);
    Q q4 = qsample(vec2(-1.0,  1.0), rad);

    // 权重上界固定为 1e4：pow(小方差, 大指数) 会逼近 0，
    // 若直接取倒数则在 mediump 精度下可能溢出成 Inf/NaN。
    float k = 1.0 + u_sharp * 6.0;
    float w1 = 1.0 / (pow(q1.v, k) + 0.0001);
    float w2 = 1.0 / (pow(q2.v, k) + 0.0001);
    float w3 = 1.0 / (pow(q3.v, k) + 0.0001);
    float w4 = 1.0 / (pow(q4.v, k) + 0.0001);
    float ws = w1 + w2 + w3 + w4;
    vec3 meanCol = (q1.m * w1 + q2.m * w2 + q3.m * w3 + q4.m * w4) / max(ws, 0.0001);

    vec3 hsv = rgb2hsv(meanCol);
    hsv.y = sat(hsv.y * (1.0 + u_sat));
    vec3 out3 = hsv2rgb(hsv);

    gl_FragColor = vec4(mix(c, out3, u_mix), 1.0);
  }
` } ]
  });

  D.registerFilter({
    id: 'watercolor',
    label: '水彩 Watercolor',
    category: 'paint',
    doc: '水彩：亮度分层量化并晕染出纸张渗色。',
    params: [
      { key: 'bands', label: '色带数', type: 'float', min: 2, max: 10, step: 1, def: 5 },
      { key: 'bleed', label: '晕染', type: 'float', min: 0, max: 1, step: 0.01, def: 0.4 },
      { key: 'edge',  label: '边缘', type: 'float', min: 0, max: 1, step: 0.01, def: 0.5 },
      { key: 'sat',   label: '饱和度', type: 'float', min: 0, max: 1, step: 0.01, def: 0.2 },
      { key: 'mix',   label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
  void main() {
    vec3 c0 = texture2D(uTex, vUv).rgb;
    vec2 px = vUv * uSize;

    float bleed = u_bleed * 3.0;
    vec2 jitter = vec2(
      (hash12(px + vec2(0.3, 1.7)) - 0.5) * 2.0 * bleed,
      (hash12(px + vec2(5.1, 0.9)) - 0.5) * 2.0 * bleed
    );
    vec3 c = texture2D(uTex, vUv + jitter * uTexel).rgb;

    float bands = max(u_bands, 2.0);
    vec3 hsv = rgb2hsv(c);
    hsv.z = floor(hsv.z * bands) / bands;
    hsv.y = sat(hsv.y * (1.0 + u_sat));
    vec3 painted = hsv2rgb(hsv);

    float l1 = luma(texture2D(uTex, vUv + vec2( uTexel.x, 0.0)).rgb);
    float l2 = luma(texture2D(uTex, vUv + vec2(-uTexel.x, 0.0)).rgb);
    float l3 = luma(texture2D(uTex, vUv + vec2(0.0,  uTexel.y)).rgb);
    float l4 = luma(texture2D(uTex, vUv + vec2(0.0, -uTexel.y)).rgb);
    float e = sat(abs(l1 - l2) + abs(l3 - l4));

    vec3 out3 = painted * (1.0 - e * u_edge);

    gl_FragColor = vec4(mix(c0, out3, u_mix), 1.0);
  }
` } ]
  });

  D.registerFilter({
    id: 'crosshatch',
    label: '交叉排线 Crosshatch',
    category: 'ink',
    doc: '按亮度阈值分层叠加四个方向的排线。',
    params: [
      { key: 'spacing',   label: '线间距', type: 'float', min: 2, max: 30, step: 0.5, def: 7, unit: 'px' },
      { key: 'thickness', label: '线宽', type: 'float', min: 0.02, max: 0.45, step: 0.01, def: 0.35 },
      { key: 'contrast',  label: '对比度', type: 'float', min: 0, max: 1, step: 0.01, def: 0.6 },
      { key: 'ink',       label: '墨色', type: 'color', def: '#101018' },
      { key: 'mix',       label: '混合', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
  float line(vec2 px, float ang) {
    float sp = max(u_spacing, 2.0);
    vec2 r = rot2(radians(ang)) * px;
    float ph = fract(r.x / sp);
    float w = clamp(u_thickness, 0.02, 0.45);
    return smoothstep(0.0, w, ph) * (1.0 - smoothstep(1.0 - w, 1.0, ph));
  }

  void main() {
    vec3 c = texture2D(uTex, vUv).rgb;
    vec2 px = vUv * uSize;
    float L = luma(c);

    float t1 = 1.0 - smoothstep(0.80, 0.92, L);
    float t2 = 1.0 - smoothstep(0.60, 0.72, L);
    float t3 = 1.0 - smoothstep(0.40, 0.52, L);
    float t4 = 1.0 - smoothstep(0.20, 0.32, L);

    float density = sat(
      line(px, 0.0)   * t1 * 0.25 +
      line(px, 45.0)  * t2 * 0.25 +
      line(px, 90.0)  * t3 * 0.25 +
      line(px, 135.0) * t4 * 0.25
    );
    density = sat((density - 0.5) * (1.0 + u_contrast * 3.0) + 0.5);

    vec3 paper = mix(vec3(1.0), vec3(0.85), L * 0.5);
    vec3 out3 = mix(paper, u_ink, density);

    gl_FragColor = vec4(mix(c, out3, u_mix), 1.0);
  }
` } ]
  });

})(window.DSV4P);
