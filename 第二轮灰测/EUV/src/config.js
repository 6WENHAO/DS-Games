/**
 * config.js — 品牌 VI、渲染质量档、影片时基
 * ==================================================================
 * 规格书 §1.3「品牌元素（Logo、片头/片尾、VI 规范）按企业要求准确应用」。
 * 客户 VI 落地方式：只改本文件的 BRAND 段 + 放入 assets/brand/logo.svg，
 * 全片片头、片尾、HUD 主色、字幕描边色、进度条同步生效，无需改动其它代码。
 */

// ───────────────────────────────────────────────────────────────────
// 品牌 VI（占位值 —— 待客户 VI 手册确认后替换，见 docs/06-评审里程碑记录.md）
// ───────────────────────────────────────────────────────────────────
export const BRAND = {
  /** 企业名 */
  nameZh: '示例科技',
  nameEn: 'EXAMPLE TECH',
  /** 影片标题 */
  titleZh: 'EUV 光刻原理',
  titleEn: 'How EUV Lithography Works',
  subtitleZh: '锡滴激光等离子体光源 · 全工艺链三维演示',
  subtitleEn: 'Tin-Droplet Laser-Produced-Plasma Source · Full Process Chain',
  /** 片尾标语 */
  taglineZh: '在 13.5 纳米的尺度上，定义下一代芯片',
  taglineEn: 'Defining the next generation of chips at 13.5 nanometres',
  /** Logo：留空则使用矢量字标回退，不会出现空缺或占位方块 */
  logoUrl: '',
  /** VI 主色板 —— HUD、字幕、光效着色统一取用 */
  colors: {
    primary: '#3FA9F5',      // 主色：EUV 冷蓝
    accent: '#7CE0FF',       // 强调：高亮青
    plasma: '#FFF1C9',       // 等离子体白热
    tin: '#C9D2DC',          // 锡金属
    warn: '#FF9F45',         // 红外/带外杂散光
    ink: '#0A0E14',          // 底色
    paper: '#EAF2FA',        // 正文文字
    grid: '#1B2836',         // HUD 网格
  },
  /** 字体：全部为系统字体或开源字体，规避字体侵权（见 docs/05） */
  fontStack: '"Source Han Sans SC","Noto Sans SC","Microsoft YaHei","PingFang SC",-apple-system,"Segoe UI",Roboto,sans-serif',
  fontStackMono: '"JetBrains Mono","Cascadia Mono",Consolas,"SF Mono",monospace',
};

// ───────────────────────────────────────────────────────────────────
// 影片时基（规格书 §2：母版 4K / 30fps；正片 2–4 分钟）
// ───────────────────────────────────────────────────────────────────
export const FILM = {
  fps: 30,
  /** 正片总时长（秒）—— 时间轴由 script.js 定义并校验总和 */
  duration: 180,
  master: { width: 3840, height: 2160, label: '4K UHD 16:9' },
  /** 衍生版本（规格书 §2 衍生版本） */
  derivatives: [
    { id: 'promo_h',   label: '正片 横版',   width: 3840, height: 2160, duration: 180 },
    { id: 'social60_h', label: '社媒 60s 横版', width: 1920, height: 1080, duration: 60 },
    { id: 'social60_v', label: '社媒 60s 竖版', width: 1080, height: 1920, duration: 60 },
    { id: 'social30_h', label: '社媒 30s 横版', width: 1920, height: 1080, duration: 30 },
    { id: 'social30_v', label: '社媒 30s 竖版', width: 1080, height: 1920, duration: 30 },
  ],
  /** 响度规范（规格书 §2 音频） */
  loudness: { targetLUFS: -14, truePeakDbTP: -1.0 },
};

// ───────────────────────────────────────────────────────────────────
// 渲染质量档
//   'preview'  实时预览（交互查看 / 评审）
//   'review'   评审渲染（首轮渲染里程碑）
//   'master'   母版逐帧捕获（离线，确定性时间步，允许每帧数百毫秒）
// ───────────────────────────────────────────────────────────────────
export const QUALITY = {
  preview: {
    pixelRatioCap: 1.5,
    msaaSamples: 4,
    bloom: { strength: 0.46, radius: 0.72, threshold: 0.80 },
    dof: { enabled: false, aperture: 0.00018, maxblur: 0.008 },
    taaLevel: 0,
    dropletCount: 220,
    plasmaRayCount: 96,
    beamSegments: 96,
    shadows: true,
    shadowMapSize: 1024,
    grain: 0.045,
  },
  review: {
    pixelRatioCap: 2,
    msaaSamples: 8,
    bloom: { strength: 0.50, radius: 0.78, threshold: 0.78 },
    dof: { enabled: true, aperture: 0.00016, maxblur: 0.0075 },
    taaLevel: 1,
    dropletCount: 340,
    plasmaRayCount: 160,
    beamSegments: 160,
    shadows: true,
    shadowMapSize: 2048,
    grain: 0.038,
  },
  master: {
    pixelRatioCap: 1,          // 捕获时由 capture.js 直接设定 3840×2160
    msaaSamples: 8,
    bloom: { strength: 0.52, radius: 0.80, threshold: 0.76 },
    dof: { enabled: true, aperture: 0.00016, maxblur: 0.0075 },
    taaLevel: 3,               // 每帧 8 次抖动累积 —— 消除闪烁与噪点（§1.3）
    dropletCount: 420,
    plasmaRayCount: 220,
    beamSegments: 240,
    shadows: true,
    shadowMapSize: 4096,
    grain: 0.03,
  },
};

/** 语言档：'zh' | 'en' | 'bi'（双语） */
export const DEFAULT_LANG = 'bi';

/** URL 参数覆盖：?q=master&lang=en&t=42&cap=1 */
export function readUrlOverrides() {
  const u = new URLSearchParams(location.search);
  const q = u.get('q');
  return {
    quality: QUALITY[q] ? q : 'preview',
    lang: ['zh', 'en', 'bi'].includes(u.get('lang')) ? u.get('lang') : DEFAULT_LANG,
    startTime: Number.isFinite(parseFloat(u.get('t'))) ? parseFloat(u.get('t')) : 0,
    captureMode: u.get('cap') === '1',
    autoplay: u.get('autoplay') !== '0',
    debug: u.get('debug') === '1',
    aspect: u.get('aspect') || '',      // '9:16' 强制竖版取景
    muted: u.get('muted') === '1',
  };
}
