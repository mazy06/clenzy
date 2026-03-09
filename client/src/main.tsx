import React, { useMemo } from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'
import rtlPlugin from 'stylis-plugin-rtl'
import { prefixer } from 'stylis'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Sentry from '@sentry/react'
import posthog from 'posthog-js'
import App from './modules/App'
import lightTheme from './theme/theme'
import darkTheme from './theme/darkTheme'
import ThemeSafetyWrapper from './components/ThemeSafetyWrapper'
import { NotificationProvider } from './hooks/useNotification'
import { ThemeModeProvider, useThemeMode } from './hooks/useThemeMode'
import { CurrencyProvider } from './hooks/useCurrency'
import { useGeoDetection } from './hooks/useGeoDetection'
import { useTranslation } from 'react-i18next'
import './i18n/config'

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
    session_recording: {
      recordCrossOriginIframes: false,
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

  const currentTheme = useMemo(() => {
    const baseTheme = isDark ? darkTheme : lightTheme;
    return createTheme({
      ...baseTheme,
      direction: isRtl ? 'rtl' : 'ltr',
    });
  }, [isDark, isRtl]);

  const emotionCache = isRtl ? rtlCache : ltrCache;

  return (
    <CacheProvider value={emotionCache}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={currentTheme}>
          <CssBaseline />
          <CurrencyProvider>
            <GeoDetectionInitializer>
              <NotificationProvider>
                <ThemeSafetyWrapper>
                  <BrowserRouter>
                    <App />
                  </BrowserRouter>
                </ThemeSafetyWrapper>
              </NotificationProvider>
            </GeoDetectionInitializer>
          </CurrencyProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </CacheProvider>
  );
}

// ─── Geo-detection wrapper (must be inside CurrencyProvider) ─────────────────
function GeoDetectionInitializer({ children }: { children: React.ReactNode }) {
  useGeoDetection();
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeModeProvider>
      <AppWithTheme />
    </ThemeModeProvider>
  </React.StrictMode>
)
