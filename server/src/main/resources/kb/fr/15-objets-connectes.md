# Objets connectés : capteurs de bruit, serrures, caméras

## Où gérer les objets connectés de mes logements ?

Les objets connectés se gèrent dans la page Propriétés, onglet Objets connectés. Ce hub regroupe tous les appareils de vos logements par catégories : Serrures, Capteurs sonores, Remise des clés, Caméras et Thermostats. Vous y voyez l'état du parc en un coup d'œil (appareils hors ligne, batterie faible, alertes en cours), pouvez filtrer par type d'appareil, ouvrir la vue d'un logement précis ou le détail d'un appareil (données en temps réel, configuration, historique). L'ajout d'un appareil passe par un assistant « Ajouter un objet » : choisir le logement, éventuellement la pièce, nommer l'appareil et confirmer. Rôles concernés : l'hôte consulte et suit les appareils de ses logements ; la connexion des services fournisseurs est gérée au niveau plateforme (voir section dédiée).

## Qui peut connecter les services (Minut, Nuki, KeyNest...) et que voit l'hôte ?

Les connexions aux fournisseurs d'objets connectés — Minut (capteurs de bruit et température), Nuki (serrures connectées), KeyNest (réseau de remise de clés), Tuya (capteurs) — sont configurées dans l'onglet Intégrations des Paramètres, réservé aux gestionnaires de plateforme (super admin, super manager). L'hôte n'a donc pas à créer de comptes techniques : une fois le service relié par la plateforme, il voit ses appareils, leurs données et leurs alertes directement dans l'onglet Objets connectés de ses propriétés. Exception : les capteurs Netatmo suivent un modèle par hôte — chaque hôte connecte son propre compte Netatmo depuis le hub Objets connectés, à condition que l'administrateur ait préalablement activé le service dans les Intégrations. Si un service n'apparaît pas ou qu'une connexion semble inactive, contactez votre gestionnaire de plateforme.

## Comment fonctionnent les capteurs de bruit et les alertes bruit ?

Les capteurs de bruit (fournisseur Minut, ou capteurs compatibles) surveillent le niveau sonore d'un logement en continu, sans enregistrer les conversations — seuls les niveaux en décibels sont mesurés. Dans le détail d'un capteur (Propriétés, onglet Objets connectés, catégorie Capteurs sonores), vous trouvez : le niveau sonore actuel, une courbe de suivi avec les seuils affichés, un sous-onglet Configuration pour régler les seuils du logement, et un sous-onglet Historique listant les alertes passées. Quand le bruit dépasse le seuil configuré (fête, tapage nocturne), une alerte est déclenchée et l'hôte est notifié : il peut alors contacter le voyageur via la messagerie avant que la situation ne dégénère avec le voisinage. Certains capteurs remontent aussi la température. Rôles concernés : hôte et gestionnaires consultent, configurent les seuils et reçoivent les alertes.

## Comment fonctionnent les serrures connectées et les codes d'accès ?

Les serrures connectées (fournisseur Nuki) permettent un accès sans clé physique : un code d'accès est associé à chaque réservation, communiqué au voyageur, et renouvelé automatiquement entre les séjours pour la sécurité. Dans le détail d'une serrure (Propriétés, onglet Objets connectés, catégorie Serrures), vous suivez l'état de la serrure en temps réel et gérez l'origine du code d'accès : soit Baitly génère le code et le pousse à la serrure, soit la serrure génère son propre code et Baitly le récupère — le changement s'applique aux prochaines réservations. Si le logement dispose d'un livret d'accueil numérique, le déverrouillage de la porte peut être proposé au voyageur depuis son livret. Pour la remise de clés physiques, le service KeyNest (réseau de points de dépôt et d'échange de clés) est également intégré. Par sécurité, aucun code d'accès n'est jamais envoyé par email aux intervenants.

## Les caméras et thermostats sont-ils disponibles ?

Le hub Objets connectés comporte des espaces Caméras (supervision vidéo des logements, par exemple pour surveiller une entrée ou vérifier une arrivée) et Thermostats (confort thermique). Ces deux catégories sont présentées en aperçu : les écrans donnent un avant-goût de l'expérience à venir pendant le déploiement progressif de ces fonctionnalités. Rappel important sur le respect de la vie privée : les caméras concernent uniquement les extérieurs et accès des logements, jamais les espaces privés, conformément aux règles des plateformes de location et à la réglementation. Comme pour les autres objets connectés, l'activation des services vidéo relève des gestionnaires de plateforme ; l'hôte retrouve ensuite ses appareils dans l'onglet Objets connectés de ses propriétés.

## Questions fréquentes

**Un capteur de bruit enregistre-t-il les conversations des voyageurs ?**
Non. Il mesure uniquement le niveau sonore en décibels ; aucun son n'est enregistré. C'est ce qui le rend conforme et accepté dans les locations.

**Comment être prévenu si mes voyageurs font trop de bruit ?**
Installez un capteur de bruit, réglez les seuils du logement dans le détail du capteur (sous-onglet Configuration) : en cas de dépassement, une alerte est déclenchée et vous êtes notifié, avec l'historique consultable.

**Puis-je connecter moi-même mon compte Minut ou Nuki ?**
Non, ces connexions sont gérées par la plateforme (gestionnaires super admin et super manager, onglet Intégrations des Paramètres). Seul Netatmo se connecte par hôte, depuis le hub Objets connectés, après activation par l'administrateur.

**Le code de la serrure change-t-il à chaque réservation ?**
Oui, chaque réservation a son code, renouvelé automatiquement. Vous choisissez si le code est généré par Baitly et poussé à la serrure, ou généré par la serrure elle-même.

**Où le voyageur trouve-t-il son code d'accès ?**
Dans ses instructions d'arrivée (le digicode est repris automatiquement dans le livret d'accueil numérique) ; sur serrure compatible, le déverrouillage peut aussi se faire depuis le livret.
