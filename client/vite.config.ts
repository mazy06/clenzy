import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' : le nouveau SW est installe en background mais ne prend PAS
      // le controle automatiquement. On expose un hook useRegisterSW au composant
      // <AppUpdateBanner /> qui affiche une bannière "Nouvelle version disponible
      // — Recharger maintenant" a l'user. Au clic, on appelle updateServiceWorker(true)
      // qui active le nouveau SW + reload la page. Evite la friction du hard refresh
      // pour les users prod qui ne connaissent pas Cmd+Shift+R.
      registerType: 'prompt',
      // favicon.ico retire : on n'a pas de version PNG/ICO, juste l'icon.svg
      // qui suffit (browsers modernes supportent SVG comme favicon depuis 2020+)
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Baitly PMS',
        short_name: 'Baitly',
        description: 'Baitly — Property Management System pour locations courte durée',
        theme_color: '#6B8A9A',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // skipWaiting + clientsClaim a `false` car on est en mode `prompt` :
        // le nouveau SW reste en "waiting" jusqu'a ce que l'user clique
        // "Recharger" dans <AppUpdateBanner />. C'est le hook updateServiceWorker(true)
        // qui envoie le message SKIP_WAITING + reload la page au moment voulu.
        //
        // Si on les laissait a `true`, le nouveau SW prendrait le controle
        // silencieusement et l'user verrait potentiellement des erreurs (chunk
        // hash mismatch entre HTML cache et JS frais) avant le reload.
        skipWaiting: false,
        clientsClaim: false,
        // Cleanup des caches obsoletes au boot du nouveau SW (chunks JS d'une
        // ancienne version qui ne sont plus referenced par le nouvel index.html).
        cleanupOutdatedCaches: true,
        // Strategie reseau-d'abord pour index.html : le SW tente le reseau
        // (3s timeout) avant de tomber sur son cache. Garantit qu'un user
        // online recoit toujours la derniere version.
        //
        // ⚠️ Pas de `navigateFallback: '/index.html'` ici — combine avec
        // `globPatterns` qui exclut html, ça faisait planter Workbox au runtime :
        //   Uncaught (in promise) non-precached-url :: [{"url":"/index.html"}]
        // Workbox cherchait /index.html dans son precache (vide pour html), plantait
        // sur toutes les navigations -> SW casse -> logout freeze + warnings preload.
        //
        // Sans navigateFallback, c'est le runtimeCaching `mode === 'navigate'`
        // ci-dessous qui gere les navigations (NetworkFirst, fallback cache offline).
        navigationPreload: true,
        // index.html EXCLUS du precache (pas de `html` dans globPatterns) — sinon
        // le SW pre-cache l'ancien index.html au build, et meme NetworkFirst
        // peut le servir si le reseau timeout. Avec html exclus, navigation
        // tombe sur runtimeCaching html-cache uniquement (NetworkFirst 3s).
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB — index.js a depasse 3 MB suite aux ajouts payments+payouts P1/P2 (TODO: lazy-load PayoutMethodEditDialog + PaymentProviderConfigDialog via React.lazy pour reduire le bundle initial)
        runtimeCaching: [
          {
            // index.html : NetworkFirst avec fallback cache si offline.
            // Empeche le cache aggresif du SW de servir l'ancien HTML apres deploy.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24, // 1 jour max en fallback offline
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1500, // 1.5 MiB — heic2any pèse ~1.35 MiB en standalone
    rollupOptions: {
      output: {
        // Code-splitting du bundle pour éviter qu'un seul chunk dépasse 2 MiB
        // (utile pour le PWA workbox cache et le TTI initial)
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-mui': [
            '@mui/material',
            '@emotion/react',
            '@emotion/styled',
            '@emotion/cache',
          ],
          'vendor-icons': ['lucide-react', '@iconify/react'],
          'vendor-charts': ['recharts'],
          'vendor-calendar': [
            '@fullcalendar/react',
            '@fullcalendar/daygrid',
            '@fullcalendar/timegrid',
            '@fullcalendar/list',
            '@fullcalendar/interaction',
          ],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-i18n': ['i18next', 'react-i18next', 'i18next-browser-languagedetector'],
          'vendor-stripe': ['@stripe/react-stripe-js', '@stripe/stripe-js'],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/modifiers', '@dnd-kit/utilities'],
          'vendor-map': ['mapbox-gl'],
        },
      },
    },
  },
  // Polyfill `global` -> `window` pour les libs CommonJS qui presupposent
  // un environnement Node (sockjs-client utilise par @stomp/stompjs).
  // Rollup le gere automatiquement au build (prod), mais esbuild en mode
  // dev de Vite non. Sans ca, le bundle plante avec "global is not defined".
  define: {
    global: 'globalThis',
  },
  server: {
    port: 3000,
    host: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
  },
})


