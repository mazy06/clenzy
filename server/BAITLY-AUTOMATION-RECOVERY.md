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

Le statut public `FAILED` ne prouve pas l'absence d'effet. Il inclut les tentatives réservées/incertaines et les lignes à examiner ; les diagnostics sont des codes fixes. L'endpoint de rejeu exige désormais une réconciliation et ne réarme aucune exécution. Aucun outil de réconciliation automatique n'est prétendu disponible.

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

## Validation

`BaitlyAutomationRecoveryTest` applique le changeset réel, vérifie sa réexécution, les courses SQL, rollback, redémarrage, résultat perdu, jetons périmés, scopes, reports et données sensibles synthétiques. La recette obligatoire `ci-payout-recipe.yml` le lance sur PostgreSQL éphémère. Tests voyageurs, échéances/fuseaux, réservations et verrouillage scheduler complètent cette suite.

Les tests réels de coupure/redémarrage du staging, les fournisseurs et les notifications sont réservés à la campagne finale. Cette documentation ne constitue pas une validation staging et ne clôture pas FR10/FR11. FR09 reste en attente du coffre-fort et du stockage hors site approuvés.
