import React, { useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
import rtlPlugin from 'stylis-plugin-rtl'
import { prefixer } from 'stylis'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'
import App from './modules/App'
import AppUpdateBanner from './components/AppUpdateBanner'
import { createBaitlyTheme } from './theme/createBaitlyTheme'
import './theme/signature/tokens.css'
import { applyThemeAttributesAtBoot, applyThemeAttribute } from './theme/signature/accent'
import ThemeSafetyWrapper from './components/ThemeSafetyWrapper'
import { NotificationProvider } from './hooks/useNotification'
import { ThemeModeProvider, useThemeMode } from './hooks/useThemeMode'
import { AccentProvider } from './hooks/useAccent'
import { CurrencyProvider } from './hooks/useCurrency'
import { useGeoDetection } from './hooks/useGeoDetection'
import { AuthProvider } from './contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import './i18n/config'

// ─── Service Worker kill-switch en mode DEV ──────────────────────────────────
// Probleme historique : un SW PWA installe via `npm run preview` ou via un
// container Docker en mode prod reste colle a localhost:3000 et continue a
// servir l'ancien bundle compile (avec ancien composant ClenzyAnimatedLogo +
// ancienne logique d'auth). Symptomes constates :
//   - Hard refresh affiche l'ancien design (goutte d'eau "Propreté & Multiservices")
//   - User authentifie est deconnecte au hard refresh (ancien bundle ne reconnait
//     pas les cookies actuels et redirige vers /login)
//
// Solution : au boot DEV, on desinstalle TOUS les SW + on vide les caches.
// Effet immediat : la page actuelle bypasse l'ancien SW, le prochain refresh
// fetch directement le dev server Vite (plus de souci).
//
// En PROD : ce code ne s'execute pas (import.meta.env.DEV = false) — le SW
// reste actif pour les benefits offline + perf.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void (async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[dev] Detecte ${regs.length} Service Worker(s) — desinstall en cours pour eviter ` +
          `les conflits avec l'ancien bundle PWA. Hard refresh recommande apres.`
        );
        await Promise.all(regs.map((reg) => reg.unregister()));
        // Vider aussi les caches Workbox (sinon le browser peut encore servir
        // des assets cached meme apres unregister du SW).
        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map((key) => caches.delete(key)));
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[dev] SW kill-switch failed:', err);
    }
  })();
}

// ─── Tokens Signature : data-theme / data-accent au boot (anti-FOUC) ─────────
// Pose les attributs sur <html> AVANT le premier render pour que les tokens
// CSS (clair/sombre + teinte d'accent) soient corrects dès le premier paint.
// useThemeMode/AppWithTheme resynchronisent ensuite a chaque changement.
applyThemeAttributesAtBoot()

// ─── Emotion caches for LTR and RTL ─────────────────────────────────────────
const ltrCache = createCache({ key: 'mui' })
const rtlCache = createCache({
  key: 'muirtl',
  stylisPlugins: [prefixer, rtlPlugin],
})

// ─── Sentry — Error tracking & performance monitoring ────────────────────────
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_ENV || 'production',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
  });
}

// ─── PostHog — Product analytics & session replay ────────────────────────────
if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
    person_profiles: 'identified_only',
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    // Z1-SEC-FRONTAUX-03 : le PMS affiche des PII guests (noms, emails,
    // telephones) et des codes d'acces physiques (PIN serrures, boites a
    // cle) en texte rendu. Par defaut PostHog masque les inputs mais PAS
    // le texte rendu → on masque TOUT le texte des enregistrements de
    // session et des events autocapture avant envoi a eu.i.posthog.com.
    mask_all_text: true,
    mask_all_element_attributes: true,
    session_recording: {
      recordCrossOriginIframes: false,
      maskAllInputs: true,
      maskTextSelector: '*',
    },
    persistence: 'localStorage+cookie',
    // Disable /flags + remote config — suppresses 401/404 errors on new
    // projects that have no feature flags configured yet.  Events, session
    // recording & autocapture still work normally.  Set to false (or remove)
    // once you create feature flags in the PostHog dashboard.
    advanced_disable_flags: true,
    loaded: (ph) => {
      if (import.meta.env.DEV) {
        console.log('[PostHog] Ready — distinct_id:', ph.get_distinct_id());
      }
    },
  });
}

// ─── Crisp — Live chat support widget ────────────────────────────────────────
if (import.meta.env.VITE_CRISP_WEBSITE_ID) {
  (window as any).$crisp = [];
  (window as any).CRISP_WEBSITE_ID = import.meta.env.VITE_CRISP_WEBSITE_ID;
  const d = document;
  const s = d.createElement('script');
  s.src = 'https://client.crisp.chat/l.js';
  s.async = true;
  d.getElementsByTagName('head')[0].appendChild(s);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppWithTheme() {
  const { isDark } = useThemeMode();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  // Set document direction on mount and language change
  React.useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language || 'fr';
  }, [isRtl, i18n.language]);

  // Tokens Signature : data-theme suit le mode resolu (clair = defaut :root,
  // sombre = [data-theme="dark"]). La teinte data-accent est geree par
  // theme/signature/accent.ts (boot + selecteur de teinte du Sidebar).
  React.useEffect(() => {
    applyThemeAttribute(isDark);
  }, [isDark]);

  // Theme principal : factory single source of truth (cf. createBaitlyTheme).
  // Tous les ThemeProvider de l'app (AppWithTheme + AuthLayout +
  // InscriptionSuccess/Confirm + Support) DOIVENT passer par cette factory
  // sinon les overrides langue (Tajawal en arabe) + direction RTL sont KO.
  const currentTheme = useMemo(
    () => createBaitlyTheme({ isDark, isRtl }),
    [isDark, isRtl]
  );

  const emotionCache = isRtl ? rtlCache : ltrCache;

  return (
    <CacheProvider value={emotionCache}>
      <ThemeProvider theme={currentTheme}>
        <CssBaseline />
        <CurrencyProvider>
          <GeoDetectionInitializer>
            <NotificationProvider>
              <ThemeSafetyWrapper>
                {/* Opt-in aux future flags React Router v7 :
                    - v7_startTransition : wrap les state updates dans
                      React.startTransition (concurrent rendering).
                    - v7_relativeSplatPath : nouvelle resolution des routes
                      relatives dans les splat routes.
                    Supprime 2 warnings console + prepare la migration v7. */}
                <BrowserRouter
                  future={{
                    v7_startTransition: true,
                    v7_relativeSplatPath: true,
                  }}
                >
                  <AuthProvider>
                    <App />
                    {/* AppUpdateBanner : banniere "Nouvelle version disponible"
                        qui ecoute le SW PWA. Monte au niveau racine pour etre
                        visible sur toutes les routes. Rend null en dev (pas de SW). */}
                    <AppUpdateBanner />
                  </AuthProvider>
                </BrowserRouter>
              </ThemeSafetyWrapper>
            </NotificationProvider>
          </GeoDetectionInitializer>
        </CurrencyProvider>
      </ThemeProvider>
    </CacheProvider>
  );
}

// ─── Geo-detection wrapper (must be inside CurrencyProvider) ─────────────────
function GeoDetectionInitializer({ children }: { children: React.ReactNode }) {
  useGeoDetection();
  return <>{children}</>;
}

// QueryClientProvider est place en racine (avant ThemeModeProvider) car
// ThemeModeProvider utilise useUserPreferences (react-query) pour sync le
// theme avec user_preferences.theme_mode cote backend. CurrencyProvider
// utilise aussi useUserPreferences, mais il est plus profond dans l'arbre
// donc le QueryClient l'enveloppe deja naturellement.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <AccentProvider>
          <AppWithTheme />
        </AccentProvider>
      </ThemeModeProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
