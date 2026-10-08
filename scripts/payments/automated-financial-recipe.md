# Recette automatisée du circuit financier Baitly

## Exécuter la même sélection en local et en CI

Le manifeste `financial_recipe.json` est partagé avec `.github/workflows/ci-payout-recipe.yml`.
Les tests ne lisent aucune clé Stripe et n'appellent ni le PMS local ni le sandbox partagé.
Le lanceur ne démarre, n'arrête et ne recharge aucun conteneur.

Prérequis : Java 21, Maven, Python 3, Node 22 ou supérieur, dépendances frontend installées,
et PostgreSQL éphémère de test déjà disponible. La base accepte l'utilisateur `postgres`
sans mot de passe sur le réseau isolé de recette. Ne jamais utiliser la base applicative.
Le backend exige aussi un moteur PDF Gotenberg éphémère (rendus réels des aperçus) :
`docker run --rm -p 127.0.0.1:3000:3000 gotenberg/gotenberg:8`.

```sh
rtk proxy python3 scripts/payments/financial_recipe.py --list
rtk proxy python3 scripts/payments/financial_recipe.py --scope all --jdbc jdbc:postgresql://127.0.0.1:5432/baitly_payout_test --pdf-url http://127.0.0.1:3000 --output tmp/financial-recipe-run-01
```

Pour exécuter seulement le frontend, ni PostgreSQL ni Gotenberg ne sont nécessaires :

```sh
rtk proxy python3 scripts/payments/financial_recipe.py --scope frontend --output tmp/financial-interface-run-01
```

`JAVA_HOME` sélectionne Java 21 ; `BAITLY_TEST_NODE` peut désigner le chemin de Node.
Sur les postes qui interdisent l'attachement dynamique de Mockito, utiliser le `JAVA_TOOL_OPTIONS`
avec l'agent Mockito correspondant à la dépendance du projet.

Le dossier de sortie doit être **neuf**. Il contient les journaux, les rapports JUnit et
`summary.json`. Un code de sortie nul exige toutes les suites sélectionnées, au moins un test
dans chaque classe (y compris ses classes imbriquées), zéro échec, zéro erreur et zéro test ignoré.
Un test PostgreSQL désactivé faute de configuration ne peut donc pas produire une recette verte.
La validation refuse les anciennes sorties, les sélections vides et les bases applicatives connues.

## Ce qui est exercé

| Niveau | Contrôles | Limite |
| --- | --- | --- |
| Services et contrats | Montants serveur, droits, reprise Checkout, répartition, remboursements, avoirs, commissions, bénéficiaires et incidents | Certaines frontières PSP, notification et documents sont simulées |
| Persistance et transactions | Allocations, idempotence, rollback, concurrence, réservations, récupération après transfert et rapprochements | Des tests JPA utilisent H2 ; ceux nommés PostgreSQL utilisent la base éphémère réelle |
| PostgreSQL et Liquibase | Changesets financiers sélectionnés, contraintes, RLS, verrous, journal, migrations rejouées, signature HTTP avec PSP simulé | Pas un boot complet de toutes les migrations du PMS ; fixtures de schéma préalable explicites |
| Intégration interface/HTTP | Composants réels, React Query, modules API et `apiClient`, serveur HTTP local éphémère, erreurs JSON/texte, double clic, invalidation du consentement et rechargement | Identité et endpoints métier simulés ; environnement DOM de test, pas navigateur complet |
| Typage | Application et fichiers des nouveaux tests d'intégration | Ne remplace pas les assertions comportementales |
| Garde-fous du lanceur | Base autorisée, présence des suites, rapports frais et interdiction des tests ignorés | Ne certifie pas le contenu de tous les tests futurs |

Les tests HTTP utilisent `client/tests/fixtures/baitlyFinanceHttp.ts`. Une route inattendue fait
échouer le test. Les montants et bénéficiaires affichés sont contrôlés avant confirmation ;
ils ne sont jamais renvoyés comme autorité dans la requête de règlement. L'identité du bénéficiaire
affiché est renvoyée comme confirmation et comparée au bénéficiaire résolu côté serveur ; elle
ne peut ni choisir un compte Stripe arbitraire ni remplacer le choix persistant.

Les confirmations de réservation sont exercées avec les services métier, le CAS et les verrous
PostgreSQL. La persistance des montants payé/dû est vérifiée après commit, ainsi que les doubles
livraisons concurrentes, les devises et organisations étrangères, les montants divergents, les
réservations annulées/remboursées et le paiement d'un solde sans acompte cohérent.

La sélection couvre également les [sept lots commerciaux](commerce-expansion-audit.md) :
portefeuille IA, acompte/solde de maintenance, booking/promotions, abonnements PMS,
upsells/affiliation, matériel et documents fiscaux. Elle comprend les pièces vendeur immuables,
les séries par émetteur, les crédits historiques sans couverture prouvée et la récupération
après un transfert confirmé tardivement.

Le mobile possède sa suite `SubscriptionCheckoutScreen.test.tsx` dans le workspace `mobile`,
exécutée par la CI mobile existante. Pour la relancer depuis la racine :

```sh
rtk npm test --workspace mobile -- --runInBand --watchman=false SubscriptionCheckoutScreen.test.tsx
```

Cette suite utilise React Native avec les endpoints simulés ; elle ne remplace pas un test
sur appareil ni le retour réel depuis Checkout.

## Campagne finale à conserver séparément

Le [plan de recette Baitly/Stripe](../../docs/payments-sandbox/final-circuit-recipe-checklist.md)
reste à exécuter après les travaux de code. Il couvre le navigateur complet, l'authentification,
les rôles, les comptes Connect, les vraies notifications Stripe de test et le rapprochement bancaire.
Les tests d'intégration HTTP ajoutés ici **ne sont pas une recette E2E du PMS avec Stripe**.
La [recette de l'extension commerciale](commerce-final-recipe.md) complète ce plan avec les
sept lots, leurs preuves attendues et les prérequis PSP/fiscaux non encore configurés.

Conserver les scénarios et fixtures sous contrôle de version pour accélérer cette campagne,
mais aucune confirmation financière ne doit être validée uniquement par un retour de navigateur.
Les rapports CI sont publiés comme artifacts ; la CI elle-même reste à exécuter après publication
du code. Aucun succès local ne prouve qu'un workflow GitHub a été exécuté.
