import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { baitlySiteDiscovery } from './tooling/baitlySiteDiscovery';
import { baitlySiteSeo } from './tooling/baitlySiteSeo';

/**
 * Site marketing Baitly (baitly.ma / baitly.fr) — app Vite séparée du PMS.
 * Réutilise la bibliothèque Baitly UI (client/src/components/ui + theme) sans
 * MUI ni le runtime applicatif. Dev : `npm run dev:site` → http://localhost:3005.
 */
export default defineConfig(() => ({
  root: fileURLToPath(new URL('./site', import.meta.url)),
  // Cache de pré-bundling SÉPARÉ de celui de l'app PMS : partager
  // node_modules/.vite entre les deux roots produit deux copies de React
  // (« Invalid hook call » au boot).
  cacheDir: fileURLToPath(new URL('./node_modules/.vite-site', import.meta.url)),
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        // Le site n'a pas de VitePWA : stub du module virtuel importé par
        // AppUpdateBanner (tiré transitivement par les projections embarquées).
        find: 'virtual:pwa-register/react',
        replacement: fileURLToPath(new URL('./site/pwa-register-stub.ts', import.meta.url)),
      },
      {
        // Carte Baitly embarquée : même résolution que l'app PMS (vite.config.ts),
        // le paquet n'exporte que `.` alors que MapLibre attend le bundle `dist/`.
        find: /^@mapbox\/mapbox-gl-rtl-text\/dist\/mapbox-gl-rtl-text\.js/,
        replacement: fileURLToPath(
          new URL('./node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js', import.meta.url),
        ),
      },
    ],
  },
  optimizeDeps: {
    exclude: ['@mapbox/mapbox-gl-rtl-text'],
  },
  plugins: [react(), tailwindcss(), baitlySiteDiscovery(), baitlySiteSeo()],
  server: {
    port: 3005,
    host: true,
  },
  build: {
    outDir: fileURLToPath(new URL('./dist-site', import.meta.url)),
    emptyOutDir: true,
  },
}));
