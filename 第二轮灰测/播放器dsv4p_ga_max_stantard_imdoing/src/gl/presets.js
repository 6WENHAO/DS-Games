/*!
 * src/gl/presets.js — 风格预设（滤镜链 + 调色板 + 字符集的组合）
 * 套用预设会替换当前滤镜链；每个预设都可以在套用后继续手改参数。
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});

  D.presets = [
    {
      id: 'pixel-8bit', name: '像素 8-bit', desc: '像素块 + PICO-8 调色板 + 有序抖动',
      palette: 'pico8',
      chain: [
        { id: 'grade', params: { contrast: 0.12, saturation: 0.2 } },
        { id: 'pixelate', params: { cell: 8, sample: 1 } },
        { id: 'palette', params: { dither: 1, amount: 0.45, gamma: 1.1 } }
      ]
    },
    {
      id: 'pixel-chunky', name: '大像素 + 描边', desc: '粗像素块、像素级描边，游戏素材感',
      palette: 'gruvbox',
      chain: [
        { id: 'pixelate', params: { cell: 14, sample: 1 } },
        { id: 'palette', params: { dither: 0, amount: 0 } },
        { id: 'pixeloutline', params: { threshold: 0.16, mode: 0, line: '#0d0b12' } }
      ]
    },
    {
      id: 'gameboy', name: 'Game Boy DMG', desc: '四阶绿 + 小像素块 + 抖动',
      palette: 'gb-dmg',
      chain: [
        { id: 'grade', params: { contrast: 0.25, saturation: -1 } },
        { id: 'pixelate', params: { cell: 6, sample: 1 } },
        { id: 'palette', params: { dither: 1, amount: 0.75, gamma: 1.25 } }
      ]
    },
    {
      id: 'handheld-lcd', name: '掌机 LCD', desc: 'GB Pocket 灰阶 + LCD 像素格纹',
      palette: 'gb-pocket',
      chain: [
        { id: 'pixelate', params: { cell: 6, sample: 1 } },
        { id: 'palette', params: { dither: 1, amount: 0.6 } },
        { id: 'lcdgrid', params: { cell: 6, contrast: 0.55, gap: 0.5, scan: 0.15 } }
      ]
    },
    {
      id: 'nes', name: '红白机 NES', desc: 'NES 常用配色 + 8px 网格',
      palette: 'nes',
      chain: [
        { id: 'grade', params: { contrast: 0.18, saturation: 0.25 } },
        { id: 'pixelate', params: { cell: 8, sample: 1 } },
        { id: 'palette', params: { dither: 2, amount: 0.4 } }
      ]
    },
    {
      id: 'c64', name: 'Commodore 64', desc: 'C64 16 色 + 宽像素（模拟 320×200）',
      palette: 'c64',
      chain: [
        { id: 'pixelate', params: { cell: 8, aspect: 1.35, sample: 1 } },
        { id: 'palette', params: { dither: 1, amount: 0.7 } }
      ]
    },
    {
      id: 'cga-dos', name: 'CGA / DOS', desc: 'CGA 16 色 + 强抖动',
      palette: 'cga',
      chain: [
        { id: 'grade', params: { contrast: 0.2 } },
        { id: 'pixelate', params: { cell: 5, sample: 1 } },
        { id: 'palette', params: { dither: 1, amount: 0.95, gamma: 1.2 } }
      ]
    },
    {
      id: 'mono-dither', name: '单色抖动 1-bit', desc: 'Bayer 抖动的黑白点阵，电子墨水感',
      chain: [
        { id: 'grade', params: { contrast: 0.15 } },
        { id: 'pixelate', params: { cell: 3, sample: 1 } },
        { id: 'dither1bit', params: { pattern: 0, contrast: 1.35 } }
      ]
    },
    {
      id: 'newspaper', name: '报纸印刷', desc: '单色半调网点 + 微微偏黄',
      chain: [
        { id: 'grade', params: { contrast: 0.25, saturation: -1, temp: 0.1 } },
        { id: 'halftone', params: { cell: 6, angle: 45, mode: 0, ink: '#14120f' } }
      ]
    },
    {
      id: 'comic-ink', name: '漫画分镜', desc: '墨线 + 色阶压缩 + 彩色网点',
      chain: [
        { id: 'grade', params: { contrast: 0.2, saturation: 0.35 } },
        { id: 'posterize', params: { levels: 6, dither: 0 } },
        { id: 'halftone', params: { cell: 5, mode: 1, mix: 0.6 } },
        { id: 'edgeink', params: { strength: 0.9, threshold: 0.3, thickness: 0.35, mode: 0 } }
      ]
    },
    {
      id: 'ascii-term', name: '终端字符画', desc: 'ASCII 字形 + 绿色磷光',
      glyph: 'ascii',
      chain: [
        { id: 'grade', params: { contrast: 0.3 } },
        { id: 'ascii', params: { cell: 10, contrast: 1.4, color: 0, ink: '#7cff9b', bg: '#04070a' } },
        { id: 'bloom', params: { threshold: 0.45, intensity: 0.5, radius: 1 } }
      ]
    },
    {
      id: 'ascii-color', name: '彩色字符画', desc: '方块字形 + 保留原色',
      glyph: 'blocks',
      chain: [
        { id: 'ascii', params: { cell: 8, contrast: 1.2, color: 1 } }
      ]
    },
    {
      id: 'crt-arcade', name: '街机 CRT', desc: '像素 + 荫罩 + 桶形畸变 + 辉光',
      palette: 'pico8',
      chain: [
        { id: 'pixelate', params: { cell: 4, sample: 1 } },
        { id: 'palette', params: { dither: 1, amount: 0.35, mix: 0.85 } },
        { id: 'bloom', params: { threshold: 0.55, intensity: 0.6, radius: 1.2 } },
        { id: 'crt', params: { scan: 0.55, mask: 1, curve: 0.09, glow: 0.25, vignette: 0.45 } }
      ]
    },
    {
      id: 'vhs-1987', name: 'VHS 1987', desc: '色度偏移、抖动扫描、磁带噪点',
      chain: [
        { id: 'grade', params: { saturation: -0.15, contrast: -0.1, temp: 0.12 } },
        { id: 'vhs', params: { chroma: 0.45, jitter: 0.5, noise: 0.35, ghost: 0.3 } },
        { id: 'filmgrain', params: { grain: 0.25, vignette: 0.35, fade: 0.15 } }
      ]
    },
    {
      id: 'datamosh', name: '故障艺术', desc: '块位移 + RGB 分离 + 磁带噪',
      chain: [
        { id: 'glitch', params: { amount: 0.55, slices: 28, rgbsplit: 0.6, blocks: 8 } },
        { id: 'vhs', params: { chroma: 0.3, jitter: 0.25, noise: 0.2, ghost: 0.15, mix: 0.7 } }
      ]
    },
    {
      id: 'noir', name: '黑白电影', desc: '去色 + 高对比 + 颗粒暗角',
      chain: [
        { id: 'grade', params: { saturation: -1, contrast: 0.35, gamma: 0.95 } },
        { id: 'filmgrain', params: { grain: 0.35, grainsize: 1.4, vignette: 0.5, fade: 0.2 } },
        { id: 'sharpen', params: { amount: 0.5, radius: 1 } }
      ]
    },
    {
      id: 'thermal', name: '热成像', desc: '亮度映射到热力色带 + 辉光',
      chain: [
        { id: 'blur', params: { radius: 0.6, mix: 0.5 } },
        { id: 'falsecolor', params: { style: 0, gain: 1.35, offset: -0.05 } },
        { id: 'bloom', params: { threshold: 0.6, intensity: 0.5 } }
      ]
    },
    {
      id: 'ir-scope', name: '夜视仪', desc: '绿色红外 + 噪点 + 暗角',
      chain: [
        { id: 'falsecolor', params: { style: 1, gain: 1.6 } },
        { id: 'filmgrain', params: { grain: 0.55, grainsize: 0.8, vignette: 0.6, vigsoft: 0.2 } },
        { id: 'crt', params: { scan: 0.25, mask: 0, curve: 0.03, glow: 0.3, vignette: 0.2 } }
      ]
    },
    {
      id: 'neon-cyber', name: '霓虹赛博', desc: '边缘发光 + 色相加强 + 辉光',
      chain: [
        { id: 'grade', params: { contrast: 0.2, saturation: 0.4 } },
        { id: 'hueshift', params: { hue: -0.06, vibrance: 0.5, huecenter: 0.55, huewidth: 0.2, hueboost: 1.1 } },
        { id: 'edgeink', params: { strength: 0.8, threshold: 0.22, thickness: 0.25, mode: 2, mix: 0.55 } },
        { id: 'bloom', params: { threshold: 0.5, intensity: 1, radius: 1.6 } }
      ]
    },
    {
      id: 'watercolor', name: '水彩', desc: '色带 + 纸张渗色 + 淡边缘',
      chain: [
        { id: 'watercolor', params: { bands: 6, bleed: 0.45, edge: 0.5, sat: 0.25 } },
        { id: 'grade', params: { contrast: -0.05, saturation: 0.1 } }
      ]
    },
    {
      id: 'oil-paint', name: '油画', desc: '桑原滤波笔触 + 提饱和',
      chain: [
        { id: 'oilkuwahara', params: { radius: 0.5, sharp: 0.65, sat: 0.35 } },
        { id: 'sharpen', params: { amount: 0.35 } }
      ]
    },
    {
      id: 'pencil', name: '铅笔素描', desc: '纸张纹理 + 交叉排线',
      chain: [
        { id: 'sketch', params: { detail: 0.65, darkness: 0.6, grain: 0.45 } },
        { id: 'crosshatch', params: { spacing: 8, thickness: 0.3, contrast: 0.45, mix: 0.45 } }
      ]
    },
    {
      id: 'hex-mosaic', name: '六边形马赛克', desc: '蜂巢网格 + 色阶压缩',
      chain: [
        { id: 'hexmosaic', params: { cell: 14, gap: 0.14 } },
        { id: 'posterize', params: { levels: 8, dither: 0, scale: 14 } }
      ]
    },
    {
      id: 'teletext', name: '图文电视', desc: '8 色 + 粗像素块 + 扫描线',
      palette: 'teletext',
      chain: [
        { id: 'pixelate', params: { cell: 12, aspect: 1.2, sample: 1 } },
        { id: 'palette', params: { dither: 2, amount: 0.5 } },
        { id: 'crt', params: { scan: 0.4, mask: 0, curve: 0.02, glow: 0.1, vignette: 0.2 } }
      ]
    },
    {
      id: 'amber-term', name: '琥珀终端', desc: '单色琥珀 + 点阵 + 荫罩',
      palette: 'amber',
      chain: [
        { id: 'pixelate', params: { cell: 4, shape: 1, gap: 0.15, sample: 1 } },
        { id: 'palette', params: { dither: 1, amount: 0.6 } },
        { id: 'bloom', params: { threshold: 0.4, intensity: 0.7, radius: 0.8 } }
      ]
    }
  ];

  D.getPreset = function (id) {
    for (var i = 0; i < D.presets.length; i++) if (D.presets[i].id === id) return D.presets[i];
    return null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
