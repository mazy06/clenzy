# Preuves métier des écritures internes du chat

Suite cumulative de #522, dont toutes les CI sont vertes sur
`7732f2070bb684c81d22dfcba9d07993c608c199`, scan compris. L’artefact de recette
PostgreSQL/JSONB 40176446516 confirme 71 cas SQL sans échec ni test ignoré.
Le candidat reste inactif ; aucune fusion, activation de SDK ou mise en service.

## Portée de cette vague

Deux chemins internes sont qualifiés : `update_property_status`, via le vrai
`PropertyService.updateStatus`, et `forget_fact`, via `AssistantMemoryService.forget`.
Ils ne font pas d’appel fournisseur métier dans la transaction instrumentée.
Les droits et confirmations existants restent l’autorité d’exécution. Une preuve
ne donne jamais le droit d’appeler un outil, ni de le rejouer.

Le journal d’invocation STARTED est commité avant le dispatch. L’observation
reconnaît l’implémentation concrète des deux handlers, pas seulement leur nom ou
un descripteur. Dans la mutation métier, après save/delete et avant la fin de
transaction, elle écrit le reçu sur la **même connexion et dans la même transaction**.
Il n’y a ni REQUIRES_NEW pour la preuve métier, ni callback best-effort après commit.

Liquibase 0610 crée `baitly_chat_write_business_proofs`, mappée par
`BaitlyChatWriteBusinessProof`. Noms des ressources vérifiés contre les entités
et changesets : `properties`, `assistant_memory`. Le reçu contient identité
technique d’invocation, périmètre, ressource numérique, catégorie fermée et,
pour le logement, statut cible parmi les quatre valeurs connues. Il ne copie
ni clé/valeur de mémoire, nom/adresse de logement, argument, résultat, jeton ou
diagnostic. Les migrations précédentes restent immuables.

## Atomicité et absence de rejeu

Une transaction absente, en lecture seule ou associée à une autre datasource ne
peut pas écrire un reçu. L’invocation doit encore être STARTED et son tour RUNNING,
avec le même propriétaire et périmètre. Une seule preuve est admise par invocation.
Une panne du journal fait annuler la transaction métier ; un rollback ou une erreur
de flush JPA annule aussi le reçu. Une lecture dans la transaction d’écriture en
cours ne peut pas présenter ce reçu provisoire comme COMMITTED.

Une fois la transaction commitée, une coupure avant le résultat de chat laisse
la preuve métier disponible. L’état du tour reste UNCERTAIN ; la requête et
l’invocation ne sont pas réadmises. On ne réexécute pas l’action pour obtenir
son résultat manquant. Une exception de sérialisation ou un doublon de résultat
ne fait pas disparaître le fait métier commité, sans transformer le tour en succès.

La preuve atteste une opération passée, pas l’état actuel et éternel de la ressource.
Une modification ultérieure ne signifie pas que l’opération précédente n’a pas eu
lieu. Les lectures de récupération ne relancent donc jamais une mutation.

## Isolation et diagnostics

La suppression de mémoire recherche et verrouille explicitement l’entrée par
organisation/utilisateur/clé, puis supprime par organisation/utilisateur/ID.
Une entrée absente ne fabrique pas de preuve de suppression. Aucun filtre
Hibernate implicite n’est nécessaire pour sécuriser cette écriture.

Les exemptions staff existantes sur les logements sont conservées. Une écriture
cross-organisation déjà autorisée peut s’exécuter, mais ne reçoit pas de preuve
pour le périmètre différent de la conversation ; le tour reste incertain.

`GET /api/agui/recovery` ajoute `writeEvidence`, après les mêmes contrôles d’accès.
Il expose l’ID technique de preuve et la catégorie COMMITTED, séparément de la
présence du résultat : MISSING, RECORDED ou CONFLICT. RECORDED indique uniquement
qu’un message existe, pas que ce message vaut un succès externe ou une fin de tour.
Ni l’ID de ressource, ni le statut cible, ni le texte métier n’y sont exposés.
Les erreurs SQL, services et handlers touchés sont neutralisées, sans cause brute.

## Limites conservées

Le reçu d’appel générique demeure UNVERIFIED/UNCERTAIN pour ces écritures.
Le contrat `durable-tools-v2` reste limité aux lectures qualifiées ; aucun nouveau
SAFE_WRITE, changement de confirmation ou déblocage de conversation n’est ajouté.
Un retour positif d’un handler non qualifié ne crée aucune preuve métier.

Restent à qualifier : correspondance complète des écritures/refus/reprises et de
leurs décisions avant une politique de fin dédiée ; autres mutations et effets
externes (paiements, messages, documents, calendriers/channels, workflows).
`remember_fact` n’est pas une lecture malgré son descripteur : son embedding et
sa transaction doivent être séparés avant qualification. Aucun succès fournisseur
n’est déduit d’une modification locale et aucun effet incertain n’est rejoué.

## Qualification

La recette applique réellement 0607 à 0610, teste leur second passage et valide
les mappings JPA des journaux contre le schéma obtenu. Les services et handlers
réels sont exécutés avec délégations repository SQL contrôlées : commit, rollback,
panne de preuve, ressource absente, isolation, staff autorisé, coupure après effet,
résultat dupliqué et implémentation non qualifiée. Un vrai JpaTransactionManager
et Hibernate vérifient aussi la connexion partagée et le rollback à un flush tardif.
Les fixtures métier sont minimales, pas un remplacement de tout le schéma applicatif.

H2 local et PostgreSQL/JSONB CI sont distingués ; la CI propre au nouveau candidat
reste obligatoire. Les suites de services/handlers sont ajoutées à la recette
financière obligatoire, avec refus des rapports manquants, vides ou ignorés.
Pas de fournisseur réel ni de notification de recette. Les tests staging restent
réservés à la campagne finale regroupée ; FR10/FR11 et les avis de dépendances ouverts.

Validation finale locale : 255 tests backend ciblés, dont 89 cas SQL, sans
échec/erreur/test ignoré. Contrôle des rapports obligatoires réussi, avec suites
imbriquées prises en compte. Aucun code frontend modifié. La CI propre à la
nouvelle tête, notamment PostgreSQL/JSONB et 0610, reste à confirmer.
