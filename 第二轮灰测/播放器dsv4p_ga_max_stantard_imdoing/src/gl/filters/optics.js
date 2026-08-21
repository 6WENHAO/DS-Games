// optics.js — 光学/显示器/故障类滤镜
(function (D) {
  'use strict';

  D.registerFilter({
    id: 'crt',
    label: '显像管 CRT',
    category: 'display',
    doc: '模拟 CRT 扫描线、荫罩与桶形畸变。',
    params: [
      { key: 'scan', label: '扫描线 Scanlines', type: 'float', min: 0, max: 1, step: 0.01, def: 0.5 },
      { key: 'mask', label: '荫罩 Mask', type: 'enum', def: 1, options: [ { v: 0, label: '关 Off' }, { v: 1, label: '栅格 Grille' }, { v: 2, label: '槽孔 Slot' } ] },
      { key: 'curve', label: '桶形畸变 Curvature', type: 'float', min: 0, max: 0.5, step: 0.005, def: 0.08 },
      { key: 'glow', label: '辉光 Glow', type: 'float', min: 0, max: 1, step: 0.01, def: 0.15 },
      { key: 'vignette', label: '暗角 Vignette', type: 'float', min: 0, max: 1, step: 0.01, def: 0.4 },
      { key: 'mix', label: '混合 Mix', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
      void main(){
        vec3 orig = texture2D(uTex, vUv).rgb;
        vec2 d = vUv - 0.5;
        float r2 = dot(d, d);
        vec2 uv = clamp(vUv + d * (u_curve * r2 * 4.0), vec2(0.0), vec2(1.0));

        vec2 px = uv * uSize;
        vec3 c = texture2D(uTex, uv).rgb;

        // 扫描线
        float sy = uv.y * uSize.y;
        c *= 1.0 - u_scan * (0.5 + 0.5 * sin(sy * 3.14159));

        // 荫罩
        if (u_mask > 0.5) {
          float col = mod(px.x, 3.0);
          float grille = 1.0 - step(0.5, col);
          float slot = grille * (0.65 + 0.35 * sin(px.y * 3.14159));
          float m = mix(grille, slot, step(1.5, u_mask));
          c *= 1.0 - m * 0.35;
        }

        // 辉光（4 点邻域模糊叠加）
        vec2 gd = uTexel * 2.0;
        vec3 glow = (texture2D(uTex, clamp(uv + vec2( gd.x, 0.0), vec2(0.0), vec2(1.0))).rgb
                   + texture2D(uTex, clamp(uv - vec2( gd.x, 0.0), vec2(0.0), vec2(1.0))).rgb
                   + texture2D(uTex, clamp(uv + vec2(0.0,  gd.y), vec2(0.0), vec2(1.0))).rgb
                   + texture2D(uTex, clamp(uv + vec2(0.0, -gd.y), vec2(0.0), vec2(1.0))).rgb) * 0.25;
        c += glow * u_glow * 0.6;

        // 暗角与边缘渐隐
        float vig = 1.0 - u_vignette * smoothstep(0.15, 0.85, r2 * 4.0);
        vec2 ev = smoothstep(vec2(0.0), vec2(0.06), uv) * (1.0 - smoothstep(vec2(0.94), vec2(1.0), uv));
        float edge = ev.x * ev.y;
        vec3 out3 = c * vig * edge;

        gl_FragColor = vec4(mix(orig, out3, u_mix), 1.0);
      }
    ` } ]
  });

  D.registerFilter({
    id: 'vhs',
    label: '磁带录像 VHS',
    category: 'glitch',
    doc: '模拟 VHS 色偏、行抖动、噪带与拖影。',
    params: [
      { key: 'chroma', label: '色偏 Chroma', type: 'float', min: 0, max: 1, step: 0.01, def: 0.35 },
      { key: 'jitter', label: '行抖动 Jitter', type: 'float', min: 0, max: 1, step: 0.01, def: 0.4 },
      { key: 'noise', label: '噪点 Noise', type: 'float', min: 0, max: 1, step: 0.01, def: 0.3 },
      { key: 'ghost', label: '拖影 Ghost', type: 'float', min: 0, max: 1, step: 0.01, def: 0.25 },
      { key: 'mix', label: '混合 Mix', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
      void main(){
        vec3 orig = texture2D(uTex, vUv).rgb;
        float line = floor(vUv.y * uSize.y);
        float jit = hash11(line + floor(uTime * 20.0) * 61.7) - 0.5;
        vec2 uv = clamp(vUv + vec2(jit * u_jitter * 0.04, 0.0), vec2(0.0), vec2(1.0));

        // 色偏（R/B 水平错位）
        float ch = u_chroma * 0.012;
        vec3 c;
        c.r = texture2D(uTex, clamp(uv + vec2(ch, 0.0), vec2(0.0), vec2(1.0))).r;
        c.g = texture2D(uTex, uv).g;
        c.b = texture2D(uTex, clamp(uv - vec2(ch, 0.0), vec2(0.0), vec2(1.0))).b;

        // 拖影（向上一行涂抹）
        vec3 ghost = texture2D(uTex, clamp(uv - vec2(0.0, uTexel.y * 3.0), vec2(0.0), vec2(1.0))).rgb;
        c = mix(c, ghost, u_ghost * 0.6);

        // 饱和度下降
        c = mix(vec3(luma(c)), c, 0.82);

        // 噪带与颗粒
        vec2 suv = vec2(vUv.x * uSize.x * 0.25, vUv.y * 8.0) + vec2(0.0, uTime * 8.0);
        float streak = step(0.985, noise4(suv).r);
        float grain = noise4(vUv * uSize * 0.25 + uTime * 40.0).r - 0.5;
        c += streak * u_noise * 0.35;
        c += grain * u_noise * 0.12;

        gl_FragColor = vec4(mix(orig, c, u_mix), 1.0);
      }
    ` } ]
  });

  D.registerFilter({
    id: 'glitch',
    label: '数字故障 Glitch',
    category: 'glitch',
    doc: '模拟数字视频的块位移、通道分离与整行损坏。',
    params: [
      { key: 'amount', label: '强度 Amount', type: 'float', min: 0, max: 1, step: 0.01, def: 0.4 },
      { key: 'slices', label: '切片数 Slices', type: 'float', min: 1, max: 64, step: 1, def: 24 },
      { key: 'rgbsplit', label: '通道分离 RGB Split', type: 'float', min: 0, max: 1, step: 0.01, def: 0.5 },
      { key: 'blocks', label: '块量化 Blocks', type: 'float', min: 1, max: 64, step: 1, def: 4 },
      { key: 'mix', label: '混合 Mix', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
      void main(){
        vec3 orig = texture2D(uTex, vUv).rgb;
        float n = max(u_slices, 1.0);
        float sy = floor(vUv.y * n);
        float ts = floor(uTime * 8.0);
        float r = hash12(vec2(sy, ts));
        vec2 uv = clamp(vUv + vec2((r - 0.5) * u_amount * 0.35, 0.0), vec2(0.0), vec2(1.0));

        // 块量化
        float bs = max(u_blocks, 1.0);
        vec2 bq = clamp(floor(uv * uSize / bs) * bs * uTexel, vec2(0.0), vec2(1.0));

        vec3 c = texture2D(uTex, bq).rgb;

        // 通道分离
        float rs = u_rgbsplit * 0.02;
        vec3 sp;
        sp.r = texture2D(uTex, clamp(bq + vec2(rs, 0.0), vec2(0.0), vec2(1.0))).r;
        sp.g = texture2D(uTex, bq).g;
        sp.b = texture2D(uTex, clamp(bq - vec2(rs, 0.0), vec2(0.0), vec2(1.0))).b;
        c = mix(c, sp, u_rgbsplit);

        // 整行损坏
        float line = floor(vUv.y * uSize.y);
        float cr = hash11(line + floor(uTime * 20.0) * 71.0);
        float corrupt = step(1.0 - u_amount * 0.12, cr);
        float cs = hash11(line + uRandom * 3.7) * u_amount;
        vec3 corrc = texture2D(uTex, clamp(vec2(vUv.x + cs, vUv.y), vec2(0.0), vec2(1.0))).rgb;
        c = mix(c, corrc, corrupt);

        gl_FragColor = vec4(mix(orig, c, u_mix), 1.0);
      }
    ` } ]
  });

  D.registerFilter({
    id: 'blur',
    label: '高斯模糊 Blur',
    category: 'display',
    doc: '可分离的 9 抽头高斯模糊（水平+垂直两遍）。',
    params: [
      { key: 'radius', label: '半径 Radius', type: 'float', min: 0, max: 4, step: 0.05, def: 1 },
      { key: 'mix', label: '混合 Mix', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [
      { fs: `
        void main(){
          vec3 orig = texture2D(uTex, vUv).rgb;
          float st = uTexel.x * (1.0 + u_radius * 2.0);
          vec3 acc = vec3(0.0);
          acc += texture2D(uTex, clamp(vUv + vec2(-4.0 * st, 0.0), vec2(0.0), vec2(1.0))).rgb * 0.018;
          acc += texture2D(uTex, clamp(vUv + vec2(-3.0 * st, 0.0), vec2(0.0), vec2(1.0))).rgb * 0.054;
          acc += texture2D(uTex, clamp(vUv + vec2(-2.0 * st, 0.0), vec2(0.0), vec2(1.0))).rgb * 0.121;
          acc += texture2D(uTex, clamp(vUv + vec2(-1.0 * st, 0.0), vec2(0.0), vec2(1.0))).rgb * 0.194;
          acc += texture2D(uTex, vUv).rgb * 0.227;
          acc += texture2D(uTex, clamp(vUv + vec2( 1.0 * st, 0.0), vec2(0.0), vec2(1.0))).rgb * 0.194;
          acc += texture2D(uTex, clamp(vUv + vec2( 2.0 * st, 0.0), vec2(0.0), vec2(1.0))).rgb * 0.121;
          acc += texture2D(uTex, clamp(vUv + vec2( 3.0 * st, 0.0), vec2(0.0), vec2(1.0))).rgb * 0.054;
          acc += texture2D(uTex, clamp(vUv + vec2( 4.0 * st, 0.0), vec2(0.0), vec2(1.0))).rgb * 0.018;
          gl_FragColor = vec4(mix(orig, acc, u_mix), 1.0);
        }
      ` },
      { fs: `
        void main(){
          vec3 orig = texture2D(uTex, vUv).rgb;
          float st = uTexel.y * (1.0 + u_radius * 2.0);
          vec3 acc = vec3(0.0);
          acc += texture2D(uTex, clamp(vUv + vec2(0.0, -4.0 * st), vec2(0.0), vec2(1.0))).rgb * 0.018;
          acc += texture2D(uTex, clamp(vUv + vec2(0.0, -3.0 * st), vec2(0.0), vec2(1.0))).rgb * 0.054;
          acc += texture2D(uTex, clamp(vUv + vec2(0.0, -2.0 * st), vec2(0.0), vec2(1.0))).rgb * 0.121;
          acc += texture2D(uTex, clamp(vUv + vec2(0.0, -1.0 * st), vec2(0.0), vec2(1.0))).rgb * 0.194;
          acc += texture2D(uTex, vUv).rgb * 0.227;
          acc += texture2D(uTex, clamp(vUv + vec2(0.0,  1.0 * st), vec2(0.0), vec2(1.0))).rgb * 0.194;
          acc += texture2D(uTex, clamp(vUv + vec2(0.0,  2.0 * st), vec2(0.0), vec2(1.0))).rgb * 0.121;
          acc += texture2D(uTex, clamp(vUv + vec2(0.0,  3.0 * st), vec2(0.0), vec2(1.0))).rgb * 0.054;
          acc += texture2D(uTex, clamp(vUv + vec2(0.0,  4.0 * st), vec2(0.0), vec2(1.0))).rgb * 0.018;
          gl_FragColor = vec4(mix(orig, acc, u_mix), 1.0);
        }
      ` }
    ]
  });

  D.registerFilter({
    id: 'bloom',
    label: '辉光 Bloom',
    category: 'display',
    doc: '阈值提取高光后模糊并与原图叠加。',
    params: [
      { key: 'threshold', label: '阈值 Threshold', type: 'float', min: 0, max: 1, step: 0.01, def: 0.7 },
      { key: 'intensity', label: '强度 Intensity', type: 'float', min: 0, max: 2, step: 0.01, def: 0.8 },
      { key: 'radius', label: '半径 Radius', type: 'float', min: 0, max: 4, step: 0.05, def: 1 },
      { key: 'mix', label: '混合 Mix', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [
      { scale: 0.5, fs: `
        void main(){
          vec3 c = texture2D(uTex, vUv).rgb;
          float th = clamp(u_threshold, 0.0, 0.999);
          float b = max(luma(c) - th, 0.0) / max(1.0 - th, 0.05);
          gl_FragColor = vec4(c * b, 1.0);
        }
      ` },
      { scale: 0.5, fs: `
        vec3 gauss9(vec2 uv, vec2 st){
          vec3 acc = vec3(0.0);
          acc += texture2D(uTex, clamp(uv - st * 4.0, vec2(0.0), vec2(1.0))).rgb * 0.018;
          acc += texture2D(uTex, clamp(uv - st * 3.0, vec2(0.0), vec2(1.0))).rgb * 0.054;
          acc += texture2D(uTex, clamp(uv - st * 2.0, vec2(0.0), vec2(1.0))).rgb * 0.121;
          acc += texture2D(uTex, clamp(uv - st, vec2(0.0), vec2(1.0))).rgb * 0.194;
          acc += texture2D(uTex, clamp(uv, vec2(0.0), vec2(1.0))).rgb * 0.227;
          acc += texture2D(uTex, clamp(uv + st, vec2(0.0), vec2(1.0))).rgb * 0.194;
          acc += texture2D(uTex, clamp(uv + st * 2.0, vec2(0.0), vec2(1.0))).rgb * 0.121;
          acc += texture2D(uTex, clamp(uv + st * 3.0, vec2(0.0), vec2(1.0))).rgb * 0.054;
          acc += texture2D(uTex, clamp(uv + st * 4.0, vec2(0.0), vec2(1.0))).rgb * 0.018;
          return acc;
        }
        void main(){
          float sc = 1.0 + u_radius * 3.0;
          vec3 h = gauss9(vUv, vec2(uTexel.x * sc, 0.0));
          vec3 v = gauss9(vUv, vec2(0.0, uTexel.y * sc));
          gl_FragColor = vec4((h + v) * 0.5, 1.0);
        }
      ` },
      { fs: `
        void main(){
          vec3 base = texture2D(uStageIn, vUv).rgb;
          vec3 bloom = texture2D(uTex, vUv).rgb * u_intensity;
          vec3 add = base + bloom;
          vec3 scr = vec3(1.0) - (vec3(1.0) - base) * (vec3(1.0) - bloom);
          vec3 out3 = mix(add, scr, 0.5);
          gl_FragColor = vec4(mix(base, out3, u_mix), 1.0);
        }
      ` }
    ]
  });

  D.registerFilter({
    id: 'sharpen',
    label: '锐化 Sharpen',
    category: 'display',
    doc: '反锐化掩模增强细节并钳制过冲。',
    params: [
      { key: 'amount', label: '强度 Amount', type: 'float', min: 0, max: 2, step: 0.01, def: 0.6 },
      { key: 'radius', label: '半径 Radius', type: 'float', min: 0, max: 4, step: 0.05, def: 1 },
      { key: 'mix', label: '混合 Mix', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
      void main(){
        vec3 orig = texture2D(uTex, vUv).rgb;
        float sx = (1.0 + u_radius * 2.0) * uTexel.x;
        float sy = (1.0 + u_radius * 2.0) * uTexel.y;
        vec3 n = texture2D(uTex, clamp(vUv + vec2( sx, 0.0), vec2(0.0), vec2(1.0))).rgb
               + texture2D(uTex, clamp(vUv - vec2( sx, 0.0), vec2(0.0), vec2(1.0))).rgb
               + texture2D(uTex, clamp(vUv + vec2(0.0,  sy), vec2(0.0), vec2(1.0))).rgb
               + texture2D(uTex, clamp(vUv + vec2(0.0, -sy), vec2(0.0), vec2(1.0))).rgb;
        vec3 blur = n * 0.25;
        vec3 sharp = clamp(orig + (orig - blur) * u_amount, vec3(0.0), vec3(1.0));
        gl_FragColor = vec4(mix(orig, sharp, u_mix), 1.0);
      }
    ` } ]
  });

})(window.DSV4P);
