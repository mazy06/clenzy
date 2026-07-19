# Messagerie et communication avec les voyageurs

## Où se trouve la messagerie et que regroupe-t-elle ?

La messagerie unifiée de Baitly est accessible depuis le menu Contact. Elle regroupe dans une même boîte de réception toutes vos conversations : les messages des voyageurs (guests) venant des plateformes connectées comme Airbnb et Booking (« Messagerie des plateformes »), les échanges par email et WhatsApp, et la messagerie interne entre membres de l'organisation. Chaque conversation affiche le fil complet des messages, avec compteur de non-lus, recherche, et possibilité de répondre directement depuis Baitly — la réponse part sur le canal d'origine de la conversation. Une conversation peut être assignée à un opérateur de l'équipe, marquée lue, ou archivée. Les messages arrivent en temps réel. Rôles concernés : hôtes et gestionnaires répondent aux voyageurs ; les utilisateurs restreints ne peuvent écrire qu'aux gestionnaires de leur périmètre.

## Quels canaux de communication sont disponibles ?

Baitly gère les canaux suivants : la messagerie des plateformes (Airbnb, Booking — disponible quand le canal est connecté via le gestionnaire de canaux), l'email (envoi transactionnel avec mise en forme), WhatsApp (via l'API officielle Meta), et la messagerie interne de l'organisation. WhatsApp est configuré et géré au niveau de la plateforme : une bannière dans la messagerie indique son état (actif, désactivé ou non configuré) ; si WhatsApp n'est pas actif pour votre organisation, contactez votre gestionnaire de plateforme. Particularité WhatsApp : en dehors de la fenêtre de conversation de 24 heures suivant le dernier message du voyageur, seul un modèle de message approuvé peut être envoyé — Baitly vous le signale le cas échéant. Les messages WhatsApp sortants sont signés avec le nom de l'hôte et du logement. Le SMS n'est pas un canal actif dans Baitly.

## Comment créer et utiliser des modèles de messages ?

Les modèles (templates) de messages se gèrent dans Documents et Communications, onglet des templates de messages. Vous pouvez créer vos propres modèles ou personnaliser les modèles système fournis par Baitly. Chaque modèle a un nom, un type, une langue, un objet et un corps ; le contenu accepte des variables dynamiques (par exemple le nom du voyageur ou le nom du logement) remplacées automatiquement à l'envoi par les informations de la réservation. Un aperçu permet de vérifier le rendu avant enregistrement. Les modèles WhatsApp sont un cas particulier : ils portent une catégorie Meta et doivent être approuvés par la plateforme WhatsApp avant usage. Les messages sortants basés sur des modèles peuvent être traduits automatiquement dans la langue du voyageur (une trentaine de langues supportées). L'historique des messages envoyés est consultable dans Documents et Communications, onglet Historique. Rôles concernés : gestionnaires et hôtes.

## Comment automatiser les messages aux voyageurs (check-in, check-out, relances) ?

Les messages automatiques se configurent dans la page Automatisations du menu. Une règle d'automatisation associe un déclencheur du cycle de vie de la réservation — réservation confirmée, check-in qui approche, jour du check-in, jour du check-out, après le départ, rappel d'avis — à un modèle de message et un canal d'envoi. Vous réglez le décalage en jours et l'heure d'envoi (9h par défaut), et pouvez ajouter des conditions pour cibler certaines réservations. Exemple typique : envoyer les instructions d'arrivée quelques heures ou jours avant le check-in, puis un message de remerciement après le départ. Chaque règle garde un historique de ses exécutions, et un même message n'est jamais envoyé deux fois pour la même réservation. Les anciens réglages de check-in et check-out automatiques de la messagerie ont été déplacés vers cette page Automatisations. Rôles concernés : gestionnaires et hôtes.

## Comment fonctionnent les notifications dans Baitly ?

Baitly notifie les bons interlocuteurs au fil des événements : nouveau message de voyageur, conversation assignée à un opérateur, intervention attribuée (avec la rémunération pour le prestataire), anomalie signalée, versement envoyé, alertes diverses. Les notifications arrivent dans le centre de notifications de l'application web (cloche), et pour les équipes terrain également en notification push sur l'application mobile (la notification ouvre directement la mission concernée) et par email pour certains événements comme l'assignation d'une mission. Chaque utilisateur règle ses préférences de notification dans ses Réglages : une notification désactivée coupe l'ensemble de ses canaux. Règle de confidentialité : chacun ne voit que les montants qui le concernent (le prestataire sa rémunération, l'hôte le prix facturé), et aucun code d'accès de logement n'est jamais envoyé par email.

## Questions fréquentes

**Puis-je répondre à un message Airbnb directement depuis Baitly ?**
Oui, si le canal est connecté via le gestionnaire de canaux : la conversation apparaît dans la messagerie des plateformes et votre réponse est renvoyée vers Airbnb ou Booking.

**Pourquoi mon message WhatsApp ne part-il pas ?**
Soit WhatsApp n'est pas actif pour votre organisation (voir la bannière d'état dans la messagerie, activation gérée par la plateforme), soit la fenêtre de 24 heures est expirée et il faut utiliser un modèle WhatsApp approuvé.

**Puis-je envoyer des SMS aux voyageurs ?**
Non, le SMS n'est pas un canal actif dans Baitly. Utilisez l'email ou WhatsApp ; les communications automatiques passent par ces canaux.

**Comment envoyer automatiquement les instructions d'arrivée ?**
Créez une règle dans Automatisations avec le déclencheur d'approche du check-in, choisissez votre modèle d'instructions et le canal, puis réglez le délai avant l'arrivée et l'heure d'envoi.

**Les voyageurs reçoivent-ils mes messages dans leur langue ?**
Les messages basés sur des modèles peuvent être traduits automatiquement vers la langue du voyageur ; vous pouvez aussi créer un modèle par langue.
