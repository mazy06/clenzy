# Baitly : édition nationale marocaine OSM et Overture

## Enrichissement depuis les sites officiels

Après construction de l'édition MA, le CI exécute
`enrich_baitly_morocco_websites.py --out DOSSIER`. Aucune découverte ni collecte
sur des annuaires tiers : seuls les domaines/identités de
`scripts/directory/morocco_website_policies.json` individuellement revus sont autorisés.
La revue porte sur l'identité du site et de l'établissement, les coordonnées
professionnelles, les restrictions publiées, robots et les pages retenues.
Elle n'accorde pas de licence sur les textes, images, tarifs, avis ou logos.

Le contrôle de réutilisation est limité à 90 jours maximum (premier lot : 60 jours).
Les pages de conditions ou, en l'absence de lien dédié, la page publique revue
sont empreintées. Changement de contenu, expiration, identité incertaine, erreur
réseau ou refus robots : pas d'enrichissement, motif dans `website-report.json`.
Un site indisponible n'est jamais considéré comme autorisé. Il faut relire et
mettre à jour la politique versionnée pour autoriser une nouvelle collecte.

Le fetch HTTPS vérifie les adresses DNS publiques et fixe l'adresse de connexion,
conserve le nom TLS, refuse les redirections hors domaines autorisés et les
ressources privées, borne taille/délais et respecte robots avant chaque requête.
Il ne suit aucun lien de découverte et espace les requêtes d'au moins une seconde.
Les formulaires, scripts, photos et avis ne sont pas collectés.

Une identité source unique et la concordance du nom et de la localisation sont
requises. Les champs existants sont conservés. Plusieurs coordonnées ou un domaine
email non vérifié passent en revue. Les numéros +212 et emails suivent ensuite les
validateurs backend habituels. Les services et prestations sont fondés uniquement
sur les affirmations explicitement examinées dans la politique.

Le snapshot conserve une preuve WEBSITE avec URL/date/empreintes, référence et
expiration de revue, champ complété et prestations. Liquibase 0595 autorise cette
preuve et conserve `website_services`. Le reader valide la portée Maroc, les URL,
dates, champs et services. Le pipeline de publication existant ne crée aucun
doublon, n'écrase pas les CRM privés et ne réactive pas les fiches supprimées.
L'API interne de référence et les snapshots d'import CRM conservent les services
et détails, sans accorder d'autorisation de campagne. Aucun nouvel écran ajouté.

Le CI publie le fichier enrichi immuable et sa notice puis le manifeste en dernier.
Chaque environnement reprend son ingestion et son indexation habituelles.
Une collecte refusée utilise les seules données OSM/Overture de la nouvelle édition,
sans reconduire aveuglément les anciennes coordonnées du site.

Premier lot du 21 octobre 2026 : M&H Pressing, Jazalum et Moroccan Maids sont
revus et enrichis en base locale, soit un email ajouté et quinze prestations
documentées. Aucun téléphone existant n'est remplacé. Le téléphone contradictoire
et l'adresse Gmail non vérifiée de Moroccan Maids sont en revue. Neteam reste
désactivé faute de résolution DNS directe ; Plomberie Jouhra n'est pas autorisé
faute de réponse robots exploitable. Le site national Cleanzy ne permet pas
d'attribuer sans vérification les coordonnées de franchise à l'établissement de Fès.

Les 21 310 identités marocaines sont conservées. Le snapshot et les preuves sont
ingérés par le même opérateur local/CD ; aucune modification des CRM ni des
autorisations de contact. Vérifications : 24 tests Python et 16 contrôles Java/
PostgreSQL ciblés, compilation Java 21 isolée et migration Liquibase réelle.
Le nouveau code doit être reconstruit/déployé pour servir les détails de prestations
dans l'API et les prochains imports CRM ; aucun redémarrage exécuté ici.

Les producteurs existants acceptent `--country MA` et conservent `SA` comme défaut
compatible. Aucun compte fournisseur ni identifiant légal inventé n'est nécessaire.

```bash
rtk proxy python scripts/directory/build_baitly_saudi_osm_snapshot.py --country MA --out /tmp/baitly-ma
rtk proxy python scripts/directory/build_baitly_saudi_public_snapshot.py --country MA --out /tmp/baitly-ma
```

Le PBF national officiel Geofabrik est contrôlé par la frontière OSM ISO3166 MA.
Overture est téléchargé par le client officiel ; seuls les points dans cette
frontière avec une adresse de pays MA sont retenus. La release, la licence, les
identifiants amont et les coordonnées disponibles restent dans les preuves.

Les métiers sont les mêmes qu'en Arabie saoudite : nettoyage, blanchisserie,
entretien/travaux, réparation, serrurerie/sécurité, jardin/piscine, nuisibles,
déménagement, gestion de biens, décoration/expertise et restauration/traiteurs.
Le mapping est fondé sur les catégories explicites, jamais sur le nom. Les lieux
fermés, scores Overture inférieurs à 0,5 et licences inconnues sont rejetés.

Les téléphones marocains valides sont normalisés en +212 ; seuls les emails
syntaxiquement valides et sites HTTPS acceptés sont exposés. Leur disponibilité
dans une source ne prouve ni leur délivrabilité ni une autorisation de campagne.
Les règles de contact CRM existantes restent inchangées.

Le dédoublonnage conserve la fiche OSM et complète uniquement ses champs vides
si le même métier et des preuves fortes correspondent de manière univoque dans
les deux sens : nom et adresse exacts à moins de 50 m, ou téléphone et domaine
web exacts à moins de 10 m. Les conflits et cas ambigus restent dans l'artifact
`review.jsonl`. Les branches distinctes restent distinctes. Les identités sources
`MA:OSM:...` / `MA:OVERTURE:...` et les alias empêchent les doublons de réimport.
La détection reste limitée aux preuves disponibles ; elle ne certifie pas
l'identité juridique de toutes les entreprises.

## Base, actualisation et CI/CD

### Diagnostic de livraison distante du 21 octobre 2026

Le manifeste `maps/directory/ma/latest.json` est absent du bucket (HEAD authentifié
404, GET anonyme 403). Le workflow présent sur `main` ne contient encore que
l'ancienne extraction OSM française ; aucun run du workflow des sources n'est
enregistré. Les sources SA/MA préparées localement doivent donc être intégrées
avant leur publication par le CI/CD. Un redémarrage backend ne publie aucun fichier.
Les secrets CI de publication existent ; leurs valeurs ne sont pas nécessaires
au diagnostic et ne sont jamais exposées.

Le workflow national vérifie maintenant la lecture anonyme du manifeste ET du
snapshot immuable, avec contrôle du SHA-256 et de la taille après publication.
Un upload authentifié réussi ne suffit plus à autoriser le déploiement.

En cas d'échec de lecture distante, la publication existante reste disponible :
ni les fiches, ni leurs coordonnées, ni leurs preuves ne sont modifiées.
`source_error` conserve le code HTTP, `retry_at` borne les nouvelles tentatives
avec délai exponentiel jusqu'à une heure, même si l'ancienne édition est terminée.
Une lecture réussie de cette même édition efface l'incident sans réimport.
L'opérateur CD peut recontrôler une source venant d'être publiée sans attendre
le prochain délai du scheduler. Aucun correctif manuel de base n'est requis.

Le tri spatial de la liste utilise des lots KNN ordonnés de taille croissante,
en incluant tous les ex æquo en frontière. Il continue jusqu'à obtenir la page
complète ou épuiser les résultats ; il ne présente pas un échantillon comme
exhaustif. Les limites de temps restent actives. Cette barrière de planification
évite le tri global de millions de lignes observé sur les vues très larges.

Liquibase 0594 étend la contrainte de l'annuaire et l'unicité des alias Overture
au Maroc. Aucun changeset antérieur n'est modifié. Le reader vérifie SHA-256,
taille, pays, portée complète et licence avant ingestion. Une édition partielle,
corrompue ou diminuant excessivement le stock ne remplace pas l'édition publiée.

Le workflow des sources construit SA et MA en matrice. Il publie le snapshot
immuable, les licences puis le manifeste en dernier sous `maps/directory/ma/`.
Il s'exécute avant le déploiement backend staging/production et chaque semaine.
Le script infra lance `com.baitly.ops.BaitlyPublicDirectoryImport` pour SA puis MA,
après le démarrage sain et les migrations. L'opérateur attend la fin de l'import
et la mise à jour de l'index spatial ; un échec fait échouer le CD. Les modifications
applicatives et infra doivent être intégrées ensemble avant déploiement.

Chaque base reçoit sa copie. Le scheduler reprend le contrôle chaque minute,
avec vérification de la source au plus une fois par heure. Les checkpoints et
verrous existants permettent la reprise, sans recréer les fiches déjà publiées.
Une ancienne édition OSM seule ne remplace pas une édition combinée.
Les retraits sont limités aux références OSM/Overture du pays : OMPIC, France,
Arabie saoudite, suppressions et données privées des organisations sont préservés.

Pour tester localement, configurer `baitly.directory.ma.osm.local-directory`
sur le dossier de l'édition (`latest.json` et `public-SHA.jsonl`). Les fiches et
leurs preuves restent enregistrées dans PostgreSQL. L'option
`baitly.directory.ma.osm.enabled=false` désactive la source publique.
Une source OMPIC autorisée et explicitement activée garde sa priorité.

## Comparaison vérifiée avec data.gov.ma, 21 octobre 2026

L'API CKAN publique `/data/api/3/action/package_search` est accessible sans compte.
La requête `entreprise` renvoie 11 jeux, principalement statistiques. Les fichiers
« Liaisons Data Entreprises » et « Entreprises déclarantes CNSS 2022 » ont été lus :
ce sont des séries/agrégats, pas des entreprises contactables.

L'[annuaire des agences de voyages](https://data.gov.ma/data/fr/dataset/annuaire-des-agences-de-voyages)
contient 846 lignes (595 avec un email), avec raison sociale, adresse, ville, coordonnées, agréments
et année. Les coordonnées mélangent téléphone, fax et email. Le fichier est
UTF-16 et tabulé malgré l'extension CSV. Licence affichée ODbL ; fichier modifié
le 18 décembre 2017. C'est une piste sectorielle à revalider, pas une source
actuelle exhaustive des prestataires de Baitly : aucun import automatique ajouté.

L'[annuaire des guides](https://data.gov.ma/data/fr/dataset/annuaire-des-guides-touristiques)
contient 2 764 lignes, avec nom, prénom, ville, catégorie et langue, mais aucune
colonne de téléphone, email ou adresse de rue. Le fichier d'hébergements disponible
porte « 2010 » : les métadonnées de publication ne garantissent pas sa fraîcheur.

## Première édition locale vérifiée

Édition Overture 2026-09-23.1 ; 246 144 lieux lus dans la zone, 11 537 retenus
après filtres. OSM : 10 874 références. Édition combinée : 21 310 fiches,
24 fusions univoques, 10 436 références Overture supplémentaires et 1 077
cas ambigus en revue. Contacts normalisés présents : 9 147 téléphones,
3 939 emails et 1 390 sites HTTPS. Ces comptes ne mesurent pas la délivrabilité.
Les restaurants/cafés représentent 20 477 fiches ; les filtres de services
permettent de cibler les autres métiers.

L'opérateur local a appliqué Liquibase 0594 et terminé la publication : 21 310
fiches actives et géolocalisées, 21 334 preuves, zéro erreur. La validation stricte
du backend conserve 3 937 emails (deux adresses supplémentaires rejetées),
9 147 téléphones et 1 390 sites. Index vérifié : révision 23, indexée 23.
Les 27 872 références saoudiennes restent présentes. Backend local : santé UP.
Les 17 tests Python et 15 vérifications Java/PostgreSQL ciblées passent ; les
tests de base utilisent un conteneur séparé et une base jetable, aucun redémarrage
des services applicatifs. La compilation ciblée Java 21 est isolée des builds locaux.

Le backend en cours d'exécution doit être reconstruit et recréé par l'utilisateur
pour utiliser les nouvelles identités marocaines lors des imports CRM et activer
le nouveau lecteur. L'édition en base est déjà disponible. Aucun environnement
staging/production ni bucket partagé n'a été modifié : leur alimentation et les
mises à jour publiques passent par le CI/CD après intégration des deux dépôts.
