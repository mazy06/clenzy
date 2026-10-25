# Preuve complète des tours d’écriture et des reprises

État suivant : [vague technique regroupée](BAITLY-FINAL-TECHNICAL-WAVE.md), qui
intègre le chat natif et retire les SDK. Le présent document décrit la phase
historique antérieure ; ses limites ne sont pas toutes le statut courant.

Suite cumulative de #523, entièrement verte sur
`186e416e86eb6117ce7d583d68e992f0cdd5a72f`, scan compris. Son artefact de
recette PostgreSQL/JSONB 40180536402 confirme 89 cas SQL sans échec ni ignoré.

## Périmètre qualifié

Le reçu métier 0610 prouve le commit d’une mutation, pas la fin du tour de chat.
Le certificat 0611 ajoute une preuve de fin pour `update_property_status` et
`forget_fact`, avec confirmation durable. Il couvre un tour complet et la reprise
mono d’une pause immédiatement précédente. Des lectures qualifiées peuvent faire
partie de la séquence. Aucun appel modèle ou fournisseur n’a lieu dans la
transaction qui publie ce certificat.

Pour une reprise, le reçu précédent doit être PAUSED, sans invocation exécutée,
avec exactement la question et la demande d’outil ; sa fin doit être la baseline
du nouveau reçu et les séquences doivent se suivre. Tout l’intervalle est couvert :
question, demandes d’outils, résultats dans l’ordre et réponse finale non vide.
Pièces jointes, messages intercalés, appels inconnus ou résultats manquants et
dupliqués empêchent la qualification.

Chaque écriture exige une preuve métier commitée de son handler concret, son
invocation terminée et un résultat unique. La décision doit être CONFIRMED,
mono, du même propriétaire/organisation/conversation/appel/outil, et antérieure
au démarrage de l’invocation. Les arguments de la demande et de la décision
sont comparés comme objets JSON en mémoire, sans nouvelle copie persistante.
Une décision étrangère, refusée, encore en attente, tardive ou supplémentaire
fait échouer la couverture. Les décisions restent conservées pour audit.

La publication exige également l’observation d’un résultat sans erreur pour
chaque appel, d’une seule réponse finale persistée et d’un seul `done` cohérent,
sans erreur, multi-agent ni nouvelle pause. Elle intervient dans la transaction
de clôture du reçu, avant la remise du terminal au client.

## Lecture et protection contre le rejeu

La récupération existante ajoute `writeTurnEvidence`, sous ses contrôles d’accès
et sa lecture REPEATABLE_READ. Chaque certificat est revérifié contre les reçus,
messages, décisions et preuves métier actuels. Une contradiction renvoie UNCERTAIN
sans watermark ; une conversation archivée ou réattribuée ne publie rien à son
ancien propriétaire. Une panne SQL produit un diagnostic fixe, sans cause brute.

Le DTO ne contient que politique, ID technique de requête, TURN_PROVEN/UNCERTAIN,
référence du message final et indication de reprise. Aucun argument, résultat
outil, clé/valeur mémoire, ressource métier, adresse ou jeton n’y figure. Une
lecture depuis une transaction d’écriture en cours reste interdite.

**Cette preuve reste distincte de l’admission.** Le contrat `durable-tools-v2`
reste limité aux lectures ; `completion` demeure UNCERTAIN pour les écritures,
et `canStart` reste faux. Les anciennes versions continuent à bloquer. Aucun
ancien reçu ambigu n’est promu et aucun effet n’est réexécuté pour fabriquer
une preuve manquante. Une coupure après le commit métier, avant le résultat ou
la fin du tour, conserve COMMITTED sans certificat de fin et sans nouvelle admission.

## Limites et validation finale

Les refus sans exécution, plusieurs pauses successives, pauses après un premier
effet, reprises multi-agent, décisions historiques supplémentaires et mutations
non qualifiées restent bloquants. Une politique d’admission versionnée et son
adaptateur candidat restent à préparer avant de poursuivre après ces tours.
`remember_fact` nécessite toujours de séparer embedding et transaction. Aucun
succès fournisseur n’est déduit d’un reçu local. Le candidat reste inactif et
FR10/FR11 restent ouverts.

La recette SQL applique et rejoue les vrais changesets 0607 à 0611 et valide les
mappings JPA. Les services et handlers réels utilisent des délégations repository
SQL contrôlées ; les fixtures métier restent minimales. Le flux de décision CAS
et les contrôleurs sont couverts séparément par les suites existantes. Cette
recette locale n’est pas un test navigateur ni un test staging de bout en bout.
PostgreSQL/JSONB doit passer dans la CI propre à cette nouvelle tête. Les tests
staging restent réservés à la campagne finale regroupée, sans fournisseur ni
notification réelle dans cette vague.

Validation locale finale : 283 tests backend ciblés, dont 117 cas SQL, sans
échec, erreur ni test ignoré. Contrôle des rapports obligatoires réussi, suites
imbriquées comprises. Aucun code frontend modifié. La CI propre à cette nouvelle
tête, notamment PostgreSQL/JSONB et 0611, reste à confirmer.
