// color.js — 调色/色调类滤镜
(function (D) {
  'use strict';

  D.registerFilter({
    id: 'grade',
    label: '一级调色 Grade',
    category: 'grade',
    doc: '曝光、对比度、饱和度、伽马、色温与色调的基础校正。',
    params: [
      { key: 'exposure', label: '曝光 Exposure', type: 'float', min: -3, max: 3, step: 0.05, def: 0, unit: 'stops' },
      { key: 'contrast', label: '对比度 Contrast', type: 'float', min: -1, max: 1, step: 0.01, def: 0 },
      { key: 'saturation', label: '饱和度 Saturation', type: 'float', min: -1, max: 1, step: 0.01, def: 0 },
      { key: 'gamma', label: '伽马 Gamma', type: 'float', min: 0.2, max: 3, step: 0.01, def: 1 },
      { key: 'temp', label: '色温 Temp', type: 'float', min: -1, max: 1, step: 0.01, def: 0 },
      { key: 'tint', label: '色调 Tint', type: 'float', min: -1, max: 1, step: 0.01, def: 0 },
      { key: 'mix', label: '混合 Mix', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
      void main(){
        vec3 orig = texture2D(uTex, vUv).rgb;
        vec3 c = orig * exp2(u_exposure);
        c = (c - 0.5) * (1.0 + u_contrast) + 0.5;
        c = max(c, vec3(0.0));
        c = pow(c, vec3(1.0 / max(u_gamma, 0.05)));
        c = mix(vec3(luma(c)), c, 1.0 + u_saturation);
        c.r += u_temp * 0.15;
        c.b -= u_temp * 0.15;
        c.r += u_tint * 0.06;
        c.g -= u_tint * 0.12;
        c.b += u_tint * 0.06;
        c = clamp(c, vec3(0.0), vec3(1.0));
        gl_FragColor = vec4(mix(orig, c, u_mix), 1.0);
      }
    ` } ]
  });

  D.registerFilter({
    id: 'duotone',
    label: '双色调 Duotone',
    category: 'grade',
    doc: '将亮度映射到两种颜色之间并带中点偏移。',
    params: [
      { key: 'dark', label: '暗部 Dark', type: 'color', def: '#0a0a1e' },
      { key: 'light', label: '亮部 Light', type: 'color', def: '#f2e6c8' },
      { key: 'bias', label: '中点偏移 Bias', type: 'float', min: -0.5, max: 0.5, step: 0.01, def: 0 },
      { key: 'contrast', label: '对比度 Contrast', type: 'float', min: -1, max: 1, step: 0.01, def: 0 },
      { key: 'mix', label: '混合 Mix', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
      void main(){
        vec3 orig = texture2D(uTex, vUv).rgb;
        float t = clamp(luma(orig) + u_bias, 0.0, 1.0);
        t = clamp((t - 0.5) * (1.0 + u_contrast) + 0.5, 0.0, 1.0);
        vec3 out3 = mix(u_dark, u_light, t);
        gl_FragColor = vec4(mix(orig, out3, u_mix), 1.0);
      }
    ` } ]
  });

  D.registerFilter({
    id: 'falsecolor',
    label: '伪彩色 False Color',
    category: 'tone',
    doc: '按亮度映射到热成像/红外/青品三段色带。',
    params: [
      { key: 'style', label: '风格 Style', type: 'enum', def: 0, options: [ { v: 0, label: '热成像 Thermal' }, { v: 1, label: '红外绿 IR Scope' }, { v: 2, label: '青品 Cyan-Magenta' } ] },
      { key: 'gain', label: '增益 Gain', type: 'float', min: 0.5, max: 4, step: 0.05, def: 1 },
      { key: 'offset', label: '偏移 Offset', type: 'float', min: -0.5, max: 0.5, step: 0.01, def: 0 },
      { key: 'mix', label: '混合 Mix', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
      vec3 rampThermal(float t){
        vec3 c = mix(vec3(0.0), vec3(0.3, 0.0, 0.6), smoothstep(0.0, 0.2, t));
        c = mix(c, vec3(0.8, 0.0, 0.1), smoothstep(0.2, 0.4, t));
        c = mix(c, vec3(1.0, 0.45, 0.0), smoothstep(0.4, 0.6, t));
        c = mix(c, vec3(1.0, 0.9, 0.1), smoothstep(0.6, 0.8, t));
        c = mix(c, vec3(1.0), smoothstep(0.8, 1.0, t));
        return c;
      }
      vec3 rampIR(float t){
        vec3 c = mix(vec3(0.0), vec3(0.0, 0.2, 0.05), smoothstep(0.0, 0.25, t));
        c = mix(c, vec3(0.0, 0.8, 0.2), smoothstep(0.25, 0.55, t));
        c = mix(c, vec3(0.4, 1.0, 0.6), smoothstep(0.55, 0.8, t));
        c = mix(c, vec3(1.0), smoothstep(0.8, 1.0, t));
        return c;
      }
      vec3 rampCM(float t){
        vec3 c = mix(vec3(0.0), vec3(0.0, 0.5, 0.8), smoothstep(0.0, 0.3, t));
        c = mix(c, vec3(0.0, 0.2, 0.8), smoothstep(0.3, 0.55, t));
        c = mix(c, vec3(0.9, 0.0, 0.9), smoothstep(0.55, 0.8, t));
        c = mix(c, vec3(1.0), smoothstep(0.8, 1.0, t));
        return c;
      }
      void main(){
        vec3 orig = texture2D(uTex, vUv).rgb;
        float t = clamp(luma(orig) * u_gain + u_offset, 0.0, 1.0);
        vec3 out3;
        if (u_style < 0.5) { out3 = rampThermal(t); }
        else if (u_style < 1.5) { out3 = rampIR(t); }
        else { out3 = rampCM(t); }
        gl_FragColor = vec4(mix(orig, out3, u_mix), 1.0);
      }
    ` } ]
  });

  D.registerFilter({
    id: 'hueshift',
    label: '色相偏移 Hue Shift',
    category: 'grade',
    doc: 'HSV 色相旋转、自然饱和度与选择性色相窗口增强。',
    params: [
      { key: 'hue', label: '色相 Hue', type: 'float', min: -0.5, max: 0.5, step: 0.01, def: 0 },
      { key: 'vibrance', label: '自然饱和 Vibrance', type: 'float', min: -1, max: 1, step: 0.01, def: 0 },
      { key: 'huecenter', label: '目标色相 Center', type: 'float', min: 0, max: 1, step: 0.01, def: 0.0 },
      { key: 'huewidth', label: '窗口宽度 Width', type: 'float', min: 0, max: 0.5, step: 0.01, def: 0.15 },
      { key: 'hueboost', label: '窗口增益 Boost', type: 'float', min: 0, max: 2, step: 0.01, def: 0.5 },
      { key: 'mix', label: '混合 Mix', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
      void main(){
        vec3 orig = texture2D(uTex, vUv).rgb;
        vec3 hsv = rgb2hsv(orig);
        hsv.x = fract(hsv.x + u_hue + 1.0);
        hsv.y *= 1.0 + u_vibrance * (1.0 - hsv.y);
        float d = abs(hsv.x - u_huecenter);
        d = min(d, 1.0 - d);
        hsv.y *= 1.0 + u_hueboost * (1.0 - smoothstep(0.0, max(u_huewidth, 0.01), d));
        vec3 out3 = hsv2rgb(hsv);
        gl_FragColor = vec4(mix(orig, out3, u_mix), 1.0);
      }
    ` } ]
  });

  D.registerFilter({
    id: 'filmgrain',
    label: '胶片颗粒 Film Grain',
    category: 'tone',
    doc: '暗角、动画胶片颗粒与褪色黑位。',
    params: [
      { key: 'grain', label: '颗粒 Grain', type: 'float', min: 0, max: 1, step: 0.01, def: 0.3 },
      { key: 'grainsize', label: '颗粒尺寸 Size', type: 'float', min: 0.5, max: 4, step: 0.05, def: 1 },
      { key: 'vignette', label: '暗角 Vignette', type: 'float', min: 0, max: 1, step: 0.01, def: 0.3 },
      { key: 'vigsoft', label: '暗角柔和 Soft', type: 'float', min: 0, max: 0.5, step: 0.01, def: 0.1 },
      { key: 'fade', label: '褪色黑位 Fade', type: 'float', min: 0, max: 1, step: 0.01, def: 0.1 },
      { key: 'mix', label: '混合 Mix', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
      void main(){
        vec3 orig = texture2D(uTex, vUv).rgb;
        vec3 c = orig;

        // 暗角
        float d = distance(vUv, vec2(0.5));
        c *= 1.0 - u_vignette * smoothstep(0.25, 0.55 + u_vigsoft, d);

        // 动画颗粒
        float gs = max(u_grainsize, 0.5);
        vec2 guv = vUv * uSize / gs;
        guv += vec2(uRandom * 16.0, uTime * 24.0);
        c += (noise4(guv).r - 0.5) * u_grain * 0.5;

        // 褪色黑位
        c = c * (1.0 - u_fade) + vec3(u_fade * 0.06);

        gl_FragColor = vec4(mix(orig, c, u_mix), 1.0);
      }
    ` } ]
  });

  D.registerFilter({
    id: 'bleachbypass',
    label: '漂白旁路 Bleach Bypass',
    category: 'tone',
    doc: '高光去饱和、对比度挤压与亮度柔光叠加的交叉冲印效果。',
    params: [
      { key: 'strength', label: '强度 Strength', type: 'float', min: 0, max: 1, step: 0.01, def: 0.6 },
      { key: 'contrast', label: '对比度 Contrast', type: 'float', min: 0, max: 2, step: 0.01, def: 0.6 },
      { key: 'warmth', label: '暖色 Warmth', type: 'float', min: 0, max: 1, step: 0.01, def: 0.15 },
      { key: 'mix', label: '混合 Mix', type: 'float', min: 0, max: 1, step: 0.01, def: 1 }
    ],
    passes: [ { fs: `
      void main(){
        vec3 orig = texture2D(uTex, vUv).rgb;
        vec3 c = orig;
        float l = luma(c);

        // 高光去饱和
        c = mix(vec3(l), c, 1.0 - u_strength * l);

        // 对比度挤压
        c = (c - 0.5) * (1.0 + u_contrast * u_strength) + 0.5;

        // 亮度柔光叠加
        vec3 sl = softLight(c, vec3(l));
        c = mix(c, sl, u_strength * 0.7);

        // 暖色偏移
        c.r += u_warmth * 0.08;
        c.b -= u_warmth * 0.08;

        c = clamp(c, vec3(0.0), vec3(1.0));
        gl_FragColor = vec4(mix(orig, c, u_mix), 1.0);
      }
    ` } ]
  });

})(window.DSV4P);
