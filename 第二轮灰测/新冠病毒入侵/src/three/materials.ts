/**
 * 共享材质库。
 *
 * 材质在整个页面生命周期内复用（模块级缓存），避免每次步骤切换重建 shader 造成卡顿；
 * 因此在 JSX 里使用时统一写 `dispose={null}`，防止组件卸载时把共享材质释放掉。
 *
 * 视觉基调：半透明 + 次表面感的生物膜、低粗糙度的蛋白质、强自发光的核酸。
 */

import {
  AdditiveBlending,
  Color,
  DoubleSide,
  FrontSide,
  type Material,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NormalBlending,
  PointsMaterial,
  Vector2,
} from 'three'
import { COLORS } from './palette'
import { glowTexture, lipidNormalTexture, lipidRoughnessTexture, noiseTexture, tailTexture } from './textures'

const cache = new Map<string, Material>()

function cached<T extends Material>(key: string, build: () => T): T {
  const hit = cache.get(key)
  if (hit) return hit as T
  const made = build()
  cache.set(key, made)
  return made
}

export interface ProteinOptions {
  /** 自发光强度（0–1），关键分子用 0.2–0.5 让它在深色背景里“荧光高亮” */
  emissive?: number
  roughness?: number
  metalness?: number
  opacity?: number
  /** 是否加一层清漆，模拟水化蛋白表面的湿润高光 */
  clearcoat?: number
  flatShading?: boolean
  vertexColors?: boolean
  side?: typeof FrontSide | typeof DoubleSide
}

/** 蛋白质通用材质：微粗糙、带清漆高光、可自发光。 */
export function proteinMaterial(color: string, opts: ProteinOptions = {}): MeshPhysicalMaterial {
  const {
    emissive = 0.16,
    roughness = 0.42,
    metalness = 0.04,
    opacity = 1,
    clearcoat = 0.55,
    flatShading = false,
    vertexColors = false,
    side = FrontSide,
  } = opts
  const key = `protein|${color}|${emissive}|${roughness}|${metalness}|${opacity}|${clearcoat}|${flatShading}|${vertexColors}|${side}`
  return cached(key, () => {
    const m = new MeshPhysicalMaterial({
      color: new Color(color),
      roughness,
      metalness,
      clearcoat,
      clearcoatRoughness: 0.35,
      emissive: new Color(color).multiplyScalar(0.9),
      emissiveIntensity: emissive,
      transparent: opacity < 1,
      opacity,
      flatShading,
      vertexColors,
      side,
      sheen: 0.35,
      sheenColor: new Color(color).lerp(new Color('#ffffff'), 0.6),
      sheenRoughness: 0.7,
    })
    if (vertexColors) {
      // 顶点色材质：把 emissive 设为白色基准，再由 vColor 着色（见下方说明）
      m.emissive = new Color('#ffffff')
      tintEmissiveByVertexColor(m)
    }
    return m
  })
}

/**
 * 让自发光跟随顶点色。
 *
 * 背景：刺突这类"一个几何体里含多个结构域"的模型用顶点色区分 S1 / RBD / S2，
 * 而材质本身的 color 是白色，于是 three 的 emissive 也只能是白色 ——
 * 结果"加强自发光"只会把分子洗白，而不是让它按自身配色发出荧光。
 *
 * 这里在片元着色器里把 totalEmissiveRadiance 乘上 vColor，
 * 每个结构域就按自己的颜色发光：刺突橙红、RBD 琥珀、催化位点淡紫……
 * 这正是需求里"荧光高亮关键分子"的实现方式。
 */
function tintEmissiveByVertexColor(material: MeshPhysicalMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor;',
    )
  }
  material.customProgramCacheKey = () => 'dsh-emissive-vcolor'
}

/**
 * 生物膜材质（细胞质膜的两层磷脂头部 / 细胞器膜 / 病毒囊膜外层）。
 * 用磷脂法线贴图产生颗粒感，用 sheen 产生边缘菲涅尔式的柔光轮廓。
 */
export function membraneMaterial(
  color: string,
  opts: {
    opacity?: number
    repeat?: number
    /** 纵向平铺次数，默认与 repeat 相同；球面 UV 需要设成 repeat 的一半 */
    repeatY?: number
    normalScale?: number
    emissive?: number
    sheenColor?: string
    transmission?: number
    depthWrite?: boolean
    side?: typeof FrontSide | typeof DoubleSide
    vertexColors?: boolean
  } = {},
): MeshPhysicalMaterial {
  const {
    opacity = 0.62,
    repeat = 26,
    repeatY = repeat,
    normalScale = 0.75,
    emissive = 0.06,
    sheenColor = COLORS.accent,
    transmission = 0,
    depthWrite = false,
    side = DoubleSide,
    vertexColors = false,
  } = opts
  const key = `membrane|${color}|${opacity}|${repeat}|${repeatY}|${normalScale}|${emissive}|${sheenColor}|${transmission}|${depthWrite}|${side}|${vertexColors}`
  return cached(key, () => {
    const normal = lipidNormalTexture().clone()
    normal.repeat.set(repeat, repeatY)
    normal.anisotropy = 8
    normal.needsUpdate = true
    const rough = lipidRoughnessTexture().clone()
    rough.repeat.set(repeat, repeatY)
    rough.anisotropy = 8
    rough.needsUpdate = true
    return new MeshPhysicalMaterial({
      color: new Color(color),
      normalMap: normal,
      normalScale: new Vector2(normalScale, normalScale),
      roughnessMap: rough,
      roughness: 0.55,
      metalness: 0.02,
      transparent: opacity < 1,
      opacity,
      depthWrite,
      side,
      transmission,
      thickness: transmission > 0 ? 0.6 : 0,
      ior: 1.36,
      clearcoat: 0.45,
      clearcoatRoughness: 0.4,
      // sheen 是"绒感"高光：调到 1 会在整张膜上糊一层近白色的光，
      // 把 ERGIC 的紫、质膜的蓝全洗成灰白（截图分析里发现的问题）。
      // 这里只保留一点边缘柔光，让颜色语义先立住。
      sheen: 0.35,
      sheenColor: new Color(sheenColor),
      sheenRoughness: 0.65,
      emissive: new Color(color),
      emissiveIntensity: emissive,
      vertexColors,
      blending: NormalBlending,
    })
  })
}

/** 脂双层内部的疏水尾部核心：深色、不透明感更强，用条纹贴图表现脂肪酸链。 */
export function bilayerCoreMaterial(color: string, opacity = 0.55, repeat = 30): MeshStandardMaterial {
  const key = `core|${color}|${opacity}|${repeat}`
  return cached(key, () => {
    const map = tailTexture().clone()
    map.repeat.set(repeat, repeat * 0.5)
    map.needsUpdate = true
    return new MeshStandardMaterial({
      color: new Color(color),
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity,
      depthWrite: false,
      side: DoubleSide,
      alphaMap: map,
    })
  })
}

/** 核酸材质：强自发光的“荧光”观感（RNA 荧光绿、负义链偏青）。 */
export function nucleicAcidMaterial(color: string, emissive = 0.95): MeshStandardMaterial {
  const key = `rna|${color}|${emissive}`
  return cached(key, () => {
    return new MeshStandardMaterial({
      color: new Color(color),
      emissive: new Color(color),
      emissiveIntensity: emissive,
      roughness: 0.3,
      metalness: 0,
      toneMapped: true,
    })
  })
}

/** 细胞器材质：低饱和、半透明，退到画面后层，不与关键分子争夺注意力。 */
export function organelleMaterial(
  color: string,
  opts: { opacity?: number; emissive?: number; roughness?: number; side?: typeof FrontSide | typeof DoubleSide } = {},
): MeshPhysicalMaterial {
  const { opacity = 0.5, emissive = 0.05, roughness = 0.6, side = DoubleSide } = opts
  const key = `organelle|${color}|${opacity}|${emissive}|${roughness}|${side}`
  return cached(key, () => {
    const n = noiseTexture().clone()
    n.repeat.set(3, 3)
    n.needsUpdate = true
    return new MeshPhysicalMaterial({
      color: new Color(color),
      roughness,
      metalness: 0.02,
      transparent: true,
      opacity,
      depthWrite: false,
      side,
      roughnessMap: n,
      clearcoat: 0.3,
      sheen: 0.3,
      sheenColor: new Color(color).lerp(new Color('#dff3ff'), 0.35),
      emissive: new Color(color),
      emissiveIntensity: emissive,
    })
  })
}

/** 附加混合的光晕材质：用于高亮环、荧光雾、结合位点闪光。 */
export function glowMaterial(color: string, opacity = 0.7): MeshBasicMaterial {
  const key = `glow|${color}|${opacity}`
  return cached(key, () => {
    return new MeshBasicMaterial({
      color: new Color(color),
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    })
  })
}

/** 贴图化的光晕（sprite 用），比纯色球更柔和。 */
export function spriteGlowMaterial(color: string, opacity = 0.8): MeshBasicMaterial {
  const key = `spriteGlow|${color}|${opacity}`
  return cached(key, () =>
    new MeshBasicMaterial({
      color: new Color(color),
      map: glowTexture(),
      transparent: true,
      opacity,
      blending: AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  )
}

/** 背景尘埃 / 胞质分子噪点。 */
export function dustMaterial(color: string, size = 0.06, opacity = 0.5): PointsMaterial {
  const key = `dust|${color}|${size}|${opacity}`
  return cached(key, () =>
    new PointsMaterial({
      color: new Color(color),
      map: glowTexture(),
      size,
      sizeAttenuation: true,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    }),
  )
}

/** 病毒囊膜：暖色半透明脂双层，高画质下开启真实折射。 */
export function virionEnvelopeMaterial(transmission: boolean): MeshPhysicalMaterial {
  return membraneMaterial(COLORS.envelope, {
    opacity: transmission ? 0.42 : 0.56,
    repeat: 9,
    normalScale: 0.9,
    emissive: 0.1,
    sheenColor: '#ffd2b0',
    transmission: transmission ? 0.34 : 0,
    depthWrite: false,
    side: DoubleSide,
  })
}

/** 供开发期排查用：释放全部缓存材质。 */
export function disposeMaterialCache(): void {
  cache.forEach((m) => m.dispose())
  cache.clear()
}
