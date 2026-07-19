# Utilisateurs, rôles et permissions dans Baitly

## Quels sont les rôles utilisateur dans Baitly ?

Baitly distingue les rôles de plateforme et les rôles d'organisation. Côté plateforme : le Super Admin (accès complet à tout Baitly) et le Super Manager (gestion et lecture transverse sur toutes les organisations) ; ces deux rôles sont réservés à l'équipe Baitly. Côté organisation : le Propriétaire / hôte (gestion complète de ses logements, réservations, tarifs, contrats), le Superviseur (supervision des équipes terrain et des interventions), le Technicien (interventions de maintenance et réparations), l'Agent de ménage / housekeeper (interventions de nettoyage et inventaire), ainsi que des rôles opérationnels spécialisés comme Blanchisserie et Technicien extérieur, et un rôle Membre générique. Enfin, les voyageurs qui réservent via le moteur de réservation ont un compte invité séparé, sans accès au back-office. Chaque rôle voit un menu et un tableau de bord adaptés : un technicien voit ses interventions, un hôte voit ses propriétés et ses revenus.

## Comment inviter un membre de mon équipe ?

L'invitation se fait depuis Paramètres, onglet « Organisation » (section équipe de votre organisation). Deux modes existent : « Inviter par email » — vous saisissez l'adresse email de la personne et choisissez son rôle dans l'organisation ; elle reçoit un email d'invitation avec un lien (que vous pouvez aussi copier et transmettre vous-même) ; l'invitation a une date d'expiration affichée après l'envoi. Ou bien ajouter directement un utilisateur existant de la plateforme en le sélectionnant et en lui attribuant un rôle. La personne invitée clique sur le lien, crée son compte (ou se connecte) et rejoint automatiquement votre organisation avec le rôle choisi. La liste des invitations en cours est visible au même endroit. L'invitation de membres fait aussi partie des étapes suggérées lors de la prise en main initiale de Baitly (« Inviter des membres »).

## Comment configurer les permissions des rôles ?

Le menu « Roles & Permissions » (réservé aux administrateurs) permet de modifier finement ce que chaque rôle peut faire, module par module. Sélectionnez un rôle, puis activez ou désactivez chaque permission d'un clic : par exemple voir, créer, modifier ou supprimer les propriétés, les demandes de service, les interventions, les équipes ; consulter ou modifier les paramètres ; gérer les utilisateurs ; accéder aux rapports. Les changements s'appliquent en temps réel à l'interface (les menus et boutons apparaissent ou disparaissent), un onglet de démonstration montre l'effet des permissions sur la navigation, et deux boutons permettent de réinitialiser aux valeurs par défaut ou de sauvegarder définitivement. En pratique : la suppression (propriétés, interventions, équipes) est réservée aux administrateurs par défaut, la gestion des utilisateurs également, et les rapports sont ouverts aux administrateurs et managers.

## Qui voit quoi dans Baitly ?

L'affichage est doublement filtré : par organisation et par rôle. Chaque organisation ne voit que ses propres données (logements, réservations, finances) — c'est une isolation stricte, seuls les rôles plateforme Baitly peuvent voir plusieurs organisations. Au sein de l'organisation, le rôle détermine les modules accessibles : le tableau de bord est visible par tous mais ses indicateurs s'adaptent (un hôte voit ses propriétés et revenus, un technicien voit ses interventions) ; l'onglet Analytics complet du tableau de bord est réservé aux rôles de gestion (administrateur, manager, superviseur) ; les équipes sont visibles par les rôles terrain mais gérées par les superviseurs et managers ; les paramètres et la configuration des permissions sont réservés aux administrateurs. Un hôte ne voit que ses propres logements et demandes. Les tentatives d'accès non autorisées sont bloquées aussi bien dans l'interface que côté serveur.

## Comment gérer les comptes utilisateurs existants ?

Le menu « Utilisateurs » (ou « Utilisateurs et Organisations » pour l'équipe plateforme) liste les comptes : nom, prénom, email, rôle. Vous pouvez créer un utilisateur (« Nouvel utilisateur »), consulter sa fiche, modifier ses informations et son rôle. Pour les prestataires terrain (techniciens, agents de ménage), la fiche donne aussi accès à leurs tarifs et à leur score qualité via la fenêtre « Tarifs & score ». La gestion des utilisateurs requiert la permission dédiée, détenue par les administrateurs. Notez qu'un membre peut avoir un rôle global sur la plateforme et un rôle spécifique dans votre organisation : c'est le rôle dans l'organisation qui gouverne ce qu'il peut faire chez vous.

## Questions fréquentes

**Comment ajouter un agent de ménage à mon équipe ?**
Paramètres, onglet Organisation : invitez-le par email en choisissant le rôle agent de ménage. Il recevra un lien d'invitation pour créer son compte et rejoindre votre organisation.

**Un technicien peut-il voir mes revenus ?**
Non. Le tableau de bord d'un technicien est centré sur ses interventions ; les indicateurs financiers et l'onglet Analytics sont réservés aux rôles de gestion.

**Le lien d'invitation a expiré, que faire ?**
Renvoyez une nouvelle invitation depuis Paramètres, onglet Organisation. La date d'expiration du nouveau lien est affichée après l'envoi.

**Puis-je personnaliser ce qu'un rôle a le droit de faire ?**
Oui, via le menu Roles & Permissions (administrateurs uniquement) : chaque permission s'active ou se désactive par module, avec sauvegarde et retour possible aux valeurs par défaut.

**Qui peut supprimer une propriété ?**
Par défaut, seuls les administrateurs disposent des permissions de suppression (propriétés, interventions, équipes). Ce réglage est modifiable dans Roles & Permissions.
