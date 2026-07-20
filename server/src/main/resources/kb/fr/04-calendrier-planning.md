# Calendrier et planning multi-logements dans Baitly

## Comment fonctionne le Planning multi-logements ?

Le menu Planning affiche le calendrier de tous vos logements sur une même vue : une ligne par propriété, une frise de dates en colonnes, et des barres colorées représentant les réservations et les blocages. Trois niveaux de zoom sont disponibles : Semaine, Quinzaine et Mois. Les flèches permettent de naviguer dans le temps, le bouton Aujourd'hui recentre la vue sur la date du jour (matérialisée par une ligne verticale), et un mode plein écran maximise la surface d'affichage. Quand le parc est important, une pagination fait défiler les propriétés par groupes, et un bouton de filtres permet de restreindre l'affichage. Une légende identifie les canaux (Airbnb, Booking, Direct), les statuts de réservation et les interventions ; vous pouvez masquer ou afficher chaque canal et chaque statut d'un clic pour ne garder que ce qui vous intéresse. Au survol ou au clic d'une barre, une infobulle détaille la réservation (voyageur, dates, statut) ; un clic sur le nom d'un logement ouvre un aperçu de la propriété.

## Comment savoir si un logement est disponible à une date donnée ?

Sur le Planning, un créneau vide signifie que le logement est disponible : seules les nuits réservées, bloquées ou en maintenance portent une barre. Chaque jour du calendrier d'un logement a donc un état : disponible, réservé, bloqué ou maintenance. Le moteur de calendrier de Baitly est la source de vérité des disponibilités : il empêche toute double réservation (anti-surbooking) en refusant la création d'une réservation ou d'un blocage qui chevaucherait un événement existant, avec un message de conflit explicite (conflit avec une réservation, un ménage prévu, une maintenance ou un blocage). Lors de la création d'une réservation, le calendrier de sélection des dates grise également les nuits indisponibles. Les disponibilités sont propagées vers vos canaux connectés (Airbnb, Booking.com et autres) via la synchronisation, afin que les plateformes reflètent le même état que Baitly.

## Comment bloquer une période (travaux, séjour propriétaire) ?

Depuis le Planning, sélectionnez un créneau sur la ligne du logement concerné puis choisissez le mode Blocage (l'assistant de création rapide propose deux modes : Réservation ou Blocage). Choisissez le type de blocage : Bloqué (indisponible) pour un séjour propriétaire ou toute indisponibilité générique, ou Maintenance / Travaux pour des travaux planifiés. Vous pouvez ajouter une raison facultative (par exemple « séjour propriétaire » ou « travaux plomberie ») pour vous y retrouver. Validez avec Bloquer : les nuits concernées deviennent indisponibles à la réservation et apparaissent comme une bande de blocage sur le Planning. Le blocage est vérifié contre le calendrier comme une réservation : impossible de bloquer des dates déjà réservées. Les périodes bloquées sont également synchronisées vers vos canaux connectés pour fermer les disponibilités partout. Pour libérer les dates, supprimez simplement le blocage depuis le Planning.

## Comment créer ou modifier une réservation depuis le Planning ?

Le Planning n'est pas qu'une vue de consultation : c'est aussi un outil d'action rapide. Sélectionnez un créneau libre sur la ligne d'un logement pour ouvrir la création rapide, avec la propriété et les dates pré-remplies ; il ne reste qu'à choisir le voyageur et le tarif. Les barres de réservation se manipulent par glisser-déposer pour décaler ou étendre un séjour, avec un aperçu du déplacement avant validation ; le moteur de calendrier refuse tout déplacement qui créerait un conflit. Un clic sur une réservation ouvre son aperçu avec un accès aux actions (modifier, voir la fiche complète). Les couleurs des barres reflètent le canal d'origine (Airbnb, Booking, Direct) et le statut (en attente, confirmée, arrivé, parti), ce qui donne une lecture immédiate de l'activité de tout le parc.

## Où voir le planning des interventions (ménage, maintenance) ?

En complément du planning des réservations, Baitly propose une vue « Planning des interventions » : un calendrier de toutes les interventions planifiées (ménages, maintenances, réparations) avec leur date, leur type et leur statut. Sur le Planning des réservations, vous pouvez aussi activer l'affichage des interventions via la légende, pour visualiser les ménages et maintenances en regard des séjours : pratique pour vérifier qu'un nettoyage est bien prévu entre deux réservations. Les rôles opérationnels (technicien, agent de ménage, superviseur) y retrouvent leurs missions ; les interventions détaillées (assignation, photos avant/après, avancement) se gèrent dans le menu Interventions. Rappel utile : lorsqu'un check-out a lieu et que l'automatisation est activée, la demande de ménage est créée automatiquement à la date du départ.

## Comment importer les réservations de mes autres plateformes dans le calendrier ?

Depuis le Planning, l'action Importer des réservations propose deux méthodes. L'import iCal : vous collez le lien de calendrier (.ics) fourni par la plateforme externe (Airbnb, Booking, Vrbo et autres) ; Baitly importe alors les réservations en lecture seule et les resynchronise régulièrement. C'est la méthode simple et universelle, mais à sens unique. Le Channel Manager : vous connectez vos plateformes de distribution pour une synchronisation dans les deux sens : réservations, tarifs et disponibilités circulent entre Baitly et les canaux (ce qui évite les doubles réservations et diffuse vos prix). Les réservations importées apparaissent sur le Planning avec la couleur de leur canal d'origine et alimentent, comme les réservations directes, le déclenchement automatique du ménage au check-out.

## Questions fréquentes

**Pourquoi je ne peux pas déplacer une réservation sur certaines dates ?**
Les dates cibles sont en conflit avec une autre réservation, un blocage, un ménage ou une maintenance. Baitly bloque l'opération pour empêcher tout surbooking.

**Comment voir uniquement mes réservations Airbnb sur le Planning ?**
Utilisez la légende des canaux : cliquez sur les canaux à masquer pour ne conserver qu'Airbnb. Le même principe vaut pour les statuts.

**Un blocage est-il visible par les voyageurs ?**
Non, un blocage rend simplement les dates indisponibles à la réservation, dans Baitly comme sur vos canaux synchronisés.

**Quelle est la différence entre le Planning et le Planning des interventions ?**
Le Planning affiche les séjours et blocages par logement ; le Planning des interventions affiche les missions de ménage et de maintenance en vue calendrier. L'affichage des interventions peut aussi être superposé au Planning des réservations.
