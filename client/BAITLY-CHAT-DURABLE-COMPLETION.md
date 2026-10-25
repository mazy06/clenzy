# Preuve durable de fin du chat

25 octobre 2026. Suite cumulative de #519, dont toutes les CI sont vertes sur
`19079646e27c2f5a12ff5058559496eb3c56eb26`, scan backend compris.
Le candidat reste inactif : aucune route frontend basculée et aucun SDK retiré.

## Contrat explicite du candidat

Le candidat transmet `forwardedProps.completionPolicy = durable-text-v1`.
Son `runId` de requête est un UUID stable pour cet envoi, distinct du run
attribué ensuite par Java dans le flux SSE. Le reçu est lié à cet UUID ;
une ancienne preuve de fin ne peut pas qualifier une nouvelle requête.

L'admission durable précède le traitement. Pour une nouvelle conversation,
elle intervient à `conversation_created`, avant le message utilisateur et
les appels de modèle. Pour une reprise, elle précède la consommation de la
décision. Propriétaire et organisation sont validés en verrouillant brièvement
la conversation. Les transactions d'admission et de fin sont indépendantes
et courtes ; l'exécuteur refuse même un appel depuis une transaction externe.
Aucun appel modèle, outil ou fournisseur n'est exécuté sous ce verrou.

## Reçus et absence de rejeu

La migration Liquibase `0607__baitly_chat_turn_receipts.sql` crée
`baitly_chat_turns`, mappée par `BaitlyChatTurn`. Noms et colonnes des tables
existantes ont été vérifiés contre les entités et changesets. Les reçus ne
contiennent ni prompt, résultat d'outil, token, adresse, coordonnées ou erreur
brute : uniquement identité technique, périmètre, séquence, état et références
de messages. Les lectures restent explicitement scopées.

| État | Signification |
|---|---|
| RUNNING | Admission engagée ; absence de fin durable. Aucun timeout ne la transforme en autorisation de rejeu. |
| SAFE_TEXT | Fin purement textuelle démontrée, sans appel d'outil ni passage multi-agent. |
| PAUSED | Pause mono-agent enregistrée sans exécution observée, avec décision durable en attente. Reprise humaine explicite uniquement. |
| UNCERTAIN | Échec, contradiction, outil, multi-agent ou preuve de fin insuffisante. Blocage conservé. |

L'identité de requête est unique par organisation/utilisateur, même après
d'autres tours terminés. Une seule admission gagne par conversation ; une
coupure de processus après admission laisse RUNNING. Une erreur SQL ou une
fin incertaine ne retourne aucun permis d'exécution. Aucun retry, reprise
automatique, expiration de sécurité ou bouton de forçage n'est ajouté.

Une conversation déjà suivie ne peut pas contourner le journal en retirant
le marqueur ou en utilisant l'ancien endpoint : le contrôleur et le moteur
refusent le chemin non suivi lorsqu'un reçu existe. Les conversations legacy
sans reçu conservent leur chemin existant ; leur ancien historique n'est
jamais promu artificiellement en SAFE_TEXT.

## Ce qui démontre SAFE_TEXT

Le vrai moteur mono-agent signale la persistance de sa réponse finale. Le
journal vérifie ensuite exactement un nouveau message utilisateur et une
réponse assistant non vides, sans pièce jointe ni tool_calls, l'ID final,
le watermark de l'historique, une fin `stop` ou `end_turn`, une seule fin SSE,
et l'absence de décision d'outil. Toute divergence bloque.

Un appel d'outil, même déclaré read-only ou avec un résultat « succès »,
disqualifie cette preuve. Tout passage multi-agent la disqualifie également,
y compris s'il retombe ensuite sur une réponse texte. Un résultat enregistré,
une trace best-effort COMPLETED, un EOF ou une fin SSE ne prouvent aucun succès
externe. Les erreurs sont réduites à un diagnostic neutre, sans cause brute.

Les terminaux SSE sont retenus jusqu'au commit du reçu. Après le flux, le
client relit le serveur et vérifie la correspondance de la requête. Après
rechargement, un SAFE_TEXT couvrant encore exactement l'historique permet
un **nouveau message explicite**, sans renvoyer l'ancien. Un historique modifié,
un reçu manquant, un autre requestId, RUNNING ou UNCERTAIN garde le blocage.

## Qualification et portes restantes

Les tests appliquent le vrai changeset Liquibase, vérifient son second passage
et valident le mapping JPA contre le schéma obtenu. Ils exercent le vrai journal,
l'exécuteur, le moteur mono-agent, des appels fournisseurs synthétiques hors
transaction, la concurrence, le redémarrage, les pannes, le scope et le HTTP/SSE
en mémoire. La recette CI PostgreSQL utilise JSONB pour les métadonnées des
messages. Le passage local H2 ne qualifie pas à sa place PostgreSQL.

Validation locale : 100 tests backend ciblés et 91 contrats frontend sans
échec/erreur/ignoré ; typage strict et builds PMS/SDK réussis. Candidat absent
du bundle actif. Nouveaux tests et recette PostgreSQL obligatoires en CI.
Résultats de la nouvelle tête à confirmer séparément de #519.

Restent avant activation : preuves métier pour les tours contenant des outils,
refus/reprises, pièces jointes ou multi-agent ; qualification des neuf rendus
historiques, de l'état et du contrat découverte/relais. Aucun effet incertain
n'est réconcilié par supposition. Les avis de dépendances et FR10/FR11 restent
ouverts ; tests staging réservés à la campagne finale regroupée.

Suite : [preuves bornées des appels d’outils](BAITLY-CHAT-TOOL-EVIDENCE.md).
Le journal d’invocation 0608 ne modifie ni SAFE_TEXT ni la politique v1 ; une
preuve de lecture isolée ne débloque pas un tour contenant des outils.
