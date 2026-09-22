#!/bin/sh
# ===========================================
# Baitly — configuration d'execution des conteneurs front (PMS et landing)
# ===========================================
# Ecrit /baitly-config.js a partir des variables d'environnement, avant que
# nginx ne demarre. C'est ce qui permet a UNE image de servir N instances (clenzy.fr,
# baitly.fr, ...) : l'URL de l'API et celle de Keycloak ne sont plus gravees
# dans le bundle au build.
#
# Le fichier est lu par `src/config/runtimeConfig.ts`, charge depuis
# `index.html` avant le bundle. Une variable absente est ecrite vide, et
# `runtimeConfig` retombe alors sur la valeur de build puis sur son defaut.
#
# Installe dans /docker-entrypoint.d/ : l'image nginx execute tout `.sh`
# executable de ce repertoire au demarrage, puis lance nginx elle-meme. On ne
# remplace donc PAS l'entrypoint officiel (qui traite les templates et regle
# les workers) — on s'y greffe.
#
# ATTENTION : `nginx.conf` doit servir /baitly-config.js en `no-cache`. Sans
# cela la regle de cache des `.js` (1 an, immutable) figerait la configuration
# dans le navigateur des visiteurs, et un changement de domaine ne serait
# jamais pris en compte.

set -e

CONFIG_FILE="${BAITLY_CONFIG_FILE:-/usr/share/nginx/html/baitly-config.js}"

# Echappe pour insertion dans un litteral JS entre guillemets doubles.
esc() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

emit() {
  printf '  %s: "%s",\n' "$1" "$(esc "$2")" >> "$CONFIG_FILE"
}

printf '// Genere au demarrage du conteneur. Ne pas editer.\nwindow.__baitlyConfig = {\n' > "$CONFIG_FILE"

emit VITE_API_BASE_URL           "${VITE_API_BASE_URL:-}"
emit VITE_API_BASE_PATH          "${VITE_API_BASE_PATH:-}"
emit VITE_KEYCLOAK_URL           "${VITE_KEYCLOAK_URL:-}"
emit VITE_KEYCLOAK_REALM         "${VITE_KEYCLOAK_REALM:-}"
emit VITE_KEYCLOAK_CLIENT_ID     "${VITE_KEYCLOAK_CLIENT_ID:-}"
emit VITE_APP_NAME               "${VITE_APP_NAME:-}"
emit VITE_ENV                    "${VITE_ENV:-}"
emit VITE_STRIPE_PUBLISHABLE_KEY "${VITE_STRIPE_PUBLISHABLE_KEY:-}"
emit VITE_SENTRY_DSN             "${VITE_SENTRY_DSN:-}"
emit VITE_POSTHOG_KEY            "${VITE_POSTHOG_KEY:-}"
emit VITE_POSTHOG_HOST           "${VITE_POSTHOG_HOST:-}"
emit VITE_MAPBOX_TOKEN           "${VITE_MAPBOX_TOKEN:-}"
emit VITE_BAITLY_CAPTCHA_ENABLED "${VITE_BAITLY_CAPTCHA_ENABLED:-false}"
emit VITE_TURNSTILE_SITE_KEY     "${VITE_TURNSTILE_SITE_KEY:-}"
emit VITE_CRISP_WEBSITE_ID       "${VITE_CRISP_WEBSITE_ID:-}"

# Landing Baitly (image clenzy-baitly-site) — ignorees par le bundle du PMS.
emit VITE_API_URL                "${VITE_API_URL:-}"
emit VITE_APP_URL                "${VITE_APP_URL:-}"

printf '};\n' >> "$CONFIG_FILE"

echo "[entrypoint] $CONFIG_FILE genere (API=${VITE_API_BASE_URL:-<build>}, KC=${VITE_KEYCLOAK_URL:-<build>})"

# Lance la commande quand on nous en passe une (usage ENTRYPOINT autonome).
# Dans /docker-entrypoint.d/ le script est appele SANS argument : on rend la
# main a l'entrypoint nginx, qui demarre le serveur.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
