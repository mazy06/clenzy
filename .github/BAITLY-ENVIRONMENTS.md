# Baitly : staging et production

Contrat validé le 10 octobre 2026 : les merges sur `main` déploient uniquement
le staging `https://app.clenzy.fr`. Après validation en situation réelle, une PR
vers `production` déploie uniquement `https://app.baitly.fr`. `develop` publie
des images sans déployer ces instances. Les PR exécutent la CI sans déploiement.

Les noms fonctionnels GitHub de `clenzy-infra` restent compatibles avec les
secrets SSH existants : `production` désigne encore le staging historique ;
`production-baitly` désigne la production publique. Les cibles logiques du CD
sont `staging` et `production-baitly`, avec leur URL affichée. Ne pas renommer
les environnements GitHub sans migration coordonnée de leurs secrets et règles.

Les dispatchs applicatifs portent une cible explicite, une branche et un SHA
complet. Les images PMS et site sont taguées avec ce SHA ; le CD conserve les
tags par service dans `.env.baitly-images`, ignoré par Git, entre déploiements
partiels. Un push infra ou un lancement manuel sans choix explicite cible
uniquement le staging. Une promotion infra en production est un lancement
explicite du CD sur `production-baitly` après validation en staging.

Ordre de mise en service : intégrer d'abord la modification de `clenzy-infra`
par PR, puis les producteurs CI frontend/backend du dépôt applicatif par PR
vers `main`. Pendant cette transition, les anciens dispatchs applicatifs sans
cible sont refusés plutôt que déployés sur les deux serveurs. Valider les runs
staging, puis promouvoir l'application par PR vers `production`. Ces changements
sont préparés localement ; ils ne modifient pas les serveurs avant intégration.

Le staging garde le profil sécurisé et le schéma géré par Liquibase :
`SPRING_LIQUIBASE_ENABLED=true` et `SPRING_JPA_HIBERNATE_DDL_AUTO=validate`.
La similarité des données, du dimensionnement et des intégrations externes doit
être mesurée séparément. Les tests `perf-tests.yml` utilisent un serveur CI
éphémère ; ils ne constituent pas une mesure de charge de `app.clenzy.fr`.
