/**
 * 验收用的极简静态服务器（零依赖）。
 *
 *   node scripts/verify-server.mjs [port] [rootDir]
 *
 * 作用：
 *   1) 静态托管 dist/ —— 供无头浏览器加载真实的生产构建；
 *   2) 接收 POST /__report —— 把页面内自检（?selftest=1）的 JSON 结果落盘到
 *      shots/selftest.json，这样自动化流程无需读取浏览器 stdout 就能拿到结果。
 *
 * 生产部署不需要这个脚本，它只服务于本地验收与截图流水线。
 */

import { createServer } from 'node:http'
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync, appendFileSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'

const port = Number(process.argv[2] ?? 4180)
const root = resolve(process.argv[3] ?? 'dist')
const reportDir = resolve('shots')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)

  if (req.method === 'POST' && url.pathname === '/__report') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 4_000_000) req.destroy()
    })
    req.on('end', () => {
      mkdirSync(reportDir, { recursive: true })
      const file = join(reportDir, 'selftest.json')
      writeFileSync(file, body, 'utf8')
      // 同时追加到 jsonl，保留一次运行里的全部上报（含启动错误），便于排查
      appendFileSync(join(reportDir, 'reports.jsonl'), `${body.replace(/\n/g, ' ')}\n`, 'utf8')
      res.writeHead(204).end()
      process.stdout.write(`[verify-server] 自检结果已写入 ${file}\n`)
    })
    return
  }

  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
  let file = join(root, rel || 'index.html')
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
  if (!file.startsWith(root)) {
    res.writeHead(403).end('forbidden')
    return
  }
  if (!existsSync(file)) {
    // SPA 兜底
    file = join(root, 'index.html')
    if (!existsSync(file)) {
      res.writeHead(404).end('not found')
      return
    }
  }
  res.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  })
  createReadStream(file).pipe(res)
})

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`[verify-server] http://127.0.0.1:${port}/  root=${root}\n`)
})
