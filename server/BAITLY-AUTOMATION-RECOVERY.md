# Reprise durable des automatisations Baitly

## Contrat de reprise

Le moteur enregistre une exécution `PENDING` dans la transaction du producteur. La création d'une réservation et l'alerte bruit enregistrent leur file avant leur commit : aucun envoi dans ce chemin, aucun callback en mémoire indispensable à la reprise. Une erreur de mise en file annule la transaction ; elle ne doit pas être présentée comme une délégation réussie.

Un drain toutes les dix secondes sélectionne au plus 25 lignes validées. Il réserve chaque tentative dans une transaction indépendante courte, puis invoque son exécuteur. Le résultat est enregistré séparément avec un jeton de tentative. Le verrou ShedLock limite le travail concurrent ; le compare-and-set SQL reste la protection lorsque le bail expire ou que plusieurs drains se chevauchent.

| État interne | Interprétation et reprise |
| --- | --- |
| `PENDING` | Jamais tenté, ou report pré-effet explicitement autorisé. Reprise possible avant expiration. |
| `STARTED` | Tentative réservée et commitée. Une interruption laisse cet état bloqué, sans expiration ni renvoi. |
| `UNKNOWN` | Résultat, commit métier ou retour d'exécuteur incertain. Aucun rejeu, y compris via une nouvelle occurrence du même sujet/règle. |
| `DONE` | Résultat terminal enregistré (`EXECUTED` ou `SKIPPED`). Aucun rejeu de cette occurrence. |
| `REVIEW` | Périmètre, version de règle ou fraîcheur invalides avant tentative. Aucune action externe. |

Le statut public `FAILED` ne prouve pas l'absence d'effet. Il inclut les tentatives réservées/incertaines et les lignes à examiner ; les diagnostics sont des codes fixes. L'endpoint de rejeu exige une réconciliation et ne réarme aucune exécution. La réconciliation décrite ci-dessous applique seulement un reçu terminal correspondant exactement à la tentative ; elle ne rappelle jamais un exécuteur.

Les seuls reports autorisés proviennent des guards avant envoi des exécuteurs voyageurs et du guard avant révocation des accès. Un report doit viser une date future et ne porter aucune référence d'effet. Un autre exécuteur ne peut pas se réarmer par un simple résultat « reporté ».

## Périmètre et confidentialité

- Les données du déclenchement sont limitées à 8 192 caractères JSON puis chiffrées avec le service AES-GCM existant. L'enveloppe est liée à l'organisation, au type et à l'ID du sujet. Aucun payload ni diagnostic arbitraire dans le DTO ou les métriques.
- Les échéances mensuelles sont figées à l'admission. La clé d'occurrence ne contient que des références internes et un jour, un mois ou l'instant de l'épisode IoT. Les relances de facture restent quotidiennes, avec le budget et l'anti-rafale métier de l'exécuteur ; une première relance tardive ne consomme pas la seconde.
- L'admission est sérialisée par règle et protégée par un index unique d'occurrence. La version et l'activation de la règle sont vérifiées avant la tentative puis à la préparation métier. Une modification n'exécute pas silencieusement la nouvelle action sur un ancien travail.
- Les réservations sont relues sous le tenant concerné. Changement de logement, voyageur ou version du voyageur : blocage. Une réservation annulée ne reçoit pas une action normale ; le déclencheur explicite d'annulation reste possible.
- Les événements bruit jamais tentés expirent après quinze minutes ; les autres après un jour suivant leur échéance. Un report pré-effet renouvelle l'échéance de fraîcheur. Ces délais ne réarment jamais `STARTED`/`UNKNOWN`.
- Le contexte chiffré est effacé après résultat terminal ou quarantaine. Un processus interrompu conserve son intention `STARTED` pour examen. Sa politique de conservation reste à décider.
- Un retour normal de fournisseur vaut uniquement le résultat contractuel de l'adaptateur, pas une preuve de réception finale. Le pipeline voyageur refuse comme succès les logs absents, `PENDING`, `FAILED` ou `BOUNCED`.

## Bascule et limites

Migration Liquibase **0603**, tables vérifiées contre les entités et 0305. Les anciennes lignes `PENDING` deviennent `FAILED` avec `AUTOMATION_LEGACY_REVIEW` : leur historique ne permet pas d'exclure un effet déjà parti. Aucun backfill de travaux anciens. Un ancien échec ambigu bloque aussi une nouvelle admission récurrente sur le même sujet/règle. Il faut inventorier et réconcilier ces lignes, sans SQL manuel de production ni suppression aveugle des protections.

Lors de la campagne finale, arrêter l'admission des anciens producteurs et terminer leur retrait avant de rendre la nouvelle candidate active, exclusivement via la procédure CI/CD approuvée. Ne pas faire cohabiter un ancien moteur qui ignore les protections avec le nouveau. Les colonnes doivent être présentes sur toutes les répliques avant activation du drain.

Le moteur prépare le contexte en transaction courte puis appelle l'exécuteur hors transaction. La session tenant reste ouverte pour les relations différées. Le claim de relevé propriétaire est validé par sa transaction repository avant l'envoi, sans verrou SQL pendant SMTP. Les transactions internes de certains services legacy (messagerie voyageurs, relevés et serrures) restent à extraire séparément : aucune transaction englobante n'est ajoutée par le moteur, et un échec après effet reste incertain sans renvoi.

Les autres producteurs événementiels conservent leurs propres contrats de réception/reprise. Ce lot ne transforme pas chaque callback de chaque intégration en outbox universelle. La reprise Minut existante confirme la délégation au moteur ; elle ne doit pas inventer le succès de ses actions.

## Métriques et alertes privées

Le collecteur `BaitlyAutomationMetrics` publie neuf jauges plateforme sans label métier : `baitly_automation_ready`, `oldest_ready_seconds`, `uncertain`, `oldest_uncertain_seconds`, `expired`, `review`, `legacy_review`, `snapshot_healthy` et `snapshot_last_success_timestamp_seconds` (toutes préfixées `baitly_automation_`). Il ne sélectionne que les états, statuts et horodatages ; aucun nom de règle, organisation, sujet, destinataire, contexte chiffré ou diagnostic. Les échantillons ne quittent pas le réseau privé de monitoring existant.

Une lecture SQL agrégée toutes les minutes, avec timeout SQL de cinq secondes (hors acquisition de connexion), prépare le snapshot ; un scrape n’interroge jamais la base. Les actions futures ne sont pas prêtes. Les actions expirées jamais tentées sont distinguées des tentatives `STARTED`/`UNKNOWN`, qui restent incertaines quel que soit leur âge. `legacy_review` inclut les échecs historiques sans état durable, y compris les anciennes lignes mises en quarantaine par 0603. Une ligne active incohérente invalide la collecte. Aucun changement d’état, réparation ou renvoi ne résulte de cette observation.

L’âge est calculé avec la convention `TIMESTAMP` du journal (heure locale du serveur), indépendamment du fuseau SQL. Échec ou table absente : conservation des derniers chiffres et de leur date, santé à zéro ; aucun faux zéro fraîchement publié. L’actualisation est propre à chaque réplique. Les compteurs lisent la même base : maximum entre répliques, jamais somme. La lecture agrégée doit être mesurée sur le volume réel lors de la campagne finale ; le délai maximal protège le collecteur, sans constituer une preuve de performance.

La candidate infra ajoute quatre alertes : collecte absente/invalide/périmée (trois minutes), action prête âgée de plus de deux minutes (trois minutes supplémentaires), tentative incertaine de plus de cinq minutes (cinq minutes supplémentaires), stock expiré/en revue/historique continuellement non vide (quinze minutes). Les alertes métier exigent neuf valeurs finies, non négatives et fraîches sur la réplique concernée, santé égale à un, horloge raisonnable et backend disponible. Ce sont des seuils initiaux à calibrer, pas une garantie de délai métier. Le précontrôle refuse l’activation si une seule réplique est incomplète. Les messages sont fixes et ne réarment aucune action. Le récepteur OPS reconnaît ces quatre noms contrôlés au déclenchement et au rétablissement ; il ignore toujours les annotations et labels privés distants. Les compteurs d’acceptation ne portent que source et statut, jamais le nom de règle métier.

La candidate applicative cumulative incluant 0603/0604 doit précéder la candidate infra cumulative #139 ; les branches précédentes ne doivent pas être livrées séparément. La conservation, les preuves distantes manquantes et les transactions internes legacy restent des sujets distincts.

## Réconciliation sur reçu terminal durable

La migration **0604** ajoute `baitly_automation_outcome_proofs`, journal JDBC privé sans backfill. Après le retour terminal de l'exécuteur et le commit de ses services transactionnels, le moteur enregistre un reçu dans une transaction indépendante. Il applique ensuite ce reçu au statut d'exécution dans une autre transaction courte. Un arrêt après le premier commit ne perd plus le résultat observé. Un arrêt avant ce reçu, même après effet réel, reste ambigu et bloqué.

Le reçu contient uniquement les références internes de périmètre (organisation, exécution, règle/version, sujet), le UUID et la date de tentative, le résultat `EXECUTED` ou `SKIPPED`, une éventuelle référence interne et la date d'observation. Aucun nom, email, contenu, contexte déchiffré, message d'exception ou reçu brut du fournisseur. Il n'existe aucun endpoint permettant d'injecter un reçu ni de déclarer manuellement un succès. Les résultats mixtes ou références invalides sont refusés.

**Ce reçu atteste le résultat explicitement retourné et observé par le moteur. Il n'atteste pas une livraison finale chez le destinataire.** Les contrats des adaptateurs continuent de s'appliquer (par exemple `SENT`/`DELIVERED` pour les messages voyageurs). Un simple marqueur, une proximité de date ou un message récent sur le même séjour ne servent jamais à fabriquer une preuve. Les anciens `STARTED`/`UNKNOWN` et échecs historiques sans reçu restent bloqués ; aucun historique n'est réinterprété.

`BaitlyAutomationReconciler` examine au maximum 25 reçus éligibles par minute, sous ShedLock et verrou SQL par exécution. La comparaison organisation/exécution/règle/version/sujet/UUID/date de tentative précède tout changement. Elle ne fait que terminer `STARTED`/`UNKNOWN` en `DONE`, avec le statut exact et la date de résultat d'origine ; elle ne retourne jamais à `PENDING`. Le changement de statut et l'audit d'application (`NORMAL` ou `RECOVERY`) sont atomiques. Des workers concurrents ne consomment qu'une seule fois le reçu.

Un reçu identique reste idempotent et garde son observation d'origine. Un résultat ou une référence contradictoire marque le reçu comme contesté sans écraser le résultat initial ; aucune application ni remise en attente n'est alors permise. Un report pré-effet n'est pas un reçu terminal. Une tentative portant déjà un reçu ne peut plus être reportée ou réarmée. Les tentatives anciennes, étrangères, futures incohérentes ou déjà terminées ne sont pas appliquées. Une modification ultérieure de la règle courante n'annule pas la preuve historique de la règle/version exécutée.

Le journal d'exécution est protégé contre une suppression en cascade qui détruirait sa preuve ; une suppression de règle rencontrant cette contrainte retourne `409 AUTOMATION_HISTORY_PROTECTED`, sans diagnostic SQL. Désactiver une règle reste possible. Les politiques d'archivage et de rétention doivent être définies séparément, sans purger une ambiguïté pour libérer une nouvelle action.

La constellation secondaire est écrite après la preuve et le statut primaires. Elle reste best-effort et n'est pas rejouée par la réconciliation. Les compteurs `baitly_automation_reconciled_total` et `baitly_automation_reconciliation_failures_total` sont globaux, sans labels métier ; les alertes existantes continuent de couvrir les tentatives durablement incertaines et les travaux retardés. Une erreur du réconciliateur n'expose aucun diagnostic arbitraire.

## Validation locale et campagne finale

`BaitlyAutomationRecoveryTest` applique le changeset réel, vérifie sa réexécution, les courses SQL, rollback, redémarrage, résultat perdu, jetons périmés, scopes, reports et données sensibles synthétiques. La recette obligatoire `ci-payout-recipe.yml` le lance sur PostgreSQL éphémère. Tests voyageurs, échéances/fuseaux, réservations et verrouillage scheduler complètent cette suite.

`BaitlyAutomationReconciliationTest` applique les changesets réels 0603/0604 et vérifie le reçu commité visible d'une autre connexion avant la panne du statut, la reprise sans deuxième appel, l'atomicité statut/audit, les courses, les scopes complets, les preuves absentes/contestées, les reports, le quota de 25, les suppressions et les diagnostics minimisés. `BaitlyAutomationHistoryProtectionTest` vérifie le conflit contrôlé et le refus cross-org. Les deux suites sont obligatoires dans la recette PostgreSQL CI ; leur succès local/CI ne vaut pas qualification staging.

Les tests réels de coupure/redémarrage du staging, les fournisseurs et les notifications sont réservés à la campagne finale. Cette documentation ne constitue pas une validation staging et ne clôture pas FR10/FR11. FR09 reste en attente du coffre-fort et du stockage hors site approuvés.

`BaitlyAutomationMetricsTest`, inclus dans la recette PostgreSQL CI, vérifie les partitions SQL, le changeset réel, les frontières d’échéance, l’absence d’écriture/rejeu et de donnée privée, les fuseaux, la conservation des derniers chiffres en panne et les neuf noms Prometheus réels. Les scénarios promtool et précontrôles infra simulent défaut, rétablissement et répliques partielles sans notification. À qualifier seulement lors de la campagne staging finale : métriques de chaque réplique, coût SQL sur volume pilote, déclenchement/rétablissement de ces quatre alertes avec destinataires de recette autorisés et contrôle des données émises.
