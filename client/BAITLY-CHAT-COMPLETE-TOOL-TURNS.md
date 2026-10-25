# Preuve complète des tours avec outils en lecture seule

Suite cumulative de #521, dont la CI entière est verte sur
`60745d34d8010e792f1d427e045dd3af87dc1b29`, scan compris. Le rapport de recette
PostgreSQL/JSONB confirme 48 cas SQL sans échec ni test ignoré.
Le candidat reste inactif, sans retrait du SDK existant.

## Contrat versionné

L’adaptateur candidat demande maintenant `durable-tools-v2`. Le serveur conserve
`durable-text-v1` et son chemin existant ; une requête v1 ne peut pas poursuivre
un historique avec outils. Retirer le marqueur ne contourne pas le journal.
Les anciens tours UNCERTAIN sans certificat ne sont jamais promus par lecture.

Liquibase 0609 crée `baitly_chat_tool_turn_proofs`, mappée par
`BaitlyChatToolTurnProof` : référence du tour, organisation/conversation,
politique v2, message final et compteur couvert. Aucun prompt, argument, résultat,
token, URL ou diagnostic n’y est copié. Les changesets 0607/0608 restent immuables.

Le certificat est séparé du statut legacy. Le reçu avec outils conserve
UNCERTAIN pour qu’un ancien serveur ou un rollback reste bloquant. Le nouveau
lecteur ne renvoie SAFE_TOOLS que sur un certificat v2 courant et revalidé.
Le certificat et le reçu sont commités dans la même transaction courte, avant
le terminal SSE ; aucune exécution de modèle, outil ou fournisseur sous verrou.
Un crash ou une panne avant commit ne produit aucun permis de continuation.

## Ce qui est couvert

Le vrai moteur mono-agent doit avoir persisté exactement une réponse finale
non vide avec `stop` ou `end_turn`, et émis une seule fin cohérente. Chaque
événement d’exécution doit correspondre à un appel unique, sans erreur.
Erreur, pause, multi-agent ou exécution contradictoire disqualifient la preuve.

Le journal vérifie ensuite le segment complet en ordre d’ID persistant :

1. Un message utilisateur non vide, sans pièce jointe ni appel d’outil.
2. Pour chaque itération : un message assistant avec un lot d’appels, suivi
   exactement de leurs résultats dans l’ordre, avant l’itération suivante.
3. Chaque appel figure une seule fois, avec un nom qualifié, un reçu durable
   READ_ONLY_COMPLETED et la référence exacte de son résultat non vide.
4. Aucun reçu, résultat, appel ou message supplémentaire n’est laissé hors
   couverture. Aucun résultat n’est qualifié par son texte ou par « succès » seul.
5. La réponse assistant finale correspond à celle observée par le moteur.

Les seuls handlers qualifiés restent `SuggestNavigationTool` et
`ComputeTouristTaxTool`, dans leur implémentation concrète déjà revue. La preuve
porte sur la fin d’une navigation proposée ou d’une lecture/calcul, pas sur une
navigation effectuée, l’exactitude d’un barème fiscal ou un reversement de taxe.
Écritures, autres outils, reprises après confirmation/refus, pièces jointes et
multi-agent restent bloqués sans leurs propres preuves métier. Aucun effet
incertain n’est rejoué pour essayer de produire une preuve.

## Relecture et nouveau message

La preuve recouvre toute la chaîne de reçus, pas seulement le dernier :
séquences contiguës, bornes et compteurs exacts, segments texte ou outils
individuellement vérifiés. Modifier un ancien segment invalide également un
reçu texte plus récent. Résultat manquant, reçu déplacé, référence étrangère,
appel inconnu, doublon ou certificat incohérent : UNCERTAIN et admission refusée.
Les contrôles de propriétaire et tenant restent obligatoires.

Après rechargement, la récupération expose la politique, la requête d’origine,
le message final et les références des lectures. Les payloads des outils restent
masqués. L’adaptateur vérifie version, borne finale, couverture des références,
absence de décision en attente et de contradiction. Il restaure uniquement la
présentation, sans appel d’outil, navigation, retry ou message sortant.

Un nouveau message exige une action humaine explicite et une nouvelle admission
SQL. Deux admissions concurrentes n’ont qu’un gagnant. La requête précédente ne
peut pas être réémise, même après un tour suivant réussi. Une fin SSE ou une
preuve d’appel isolée ne suffit toujours pas.

## Qualification et suite

La suite SQL obligatoire applique réellement 0607/0608/0609, vérifie leur second
passage et les mappings JPA sur le schéma obtenu. Elle utilise le vrai moteur,
des handlers concrets de lecture et des services/modèles synthétiques hors
transaction : lots, itérations, panne du certificat, historique incohérent,
concurrence, blocage v1 et absence de rejeu. Le HTTP vérifie le dispatch v2 avec
l’identité authentifiée ; l’adaptateur teste restauration, nouvel envoi explicite
et preuves absentes/contradictoires. H2 local et PostgreSQL CI sont distingués.

Les preuves des écritures/fournisseurs et des autres modes restent à traiter,
ainsi que les neuf rendus historiques, l’état et découverte/relais avant
activation. FR10/FR11 et les avis de dépendances restent ouverts. Aucune fusion,
notification réelle ou mise en service ; tests staging réservés à la campagne
finale regroupée.

Validation locale finale : 145 tests backend ciblés, dont 71 cas SQL et 7 cas
HTTP/SSE, et 94 contrats frontend réussis, sans échec/erreur/test ignoré. Typage
strict et builds PMS/SDK réussis ; candidat absent du bundle actif. La CI de
la nouvelle tête, notamment PostgreSQL/JSONB, doit être confirmée séparément.
