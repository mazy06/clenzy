import { defineConfig } from 'vite';

/**
 * Build STANDALONE du SDK widget de réservation (P1 — « rendre les sites bookables »).
 * Produit un bundle IIFE auto-suffisant exposant `window.BaitlyBooking` (cf. sdk/index.ts), CSS
 * du widget inlinée (imports `?raw` → Shadow DOM). Aucun React (le widget est vanilla DOM).
 *
 * Usage : `npm run build:sdk` → public/booking/v1/clenzy-booking.min.js
 * Servi par l'app à `https://app.clenzy.fr/booking/v1/clenzy-booking.min.js`, chargé par le service
 * SSR « clenzy-sites » et par tout embed tiers (script-tag). `prebuild` le génère avant le build SPA.
 */
export default defineConfig({
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    lib: {
      entry: 'src/modules/booking-engine/sdk/index.ts',
      name: 'BaitlyBooking',
      formats: ['iife'],
      fileName: () => 'clenzy-booking.min.js',
    },
    outDir: 'public/booking/v1',
    emptyOutDir: true,
    minify: 'esbuild',
    sourcemap: false,
  },
});
