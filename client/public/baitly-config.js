// Configuration d'execution — PLACEHOLDER de developpement.
//
// En production, ce fichier est REECRIT au demarrage du conteneur par
// `docker-runtime-config.sh` a partir des variables d'environnement. L'objet vide
// ci-dessous laisse `runtimeConfig.ts` retomber sur les valeurs de build
// (fichiers `.env`), ce qui est le comportement voulu pour `vite dev`.
//
// Ne rien ecrire ici en dur : la valeur serait ignoree en production et
// donnerait une divergence dev/prod difficile a diagnostiquer.
window.__baitlyConfig = {};
