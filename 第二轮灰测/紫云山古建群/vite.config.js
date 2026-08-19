import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: false,
    watch: {
      // 避免监视截图 / 缓存等易被占用的目录（否则 Windows 下可能 EBUSY）
      ignored: ['**/dist/**', '**/.tmp/**', '**/.npm-cache/**', '**/preview/**']
    }
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1600
  }
});
