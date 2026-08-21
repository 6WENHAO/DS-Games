import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 相对 base：构建产物可直接放到任意静态目录 / CDN 子路径下。
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // 按包边界精确切分，避免 @react-three/* 之类同时含 "react" 与 "three" 字样的路径被误判
        manualChunks(id) {
          const norm = id.replace(/\\/g, '/')
          if (!norm.includes('/node_modules/')) return undefined
          if (/\/node_modules\/three\//.test(norm)) return 'three'
          if (/\/node_modules\/postprocessing\//.test(norm)) return 'postfx'
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(norm)) return 'react'
          return 'vendor'
        },
      },
    },
  },
})
