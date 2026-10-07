# Règlement des dépenses retenues

Recette locale du 6 octobre 2026, dans le sandbox Stripe Baitly. Aucune dépense, prestation ou transaction réelle.

## Parcours raccordé

Une dépense approuvée peut être retenue dans un reversement propriétaire. Cette retenue ne constitue pas le paiement du prestataire. Finance propose désormais un règlement distinct une fois le reversement propriétaire confirmé, avec confirmation du montant et du bénéficiaire personnel.

Avant émission, le serveur vérifie le financement des séjours, les remboursements et litiges, le montant exact des dépenses liées, leur organisation, logement, propriétaire et période, ainsi que le compte Connect personnel du prestataire. Il relit également la preuve Stripe du reversement propriétaire. Une retenue modifiée, un financement ambigu ou un compte non prêt bloque le paiement.

Le journal commun conserve une instruction `PROVIDER_EXPENSE` et sa clé d'idempotence. Le statut `PAID` de la dépense et la preuve du journal sont confirmés ensemble. Un résultat incertain exige un rapprochement ; une tentative répétée ne crée pas un second transfert. Le suivi bancaire reste distinct du transfert Connect.

La recette a également révélé une erreur Hibernate à la lecture de la première dépense : les noms du prestataire et du logement étaient lus après fermeture de la session. Les réponses sont désormais construites dans une transaction de service, y compris après approbation et modification.

## Validation automatisée

- Suite financière de la CI exécutée localement : **1 009 tests serveur, 142 suites, zéro échec, erreur ou test ignoré**.
- **58 tests interface** : 49 pour les dépenses, le suivi des transferts, les remboursements et le retour public de réservation ; 9 pour les montants Finance.
- TypeScript vérifié ; packaging Java 21 réussi.
- Migration 0507 exercée sur PostgreSQL isolé avec les migrations précédentes : nouveau type de journal, protection d'immutabilité et accès en lecture seule au compte du prestataire retenu. Les autres organisations et écritures restent interdites.
- Tests de concurrence sur la retenue et contrôle des réponses après fermeture réelle de la session Hibernate.

## Chargement local

- JAR `/private/tmp/baitly-expense-payout-runtime.jar`.
- SHA-256 `e6f305a33887acd1ec1f19d5c7873839b8795b1f06a1ca7a61348f75e31b217d`.
- Sauvegarde `/private/tmp/baitly-before-expense-payout-hicqvy_o/server.jar`.
- Seul `clenzy-server-dev` est rechargé ; mêmes variables Stripe, frontend conservé.
- Migration 0507 exécutée au démarrage à 13:32:51 UTC.

## Recette depuis Baitly validée

- Dépense 1 créée depuis Finance : « TEST SANDBOX · Réassort consommables, aucune dépense réelle », Jean Martin, logement Baitly Sandbox Reversement, 5 EUR TTC, date 26 septembre 2026. Aucun justificatif réel fabriqué.
- Séjour 553, `DIR-6K7F7Q`, créé depuis Baitly du 26 au 28 septembre, 30 EUR, sans prestation automatique.
- Encaissement 62, `TX-15f05cc1-0b7`, confirmé après paiement par carte de test dans Checkout Baitly. Le retour public affiche le séjour confirmé et 30 EUR. La base locale indique `COMPLETED`.
- Reversement propriétaire 16 généré puis approuvé : 30 EUR bruts, 5 EUR de retenue, 25 EUR nets. Avant son transfert, Baitly bloque correctement le règlement de la dépense.
- Reversement de 25 EUR émis depuis Finance, journal 4 `OWNER_PAYOUT / TRANSFERRED`, référence `tr_1UNYdDQxlvbxDIrYOqOjjyit`. Stripe confirme le montant, EUR, le compte propriétaire attendu et `livemode=false`.
- Confirmation explicite du règlement de 5 EUR à Jean Martin, puis émission depuis Finance. Dépense 1 `PAID`, journal 5 `PROVIDER_EXPENSE / TRANSFERRED`, référence `tr_1UNYgHQxlvbxDIrYx1xSURT5`. Stripe confirme 500 centimes EUR vers le compte personnel de test de Jean Martin, sans annulation et `livemode=false`.
- Le KPI inclut désormais les dépenses retenues mais non réglées parmi les montants en attente. Après paiement : 0 EUR en attente et 5 EUR payés ; action retirée et preuve Stripe visible.
- Le suivi des versements affiche « Règlement dépense #1 », le bénéficiaire, le montant et l'historique `SUBMITTING → TRANSFERRED`. Il indique explicitement qu'aucun versement bancaire n'est encore rapproché.
- Contrôle responsive 375, 768, 1024 et 1440 pixels : aucune largeur débordante et confirmation accessible. Aucun transfert répété pour ces contrôles.

## Limites

Cette action vise le prestataire individuel explicitement enregistré sur la dépense, jamais un compte société déduit arbitrairement. Le bénéficiaire société et les achats directement facturés par un fournisseur nécessitent leur propre modèle de rattachement. La recette ne constitue pas une réception bancaire réelle, une validation fiscale du justificatif ni une livraison en production.
