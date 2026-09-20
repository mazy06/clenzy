/**
 * Configuration resolue a l'EXECUTION, pas au build.
 *
 * <p>Le probleme qu'elle resout : `import.meta.env.VITE_*` est substitue
 * textuellement par Vite au moment du build. L'URL de l'API et celle de
 * Keycloak finissaient donc gravees dans le bundle, et l'image publiee sur
 * GHCR ne pouvait servir qu'UN seul domaine. Deployer une seconde instance
 * (baitly.fr a cote de clenzy.fr) imposait de rebuilder et de republier une
 * image par domaine.</p>
 *
 * <p>Partage par le PMS (`src/`) et par la landing Baitly (`site/`) : les deux
 * images embarquent le meme `docker-runtime-config.sh`.</p>
 *
 * <p>Desormais le conteneur ecrit `/baitly-config.js` a son demarrage
 * (cf. `docker-entrypoint.sh`), charge par `index.html` AVANT le bundle. Une
 * seule image sert N instances : seules les variables d'environnement du
 * conteneur changent.</p>
 *
 * <p>Ordre de resolution : valeur runtime -> valeur de build -> defaut.
 * Le repli sur le build preserve le confort du `vite dev` local, ou aucun
 * `/baitly-config.js` n'est genere et ou les `.env` continuent de primer.</p>
 */

export type RuntimeConfigKey =
  | 'VITE_API_BASE_URL'
  | 'VITE_API_BASE_PATH'
  | 'VITE_KEYCLOAK_URL'
  | 'VITE_KEYCLOAK_REALM'
  | 'VITE_KEYCLOAK_CLIENT_ID'
  | 'VITE_APP_NAME'
  | 'VITE_ENV'
  | 'VITE_STRIPE_PUBLISHABLE_KEY'
  | 'VITE_SENTRY_DSN'
  | 'VITE_POSTHOG_KEY'
  | 'VITE_POSTHOG_HOST'
  | 'VITE_MAPBOX_TOKEN'
  | 'VITE_TURNSTILE_SITE_KEY'
  | 'VITE_CRISP_WEBSITE_ID'
  // Cles propres a la landing Baitly (bundle `site/`, image clenzy-baitly-site).
  | 'VITE_API_URL'
  | 'VITE_APP_URL';

declare global {
  interface Window {
    __baitlyConfig?: Partial<Record<RuntimeConfigKey, string>>;
  }
}

/**
 * Valeurs de build.
 *
 * <p>Chaque acces est ecrit EN TOUTES LETTRES, volontairement : Vite substitue
 * `import.meta.env.VITE_FOO` par analyse textuelle. Un acces indexe
 * (`import.meta.env[key]`) n'est PAS substitue et vaudrait `undefined` dans le
 * bundle de production — panne silencieuse. Ne pas « factoriser » cette
 * table en boucle.</p>
 */
const BUILD_TIME: Partial<Record<RuntimeConfigKey, string>> = {
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_API_BASE_PATH: import.meta.env.VITE_API_BASE_PATH,
  VITE_KEYCLOAK_URL: import.meta.env.VITE_KEYCLOAK_URL,
  VITE_KEYCLOAK_REALM: import.meta.env.VITE_KEYCLOAK_REALM,
  VITE_KEYCLOAK_CLIENT_ID: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
  VITE_ENV: import.meta.env.VITE_ENV,
  VITE_STRIPE_PUBLISHABLE_KEY: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
  VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  VITE_POSTHOG_KEY: import.meta.env.VITE_POSTHOG_KEY,
  VITE_POSTHOG_HOST: import.meta.env.VITE_POSTHOG_HOST,
  VITE_MAPBOX_TOKEN: import.meta.env.VITE_MAPBOX_TOKEN,
  VITE_TURNSTILE_SITE_KEY: import.meta.env.VITE_TURNSTILE_SITE_KEY,
  VITE_CRISP_WEBSITE_ID: import.meta.env.VITE_CRISP_WEBSITE_ID,
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_APP_URL: import.meta.env.VITE_APP_URL,
};

const clean = (value: string | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * Valeur runtime, repli build, sinon `undefined`.
 *
 * <p>Une chaine vide compte pour absente : l'entrypoint ecrit toutes les cles,
 * y compris celles que l'operateur n'a pas renseignees, et une cle vide doit
 * laisser le repli s'appliquer plutot que d'ecraser le defaut par du vide.</p>
 */
export function runtimeEnv(key: RuntimeConfigKey): string | undefined {
  const fromRuntime =
    typeof window !== 'undefined' ? clean(window.__baitlyConfig?.[key]) : undefined;
  return fromRuntime ?? clean(BUILD_TIME[key]);
}

/** Variante avec defaut, pour les cles qui doivent toujours valoir quelque chose. */
export function runtimeEnvOr(key: RuntimeConfigKey, fallback: string): string {
  return runtimeEnv(key) ?? fallback;
}
