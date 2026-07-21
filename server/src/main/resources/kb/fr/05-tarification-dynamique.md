# Tarification et prix dynamiques dans Baitly

## Où gérer les prix de mes logements ?

La tarification des nuitées se gère dans la page Prix dynamiques (accessible aussi depuis la page Propriétés, onglet Prix dynamique). Elle est organisée en trois onglets : Par propriété (les plans tarifaires et le calendrier des prix d'un logement donné), Vue d'ensemble (panorama des prix sur le parc) et Yield (règles d'ajustement automatique selon l'occupation). Sélectionnez d'abord une propriété dans le filtre pour visualiser et ajuster son calendrier de prix ; un filtre par propriétaire aide à naviguer si vous gérez les biens de plusieurs hôtes. Le point de départ de tout logement est son prix par nuit, défini sur sa fiche (menu Propriétés) : c'est le prix de repli utilisé quand aucune règle tarifaire ne s'applique. Tout le reste (saisons, promotions, prix spécifiques, yield) vient affiner ce prix de base.

## Comment définir un prix de base et des prix saisonniers ?

Dans Prix dynamiques, onglet Par propriété, la section Plans tarifaires permet de créer des plans avec le bouton Nouveau plan. Chaque plan a un nom, un type, un prix par nuit, une priorité, une période d'application (date de début et date de fin) et éventuellement des jours de la semaine ciblés ; il peut être actif ou inactif. Quatre types de plans existent : Base (le tarif standard du logement), Saisonnier (un prix différent pour une saison, par exemple l'été ou les vacances scolaires), Promotion (un tarif réduit sur une période) et Dernière minute (un tarif pour les réservations proches de la date d'arrivée). Exemple : un plan Base à 80 euros la nuit toute l'année, un plan Saisonnier à 120 euros de juillet à août, un plan Promotion à 65 euros sur une quinzaine creuse. Vous pouvez modifier ou supprimer un plan à tout moment ; un plan inactif est conservé mais ignoré dans le calcul.

## Comment fixer un prix ponctuel sur une date précise (override) ?

Pour déroger au tarif calculé sur une ou plusieurs nuits précises, utilisez les prix spécifiques (surcharges manuelles). Dans Prix dynamiques, onglet Par propriété, la section Prix spécifiques propose Ajouter un prix spécifique pour une date, ou Appliquer sur une période pour poser le même prix sur une plage de dates. Vous pouvez aussi cliquer directement sur un jour du calendrier des prix et choisir Modifier le prix. Un prix spécifique est prioritaire sur tout le reste : il l'emporte sur les promotions, les prix saisonniers et le plan de base. C'est l'outil idéal pour un événement local (festival, salon, jour férié) où vous voulez fixer un montant précis à la main. Le calendrier des prix indique pour chaque nuit la source du prix affiché : Manuel (prix spécifique), Promotion, Saisonnier, Dernière minute, Plan de base ou Prix par défaut du logement. Pour revenir au prix calculé, supprimez simplement le prix spécifique.

## Dans quel ordre les règles de prix s'appliquent-elles ?

Pour chaque nuit, Baitly résout le prix en cascade, du plus prioritaire au plus général : d'abord un éventuel prix spécifique posé à la main (toujours gagnant), puis les plans par ordre de priorité, promotion avant prix saisonnier, la dernière minute s'appliquant à l'approche de la date d'arrivée, puis le plan de base ; en l'absence de tout plan, c'est le prix par nuit de la fiche du logement qui s'applique. La source retenue est visible sur le calendrier des prix, nuit par nuit, ce qui permet de comprendre d'où vient chaque montant affiché. Ce prix des nuitées est ensuite complété, au moment de la réservation, par les frais annexes (frais de ménage, taxe de séjour par personne et par nuit) qui ne font pas partie du prix par nuit. Les prix résolus sont également diffusés vers vos canaux connectés via la synchronisation, afin que vos annonces externes reflètent la même grille tarifaire.

## Comment fonctionnent les règles de yield (ajustement automatique selon l'occupation) ?

L'onglet Yield de la page Prix dynamiques automatise les ajustements de prix selon le remplissage. Vous créez des règles d'occupation du type : « si l'occupation est inférieure à 40 % à 30 jours, baisser de 5 % » ou « si l'occupation est supérieure à 85 % à 60 jours, augmenter de 10 % ». Chaque règle définit un périmètre (tous les biens ou un bien précis), une condition (occupation inférieure ou supérieure à un seuil en pourcentage, mesurée à un horizon en jours), un ajustement en pourcentage (baisse ou hausse) et un plafond d'ajustement par jour, et peut être activée ou désactivée. Trois modes d'exécution existent : Simulation (rapport de ce qui aurait changé, aucune écriture tarifaire), Suggestion (des propositions à approuver, montants recalculés à l'application) et Automatique (application directe des ajustements). Un interrupteur général « Yield automatique activé » permet de tout couper d'un geste.

## Quels garde-fous pour éviter des prix aberrants avec le yield automatique ?

Le yield automatique est encadré par des garde-fous par bien : pour chaque logement, vous définissez un prix plancher et un prix plafond en euros. Ces deux bornes sont obligatoires pour que le yield agisse : sans plancher et plafond renseignés, le logement est simplement ignoré par les règles automatiques (et l'exclusion est journalisée). Le mode Automatique ne peut donc jamais descendre sous votre plancher ni dépasser votre plafond, et le plafond d'ajustement par jour limite l'amplitude quotidienne des variations. Un journal des ajustements trace tout ce que le yield a fait ou proposé : pour chaque entrée, la date d'évaluation, la nuit concernée, le bien, le mode, le prix avant et après, le taux d'occupation constaté et le détail de la décision. Conseil : démarrez en mode Simulation pour observer le comportement des règles, passez en Suggestion pour valider au cas par cas, puis en Automatique quand vous êtes en confiance.

## Questions fréquentes

**Quel prix s'applique si je n'ai configuré aucun plan tarifaire ?**
Le prix par nuit défini sur la fiche du logement. Les plans et prix spécifiques ne font qu'affiner ce tarif de repli.

**Un prix spécifique est-il écrasé par le yield automatique ?**
Le prix spécifique est le niveau le plus prioritaire de la grille : c'est votre décision manuelle qui prime sur la tarification calculée.

**Puis-je tester mes règles de yield sans toucher à mes prix ?**
Oui, choisissez le mode Simulation : Baitly produit un rapport de ce qui aurait changé, sans aucune écriture tarifaire.

**Baitly a-t-il besoin d'un outil de tarification externe ?**
Non : Baitly intègre son propre moteur de revenue management. Les règles de yield ajustent les prix selon l'occupation, le comblement automatique des nuits orphelines et le séjour minimum dynamique optimisent les creux, et les recommandations restent validables par vous (mode simulation, suggestion ou automatique). Aucun abonnement tiers n'est requis.

**Comment faire une réduction ponctuelle pour remplir une période creuse ?**
Créez un plan de type Promotion sur la période visée, ou une règle de yield de baisse conditionnée à une occupation faible, ou encore un prix spécifique appliqué sur la période.
