/**
 * 画质分档：桌面 60fps / 移动 30fps+ 的达标手段。
 *
 * 所有“可以变的量”都集中在这里，运行时可由用户手动切换，也可由
 * drei 的 PerformanceMonitor 自动降档（见 src/scene/PerfGovernor.tsx）。
 */

export type Quality = 'high' | 'medium' | 'low'

export interface QualityTier {
  label: string
  /** Canvas 的 dpr 区间 */
  dpr: [number, number]
  /** 是否启用后处理（泛光 / 暗角 / 景深） */
  postprocessing: boolean
  depthOfField: boolean
  /** EffectComposer 的 MSAA 采样数（0 = 关闭） */
  multisampling: number
  /** 病毒囊膜是否使用 transmission（真实折射，较贵） */
  transmission: boolean
  /** 病毒囊膜细分级别（IcosahedronGeometry detail） */
  envelopeDetail: number
  /** 刺突蛋白细分级别 */
  spikeDetail: number
  /** 细胞膜网格分段数（正方形网格） */
  membraneSegments: number
  /** 特写处实例化磷脂分子的数量 */
  lipidCount: number
  /** 背景漂浮尘埃 / 分子噪点数量 */
  dustCount: number
  /** 第 8 步同时出胞的子代病毒数量 */
  progenyCount: number
  /** 细胞质中的核糖体数量 */
  ribosomeCount: number
  /** 阴影 */
  shadows: boolean
}

export const QUALITY_TIERS: Record<Quality, QualityTier> = {
  high: {
    label: '高画质',
    dpr: [1, 2],
    postprocessing: true,
    depthOfField: true,
    multisampling: 4,
    transmission: true,
    envelopeDetail: 4,
    spikeDetail: 2,
    membraneSegments: 128,
    lipidCount: 900,
    dustCount: 1400,
    progenyCount: 7,
    ribosomeCount: 60,
    shadows: false,
  },
  medium: {
    label: '中画质',
    dpr: [1, 1.5],
    postprocessing: true,
    depthOfField: false,
    multisampling: 0,
    transmission: false,
    envelopeDetail: 3,
    spikeDetail: 1,
    membraneSegments: 96,
    lipidCount: 420,
    dustCount: 700,
    progenyCount: 5,
    ribosomeCount: 36,
    shadows: false,
  },
  low: {
    label: '流畅优先',
    dpr: [0.75, 1],
    postprocessing: false,
    depthOfField: false,
    multisampling: 0,
    transmission: false,
    envelopeDetail: 2,
    spikeDetail: 1,
    membraneSegments: 64,
    lipidCount: 0,
    dustCount: 260,
    progenyCount: 3,
    ribosomeCount: 18,
    shadows: false,
  },
}

export function isMobileLike(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  return /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua) || (coarse && Math.min(screen.width, screen.height) < 820)
}

/** 首屏启发式选档：宁可先给中档再自动升/降，也不要开局就掉帧。 */
export function detectQuality(): Quality {
  if (typeof window === 'undefined') return 'medium'
  const cores = navigator.hardwareConcurrency ?? 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0
  if (isMobileLike()) return cores >= 8 ? 'medium' : 'low'
  if (cores <= 4 || mem === 1) return 'medium'
  return 'high'
}

/** 探测软件渲染（SwiftShader / llvmpipe）——这类环境必须直接降到最低档。 */
export function isSoftwareRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    if (!dbg) return false
    const renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '')
    return /SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(renderer)
  } catch {
    return false
  }
}
