/**
 * 程序化贴图：全部在运行时用 TypedArray 生成，零外部资源、零网络请求。
 *
 * 最关键的一张是 `lipidNormalTexture()` —— 六方密排的球形凸起法线贴图，
 * 它让细胞膜与病毒囊膜在 PBR 光照下呈现真实的“磷脂头部颗粒感”，
 * 而不是一张光滑的塑料片；这是需求中“磷脂双分子层质感”的核心实现。
 */

import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace } from 'three'
import { valueNoise2D } from './rand'

function finish(tex: DataTexture, srgb = false): DataTexture {
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  tex.magFilter = LinearFilter
  tex.minFilter = LinearMipmapLinearFilter
  tex.generateMipmaps = true
  if (srgb) tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

/** 六方密排磷脂头部的法线贴图（可平铺）。 */
function buildLipidNormal(size = 256, cols = 8, rows = 10): DataTexture {
  const data = new Uint8Array(size * size * 4)
  const cw = size / cols
  const ch = size / rows
  const headRadius = Math.min(cw, ch) * 0.5
  const half = size / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bestD2 = Infinity
      let bdx = 0
      let bdy = 0
      const j0 = Math.floor(y / ch)
      for (let dj = -1; dj <= 1; dj++) {
        const j = j0 + dj
        const cy = (j + 0.5) * ch
        const rowOffset = (((j % 2) + 2) % 2) * cw * 0.5
        const i0 = Math.floor((x - rowOffset) / cw)
        for (let di = -1; di <= 1; di++) {
          const cx = (i0 + di + 0.5) * cw + rowOffset
          let dx = x - cx
          let dy = y - cy
          if (dx > half) dx -= size
          if (dx < -half) dx += size
          if (dy > half) dy -= size
          if (dy < -half) dy += size
          const d2 = dx * dx + dy * dy
          if (d2 < bestD2) {
            bestD2 = d2
            bdx = dx
            bdy = dy
          }
        }
      }

      const d = Math.sqrt(bestD2) / headRadius
      let nx: number
      let ny: number
      let nz: number
      let height: number
      if (d < 1) {
        // 半球形头部：法线由球面几何给出，再压扁一点避免过强的凹凸感
        const flat = 0.72
        nx = (bdx / headRadius) * flat
        ny = (bdy / headRadius) * flat
        nz = Math.sqrt(Math.max(1e-4, 1 - Math.min(1, d * d)))
        height = Math.sqrt(Math.max(0, 1 - d * d))
      } else {
        // 头部之间的缝隙：轻微噪声，避免死板
        const n = valueNoise2D(x * 0.25, y * 0.25, 7) - 0.5
        nx = n * 0.12
        ny = (valueNoise2D(y * 0.25, x * 0.25, 13) - 0.5) * 0.12
        nz = 1
        height = 0
      }
      const len = Math.hypot(nx, ny, nz) || 1
      const i = (y * size + x) * 4
      data[i] = Math.round(((nx / len) * 0.5 + 0.5) * 255)
      data[i + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255)
      data[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255)
      data[i + 3] = Math.round(height * 255)
    }
  }
  return finish(new DataTexture(data, size, size))
}

/** 由磷脂图案派生的粗糙度贴图：头部略光滑、缝隙略粗糙，增加真实感。 */
function buildLipidRoughness(size = 256, cols = 8, rows = 10): DataTexture {
  const normal = buildLipidNormal(size, cols, rows)
  const src = normal.image.data as Uint8Array
  const data = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const h = src[i * 4 + 3] / 255
    const n = valueNoise2D((i % size) * 0.08, Math.floor(i / size) * 0.08, 21)
    const rough = 0.86 - h * 0.42 + (n - 0.5) * 0.1
    const v = Math.max(0, Math.min(255, Math.round(rough * 255)))
    data[i * 4] = v
    data[i * 4 + 1] = v
    data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }
  normal.dispose()
  return finish(new DataTexture(data, size, size))
}

/** 分形噪声贴图：细胞器表面、细胞质雾的不均匀感。 */
function buildFractalNoise(size = 256): DataTexture {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = 0
      let amp = 0.5
      let freq = 4 / size
      for (let o = 0; o < 4; o++) {
        v += valueNoise2D(x * freq, y * freq, o * 31 + 3) * amp
        amp *= 0.5
        freq *= 2
      }
      const c = Math.max(0, Math.min(255, Math.round(v * 255)))
      const i = (y * size + x) * 4
      data[i] = c
      data[i + 1] = c
      data[i + 2] = c
      data[i + 3] = 255
    }
  }
  return finish(new DataTexture(data, size, size))
}

/** 径向光晕贴图：用于荧光光点、体积光尘埃与选中高亮环。 */
function buildGlow(size = 128, power = 2.6): DataTexture {
  const data = new Uint8Array(size * size * 4)
  const c = (size - 1) / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.min(1, Math.hypot(x - c, y - c) / c)
      const a = Math.pow(1 - d, power)
      const i = (y * size + x) * 4
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
      data[i + 3] = Math.round(a * 255)
    }
  }
  const tex = finish(new DataTexture(data, size, size), true)
  tex.wrapS = tex.wrapT = RepeatWrapping
  return tex
}

/** 疏水尾部的条纹贴图：脂双层内部“栅栏状”脂肪酸链质感。 */
function buildTailStreaks(size = 128): DataTexture {
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const stripe = 0.5 + 0.5 * Math.sin((x / size) * Math.PI * 2 * 24)
      const wobble = valueNoise2D(x * 0.12, y * 0.06, 41)
      const v = Math.max(0, Math.min(1, stripe * 0.55 + wobble * 0.45))
      const i = (y * size + x) * 4
      data[i] = Math.round(v * 255)
      data[i + 1] = Math.round(v * 235)
      data[i + 2] = Math.round(v * 210)
      data[i + 3] = 255
    }
  }
  return finish(new DataTexture(data, size, size))
}

// —— 单例：贴图较贵，全应用共享，生命周期与页面一致 ——
let _lipidNormal: DataTexture | null = null
let _lipidRoughness: DataTexture | null = null
let _noise: DataTexture | null = null
let _glow: DataTexture | null = null
let _tails: DataTexture | null = null

export function lipidNormalTexture(): DataTexture {
  if (!_lipidNormal) _lipidNormal = buildLipidNormal(256, 8, 10)
  return _lipidNormal
}
export function lipidRoughnessTexture(): DataTexture {
  if (!_lipidRoughness) _lipidRoughness = buildLipidRoughness(256, 8, 10)
  return _lipidRoughness
}
export function noiseTexture(): DataTexture {
  if (!_noise) _noise = buildFractalNoise(256)
  return _noise
}
export function glowTexture(): DataTexture {
  if (!_glow) _glow = buildGlow(128, 2.6)
  return _glow
}
export function tailTexture(): DataTexture {
  if (!_tails) _tails = buildTailStreaks(128)
  return _tails
}
