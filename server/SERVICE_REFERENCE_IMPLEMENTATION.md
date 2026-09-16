# Baitly — Bilan du référentiel commun PMS / Marketplace

Date : 16 septembre 2026.

> Les sections ci-dessous conservent les bilans successifs de l'implémentation.
> Les réserves liées aux redémarrages décrivent leur état à cette étape, pas un diagnostic
> du serveur actuellement lancé. Voir le bilan final en fin de document.

## Formulaire de création des demandes

La route `/service-requests/new` utilise maintenant une composition Baitly UI : logement,
catalogue recherchable et filtrable par métier, sélection multiple, précisions et durée par
prestation, date et consignes communes, puis récapitulatif budgétaire. Les départs de voyageurs
restent une aide facultative à la saisie. Les textes d'interface sont traduits en FR/EN/AR.

- Une sélection crée une demande PMS distincte via le service existant, dans une transaction
  commune. Le demandeur vient du JWT ; le logement est chargé avec contrôle d'organisation.
- Une clé de soumission réutilise le mécanisme `auto_flow_key` pour éviter les doublons lors
  d'une relance. Une reprise avec des paramètres différents est refusée pour une demande existante.
- L'attribution, les contrôles de capacité et de disponibilité restent dans le parcours PMS.
- Le budget appelle le moteur serveur pour les trois prestations de ménage qu'il couvre.
  Il affiche explicitement un repère plateforme en EUR, et non un tarif prestataire accepté.
  Les autres prestations restent sur devis. Les devis inconnus sont exclus du sous-total.
  Aucune formule tarifaire ni aucun montant fictif n'est calculé dans le navigateur.
- La durée de planification est entière, conformément au contrat serveur existant. Les minutes
  indicatives du moteur restent visibles ; le créneau proposé est arrondi à l'heure supérieure.
- Les contrôles visuels ont couvert 375, 768, 1024 et 1440 px, ainsi que la sélection au clavier.
  Les couleurs utilisent les tokens Baitly ; contraste calculé sur les surfaces claires et sombres.
- 103 tests backend et 6 tests frontend ciblés réussis, dont un test transactionnel avec échec
  de la seconde création et vérification qu'aucune demande du lot n'est conservée.
- Vérification TypeScript et compilation Vite de production réussies sur le formulaire final.
- Les endpoints `/api/service-requests/estimate` et `/api/service-requests/batch` nécessitent
  un redémarrage du serveur de développement. La création connectée et les montants renvoyés
  par ce serveur restent à vérifier ensuite. Aucun lot de test n'a été créé dans la base dev.

Le formulaire d'édition existant et le formulaire rapide du planning ne sont pas refondus
dans ce lot ; ils continuent d'utiliser les demandes PMS existantes.

## Architecture livrée

Le catalogue existant `marketplace_service_categories/items` reste la source des prestations.
Les rôles de connexion ne déterminent plus les compétences. Les anciens types restent des
projections de compatibilité, résolues par une table de correspondances.

| Sujet | Implémentation |
| --- | --- |
| Référentiel | Code précis sur les demandes et interventions ; domaine professionnel distinct du payeur ; modes sur site, à distance et livraison configurables par données. |
| Capacités | Capacités explicites des équipes ; profil personnel unique partagé entre organisations ; ajout possible pendant une mission, retrait protégé par les verrous d'affectation. |
| Logements | Associations organisation cliente / logement / prestation / équipe, priorité et activation ; suppression ciblée ; sélection des partenaires selon leurs offres visibles et capacités. |
| Attribution | Contrôle commun de contexte, capacité, logement, documents et disponibilité ; revalidation sous verrou ; motifs d'inéligibilité dans les suggestions. |
| Besoin commun | Demandes PMS, nouvelles missions directes et sollicitations marketplace qualifiées et datées ; réutilisation du besoin à l'acceptation ; commandes concurrentes bloquées. |
| Exécution à distance | Logement facultatif selon le catalogue ; date utilisée comme échéance ; absence de réservation de créneau lorsque le catalogue le prévoit. |
| Justificatifs | Périmètre précis ITEM, reprise des anciens périmètres certains ; les exigences explicites par pays/statut/prestation restent applicables à distance. |
| Producteurs | Réservations et imports, récurrences, automatisations et outil assistant conservent la prestation ; outil assistant de découverte du même catalogue. |
| Interfaces | Sélecteurs communs, capacités des équipes et indépendants, associations logement, formulaires, libellés et raisons d'inéligibilité ; textes FR/EN/AR. |
| Retrait legacy | Suppression des anciens matchers de type et de rôle ; correspondances de tarifs centralisées sur le référentiel. |

## Migrations additives

0461 références et correspondances ; 0462 capacités et associations ; 0463 protection des
capacités pendant les missions ; 0464 périmètres documentaires ; 0465 règles d'exécution ;
0466 réservation uniquement par l'exécution lorsqu'elle existe ; 0467 documents à distance ;
0468 origine commerciale du besoin ; 0469 propriétaire unique des capacités personnelles ;
0470 reprise des anciennes missions qualifiées ; 0471 invariant non nul de l'urgence des demandes.

Les migrations précédentes ne sont pas réécrites. La reprise n'émet aucune notification,
ne crée aucun paiement et ne copie aucun montant dans un nouveau circuit financier.
Les anciennes missions qualifiées sont rattachées au besoin commun ; les liens existants sont conservés.

## Invariants conservés

- Le tarif courant reste dans ProviderTariff ; un montant accepté reste dans l'accord.
- La demande source ne réserve plus l'ancien prestataire après remplacement de la mission.
- Une spécialité commune ne donne aucun accès aux conversations d'un autre prestataire.
- Une absence signale un conflit sans réattribution automatique.
- Une récurrence crée une nouvelle demande, avec une nouvelle vérification d'éligibilité.
- Une annulation commerciale utilise son parcours et son dossier financier existants.

## Limites explicites et recette restante

- Une sollicitation sans date ou sans prestation suffisamment qualifiée reste en préparation
  commerciale. Aucun logement, créneau ou métier n'est inventé pour créer prématurément une mission.
- Les références historiques ambiguës ou contradictoires restent dans
  `service_catalog_reference_issues`. Leur choix relève d'une validation métier ; les accords
  acceptés ne sont pas réécrits automatiquement pour faire disparaître un diagnostic.
- Certains regroupements et filtres d'affichage historiques restent compatibles avec les anciennes
  données. Ils ne constituent plus une autorisation d'exécuter une prestation.
- Le redémarrage effectué par l'utilisateur le 16 septembre a appliqué avec succès les migrations
  0461 à 0470 ; Spring Boot a démarré et le conteneur est sain. La lecture des demandes a toutefois
  révélé une erreur 500 : la reprise SQL 0470 omettait `is_urgent`, nullable dans l'ancien schéma
  mais booléen primitif dans l'entité. Le correctif additif 0471 remplit les valeurs nulles par
  `false`, conserve les valeurs explicites et impose une valeur par défaut ainsi que `NOT NULL`.
  Son application et la recette des écrans connectés restent à vérifier après un nouveau
  redémarrage par l'utilisateur. Aucun conteneur n'a été redémarré par l'agent.
- Les logs signalent aussi une transaction iCal annulée (`rollback-only`) ; ils ne permettent
  pas d'en déterminer la cause. Ce point n'est pas considéré comme validé.
- Les tests conditionnels nécessitant Docker/Testcontainers n'ont pas été activés.
- Aucun déploiement ni push. Le commit préalable est `f722e41f1` ; l'implémentation qui suit reste
  dans l'arbre de travail pour revue.

## Validation

- Correctif après redémarrage : 109 tests ciblés réussis, dont 6 sur PostgreSQL réel.
  Le test de reprise reproduit l'urgence nulle laissée par 0470 puis applique 0471 ; un autre
  vérifie la conservation des urgences explicites, la valeur par défaut, le rejet des valeurs
  nulles en insertion et modification, et la réexécution sans perte de données.
- 2313 tests backend distincts réussis sur les suites ciblées et leurs relances après corrections.
- 6 tests ReservationServiceIntegrationTest ignorés : environnement Docker/Testcontainers non activé.
- 56 tests frontend ciblés réussis.
- TypeScript sans erreur ; compilation Vite de production réussie.
- SQL des nouvelles migrations exécuté sur PostgreSQL temporaire, avec cas de reprise,
  périmètres documentaires, conflits, unicité et isolation des organisations.
- Reprise historique exécutée deux fois dans le test : aucun doublon, aucun montant recopié.
- `git diff --check` réussi.
- Avertissements de compilation frontend : certains bundles volumineux et base Browserslist ancienne.
  Ils ne bloquent pas la compilation.
- La validation SQL isolée ne remplace pas un démarrage complet Spring Boot/Liquibase sur la base de développement.

## Correction des listes et des références spécialisées

- 0471 reste nécessaire pour reprendre is_urgent NULL et imposer DEFAULT FALSE / NOT NULL.
- 0472 ajoute les références exactes sols, cuisine et sanitaires, sans écraser les accords ou qualifications existants. La reprise 0470 est rejouée dans ce changeset pour rattacher les nouvelles références au besoin commun.
- Les listes affichent désormais une erreur avec réessai au lieu de statistiques zéro et d’un faux état vide lors d’un échec API.
- Le serveur doit redémarrer avec Liquibase actif pour appliquer les changesets en attente.

## Bilan final avant commit

- Parcours de demande avant acceptation, puis intervention liée ; exclusion des demandes
  déjà converties des listes actives. Les propositions reçues et candidatures publiques
  restent intégrées à l'écran des demandes de service.
- Attribution interne prioritaire puis ouverture publique selon l'éligibilité ; propositions,
  accord tarifaire, expiration et réattribution. Les situations sans candidat ou nécessitant
  une qualification restent explicites : aucune attribution fictive ne masque ces blocages.
- Traitement réactif par événements Kafka, travaux durables et échéances ciblées ; récupération
  au démarrage et lors du rééquilibrage des consumers. Le décompte est local au navigateur,
  les changements sont propagés par SSE. Aucun balayage métier toutes les minutes.
- Migrations additionnelles 0473 à 0476 pour propositions, réservations de créneaux,
  préférences de contact et travaux durables. Liquibase reste la source du schéma.
- Vues carte mutualisées avec chargement de la liste par lots de 20, logement illustré,
  intervenant, créneau, priorité et retard. Catalogue prestataires mutualisé avec variantes
  de rôle, colonnes adaptatives et filtres intégrés.
- Fiche de demande restructurée : photo rectangulaire du logement, consignes prioritaires,
  accès distinct, créneau local, tarifs et contacts. Le suivi distingue les étapes terminées,
  l'étape actuelle et la prochaine action ; l'échéance n'est montrée que si elle existe.
- Dernière validation frontend : 78 tests sur 16 suites modifiées, TypeScript sans erreur.
  Compilation Vite réussie avant les derniers ajustements visuels ; ces ajustements ont
  été vérifiés dans le navigateur, sur ordinateur et mobile, et par TypeScript.
- Validation antérieure de l'attribution réactive : 54 tests backend, dont 11 tests
  PostgreSQL/Liquibase, et 24 tests frontend ciblés. Les tests de projection du logement
  et des photos sont également passés.
- Passe finale globale : 963 tests backend réussis sur 54 suites modifiées. Deux attentes
  anciennes de recalcul immédiat du tarif ont été remplacées par la vérification de l'envoi
  d'une proposition sans écrasement du prix. Le refus de réattribuer une demande payée ou
  déjà convertie est également protégé avant l'appel au moteur d'attribution.

### Limites de validation conservées

La réussite des tests ne constitue pas une recette exhaustive de tous les rôles ni de tous
les échanges Kafka/SSE sur l'infrastructure déployée. L'ancien signal iCal `rollback-only`
n'a pas fait l'objet d'une investigation dédiée dans ce lot. Les références historiques
ambiguës nécessitent toujours une qualification métier. Aucun conteneur n'a été relancé
par l'agent ; aucun push ni déploiement n'est inclus dans cette livraison.
