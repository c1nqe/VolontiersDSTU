import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // В разработке запросы к API и фото проксируются на Rust-сервер (cookie остаются «своими» для браузера)
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/graphql': { target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8080', changeOrigin: false },
      '/media': { target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8080', changeOrigin: false },
    },
  },
  preview: { port: 3000 },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // React и Leaflet меняются редко — отдельные чанки долго живут в кэше браузера
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/](maplibre-gl|@maplibre)[\\/]/.test(id)) return 'vendor-maplibre';
          if (/[\\/](leaflet|react-leaflet|@react-leaflet)[\\/]/.test(id)) return 'vendor-leaflet';
          if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          // motion: ядро — в общем чанке, полный набор возможностей (LazyMotion) — отдельным чанком по требованию
          if (/[\\/](motion|motion-dom|motion-utils|framer-motion)[\\/]/.test(id)) return undefined;
          if (/[\\/]animejs[\\/]/.test(id)) return 'vendor-anime';
          return 'vendor';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,jsx}'],
  },
});
