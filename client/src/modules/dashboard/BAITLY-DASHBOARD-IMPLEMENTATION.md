# Dashboard Baitly : suivi d’implémentation

## Premier lot, 3 octobre 2026

### Données et chargement

- La synthèse serveur expose le contexte financier (dates, fin exclusive, fuseau du `Clock`, devise, définition) et les revenus par canal. Les deux utilisent le CA hébergement proratisé, hors annulations, et le même périmètre hôte/organisation.
- Les revenus de réservation sont consolidés en EUR via les taux historiques existants, puis convertis pour l’affichage par `Money`. Aucune somme brute de devises différentes dans ces KPI. Un taux manquant provoque une erreur visible, jamais un taux fictif de 1.
- Les canaux suivent le filtre global. Le filtre local mois/année est remplacé par les dates explicites de la fenêtre commune.
- Occupation et rapports partagent la requête portefeuille. Deux widgets d’un même rapport financier partagent leur cache, cloisonné par utilisateur et organisation.
- Les requêtes de rémunération, devis et tarifs terrain sont activées uniquement pour les métiers concernés. Le polling de versement inutilisé est retiré de l’overview.
- Les modules de rapports sont importés à la demande. Les widgets importés hors écran attendent l’approche du viewport avant de monter leurs hooks. Le catalogue et l’éditeur de disposition sont également chargés à la demande.
- Chaque bloc natif présente un squelette ou une erreur avec reprise. L’overview n’attend plus le statut d’onboarding pour afficher ses widgets.
- Le graphique mensuel ne remplace plus un échec de chargement des versements par zéro. Ses bornes utilisent les dates locales et excluent les périodes de versement futures.

### Interface

- Disposition recommandée réduite de 17 à 7 widgets : indicateurs, journée/actions, historique/canaux, arrivées/occupation.
- Clé `dashboard.layout.v2`, identifiants, retraits et largeurs sauvegardés conservés. Pour adopter volontairement le nouveau défaut : **Personnaliser → Réinitialiser**.
- Répartition CSS selon la largeur disponible et le contenu : minimum de 520 px pour le graphique, 800 px pour le tableau d’arrivées et 320 px pour les synthèses. Les proportions sauvegardées s’appliquent tant que ces minimums le permettent ; sinon les voisins redistribuent l’espace ou passent à la ligne.
- Suppression des mesures de hauteur et des panneaux redimensionnables en lecture. Le redimensionnement reste disponible en mode Personnaliser, au pointeur et au clavier.
- Après ajustement demandé : hauteur standard de 28 rem (448 px à la taille de texte par défaut), commune à tous les widgets d’une ligne. Seuls les bandeaux d’indicateurs et alertes isolées gardent une hauteur naturelle. Les listes longues défilent dans un corps accessible au clavier ; leur titre et leurs actions restent en place.
- Le graphique mensuel remplit l’espace disponible dans cette hauteur bornée. Les mois sont traduits au rendu, sans tronquer juin et juillet en deux libellés identiques.
- Journée regroupée dans une surface ; départs ouvrables comme les arrivées, ménages reliés à leur fiche. Les horaires sont nommés « fenêtre » et restent lisibles sur téléphone.
- Canaux : cinq lignes initiales, part des autres canaux annoncée, bouton pour les révéler, devise source explicite et variation de part visible.
- Valeurs secondaires des blocs modifiés à 12 px minimum ; nouveaux libellés traduits en français, anglais et arabe.
- Les textes longs reviennent à la ligne. Les prochaines arrivées passent du tableau à une liste détaillée sous 800 px, avec toutes les informations et les actions conservées. En édition, les poignées respectent les mêmes minimums de largeur ; aucune préférence n’est écrite simplement en redimensionnant la fenêtre.
- Prochaines arrivées : logos officiels des canaux via le registre partagé, nom accessible au clavier et aux lecteurs d’écran, icône de repli pour les canaux sans logo. Les colonnes nuits et canal sont centrées, les dates restent sur une ligne, les montants sont alignés en fin de ligne et les noms/logements se partagent l’espace restant.
- Les largeurs des arrivées sont portées par un `colgroup` commun à l’en-tête et aux lignes. Statut et total forment un groupe compact aligné en fin de cellule. Les limites de cinq arrivées et six logements sont retirées : toutes les données reçues occupent l’espace disponible, puis défilent dans la hauteur standard. Il n’est plus nécessaire de cliquer pour voir les logements suivants.

## Vérifications

- 83 tests frontend passent : dispositions historiques, premier usage, cache et changement de compte/organisation, montages différés, erreurs, devises, dates, i18n et révélation des canaux.
- 11 tests du service de synthèse passent, dont devises multiples, somme des canaux égale au KPI, annulation, proratisation et périmètre hôte.
- TypeScript et build de production réussis. Le build conserve des avertissements de taille sur des bundles globaux ; aucun objectif LCP/INP n’est déclaré atteint sans profilage.
- Tests Chromium sur les composants réels avec des données simulées, sans serveur de preview : 375/768/1024/1440 px. Le contrôle porte sur les hauteurs communes, les textes longs, les listes développées, les rapports importés et les proportions déséquilibrées. Redimensionnement au clavier vérifié ; aucune préférence écrite au montage de l’éditeur.
- Thème sombre et arabe RTL vérifiés. Contraste du texte secondaire sur carte : 5,88:1 en clair, 6,65:1 en sombre. Proportions personnalisées 60/40 vérifiées à 1440 px.
- Cette validation de composants ne remplace pas une recette authentifiée avec des données réelles.
- Après les derniers ajustements des colonnes et des listes : TypeScript, 19 tests ciblés et 10 scénarios Chromium passent. La fixture contient 14 arrivées et 10 logements ; aucune limite de cinq/six lignes ne subsiste dans ces deux widgets. Logos accessibles au clavier, hauteurs de 448 px et absence de débordement horizontal vérifiés.

## Suite du plan

1. **Finances mensuelles** : consolider les devises du moteur historique et des reversements avant de rapprocher complètement le graphique mensuel des autres revenus. Définir séparément brut, hébergement, engagement de versement et trésorerie ; remplacer le libellé ambigu « Reste » par la définition validée. Les rapports importés conservent encore leurs définitions propres.
2. **Analytique importée** : isoler les calculs réellement nécessaires à chaque widget pour éviter que plusieurs hooks remontent tout un onglet et recalculent son moteur. Le partage des requêtes ne partage pas automatiquement ces calculs.
3. **Navigation et accessibilité globale** : rendre le compteur d’actions du header directement actionnable, auditer la sidebar, compléter la lecture alternative des graphiques et le parcours clavier de tous les états.
4. **Mesure sur l’application réelle** : réseau lent, portefeuille volumineux, changement de période/devise, scénarios d’erreur partielle, ancien layout à trois colonnes, rôles terrain. Mesurer LCP/INP/CLS, nombre de requêtes et temps de rendu avant/après avec les mêmes données.

Pas de migration SQL, de modification des configurations de sécurité ni d’opération sur les conteneurs dans ce lot. Déploiement à réaliser par le circuit CI/CD habituel.

## Console et chargement sur staging, 10 octobre 2026

La recette authentifiée montre un HTTP 500 sur `/api/dashboard/action-items`,
avec le widget « À traiter » en erreur. Un cas est reproduit par test :
`GuestPhotoUrlResolver` renvoie normalement `null` pour un voyageur sans photo,
mais `Collectors.toMap` refuse cette valeur et fait échouer toute la file.
Les photos absentes sont désormais omises du dictionnaire ; les actions,
leurs compteurs et les autres photos restent disponibles. Le filtrage par
organisation reste effectué avant toute résolution de photo.

Les photos des widgets et l'alerte des contrats manquants appelaient toutes deux
`propertiesApi.getAll()` sous deux clés de cache. Elles utilisent désormais
`usePropertiesList` et partagent une requête, avec les invalidations déjà
utilisées lors des créations/imports/suppressions de logements. Les rôles sans
accès aux contrats ne déclenchent pas cette requête depuis l'alerte.

Les erreurs Google Fonts/Workbox et SSE sont communes au shell et couvertes
par la PR #438. L'avertissement du sandbox Keycloak reste inchangé.
Les URL des ressources signalées comme préchargées mais inutilisées ne sont
pas présentes dans l'extrait de console ; aucune suppression de préchargement
n'est faite sans connaître les ressources concernées.

Le gain réseau démontré par test est une requête de portefeuille supprimée
quand ces widgets sont montés ensemble. Aucun gain de LCP ou de temps total
en millisecondes n'est annoncé avant une mesure comparable sur staging.

Validation : le test du voyageur sans photo échoue avant le correctif et passe
après. Les 13 tests de lecture de la file et les 3 tests SSE passent, ainsi que
24 tests frontend ciblés, TypeScript et le build Vite de production.
Le CI complet du lot précédent a identifié deux inventaires d'architecture
à compléter pour le heartbeat SSE : cadence rapide justifiée et état local
à chaque instance, sans verrou distribué. Les règles générales restent intactes.
