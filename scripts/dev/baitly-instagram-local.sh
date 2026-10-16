#!/bin/sh
# À exécuter par l'utilisateur : reconstruit et recharge seulement le serveur local.
set -eu
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
task_infra="$task_root/../clenzy-infra"
task_private="$task_root/.env.baitly-instagram.local"
test -f "$task_private" || { echo "Configuration Instagram locale manquante" >&2; exit 1; }
set -- --project-directory "$task_infra" \
  --env-file "$task_infra/.env.dev"
if test -f "$task_root/.env.baitly-stripe.local"; then
  set -- "$@" --env-file "$task_root/.env.baitly-stripe.local"
fi
set -- "$@" --env-file "$task_private" \
  -f "$task_infra/docker-compose.dev.yml"
if test -f "$task_root/.env.baitly-stripe.local"; then
  set -- "$@" -f "$task_root/scripts/payments/docker-compose.stripe-sandbox-env.yml"
fi
set -- "$@" -f "$task_root/scripts/dev/docker-compose.baitly-instagram.yml"
# Ne jamais afficher la configuration résolue : elle contient les secrets.
rtk proxy docker compose "$@" config --quiet
rtk proxy docker compose "$@" up -d --build --no-deps pms-server
