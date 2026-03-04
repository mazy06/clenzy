/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MODE: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly SSR: boolean

  // API Backend
  readonly VITE_API_BASE_URL: string
  readonly VITE_API_BASE_PATH: string

  // Keycloak Authentication
  readonly VITE_KEYCLOAK_URL: string
  readonly VITE_KEYCLOAK_REALM: string
  readonly VITE_KEYCLOAK_CLIENT_ID: string

  // Sentry
  readonly VITE_SENTRY_DSN: string
  readonly VITE_ENV: string

  // PostHog
  readonly VITE_POSTHOG_KEY: string
  readonly VITE_POSTHOG_HOST: string

  // Crisp
  readonly VITE_CRISP_WEBSITE_ID: string

  // Mapbox
  readonly VITE_MAPBOX_TOKEN: string

  // Application
  readonly VITE_APP_NAME: string
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
