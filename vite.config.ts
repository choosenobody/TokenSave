import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html',
        app: './app/index.html',
      },
    },
  },
  server: {
    port: 5173,
  },
});
