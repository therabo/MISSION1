import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const cesiumSource = 'node_modules/cesium/Build/Cesium';
const cesiumBaseUrl = '/cesiumStatic';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: ['Workers', 'Assets', 'Widgets', 'ThirdParty'].map((folder) => ({
        src: `${cesiumSource}/${folder}/**/*`,
        dest: `cesiumStatic/${folder}`,
        rename: { stripBase: 5 },
      })),
    }),
  ],
  define: { CESIUM_BASE_URL: JSON.stringify(cesiumBaseUrl) },
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true } },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
