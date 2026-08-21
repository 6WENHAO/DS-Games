import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { reportSelfTest } from './scene/SelfTest'
import { applyUrlOverrides } from './state/urlState'
import './styles/global.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root 未找到')

// 自检模式下把运行期错误也回传，避免"页面白屏但拿不到原因"
if (new URLSearchParams(window.location.search).get('selftest') === '1') {
  reportSelfTest({ verdict: 'BOOT', stage: 'main.tsx 已执行' })
  window.addEventListener('error', (e) => {
    reportSelfTest({ verdict: 'ERROR', error: e.message, source: `${e.filename}:${e.lineno}:${e.colno}`, stack: e.error?.stack ?? null })
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason as { message?: string; stack?: string } | undefined
    reportSelfTest({ verdict: 'ERROR', error: reason?.message ?? String(e.reason), stack: reason?.stack ?? null })
  })
}

// 先应用 URL 预设（深链接 / 教学预设 / 截图定格），再挂载应用
applyUrlOverrides()

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
