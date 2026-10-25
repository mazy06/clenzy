# Preuves métier des appels d’outils du chat

Suite de la preuve de fin `durable-text-v1`. Le candidat reste inactif.
Cette vague ajoute une preuve d’invocation et des preuves bornées de lecture,
sans élargir SAFE_TEXT ni débloquer automatiquement les tours avec outils.

## Journal avant effet

Liquibase 0608 crée `baitly_chat_tool_evidence`, dont les noms et colonnes sont
mappés par `BaitlyChatToolEvidence`. Le journal enregistre une référence au tour,
le périmètre organisation/conversation, l’identifiant d’appel, une catégorie
fermée de preuve, les timestamps et la référence du résultat persisté.
Il ne copie ni arguments, résultats, noms libres du modèle, URL, erreurs ou
coordonnées. Aucun backfill ne qualifie les anciens résultats.

Le chemin mono-agent et `executeConfirmed` enregistrent STARTED dans une courte
transaction indépendante, avant le dispatch. La conversation doit appartenir
au même utilisateur/tenant et le tour doit encore être RUNNING. Une contrainte
unique sur organisation/conversation/identifiant d’appel empêche une seconde
exécution du même appel, y compris après redémarrage. Un résultat déjà présent
dans l’historique bloque également le départ, même sans ancien reçu d’invocation. Une panne du journal
bloque avant le handler ; un échec après effet laisse STARTED ou UNCERTAIN.
Les appels outil et fournisseur restent hors transaction du journal.

Après persistance du message d’outil, une seconde transaction vérifie sa
référence, son rôle, son identifiant d’appel, son périmètre et l’unicité du
résultat. Un simple message de résultat ou `isError=false` ne suffit pas.

## Portée exacte des preuves

| Catégorie | Preuve accordée |
|---|---|
| NAVIGATION_ONLY_V1 | Le handler concret `SuggestNavigationTool`, sans modification métier ni appel distant, a terminé et son résultat est persisté. Aucune navigation du navigateur n’est exécutée par la restauration. |
| TAX_READ_ONLY_V1 | Le handler concret `ComputeTouristTaxTool` a terminé une lecture/calcul via `TouristTaxService`, puis son résultat est persisté. Ceci ne prouve ni exactitude fiscale d’un barème saisi, ni collecte, ni reversement de taxe. |
| UNVERIFIED | Tout autre handler, écriture, implémentation substituée ou descripteur incompatible. Un retour positif reste UNCERTAIN. |

L’identité de l’implémentation est vérifiée explicitement. Un nom identique ou
`requiresConfirmation=false` n’accorde aucune preuve. Une nouvelle implémentation
ou un proxy inconnu est refusé à la qualification. Étendre cette liste exige
une revue du traitement métier, des transactions et des effets possibles.

`GET /api/agui/recovery` ajoute `toolEvidence` après les contrôles d’accès
existants. Chaque lecture recoupe les résultats avec les messages actuels ;
résultat absent, vide, déplacé ou dupliqué : preuve dégradée en UNCERTAIN.
Les erreurs SQL restent neutres, sans cause brute. La lecture ne déclenche
ni handler, ni réconciliation automatique, ni nettoyage des verrous.

## Limites conservées

Le tour avec outils reste UNCERTAIN, même si tous les outils observés ont une
preuve de lecture. Il faut encore démontrer la couverture complète du tour,
les lots et itérations, les refus/reprises, les pièces jointes et le multi-agent
avant un nouveau statut de fin. La politique v1 n’est pas réinterprétée.
L’adaptateur frontend existant reste bloqué et ignore le nouveau champ additif.

La contrainte porte sur l’identité technique d’appel, pas sur l’équivalence
sémantique de deux actions avec des identifiants différents. Aucune écriture
incertaine n’est rejouée ni déclarée réussie : les preuves fournisseur et les
journaux métier correspondants restent nécessaires. Les traitements legacy
non suivis conservent leur comportement. Le multi-agent n’est pas couvert par
ce nouveau journal et reste disqualifiant pour la fin du tour.

## Qualification

La recette existante applique réellement 0607 et 0608, teste le second passage
Liquibase et valide les deux mappings JPA contre le schéma créé. Les tests
exercent le vrai moteur mono-agent et de vrais handlers de lecture avec données
synthétiques, ainsi que doublons, pannes, crash, preuve contradictoire, scope,
diagnostics et absence d’appel fournisseur dans les transactions.
H2 local et PostgreSQL/JSONB CI sont qualifiés séparément. Les tests staging
restent réservés à la campagne finale regroupée ; aucun fournisseur réel,
déploiement, notification ou donnée personnelle de recette n’est utilisé.

Validation locale sur les sources figées : 121 tests backend ciblés, dont
48 cas SQL, sans échec, erreur ou test ignoré. La nouvelle tête doit encore
passer sa CI, notamment la recette PostgreSQL/JSONB. Aucun code frontend modifié.

Suite : [preuve complète des tours de lecture](BAITLY-CHAT-COMPLETE-TOOL-TURNS.md).
Elle ajoute un certificat v2 de couverture de tour, sans réinterpréter les
anciens reçus v1 ou débloquer les écritures incertaines.
