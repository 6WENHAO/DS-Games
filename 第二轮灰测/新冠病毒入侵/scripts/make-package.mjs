/**
 * 生成部署包（零依赖，自带最小 ZIP 写入器）。
 *
 *   node scripts/make-package.mjs            # 打包 dist/ → deploy/sars-cov-2-3d-<version>.zip
 *   node scripts/make-package.mjs --no-zip   # 只生成 deploy/ 目录
 *
 * 包内含：
 *   index.html + assets/**      构建产物（纯静态，可直接丢到任意静态服务器 / CDN）
 *   DEPLOY.md                   部署与验收说明
 *   SCIENCE.md                  科学依据与准确性说明（供评审）
 *
 * 之所以自己写 ZIP：项目要求"零外部依赖 + 可离线交付"，
 * 不希望为了打个包再引入 archiver / jszip 这类依赖。
 */

import { deflateRawSync } from 'node:zlib'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join, relative, resolve } from 'node:path'

const root = resolve(process.argv[1], '../..')
const dist = join(root, 'dist')
const deployDir = join(root, 'deploy')
const noZip = process.argv.includes('--no-zip')

if (!existsSync(dist)) {
  process.stderr.write('未找到 dist/，请先执行 npm run build\n')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const stamp = new Date().toISOString().slice(0, 10)
const name = `sars-cov-2-3d-v${pkg.version}`

// —— CRC32 ——
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosDateTime(date) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() / 2) & 0x1f)
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f)
  return { time, day }
}

/** 极简 ZIP（deflate 存储，无 zip64、无加密），足以交付静态站点。 */
function createZip(entries) {
  const chunks = []
  const central = []
  let offset = 0
  const { time, day } = dosDateTime(new Date())

  for (const { path, data } of entries) {
    const nameBuf = Buffer.from(path, 'utf8')
    const compressed = deflateRawSync(data, { level: 9 })
    const crc = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // UTF-8 文件名
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(day, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)
    chunks.push(local, nameBuf, compressed)

    const dir = Buffer.alloc(46)
    dir.writeUInt32LE(0x02014b50, 0)
    dir.writeUInt16LE(20, 4)
    dir.writeUInt16LE(20, 6)
    dir.writeUInt16LE(0x0800, 8)
    dir.writeUInt16LE(8, 10)
    dir.writeUInt16LE(time, 12)
    dir.writeUInt16LE(day, 14)
    dir.writeUInt32LE(crc, 16)
    dir.writeUInt32LE(compressed.length, 20)
    dir.writeUInt32LE(data.length, 24)
    dir.writeUInt16LE(nameBuf.length, 28)
    dir.writeUInt16LE(0, 30)
    dir.writeUInt16LE(0, 32)
    dir.writeUInt16LE(0, 34)
    dir.writeUInt16LE(0, 36)
    dir.writeUInt32LE(0, 38)
    dir.writeUInt32LE(offset, 42)
    central.push(dir, nameBuf)

    offset += local.length + nameBuf.length + compressed.length
  }

  const cd = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)
  return Buffer.concat([...chunks, cd, end])
}

function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, base, out)
    else out.push({ full, rel: relative(base, full).replace(/\\/g, '/') })
  }
  return out
}

const DEPLOY_DOC = `# 部署说明 · 新冠病毒入侵人体细胞 3D 交互可视化 v${pkg.version}

打包时间：${stamp}

## 一、这是什么

一个**纯静态**的前端站点：只有 HTML / JS / CSS，没有后端、没有数据库、
不发起任何外部网络请求（3D 几何与贴图全部在浏览器里程序化生成）。

## 二、怎么部署

把本目录下的 index.html 与 assets/ 原样上传到任意静态服务器即可，例如：

- Nginx / Apache：放进站点根目录或任意子目录（构建使用相对路径，子目录部署无需改配置）
- 对象存储 + CDN（OSS / COS / S3 + CloudFront 等）：整目录上传，入口设为 index.html
- GitHub Pages / Netlify / Vercel：作为静态站点直接发布

本地快速预览（任选其一）：

    npx serve .
    python -m http.server 8080

> 注意：请通过 HTTP(S) 访问，不要直接双击用 file:// 打开 —— 浏览器会以跨域策略
> 阻止 ES Module 加载。

## 三、服务器建议

- 为 assets/ 下的带哈希文件名的资源设置长缓存（Cache-Control: max-age=31536000, immutable）
- index.html 设为不缓存或短缓存（no-cache），以便发布新版本后立即生效
- 建议开启 gzip / brotli：JS 总体积约 1.4 MB，压缩后约 400 KB

## 四、浏览器要求

需要 WebGL 2（Chrome/Edge 90+、Firefox 90+、Safari 15+、iOS 15+、Android Chrome 90+）。
未启用 WebGL 时页面会给出可读的中文提示，而不是白屏。

## 五、URL 参数（教学与展台预设）

    ?step=4&t=0.6&paused=1      定格在第 4 步 60% 处（讲解用）
    ?quality=high|medium|low    强制画质（同时关闭自动升降档）
    ?labels=0&rotate=0          关闭分子标签 / 关闭自动旋转
    ?perf=1                     显示实时帧率
    ?selftest=1                 运行页面内科学不变量自检并显示结果

## 六、验收自检

在浏览器打开 \`?selftest=1\`，会逐条列出科学不变量与渲染预算的检查结果
（例如"病毒 RNA 全程不进入细胞核""融合孔时序正确"）。
详细说明见随包的 SCIENCE.md。
`

// —— 生成 deploy/ ——
rmSync(deployDir, { recursive: true, force: true })
mkdirSync(deployDir, { recursive: true })

const files = walk(dist)
for (const f of files) {
  const target = join(deployDir, f.rel)
  mkdirSync(join(target, '..'), { recursive: true })
  copyFileSync(f.full, target)
}
writeFileSync(join(deployDir, 'DEPLOY.md'), DEPLOY_DOC, 'utf8')
const sciencePath = join(root, 'docs', 'SCIENCE.md')
if (existsSync(sciencePath)) copyFileSync(sciencePath, join(deployDir, 'SCIENCE.md'))

let totalBytes = 0
const entries = walk(deployDir).map((f) => {
  const data = readFileSync(f.full)
  totalBytes += data.length
  return { path: `${name}/${f.rel}`, data }
})

process.stdout.write(`部署目录：${deployDir}\n`)
process.stdout.write(`  文件数 ${entries.length}，原始体积 ${(totalBytes / 1024).toFixed(1)} KB\n`)

if (!noZip) {
  const zip = createZip(entries)
  const zipPath = join(deployDir, `${name}.zip`)
  writeFileSync(zipPath, zip)
  process.stdout.write(`部署包：${zipPath}\n  压缩后 ${(zip.length / 1024).toFixed(1)} KB\n`)
  process.stdout.write(`（zip 内根目录为 ${name}/，解压后即可上传）\n`)
}

process.stdout.write(`入口文件：${basename(join(deployDir, 'index.html'))}\n`)
