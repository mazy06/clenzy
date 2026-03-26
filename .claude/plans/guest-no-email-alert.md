# Alerte host quand un guest n'a pas d'email pour le check-in

## Contexte

Le `GuestMessagingScheduler` détecte les réservations sans email guest et log un warning, mais le host n'est jamais prévenu. Il faut envoyer une notification in-app aux admins/managers de l'organisation.

## Changements

### 1. Ajouter la clé de notification `GUEST_NO_EMAIL_FOR_CHECKIN`

**Fichier** : `server/src/main/java/com/clenzy/model/NotificationKey.java`

- Ajouter dans la section GUEST MESSAGING :
  ```java
  GUEST_NO_EMAIL_FOR_CHECKIN(NotificationType.WARNING, NotificationCategory.GUEST_MESSAGING, true),
  ```
- Le commentaire passe de `(3 cles)` à `(4 cles)`

### 2. Injecter `NotificationService` dans `GuestMessagingScheduler`

**Fichier** : `server/src/main/java/com/clenzy/scheduler/GuestMessagingScheduler.java`

- Ajouter `NotificationService` en dépendance du constructeur
- Dans `processCheckIn()` et `processCheckOut()`, quand `hasValidRecipient()` retourne false, appeler :
  ```java
  notificationService.notifyAdminsAndManagersByOrgId(
      orgId,
      NotificationKey.GUEST_NO_EMAIL_FOR_CHECKIN,
      "Email manquant pour le voyageur",
      "La réservation #" + reservation.getId()
          + " (" + reservation.getProperty().getName() + ")"
          + " n'a pas d'email voyageur configuré. Le message de check-in/check-out ne peut pas être envoyé.",
      "/reservations/" + reservation.getId()
  );
  ```
- Ajouter une garde anti-spam : ne notifier qu'une fois par réservation en utilisant `messagingService.alreadySent()` ou un simple Set local au run

### 3. Traductions (i18n)

**Fichiers** : `client/src/i18n/locales/{fr,en,ar}.json`

- Ajouter les clés pour le type de notification dans les préférences (si applicable)

## Ce qui ne change PAS

- Pas de nouveau endpoint API
- Pas de migration DB
- Pas de changement frontend (la notification apparaît via le système existant de notifications in-app)

## Complexité

Faible — ~30 lignes de code modifiées, 2 fichiers backend.
