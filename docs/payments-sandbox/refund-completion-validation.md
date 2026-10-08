# Baitly : clôture des trois compléments de remboursement

## Portée du 7 octobre 2026

Implémentation des affectations multiples d'une preuve externe, des remboursements externes après transfert propriétaire et des crédits fidélité/remboursements/documentation. Les opérations de cette tranche restent des tests isolés. Aucun remboursement Stripe, email, chargement du PMS partagé ou déploiement de production n'est réalisé. La campagne navigateur Baitly/Stripe reste celle de la [checklist finale](final-circuit-recipe-checklist.md).

## Une preuve Stripe pour plusieurs prestations

Finance propose une répartition explicite avec montant par prestation, solde disponible et motif. La somme doit correspondre exactement à la preuve observée. Le serveur reprend l'organisation et l'auteur authentifiés et vérifie chaque part du même encaissement. La saisie n'envoie pas d'argent.

La transaction bancaire conserve son unique référence `re_`. Ses affectations portent un lien `refund_parent_id` et aucun identifiant PSP supplémentaire. Elles alimentent les journaux, avoirs et soldes des prestations après relecture de la charge et de toutes les restitutions. Le manifeste Stripe rassemble les affectations sous la preuve bancaire unique ; il ne réémet pas un remboursement externe.

L'ordre des preuves reste celui de leur enregistrement, même si l'opérateur répartit d'abord une preuve plus récente. Un incident annule l'ensemble des effets locaux de la répartition. Les garde-fous et la migration 0512 protègent les plafonds, les organisations, l'identité des affectations et leur décision immuable.

## Remboursement externe après transfert propriétaire

Les nouveaux reversements figent le net de chaque séjour après commission, frais et ventilation des dépenses communes. La somme correspond au transfert. Une restitution ultérieure utilise ces montants historiques, jamais le contrat ou le tarif courant.

Le remboursement voyageur confirmé et la récupération du propriétaire sont distincts. Le rapprochement crée une instruction de récupération plafonnée à la part nette du séjour. Le worker existant relit ensuite les preuves Stripe et tente la reprise ; une insuffisance ou une incertitude reste visible et reprenable. Plusieurs remboursements peuvent être comptabilisés pendant cette attente, mais leurs récupérations s'exécutent dans l'ordre. Le transfert initial et sa réception bancaire historique ne sont pas réécrits.

Exemple testé : séjour encaissé 45 EUR, net transféré 30 EUR, commission TTC 15 EUR. Restitutions de 5 puis 40 EUR : récupérations de 3,33 puis 26,67 EUR, avoirs voyageurs totalisant 45 EUR, avoirs de commission distincts totalisant 15 EUR avec la TVA historique exacte. Un transfert couvrant plusieurs séjours ne reprend que le net du séjour concerné.

Les migrations 0513 et 0515 conservent les bases et rattachent les avoirs de commission à la preuve de remboursement sans réutiliser le lien unique de l'avoir voyageur.

## Fidélité et parrainage

Le périmètre existant `EARN`/`GRANT` représente des récompenses offertes. Le traitement documentaire repose sur cette nature déjà présente dans le code : remise répartie sur les lignes taxables de la facture, taxe de séjour conservée, encaissement et avoir limités au montant réellement payé. Cette tranche n'ajoute pas de crédit acheté ni de moyen de paiement prépayé.

Les remboursements externes restituent les points consommés proportionnellement au montant cash rendu et reprennent les récompenses de fidélité/parrainage liées au séjour. Chaque écriture est liée à son origine et idempotente. Les cumuls absorbent les centimes ; une annulation après restitution partielle ne restitue que les points restants. La preuve historique reste exploitable pour reverser le cash conservé. Les KPI Finance excluent aussi la remise offerte des montants encaissés et à encaisser ; une réduction incohérente reste à vérifier.

Si les récompenses ont déjà été dépensées, le solde interne peut devenir négatif ; le disponible affiché reste nul et les gains futurs compensent l'écart. Aucun débit bancaire n'est créé. La migration 0514 lie ces écritures à leur source dans la même organisation.

## Validation automatisée

La campagne `tmp/baitly-financial-completion-04/summary.json` est **passed** : **2 277 tests serveur (343 suites JUnit), 101 tests interface (12 fichiers), deux contrôles TypeScript**, sans échec, erreur ni test ignoré. Les **36 tests Python** du lanceur passent également (`/private/tmp/baitly-financial-python-05.log`). Les exécutions intermédiaires sont conservées ; leurs échecs de fixtures/libellés ne sont pas présentés comme des succès.

Les suites utilisent PostgreSQL temporaire, les vrais services comptables et une outbox persistée ; les frontières Stripe/Keycloak sont simulées. Les tests d'interface utilisent les composants, React Query et le vrai client HTTP contre un serveur de fixtures. Ce ne sont pas des tests E2E navigateur du PMS partagé.

## Livrable local

Le packaging Maven a réussi. Le JAR `server/target/clenzy-platform-1.0.0.jar` contient les migrations 0512 à 0515, vérifiées octet par octet contre les sources. SHA-256 : `8fb8e2e8dcf427c211b524e612cb1cb683ff70b1bd3867790edd8e7339fdd6f6`. La preuve de packaging est dans `tmp/baitly-financial-completion-04/package.json`. Ce JAR n’a pas encore été chargé dans le PMS partagé.

## Limites conservées

- Les anciens reversements multi-séjours sans ventilation nette restent à rapprocher : aucune répartition historique n'est inventée. Un ancien transfert mono-séjour possède une base certaine.
- Une instruction propriétaire encore en cours, un reçu incomplet, un litige ou une série mêlée à une annulation ambiguë restent bloquants jusqu'à rapprochement.
- Fidélité : récompenses offertes en EUR et encaissement unique. Pas de crédit acheté, d'acompte historique reconstitué, de réservation/expiration des points à l'ouverture du checkout ni de complément de paiement automatique. Une insuffisance concurrente reste à rapprocher.
- Les anciennes factures ne sont pas réécrites automatiquement : une facture incompatible avec le reçu cash demeure en revue.
- Les migrations 0512 à 0515 doivent être chargées avec le livrable correspondant avant la recette finale ; les tests isolés ne prouvent pas leur présence dans le serveur partagé.
- La réception bancaire, les capacités des comptes Connect et les parcours navigateur seront vérifiés lors de la campagne finale.
