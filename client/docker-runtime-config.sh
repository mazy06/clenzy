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
emit VITE_MAP_TILES_URL          "${VITE_MAP_TILES_URL:-}"
emit VITE_MAP_ASSETS_URL         "${VITE_MAP_ASSETS_URL:-}"
emit VITE_MAP_TERRAIN_URL        "${VITE_MAP_TERRAIN_URL:-}"
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

# ─── Académie Baitly : vidéos servies sous /academie/media/ ────────────────────
# Le site lit ses vidéos sur SON domaine (/academie/media/...), ce que la CSP
# autorise (media-src 'self'). Quand BAITLY_ACADEMY_MEDIA_ORIGIN est defini, par
# exemple https://<bucket>.s3.gra.io.cloud.ovh.net/academie, nginx relaie ce
# chemin vers le stockage objet (lecture seule, sans cookies) et Cloudflare met
# les fichiers en cache. Variable absente : aucun relais ; la page Academie
# affiche alors un message a la place de la video.
# Voir marketing/academie/PUBLICATION.md.
ACADEMY_DIR="${BAITLY_ACADEMY_NGINX_DIR:-/etc/nginx/baitly-academy}"
mkdir -p "$ACADEMY_DIR"
rm -f "$ACADEMY_DIR/media.conf"
if [ -n "${BAITLY_ACADEMY_MEDIA_ORIGIN:-}" ]; then
  origin="${BAITLY_ACADEMY_MEDIA_ORIGIN%/}"
  rest="${origin#https://}"
  host="${rest%%/*}"
  path="${rest#"$host"}"
  # Valeurs injectees dans la configuration nginx : https, caracteres d'un nom DNS et d'un chemin
  # simple. Une valeur invalide n'empeche pas le site de demarrer : le relais est seulement omis.
  academy_error=""
  case "$origin" in https://*) ;; *) academy_error="doit commencer par https://" ;; esac
  case "$host" in ''|*[!A-Za-z0-9.-]*) academy_error="hote invalide" ;; esac
  case "$path" in *[!A-Za-z0-9/_.-]*|*..*) academy_error="chemin invalide" ;; esac
  academy_resolver="${BAITLY_ACADEMY_RESOLVER:-127.0.0.11}"
  case "$academy_resolver" in ''|*[!A-Za-z0-9.:\ -]*) academy_error="resolveur invalide" ;; esac
fi
if [ -n "${BAITLY_ACADEMY_MEDIA_ORIGIN:-}" ] && [ -n "$academy_error" ]; then
  echo "[entrypoint] BAITLY_ACADEMY_MEDIA_ORIGIN ignoree ($academy_error) : pas de relais des videos" >&2
elif [ -n "${BAITLY_ACADEMY_MEDIA_ORIGIN:-}" ]; then
  cat > "$ACADEMY_DIR/media.conf" <<NGINX
location ^~ /academie/media/ {
  limit_except GET HEAD { deny all; }
  resolver $academy_resolver valid=300s ipv6=off;
  set \$baitly_academy_host "$host";
  rewrite ^/academie/media/(.*)\$ $path/\$1 break;
  proxy_pass https://\$baitly_academy_host;
  proxy_set_header Host \$baitly_academy_host;
  proxy_ssl_server_name on;
  proxy_ssl_name \$baitly_academy_host;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_set_header Cookie "";
  proxy_set_header Authorization "";
  proxy_hide_header Set-Cookie;
  add_header Cache-Control "public, max-age=2592000" always;
  add_header X-Content-Type-Options "nosniff" always;
}
NGINX
fi

# ─── Carte Baitly : tuiles et ressources de style servies sous /maps/ ──────────
# Le front lit la carte sur SON domaine (/maps/baitly.pmtiles, /maps/assets/...) :
# ni CSP a elargir, ni CORS. Quand BAITLY_MAPS_ORIGIN est defini, par exemple
# https://<bucket>.s3.gra.io.cloud.ovh.net/maps, nginx relaie ce chemin vers le
# conteneur PUBLIC des cartes (lecture seule, sans cookies). L'en-tete Range passe
# tel quel : PMTiles ne lit l'archive que par plages d'octets. Le Cache-Control
# pose au televersement (scripts/maps/upload-baitly-tiles.sh) est conserve.
# Variable absente : /maps/ repond 404 — jamais le repli SPA (index.html), que
# MapLibre tenterait de decoder comme une archive.
MAPS_DIR="${BAITLY_MAPS_NGINX_DIR:-/etc/nginx/baitly-maps}"
mkdir -p "$MAPS_DIR"
rm -f "$MAPS_DIR/maps.conf" "$MAPS_DIR/maps-cache.http"
maps_error=""
if [ -n "${BAITLY_MAPS_ORIGIN:-}" ]; then
  maps_origin="${BAITLY_MAPS_ORIGIN%/}"
  maps_rest="${maps_origin#https://}"
  maps_host="${maps_rest%%/*}"
  maps_path="${maps_rest#"$maps_host"}"
  case "$maps_origin" in https://*) ;; *) maps_error="doit commencer par https://" ;; esac
  case "$maps_host" in ''|*[!A-Za-z0-9.-]*) maps_error="hote invalide" ;; esac
  case "$maps_path" in *[!A-Za-z0-9/_.-]*|*..*) maps_error="chemin invalide" ;; esac
  maps_resolver="${BAITLY_MAPS_RESOLVER:-127.0.0.11}"
  case "$maps_resolver" in ''|*[!A-Za-z0-9.:\ -]*) maps_error="resolveur invalide" ;; esac
  case "${BAITLY_MAPS_CACHE_MAX_SIZE:-2g}" in *[!0-9]*[!kmg]|[!0-9]*|*[!0-9kmg]*) maps_error="taille de cache invalide" ;; esac
fi
if [ -n "${BAITLY_MAPS_ORIGIN:-}" ] && [ -z "$maps_error" ]; then
  # Cache local par tranches : chaque tuile est une requete Range dans une archive de
  # plusieurs Go, que Cloudflare ne met pas en cache (180-500 ms vers le stockage a
  # chaque fois). nginx garde des tranches de 256 Ko : les zones consultees ne
  # repartent plus vers le stockage. La duree suit le Cache-Control des objets.
  cat > "$MAPS_DIR/maps-cache.http" <<NGINX
proxy_cache_path /var/cache/nginx/baitly-maps levels=1:2 keys_zone=baitly_maps:20m
                 max_size=${BAITLY_MAPS_CACHE_MAX_SIZE:-2g} inactive=7d use_temp_path=off;
NGINX
  cat > "$MAPS_DIR/maps.conf" <<NGINX
location ^~ /maps/ {
  limit_except GET HEAD { deny all; }
  slice 256k;
  proxy_cache baitly_maps;
  proxy_cache_key \$uri\$slice_range;
  proxy_set_header Range \$slice_range;
  proxy_cache_valid 200 206 1h;
  proxy_cache_lock on;
  proxy_cache_lock_timeout 5s;
  proxy_cache_use_stale error timeout updating;
  add_header X-Baitly-Maps-Cache \$upstream_cache_status always;
  resolver $maps_resolver valid=300s ipv6=off;
  set \$baitly_maps_host "$maps_host";
  rewrite ^/maps/(.*)\$ $maps_path/\$1 break;
  proxy_pass https://\$baitly_maps_host;
  proxy_set_header Host \$baitly_maps_host;
  proxy_ssl_server_name on;
  proxy_ssl_name \$baitly_maps_host;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_set_header Cookie "";
  proxy_set_header Authorization "";
  proxy_hide_header Set-Cookie;
  add_header X-Content-Type-Options "nosniff" always;
}
NGINX
else
  [ -n "$maps_error" ] && echo "[entrypoint] BAITLY_MAPS_ORIGIN ignoree ($maps_error) : carte indisponible" >&2
  cat > "$MAPS_DIR/maps.conf" <<NGINX
location ^~ /maps/ {
  return 404;
}
NGINX
fi
