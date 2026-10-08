# Dépenses : bénéficiaire société explicite

## Code et périmètre

Une dépense retenue sur un reversement propriétaire financé peut désigner la société du
prestataire enregistré. Les sociétés éligibles sont les organisations `CONCIERGE` et
`CLEANING_COMPANY` de ce prestataire. Aucune société n'est déduite automatiquement de la mission
ou du compte de l'opérateur. Les dépenses historiques conservent leur bénéficiaire personnel.

Finance propose « Verser à sa société », puis une confirmation du choix. Cette décision ne
transfère aucun argent. Le versement reste une seconde action, qui nomme le bénéficiaire effectif.
Le corps de la requête confirme l'identité affichée ; le serveur la compare à la décision en
base. Montant, devise, compte Stripe et financement restent exclusivement résolus côté serveur.

La migration Liquibase **0509** conserve la décision, son auteur et sa date. Elle verrouille la
dépense, interdit une désignation après une tentative de transfert et empêche la modification
du créancier après choix. Elle limite la lecture du compte Connect société aux dépenses de
l'organisation opératrice effectivement retenues sur un reversement financé.

Une société déconnectée ou un changement de rattachement du prestataire bloque l'émission ;
aucun repli vers le compte personnel. Journal, rapprochement et suivi bancaire conservent le
bénéficiaire société. Une confirmation périmée est refusée avant tout appel Stripe.

## Vérifications locales du 6 octobre 2026

Rapport : `tmp/baitly-financial-recipe-expense-company-01/summary.json`.

- **1 948 tests serveur**, zéro échec, erreur ou test ignoré.
- **77 tests interface**, zéro échec, erreur ou test ignoré ; typage application et intégration réussi.
- PostgreSQL réel jetable : onze changesets financiers, dont 0509, appliqués puis rejoués ;
  mapping JPA de la nouvelle décision validé contre le schéma Liquibase, dépôt Spring Data,
  RLS avec rôle non propriétaire, rejet des destinations étrangères, compte révoqué, créancier
  modifié et concurrence choix/émission.
- Services et contrôleur : droits staff, organisation du contexte serveur, identité de l'auteur,
  choix idempotent, absence de repli personnel, confirmation HTTP manquante/ambiguë/invalide,
  rejeu du transfert et refus d'une confirmation périmée sans appel PSP.
- Interface/HTTP local : choix séparé du transfert, double clic, compte société affiché et
  confirmé, HTTP 409 après changement concurrent, nouvelle confirmation nécessaire.

Ces tests ne sollicitent pas le sandbox Stripe ni le PMS partagé. Les endpoints HTTP de
l'interface sont des fixtures ; ce résultat ne vaut pas une recette navigateur avec Stripe.

## À exercer lors de la campagne finale

Charger la migration et le code, connecter une société de test autorisée, puis vérifier depuis
Finance la désignation, le refus sans compte prêt, le transfert, le rejeu et la réception bancaire
distincte. Vérifier également les traductions et le rendu mobile/RTL.

L'achat direct auprès d'un fournisseur sans bénéficiaire Baitly enregistré reste hors de ce
parcours. La décision ne prétend pas vérifier la qualité juridique du créancier : l'opérateur
doit désigner la société correspondant au justificatif de la dépense.
