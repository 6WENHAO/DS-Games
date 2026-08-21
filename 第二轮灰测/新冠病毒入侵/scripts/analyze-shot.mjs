/**
 * 截图像素分析（零依赖）—— 用于自动化「视觉验收」。
 *
 *   node scripts/analyze-shot.mjs shots/step03.png
 *   node scripts/analyze-shot.mjs shots            # 分析目录下所有 png
 *
 * 为什么需要它：验收要求“视觉精美、关键分子配色正确”，但自动化流程没有人眼。
 * 于是这里直接解码 PNG，统计画面是否真的渲染出了内容、以及需求约定的四种关键配色
 * （刺突橙红 / ACE2 青蓝 / RNA 荧光绿 / TMPRSS2 紫）各占多少像素，
 * 从而把“画面对不对”变成可断言的数字。
 *
 * 只支持 Chrome 截图产出的 8 位非隔行 PNG（颜色类型 2/6），足够本项目使用。
 */

import { inflateSync } from 'node:zlib'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG 文件')
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const idat = []

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
      interlace = data[12]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }

  if (bitDepth !== 8) throw new Error(`仅支持 8 位深度，当前 ${bitDepth}`)
  if (interlace !== 0) throw new Error('不支持隔行 PNG')
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0
  if (!channels) throw new Error(`仅支持颜色类型 2/6，当前 ${colorType}`)

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const out = Buffer.alloc(height * stride)
  let pos = 0
  let prevRow = Buffer.alloc(stride)

  for (let y = 0; y < height; y++) {
    const filter = raw[pos++]
    const row = raw.subarray(pos, pos + stride)
    pos += stride
    const cur = Buffer.from(row)
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0
      const b = prevRow[x]
      const c = x >= channels ? prevRow[x - channels] : 0
      switch (filter) {
        case 0:
          break
        case 1:
          cur[x] = (cur[x] + a) & 0xff
          break
        case 2:
          cur[x] = (cur[x] + b) & 0xff
          break
        case 3:
          cur[x] = (cur[x] + ((a + b) >> 1)) & 0xff
          break
        case 4: {
          const p = a + b - c
          const pa = Math.abs(p - a)
          const pb = Math.abs(p - b)
          const pc = Math.abs(p - c)
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
          cur[x] = (cur[x] + pred) & 0xff
          break
        }
        default:
          throw new Error(`未知的行滤波器 ${filter}`)
      }
    }
    cur.copy(out, y * stride)
    prevRow = cur
  }
  return { width, height, channels, data: out }
}

function rgbToHsl(r, g, b) {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l]
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / d + 2) / 6
  else h = ((rn - gn) / d + 4) / 6
  return [h * 360, s, l]
}

/** 需求约定的关键配色（色相区间 + 最低饱和度/亮度） */
const BUCKETS = [
  { key: 'spikeOrange', label: '刺突橙红', hue: [4, 42], minSat: 0.32, minLight: 0.16 },
  { key: 'ace2Cyan', label: 'ACE2 青蓝', hue: [168, 200], minSat: 0.3, minLight: 0.2 },
  { key: 'rnaGreen', label: 'RNA 荧光绿', hue: [120, 165], minSat: 0.32, minLight: 0.24 },
  { key: 'tmprss2Violet', label: 'TMPRSS2 紫', hue: [258, 296], minSat: 0.24, minLight: 0.18 },
  { key: 'nProteinPink', label: 'N 蛋白粉', hue: [310, 350], minSat: 0.28, minLight: 0.2 },
]

export function analyze(file) {
  const png = decodePng(readFileSync(file))
  const { width, height, channels, data } = png
  const total = width * height
  const counts = Object.fromEntries(BUCKETS.map((b) => [b.key, 0]))
  let lumaSum = 0
  let litPixels = 0
  let brightPixels = 0

  for (let i = 0; i < total; i++) {
    const o = i * channels
    const r = data[o]
    const g = data[o + 1]
    const b = data[o + 2]
    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
    lumaSum += luma
    if (luma > 0.06) litPixels++
    if (luma > 0.45) brightPixels++
    const [h, s, l] = rgbToHsl(r, g, b)
    for (const bucket of BUCKETS) {
      if (s >= bucket.minSat && l >= bucket.minLight && h >= bucket.hue[0] && h <= bucket.hue[1]) {
        counts[bucket.key]++
        break
      }
    }
  }

  const pct = (n) => Number(((n / total) * 100).toFixed(3))
  return {
    file,
    width,
    height,
    meanLuma: Number((lumaSum / total).toFixed(4)),
    litRatio: pct(litPixels),
    brightRatio: pct(brightPixels),
    colors: Object.fromEntries(BUCKETS.map((b) => [b.key, pct(counts[b.key])])),
  }
}

/**
 * 文本预览：把截图降采样成字符画，用字母表示主色相、大小写表示明暗。
 *
 * 这是给"看不到图片的自动化流程"准备的眼睛 —— 能直接读出构图：
 * 主体在不在画面中央、细胞膜是不是一条横带、关键分子的颜色分布对不对。
 *
 *   . : + #   低饱和（背景 / 灰白结构，由暗到亮）
 *   o O       橙红（刺突）        c C  青蓝（ACE2 / 高亮）
 *   g G       绿（RNA）          v V  紫（TMPRSS2 / ERGIC）
 *   p P       粉（N 蛋白）        b B  蓝（宿主膜 / 细胞器）
 *   y Y       黄（E 蛋白 / 琥珀）  r R  红（警示）
 */
export function preview(file, cols = 78, rows = 30) {
  const png = decodePng(readFileSync(file))
  const { width, height, channels, data } = png
  const lines = []
  for (let ry = 0; ry < rows; ry++) {
    let line = ''
    for (let rx = 0; rx < cols; rx++) {
      const x0 = Math.floor((rx / cols) * width)
      const x1 = Math.max(x0 + 1, Math.floor(((rx + 1) / cols) * width))
      const y0 = Math.floor((ry / rows) * height)
      const y1 = Math.max(y0 + 1, Math.floor(((ry + 1) / rows) * height))
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const o = (y * width + x) * channels
          r += data[o]
          g += data[o + 1]
          b += data[o + 2]
          n++
        }
      }
      r /= n
      g /= n
      b /= n
      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      const [h, s] = rgbToHsl(r, g, b)
      let ch
      if (luma < 0.05) ch = ' '
      else if (s < 0.2) ch = luma < 0.12 ? '.' : luma < 0.28 ? ':' : luma < 0.5 ? '+' : '#'
      else {
        let letter = '?'
        if (h < 12 || h >= 340) letter = 'r'
        else if (h < 42) letter = 'o'
        else if (h < 70) letter = 'y'
        else if (h < 165) letter = 'g'
        else if (h < 205) letter = 'c'
        else if (h < 255) letter = 'b'
        else if (h < 300) letter = 'v'
        else letter = 'p'
        ch = luma > 0.34 ? letter.toUpperCase() : letter
      }
      line += ch
    }
    lines.push(line)
  }
  return lines.join('\n')
}

const target = resolve(process.argv[2] ?? 'shots')
const wantPreview = process.argv.includes('--preview')
const files = statSync(target).isDirectory()
  ? readdirSync(target)
      .filter((f) => extname(f).toLowerCase() === '.png')
      .sort()
      .map((f) => join(target, f))
  : [target]

if (wantPreview) {
  for (const f of files) {
    process.stdout.write(`\n=== ${f.split(/[\\/]/).pop()} ===\n`)
    try {
      process.stdout.write(`${preview(f)}\n`)
    } catch (err) {
      process.stdout.write(`ERROR ${String(err.message ?? err)}\n`)
    }
  }
  process.exit(0)
}

const rows = []
for (const f of files) {
  try {
    rows.push(analyze(f))
  } catch (err) {
    rows.push({ file: f, error: String(err.message ?? err) })
  }
}

const pad = (s, n) => String(s).padEnd(n)
process.stdout.write(
  `${pad('文件', 22)}${pad('尺寸', 12)}${pad('平均亮度', 10)}${pad('有效像素%', 11)}${pad('橙红%', 9)}${pad('青蓝%', 9)}${pad('绿%', 9)}${pad('紫%', 9)}${pad('粉%', 8)}\n`,
)
for (const r of rows) {
  if (r.error) {
    process.stdout.write(`${pad(r.file.split(/[\\/]/).pop(), 22)}ERROR ${r.error}\n`)
    continue
  }
  const c = r.colors
  process.stdout.write(
    `${pad(r.file.split(/[\\/]/).pop(), 22)}${pad(`${r.width}x${r.height}`, 12)}${pad(r.meanLuma, 10)}${pad(r.litRatio, 11)}${pad(c.spikeOrange, 9)}${pad(c.ace2Cyan, 9)}${pad(c.rnaGreen, 9)}${pad(c.tmprss2Violet, 9)}${pad(c.nProteinPink, 8)}\n`,
  )
}
process.stdout.write(`\nJSON: ${JSON.stringify(rows)}\n`)
