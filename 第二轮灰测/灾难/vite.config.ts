import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: false,
    watch: {
      // editors that write atomically drop temp dirs next to the file; watching
      // them makes chokidar throw EBUSY on Windows
      ignored: ['**/.*.tmpdir/**', '**/*.tmp', '**/shots/**', '**/tools/**'],
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
  },
});
