# Baitly Prospection : refonte CRM

## Direction retenue

Demande explicite de l’utilisateur : remplacer la direction monochrome par une interface proche des références Monday CRM. Cette demande prime sur les anciennes règles visuelles pour ce module. Surface claire, tableau dense, cellules de statut et de qualification colorées, catégories propriétaire/conciergerie/prestataire distinctes. Navigation compacte CRM, carte, campagnes, demandes, formulaires et analyse. Retrait des introductions, compteurs isolés et titres répétés.

La fiche remplace le tableau pendant sa consultation. Les demandes apparaissent à gauche, les informations à droite ; les champs de contact vides ou déjà présents dans l’identité ne sont pas répétés. Les fonctionnalités de campagne conservent leur préparation en trois étapes et la validation explicite des destinataires avant envoi.

## Données réelles

- Les champs responsable, société, qualification, fonction, rôle précis et zone sont persistés par organisation dans `baitly_crm_contact_details` (Liquibase 0574).
- Le responsable provient des membres actifs disposant de `baitly-crm:view`. Les noms passent par les entités JPA et leur déchiffrement existant. Les anciens responsables devenus inéligibles sont masqués et signalés comme à réattribuer.
- Le score sur 5 mesure la complétude : email, téléphone, ville, provenance documentée et qualification confirmée. Il ne prédit pas une conversion.
- Les coordonnées de carte sont confirmées explicitement via une recherche, puis persistées dans `baitly_crm_contact_locations` (Liquibase 0573). Aucune coordonnée n’est inventée ; un changement de ville exige une nouvelle confirmation.
- Aucune affectation ni qualification ne donne une autorisation de contact. Les politiques d’envoi existantes restent appliquées côté serveur.
- Les colonnes facultatives et filtres sont des préférences serveur. L’export porte sur la sélection et neutralise les préfixes de formules CSV.

## Validation locale

Les migrations 0568, 0572, 0573 et 0574 ont été exécutées sur un PostgreSQL temporaire, puis rejouées sans nouveau changeset. Les tests de persistance, cloisonnement organisation et droits ont passé (15 tests PostgreSQL et 4 tests de contrôleur).

La validation visuelle utilise un assemblage hors ligne avec des contacts fictifs et un fond cartographique de test : elle ne valide pas les tuiles distantes de production ni l’envoi SMTP. Aucun serveur de preview ou conteneur Docker n’a été lancé ou redémarré. Les migrations et le backend mis à jour doivent être intégrés avec le frontend pour les nouvelles colonnes.

TypeScript et build Vite PMS validés. Seize tests frontend ciblés passent ; les sept tests CRM/éditeur ont été rejoués après les derniers ajustements. Vérification Chrome hors ligne sur 375, 768, 1024 et 1440 pixels, en clair, sombre et arabe : aucun débordement ni erreur détectée dans les parcours vérifiés, avec contrôle de contraste sur les éléments ciblés.

## Extension aux campagnes, demandes et formulaires

La même direction visuelle est appliquée aux écrans secondaires via `baitly-crm-workflows.css`, importé par la racine du module. Les campagnes utilisent un tableau avec cibles et statuts colorés ; la préparation garde ses trois étapes, sans les titres numérotés répétés. Les destinataires préparés sont plus denses, les messages restent consultables et la confirmation d’envoi reste obligatoire. Les conditions d’envoi et explications de suivi se déplient à la demande.

Les demandes reçues sont des lignes dépliables avec identité, objet, ville, extrait, date et suivi. Le message complet, les informations de candidature et la provenance sont conservés dans le détail. Dans une fiche contact, les demandes sont ouvertes initialement. Les alertes de rapprochement restent signalées dès la ligne de liste.

Les deux formulaires publics ont une grille commune, des choix de services compacts et un pied regroupant publication et enregistrement. Les liens publics n’apparaissent que pour les pages effectivement publiées. Les permissions et appels API existants sont conservés. L’import CSV est réservé aux vues de contacts ; les paginations ne sont affichées que lorsqu’elles sont nécessaires.

Validation : 12 tests ciblés des campagnes, demandes, recrutement et navigation CRM passent. Vérification hors ligne de 65 états sur les quatre tailles d’écran, en clair, sombre et arabe, sans débordement ou erreur JavaScript détectés. Les contrastes des statuts, boutons actifs et services sélectionnés passent le contrôle à 4,5:1. Ces vérifications utilisent des données fictives, sans publication ni envoi réel.

## Carte, pagination et retour au PageHeader partagé

Dernières demandes explicites de l’utilisateur : conserver le PageHeader partagé, y placer les actions principales de chaque onglet, utiliser le bleu Baitly pour les boutons et limiter les paginations CRM à 10 contacts. La direction colorée des cellules et catégories reste conservée.

- Racine restaurée sur `PageHeader`, `PageTabs`, `PageHeaderActionsProvider` et recherche unique `useScreenSearch`. Les actions des onglets utilisent le slot partagé, avec repli autonome pour les composants employés sans header. Les soumissions des formulaires conservent un identifiant de formulaire explicite pour fonctionner depuis le header.
- Contacts/carte : import et ajout ; campagnes : préparation, progression, préparation sans envoi puis envoi explicite ; demandes : actualisation ; formulaires : enregistrement ; analyse : actualisation. Les permissions et conditions d’activation restent celles des composants métier.
- Boutons principaux sur le token bleu `--bui-navy`, avec adaptation sombre et repli de contraste pour les portails du menu mobile.
- Table : 10 contacts par page de groupe ; pipeline : 10 par colonne ; liste de carte : 10 par page. La carte continue de positionner tous les contacts filtrés disposant d’une localisation confirmée.
- Pastilles propriétaires bleues et rondes, conciergeries violettes avec angles arrondis, prestataires turquoise avec une troisième forme ; icônes maison, clé et outil. Le clic ouvre une fiche compacte et conserve la carte. La fiche complète nécessite l’action explicite « Ouvrir la fiche ».
- Sur mobile, l’aperçu est ancré au bas de la carte pour rester lisible. Les contacts non localisés restent consultables depuis la liste, sans repère inventé.
- La sélection depuis la liste demande d’abord au moteur de sortir le repère de son groupe avant de piloter la sélection : ouvrir directement la bulle d’un marqueur encore regroupé pouvait échouer sur mobile.

Vérification : 25 tests du module réussis, dont aperçu puis ouverture de fiche complète et pagination à 10. Contrôle Chrome hors ligne des ouvertures, fermetures et réouvertures des trois pastilles, des fiches sur quatre tailles en clair/sombre/arabe et du positionnement des actions dans le PageHeader. Les tuiles distantes ne sont pas testées par ce montage hors ligne.

## Retrait des liserés et suppression des contacts

Demande utilisateur suivante : retirer les liserés des tableaux et permettre la suppression individuelle ou groupée. Le bord coloré de 5 px a été supprimé ; seul le cadre neutre fin du tableau reste.

Chaque ligne éditable dispose d’une corbeille. La barre de sélection propose « Tout sélectionner (N) », portant sur tous les résultats filtrés, y compris les autres pages et groupes. La confirmation fige les contacts concernés et affiche leur nombre. Annuler n’envoie aucune requête ; une erreur conserve la confirmation et la sélection, sans reprise automatique.

La suppression reprend le retrait logique existant : `archived=true`, conservation des identités, historiques et oppositions. Le nouvel endpoint `POST /api/prospects/bulk-delete` requiert les droits de lecture et gestion, valide l’organisation et la verrouille avant mutation. La sélection explicite est dédupliquée et entièrement vérifiée dans l’organisation avant toute modification. Une ressource absente ou étrangère refuse tout le lot. Le service est transactionnel et la requête est limitée à 10 000 identifiants. Aucune migration nécessaire ; le backend doit être livré avec le frontend pour cette action.

Validation : 29 tests frontend du module et 18 tests backend ciblés (service et droits) passent. Vérification Chrome hors ligne de la confirmation, de l’annulation, de la suppression d’une ligne puis de tous les contacts restants, sur mobile/bureau en clair, sombre et arabe : aucun échec détecté. Ces suppressions portent uniquement sur les contacts fictifs du montage de test.

## Largeurs adaptatives, barre unique et couleurs des onglets

Les tables utilisent désormais la mesure intrinsèque du navigateur (`table-layout:auto`, largeur selon le contenu, plancher à la largeur disponible). Les anciennes largeurs fixes ont été retirées ; seules les cases de sélection et actions conservent une largeur compacte. Les noms et emails très longs ont une limite et leur valeur complète en infobulle. Les en-têtes restent lisibles et le tableau défile horizontalement si nécessaire.

Les filtres de type/étape sont injectés dans la même barre que responsable/qualification, tri/colonnes, sélection et changement de vue. Des filets verticaux séparent les groupes. La barre ne revient pas à la ligne ; elle défile sur les petits écrans. Le choix des colonnes utilise le Popover partagé, rendu en portail pour rester visible hors de cette barre.

`PageTabItem.color` est une option additive : seuls les onglets qui déclarent une couleur la reçoivent dans le sélecteur et la bande. Prospection fournit six teintes en clair/sombre, avec icônes colorées conservées dans les menus en portail. Le PageHeader partagé reste en place.

Validation : TypeScript, build PMS et les 29 tests du module passent. Vérification visuelle hors ligne sur 375, 768, 1440 et 1790 pixels, en clair/sombre/arabe : filtres sur une ligne, en-têtes non tronqués, Popover des colonnes accessible et six couleurs distinctes dans le menu du header.

## Glisser-déposer du pipeline

Les contacts peuvent être déplacés entre les colonnes visibles via leur poignée, avec `@dnd-kit/core` déjà installé. Le clic sur la carte garde son rôle d’ouverture de fiche. Souris (seuil de mouvement), toucher (appui de 200 ms), et clavier (Espace, flèches horizontales, Espace ; Échap pour annuler) sont pris en charge. Les colonnes sont des zones de dépôt, y compris lorsqu’elles sont vides.

Le dépôt modifie uniquement `status` via le PUT existant du contact. La carte change immédiatement de colonne pendant l’enregistrement, les déplacements supplémentaires sont bloqués et les requêtes CRM sont invalidées après succès. Un échec replace la carte dans son étape initiale et affiche une erreur ; les annulations et dépôts dans la même colonne n’écrivent rien. Les colonnes paginées basculent sur la page du contact déplacé. Le focus clavier est restauré sur sa poignée après l’enregistrement.

La capacité `canManage` est transmise par la racine et bloque les poignées ainsi que la soumission des déplacements pour les membres en lecture seule. Les contrôles existants d’organisation et de droits restent appliqués par l’API. Le changement d’étape ne modifie aucune autorisation de contact.

Validation : 33 tests frontend passent, dont enregistrement d’étape, annulation, dépôt hors colonne, lecture seule et retour à la colonne d’origine après échec. Les essais navigateur hors ligne valident souris, clavier, annulation et toucher réel simulé par CDP, sans ouvrir la fiche par accident. Aucun contact réel n’a été déplacé pendant ces tests.
